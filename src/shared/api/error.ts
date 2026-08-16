import type { RequestError } from './request'

export interface NormalizedRequestError {
  status?: number
  message: string
  raw: unknown
}

function isRequestError(error: unknown): error is RequestError {
  return (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && 'raw' in error
  )
}

function getBackendMessage(raw: unknown) {
  if (typeof raw !== 'object' || raw === null || !('response' in raw)) {
    return ''
  }
  const response = (raw as { response?: { data?: unknown } }).response
  const data = response?.data
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return ''
  }
  const message = (data as { message?: unknown }).message
  return typeof message === 'string' ? message.trim() : ''
}

function getStatusMessage(status?: number) {
  if (status === 401) {
    return '暂无访问权限或登录状态已失效'
  }
  if (status === 403) {
    return '暂无权限执行该操作'
  }
  if (status === 404) {
    return '请求的资源不存在'
  }
  if (status === 429) {
    return '操作过于频繁，请稍后重试'
  }
  if (status && status >= 500) {
    return '服务暂时不可用，请稍后重试'
  }
  return ''
}

function getNetworkMessage(message: string) {
  if (/timeout/i.test(message)) {
    return '请求超时，请稍后重试'
  }
  if (/network/i.test(message)) {
    return '网络连接异常，请检查服务状态'
  }
  return ''
}

export function normalizeRequestError(error: unknown): NormalizedRequestError {
  if (isRequestError(error)) {
    const statusMessage = getStatusMessage(error.status)
    const networkMessage = getNetworkMessage(error.message)
    const backendMessage = getBackendMessage(error.raw)

    return {
      status: error.status,
      message: backendMessage || statusMessage || networkMessage || error.message || '请求失败，请稍后重试',
      raw: error.raw,
    }
  }

  if (error instanceof Error) {
    return {
      message: getNetworkMessage(error.message) || error.message || '请求失败，请稍后重试',
      raw: error,
    }
  }

  return {
    message: '请求失败，请稍后重试',
    raw: error,
  }
}

export function getRequestErrorMessage(error: unknown) {
  return normalizeRequestError(error).message
}

export function isUnauthorizedError(error: unknown) {
  return normalizeRequestError(error).status === 401
}
