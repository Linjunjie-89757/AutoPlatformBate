const MASKED_HEADER_VALUE = '••••••••'

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
])

function isSensitiveHeaderName(name: string) {
  const normalizedName = name.trim().toLowerCase()
  return (
    SENSITIVE_HEADER_NAMES.has(normalizedName) ||
    normalizedName.includes('token') ||
    normalizedName.includes('secret') ||
    normalizedName.includes('password')
  )
}

function maskSensitiveHeaderValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveHeaderValues)
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveHeaderName(key) ? MASKED_HEADER_VALUE : maskSensitiveHeaderValues(nestedValue),
    ]),
  )
}

export function formatMockLogJson(value: string | null) {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function formatMockLogHeaders(value: string | null) {
  if (!value) return '-'
  try {
    return JSON.stringify(maskSensitiveHeaderValues(JSON.parse(value)), null, 2)
  } catch {
    if (/authorization|cookie|api-key|token|secret|password/i.test(value)) {
      return MASKED_HEADER_VALUE
    }
    return value
  }
}
