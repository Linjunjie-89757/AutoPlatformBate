import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test } from 'node:test';

test('replays dialog acceptance and new tab continuation in one web case run', async () => {
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
  const reports = {
    register: [],
    pull: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const app = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', appBaseUrl);
    if (url.pathname === '/dialog') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildDialogPageHtml());
      return;
    }
    if (url.pathname === '/opener') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildPopupOpenerPageHtml());
      return;
    }
    if (url.pathname === '/child') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildPopupChildPageHtml());
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
          runnerId: 'runner_recording_boundaries',
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
          data: {
            hasTask: false,
            serverTime: new Date().toISOString(),
            pollIntervalMs: 1000,
            task: null,
          },
        });
      }
      taskPulled = true;
      return sendJson(response, 200, {
        success: true,
        data: {
          hasTask: true,
          serverTime: new Date().toISOString(),
          pollIntervalMs: 1000,
          task: buildBoundaryTask(appBaseUrl),
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_boundaries/status') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_boundaries/logs') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_boundaries/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_boundaries/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(app, appPort);
  await listen(platform, platformPort);

  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: String(runnerPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'recording-boundaries',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0, 20000, 'runner did not report boundary result');

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.total, 8);
    assert.equal(reports.results[0].summary.passed, 8);
    assert.equal(reports.results[0].summary.failed, 0);
    assert.deepEqual(reports.steps.map(item => item.status), Array(8).fill('SUCCESS'));
    assert.equal(reports.steps[2].extra.pageUrl, `${appBaseUrl}/dialog`);
    assert.equal(reports.steps[7].extra.pageUrl, `${appBaseUrl}/child`);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(platform);
    await closeServer(app);
  }

  assert.deepEqual(stderr, []);
});

function buildBoundaryTask(appBaseUrl) {
  return {
    runId: 'run_recording_boundaries',
    taskType: 'WEB_CASE_RUN',
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_recording_boundaries',
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
        caseId: 2001,
        caseName: 'Recording boundary replay',
        baseUrl: '',
        headless: true,
        defaultTimeoutMs: 5000,
        steps: [
          {
            stepId: 'open-dialog',
            stepName: 'Open dialog page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/dialog`,
            enabled: true,
            sortOrder: 1,
          },
          {
            stepId: 'accept-confirm',
            stepName: 'Accept confirm',
            stepType: 'CLICK',
            locatorType: 'TEST_ID',
            locatorValue: 'confirm-action',
            enabled: true,
            sortOrder: 2,
          },
          {
            stepId: 'accept-prompt',
            stepName: 'Accept prompt',
            stepType: 'CLICK',
            locatorType: 'TEST_ID',
            locatorValue: 'prompt-action',
            enabled: true,
            sortOrder: 3,
          },
          {
            stepId: 'assert-dialog',
            stepName: 'Assert dialog result',
            stepType: 'ASSERT_TEXT',
            locatorType: 'CSS',
            locatorValue: '#dialog-result',
            inputValue: 'confirm:true|prompt:',
            enabled: true,
            sortOrder: 4,
          },
          {
            stepId: 'open-popup',
            stepName: 'Open popup page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/opener`,
            enabled: true,
            sortOrder: 5,
          },
          {
            stepId: 'click-popup-link',
            stepName: 'Open child tab',
            stepType: 'CLICK',
            locatorType: 'TEST_ID',
            locatorValue: 'open-child',
            enabled: true,
            sortOrder: 6,
          },
          {
            stepId: 'fill-child',
            stepName: 'Fill child name',
            stepType: 'FILL',
            locatorType: 'CSS',
            locatorValue: '#child-name',
            inputValue: 'Ada',
            enabled: true,
            sortOrder: 7,
          },
          {
            stepId: 'assert-child',
            stepName: 'Assert child result',
            stepType: 'ASSERT_TEXT',
            locatorType: 'CSS',
            locatorValue: '#child-result',
            inputValue: 'Saved Ada',
            enabled: true,
            sortOrder: 8,
          },
        ],
      },
      runOptions: {
        debugMode: true,
      },
    },
  };
}

function buildDialogPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Dialog Boundary</title></head>',
    '<body>',
    '<button id="confirm" data-testid="confirm-action">Confirm</button>',
    '<button id="prompt" data-testid="prompt-action">Prompt</button>',
    '<div id="dialog-result">pending</div>',
    '<script>',
    'let confirmValue = null;',
    'let promptValue = null;',
    'function render() {',
    '  document.querySelector("#dialog-result").textContent = `confirm:${confirmValue}|prompt:${promptValue ?? ""}`;',
    '}',
    'document.querySelector("#confirm").addEventListener("click", () => {',
    '  confirmValue = window.confirm("Continue?");',
    '  render();',
    '});',
    'document.querySelector("#prompt").addEventListener("click", () => {',
    '  promptValue = window.prompt("Name?", "");',
    '  render();',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildPopupOpenerPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Popup Opener</title></head>',
    '<body>',
    '<a href="/child" target="_blank" data-testid="open-child">Open child</a>',
    '</body>',
    '</html>',
  ].join('');
}

function buildPopupChildPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Popup Child</title></head>',
    '<body>',
    '<label for="child-name">Name</label>',
    '<input id="child-name" />',
    '<div id="child-result">waiting</div>',
    '<script>',
    'document.querySelector("#child-name").addEventListener("input", event => {',
    '  document.querySelector("#child-result").textContent = `Saved ${event.target.value}`;',
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
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error(message);
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function listen(server, port) {
  const listening = once(server, 'listening');
  server.listen(port, '127.0.0.1');
  await listening;
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  const closed = once(server, 'close');
  server.close();
  await closed;
}

async function stopRunnerProcess(runner) {
  if (runner.exitCode !== null || runner.signalCode !== null) {
    return;
  }
  const exited = once(runner, 'exit');
  runner.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  if (runner.exitCode === null && runner.signalCode === null) {
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
