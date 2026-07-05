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
const LABEL_LOCAL_RUN = '\u672c\u5730\u8fd0\u884c';

const FIXTURE_FILE_NAME = 'upload-demo.txt';
const FIXTURE_FILE_CONTENT = 'demo';
const FIXTURE_FILE_BASE64 = 'ZGVtbw==';
const FIXTURE_FILE_CONTENT_TYPE = 'text/plain';
const FIXTURE_INPUT_SELECTOR = '#attachment';
const FIXTURE_RESULT_TEXT = `Uploaded ${FIXTURE_FILE_NAME}`;
const MOCK_FORMAL_RUN_ID = 90001;

async function main() {
  const fixture = await startUploadFixtureServer();
  const browser = await chromium.launch({ headless: false, slowMo: 25 });
  const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  const page = await context.newPage();

  let caseDetail = null;
  let savedPayload = null;
  let localRunnerRunPayload = null;
  let runnerPollStartPayload = null;

  try {
    await verifyEnvironment();

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes(`/api/automation/web/cases/${CASE_ID}`) && response.request().method() === 'GET') {
        try {
          caseDetail = await response.json();
        } catch {
          // Ignore unrelated retries.
        }
      }
    });

    await page.route(`${BACKEND_BASE_URL}/api/automation/web/cases/${CASE_ID}`, async (route) => {
      const request = route.request();
      if (request.method() === 'GET' && savedPayload) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: buildSavedCaseDetail(caseDetail?.data || {}, savedPayload),
            message: 'OK',
          }),
        });
        return;
      }
      if (request.method() !== 'PUT') {
        await route.continue();
        return;
      }
      savedPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: buildSavedCaseDetail(caseDetail?.data || {}, savedPayload),
          message: 'OK',
        }),
      });
    });

    await page.route(`${BACKEND_BASE_URL}/api/automation/web/cases/${CASE_ID}/local-runner-run`, async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      localRunnerRunPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            run: {
              runId: MOCK_FORMAL_RUN_ID,
              caseId: CASE_ID,
              caseName: 'Recording upload platform closure replay',
              status: 'SUCCESS',
              totalSteps: 3,
              passedSteps: 3,
              failedSteps: 0,
              skippedSteps: 0,
            },
            runnerTask: {
              runId: 'mock_recording_upload_platform_run_001',
              taskType: 'WEB_CASE_RUN',
              runnerId: 'mock-local-runner',
              status: 'SUCCESS',
              currentStage: 'COMPLETED',
              progress: {
                current: 3,
                total: 3,
                percent: 100,
              },
              statusMessage: 'mocked local runner run accepted',
              errorMessage: null,
              assignedAt: new Date().toISOString(),
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              lastReportedAt: new Date().toISOString(),
              result: {},
            },
          },
          message: 'OK',
        }),
      });
    });

    await page.route(`${BACKEND_BASE_URL}/api/automation/web/runs/${MOCK_FORMAL_RUN_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            summary: {
              id: MOCK_FORMAL_RUN_ID,
              workspaceCode: WORKSPACE_CODE,
              workspaceName: WORKSPACE_CODE,
              caseId: CASE_ID,
              caseName: 'Recording upload platform closure replay',
              status: 'SUCCESS',
              browserType: 'CHROMIUM',
              headless: true,
              totalSteps: 3,
              passedSteps: 3,
              failedSteps: 0,
              skippedSteps: 0,
              executionLocation: 'LOCAL_RUNNER',
            },
            context: null,
            steps: [],
          },
          message: 'OK',
        }),
      });
    });

    await page.route(`${RUNNER_BASE_URL}/tasks/poll/start`, async (route) => {
      const request = route.request();
      runnerPollStartPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          poller: {
            apiBaseUrl: BACKEND_BASE_URL,
            installId: runnerPollStartPayload?.installId || 'mock-platform-recording-upload',
            runnerId: 'mock-local-runner',
            runnerVersion: '0.1.0',
            protocolVersion: '1.0',
            capabilities: runnerPollStartPayload?.capabilities || ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
            workspaceCodes: runnerPollStartPayload?.workspaceCodes || [WORKSPACE_CODE],
            maxResourceSlots: 5,
            resource: {
              mode: 'LOCAL_NODE_RUNNER',
              validationMode: 'LOCAL_PLAYWRIGHT',
              executionMode: 'LOCAL_PLAYWRIGHT',
              maxSlots: 5,
              usedSlots: 0,
              availableSlots: 5,
              runningRunIds: [],
            },
            running: true,
            tickRunning: false,
            startedAt: new Date().toISOString(),
            lastTickAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastMessage: 'mocked',
            pulledCount: 0,
            completedCount: 0,
            failedCount: 0,
            stoppedCount: 0,
            currentRunId: null,
            currentTaskType: null,
            lastTaskType: null,
            intervalMs: 1000,
            lastStoppedMessage: null,
          },
        }),
      });
    });

    await runnerPost('/tasks/poll/stop', {}).catch(() => null);
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
    }, 20000, 'runner session did not open upload fixture page');
    const currentSessionId = heartbeat.session.sessionId;

    await clickLastEnabledButtonByText(page, LABEL_START);

    const statusBeforeStop = await waitFor(async () => {
      const value = await runnerGet('/record/status');
      const sameSession = value?.recording?.sessionId === currentSessionId;
      const active = value?.recording?.status === 'RECORDING';
      const recordedUpload = value?.steps?.[0]?.type === 'FILE_UPLOAD';
      return sameSession && active && recordedUpload ? value : null;
    }, 25000, 'runner did not record the fixture upload interaction');

    await clickLastEnabledButtonByText(page, LABEL_STOP);

    const statusAfterStop = await waitFor(async () => {
      const value = await runnerGet('/record/status');
      const sameSession = value?.recording?.sessionId === currentSessionId;
      const stopped = value?.recording?.status === 'STOPPED';
      const recordedUpload = value?.steps?.[0]?.type === 'FILE_UPLOAD';
      return sameSession && stopped && recordedUpload ? value : null;
    }, 15000, 'runner did not stop with recorded upload steps');

    await waitFor(async () => {
      const text = await page.locator('body').innerText();
      return text.includes('\u5171 1 \u6b65') ? text : null;
    }, 15000, 'platform workbench did not show the recorded upload step');

    await clickLastEnabledButtonByText(page, LABEL_SAVE);

    await waitFor(() => savedPayload, 10000, 'platform upload save request was not captured');

    const savedStep = savedPayload?.steps?.[0];
    assert.equal(savedPayload?.steps?.length, 1, 'expected a single saved recorded upload step');
    assert.equal(savedStep?.type, 'FILE_UPLOAD');
    assert.equal(savedStep?.locatorType, 'CSS');
    assert.equal(savedStep?.locatorValue, FIXTURE_INPUT_SELECTOR);
    assert.match(String(savedStep?.inputValue || ''), /^artifact:/);
    assert.equal(savedStep?.uploadArtifactBinding?.contentBase64, FIXTURE_FILE_BASE64);

    await page.reload({
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await waitFor(async () => {
      const text = await page.locator('body').innerText();
      const hasStepSummary = text.includes('\u5171 1 \u6b65');
      const hasFileUploadStep = text.includes('\u4e0a\u4f20');
      return hasStepSummary && hasFileUploadStep ? text : null;
    }, 15000, 'platform upload step did not survive page reload');

    await waitForEnabledButtonByText(page, LABEL_LOCAL_RUN);
    await clickLastEnabledButtonByText(page, LABEL_LOCAL_RUN);
    await waitFor(() => localRunnerRunPayload, 10000, 'platform local runner upload request was not captured');

    assert.equal(runnerPollStartPayload?.capabilities?.includes('WEB_CASE_RUN'), true, 'platform did not request WEB_CASE_RUN polling');
    assert.equal(Array.isArray(localRunnerRunPayload?.artifactRefs), true, 'local runner run payload did not include artifactRefs');
    assert.equal(localRunnerRunPayload?.artifactRefs?.length, 1, 'expected a single upload artifact ref');

    const uploadArtifactRef = localRunnerRunPayload.artifactRefs[0];
    assert.equal(savedStep.inputValue, `artifact:${uploadArtifactRef.fileId}`);
    assert.equal(uploadArtifactRef.fileName, FIXTURE_FILE_NAME);
    assert.equal(uploadArtifactRef.contentType, FIXTURE_FILE_CONTENT_TYPE);
    assert.equal(uploadArtifactRef.contentBase64, FIXTURE_FILE_BASE64);
    assert.equal(uploadArtifactRef.size, Buffer.byteLength(FIXTURE_FILE_CONTENT, 'utf8'));

    await runnerPost('/tasks/poll/stop', {}).catch(() => null);
    await runnerPost('/session/release', {});
    const replayPlatform = await startReplayPlatform({
      playbackUrl: fixture.buildUrl('playback'),
      savedStep,
      artifactRefs: localRunnerRunPayload.artifactRefs,
    });

    let replayResult;
    try {
      const replayStarted = await runnerPost('/tasks/poll/start', {
        apiBaseUrl: replayPlatform.baseUrl,
        installId: 'recording-platform-upload-closure',
        intervalMs: 1000,
        capabilities: ['WEB_CASE_RUN'],
      });
      assert.equal(replayStarted?.success, true, 'runner task polling did not start for upload replay');

      await waitForReplayStage(
        replayPlatform,
        'register',
        () => replayPlatform.reports.register[0] || null,
        12000,
        'runner upload replay register was not reported',
      );
      await waitForReplayStage(
        replayPlatform,
        'pull',
        () => replayPlatform.reports.pull[0] || null,
        20000,
        'runner upload replay task pull was not reported',
      );

      replayResult = await waitForReplayResult(replayPlatform, 'runner upload replay result was not reported');
      assert.equal(replayResult?.status, 'SUCCESS', 'runner upload replay task did not succeed');
      assert.equal(replayPlatform.reports.steps.length, 3, 'expected open/upload/assert step reports');
      assert.deepEqual(
        replayPlatform.reports.steps.map(item => item.status),
        ['SUCCESS', 'SUCCESS', 'SUCCESS'],
        'upload replay steps did not all succeed',
      );
    } finally {
      await runnerPost('/tasks/poll/stop', {}).catch(() => null);
      await replayPlatform.close();
    }

    await page.screenshot({
      path: 'output/playwright/recording-platform-upload-closure-script.png',
      fullPage: true,
    });

    console.log(JSON.stringify({
      success: true,
      fixtureUrl,
      statusBeforeStop: summarizeRecording(statusBeforeStop),
      statusAfterStop: summarizeRecording(statusAfterStop),
      savedStep,
      localRunnerRunPayload: {
        headless: localRunnerRunPayload?.headless ?? null,
        artifactRefs: localRunnerRunPayload?.artifactRefs || [],
      },
      replayResult: replayResult ? {
        status: replayResult.status,
        summary: replayResult.summary,
      } : null,
      screenshot: 'output/playwright/recording-platform-upload-closure-script.png',
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

function buildSavedCaseDetail(base, savedPayload) {
  return {
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
  };
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

async function waitForEnabledButtonByText(page, text) {
  await waitFor(async () => {
    const available = await page.evaluate((label) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((button) => (button.textContent || '').trim().includes(label) && !button.disabled);
    }, text);
    return available ? true : null;
  }, 15000, `button not found or disabled: ${text}`);
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

async function waitForReplayResult(replayPlatform, failureMessage) {
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
    }, 45000, failureMessage);
  } catch (error) {
    await throwReplayDiagnosticsError(replayPlatform, 'result', error, failureMessage);
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
      inputValue: step.inputValue,
      uploadArtifact: step.uploadArtifact || null,
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

async function startUploadFixtureServer() {
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const mode = url.searchParams.get('mode') === 'playback' ? 'playback' : 'record';
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(buildUploadFixtureHtml(mode));
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

async function startReplayPlatform({ playbackUrl, savedStep, artifactRefs }) {
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
          runnerId: 'recording_platform_upload_closure_runner',
          runnerToken: 'runner_token',
          runnerName: 'Recording Platform Upload Closure Runner',
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
            runId: 'recording_platform_upload_closure_replay_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'recording_platform_upload_closure_runner',
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
            artifactRefs: Array.isArray(artifactRefs) ? artifactRefs : [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: CASE_ID,
                caseName: 'Recording platform upload closure replay',
                baseUrl: '',
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-upload-playback-page',
                    stepName: 'Open upload playback page',
                    stepType: 'OPEN',
                    inputValue: playbackUrl,
                    enabled: true,
                    sortOrder: 1,
                  },
                  {
                    ...savedStep,
                    stepId: 'recorded-upload-step-1',
                    stepName: savedStep.name || 'Recorded upload replay step',
                    stepType: savedStep.type || savedStep.stepType,
                    enabled: true,
                    sortOrder: 2,
                  },
                  {
                    stepId: 'assert-upload-playback-result',
                    stepName: 'Assert upload playback result',
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

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_upload_closure_replay_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_upload_closure_replay_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_upload_closure_replay_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/recording_platform_upload_closure_replay_001/result') {
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

function buildUploadFixtureHtml(mode) {
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8"><title>upload-fixture</title></head>',
    '<body>',
    '<label for="attachment">Attachment</label>',
    '<input id="attachment" type="file" />',
    '<div id="result"></div>',
    '<script>',
    'const result = document.querySelector("#result");',
    'const input = document.querySelector("#attachment");',
    'input.addEventListener("change", () => {',
    '  const file = input.files && input.files[0];',
    '  result.textContent = file ? `Uploaded ${file.name}` : "No file";',
    '});',
    'function injectRecordedFile() {',
    `  const file = new File([${JSON.stringify(FIXTURE_FILE_CONTENT)}], ${JSON.stringify(FIXTURE_FILE_NAME)}, { type: ${JSON.stringify(FIXTURE_FILE_CONTENT_TYPE)} });`,
    '  const dt = new DataTransfer();',
    '  dt.items.add(file);',
    '  input.files = dt.files;',
    '  input.dispatchEvent(new Event("change", { bubbles: true }));',
    '}',
    'const timer = setInterval(() => {',
    `  if (${JSON.stringify(mode)} === "record" && window.__autoWebRunnerRecorderInstalled && !window.__fixtureUploadDone) {`,
    '    window.__fixtureUploadDone = true;',
    '    clearInterval(timer);',
    '    window.setTimeout(() => injectRecordedFile(), 900);',
    '  }',
    '}, 200);',
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
