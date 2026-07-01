const metaEnv = import.meta.env ?? {}

export const env = {
  apiBaseUrl: metaEnv.VITE_API_BASE_URL ?? 'http://localhost:8080/api',
} as const
