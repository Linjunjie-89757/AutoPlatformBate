import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test } from 'node:test';

test('replays coordinate drag steps inside a canvas-like target', async () => {
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
    if (url.pathname === '/canvas-drag') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildCanvasDragPageHtml());
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
          runnerId: 'runner_recording_coordinate_drag',
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
          task: buildCoordinateDragTask(appBaseUrl),
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_coordinate_drag/status') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_coordinate_drag/logs') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_coordinate_drag/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_coordinate_drag/result') {
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
      installId: 'recording-coordinate-drag',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);
    await waitFor(() => reports.results.length > 0, 20000, 'runner did not report coordinate drag result');

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS', 'SUCCESS']);
    assert.equal(reports.steps[1].extra.dragCoordinates.relativeTo, 'element');
    assert.deepEqual(reports.steps[1].extra.dragCoordinates.from, { x: 10, y: 10 });
    assert.deepEqual(reports.steps[1].extra.dragCoordinates.to, { x: 180, y: 120 });
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(platform);
    await closeServer(app);
  }

  assert.deepEqual(stderr, []);
});

function buildCoordinateDragTask(appBaseUrl) {
  return {
    runId: 'run_recording_coordinate_drag',
    taskType: 'WEB_CASE_RUN',
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_recording_coordinate_drag',
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
        caseId: 2004,
        caseName: 'Recording coordinate drag replay',
        baseUrl: '',
        headless: true,
        defaultTimeoutMs: 5000,
        steps: [
          {
            stepId: 'open-canvas-drag',
            stepName: 'Open canvas drag page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/canvas-drag`,
            enabled: true,
            sortOrder: 1,
          },
          {
            stepId: 'coordinate-drag-canvas',
            stepName: 'Drag inside canvas',
            stepType: 'DRAG_COORDINATES',
            locatorType: 'TEST_ID',
            locatorValue: 'paint-canvas',
            inputValue: '10,10 -> 180,120',
            enabled: true,
            sortOrder: 2,
          },
          {
            stepId: 'assert-coordinate-drag',
            stepName: 'Assert coordinate drag result',
            stepType: 'ASSERT_TEXT',
            locatorType: 'CSS',
            locatorValue: '#drag-result',
            inputValue: 'coordinate-dragged',
            enabled: true,
            sortOrder: 3,
          },
        ],
      },
      runOptions: { debugMode: true },
    },
  };
}

function buildCanvasDragPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<title>Coordinate Drag Replay</title>',
    '<style>',
    'body { font-family: sans-serif; padding: 32px; }',
    'canvas { width: 240px; height: 160px; border: 2px solid #333; background: #f6fbff; }',
    '</style>',
    '</head>',
    '<body>',
    '<canvas id="paint-canvas" data-testid="paint-canvas" width="240" height="160"></canvas>',
    '<p id="drag-result">waiting</p>',
    '<script>',
    'const canvas = document.querySelector("#paint-canvas");',
    'const result = document.querySelector("#drag-result");',
    'let start = null;',
    'function point(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }',
    'canvas.addEventListener("mousedown", event => { start = point(event); });',
    'canvas.addEventListener("mouseup", event => {',
    '  const end = point(event);',
    '  if (start && start.x < 30 && start.y < 30 && end.x > 160 && end.y > 100) result.textContent = "coordinate-dragged";',
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
