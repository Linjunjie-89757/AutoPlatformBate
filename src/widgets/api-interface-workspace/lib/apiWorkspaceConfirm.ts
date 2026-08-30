import { confirmAction, confirmDelete } from '@/shared/ui'

export function confirmApiAction(
  message: string,
  title: string,
  options: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
) {
  if (options.danger) {
    return confirmDelete({
      title,
      message,
      confirmText: options.confirmText || '确认删除',
      cancelText: options.cancelText || '取消',
    }).then(
      () => true,
      () => false,
    )
  }

  return confirmAction({
    title,
    message,
    confirmText: options.confirmText || '确定',
    cancelText: options.cancelText || '取消',
    tone: 'warning',
  }).then(
    () => true,
    () => false,
  )
}
