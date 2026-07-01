import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectValidationTarget,
  WebUiElementCollectValidationResult,
  WebUiLocatorContextPathItem,
  WebUiLocatorType,
} from '../model/types'
import { env } from '../../../shared/config/env.ts'

export const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:39118'
export const LOCAL_RUNNER_VALIDATION_TIMEOUT_MS = 30000
export const LOCAL_RUNNER_START_COMMAND = 'cd D:\\perfectproject\\newautoweb\\perfectprojectwebchonggou-main && npm.cmd run runner'
export const LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND = 'npx playwright install chromium'
const LOCAL_RUNNER_VALIDATION_BATCH_SIZE = 10

export interface LocalRunnerCapabilityView {
  key: string
  label: string
  enabled: boolean
  description: string | null
}

export interface LocalRunnerDiagnosticsView {
  startCommand: string
  installChromiumCommand: string
  sessionTtlMinutes: number | null
  validationLocatorLimit: number | null
  validationScreenshotLimit: number | null
}

export interface LocalRunnerHealthView {
  online: boolean
  runnerVersion: string
  playwrightAvailable: boolean
  chromiumInstalled: boolean
  capabilities: LocalRunnerCapabilityView[]
  diagnostics: LocalRunnerDiagnosticsView
  currentUrl: string | null
  pageTitle: string | null
  pageAlive: boolean
  sessionId: string | null
  openedAt: string | null
  boundTaskId: string | null
  boundAt: string | null
  lastActiveAt: string | null
  authStateExists: boolean
  authSavedAt: string | null
  expiresAt: string | null
  ttlMinutes: number | null
  remainingSeconds: number | null
  expired: boolean
}

export type LocalRunnerStatusKind =
  | 'CHECKING'
  | 'OFFLINE'
  | 'PLAYWRIGHT_MISSING'
  | 'CHROMIUM_MISSING'
  | 'NO_PAGE'
  | 'LOGIN_PAGE'
  | 'URL_MISMATCH'
  | 'READY'

export interface LocalRunnerStatusView {
  kind: LocalRunnerStatusKind
  tagType: 'success' | 'warning' | 'danger' | 'info' | 'primary'
  alertType: 'success' | 'warning' | 'error' | 'info'
  label: string
  title: string
  description: string
  commands: string[]
  currentUrl: string | null
  runnerVersion: string | null
  canOpenPage: boolean
  canCollect: boolean
}

export interface LocalRunnerOpenPayload {
  url?: string
  workspaceId?: string | null
  environmentId?: string | number | null
}

export interface LocalRunnerBindPayload {
  taskId: number | string
  sessionId?: string | null
}

export interface LocalRunnerPlatformPollPayload {
  taskId: number | string
  workspaceCode: string
  runnerId?: string | null
  sessionId?: string | null
  locators?: WebUiElementCollectValidationTarget[]
}

export interface LocalRunnerPlatformPollStatus {
  success: boolean
  poller: {
    taskId: string
    apiBaseUrl: string
    workspaceCode: string
    runnerId: string
    sessionId: string | null
    running: boolean
    tickRunning: boolean
    startedAt: string | null
    lastTickAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    lastMessage: string | null
    validatedCount: number
    locatorCount: number
  } | null
}

export interface LocalRunnerTaskPollPayload {
  installId?: string
  runnerId?: string | null
  runnerToken?: string | null
  capabilities?: string[]
  workspaceCodes?: string[]
  intervalMs?: number
}

export interface LocalRunnerTaskPollingStatus {
  success: boolean
  poller: {
    apiBaseUrl: string
    installId: string
    runnerId: string | null
    runnerVersion: string
    protocolVersion: string
    capabilities: string[]
    workspaceCodes: string[]
    running: boolean
    tickRunning: boolean
    startedAt: string | null
    lastTickAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    lastMessage: string | null
    pulledCount: number
    completedCount: number
    failedCount: number
    intervalMs: number
  } | null
}

export interface LocalRunnerAuthStatus {
  success: boolean
  workspaceId: string
  environmentId: string
  exists: boolean
  savedAt: string | null
  savedUrl: string | null
  ageMinutes: number | null
  stale: boolean
  staleAfterMinutes: number
  activeSession: {
    sessionId: string
    currentUrl: string
    pageTitle?: string | null
    openedAt: string | null
    expiresAt: string | null
    authStateExists: boolean
    boundTaskId?: string | null
    boundAt?: string | null
  } | null
}

export interface LocalRunnerOpenResult {
  success: boolean
  session?: {
    sessionId: string
    currentUrl: string
    authStateExists: boolean
  }
  page?: {
    url: string
    title: string
    isProbablyLoginPage: boolean
  }
}

export interface LocalRunnerCaptureResult {
  success: boolean
  session?: {
    sessionId: string
    currentUrl: string
    authStateExists: boolean
  }
  page?: {
    url: string
    title: string
    isProbablyLoginPage: boolean
  }
  candidates: LocalRunnerCandidate[]
  rawCount: number
  screenshotBase64?: string | null
}

export interface LocalRunnerCandidate {
  name: string
  elementType: string | null
  locator: {
    strategy: string
    value: string
    framePath?: WebUiLocatorContextPathItem[] | null
    shadowPath?: WebUiLocatorContextPathItem[] | null
  }
  text?: string | null
  placeholder?: string | null
  tagName?: string | null
  stabilityScore?: number | null
  source?: string | null
}

export interface LocalRunnerValidateLocatorInput {
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
}

export interface LocalRunnerValidationProgress {
  done: number
  total: number
  batchFailed: number
}

export function normalizeRunnerHealth(payload: any): LocalRunnerHealthView {
  return {
    online: Boolean(payload?.success),
    runnerVersion: String(payload?.runner?.version || '-'),
    playwrightAvailable: Boolean(payload?.playwright?.available),
    chromiumInstalled: Boolean(payload?.browsers?.chromium?.installed),
    capabilities: normalizeRunnerCapabilities(payload?.capabilities),
    diagnostics: normalizeRunnerDiagnostics(payload?.diagnostics),
    currentUrl: payload?.session?.currentUrl || null,
    pageTitle: payload?.session?.pageTitle || null,
    pageAlive: Boolean(payload?.session?.pageAlive),
    sessionId: payload?.session?.sessionId || null,
    openedAt: payload?.session?.openedAt || null,
    boundTaskId: payload?.session?.boundTaskId === null || payload?.session?.boundTaskId === undefined
      ? null
      : String(payload.session.boundTaskId),
    boundAt: payload?.session?.boundAt || null,
    lastActiveAt: payload?.session?.lastActiveAt || null,
    authStateExists: Boolean(payload?.session?.authStateExists),
    authSavedAt: payload?.session?.authSavedAt || null,
    expiresAt: payload?.session?.expiresAt || null,
    ttlMinutes: Number.isFinite(Number(payload?.session?.ttlMinutes)) ? Number(payload.session.ttlMinutes) : null,
    remainingSeconds: Number.isFinite(Number(payload?.session?.remainingSeconds)) ? Number(payload.session.remainingSeconds) : null,
    expired: Boolean(payload?.session?.expired),
  }
}

function normalizeRunnerCapabilities(value: unknown): LocalRunnerCapabilityView[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(item => item && typeof item === 'object')
    .map((item: any) => ({
      key: String(item.key || ''),
      label: String(item.label || item.key || '能力'),
      enabled: item.enabled !== false,
      description: item.description || null,
    }))
    .filter(item => item.key)
}

function normalizeRunnerDiagnostics(value: any): LocalRunnerDiagnosticsView {
  return {
    startCommand: value?.startCommand || LOCAL_RUNNER_START_COMMAND,
    installChromiumCommand: value?.installChromiumCommand || LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND,
    sessionTtlMinutes: Number.isFinite(Number(value?.sessionTtlMinutes)) ? Number(value.sessionTtlMinutes) : null,
    validationLocatorLimit: Number.isFinite(Number(value?.validationLocatorLimit)) ? Number(value.validationLocatorLimit) : null,
    validationScreenshotLimit: Number.isFinite(Number(value?.validationScreenshotLimit)) ? Number(value.validationScreenshotLimit) : null,
  }
}

export function buildLocalRunnerStatusView(input: {
  checking?: boolean
  health?: LocalRunnerHealthView | null
  errorMessage?: string | null
  expectedUrl?: string | null
}): LocalRunnerStatusView {
  const health = input.health || null
  const currentUrl = health?.currentUrl || null
  const runnerVersion = health?.runnerVersion && health.runnerVersion !== '-' ? health.runnerVersion : null

  if (input.checking) {
    return createLocalRunnerStatus({
      kind: 'CHECKING',
      tagType: 'info',
      alertType: 'info',
      label: '检测中',
      title: '正在检测本地 Runner',
      description: '正在读取 Runner、Playwright、Chromium 和当前页面状态。',
      currentUrl,
      runnerVersion,
    })
  }

  if (!health?.online) {
    const reason = input.errorMessage ? `当前错误：${input.errorMessage}` : `无法访问 ${LOCAL_RUNNER_BASE_URL}/health。`
    return createLocalRunnerStatus({
      kind: 'OFFLINE',
      tagType: 'danger',
      alertType: 'error',
      label: '未连接',
      title: '本地 Runner 未启动或无法访问',
      description: `${reason} 请在前端项目目录启动 Runner，然后重新检测。`,
      commands: [LOCAL_RUNNER_START_COMMAND],
    })
  }

  if (!health.playwrightAvailable) {
    return createLocalRunnerStatus({
      kind: 'PLAYWRIGHT_MISSING',
      tagType: 'warning',
      alertType: 'warning',
      label: '依赖缺失',
      title: 'Runner 已连接，但 Playwright 不可用',
      description: '请先安装前端依赖，确认当前项目可以加载 playwright 包，再重新启动 Runner。',
      commands: ['npm.cmd install', LOCAL_RUNNER_START_COMMAND],
      currentUrl,
      runnerVersion,
    })
  }

  if (!health.chromiumInstalled) {
    return createLocalRunnerStatus({
      kind: 'CHROMIUM_MISSING',
      tagType: 'warning',
      alertType: 'warning',
      label: '浏览器缺失',
      title: 'Runner 已连接，但 Chromium 未安装',
      description: '请安装 Playwright 的 Chromium 浏览器内核，安装后重新启动 Runner。',
      commands: [LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND, LOCAL_RUNNER_START_COMMAND],
      currentUrl,
      runnerVersion,
    })
  }

  if (!currentUrl) {
    return createLocalRunnerStatus({
      kind: 'NO_PAGE',
      tagType: 'warning',
      alertType: 'warning',
      label: '未打开页面',
      title: 'Runner 已连接，请先打开目标业务页面',
      description: '可以填写页面 URL 后点击“打开目标页”，也可以在 Runner 浏览器里手动进入目标页面。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
    })
  }

  if (isProbablyLoginUrl(currentUrl)) {
    return createLocalRunnerStatus({
      kind: 'LOGIN_PAGE',
      tagType: 'warning',
      alertType: 'warning',
      label: '疑似登录页',
      title: 'Runner 当前页面可能是登录页',
      description: '请先在 Runner 浏览器中完成登录，并进入真正要采集的业务页面后再开始采集。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
    })
  }

  const expectedUrl = input.expectedUrl?.trim()
  if (expectedUrl && normalizeComparableUrl(currentUrl) !== normalizeComparableUrl(expectedUrl)) {
    return createLocalRunnerStatus({
      kind: 'URL_MISMATCH',
      tagType: 'warning',
      alertType: 'warning',
      label: '页面不一致',
      title: 'Runner 当前页面和目标页面地址不一致',
      description: '采集会以 Runner 浏览器当前页面为准。如果这不是目标业务页面，请重新打开目标页或手动切回正确页面。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
      canCollect: true,
    })
  }

  return createLocalRunnerStatus({
    kind: 'READY',
    tagType: 'success',
    alertType: 'success',
    label: '可采集',
    title: 'Runner 已就绪',
    description: `将采集当前页面：${currentUrl}`,
    currentUrl,
    runnerVersion,
    canOpenPage: true,
    canCollect: true,
  })
}

export async function checkLocalRunnerHealth() {
  const payload = await requestLocalRunner('/health')
  return normalizeRunnerHealth(payload)
}

export async function openLocalRunnerPage(payload: LocalRunnerOpenPayload) {
  return requestLocalRunner<LocalRunnerOpenResult>('/collect/open', {
    method: 'POST',
    body: payload,
  })
}

export async function captureLocalRunnerPage(waitMs = 300) {
  return requestLocalRunner<LocalRunnerCaptureResult>('/collect/capture', {
    method: 'POST',
    body: { waitMs },
  })
}

export async function validateLocalRunnerLocators(
  locators: LocalRunnerValidateLocatorInput[],
  options: {
    onProgress?: (progress: LocalRunnerValidationProgress) => void
  } = {},
) {
  const normalizedLocators = locators
    .filter(item => item.locatorValue?.trim())
    .map(item => ({
      locatorType: normalizeLocatorType(item.locatorType),
      locatorValue: item.locatorValue.trim(),
      ...buildLocatorContext(item),
    }))
  const results: WebUiElementCollectValidationResult[] = []
  let batchFailed = 0
  let lastError: unknown = null

  for (let index = 0; index < normalizedLocators.length; index += LOCAL_RUNNER_VALIDATION_BATCH_SIZE) {
    const batch = normalizedLocators.slice(index, index + LOCAL_RUNNER_VALIDATION_BATCH_SIZE)
    try {
      const payload = await requestLocalRunner<{ results?: WebUiElementCollectValidationResult[] }>('/collect/validate', {
        method: 'POST',
        timeoutMs: LOCAL_RUNNER_VALIDATION_TIMEOUT_MS,
        body: {
          locators: batch,
        },
      })
      if (Array.isArray(payload.results)) {
        results.push(...payload.results.map((item, resultIndex) => normalizeLocalRunnerValidationResult(item, batch[resultIndex])))
      }
    } catch (error) {
      batchFailed += 1
      lastError = error
      results.push(...batch.map(item => ({
        locatorType: item.locatorType,
        locatorValue: item.locatorValue,
        validationStatus: 'FAILED',
        matchCount: 0,
        validationMessage: `本批真机验证失败：${getLocalRunnerErrorMessage(error)}`,
        screenshotBase64: null,
        ...buildLocatorContext(item),
      })))
    }
    options.onProgress?.({
      done: Math.min(index + batch.length, normalizedLocators.length),
      total: normalizedLocators.length,
      batchFailed,
    })
  }

  if (normalizedLocators.length > 0 && batchFailed === Math.ceil(normalizedLocators.length / LOCAL_RUNNER_VALIDATION_BATCH_SIZE)) {
    throw lastError instanceof Error ? lastError : new Error('本地 Runner 所有验证批次均失败')
  }

  return results
}

export async function saveLocalRunnerAuth(payload: Omit<LocalRunnerOpenPayload, 'url'>) {
  return requestLocalRunner('/auth/save', {
    method: 'POST',
    body: payload,
  })
}

export async function getLocalRunnerAuthStatus(payload: Omit<LocalRunnerOpenPayload, 'url'>) {
  return requestLocalRunner<LocalRunnerAuthStatus>('/auth/status', {
    method: 'POST',
    body: payload,
  })
}

export async function clearLocalRunnerAuth(payload: Omit<LocalRunnerOpenPayload, 'url'>) {
  return requestLocalRunner('/auth/clear', {
    method: 'POST',
    body: payload,
  })
}

export async function releaseLocalRunnerSession() {
  return requestLocalRunner('/session/release', {
    method: 'POST',
  })
}

export async function bindLocalRunnerSession(payload: LocalRunnerBindPayload) {
  return requestLocalRunner('/session/bind', {
    method: 'POST',
    body: payload,
  })
}

export async function getLocalRunnerHeartbeat() {
  const payload = await requestLocalRunner('/session/heartbeat')
  return normalizeRunnerHealth(payload)
}

export async function startLocalRunnerPlatformPolling(payload: LocalRunnerPlatformPollPayload) {
  return requestLocalRunner<LocalRunnerPlatformPollStatus>('/platform/poll/start', {
    method: 'POST',
    body: {
      apiBaseUrl: env.apiBaseUrl,
      workspaceCode: payload.workspaceCode,
      taskId: payload.taskId,
      runnerId: payload.runnerId || 'local-runner',
      sessionId: payload.sessionId || null,
      locators: payload.locators || [],
      intervalMs: 2000,
    },
  })
}

export async function stopLocalRunnerPlatformPolling() {
  return requestLocalRunner<LocalRunnerPlatformPollStatus>('/platform/poll/stop', {
    method: 'POST',
  })
}

export async function getLocalRunnerPlatformPollingStatus() {
  return requestLocalRunner<LocalRunnerPlatformPollStatus>('/platform/poll/status')
}

export async function startLocalRunnerTaskPolling(payload: LocalRunnerTaskPollPayload = {}) {
  return requestLocalRunner<LocalRunnerTaskPollingStatus>('/tasks/poll/start', {
    method: 'POST',
    body: {
      apiBaseUrl: env.apiBaseUrl,
      installId: payload.installId,
      runnerId: payload.runnerId || null,
      runnerToken: payload.runnerToken || null,
      capabilities: payload.capabilities || ['WEB_ELEMENT_VALIDATE'],
      workspaceCodes: payload.workspaceCodes || [],
      intervalMs: payload.intervalMs || 2000,
    },
  })
}

export async function stopLocalRunnerTaskPolling() {
  return requestLocalRunner<LocalRunnerTaskPollingStatus>('/tasks/poll/stop', {
    method: 'POST',
  })
}

export async function getLocalRunnerTaskPollingStatus() {
  return requestLocalRunner<LocalRunnerTaskPollingStatus>('/tasks/poll/status')
}

export function mapRunnerCandidateToCollectCandidate(input: {
  candidate: LocalRunnerCandidate
  groupName: string
  screenshotBase64?: string | null
}): WebUiElementCollectCandidate {
  const locatorType = normalizeLocatorType(input.candidate.locator?.strategy)
  const confidence = clampConfidence(input.candidate.stabilityScore)
  const hasLocator = Boolean(input.candidate.locator?.value)

  return {
    groupName: input.groupName || '页面元素',
    candidateSource: 'STATIC_RULE',
    elementName: input.candidate.name || '页面元素',
    locatorType,
    locatorValue: input.candidate.locator?.value || '',
    ...buildLocatorContext(input.candidate.locator),
    confidence,
    reason: '本地 Runner 静态规则采集',
    tagName: input.candidate.tagName || null,
    elementType: input.candidate.elementType || null,
    text: input.candidate.text || null,
    placeholder: input.candidate.placeholder || null,
    ariaLabel: null,
    labelText: null,
    nearbyHeading: null,
    businessMeaning: input.candidate.text || input.candidate.placeholder || null,
    recommendedToSave: hasLocator,
    notRecommendedReason: hasLocator ? null : '未生成可用定位器',
    maintenanceSuggestion: '来自本地 Runner 静态采集，当前阶段尚未接入真机验证，保存前请确认名称、分组和定位器。',
    stabilityNote: `定位器稳定性评分 ${confidence}%`,
    validationStatus: 'UNVERIFIED',
    matchCount: null,
    validationMessage: '静态生成，尚未经过 Runner 真机验证',
    screenshotBase64: input.screenshotBase64 || null,
    saveBlockedReason: hasLocator ? null : '缺少定位器',
  }
}

async function requestLocalRunner<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    timeoutMs?: number
  } = {},
): Promise<T> {
  const controller = options.timeoutMs ? new AbortController() : null
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), options.timeoutMs)
    : null
  let response: Response
  try {
    response = await fetch(`${LOCAL_RUNNER_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`本地 Runner 请求超时，请确认 ${LOCAL_RUNNER_BASE_URL} 正常响应`)
    }
    throw new Error(`本地 Runner 未连接，请先启动 Runner：${LOCAL_RUNNER_START_COMMAND}`)
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId)
    }
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || '本地 Runner 请求失败')
  }

  return payload as T
}

function normalizeLocatorType(value?: string | null): WebUiLocatorType {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'TEXT'
    || normalized === 'ROLE'
    || normalized === 'PLACEHOLDER'
    || normalized === 'LABEL'
    || normalized === 'TEST_ID'
    || normalized === 'XPATH'
  ) {
    return normalized
  }

  return 'CSS'
}

function normalizeLocalRunnerValidationResult(
  item: WebUiElementCollectValidationResult,
  fallback?: Pick<WebUiElementCollectValidationTarget, 'framePath' | 'shadowPath'>,
): WebUiElementCollectValidationResult {
  return {
    locatorType: normalizeLocatorType(item.locatorType),
    locatorValue: item.locatorValue || '',
    ...buildLocatorContext({
      framePath: item.framePath ?? fallback?.framePath,
      shadowPath: item.shadowPath ?? fallback?.shadowPath,
    }),
    validationStatus: item.validationStatus || 'UNVERIFIED',
    matchCount: Number(item.matchCount || 0),
    validationMessage: item.validationMessage || null,
    screenshotBase64: item.screenshotBase64 || null,
  }
}

function buildLocatorContext(value?: Pick<WebUiElementCollectValidationTarget, 'framePath' | 'shadowPath'> | null) {
  const framePath = normalizeLocatorContextPath(value?.framePath)
  const shadowPath = normalizeLocatorContextPath(value?.shadowPath)
  return {
    ...(framePath.length > 0 ? { framePath } : {}),
    ...(shadowPath.length > 0 ? { shadowPath } : {}),
  }
}

function normalizeLocatorContextPath(value?: WebUiLocatorContextPathItem[] | null) {
  return Array.isArray(value) ? value : []
}

function getLocalRunnerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createLocalRunnerStatus(input: Partial<LocalRunnerStatusView> & Pick<LocalRunnerStatusView, 'kind' | 'tagType' | 'alertType' | 'label' | 'title' | 'description'>): LocalRunnerStatusView {
  return {
    commands: [],
    currentUrl: null,
    runnerVersion: null,
    canOpenPage: false,
    canCollect: false,
    ...input,
  }
}

function normalizeComparableUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return String(url || '').trim().replace(/\/+$/, '')
  }
}

function isProbablyLoginUrl(url: string) {
  return /login|signin|auth|passport|sso/i.test(url)
}

function clampConfidence(value?: number | null) {
  const numeric = Number(value || 0)
  if (Number.isNaN(numeric)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(numeric)))
}
