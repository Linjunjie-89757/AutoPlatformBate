import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import { confirmDelete } from '@/shared/ui'

export async function deleteAiProviderConnection(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  await confirmDelete({
    title: '删除 AI 连接',
    message: `确认删除 AI 连接「${provider.connectionName}」吗？删除后相关模型缓存也会被移除。`,
    confirmText: '确认删除',
  })

  return aiProviderApi.deleteProviderConnection(workspaceCode, provider.id)
}
