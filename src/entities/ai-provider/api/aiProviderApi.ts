import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  AiProviderConnectionItem,
  AiProviderModelItem,
  AiProviderSyncModelsResult,
  AiProviderTestResult,
  PreviewAiProviderModelsPayload,
  PreviewAiProviderModelsResult,
  ProbeAiProviderModelPayload,
  SaveAiProviderConnectionPayload,
  UpdateAiProviderStatusPayload,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export const aiProviderApi = {
  async getProviderConnections(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<AiProviderConnectionItem[]>>('/cases/ai/providers', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createProviderConnection(workspaceCode: string, payload: SaveAiProviderConnectionPayload) {
    const response = await httpPost<ApiResponse<AiProviderConnectionItem>, SaveAiProviderConnectionPayload>(
      '/cases/ai/providers',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateProviderConnection(workspaceCode: string, id: number, payload: SaveAiProviderConnectionPayload) {
    const response = await httpPut<ApiResponse<AiProviderConnectionItem>, SaveAiProviderConnectionPayload>(
      `/cases/ai/providers/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async testProviderConnection(workspaceCode: string, id: number) {
    const response = await httpPost<ApiResponse<AiProviderTestResult>, undefined>(
      `/cases/ai/providers/${id}/test`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async previewProviderModels(workspaceCode: string, payload: PreviewAiProviderModelsPayload) {
    const response = await httpPost<ApiResponse<PreviewAiProviderModelsResult>, PreviewAiProviderModelsPayload>(
      '/cases/ai/providers/preview-models',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async syncProviderModels(workspaceCode: string, id: number) {
    const response = await httpPost<ApiResponse<AiProviderSyncModelsResult>, undefined>(
      `/cases/ai/providers/${id}/fetch-models`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteProviderConnection(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<null>>(`/cases/ai/providers/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getProviderModels(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<AiProviderModelItem[]>>(`/cases/ai/providers/${id}/models`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async probeProviderModel(workspaceCode: string, id: number, payload: ProbeAiProviderModelPayload) {
    const response = await httpPost<ApiResponse<AiProviderModelItem>, ProbeAiProviderModelPayload>(
      `/cases/ai/providers/${id}/models/probe`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateProviderStatus(workspaceCode: string, id: number, payload: UpdateAiProviderStatusPayload) {
    const response = await httpPut<ApiResponse<AiProviderConnectionItem>, UpdateAiProviderStatusPayload>(
      `/cases/ai/providers/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },
}
