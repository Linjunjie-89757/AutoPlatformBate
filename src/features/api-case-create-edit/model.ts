import type {
  ApiDefinitionCaseDetail,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiKeyValueInput,
  ApiRequestConfigInput,
  SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'

export type ApiCaseDialogMode = 'create' | 'edit'

export interface ApiCaseForm {
  workspaceCode: string
  workspaceName: string
  definitionId: number | null
  definitionName: string
  directoryName: string
  name: string
  priority: string
  status: string
  method: string
  path: string
  description: string
  tagsText: string
  timeoutMs: string
  lastRunAt: string | null
  lastRunResult: string | null
  baseRequestConfig: ApiRequestConfigInput | null
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

function createDefaultRequestConfig(method = 'GET', path = '', timeoutMs = 60000): ApiRequestConfigInput {
  return {
    method,
    path,
    timeoutMs,
    connectTimeoutMs: 30000,
    followRedirects: true,
    queryParams: [],
    headers: [],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: null,
      jsonText: null,
      xmlText: null,
      plainText: null,
      formItems: [],
      contentType: null,
      fileName: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: null,
      digestAuth: null,
    },
  }
}

function cloneRequestConfig(config: ApiRequestConfigInput | null | undefined): ApiRequestConfigInput {
  const fallback = createDefaultRequestConfig()
  const source = config || fallback
  const cloned = JSON.parse(JSON.stringify(source)) as ApiRequestConfigInput

  return {
    ...fallback,
    ...cloned,
    queryParams: Array.isArray(cloned.queryParams) ? cloned.queryParams : [],
    headers: Array.isArray(cloned.headers) ? cloned.headers : [],
    cookies: Array.isArray(cloned.cookies) ? cloned.cookies : [],
    body: {
      ...fallback.body,
      ...(cloned.body || {}),
      formItems: Array.isArray(cloned.body?.formItems) ? cloned.body.formItems : [],
    },
    authConfig: {
      ...fallback.authConfig,
      ...(cloned.authConfig || {}),
    },
  }
}

function isKeyValueRowEmpty(item: ApiKeyValueInput) {
  return ![
    item.key,
    item.value,
    item.description,
    item.fileName,
    item.fileBase64,
  ].some(value => String(value ?? '').trim())
}

function normalizeKeyValueRow(item: ApiKeyValueInput): ApiKeyValueInput {
  return {
    ...item,
    key: String(item.key ?? '').trim(),
    value: item.value ?? '',
    description: item.description ?? '',
    enabled: item.enabled !== false,
    paramType: item.paramType || 'string',
    required: item.required === true,
    encode: item.encode !== false,
    minLength: item.minLength ?? null,
    maxLength: item.maxLength ?? null,
    fileName: item.fileName ?? null,
    fileSize: item.fileSize ?? null,
    contentType: item.contentType ?? null,
    fileBase64: item.fileBase64 ?? null,
  }
}

function prepareKeyValueRowsForPayload(items: ApiKeyValueInput[] | undefined) {
  return (items || [])
    .map(item => normalizeKeyValueRow(item))
    .filter(item => !isKeyValueRowEmpty(item))
}

export function createDefaultApiCaseForm(
  definition: ApiDefinitionItem | null,
  workspaceCode = 'ALL',
): ApiCaseForm {
  return {
    workspaceCode,
    workspaceName: definition?.workspaceName || '',
    definitionId: definition?.id ?? null,
    definitionName: definition?.name || '',
    directoryName: definition?.directoryName || '',
    name: '',
    priority: 'P1',
    status: '进行中',
    method: definition?.method || 'GET',
    path: definition?.path || '',
    description: '',
    tagsText: '',
    timeoutMs: '60000',
    lastRunAt: null,
    lastRunResult: null,
    baseRequestConfig: createDefaultRequestConfig(definition?.method || 'GET', definition?.path || ''),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
  }
}

export function createApiCaseFormFromSummary(
  item: ApiDefinitionCaseItem,
  definition: ApiDefinitionItem | null,
  fallbackWorkspaceCode = 'ALL',
): ApiCaseForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    workspaceName: item.workspaceName || definition?.workspaceName || '',
    definitionId: item.definitionId || definition?.id || null,
    definitionName: item.definitionName || definition?.name || '',
    directoryName: definition?.directoryName || '',
    name: item.name || '',
    priority: (item as any).casePriority || (item as any).priority || 'P0',
    status: (item as any).caseStatus || (item as any).status || '进行中',
    method: item.method || definition?.method || 'GET',
    path: item.path || definition?.path || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: '60000',
    lastRunAt: item.lastRunAt || null,
    lastRunResult: item.lastRunResult || null,
    baseRequestConfig: createDefaultRequestConfig(
      item.method || definition?.method || 'GET',
      item.path || definition?.path || '',
    ),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
  }
}

export function createApiCaseFormFromDetail(item: ApiDefinitionCaseDetail): ApiCaseForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || '',
    definitionId: item.definitionId,
    definitionName: item.definitionName || '',
    directoryName: (item as any).directoryName || '',
    name: item.name || '',
    priority: (item as any).casePriority || (item as any).priority || 'P0',
    status: (item as any).caseStatus || (item as any).status || '进行中',
    method: item.requestConfig?.method || item.method || 'GET',
    path: item.requestConfig?.path || item.path || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: String(item.requestConfig?.timeoutMs || 60000),
    lastRunAt: item.lastRunAt || null,
    lastRunResult: item.lastRunResult || null,
    baseRequestConfig: cloneRequestConfig(item.requestConfig || createDefaultRequestConfig(item.method || 'GET', item.path || '')),
    assertions: Array.isArray(item.assertions) ? item.assertions : [],
    extractors: Array.isArray(item.extractors) ? item.extractors : [],
    preProcessors: Array.isArray(item.preProcessors) ? item.preProcessors : [],
    postProcessors: Array.isArray(item.postProcessors) ? item.postProcessors : [],
  }
}

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildSaveApiCasePayload(form: ApiCaseForm): SaveApiDefinitionCasePayload {
  const baseRequestConfig = cloneRequestConfig(form.baseRequestConfig || createDefaultRequestConfig(form.method, form.path))
  const body = {
    ...baseRequestConfig.body,
    formItems: prepareKeyValueRowsForPayload(baseRequestConfig.body.formItems),
    rawText:
      baseRequestConfig.body.type === 'RAW_JSON'
        ? baseRequestConfig.body.jsonText ?? baseRequestConfig.body.rawText ?? null
        : baseRequestConfig.body.type === 'RAW_XML'
          ? baseRequestConfig.body.xmlText ?? baseRequestConfig.body.rawText ?? null
          : baseRequestConfig.body.type === 'RAW_TEXT'
            ? baseRequestConfig.body.plainText ?? baseRequestConfig.body.rawText ?? null
            : baseRequestConfig.body.rawText ?? null,
  }
  if (body.type === 'RAW_JSON') body.jsonText = body.rawText
  if (body.type === 'RAW_XML') body.xmlText = body.rawText
  if (body.type === 'RAW_TEXT') body.plainText = body.rawText

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    definitionId: Number(form.definitionId),
    name: form.name.trim(),
    description: form.description.trim() || null,
    tags: parseTags(form.tagsText),
    requestConfig: {
      ...baseRequestConfig,
      method: form.method.trim().toUpperCase(),
      path: form.path.trim(),
      timeoutMs: Number(form.timeoutMs) || 60000,
      queryParams: prepareKeyValueRowsForPayload(baseRequestConfig.queryParams),
      headers: prepareKeyValueRowsForPayload(baseRequestConfig.headers),
      cookies: prepareKeyValueRowsForPayload(baseRequestConfig.cookies),
      body,
    },
    assertions: form.assertions,
    preProcessors: form.preProcessors,
    postProcessors: form.postProcessors,
  }
}

export function validateApiCaseForm(form: ApiCaseForm) {
  if (!form.definitionId) {
    return '请先选择接口定义'
  }
  if (!form.name.trim()) {
    return '请输入用例名称'
  }
  if (!form.method.trim()) {
    return '请选择请求方法'
  }
  if (!form.path.trim()) {
    return '请输入请求路径'
  }
  if (!Number.isFinite(Number(form.timeoutMs)) || Number(form.timeoutMs) <= 0) {
    return '超时时间必须是大于 0 的数字'
  }
  return ''
}
