import { ref } from 'vue'

import { sessionApi, setCurrentUser, type LoginPayload } from '@/entities/session'
import { normalizeRequestError } from '@/shared/api/error'

export function getLoginErrorMessage(error: unknown) {
  const normalized = normalizeRequestError(error)
  const message = normalized.message.trim()

  if (/停用|禁用|disabled/i.test(message)) {
    return '该账户已被停用，请联系管理员处理'
  }
  if (
    normalized.status === 401
    || /bad credentials|用户不存在|密码错误|账号或密码|用户名或密码|请先登录/i.test(message)
  ) {
    return '账号或密码错误，请重新输入'
  }
  if (normalized.status && normalized.status >= 500) {
    return '系统繁忙，请稍后再试'
  }
  if (/timeout|timed out|超时|econnaborted|etimedout/i.test(message)) {
    return '网络连接超时，请检查网络后重试'
  }
  if (
    normalized.status === undefined
    && (
      /network|err_network|failed to fetch|网络/i.test(message)
      || (typeof error === 'object' && error !== null && 'raw' in error)
    )
  ) {
    return '网络连接异常，请检查网络后重试'
  }

  return message || '登录失败，请稍后再试'
}

export function useLogin() {
  const loading = ref(false)
  const errorMessage = ref('')

  async function login(payload: LoginPayload) {
    loading.value = true
    errorMessage.value = ''

    try {
      const user = await sessionApi.login(payload)
      setCurrentUser(user)
      return user
    } catch (error) {
      errorMessage.value = getLoginErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    errorMessage,
    login,
  }
}
