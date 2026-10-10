import { webUiAutomationApi } from '../api/webUiAutomationApi'
import type { WebUiElementItem, WebUiElementListQuery } from '../model/types'

const ELEMENTS_PAGE_SIZE = 200
const ELEMENTS_PAGE_CONCURRENCY = 4

/** Load the complete element set without sending a large single-page response. */
export async function listAllWebUiElements(
  workspaceCode: string,
  query: Omit<WebUiElementListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<WebUiElementItem[]> {
  const firstPage = await webUiAutomationApi.getElements(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: ELEMENTS_PAGE_SIZE,
  })
  const elements = [...firstPage.items]
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.total > 0 ? Math.ceil(firstPage.total / ELEMENTS_PAGE_SIZE) : 0,
  )

  for (let pageNo = 2; pageNo <= totalPages; pageNo += ELEMENTS_PAGE_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(ELEMENTS_PAGE_CONCURRENCY, totalPages - pageNo + 1) },
      (_, index) => pageNo + index,
    )
    const pages = await Promise.all(pageNumbers.map(currentPageNo => (
      webUiAutomationApi.getElements(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: ELEMENTS_PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) {
        return elements
      }
      elements.push(...page.items)
    }
  }

  return elements
}
