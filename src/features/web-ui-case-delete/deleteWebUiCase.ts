import { ElMessage } from 'element-plus'

import { webUiAutomationApi, type WebUiCaseItem } from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'

export async function deleteWebUiCase(caseItem: WebUiCaseItem, workspaceCode = 'ALL') {
  try {
    await confirmDelete({
      title: '删除 Web UI 用例',
      message: `确认删除「${caseItem.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return false
    }
    throw error
  }

  try {
    await webUiAutomationApi.deleteCase(workspaceCode, caseItem.id)
    ElMessage.success('Web UI 用例已删除')
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    throw error
  }
}
