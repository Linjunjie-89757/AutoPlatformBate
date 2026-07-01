import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('polls generic runner task and reports real WEB_ELEMENT_VALIDATE result', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_generic_test',
          runnerToken: 'runner_token',
          runnerName: 'Generic Test Runner',
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
            runId: 'run_generic_validate_001',
            taskType: 'WEB_ELEMENT_VALIDATE',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_generic_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 3,
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
              pageUrl: 'https://example.test',
              locators: [
                {
                  locatorId: 'save-button',
                  locatorType: 'CSS',
                  locatorValue: '#save',
                },
              ],
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/result') {
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
      url: 'data:text/html,<button id="save">Save</button>',
      workspaceId: 'account-open',
      environmentId: 'default',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-task-test',
      intervalMs: 1000,
      capabilities: ['WEB_ELEMENT_VALIDATE'],
    });
    assert.equal(started.success, true);
    assert.equal(started.poller.runnerId, 'runner_generic_test');

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.register.length, 1);
    assert.equal(reports.pull[0].runnerId, 'runner_generic_test');
    assert.equal(reports.pull[0].resource.maxSlots, 5);
    assert.equal(reports.pull[0].resource.usedSlots, 0);
    assert.equal(reports.pull[0].resource.availableSlots, 5);
    assert.equal(reports.status[0].status, 'RUNNING');
    assert.equal(reports.logs[0].message, '开始执行 WEB_ELEMENT_VALIDATE 任务');
    assert.equal(reports.steps[0].stepId, 'web-element-validate-local');
    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.mode, 'LOCAL_PLAYWRIGHT');
    assert.equal(reports.results[0].reportData.validationMode, 'LOCAL_PLAYWRIGHT');
    assert.equal(reports.results[0].reportData.results[0].validationStatus, 'PASSED');
    assert.equal(reports.results[0].reportData.results[0].matchCount, 1);
    assert.equal(reports.results[0].reportData.results[0].visible, true);

    const status = await getJson(runnerBaseUrl, '/tasks/poll/status');
    assert.equal(status.success, true);
    assert.ok(status.poller.completedCount >= 1);
    assert.equal(status.poller.currentRunId, null);
    assert.equal(status.poller.lastTaskType, 'WEB_ELEMENT_VALIDATE');
    assert.equal(status.poller.maxResourceSlots, 5);
    assert.equal(status.poller.resource.availableSlots, 5);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('polls generic runner task and reports real WEB_CASE_RUN result', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}/app/`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_case_run_test',
          runnerToken: 'runner_token',
          runnerName: 'Case Run Test Runner',
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
            runId: 'run_generic_case_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_case_run_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 5,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {},
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
              environmentId: 'env-local',
              environmentName: 'Local Test Env',
            },
            variableSnapshot: {
              variableSetId: 'vars-local',
              variableSetName: 'Local Test Variables',
              variables: {
                path: './form',
                name: 'codex',
                role: 'admin',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1001,
                caseName: 'Local Runner MVP case',
                baseUrl: '${baseUrl}',
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    inputValue: '${path}',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'fill-name',
                    stepName: 'Fill name',
                    stepType: 'FILL',
                    locatorType: 'CSS',
                    locatorValue: '#username',
                    inputValue: '${name}',
                    enabled: true,
                    sortOrder: 2,
                  },
                  {
                    stepId: 'clear-name',
                    stepName: 'Clear name',
                    stepType: 'CLEAR',
                    locatorType: 'CSS',
                    locatorValue: '#username',
                    enabled: true,
                    sortOrder: 3,
                  },
                  {
                    stepId: 'fill-name-again',
                    stepName: 'Fill name again',
                    stepType: 'FILL',
                    locatorType: 'CSS',
                    locatorValue: '#username',
                    inputValue: '${name}',
                    enabled: true,
                    sortOrder: 4,
                  },
                  {
                    stepId: 'press-enter',
                    stepName: 'Press enter',
                    stepType: 'PRESS_KEY',
                    locatorType: 'CSS',
                    locatorValue: '#username',
                    inputValue: 'Enter',
                    enabled: true,
                    sortOrder: 5,
                  },
                  {
                    stepId: 'assert-key',
                    stepName: 'Assert key',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#key',
                    inputValue: 'entered',
                    enabled: true,
                    sortOrder: 6,
                  },
                  {
                    stepId: 'select-role',
                    stepName: 'Select role',
                    stepType: 'SELECT',
                    locatorType: 'CSS',
                    locatorValue: '#role',
                    inputValue: '${role}',
                    enabled: true,
                    sortOrder: 7,
                  },
                  {
                    stepId: 'assert-role',
                    stepName: 'Assert role',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#role-text',
                    inputValue: '${role}',
                    enabled: true,
                    sortOrder: 8,
                  },
                  {
                    stepId: 'hover-target',
                    stepName: 'Hover target',
                    stepType: 'HOVER',
                    locatorType: 'CSS',
                    locatorValue: '#hover',
                    enabled: true,
                    sortOrder: 9,
                  },
                  {
                    stepId: 'double-target',
                    stepName: 'Double target',
                    stepType: 'DOUBLE_CLICK',
                    locatorType: 'CSS',
                    locatorValue: '#double',
                    enabled: true,
                    sortOrder: 10,
                  },
                  {
                    stepId: 'right-target',
                    stepName: 'Right target',
                    stepType: 'RIGHT_CLICK',
                    locatorType: 'CSS',
                    locatorValue: '#right',
                    enabled: true,
                    sortOrder: 11,
                  },
                  {
                    stepId: 'click-submit',
                    stepName: 'Click submit',
                    stepType: 'CLICK',
                    locatorType: 'CSS',
                    locatorValue: '#submit',
                    enabled: true,
                    sortOrder: 12,
                  },
                  {
                    stepId: 'assert-title',
                    stepName: 'Assert title',
                    stepType: 'ASSERT_TITLE',
                    inputValue: 'Runner Steps',
                    enabled: true,
                    sortOrder: 13,
                  },
                  {
                    stepId: 'assert-url',
                    stepName: 'Assert url',
                    stepType: 'ASSERT_URL',
                    inputValue: '/app/form',
                    enabled: true,
                    sortOrder: 14,
                  },
                  {
                    stepId: 'wait-url',
                    stepName: 'Wait url',
                    stepType: 'WAIT_URL',
                    inputValue: '/app/form',
                    enabled: true,
                    sortOrder: 15,
                  },
                  {
                    stepId: 'assert-input',
                    stepName: 'Assert input',
                    stepType: 'ASSERT_VALUE',
                    locatorType: 'CSS',
                    locatorValue: '#username',
                    inputValue: '${name}',
                    enabled: true,
                    sortOrder: 16,
                  },
                  {
                    stepId: 'wait-text',
                    stepName: 'Wait text',
                    stepType: 'WAIT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#role-text',
                    inputValue: '${role}',
                    enabled: true,
                    sortOrder: 17,
                  },
                  {
                    stepId: 'wait-hidden',
                    stepName: 'Wait hidden',
                    stepType: 'WAIT_HIDDEN',
                    locatorType: 'CSS',
                    locatorValue: '#hidden',
                    enabled: true,
                    sortOrder: 18,
                  },
                  {
                    stepId: 'assert-hidden',
                    stepName: 'Assert hidden',
                    stepType: 'ASSERT_NOT_VISIBLE',
                    locatorType: 'CSS',
                    locatorValue: '#hidden',
                    enabled: true,
                    sortOrder: 19,
                  },
                  {
                    stepId: 'assert-ok',
                    stepName: 'Assert saved',
                    stepType: 'ASSERT_VISIBLE',
                    locatorType: 'CSS',
                    locatorValue: '#ok',
                    enabled: true,
                    sortOrder: 20,
                  },
                  {
                    stepId: 'assert-text',
                    stepName: 'Assert saved text',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#ok',
                    inputValue: 'Saved codex admin hovered double right',
                    enabled: true,
                    sortOrder: 21,
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

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  const targetApp = createServer((request, response) => {
    void request;
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html>
        <head><title>Runner Steps</title></head>
        <body>
          <input id="username">
          <div id="key"></div>
          <select id="role">
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <div id="role-text"></div>
          <button id="hover">Hover</button>
          <button id="double">Double</button>
          <button id="right">Right</button>
          <button id="submit">Submit</button>
          <div id="hidden" style="display:none">Hidden text</div>
          <div id="ok" style="display:none"></div>
          <script>
            const state = { hovered: false, double: false, right: false };
            document.getElementById("username").addEventListener("keydown", event => {
              if (event.key === "Enter") document.getElementById("key").textContent = "entered";
            });
            document.getElementById("role").addEventListener("change", event => {
              document.getElementById("role-text").textContent = event.target.value;
            });
            document.getElementById("hover").addEventListener("mouseover", () => { state.hovered = true; });
            document.getElementById("double").addEventListener("dblclick", () => { state.double = true; });
            document.getElementById("right").addEventListener("contextmenu", event => {
              event.preventDefault();
              state.right = true;
            });
            document.getElementById("submit").addEventListener("click", () => {
              const result = [
                "Saved",
                document.getElementById("username").value,
                document.getElementById("role").value,
                state.hovered ? "hovered" : "not-hovered",
                state.double ? "double" : "not-double",
                state.right ? "right" : "not-right"
              ].join(" ");
              const ok = document.getElementById("ok");
              ok.textContent = result;
              ok.style.display = "block";
            });
          </script>
        </body>
      </html>`);
  });

  await listen(targetApp, targetPort);
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

    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);
    assert.equal(started.poller.runnerId, 'runner_case_run_test');

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.register.length, 1);
    assert.equal(reports.pull[0].capabilities.includes('WEB_CASE_RUN'), true);
    assert.equal(reports.logs[0].message, '开始执行 WEB_CASE_RUN 任务');
    assert.equal(reports.steps.length, 21);
    assert.equal(reports.steps[0].stepId, 'open-page');
    assert.equal(reports.steps[0].extra?.pageUrl?.startsWith(`${targetBaseUrl}form`), true);
    assert.equal(reports.steps[20].status, 'SUCCESS');
    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.total, 21);
    assert.equal(reports.results[0].summary.passed, 21);
    assert.equal(reports.results[0].summary.failed, 0);
    assert.equal(reports.results[0].reportData.executionMode, 'LOCAL_PLAYWRIGHT');
    assert.equal(reports.results[0].reportData.executionContext.environment.baseUrl, targetBaseUrl);
    assert.equal(reports.results[0].reportData.executionContext.variableSetName, 'Local Test Variables');
    assert.equal(reports.results[0].reportData.stepResults.length, 21);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApp);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('validates locator inside iframe when framePath is provided', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;

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
      url: 'data:text/html,<iframe id="child" srcdoc="<button id=&quot;inside&quot;>Inside</button>"></iframe>',
      workspaceId: 'account-open',
      environmentId: 'iframe-validate',
      headless: true,
    });
    assert.equal(opened.success, true);

    const validation = await postJson(runnerBaseUrl, '/collect/validate', {
      locators: [
        {
          locatorType: 'CSS',
          locatorValue: '#inside',
          framePath: [{ selector: 'iframe#child' }],
        },
      ],
    });

    assert.equal(validation.results[0].validationStatus, 'PASSED');
    assert.equal(validation.results[0].matchCount, 1);
    assert.deepEqual(validation.results[0].framePath, [{ selector: 'iframe#child' }]);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('validates locator inside shadow root when shadowPath is provided', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const pageHtml = [
    '<button id="inside">Outer</button>',
    '<custom-shell></custom-shell>',
    '<script>',
    'const root = document.querySelector("custom-shell").attachShadow({ mode: "open" });',
    'root.innerHTML = `<button id="inside">Shadow</button>`;',
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
      environmentId: 'shadow-validate',
      headless: true,
    });
    assert.equal(opened.success, true);

    const validation = await postJson(runnerBaseUrl, '/collect/validate', {
      locators: [
        {
          locatorType: 'CSS',
          locatorValue: '#inside',
          shadowPath: ['custom-shell'],
        },
      ],
    });

    assert.equal(validation.results[0].validationStatus, 'PASSED');
    assert.equal(validation.results[0].matchCount, 1);
    assert.deepEqual(validation.results[0].shadowPath, ['custom-shell']);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('runs WEB_CASE_RUN step inside iframe when framePath is provided', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const pageUrl = 'data:text/html,<iframe id="child" srcdoc="<button id=&quot;inside&quot; onclick=&quot;document.body.dataset.clicked=1&quot;>Inside</button><div id=&quot;state&quot;>ready</div><script>document.getElementById(&quot;inside&quot;).addEventListener(&quot;click&quot;,()=>document.getElementById(&quot;state&quot;).textContent=&quot;clicked&quot;)</script>"></iframe>';
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_iframe_case_test',
          runnerToken: 'runner_token',
          runnerName: 'Iframe Case Test Runner',
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
            runId: 'run_generic_case_iframe_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_iframe_case_test',
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
                caseId: 1008,
                caseName: 'Iframe case',
                baseUrl: pageUrl,
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'click-inside-frame',
                    stepName: 'Click iframe button',
                    stepType: 'CLICK',
                    locatorType: 'CSS',
                    locatorValue: '#inside',
                    framePath: [{ selector: 'iframe#child' }],
                    enabled: true,
                    sortOrder: 2,
                  },
                  {
                    stepId: 'assert-frame-state',
                    stepName: 'Assert iframe state',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#state',
                    inputValue: 'clicked',
                    framePath: [{ selector: 'iframe#child' }],
                    enabled: true,
                    sortOrder: 3,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_iframe_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_iframe_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_iframe_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_iframe_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-iframe-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.steps.length, 3);
    assert.equal(reports.steps[1].status, 'SUCCESS');
    assert.deepEqual(reports.steps[1].extra.framePath, [{ selector: 'iframe#child' }]);
    assert.equal(reports.steps[2].status, 'SUCCESS');
    assert.equal(reports.results[0].status, 'SUCCESS');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('runs WEB_CASE_RUN step inside shadow root when shadowPath is provided', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const pageHtml = [
    '<button id="inside">Outer</button>',
    '<custom-shell></custom-shell>',
    '<script>',
    'const root = document.querySelector("custom-shell").attachShadow({ mode: "open" });',
    'root.innerHTML = `<button id="inside">Shadow</button><div id="state">ready</div>`;',
    'root.querySelector("#inside").addEventListener("click", () => root.querySelector("#state").textContent = "clicked");',
    '</script>',
  ].join('');
  const pageUrl = `data:text/html,${encodeURIComponent(pageHtml)}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_shadow_case_test',
          runnerToken: 'runner_token',
          runnerName: 'Shadow Case Test Runner',
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
            runId: 'run_generic_case_shadow_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_shadow_case_test',
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
                caseId: 1009,
                caseName: 'Shadow case',
                baseUrl: pageUrl,
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'click-inside-shadow',
                    stepName: 'Click shadow button',
                    stepType: 'CLICK',
                    locatorType: 'CSS',
                    locatorValue: '#inside',
                    shadowPath: ['custom-shell'],
                    enabled: true,
                    sortOrder: 2,
                  },
                  {
                    stepId: 'assert-shadow-state',
                    stepName: 'Assert shadow state',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#state',
                    inputValue: 'clicked',
                    shadowPath: ['custom-shell'],
                    enabled: true,
                    sortOrder: 3,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_shadow_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_shadow_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_shadow_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_shadow_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-shadow-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.steps.length, 3);
    assert.equal(reports.steps[1].status, 'SUCCESS');
    assert.deepEqual(reports.steps[1].extra.shadowPath, ['custom-shell']);
    assert.equal(reports.steps[2].status, 'SUCCESS');
    assert.equal(reports.results[0].status, 'SUCCESS');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('reports clear WEB_CASE_RUN failure when FILE_UPLOAD artifact is not available locally', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_file_upload_test',
          runnerToken: 'runner_token',
          runnerName: 'File Upload Test Runner',
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
            runId: 'run_generic_case_file_upload_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_file_upload_test',
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
            artifactRefs: [{
              fileId: 'avatar',
              fileName: 'avatar.png',
            }],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1006,
                caseName: 'File upload case',
                baseUrl: 'data:text/html,<input id="file" type="file">',
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'upload-avatar',
                    stepName: 'Upload avatar',
                    stepType: 'FILE_UPLOAD',
                    locatorType: 'CSS',
                    locatorValue: '#file',
                    inputValue: 'artifact:avatar',
                    enabled: true,
                    sortOrder: 2,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-file-upload-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    const failedStep = reports.steps.find(item => item.stepId === 'upload-avatar');
    assert.equal(failedStep.status, 'FAILED');
    assert.match(failedStep.errorMessage, /工件|artifact|文件/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('uploads WEB_CASE_RUN artifact file from localPath', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const artifactDir = join(homedir(), '.auto-web-ui-runner', 'test-artifacts');
  const artifactPath = join(artifactDir, `avatar-${Date.now()}.txt`);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(artifactPath, 'avatar-content', 'utf8');

  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApp = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html>
        <body>
          <input id="file" type="file" />
          <div id="file-name"></div>
          <script>
            document.getElementById("file").addEventListener("change", event => {
              document.getElementById("file-name").textContent = event.target.files[0]?.name || "";
            });
          </script>
        </body>
      </html>`);
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_file_upload_success_test',
          runnerToken: 'runner_token',
          runnerName: 'File Upload Success Test Runner',
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
            runId: 'run_generic_case_file_upload_success_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_file_upload_success_test',
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
            artifactRefs: [{
              fileId: 'avatar',
              fileName: 'avatar.txt',
              localPath: artifactPath,
              mimeType: 'text/plain',
            }],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1007,
                caseName: 'File upload success case',
                baseUrl: targetBaseUrl,
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    inputValue: targetBaseUrl,
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'upload-avatar',
                    stepName: 'Upload avatar',
                    stepType: 'FILE_UPLOAD',
                    locatorType: 'CSS',
                    locatorValue: '#file',
                    inputValue: 'artifact:avatar',
                    enabled: true,
                    sortOrder: 2,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_success_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_success_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_success_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_file_upload_success_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApp, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-file-upload-success-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.steps.find(item => item.stepId === 'upload-avatar')?.status, 'SUCCESS');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApp);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
    await rm(artifactPath, { force: true });
  }

  assert.deepEqual(stderr, []);
});

test('reports clear WEB_CASE_RUN failure when required auth state is missing', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_auth_missing_test',
          runnerToken: 'runner_token',
          runnerName: 'Auth Missing Test Runner',
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
            runId: 'run_generic_case_auth_missing_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_auth_missing_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 5,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {},
            environmentSnapshot: {
              environmentId: 'auth-missing-env',
              environmentName: 'Auth Missing Env',
              baseUrl: 'https://example.test/',
            },
            variableSnapshot: {},
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1002,
                caseName: 'Auth missing case',
                baseUrl: '${baseUrl}',
                environmentId: 'auth-missing-env',
                requireAuthState: true,
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    inputValue: './secure',
                    enabled: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_missing_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_missing_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_missing_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_missing_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-auth-missing-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.steps.length, 1);
    assert.equal(reports.steps[0].status, 'FAILED');
    assert.match(reports.steps[0].errorMessage, /登录状态/);
    assert.equal(reports.results[0].status, 'FAILED');
    assert.match(reports.results[0].errorMessage, /登录状态/);
    assert.equal(reports.steps[0].extra.screenshot || null, null);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('reports WEB_CASE_RUN failure when required auth state is expiring soon', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const workspaceCode = 'account-open';
  const environmentId = 'auth-expiring-env';
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  await writeStorageState(workspaceCode, environmentId, {
    cookies: [
      {
        name: 'sid',
        value: 'soon-expired',
        domain: '127.0.0.1',
        path: '/',
        expires: Math.floor((Date.now() + 60_000) / 1000),
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_auth_expiring_test',
          runnerToken: 'runner_token',
          runnerName: 'Auth Expiring Test Runner',
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
            runId: 'run_generic_case_auth_expiring_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_auth_expiring_test',
            workspaceCode,
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 5,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              authStateMinTtlMs: 5 * 60_000,
            },
            environmentSnapshot: {
              environmentId,
              baseUrl: 'https://example.test/',
            },
            variableSnapshot: {},
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1006,
                caseName: 'Auth expiring case',
                baseUrl: '${baseUrl}',
                environmentId,
                requireAuthState: true,
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    inputValue: './secure',
                    enabled: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_expiring_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_expiring_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_expiring_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_expiring_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-auth-expiring-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.steps.length, 1);
    assert.equal(reports.steps[0].status, 'FAILED');
    assert.match(reports.steps[0].errorMessage, /即将过期/);
    assert.equal(reports.results[0].status, 'FAILED');
    assert.match(reports.results[0].errorMessage, /即将过期/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
    await removeStorageState(workspaceCode, environmentId);
  }

  assert.deepEqual(stderr, []);
});

test('reports WEB_CASE_RUN failure when saved auth state lands on login page', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const workspaceCode = 'account-open';
  const environmentId = 'auth-login-env';
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  await writeStorageState(workspaceCode, environmentId, {
    cookies: [
      {
        name: 'sid',
        value: 'valid-but-rejected',
        domain: '127.0.0.1',
        path: '/',
        expires: Math.floor((Date.now() + 60 * 60_000) / 1000),
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  });

  const targetApp = createServer((request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (url.pathname === '/secure') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<title>Login</title><input type="password" aria-label="Password"><button>Login</button>');
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_auth_login_test',
          runnerToken: 'runner_token',
          runnerName: 'Auth Login Test Runner',
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
            runId: 'run_generic_case_auth_login_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_auth_login_test',
            workspaceCode,
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 5,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {},
            environmentSnapshot: {
              environmentId,
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {},
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1007,
                caseName: 'Auth login redirect case',
                baseUrl: '${baseUrl}',
                environmentId,
                requireAuthState: true,
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    inputValue: './secure',
                    enabled: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_login_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_login_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_login_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_auth_login_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApp, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-auth-login-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.steps.length, 1);
    assert.equal(reports.steps[0].status, 'FAILED');
    assert.match(reports.steps[0].errorMessage, /登录页|登录状态已失效/);
    assert.equal(reports.results[0].status, 'FAILED');
    assert.match(reports.results[0].errorMessage, /登录页|登录状态已失效/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApp);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
    await removeStorageState(workspaceCode, environmentId);
  }

  assert.deepEqual(stderr, []);
});

test('stops WEB_CASE_RUN when platform acknowledges task cancellation', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_cancel_test',
          runnerToken: 'runner_token',
          runnerName: 'Cancel Test Runner',
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
            runId: 'run_generic_case_cancel_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_cancel_test',
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
                caseId: 1003,
                caseName: 'Cancel case',
                baseUrl: 'data:text/html,<div>cancel</div>',
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_cancel_001/status') {
      reports.status.push(body);
      const status = reports.status.length > 1 ? 'CANCELED' : body.status;
      return sendJson(response, 200, { success: true, data: { accepted: true, status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_cancel_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_cancel_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_cancel_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-cancel-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(async () => {
      const status = await getJson(runnerBaseUrl, '/tasks/poll/status');
      return status.poller?.stoppedCount === 1;
    });

    assert.equal(reports.results.length, 0);
    const status = await getJson(runnerBaseUrl, '/tasks/poll/status');
    assert.equal(status.success, true);
    assert.match(status.poller.lastStoppedMessage, /取消|停止/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('reports WEB_CASE_RUN timeout when task exceeds timeout policy', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_timeout_test',
          runnerToken: 'runner_token',
          runnerName: 'Timeout Test Runner',
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
            runId: 'run_generic_case_timeout_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_timeout_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 5,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              maxDurationMs: 300,
            },
            environmentSnapshot: {},
            variableSnapshot: {},
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1004,
                caseName: 'Timeout case',
                baseUrl: 'data:text/html,<div>timeout</div>',
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'wait-too-long',
                    stepName: 'Wait too long',
                    stepType: 'WAIT_FOR',
                    timeoutMs: 2000,
                    enabled: true,
                    sortOrder: 2,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_timeout_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_timeout_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_timeout_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_timeout_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-timeout-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    const finalResult = reports.results.at(-1);
    assert.equal(finalResult.status, 'FAILED');
    assert.match(finalResult.errorMessage, /超时|timeout/i);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('reports screenshot evidence for WEB_CASE_RUN step failure after page opens', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_screenshot_test',
          runnerToken: 'runner_token',
          runnerName: 'Screenshot Test Runner',
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
            runId: 'run_generic_case_screenshot_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_screenshot_test',
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
                caseId: 1005,
                caseName: 'Screenshot failure case',
                baseUrl: 'data:text/html,<div id="message">actual</div>',
                headless: true,
                defaultTimeoutMs: 1000,
                steps: [
                  {
                    stepId: 'open-page',
                    stepName: 'Open page',
                    stepType: 'OPEN',
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    stepId: 'assert-message',
                    stepName: 'Assert message',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#message',
                    inputValue: 'expected',
                    enabled: true,
                    sortOrder: 2,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_screenshot_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_screenshot_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_screenshot_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_case_screenshot_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-case-screenshot-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    const failedStep = reports.steps.find(item => item.stepId === 'assert-message');
    assert.equal(failedStep.status, 'FAILED');
    assert.match(failedStep.screenshotRef, /^inline:base64:/);
    assert.equal(failedStep.extra.screenshot.encoding, 'base64');
    assert.equal(failedStep.extra.screenshot.contentType, 'image/png');
    assert.ok(failedStep.extra.screenshotBase64.length > 0);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('polls generic runner task and reports real API_CASE_RUN result', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'POST' && url.pathname === '/orders/42' && request.headers.authorization === 'Bearer token-001') {
      const body = await readJson(request);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, name: body.name, status: 'PAID' }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_case_test',
          runnerToken: 'runner_token',
          runnerName: 'API Case Test Runner',
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
            runId: 'run_generic_api_case_001',
            taskType: 'API_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_case_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {
                TOKEN: 'token-001',
                ORDER_ID: '42',
                NAME: 'codex',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              apiCaseSnapshot: {
                caseId: 2001,
                caseName: 'Local API case',
                request: {
                  method: 'POST',
                  url: '{{baseUrl}}/orders/{{ORDER_ID}}',
                  headers: [
                    { name: 'Authorization', value: 'Bearer {{TOKEN}}', enabled: true },
                    { name: 'Content-Type', value: 'application/json', enabled: true },
                  ],
                  queryParams: [],
                  body: '{"name":"{{NAME}}"}',
                },
                assertions: [
                  { assertionId: 'status', type: 'STATUS_CODE', expected: '200' },
                  { assertionId: 'body', type: 'BODY_CONTAINS', expected: '"PAID"' },
                ],
                extractors: [
                  {
                    extractorId: 'order-status',
                    name: 'order-status',
                    variableName: 'ORDER_STATUS',
                    extractType: 'JSON_PATH',
                    extractScope: 'BODY',
                    expression: '$.status',
                    enabled: true,
                  },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-case-test',
      intervalMs: 1000,
      capabilities: ['API_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.statusCode, 200);
    assert.equal(reports.results[0].summary.passedAssertions, 2);
    assert.equal(reports.results[0].reportData.response.status, 200);
    assert.equal(reports.results[0].reportData.extractedVariables.ORDER_STATUS, 'PAID');
    assert.match(reports.results[0].reportData.response.body, /PAID/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('polls generic API_CASE_RUN multipart artifact upload result', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const artifactDir = join(homedir(), '.auto-web-ui-runner', 'test-artifacts');
  const artifactPath = join(artifactDir, `api-upload-${Date.now()}.txt`);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(artifactPath, 'api-upload-content', 'utf8');

  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer((request, response) => {
    let raw = Buffer.alloc(0);
    request.on('data', chunk => {
      raw = Buffer.concat([raw, Buffer.from(chunk)]);
    });
    request.on('end', () => {
      const body = raw.toString('utf8');
      const contentType = String(request.headers['content-type'] || '');
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        ok: contentType.includes('multipart/form-data')
          && body.includes('api-upload-content')
          && body.includes('filename="api-upload.txt"')
          && body.includes('name="description"')
          && body.includes('runner artifact'),
      }));
    });
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_multipart_artifact_test',
          runnerToken: 'runner_token',
          runnerName: 'API Multipart Artifact Test Runner',
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
            runId: 'run_generic_api_multipart_artifact_001',
            taskType: 'API_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_multipart_artifact_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {},
            },
            scriptSnapshot: {},
            artifactRefs: [{
              fileId: 'upload-file',
              fileName: 'api-upload.txt',
              localPath: artifactPath,
              mimeType: 'text/plain',
            }],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              apiCaseSnapshot: {
                caseId: 2011,
                caseName: 'Local API multipart artifact case',
                request: {
                  method: 'POST',
                  url: '{{baseUrl}}/upload',
                  headers: [],
                  queryParams: [],
                  body: {
                    type: 'FORM_DATA',
                    formItems: [
                      { key: 'description', value: 'runner artifact', enabled: true },
                      {
                        key: 'file',
                        value: 'artifact:upload-file',
                        enabled: true,
                        fileName: 'api-upload.txt',
                        contentType: 'text/plain',
                      },
                    ],
                  },
                },
                assertions: [
                  { assertionId: 'status', type: 'STATUS_CODE', expected: '200' },
                  { assertionId: 'body', type: 'BODY_CONTAINS', expected: '"ok":true' },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_multipart_artifact_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_multipart_artifact_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_multipart_artifact_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_multipart_artifact_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-multipart-artifact-test',
      intervalMs: 1000,
      capabilities: ['API_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.passedAssertions, 2);
    assert.match(reports.results[0].reportData.response.body, /"ok":true/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
    await rm(artifactPath, { force: true });
  }

  assert.deepEqual(stderr, []);
});

test('polls generic runner task and reports real API_SCENARIO_RUN result with extracted variables', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'POST' && url.pathname === '/orders') {
      const body = await readJson(request);
      response.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ orderId: 'A100', name: body.name, status: 'CREATED' }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/orders/A100') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ orderId: 'A100', status: 'PAID' }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_scenario_test',
          runnerToken: 'runner_token',
          runnerName: 'API Scenario Test Runner',
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
            runId: 'run_generic_api_scenario_001',
            taskType: 'API_SCENARIO_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_scenario_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {
                NAME: 'codex',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              scenarioSnapshot: {
                scenarioId: 3001,
                scenarioName: 'Local API scenario',
                steps: [
                  {
                    stepId: 'create-order',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2002,
                      caseName: 'Create order',
                      request: {
                        method: 'POST',
                        url: '{{baseUrl}}/orders',
                        headers: [
                          { name: 'Content-Type', value: 'application/json', enabled: true },
                        ],
                        body: '{"name":"{{NAME}}"}',
                      },
                      assertions: [
                        { assertionId: 'create-status', type: 'STATUS_CODE', expected: '201' },
                      ],
                      extractors: [
                        {
                          extractorId: 'order-id',
                          name: 'order-id',
                          variableName: 'ORDER_ID',
                          extractType: 'JSON_PATH',
                          extractScope: 'BODY',
                          expression: '$.orderId',
                          enabled: true,
                        },
                      ],
                    },
                  },
                  {
                    stepId: 'get-order',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2003,
                      caseName: 'Get order',
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/orders/{{ORDER_ID}}',
                        headers: [],
                      },
                      assertions: [
                        { assertionId: 'get-status', type: 'STATUS_CODE', expected: '200' },
                        { assertionId: 'get-body', type: 'BODY_CONTAINS', expected: '"PAID"' },
                      ],
                    },
                  },
                ],
              },
              runOptions: {
                stopOnFirstFailure: true,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-scenario-test',
      intervalMs: 1000,
      capabilities: ['API_SCENARIO_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.steps.length, 2);
    assert.equal(reports.results[0].summary.totalSteps, 2);
    assert.equal(reports.results[0].summary.passedSteps, 2);
    assert.equal(reports.results[0].reportData.extractedVariables.ORDER_ID, 'A100');
    assert.match(reports.results[0].reportData.stepResults[1].response.body, /PAID/);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('polls generic runner task and reports real API_SUITE_RUN result across suite items', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'POST' && url.pathname === '/suite/orders') {
      const body = await readJson(request);
      response.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ orderId: 'S100', name: body.name, status: 'CREATED' }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/suite/orders/S100') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ orderId: 'S100', status: 'PAID' }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_suite_test',
          runnerToken: 'runner_token',
          runnerName: 'API Suite Test Runner',
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
            runId: 'run_generic_api_suite_001',
            taskType: 'API_SUITE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_suite_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {
                NAME: 'codex',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              suiteSnapshot: {
                suiteId: 8001,
                suiteName: 'Local API suite',
                items: [
                  {
                    itemId: 1,
                    itemType: 'API_CASE',
                    itemName: 'Create order',
                    sortOrder: 10,
                    caseSnapshot: {
                      caseId: 2001,
                      caseName: 'Create order',
                      request: {
                        method: 'POST',
                        url: '{{baseUrl}}/suite/orders',
                        headers: [
                          { name: 'Content-Type', value: 'application/json', enabled: true },
                        ],
                        body: '{"name":"{{NAME}}"}',
                      },
                      assertions: [
                        { assertionId: 'create-status', type: 'STATUS_CODE', expected: '201' },
                      ],
                      extractors: [
                        { extractorId: 'order-id', name: 'ORDER_ID', type: 'JSON_PATH', expression: '$.orderId' },
                      ],
                    },
                  },
                  {
                    itemId: 2,
                    itemType: 'SCENARIO',
                    itemName: 'Pay order',
                    sortOrder: 20,
                    scenarioSnapshot: {
                      scenarioId: 3001,
                      scenarioName: 'Pay order',
                      steps: [
                        {
                          stepId: 'pay-order',
                          type: 'API_CASE',
                          continueOnFailure: false,
                          caseSnapshot: {
                            caseId: 2002,
                            caseName: 'Pay order',
                            request: {
                              method: 'GET',
                              url: '{{baseUrl}}/suite/orders/{{ORDER_ID}}',
                              headers: [],
                            },
                            assertions: [
                              { assertionId: 'pay-status', type: 'STATUS_CODE', expected: '200' },
                              { assertionId: 'pay-body', type: 'BODY_CONTAINS', expected: '"PAID"' },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
              runOptions: {
                stopOnFirstFailure: true,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_suite_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_suite_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_suite_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_suite_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-suite-test',
      intervalMs: 1000,
      capabilities: ['API_SUITE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.steps.length, 2);
    assert.equal(reports.results[0].summary.totalSteps, 2);
    assert.equal(reports.results[0].summary.passedSteps, 2);
    assert.equal(reports.results[0].reportData.suiteId, 8001);
    assert.equal(reports.results[0].reportData.itemSnapshots.length, 2);
    assert.equal(reports.results[0].reportData.extractedVariables.ORDER_ID, 'S100');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('continues API_SCENARIO_RUN after soft failure and supports richer assertions and extractors', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'GET' && url.pathname === '/trace') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': 'trace-7788',
      });
      response.end(JSON.stringify({ message: 'ticket=T-900', nested: { status: 'READY' } }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/tickets/T-900' && request.headers['x-trace-id'] === 'trace-7788') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ticketId: 'T-900', nested: { status: 'DONE' } }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_scenario_rich_test',
          runnerToken: 'runner_token',
          runnerName: 'API Scenario Rich Test Runner',
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
            runId: 'run_generic_api_scenario_rich_001',
            taskType: 'API_SCENARIO_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_scenario_rich_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {},
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              scenarioSnapshot: {
                scenarioId: 3002,
                scenarioName: 'Local API scenario rich',
                steps: [
                  {
                    stepId: 'trace',
                    type: 'API_CASE',
                    continueOnFailure: true,
                    caseSnapshot: {
                      caseId: 2004,
                      caseName: 'Trace',
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/trace',
                        headers: [],
                      },
                      assertions: [
                        { assertionId: 'trace-status', type: 'STATUS_CODE', expected: '200' },
                        { assertionId: 'trace-header', type: 'HEADER_EQUALS', headerName: 'x-trace-id', expected: 'trace-7788' },
                        { assertionId: 'trace-json-soft-fail', type: 'JSON_EQUALS', expression: '$.nested.status', expected: 'NOT_READY' },
                      ],
                      extractors: [
                        { extractorId: 'trace-id', name: 'TRACE_ID', type: 'HEADER', expression: 'x-trace-id' },
                        { extractorId: 'ticket-id', name: 'TICKET_ID', type: 'REGEX', expression: 'ticket=(T-\\d+)' },
                      ],
                    },
                  },
                  {
                    stepId: 'ticket',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2005,
                      caseName: 'Ticket',
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/tickets/{{TICKET_ID}}',
                        headers: [
                          { name: 'X-Trace-Id', value: '{{TRACE_ID}}', enabled: true },
                        ],
                      },
                      assertions: [
                        { assertionId: 'ticket-status', type: 'STATUS_CODE', expected: '200' },
                        { assertionId: 'ticket-json', type: 'JSON_EQUALS', expression: '$.nested.status', expected: 'DONE' },
                        { assertionId: 'ticket-time', type: 'RESPONSE_TIME_LESS_THAN', expected: '5000' },
                      ],
                    },
                  },
                ],
              },
              runOptions: {
                stopOnFirstFailure: false,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_rich_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_rich_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_rich_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_scenario_rich_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-scenario-rich-test',
      intervalMs: 1000,
      capabilities: ['API_SCENARIO_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'FAILED');
    assert.equal(reports.steps.length, 2);
    assert.equal(reports.steps[0].status, 'FAILED');
    assert.equal(reports.steps[1].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.totalSteps, 2);
    assert.equal(reports.results[0].summary.passedSteps, 1);
    assert.equal(reports.results[0].summary.failedSteps, 1);
    assert.equal(reports.results[0].reportData.extractedVariables.TRACE_ID, 'trace-7788');
    assert.equal(reports.results[0].reportData.extractedVariables.TICKET_ID, 'T-900');
    assert.equal(reports.results[0].reportData.stepResults[1].assertions.length, 3);
    assert.notEqual(reports.results[0].reportData.stepResults[1].assertions[2].actual, '0');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('runs API scripts with controlled variables and preserves continue policy', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'GET' && url.pathname === '/scripted') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Server-Token': 'server-token-42',
      });
      response.end(JSON.stringify({
        token: request.headers['x-script-token'],
        query: url.searchParams.get('q'),
      }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/after-script') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        observed: request.headers['x-server-token'],
      }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_script_test',
          runnerToken: 'runner_token',
          runnerName: 'API Script Test Runner',
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
            runId: 'run_generic_api_script_001',
            taskType: 'API_SCENARIO_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_script_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {
                SEED: 'alpha',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              scenarioSnapshot: {
                scenarioId: 3003,
                scenarioName: 'Local API scripted scenario',
                steps: [
                  {
                    stepId: 'scripted',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2006,
                      caseName: 'Scripted',
                      preScript: `
                        variables.set('SCRIPT_TOKEN', variables.get('SEED') + '-token');
                        variables.set('QUERY_VALUE', utils.upper('ready'));
                      `,
                      postScript: `
                        const data = response.json();
                        variables.set('SERVER_TOKEN', response.headers['x-server-token']);
                        variables.set('ECHO_TOKEN', data.token);
                      `,
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/scripted?q={{QUERY_VALUE}}',
                        headers: [
                          { name: 'X-Script-Token', value: '{{SCRIPT_TOKEN}}', enabled: true },
                        ],
                      },
                      assertions: [
                        { assertionId: 'script-status', type: 'STATUS_CODE', expected: '200' },
                        { assertionId: 'script-token', type: 'JSON_EQUALS', expression: '$.token', expected: 'alpha-token' },
                        { assertionId: 'script-query', type: 'JSON_EQUALS', expression: '$.query', expected: 'READY' },
                      ],
                    },
                  },
                  {
                    stepId: 'bad-script',
                    type: 'API_CASE',
                    continueOnFailure: true,
                    caseSnapshot: {
                      caseId: 2007,
                      caseName: 'Bad Script',
                      preScript: `throw new Error('planned script failure');`,
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/should-not-run',
                        headers: [],
                      },
                    },
                  },
                  {
                    stepId: 'after-script',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2008,
                      caseName: 'After Script',
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/after-script',
                        headers: [
                          { name: 'X-Server-Token', value: '{{SERVER_TOKEN}}', enabled: true },
                        ],
                      },
                      assertions: [
                        { assertionId: 'after-status', type: 'STATUS_CODE', expected: '200' },
                        { assertionId: 'after-token', type: 'JSON_EQUALS', expression: '$.observed', expected: 'server-token-42' },
                      ],
                    },
                  },
                ],
              },
              runOptions: {
                stopOnFirstFailure: false,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-script-test',
      intervalMs: 1000,
      capabilities: ['API_SCENARIO_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'FAILED');
    assert.equal(reports.steps.length, 3);
    assert.equal(reports.steps[0].status, 'SUCCESS');
    assert.equal(reports.steps[1].status, 'FAILED');
    assert.match(reports.steps[1].errorMessage, /planned script failure/);
    assert.equal(reports.steps[2].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.passedSteps, 2);
    assert.equal(reports.results[0].summary.failedSteps, 1);
    assert.equal(reports.results[0].reportData.extractedVariables.SERVER_TOKEN, '******');
    assert.equal(reports.results[0].reportData.extractedVariables.ECHO_TOKEN, '******');
    assert.equal(JSON.stringify(reports.results[0]).includes('server-token-42'), false);
    assert.equal(JSON.stringify(reports.results[0]).includes('alpha-token'), false);
    assert.equal(reports.results[0].reportData.stepResults[0].scriptResults.pre.status, 'SUCCESS');
    assert.equal(reports.results[0].reportData.stepResults[0].scriptResults.post.status, 'SUCCESS');
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('blocks unsafe API script globals and stops scenario on hard script failure', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_script_guard_test',
          runnerToken: 'runner_token',
          runnerName: 'API Script Guard Test Runner',
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
            runId: 'run_generic_api_script_guard_001',
            taskType: 'API_SCENARIO_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_script_guard_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: 'http://127.0.0.1/unused',
            },
            variableSnapshot: {
              variables: {},
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              scenarioSnapshot: {
                scenarioId: 3004,
                scenarioName: 'Local API script guard scenario',
                steps: [
                  {
                    stepId: 'unsafe-script',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2009,
                      caseName: 'Unsafe Script',
                      preScript: `variables.set('LEAK', process.cwd());`,
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/should-not-run',
                        headers: [],
                      },
                    },
                  },
                  {
                    stepId: 'after-unsafe',
                    type: 'API_CASE',
                    continueOnFailure: false,
                    caseSnapshot: {
                      caseId: 2010,
                      caseName: 'After Unsafe',
                      request: {
                        method: 'GET',
                        url: '{{baseUrl}}/after',
                        headers: [],
                      },
                    },
                  },
                ],
              },
              runOptions: {
                stopOnFirstFailure: true,
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_guard_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_guard_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_guard_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_script_guard_001/result') {
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-script-guard-test',
      intervalMs: 1000,
      capabilities: ['API_SCENARIO_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'FAILED');
    assert.equal(reports.steps.length, 1);
    assert.equal(reports.steps[0].status, 'FAILED');
    assert.match(reports.steps[0].errorMessage, /process is not defined/);
    assert.equal(reports.results[0].summary.totalSteps, 2);
    assert.equal(reports.results[0].summary.failedSteps, 1);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('runs API_CASE_RUN scripts and reports script variables', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  let targetPort = await findAvailablePort();
  while (targetPort === runnerPort || targetPort === platformPort) {
    targetPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const targetBaseUrl = `http://127.0.0.1:${targetPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const targetApi = createServer(async (request, response) => {
    const url = new URL(request.url || '/', targetBaseUrl);
    if (request.method === 'GET' && url.pathname === '/case-script') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ token: request.headers['x-case-token'] }));
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false }));
  });

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_api_case_script_test',
          runnerToken: 'runner_token',
          runnerName: 'API Case Script Test Runner',
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
            runId: 'run_generic_api_case_script_001',
            taskType: 'API_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_api_case_script_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 1,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {
              requestTimeoutMs: 5000,
            },
            environmentSnapshot: {
              baseUrl: targetBaseUrl,
            },
            variableSnapshot: {
              variables: {
                PREFIX: 'case',
              },
            },
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              apiCaseSnapshot: {
                caseId: 2011,
                caseName: 'API case script',
                preScript: `variables.set('CASE_TOKEN', variables.get('PREFIX') + '-token');`,
                postScript: `
                  const data = response.json();
                  variables.set('CASE_ECHO', data.token);
                `,
                request: {
                  method: 'GET',
                  url: '{{baseUrl}}/case-script',
                  headers: [
                    { name: 'X-Case-Token', value: '{{CASE_TOKEN}}', enabled: true },
                  ],
                },
                assertions: [
                  { assertionId: 'case-script-status', type: 'STATUS_CODE', expected: '200' },
                  { assertionId: 'case-script-token', type: 'JSON_EQUALS', expression: '$.token', expected: 'case-token' },
                ],
              },
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_script_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_script_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_script_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_api_case_script_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(targetApi, targetPort);
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
    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-api-case-script-test',
      intervalMs: 1000,
      capabilities: ['API_CASE_RUN'],
    });
    assert.equal(started.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].reportData.scriptResults.pre.status, 'SUCCESS');
    assert.equal(reports.results[0].reportData.scriptResults.post.status, 'SUCCESS');
    assert.equal(reports.results[0].reportData.extractedVariables.CASE_ECHO, '******');
    assert.equal(JSON.stringify(reports.results[0]).includes('case-token'), false);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    await closeServer(targetApi);
    await closeServer(fakePlatform);
    await stopRunnerProcess(runner);
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

async function stopRunnerProcess(runner) {
  if (runner.exitCode !== null || runner.signalCode !== null) {
    return;
  }
  const exited = once(runner, 'exit').catch(() => {});
  runner.kill();
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
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

async function writeStorageState(workspaceId, environmentId, storageState) {
  const filePath = storageStatePath(workspaceId, environmentId);
  await mkdir(join(homedir(), '.auto-web-ui-runner', 'auth'), { recursive: true });
  await writeFile(filePath, JSON.stringify(storageState), 'utf8');
  await writeFile(`${filePath}.meta.json`, JSON.stringify({
    workspaceId,
    environmentId,
    savedAt: new Date().toISOString(),
    url: '',
  }), 'utf8');
}

async function removeStorageState(workspaceId, environmentId) {
  const filePath = storageStatePath(workspaceId, environmentId);
  await rm(filePath, { force: true });
  await rm(`${filePath}.meta.json`, { force: true });
}

function storageStatePath(workspaceId, environmentId) {
  return join(homedir(), '.auto-web-ui-runner', 'auth', `${safeName(workspaceId)}__${safeName(environmentId)}.json`);
}

function safeName(value) {
  return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
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
