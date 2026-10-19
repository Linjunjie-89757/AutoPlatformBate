<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed } from 'vue'
import { X } from '@lucide/vue'

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
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:caseName', value: string): void
  (event: 'update:priority', value: string): void
  (event: 'update:status', value: string): void
  (event: 'update:tags', value: string[]): void
  (event: 'requestClose'): void
  (event: 'debug'): void
  (event: 'create'): void
  (event: 'save'): void
}>()

const submitLabel = computed(() => (props.isEdit ? '保存' : '创建'))

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
    close-on-click-modal
    close-on-press-escape
    modal-class="api-case-drawer-modal"
    size="894px"
    class="api-case-drawer"
    :before-close="handleBeforeClose"
    @update:model-value="handleDrawerModelValueChange"
  >
    <div class="api-case-drawer-shell">
      <div class="api-case-drawer-top">
        <div class="api-case-drawer-header">
          <div class="api-case-drawer-title">{{ props.title }}</div>
          <div class="api-case-drawer-subtitle">{{ props.subtitle }}</div>
        </div>
        <button type="button" class="api-case-drawer-close" @click="handleCloseClick">
          <X />
        </button>
      </div>

      <div class="api-case-drawer-scroll">
        <div class="api-case-drawer-summary-card">
          <div class="api-case-drawer-summary-main">
            <div class="api-case-drawer-summary-meta">
              <span :class="['api-case-drawer-method-tag', `request-method-${String(props.method || 'GET').toLowerCase()}`]">
                {{ props.method || 'GET' }}
              </span>
              <span class="api-case-drawer-summary-path">{{ props.path || '未设置路径' }}</span>
            </div>
          </div>
        </div>

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
            {{ props.primaryActionLabel }}
          </el-button>
        </div>

        <div class="api-case-drawer-meta-row">
          <el-select :suffix-icon="AppSelectChevron"
            :model-value="props.priority"
            :disabled="props.readOnly"
            class="api-case-drawer-meta-field"
            placeholder="优先级"
            @update:model-value="updatePriority"
          >
            <el-option v-for="item in props.priorityOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-select :suffix-icon="AppSelectChevron"
            :model-value="props.status"
            :disabled="props.readOnly"
            class="api-case-drawer-meta-field"
            placeholder="状态"
            @update:model-value="updateStatus"
          >
            <el-option v-for="item in props.statusOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-select :suffix-icon="AppSelectChevron"
            :model-value="props.tags"
            :disabled="props.readOnly"
            class="api-case-drawer-tags-field"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :teleported="false"
            popper-class="api-case-drawer-tag-popper"
            placeholder="输入内容后回车可直接添加标签"
            @update:model-value="updateTags"
          />
        </div>

        <div class="api-case-drawer-tabs">
          <slot name="tabs" />
        </div>
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
          {{ submitLabel }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:global(.api-case-drawer-modal) {
  background: rgba(15, 23, 42, 0.28);
}

.api-case-drawer :deep(.el-drawer) {
  max-width: calc(100vw - 24px);
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  border-radius: 16px 0 0 16px;
  box-shadow: -24px 0 56px rgba(15, 23, 42, 0.16);
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

.api-case-drawer :deep(.el-drawer__body) {
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-drawer-title {
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-subtitle {
  overflow: hidden;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
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

.api-case-drawer-scroll {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 20px 24px 24px;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.api-case-drawer-scroll::-webkit-scrollbar {
  width: 8px;
}

.api-case-drawer-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.64);
}

.api-case-drawer-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.api-case-drawer-summary-card {
  padding: 0;
}

.api-case-drawer-summary-main,
.api-case-drawer-summary-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-case-drawer-method-tag {
  display: inline-flex;
  min-width: 44px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.api-case-drawer-method-tag.request-method-get,
.api-case-drawer-method-tag.request-method-head {
  color: #15803d;
}

.api-case-drawer-method-tag.request-method-post {
  color: #ea580c;
}

.api-case-drawer-method-tag.request-method-put {
  color: #2563eb;
}

.api-case-drawer-method-tag.request-method-delete {
  color: #dc2626;
}

.api-case-drawer-method-tag.request-method-patch,
.api-case-drawer-method-tag.request-method-options {
  color: #7c3aed;
}

.api-case-drawer-method-tag.request-method-trace {
  color: #6b7280;
}

.api-case-drawer-summary-path {
  min-width: 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}

.api-case-drawer-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.api-case-drawer-name-input :deep(.el-input__wrapper),
.api-case-drawer-meta-field :deep(.el-select__wrapper),
.api-case-drawer-tags-field :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-case-drawer-name-input :deep(.el-input__wrapper:hover),
.api-case-drawer-meta-field :deep(.el-select__wrapper:hover),
.api-case-drawer-tags-field :deep(.el-select__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #9ca3af;
}

.api-case-drawer-name-input :deep(.el-input__wrapper.is-focus),
.api-case-drawer-meta-field :deep(.el-select__wrapper.is-focused),
.api-case-drawer-tags-field :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-case-drawer-tags-field :deep(.el-select__wrapper) {
  align-items: center;
  padding: 0 10px;
}

.api-case-drawer-tags-field :deep(.el-select__selection) {
  display: flex;
  min-height: 34px;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.api-case-drawer-tags-field :deep(.el-select__caret),
.api-case-drawer-tags-field :deep(.el-select__suffix) {
  display: none;
}

.api-case-drawer-tags-field :deep(.el-tag) {
  height: 24px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  line-height: 22px;
  box-shadow: none;
}

.api-case-drawer-tags-field :deep(.el-tag .el-tag__content) {
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
}

.api-case-drawer-meta-row {
  display: grid;
  grid-template-columns: 140px 140px minmax(0, 1fr);
  gap: 12px;
}

.api-case-drawer-tabs,
.api-case-drawer-body,
.api-case-drawer-response {
  min-width: 0;
}

.api-case-drawer-tabs,
.api-case-drawer-body,
.api-case-drawer-response {
  flex: 0 0 auto;
}

.api-case-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-debug-button,
.api-case-drawer-submit-button,
.api-case-drawer-cancel-button {
  min-width: 76px;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.api-case-drawer :deep(.api-case-drawer-debug-button.el-button--primary),
.api-case-drawer :deep(.api-case-drawer-submit-button.el-button--primary) {
  --el-button-bg-color: #2563eb;
  --el-button-border-color: #2563eb;
  --el-button-hover-bg-color: #1d4ed8;
  --el-button-hover-border-color: #1d4ed8;
  --el-button-active-bg-color: #1e40af;
  --el-button-active-border-color: #1e40af;
  --el-button-disabled-bg-color: #93c5fd;
  --el-button-disabled-border-color: #93c5fd;
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

@media (max-width: 960px) {
  .api-case-drawer-meta-row,
  .api-case-drawer-name-row {
    grid-template-columns: 1fr;
  }
}
</style>
