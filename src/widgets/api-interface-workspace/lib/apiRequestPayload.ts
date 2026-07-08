import type {
  ApiDefinitionDetail,
  ApiRequestConfigInput,
  SaveApiDefinitionPayload,
} from '@/entities/api-automation'

interface BuildApiDefinitionPayloadOptions {
  workspaceCode: string
  clone: <T>(value: T) => T
  syncRequestBodyRawText: (requestConfig: ApiRequestConfigInput) => void
}

export function buildApiRequestConfigPayload(
  detail: ApiDefinitionDetail,
  options: BuildApiDefinitionPayloadOptions,
): ApiRequestConfigInput {
  options.syncRequestBodyRawText(detail.requestConfig)
  const requestConfig = options.clone({
    ...detail.requestConfig,
    method: detail.requestConfig.method || 'GET',
    path: detail.requestConfig.path || '',
    timeoutMs: Number(detail.requestConfig.timeoutMs || 10000),
  })
  delete requestConfig.body.jsonText
  delete requestConfig.body.xmlText
  delete requestConfig.body.plainText
  return requestConfig
}

export function buildApiDefinitionPayload(
  detail: ApiDefinitionDetail,
  options: BuildApiDefinitionPayloadOptions,
): SaveApiDefinitionPayload {
  return {
    workspaceCode: options.workspaceCode === 'ALL' ? detail.workspaceCode : options.workspaceCode,
    name: detail.name?.trim() || detail.requestConfig.path?.trim() || '未命名接口',
    directoryName: detail.directoryName || null,
    description: detail.description || null,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    requestConfig: buildApiRequestConfigPayload(detail, options),
    assertions: options.clone(detail.assertions || []),
    extractors: options.clone(detail.extractors || []),
    preProcessors: options.clone(detail.preProcessors || []),
    postProcessors: options.clone(detail.postProcessors || []),
  }
}
