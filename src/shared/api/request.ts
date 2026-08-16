import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import { env } from '@/shared/config/env'

export interface ApiResponse<T> {
  success?: boolean
  code?: number
  message?: string
  data: T
}

export interface RequestError {
  status?: number
  message: string
  raw: unknown
}

export const request: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = String(error.config?.url || '')
    if (
      error.response?.status === 401
      && !requestUrl.includes('/auth/login')
      && !requestUrl.includes('/auth/me')
    ) {
      const responseData = error.response.data
      const responseMessage = typeof responseData === 'object'
        && responseData !== null
        && 'message' in responseData
        && typeof responseData.message === 'string'
        ? responseData.message
        : ''
      const reason = /停用|禁用|disabled/i.test(responseMessage)
        ? 'account-disabled'
        : 'session-expired'
      window.dispatchEvent(new CustomEvent('autotest:unauthorized', { detail: { reason } }))
    }
    const requestError: RequestError = {
      status: error.response?.status,
      message: error.message || '请求失败',
      raw: error,
    }

    return Promise.reject(requestError)
  },
)

export async function httpGet<T>(url: string, config?: AxiosRequestConfig) {
  const response: AxiosResponse<T> = await request.get(url, config)
  return response.data
}

export async function httpPost<T, P = unknown>(
  url: string,
  payload?: P,
  config?: AxiosRequestConfig,
) {
  const response: AxiosResponse<T> = await request.post(url, payload, config)
  return response.data
}

export async function httpPut<T, P = unknown>(
  url: string,
  payload?: P,
  config?: AxiosRequestConfig,
) {
  const response: AxiosResponse<T> = await request.put(url, payload, config)
  return response.data
}

export async function httpDelete<T>(url: string, config?: AxiosRequestConfig) {
  const response: AxiosResponse<T> = await request.delete(url, config)
  return response.data
}
