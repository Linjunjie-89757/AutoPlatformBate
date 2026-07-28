import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

import { RUNNER_VERSION } from './runnerConfig.mjs';

const TEST_PORT = 39218;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const RELEASE_TEST_PORT = 39219;
const RELEASE_BASE_URL = `http://127.0.0.1:${RELEASE_TEST_PORT}`;

test('expires active page session and blocks capture after TTL', async () => {
  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: String(TEST_PORT),
      WEB_UI_RUNNER_SESSION_TTL_MINUTES: '0.01',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth();

    const opened = await postJson(BASE_URL, '/collect/open', {
      url: 'data:text/html,<button id="save">Save</button>',
      workspaceId: 'ttl-test',
      environmentId: 'short',
      headless: true,
    });
    assert.equal(opened.success, true);
    assert.equal(opened.session.ttlMinutes, 0.01);
    assert.equal(opened.session.expired, false);
    assert.ok(opened.session.remainingSeconds <= 1);

    await new Promise(resolve => setTimeout(resolve, 900));

    const captureResponse = await fetch(`${BASE_URL}/collect/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitMs: 0 }),
    });
    const capturePayload = await captureResponse.json();
    assert.equal(captureResponse.status, 500);
    assert.equal(capturePayload.success, false);
    assert.match(capturePayload.message, /session has expired/i);

    const health = await getJson(BASE_URL, '/health');
    assert.equal(health.success, true);
    assert.equal(health.session, null);
    assert.equal(health.runner.version, RUNNER_VERSION);
    assert.ok(health.capabilities.some(item => item.key === 'STATIC_COLLECT'));
    assert.ok(health.capabilities.some(item => item.key === 'LOCAL_VALIDATE'));
    assert.equal(health.diagnostics.sessionTtlMinutes, 0.01);
    assert.equal(health.diagnostics.validationLocatorLimit, 200);
  } finally {
    runner.kill();
    await once(runner, 'exit').catch(() => {});
  }

  assert.deepEqual(stderr, []);
});

test('releases active page session on demand', async () => {
  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: String(RELEASE_TEST_PORT),
      WEB_UI_RUNNER_SESSION_TTL_MINUTES: '15',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(RELEASE_BASE_URL);

    const opened = await postJson(RELEASE_BASE_URL, '/collect/open', {
      url: 'data:text/html,<button id="cancel">Cancel</button>',
      workspaceId: 'release-test',
      environmentId: 'default',
      headless: true,
    });
    assert.equal(opened.success, true);
    assert.ok(opened.session.sessionId);

    const bound = await postJson(RELEASE_BASE_URL, '/session/bind', {
      taskId: 123,
      sessionId: opened.session.sessionId,
    });
    assert.equal(bound.success, true);
    assert.equal(bound.session.boundTaskId, '123');
    assert.equal(bound.session.pageAlive, true);

    const heartbeat = await getJson(RELEASE_BASE_URL, '/session/heartbeat');
    assert.equal(heartbeat.success, true);
    assert.equal(heartbeat.session.boundTaskId, '123');
    assert.equal(heartbeat.session.pageAlive, true);
    assert.ok(heartbeat.session.currentUrl.startsWith('data:text/html'));

    const released = await postJson(RELEASE_BASE_URL, '/session/release', {});
    assert.equal(released.success, true);
    assert.equal(released.released, true);
    assert.equal(released.session.sessionId, opened.session.sessionId);
    assert.equal(released.session.boundTaskId, '123');

    const health = await getJson(RELEASE_BASE_URL, '/health');
    assert.equal(health.success, true);
    assert.equal(health.session, null);
  } finally {
    runner.kill();
    await once(runner, 'exit').catch(() => {});
  }

  assert.deepEqual(stderr, []);
});

async function waitForRunnerHealth(baseUrl = BASE_URL) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 10_000) {
    try {
      const health = await getJson(baseUrl, '/health');
      if (health.success) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw lastError || new Error('Runner did not become healthy in time');
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}
