import { normalizeRequestError } from '@/shared/api/error'
import { httpPost, type ApiResponse } from '@/shared/api/request'

export interface PasswordResetRequestResult {
  resendCooldownSeconds: number
  validMinutes: number
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

export const passwordResetApi = {
  async request(email: string) {
    const response = await httpPost<ApiResponse<PasswordResetRequestResult>, { email: string }>(
      '/auth/password-reset/request',
      { email },
    )
    return unwrapApiResponse(response)
  },

  async confirm(token: string, newPassword: string) {
    const response = await httpPost<ApiResponse<null>, { token: string; newPassword: string }>(
      '/auth/password-reset/confirm',
      { token, newPassword },
    )
    return unwrapApiResponse(response)
  },
}

export function getPasswordResetErrorMessage(error: unknown) {
  const normalized = normalizeRequestError(error)
  if (/timeout|超时/i.test(normalized.message)) {
    return '网络连接超时，请检查网络后重试'
  }
  if (normalized.status === undefined && /network|网络/i.test(normalized.message)) {
    return '网络连接异常，请检查网络后重试'
  }
  if (normalized.status && normalized.status >= 500 && !normalized.message.trim()) {
    return '系统繁忙，请稍后再试'
  }
  return normalized.message || '请求失败，请稍后重试'
}
