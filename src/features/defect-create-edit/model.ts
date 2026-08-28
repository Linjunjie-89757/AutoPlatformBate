import type { DefectDetail, DefectPriority, DefectSeverity, DefectSourceType, DefectSummaryItem, SaveDefectPayload } from '@/entities/defect'

export type DefectDialogMode = 'create' | 'edit'

export interface DefectForm {
  workspaceCode: string
  title: string
  description: string
  reproductionSteps: string
  expectedResult: string
  actualResult: string
  moduleName: string
  versionName: string
  bugType: string
  environmentName: string
  priority: DefectPriority
  severity: DefectSeverity
  sourceType: DefectSourceType
  assigneeId: string
  relatedCaseId: string
  relatedCaseIds: string[]
  tagsText: string
  tags: string[]
}

export function createDefaultDefectForm(workspaceCode = 'ALL'): DefectForm {
  return {
    workspaceCode,
    title: '',
    description: '',
    reproductionSteps: '',
    expectedResult: '',
    actualResult: '',
    moduleName: '',
    versionName: '',
    bugType: '',
    environmentName: '',
    priority: 'P1',
    severity: 'MEDIUM',
    sourceType: 'MANUAL',
    assigneeId: '',
    relatedCaseId: '',
    relatedCaseIds: [],
    tagsText: '',
    tags: [],
  }
}

export function createDefectFormFromDetail(item: DefectDetail): DefectForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    title: item.title || '',
    description: item.description || '',
    reproductionSteps: item.reproductionSteps || '',
    expectedResult: item.expectedResult || '',
    actualResult: item.actualResult || '',
    moduleName: item.moduleName || '',
    versionName: item.versionName || '',
    bugType: item.bugType || '',
    environmentName: item.environmentName || '',
    priority: (item.priority || 'P1') as DefectPriority,
    severity: (item.severity || 'MEDIUM') as DefectSeverity,
    sourceType: (item.sourceType || 'MANUAL') as DefectSourceType,
    assigneeId: item.assigneeId ? String(item.assigneeId) : '',
    relatedCaseId: item.relatedCaseId ? String(item.relatedCaseId) : '',
    relatedCaseIds: Array.isArray(item.relatedCases) ? item.relatedCases.map(caseItem => String(caseItem.id)) : item.relatedCaseId ? [String(item.relatedCaseId)] : [],
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
  }
}

export function createDefectFormFromSummary(item: DefectSummaryItem, fallbackWorkspaceCode = 'ALL'): DefectForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    title: item.title || '',
    description: '',
    reproductionSteps: '',
    expectedResult: '',
    actualResult: '',
    moduleName: '',
    versionName: '',
    bugType: '',
    environmentName: '',
    priority: (item.priority || 'P1') as DefectPriority,
    severity: (item.severity || 'MEDIUM') as DefectSeverity,
    sourceType: 'MANUAL',
    assigneeId: '',
    relatedCaseId: item.relatedCaseId ? String(item.relatedCaseId) : '',
    relatedCaseIds: item.relatedCaseId ? [String(item.relatedCaseId)] : [],
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
  }
}

function parseOptionalId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const id = Number(trimmed)
  return Number.isFinite(id) ? id : null
}

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildSaveDefectPayload(form: DefectForm): SaveDefectPayload {
  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    title: form.title.trim(),
    description: form.description.trim(),
    reproductionSteps: form.reproductionSteps.trim(),
    expectedResult: form.expectedResult.trim(),
    actualResult: form.actualResult.trim(),
    moduleName: form.moduleName.trim(),
    versionName: form.versionName.trim(),
    bugType: form.bugType.trim(),
    environmentName: form.environmentName.trim(),
    priority: form.priority,
    severity: form.severity,
    sourceType: form.sourceType,
    assigneeId: parseOptionalId(form.assigneeId),
    relatedCaseId: form.relatedCaseIds.length ? parseOptionalId(form.relatedCaseIds[0]) : parseOptionalId(form.relatedCaseId),
    tags: form.tags.length ? form.tags : parseTags(form.tagsText),
  }
}

export function validateDefectForm(form: DefectForm, options: { assigneeRequired?: boolean } = {}) {
  if (!form.title.trim()) {
    return '请输入缺陷标题'
  }
  if (!form.description.trim()) {
    return '请输入缺陷描述'
  }
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return '请选择具体工作空间'
  }
  if (!form.priority) {
    return '请选择优先级'
  }
  if (!form.severity) {
    return '请选择严重级别'
  }
  if (options.assigneeRequired && !form.assigneeId.trim()) {
    return '请选择处理人'
  }
  if (form.assigneeId.trim() && !Number.isFinite(Number(form.assigneeId))) {
    return '处理人参数无效'
  }
  if (form.relatedCaseId.trim() && !Number.isFinite(Number(form.relatedCaseId))) {
    return '关联用例数据异常，请重新选择'
  }
  return ''
}
