import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('replays file chooser upload steps triggered by a button', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'recording-file-picker-'));
  const uploadPath = join(tempDir, 'picker-demo.txt');
  await writeFile(uploadPath, 'file-picker-content', 'utf8');

  const runnerPort = await findAvailablePort();
  let appPort = await findAvailablePort();
  while (appPort === runnerPort) appPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort || platformPort === appPort) platformPort = await findAvailablePort();

  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = { register: [], pull: [], steps: [], results: [] };
  let taskPulled = false;

  const app = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', appBaseUrl);
    if (url.pathname === '/file-picker') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildFilePickerPageHtml());
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  const platform = createHttpServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_recording_file_picker',
          runnerToken: 'runner_token',
          protocolVersion: '1.0',
          accepted: true,
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/pull') {
      reports.pull.push(body);
      if (taskPulled) {
        return sendJson(response, 200, {
          success: true,
          data: { hasTask: false, serverTime: new Date().toISOString(), pollIntervalMs: 1000, task: null },
        });
      }
      taskPulled = true;
      return sendJson(response, 200, {
        success: true,
        data: {
          hasTask: true,
          serverTime: new Date().toISOString(),
          pollIntervalMs: 1000,
          task: buildFilePickerTask(appBaseUrl, uploadPath),
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_file_picker/status') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_file_picker/logs') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_file_picker/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_file_picker/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }
    return sendJson(response, 404, { success: false, message: `Unexpected route: ${request.method} ${url.pathname}` });
  });

  await listen(app, appPort);
  await listen(platform, platformPort);

  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, WEB_UI_RUNNER_PORT: String(runnerPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'recording-file-picker',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);
    await waitFor(() => reports.results.length > 0, 20000, 'runner did not report file picker result');

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS', 'SUCCESS']);
    assert.equal(reports.steps[1].extra.filePicker.filePath, uploadPath);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(platform);
    await closeServer(app);
    await rm(tempDir, { recursive: true, force: true });
  }

  assert.deepEqual(stderr, []);
});

function buildFilePickerTask(appBaseUrl, uploadPath) {
  return {
    runId: 'run_recording_file_picker',
    taskType: 'WEB_CASE_RUN',
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_recording_file_picker',
    workspaceCode: 'account-open',
    userId: '1',
    protocolVersion: '1.0',
    priority: 'MANUAL',
    resourceCost: 5,
    createdAt: new Date().toISOString(),
    deadlineAt: null,
    timeoutPolicy: {},
    environmentSnapshot: {},
    variableSnapshot: {},
    scriptSnapshot: {},
    artifactRefs: [],
    maskingRules: [],
    screenshotPolicy: {},
    payload: {
      caseSnapshot: {
        caseId: 2005,
        caseName: 'Recording file picker replay',
        baseUrl: '',
        headless: true,
        defaultTimeoutMs: 5000,
        steps: [
          {
            stepId: 'open-file-picker',
            stepName: 'Open file picker page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/file-picker`,
            enabled: true,
            sortOrder: 1,
          },
          {
            stepId: 'choose-file',
            stepName: 'Choose upload file',
            stepType: 'FILE_PICKER',
            locatorType: 'TEST_ID',
            locatorValue: 'choose-file',
            inputValue: uploadPath,
            enabled: true,
            sortOrder: 2,
          },
          {
            stepId: 'assert-file-picker',
            stepName: 'Assert file picker result',
            stepType: 'ASSERT_TEXT',
            locatorType: 'CSS',
            locatorValue: '#file-result',
            inputValue: 'file-picker-content',
            enabled: true,
            sortOrder: 3,
          },
        ],
      },
      runOptions: { debugMode: true },
    },
  };
}

function buildFilePickerPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>File Picker Replay</title></head>',
    '<body>',
    '<button type="button" data-testid="choose-file" id="choose-file">Choose file</button>',
    '<input id="hidden-file" type="file" style="display:none">',
    '<p id="file-result">waiting</p>',
    '<script>',
    'const input = document.querySelector("#hidden-file");',
    'document.querySelector("#choose-file").addEventListener("click", () => input.click());',
    'input.addEventListener("change", async () => {',
    '  const file = input.files && input.files[0];',
    '  document.querySelector("#file-result").textContent = file ? await file.text() : "empty";',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

async function waitForRunnerHealth(baseUrl) {
  await waitFor(async () => {
    const health = await getJson(baseUrl, '/health').catch(() => null);
    return health?.success ? health : null;
  }, 10000, 'runner did not start');
}

async function waitFor(fn, timeoutMs = 10000, message = 'condition timed out') {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error(message);
}

async function getJson(baseUrl, path) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function listen(server, port) {
  const listening = once(server, 'listening');
  server.listen(port, '127.0.0.1');
  await listening;
}

async function closeServer(server) {
  if (!server.listening) return;
  const closed = once(server, 'close');
  server.close();
  await closed;
}

async function stopRunnerProcess(runner) {
  if (runner.exitCode !== null || runner.signalCode !== null) return;
  const exited = once(runner, 'exit');
  runner.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
  if (runner.exitCode === null && runner.signalCode === null) {
    const killed = once(runner, 'exit');
    runner.kill('SIGKILL');
    await Promise.race([killed, new Promise(resolve => setTimeout(resolve, 1000))]);
  }
}

async function findAvailablePort() {
  const server = createNetServer();
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return port;
}
