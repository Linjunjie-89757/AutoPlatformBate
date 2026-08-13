import { ElMessageBox } from 'element-plus'

import { confirmDelete } from '@/shared/ui'

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

  return ElMessageBox.confirm(message, title, {
    type: 'warning',
    confirmButtonText: options.confirmText || '确定',
    cancelButtonText: options.cancelText || '取消',
    customClass: 'api-soft-message-box',
    confirmButtonClass: 'api-soft-message-box__primary',
    cancelButtonClass: 'api-soft-message-box__cancel',
  }).then(
    () => true,
    () => false,
  )
}
