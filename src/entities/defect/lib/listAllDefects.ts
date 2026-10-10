import { defectApi } from '../api/defectApi'
import type { DefectListQuery, DefectSummaryItem } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

/** Load all defect candidates through bounded pages for local relation filtering. */
export async function listAllDefects(
  workspaceCode: string,
  query: Omit<DefectListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<DefectSummaryItem[]> {
  const firstPage = await defectApi.getDefects(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: PAGE_SIZE,
  })
  const defects = [...firstPage.items]
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.total > 0 ? Math.ceil(firstPage.total / PAGE_SIZE) : 0,
  )

  for (let pageNo = 2; pageNo <= totalPages; pageNo += PAGE_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, totalPages - pageNo + 1) },
      (_, index) => pageNo + index,
    )
    const pages = await Promise.all(pageNumbers.map(currentPageNo => (
      defectApi.getDefects(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) return defects
      defects.push(...page.items)
    }
  }

  return defects
}
