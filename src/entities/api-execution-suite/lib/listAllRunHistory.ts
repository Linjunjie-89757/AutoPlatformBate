import { apiExecutionSuiteApi } from '../api/apiExecutionSuiteApi'
import type { ApiExecutionSuiteRunHistoryItem } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

/** Load the complete run history for a suite through bounded pages. */
export async function listAllApiExecutionSuiteRunHistory(
  workspaceCode: string,
  suiteId: number,
): Promise<ApiExecutionSuiteRunHistoryItem[]> {
  const firstPage = await apiExecutionSuiteApi.getSuiteRunHistory(workspaceCode, suiteId, {
    pageNo: 1,
    pageSize: PAGE_SIZE,
  })
  const items = [...firstPage.items]
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
      apiExecutionSuiteApi.getSuiteRunHistory(workspaceCode, suiteId, {
        pageNo: currentPageNo,
        pageSize: PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) return items
      items.push(...page.items)
    }
  }

  return items
}
