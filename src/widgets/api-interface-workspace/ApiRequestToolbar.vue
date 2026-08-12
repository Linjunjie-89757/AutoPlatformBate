<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ApiAutomationEnvironmentItem } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'

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
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
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
const canMutate = computed(() => props.definitionId ? props.canEdit !== false : props.canCreate !== false)

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
        :disabled="!canMutate"
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
        :disabled="!canMutate"
        @update:model-value="updatePath"
      />
      <button type="button" class="api-curl-button" :disabled="!canMutate" @click="emit('importCurl')">Curl</button>
    </div>
    <div class="api-run-environment-combo">
      <button
        type="button"
        class="api-run-environment-detail-button"
        :disabled="!props.environmentSelected"
        title="查看运行环境详情"
        @click="emit('openEnvironment')"
      ></button>
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
      :disabled="props.canExecute === false || props.sending || !props.path.trim()"
      @click="emit('send')"
    >
      <img class="api-send-button__icon" :src="figmaApiInterfaceIcons.send" alt="" />
      发送
    </button>
    <el-dropdown
      split-button
      class="api-save-dropdown"
      popper-class="api-save-dropdown-menu"
      :disabled="!canMutate || !props.path.trim()"
      :loading="props.saving"
      @click="emit('save')"
    >
      <span class="api-save-label">
        <img class="api-button-icon" :src="figmaApiInterfaceIcons.save" alt="" />
        保存
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="props.definitionId && props.canCreate !== false" @click="emit('saveAsCase')">保存为用例</el-dropdown-item>
          <el-dropdown-item v-if="props.canCreate !== false" @click="emit('duplicate')">
            复制接口
          </el-dropdown-item>
          <el-dropdown-item v-if="props.canDelete !== false" @click="emit('delete')">
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
  box-sizing: border-box;
  grid-template-columns: minmax(0, 1fr) 110px 72.25px auto;
  align-items: center;
  gap: 7px;
  height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #fff;
}

.api-url-compose {
  display: grid;
  box-sizing: border-box;
  height: 31.5px;
  min-width: 0;
  grid-template-columns: 90px minmax(0, 1fr) 47px;
  align-items: center;
  gap: 7px;
  overflow: visible;
  background: transparent;
}

.api-run-environment-combo {
  display: block;
  box-sizing: border-box;
  height: 28px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #ffffff;
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
  box-sizing: border-box;
  height: 26px;
  min-height: 26px;
  padding: 0 9px 0 10px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: none;
}

.api-run-environment-select :deep(.el-select__selected-item),
.api-run-environment-select :deep(.el-select__placeholder) {
  font-size: 12px;
}

.api-run-environment-detail-button {
  display: none;
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
.api-url-compose :deep(.el-input__wrapper) {
  box-sizing: border-box;
  height: 31.5px;
  min-height: 31.5px;
  border-radius: 7px;
  font-size: 13px;
  line-height: 20px;
}

.api-method-select :deep(.el-select__wrapper) {
  min-height: 31.5px;
  padding: 0 10px;
  border-color: var(--api-method-border, #e8ffea);
  border-style: solid;
  border-width: 1px;
  border-radius: 7px;
  background: var(--api-method-bg, #e8ffea);
  background-color: var(--api-method-bg, #e8ffea);
  box-shadow: none;
}

.api-method-select :deep(.el-select__wrapper:hover),
.api-method-select :deep(.el-select__wrapper.is-focused),
.api-method-select.is-focus :deep(.el-select__wrapper) {
  border-color: var(--api-method-border-hover, var(--api-method-border, var(--app-border)));
  border-style: solid;
  border-width: 1px;
  background: var(--api-method-bg, #e8ffea);
  background-color: var(--api-method-bg, #e8ffea);
  box-shadow: none;
}

.api-method-select {
  width: 90px;
  min-width: 90px;
  height: 31.5px;
  line-height: 21px;
}

.api-method-select :deep(.el-select__selected-item) {
  justify-content: center;
  color: var(--api-method-color, #00b42a);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.api-method-select :deep(.el-select__selection) {
  justify-content: center;
}

.api-method-select :deep(.el-select__placeholder),
.api-method-select :deep(.el-select__caret) {
  color: var(--api-method-color, #00b42a);
}

.api-method-select.method-get {
  --api-method-bg: #e8ffea;
  --api-method-border: #e8ffea;
  --api-method-border-hover: rgba(0, 180, 42, 0.26);
  --api-method-color: #00b42a;
}

.api-method-select.method-post {
  --api-method-bg: #fff3e8;
  --api-method-border: #fff3e8;
  --api-method-border-hover: rgba(255, 125, 0, 0.3);
  --api-method-color: #ff7d00;
}

.api-method-select.method-put {
  --api-method-bg: #e8f3ff;
  --api-method-border: #e8f3ff;
  --api-method-border-hover: rgba(22, 93, 255, 0.28);
  --api-method-color: #165dff;
}

.api-method-select.method-patch,
.api-method-select.method-options {
  --api-method-bg: #f5e8ff;
  --api-method-border: #f5e8ff;
  --api-method-border-hover: rgba(120, 22, 255, 0.26);
  --api-method-color: #7816ff;
}

.api-method-select.method-delete {
  --api-method-bg: #ffece8;
  --api-method-border: #ffece8;
  --api-method-border-hover: rgba(245, 63, 63, 0.28);
  --api-method-color: #f53f3f;
}

.api-method-select.method-head {
  --api-method-bg: #e8ffea;
  --api-method-border: #e8ffea;
  --api-method-border-hover: rgba(0, 180, 42, 0.26);
  --api-method-color: #15803d;
}

.api-method-select.method-trace {
  --api-method-bg: #f2f3f5;
  --api-method-border: #f2f3f5;
  --api-method-border-hover: #c9cdd4;
  --api-method-color: #4e5969;
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
  box-sizing: border-box;
  padding-inline: 11.5px;
  border: 1px solid var(--app-border);
  background: #ffffff;
  box-shadow: none;
}

.api-url-compose :deep(.el-input__inner) {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 400;
}

.api-url-compose :deep(.el-input__inner::placeholder) {
  color: var(--app-text-muted);
}

.api-curl-button {
  box-sizing: border-box;
  height: 28px;
  min-height: 28px;
  padding: 0 11.5px;
  border-width: 1px;
  border-color: var(--app-border);
  border-style: solid;
  background: #ffffff;
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
  box-sizing: border-box;
  width: 72.25px;
  min-width: 72.25px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
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
  flex: 0 0 auto;
}

.api-save-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  line-height: 1;
}

.api-save-dropdown {
  display: inline-flex;
  width: auto;
  min-width: 95px;
  height: 32px;
  align-items: center;
  vertical-align: middle;
}

.api-save-dropdown :deep(.el-button-group) {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: stretch;
}

.api-save-dropdown :deep(.el-button),
.api-save-dropdown :deep(.el-button-group > .el-button) {
  display: inline-flex;
  box-sizing: border-box;
  height: 32px;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  border-color: var(--app-border);
  background: #ffffff;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.api-save-dropdown :deep(.el-button-group > .el-button:first-child) {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 7px 0 0 7px;
  padding: 0 10px 0 11.5px;
}

.api-save-dropdown :deep(.el-button-group > .el-button:last-child) {
  display: inline-flex;
  flex: 0 0 28px;
  width: 28px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0;
  border-left-color: var(--app-border-soft);
}

.api-save-dropdown :deep(.el-button-group > .el-button:last-child .el-icon) {
  width: 12px;
  height: 12px;
  color: #86909c;
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
    grid-template-columns: minmax(0, 1fr) 104px 72.25px auto;
  }

  .api-url-compose {
    grid-template-columns: 88px minmax(0, 1fr) 47px;
  }

  .api-method-select {
    width: 88px;
    min-width: 88px;
  }
}
</style>
