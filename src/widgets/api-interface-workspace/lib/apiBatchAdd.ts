export type BatchAddTarget = 'query' | 'header' | 'cookie' | 'body-form' | 'assertion' | 'extractor'

export interface BatchAddRow {
  key: string
  value: string
  description: string
}

export function batchAddTitle(target: BatchAddTarget) {
  if (target === 'assertion') return '批量添加断言'
  if (target === 'extractor') return '批量添加提取器'
  if (target === 'cookie') return '批量添加 Cookie'
  if (target === 'header') return '批量添加请求头'
  if (target === 'body-form') return '批量添加表单项'
  return '批量添加 Query 参数'
}

export function batchAddHint(target: BatchAddTarget) {
  if (target === 'extractor') return '每行一条，左侧为变量名，右侧为表达式，例如 token=$.data.token。'
  if (target === 'assertion') return '每行一条，左侧为断言名称，右侧为期望值，例如 status=200。'
  return '每行一条，支持 key=value、key: value 或 tab 分隔。'
}

export function batchAddPlaceholder(target: BatchAddTarget) {
  if (target === 'extractor') return 'token=$.data.token\ntraceId=$.headers.traceId'
  if (target === 'assertion') return '状态码=200\n响应包含=success'
  return 'token=abc\nContent-Type: application/json'
}

export function batchAddExamples(target: BatchAddTarget) {
  if (target === 'extractor') {
    return ['token=$.data.token', 'traceId: X-Trace-Id', 'userId\t$.data.user.id']
  }
  if (target === 'assertion') {
    return ['状态码=200', '响应包含: success', 'traceId\t不为空']
  }
  return ['token=abc', 'Content-Type: application/json', 'page\t1']
}

export function parseBatchRows(text: string): BatchAddRow[] {
  const rowMap = new Map<string, BatchAddRow>()

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line || /^[=:]/.test(line) || rawLine.startsWith('\t')) {
      return
    }

    const separatorIndex = rawLine.includes('\t')
      ? rawLine.indexOf('\t')
      : rawLine.includes(':')
        ? rawLine.indexOf(':')
        : rawLine.indexOf('=')
    const parts = separatorIndex >= 0
      ? [rawLine.slice(0, separatorIndex), rawLine.slice(separatorIndex + 1)]
      : [rawLine, '']
    const row = {
      key: (parts[0] || '').trim(),
      value: (parts[1] || '').trim(),
      description: '',
    }
    if (!row.key) {
      return
    }
    rowMap.delete(row.key)
    rowMap.set(row.key, row)
  })

  return Array.from(rowMap.values())
}
