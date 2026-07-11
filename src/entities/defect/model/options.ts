import type { DefectPriority, DefectSeverity, DefectStatus } from './types'

export const defectStatusOptions: Array<{ label: string; value: DefectStatus }> = [
  { label: '新建', value: 'TODO' },
  { label: '已指派', value: 'ASSIGNED' },
  { label: '处理中', value: 'IN_PROGRESS' },
  { label: '待验证', value: 'PENDING_VERIFY' },
  { label: '已关闭', value: 'CLOSED' },
  { label: '已驳回', value: 'REJECTED' },
]

export const defectSeverityOptions: Array<{ label: string; value: DefectSeverity }> = [
  { label: '致命', value: 'CRITICAL' },
  { label: '严重', value: 'HIGH' },
  { label: '一般', value: 'MEDIUM' },
  { label: '轻微', value: 'LOW' },
]

export const defectPriorityOptions: Array<{ label: DefectPriority; value: DefectPriority }> = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
]
