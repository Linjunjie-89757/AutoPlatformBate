import type { ApiRunStepResult } from '@/entities/api-automation'

export type ApiReportTreeNodeType = 'root' | 'item' | 'scenario' | 'request' | 'step'

export interface ApiReportTreeNode {
  key: string
  type: ApiReportTreeNodeType
  title: string
  subtitle: string
  result: string | null
  success: boolean | null
  durationMs: number | null
  statusCode: number | null
  failureSummary: string | null
  step: ApiRunStepResult | null
  children: ApiReportTreeNode[]
}
