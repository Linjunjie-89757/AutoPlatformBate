<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { AlertTriangle, Power } from '@lucide/vue'

type ActionConfirmTone = 'success' | 'warning'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    tone?: ActionConfirmTone
    variant?: 'default' | 'figma-danger'
  }>(),
  {
    title: '确认操作',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    tone: 'warning',
    variant: 'default',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  cancel: []
  confirm: []
}>()

const iconClass = computed(() => `is-${props.tone}`)

function closeByCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return
  }

  if (event.key === 'Escape') {
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
    <Transition name="app-action-confirm">
      <div
        v-if="modelValue"
        class="app-action-confirm"
        :class="`is-${props.variant}`"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="closeByCancel"
      >
        <section class="app-action-confirm__panel">
          <div class="app-action-confirm__body">
            <span class="app-action-confirm__icon" :class="iconClass" aria-hidden="true">
              <AlertTriangle v-if="tone === 'warning'" :size="props.variant === 'figma-danger' ? 20 : 17" />
              <Power v-else :size="17" aria-hidden="true" />
            </span>
            <span class="app-action-confirm__copy">
              <strong>{{ title }}</strong>
              <small>{{ message }}</small>
            </span>
          </div>
          <footer class="app-action-confirm__actions">
            <button type="button" class="app-action-confirm__button" @click="closeByCancel">
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="app-action-confirm__button is-primary"
              :class="iconClass"
              @click="confirm"
            >
              {{ confirmText }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-action-confirm {
  position: fixed;
  z-index: 2050;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.25);
}

.app-action-confirm__panel {
  width: min(380px, calc(100vw - 48px));
  padding: 24px 24px 20px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.16);
}

.app-action-confirm__body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.app-action-confirm__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.app-action-confirm__icon.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.app-action-confirm__icon.is-warning {
  background: #fff3e8;
  color: #ff7d00;
}

.app-action-confirm__icon svg {
  width: 17px;
  height: 17px;
}

.app-action-confirm__copy {
  min-width: 0;
}

.app-action-confirm__copy strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

.app-action-confirm__copy small {
  display: block;
  margin-top: 6px;
  color: #4e5969;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.65;
  white-space: pre-line;
}

.app-action-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.app-action-confirm__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 7px 18px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.app-action-confirm__button:hover,
.app-action-confirm__button:focus-visible {
  border-color: #c9cdd4;
  background: #f7f8fa;
  outline: none;
}

.app-action-confirm__button:focus-visible {
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.12);
}

.app-action-confirm__button.is-primary {
  border-color: transparent;
  color: #ffffff;
}

.app-action-confirm__button.is-primary.is-success {
  background: #00b42a;
}

.app-action-confirm__button.is-primary.is-warning {
  background: #ff7d00;
}

.app-action-confirm__button.is-primary.is-success:hover,
.app-action-confirm__button.is-primary.is-success:focus-visible {
  background: #009a24;
}

.app-action-confirm__button.is-primary.is-warning:hover,
.app-action-confirm__button.is-primary.is-warning:focus-visible {
  background: #e66f00;
}

.app-action-confirm.is-figma-danger {
  background: rgba(29, 33, 41, 0.5);
}

.app-action-confirm.is-figma-danger .app-action-confirm__panel {
  width: min(380px, calc(100vw - 48px));
  padding: 28px;
  border-radius: 10px;
}

.app-action-confirm.is-figma-danger .app-action-confirm__body {
  gap: 10px;
  margin-bottom: 24px;
}

.app-action-confirm.is-figma-danger .app-action-confirm__icon {
  width: 20px;
  height: 22px;
  border-radius: 0;
  background: transparent;
  color: #f53f3f;
}

.app-action-confirm.is-figma-danger .app-action-confirm__copy strong {
  color: #1d2129;
  font-size: 15px;
  line-height: 22px;
}

.app-action-confirm.is-figma-danger .app-action-confirm__copy small {
  margin-top: 6px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.app-action-confirm.is-figma-danger .app-action-confirm__button.is-primary.is-warning {
  background: #f53f3f;
}

.app-action-confirm.is-figma-danger .app-action-confirm__button.is-primary.is-warning:hover,
.app-action-confirm.is-figma-danger .app-action-confirm__button.is-primary.is-warning:focus-visible {
  background: #cb2636;
}

.app-action-confirm-enter-active,
.app-action-confirm-leave-active {
  transition: opacity 160ms ease;
}

.app-action-confirm-enter-active .app-action-confirm__panel,
.app-action-confirm-leave-active .app-action-confirm__panel {
  transition: transform 160ms ease, opacity 160ms ease;
}

.app-action-confirm-enter-from,
.app-action-confirm-leave-to {
  opacity: 0;
}

.app-action-confirm-enter-from .app-action-confirm__panel,
.app-action-confirm-leave-to .app-action-confirm__panel {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
