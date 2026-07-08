import {
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiScenarioStep,
  type ApiScenarioStepType,
} from '@/entities/api-automation'

import { normalizeSwaggerPathVariables } from './apiRequestPathTemplate'

export type ScenarioBodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'

export const scenarioQueryParamTypeOptions = ['string', 'integer', 'number', 'boolean', 'array'] as const
export const scenarioBodyParamTypeOptionValues = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file'] as const

export function createEmptyKeyValue(extra: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    required: false,
    paramType: 'string',
    encode: false,
    minLength: null,
    maxLength: null,
    fileName: '',
    fileSize: null,
    contentType: '',
    fileBase64: '',
    ...extra,
  }
}

export function scenarioQueryParamDefaults() {
  return { paramType: 'string', required: false, encode: false }
}

export function scenarioHeaderParamDefaults() {
  return { paramType: '', required: false, encode: false }
}

export function scenarioBodyFormParamDefaults() {
  return { paramType: 'string', required: false, encode: false }
}

export function getScenarioBodyParamTypeOptions(bodyType?: string | null) {
  if (normalizeScenarioBodyType(bodyType) === 'FORM_DATA') {
    return scenarioBodyParamTypeOptionValues
  }
  return scenarioBodyParamTypeOptionValues.filter(option => option !== 'file' && option !== 'json')
}

export function isScenarioKeyValueRowEmpty(row?: ApiKeyValueInput | null) {
  if (!row) return true
  return !row.key?.trim()
    && !row.value?.trim()
    && !row.description?.trim()
    && !row.fileName?.trim()
}

export function ensureScenarioTrailingKeyValueRow(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  if (!rows.length || !isScenarioKeyValueRowEmpty(rows[rows.length - 1])) {
    rows.push(createEmptyKeyValue(defaults))
  }
}

export function scenarioTableSelectionState(rows: ApiKeyValueInput[]) {
  const total = rows.length
  const enabled = rows.filter(item => item.enabled !== false).length
  return {
    checked: total > 0 && enabled === total,
    indeterminate: enabled > 0 && enabled < total,
  }
}

export function readScenarioFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function formatScenarioBodyFormFileSize(row: ApiKeyValueInput) {
  const size = row.fileSize
  if (size == null) return ''
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

export function createEmptyRequestConfig(): ApiRequestConfigInput {
  return {
    method: 'GET',
    path: '',
    timeoutMs: 30000,
    queryParams: [],
    headers: [],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: '',
      jsonText: '',
      xmlText: '',
      plainText: '',
      formItems: [],
      contentType: null,
      fileName: null,
      fileSize: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: { userName: '', password: '' },
      digestAuth: { userName: '', password: '' },
    },
  }
}

export function normalizeScenarioRequestConfig(config?: ApiRequestConfigInput | null): ApiRequestConfigInput {
  const next = config || createEmptyRequestConfig()
  const body = next.body || createEmptyRequestConfig().body
  const bodyType = normalizeScenarioBodyType(body.type)
  const rawText = body.rawText ?? ''
  return {
    method: String(next.method || 'GET').toUpperCase(),
    path: normalizeSwaggerPathVariables(next.path),
    timeoutMs: Number(next.timeoutMs || 30000),
    queryParams: Array.isArray(next.queryParams) ? next.queryParams : [],
    headers: Array.isArray(next.headers) ? next.headers : [],
    cookies: Array.isArray(next.cookies) ? next.cookies : [],
    body: {
      type: bodyType,
      rawText,
      jsonText: bodyType === 'RAW_JSON' && !body.jsonText ? rawText : (body.jsonText || ''),
      xmlText: bodyType === 'RAW_XML' && !body.xmlText ? rawText : (body.xmlText || ''),
      plainText: bodyType === 'RAW_TEXT' && !body.plainText ? rawText : (body.plainText || ''),
      formItems: Array.isArray(body.formItems) ? body.formItems : [],
      contentType: body.contentType || null,
      fileName: body.fileName || null,
      fileSize: body.fileSize ?? null,
      binaryBase64: body.binaryBase64 || null,
    },
    authConfig: {
      authType: next.authConfig?.authType || 'NONE',
      basicAuth: next.authConfig?.basicAuth || { userName: '', password: '' },
      digestAuth: next.authConfig?.digestAuth || { userName: '', password: '' },
    },
  }
}

export function normalizeScenarioBodyType(type?: string | null): ScenarioBodyType {
  const normalized = String(type || 'NONE').toUpperCase()
  if (normalized === 'NONE' || normalized === 'FORM_DATA' || normalized === 'FORM_URLENCODED' || normalized === 'RAW_JSON' || normalized === 'RAW_XML' || normalized === 'RAW_TEXT' || normalized === 'BINARY') {
    return normalized
  }
  if (normalized === 'JSON') return 'RAW_JSON'
  if (normalized === 'XML') return 'RAW_XML'
  if (normalized === 'RAW') return 'RAW_TEXT'
  return 'NONE'
}

export function isScenarioRawBody(type?: string | null) {
  return ['RAW_JSON', 'RAW_XML', 'RAW_TEXT'].includes(String(type || '').toUpperCase())
}

export function getRequestBodyText(body: ApiRequestConfigInput['body']) {
  const type = normalizeScenarioBodyType(body.type)
  if (type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

export function setRequestBodyText(body: ApiRequestConfigInput['body'], value: string) {
  const type = normalizeScenarioBodyType(body.type)
  if (type === 'RAW_JSON') body.jsonText = value
  if (type === 'RAW_XML') body.xmlText = value
  if (type === 'RAW_TEXT') body.plainText = value
  body.rawText = value
}

export function scenarioStepTypeTitle(type?: ApiScenarioStepType | null) {
  const titles: Record<ApiScenarioStepType, string> = {
    API: '导入系统请求',
    API_CASE: '引用用例',
    CUSTOM_REQUEST: '自定义请求',
    API_SCENARIO: '引用场景',
    IF_CONTROLLER: '条件控制器',
    LOOP_CONTROLLER: '循环控制器',
    ONCE_ONLY_CONTROLLER: '仅一次控制器',
    CONSTANT_TIMER: '等待时间',
    SCRIPT: '脚本操作',
  }
  return titles[type || 'API'] || '步骤配置'
}

export function scenarioStepDisplayName(step: ApiScenarioStep) {
  if (step.stepName?.trim()) return step.stepName.trim()
  if (step.stepType === 'CUSTOM_REQUEST') return step.requestConfig?.path || '自定义请求'
  if (step.stepType === 'CONSTANT_TIMER') return `等待 ${step.delayMs || 0} ms`
  return scenarioStepTypeTitle(step.stepType)
}

export function requestMethodClass(method?: string | null) {
  return `is-${String(method || 'GET').toLowerCase()}`
}
