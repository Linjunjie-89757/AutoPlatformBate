import { httpDelete, httpGet, httpPost, httpPut, request, type ApiResponse } from '@/shared/api/request'

import type {
  AiCaseAdoptionItem,
  AiCaseCandidateItem,
  AiCaseCandidateVersionPayload,
  AiCaseConfigResponse,
  AiGenerationTaskEventItem,
  AiGenerationTaskItem,
  AiRequirementAssetItem,
  CreateAiGenerationTaskPayload,
  ImportRequirementDocumentResult,
  SaveAiCaseConfigPayload,
  TestAiCaseConfigResponse,
  UpdateAiGenerationTaskPayload,
  UpdateAiCaseCandidatePayload,
  ValidateAiGenerationImageSupportPayload,
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

export const caseAiApi = {
  async getConfig(workspaceCode = 'ALL', targetWorkspaceCode?: string) {
    const payload = await httpGet<ApiResponse<AiCaseConfigResponse>>('/cases/ai/config', {
      headers: workspaceHeaders(workspaceCode),
      params: targetWorkspaceCode ? { targetWorkspaceCode } : undefined,
    })

    return unwrapApiResponse(payload)
  },

  async createConfig(workspaceCode: string, data: SaveAiCaseConfigPayload) {
    const payload = await httpPost<ApiResponse<AiCaseConfigResponse['generatorConfig']>, SaveAiCaseConfigPayload>(
      '/cases/ai/config',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async updateConfig(workspaceCode: string, id: number, data: SaveAiCaseConfigPayload) {
    const payload = await httpPut<ApiResponse<AiCaseConfigResponse['generatorConfig']>, SaveAiCaseConfigPayload>(
      `/cases/ai/config/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async testConfig(workspaceCode: string, data: SaveAiCaseConfigPayload) {
    const payload = await httpPost<ApiResponse<TestAiCaseConfigResponse>, SaveAiCaseConfigPayload>(
      '/cases/ai/config/test',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async bootstrapFromLegacy(workspaceCode: string) {
    const payload = await httpPost<ApiResponse<AiCaseConfigResponse>, undefined>(
      '/cases/ai/config/bootstrap-from-legacy',
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async importRequirementDocument(workspaceCode: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const payload = await httpPost<ApiResponse<ImportRequirementDocumentResult>, FormData>(
      '/cases/ai/requirement-import',
      formData,
      {
        headers: {
          ...workspaceHeaders(workspaceCode),
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    return unwrapApiResponse(payload)
  },

  async uploadAssets(workspaceCode: string, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    const payload = await httpPost<ApiResponse<AiRequirementAssetItem[]>, FormData>(
      '/cases/ai/assets',
      formData,
      {
        headers: {
          ...workspaceHeaders(workspaceCode),
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    return unwrapApiResponse(payload)
  },

  async deleteAsset(workspaceCode: string, id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/cases/ai/assets/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async downloadAsset(workspaceCode: string, id: number) {
    const response = await request.get<Blob>(`/cases/ai/assets/${id}/download`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })

    return response.data
  },

  async validateImageSupport(workspaceCode: string, data: ValidateAiGenerationImageSupportPayload) {
    const payload = await httpPost<ApiResponse<null>, ValidateAiGenerationImageSupportPayload>(
      '/cases/ai/tasks/image-support/validate',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async createTask(workspaceCode: string, data: CreateAiGenerationTaskPayload) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, CreateAiGenerationTaskPayload>(
      '/cases/ai/tasks',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async listTasks(workspaceCode: string) {
    const payload = await httpGet<ApiResponse<AiGenerationTaskItem[]>>('/cases/ai/tasks', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getTask(workspaceCode: string, taskId: string) {
    const payload = await httpGet<ApiResponse<AiGenerationTaskItem>>(`/cases/ai/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async streamTaskEvents(
    workspaceCode: string,
    taskId: string,
    handlers: {
      signal?: AbortSignal
      onEvent: (event: AiGenerationTaskEventItem) => void
    },
  ) {
    const response = await fetch(`${request.defaults.baseURL}/cases/ai/tasks/${encodeURIComponent(taskId)}/events/stream`, {
      method: 'GET',
      credentials: 'include',
      signal: handlers.signal,
      headers: workspaceHeaders(workspaceCode),
    })

    if (!response.ok || !response.body) {
      let message = '订阅 AI 生成任务事件失败'
      try {
        const errorPayload = await response.json() as ApiResponse<null>
        message = errorPayload.message || message
      } catch {
        // ignore non-json streaming errors
      }
      throw new Error(message)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const consumeStreamText = (chunk: string) => {
      const blocks = chunk.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const dataLines = block
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
        if (!dataLines.length) {
          continue
        }
        try {
          handlers.onEvent(JSON.parse(dataLines.join('\n')) as AiGenerationTaskEventItem)
        } catch {
          // ignore malformed fragments and keep consuming later events
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      consumeStreamText(buffer + decoder.decode(value, { stream: true }))
    }

    consumeStreamText(buffer + decoder.decode())
    if (buffer.trim()) {
      try {
        const data = buffer
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n')
        if (data) {
          handlers.onEvent(JSON.parse(data) as AiGenerationTaskEventItem)
        }
      } catch {
        // ignore malformed trailing stream content
      }
    }
  },

  async cancelTask(workspaceCode: string, taskId: string) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, undefined>(
      `/cases/ai/tasks/${taskId}/cancel`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async retryTask(workspaceCode: string, taskId: string) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, undefined>(
      `/cases/ai/tasks/${taskId}/retry`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async deleteTask(workspaceCode: string, taskId: string) {
    const payload = await httpDelete<ApiResponse<null>>(`/cases/ai/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async updateTask(workspaceCode: string, taskId: string, data: UpdateAiGenerationTaskPayload) {
    const payload = await httpPut<ApiResponse<AiGenerationTaskItem>, UpdateAiGenerationTaskPayload>(
      `/cases/ai/tasks/${taskId}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async adoptCase(workspaceCode: string, taskId: string, caseIndex: number, directoryId: number) {
    const payload = await httpPost<ApiResponse<AiCaseAdoptionItem>, { directoryId: number }>(
      `/cases/ai/tasks/${taskId}/adoptions/${caseIndex}`,
      { directoryId },
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async listCandidates(workspaceCode: string, taskId: string) {
    const payload = await httpGet<ApiResponse<AiCaseCandidateItem[]>>(
      `/cases/ai/tasks/${taskId}/candidates`,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async getCandidate(workspaceCode: string, taskId: string, candidateId: string) {
    const payload = await httpGet<ApiResponse<AiCaseCandidateItem>>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}`,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async keepCandidateOriginal(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    data: AiCaseCandidateVersionPayload,
  ) {
    const payload = await httpPost<ApiResponse<AiCaseCandidateItem>, AiCaseCandidateVersionPayload>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/keep-original`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async applyCandidateSuggestion(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    data: AiCaseCandidateVersionPayload,
  ) {
    const payload = await httpPost<ApiResponse<AiCaseCandidateItem>, AiCaseCandidateVersionPayload>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/apply-suggestion`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async updateCandidateCurrentCase(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    data: UpdateAiCaseCandidatePayload,
  ) {
    const payload = await httpPut<ApiResponse<AiCaseCandidateItem>, UpdateAiCaseCandidatePayload>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/current-case`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async excludeCandidate(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    data: AiCaseCandidateVersionPayload,
  ) {
    const payload = await httpPost<ApiResponse<AiCaseCandidateItem>, AiCaseCandidateVersionPayload>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/exclude`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async restoreCandidate(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    data: AiCaseCandidateVersionPayload,
  ) {
    const payload = await httpPost<ApiResponse<AiCaseCandidateItem>, AiCaseCandidateVersionPayload>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/restore`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async adoptCandidate(
    workspaceCode: string,
    taskId: string,
    candidateId: string,
    directoryId: number,
  ) {
    const payload = await httpPost<ApiResponse<AiCaseAdoptionItem>, { directoryId: number }>(
      `/cases/ai/tasks/${taskId}/candidates/${candidateId}/adopt`,
      { directoryId },
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },
}
