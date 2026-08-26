import { defectApi, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'

export interface DefectTransitionForm {
  assigneeId: string
  toStatus: string
  actionComment: string
}

export interface DefectTransitionOption {
  value: string
  label: string
  color: string
  borderColor: string
  selectedBackground: string
}

const transitionOptions: Record<string, DefectTransitionOption[]> = {
  TODO: [
    { value: 'ASSIGNED', label: '指派处理', color: '#7816FF', borderColor: '#7816FF35', selectedBackground: '#7816FF12' },
  ],
  ASSIGNED: [
    { value: 'IN_PROGRESS', label: '开始处理', color: '#FF7D00', borderColor: '#FF7D0035', selectedBackground: '#FF7D0012' },
    { value: 'CLOSED', label: '直接关闭', color: '#00B42A', borderColor: '#00B42A35', selectedBackground: '#00B42A12' },
  ],
  IN_PROGRESS: [
    { value: 'PENDING_VERIFY', label: '提交验证', color: '#C89B00', borderColor: '#C89B0035', selectedBackground: '#C89B0012' },
    { value: 'CLOSED', label: '直接关闭', color: '#00B42A', borderColor: '#00B42A35', selectedBackground: '#00B42A12' },
  ],
  PENDING_VERIFY: [
    { value: 'CLOSED', label: '验证通过', color: '#00B42A', borderColor: '#00B42A35', selectedBackground: '#00B42A12' },
    { value: 'REJECTED', label: '验证驳回', color: '#F53F3F', borderColor: '#F53F3F35', selectedBackground: '#F53F3F12' },
  ],
  CLOSED: [
    { value: 'ASSIGNED', label: '重新打开', color: '#7816FF', borderColor: '#7816FF35', selectedBackground: '#7816FF12' },
  ],
  REJECTED: [
    { value: 'ASSIGNED', label: '重新指派', color: '#7816FF', borderColor: '#7816FF35', selectedBackground: '#7816FF12' },
    { value: 'IN_PROGRESS', label: '重新处理', color: '#FF7D00', borderColor: '#FF7D0035', selectedBackground: '#FF7D0012' },
  ],
}

export function getDefectTransitionOptions(status?: string | null) {
  return status ? (transitionOptions[status] ?? []) : []
}

export function createDefaultTransitionForm(_item?: DefectSummaryItem | null): DefectTransitionForm {
  return {
    assigneeId: '',
    toStatus: '',
    actionComment: '',
  }
}

export function validateTransitionForm(form: DefectTransitionForm) {
  if (form.assigneeId.trim() && !Number.isFinite(Number(form.assigneeId))) {
    return '处理人数据异常，请重新选择'
  }
  if (!form.toStatus) {
    return '请选择目标状态'
  }
  if (form.toStatus === 'ASSIGNED' && !form.assigneeId.trim()) {
    return '请选择处理人'
  }
  return ''
}

export function buildTransitionPayload(
  form: DefectTransitionForm,
  workspaceCode = 'ALL',
): TransitionDefectPayload {
  return {
    workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
    toStatus: form.toStatus,
    assigneeId: form.assigneeId.trim() ? Number(form.assigneeId.trim()) : undefined,
    actionComment: form.actionComment.trim() || undefined,
  }
}

export async function transitionDefect(
  item: DefectSummaryItem,
  workspaceCode = 'ALL',
  payload: TransitionDefectPayload,
) {
  return defectApi.transitionDefect(workspaceCode, item.id, payload)
}
