import { httpDelete, httpGet, httpPost, httpPut, request, type ApiResponse } from '@/shared/api/request'

import type {
  AddDefectCommentPayload,
  AssignDefectPayload,
  AssignDefectResult,
  DefectAttachment,
  DefectCaseSummary,
  DefectComment,
  DefectDetail,
  DefectListQuery,
  DefectListResponse,
  DefectStatistics,
  DefectSummaryItem,
  ReplaceDefectCasesPayload,
  SaveDefectPayload,
  TransitionDefectPayload,
  TransitionDefectResult,
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

function cleanQuery(query?: DefectListQuery) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function normalizeDefectItem(item: DefectSummaryItem): DefectSummaryItem {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    assigneeName: item.assigneeName || null,
    reporterName: item.reporterName || null,
    updatedByName: item.updatedByName || null,
    relatedCaseCount: Number(item.relatedCaseCount || 0),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
  }
}

function normalizeDefectComment(item: DefectComment): DefectComment {
  return {
    ...item,
    commenterId: item.commenterId ?? null,
    commenterName: item.commenterName || null,
    content: item.content || '',
    createdAt: item.createdAt || null,
  }
}

function normalizeDefectAttachment(item: DefectAttachment): DefectAttachment {
  return {
    ...item,
    fileName: item.fileName || '-',
    contentType: item.contentType || null,
    fileSize: item.fileSize ?? null,
    downloadUrl: item.downloadUrl || null,
    uploadedByName: item.uploadedByName || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeDefectCase(item: DefectCaseSummary): DefectCaseSummary {
  return {
    ...item,
    caseNo: item.caseNo || null,
    title: item.title || null,
    workspaceCode: item.workspaceCode || null,
    workspaceName: item.workspaceName || null,
    directoryId: item.directoryId ?? null,
    directoryName: item.directoryName || null,
    modulePath: item.modulePath || null,
    executionStatus: item.executionStatus || null,
    executionComment: item.executionComment || null,
    executedAt: item.executedAt || null,
  }
}

function normalizeDefectDetail(item: DefectDetail): DefectDetail {
  const summary = normalizeDefectItem(item)

  return {
    ...item,
    ...summary,
    description: item.description || '',
    reproductionSteps: item.reproductionSteps || '',
    expectedResult: item.expectedResult || '',
    actualResult: item.actualResult || '',
    moduleName: item.moduleName || '',
    versionName: item.versionName || '',
    sourceType: item.sourceType || null,
    assigneeId: item.assigneeId ?? null,
    reporterId: item.reporterId ?? null,
    relatedCaseId: item.relatedCaseId ?? null,
    relatedCases: Array.isArray(item.relatedCases) ? item.relatedCases.map(normalizeDefectCase) : [],
    relatedReportId: item.relatedReportId ?? null,
    relatedTaskId: item.relatedTaskId ?? null,
    attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeDefectAttachment) : [],
    activities: Array.isArray(item.activities) ? item.activities : [],
    flows: Array.isArray(item.flows) ? item.flows : [],
    comments: Array.isArray(item.comments) ? item.comments.map(normalizeDefectComment) : [],
  }
}

function normalizeDefectListResponse(page: DefectListResponse): DefectListResponse {
  const items = Array.isArray(page.items) ? page.items.map(normalizeDefectItem) : []
  const total = Number(page.total ?? items.length)
  const pageSize = Number(page.pageSize || total || items.length || 10)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize,
    totalPages: Number(page.totalPages || (total > 0 ? Math.ceil(total / Math.max(pageSize, 1)) : 0)),
  }
}

export const defectApi = {
  async getDefects(workspaceCode = 'ALL', query?: DefectListQuery) {
    const payload = await httpGet<ApiResponse<DefectListResponse>>('/bugs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizeDefectListResponse(unwrapApiResponse(payload))
  },

  async getDefectStatistics(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<DefectStatistics>>('/bugs/statistics', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getDefectDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<DefectDetail>>(`/bugs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async getDefectComments(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<DefectComment[]>>(`/bugs/${id}/comments`, {
      headers: workspaceHeaders(workspaceCode),
    })

    const comments = unwrapApiResponse(payload)
    return Array.isArray(comments) ? comments.map(normalizeDefectComment) : []
  },

  async addDefectComment(workspaceCode = 'ALL', id: number, data: AddDefectCommentPayload) {
    const payload = await httpPost<ApiResponse<DefectComment>, AddDefectCommentPayload>(`/bugs/${id}/comments`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectComment(unwrapApiResponse(payload))
  },

  async downloadDefectAttachment(workspaceCode = 'ALL', id: number, attachmentId: number) {
    const response = await request.get<Blob>(`/bugs/${id}/attachments/${attachmentId}/download`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })

    return response.data
  },

  async uploadDefectAttachments(workspaceCode = 'ALL', id: number, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    const payload = await httpPost<ApiResponse<DefectAttachment[]>, FormData>(`/bugs/${id}/attachments`, formData, {
      headers: {
        ...workspaceHeaders(workspaceCode),
        'Content-Type': 'multipart/form-data',
      },
    })

    const attachments = unwrapApiResponse(payload)
    return Array.isArray(attachments) ? attachments.map(normalizeDefectAttachment) : []
  },

  async deleteDefectAttachment(workspaceCode = 'ALL', id: number, attachmentId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/bugs/${id}/attachments/${attachmentId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createDefect(workspaceCode = 'ALL', data: SaveDefectPayload) {
    const payload = await httpPost<ApiResponse<DefectDetail>, SaveDefectPayload>('/bugs', data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async createDefectFromCase(workspaceCode = 'ALL', caseId: number, data: SaveDefectPayload) {
    const payload = await httpPost<ApiResponse<DefectDetail>, SaveDefectPayload>(`/cases/${caseId}/bugs`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async updateDefect(workspaceCode = 'ALL', id: number, data: SaveDefectPayload) {
    const payload = await httpPut<ApiResponse<DefectDetail>, SaveDefectPayload>(`/bugs/${id}`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async getDefectCases(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<DefectCaseSummary[]>>(`/bugs/${id}/cases`, {
      headers: workspaceHeaders(workspaceCode),
    })

    const cases = unwrapApiResponse(payload)
    return Array.isArray(cases) ? cases.map(normalizeDefectCase) : []
  },

  async replaceDefectCases(workspaceCode = 'ALL', id: number, data: ReplaceDefectCasesPayload) {
    const payload = await httpPut<ApiResponse<DefectDetail>, ReplaceDefectCasesPayload>(`/bugs/${id}/cases`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async deleteDefectCase(workspaceCode = 'ALL', id: number, caseId: number) {
    const payload = await httpDelete<ApiResponse<DefectDetail>>(`/bugs/${id}/cases/${caseId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async deleteDefect(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/bugs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async assignDefect(workspaceCode = 'ALL', id: number, data: AssignDefectPayload) {
    const payload = await httpPost<ApiResponse<AssignDefectResult>, AssignDefectPayload>(`/bugs/${id}/assign`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async transitionDefect(workspaceCode = 'ALL', id: number, data: TransitionDefectPayload) {
    const payload = await httpPost<ApiResponse<TransitionDefectResult>, TransitionDefectPayload>(
      `/bugs/${id}/transition`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },
}
