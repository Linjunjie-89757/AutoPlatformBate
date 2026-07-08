<script setup lang="ts">
import { ref } from 'vue'
import {
  Info as LucideInfo,
  Play as LucidePlay,
  Save as LucideSave,
} from '@lucide/vue'

import type { ApiAutomationEnvironmentItem } from '@/entities/api-automation'

const pathInputRef = ref<{ focus: () => void } | null>(null)

const props = defineProps<{
  method: string
  path: string
  definitionId: number | null
  environmentId: number | null
  environments: ApiAutomationEnvironmentItem[]
  environmentSelected: boolean
  runOptionsLoading: boolean
  sending: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'update:method': [value: string]
  'update:path': [value: string]
  'update:environmentId': [value: number | null]
  dirty: []
  importCurl: []
  openEnvironment: []
  persistRunOptions: []
  send: []
  save: []
  saveAsCase: []
  duplicate: []
  delete: []
}>()

const apiMethodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE'] as const

function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

function updateMethod(value: string) {
  emit('update:method', value)
  emit('dirty')
}

function updatePath(value: string) {
  emit('update:path', value)
  emit('dirty')
}

function updateEnvironment(value: number | null) {
  emit('update:environmentId', value)
  emit('persistRunOptions')
}

defineExpose({
  focus: () => pathInputRef.value?.focus(),
})
</script>

<template>
  <div class="api-request-line">
    <div class="api-url-compose">
      <el-select
        :model-value="props.method"
        :class="['api-method-select', requestMethodClass(props.method)]"
        popper-class="api-method-popper"
        @update:model-value="updateMethod"
      >
        <el-option v-for="methodOption in apiMethodOptions" :key="methodOption" :label="methodOption" :value="methodOption">
          <span :class="['api-method-option', requestMethodClass(methodOption)]">{{ methodOption }}</span>
        </el-option>
      </el-select>
      <el-input
        ref="pathInputRef"
        :model-value="props.path"
        placeholder="请输入包含 http/https 的完整 URL 或接口路径"
        @update:model-value="updatePath"
      />
      <button type="button" class="api-curl-button" @click="emit('importCurl')">Curl</button>
    </div>
    <div class="api-run-environment-combo">
      <el-tooltip
        :content="props.environmentSelected ? '查看运行环境详情' : '选择运行环境后查看详情'"
        placement="top"
      >
        <button
          type="button"
          class="api-run-environment-detail-button"
          :disabled="!props.environmentSelected"
          @click="emit('openEnvironment')"
        >
          <LucideInfo class="api-run-environment-detail-icon" />
        </button>
      </el-tooltip>
      <el-select
        :model-value="props.environmentId"
        class="api-run-environment-select"
        clearable
        filterable
        :loading="props.runOptionsLoading"
        placeholder="运行环境"
        popper-class="api-run-env-popper"
        @update:model-value="updateEnvironment"
      >
        <el-option
          v-for="environment in props.environments"
          :key="environment.id"
          :label="environment.name"
          :value="environment.id"
        />
      </el-select>
    </div>
    <button
      type="button"
      class="api-send-button"
      :disabled="props.sending || !props.path.trim()"
      @click="emit('send')"
    >
      <LucidePlay class="api-send-button__icon" />
      发送
    </button>
    <el-dropdown
      split-button
      class="api-save-dropdown"
      popper-class="api-save-dropdown-menu"
      :disabled="!props.path.trim()"
      :loading="props.saving"
      @click="emit('save')"
    >
      <span class="api-save-label">
        <LucideSave class="api-button-icon" />
        保存
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="props.definitionId" @click="emit('saveAsCase')">保存为用例</el-dropdown-item>
          <el-dropdown-item @click="emit('duplicate')">
            复制接口
          </el-dropdown-item>
          <el-dropdown-item @click="emit('delete')">
            删除接口
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.api-request-line {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 168px 80px 92px;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #fff;
}

.api-url-compose {
  display: grid;
  min-width: 0;
  grid-template-columns: 90px minmax(0, 1fr) 68px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.api-url-compose:focus-within {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
}

.api-run-environment-combo {
  display: grid;
  min-width: 0;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.api-run-environment-combo:focus-within {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
}

.api-run-environment-select {
  width: 100%;
  min-width: 0;
}

.api-run-environment-select :deep(.el-select__wrapper) {
  height: 36px;
  min-height: 36px;
  padding-left: 8px;
  border-radius: 0;
  background: var(--app-bg-panel);
  box-shadow: none;
}

.api-run-environment-select :deep(.el-select__selected-item),
.api-run-environment-select :deep(.el-select__placeholder) {
  font-size: 12px;
}

.api-run-environment-detail-button {
  display: inline-flex;
  width: 31px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-right: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  cursor: pointer;
}

.api-run-environment-detail-button:hover:not(:disabled) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-run-environment-detail-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.api-run-environment-detail-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

.api-method-select :deep(.el-select__wrapper),
.api-url-compose :deep(.el-input__wrapper),
.api-curl-button {
  height: 36px;
  min-height: 36px;
  border-radius: 0;
  font-size: 13px;
  line-height: 20px;
}

.api-method-select :deep(.el-select__wrapper) {
  min-height: 36px;
  padding: 0 10px;
  border-color: var(--app-border);
  border-style: solid;
  border-width: 0 1px 0 0;
  border-radius: var(--app-radius-md);
  border-bottom-right-radius: 0;
  border-top-right-radius: 0;
  background: var(--app-bg-muted);
  box-shadow: none;
  color: var(--app-text-primary);
}

.api-method-select :deep(.el-select__wrapper:hover),
.api-method-select :deep(.el-select__wrapper.is-focused),
.api-method-select.is-focus :deep(.el-select__wrapper) {
  border-color: var(--app-border);
  border-style: solid;
  border-width: 0 1px 0 0;
  background: var(--app-bg-muted);
  box-shadow: none;
  color: var(--app-text-primary);
}

.api-method-select {
  width: 90px;
  min-width: 90px;
  line-height: 21px;
}

.api-method-select :deep(.el-select__selected-item) {
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.api-method-select.method-get :deep(.el-select__selected-item),
.api-method-select.method-get :deep(.el-select__placeholder) { color: #00B42A; }
.api-method-select.method-post :deep(.el-select__selected-item),
.api-method-select.method-post :deep(.el-select__placeholder) { color: #FF7D00; }
.api-method-select.method-put :deep(.el-select__selected-item),
.api-method-select.method-put :deep(.el-select__placeholder) { color: #165DFF; }
.api-method-select.method-patch :deep(.el-select__selected-item),
.api-method-select.method-patch :deep(.el-select__placeholder) { color: #7816FF; }
.api-method-select.method-delete :deep(.el-select__selected-item),
.api-method-select.method-delete :deep(.el-select__placeholder) { color: #F53F3F; }
.api-method-select.method-options :deep(.el-select__selected-item),
.api-method-select.method-options :deep(.el-select__placeholder) { color: #7816FF; }
.api-method-select.method-trace :deep(.el-select__selected-item),
.api-method-select.method-trace :deep(.el-select__placeholder) { color: #6b7280; }
.api-method-select.method-head :deep(.el-select__selected-item),
.api-method-select.method-head :deep(.el-select__placeholder) { color: #15803d; }

.api-method-option {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

:global(.api-method-popper .el-select-dropdown__item) {
  height: 34px;
  font-weight: 600;
  line-height: 34px;
}

:global(.api-method-popper .method-get) {
  color: #00B42A;
}

:global(.api-method-popper .method-post) {
  color: #FF7D00;
}

:global(.api-method-popper .method-put) {
  color: #165DFF;
}

:global(.api-method-popper .method-patch),
:global(.api-method-popper .method-options) {
  color: #7816FF;
}

:global(.api-method-popper .method-trace) {
  color: #6b7280;
}

:global(.api-method-popper .method-head) {
  color: #00B42A;
}

:global(.api-method-popper .method-delete) {
  color: #F53F3F;
}

:global(.api-method-popper.el-select-dropdown) {
  border-radius: 4px;
}

.api-url-compose :deep(.el-input__wrapper) {
  padding-inline: 14px;
  background: var(--app-bg-panel);
  box-shadow: none;
}

.api-url-compose :deep(.el-input__inner) {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
}

.api-url-compose :deep(.el-input__inner::placeholder) {
  color: var(--app-text-muted);
}

.api-curl-button {
  border-width: 0 0 0 1px;
  border-color: var(--app-border);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.api-curl-button:hover {
  background: var(--app-bg-soft);
  color: var(--app-primary);
}

.api-send-button {
  display: inline-flex;
  width: 80px;
  min-width: 80px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: var(--app-primary);
  color: #fff;
  cursor: pointer;
  box-shadow: none;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.api-send-button:hover:not(:disabled) {
  background: var(--app-primary-hover);
}

.api-send-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.api-send-button__icon,
.api-button-icon {
  width: 13px;
  height: 13px;
}

.api-save-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.api-save-dropdown {
  width: 92px;
  min-width: 92px;
}

.api-save-dropdown :deep(.el-button-group) {
  display: flex;
  width: 100%;
  height: 36px;
  align-items: stretch;
}

.api-save-dropdown :deep(.el-button),
.api-save-dropdown :deep(.el-button-group > .el-button) {
  height: 36px;
  border-color: var(--app-border);
  background: var(--app-bg-panel);
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.api-save-dropdown :deep(.el-button-group > .el-button:first-child) {
  flex: 1 1 auto;
  min-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  padding: 0 8px;
}

.api-save-dropdown :deep(.el-button-group > .el-button:last-child) {
  flex: 0 0 30px;
  width: 30px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0;
}

.api-save-dropdown :deep(.el-button:hover:not(.is-disabled)) {
  border-color: var(--app-primary);
  background: #fff;
  color: var(--app-primary);
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item) {
  gap: 6px;
  min-height: 32px;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .api-request-line {
    grid-template-columns: minmax(300px, 1fr) 152px 76px 88px;
  }

  .api-url-compose {
    grid-template-columns: 88px minmax(0, 1fr) 62px;
  }

  .api-method-select {
    width: 88px;
    min-width: 88px;
  }
}
</style>
