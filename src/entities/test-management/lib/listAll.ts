import { testManagementApi } from '../api/testManagementApi'
import type { TestPage } from '../model/types'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4

type PageQuery = Record<string, string | number | undefined>

/** Load a complete test-management relation set through bounded pages. */
export async function listAllTestManagementItems<T>(
  loadPage: (pageNo: number, pageSize: number) => Promise<TestPage<T>>,
): Promise<T[]> {
  const firstPage = await loadPage(1, PAGE_SIZE)
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
    const pages = await Promise.all(pageNumbers.map(currentPageNo => loadPage(currentPageNo, PAGE_SIZE)))
    for (const page of pages) {
      if (!page.items.length) return items
      items.push(...page.items)
    }
  }

  return items
}

export function listAllTestVersions(workspaceCode: string, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listVersions(workspaceCode, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllTestRequirements(workspaceCode: string, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listRequirements(workspaceCode, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllTestPlans(workspaceCode: string, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listPlans(workspaceCode, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllVersionRequirements(workspaceCode: string, versionId: number, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listVersionRequirements(workspaceCode, versionId, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllVersionActivities(workspaceCode: string, versionId: number, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listVersionActivities(workspaceCode, versionId, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllRequirementActivities(workspaceCode: string, requirementId: number, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listRequirementActivities(workspaceCode, requirementId, { ...query, pageNo, pageSize: PAGE_SIZE }))
}

export function listAllPlanActivities(workspaceCode: string, planId: number, query: PageQuery = {}) {
  return listAllTestManagementItems(pageNo => testManagementApi.listPlanActivities(workspaceCode, planId, { ...query, pageNo, pageSize: PAGE_SIZE }))
}
