import { configApi, type EnvConfigItem } from '@/entities/config'
import { confirmDelete } from '@/shared/ui'

export async function deleteConfigEnv(env: EnvConfigItem, workspaceCode = 'ALL') {
  await confirmDelete({
    title: '删除环境',
    message: `确认删除环境“${env.envName}”吗？删除后不可恢复。`,
    confirmText: '确认删除',
  })

  await configApi.deleteSettingsEnv(workspaceCode, env.id)
}
