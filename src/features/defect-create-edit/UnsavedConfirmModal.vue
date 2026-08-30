<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  stay: []
  discard: []
}>()

function stayOnPage() {
  emit('stay')
  emit('update:modelValue', false)
}

function discardChanges() {
  emit('discard')
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="defect-unsaved-confirm">
      <div
        v-if="modelValue"
        class="defect-unsaved-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="defect-unsaved-confirm-title"
        @click.self="stayOnPage"
      >
        <section class="defect-unsaved-confirm__panel">
          <div class="defect-unsaved-confirm__accent" />
          <div class="defect-unsaved-confirm__body">
            <div class="defect-unsaved-confirm__heading">
              <span class="defect-unsaved-confirm__icon" aria-hidden="true">
                <AlertTriangle :size="16" aria-hidden="true" />
              </span>
              <strong id="defect-unsaved-confirm-title">放弃未保存的修改？</strong>
            </div>
            <p>您填写的内容尚未保存，离开后将全部丢失，此操作无法撤销。</p>
          </div>
          <footer class="defect-unsaved-confirm__actions">
            <button type="button" class="defect-unsaved-confirm__button" @click="stayOnPage">
              继续编辑
            </button>
            <button type="button" class="defect-unsaved-confirm__button is-discard" @click="discardChanges">
              放弃修改
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.defect-unsaved-confirm {
  position: fixed;
  z-index: 2050;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(29, 33, 41, 0.4);
}

.defect-unsaved-confirm__panel {
  width: min(380px, calc(100vw - 48px));
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.defect-unsaved-confirm__accent {
  height: 4px;
  background: #ff7d00;
}

.defect-unsaved-confirm__body {
  padding: 20px 24px 8px;
}

.defect-unsaved-confirm__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.defect-unsaved-confirm__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #fff3e8;
  color: #ff7d00;
}

.defect-unsaved-confirm__icon svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.defect-unsaved-confirm__heading strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.defect-unsaved-confirm__body p {
  margin: 10px 0 0 48px;
  color: #4e5969;
  font-size: 13px;
  line-height: 21px;
}

.defect-unsaved-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px 20px;
}

.defect-unsaved-confirm__button {
  min-width: 76px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.defect-unsaved-confirm__button:hover,
.defect-unsaved-confirm__button:focus-visible {
  border-color: #c9cdd4;
  background: #f7f8fa;
  outline: none;
}

.defect-unsaved-confirm__button.is-discard {
  border-color: transparent;
  background: #ff7d00;
  color: #ffffff;
}

.defect-unsaved-confirm__button.is-discard:hover,
.defect-unsaved-confirm__button.is-discard:focus-visible {
  border-color: #e66f00;
  background: #e66f00;
}

.defect-unsaved-confirm-enter-active,
.defect-unsaved-confirm-leave-active {
  transition: opacity 160ms ease;
}

.defect-unsaved-confirm-enter-active .defect-unsaved-confirm__panel,
.defect-unsaved-confirm-leave-active .defect-unsaved-confirm__panel {
  transition: transform 160ms ease, opacity 160ms ease;
}

.defect-unsaved-confirm-enter-from,
.defect-unsaved-confirm-leave-to {
  opacity: 0;
}

.defect-unsaved-confirm-enter-from .defect-unsaved-confirm__panel,
.defect-unsaved-confirm-leave-to .defect-unsaved-confirm__panel {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
