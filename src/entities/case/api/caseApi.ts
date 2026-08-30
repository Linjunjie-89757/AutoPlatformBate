import { httpDelete, httpGet, httpPost, httpPut, request, type ApiResponse } from '@/shared/api/request'

import type {
  BatchUpdateCasesPayload,
  BatchUpdateCasesResult,
  BatchDeleteCasesPayload,
  BatchMoveCasesPayload,
  CaseDetail,
  CaseDirectoryNode,
  CaseExecutionAttachment,
  CaseExecutionHistoryItem,
  CaseImportDuplicateStrategy,
  CaseExportQuery,
  CaseImportResult,
  CaseDirectoryWorkspace,
  CreateCaseDirectoryPayload,
  CaseListQuery,
  MoveCaseDirectoryPayload,
  RenameCaseDirectoryPayload,
  ReviewCasePayload,
  ReviewCaseResult,
  RunCasePayload,
  RunCaseResult,
  SaveCasePayload,
  CaseSummaryItem,
  PageResponse,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function cleanQuery<T extends object>(query?: T) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

function normalizeCaseAttachment(item: CaseExecutionAttachment): CaseExecutionAttachment {
  return {
    ...item,
    fileName: item.fileName || '-',
    fileSize: item.fileSize ?? null,
    contentType: item.contentType || null,
    downloadUrl: item.downloadUrl || null,
    uploadedByName: item.uploadedByName || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeCaseDetail(item: CaseDetail): CaseDetail {
  return {
    ...item,
    attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeCaseAttachment) : [],
  }
}

export const caseApi = {
  async getCases(workspaceCode = 'ALL', query?: CaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<CaseSummaryItem>>>('/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async getCaseDirectories(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<CaseDirectoryWorkspace[]>>('/cases/directories', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createCaseDirectory(workspaceCode = 'ALL', payload: CreateCaseDirectoryPayload) {
    const response = await httpPost<ApiResponse<CaseDirectoryNode>, CreateCaseDirectoryPayload>(
      '/cases/directories',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async renameCaseDirectory(id: number, workspaceCode = 'ALL', payload: RenameCaseDirectoryPayload) {
    const response = await httpPut<ApiResponse<CaseDirectoryWorkspace>, RenameCaseDirectoryPayload>(
      `/cases/directories/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async moveCaseDirectory(id: number, workspaceCode = 'ALL', payload: MoveCaseDirectoryPayload) {
    const response = await httpPost<ApiResponse<CaseDirectoryWorkspace>, MoveCaseDirectoryPayload>(
      `/cases/directories/${id}/move`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteCaseDirectory(id: number, workspaceCode = 'ALL') {
    const response = await httpDelete<ApiResponse<null>>(`/cases/directories/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getCaseDetail(id: number, workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<CaseDetail>>(`/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async createCase(workspaceCode = 'ALL', payload: SaveCasePayload) {
    const response = await httpPost<ApiResponse<CaseSummaryItem>, SaveCasePayload>('/cases', payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateCase(id: number, workspaceCode = 'ALL', payload: SaveCasePayload) {
    const response = await httpPut<ApiResponse<CaseSummaryItem>, SaveCasePayload>(`/cases/${id}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async deleteCase(id: number, workspaceCode = 'ALL') {
    const response = await httpDelete<ApiResponse<null>>(`/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async runCase(id: number, workspaceCode = 'ALL', payload: RunCasePayload) {
    const response = await httpPost<ApiResponse<RunCaseResult>, RunCasePayload>(`/cases/${id}/execute`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeCaseDetail(unwrapApiResponse(response))
  },

  async getCaseExecutionHistory(id: number, workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<CaseExecutionHistoryItem>>>(`/cases/${id}/executions`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async uploadCaseExecutionAttachments(workspaceCode = 'ALL', id: number, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    const payload = await httpPost<ApiResponse<CaseExecutionAttachment[]>, FormData>(
      `/cases/${id}/attachments`,
      formData,
      {
        headers: {
          ...workspaceHeaders(workspaceCode),
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    const attachments = unwrapApiResponse(payload)
    return Array.isArray(attachments) ? attachments.map(normalizeCaseAttachment) : []
  },

  async downloadCaseExecutionAttachment(workspaceCode = 'ALL', caseId: number, attachmentId: number) {
    const response = await request.get<Blob>(`/cases/${caseId}/attachments/${attachmentId}/download`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })

    return response.data
  },

  async deleteCaseExecutionAttachment(workspaceCode = 'ALL', caseId: number, attachmentId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/cases/${caseId}/attachments/${attachmentId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async reviewCase(id: number, workspaceCode = 'ALL', payload: ReviewCasePayload) {
    const response = await httpPost<ApiResponse<ReviewCaseResult>, ReviewCasePayload>(`/cases/${id}/review`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async batchUpdateCases(workspaceCode = 'ALL', payload: BatchUpdateCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchUpdateCasesPayload>(
      '/cases/batch/update',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async downloadCaseImportTemplate() {
    const response = await request.get<Blob>('/cases/import/template', {
      responseType: 'blob',
    })
    return response.data
  },

  async exportCases(workspaceCode: string, query: CaseExportQuery) {
    const response = await request.get<Blob>('/cases/export', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery({
        ...query,
        caseIds: query.caseIds?.join(','),
      }),
      responseType: 'blob',
    })
    return response.data
  },

  async importCases(
    workspaceCode: string,
    payload: {
      file: File
      directoryId?: number | null
      duplicateStrategy: CaseImportDuplicateStrategy
    },
  ) {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('duplicateStrategy', payload.duplicateStrategy)
    if (payload.directoryId != null) {
      formData.append('directoryId', String(payload.directoryId))
    }
    const response = await httpPost<ApiResponse<CaseImportResult>, FormData>('/cases/import', formData, {
      headers: {
        ...workspaceHeaders(workspaceCode),
        'Content-Type': 'multipart/form-data',
      },
    })
    return unwrapApiResponse(response)
  },

  async batchMoveCases(workspaceCode = 'ALL', payload: BatchMoveCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchMoveCasesPayload>(
      '/cases/batch/move',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async batchDeleteCases(workspaceCode = 'ALL', payload: BatchDeleteCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchDeleteCasesPayload>(
      '/cases/batch/delete',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },
}
