import { caseApi } from '../api/caseApi'
import type { CaseListQuery, CaseSummaryItem } from '../model/types'

const CASES_PAGE_SIZE = 200
const CASES_PAGE_CONCURRENCY = 4

/** Load the complete case summary set in bounded pages for relation pickers. */
export async function listAllCases(
  workspaceCode: string,
  query: Omit<CaseListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<CaseSummaryItem[]> {
  const firstPage = await caseApi.getCases(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: CASES_PAGE_SIZE,
  })
  const cases = [...firstPage.items]
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.total > 0 ? Math.ceil(firstPage.total / CASES_PAGE_SIZE) : 0,
  )

  for (let pageNo = 2; pageNo <= totalPages; pageNo += CASES_PAGE_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(CASES_PAGE_CONCURRENCY, totalPages - pageNo + 1) },
      (_, index) => pageNo + index,
    )
    const pages = await Promise.all(pageNumbers.map(currentPageNo => (
      caseApi.getCases(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: CASES_PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) {
        return cases
      }
      cases.push(...page.items)
    }
  }

  return cases
}
