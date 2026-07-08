import type { ComputedRef } from 'vue'

import type {
  ApiDefinitionDetail,
  ApiRequestConfigInput,
} from '@/entities/api-automation'
import { buildApiDefinitionPayload, buildApiRequestConfigPayload } from './apiRequestPayload'

interface UseApiRequestPayloadWorkspaceOptions {
  workspaceCode: ComputedRef<string>
  clone: <T>(value: T) => T
  syncRequestBodyRawText: (requestConfig: ApiRequestConfigInput) => void
}

export function useApiRequestPayloadWorkspace(options: UseApiRequestPayloadWorkspaceOptions) {
  function buildPayload(detail: ApiDefinitionDetail) {
    return buildApiDefinitionPayload(detail, {
      workspaceCode: options.workspaceCode.value,
      clone: options.clone,
      syncRequestBodyRawText: options.syncRequestBodyRawText,
    })
  }

  function buildRequestConfigPayload(detail: ApiDefinitionDetail) {
    return buildApiRequestConfigPayload(detail, {
      workspaceCode: options.workspaceCode.value,
      clone: options.clone,
      syncRequestBodyRawText: options.syncRequestBodyRawText,
    })
  }

  return {
    buildPayload,
    buildRequestConfigPayload,
  }
}
