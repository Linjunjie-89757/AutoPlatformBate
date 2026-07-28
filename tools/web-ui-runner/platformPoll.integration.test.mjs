import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { RUNNER_PRODUCT_NAME } from './runnerConfig.mjs';

test('polls platform validation command and submits local validation results', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const receivedResults = [];
  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/automation/web/element-collect-tasks/456/local-validation-command') {
      return sendJson(response, 200, {
        success: true,
        data: {
          taskId: 456,
          status: 'WAITING_LOCAL_VALIDATION',
          runnable: true,
          runnerId: body.runnerId,
          sessionId: body.sessionId,
          locators: [
            {
              locatorType: 'CSS',
              locatorValue: '#save',
            },
          ],
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/automation/web/element-collect-tasks/456/local-validation-results') {
      receivedResults.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          taskId: 456,
          status: 'COMPLETED',
        },
      });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(fakePlatform, platformPort);

  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: String(runnerPort),
      WEB_UI_RUNNER_SESSION_TTL_MINUTES: '15',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);

    const opened = await postJson(runnerBaseUrl, '/collect/open', {
      url: 'data:text/html,<button id="save">Save</button>',
      workspaceId: 'poll-test',
      environmentId: 'default',
      headless: true,
    });
    assert.equal(opened.success, true);
    assert.ok(opened.session.sessionId);

    const started = await postJson(runnerBaseUrl, '/platform/poll/start', {
      apiBaseUrl: `${platformBaseUrl}/api`,
      workspaceCode: 'poll-test',
      taskId: 456,
      runnerId: 'local-runner',
      sessionId: opened.session.sessionId,
      locators: [
        {
          locatorType: 'CSS',
          locatorValue: '#save',
        },
      ],
      intervalMs: 1000,
    });
    assert.equal(started.success, true);
    assert.equal(started.poller.taskId, '456');

    await waitFor(() => receivedResults.length > 0);

    assert.equal(receivedResults.length, 1);
    assert.equal(receivedResults[0].runnerId, 'local-runner');
    assert.equal(receivedResults[0].sessionId, opened.session.sessionId);
    assert.equal(receivedResults[0].results.length, 1);
    assert.equal(receivedResults[0].results[0].locatorType, 'CSS');
    assert.equal(receivedResults[0].results[0].locatorValue, '#save');
    assert.equal(receivedResults[0].results[0].validationStatus, 'PASSED');
    assert.equal(receivedResults[0].results[0].matchCount, 1);

    await waitFor(async () => {
      const status = await getJson(runnerBaseUrl, '/platform/poll/status');
      return status.success && status.poller === null;
    });
  } finally {
    runner.kill();
    await closeServer(fakePlatform);
    await once(runner, 'exit').catch(() => {});
  }

  assert.deepEqual(stderr, []);
});

test('reports productized runtime configuration from health endpoint', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const runnerDataDir = await mkdtemp(join(tmpdir(), 'runner-productized-'));
  const runner = spawn(process.execPath, [
    'tools/web-ui-runner/server.mjs',
    `--port=${runnerPort}`,
    '--runner-name=Productized Runner',
    '--install-id=productized-install',
    `--data-dir=${runnerDataDir}`,
    '--max-resource-slots=7',
    '--session-ttl-minutes=25',
    '--start-command=web-ui-runner.exe',
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: '39000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);
    const health = await getJson(runnerBaseUrl, '/health');

    assert.equal(health.runner.name, 'Productized Runner');
    assert.equal(health.runner.productName, RUNNER_PRODUCT_NAME);
    assert.equal(health.runner.installId, 'productized-install');
    assert.equal(health.runner.port, runnerPort);
    assert.equal(health.diagnostics.sessionTtlMinutes, 25);
    assert.equal(health.diagnostics.maxResourceSlots, 7);
    assert.equal(health.diagnostics.dataDir, runnerDataDir);
    assert.equal(health.diagnostics.logDir, `${runnerDataDir}\\logs`);
    assert.equal(health.diagnostics.configPath, `${runnerDataDir}\\config.json`);
    assert.equal(health.diagnostics.startCommand, 'web-ui-runner.exe');
  } finally {
    runner.kill();
    await once(runner, 'exit').catch(() => {});
    await rm(runnerDataDir, { recursive: true, force: true });
  }

  assert.deepEqual(stderr, []);
});

async function waitForRunnerHealth(baseUrl) {
  await waitFor(async () => {
    const health = await getJson(baseUrl, '/health');
    return health.success;
  });
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Timed out waiting for condition');
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await closeServer(server);
  return port;
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(1500),
  });
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
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
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}
