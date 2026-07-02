import {
  defectSeverityOptions,
  defectStatusOptions,
} from '../model/options'
import type { DefectClientFilter, DefectSummaryItem } from '../model/types'

export function formatDefectDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function getDefectPriorityTone(priority: string) {
  if (priority === 'P0') {
    return 'critical'
  }
  if (priority === 'P1') {
    return 'p1'
  }
  if (priority === 'P2') {
    return 'p2'
  }
  if (priority === 'P3') {
    return 'low'
  }

  return 'neutral'
}

export function getDefectStatusMeta(status: string) {
  const option = defectStatusOptions.find((item) => item.value === status)

  if (status === 'CLOSED') {
    return { label: option?.label || status || '-', tone: 'closed' as const }
  }
  if (status === 'REJECTED') {
    return { label: option?.label || status || '-', tone: 'hold' as const }
  }
  if (status === 'IN_PROGRESS') {
    return { label: option?.label || status || '-', tone: 'processing' as const }
  }
  if (status === 'PENDING_VERIFY') {
    return { label: option?.label || status || '-', tone: 'verify' as const }
  }
  if (status === 'ASSIGNED') {
    return { label: option?.label || status || '-', tone: 'assigned' as const }
  }
  if (status === 'TODO') {
    return { label: option?.label || status || '-', tone: 'new' as const }
  }

  return { label: option?.label || status || '-', tone: 'neutral' as const }
}

export function getDefectSeverityMeta(severity: string) {
  const option = defectSeverityOptions.find((item) => item.value === severity)

  if (severity === 'CRITICAL') {
    return { label: option?.label || severity || '-', tone: 'critical' as const }
  }
  if (severity === 'HIGH') {
    return { label: option?.label || severity || '-', tone: 'high' as const }
  }
  if (severity === 'MEDIUM') {
    return { label: option?.label || severity || '-', tone: 'medium' as const }
  }
  if (severity === 'LOW') {
    return { label: option?.label || severity || '-', tone: 'low' as const }
  }

  return { label: option?.label || severity || '-', tone: 'neutral' as const }
}

export function formatDefectTags(tags: string[] | null | undefined) {
  return Array.isArray(tags) && tags.length ? tags.join(' / ') : '-'
}

export function matchesDefectClientFilter(item: DefectSummaryItem, filter: DefectClientFilter) {
  const keyword = filter.keyword.trim().toLowerCase()
  if (keyword) {
    const haystack = [
      item.bugNo,
      item.title,
      item.assigneeName,
      item.reporterName,
      item.workspaceName,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(keyword)) {
      return false
    }
  }

  if (filter.status && item.status !== filter.status) {
    return false
  }
  if (filter.priority && item.priority !== filter.priority) {
    return false
  }
  if (filter.severity && item.severity !== filter.severity) {
    return false
  }

  return true
}
