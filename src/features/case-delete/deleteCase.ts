import { caseApi, type CaseSummaryItem } from '@/entities/case'
import { confirmDelete } from '@/shared/ui'

export async function deleteCase(item: CaseSummaryItem, workspaceCode = 'ALL') {
  await confirmDelete({
    title: '删除用例',
    message: `确认删除「${item.title || item.caseNo}」吗？删除后不可恢复。`,
    confirmText: '确认删除',
  })

  await caseApi.deleteCase(item.id, workspaceCode)
}
