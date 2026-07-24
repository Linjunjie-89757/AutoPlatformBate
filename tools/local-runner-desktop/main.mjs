import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCT_NAME = 'Auto Platform Local Runner';
const DEFAULT_PORT = 39118;
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080';
const MAX_LOG_LINES = 300;

app.setName(PRODUCT_NAME);

let mainWindow;
let tray;
let runnerProcess;
let runnerStartedAt;
let desktopConfig;
let logStream;
let logLines = [];

const appPaths = {
  config: () => join(app.getPath('userData'), 'desktop-config.json'),
  logs: () => join(app.getPath('userData'), 'logs'),
  runnerData: () => join(app.getPath('userData'), 'runner-data'),
};

const projectRootPath = () => (app.isPackaged ? app.getAppPath() : join(__dirname, '..', '..'));
const runnerScriptPath = () => join(projectRootPath(), 'tools', 'web-ui-runner', 'server.mjs');

const defaultConfig = () => ({
  apiBaseUrl: DEFAULT_API_BASE_URL,
  port: DEFAULT_PORT,
  runnerName: `${hostname()} Local Runner`,
  autoStart: true,
});

async function readDesktopConfig() {
  try {
    const raw = await readFile(appPaths.config(), 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch {
    return defaultConfig();
  }
}

function normalizeConfig(input = {}) {
  const fallback = defaultConfig();
  const port = Number.parseInt(String(input.port || ''), 10);
  return {
    apiBaseUrl: normalizeUrl(input.apiBaseUrl) || fallback.apiBaseUrl,
    port: Number.isFinite(port) && port > 0 ? port : fallback.port,
    runnerName: typeof input.runnerName === 'string' && input.runnerName.trim()
      ? input.runnerName.trim()
      : fallback.runnerName,
    autoStart: input.autoStart !== false,
  };
}

function normalizeUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.replace(/\/+$/, '');
}

async function saveDesktopConfig(nextConfig) {
  desktopConfig = normalizeConfig(nextConfig);
  await mkdir(dirname(appPaths.config()), { recursive: true });
  await writeFile(appPaths.config(), `${JSON.stringify(desktopConfig, null, 2)}\n`, 'utf8');
  return getState();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 660,
    minWidth: 760,
    minHeight: 560,
    title: PRODUCT_NAME,
    backgroundColor: '#f4f6fa',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARUlEQVR4AWP4//8/AyUYTFhZWYENwESJ5RkZGQYGhr8wMDD8R5omgGJgYGBkYGBg+I8iSLAQkgwMDIwMDAwMDAx/AwB4IwcjTxU4kwAAAABJRU5ErkJggg==',
  );
  tray = new Tray(icon);
  tray.setToolTip(PRODUCT_NAME);
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', showMainWindow);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '打开 Local Runner', click: showMainWindow },
    {
      label: isRunnerRunning() ? '停止 Runner' : '启动 Runner',
      click: () => {
        if (isRunnerRunning()) {
          void stopRunner();
        } else {
          void startRunner();
        }
      },
    },
    { label: '打开日志目录', click: () => shell.openPath(appPaths.logs()) },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        void stopRunner().finally(() => app.quit());
      },
    },
  ]);
}

function refreshTray() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
    tray.setToolTip(`${PRODUCT_NAME} - ${isRunnerRunning() ? '运行中' : '未运行'}`);
  }
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

async function startRunner() {
  if (isRunnerRunning()) {
    return getState();
  }

  await mkdir(appPaths.logs(), { recursive: true });
  await mkdir(appPaths.runnerData(), { recursive: true });
  if (!desktopConfig) {
    desktopConfig = await readDesktopConfig();
  }

  const logPath = join(appPaths.logs(), 'local-runner-desktop.log');
  logStream = createWriteStream(logPath, { flags: 'a' });
  appendLog(`[desktop] starting ${runnerScriptPath()}`);

  runnerProcess = spawn(process.execPath, [
    runnerScriptPath(),
    `--port=${desktopConfig.port}`,
    `--runner-name=${desktopConfig.runnerName}`,
    `--data-dir=${appPaths.runnerData()}`,
    '--start-command=Auto Platform Local Runner',
  ], {
    cwd: projectRootPath(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      WEB_UI_RUNNER_PORT: String(desktopConfig.port),
      WEB_UI_RUNNER_NAME: desktopConfig.runnerName,
      WEB_UI_RUNNER_DATA_DIR: appPaths.runnerData(),
      WEB_UI_RUNNER_START_COMMAND: 'Auto Platform Local Runner',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  runnerStartedAt = new Date().toISOString();

  runnerProcess.stdout?.on('data', (chunk) => appendLog(String(chunk)));
  runnerProcess.stderr?.on('data', (chunk) => appendLog(String(chunk)));
  runnerProcess.on('exit', (code, signal) => {
    appendLog(`[desktop] runner exited: code=${code ?? '-'} signal=${signal ?? '-'}`);
    runnerProcess = undefined;
    runnerStartedAt = undefined;
    closeLogStream();
    refreshTray();
    pushState();
  });

  refreshTray();
  pushState();
  return getState();
}

async function stopRunner() {
  if (!runnerProcess) {
    return getState();
  }

  const child = runnerProcess;
  appendLog('[desktop] stopping runner');
  runnerProcess = undefined;
  runnerStartedAt = undefined;
  child.kill('SIGTERM');

  setTimeout(() => {
    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }
  }, 3000).unref?.();

  refreshTray();
  pushState();
  return getState();
}

function isRunnerRunning() {
  return Boolean(runnerProcess && !runnerProcess.killed);
}

async function getState() {
  const config = desktopConfig || await readDesktopConfig();
  return {
    productName: PRODUCT_NAME,
    config,
    process: {
      running: isRunnerRunning(),
      pid: runnerProcess?.pid || null,
      startedAt: runnerStartedAt || null,
    },
    health: await fetchRunnerJson('/health', config.port),
    taskPoll: await fetchRunnerJson('/tasks/poll/status', config.port),
    logLines,
    paths: {
      appData: app.getPath('userData'),
      logDir: appPaths.logs(),
      runnerDataDir: appPaths.runnerData(),
    },
    capabilities: [
      { key: 'WEB_UI', label: 'Web UI 自动化', enabled: true },
      { key: 'API', label: '接口自动化', enabled: true },
      { key: 'APP', label: 'APP 自动化', enabled: false },
    ],
  };
}

async function fetchRunnerJson(pathname, port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    return await response.json();
  } catch (error) {
    return {
      success: false,
      offline: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function connectPlatform() {
  const config = desktopConfig || await readDesktopConfig();
  const response = await fetch(`http://127.0.0.1:${config.port}/tasks/poll/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiBaseUrl: config.apiBaseUrl,
      runnerName: config.runnerName,
    }),
  });
  const result = await response.json();
  pushState();
  return result;
}

async function disconnectPlatform() {
  const config = desktopConfig || await readDesktopConfig();
  const response = await fetch(`http://127.0.0.1:${config.port}/tasks/poll/stop`, {
    method: 'POST',
  });
  const result = await response.json();
  pushState();
  return result;
}

function appendLog(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  for (const line of lines) {
    const value = `${new Date().toISOString()} ${line}`;
    logLines.push(value);
    logStream?.write(`${value}\n`);
  }
  if (logLines.length > MAX_LOG_LINES) {
    logLines = logLines.slice(-MAX_LOG_LINES);
  }
  pushState();
}

function closeLogStream() {
  logStream?.end();
  logStream = undefined;
}

function pushState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    void getState().then((state) => {
      mainWindow?.webContents.send('runner:state', state);
    });
  }
}

ipcMain.handle('runner:get-state', () => getState());
ipcMain.handle('runner:start', () => startRunner());
ipcMain.handle('runner:stop', () => stopRunner());
ipcMain.handle('runner:save-config', (_, config) => saveDesktopConfig(config));
ipcMain.handle('runner:connect-platform', () => connectPlatform());
ipcMain.handle('runner:disconnect-platform', () => disconnectPlatform());
ipcMain.handle('runner:open-logs', () => shell.openPath(appPaths.logs()));

app.whenReady().then(async () => {
  desktopConfig = await readDesktopConfig();
  createTray();
  await createWindow();
  if (desktopConfig.autoStart) {
    await startRunner();
  } else {
    pushState();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  } else {
    showMainWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {});
