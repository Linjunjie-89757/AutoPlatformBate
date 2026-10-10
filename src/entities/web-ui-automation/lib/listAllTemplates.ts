import { webUiAutomationApi } from '../api/webUiAutomationApi'
import type { WebUiCaseTemplateItem, WebUiCaseTemplateListQuery } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

/** Load the complete template set for the template library through bounded pages. */
export async function listAllWebUiTemplates(
  workspaceCode: string,
  query: Omit<WebUiCaseTemplateListQuery, 'pageNo' | 'pageSize'> = {},
): Promise<WebUiCaseTemplateItem[]> {
  const firstPage = await webUiAutomationApi.getTemplates(workspaceCode, {
    ...query,
    pageNo: 1,
    pageSize: PAGE_SIZE,
  })
  const templates = [...firstPage.items]
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
      webUiAutomationApi.getTemplates(workspaceCode, {
        ...query,
        pageNo: currentPageNo,
        pageSize: PAGE_SIZE,
      })
    )))
    for (const page of pages) {
      if (!page.items.length) return templates
      templates.push(...page.items)
    }
  }

  return templates
}
