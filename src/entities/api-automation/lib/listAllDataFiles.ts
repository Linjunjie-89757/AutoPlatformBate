import { apiAutomationApi } from '../api/apiAutomationApi'
import type { ApiDataFileItem, ApiDataFileListQuery } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

/** Load the complete data-file library through bounded pages. */
export async function listAllApiDataFiles(
  workspaceCode: string,
  query: Omit<ApiDataFileListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<ApiDataFileItem[]> {
  const firstPage = await apiAutomationApi.getDataFiles(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: PAGE_SIZE,
  })
  const files = [...firstPage.items]
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
      apiAutomationApi.getDataFiles(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) return files
      files.push(...page.items)
    }
  }

  return files
}
