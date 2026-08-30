import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import { confirmDelete } from '@/shared/ui'

export async function deleteAiProviderConnection(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  await confirmDelete({
    title: '删除 AI 连接',
    message: `确认删除「${provider.connectionName}」？删除后依赖该连接的 AI 能力将无法正常运行。`,
    confirmText: '确认删除',
    density: 'compact',
  })

  return aiProviderApi.deleteProviderConnection(workspaceCode, provider.id)
}
