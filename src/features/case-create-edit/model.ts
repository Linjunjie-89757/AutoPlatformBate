import type {
  CaseDetail,
  CaseDirectoryNode,
  CaseDirectoryWorkspace,
  CaseSummaryItem,
  SaveCasePayload,
} from '@/entities/case'

export type CaseDialogMode = 'create' | 'edit' | 'copy'

export interface CaseForm {
  workspaceCode: string
  directoryId: number | null
  title: string
  caseType: string
  priority: string
  sourceType: string
  ownerId: string
  precondition: string
  steps: string
  expectedResult: string
}

export interface CaseDirectoryOption {
  label: string
  value: number
  workspaceCode: string
}

export const caseTypeOptions = [
  { label: '功能', value: 'FUNCTION' },
  { label: '回归', value: 'REGRESSION' },
  { label: '异常', value: 'EXCEPTION' },
] as const

export const caseSourceTypeOptions = [
  { label: '手工创建', value: 'MANUAL' },
  { label: '导入', value: 'IMPORTED' },
  { label: 'AI 生成', value: 'AI_GENERATED' },
] as const

export function createDefaultCaseForm(workspaceCode = 'ALL', directoryId: number | null = null): CaseForm {
  return {
    workspaceCode,
    directoryId,
    title: '',
    caseType: 'FUNCTION',
    priority: 'P1',
    sourceType: 'MANUAL',
    ownerId: '',
    precondition: '',
    steps: '',
    expectedResult: '',
  }
}

export function createCaseFormFromDetail(item: CaseDetail, mode: CaseDialogMode = 'edit'): CaseForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    directoryId: item.directoryId,
    title: mode === 'copy' ? `Copy-${item.title || ''}` : item.title || '',
    caseType: item.caseType || 'FUNCTION',
    priority: item.priority || 'P1',
    sourceType: item.sourceType || 'MANUAL',
    ownerId: item.ownerId ? String(item.ownerId) : '',
    precondition: item.precondition || '',
    steps: item.steps || '',
    expectedResult: item.expectedResult || '',
  }
}

export function createCaseFormFromSummary(
  item: CaseSummaryItem,
  fallbackWorkspaceCode = 'ALL',
  mode: CaseDialogMode = 'edit',
): CaseForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    directoryId: item.directoryId,
    title: mode === 'copy' ? `Copy-${item.title || ''}` : item.title || '',
    caseType: item.caseType || 'FUNCTION',
    priority: item.priority || 'P1',
    sourceType: item.sourceType || 'MANUAL',
    ownerId: '',
    precondition: '',
    steps: '',
    expectedResult: '',
  }
}

export function buildSaveCasePayload(form: CaseForm): SaveCasePayload {
  const ownerId = Number(form.ownerId)

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    directoryId: form.directoryId,
    title: form.title.trim(),
    caseType: form.caseType,
    priority: form.priority,
    sourceType: form.sourceType,
    ownerId: form.ownerId.trim() && Number.isFinite(ownerId) ? ownerId : null,
    precondition: form.precondition.trim(),
    steps: form.steps.trim(),
    expectedResult: form.expectedResult.trim(),
  }
}

export function validateCaseForm(form: CaseForm) {
  if (!form.title.trim()) {
    return '请输入用例名称'
  }
  if (!form.caseType) {
    return '请选择用例类型'
  }
  if (!form.priority) {
    return '请选择优先级'
  }
  if (!form.sourceType) {
    return '请选择来源'
  }
  if (form.ownerId.trim() && !Number.isFinite(Number(form.ownerId))) {
    return '负责人 ID 必须是数字'
  }
  return ''
}

export function flattenCaseDirectoryOptions(workspaces: CaseDirectoryWorkspace[]) {
  const options: CaseDirectoryOption[] = []

  function visit(nodes: CaseDirectoryNode[], prefix: string, workspaceCode: string) {
    nodes.forEach((node) => {
      const label = prefix ? `${prefix} / ${node.name}` : node.name
      options.push({
        label,
        value: node.id,
        workspaceCode,
      })
      visit(node.children, label, workspaceCode)
    })
  }

  workspaces.forEach((workspace) => {
    visit(workspace.children, workspace.workspaceName || workspace.workspaceCode, workspace.workspaceCode)
  })

  return options
}
