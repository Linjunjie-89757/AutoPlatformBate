import { createApp, h, ref } from 'vue'

import AppDeleteConfirmDialog from './AppDeleteConfirmDialog.vue'

export interface ConfirmDeleteOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  loadingText?: string
  density?: 'default' | 'compact'
  zIndex?: number
  beforeConfirm?: () => void | Promise<void>
}

export function confirmDelete(options: ConfirmDeleteOptions = {}) {
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

    const app = createApp({
      setup() {
        const visible = ref(true)
        const confirming = ref(false)

        const handleConfirm = async () => {
          if (confirming.value) {
            return
          }

          if (!options.beforeConfirm) {
            visible.value = false
            settle(resolve)
            return
          }

          confirming.value = true
          try {
            await options.beforeConfirm()
            visible.value = false
            settle(resolve)
          } catch {
            confirming.value = false
          }
        }

        const handleCancel = () => {
          if (confirming.value) {
            return
          }
          visible.value = false
          settle(() => reject('cancel'))
        }

        const handleVisibleChange = (value: boolean) => {
          visible.value = value
          if (!value && !confirming.value) {
            settle(() => reject('close'))
          }
        }

        return () => h(AppDeleteConfirmDialog, {
          modelValue: visible.value,
          title: options.title,
          message: options.message,
          confirmText: options.confirmText,
          cancelText: options.cancelText,
          loadingText: options.loadingText,
          loading: confirming.value,
          density: options.density,
          zIndex: options.zIndex,
          onConfirm: handleConfirm,
          onCancel: handleCancel,
          'onUpdate:modelValue': handleVisibleChange,
        })
      },
    })

    app.mount(container)
  })
}
