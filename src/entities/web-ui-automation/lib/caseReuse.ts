import type {
  WebUiBrowserType,
  WebUiCaseDetail,
  WebUiCaseStatus,
  WebUiCaseStepItem,
  WebUiCaseTemplateDetail,
  WebUiLocatorType,
  WebUiScreenshotPolicy,
  WebUiStepType,
} from '../model/types'

const SUPPORTED_STEP_TYPES: WebUiStepType[] = [
  'OPEN',
  'CLICK',
  'FILL',
  'CLEAR',
  'HOVER',
  'DRAG_TO',
  'DRAG_COORDINATES',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'PRESS_KEY',
  'SELECT',
  'FILE_UPLOAD',
  'FILE_PICKER',
  'WAIT_FOR',
  'ASSERT_VISIBLE',
  'ASSERT_TEXT',
  'ASSERT_URL',
  'ASSERT_TITLE',
  'ASSERT_ATTRIBUTE',
  'ASSERT_COUNT',
  'SCREENSHOT',
]

const SUPPORTED_LOCATOR_TYPES: WebUiLocatorType[] = ['CSS', 'TEXT', 'ROLE', 'PLACEHOLDER', 'LABEL', 'TEST_ID', 'XPATH']
const SUPPORTED_BROWSER_TYPES: WebUiBrowserType[] = ['CHROMIUM', 'FIREFOX', 'WEBKIT']
const SUPPORTED_CASE_STATUS: WebUiCaseStatus[] = ['ENABLED', 'DISABLED']
const SUPPORTED_SCREENSHOT_POLICIES: WebUiScreenshotPolicy[] = ['NONE', 'ON_FAILURE', 'ALWAYS']
const STEP_TYPES_REQUIRING_LOCATOR: WebUiStepType[] = [
  'CLICK',
  'FILL',
  'CLEAR',
  'HOVER',
  'DRAG_TO',
  'DRAG_COORDINATES',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'SELECT',
  'FILE_UPLOAD',
  'FILE_PICKER',
  'WAIT_FOR',
  'ASSERT_VISIBLE',
  'ASSERT_TEXT',
  'ASSERT_ATTRIBUTE',
  'ASSERT_COUNT',
]
const STEP_TYPES_REQUIRING_INPUT: WebUiStepType[] = [
  'OPEN',
  'FILL',
  'DRAG_TO',
  'DRAG_COORDINATES',
  'PRESS_KEY',
  'SELECT',
  'FILE_UPLOAD',
  'FILE_PICKER',
  'ASSERT_TEXT',
  'ASSERT_URL',
  'ASSERT_TITLE',
  'ASSERT_ATTRIBUTE',
  'ASSERT_COUNT',
]

export interface WebUiCaseTemplate {
  id: string
  name: string
  moduleName: string
  description: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
  steps: WebUiCaseStepItem[]
}

export interface WebUiCasePortableJson {
  version: 1
  exportedAt: string
  name: string
  moduleName: string | null
  description: string | null
  baseUrl: string | null
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
  steps: Array<{
    name?: string | null
    type: WebUiStepType
    locatorType?: WebUiLocatorType | null
    locatorValue?: string | null
    inputValue?: string | null
    timeoutMs?: number | null
    continueOnFailure: boolean
    screenshotPolicy: WebUiScreenshotPolicy
    enabled: boolean
    sortOrder: number
  }>
}

export type WebUiCaseImportResult =
  | { ok: true; draft: WebUiCaseDetail; warnings: string[] }
  | { ok: false; errors: string[] }

export const WEB_UI_CASE_TEMPLATES: WebUiCaseTemplate[] = [
  {
    id: 'login-flow',
    name: '登录流程',
    moduleName: '账号登录',
    description: '覆盖打开登录页、输入账号密码、提交登录和登录成功断言。',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [
      createStep(1, '打开登录页', 'OPEN', { inputValue: '/login' }),
      createStep(2, '输入用户名', 'FILL', { locatorType: 'CSS', locatorValue: 'input[name="username"]', inputValue: '{{USERNAME}}' }),
      createStep(3, '输入密码', 'FILL', { locatorType: 'CSS', locatorValue: 'input[name="password"]', inputValue: '{{PASSWORD}}' }),
      createStep(4, '点击登录', 'CLICK', { locatorType: 'CSS', locatorValue: 'button[type="submit"]' }),
      createStep(5, '断言进入首页', 'ASSERT_URL', { inputValue: '/dashboard' }),
    ],
  },
  {
    id: 'search-list-assert',
    name: '搜索/筛选/列表断言',
    moduleName: '列表查询',
    description: '覆盖打开列表页、输入关键字、触发查询和列表结果断言。',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [
      createStep(1, '打开列表页', 'OPEN', { inputValue: '/list' }),
      createStep(2, '输入搜索关键字', 'FILL', { locatorType: 'CSS', locatorValue: 'input[name="keyword"]', inputValue: '{{KEYWORD}}' }),
      createStep(3, '点击查询', 'CLICK', { locatorType: 'TEXT', locatorValue: '查询' }),
      createStep(4, '等待列表结果', 'WAIT_FOR', { locatorType: 'CSS', locatorValue: '.el-table__row' }),
      createStep(5, '断言列表有数据', 'ASSERT_COUNT', { locatorType: 'CSS', locatorValue: '.el-table__row', inputValue: '>0' }),
    ],
  },
  {
    id: 'form-create',
    name: '表单新增',
    moduleName: '表单维护',
    description: '覆盖进入新增页、填写表单、保存和成功提示断言。',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [
      createStep(1, '打开新增页', 'OPEN', { inputValue: '/create' }),
      createStep(2, '填写名称', 'FILL', { locatorType: 'LABEL', locatorValue: '名称', inputValue: '{{NAME}}' }),
      createStep(3, '填写备注', 'FILL', { locatorType: 'LABEL', locatorValue: '备注', inputValue: '{{DESCRIPTION}}' }),
      createStep(4, '保存表单', 'CLICK', { locatorType: 'TEXT', locatorValue: '保存' }),
      createStep(5, '断言保存成功', 'ASSERT_TEXT', { locatorType: 'CSS', locatorValue: '.el-message', inputValue: '成功' }),
    ],
  },
  {
    id: 'table-action',
    name: '表格操作',
    moduleName: '表格维护',
    description: '覆盖列表搜索、定位行内操作按钮、确认操作和结果断言。',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [
      createStep(1, '打开表格页', 'OPEN', { inputValue: '/table' }),
      createStep(2, '等待表格加载', 'WAIT_FOR', { locatorType: 'CSS', locatorValue: '.el-table__row' }),
      createStep(3, '点击第一行编辑', 'CLICK', { locatorType: 'CSS', locatorValue: '.el-table__row:first-child .el-button' }),
      createStep(4, '断言编辑弹窗打开', 'ASSERT_VISIBLE', { locatorType: 'CSS', locatorValue: '.el-dialog' }),
      createStep(5, '关闭弹窗', 'PRESS_KEY', { inputValue: 'Escape' }),
    ],
  },
  {
    id: 'file-upload',
    name: '文件上传',
    moduleName: '文件处理',
    description: '覆盖打开上传页、选择文件、提交上传和上传成功断言。',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 15000,
    status: 'ENABLED',
    steps: [
      createStep(1, '打开上传页', 'OPEN', { inputValue: '/upload' }),
      createStep(2, '选择文件', 'FILE_UPLOAD', { locatorType: 'CSS', locatorValue: 'input[type="file"]', inputValue: 'D:/test-data/demo.xlsx' }),
      createStep(3, '点击上传', 'CLICK', { locatorType: 'TEXT', locatorValue: '上传' }),
      createStep(4, '断言上传成功', 'ASSERT_TEXT', { locatorType: 'CSS', locatorValue: '.el-message', inputValue: '成功' }),
    ],
  },
]

export function buildWebUiDraftFromTemplate(template: WebUiCaseTemplate, workspaceCode: string): WebUiCaseDetail {
  return createDraftCase({
    workspaceCode,
    name: template.name,
    moduleName: template.moduleName,
    description: template.description,
    baseUrl: template.baseUrl,
    browserType: template.browserType,
    headless: template.headless,
    defaultTimeoutMs: template.defaultTimeoutMs,
    status: template.status,
    steps: cloneSteps(template.steps),
  })
}

export function buildWebUiDraftFromTemplateDetail(template: WebUiCaseTemplateDetail, workspaceCode: string): WebUiCaseDetail {
  return createDraftCase({
    workspaceCode,
    name: template.name,
    moduleName: template.moduleName,
    description: template.description,
    baseUrl: template.baseUrl,
    browserType: template.browserType,
    headless: template.headless,
    defaultTimeoutMs: template.defaultTimeoutMs,
    status: template.status,
    steps: cloneSteps(template.steps),
  })
}

export function buildWebUiCaseExportJson(detail: WebUiCaseDetail): string {
  const portable: WebUiCasePortableJson = {
    version: 1,
    exportedAt: new Date().toISOString(),
    name: detail.name,
    moduleName: detail.moduleName,
    description: detail.description,
    baseUrl: detail.baseUrl || null,
    browserType: detail.browserType,
    headless: detail.headless,
    defaultTimeoutMs: detail.defaultTimeoutMs,
    status: detail.status,
    steps: cloneSteps(detail.steps).map(step => ({
      name: step.name || null,
      type: step.type,
      locatorType: step.locatorType || null,
      locatorValue: step.locatorValue || null,
      inputValue: step.inputValue || null,
      timeoutMs: step.timeoutMs ?? null,
      continueOnFailure: step.continueOnFailure,
      screenshotPolicy: step.screenshotPolicy,
      enabled: step.enabled,
      sortOrder: step.sortOrder,
    })),
  }
  return `${JSON.stringify(portable, null, 2)}\n`
}

export function parseWebUiCaseImportJson(jsonText: string, workspaceCode: string): WebUiCaseImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { ok: false, errors: ['JSON 格式不正确，请检查括号、逗号和引号。'] }
  }

  if (!isRecord(raw)) {
    return { ok: false, errors: ['导入内容必须是一个 JSON 对象。'] }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const name = normalizeText(raw.name) || normalizeText(raw.caseName)
  if (!name) {
    errors.push('用例名称不能为空。')
  }

  const rawSteps = Array.isArray(raw.steps) ? raw.steps : []
  if (!rawSteps.length) {
    errors.push('至少需要 1 个步骤。')
  }

  const steps = rawSteps.map((item, index) => normalizeImportedStep(item, index, errors))
  if (!steps.some(step => step.enabled)) {
    errors.push('至少需要 1 个启用步骤。')
  }

  const browserType = normalizeEnum(raw.browserType, SUPPORTED_BROWSER_TYPES, 'CHROMIUM')
  if (raw.browserType && browserType !== raw.browserType) {
    warnings.push('浏览器类型不支持，已默认使用 Chromium。')
  }

  const status = normalizeEnum(raw.status, SUPPORTED_CASE_STATUS, 'ENABLED')
  const defaultTimeoutMs = normalizePositiveNumber(raw.defaultTimeoutMs, 10000)
  const headless = typeof raw.headless === 'boolean' ? raw.headless : true

  if (errors.length) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    warnings,
    draft: createDraftCase({
      workspaceCode,
      name,
      moduleName: normalizeText(raw.moduleName),
      description: normalizeText(raw.description),
      baseUrl: normalizeText(raw.baseUrl),
      browserType,
      headless,
      defaultTimeoutMs,
      status,
      steps,
    }),
  }
}

function createStep(
  sortOrder: number,
  name: string,
  type: WebUiStepType,
  overrides: Partial<WebUiCaseStepItem> = {},
): WebUiCaseStepItem {
  return {
    id: null,
    name,
    type,
    elementId: null,
    elementName: null,
    locatorType: null,
    locatorValue: null,
    inputValue: null,
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'ON_FAILURE',
    enabled: true,
    sortOrder,
    ...overrides,
  }
}

function createDraftCase(input: {
  workspaceCode: string
  name: string
  moduleName?: string | null
  description?: string | null
  baseUrl?: string | null
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
  steps: WebUiCaseStepItem[]
}): WebUiCaseDetail {
  return {
    id: 0,
    workspaceCode: input.workspaceCode,
    workspaceName: input.workspaceCode,
    name: input.name,
    moduleName: input.moduleName || null,
    status: input.status,
    browserType: input.browserType,
    headless: input.headless,
    defaultTimeoutMs: input.defaultTimeoutMs,
    baseUrl: input.baseUrl || null,
    description: input.description || null,
    stepCount: input.steps.length,
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    createdAt: null,
    steps: cloneSteps(input.steps),
  }
}

function cloneSteps(steps: WebUiCaseStepItem[]): WebUiCaseStepItem[] {
  return steps.map((step, index) => ({
    id: null,
    name: step.name || null,
    type: step.type,
    elementId: step.elementId ?? null,
    elementName: step.elementName || null,
    locatorType: step.locatorType || null,
    locatorValue: step.locatorValue || null,
    inputValue: step.inputValue || null,
    timeoutMs: step.timeoutMs ?? null,
    continueOnFailure: Boolean(step.continueOnFailure),
    screenshotPolicy: step.screenshotPolicy || 'ON_FAILURE',
    enabled: step.enabled !== false,
    sortOrder: index + 1,
  }))
}

function normalizeImportedStep(raw: unknown, index: number, errors: string[]): WebUiCaseStepItem {
  const stepIndex = index + 1
  const record = isRecord(raw) ? raw : {}
  const rawType = normalizeText(record.type)
  const type = normalizeEnum(rawType, SUPPORTED_STEP_TYPES, 'OPEN')
  if (!rawType || !SUPPORTED_STEP_TYPES.includes(rawType as WebUiStepType)) {
    errors.push(`第 ${stepIndex} 步类型不支持。`)
  }

  const locatorType = normalizeEnum(record.locatorType, SUPPORTED_LOCATOR_TYPES, null)
  const locatorValue = normalizeText(record.locatorValue)
  const inputValue = normalizeText(record.inputValue)
  const screenshotPolicy = normalizeEnum(record.screenshotPolicy, SUPPORTED_SCREENSHOT_POLICIES, 'ON_FAILURE')
  const enabled = record.enabled !== false

  if (enabled && STEP_TYPES_REQUIRING_LOCATOR.includes(type) && (!locatorType || !locatorValue)) {
    errors.push(`第 ${stepIndex} 步需要填写定位器类型和定位器。`)
  }
  if (enabled && STEP_TYPES_REQUIRING_INPUT.includes(type) && !inputValue) {
    errors.push(`第 ${stepIndex} 步需要填写输入值或期望值。`)
  }

  return createStep(stepIndex, normalizeText(record.name) || `第 ${stepIndex} 步`, type, {
    locatorType,
    locatorValue,
    inputValue,
    timeoutMs: normalizeNullablePositiveNumber(record.timeoutMs),
    continueOnFailure: Boolean(record.continueOnFailure),
    screenshotPolicy,
    enabled,
  })
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback
}

function normalizeNullablePositiveNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : null
}

function normalizeEnum<T extends string>(value: unknown, supported: readonly T[], fallback: T): T
function normalizeEnum<T extends string>(value: unknown, supported: readonly T[], fallback: T | null): T | null
function normalizeEnum<T extends string>(value: unknown, supported: readonly T[], fallback: T | null) {
  return typeof value === 'string' && supported.includes(value as T) ? value as T : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
