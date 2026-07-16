import { configApi, type ParamSetItem } from '@/entities/config'
import { confirmDelete } from '@/shared/ui'

export async function deleteConfigParam(param: ParamSetItem, workspaceCode = 'ALL') {
  await confirmDelete({
    title: '删除参数',
    message: `确认删除参数“${param.paramName}”吗？删除后不可恢复。`,
    confirmText: '确认删除',
  })

  await configApi.deleteSettingsParam(workspaceCode, param.id)
}
