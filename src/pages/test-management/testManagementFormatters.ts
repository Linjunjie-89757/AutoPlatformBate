export const formatTestManagementDateTime = (value?: string | null): string => {
  if (!value || value === '—') return '—'

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return value

  const [, year, month, day, hour, minute, second = '00'] = match
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
