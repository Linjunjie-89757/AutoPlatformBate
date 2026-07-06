import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

import { buildCandidatesFromElements, normalizeLocatorValidationResult, isProbablyLoginPage } from './collector.mjs';
import { isAllowedRunnerOrigin, parseAllowedOrigins } from './cors.mjs';
import { createRunnerTaskPoller } from './platformTaskPoller.mjs';
import { resolveOpenTarget } from './session.mjs';
import { evaluateAuthStateHealth } from './authState.mjs';
import { ensureRunnerRuntimeDirectories, resolveRunnerRuntimeConfig } from './runnerConfig.mjs';
import { resolveArtifactUploadPath } from './artifactManager.mjs';

const VALIDATION_LOCATOR_LIMIT = 200;
const VALIDATION_SCREENSHOT_LIMIT = 8;
const VALIDATION_HIGHLIGHT_LIMIT = 8;
const VALIDATION_HIGHLIGHT_DURATION_MS = 3000;
const AUTH_STALE_MINUTES = 24 * 60;
const RECORDER_BINDING_NAME = '__autoWebRunnerRecordEvent';
const RUNNER_OVERLAY_BINDING_NAME = '__autoWebRunnerOverlayControl';
const RECORDER_MAX_EVENTS = 300;
const RECORDER_DUPLICATE_CLICK_WINDOW_MS = 500;
const RECORDER_DUPLICATE_HOVER_WINDOW_MS = 500;
const RECORDED_UPLOAD_ARTIFACT_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const DOWNLOAD_ARCHIVE_MAX_SIZE_BYTES = 1024 * 1024;
const runtimeConfig = resolveRunnerRuntimeConfig({
  env: process.env,
  argv: process.argv.slice(2),
  homeDir: homedir(),
  hostname: hostname(),
});
const HOST = runtimeConfig.host;
const RUNNER_VERSION = runtimeConfig.runnerVersion;
const DATA_DIR = runtimeConfig.dataDir;
const AUTH_DIR = runtimeConfig.authDir;

let browser;
let browserHeaded;
let context;
let page;
let activeSession;
let playwrightModule;
let platformPoller;
let activeRecorder;
let lastStoppedRecorder;
let recorderBindingContext;
let recorderScriptContext;
let recorderNavigationPage;
let overlayBindingContext;
let overlayScriptContext;
let pageTrackingContext;
let trackedNavigationPages = new WeakSet();
let activePagePromotedAtMs = 0;

const port = runtimeConfig.port;
const allowedOrigins = parseAllowedOrigins(process.env.WEB_UI_RUNNER_ORIGINS);
const sessionTtlMinutes = runtimeConfig.sessionTtlMinutes;
const runnerTaskPoller = createRunnerTaskPoller({
  runnerVersion: RUNNER_VERSION,
  defaultInstallId: runtimeConfig.installId,
  machineHint: runtimeConfig.machineHint,
  webElementValidateExecutor: async ({ locators }) => validateCurrentPageLocators({
    locators,
  }),
  webCaseRunExecutor: async ({ task, environmentSnapshot, variableSnapshot, caseSnapshot, steps, onStepResult }) => executeCurrentPageCase({
    task,
    environmentSnapshot,
    variableSnapshot,
    caseSnapshot,
    steps,
    onStepResult,
  }),
});

await ensureRunnerRuntimeDirectories(runtimeConfig);

const server = createServer(async (request, response) => {
  try {
    if (handleCors(request, response)) {
      return;
    }

    const route = `${request.method || 'GET'} ${new URL(request.url || '/', `http://${HOST}`).pathname}`;

    if (route === 'GET /health') {
      return sendJson(response, 200, await getHealth());
    }

    if (route === 'GET /session/heartbeat') {
      return sendJson(response, 200, await getSessionHeartbeat());
    }

    if (route === 'POST /collect/open') {
      const payload = await readJson(request);
      const result = await openCollectPage(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /collect/capture') {
      const payload = await readJson(request);
      const result = await captureCurrentPage(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /collect/validate') {
      const payload = await readJson(request);
      const result = await validateCurrentPageLocators(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /record/start') {
      const payload = await readJson(request);
      const result = await startPageRecording(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /record/stop') {
      const payload = await readJson(request);
      const result = await stopPageRecording(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /record/pause') {
      const payload = await readJson(request);
      const result = await pausePageRecording(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /record/resume') {
      const payload = await readJson(request);
      const result = await resumePageRecording(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /record/undo') {
      const payload = await readJson(request);
      const result = await undoLastRecordedStep(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'GET /record/status') {
      return sendJson(response, 200, await getPageRecordingStatus());
    }

    if (route === 'POST /session/release') {
      const result = await releaseCurrentSession('manual');
      return sendJson(response, 200, result);
    }

    if (route === 'POST /session/bind') {
      const payload = await readJson(request);
      const result = await bindCurrentSession(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /platform/poll/start') {
      const payload = await readJson(request);
      const result = await startPlatformValidationPolling(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /platform/poll/stop') {
      const result = stopPlatformValidationPolling('manual');
      return sendJson(response, 200, result);
    }

    if (route === 'GET /platform/poll/status') {
      return sendJson(response, 200, getPlatformPollStatus());
    }

    if (route === 'POST /tasks/poll/start') {
      const payload = await readJson(request);
      const result = await runnerTaskPoller.start({
        capabilities: runtimeConfig.capabilities,
        maxResourceSlots: runtimeConfig.maxResourceSlots,
        ...payload,
      });
      return sendJson(response, 200, result);
    }

    if (route === 'POST /tasks/poll/stop') {
      const result = runnerTaskPoller.stop('manual');
      return sendJson(response, 200, result);
    }

    if (route === 'GET /tasks/poll/status') {
      return sendJson(response, 200, runnerTaskPoller.status());
    }

    if (route === 'POST /auth/save') {
      const payload = await readJson(request);
      const result = await saveAuthState(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /auth/status') {
      const payload = await readJson(request);
      const result = await getAuthStateStatus(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /auth/clear') {
      const payload = await readJson(request);
      const result = await clearAuthState(payload);
      return sendJson(response, 200, result);
    }

    return sendJson(response, 404, {
      success: false,
      message: 'Unknown runner endpoint',
    });
  } catch (error) {
    return sendJson(response, 500, {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, HOST, () => {
  console.log(`Web UI Local Runner ${RUNNER_VERSION} listening on http://${HOST}:${port}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function getHealth() {
  const playwright = await loadPlaywright();
  let chromiumInstalled = false;
  let chromiumError = '';

  if (playwright.available) {
    try {
      chromiumInstalled = Boolean(playwright.module.chromium.executablePath());
    } catch (error) {
      chromiumError = error instanceof Error ? error.message : String(error);
    }
  }

  clearClosedSession();
  await refreshActiveSessionPageSnapshot();

  return {
    success: true,
    runner: {
      name: runtimeConfig.runnerName,
      productName: runtimeConfig.productName,
      version: RUNNER_VERSION,
      host: HOST,
      port,
      installId: runtimeConfig.installId,
    },
    playwright: {
      available: playwright.available,
      error: playwright.error,
    },
    browsers: {
      chromium: {
        installed: chromiumInstalled,
        error: chromiumError,
      },
    },
    capabilities: buildRunnerCapabilities({
      playwrightAvailable: playwright.available,
      chromiumInstalled,
    }),
    diagnostics: {
      startCommand: runtimeConfig.commands.start,
      installChromiumCommand: runtimeConfig.commands.installChromium,
      sessionTtlMinutes,
      maxResourceSlots: runtimeConfig.maxResourceSlots,
      dataDir: runtimeConfig.dataDir,
      authDir: runtimeConfig.authDir,
      logDir: runtimeConfig.logDir,
      configPath: runtimeConfig.configPath,
      validationLocatorLimit: VALIDATION_LOCATOR_LIMIT,
      validationScreenshotLimit: VALIDATION_SCREENSHOT_LIMIT,
    },
    session: buildSessionView(),
  };
}

function buildRunnerCapabilities(input) {
  const browserReady = Boolean(input.playwrightAvailable && input.chromiumInstalled);
  return [
    {
      key: 'HEADED_BROWSER',
      label: '有头浏览器',
      enabled: browserReady,
      description: '使用本机 Chromium 打开业务页面，支持人工登录、验证码和 SSO。',
    },
    {
      key: 'AUTH_STATE',
      label: '登录状态',
      enabled: browserReady,
      description: '保存 Cookie、LocalStorage 和 SessionStorage，后续采集可复用。',
    },
    {
      key: 'STATIC_COLLECT',
      label: '静态采集',
      enabled: browserReady,
      description: '采集当前页面 DOM、可见文本、定位器候选和全局截图。',
    },
    {
      key: 'LOCAL_VALIDATE',
      label: '本地页面验证',
      enabled: browserReady,
      description: '在当前页面上下文批量校验 locator，并返回匹配数和截图证据。',
    },
    {
      key: 'PLATFORM_POLLING',
      label: '本地自动验证',
      enabled: browserReady,
      description: 'Runner 可拉取平台下发的验证指令并回传验证结果。',
    },
    {
      key: 'SESSION_TTL',
      label: '本地页面有效期',
      enabled: true,
      description: `本地页面默认 ${sessionTtlMinutes} 分钟后过期，避免长期占用本地浏览器。`,
    },
  ];
}

async function getSessionHeartbeat() {
  return {
    ...(await getHealth()),
    heartbeatAt: new Date().toISOString(),
  };
}

async function openCollectPage(payload) {
  const workspaceId = optionalString(payload.workspaceId) || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || 'default-environment';
  const headed = payload.headless === true ? false : true;
  const playwright = await ensurePlaywright();
  await ensureBrowserMode(playwright, headed);
  clearClosedSession();
  const target = resolveOpenTarget({
    requestedUrl: payload.url,
    hasActivePage: hasUsablePage(),
    currentUrl: getActivePageUrl(),
  });

  if (target.action === 'REUSE_CURRENT_PAGE') {
    activeSession = {
      ...(activeSession || {}),
      sessionId: activeSession?.sessionId || randomUUID(),
      workspaceId,
      environmentId,
      originalUrl: activeSession?.originalUrl || target.url,
      currentUrl: page.url(),
      openedAt: activeSession?.openedAt || new Date().toISOString(),
      authStateExists: activeSession?.authStateExists || false,
      expiresAt: activeSession?.expiresAt || buildSessionExpiresAt(),
      boundTaskId: activeSession?.boundTaskId || null,
      boundAt: activeSession?.boundAt || null,
    };
    await ensureRunnerOverlayInstalled();

    return {
      success: true,
      session: buildSessionView(),
      page: await getPageInfo(page),
    };
  }

  if (context) {
    await context.close();
    context = undefined;
    page = undefined;
    pageTrackingContext = undefined;
    trackedNavigationPages = new WeakSet();
    activePagePromotedAtMs = 0;
  }

  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  const contextOptions = existsSync(storageStatePath) ? { storageState: storageStatePath } : {};
  context = await browser.newContext(contextOptions);
  page = await context.newPage();
  await ensureRunnerOverlayInstalled();
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  activeSession = {
    sessionId: randomUUID(),
    workspaceId,
    environmentId,
    originalUrl: target.url,
    currentUrl: page.url(),
    pageTitle: '',
    openedAt: new Date().toISOString(),
    authStateExists: existsSync(storageStatePath),
    expiresAt: buildSessionExpiresAt(),
    boundTaskId: null,
    boundAt: null,
  };

  return {
    success: true,
    session: buildSessionView(),
    page: await getPageInfo(page),
  };
}

async function captureCurrentPage(payload) {
  ensurePage();
  await ensureSessionFresh();

  if (payload.waitMs) {
    await page.waitForTimeout(Math.min(Number(payload.waitMs), 10_000));
  }

  const rawElements = await collectRawElementsFromPage();
  const pageInfo = await getPageInfo(page);
  const screenshot = await page.screenshot({
    fullPage: false,
    type: 'png',
  });

  return {
    success: true,
    session: buildSessionView(),
    page: pageInfo,
    candidates: buildCandidatesFromElements(rawElements),
    rawCount: rawElements.length,
    screenshotBase64: screenshot.toString('base64'),
  };
}

async function startPageRecording(payload = {}) {
  ensureContext();
  ensurePage();
  await ensureSessionFresh();
  await ensureRecorderInstalled();
  await refreshActiveSessionPageSnapshot();

  lastStoppedRecorder = undefined;
  activeRecorder = {
    recorderId: randomUUID(),
    sessionId: activeSession?.sessionId || null,
    workspaceId: optionalString(payload.workspaceId) || activeSession?.workspaceId || null,
    environmentId: optionalString(payload.environmentId) || activeSession?.environmentId || null,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    pausedAt: null,
    resumedAt: null,
    status: 'RECORDING',
    active: true,
    events: [],
    overflow: false,
  };
  scheduleRecorderFrameRefreshes();

  return {
    success: true,
    session: buildSessionView(),
    page: await getPageInfo(page),
    recording: buildRecorderView(activeRecorder),
  };
}

async function stopPageRecording() {
  const recorder = finalizeActiveRecorder();

  if (!recorder) {
    return buildPageRecordingResult(lastStoppedRecorder || null);
  }

  return buildPageRecordingResult(recorder);
}

async function pausePageRecording() {
  const recorder = activeRecorder;
  if (!recorder) {
    return buildPageRecordingResult(null);
  }

  if (recorder.status !== 'PAUSED') {
    recorder.active = false;
    recorder.status = 'PAUSED';
    recorder.pausedAt = new Date().toISOString();
  }

  return buildPageRecordingResult(recorder);
}

async function resumePageRecording() {
  const recorder = activeRecorder;
  if (!recorder) {
    return buildPageRecordingResult(null);
  }

  ensureContext();
  ensurePage();
  await ensureSessionFresh();
  await ensureRecorderInstalled();
  await refreshActiveSessionPageSnapshot();
  recorder.active = true;
  recorder.status = 'RECORDING';
  recorder.resumedAt = new Date().toISOString();

  return buildPageRecordingResult(recorder);
}

async function undoLastRecordedStep() {
  const recorder = activeRecorder;
  if (!recorder) {
    return {
      ...(await buildPageRecordingResult(null)),
      undone: false,
    };
  }

  const previousStepCount = buildRecordedSteps(recorder.events).length;
  let undone = false;
  while (recorder.events.length > 0) {
    recorder.events.pop();
    undone = true;
    if (buildRecordedSteps(recorder.events).length < previousStepCount || previousStepCount === 0) {
      break;
    }
  }

  return {
    ...(await buildPageRecordingResult(recorder)),
    undone,
  };
}

async function getPageRecordingStatus() {
  await refreshActiveSessionPageSnapshot();
  if (activeRecorder && !hasUsablePage()) {
    finalizeActiveRecorder();
  }
  return buildPageRecordingResult(activeRecorder || lastStoppedRecorder || null);
}

function finalizeActiveRecorder() {
  const recorder = activeRecorder;
  activeRecorder = undefined;
  if (!recorder) {
    return null;
  }
  recorder.active = false;
  recorder.status = 'STOPPED';
  recorder.stoppedAt = recorder.stoppedAt || new Date().toISOString();
  lastStoppedRecorder = recorder;
  return recorder;
}

async function buildPageRecordingResult(recorder) {
  const events = recorder?.events?.slice() || [];
  const latestPageEvent = findLatestRecordedPageEvent(events);
  if (latestPageEvent?.pageUrl) {
    promoteActivePageByUrl(latestPageEvent.pageUrl, latestPageEvent.timestamp);
  }
  const pageInfo = hasUsablePage() ? await getPageInfo(page) : null;
  return {
    success: true,
    session: buildSessionView(),
    page: buildRecordingPageInfo(pageInfo, latestPageEvent),
    recording: buildRecorderView(recorder),
    events,
    steps: buildRecordedSteps(events),
  };
}

function findLatestRecordedPageEvent(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (optionalString(events[index]?.pageUrl)) {
      return events[index];
    }
  }
  return null;
}

function buildRecordingPageInfo(pageInfo, latestPageEvent) {
  const latestUrl = optionalString(latestPageEvent?.pageUrl);
  if (!latestUrl || pageInfo?.url === latestUrl) {
    return pageInfo;
  }
  const latestTitle = optionalString(latestPageEvent?.pageTitle) || pageInfo?.title || '';
  return {
    url: latestUrl,
    title: latestTitle,
    isProbablyLoginPage: isProbablyLoginPage({
      url: latestUrl,
      title: latestTitle,
      visibleText: '',
      hasPasswordInput: false,
    }),
  };
}

async function ensureRecorderInstalled() {
  ensureContext();
  ensurePage();
  ensureContextPageTracking();
  attachPageNavigationTracking(page);

  if (recorderBindingContext !== context) {
    await context.exposeBinding(RECORDER_BINDING_NAME, async (source, event) => {
      promoteActivePage(source?.page, event?.timestamp);
      await recordBrowserEvent(source, event);
      return { accepted: Boolean(activeRecorder?.active) };
    });
    recorderBindingContext = context;
  }

  if (recorderScriptContext !== context) {
    await context.addInitScript(installBrowserRecorderScript);
    recorderScriptContext = context;
  }

  await installRecorderScriptInPageFrames(page);
}

async function installRecorderScriptInPageFrames(targetPage) {
  if (!targetPage || targetPage.isClosed?.()) {
    return;
  }
  await Promise.all(targetPage.frames().map(frame => frame.evaluate(installBrowserRecorderScript).catch(() => null)));
}

function scheduleRecorderFrameRefreshes() {
  const delays = [150, 500, 1200, 2200];
  for (const delayMs of delays) {
    setTimeout(() => {
      if (!activeRecorder || activeRecorder.status !== 'RECORDING' || !page || recorderScriptContext !== context) {
        return;
      }
      void installRecorderScriptInPageFrames(page).catch(() => null);
    }, delayMs);
  }
}

async function ensureRunnerOverlayInstalled() {
  ensureContext();
  ensurePage();
  ensureContextPageTracking();
  attachPageNavigationTracking(page);

  if (overlayBindingContext !== context) {
    await context.exposeBinding(RUNNER_OVERLAY_BINDING_NAME, async (source, payload) => {
      promoteActivePage(source?.page, payload?.event?.timestamp);
      const action = optionalString(payload?.action).toLowerCase();
      if (action === 'start') {
        return startPageRecording({});
      }
      if (action === 'pause') {
        return pausePageRecording();
      }
      if (action === 'resume') {
        return resumePageRecording();
      }
      if (action === 'undo') {
        return undoLastRecordedStep();
      }
      if (action === 'stop') {
        return stopPageRecording();
      }
      if (action === 'status') {
        return getPageRecordingStatus();
      }
      if (['assert-visible', 'assert-text', 'assert-url'].includes(action)) {
        if (!payload?.event || typeof payload.event !== 'object') {
          throw new Error('assertion event is required');
        }
        await recordBrowserEvent(source, payload.event);
        return buildPageRecordingResult(activeRecorder || lastStoppedRecorder || null);
      }
      throw new Error(`unsupported overlay action: ${action || 'unknown'}`);
    });
    overlayBindingContext = context;
  }

  if (overlayScriptContext !== context) {
    await context.addInitScript(installBrowserRunnerOverlayScript);
    overlayScriptContext = context;
  }

  await page.evaluate(installBrowserRunnerOverlayScript).catch(() => null);
}

function ensureContextPageTracking() {
  if (!context || pageTrackingContext === context) {
    return;
  }
  trackedNavigationPages = new WeakSet();
  context.on('page', newPage => {
    attachPageNavigationTracking(newPage);
    if (activeRecorder || activeSession) {
      promoteActivePage(newPage, Date.now());
    }
  });
  pageTrackingContext = context;
}

function attachPageNavigationTracking(targetPage) {
  if (!targetPage || targetPage.isClosed?.() || trackedNavigationPages.has(targetPage)) {
    return;
  }
  trackedNavigationPages.add(targetPage);
  targetPage.on('framenavigated', frame => {
    if (recorderScriptContext === context) {
      void frame.evaluate(installBrowserRecorderScript).catch(() => null);
    }
    if (targetPage === page && frame === targetPage.mainFrame()) {
      void refreshActiveSessionPageSnapshot();
    }
  });
  targetPage.on('close', () => {
    if (targetPage !== page) {
      return;
    }
    const replacement = context?.pages?.().find(item => item && !item.isClosed?.());
    if (replacement && replacement !== targetPage) {
      promoteActivePage(replacement);
      return;
    }
    clearClosedSession();
  });
}

function promoteActivePage(candidatePage, promotedAt = Date.now()) {
  if (!candidatePage || candidatePage.isClosed?.()) {
    return false;
  }
  if (context && typeof candidatePage.context === 'function' && candidatePage.context() !== context) {
    return false;
  }
  const promotedAtMs = normalizePromotionTime(promotedAt);
  if (page && page !== candidatePage && promotedAtMs < activePagePromotedAtMs) {
    return false;
  }
  activePagePromotedAtMs = Math.max(activePagePromotedAtMs, promotedAtMs);
  if (page !== candidatePage) {
    page = candidatePage;
  }
  attachPageNavigationTracking(candidatePage);
  if (activeSession) {
    activeSession.currentUrl = candidatePage.url?.() || activeSession.currentUrl || '';
    void refreshActiveSessionPageSnapshot();
  }
  return true;
}

function promoteActivePageByUrl(url, promotedAt = Date.now()) {
  const targetUrl = optionalString(url);
  if (!targetUrl || !context?.pages) {
    return false;
  }
  const matchingPage = context.pages().find(item => item && !item.isClosed?.() && item.url?.() === targetUrl);
  return matchingPage ? promoteActivePage(matchingPage, promotedAt) : false;
}

function normalizePromotionTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Date.parse(optionalString(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function recordBrowserEvent(source, event) {
  const recorder = activeRecorder;
  if (recorder?.status !== 'RECORDING' || !recorder.active || !event || typeof event !== 'object') {
    return;
  }
  promoteActivePageByUrl(event.url, event.timestamp);
  const normalized = await normalizeRecordedBrowserEvent(source, event);
  if (!normalized) {
    return;
  }
  if (recorder.events.length >= RECORDER_MAX_EVENTS) {
    recorder.overflow = true;
    return;
  }
  appendRecordedEvent(recorder.events, normalized);
}

async function normalizeRecordedBrowserEvent(source, event) {
  const kind = optionalString(event.kind).toUpperCase();
  if (!['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'FILL', 'SELECT', 'PRESS_KEY', 'HOVER', 'FILE_UPLOAD', 'ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL'].includes(kind)) {
    return null;
  }
  const target = normalizeRecordedTarget(event.target);
  if (!target?.locator && !['PRESS_KEY', 'ASSERT_URL'].includes(kind)) {
    return null;
  }
  if ((kind === 'FILL' || kind === 'SELECT' || kind === 'FILE_UPLOAD' || kind === 'ASSERT_TEXT' || kind === 'ASSERT_URL') && event.inputValue === undefined) {
    return null;
  }
  const framePath = await resolveFramePath(source?.frame).catch(() => []);
  if (target?.locator && framePath.length > 0) {
    target.locator.framePath = framePath;
    target.framePath = framePath;
  }
  if (target?.locator && normalizeShadowPath(target.locator.shadowPath).length === 0) {
    const inferredShadowPath = await inferRecordedTargetShadowPath(source?.frame, target).catch(() => []);
    if (inferredShadowPath.length > 0) {
      target.locator.shadowPath = inferredShadowPath;
      target.shadowPath = inferredShadowPath;
    }
  }

  return {
    eventId: randomUUID(),
    kind,
    timestamp: optionalString(event.timestamp) || new Date().toISOString(),
    pageUrl: optionalString(event.url) || getActivePageUrl() || null,
    pageTitle: optionalString(event.title) || activeSession?.pageTitle || null,
    inputValue: event.inputValue === undefined || event.inputValue === null ? null : String(event.inputValue),
    key: optionalString(event.key) || null,
    uploadArtifact: kind === 'FILE_UPLOAD' ? normalizeRecordedUploadArtifact(event.uploadArtifact) : null,
    target,
  };
}

function normalizeRecordedUploadArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return null;
  }
  const fileName = optionalString(artifact.fileName);
  if (!fileName) {
    return null;
  }
  const contentBase64 = optionalString(artifact.contentBase64);
  const size = Number(artifact.size);
  const fileCount = Number(artifact.fileCount);
  const limitBytes = Number(artifact.limitBytes);
  const captureStatus = normalizeRecordedUploadArtifactCaptureStatus(artifact.captureStatus, Boolean(contentBase64));
  const normalized = {
    fileName,
    contentType: optionalString(artifact.contentType) || 'application/octet-stream',
    ...(contentBase64 ? { contentBase64 } : {}),
    size: Number.isFinite(size) && size >= 0 ? size : null,
    captureStatus,
    ...(Number.isFinite(limitBytes) && limitBytes > 0 ? { limitBytes } : {}),
    ...(Number.isFinite(fileCount) && fileCount > 0 ? { fileCount } : {}),
  };
  if (!normalized.contentBase64 && captureStatus === 'READY') {
    normalized.captureStatus = 'EMPTY_CONTENT';
  }
  return normalized;
}

function normalizeRecordedUploadArtifactCaptureStatus(value, hasContentBase64) {
  const normalized = optionalString(value);
  if (normalized === 'TOO_LARGE' || normalized === 'UNSUPPORTED_MULTIPLE' || normalized === 'EMPTY_CONTENT' || normalized === 'READ_FAILED') {
    return normalized;
  }
  return hasContentBase64 ? 'READY' : 'EMPTY_CONTENT';
}

function normalizeRecordedTarget(target) {
  if (!target || typeof target !== 'object') {
    return null;
  }
  const locator = normalizeRecordedLocator(target.locator);
  const framePath = normalizeFramePath(target.framePath || locator?.framePath);
  const shadowPath = normalizeShadowPath(target.shadowPath || locator?.shadowPath);
  return {
    tagName: optionalString(target.tagName).toLowerCase() || null,
    elementType: optionalString(target.elementType).toUpperCase() || null,
    text: truncateText(target.text, 160),
    label: truncateText(target.label, 160),
    placeholder: truncateText(target.placeholder, 160),
    role: optionalString(target.role) || null,
    testId: optionalString(target.testId) || null,
    locator: locator ? {
      ...locator,
      framePath,
      shadowPath,
    } : null,
    framePath,
    shadowPath,
  };
}

function normalizeRecordedLocator(locator) {
  if (!locator || typeof locator !== 'object') {
    return null;
  }
  const locatorType = optionalString(locator.strategy || locator.locatorType).toUpperCase();
  const locatorValue = optionalString(locator.value || locator.locatorValue);
  if (!locatorType || !locatorValue) {
    return null;
  }
  return {
    locatorType,
    locatorValue,
    framePath: normalizeFramePath(locator.framePath),
    shadowPath: normalizeShadowPath(locator.shadowPath),
  };
}

function appendRecordedEvent(events, event) {
  const last = events[events.length - 1];
  if (
    last
    && ['FILL', 'SELECT'].includes(event.kind)
    && last.kind === event.kind
    && sameRecordedLocator(last.target?.locator, event.target?.locator)
  ) {
    events[events.length - 1] = event;
    return;
  }
  if (
    last
    && event.kind === 'FILE_UPLOAD'
    && last.kind === 'CLICK'
    && sameRecordedLocator(last.target?.locator, event.target?.locator)
  ) {
    events[events.length - 1] = event;
    return;
  }
  if (
    last
    && event.kind === 'HOVER'
    && last.kind === 'HOVER'
    && sameRecordedLocator(last.target?.locator, event.target?.locator)
    && isWithinRecordedEventWindow(last, event, RECORDER_DUPLICATE_HOVER_WINDOW_MS)
  ) {
    events[events.length - 1] = event;
    return;
  }
  if (
    last
    && event.kind === 'CLICK'
    && last.kind === 'CLICK'
    && sameRecordedLocator(last.target?.locator, event.target?.locator)
    && isWithinRecordedEventWindow(last, event, RECORDER_DUPLICATE_CLICK_WINDOW_MS)
  ) {
    events[events.length - 1] = event;
    return;
  }
  if (
    last
    && event.kind === 'DOUBLE_CLICK'
    && last.kind === 'CLICK'
    && sameRecordedLocator(last.target?.locator, event.target?.locator)
    && isWithinRecordedEventWindow(last, event, RECORDER_DUPLICATE_CLICK_WINDOW_MS)
  ) {
    events[events.length - 1] = event;
    return;
  }
  events.push(event);
}

function isWithinRecordedEventWindow(left, right, windowMs) {
  const leftTime = Date.parse(optionalString(left?.timestamp));
  const rightTime = Date.parse(optionalString(right?.timestamp));
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }
  return Math.abs(rightTime - leftTime) <= windowMs;
}

function sameRecordedLocator(left, right) {
  return Boolean(
    left
    && right
    && left.locatorType === right.locatorType
    && left.locatorValue === right.locatorValue
    && JSON.stringify(left.framePath || []) === JSON.stringify(right.framePath || [])
    && JSON.stringify(left.shadowPath || []) === JSON.stringify(right.shadowPath || []),
  );
}

function buildRecordedSteps(events) {
  const steps = [];
  for (const event of events) {
    const step = buildRecordedStep(event, steps.length + 1);
    if (step) {
      steps.push(step);
    }
  }
  return steps;
}

function buildRecordedStep(event, sortOrder) {
  const locator = event.target?.locator || null;
  let type = event.kind;
  let inputValue = event.inputValue;
  if (type === 'FILL' && String(inputValue ?? '') === '') {
    type = 'CLEAR';
    inputValue = null;
  }
  if (type === 'PRESS_KEY') {
    inputValue = event.key || event.inputValue || '';
  }
  if (['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'FILL', 'CLEAR', 'SELECT', 'HOVER', 'FILE_UPLOAD', 'ASSERT_VISIBLE', 'ASSERT_TEXT'].includes(type) && !locator) {
    return null;
  }
  if (['FILL', 'SELECT', 'PRESS_KEY', 'FILE_UPLOAD', 'ASSERT_TEXT', 'ASSERT_URL'].includes(type) && !optionalString(inputValue)) {
    return null;
  }

  const targetName = buildRecordedTargetName(event.target);
  return {
    id: null,
    name: buildRecordedStepName(type, targetName, sortOrder),
    type,
    stepType: type,
    elementId: null,
    elementName: targetName || null,
    locatorType: locator?.locatorType || null,
    locatorValue: locator?.locatorValue || null,
    framePath: locator?.framePath?.length ? locator.framePath : null,
    shadowPath: locator?.shadowPath?.length ? locator.shadowPath : null,
    inputValue: inputValue === null || inputValue === undefined ? null : String(inputValue),
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'ON_FAILURE',
    enabled: true,
    sortOrder,
    source: 'LOCAL_RUNNER_RECORDING',
    pageUrl: event.pageUrl || null,
    recordedAt: event.timestamp || null,
    uploadArtifact: event.uploadArtifact || null,
  };
}

function buildRecordedTargetName(target) {
  return truncateText(
    target?.label
      || target?.placeholder
      || target?.text
      || target?.testId
      || target?.locator?.locatorValue
      || '',
    60,
  );
}

function buildRecordedStepName(type, targetName, sortOrder) {
  const suffix = targetName ? ` ${targetName}` : '';
  if (type === 'CLICK') return `点击${suffix}`.trim();
  if (type === 'DOUBLE_CLICK') return `双击${suffix}`.trim();
  if (type === 'RIGHT_CLICK') return `右键${suffix}`.trim();
  if (type === 'FILL') return `输入${suffix}`.trim();
  if (type === 'CLEAR') return `清空${suffix}`.trim();
  if (type === 'HOVER') return `悬停${suffix}`.trim();
  if (type === 'SELECT') return `选择${suffix}`.trim();
  if (type === 'FILE_UPLOAD') return `上传${suffix}`.trim();
  if (type === 'PRESS_KEY') return `按键${suffix}`.trim();
  if (type === 'ASSERT_VISIBLE') return `验证${suffix}可见`.trim();
  if (type === 'ASSERT_TEXT') return `验证${suffix}文本`.trim();
  if (type === 'ASSERT_URL') return '验证 URL';
  return `录制步骤 ${sortOrder}`;
}

function buildRecorderView(recorder) {
  if (!recorder) {
    return {
      active: false,
      status: 'IDLE',
      paused: false,
      recorderId: null,
      sessionId: null,
      startedAt: null,
      stoppedAt: null,
      pausedAt: null,
      resumedAt: null,
      eventCount: 0,
      stepCount: 0,
      overflow: false,
    };
  }
  const status = recorder.status || (recorder.active ? 'RECORDING' : recorder.stoppedAt ? 'STOPPED' : 'PAUSED');
  const steps = buildRecordedSteps(recorder.events);
  return {
    active: status === 'RECORDING',
    status,
    paused: status === 'PAUSED',
    recorderId: recorder.recorderId,
    sessionId: recorder.sessionId || null,
    startedAt: recorder.startedAt || null,
    stoppedAt: recorder.stoppedAt || null,
    pausedAt: recorder.pausedAt || null,
    resumedAt: recorder.resumedAt || null,
    eventCount: recorder.events.length,
    stepCount: steps.length,
    overflow: Boolean(recorder.overflow),
  };
}

function truncateText(value, maxLength) {
  const text = optionalString(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

async function collectRawElementsFromPage() {
  ensurePage();
  const frames = page.frames();
  const elements = [];
  for (const frame of frames) {
    const framePath = await resolveFramePath(frame).catch(() => []);
    const frameElements = await frame.evaluate(collectElementsInPage, {
      framePath,
      shadowPath: [],
    }).catch(() => []);
    elements.push(...frameElements);
  }
  return elements;
}

async function resolveFramePath(frame) {
  if (!page || frame === page.mainFrame()) {
    return [];
  }
  const parent = frame.parentFrame();
  const parentPath = parent ? await resolveFramePath(parent) : [];
  const frameElement = await frame.frameElement().catch(() => null);
  const selector = frameElement ? await frameElement.evaluate(buildFrameElementSelector).catch(() => '') : '';
  return selector ? [...parentPath, { selector }] : parentPath;
}

async function inferRecordedTargetShadowPath(frame, target) {
  if (!frame || !target?.locator) {
    return [];
  }
  const locatorType = optionalString(target.locator.locatorType).toUpperCase();
  const locatorValue = optionalString(target.locator.locatorValue);
  if (!locatorType || !locatorValue) {
    return [];
  }
  const candidates = await frame.evaluate(({ locatorType: type, locatorValue: value, text, testId }) => {
    const matches = [];

    walkRoot(document);
    return matches;

    function walkRoot(root) {
      for (const element of Array.from(root.querySelectorAll('*'))) {
        if (matchesLocator(element, type, value)) {
          matches.push({
            shadowPath: buildElementShadowPath(element),
            text: normalizeText(element.innerText || element.textContent || ''),
            testId: element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-qa') || '',
          });
        }
        if (element.shadowRoot) {
          walkRoot(element.shadowRoot);
        }
      }
    }

    function matchesLocator(element, locatorType, locatorValue) {
      if (!(element instanceof Element)) {
        return false;
      }
      if (locatorType === 'CSS') {
        try {
          return element.matches(locatorValue);
        } catch {
          return false;
        }
      }
      if (locatorType === 'TEST_ID') {
        return [element.getAttribute('data-testid'), element.getAttribute('data-test'), element.getAttribute('data-qa'), element.id]
          .filter(Boolean)
          .includes(locatorValue);
      }
      return false;
    }

    function buildElementShadowPath(element) {
      const path = [];
      let current = element;
      while (current instanceof Element) {
        const root = current.getRootNode?.();
        const host = root && typeof root === 'object' && 'host' in root ? root.host : null;
        if (!(host instanceof Element)) {
          break;
        }
        const hostRoot = host.getRootNode?.();
        if (!hostRoot || typeof hostRoot.querySelectorAll !== 'function') {
          break;
        }
        path.unshift(buildShadowHostSelector(host, hostRoot));
        current = host;
      }
      return path;
    }

    function buildShadowHostSelector(element, root) {
      const tag = element.tagName.toLowerCase();
      if (element.id) {
        return `${tag}#${CSS.escape(element.id)}`;
      }
      const testIdValue = element.getAttribute('data-testid') || element.getAttribute('data-test');
      if (testIdValue) {
        return `${tag}[data-testid="${cssAttributeEscape(testIdValue)}"]`;
      }
      const name = element.getAttribute('name');
      if (name) {
        return `${tag}[name="${cssAttributeEscape(name)}"]`;
      }
      const sameTagCount = root.querySelectorAll(tag).length;
      return sameTagCount === 1 ? tag : buildCssPath(element);
    }

    function buildCssPath(element) {
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const tag = current.tagName.toLowerCase();
        if (current.id) {
          parts.unshift(`${tag}#${CSS.escape(current.id)}`);
          break;
        }
        const parent = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = Array.from(parent.children).filter(item => item.tagName === current.tagName);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
        current = parent;
      }
      return parts.join(' > ');
    }

    function cssAttributeEscape(raw) {
      return String(raw).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function normalizeText(raw) {
      return String(raw || '').replace(/\\s+/g, ' ').trim();
    }
  }, {
    locatorType,
    locatorValue,
    text: optionalString(target.text),
    testId: optionalString(target.testId),
  }).catch(() => []);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }
  const normalizedText = optionalString(target.text);
  const normalizedTestId = optionalString(target.testId);
  const preferred = candidates.find(item =>
    normalizeShadowPath(item?.shadowPath).length > 0
    && (
      (normalizedTestId && optionalString(item?.testId) === normalizedTestId)
      || (normalizedText && optionalString(item?.text) === normalizedText)
    ),
  ) || candidates.find(item => normalizeShadowPath(item?.shadowPath).length > 0);
  return normalizeShadowPath(preferred?.shadowPath);
}

function buildFrameElementSelector(element) {
  if (!element) {
    return '';
  }
  const tag = String(element.tagName || '').toLowerCase() || 'iframe';
  if (element.id) {
    return `${tag}#${CSS.escape(element.id)}`;
  }
  const name = element.getAttribute('name');
  if (name) {
    return `${tag}[name="${String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }
  const parent = element.parentElement;
  if (!parent) {
    return tag;
  }
  const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
  const index = siblings.indexOf(element) + 1;
  return siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag;
}

async function validateCurrentPageLocators(payload) {
  ensurePage();
  await ensureSessionFresh();
  const locators = Array.isArray(payload.locators) ? payload.locators : [];
  const shouldHighlight = payload.highlight === true;
  const results = [];
  let screenshotCount = 0;

  for (const item of locators.slice(0, VALIDATION_LOCATOR_LIMIT)) {
    const locatorType = optionalString(item.locatorType).toUpperCase();
    const locatorValue = optionalString(item.locatorValue);
    if (!locatorType || !locatorValue) {
      results.push(normalizeLocatorValidationResult({
        locatorType,
        locatorValue,
        matchCount: 0,
        screenshotBase64: null,
        framePath: item.framePath,
        shadowPath: item.shadowPath,
      }));
      continue;
    }

    try {
      const target = resolveLocatorTarget(page, item.framePath, item.shadowPath);
      const locator = resolveLocator(target, locatorType, locatorValue);
      const matchCount = await locator.count();
      let screenshotBase64 = null;
      let visible = false;
      let editable = false;
      let enabled = false;
      if (matchCount > 0) {
        const first = locator.first();
        await first.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
        visible = await first.isVisible({ timeout: 1000 }).catch(() => false);
        editable = await first.isEditable({ timeout: 1000 }).catch(() => false);
        enabled = await first.isEnabled({ timeout: 1000 }).catch(() => false);
        if (shouldHighlight) {
          await highlightLocatorMatches(locator, {
            limit: VALIDATION_HIGHLIGHT_LIMIT,
            durationMs: VALIDATION_HIGHLIGHT_DURATION_MS,
          }).catch(() => {});
        }
        if (screenshotCount < VALIDATION_SCREENSHOT_LIMIT) {
          const screenshot = await first.screenshot({ timeout: 1200 }).catch(() => null);
          screenshotBase64 = screenshot ? screenshot.toString('base64') : null;
          if (screenshotBase64) {
            screenshotCount += 1;
          }
        }
      }
      results.push(normalizeLocatorValidationResult({
        locatorType,
        locatorValue,
        matchCount,
        visible,
        editable,
        enabled,
        screenshotBase64,
        framePath: item.framePath,
        shadowPath: item.shadowPath,
      }));
    } catch (error) {
      results.push({
        locatorType,
        locatorValue,
        validationStatus: 'FAILED',
        matchCount: 0,
        validationMessage: error instanceof Error ? error.message : String(error),
        screenshotBase64: null,
        ...buildLocatorContextExtra(item),
      });
    }
  }

  return {
    success: true,
    session: activeSession,
    page: await getPageInfo(page),
    results,
  };
}

async function executeCurrentPageCase(payload) {
  const task = payload.task || {};
  const renderContext = buildCaseRenderContext(payload);
  const caseSnapshot = renderCaseSnapshot(payload.caseSnapshot || {}, renderContext);
  const steps = Array.isArray(payload.steps) ? payload.steps.map(step => renderCaseStep(step, renderContext)) : [];
  const stepResults = [];
  let stoppedByFailure = false;

  for (const step of steps) {
    if (stoppedByFailure) {
      const skipped = buildCaseStepResult(step, {
        status: 'SKIPPED',
        durationMs: 0,
        errorMessage: '前置步骤失败，当前步骤未执行',
      });
      stepResults.push(skipped);
      await payload.onStepResult?.(skipped);
      continue;
    }

    const startedAt = Date.now();
    let result;
    try {
      const stepExtra = await executeCurrentPageCaseStep({
        task,
        caseSnapshot,
        step,
      });
      result = buildCaseStepResult(step, {
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        extra: {
          pageUrl: getActivePageUrl(),
          ...(stepExtra && typeof stepExtra === 'object' ? stepExtra : {}),
        },
      });
    } catch (error) {
      const message = humanizeRunnerError(error);
      const screenshotBase64 = await captureFailureScreenshot();
      const screenshotEvidence = buildFailureScreenshotEvidence(step, screenshotBase64);
      result = buildCaseStepResult(step, {
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        errorMessage: message,
        screenshotRef: screenshotEvidence?.screenshot?.ref || null,
        extra: {
          pageUrl: getActivePageUrl(),
          ...(screenshotEvidence || {}),
        },
      });
      if (step.continueOnFailure !== true) {
        stoppedByFailure = true;
      }
    }

    stepResults.push(result);
    await payload.onStepResult?.(result);
  }

  return {
    success: stepResults.every(item => item.status !== 'FAILED'),
    page: hasUsablePage() ? await getPageInfo(page) : null,
    stepResults,
    errorMessage: stepResults.find(item => item.status === 'FAILED')?.errorMessage || null,
  };
}

async function executeCurrentPageCaseStep(input) {
  const step = input.step || {};
  const stepType = optionalString(step.stepType || step.type).toUpperCase();
  const timeoutMs = normalizePositiveNumber(step.timeoutMs, input.caseSnapshot.defaultTimeoutMs || 10_000);

  switch (stepType) {
    case 'OPEN': {
      const url = resolveCaseOpenUrl(step, input.caseSnapshot);
      if (!url) {
        throw new Error('OPEN step requires inputValue or case baseUrl');
      }
      await assertRequiredAuthState(input.task, input.caseSnapshot);
      await openCollectPage({
        url,
        workspaceId: input.task.workspaceCode || 'default-workspace',
        environmentId: input.caseSnapshot.environmentId || 'default-environment',
        headless: input.caseSnapshot.headless === true,
      });
      await assertPageStillAuthenticated(input.caseSnapshot);
      return;
    }
    case 'CLICK': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      return executeActionWithPageBoundary(() => locator.click({ timeout: timeoutMs }), { timeoutMs });
    }
    case 'DOUBLE_CLICK': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      return executeActionWithPageBoundary(() => locator.dblclick({ timeout: timeoutMs }), { timeoutMs });
    }
    case 'RIGHT_CLICK': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      return executeActionWithPageBoundary(() => locator.click({ button: 'right', timeout: timeoutMs }), { timeoutMs });
    }
    case 'HOVER': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      await locator.hover({ timeout: timeoutMs });
      return;
    }
    case 'DRAG_TO': {
      const source = await prepareLocatorAction(step, timeoutMs);
      const target = await prepareDragTargetLocator(step, timeoutMs);
      const actionExtra = await executeActionWithPageBoundary(() => source.dragTo(target.locator, { timeout: timeoutMs }), { timeoutMs });
      return {
        ...actionExtra,
        dragTarget: {
          locatorType: target.locatorType,
          locatorValue: target.locatorValue,
        },
      };
    }
    case 'DRAG_COORDINATES': {
      const drag = await prepareCoordinateDrag(step, timeoutMs);
      const actionExtra = await executeActionWithPageBoundary(async () => {
        await page.mouse.move(drag.absoluteFrom.x, drag.absoluteFrom.y);
        await page.mouse.down();
        await page.mouse.move(drag.absoluteTo.x, drag.absoluteTo.y, { steps: drag.steps });
        await page.mouse.up();
      }, { timeoutMs });
      return {
        ...actionExtra,
        dragCoordinates: drag.extra,
      };
    }
    case 'FILL': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      await locator.fill(String(step.inputValue ?? ''), { timeout: timeoutMs });
      return;
    }
    case 'CLEAR': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      await locator.fill('', { timeout: timeoutMs });
      return;
    }
    case 'PRESS_KEY': {
      await ensureCasePage();
      const key = optionalString(step.inputValue || step.key);
      if (!key) {
        throw new Error('PRESS_KEY step requires inputValue');
      }
      if (optionalString(step.locatorValue)) {
        await (await prepareLocatorAction(step, timeoutMs)).press(key, { timeout: timeoutMs });
      } else {
        await page.keyboard.press(key);
      }
      return;
    }
    case 'SELECT': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const value = optionalString(step.inputValue || step.value);
      if (!value) {
        throw new Error('SELECT step requires inputValue');
      }
      await locator.selectOption(value, { timeout: timeoutMs });
      return;
    }
    case 'FILE_UPLOAD': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const filePath = resolveUploadFilePath(input.task, step);
      await locator.setInputFiles(filePath, { timeout: timeoutMs });
      return;
    }
    case 'FILE_PICKER': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const filePath = resolveUploadFilePath(input.task, step);
      const actionExtra = await executeActionWithPageBoundary(async () => {
        const chooserPromise = page.waitForEvent('filechooser', { timeout: timeoutMs });
        await locator.click({ timeout: timeoutMs });
        const chooser = await chooserPromise;
        await chooser.setFiles(filePath);
      }, { timeoutMs });
      return {
        ...actionExtra,
        filePicker: {
          filePath,
        },
      };
    }
    case 'WAIT_FOR': {
      if (optionalString(step.locatorValue)) {
        const locator = resolveCaseStepLocator(step, timeoutMs);
        await locator.waitFor({ state: 'visible', timeout: timeoutMs }).catch(error => {
          throw new Error(`等待失败：元素在 ${timeoutMs} ms 内未显示（${formatLocatorForMessage(step)}），原始错误：${error instanceof Error ? error.message : String(error)}`);
        });
        return;
      }
      await ensureCasePage();
      await page.waitForTimeout(Math.min(timeoutMs, 60_000));
      return;
    }
    case 'WAIT_URL': {
      await ensureCasePage();
      const expectedUrl = optionalString(step.inputValue || step.expectedUrl || step.url);
      if (!expectedUrl) {
        throw new Error('WAIT_URL step requires inputValue');
      }
      await page.waitForURL(url => String(url).includes(expectedUrl), { timeout: timeoutMs }).catch(error => {
        throw new Error(`等待失败：URL 在 ${timeoutMs} ms 内未匹配“${expectedUrl}”，当前为“${page.url()}”，原始错误：${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }
    case 'WAIT_TEXT': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const expectedText = optionalString(step.inputValue || step.expectedText || step.text);
      if (!expectedText) {
        throw new Error('WAIT_TEXT step requires inputValue');
      }
      const startedAt = Date.now();
      let actualText = '';
      while (Date.now() - startedAt < timeoutMs) {
        actualText = optionalString(await locator.innerText({ timeout: Math.min(1000, timeoutMs) }).catch(() => ''));
        if (actualText.includes(expectedText)) {
          return;
        }
        await page.waitForTimeout(100);
      }
      throw new Error(`等待失败：文本在 ${timeoutMs} ms 内未匹配。期望包含“${expectedText}”，实际为“${actualText || '空文本'}”`);
    }
    case 'WAIT_HIDDEN': {
      const locator = resolveCaseStepLocator(step, timeoutMs);
      await locator.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(error => {
        throw new Error(`等待失败：元素在 ${timeoutMs} ms 内未隐藏（${formatLocatorForMessage(step)}），原始错误：${error instanceof Error ? error.message : String(error)}`);
      });
      return;
    }
    case 'ASSERT_VISIBLE': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const visible = await locator.isVisible({ timeout: timeoutMs }).catch(() => false);
      if (!visible) {
        throw new Error(`断言失败：元素未显示（${formatLocatorForMessage(step)}）`);
      }
      return;
    }
    case 'ASSERT_NOT_VISIBLE': {
      const locator = resolveCaseStepLocator(step, timeoutMs);
      const visible = await locator.isVisible({ timeout: timeoutMs }).catch(() => false);
      if (visible) {
        throw new Error(`断言失败：元素不应显示（${formatLocatorForMessage(step)}）`);
      }
      return;
    }
    case 'ASSERT_TEXT': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const expectedText = optionalString(step.inputValue || step.expectedText || step.text);
      if (!expectedText) {
        throw new Error('ASSERT_TEXT step requires inputValue');
      }
      const actualText = optionalString(await locator.innerText({ timeout: timeoutMs }).catch(() => ''));
      if (!actualText.includes(expectedText)) {
        throw new Error(`断言失败：文本不匹配。期望包含“${expectedText}”，实际为“${actualText || '空文本'}”`);
      }
      return;
    }
    case 'ASSERT_VALUE': {
      const locator = await prepareLocatorAction(step, timeoutMs);
      const expectedValue = optionalString(step.inputValue || step.expectedValue || step.value);
      if (!expectedValue) {
        throw new Error('ASSERT_VALUE step requires inputValue');
      }
      const actualValue = optionalString(await locator.inputValue({ timeout: timeoutMs }).catch(() => ''));
      if (actualValue !== expectedValue) {
        throw new Error(`断言失败：输入值不匹配。期望为“${expectedValue}”，实际为“${actualValue || '空值'}”`);
      }
      return;
    }
    case 'ASSERT_URL': {
      await ensureCasePage();
      const expectedUrl = optionalString(step.inputValue || step.expectedUrl || step.url);
      if (!expectedUrl) {
        throw new Error('ASSERT_URL step requires inputValue');
      }
      const actualUrl = page.url();
      if (!actualUrl.includes(expectedUrl)) {
        throw new Error(`断言失败：URL 不匹配。期望包含“${expectedUrl}”，实际为“${actualUrl}”`);
      }
      return;
    }
    case 'ASSERT_TITLE': {
      await ensureCasePage();
      const expectedTitle = optionalString(step.inputValue || step.expectedTitle || step.title);
      if (!expectedTitle) {
        throw new Error('ASSERT_TITLE step requires inputValue');
      }
      const actualTitle = await page.title();
      if (!actualTitle.includes(expectedTitle)) {
        throw new Error(`断言失败：标题不匹配。期望包含“${expectedTitle}”，实际为“${actualTitle || '空标题'}”`);
      }
      return;
    }
    case 'SCREENSHOT':
      await ensureCasePage();
      await page.screenshot({ fullPage: false, type: 'png' });
      return;
    default:
      throw new Error(`Unsupported Web UI case step type: ${stepType || 'UNKNOWN'}`);
  }
}

async function ensureCasePage() {
  ensurePage();
  await ensureSessionFresh();
}

async function executeActionWithPageBoundary(action, options = {}) {
  await ensureCasePage();
  const actionPage = page;
  const knownPages = new Set(context?.pages?.().filter(item => item && !item.isClosed?.()) || []);
  const dialogMessages = [];
  let capturedDownload = null;
  const onDialog = async dialog => {
    dialogMessages.push({
      type: dialog.type?.() || 'dialog',
      message: dialog.message?.() || '',
      defaultValue: dialog.defaultValue?.() || '',
    });
    await dialog.accept(optionalString(options.dialogText)).catch(async () => {
      await dialog.dismiss().catch(() => null);
    });
  };
  const onDownload = download => {
    capturedDownload = download;
  };
  actionPage.on?.('dialog', onDialog);
  actionPage.on?.('download', onDownload);
  try {
    const result = await action();
    const newPage = await promoteNewPageAfterAction(knownPages, options.timeoutMs);
    const download = await summarizeCapturedDownload(capturedDownload);
    return {
      result,
      ...(dialogMessages.length ? { dialogs: dialogMessages } : {}),
      ...(download ? { download } : {}),
      ...(newPage ? { newPageUrl: newPage.url?.() || null } : {}),
    };
  } finally {
    actionPage.off?.('dialog', onDialog);
    actionPage.off?.('download', onDownload);
  }
}

async function promoteNewPageAfterAction(knownPages, timeoutMs = 1000) {
  if (!context?.pages) {
    return null;
  }
  const deadline = Date.now() + Math.min(Math.max(Number(timeoutMs || 0), 500), 1000);
  while (Date.now() <= deadline) {
    const candidate = context.pages()
      .filter(item => item && !item.isClosed?.() && !knownPages.has(item))
      .at(-1);
    if (candidate) {
      attachPageNavigationTracking(candidate);
      await candidate.waitForLoadState('domcontentloaded', { timeout: Math.max(100, deadline - Date.now()) }).catch(() => null);
      promoteActivePage(candidate);
      return candidate;
    }
    await sleep(50);
  }
  return null;
}

async function summarizeCapturedDownload(download) {
  if (!download) {
    return null;
  }
  const suggestedFilename = optionalString(download.suggestedFilename?.());
  const localPath = await download.path?.().catch(() => null);
  const failure = await download.failure?.().catch(() => null);
  const stats = localPath ? await stat(localPath).catch(() => null) : null;
  const contentType = inferContentTypeFromFileName(suggestedFilename);
  const archive = await buildDownloadArchive({
    localPath,
    suggestedFilename,
    contentType,
    size: stats?.size ?? null,
    failure,
  });
  return {
    suggestedFilename: suggestedFilename || null,
    url: optionalString(download.url?.()) || null,
    contentType,
    size: stats?.size ?? null,
    failure: optionalString(failure) || null,
    completed: !failure,
    ...(archive ? { archive } : {}),
  };
}

async function buildDownloadArchive(input) {
  if (input.failure || !input.localPath || typeof input.size !== 'number') {
    return null;
  }
  if (input.size > DOWNLOAD_ARCHIVE_MAX_SIZE_BYTES) {
    return {
      archived: false,
      reason: 'FILE_TOO_LARGE',
      maxSize: DOWNLOAD_ARCHIVE_MAX_SIZE_BYTES,
    };
  }
  const content = await readFile(input.localPath).catch(() => null);
  if (!content) {
    return {
      archived: false,
      reason: 'READ_FAILED',
      maxSize: DOWNLOAD_ARCHIVE_MAX_SIZE_BYTES,
    };
  }
  return {
    archived: true,
    source: 'LOCAL_RUNNER_DOWNLOAD',
    fileName: optionalString(input.suggestedFilename) || null,
    contentType: input.contentType || null,
    encoding: 'base64',
    contentBase64: content.toString('base64'),
    size: input.size,
  };
}

function inferContentTypeFromFileName(fileName) {
  const normalized = optionalString(fileName).toLowerCase();
  if (normalized.endsWith('.txt')) return 'text/plain';
  if (normalized.endsWith('.json')) return 'application/json';
  if (normalized.endsWith('.csv')) return 'text/csv';
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (normalized.endsWith('.zip')) return 'application/zip';
  return null;
}

function resolveCaseOpenUrl(step, caseSnapshot) {
  const rawUrl = optionalString(step.inputValue || step.url || caseSnapshot.baseUrl || caseSnapshot.pageUrl);
  if (!rawUrl) {
    return '';
  }
  if (isAbsoluteBrowserUrl(rawUrl)) {
    return rawUrl;
  }
  const baseUrl = optionalString(caseSnapshot.baseUrl || caseSnapshot.pageUrl);
  if (!baseUrl || !isAbsoluteBrowserUrl(baseUrl)) {
    return rawUrl;
  }
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function isAbsoluteBrowserUrl(value) {
  return /^(https?:|file:|data:|about:)/i.test(optionalString(value));
}

async function assertRequiredAuthState(task, caseSnapshot) {
  if (caseSnapshot.requireAuthState !== true && caseSnapshot.authRequired !== true) {
    return;
  }
  const workspaceId = optionalString(task.workspaceCode) || 'default-workspace';
  const environmentId = optionalString(caseSnapshot.environmentId) || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  const health = evaluateAuthStateHealth({
    required: true,
    exists: existsSync(storageStatePath),
    workspaceId,
    environmentId,
    storageState: await readJsonFile(storageStatePath),
    minTtlMs: resolveAuthStateMinTtlMs(task, caseSnapshot),
  });
  if (!health.ok) {
    throw new Error(health.message);
  }
}

async function assertPageStillAuthenticated(caseSnapshot) {
  if (caseSnapshot.requireAuthState !== true && caseSnapshot.authRequired !== true) {
    return;
  }
  const pageInfo = await getPageInfo(page);
  if (pageInfo.isProbablyLoginPage) {
    throw new Error(`本地登录状态已失效：打开目标页面后跳转到登录页（当前 URL：${pageInfo.url}），请重新保存登录状态后再执行`);
  }
}

function resolveAuthStateMinTtlMs(task, caseSnapshot) {
  const timeoutPolicy = normalizePlainObject(task.timeoutPolicy);
  const explicit = Number(caseSnapshot.authStateMinTtlMs ?? timeoutPolicy.authStateMinTtlMs);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const maxDuration = Number(timeoutPolicy.maxDurationMs ?? timeoutPolicy.taskTimeoutMs ?? task.taskTimeoutMs);
  if (Number.isFinite(maxDuration) && maxDuration > 0) {
    return maxDuration;
  }
  return 5 * 60_000;
}

function buildCaseRenderContext(payload) {
  const environment = normalizePlainObject(payload.environmentSnapshot);
  const variableSnapshot = normalizePlainObject(payload.variableSnapshot);
  const snapshotVariables = normalizePlainObject(variableSnapshot.variables);
  const caseSnapshot = normalizePlainObject(payload.caseSnapshot);
  const context = {
    ...flattenSnapshot(environment, 'environment'),
    ...flattenSnapshot(variableSnapshot, 'variableSet'),
    ...snapshotVariables,
  };
  for (const key of ['baseUrl', 'pageUrl', 'environmentId', 'environmentName', 'browserType', 'defaultTimeoutMs']) {
    if (environment[key] !== undefined && environment[key] !== null) {
      context[key] = environment[key];
    }
  }
  for (const key of ['baseUrl', 'pageUrl', 'environmentId', 'environmentName', 'browserType', 'defaultTimeoutMs']) {
    if (context[key] === undefined && caseSnapshot[key] !== undefined && caseSnapshot[key] !== null) {
      context[key] = caseSnapshot[key];
    }
  }
  return context;
}

function renderCaseSnapshot(caseSnapshot, context) {
  const rendered = { ...caseSnapshot };
  for (const key of ['baseUrl', 'pageUrl', 'environmentId', 'environmentName', 'browserType']) {
    if (typeof rendered[key] === 'string') {
      rendered[key] = renderTemplateString(rendered[key], context);
    }
  }
  return rendered;
}

function renderCaseStep(step, context) {
  const rendered = { ...step };
  for (const key of ['locatorType', 'locatorValue', 'inputValue', 'url', 'key', 'value', 'expectedText', 'expectedUrl', 'expectedTitle', 'text', 'title']) {
    if (typeof rendered[key] === 'string') {
      rendered[key] = renderTemplateString(rendered[key], context);
    }
  }
  return rendered;
}

function renderTemplateString(value, context) {
  return String(value).replace(/\$\{([^}]+)}/g, (match, rawKey) => {
    const key = String(rawKey || '').trim();
    if (!key) {
      return match;
    }
    const replacement = resolveContextValue(context, key);
    return replacement === undefined || replacement === null ? match : String(replacement);
  });
}

function resolveContextValue(context, key) {
  if (Object.prototype.hasOwnProperty.call(context, key)) {
    return context[key];
  }
  const parts = key.split('.').filter(Boolean);
  let current = context;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function flattenSnapshot(value, prefix) {
  const source = normalizePlainObject(value);
  const result = {};
  for (const [key, item] of Object.entries(source)) {
    if (item === undefined || item === null || typeof item === 'object') {
      continue;
    }
    result[`${prefix}.${key}`] = item;
  }
  return result;
}

function normalizePlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveCaseStepLocator(step, timeoutMs) {
  ensurePage();
  void timeoutMs;
  const locatorType = optionalString(step.locatorType).toUpperCase();
  const locatorValue = optionalString(step.locatorValue);
  if (!locatorType || !locatorValue) {
    throw new Error('Step locatorType and locatorValue are required');
  }
  const target = resolveLocatorTarget(page, step.framePath, step.shadowPath);
  const locator = resolveLocator(target, locatorType, locatorValue);
  return locator.first();
}

async function prepareLocatorAction(step, timeoutMs) {
  const locator = resolveCaseStepLocator(step, timeoutMs);
  await locator.waitFor({ state: 'visible', timeout: timeoutMs }).catch(error => {
    throw new Error(`元素准备失败：元素在 ${timeoutMs} ms 内未显示（${formatLocatorForMessage(step)}），原始错误：${error instanceof Error ? error.message : String(error)}`);
  });
  await locator.scrollIntoViewIfNeeded({ timeout: Math.min(timeoutMs, 5000) }).catch(() => {});
  return locator;
}

async function prepareDragTargetLocator(step, timeoutMs) {
  ensurePage();
  const target = parseDragTargetLocator(step.inputValue || step.targetLocator || step.value);
  const locatorTarget = resolveLocatorTarget(page, step.targetFramePath || step.framePath, step.targetShadowPath || step.shadowPath);
  const locator = resolveLocator(locatorTarget, target.locatorType, target.locatorValue).first();
  await locator.waitFor({ state: 'visible', timeout: timeoutMs }).catch(error => {
    throw new Error(`拖拽目标准备失败：元素在 ${timeoutMs} ms 内未显示（${target.locatorType}: ${target.locatorValue}），原始错误：${error instanceof Error ? error.message : String(error)}`);
  });
  await locator.scrollIntoViewIfNeeded({ timeout: Math.min(timeoutMs, 5000) }).catch(() => {});
  return {
    locator,
    locatorType: target.locatorType,
    locatorValue: target.locatorValue,
  };
}

function parseDragTargetLocator(value) {
  const raw = optionalString(value);
  if (!raw) {
    throw new Error('DRAG_TO step requires inputValue as target locator');
  }
  const separatorIndex = raw.indexOf('=');
  if (separatorIndex <= 0) {
    return { locatorType: 'CSS', locatorValue: raw };
  }
  const locatorType = raw.slice(0, separatorIndex).trim().toUpperCase();
  const locatorValue = raw.slice(separatorIndex + 1).trim();
  if (!locatorValue) {
    throw new Error('DRAG_TO target locator value is required');
  }
  if (!['CSS', 'TEST_ID', 'TEXT', 'ROLE', 'PLACEHOLDER', 'LABEL', 'XPATH'].includes(locatorType)) {
    return { locatorType: 'CSS', locatorValue: raw };
  }
  return { locatorType, locatorValue };
}

async function prepareCoordinateDrag(step, timeoutMs) {
  ensurePage();
  const locator = await prepareLocatorAction(step, timeoutMs);
  const box = await locator.boundingBox({ timeout: Math.min(timeoutMs, 5000) }).catch(() => null);
  if (!box) {
    throw new Error(`坐标拖拽失败：无法获取元素位置（${formatLocatorForMessage(step)}）`);
  }
  const coordinates = parseDragCoordinates(step.inputValue || step.coordinates || step.value);
  const absoluteFrom = resolveCoordinatePoint(box, coordinates.from, coordinates.relativeTo);
  const absoluteTo = resolveCoordinatePoint(box, coordinates.to, coordinates.relativeTo);
  return {
    absoluteFrom,
    absoluteTo,
    steps: coordinates.steps,
    extra: {
      relativeTo: coordinates.relativeTo,
      from: coordinates.from,
      to: coordinates.to,
      absoluteFrom,
      absoluteTo,
      steps: coordinates.steps,
    },
  };
}

function parseDragCoordinates(value) {
  const raw = optionalString(value);
  if (!raw) {
    throw new Error('DRAG_COORDINATES step requires inputValue');
  }
  const parsed = parseDragCoordinatesJson(raw) || parseDragCoordinatesExpression(raw);
  if (!parsed) {
    throw new Error('DRAG_COORDINATES inputValue must be JSON or "x1,y1 -> x2,y2"');
  }
  return {
    relativeTo: parsed.relativeTo === 'viewport' ? 'viewport' : 'element',
    from: normalizeCoordinatePoint(parsed.from, 'from'),
    to: normalizeCoordinatePoint(parsed.to, 'to'),
    steps: normalizeDragSteps(parsed.steps),
  };
}

function parseDragCoordinatesJson(raw) {
  if (!raw.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      relativeTo: optionalString(parsed.relativeTo),
      from: parsed.from,
      to: parsed.to,
      steps: parsed.steps,
    };
  } catch {
    return null;
  }
}

function parseDragCoordinatesExpression(raw) {
  const match = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:->|=>|to)\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/i);
  if (!match) {
    return null;
  }
  return {
    relativeTo: 'element',
    from: { x: Number(match[1]), y: Number(match[2]) },
    to: { x: Number(match[3]), y: Number(match[4]) },
  };
}

function normalizeCoordinatePoint(value, label) {
  const point = Array.isArray(value)
    ? { x: value[0], y: value[1] }
    : value && typeof value === 'object'
      ? { x: value.x, y: value.y }
      : null;
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`DRAG_COORDINATES ${label} coordinate must include numeric x and y`);
  }
  return { x, y };
}

function normalizeDragSteps(value) {
  const steps = Number(value);
  return Number.isFinite(steps) && steps > 0 ? Math.min(Math.floor(steps), 100) : 12;
}

function resolveCoordinatePoint(box, point, relativeTo) {
  if (relativeTo === 'viewport') {
    return { x: point.x, y: point.y };
  }
  return {
    x: box.x + point.x,
    y: box.y + point.y,
  };
}

function formatLocatorForMessage(step) {
  const locatorType = optionalString(step.locatorType).toUpperCase() || 'CSS';
  const locatorValue = optionalString(step.locatorValue) || '-';
  return `${locatorType}: ${locatorValue}`;
}

function resolveUploadFilePath(task, step) {
  const inputValue = optionalString(step.inputValue || step.filePath || step.value);
  return resolveArtifactUploadPath(task, inputValue);
}

function buildCaseStepResult(step, result) {
  return {
    stepId: String(resultStepId(step)),
    stepName: optionalString(step.stepName || step.name) || String(resultStepId(step)),
    stepType: optionalString(step.stepType || step.type).toUpperCase(),
    status: result.status,
    durationMs: result.durationMs,
    errorMessage: result.errorMessage || null,
    screenshotRef: result.screenshotRef || null,
    extra: {
      sortOrder: step.sortOrder || null,
      locatorType: step.locatorType || null,
      locatorValue: step.locatorValue || null,
      ...buildLocatorContextExtra(step),
      ...(result.extra || {}),
    },
  };
}

function buildLocatorContextExtra(value) {
  const framePath = normalizeFramePath(value.framePath);
  const shadowPath = normalizeShadowPath(value.shadowPath);
  return {
    ...(framePath.length > 0 ? { framePath } : {}),
    ...(shadowPath.length > 0 ? { shadowPath } : {}),
  };
}

function resultStepId(step) {
  return step.stepId || step.id || step.sortOrder || randomUUID();
}

function buildFailureScreenshotEvidence(step, screenshotBase64) {
  if (!screenshotBase64) {
    return null;
  }
  const stepId = String(resultStepId(step));
  return {
    screenshotBase64,
    screenshot: {
      ref: `inline:base64:${stepId}`,
      source: 'LOCAL_RUNNER',
      encoding: 'base64',
      contentType: 'image/png',
    },
  };
}

async function captureFailureScreenshot() {
  if (!hasUsablePage()) {
    return null;
  }
  const screenshot = await page.screenshot({
    fullPage: false,
    type: 'png',
  }).catch(() => null);
  return screenshot ? screenshot.toString('base64') : null;
}

function resolveLocator(targetPage, locatorType, locatorValue) {
  switch (locatorType) {
    case 'XPATH':
      return targetPage.locator(`xpath=${locatorValue}`);
    case 'TEXT':
      return targetPage.getByText(locatorValue);
    case 'ROLE': {
      const match = locatorValue.match(/^([^[]+)\[name="(.+)"\]$/);
      if (match) {
        return targetPage.getByRole(match[1], { name: match[2] });
      }
      const legacyParts = locatorValue.split(':');
      if (legacyParts.length > 1) {
        return targetPage.getByRole(legacyParts[0], { name: legacyParts.slice(1).join(':') });
      }
      return targetPage.getByRole(locatorValue);
    }
    case 'LABEL':
      return targetPage.getByLabel(locatorValue);
    case 'PLACEHOLDER':
      return targetPage.getByPlaceholder(locatorValue);
    case 'TEST_ID':
      return targetPage.locator([
        `[data-testid="${cssAttributeEscape(locatorValue)}"]`,
        `[data-test="${cssAttributeEscape(locatorValue)}"]`,
        `[data-qa="${cssAttributeEscape(locatorValue)}"]`,
        `[id="${cssAttributeEscape(locatorValue)}"]`,
      ].join(', '));
    default:
      return targetPage.locator(locatorValue);
  }
}

function resolveLocatorTarget(rootPage, framePath, shadowPath) {
  let target = rootPage;
  for (const item of normalizeFramePath(framePath)) {
    const selector = optionalString(item?.selector || item);
    if (selector) {
      target = target.frameLocator(selector);
    }
  }
  for (const item of normalizeShadowPath(shadowPath)) {
    const selector = optionalString(item?.selector || item);
    if (selector) {
      target = target.locator(selector);
    }
  }
  return target;
}

async function highlightLocatorMatches(locator, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || VALIDATION_HIGHLIGHT_LIMIT), 20));
  const durationMs = Math.max(1000, Math.min(Number(options.durationMs || VALIDATION_HIGHLIGHT_DURATION_MS), 10_000));
  await locator.evaluateAll((elements, payload) => {
    const marker = 'data-auto-web-ui-highlight';
    const badgeMarker = 'data-auto-web-ui-highlight-badge';
    const styleAttr = 'data-auto-web-ui-highlight-style';
    const timerKey = '__autoWebUiHighlightTimer';

    const cleanup = () => {
      document.querySelectorAll(`[${badgeMarker}="true"]`).forEach(item => item.remove());
      document.querySelectorAll(`[${marker}="true"]`).forEach(item => {
        const originalStyle = item.getAttribute(styleAttr);
        if (originalStyle && originalStyle !== '__AUTO_EMPTY__') {
          item.setAttribute('style', originalStyle);
        } else {
          item.removeAttribute('style');
        }
        item.removeAttribute(marker);
        item.removeAttribute(styleAttr);
      });
    };

    cleanup();
    window.clearTimeout(window[timerKey]);

    elements.slice(0, payload.limit).forEach((item, index) => {
      if (!(item instanceof Element) || !('style' in item)) {
        return;
      }
      const rect = item.getBoundingClientRect();
      const originalStyle = item.getAttribute('style');
      item.setAttribute(marker, 'true');
      item.setAttribute(styleAttr, originalStyle || '__AUTO_EMPTY__');
      item.style.outline = '3px solid #409eff';
      item.style.outlineOffset = '2px';
      item.style.boxShadow = '0 0 0 6px rgba(64, 158, 255, 0.22), 0 8px 24px rgba(64, 158, 255, 0.3)';
      item.style.backgroundColor = 'rgba(64, 158, 255, 0.12)';
      item.style.transition = 'outline 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease';

      const badge = document.createElement('div');
      badge.setAttribute(badgeMarker, 'true');
      badge.textContent = String(index + 1);
      badge.style.position = 'fixed';
      badge.style.left = `${Math.max(8, rect.left)}px`;
      badge.style.top = `${Math.max(8, rect.top - 24)}px`;
      badge.style.zIndex = '2147483647';
      badge.style.minWidth = '18px';
      badge.style.height = '18px';
      badge.style.padding = '0 5px';
      badge.style.borderRadius = '999px';
      badge.style.background = '#409eff';
      badge.style.color = '#fff';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '600';
      badge.style.lineHeight = '18px';
      badge.style.textAlign = 'center';
      badge.style.boxShadow = '0 4px 12px rgba(64, 158, 255, 0.35)';
      badge.style.pointerEvents = 'none';
      document.body.appendChild(badge);
    });

    window[timerKey] = window.setTimeout(cleanup, payload.durationMs);
  }, { limit, durationMs });
}

function normalizeFramePath(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeShadowPath(value) {
  return Array.isArray(value) ? value : [];
}

function cssAttributeEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function saveAuthState(payload) {
  ensureContext();
  ensurePage();
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);

  await mkdir(AUTH_DIR, { recursive: true });
  await context.storageState({ path: storageStatePath });
  const savedAt = new Date().toISOString();
  await writeFile(
    `${storageStatePath}.meta.json`,
    JSON.stringify({
      workspaceId,
      environmentId,
      savedAt,
      url: page?.url() || '',
    }, null, 2),
    'utf8',
  );
  if (activeSession) {
    activeSession.authStateExists = true;
    activeSession.authSavedAt = savedAt;
  }

  return {
    success: true,
    storageStatePath,
    savedAt,
  };
}

async function getAuthStateStatus(payload) {
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  const exists = existsSync(storageStatePath);
  const meta = await readJsonFile(`${storageStatePath}.meta.json`);
  const savedAt = typeof meta?.savedAt === 'string' ? meta.savedAt : null;
  const savedUrl = typeof meta?.url === 'string' ? meta.url : null;
  const ageMinutes = savedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(savedAt)) / 60000)) : null;

  return {
    success: true,
    workspaceId,
    environmentId,
    exists,
    savedAt,
    savedUrl,
    ageMinutes,
    stale: exists && typeof ageMinutes === 'number' ? ageMinutes >= AUTH_STALE_MINUTES : false,
    staleAfterMinutes: AUTH_STALE_MINUTES,
    activeSession: activeSession
      ? {
          sessionId: activeSession.sessionId,
          currentUrl: getActivePageUrl() || activeSession.currentUrl || '',
          openedAt: activeSession.openedAt || null,
          expiresAt: activeSession.expiresAt || null,
          authStateExists: Boolean(activeSession.authStateExists),
        }
      : null,
  };
}

async function clearAuthState(payload) {
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  await rm(storageStatePath, { force: true });
  await rm(`${storageStatePath}.meta.json`, { force: true });
  if (activeSession && activeSession.workspaceId === workspaceId && activeSession.environmentId === environmentId) {
    activeSession.authStateExists = false;
    activeSession.authSavedAt = null;
  }

  return {
    success: true,
    cleared: true,
  };
}

async function releaseCurrentSession(reason = 'manual') {
  finalizeActiveRecorder();
  const releasedSession = buildSessionView();
  if (context) {
    await context.close().catch(() => {});
  }
  context = undefined;
  page = undefined;
  activeSession = undefined;

  return {
    success: true,
    released: Boolean(releasedSession),
    reason,
    session: releasedSession,
  };
}

async function bindCurrentSession(payload) {
  ensurePage();
  await ensureSessionFresh();
  const taskId = normalizeTaskId(payload.taskId);
  if (!taskId) {
    throw new Error('taskId is required');
  }
  const expectedSessionId = optionalString(payload.sessionId);
  if (expectedSessionId && activeSession?.sessionId && expectedSessionId !== activeSession.sessionId) {
    throw new Error('sessionId does not match active runner session');
  }
  activeSession = {
    ...(activeSession || {}),
    boundTaskId: taskId,
    boundAt: new Date().toISOString(),
    currentUrl: getActivePageUrl() || activeSession?.currentUrl || '',
  };
  await refreshActiveSessionPageSnapshot();
  return {
    success: true,
    session: buildSessionView(),
  };
}

async function startPlatformValidationPolling(payload) {
  ensurePage();
  await ensureSessionFresh();
  const taskId = normalizeTaskId(payload.taskId || activeSession?.boundTaskId);
  if (!taskId) {
    throw new Error('taskId is required');
  }
  const apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
  if (!apiBaseUrl) {
    throw new Error('apiBaseUrl is required');
  }
  const workspaceCode = optionalString(payload.workspaceCode) || 'ALL';
  const sessionId = optionalString(payload.sessionId) || activeSession?.sessionId || '';
  if (payload.sessionId && activeSession?.sessionId && sessionId !== activeSession.sessionId) {
    throw new Error('sessionId does not match active runner session');
  }
  const runnerId = optionalString(payload.runnerId) || 'local-runner';
  const currentUrl = getActivePageUrl() || optionalString(payload.currentUrl) || activeSession?.currentUrl || '';
  const requestedLocators = Array.isArray(payload.locators) ? payload.locators : [];
  const intervalMs = Math.max(1000, Math.min(Number(payload.intervalMs || 2000), 15000));
  const headers = normalizePlatformHeaders(payload);

  stopPlatformValidationPolling('replaced');
  activeSession = {
    ...(activeSession || {}),
    boundTaskId: taskId,
    boundAt: activeSession?.boundAt || new Date().toISOString(),
    currentUrl: getActivePageUrl() || activeSession?.currentUrl || '',
  };

  platformPoller = {
    taskId,
    apiBaseUrl,
    workspaceCode,
    runnerId,
    sessionId,
    currentUrl,
    locators: requestedLocators,
    intervalMs,
    headers,
    running: true,
    tickRunning: false,
    startedAt: new Date().toISOString(),
    lastTickAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastMessage: '本地自动验证已启动',
    validatedCount: 0,
    timer: null,
  };
  schedulePlatformPollTick(0);
  return getPlatformPollStatus();
}

function stopPlatformValidationPolling(reason = 'manual') {
  if (platformPoller?.timer) {
    clearTimeout(platformPoller.timer);
  }
  const previous = platformPoller ? sanitizePlatformPoller(platformPoller) : null;
  platformPoller = undefined;
  return {
    success: true,
    stopped: Boolean(previous),
    reason,
    poller: previous,
  };
}

function getPlatformPollStatus() {
  return {
    success: true,
    poller: platformPoller ? sanitizePlatformPoller(platformPoller) : null,
  };
}

function schedulePlatformPollTick(delayMs) {
  if (!platformPoller?.running) {
    return;
  }
  platformPoller.timer = setTimeout(() => {
    void runPlatformPollTick();
  }, delayMs);
}

async function runPlatformPollTick() {
  const poller = platformPoller;
  if (!poller?.running || poller.tickRunning) {
    return;
  }
  poller.tickRunning = true;
  poller.lastTickAt = new Date().toISOString();
  try {
    ensurePage();
    await ensureSessionFresh();
    poller.currentUrl = getActivePageUrl() || activeSession?.currentUrl || poller.currentUrl || '';
    const command = await fetchPlatformJson(poller, `/public/automation/web/element-collect-tasks/${encodeURIComponent(poller.taskId)}/local-validation-command`, {
      runnerId: poller.runnerId,
      sessionId: poller.sessionId || activeSession?.sessionId || null,
      currentUrl: poller.currentUrl || null,
      locators: poller.locators,
    });
    if (isTerminalCollectStatus(command.status)) {
      poller.lastSuccessAt = new Date().toISOString();
      poller.lastMessage = `任务已结束：${command.status}`;
      stopPlatformValidationPolling('task-terminal');
      return;
    }
    if (!command.runnable || !Array.isArray(command.locators) || command.locators.length === 0) {
      poller.lastMessage = command.reason || '平台暂未下发可验证定位器';
      schedulePlatformPollTick(poller.intervalMs);
      return;
    }
    const validation = await validateCurrentPageLocators({
      locators: command.locators,
    });
    const resultTask = await fetchPlatformJson(poller, `/public/automation/web/element-collect-tasks/${encodeURIComponent(poller.taskId)}/local-validation-results`, {
      runnerId: poller.runnerId,
      sessionId: poller.sessionId || activeSession?.sessionId || null,
      results: validation.results || [],
    });
    poller.validatedCount += validation.results?.length || 0;
    poller.lastSuccessAt = new Date().toISOString();
    poller.lastMessage = `已回传 ${validation.results?.length || 0} 个验证结果`;
    if (isTerminalCollectStatus(resultTask.status)) {
      stopPlatformValidationPolling('validation-complete');
      return;
    }
    schedulePlatformPollTick(poller.intervalMs);
  } catch (error) {
    if (platformPoller === poller) {
      poller.lastError = error instanceof Error ? error.message : String(error);
      poller.lastMessage = poller.lastError;
      schedulePlatformPollTick(poller.intervalMs);
    }
  } finally {
    if (platformPoller === poller) {
      poller.tickRunning = false;
    }
  }
}

async function getPageInfo(targetPage) {
  const info = await targetPage.evaluate(() => {
    const visibleText = document.body?.innerText || '';
    return {
      title: document.title,
      visibleText: visibleText.slice(0, 2000),
      hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
    };
  });

  return {
    url: targetPage.url(),
    title: info.title,
    isProbablyLoginPage: isProbablyLoginPage({
      url: targetPage.url(),
      title: info.title,
      visibleText: info.visibleText,
      hasPasswordInput: info.hasPasswordInput,
    }),
  };
}

function installBrowserRecorderScript() {
  if (window.__autoWebRunnerRecorderInstalled) {
    return;
  }
  window.__autoWebRunnerRecorderInstalled = true;
  const assertTargetMarkerAttr = 'data-auto-web-runner-assert-target';
  const assertTargetStyleAttr = 'data-auto-web-runner-assert-target-style';
  const assertTargetTimerKey = '__autoWebRunnerAssertTargetTimer';
  let lastRecordableElement = null;
  const observedFileInputValues = new WeakMap();
  let pendingFileInputSelection = null;
  let pendingFileInputTimer = 0;

  function isElementLike(value) {
    return Boolean(
      value
      && typeof value === 'object'
      && typeof value.tagName === 'string'
      && typeof value.matches === 'function'
      && typeof value.closest === 'function'
    );
  }

  document.addEventListener('click', event => {
    const target = findRecordableTarget(event);
    if (!target || isTextEntryElement(target) || target.tagName.toLowerCase() === 'select') {
      return;
    }
    if (isFileInputElement(target)) {
      rememberPendingFileInputSelection(target);
    }
    sendRecordedEvent('CLICK', event, target);
  }, true);

  document.addEventListener('dblclick', event => {
    const target = findRecordableTarget(event);
    if (!target || isTextEntryElement(target) || target.tagName.toLowerCase() === 'select') {
      return;
    }
    sendRecordedEvent('DOUBLE_CLICK', event, target);
  }, true);

  document.addEventListener('contextmenu', event => {
    const target = findRecordableTarget(event);
    if (!target || isTextEntryElement(target) || target.tagName.toLowerCase() === 'select') {
      return;
    }
    sendRecordedEvent('RIGHT_CLICK', event, target);
  }, true);

  document.addEventListener('input', event => {
    const target = findRecordableTarget(event);
    if (!target || !isTextEntryElement(target)) {
      return;
    }
    sendRecordedEvent('FILL', event, target, {
      inputValue: readElementValue(target),
    });
  }, true);

  document.addEventListener('change', event => {
    const target = findRecordableTarget(event);
    if (!target) {
      return;
    }
    if (isFileInputElement(target)) {
      rememberObservedFileInputValue(target);
      clearPendingFileInputSelection();
      void sendRecordedFileUploadEvent(event, target);
      return;
    }
    if (target.tagName.toLowerCase() === 'select') {
      sendRecordedEvent('SELECT', event, target, {
        inputValue: readElementValue(target),
      });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.repeat || !['Enter', 'Escape', 'Tab'].includes(event.key)) {
      return;
    }
    const target = findRecordableTarget(event);
    sendRecordedEvent('PRESS_KEY', event, target, {
      key: event.key,
      inputValue: event.key,
    });
  }, true);

  document.addEventListener('mouseover', event => {
    const target = findRecordableTarget(event);
    if (!target || !isHoverRecordableElement(target)) {
      return;
    }
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
      return;
    }
    sendRecordedEvent('HOVER', event, target);
  }, true);
  window.addEventListener('focus', () => {
    schedulePendingFileInputSelectionFlush();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      schedulePendingFileInputSelectionFlush();
    }
  }, true);

  function sendRecordedEvent(kind, event, target, extra = {}) {
    const binding = window.__autoWebRunnerRecordEvent;
    if (typeof binding !== 'function') {
      return;
    }
    const element = target || findRecordableTarget(event);
    if (element) {
      lastRecordableElement = element;
    }
    const shadowPath = element ? safeBuildShadowPathFromEvent(event) : [];
    binding({
      kind,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      title: document.title,
      target: element ? buildRecordTarget(element, shadowPath) : null,
      ...extra,
    }).catch(() => {});
  }

  window.__autoWebRunnerBuildAssertionEvent = (assertionType) => {
    const kind = String(assertionType || '').toUpperCase();
    if (kind === 'ASSERT_URL') {
      return {
        kind,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        inputValue: buildAssertionUrlValue(),
      };
    }
    const element = resolveAssertionTarget();
    if (!element) {
      throw new Error('当前没有可用于断言的页面元素');
    }
    const target = buildRecordTarget(element);
    if (!target?.locator) {
      throw new Error('当前元素没有可用定位器');
    }
    if (kind === 'ASSERT_TEXT') {
      const expectedValue = readAssertionText(element);
      if (!expectedValue) {
        throw new Error('当前元素没有可用断言文本');
      }
      return {
        kind,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        target,
        inputValue: expectedValue,
      };
    }
    if (kind === 'ASSERT_VISIBLE') {
      return {
        kind,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        target,
      };
    }
    throw new Error(`unsupported assertion type: ${kind || 'unknown'}`);
  };
  window.__autoWebRunnerDescribeAssertionTarget = () => {
    const element = resolveAssertionTarget();
    if (!element) {
      return {
        canAssert: false,
        label: '',
        locatorValue: '',
        assertionText: '',
      };
    }
    const target = buildRecordTarget(element);
    return {
      canAssert: Boolean(target?.locator),
      label: buildAssertionTargetLabel(target),
      locatorValue: target?.locator?.value || '',
      assertionText: readAssertionText(element),
    };
  };
  window.__autoWebRunnerHighlightAssertionTarget = () => {
    const element = resolveAssertionTarget();
    if (!element) {
      return false;
    }
    highlightAssertionTarget(element);
    return true;
  };

  function findRecordableTarget(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.some(isRunnerOverlayElement)) {
      return null;
    }
    for (const item of path) {
      if (isElementLike(item) && isRecordableElement(item)) {
        return item;
      }
    }
    const raw = isElementLike(event.target) ? event.target : event.target?.parentElement;
    return raw?.closest?.([
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[role]',
      '[data-testid]',
      '[data-test]',
      '[data-qa]',
      '[contenteditable="true"]',
    ].join(',')) || null;
  }

  function isRecordableElement(element) {
    if (isRunnerOverlayElement(element)) {
      return false;
    }
    return Boolean(element?.matches?.([
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[role]',
      '[data-testid]',
      '[data-test]',
      '[data-qa]',
      '[contenteditable="true"]',
    ].join(',')));
  }

  function isTextEntryElement(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea' || element.isContentEditable) {
      return true;
    }
    if (tagName !== 'input') {
      return false;
    }
    const type = String(element.getAttribute('type') || 'text').toLowerCase();
    return [
      'text',
      'search',
      'email',
      'password',
      'number',
      'tel',
      'url',
      'date',
      'datetime-local',
      'month',
      'time',
      'week',
    ].includes(type);
  }

  function isFileInputElement(element) {
    return element instanceof HTMLInputElement && String(element.getAttribute('type') || '').toLowerCase() === 'file';
  }

  function rememberPendingFileInputSelection(element) {
    rememberObservedFileInputValue(element);
    pendingFileInputSelection = {
      element,
      value: readElementValue(element),
    };
    window.clearTimeout(pendingFileInputTimer);
  }

  function rememberObservedFileInputValue(element) {
    if (!isFileInputElement(element)) {
      return;
    }
    observedFileInputValues.set(element, readElementValue(element));
  }

  function clearPendingFileInputSelection() {
    pendingFileInputSelection = null;
    window.clearTimeout(pendingFileInputTimer);
    pendingFileInputTimer = 0;
  }

  function schedulePendingFileInputSelectionFlush() {
    window.clearTimeout(pendingFileInputTimer);
    pendingFileInputTimer = window.setTimeout(() => {
      flushPendingFileInputSelection();
    }, 80);
  }

  function flushPendingFileInputSelection() {
    pendingFileInputTimer = 0;
    const pending = pendingFileInputSelection;
    const candidates = pending?.element
      ? [pending.element]
      : Array.from(document.querySelectorAll('input[type="file"]'));
    for (const element of candidates) {
      if (!isFileInputElement(element) || !document.contains(element)) {
        continue;
      }
      const previousValue = pending?.element === element
        ? pending.value
        : (observedFileInputValues.get(element) || '');
      const nextValue = readElementValue(element);
      observedFileInputValues.set(element, nextValue);
      if (!nextValue || nextValue === previousValue) {
        continue;
      }
      clearPendingFileInputSelection();
      void sendRecordedFileUploadEvent({ target: element }, element, nextValue);
      return;
    }
    clearPendingFileInputSelection();
  }

  async function sendRecordedFileUploadEvent(event, target, inputValue = readElementValue(target)) {
    const uploadArtifact = await readFileUploadArtifact(target);
    sendRecordedEvent('FILE_UPLOAD', event, target, {
      inputValue,
      ...(uploadArtifact ? { uploadArtifact } : {}),
    });
  }

  function readFileUploadArtifact(element) {
    return new Promise((resolve) => {
      if (!isFileInputElement(element)) {
        resolve(null);
        return;
      }
      const files = Array.from(element.files || []);
      const file = files[0];
      if (!file) {
        resolve(null);
        return;
      }
      const maxSizeBytes = 2 * 1024 * 1024;
      const baseArtifact = {
        fileName: file.name || readElementValue(element),
        contentType: file.type || 'application/octet-stream',
        size: typeof file.size === 'number' ? file.size : null,
      };
      if (files.length > 1) {
        resolve({
          ...baseArtifact,
          captureStatus: 'UNSUPPORTED_MULTIPLE',
          fileCount: files.length,
        });
        return;
      }
      if (typeof file.size === 'number' && file.size > maxSizeBytes) {
        resolve({
          ...baseArtifact,
          captureStatus: 'TOO_LARGE',
          limitBytes: maxSizeBytes,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIndex = result.indexOf(',');
        const contentBase64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
        if (!contentBase64) {
          resolve({
            ...baseArtifact,
            captureStatus: 'EMPTY_CONTENT',
          });
          return;
        }
        resolve({
          ...baseArtifact,
          contentBase64,
          captureStatus: 'READY',
        });
      };
      reader.onerror = () => resolve({
        ...baseArtifact,
        captureStatus: 'READ_FAILED',
      });
      reader.readAsDataURL(file);
    });
  }

  function isHoverRecordableElement(element) {
    if (isTextEntryElement(element) || isFileInputElement(element)) {
      return false;
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'select') {
      return false;
    }
    return Boolean(element.matches?.([
      'a',
      'button',
      '[role]',
      '[data-testid]',
      '[data-test]',
      '[data-qa]',
    ].join(',')));
  }

  function isRunnerOverlayElement(element) {
    return isElementLike(element)
      && (
        element.getAttribute('data-auto-web-runner-overlay') === 'true'
        || element.getAttribute('data-auto-web-runner-overlay-host') === 'true'
      );
  }

  function resolveAssertionTarget() {
    if (lastRecordableElement instanceof Element && document.contains(lastRecordableElement) && isRecordableElement(lastRecordableElement)) {
      return lastRecordableElement;
    }
    if (document.activeElement instanceof Element && isRecordableElement(document.activeElement) && !isRunnerOverlayElement(document.activeElement)) {
      return document.activeElement;
    }
    return null;
  }

  function readElementValue(element) {
    if (isFileInputElement(element)) {
      return Array.from(element.files || []).map(file => file.name).filter(Boolean).join(', ');
    }
    if (element instanceof HTMLSelectElement) {
      return element.value || element.selectedOptions?.[0]?.textContent || '';
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value || '';
    }
    if (element?.isContentEditable) {
      return element.innerText || element.textContent || '';
    }
    return '';
  }

  function readAssertionText(element) {
    if (isTextEntryElement(element) || element instanceof HTMLSelectElement || isFileInputElement(element)) {
      return readElementValue(element).trim();
    }
    return normalizeText(element.innerText || element.textContent || '');
  }

  function buildAssertionUrlValue() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}` || window.location.href;
    }
    return window.location.href;
  }

  function buildAssertionTargetLabel(target) {
    return normalizeText(
      target?.label
      || target?.placeholder
      || target?.text
      || target?.testId
      || target?.locator?.value
      || '',
    );
  }

  function highlightAssertionTarget(element, durationMs = 1800) {
    document.querySelectorAll(`[${assertTargetMarkerAttr}="true"]`).forEach((item) => {
      const originalStyle = item.getAttribute(assertTargetStyleAttr);
      if (originalStyle && originalStyle !== '__AUTO_EMPTY__') {
        item.setAttribute('style', originalStyle);
      } else {
        item.removeAttribute('style');
      }
      item.removeAttribute(assertTargetMarkerAttr);
      item.removeAttribute(assertTargetStyleAttr);
    });
    window.clearTimeout(window[assertTargetTimerKey]);
    if (!(element instanceof Element) || !('style' in element)) {
      return;
    }
    const originalStyle = element.getAttribute('style');
    element.setAttribute(assertTargetMarkerAttr, 'true');
    element.setAttribute(assertTargetStyleAttr, originalStyle || '__AUTO_EMPTY__');
    element.style.outline = '3px solid #f59e0b';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 0 6px rgba(245, 158, 11, 0.18), 0 10px 26px rgba(245, 158, 11, 0.24)';
    element.style.transition = 'outline 0.16s ease, box-shadow 0.16s ease';
    window[assertTargetTimerKey] = window.setTimeout(() => {
      const savedStyle = element.getAttribute(assertTargetStyleAttr);
      if (savedStyle && savedStyle !== '__AUTO_EMPTY__') {
        element.setAttribute('style', savedStyle);
      } else {
        element.removeAttribute('style');
      }
      element.removeAttribute(assertTargetMarkerAttr);
      element.removeAttribute(assertTargetStyleAttr);
    }, durationMs);
  }

  function buildRecordTarget(element, preferredShadowPath = null) {
    const shadowPath = Array.isArray(preferredShadowPath) && preferredShadowPath.length > 0
      ? preferredShadowPath
      : safeBuildElementShadowPath(element);
    const locator = buildRecordLocator(element, shadowPath);
    return {
      tagName: element.tagName.toLowerCase(),
      elementType: inferElementType(element),
      text: normalizeText(element.innerText || element.textContent || ''),
      label: findLabelText(element),
      placeholder: element.getAttribute('placeholder') || '',
      role: element.getAttribute('role') || inferRole(element) || '',
      testId: element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-qa') || '',
      shadowPath,
      locator,
    };
  }

  function buildRecordLocator(element, shadowPath = []) {
    const context = shadowPath.length > 0 ? { shadowPath } : {};
    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-qa');
    if (testId) {
      return { strategy: 'TEST_ID', value: testId, ...context };
    }
    if (element.id) {
      return { strategy: 'CSS', value: `#${cssEscape(element.id)}`, ...context };
    }
    const role = element.getAttribute('role') || inferRole(element);
    const roleName = findAccessibleName(element);
    if (role && roleName) {
      return { strategy: 'ROLE', value: `${role}[name="${escapeLocatorName(roleName)}"]`, ...context };
    }
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return { strategy: 'PLACEHOLDER', value: placeholder, ...context };
    }
    const label = findLabelText(element);
    if (label) {
      return { strategy: 'LABEL', value: label, ...context };
    }
    const text = normalizeText(element.innerText || element.textContent || '');
    if (text && ['a', 'button'].includes(element.tagName.toLowerCase())) {
      return { strategy: 'TEXT', value: text, ...context };
    }
    return { strategy: 'CSS', value: buildCssPath(element), ...context };
  }

  function buildElementShadowPath(element) {
    const path = [];
    let current = element;
    while (isElementLike(current)) {
      const root = current.getRootNode?.();
      const host = root && typeof root === 'object' && 'host' in root ? root.host : null;
      if (!isElementLike(host)) {
        break;
      }
      const hostRoot = host.getRootNode?.();
      if (!hostRoot || typeof hostRoot.querySelectorAll !== 'function') {
        break;
      }
      path.unshift(buildShadowHostSelector(host, hostRoot));
      current = host;
    }
    return path;
  }

  function safeBuildElementShadowPath(element) {
    try {
      return buildElementShadowPath(element);
    } catch {
      return [];
    }
  }

  function buildShadowPathFromEvent(event) {
    const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
    const shadowPath = [];
    for (const item of path) {
      const host = item && typeof item === 'object' && 'host' in item ? item.host : null;
      if (!isElementLike(host)) {
        continue;
      }
      const hostRoot = host.getRootNode?.();
      if (!hostRoot || typeof hostRoot.querySelectorAll !== 'function') {
        continue;
      }
      const selector = buildShadowHostSelector(host, hostRoot);
      if (selector && !shadowPath.includes(selector)) {
        shadowPath.unshift(selector);
      }
    }
    return shadowPath;
  }

  function safeBuildShadowPathFromEvent(event) {
    try {
      return buildShadowPathFromEvent(event);
    } catch {
      return [];
    }
  }

  function inferElementType(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'a') return 'LINK';
    if (tagName === 'button') return 'BUTTON';
    if (tagName === 'select') return 'SELECT';
    if (tagName === 'textarea') return 'TEXTAREA';
    if (tagName === 'input') return String(element.getAttribute('type') || 'text').toUpperCase();
    return tagName.toUpperCase();
  }

  function inferRole(element) {
    const tagName = element.tagName.toLowerCase();
    const type = String(element.getAttribute('type') || '').toLowerCase();
    if (tagName === 'button') return 'button';
    if (tagName === 'a' && element.getAttribute('href')) return 'link';
    if (tagName === 'select') return 'combobox';
    if (tagName === 'textarea') return 'textbox';
    if (tagName === 'input' && type === 'checkbox') return 'checkbox';
    if (tagName === 'input' && type === 'radio') return 'radio';
    if (tagName === 'input') return 'textbox';
    return '';
  }

  function findAccessibleName(element) {
    return normalizeText([
      element.getAttribute('aria-label'),
      findLabelText(element),
      element.getAttribute('title'),
      element.getAttribute('alt'),
      element.innerText,
      element.textContent,
    ].find(Boolean) || '');
  }

  function findLabelText(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
      if (label?.textContent) {
        return normalizeText(label.textContent);
      }
    }
    const closestLabel = element.closest?.('label');
    if (closestLabel?.textContent) {
      return normalizeText(closestLabel.textContent);
    }
    return '';
  }

  function buildCssPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${cssEscape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function escapeLocatorName(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
}

function installBrowserRunnerOverlayScript() {
  if (window.top !== window) {
    return;
  }

  if (window.__autoWebRunnerOverlayInstalled) {
    if (typeof window.__autoWebRunnerOverlayMount === 'function') {
      window.__autoWebRunnerOverlayMount();
    }
    if (typeof window.__autoWebRunnerOverlayPollNow === 'function') {
      window.__autoWebRunnerOverlayPollNow();
    }
    return;
  }

  window.__autoWebRunnerOverlayInstalled = true;

  const hostAttr = 'data-auto-web-runner-overlay-host';
  const markerAttr = 'data-auto-web-runner-overlay';
  const bindingName = '__autoWebRunnerOverlayControl';
  const positionStorageKey = '__auto_web_runner_overlay_position';
  const state = {
    busyAction: '',
    collapsed: false,
    eventCount: 0,
    message: '',
    overlayLeft: null,
    overlayTop: null,
    status: 'IDLE',
    stepCount: 0,
    targetCanAssert: false,
    targetKey: '',
    targetLabel: '',
    targetLocator: '',
  };
  let host = null;
  let shadowRoot = null;
  let pollTimer = null;
  const dragState = {
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  function mountPanel() {
    if (!document.documentElement) {
      return;
    }
    host = document.querySelector(`[${hostAttr}="true"]`);
    if (!host) {
      host = document.createElement('div');
      host.setAttribute(hostAttr, 'true');
      host.setAttribute(markerAttr, 'true');
      document.documentElement.appendChild(host);
      shadowRoot = host.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `
        <style>
          :host { all: initial; }
          .panel {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2147483647;
            width: 240px;
            box-sizing: border-box;
            border: 1px solid rgba(15, 23, 42, 0.12);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.96);
            color: #0f172a;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
            font-family: "Segoe UI", Arial, sans-serif;
            backdrop-filter: blur(10px);
          }
          .panel * { box-sizing: border-box; }
          .panel[data-status="RECORDING"] .dot { background: #ef4444; }
          .panel[data-status="PAUSED"] .dot { background: #f59e0b; }
          .panel[data-status="STOPPED"] .dot { background: #64748b; }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px 8px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
            cursor: move;
            user-select: none;
          }
          .title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
          }
          .collapse {
            width: 28px;
            height: 28px;
            padding: 0;
            line-height: 1;
            cursor: pointer;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: #94a3b8;
            box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.18);
          }
          .meta {
            padding: 10px 12px 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .metric {
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 6px;
            padding: 8px;
            background: rgba(248, 250, 252, 0.92);
          }
          .metric span {
            display: block;
            font-size: 11px;
            color: #475569;
          }
          .metric strong {
            display: block;
            margin-top: 4px;
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
          }
          .actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            padding: 12px;
          }
          button {
            appearance: none;
            border: 1px solid rgba(148, 163, 184, 0.26);
            border-radius: 6px;
            background: #fff;
            color: #0f172a;
            padding: 7px 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }
          button[hidden] { display: none; }
          button:disabled {
            cursor: not-allowed;
            color: #94a3b8;
            background: rgba(248, 250, 252, 0.92);
          }
          .message {
            min-height: 18px;
            padding: 0 12px 12px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }
          .target {
            padding: 10px 12px 0;
          }
          .target span {
            display: block;
            font-size: 11px;
            color: #475569;
          }
          .target strong {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
            word-break: break-word;
          }
          .target small {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 11px;
            word-break: break-all;
          }
          .compact {
            display: none;
            padding: 0 12px 10px;
            color: #475569;
            font-size: 11px;
            line-height: 1.5;
          }
          .panel[data-collapsed="true"] {
            width: 180px;
          }
          .panel[data-collapsed="true"] .meta,
          .panel[data-collapsed="true"] .target,
          .panel[data-collapsed="true"] .actions,
          .panel[data-collapsed="true"] .message {
            display: none;
          }
          .panel[data-collapsed="true"] .compact {
            display: block;
          }
        </style>
        <div class="panel" data-status="IDLE" data-collapsed="false" data-auto-web-runner-overlay="true">
          <div class="header" data-auto-web-runner-overlay="true">
            <div class="title" data-auto-web-runner-overlay="true">
              <span class="dot" data-auto-web-runner-overlay="true"></span>
              <span data-role="status" data-auto-web-runner-overlay="true">未开始</span>
            </div>
            <button type="button" class="collapse" data-action="toggle-collapse" data-auto-web-runner-overlay="true" title="收起面板">-</button>
          </div>
          <div class="compact" data-role="compact" data-auto-web-runner-overlay="true">步骤 0</div>
          <div class="meta" data-auto-web-runner-overlay="true">
            <div class="metric" data-auto-web-runner-overlay="true">
              <span data-auto-web-runner-overlay="true">步骤</span>
              <strong data-role="steps" data-auto-web-runner-overlay="true">0</strong>
            </div>
            <div class="metric" data-auto-web-runner-overlay="true">
              <span data-auto-web-runner-overlay="true">事件</span>
              <strong data-role="events" data-auto-web-runner-overlay="true">0</strong>
            </div>
          </div>
          <div class="target" data-auto-web-runner-overlay="true">
            <span data-auto-web-runner-overlay="true">断言目标</span>
            <strong data-role="target" data-auto-web-runner-overlay="true">等待选择页面元素</strong>
            <small data-role="target-locator" data-auto-web-runner-overlay="true"></small>
          </div>
          <div class="actions" data-auto-web-runner-overlay="true">
            <button type="button" data-action="start" data-auto-web-runner-overlay="true">开始</button>
            <button type="button" data-action="pause" data-auto-web-runner-overlay="true" hidden>暂停</button>
            <button type="button" data-action="resume" data-auto-web-runner-overlay="true" hidden>继续</button>
            <button type="button" data-action="undo" data-auto-web-runner-overlay="true">撤销</button>
            <button type="button" data-action="stop" data-auto-web-runner-overlay="true">停止</button>
            <button type="button" data-action="reset-position" data-auto-web-runner-overlay="true">复位</button>
            <button type="button" data-action="assert-visible" data-auto-web-runner-overlay="true">可见断言</button>
            <button type="button" data-action="assert-text" data-auto-web-runner-overlay="true">文本断言</button>
            <button type="button" data-action="assert-url" data-auto-web-runner-overlay="true">URL 断言</button>
          </div>
          <div class="message" data-role="message" data-auto-web-runner-overlay="true"></div>
        </div>
      `;
      applyOverlayPosition();
      bindPanelEvents();
    } else {
      shadowRoot = host.shadowRoot;
      applyOverlayPosition();
    }
  }

  function bindPanelEvents() {
    if (!shadowRoot) {
      return;
    }
    shadowRoot.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = button.getAttribute('data-action') || '';
        void runAction(action);
      });
    });
    const header = shadowRoot.querySelector('.header');
    header?.addEventListener('pointerdown', startPanelDrag);
  }

  function loadOverlayPosition() {
    const saved = window.__autoWebRunnerOverlayPosition;
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      return saved;
    }
    try {
      const raw = window.localStorage?.getItem(positionStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed?.left) && Number.isFinite(parsed?.top)) {
        window.__autoWebRunnerOverlayPosition = parsed;
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  function saveOverlayPosition(position) {
    window.__autoWebRunnerOverlayPosition = position;
    try {
      window.localStorage?.setItem(positionStorageKey, JSON.stringify(position));
    } catch {
      // Some pages, such as data: URLs, do not allow localStorage access.
    }
  }

  function resetOverlayPosition() {
    state.overlayLeft = null;
    state.overlayTop = null;
    window.__autoWebRunnerOverlayPosition = null;
    try {
      window.localStorage?.removeItem(positionStorageKey);
    } catch {
      // Some pages, such as data: URLs, do not allow localStorage access.
    }
    applyOverlayPosition();
  }

  function clampOverlayPosition(left, top, panel) {
    const rect = panel.getBoundingClientRect();
    const width = rect.width || 240;
    const height = rect.height || 120;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop),
    };
  }

  function applyOverlayPosition() {
    if (!shadowRoot) {
      return;
    }
    const panel = shadowRoot.querySelector('.panel');
    if (!panel) {
      return;
    }
    if (!Number.isFinite(state.overlayLeft) || !Number.isFinite(state.overlayTop)) {
      const saved = loadOverlayPosition();
      if (saved) {
        state.overlayLeft = saved.left;
        state.overlayTop = saved.top;
      }
    }
    if (!Number.isFinite(state.overlayLeft) || !Number.isFinite(state.overlayTop)) {
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '16px';
      panel.removeAttribute('data-positioned');
      return;
    }
    const next = clampOverlayPosition(state.overlayLeft, state.overlayTop, panel);
    state.overlayLeft = next.left;
    state.overlayTop = next.top;
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = 'auto';
    panel.setAttribute('data-positioned', 'true');
  }

  function startPanelDrag(event) {
    if (event.button !== 0 || event.target?.closest?.('button')) {
      return;
    }
    const panel = shadowRoot?.querySelector('.panel');
    if (!panel) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    dragState.active = true;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.startLeft = rect.left;
    dragState.startTop = rect.top;
    event.preventDefault();
    event.stopPropagation();
    document.addEventListener('pointermove', movePanelDrag, true);
    document.addEventListener('pointerup', stopPanelDrag, true);
    document.addEventListener('pointercancel', stopPanelDrag, true);
  }

  function movePanelDrag(event) {
    if (!dragState.active) {
      return;
    }
    const panel = shadowRoot?.querySelector('.panel');
    if (!panel) {
      return;
    }
    const next = clampOverlayPosition(
      dragState.startLeft + event.clientX - dragState.startX,
      dragState.startTop + event.clientY - dragState.startY,
      panel,
    );
    state.overlayLeft = next.left;
    state.overlayTop = next.top;
    applyOverlayPosition();
    event.preventDefault();
    event.stopPropagation();
  }

  function stopPanelDrag(event) {
    if (!dragState.active) {
      return;
    }
    dragState.active = false;
    document.removeEventListener('pointermove', movePanelDrag, true);
    document.removeEventListener('pointerup', stopPanelDrag, true);
    document.removeEventListener('pointercancel', stopPanelDrag, true);
    if (Number.isFinite(state.overlayLeft) && Number.isFinite(state.overlayTop)) {
      saveOverlayPosition({ left: state.overlayLeft, top: state.overlayTop });
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  function normalizeStatus(recording) {
    const status = String(recording?.status || '').toUpperCase();
    if (status === 'RECORDING' || status === 'PAUSED' || status === 'STOPPED') {
      return status;
    }
    return recording?.active ? 'RECORDING' : 'IDLE';
  }

  function statusLabel(status) {
    if (status === 'RECORDING') return '录制中';
    if (status === 'PAUSED') return '已暂停';
    if (status === 'STOPPED') return '已停止';
    return '未开始';
  }

  function applyResult(result, message = '') {
    const recording = result?.recording || {};
    state.status = normalizeStatus(recording);
    state.stepCount = Number(recording?.stepCount ?? result?.steps?.length ?? 0);
    state.eventCount = Number(recording?.eventCount || 0);
    state.message = message;
    refreshTargetPreview({ highlight: state.status === 'RECORDING' });
    renderPanel();
    schedulePoll(state.status === 'RECORDING' || state.status === 'PAUSED' ? 800 : 1800);
  }

  function renderPanel() {
    mountPanel();
    if (!shadowRoot) {
      return;
    }
    const panel = shadowRoot.querySelector('.panel');
    const statusNode = shadowRoot.querySelector('[data-role="status"]');
    const stepsNode = shadowRoot.querySelector('[data-role="steps"]');
    const eventsNode = shadowRoot.querySelector('[data-role="events"]');
    const messageNode = shadowRoot.querySelector('[data-role="message"]');
    const compactNode = shadowRoot.querySelector('[data-role="compact"]');
    const targetNode = shadowRoot.querySelector('[data-role="target"]');
    const targetLocatorNode = shadowRoot.querySelector('[data-role="target-locator"]');
    const toggleCollapseButton = shadowRoot.querySelector('[data-action="toggle-collapse"]');
    const startButton = shadowRoot.querySelector('[data-action="start"]');
    const pauseButton = shadowRoot.querySelector('[data-action="pause"]');
    const resumeButton = shadowRoot.querySelector('[data-action="resume"]');
    const undoButton = shadowRoot.querySelector('[data-action="undo"]');
    const stopButton = shadowRoot.querySelector('[data-action="stop"]');
    const resetPositionButton = shadowRoot.querySelector('[data-action="reset-position"]');
    const assertVisibleButton = shadowRoot.querySelector('[data-action="assert-visible"]');
    const assertTextButton = shadowRoot.querySelector('[data-action="assert-text"]');
    const assertUrlButton = shadowRoot.querySelector('[data-action="assert-url"]');
    if (
      !panel || !statusNode || !stepsNode || !eventsNode || !messageNode || !compactNode
      || !targetNode || !targetLocatorNode || !toggleCollapseButton
      || !startButton || !pauseButton || !resumeButton || !undoButton || !stopButton || !resetPositionButton
      || !assertVisibleButton || !assertTextButton || !assertUrlButton
    ) {
      return;
    }
    panel.setAttribute('data-status', state.status);
    panel.setAttribute('data-collapsed', state.collapsed ? 'true' : 'false');
    applyOverlayPosition();
    statusNode.textContent = statusLabel(state.status);
    stepsNode.textContent = String(state.stepCount);
    eventsNode.textContent = String(state.eventCount);
    compactNode.textContent = `步骤 ${state.stepCount} · 事件 ${state.eventCount}`;
    targetNode.textContent = state.targetLabel || 'Pick a page element';
    targetLocatorNode.textContent = state.targetLocator || (state.status === 'RECORDING' ? 'Click, input, or hover a recordable element first' : '');
    messageNode.textContent = state.message || 'Control recording directly in the page';
    toggleCollapseButton.textContent = state.collapsed ? '+' : '-';
    toggleCollapseButton.setAttribute('title', state.collapsed ? '展开面板' : '收起面板');
    startButton.hidden = state.status === 'RECORDING' || state.status === 'PAUSED';
    pauseButton.hidden = state.status !== 'RECORDING';
    resumeButton.hidden = state.status !== 'PAUSED';
    startButton.disabled = Boolean(state.busyAction) || state.status === 'RECORDING' || state.status === 'PAUSED';
    pauseButton.disabled = Boolean(state.busyAction) || state.status !== 'RECORDING';
    resumeButton.disabled = Boolean(state.busyAction) || state.status !== 'PAUSED';
    undoButton.disabled = Boolean(state.busyAction) || !['RECORDING', 'PAUSED'].includes(state.status) || state.stepCount <= 0;
    stopButton.disabled = Boolean(state.busyAction) || !['RECORDING', 'PAUSED'].includes(state.status);
    resetPositionButton.disabled = Boolean(state.busyAction);
    assertVisibleButton.disabled = Boolean(state.busyAction) || state.status !== 'RECORDING' || !state.targetCanAssert;
    assertTextButton.disabled = Boolean(state.busyAction) || state.status !== 'RECORDING' || !state.targetCanAssert;
    assertUrlButton.disabled = Boolean(state.busyAction) || state.status !== 'RECORDING';
  }

  function refreshTargetPreview(options = {}) {
    const preview = window.__autoWebRunnerDescribeAssertionTarget?.() || null;
    const nextKey = preview?.canAssert ? `${preview.locatorValue || ''}::${preview.label || ''}` : '';
    const shouldHighlight = options.highlight && preview?.canAssert && nextKey && nextKey !== state.targetKey;
    state.targetCanAssert = Boolean(preview?.canAssert);
    state.targetKey = nextKey;
    state.targetLabel = preview?.label || '';
    state.targetLocator = preview?.locatorValue || '';
    if (shouldHighlight) {
      window.__autoWebRunnerHighlightAssertionTarget?.();
    }
  }

  function buildOverlayActionPayload(action) {
    if (action === 'assert-visible') {
      window.__autoWebRunnerHighlightAssertionTarget?.();
      return {
        action,
        event: window.__autoWebRunnerBuildAssertionEvent?.('ASSERT_VISIBLE'),
      };
    }
    if (action === 'assert-text') {
      window.__autoWebRunnerHighlightAssertionTarget?.();
      return {
        action,
        event: window.__autoWebRunnerBuildAssertionEvent?.('ASSERT_TEXT'),
      };
    }
    if (action === 'assert-url') {
      return {
        action,
        event: window.__autoWebRunnerBuildAssertionEvent?.('ASSERT_URL'),
      };
    }
    return { action };
  }

  async function callOverlayBinding(action) {
    const binding = window[bindingName];
    if (typeof binding !== 'function') {
      throw new Error('overlay control binding unavailable');
    }
    return binding(buildOverlayActionPayload(action));
  }

  async function runAction(action) {
    if (!action) {
      return;
    }
    if (action === 'toggle-collapse') {
      state.collapsed = !state.collapsed;
      renderPanel();
      return;
    }
    if (action === 'reset-position') {
      resetOverlayPosition();
      state.message = '面板位置已重置';
      renderPanel();
      return;
    }
    state.busyAction = action;
    state.message = '同步中...';
    renderPanel();
    try {
      const result = await callOverlayBinding(action);
      const actionMessages = {
        start: '录制已开始',
        pause: '录制已暂停',
        resume: '录制已继续',
        undo: result?.undone ? '已撤销上一步' : '当前没有可撤销步骤',
        stop: '录制已停止',
        'assert-visible': '已添加可见断言',
        'assert-text': '已添加文本断言',
        'assert-url': '已添加 URL 断言',
      };
      applyResult(result, actionMessages[action] || '已同步状态');
    } catch (error) {
      state.message = error instanceof Error ? error.message : String(error);
      renderPanel();
      schedulePoll(1500);
    } finally {
      state.busyAction = '';
      renderPanel();
    }
  }

  function schedulePoll(delayMs) {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(() => {
      void pollStatus();
    }, delayMs);
  }

  async function pollStatus() {
    try {
      const result = await callOverlayBinding('status');
      applyResult(result);
    } catch (error) {
      state.message = error instanceof Error ? error.message : String(error);
      renderPanel();
      schedulePoll(1800);
    }
  }

  window.__autoWebRunnerOverlayMount = mountPanel;
  window.__autoWebRunnerOverlayPollNow = () => {
    void pollStatus();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountPanel, { once: true });
  } else {
    mountPanel();
  }
  document.addEventListener('click', handleTargetActivity, true);
  document.addEventListener('input', handleTargetActivity, true);
  document.addEventListener('mouseover', handleTargetActivity, true);
  document.addEventListener('focusin', handleTargetActivity, true);
  schedulePoll(120);

  function handleTargetActivity(event) {
    if (!['RECORDING', 'PAUSED'].includes(state.status) || isOverlayInteraction(event)) {
      return;
    }
    window.setTimeout(() => {
      refreshTargetPreview({ highlight: state.status === 'RECORDING' });
      renderPanel();
    }, 0);
  }

  function isOverlayInteraction(event) {
    const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
    return path.some(item => item instanceof Element && (
      item.getAttribute('data-auto-web-runner-overlay') === 'true'
      || item.getAttribute('data-auto-web-runner-overlay-host') === 'true'
    ));
  }
}

function collectElementsInPage(context = {}) {
  const selector = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    '[role]',
    '[data-testid]',
    '[data-test]',
    '[aria-label]',
  ].join(',');
  const baseFramePath = Array.isArray(context.framePath) ? context.framePath : [];
  const baseShadowPath = Array.isArray(context.shadowPath) ? context.shadowPath : [];
  const elements = [];

  collectFromRoot(document, baseShadowPath);
  return elements.slice(0, 500);

  function collectFromRoot(root, shadowPath) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      elements.push(buildElementInfo(element, shadowPath));
    }
    for (const host of Array.from(root.querySelectorAll('*'))) {
      if (host.shadowRoot) {
        collectFromRoot(host.shadowRoot, [...shadowPath, buildShadowHostSelector(host, root)]);
      }
    }
  }

  function buildElementInfo(element, shadowPath) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const label = findLabelText(element);
    const region = inferRegion(element);
    return {
      tagName: element.tagName,
      type: element.getAttribute('type') || '',
      visible: rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none',
      text: element.innerText || element.textContent || '',
      placeholder: element.getAttribute('placeholder') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      name: element.getAttribute('name') || '',
      id: element.id || '',
      testId: element.getAttribute('data-testid') || element.getAttribute('data-test') || '',
      href: element.getAttribute('href') || '',
      role: element.getAttribute('role') || '',
      label,
      regionName: region.name,
      regionType: region.type,
      cssPath: buildCssPath(element),
      xpath: buildXPath(element),
      framePath: baseFramePath,
      shadowPath,
    };
  }

  function findLabelText(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label?.textContent) {
        return label.textContent;
      }
    }
    const wrapperLabel = element.closest('label');
    if (wrapperLabel?.textContent) {
      return wrapperLabel.textContent;
    }
    return '';
  }

  function inferRegion(element) {
    const container = element.closest([
      'dialog',
      '[role="dialog"]',
      '.el-dialog',
      '.el-drawer',
      'form',
      'table',
      '.el-table',
      'header',
      'nav',
      'aside',
      'footer',
      'main',
      'section',
    ].join(','));
    if (!container) {
      return { name: inferRegionByElement(element), type: 'element' };
    }

    const tagName = container.tagName.toLowerCase();
    const role = (container.getAttribute('role') || '').toLowerCase();
    const className = String(container.className || '').toLowerCase();
    const heading = findRegionHeading(container);

    if (tagName === 'dialog' || role === 'dialog' || className.includes('dialog') || className.includes('drawer')) {
      return { name: heading ? `${heading}弹窗区` : '弹窗抽屉区', type: 'dialog' };
    }
    if (tagName === 'form' || role === 'search' || /search|filter|query|筛选|查询/.test(className)) {
      return { name: heading ? `${heading}表单区` : '查询筛选区', type: 'form' };
    }
    if (tagName === 'table' || className.includes('table')) {
      return { name: heading ? `${heading}表格区` : '表格列表区', type: 'table' };
    }
    if (tagName === 'header' || tagName === 'nav') {
      return { name: '顶部导航区', type: 'nav' };
    }
    if (tagName === 'aside') {
      return { name: '侧边菜单区', type: 'aside' };
    }
    if (tagName === 'footer') {
      return { name: '底部操作区', type: 'footer' };
    }
    return { name: heading ? `${heading}区域` : inferRegionByElement(element), type: tagName || 'section' };
  }

  function findRegionHeading(container) {
    const heading = container.querySelector?.('h1,h2,h3,h4,.el-dialog__title,.modal-title,.title,[data-title]');
    return normalizeRegionText(heading?.textContent || heading?.getAttribute?.('data-title') || '');
  }

  function inferRegionByElement(element) {
    const text = normalizeRegionText([
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.innerText,
      element.textContent,
    ].filter(Boolean).join(' '));
    if (/查询|搜索|筛选|重置/.test(text)) {
      return '查询筛选区';
    }
    if (/提交|保存|确定|取消|关闭|删除|新增|添加|编辑/.test(text)) {
      return '按钮操作区';
    }
    const tagName = element.tagName.toLowerCase();
    const type = String(element.getAttribute('type') || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || type === 'text') {
      return '表单输入区';
    }
    if (tagName === 'a') {
      return '链接导航区';
    }
    return '未分类';
  }

  function normalizeRegionText(value) {
    return String(value || '').replace(/\s+/g, '').slice(0, 16);
  }

  function buildCssPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  function buildShadowHostSelector(element, root) {
    const tag = element.tagName.toLowerCase();
    if (element.id) {
      return `${tag}#${CSS.escape(element.id)}`;
    }
    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test');
    if (testId) {
      return `${tag}[data-testid="${cssAttributeEscape(testId)}"]`;
    }
    const name = element.getAttribute('name');
    if (name) {
      return `${tag}[name="${cssAttributeEscape(name)}"]`;
    }
    const sameTagCount = root.querySelectorAll(tag).length;
    return sameTagCount === 1 ? tag : buildCssPath(element);
  }

  function buildXPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`*[@id="${current.id.replaceAll('"', '\\"')}"]`);
        return `//${parts.join('/')}`;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}[${index}]`);
      current = parent;
    }
    return `/${parts.join('/')}`;
  }

  function cssAttributeEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

async function loadPlaywright() {
  if (playwrightModule) {
    return {
      available: true,
      module: playwrightModule,
      error: '',
    };
  }

  try {
    playwrightModule = await import('playwright');
    return {
      available: true,
      module: playwrightModule,
      error: '',
    };
  } catch (error) {
    return {
      available: false,
      module: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensurePlaywright() {
  const playwright = await loadPlaywright();
  if (!playwright.available) {
    throw new Error(`Playwright is not installed. Run: npm install -D playwright && npx playwright install chromium. ${playwright.error}`);
  }
  return playwright.module;
}

function ensureContext() {
  clearClosedSession();
  if (!context) {
    throw new Error('No active browser context. Please click "打开目标页" or run /collect/open first.');
  }
}

function ensurePage() {
  clearClosedSession();
  if (!hasUsablePage()) {
    throw new Error('No active browser page. Please click "打开目标页" or run /collect/open before capture.');
  }
}

async function ensureSessionFresh() {
  if (!activeSession || !isSessionExpired(activeSession)) {
    return;
  }
  const expiredAt = activeSession.expiresAt || '';
  await releaseCurrentSession('expired');
  throw new Error(`Local Runner page session has expired${expiredAt ? ` at ${expiredAt}` : ''}. Please open the target page again.`);
}

function getStorageStatePath(workspaceId, environmentId) {
  return join(AUTH_DIR, `${safeName(workspaceId)}__${safeName(environmentId)}.json`);
}

async function fetchPlatformJson(poller, path, body) {
  const response = await fetch(`${poller.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...poller.headers,
      'Content-Type': 'application/json',
      'X-Workspace-Code': poller.workspaceCode,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `HTTP ${response.status}`;
    throw new Error(`平台接口请求失败：${message}`);
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function normalizeApiBaseUrl(value) {
  const url = optionalString(value);
  if (!url) {
    return '';
  }
  return url.replace(/\/+$/, '');
}

function normalizePlatformHeaders(payload) {
  const headers = {};
  const cookie = optionalString(payload.cookie);
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (payload.headers && typeof payload.headers === 'object') {
    for (const [key, value] of Object.entries(payload.headers)) {
      const normalizedKey = optionalString(key);
      const normalizedValue = optionalString(value);
      if (!normalizedKey || !normalizedValue) {
        continue;
      }
      if (/^(host|connection|content-length)$/i.test(normalizedKey)) {
        continue;
      }
      headers[normalizedKey] = normalizedValue;
    }
  }
  return headers;
}

function sanitizePlatformPoller(poller) {
  return {
    taskId: poller.taskId,
    apiBaseUrl: poller.apiBaseUrl,
    workspaceCode: poller.workspaceCode,
    runnerId: poller.runnerId,
    sessionId: poller.sessionId || null,
    currentUrl: poller.currentUrl || null,
    running: Boolean(poller.running),
    tickRunning: Boolean(poller.tickRunning),
    startedAt: poller.startedAt,
    lastTickAt: poller.lastTickAt,
    lastSuccessAt: poller.lastSuccessAt,
    lastError: poller.lastError,
    lastMessage: poller.lastMessage,
    validatedCount: poller.validatedCount || 0,
    locatorCount: Array.isArray(poller.locators) ? poller.locators.length : 0,
  };
}

function isTerminalCollectStatus(status) {
  return ['COMPLETED', 'FAILED', 'DEGRADED', 'CANCELED'].includes(optionalString(status).toUpperCase());
}

function humanizeRunnerError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.trim() || '本地 Runner 执行失败';
  if (/page\.goto/i.test(message) && /Protocol error/i.test(message)) {
    return `目标页面打开失败：浏览器导航协议异常。请检查 URL 是否可访问、协议是否正确，原始错误：${message}`;
  }
  if (/net::ERR_NAME_NOT_RESOLVED/i.test(message)) {
    return `目标页面打开失败：域名无法解析。请检查本机网络、DNS 或目标环境配置，原始错误：${message}`;
  }
  if (/net::ERR_CONNECTION_REFUSED/i.test(message)) {
    return `目标页面打开失败：连接被拒绝。请确认目标服务已启动且本机可访问，原始错误：${message}`;
  }
  if (/Timeout/i.test(message)) {
    return `本地执行超时：页面加载或步骤等待超过限制。请检查页面响应速度、登录状态和定位器，原始错误：${message}`;
  }
  return message;
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeName(value) {
  return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function handleCors(request, response) {
  const origin = request.headers.origin || '';
  if (isAllowedRunnerOrigin(origin, allowedOrigins)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Web-Ui-Runner-Token');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return true;
  }

  return false;
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

function requireString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function hasUsablePage() {
  return Boolean(page && !page.isClosed());
}

function getActivePageUrl() {
  return hasUsablePage() ? page.url() : '';
}

function buildSessionExpiresAt() {
  return new Date(Date.now() + sessionTtlMinutes * 60_000).toISOString();
}

function buildSessionView() {
  if (!activeSession) {
    return null;
  }
  const now = Date.now();
  const expiresAt = activeSession.expiresAt || null;
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const remainingMs = Number.isNaN(expiresAtMs) ? null : Math.max(0, expiresAtMs - now);
  return {
    ...activeSession,
    currentUrl: getActivePageUrl() || activeSession.currentUrl || '',
    pageAlive: hasUsablePage(),
    pageTitle: activeSession.pageTitle || '',
    lastActiveAt: new Date().toISOString(),
    expiresAt,
    ttlMinutes: sessionTtlMinutes,
    remainingSeconds: typeof remainingMs === 'number' ? Math.ceil(remainingMs / 1000) : null,
    expired: isSessionExpired(activeSession),
  };
}

function isSessionExpired(session) {
  if (!session?.expiresAt) {
    return false;
  }
  const expiresAtMs = Date.parse(session.expiresAt);
  return !Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs;
}

function clearClosedSession() {
  if (page && page.isClosed()) {
    page = undefined;
  }
  if (!page) {
    activeSession = undefined;
  }
}

async function refreshActiveSessionPageSnapshot() {
  if (!activeSession || !hasUsablePage()) {
    return;
  }
  const session = activeSession;
  const targetPage = page;
  session.currentUrl = targetPage.url?.() || session.currentUrl || '';
  const title = await targetPage.title().catch(() => session.pageTitle || '');
  if (activeSession === session && page === targetPage) {
    session.pageTitle = title;
  }
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeTaskId(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
  return text;
}

function normalizePositiveNumber(value, fallback) {
  const numeric = Number.parseFloat(String(value || ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

async function shutdown() {
  runnerTaskPoller.stop('shutdown');
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  process.exit(0);
}

async function ensureBrowserMode(playwright, headed) {
  if (browser && browserHeaded !== headed) {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
    browser = undefined;
    browserHeaded = undefined;
    context = undefined;
    page = undefined;
    activeSession = undefined;
  }

  if (!browser) {
    browser = await playwright.chromium.launch({
      headless: !headed,
    });
    browserHeaded = headed;
  }
}
