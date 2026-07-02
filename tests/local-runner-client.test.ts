import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LOCAL_RUNNER_BASE_URL,
  LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND,
  LOCAL_RUNNER_START_COMMAND,
  mapRunnerCandidateToCollectCandidate,
  normalizeRunnerHealth,
  getLocalRunnerRecordingStatus,
  pauseLocalRunnerRecording,
  resumeLocalRunnerRecording,
  startLocalRunnerTaskPolling,
  startLocalRunnerRecording,
  stopLocalRunnerRecording,
  undoLocalRunnerRecordingStep,
  validateLocalRunnerLocators,
} from '../src/entities/web-ui-automation/lib/localRunnerClient.ts'

test('local runner client uses localhost runner endpoint', () => {
  assert.equal(LOCAL_RUNNER_BASE_URL, 'http://127.0.0.1:39118')
})

test('normalizeRunnerHealth keeps UI fields with safe defaults', () => {
  const health = normalizeRunnerHealth({
    success: true,
    runner: { version: '0.1.0', port: 39118 },
    playwright: { available: true },
    browsers: { chromium: { installed: true } },
    session: { currentUrl: 'https://example.test/orders' },
  })

  assert.deepEqual(health, {
    online: true,
    runnerVersion: '0.1.0',
    playwrightAvailable: true,
    chromiumInstalled: true,
    capabilities: [],
    diagnostics: {
      startCommand: LOCAL_RUNNER_START_COMMAND,
      installChromiumCommand: LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND,
      sessionTtlMinutes: null,
      validationLocatorLimit: null,
      validationScreenshotLimit: null,
    },
    currentUrl: 'https://example.test/orders',
    pageTitle: null,
    pageAlive: false,
    sessionId: null,
    openedAt: null,
    boundTaskId: null,
    boundAt: null,
    lastActiveAt: null,
    authStateExists: false,
    authSavedAt: null,
    expiresAt: null,
    ttlMinutes: null,
    remainingSeconds: null,
    expired: false,
  })
})

test('mapRunnerCandidateToCollectCandidate maps runner candidates as static unverified first-phase results', () => {
  const candidate = mapRunnerCandidateToCollectCandidate({
    groupName: 'Login Form',
    screenshotBase64: 'screen',
    candidate: {
      name: 'Username',
      elementType: 'INPUT',
      locator: {
        strategy: 'TEST_ID',
        value: 'login-username',
        framePath: [{ selector: 'iframe#login' }],
        shadowPath: ['login-shell'],
        alternatives: [
          { strategy: 'LABEL', value: '用户名' },
          { strategy: 'CSS', value: '#username' },
        ],
      },
      text: '',
      placeholder: 'Input username',
      tagName: 'input',
      stabilityScore: 96,
      source: 'RULE',
    },
  })

  assert.equal(candidate.groupName, 'Login Form')
  assert.equal(candidate.elementName, 'Username')
  assert.equal(candidate.locatorType, 'TEST_ID')
  assert.equal(candidate.locatorValue, 'login-username')
  assert.equal(candidate.confidence, 96)
  assert.equal(candidate.candidateSource, 'STATIC_RULE')
  assert.equal(candidate.validationStatus, 'UNVERIFIED')
  assert.equal(candidate.matchCount, null)
  assert.equal(candidate.validationMessage, '静态生成，尚未经过本地页面验证')
  assert.equal(candidate.screenshotBase64, 'screen')
  assert.deepEqual(candidate.framePath, [{ selector: 'iframe#login' }])
  assert.deepEqual(candidate.shadowPath, ['login-shell'])
  assert.deepEqual(candidate.locatorCandidates?.map(item => [item.locatorType, item.locatorValue]), [
    ['TEST_ID', 'login-username'],
    ['LABEL', '用户名'],
    ['CSS', '#username'],
  ])
})

test('startLocalRunnerTaskPolling posts task polling options to local runner', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestBody: Record<string, unknown> = {}
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(url)
    requestBody = JSON.parse(String(init?.body || '{}'))
    return {
      ok: true,
      json: async () => ({
        success: true,
        poller: {
          runnerId: 'runner_local',
          capabilities: requestBody.capabilities,
          workspaceCodes: requestBody.workspaceCodes,
          running: true,
        },
      }),
    } as Response
  }) as typeof fetch

  try {
    await startLocalRunnerTaskPolling({
      installId: 'api-scenario-risk-ops',
      capabilities: ['API_CASE_RUN', 'API_SCENARIO_RUN', 'API_SUITE_RUN'],
      workspaceCodes: ['risk-ops'],
      intervalMs: 1000,
    })

    assert.equal(requestUrl, `${LOCAL_RUNNER_BASE_URL}/tasks/poll/start`)
    assert.equal(requestBody.installId, 'api-scenario-risk-ops')
    assert.deepEqual(requestBody.capabilities, ['API_CASE_RUN', 'API_SCENARIO_RUN', 'API_SUITE_RUN'])
    assert.deepEqual(requestBody.workspaceCodes, ['risk-ops'])
    assert.equal(requestBody.intervalMs, 1000)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('local runner recording client calls recording endpoints', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string, method: string, body: unknown }> = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      method: String(init?.method || 'GET'),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    })
    return {
      ok: true,
      json: async () => ({
        success: true,
        recording: {
          active: String(url).endsWith('/record/start'),
          status: String(url).endsWith('/record/start') || String(url).endsWith('/record/resume')
            ? 'RECORDING'
            : String(url).endsWith('/record/pause')
              ? 'PAUSED'
              : String(url).endsWith('/record/stop')
                ? 'STOPPED'
                : 'IDLE',
          recorderId: 'rec-1',
          sessionId: 'session-1',
          startedAt: '2026-07-02T12:00:00.000Z',
          stoppedAt: null,
          pausedAt: null,
          resumedAt: null,
          eventCount: 0,
          stepCount: 0,
          overflow: false,
        },
        steps: [],
      }),
    } as Response
  }) as typeof fetch

  try {
    await startLocalRunnerRecording({ workspaceId: 'account-open', environmentId: 'manual' })
    await pauseLocalRunnerRecording()
    await resumeLocalRunnerRecording()
    await undoLocalRunnerRecordingStep()
    await stopLocalRunnerRecording()
    await getLocalRunnerRecordingStatus()

    assert.deepEqual(requests, [
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/start`,
        method: 'POST',
        body: { workspaceId: 'account-open', environmentId: 'manual' },
      },
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/pause`,
        method: 'POST',
        body: null,
      },
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/resume`,
        method: 'POST',
        body: null,
      },
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/undo`,
        method: 'POST',
        body: null,
      },
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/stop`,
        method: 'POST',
        body: null,
      },
      {
        url: `${LOCAL_RUNNER_BASE_URL}/record/status`,
        method: 'GET',
        body: null,
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('validateLocalRunnerLocators posts locators and normalizes validation results', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestBody: unknown = null
  let requestSignal: AbortSignal | null = null
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(url)
    requestBody = JSON.parse(String(init?.body || '{}'))
    requestSignal = init?.signal as AbortSignal
    return {
      ok: true,
      json: async () => ({
        success: true,
        results: [
          {
            locatorType: 'CSS',
            locatorValue: '#search',
            validationStatus: 'PASSED',
            matchCount: 1,
            validationMessage: 'ok',
            screenshotBase64: 'png',
          },
          {
            locatorType: 'TEXT',
            locatorValue: 'Submit',
            validationStatus: 'MULTIPLE',
            matchCount: 2,
          },
        ],
      }),
    } as Response
  }) as typeof fetch

  try {
    const results = await validateLocalRunnerLocators([
      { locatorType: 'CSS', locatorValue: '#search', framePath: [{ selector: 'iframe#orders' }], shadowPath: ['order-shell'] },
      { locatorType: 'TEXT', locatorValue: 'Submit' },
      { locatorType: 'CSS', locatorValue: '' },
    ], { highlight: true })

    assert.equal(requestUrl, `${LOCAL_RUNNER_BASE_URL}/collect/validate`)
    assert.equal(requestSignal instanceof AbortSignal, true)
    assert.deepEqual(requestBody, {
      locators: [
        { locatorType: 'CSS', locatorValue: '#search', framePath: [{ selector: 'iframe#orders' }], shadowPath: ['order-shell'] },
        { locatorType: 'TEXT', locatorValue: 'Submit' },
      ],
      highlight: true,
    })
    assert.deepEqual(results, [
      {
        locatorType: 'CSS',
        locatorValue: '#search',
        validationStatus: 'PASSED',
        matchCount: 1,
        validationMessage: 'ok',
        screenshotBase64: 'png',
        framePath: [{ selector: 'iframe#orders' }],
        shadowPath: ['order-shell'],
      },
      {
        locatorType: 'TEXT',
        locatorValue: 'Submit',
        validationStatus: 'MULTIPLE',
        matchCount: 2,
        validationMessage: null,
        screenshotBase64: null,
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
