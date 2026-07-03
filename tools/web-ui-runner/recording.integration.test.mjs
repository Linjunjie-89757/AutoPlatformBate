import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { test } from 'node:test';

test('records page input, select and click events as runnable web ui steps', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildRecordingPageHtml({ autoInteract: true }))}`;
  const playbackPageUrl = `data:text/html,${encodeURIComponent(buildRecordingPageHtml({ autoInteract: false }))}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;
  let recordedSteps = [];

  const fakePlatform = createHttpServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_recording_replay_test',
          runnerToken: 'runner_token',
          runnerName: 'Recording Replay Test Runner',
          protocolVersion: '1.0',
          accepted: true,
          message: 'registered',
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
          task: {
            runId: 'run_recording_replay_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_recording_replay_test',
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
                caseId: 1002,
                caseName: 'Recorded replay case',
                baseUrl: '',
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-recorded-page',
                    stepName: 'Open recorded playback page',
                    stepType: 'OPEN',
                    inputValue: playbackPageUrl,
                    enabled: true,
                    sortOrder: 1,
                  },
                  ...recordedSteps.map((step, index) => ({
                    ...step,
                    stepId: `recorded-${index + 1}`,
                    stepName: step.name || `Recorded step ${index + 1}`,
                    stepType: step.stepType || step.type,
                    enabled: true,
                    sortOrder: index + 2,
                  })),
                  {
                    stepId: 'assert-recorded-result',
                    stepName: 'Assert recorded replay result',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#result',
                    inputValue: 'Saved Alice admin',
                    enabled: true,
                    sortOrder: recordedSteps.length + 2,
                  },
                ],
              },
              runOptions: {
                debugMode: true,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_replay_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_replay_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_replay_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_replay_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);
    const opened = await postJson(runnerBaseUrl, '/collect/open', {
      url: recordingPageUrl,
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
    recordedSteps = stopped.steps;

    const [fillStep, selectStep, clickStep] = stopped.steps;
    assert.equal(fillStep.locatorType, 'CSS');
    assert.equal(fillStep.locatorValue, '#name');
    assert.equal(fillStep.inputValue, 'Alice');
    assert.equal(selectStep.locatorType, 'CSS');
    assert.equal(selectStep.locatorValue, '#role');
    assert.equal(selectStep.inputValue, 'admin');
    assert.equal(clickStep.locatorType, 'TEST_ID');
    assert.equal(clickStep.locatorValue, 'save-order');

    await postJson(runnerBaseUrl, '/session/release', {});
    const startedReplay = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'recording-replay-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(startedReplay.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.register.length, 1);
    assert.equal(reports.pull[0].capabilities.includes('WEB_CASE_RUN'), true);
    assert.equal(reports.steps.length, 5);
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS']);
    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.total, 5);
    assert.equal(reports.results[0].summary.passed, 5);
    assert.equal(reports.results[0].summary.failed, 0);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('pauses resumes and undoes recorded page steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildPauseResumeRecordingPageHtml())}`;

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
      url: recordingPageUrl,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');
    assert.equal(started.recording.active, true);

    const paused = await postJson(runnerBaseUrl, '/record/pause', {});
    assert.equal(paused.recording.status, 'PAUSED');
    assert.equal(paused.recording.active, false);
    assert.equal(paused.recording.paused, true);

    await new Promise(resolve => setTimeout(resolve, 1250));
    const pausedStatus = await getJson(runnerBaseUrl, '/record/status');
    assert.equal(pausedStatus.recording.status, 'PAUSED');
    assert.equal(pausedStatus.recording.eventCount, 0);
    assert.deepEqual(pausedStatus.steps, []);

    const resumed = await postJson(runnerBaseUrl, '/record/resume', {});
    assert.equal(resumed.recording.status, 'RECORDING');
    assert.equal(resumed.recording.active, true);

    let recordedStatus;
    await waitFor(async () => {
      recordedStatus = await getJson(runnerBaseUrl, '/record/status');
      return recordedStatus?.steps?.length === 2;
    }, 5000);
    assert.deepEqual(recordedStatus.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(recordedStatus.steps[0].inputValue, 'kept');

    const undone = await postJson(runnerBaseUrl, '/record/undo', {});
    assert.equal(undone.undone, true);
    assert.equal(undone.recording.status, 'RECORDING');
    assert.equal(undone.steps.length, 1);
    assert.deepEqual(undone.steps.map(item => item.type), ['FILL']);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.equal(stopped.recording.active, false);
    assert.equal(stopped.steps.length, 1);
    assert.equal(stopped.steps[0].type, 'FILL');
    assert.equal(stopped.steps[0].inputValue, 'kept');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('deduplicates noisy input and repeated clicks while recording', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildNoisyRecordingPageHtml())}`;

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
      url: recordingPageUrl,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');

    await waitFor(async () => {
      const status = await getJson(runnerBaseUrl, '/record/status');
      return status?.steps?.length === 2;
    }, 5000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stopped.steps[0].locatorValue, '#name');
    assert.equal(stopped.steps[0].inputValue, 'Alice');
    assert.equal(stopped.steps[1].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[1].locatorValue, 'save-order');
    assert.equal(stopped.events.length, 2);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('records hover checkbox radio and file upload interactions', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildComplexRecordingPageHtml())}`;

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
      url: recordingPageUrl,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');

    await waitFor(async () => {
      const status = await getJson(runnerBaseUrl, '/record/status');
      return status?.steps?.length === 4;
    }, 5000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['HOVER', 'CLICK', 'CLICK', 'FILE_UPLOAD']);
    assert.equal(stopped.steps[0].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[0].locatorValue, 'orders-menu');
    assert.equal(stopped.steps[1].locatorValue, '#send-email');
    assert.equal(stopped.steps[2].locatorValue, '#priority-high');
    assert.equal(stopped.steps[3].locatorValue, '#attachment');
    assert.equal(stopped.steps[3].inputValue, 'upload-demo.txt');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('keeps recorded steps available after session release interrupts recording', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildNoisyRecordingPageHtml())}`;

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
      url: recordingPageUrl,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');

    let recordedStatus;
    await waitFor(async () => {
      recordedStatus = await getJson(runnerBaseUrl, '/record/status');
      return recordedStatus?.steps?.length === 2;
    }, 5000);

    const released = await postJson(runnerBaseUrl, '/session/release', {});
    assert.equal(released.success, true);

    const recovered = await getJson(runnerBaseUrl, '/record/status');
    assert.equal(recovered.recording.status, 'STOPPED');
    assert.equal(recovered.recording.active, false);
    assert.deepEqual(recovered.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(recovered.steps[0].inputValue, 'Alice');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

function buildRecordingPageHtml({ autoInteract }) {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Recording Replay</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<select id="role"><option value="">Choose</option><option value="admin">Admin</option></select>',
    '<button id="save" data-testid="save-order">Save order</button>',
    '<div id="result"></div>',
    '<script>',
    'function saveOrder() {',
    '  document.querySelector("#result").textContent = `Saved ${document.querySelector("#name").value} ${document.querySelector("#role").value}`;',
    '}',
    'document.querySelector("#save").addEventListener("click", saveOrder);',
    autoInteract ? [
      'window.setTimeout(() => {',
      '  const input = document.querySelector("#name");',
      '  input.value = "Alice";',
      '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "Alice" }));',
      '  const select = document.querySelector("#role");',
      '  select.value = "admin";',
      '  select.dispatchEvent(new Event("change", { bubbles: true }));',
      '  document.querySelector("#save").click();',
      '}, 1000);',
    ].join('') : '',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildComplexRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Complex Recording</title></head>',
    '<body>',
    '<button id="orders-menu" data-testid="orders-menu">Orders menu</button>',
    '<label for="send-email">Send email</label>',
    '<input id="send-email" type="checkbox" />',
    '<label for="priority-high">High priority</label>',
    '<input id="priority-high" type="radio" name="priority" value="high" />',
    '<label for="attachment">Attachment</label>',
    '<input id="attachment" type="file" />',
    '<script>',
    'window.setTimeout(() => {',
    '  const menu = document.querySelector("#orders-menu");',
    '  menu.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));',
    '}, 1000);',
    'window.setTimeout(() => document.querySelector("#send-email").click(), 1150);',
    'window.setTimeout(() => document.querySelector("#priority-high").click(), 1300);',
    'window.setTimeout(() => {',
    '  const input = document.querySelector("#attachment");',
    '  const transfer = new DataTransfer();',
    '  transfer.items.add(new File(["demo"], "upload-demo.txt", { type: "text/plain" }));',
    '  input.files = transfer.files;',
    '  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));',
    '}, 1450);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildNoisyRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Noisy Recording</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="save" data-testid="save-order">Save order</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'window.setTimeout(() => inputValue("A"), 1000);',
    'window.setTimeout(() => inputValue("Ali"), 1050);',
    'window.setTimeout(() => inputValue("Alice"), 1100);',
    'window.setTimeout(() => document.querySelector("#save").click(), 1200);',
    'window.setTimeout(() => document.querySelector("#save").click(), 1240);',
    'window.setTimeout(() => document.querySelector("#save").click(), 1280);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildPauseResumeRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Recording Controls</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="save" data-testid="save-order">Save order</button>',
    '<script>',
    'function perform(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '  document.querySelector("#save").click();',
    '}',
    'window.setTimeout(() => perform("ignored"), 1000);',
    'window.setTimeout(() => perform("kept"), 1700);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

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
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  server.close();
  await once(server, 'close');
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
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  server.close();
  await once(server, 'close');
  return port;
}
