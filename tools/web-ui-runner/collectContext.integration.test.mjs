import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';

test('collects candidates from iframe and open shadow root with context paths', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const pageHtml = [
    '<button id="outer">Outer</button>',
    '<iframe id="child" srcdoc="<button id=&quot;inside-frame&quot; data-testid=&quot;frame-save&quot;>Frame Save</button>"></iframe>',
    '<custom-shell></custom-shell>',
    '<script>',
    'const root = document.querySelector("custom-shell").attachShadow({ mode: "open" });',
    'root.innerHTML = `<button id="inside-shadow" data-testid="shadow-save">Shadow Save</button>`;',
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
      environmentId: 'collect-context',
      headless: true,
    });
    assert.equal(opened.success, true);

    const captured = await postJson(runnerBaseUrl, '/collect/capture', { waitMs: 100 });
    assert.equal(captured.success, true);

    const frameCandidate = captured.candidates.find(item => item.locator?.value === 'frame-save');
    assert.ok(frameCandidate, 'expected iframe candidate');
    assert.deepEqual(frameCandidate.framePath, [{ selector: 'iframe#child' }]);
    assert.deepEqual(frameCandidate.locator.framePath, [{ selector: 'iframe#child' }]);

    const shadowCandidate = captured.candidates.find(item => item.locator?.value === 'shadow-save');
    assert.ok(shadowCandidate, 'expected shadow candidate');
    assert.deepEqual(shadowCandidate.shadowPath, ['custom-shell']);
    assert.deepEqual(shadowCandidate.locator.shadowPath, ['custom-shell']);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('collects candidates from iframe shadow root with frame and shadow context paths', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const frameHtml = [
    '<!doctype html>',
    '<html>',
    '<body>',
    '<custom-shell></custom-shell>',
    '<script>',
    'const root = document.querySelector("custom-shell").attachShadow({ mode: "open" });',
    'root.innerHTML = `<button id="inside-shadow-frame" data-testid="iframe-shadow-save">Iframe Shadow Save</button>`;',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
  const pageHtml = [
    '<button id="outer">Outer</button>',
    `<iframe id="child" srcdoc="${frameHtml.replace(/"/g, '&quot;')}"></iframe>`,
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
      environmentId: 'collect-iframe-shadow-context',
      headless: true,
    });
    assert.equal(opened.success, true);

    const captured = await postJson(runnerBaseUrl, '/collect/capture', { waitMs: 100 });
    assert.equal(captured.success, true);

    const iframeShadowCandidate = captured.candidates.find(item => item.locator?.value === 'iframe-shadow-save');
    assert.ok(iframeShadowCandidate, 'expected iframe shadow candidate');
    assert.deepEqual(iframeShadowCandidate.framePath, [{ selector: 'iframe#child' }]);
    assert.deepEqual(iframeShadowCandidate.shadowPath, ['custom-shell']);
    assert.deepEqual(iframeShadowCandidate.locator.framePath, [{ selector: 'iframe#child' }]);
    assert.deepEqual(iframeShadowCandidate.locator.shadowPath, ['custom-shell']);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
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
  return response.json();
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
