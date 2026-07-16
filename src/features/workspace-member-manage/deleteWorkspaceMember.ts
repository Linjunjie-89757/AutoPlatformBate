import { workspaceApi, type WorkspaceMemberItem } from '@/entities/workspace'
import { confirmDelete } from '@/shared/ui'

export async function deleteWorkspaceMember(workspaceCode: string, member: WorkspaceMemberItem) {
  const displayName = member.displayName || member.username || String(member.userId)

  await confirmDelete({
    title: '移除空间成员',
    message: `确认将“${displayName}”移出当前工作空间吗？`,
    confirmText: '确认移除',
  })

  return workspaceApi.deleteWorkspaceMember(workspaceCode, member.id)
}
