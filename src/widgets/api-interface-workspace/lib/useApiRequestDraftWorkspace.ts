import type {
  ApiDefinitionDetail,
  ApiKeyValueInput,
  ApiRequestConfigInput,
} from '@/entities/api-automation'

interface UseApiRequestRowWorkspaceOptions {
  markDirty: () => void
}

export function emptyKeyValue(extra: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: 'string',
    required: false,
    encode: true,
    minLength: null,
    maxLength: null,
    fileName: null,
    fileSize: null,
    contentType: null,
    fileBase64: null,
    ...extra,
  }
}

export function emptyRequestConfig(method = 'GET'): ApiRequestConfigInput {
  return {
    method,
    path: '',
    timeoutMs: 10000,
    queryParams: [emptyKeyValue()],
    headers: [emptyKeyValue()],
    cookies: [],
    body: {
      type: 'RAW_JSON',
      rawText: '{\n  "page": 1,\n  "pageSize": 20\n}',
      jsonText: '{\n  "page": 1,\n  "pageSize": 20\n}',
      xmlText: '',
      plainText: '',
      formItems: [emptyKeyValue()],
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
    schemaFields: [],
  }
}

export function createDraftDetail(workspaceCode: string): ApiDefinitionDetail {
  return {
    id: 0,
    workspaceCode,
    workspaceName: workspaceCode,
    name: '新建请求',
    method: 'GET',
    path: '',
    directoryName: null,
    description: '',
    tags: [],
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    requestConfig: emptyRequestConfig(),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
    createdAt: null,
  }
}

export function editorTitle(detail: ApiDefinitionDetail) {
  return detail.name?.trim() || detail.requestConfig.path?.trim() || '新建请求'
}

export function enabledRows(rows?: ApiKeyValueInput[]) {
  return (rows || []).filter(row => row.enabled !== false && row.key.trim())
}

export function useApiRequestRowWorkspace(options: UseApiRequestRowWorkspaceOptions) {
  function setRowsEnabled(rows: ApiKeyValueInput[], checked: unknown) {
    rows.forEach(row => {
      row.enabled = Boolean(checked)
    })
    options.markDirty()
  }

  function addRow(rows: ApiKeyValueInput[]) {
    rows.push(emptyKeyValue())
    options.markDirty()
  }

  function removeRow(rows: ApiKeyValueInput[], index: number) {
    rows.splice(index, 1)
    if (!rows.length) rows.push(emptyKeyValue())
    options.markDirty()
  }

  return {
    addRow,
    removeRow,
    setRowsEnabled,
  }
}
