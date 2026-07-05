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

test('replays recorded file upload through WEB_CASE_RUN artifact refs', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildRecordedUploadReplayPageHtml({ autoInteract: true }))}`;
  const playbackPageUrl = `data:text/html,${encodeURIComponent(buildRecordedUploadReplayPageHtml({ autoInteract: false }))}`;
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
  let artifactRefs = [];

  const fakePlatform = createHttpServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_recording_upload_replay_test',
          runnerToken: 'runner_token',
          runnerName: 'Recording Upload Replay Test Runner',
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
            runId: 'run_recording_upload_replay_001',
            taskType: 'WEB_CASE_RUN',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_recording_upload_replay_test',
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
            artifactRefs,
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              caseSnapshot: {
                caseId: 1003,
                caseName: 'Recorded upload replay case',
                baseUrl: '',
                headless: true,
                defaultTimeoutMs: 5000,
                steps: [
                  {
                    stepId: 'open-recorded-upload-page',
                    stepName: 'Open recorded upload playback page',
                    stepType: 'OPEN',
                    inputValue: playbackPageUrl,
                    enabled: true,
                    sortOrder: 1,
                  },
                  ...recordedSteps.map((step, index) => ({
                    ...step,
                    stepId: `recorded-upload-${index + 1}`,
                    stepName: step.name || `Recorded upload step ${index + 1}`,
                    stepType: step.stepType || step.type,
                    enabled: true,
                    sortOrder: index + 2,
                  })),
                  {
                    stepId: 'assert-recorded-upload-result',
                    stepName: 'Assert recorded upload replay result',
                    stepType: 'ASSERT_TEXT',
                    locatorType: 'CSS',
                    locatorValue: '#result',
                    inputValue: 'Uploaded upload-demo.txt',
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

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_upload_replay_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_upload_replay_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_upload_replay_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_recording_upload_replay_001/result') {
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

    await new Promise(resolve => setTimeout(resolve, 1600));

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.success, true);
    assert.equal(stopped.steps.length, 1);
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILE_UPLOAD']);
    assert.equal(stopped.steps[0].locatorType, 'CSS');
    assert.equal(stopped.steps[0].locatorValue, '#attachment');
    assert.equal(stopped.steps[0].inputValue, 'upload-demo.txt');
    assert.deepEqual(stopped.steps[0].uploadArtifact, {
      fileName: 'upload-demo.txt',
      contentType: 'text/plain',
      contentBase64: 'ZGVtbw==',
      size: 4,
      captureStatus: 'READY',
    });

    const uploadArtifact = stopped.steps[0].uploadArtifact;
    artifactRefs = [{
      fileId: 'recorded-upload-artifact-1',
      artifactId: 'recorded-upload-artifact-1',
      fileName: uploadArtifact.fileName,
      contentType: uploadArtifact.contentType,
      contentBase64: uploadArtifact.contentBase64,
      size: uploadArtifact.size,
    }];
    recordedSteps = stopped.steps.map((step) => ({
      ...step,
      inputValue: `artifact:${artifactRefs[0].fileId}`,
    }));

    await postJson(runnerBaseUrl, '/session/release', {});
    const startedReplay = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'recording-upload-replay-test',
      intervalMs: 1000,
      capabilities: ['WEB_CASE_RUN'],
    });
    assert.equal(startedReplay.success, true);

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.register.length, 1);
    assert.equal(reports.pull[0].capabilities.includes('WEB_CASE_RUN'), true);
    assert.equal(reports.steps.length, 3);
    assert.deepEqual(reports.steps.map(item => item.status), ['SUCCESS', 'SUCCESS', 'SUCCESS']);
    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.total, 3);
    assert.equal(reports.results[0].summary.passed, 3);
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
    assert.deepEqual(stopped.steps[3].uploadArtifact, {
      fileName: 'upload-demo.txt',
      contentType: 'text/plain',
      contentBase64: 'ZGVtbw==',
      size: 4,
      captureStatus: 'READY',
    });
    assert.deepEqual(stopped.events[3].uploadArtifact, stopped.steps[3].uploadArtifact);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('upgrades file input click to file upload after native picker focus returns', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildNativeFilePickerFallbackRecordingPageHtml())}`;

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
      return status?.steps?.length === 1 && status.steps[0]?.type === 'FILE_UPLOAD';
    }, 5000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILE_UPLOAD']);
    assert.equal(stopped.steps[0].locatorType, 'CSS');
    assert.equal(stopped.steps[0].locatorValue, '#attachment');
    assert.equal(stopped.steps[0].inputValue, 'native-upload.txt');
    assert.deepEqual(stopped.steps[0].uploadArtifact, {
      fileName: 'native-upload.txt',
      contentType: 'text/plain',
      contentBase64: 'bmF0aXZl',
      size: 6,
      captureStatus: 'READY',
    });
    assert.equal(stopped.events.length, 1);
    assert.equal(stopped.events[0].kind, 'FILE_UPLOAD');
    assert.deepEqual(stopped.events[0].uploadArtifact, stopped.steps[0].uploadArtifact);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('records file upload after focus returns even when no DOM click is observed', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildFilePickerFocusOnlyRecordingPageHtml())}`;

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
      return status?.steps?.length === 1 && status.steps[0]?.type === 'FILE_UPLOAD';
    }, 5000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILE_UPLOAD']);
    assert.equal(stopped.steps[0].locatorValue, '#attachment');
    assert.equal(stopped.steps[0].inputValue, 'focus-only-upload.txt');
    assert.deepEqual(stopped.steps[0].uploadArtifact, {
      fileName: 'focus-only-upload.txt',
      contentType: 'text/plain',
      contentBase64: 'Zm9jdXM=',
      size: 5,
      captureStatus: 'READY',
    });
    assert.equal(stopped.events.length, 1);
    assert.equal(stopped.events[0].kind, 'FILE_UPLOAD');
    assert.deepEqual(stopped.events[0].uploadArtifact, stopped.steps[0].uploadArtifact);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('records keyboard double click and right click interactions', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildAdvancedInteractionRecordingPageHtml())}`;

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
      return status?.steps?.length === 5;
    }, 6000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILL', 'PRESS_KEY', 'PRESS_KEY', 'DOUBLE_CLICK', 'RIGHT_CLICK']);
    assert.equal(stopped.steps[0].locatorValue, '#search');
    assert.equal(stopped.steps[0].inputValue, 'Alice');
    assert.equal(stopped.steps[1].locatorValue, '#search');
    assert.equal(stopped.steps[1].inputValue, 'Enter');
    assert.equal(stopped.steps[2].locatorValue, null);
    assert.equal(stopped.steps[2].inputValue, 'Tab');
    assert.equal(stopped.steps[3].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[3].locatorValue, 'advanced-double');
    assert.equal(stopped.steps[4].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[4].locatorValue, 'advanced-right');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('continues recording after page refresh', async () => {
  const runnerPort = await findAvailablePort();
  let appPort = await findAvailablePort();
  while (appPort === runnerPort) {
    appPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;

  const app = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', appBaseUrl);
    if (url.pathname === '/refresh') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildRefreshRecordingPageHtml());
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  await listen(app, appPort);

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
      url: `${appBaseUrl}/refresh`,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);
    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');

    let status;
    await waitFor(async () => {
      status = await getJson(runnerBaseUrl, '/record/status');
      return status?.steps?.length === 2;
    }, 8000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stopped.steps[0].locatorValue, '#refresh-name');
    assert.equal(stopped.steps[0].inputValue, 'Reloaded');
    assert.equal(stopped.steps[1].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[1].locatorValue, 'refresh-save');
    assert.equal(status.page.url, `${appBaseUrl}/refresh`);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(app);
  }

  assert.deepEqual(stderr, []);
});

test('follows the active recording page when a new tab records events', async () => {
  const runnerPort = await findAvailablePort();
  let appPort = await findAvailablePort();
  while (appPort === runnerPort) {
    appPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;

  const app = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', appBaseUrl);
    if (url.pathname === '/opener') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildNewTabOpenerRecordingPageHtml());
      return;
    }
    if (url.pathname === '/child') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildNewTabChildRecordingPageHtml());
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  await listen(app, appPort);

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
      url: `${appBaseUrl}/opener`,
      workspaceId: 'account-open',
      environmentId: 'recording',
      headless: true,
    });
    assert.equal(opened.success, true);
    const started = await postJson(runnerBaseUrl, '/record/start', {});
    assert.equal(started.recording.status, 'RECORDING');

    let status;
    await waitFor(async () => {
      status = await getJson(runnerBaseUrl, '/record/status');
      return status?.steps?.length === 4;
    }, 8000);

    const stopped = await postJson(runnerBaseUrl, '/record/stop', {});
    assert.equal(stopped.recording.status, 'STOPPED');
    assert.deepEqual(stopped.steps.map(item => item.type), ['FILL', 'CLICK', 'FILL', 'CLICK']);
    assert.equal(stopped.steps[0].locatorValue, '#opener-name');
    assert.equal(stopped.steps[1].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[1].locatorValue, 'open-child');
    assert.equal(stopped.steps[2].locatorValue, '#child-name');
    assert.equal(stopped.steps[3].locatorType, 'TEST_ID');
    assert.equal(stopped.steps[3].locatorValue, 'child-save');
    assert.equal(status.page.url, `${appBaseUrl}/child`);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
    await closeServer(app);
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

test('browser overlay panel controls recording without polluting recorded steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayControlRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 7000);

    assert.equal(stoppedStatus.recording.active, false);
    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'CLICK', 'FILL']);
    assert.deepEqual(stoppedStatus.steps.map(item => item.locatorValue), ['#name', 'save-order', '#name']);
    assert.equal(stoppedStatus.steps.some(item => item.inputValue === 'ignored'), false);
    assert.equal(stoppedStatus.steps.some(item => String(item.locatorValue || '').includes('auto-web-runner-overlay')), false);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('browser overlay panel appends quick assertion steps from current context', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayAssertionRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 7000);

    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL']);
    assert.deepEqual(stoppedStatus.steps.slice(0, 3).map(item => item.locatorValue), ['#name', '#name', '#name']);
    assert.equal(stoppedStatus.steps[0].inputValue, 'Alice');
    assert.equal(stoppedStatus.steps[1].inputValue, null);
    assert.equal(stoppedStatus.steps[2].inputValue, 'Alice');
    assert.equal(stoppedStatus.steps[3].locatorType, null);
    assert.equal(stoppedStatus.steps[3].locatorValue, null);
    assert.equal(String(stoppedStatus.steps[3].inputValue || '').startsWith('data:text/html,'), true);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('browser overlay panel shows current assertion target and highlights page element', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayTargetHintRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 7000);

    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stoppedStatus.steps[1].locatorType, 'TEST_ID');
    assert.equal(stoppedStatus.steps[1].locatorValue, 'overlay-proof-pass');
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('browser overlay panel collapses to compact status without polluting recorded steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayCompactRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 7000);

    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stoppedStatus.steps[0].locatorValue, '#name');
    assert.equal(stoppedStatus.steps[1].locatorType, 'TEST_ID');
    assert.equal(stoppedStatus.steps[1].locatorValue, 'overlay-compact-pass');
    assert.equal(stoppedStatus.steps.some(item => String(item.locatorValue || '').includes('auto-web-runner-overlay')), false);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('browser overlay panel can be dragged and keeps position without polluting recorded steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayDragRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 8000);

    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stoppedStatus.steps[0].locatorValue, '#name');
    assert.equal(stoppedStatus.steps[1].locatorType, 'TEST_ID');
    assert.equal(stoppedStatus.steps[1].locatorValue, 'overlay-drag-pass');
    assert.equal(stoppedStatus.steps.some(item => String(item.locatorValue || '').includes('auto-web-runner-overlay')), false);
  } finally {
    await postJson(runnerBaseUrl, '/record/stop', {}).catch(() => {});
    await postJson(runnerBaseUrl, '/session/release', {}).catch(() => {});
    await stopRunnerProcess(runner);
  }

  assert.deepEqual(stderr, []);
});

test('browser overlay panel can reset dragged position without polluting recorded steps', async () => {
  const runnerPort = await findAvailablePort();
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const recordingPageUrl = `data:text/html,${encodeURIComponent(buildOverlayResetPositionRecordingPageHtml())}`;

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

    let stoppedStatus;
    await waitFor(async () => {
      stoppedStatus = await getJson(runnerBaseUrl, '/record/status');
      return stoppedStatus?.recording?.status === 'STOPPED';
    }, 8000);

    assert.deepEqual(stoppedStatus.steps.map(item => item.type), ['FILL', 'CLICK']);
    assert.equal(stoppedStatus.steps[0].locatorValue, '#name');
    assert.equal(stoppedStatus.steps[1].locatorType, 'TEST_ID');
    assert.equal(stoppedStatus.steps[1].locatorValue, 'overlay-reset-pass');
    assert.equal(stoppedStatus.steps.some(item => String(item.locatorValue || '').includes('auto-web-runner-overlay')), false);
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

function buildRecordedUploadReplayPageHtml({ autoInteract }) {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Recording Upload Replay</title></head>',
    '<body>',
    '<label for="attachment">Attachment</label>',
    '<input id="attachment" type="file" />',
    '<div id="result">Waiting</div>',
    '<script>',
    'const input = document.querySelector("#attachment");',
    'const result = document.querySelector("#result");',
    'function syncResult() {',
    '  const file = input.files && input.files[0];',
    '  result.textContent = file ? `Uploaded ${file.name}` : "No file";',
    '}',
    'input.addEventListener("change", syncResult);',
    autoInteract ? [
      'window.setTimeout(() => {',
      '  const transfer = new DataTransfer();',
      '  transfer.items.add(new File(["demo"], "upload-demo.txt", { type: "text/plain" }));',
      '  input.files = transfer.files;',
      '  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));',
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

function buildNativeFilePickerFallbackRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Native Picker Fallback</title></head>',
    '<body>',
    '<label for="attachment">Attachment</label>',
    '<input id="attachment" type="file" />',
    '<script>',
    'const input = document.querySelector("#attachment");',
    'input.addEventListener("click", () => {',
    '  window.setTimeout(() => {',
    '    const transfer = new DataTransfer();',
    '    transfer.items.add(new File(["native"], "native-upload.txt", { type: "text/plain" }));',
    '    input.files = transfer.files;',
    '    window.dispatchEvent(new FocusEvent("focus"));',
    '  }, 120);',
    '}, { once: true });',
    'window.setTimeout(() => input.click(), 1000);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildFilePickerFocusOnlyRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>File Picker Focus Only</title></head>',
    '<body>',
    '<label for="attachment">Attachment</label>',
    '<input id="attachment" type="file" />',
    '<script>',
    'window.setTimeout(() => {',
    '  const input = document.querySelector("#attachment");',
    '  const transfer = new DataTransfer();',
    '  transfer.items.add(new File(["focus"], "focus-only-upload.txt", { type: "text/plain" }));',
    '  input.files = transfer.files;',
    '  window.dispatchEvent(new FocusEvent("focus"));',
    '}, 1000);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildAdvancedInteractionRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Advanced Recording</title></head>',
    '<body>',
    '<label for="search">Search</label>',
    '<input id="search" placeholder="Search" />',
    '<button id="double" data-testid="advanced-double">Double</button>',
    '<button id="right" data-testid="advanced-right">Right</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#search");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));',
    '}',
    'function keydown(target, key) {',
    '  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key }));',
    '}',
    'function mouse(target, type) {',
    '  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, button: type === "contextmenu" ? 2 : 0 }));',
    '}',
    'window.setTimeout(() => inputValue("Alice"), 1000);',
    'window.setTimeout(() => keydown(document.querySelector("#search"), "Enter"), 1200);',
    'window.setTimeout(() => keydown(document.body, "Tab"), 1400);',
    'window.setTimeout(() => {',
    '  const button = document.querySelector("#double");',
    '  mouse(button, "click");',
    '  mouse(button, "click");',
    '  mouse(button, "dblclick");',
    '}, 1650);',
    'window.setTimeout(() => mouse(document.querySelector("#right"), "contextmenu"), 1950);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildRefreshRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Refresh Recording</title></head>',
    '<body>',
    '<label for="refresh-name">Refresh Name</label>',
    '<input id="refresh-name" placeholder="Refresh Name" />',
    '<button id="refresh-save" data-testid="refresh-save">Save refresh</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#refresh-name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));',
    '}',
    'window.setTimeout(() => {',
    '  if (sessionStorage.getItem("auto-web-refresh-done") !== "true") {',
    '    sessionStorage.setItem("auto-web-refresh-done", "true");',
    '    window.location.reload();',
    '    return;',
    '  }',
    '  inputValue("Reloaded");',
    '  window.setTimeout(() => document.querySelector("#refresh-save").click(), 200);',
    '}, 900);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildNewTabOpenerRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>New Tab Opener</title></head>',
    '<body>',
    '<label for="opener-name">Opener Name</label>',
    '<input id="opener-name" placeholder="Opener Name" />',
    '<a id="child-link" href="/child" target="_blank" data-testid="open-child">Open child</a>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#opener-name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));',
    '}',
    'window.setTimeout(() => inputValue("Opener"), 900);',
    'window.setTimeout(() => document.querySelector("#child-link").click(), 1300);',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildNewTabChildRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>New Tab Child</title></head>',
    '<body>',
    '<label for="child-name">Child Name</label>',
    '<input id="child-name" placeholder="Child Name" />',
    '<button id="child-save" data-testid="child-save">Save child</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#child-name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));',
    '}',
    'window.setTimeout(() => inputValue("Child"), 800);',
    'window.setTimeout(() => document.querySelector("#child-save").click(), 1100);',
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

function buildOverlayControlRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Recording Controls</title></head>',
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
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("panel"), 700);',
    '    window.setTimeout(() => document.querySelector("#save").click(), 900);',
    '    window.setTimeout(() => clickAction(shadowRoot, "pause"), 1150);',
    '    window.setTimeout(() => inputValue("ignored"), 1350);',
    '    window.setTimeout(() => document.querySelector("#save").click(), 1500);',
    '    window.setTimeout(() => clickAction(shadowRoot, "resume"), 1750);',
    '    window.setTimeout(() => inputValue("kept"), 2000);',
    '    window.setTimeout(() => document.querySelector("#save").click(), 2150);',
    '    window.setTimeout(() => clickAction(shadowRoot, "undo"), 2450);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2750);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildOverlayAssertionRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Assertion Controls</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("Alice"), 700);',
    '    window.setTimeout(() => clickAction(shadowRoot, "assert-visible"), 1050);',
    '    window.setTimeout(() => clickAction(shadowRoot, "assert-text"), 1350);',
    '    window.setTimeout(() => clickAction(shadowRoot, "assert-url"), 1650);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2050);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildOverlayTargetHintRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Target Hint</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="proof-pass" data-testid="overlay-proof-pass">PASS</button>',
    '<button id="proof-fail" data-testid="overlay-proof-fail">FAIL</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("Alice"), 700);',
    '    window.setTimeout(() => {',
    '      const targetText = shadowRoot.querySelector(\'[data-role="target"]\')?.textContent || "";',
    '      const locatorText = shadowRoot.querySelector(\'[data-role="target-locator"]\')?.textContent || "";',
    '      const highlighted = document.querySelector("#name")?.getAttribute("data-auto-web-runner-assert-target") === "true";',
    '      const proofButton = targetText.includes("Name") && locatorText.includes("#name") && highlighted',
    '        ? document.querySelector("#proof-pass")',
    '        : document.querySelector("#proof-fail");',
    '      proofButton?.click();',
    '    }, 1700);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2200);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildOverlayCompactRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Compact Controls</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="proof-pass" data-testid="overlay-compact-pass">PASS</button>',
    '<button id="proof-fail" data-testid="overlay-compact-fail">FAIL</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("Alice"), 700);',
    '    window.setTimeout(() => clickAction(shadowRoot, "toggle-collapse"), 1050);',
    '    window.setTimeout(() => {',
    '      const panel = shadowRoot.querySelector(".panel");',
    '      const metaDisplay = getComputedStyle(shadowRoot.querySelector(".meta")).display;',
    '      const compactText = shadowRoot.querySelector(\'[data-role="compact"]\')?.textContent || "";',
    '      const collapsed = panel?.getAttribute("data-collapsed") === "true";',
    '      const compactOk = collapsed && metaDisplay === "none" && compactText.includes("1");',
    '      clickAction(shadowRoot, "toggle-collapse");',
    '      window.setTimeout(() => {',
    '        const expanded = panel?.getAttribute("data-collapsed") === "false";',
    '        const proofButton = compactOk && expanded',
    '          ? document.querySelector("#proof-pass")',
    '          : document.querySelector("#proof-fail");',
    '        proofButton?.click();',
    '      }, 150);',
    '    }, 1400);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2200);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildOverlayDragRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Drag Controls</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="proof-pass" data-testid="overlay-drag-pass">PASS</button>',
    '<button id="proof-fail" data-testid="overlay-drag-fail">FAIL</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function dispatchPointer(target, type, options) {',
    '  const eventOptions = { bubbles: true, composed: true, pointerId: 7, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, ...options };',
    '  const event = typeof PointerEvent === "function"',
    '    ? new PointerEvent(type, eventOptions)',
    '    : new MouseEvent(type.replace("pointer", "mouse"), eventOptions);',
    '  target.dispatchEvent(event);',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("Alice"), 700);',
    '    window.setTimeout(() => {',
    '      const panel = shadowRoot.querySelector(".panel");',
    '      const header = shadowRoot.querySelector(".header");',
    '      const before = panel.getBoundingClientRect();',
    '      dispatchPointer(header, "pointerdown", { clientX: before.left + 30, clientY: before.top + 14 });',
    '      dispatchPointer(document, "pointermove", { clientX: before.left - 85, clientY: before.top + 96 });',
    '      dispatchPointer(document, "pointerup", { clientX: before.left - 85, clientY: before.top + 96 });',
    '      window.setTimeout(() => {',
    '        const moved = panel.getBoundingClientRect();',
    '        clickAction(shadowRoot, "toggle-collapse");',
    '        window.setTimeout(() => {',
    '          clickAction(shadowRoot, "toggle-collapse");',
    '          window.setTimeout(() => {',
    '            const restored = panel.getBoundingClientRect();',
    '            const movedFarEnough = Math.abs(moved.left - before.left) > 40 && Math.abs(moved.top - before.top) > 40;',
    '            const keptPosition = Math.abs(restored.left - moved.left) < 3 && Math.abs(restored.top - moved.top) < 3;',
    '            const proofButton = movedFarEnough && keptPosition',
    '              ? document.querySelector("#proof-pass")',
    '              : document.querySelector("#proof-fail");',
    '            proofButton?.click();',
    '          }, 150);',
    '        }, 150);',
    '      }, 150);',
    '    }, 1100);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2600);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
    '</script>',
    '</body>',
    '</html>',
  ].join('');
}

function buildOverlayResetPositionRecordingPageHtml() {
  return [
    '<!doctype html>',
    '<html>',
    '<head><title>Overlay Reset Position</title></head>',
    '<body>',
    '<label for="name">Name</label>',
    '<input id="name" placeholder="Name" />',
    '<button id="proof-pass" data-testid="overlay-reset-pass">PASS</button>',
    '<button id="proof-fail" data-testid="overlay-reset-fail">FAIL</button>',
    '<script>',
    'function inputValue(value) {',
    '  const input = document.querySelector("#name");',
    '  input.value = value;',
    '  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));',
    '}',
    'function clickAction(shadowRoot, action) {',
    '  shadowRoot.querySelector(`[data-action="${action}"]`)?.click();',
    '}',
    'function dispatchPointer(target, type, options) {',
    '  const eventOptions = { bubbles: true, composed: true, pointerId: 8, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, ...options };',
    '  const event = typeof PointerEvent === "function"',
    '    ? new PointerEvent(type, eventOptions)',
    '    : new MouseEvent(type.replace("pointer", "mouse"), eventOptions);',
    '  target.dispatchEvent(event);',
    '}',
    'function waitForOverlay() {',
    '  return new Promise((resolve, reject) => {',
    '    const deadline = Date.now() + 5000;',
    '    const tick = () => {',
    '      const host = document.querySelector(\'[data-auto-web-runner-overlay-host="true"]\');',
    '      if (host?.shadowRoot) {',
    '        resolve(host.shadowRoot);',
    '        return;',
    '      }',
    '      if (Date.now() >= deadline) {',
    '        reject(new Error("overlay host not found"));',
    '        return;',
    '      }',
    '      window.setTimeout(tick, 50);',
    '    };',
    '    tick();',
    '  });',
    '}',
    'window.addEventListener("load", () => {',
    '  waitForOverlay().then(shadowRoot => {',
    '    window.setTimeout(() => clickAction(shadowRoot, "start"), 250);',
    '    window.setTimeout(() => inputValue("Alice"), 700);',
    '    window.setTimeout(() => {',
    '      const panel = shadowRoot.querySelector(".panel");',
    '      const header = shadowRoot.querySelector(".header");',
    '      const before = panel.getBoundingClientRect();',
    '      dispatchPointer(header, "pointerdown", { clientX: before.left + 30, clientY: before.top + 14 });',
    '      dispatchPointer(document, "pointermove", { clientX: before.left - 90, clientY: before.top + 100 });',
    '      dispatchPointer(document, "pointerup", { clientX: before.left - 90, clientY: before.top + 100 });',
    '      window.setTimeout(() => {',
    '        const moved = panel.getBoundingClientRect();',
    '        clickAction(shadowRoot, "reset-position");',
    '        window.setTimeout(() => {',
    '          const reset = panel.getBoundingClientRect();',
    '          const movedFarEnough = Math.abs(moved.left - before.left) > 40 && Math.abs(moved.top - before.top) > 40;',
    '          const resetToTop = Math.abs(reset.top - 16) < 3;',
    '          const resetToRight = Math.abs((window.innerWidth - reset.right) - 16) < 3;',
    '          const unpositioned = panel.getAttribute("data-positioned") !== "true";',
    '          const proofButton = movedFarEnough && resetToTop && resetToRight && unpositioned',
    '            ? document.querySelector("#proof-pass")',
    '            : document.querySelector("#proof-fail");',
    '          proofButton?.click();',
    '        }, 150);',
    '      }, 150);',
    '    }, 1100);',
    '    window.setTimeout(() => clickAction(shadowRoot, "stop"), 2500);',
    '  }).catch(error => {',
    '    document.body.setAttribute("data-overlay-error", error.message);',
    '  });',
    '});',
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
