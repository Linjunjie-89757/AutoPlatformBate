<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

type ActionConfirmTone = 'success' | 'warning'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    tone?: ActionConfirmTone
  }>(),
  {
    title: '确认操作',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    tone: 'warning',
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
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="closeByCancel"
      >
        <section class="app-action-confirm__panel">
          <div class="app-action-confirm__body">
            <span class="app-action-confirm__icon" :class="iconClass" aria-hidden="true">
              <svg viewBox="0 0 16 16" focusable="false">
                <path
                  d="M8 1.333V8"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.333"
                />
                <path
                  d="M12.267 4.4a6 6 0 1 1-8.514.027"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.333"
                />
              </svg>
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
  background: rgba(0, 0, 0, 0.28);
}

.app-action-confirm__panel {
  width: min(380px, calc(100vw - 48px));
  padding: 21px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 30px rgba(0, 0, 0, 0.16);
}

.app-action-confirm__body {
  display: flex;
  align-items: flex-start;
  gap: 10.5px;
}

.app-action-confirm__icon {
  display: inline-flex;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
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
  width: 18px;
  height: 18px;
}

.app-action-confirm__copy {
  display: grid;
  width: min(208px, 100%);
}

.app-action-confirm__copy strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.app-action-confirm__copy small {
  padding-top: 3.5px;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.app-action-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  padding-top: 17.5px;
  border-top: 0;
}

.app-action-confirm__button {
  display: inline-flex;
  width: 49px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
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
  width: 80px;
  min-width: 80px;
  height: 32px;
  padding: 0;
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
