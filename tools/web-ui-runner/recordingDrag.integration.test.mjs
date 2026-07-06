import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test } from 'node:test';

test('replays drag-to steps with a structured target locator', async () => {
  const runnerPort = await findAvailablePort();
  let appPort = await findAvailablePort();
  while (appPort === runnerPort) {
    appPort = await findAvailablePort();
  }
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort || platformPort === appPort) {
    platformPort = await findAvailablePort();
  }

  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = { register: [], pull: [], steps: [], results: [] };
  let taskPulled = false;

  const app = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', appBaseUrl);
    if (url.pathname === '/drag-page') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildDragPageHtml());
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
          runnerId: 'runner_recording_drag',
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
          task: buildDragTask(appBaseUrl),
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_drag/status') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_drag/logs') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_drag/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_drag/result') {
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
      installId: 'recording-drag',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);
    await waitFor(() => reports.results.length > 0, 20000, 'runner did not report drag result');

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.total, 3);
    assert.equal(reports.results[0].summary.passed, 3);
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS', 'SUCCESS']);
    assert.deepEqual(reports.steps[1].extra.dragTarget, {
      locatorType: 'TEST_ID',
      locatorValue: 'drop-target',
    });
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(platform);
    await closeServer(app);
  }

  assert.deepEqual(stderr, []);
});

function buildDragTask(appBaseUrl) {
  return {
    runId: 'run_recording_drag',
    taskType: 'WEB_CASE_RUN',
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_recording_drag',
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
        caseId: 2003,
        caseName: 'Recording drag replay',
        baseUrl: '',
        headless: true,
        defaultTimeoutMs: 5000,
        steps: [
          {
            stepId: 'open-drag',
            stepName: 'Open drag page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/drag-page`,
            enabled: true,
            sortOrder: 1,
          },
          {
            stepId: 'drag-source',
            stepName: 'Drag source to drop target',
            stepType: 'DRAG_TO',
            locatorType: 'TEST_ID',
            locatorValue: 'drag-source',
            inputValue: 'TEST_ID=drop-target',
            enabled: true,
            sortOrder: 2,
          },
          {
            stepId: 'assert-drag-result',
            stepName: 'Assert drag result',
            stepType: 'ASSERT_TEXT',
            locatorType: 'CSS',
            locatorValue: '#drag-result',
            inputValue: 'dropped',
            enabled: true,
            sortOrder: 3,
          },
        ],
      },
      runOptions: { debugMode: true },
    },
  };
}

function buildDragPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Drag Replay</title>',
    '<style>',
    'body { font-family: sans-serif; padding: 32px; }',
    '#drag-source, #drop-target { width: 160px; height: 80px; display: grid; place-items: center; border: 2px solid #333; margin: 18px; }',
    '#drag-source { background: #dff3ff; cursor: grab; }',
    '#drop-target { background: #f7f7f7; }',
    '</style>',
    '</head>',
    '<body>',
    '<div id="drag-source" data-testid="drag-source" draggable="true">Drag me</div>',
    '<div id="drop-target" data-testid="drop-target">Drop here</div>',
    '<p id="drag-result">waiting</p>',
    '<script>',
    'const source = document.querySelector("[data-testid=\\"drag-source\\"]");',
    'const target = document.querySelector("[data-testid=\\"drop-target\\"]");',
    'source.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", "source"));',
    'target.addEventListener("dragover", event => event.preventDefault());',
    'target.addEventListener("drop", event => { event.preventDefault(); document.querySelector("#drag-result").textContent = event.dataTransfer.getData("text/plain") === "source" ? "dropped" : "failed"; });',
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
  if (chunks.length === 0) {
    return {};
  }
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
  if (runner.exitCode !== null) return;
  const exited = once(runner, 'exit');
  runner.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  if (runner.exitCode === null) {
    const killed = once(runner, 'exit');
    runner.kill('SIGKILL');
    await Promise.race([
      killed,
      new Promise(resolve => setTimeout(resolve, 1000)),
    ]);
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
