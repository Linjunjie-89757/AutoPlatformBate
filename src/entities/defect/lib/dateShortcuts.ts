export type DefectDateRange = [string, string]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateRangeFromToday(days: number): DefectDateRange {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - days + 1)
  return [formatDate(start), formatDate(end)]
}

export const defectDateShortcuts = [
  { text: '近 7 天', value: () => dateRangeFromToday(7) },
  { text: '近 30 天', value: () => dateRangeFromToday(30) },
  {
    text: '本月',
    value: () => {
      const end = new Date()
      return [formatDate(new Date(end.getFullYear(), end.getMonth(), 1)), formatDate(end)] as DefectDateRange
    },
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      return [
        formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        formatDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      ] as DefectDateRange
    },
  },
  {
    text: '本年度',
    value: () => {
      const end = new Date()
      return [formatDate(new Date(end.getFullYear(), 0, 1)), formatDate(end)] as DefectDateRange
    },
  },
]

export { formatDate }
