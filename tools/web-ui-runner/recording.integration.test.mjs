import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';

test('records page input, select and click events as runnable web ui steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const pageHtml = [
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<select id="role"><option value="">Choose</option><option value="admin">Admin</option></select>',
    '<button id="save" data-testid="save-order">Save order</button>',
    '<script>',
    'window.setTimeout(() => {',
    '  const input = document.querySelector("#name");',
    '  input.value = "Alice";',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "Alice" }));',
    '  const select = document.querySelector("#role");',
    '  select.value = "admin";',
    '  select.dispatchEvent(new Event("change", { bubbles: true }));',
    '  document.querySelector("#save").click();',
    '}, 1000);',
    '</script>',
  ].join('');

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
    const opened = await postJson(runnerBaseUrl, '/collect/open', {
      url: `data:text/html,${encodeURIComponent(pageHtml)}`,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.success, true);
    assert.equal(started.recording.active, true);
    assert.equal(started.recording.eventCount, 0);

    await new Promise(resolve => setTimeout(resolve, 1800));

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.success, true);
    assert.equal(stopped.recording.active, false);
    assert.equal(stopped.steps.length, 3);
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILL', 'SELECT', 'CLICK']);

    const [fillStep, selectStep, clickStep] = stopped.steps;
    assert.equal(fillStep.locatorType, 'CSS');
    assert.equal(fillStep.locatorValue, '#name');
    assert.equal(fillStep.inputValue, 'Alice');
    assert.equal(selectStep.locatorType, 'CSS');
    assert.equal(selectStep.locatorValue, '#role');
    assert.equal(selectStep.inputValue, 'admin');
    assert.equal(clickStep.locatorType, 'TEST_ID');
    assert.equal(clickStep.locatorValue, 'save-order');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

async function waitForRunnerHealth(baseUrl) {
  await waitFor(async () => {
    const health = await getJson(baseUrl, '/health').catch(() => null);
    return health?.success === true;
  });
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
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

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(1500),
  });
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function stopRunnerProcess(runner) {
  if (runner.exitCode !== null || runner.signalCode !== null) {
    return;
  }
  runner.kill('SIGTERM');
  await Promise.race([
    once(runner, 'exit'),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  if (runner.exitCode === null && runner.signalCode === null) {
    runner.kill('SIGKILL');
    await Promise.race([
      once(runner, 'exit'),
      new Promise(resolve => setTimeout(resolve, 1000)),
    ]);
  }
}

async function findAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  server.close();
  await once(server, 'close');
  return port;
}
