<script setup lang="ts">
import { AlertTriangle, ChevronDown as AppSelectChevron, Play, Save, X } from '@lucide/vue'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    subtitle: string
    method: string
    path: string
    caseName: string
    priority: string
    priorityOptions: readonly string[]
    status: string
    statusOptions: readonly string[]
    tags: string[]
    showStatus?: boolean
    unsaved?: boolean
    showCloseConfirm?: boolean
    canDebug: boolean
    canWrite: boolean
    saving: boolean
    debugging?: boolean
    isEdit: boolean
    readOnly?: boolean
    primaryActionLabel?: string
    showFooter?: boolean
  }>(),
  {
    debugging: false,
    readOnly: false,
    primaryActionLabel: '发送',
    showFooter: true,
    showStatus: false,
    unsaved: false,
    showCloseConfirm: false,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:caseName', value: string): void
  (event: 'update:priority', value: string): void
  (event: 'update:status', value: string): void
  (event: 'update:tags', value: string[]): void
  (event: 'requestClose'): void
  (event: 'cancelCloseConfirm'): void
  (event: 'discardClose'): void
  (event: 'debug'): void
  (event: 'create'): void
  (event: 'save'): void
}>()

const submitLabel = computed(() => (props.isEdit ? '保存' : '创建'))
const addingTag = ref(false)
const tagInput = ref('')

function handleDrawerModelValueChange(value: boolean) {
  if (!value) {
    emit('requestClose')
    return
  }
  emit('update:modelValue', value)
}

function handleBeforeClose() {
  emit('requestClose')
}

function handleCloseClick() {
  emit('requestClose')
}

function updateCaseName(value: string | number) {
  emit('update:caseName', String(value))
}

function updatePriority(value: string | number) {
  emit('update:priority', String(value))
}

function updateStatus(value: string | number) {
  emit('update:status', String(value))
}

function updateTags(value: string | string[]) {
  emit('update:tags', Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [])
}

function commitTag() {
  const value = tagInput.value.trim()
  if (value && !props.tags.includes(value)) {
    updateTags([...props.tags, value])
  }
  tagInput.value = ''
  addingTag.value = false
}

function cancelTagEntry() {
  tagInput.value = ''
  addingTag.value = false
}

function removeTag(tag: string) {
  updateTags(props.tags.filter(item => item !== tag))
}

function handleSubmitClick() {
  if (props.isEdit) {
    emit('save')
    return
  }
  emit('create')
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    append-to-body
    destroy-on-close
    :with-header="false"
    :show-close="false"
    :close-on-click-modal="!props.saving"
    :close-on-press-escape="!props.saving"
    modal-class="api-case-drawer-modal"
    size="820px"
    class="api-case-drawer"
    :before-close="handleBeforeClose"
    @update:model-value="handleDrawerModelValueChange"
  >
    <div class="api-case-drawer-shell">
      <div class="api-case-drawer-top">
        <div class="api-case-drawer-header">
          <div class="api-case-drawer-title">{{ props.title }}</div>
          <div class="api-case-drawer-subtitle">
            <span :class="['api-case-drawer-method-tag', `request-method-${String(props.method || 'GET').toLowerCase()}`]">{{ props.method || 'GET' }}</span>
            <span class="api-case-drawer-summary-path">{{ props.path || '未设置路径' }}</span>
            <span class="api-case-drawer-context-separator">·</span>
            <span class="api-case-drawer-context-name">{{ props.subtitle }}</span>
          </div>
        </div>
        <span v-if="props.unsaved" class="api-case-drawer-unsaved"><i />未保存</span>
        <button type="button" class="api-case-drawer-close" :disabled="props.saving" @click="handleCloseClick">
          <X />
        </button>
      </div>

      <div class="api-case-drawer-meta">
        <slot name="notice" />

        <div class="api-case-drawer-name-row">
          <el-input
            :model-value="props.caseName"
            :disabled="props.readOnly"
            maxlength="255"
            show-word-limit
            placeholder="请输入用例名称"
            class="api-case-drawer-name-input"
            @update:model-value="updateCaseName"
          />
          <el-button class="api-case-drawer-debug-button" type="primary" :disabled="!props.canDebug" :loading="props.debugging" @click="emit('debug')">
            <Play :size="13" />
            {{ props.primaryActionLabel }}
          </el-button>
        </div>

        <div class="api-case-drawer-meta-row">
          <div class="api-case-drawer-priority" role="group" aria-label="优先级">
            <button
              v-for="item in props.priorityOptions"
              :key="item"
              type="button"
              :class="['api-case-drawer-priority-option', `is-${item.toLowerCase()}`, { 'is-active': props.priority === item }]"
              :disabled="props.readOnly"
              @click="updatePriority(item)"
            >{{ item }}</button>
          </div>
          <el-select v-if="props.showStatus" :suffix-icon="AppSelectChevron"
            :model-value="props.status"
            :disabled="props.readOnly"
            class="api-case-drawer-meta-field"
            placeholder="状态"
            @update:model-value="updateStatus"
          >
            <el-option v-for="item in props.statusOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <div class="api-case-drawer-tags-field">
            <span v-for="tag in props.tags" :key="tag" class="api-case-drawer-tag-chip">
              {{ tag }}
              <button type="button" :disabled="props.readOnly" :aria-label="`删除标签 ${tag}`" @click="removeTag(tag)">
                <X :size="10" />
              </button>
            </span>
            <input
              v-if="addingTag"
              v-model="tagInput"
              class="api-case-drawer-tag-input"
              :disabled="props.readOnly"
              autofocus
              @blur="commitTag"
              @keydown.enter.prevent="commitTag"
              @keydown.esc.stop.prevent="cancelTagEntry"
            />
            <button
              v-else
              type="button"
              class="api-case-drawer-add-tag"
              :disabled="props.readOnly"
              @click="addingTag = true"
            >+ 标签</button>
          </div>
        </div>
      </div>

      <div class="api-case-drawer-tabs">
        <slot name="tabs" />
      </div>
      <div class="api-case-drawer-workspace">
        <div class="api-case-drawer-body">
          <slot name="body" />
        </div>
        <div class="api-case-drawer-response">
          <slot name="response" />
        </div>
      </div>

      <div v-if="props.showFooter" class="api-case-drawer-footer">
        <el-button class="api-case-drawer-cancel-button" :disabled="props.saving" @click="handleCloseClick">取消</el-button>
        <el-button class="api-case-drawer-submit-button" type="primary" :disabled="!props.canWrite" :loading="props.saving" @click="handleSubmitClick">
          <Save v-if="!props.saving" :size="13" />
          {{ submitLabel }}
        </el-button>
      </div>
    </div>
  </el-drawer>

  <Teleport to="body">
    <div
      v-if="props.showCloseConfirm"
      class="api-case-unsaved-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-case-unsaved-confirm-title"
      tabindex="-1"
      @click.self="emit('cancelCloseConfirm')"
      @keydown.esc.stop.prevent="emit('cancelCloseConfirm')"
    >
      <section class="api-case-unsaved-confirm__panel">
        <div class="api-case-unsaved-confirm__body">
          <AlertTriangle :size="17" class="api-case-unsaved-confirm__icon" aria-hidden="true" />
          <div class="api-case-unsaved-confirm__copy">
            <strong id="api-case-unsaved-confirm-title">存在未保存的修改</strong>
            <p>关闭后当前修改将丢失，是否确认关闭？</p>
          </div>
        </div>
        <div class="api-case-unsaved-confirm__actions">
          <button type="button" class="api-case-unsaved-confirm__button" autofocus @click="emit('cancelCloseConfirm')">
            继续编辑
          </button>
          <button type="button" class="api-case-unsaved-confirm__button is-discard" @click="emit('discardClose')">
            放弃并关闭
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
:global(.api-case-drawer-modal) {
  background: rgba(0, 0, 0, 0.18);
}

:global(.api-case-drawer.el-drawer) {
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: auto;
  max-width: 100vw;
  overflow: hidden;
  background: #fff;
  border: 0;
  border-radius: 0;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.11);
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

:global(.api-case-drawer.el-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.api-case-drawer :deep(.el-button),
.api-case-drawer :deep(.el-input__inner) {
  font-family: inherit;
}

.api-case-drawer-shell {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.api-case-drawer-top {
  display: flex;
  box-sizing: border-box;
  min-height: 81px;
  flex: 0 0 81px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.api-case-drawer-header {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0;
}

.api-case-drawer-title {
  overflow: hidden;
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-subtitle {
  display: flex;
  min-width: 0;
  box-sizing: border-box;
  align-items: center;
  height: 25px;
  gap: 6px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  padding-top: 4px;
  white-space: nowrap;
}

.api-case-drawer-unsaved {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  color: #ff7d00;
  font-size: 11px;
}

.api-case-drawer-unsaved i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.api-case-unsaved-confirm {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.25);
}

.api-case-unsaved-confirm__panel {
  box-sizing: border-box;
  width: min(360px, calc(100vw - 32px));
  padding: 22px 26px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
}

.api-case-unsaved-confirm__body {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 18px;
}

.api-case-unsaved-confirm__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #ff7d00;
}

.api-case-unsaved-confirm__copy strong {
  display: block;
  margin-bottom: 5px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.api-case-unsaved-confirm__copy p {
  margin: 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 1.65;
}

.api-case-unsaved-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.api-case-unsaved-confirm__button {
  box-sizing: border-box;
  min-height: 34px;
  padding: 6px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.api-case-unsaved-confirm__button:hover,
.api-case-unsaved-confirm__button:focus-visible {
  border-color: #c9cdd4;
  background: #f7f8fa;
  outline: none;
}

.api-case-unsaved-confirm__button.is-discard {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #fff;
}

.api-case-unsaved-confirm__button.is-discard:hover,
.api-case-unsaved-confirm__button.is-discard:focus-visible {
  border-color: #cb2636;
  background: #cb2636;
}

.api-case-drawer-context-separator {
  color: #c9cdd4;
}

.api-case-drawer-context-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.api-case-drawer-close {
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.api-case-drawer-close:hover,
.api-case-drawer-close:focus-visible {
  background: #f3f4f6;
  color: #374151;
}

.api-case-drawer-close svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.api-case-drawer-meta {
  box-sizing: border-box;
  display: flex;
  min-height: 106.5px;
  flex: 0 0 auto;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.api-case-drawer-method-tag {
  display: inline-flex;
  min-width: 43px;
  height: 21px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: #f2f3f5;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.api-case-drawer-method-tag.request-method-get,
.api-case-drawer-method-tag.request-method-head {
  color: #00b42a;
  background: #e8ffea;
}

.api-case-drawer-method-tag.request-method-post {
  color: #ff7d00;
  background: rgba(255, 125, 0, 0.07);
}

.api-case-drawer-method-tag.request-method-put {
  color: #165dff;
  background: #e8f3ff;
}

.api-case-drawer-method-tag.request-method-delete {
  color: #f53f3f;
  background: #ffe8e8;
}

.api-case-drawer-method-tag.request-method-patch,
.api-case-drawer-method-tag.request-method-options {
  color: #7816ff;
  background: #f5e8ff;
}

.api-case-drawer-method-tag.request-method-trace {
  color: #6b7280;
}

.api-case-drawer-summary-path {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 340px;
  overflow: hidden;
  color: #4e5969;
  font-family: Cousine, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
}

@font-face {
  font-family: Cousine;
  src: url('../../assets/fonts/cousine/Cousine-latin-400.woff2') format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

.api-case-drawer-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.api-case-drawer-name-input :deep(.el-input__wrapper),
.api-case-drawer-meta-field :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 7px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-case-drawer-name-input :deep(.el-input__inner) {
  font-size: 13px;
}

.api-case-drawer-name-input :deep(.el-input__count-inner) {
  font-size: 11px;
}

.api-case-drawer-name-input :deep(.el-input__wrapper:hover),
.api-case-drawer-meta-field :deep(.el-select__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #9ca3af;
}

.api-case-drawer-name-input :deep(.el-input__wrapper.is-focus),
.api-case-drawer-meta-field :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-case-drawer-meta-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-case-drawer-priority {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  height: 30px;
  padding: 2px 3px;
  border-radius: 6px;
  background: #f4f6fa;
}

.api-case-drawer-priority-option {
  min-width: 38px;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.api-case-drawer-priority-option.is-active.is-p0 { background: #fff0f0; color: #f53f3f; }
.api-case-drawer-priority-option.is-active.is-p1 { background: #fff7e6; color: #ff7d00; }
.api-case-drawer-priority-option.is-active.is-p2 { background: #e8f0ff; color: #165dff; }
.api-case-drawer-priority-option.is-active.is-p3 { background: #e5e6eb; color: #4e5969; }
.api-case-drawer-priority-option:disabled { cursor: not-allowed; }

.api-case-drawer-tags-field {
  display: flex;
  min-width: 0;
  max-width: min(360px, 48%);
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.api-case-drawer-add-tag {
  box-sizing: border-box;
  display: inline-flex;
  width: 58px;
  height: 26px;
  flex: 0 0 58px;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border: 1px dashed #e5e6eb;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-case-drawer-add-tag:disabled,
.api-case-drawer-tag-chip button:disabled {
  cursor: not-allowed;
}

.api-case-drawer-tag-chip {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 5px;
  background: rgba(22, 93, 255, 0.055);
  color: #165dff;
  font-size: 12px;
  line-height: 18px;
}

.api-case-drawer-tag-chip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(22, 93, 255, 0.44);
  cursor: pointer;
  line-height: 0;
}

.api-case-drawer-tag-chip button:hover {
  color: #165dff;
}

.api-case-drawer-tag-input {
  box-sizing: border-box;
  width: 80px;
  height: 26px;
  padding: 3px 9px;
  border: 1px solid #165dff;
  border-radius: 5px;
  outline: none;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.api-case-drawer-meta-field {
  width: 120px;
}

.api-case-drawer-tabs {
  display: flex;
  min-width: 0;
  align-items: center;
  box-sizing: border-box;
  height: 45px;
  min-height: 45px;
  flex: 0 0 45px;
  border-bottom: 1px solid #e5e6eb;
}

.api-case-drawer-workspace {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.api-case-drawer-body {
  min-width: 0;
  min-height: 0;
  flex: 3 1 0;
  overflow: hidden;
}

.api-case-drawer-response {
  min-width: 0;
  min-height: 140px;
  flex: 2 1 0;
  overflow: hidden;
}

.api-case-drawer-footer {
  box-sizing: border-box;
  display: flex;
  height: 55px;
  min-height: 55px;
  flex: 0 0 55px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 20px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.api-case-drawer-debug-button,
.api-case-drawer-submit-button,
.api-case-drawer-cancel-button {
  min-width: 64px;
  height: 34px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.api-case-drawer-debug-button {
  min-width: 85px;
  height: 36px;
  gap: 6px;
}

.api-case-drawer-submit-button {
  min-width: 84px;
  height: 32px;
}

:global(.api-case-drawer .api-case-drawer-debug-button.el-button--primary),
:global(.api-case-drawer .api-case-drawer-submit-button.el-button--primary) {
  --el-button-bg-color: #165dff;
  --el-button-border-color: #165dff;
  --el-button-hover-bg-color: #0e4ecc;
  --el-button-hover-border-color: #0e4ecc;
  --el-button-active-bg-color: #0b3fa3;
  --el-button-active-border-color: #0b3fa3;
  --el-button-disabled-bg-color: #9db9ff;
  --el-button-disabled-border-color: #9db9ff;
  color: #fff;
}

.api-case-drawer-cancel-button {
  --el-button-text-color: #111827;
  --el-button-border-color: #d1d5db;
  --el-button-bg-color: #fff;
  --el-button-hover-text-color: #111827;
  --el-button-hover-border-color: #9ca3af;
  --el-button-hover-bg-color: #f9fafb;
  color: #111827;
}

@media (max-width: 840px) {
  .api-case-drawer-meta-row { flex-wrap: wrap; }
}

@media (max-width: 700px) {
  .api-case-drawer-name-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

:global(.api-case-drawer .api-case-drawer-tabs .case-drawer-top-tabs) {
  box-sizing: border-box;
  height: 44px;
  min-height: 44px;
  padding: 0 4px;
  border: 0;
}

:global(.api-case-drawer .api-case-drawer-tabbar) {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
}

:global(.api-case-drawer .api-case-drawer-tabbar .case-drawer-top-tabs) {
  flex: 1 1 auto;
}

:global(.api-case-drawer .api-case-drawer-tab-note) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding-right: 14px;
  color: #86909c;
  font-size: 11px;
}

:global(.api-case-drawer .api-case-drawer-tab-note svg) {
  width: 11px;
  height: 11px;
}

:global(.api-case-drawer .api-case-drawer-tabs .ms-like-top-tab) {
  height: 44px;
  padding: 0 16px;
  font-size: 13px;
}

:global(.api-case-drawer .api-case-drawer-tabs .ms-like-top-tab.active) {
  border-bottom-color: #ff7d00;
  color: #ff7d00;
  font-weight: 600;
}

:global(.api-case-drawer .api-case-drawer-body .api-case-editor-panel),
:global(.api-case-drawer .api-case-drawer-body > .request-section) {
  min-height: 100%;
}

:global(.api-case-drawer .api-case-drawer-response .case-drawer-response-shell) {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding-top: 0;
  border-top: 0;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-header) {
  box-sizing: border-box;
  height: 41px;
  min-height: 41px;
  padding: 0 8px 0 16px;
  border-top: 2px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-tabs) {
  height: 39px;
  margin: 0 0 0 auto;
  border: 0;
  background: transparent;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-tabs .ms-like-top-tab) {
  height: 39px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-tabs .ms-like-top-tab.active) {
  border-bottom-color: #165dff;
  color: #165dff;
}

:global(.api-case-drawer .api-case-drawer-response .response-more-tab) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

:global(.api-case-drawer .api-case-drawer-response .response-more-tab svg) {
  width: 12px;
  height: 12px;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-body) {
  min-height: 0;
  padding: 0 16px 10px;
}

:global(.api-case-drawer .api-case-drawer-response .ms-like-response-empty) {
  min-height: 0;
  padding: 6px 16px 12px;
}
</style>
