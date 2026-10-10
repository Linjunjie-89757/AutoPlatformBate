import { apiAutomationApi } from '../api/apiAutomationApi'
import type { ApiCaseListQuery, ApiDefinitionCaseItem } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

/** Load all cases for a relation view without requesting an unbounded page. */
export async function listAllApiCases(
  workspaceCode: string,
  query: Omit<ApiCaseListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<ApiDefinitionCaseItem[]> {
  const firstPage = await apiAutomationApi.getCases(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: PAGE_SIZE,
  })
  const cases = [...firstPage.items]
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
      apiAutomationApi.getCases(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) return cases
      cases.push(...page.items)
    }
  }

  return cases
}
