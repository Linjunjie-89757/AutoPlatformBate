import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';

const FRONTEND_BASE_URL = process.env.LOCAL_RUNNER_E2E_FRONTEND_URL || 'http://localhost:5175';
const RUNNER_BASE_URL = process.env.LOCAL_RUNNER_E2E_RUNNER_URL || 'http://127.0.0.1:39118';
const BACKEND_BASE_URL = process.env.LOCAL_RUNNER_E2E_BACKEND_URL || 'http://localhost:8080';
const USERNAME = process.env.LOCAL_RUNNER_E2E_USERNAME || 'zhangli';
const PASSWORD = process.env.LOCAL_RUNNER_E2E_PASSWORD || '123456';
const WORKSPACE_CODE = process.env.LOCAL_RUNNER_E2E_WORKSPACE || 'account-open';
const CASE_ID = Number(process.env.LOCAL_RUNNER_E2E_CASE_ID || 64);

const LABEL_OPEN = '\u6253\u5f00\u76ee\u6807\u9875';
const LABEL_START = '\u5f00\u59cb\u5f55\u5236';
const LABEL_STOP = '\u505c\u6b62\u5e76\u751f\u6210\u6b65\u9aa4';
const LABEL_SAVE = '\u4fdd\u5b58';

const FIXTURE_BUTTON_TEXT = 'Shadow Button';
const FIXTURE_TEST_ID = 'shadow-button';
const FIXTURE_FRAME_SELECTOR = 'iframe#demo-frame';
const FIXTURE_SHADOW_SELECTOR = 'fixture-host';
const FIXTURE_RESULT_TEXT = 'clicked shadow-button';

async function main() {
  const fixture = await startFixtureServer();
  const browser = await chromium.launch({ headless: false, slowMo: 25 });
  const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  const page = await context.newPage();

  let caseDetail = null;
  let savedPayload = null;

  try {
    await verifyEnvironment();

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes(`/api/automation/web/cases/${CASE_ID}`) && response.request().method() === 'GET') {
        try {
          caseDetail = await response.json();
        } catch {
          // Ignore read failures from unrelated retries.
        }
      }
    });

    await page.route(`${BACKEND_BASE_URL}/api/automation/web/cases/${CASE_ID}`, async (route) => {
      const request = route.request();
      if (request.method() !== 'PUT') {
        await route.continue();
        return;
      }
      savedPayload = request.postDataJSON();
      const base = caseDetail?.data || {};
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...base,
            id: CASE_ID,
            workspaceCode: WORKSPACE_CODE,
            workspaceName: base.workspaceName || 'X-MAN',
            name: savedPayload.name,
            caseName: savedPayload.name,
            moduleName: savedPayload.moduleName,
            description: savedPayload.description,
            baseUrl: savedPayload.baseUrl,
            browserType: savedPayload.browserType,
            headless: savedPayload.headless,
            defaultTimeoutMs: savedPayload.defaultTimeoutMs,
            status: savedPayload.status,
            updatedAt: new Date().toISOString(),
            steps: savedPayload.steps,
          },
          message: 'OK',
        }),
      });
    });

    await runnerPost('/session/release', {});

    await loginToPlatform(page);
    await page.goto(`${FRONTEND_BASE_URL}/automation/web/cases/${CASE_ID}?workspace=${WORKSPACE_CODE}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    const fixtureUrl = `${fixture.baseUrl}/?t=${Date.now()}`;
    await page.locator('input').nth(1).fill(fixtureUrl);

    await clickLastEnabledButtonByText(page, LABEL_OPEN);
    const heartbeat = await waitFor(async () => {
      const value = await runnerGet('/session/heartbeat');
      return value?.session?.currentUrl?.includes(fixture.baseUrl) ? value : null;
    }, 20000, 'runner session did not open fixture page');
    const currentSessionId = heartbeat.session.sessionId;

    await clickLastEnabledButtonByText(page, LABEL_START);

    const statusBeforeStop = await waitFor(async () => {
      const value = await runnerGet('/record/status');
      const sameSession = value?.recording?.sessionId === currentSessionId;
      const active = value?.recording?.status === 'RECORDING';
      const hasStep = Number(value?.recording?.stepCount || 0) > 0;
      return sameSession && active && hasStep ? value : null;
    }, 25000, 'runner did not record the fixture interaction');

    await clickLastEnabledButtonByText(page, LABEL_STOP);

    const statusAfterStop = await waitFor(async () => {
      const value = await runnerGet('/record/status');
      const sameSession = value?.recording?.sessionId === currentSessionId;
      const stopped = value?.recording?.status === 'STOPPED';
      const hasStep = Number(value?.recording?.stepCount || 0) > 0;
      return sameSession && stopped && hasStep ? value : null;
    }, 15000, 'runner did not stop with recorded steps');

    await waitFor(async () => {
      const text = await page.locator('body').innerText();
      return text.includes('\u5171 1 \u6b65') ? text : null;
    }, 15000, 'platform workbench did not show the recorded draft step');

    await clickLastEnabledButtonByText(page, LABEL_SAVE);

    await waitFor(() => savedPayload, 10000, 'platform save request was not captured');

    const savedStep = savedPayload?.steps?.[0];
    assert.equal(savedPayload?.steps?.length, 1, 'expected a single saved recorded step');
    assert.equal(savedStep?.locatorType, 'TEST_ID');
    assert.equal(savedStep?.locatorValue, FIXTURE_TEST_ID);
    assert.deepEqual(savedStep?.framePath, [{ selector: FIXTURE_FRAME_SELECTOR }]);
    assert.deepEqual(savedStep?.shadowPath, [FIXTURE_SHADOW_SELECTOR]);

    await runnerPost('/tasks/poll/stop', {}).catch(() => null);
    await runnerPost('/session/release', {});
    const replayPlatform = await startReplayPlatform({
      playbackUrl: fixture.buildUrl('playback'),
      savedStep,
    });
    let replayResult;
    try {
      const replayStarted = await runnerPost('/tasks/poll/start', {
        apiBaseUrl: replayPlatform.baseUrl,
        installId: 'recording-platform-closure',
        intervalMs: 1000,
        capabilities: ['WEB_CASE_RUN'],
      });
      assert.equal(replayStarted?.success, true, 'runner task polling did not start');

      await waitForReplayStage(
        replayPlatform,
        'register',
        () => replayPlatform.reports.register[0] || null,
        12000,
        'runner replay register was not reported',
      );
      await waitForReplayStage(
        replayPlatform,
        'pull',
        () => replayPlatform.reports.pull[0] || null,
        20000,
        'runner replay task pull was not reported',
      );
      replayResult = await waitForReplayResult(replayPlatform);
      assert.equal(replayResult?.status, 'SUCCESS', 'runner replay task did not succeed');
      assert.equal(replayPlatform.reports.steps.length, 3, 'expected open/click/assert step reports');
      assert.deepEqual(
        replayPlatform.reports.steps.map(item => item.status),
        ['SUCCESS', 'SUCCESS', 'SUCCESS'],
        'replay steps did not all succeed',
      );
      assert.deepEqual(replayPlatform.reports.steps[1]?.extra?.framePath, [{ selector: FIXTURE_FRAME_SELECTOR }]);
      assert.deepEqual(replayPlatform.reports.steps[1]?.extra?.shadowPath, [FIXTURE_SHADOW_SELECTOR]);
    } finally {
      await runnerPost('/tasks/poll/stop', {}).catch(() => null);
      await replayPlatform.close();
    }

    await page.screenshot({
      path: 'output/playwright/recording-platform-real-closure-script.png',
      fullPage: true,
    });

    console.log(JSON.stringify({
      success: true,
      fixtureUrl,
      statusBeforeStop: summarizeRecording(statusBeforeStop),
      statusAfterStop: summarizeRecording(statusAfterStop),
      savedStep,
      replayResult: replayResult ? {
        status: replayResult.status,
        summary: replayResult.summary,
      } : null,
      screenshot: 'output/playwright/recording-platform-real-closure-script.png',
    }, null, 2));
  } finally {
    await runnerPost('/tasks/poll/stop', {}).catch(() => null);
    await runnerPost('/session/release', {}).catch(() => null);
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
    await fixture.close();
  }
}

async function verifyEnvironment() {
  const frontend = await fetch(`${FRONTEND_BASE_URL}/login`);
  assert.equal(frontend.ok, true, `frontend is unreachable: ${FRONTEND_BASE_URL}`);

  const runnerHealth = await runnerGet('/health');
  assert.equal(runnerHealth?.success, true, `runner is unreachable: ${RUNNER_BASE_URL}`);
}

async function loginToPlatform(page) {
  await page.goto(`${FRONTEND_BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[autocomplete="username"]').fill(USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/config-center', { timeout: 30000 });
}

async function clickLastEnabledButtonByText(page, text) {
  const clicked = await page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.filter((button) => (button.textContent || '').trim().includes(label) && !button.disabled).pop();
    if (!target) {
      return false;
    }
    target.click();
    return true;
  }, text);
  assert.equal(clicked, true, `button not found or disabled: ${text}`);
}

async function runnerGet(path) {
  const response = await fetch(`${RUNNER_BASE_URL}${path}`);
  assert.equal(response.ok, true, `runner GET failed: ${path}`);
  return response.json();
}

async function runnerPost(path, body) {
  const response = await fetch(`${RUNNER_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  assert.equal(response.ok, true, `runner POST failed: ${path}`);
  return response.json();
}

async function waitFor(fn, timeoutMs, failureMessage) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await fn();
    if (value) {
      return value;
    }
    await sleep(300);
  }
  throw new Error(failureMessage);
}

async function waitForReplayStage(replayPlatform, stage, predicate, timeoutMs, failureMessage) {
  try {
    return await waitFor(predicate, timeoutMs, failureMessage);
  } catch (error) {
    await throwReplayDiagnosticsError(replayPlatform, stage, error, failureMessage);
  }
}

async function waitForReplayResult(replayPlatform) {
  try {
    return await waitFor(async () => {
      if (replayPlatform.reports.results.length > 0) {
        return replayPlatform.reports.results[0];
      }
      const pollStatus = await runnerGet('/tasks/poll/status').catch(() => null);
      const poller = pollStatus?.poller;
      if (poller?.failedCount > 0 && poller?.lastError) {
        throw new Error(`runner poller failed before replay result: ${poller.lastError}`);
      }
      return null;
    }, 45000, 'runner replay result was not reported');
  } catch (error) {
    await throwReplayDiagnosticsError(replayPlatform, 'result', error, 'runner replay result was not reported');
  }
}

async function throwReplayDiagnosticsError(replayPlatform, stage, error, failureMessage) {
  const pollStatus = await runnerGet('/tasks/poll/status').catch(() => null);
  const diagnostics = {
    stage,
    pollStatus,
    replayReports: summarizeReplayReports(replayPlatform.reports),
  };
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    diagnostics,
  }, null, 2));
  throw new Error(`${failureMessage}: ${JSON.stringify(diagnostics)}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function summarizeRecording(result) {
  return {
    sessionId: result?.recording?.sessionId || null,
    status: result?.recording?.status || null,
    eventCount: Number(result?.recording?.eventCount || 0),
    stepCount: Number(result?.recording?.stepCount || 0),
    steps: Array.isArray(result?.steps) ? result.steps.map(step => ({
      type: step.type,
      locatorType: step.locatorType,
      locatorValue: step.locatorValue,
      framePath: step.framePath,
      shadowPath: step.shadowPath,
    })) : [],
  };
}

function summarizeReplayReports(reports) {
  return {
    registerCount: Array.isArray(reports?.register) ? reports.register.length : 0,
    pullCount: Array.isArray(reports?.pull) ? reports.pull.length : 0,
    statusCount: Array.isArray(reports?.status) ? reports.status.length : 0,
    logCount: Array.isArray(reports?.logs) ? reports.logs.length : 0,
    stepCount: Array.isArray(reports?.steps) ? reports.steps.length : 0,
    resultCount: Array.isArray(reports?.results) ? reports.results.length : 0,
    lastStatus: Array.isArray(reports?.status) && reports.status.length > 0 ? reports.status[reports.status.length - 1] : null,
    lastStep: Array.isArray(reports?.steps) && reports.steps.length > 0 ? reports.steps[reports.steps.length - 1] : null,
    lastResult: Array.isArray(reports?.results) && reports.results.length > 0 ? reports.results[reports.results.length - 1] : null,
  };
}

async function startFixtureServer() {
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const mode = url.searchParams.get('mode') === 'playback' ? 'playback' : 'record';
    if (request.url?.startsWith('/frame.html')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildFrameHtml(mode));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(buildIndexHtml(mode));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object' && typeof address.port === 'number');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    buildUrl: (mode = 'record') => `http://127.0.0.1:${address.port}/?mode=${mode}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

async function startReplayPlatform({ playbackUrl, savedStep }) {
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'recording_platform_closure_runner',
          runnerToken: 'runner_token',
          runnerName: 'Recording Platform Closure Runner',
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
            runId: 'recording_platform_closure_replay_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'recording_platform_closure_runner',
            workspaceCode: WORKSPACE_CODE,
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
                caseId: CASE_ID,
                caseName: 'Recording platform closure replay',
                baseUrl: '',
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-playback-page',
                    stepName: 'Open playback page',
                    stepType: 'OPEN',
                    inputValue: playbackUrl,
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    ...savedStep,
                    stepId: 'recorded-step-1',
                    stepName: savedStep.name || 'Recorded replay step',
                    stepType: savedStep.type || savedStep.stepType,
                    enabled: true,
                    sortOrder: 2,
                  },
                  {
                    stepId: 'assert-playback-result',
                    stepName: 'Assert playback result',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#result',
                    inputValue: FIXTURE_RESULT_TEXT,
                    enabled: true,
                    sortOrder: 3,
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

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_closure_replay_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_closure_replay_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_closure_replay_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_closure_replay_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected replay platform route: ${request.method} ${url.pathname}`,
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object' && typeof address.port === 'number');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    reports,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function buildIndexHtml(mode) {
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8"><title>iframe-shadow-fixture</title></head>',
    '<body>',
    '<div id="result"></div>',
    `<iframe id="demo-frame" name="demo-frame" src="/frame.html?mode=${mode}" style="width:800px;height:400px;border:1px solid #ccc"></iframe>`,
    '</body>',
    '</html>',
  ].join('');
}

function buildFrameHtml(mode) {
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8"><title>frame</title></head>',
    '<body>',
    '<fixture-host></fixture-host>',
    '<script>',
    'class FixtureHost extends HTMLElement {',
    '  constructor() {',
    '    super();',
    '    const root = this.attachShadow({ mode: "open" });',
    '    const button = document.createElement("button");',
    '    button.type = "button";',
    `    button.textContent = ${JSON.stringify(FIXTURE_BUTTON_TEXT)};`,
    `    button.setAttribute("data-testid", ${JSON.stringify(FIXTURE_TEST_ID)});`,
    `    button.addEventListener("click", () => { const result = window.top?.document?.querySelector("#result"); if (result) result.textContent = ${JSON.stringify(FIXTURE_RESULT_TEXT)}; });`,
    '    root.appendChild(button);',
    '    const timer = setInterval(() => {',
    `      if (${JSON.stringify(mode)} === "record" && window.__autoWebRunnerRecorderInstalled && !window.__fixtureClicked) {`,
    '        window.__fixtureClicked = true;',
    '        clearInterval(timer);',
    '        setTimeout(() => button.click(), 900);',
    '      }',
    '    }, 200);',
    '  }',
    '}',
    'customElements.define("fixture-host", FixtureHost);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length <= 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
