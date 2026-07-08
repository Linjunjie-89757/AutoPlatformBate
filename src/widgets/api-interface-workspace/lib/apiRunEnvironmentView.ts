export interface RunEnvironmentHeaderView {
  key: string
  value: string
  enabled: boolean
}

export function formatApiEnvironmentWorkspace(environment: { workspaceName?: string | null; workspaceCode?: string | null }) {
  return environment.workspaceName || environment.workspaceCode || '全部空间'
}

export function parseRunEnvironmentConfig(configJson: string) {
  if (!configJson?.trim()) {
    return {} as Record<string, unknown>
  }
  try {
    const parsed = JSON.parse(configJson)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function normalizeRunEnvironmentHeaders(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as RunEnvironmentHeaderView[]
  }
  return value
    .filter((item): item is { key?: unknown; value?: unknown; enabled?: unknown } => typeof item === 'object' && item !== null)
    .map(item => ({
      key: typeof item.key === 'string' ? item.key : '',
      value: typeof item.value === 'string' ? item.value : '',
      enabled: item.enabled !== false,
    }))
    .filter(item => item.key)
}

export function formatRunEnvironmentStatus(status: number | null | undefined) {
  return status === 0 ? '停用' : '启用'
}

export function formatRunEnvironmentTimeout(config: Record<string, unknown>) {
  const value = config.timeoutMs ?? config.defaultTimeoutMs
  return typeof value === 'number' ? `${value} ms` : '未配置'
}

export function formatRunEnvironmentSsl(config: Record<string, unknown>) {
  const ignoreSsl = config.ignoreSsl === true || config.ignoreHttpsErrors === true
  return ignoreSsl ? '忽略 SSL 证书校验' : '校验证书'
}
