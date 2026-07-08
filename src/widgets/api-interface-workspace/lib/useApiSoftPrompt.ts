import { nextTick, ref } from 'vue'

export type ApiSoftPromptInputType = 'text' | 'textarea'

export interface ApiSoftPromptOptions {
  title: string
  message?: string
  value?: string
  placeholder?: string
  inputType?: ApiSoftPromptInputType
  requiredMessage?: string
  confirmText?: string
  cancelText?: string
}

export function useApiSoftPrompt() {
  const visible = ref(false)
  const title = ref('')
  const message = ref('')
  const value = ref('')
  const placeholder = ref('')
  const inputType = ref<ApiSoftPromptInputType>('text')
  const requiredMessage = ref('请输入内容')
  const confirmText = ref('确定')
  const cancelText = ref('取消')
  const error = ref('')
  let resolvePrompt: ((value: string | null) => void) | null = null

  function open(options: ApiSoftPromptOptions) {
    if (resolvePrompt) {
      resolvePrompt(null)
    }
    title.value = options.title
    message.value = options.message || ''
    value.value = options.value || ''
    placeholder.value = options.placeholder || ''
    inputType.value = options.inputType || 'text'
    requiredMessage.value = options.requiredMessage || '请输入内容'
    confirmText.value = options.confirmText || '确定'
    cancelText.value = options.cancelText || '取消'
    error.value = ''
    visible.value = true

    return new Promise<string | null>((resolve) => {
      resolvePrompt = resolve
      void nextTick(() => {
        const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.api-soft-dialog input, .api-soft-dialog textarea')
        input?.focus()
        input?.select()
      })
    })
  }

  function confirm() {
    const normalizedValue = value.value.trim()
    if (!normalizedValue) {
      error.value = requiredMessage.value
      return
    }
    resolvePrompt?.(normalizedValue)
    resolvePrompt = null
    visible.value = false
  }

  function cancel() {
    resolvePrompt?.(null)
    resolvePrompt = null
    visible.value = false
  }

  return {
    visible,
    title,
    message,
    value,
    placeholder,
    inputType,
    error,
    confirmText,
    cancelText,
    open,
    confirm,
    cancel,
  }
}
