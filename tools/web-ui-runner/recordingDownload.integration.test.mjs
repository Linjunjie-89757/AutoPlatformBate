import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test } from 'node:test';

test('reports download filename size and content type evidence for click steps', async () => {
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
    if (url.pathname === '/download-page') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end([
        '<!doctype html>',
        '<html>',
        '<head><title>Download Evidence</title></head>',
        '<body>',
        '<a href="/files/report.txt" download="report.txt" data-testid="download-report">Download</a>',
        '</body>',
        '</html>',
      ].join(''));
      return;
    }
    if (url.pathname === '/files/report.txt') {
      const body = 'local-runner-download-evidence';
      response.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="report.txt"',
        'Content-Length': Buffer.byteLength(body),
      });
      response.end(body);
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
          runnerId: 'runner_recording_download',
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
          task: buildDownloadTask(appBaseUrl),
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_download/status') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_download/logs') {
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_download/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }
    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_download/result') {
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
      installId: 'recording-download',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);
    await waitFor(() => reports.results.length > 0, 20000, 'runner did not report download result');

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS']);
    assert.equal(reports.steps[1].extra.download.suggestedFilename, 'report.txt');
    assert.equal(reports.steps[1].extra.download.contentType, 'text/plain');
    assert.equal(reports.steps[1].extra.download.size, Buffer.byteLength('local-runner-download-evidence'));
    assert.equal(reports.steps[1].extra.download.completed, true);
    assert.equal(reports.steps[1].extra.download.archive.archived, true);
    assert.equal(reports.steps[1].extra.download.archive.encoding, 'base64');
    assert.equal(
      Buffer.from(reports.steps[1].extra.download.archive.contentBase64, 'base64').toString('utf8'),
      'local-runner-download-evidence',
    );
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(platform);
    await closeServer(app);
  }

  assert.deepEqual(stderr, []);
});

function buildDownloadTask(appBaseUrl) {
  return {
    runId: 'run_recording_download',
    taskType: 'WEB_CASE_RUN',
    executionLocation: 'LOCAL_RUNNER',
    executionToken: 'execution_token',
    runnerId: 'runner_recording_download',
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
        caseId: 2002,
        caseName: 'Recording download replay',
        baseUrl: '',
        headless: true,
        defaultTimeoutMs: 5000,
        steps: [
          {
            stepId: 'open-download',
            stepName: 'Open download page',
            stepType: 'OPEN',
            inputValue: `${appBaseUrl}/download-page`,
            enabled: true,
            sortOrder: 1,
          },
          {
            stepId: 'click-download',
            stepName: 'Download report',
            stepType: 'CLICK',
            locatorType: 'TEST_ID',
            locatorValue: 'download-report',
            enabled: true,
            sortOrder: 2,
          },
        ],
      },
      runOptions: { debugMode: true },
    },
  };
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
  if (!response.ok) throw new Error(payload?.message || `Request failed: ${response.status}`);
  return payload;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
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
  if (!server.listening) return;
  const closed = once(server, 'close');
  server.close();
  await closed;
}

async function stopRunnerProcess(runner) {
  if (runner.exitCode !== null || runner.signalCode !== null) return;
  const exited = once(runner, 'exit');
  runner.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
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
