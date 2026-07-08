import type { ApiDefinitionCaseDetail } from '@/entities/api-automation'

export type ApiCaseDetailRequestTab = 'headers' | 'body' | 'params' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'

export function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

export function statusTone(status: number | null) {
  if (status == null) return 'empty'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400) return 'danger'
  return 'warning'
}

export function formatFileSize(size?: number | null) {
  if (!size) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatDuration(value?: number | null) {
  if (value == null) return '-'
  return `${value} ms`
}

export function formatResponseSize(value?: number | null) {
  return formatFileSize(value)
}

export function runResultLabel(result?: string | null) {
  if (!result) return '-'
  const normalized = String(result).toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return '通过'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return '失败'
  if (['RUNNING', 'PENDING'].includes(normalized)) return '执行中'
  if (normalized === 'NO_ASSERTION') return '无断言'
  return result
}

export function runResultClass(result?: string | null) {
  const normalized = String(result || '').toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return 'is-passed'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return 'is-failed'
  return 'is-neutral'
}

export function hasBodyContent(body: ApiDefinitionCaseDetail['requestConfig']['body']) {
  if (body.type === 'NONE') return false
  if (['FORM_DATA', 'FORM_URLENCODED'].includes(body.type)) return body.formItems.some(row => row.key || row.value || row.fileName)
  if (body.type === 'BINARY') return Boolean(body.fileName)
  return Boolean(body.rawText || body.jsonText || body.xmlText || body.plainText)
}

export function pickCaseDetailDefaultRequestTab(detail: ApiDefinitionCaseDetail): ApiCaseDetailRequestTab {
  if (detail.requestConfig.queryParams.some(row => row.key || row.value)) return 'params'
  if (hasBodyContent(detail.requestConfig.body)) return 'body'
  if (detail.requestConfig.headers.some(row => row.key || row.value)) return 'headers'
  if (detail.requestConfig.authConfig.authType !== 'NONE') return 'auth'
  return 'params'
}

export function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
