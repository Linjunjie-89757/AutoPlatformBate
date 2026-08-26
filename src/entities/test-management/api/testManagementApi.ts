import { httpDelete, httpGet, httpPost, httpPut, request, type ApiResponse } from '@/shared/api/request'

import type {
  TestActivityItem,
  TestPage,
  TestPlanDefectItem,
  TestPlanCreateDefectPayload,
  TestPlanExecutionAttachmentItem,
  TestPlanExecutionHistoryItem,
  TestPlanItem,
  TestPlanReportItem,
  TestPlanSavePayload,
  TestRequirementItem,
  TestRequirementImportResult,
  TestRequirementSavePayload,
  TestVersionItem,
  TestVersionSavePayload,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return { 'X-Workspace-Code': workspaceCode }
}

function unwrap<T>(payload: ApiResponse<T>, fallbackMessage = '测试管理请求失败') {
  if (payload.success === false) {
    throw new Error(payload.message || fallbackMessage)
  }
  return payload.data
}

function page<T>(payload: ApiResponse<TestPage<T>>, fallbackMessage: string) {
  const data = unwrap(payload, fallbackMessage)
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total || 0),
    pageNo: Number(data?.pageNo || 1),
    pageSize: Number(data?.pageSize || 10),
    totalPages: Number(data?.totalPages || 0),
  }
}

export const testManagementApi = {
  async listVersions(workspaceCode: string, params?: Record<string, string | number | undefined>) {
    return page(await httpGet<ApiResponse<TestPage<TestVersionItem>>>('/test-management/versions', {
      headers: workspaceHeaders(workspaceCode), params,
    }), '版本列表加载失败')
  },

  async getVersion(workspaceCode: string, id: number) {
    return unwrap(await httpGet<ApiResponse<TestVersionItem>>(`/test-management/versions/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    }), '版本详情加载失败')
  },

  async createVersion(workspaceCode: string, payload: TestVersionSavePayload) {
    return unwrap(await httpPost<ApiResponse<TestVersionItem>, TestVersionSavePayload>('/test-management/versions', payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '版本创建失败')
  },

  async updateVersion(workspaceCode: string, id: number, payload: TestVersionSavePayload & { expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestVersionItem>, typeof payload>(`/test-management/versions/${id}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '版本更新失败')
  },

  async transitionVersion(workspaceCode: string, id: number, payload: { targetStatus: string; expectedVersion: number; force?: boolean; reason?: string }) {
    return unwrap(await httpPost<ApiResponse<TestVersionItem>, typeof payload>(`/test-management/versions/${id}/transition`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '版本状态更新失败')
  },

  async listVersionRequirements(workspaceCode: string, id: number) {
    return page(await httpGet<ApiResponse<TestPage<TestRequirementItem>>>(`/test-management/versions/${id}/requirements`, {
      headers: workspaceHeaders(workspaceCode), params: { pageNo: 1, pageSize: 100 },
    }), '版本需求加载失败')
  },

  async listVersionActivities(workspaceCode: string, id: number) {
    return page(await httpGet<ApiResponse<TestPage<TestActivityItem>>>(`/test-management/versions/${id}/activities`, {
      headers: workspaceHeaders(workspaceCode), params: { pageNo: 1, pageSize: 100 },
    }), '版本操作记录加载失败')
  },

  async exportVersionReportPdf(workspaceCode: string, id: number) {
    const response = await request.get<Blob>(`/test-management/versions/${id}/report/pdf`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })
    const disposition = String(response.headers['content-disposition'] || '')
    const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    let fileName = '版本测试汇总报告.pdf'
    try {
      fileName = decodeURIComponent(utf8Name || plainName || fileName)
    } catch {
      fileName = plainName || fileName
    }
    return { blob: response.data, fileName }
  },

  async listRequirements(workspaceCode: string, params?: Record<string, string | number | undefined>) {
    return page(await httpGet<ApiResponse<TestPage<TestRequirementItem>>>('/test-management/requirements', {
      headers: workspaceHeaders(workspaceCode), params,
    }), '需求列表加载失败')
  },

  async getRequirement(workspaceCode: string, id: number) {
    return unwrap(await httpGet<ApiResponse<TestRequirementItem>>(`/test-management/requirements/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    }), '需求详情加载失败')
  },

  async createRequirement(workspaceCode: string, payload: TestRequirementSavePayload) {
    return unwrap(await httpPost<ApiResponse<TestRequirementItem>, TestRequirementSavePayload>('/test-management/requirements', payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '需求创建失败')
  },

  async updateRequirement(workspaceCode: string, id: number, payload: TestRequirementSavePayload & { expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestRequirementItem>, typeof payload>(`/test-management/requirements/${id}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '需求更新失败')
  },

  async deleteRequirement(workspaceCode: string, id: number, expectedVersion: number) {
    unwrap(await httpDelete<ApiResponse<null>>(`/test-management/requirements/${id}`, {
      headers: workspaceHeaders(workspaceCode), params: { expectedVersion },
    }), '需求删除失败')
  },

  async downloadRequirementImportTemplate(workspaceCode: string) {
    const response = await request.get<Blob>('/test-management/requirements/import-template', {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })
    const disposition = String(response.headers['content-disposition'] || '')
    const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    let fileName = '需求导入模板.xlsx'
    try {
      fileName = decodeURIComponent(utf8Name || plainName || fileName)
    } catch {
      fileName = plainName || fileName
    }
    return { blob: response.data, fileName }
  },

  async importRequirements(workspaceCode: string, defaultVersionId: number, file: File, duplicateStrategy = 'SKIP') {
    const form = new FormData()
    form.append('defaultVersionId', String(defaultVersionId))
    form.append('duplicateStrategy', duplicateStrategy)
    form.append('file', file)
    const response = await request.post<ApiResponse<TestRequirementImportResult>>('/test-management/requirements/import', form, {
      headers: { ...workspaceHeaders(workspaceCode), 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response.data, '需求导入失败')
  },

  async replaceRequirementCases(workspaceCode: string, id: number, caseIds: number[], expectedVersion: number) {
    return unwrap(await httpPut<ApiResponse<TestRequirementItem>, { caseIds: number[]; expectedVersion: number }>(
      `/test-management/requirements/${id}/cases`, { caseIds, expectedVersion }, { headers: workspaceHeaders(workspaceCode) },
    ), '需求用例关联失败')
  },

  async startRequirementReview(workspaceCode: string, id: number, expectedVersion: number) {
    return unwrap(await httpPost<ApiResponse<TestRequirementItem>, { expectedVersion: number }>(
      `/test-management/requirements/${id}/review/start`, { expectedVersion }, { headers: workspaceHeaders(workspaceCode) },
    ), '需求评审发起失败')
  },

  async reviewRequirementCase(workspaceCode: string, id: number, caseId: number, payload: { decision: string; comment?: string; expectedVersion: number }) {
    return unwrap(await httpPost<ApiResponse<TestRequirementItem>, typeof payload>(
      `/test-management/requirements/${id}/cases/${caseId}/review`, payload, { headers: workspaceHeaders(workspaceCode) },
    ), '用例评审保存失败')
  },

  async listRequirementActivities(workspaceCode: string, id: number) {
    return page(await httpGet<ApiResponse<TestPage<TestActivityItem>>>(`/test-management/requirements/${id}/activities`, {
      headers: workspaceHeaders(workspaceCode), params: { pageNo: 1, pageSize: 100 },
    }), '需求操作记录加载失败')
  },

  async listPlans(workspaceCode: string, params?: Record<string, string | number | undefined>) {
    return page(await httpGet<ApiResponse<TestPage<TestPlanItem>>>('/test-management/plans', {
      headers: workspaceHeaders(workspaceCode), params,
    }), '测试计划列表加载失败')
  },

  async getPlan(workspaceCode: string, id: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanItem>>(`/test-management/plans/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划详情加载失败')
  },

  async createPlan(workspaceCode: string, payload: TestPlanSavePayload) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, TestPlanSavePayload>('/test-management/plans', payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划创建失败')
  },

  async createAndStartPlan(workspaceCode: string, payload: TestPlanSavePayload) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, TestPlanSavePayload>('/test-management/plans/create-and-start', payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划创建并启动失败')
  },

  async updatePlan(workspaceCode: string, id: number, payload: Omit<TestPlanSavePayload, 'purpose' | 'draft'> & { expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划更新失败')
  },

  async copyPlan(workspaceCode: string, id: number, payload: {
    name?: string
    targetVersionId?: number | null
    copyRequirements?: boolean
    copyRequirementCases?: boolean
    copyManualCases?: boolean
    copyQualityStandards?: boolean
    expectedVersion: number
  }) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/copy`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划复制失败')
  },

  async deletePlan(workspaceCode: string, id: number, expectedVersion: number) {
    unwrap(await httpDelete<ApiResponse<null>>(`/test-management/plans/${id}`, {
      headers: workspaceHeaders(workspaceCode), params: { expectedVersion },
    }), '测试计划删除失败')
  },

  async replacePlanRequirements(workspaceCode: string, id: number, payload: { requirementIds: number[]; excludedAutoCaseIds: number[]; expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/requirements`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划需求范围保存失败')
  },

  async replacePlanCases(workspaceCode: string, id: number, payload: { caseIds: number[]; expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/cases`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划用例范围保存失败')
  },

  async addPlanCases(workspaceCode: string, id: number, payload: { caseIds: number[]; reason?: string; expectedVersion: number }) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/cases`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划添加用例失败')
  },

  async removePlanCase(workspaceCode: string, id: number, planCaseId: number, expectedVersion: number, reason?: string) {
    return unwrap(await httpDelete<ApiResponse<TestPlanItem>>(`/test-management/plans/${id}/cases/${planCaseId}`, {
      headers: workspaceHeaders(workspaceCode), params: { expectedVersion, reason },
    }), '测试计划移除用例失败')
  },

  async assignPlanCase(workspaceCode: string, id: number, planCaseId: number, payload: { assigneeId: number | null; expectedVersion: number }) {
    return unwrap(await httpPut<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/cases/${planCaseId}/assignee`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试用例负责人更新失败')
  },

  async updatePlanCaseSnapshot(workspaceCode: string, id: number, planCaseId: number, payload: {
    title: string
    module?: string | null
    priority: string
    precondition?: string | null
    steps?: string | null
    expectedResult?: string | null
    expectedVersion: number
  }) {
    return unwrap(await httpPut<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/cases/${planCaseId}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试用例快照更新失败')
  },

  async recordPlanCaseResult(workspaceCode: string, id: number, planCaseId: number, payload: { status: string; note?: string; expectedVersion: number }) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/cases/${planCaseId}/results`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试结果保存失败')
  },

  async listPlanCaseExecutions(workspaceCode: string, id: number, planCaseId: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanExecutionHistoryItem[]>>(`/test-management/plans/${id}/cases/${planCaseId}/executions`, {
      headers: workspaceHeaders(workspaceCode),
    }), '执行历史加载失败')
  },

  async uploadPlanCaseEvidence(workspaceCode: string, id: number, planCaseId: number, files: File[]) {
    const form = new FormData()
    files.forEach(file => form.append('files', file))
    const response = await request.post<ApiResponse<TestPlanExecutionAttachmentItem[]>>(`/test-management/plans/${id}/cases/${planCaseId}/evidence`, form, {
      headers: { ...workspaceHeaders(workspaceCode), 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response.data, '执行证据上传失败')
  },

  async listPlanCaseEvidence(workspaceCode: string, id: number, planCaseId: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanExecutionAttachmentItem[]>>(`/test-management/plans/${id}/cases/${planCaseId}/evidence`, {
      headers: workspaceHeaders(workspaceCode),
    }), '执行证据加载失败')
  },

  async downloadPlanCaseEvidence(workspaceCode: string, id: number, planCaseId: number, attachmentId: number) {
    const response = await request.get<Blob>(`/test-management/plans/${id}/cases/${planCaseId}/evidence/${attachmentId}/download`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })
    return response.data
  },

  async deletePlanCaseEvidence(workspaceCode: string, id: number, planCaseId: number, attachmentId: number) {
    return unwrap(await httpDelete<ApiResponse<null>>(`/test-management/plans/${id}/cases/${planCaseId}/evidence/${attachmentId}`, {
      headers: workspaceHeaders(workspaceCode),
    }), '执行证据删除失败')
  },

  async linkPlanDefect(workspaceCode: string, id: number, planCaseId: number, payload: { defectId: number; expectedVersion: number }) {
    return unwrap(await httpPost<ApiResponse<unknown>, typeof payload>(`/test-management/plans/${id}/cases/${planCaseId}/defects/link`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '缺陷关联失败')
  },

  async unlinkPlanDefect(workspaceCode: string, id: number, planCaseId: number, defectId: number) {
    return unwrap(await httpDelete<ApiResponse<unknown>>(`/test-management/plans/${id}/cases/${planCaseId}/defects/${defectId}`, {
      headers: workspaceHeaders(workspaceCode),
    }), '缺陷解除关联失败')
  },

  async planAction(workspaceCode: string, id: number, action: 'start' | 'block' | 'resume' | 'complete' | 'cancel', payload: { expectedVersion: number; force?: boolean; reason?: string }) {
    return unwrap(await httpPost<ApiResponse<TestPlanItem>, typeof payload>(`/test-management/plans/${id}/${action}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划状态更新失败')
  },

  async listPlanDefects(workspaceCode: string, id: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanDefectItem[]>>(`/test-management/plans/${id}/defects`, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试计划缺陷加载失败')
  },

  async listPlanCaseDefects(workspaceCode: string, id: number, planCaseId: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanDefectItem[]>>(`/test-management/plans/${id}/cases/${planCaseId}/defects`, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试用例关联缺陷加载失败')
  },

  async createPlanDefect(workspaceCode: string, id: number, planCaseId: number, payload: TestPlanCreateDefectPayload) {
    return unwrap(await httpPost<ApiResponse<unknown>, TestPlanCreateDefectPayload>(
      `/test-management/plans/${id}/cases/${planCaseId}/defects`, payload,
      { headers: workspaceHeaders(workspaceCode) },
    ), '测试计划缺陷创建失败')
  },

  async getPlanReport(workspaceCode: string, id: number) {
    return unwrap(await httpGet<ApiResponse<TestPlanReportItem | null>>(`/test-management/plans/${id}/report`, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试报告加载失败')
  },

  async exportPlanReportPdf(workspaceCode: string, id: number) {
    const response = await request.get<Blob>(`/test-management/plans/${id}/report/pdf`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })
    const disposition = String(response.headers['content-disposition'] || '')
    const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    let fileName = '测试计划报告.pdf'
    try {
      fileName = decodeURIComponent(utf8Name || plainName || fileName)
    } catch {
      fileName = plainName || fileName
    }
    return { blob: response.data, fileName }
  },

  async generatePlanReport(workspaceCode: string, id: number) {
    return unwrap(await httpPost<ApiResponse<TestPlanReportItem>, Record<string, never>>(`/test-management/plans/${id}/report/generate`, {}, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试报告生成失败')
  },

  async signPlanReport(workspaceCode: string, id: number, expectedVersion: number) {
    return unwrap(await httpPost<ApiResponse<TestPlanReportItem>, { expectedVersion: number }>(`/test-management/plans/${id}/report/sign`, { expectedVersion }, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试报告签署失败')
  },

  async revokePlanReportSignature(workspaceCode: string, id: number, expectedVersion: number) {
    return unwrap(await httpPost<ApiResponse<TestPlanReportItem>, { expectedVersion: number }>(`/test-management/plans/${id}/report/revoke-signature`, { expectedVersion }, {
      headers: workspaceHeaders(workspaceCode),
    }), '测试报告撤回签署失败')
  },

  async listPlanActivities(workspaceCode: string, id: number) {
    return page(await httpGet<ApiResponse<TestPage<TestActivityItem>>>(`/test-management/plans/${id}/activities`, {
      headers: workspaceHeaders(workspaceCode), params: { pageNo: 1, pageSize: 100 },
    }), '测试计划操作记录加载失败')
  },
}
