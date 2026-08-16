import { normalizeRequestError } from '@/shared/api/error'
import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

export interface AccountActivationInfo {
  email: string
  displayName: string
  expiresAt: string
}

function unwrap<T>(payload: ApiResponse<T>) {
  if (payload.success === false) throw new Error(payload.message || '请求失败')
  return payload.data
}

export const accountActivationApi = {
  async validate(token: string) {
    const response = await httpGet<ApiResponse<AccountActivationInfo>>(
      '/auth/account-activation/validate',
      { params: { token } },
    )
    return unwrap(response)
  },

  async confirm(token: string, password: string) {
    const response = await httpPost<ApiResponse<null>, { token: string; password: string }>(
      '/auth/account-activation/confirm',
      { token, password },
    )
    return unwrap(response)
  },
}

export function getAccountActivationErrorMessage(error: unknown) {
  return normalizeRequestError(error).message || '激活失败，请联系管理员重新发送邀请'
}
