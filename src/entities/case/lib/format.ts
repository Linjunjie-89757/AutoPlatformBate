import type { CaseSummaryItem } from '../model/types'

export function formatCaseDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function getCasePriorityTone(priority: string) {
  if (priority === 'P0') {
    return 'danger'
  }
  if (priority === 'P1') {
    return 'warning'
  }
  if (priority === 'P2') {
    return 'primary'
  }
  return 'default'
}

export function getCaseReviewStatusMeta(status: string) {
  if (status === 'PASSED') {
    return { label: '已通过', tone: 'success' as const }
  }
  if (status === 'REJECTED') {
    return { label: '未通过', tone: 'danger' as const }
  }
  return { label: '待评审', tone: 'default' as const }
}

export function getCaseExecutionStatusMeta(status: string) {
  if (status === 'PASSED') {
    return { label: '已通过', tone: 'success' as const }
  }
  if (status === 'FAILED') {
    return { label: '失败', tone: 'danger' as const }
  }
  if (status === 'BLOCKED') {
    return { label: '阻塞中', tone: 'warning' as const }
  }
  return { label: '未执行', tone: 'default' as const }
}

export function getCaseDirectoryText(item: CaseSummaryItem) {
  return item.directoryName || '空间根目录'
}

export function matchesCaseClientFilter(
  item: CaseSummaryItem,
  filter: {
    keyword: string
    priority: string
    reviewStatus: string
    sourceType?: string
    createdByName?: string
    executionStatus?: string
  },
) {
  const keyword = filter.keyword.trim().toLowerCase()
  if (keyword) {
    const haystack = [item.caseNo, item.title, item.directoryName, item.workspaceName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(keyword)) {
      return false
    }
  }

  if (filter.priority && item.priority !== filter.priority) {
    return false
  }
  if (filter.reviewStatus && item.reviewStatus !== filter.reviewStatus) {
    return false
  }
  if (filter.sourceType && item.sourceType !== filter.sourceType) {
    return false
  }
  if (filter.createdByName && item.createdByName !== filter.createdByName) {
    return false
  }
  if (filter.executionStatus && item.executionStatus !== filter.executionStatus) {
    return false
  }

  return true
}
