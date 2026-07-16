<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    loadingText?: string
    loading?: boolean
    density?: 'default' | 'compact'
    zIndex?: number
  }>(),
  {
    title: '确认删除',
    message: '删除后不可恢复。',
    confirmText: '确认删除',
    cancelText: '取消',
    loadingText: '删除中...',
    loading: false,
    density: 'default',
    zIndex: 2050,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  cancel: []
  confirm: []
}>()

function closeByCancel() {
  if (props.loading) {
    return
  }

  emit('cancel')
  emit('update:modelValue', false)
}

function confirm() {
  if (props.loading) {
    return
  }

  emit('confirm')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return
  }

  if (event.key === 'Escape' && !props.loading) {
    event.preventDefault()
    closeByCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="app-delete-confirm">
      <div
        v-if="modelValue"
        :class="['app-delete-confirm', `is-${density}`]"
        :style="{ zIndex }"
        role="dialog"
        aria-modal="true"
        :aria-busy="loading"
        :aria-label="title"
        @click.self="closeByCancel"
      >
        <section class="app-delete-confirm__panel">
          <span class="app-delete-confirm__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false">
              <path
                d="M2.667 4h10.666"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.333"
              />
              <path
                d="M12 4v8.667c0 .666-.667 1.333-1.333 1.333H5.333C4.667 14 4 13.333 4 12.667V4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.333"
              />
              <path
                d="M6 4V2.667C6 2 6.667 1.333 7.333 1.333h1.334C9.333 1.333 10 2 10 2.667V4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.333"
              />
              <path
                d="M6.667 7.333v3.334M9.333 7.333v3.334"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.333"
              />
            </svg>
          </span>
          <div class="app-delete-confirm__content">
            <h2>{{ title }}</h2>
            <p>{{ message }}</p>
          </div>
          <footer class="app-delete-confirm__actions">
            <button type="button" class="app-delete-confirm__button" :disabled="loading" @click="closeByCancel">
              {{ cancelText }}
            </button>
            <button type="button" class="app-delete-confirm__button is-danger" :disabled="loading" @click="confirm">
              {{ loading ? loadingText : confirmText }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-delete-confirm {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.28);
}

.app-delete-confirm__panel {
  position: relative;
  display: grid;
  width: min(400px, calc(100vw - 48px));
  grid-template-columns: 40px minmax(0, 1fr);
  column-gap: 12px;
  padding: 24px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
}

.app-delete-confirm__icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ffe8e8;
  color: #f53f3f;
}

.app-delete-confirm__icon svg {
  width: 16px;
  height: 16px;
}

.app-delete-confirm__content {
  min-width: 0;
  padding-top: 1px;
}

.app-delete-confirm__content h2 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.app-delete-confirm__content p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.app-delete-confirm__actions {
  display: flex;
  grid-column: 2;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 20px;
}

.app-delete-confirm__button {
  display: inline-flex;
  min-width: 56px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.app-delete-confirm__button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-delete-confirm__button:not(:disabled):hover,
.app-delete-confirm__button:not(:disabled):focus-visible {
  border-color: #c9cdd4;
  background: #f7f8fa;
  outline: none;
}

.app-delete-confirm__button:not(:disabled):focus-visible {
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.12);
}

.app-delete-confirm__button.is-danger {
  min-width: 80px;
  border-color: #f53f3f;
  background: #f53f3f;
  color: #ffffff;
}

.app-delete-confirm.is-compact .app-delete-confirm__panel {
  grid-template-columns: 35px minmax(0, 1fr);
  column-gap: 10.5px;
  padding: 21px;
  border-radius: 14px;
  box-shadow: 0 20px 30px rgba(0, 0, 0, 0.16);
}

.app-delete-confirm.is-compact .app-delete-confirm__icon {
  width: 35px;
  height: 35px;
}

.app-delete-confirm.is-compact .app-delete-confirm__icon svg {
  width: 18px;
  height: 18px;
}

.app-delete-confirm.is-compact .app-delete-confirm__content {
  padding-top: 0;
}

.app-delete-confirm.is-compact .app-delete-confirm__content h2 {
  line-height: 22.5px;
}

.app-delete-confirm.is-compact .app-delete-confirm__content p {
  margin-top: 3.5px;
  line-height: 19.5px;
}

.app-delete-confirm.is-compact .app-delete-confirm__actions {
  height: 49.5px;
  align-items: flex-start;
  gap: 7px;
  padding-top: 17.5px;
}

.app-delete-confirm.is-compact .app-delete-confirm__button {
  min-width: 0;
  height: 28px;
  padding: 1px 11.5px;
  border-radius: 7px;
}

.app-delete-confirm.is-compact .app-delete-confirm__button.is-danger {
  min-width: 0;
  height: 32px;
  padding: 0 14px;
}

.app-delete-confirm__button.is-danger:not(:disabled):hover,
.app-delete-confirm__button.is-danger:not(:disabled):focus-visible {
  border-color: #e63535;
  background: #e63535;
}

.app-delete-confirm-enter-active,
.app-delete-confirm-leave-active {
  transition: opacity 160ms ease;
}

.app-delete-confirm-enter-active .app-delete-confirm__panel,
.app-delete-confirm-leave-active .app-delete-confirm__panel {
  transition: transform 160ms ease, opacity 160ms ease;
}

.app-delete-confirm-enter-from,
.app-delete-confirm-leave-to {
  opacity: 0;
}

.app-delete-confirm-enter-from .app-delete-confirm__panel,
.app-delete-confirm-leave-to .app-delete-confirm__panel {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .app-delete-confirm-enter-active,
  .app-delete-confirm-leave-active,
  .app-delete-confirm-enter-active .app-delete-confirm__panel,
  .app-delete-confirm-leave-active .app-delete-confirm__panel {
    transition: none;
  }
}
</style>
