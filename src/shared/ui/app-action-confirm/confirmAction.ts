import { createApp } from 'vue'

import AppActionConfirmDialog from './AppActionConfirmDialog.vue'

export interface ConfirmActionOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: 'success' | 'warning'
}

export function confirmAction(options: ConfirmActionOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    let settled = false

    const cleanup = () => {
      app.unmount()
      container.remove()
    }

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      callback()
      setTimeout(cleanup, 180)
    }

    const app = createApp(AppActionConfirmDialog, {
      modelValue: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      tone: options.tone,
      onConfirm: () => {
        settle(resolve)
      },
      onCancel: () => {
        settle(() => reject('cancel'))
      },
      'onUpdate:modelValue': (value: boolean) => {
        if (!value) {
          settle(() => reject('close'))
        }
      },
    })

    app.mount(container)
  })
}
