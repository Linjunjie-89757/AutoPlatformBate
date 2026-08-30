<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { FolderPlus, Pencil, Trash2 } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  mode: 'create' | 'rename' | 'delete'
  name?: string
  targetLabel?: string
  targetCount?: number
  countUnit?: string
  theme?: 'primary' | 'warning'
  saving?: boolean
  error?: string
}>(), {
  name: '',
  targetLabel: '',
  targetCount: 0,
  countUnit: '条用例',
  theme: 'primary',
  saving: false,
  error: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:name': [value: string]
  confirm: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const title = computed(() => props.mode === 'create' ? '添加子目录' : props.mode === 'rename' ? '重命名目录' : '删除目录')
const isForm = computed(() => props.mode !== 'delete')
const accent = computed(() => props.mode === 'delete' ? '#F53F3F' : props.theme === 'warning' ? '#FF7D00' : '#165DFF')
const iconBackground = computed(() => props.mode === 'delete' ? 'rgba(245, 63, 63, 0.07)' : props.theme === 'warning' ? 'rgba(255, 125, 0, 0.08)' : 'rgba(22, 93, 255, 0.07)')
const iconComponent = computed(() => props.mode === 'create' ? FolderPlus : props.mode === 'rename' ? Pencil : Trash2)
const confirmText = computed(() => props.mode === 'delete' ? (props.saving ? '删除中...' : '确认删除') : props.saving ? '保存中...' : '确认')
const disabled = computed(() => props.saving || (isForm.value && !props.name.trim()))

function close() {
  if (!props.saving) emit('update:modelValue', false)
}

function confirm() {
  if (!disabled.value) emit('confirm')
}

watch(() => props.modelValue, async (visible) => {
  if (visible && isForm.value) {
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="app-directory-dialog"
      :class="{ 'is-delete': mode === 'delete' }"
      role="dialog"
      :aria-modal="true"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        class="app-directory-dialog__panel"
        :class="{ 'is-delete': mode === 'delete' }"
        :style="{ '--directory-dialog-accent': accent, '--directory-dialog-icon-background': iconBackground }"
      >
        <div class="app-directory-dialog__accent" />
        <template v-if="isForm">
          <div class="app-directory-dialog__body">
            <div class="app-directory-dialog__heading">
              <span class="app-directory-dialog__icon"><component :is="iconComponent" :size="15" /></span>
              <span class="app-directory-dialog__title">{{ title }}</span>
            </div>
            <label class="app-directory-dialog__field">
              <span>目录名称<span class="app-directory-dialog__required">*</span></span>
              <input
                ref="inputRef"
                :value="name"
                maxlength="20"
                placeholder="请输入目录名称，最多 20 个字符"
                :class="{ 'is-error': error }"
                @input="emit('update:name', ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="confirm"
              />
              <span class="app-directory-dialog__field-meta"><span v-if="error" class="app-directory-dialog__error">{{ error }}</span><span>{{ name.length }}/20</span></span>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="app-directory-dialog__delete-body">
            <span class="app-directory-dialog__delete-icon" aria-hidden="true"><Trash2 :size="15" /></span>
            <div>
              <h2>{{ title }}</h2>
              <p>确认删除「{{ targetLabel }}」目录？</p>
              <p v-if="targetCount > 0" class="is-danger">该目录下共 {{ targetCount }} {{ countUnit }}将被移出。</p>
            </div>
          </div>
        </template>
        <div class="app-directory-dialog__footer">
          <button type="button" class="app-directory-dialog__button is-ghost" :disabled="saving" @click="close">取消</button>
          <button type="button" class="app-directory-dialog__button" :class="mode === 'delete' ? 'is-danger' : 'is-primary'" :disabled="disabled" @click="confirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-directory-dialog {
  position: fixed;
  z-index: 2050;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.5);
  font-family: var(--app-font-family);
}

.app-directory-dialog,
.app-directory-dialog * { box-sizing: border-box; }

.app-directory-dialog__panel {
  position: relative;
  width: min(400px, calc(100vw - 48px));
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.app-directory-dialog__accent { height: 3px; background: var(--directory-dialog-accent); }
.app-directory-dialog__body { padding: 20px 24px 16px; }
.app-directory-dialog__heading { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.app-directory-dialog__icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; flex: 0 0 34px; border-radius: 50%; background: var(--directory-dialog-icon-background); color: var(--directory-dialog-accent); }
.app-directory-dialog__title { color: var(--app-text-primary); font-size: 15px; font-weight: 600; line-height: 22px; }
.app-directory-dialog__field { display: block; }
.app-directory-dialog__field > span:first-child { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 600; line-height: 18px; }
.app-directory-dialog__required { margin-left: 2px; color: #f53f3f; }
.app-directory-dialog__field-meta { display: flex; justify-content: space-between; min-height: 18px; margin-top: 5px; color: var(--app-text-muted); font-size: 11px; line-height: 18px; }
.app-directory-dialog__error { color: var(--app-danger); font-size: 12px; }
.app-directory-dialog__field input { box-sizing: border-box; width: 100%; height: 36px; padding: 0 12px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: none; color: var(--app-text-primary); font-size: 13px; line-height: 19.5px; }
.app-directory-dialog__field input:focus { border-color: var(--directory-dialog-accent); }
.app-directory-dialog__field input.is-error { border-color: #f53f3f; background: #fff8f8; }
.app-directory-dialog__footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 24px; border-top: 1px solid var(--app-border); background: #fff; }
.app-directory-dialog__button { display: inline-flex; height: 32px; align-items: center; justify-content: center; padding: 0 12px; border: 1px solid var(--app-border); border-radius: 8px; background: #fff; color: var(--app-text-secondary); cursor: pointer; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.app-directory-dialog__button.is-primary, .app-directory-dialog__button.is-danger { padding: 0 14px; border-color: var(--directory-dialog-accent); background: var(--directory-dialog-accent); color: #fff; }
.app-directory-dialog__button.is-danger { border-color: #f53f3f; background: #f53f3f; }
.app-directory-dialog__button:not(:disabled):hover { filter: brightness(1.1); }
.app-directory-dialog__button:not(:disabled):active { transform: scale(.98); }
.app-directory-dialog__button:disabled { cursor: not-allowed; opacity: .6; }
.app-directory-dialog__panel.is-delete { width: min(380px, calc(100vw - 48px)); }
.app-directory-dialog__panel.is-delete .app-directory-dialog__accent { background: #f53f3f; }
.app-directory-dialog__delete-body { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px; }
.app-directory-dialog__delete-icon { display: inline-flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border-radius: 50%; background: rgba(245, 63, 63, 0.07); color: #f53f3f; }
.app-directory-dialog__delete-body h2 { margin: 0 0 6px; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.app-directory-dialog__delete-body p { margin: 0; color: #4e5969; font-size: 13px; font-weight: 400; line-height: 22.1px; }
.app-directory-dialog__delete-body p.is-danger { color: #f53f3f; }
</style>
