<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { X as LucideX } from '@lucide/vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import type { ApiAiCaseGenerationGroup } from './apiInterfaceTypes'

const props = defineProps<{
  modelValue: boolean
  groups: ApiAiCaseGenerationGroup[]
  selectedCount: number
  selectedOptionKeys: string[]
  caseCount: string
  providerId: number | null
  providers: AiProviderConnectionItem[]
  providersLoading: boolean
  noDuplicate: boolean
  prompt: string
  canGenerate: boolean
  generationStatus: 'idle' | 'running' | 'done' | 'failed'
  isGroupAllSelected: (groupKey: string) => boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:selectedOptionKeys': [value: string[]]
  'update:caseCount': [value: string]
  'update:providerId': [value: number | null]
  'update:noDuplicate': [value: boolean]
  'update:prompt': [value: string]
  toggleGroup: [groupKey: string, checked: boolean]
  submit: []
}>()

const drawerVisible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    size="640px"
    class="api-ai-case-drawer"
    append-to-body
    :show-close="false"
    destroy-on-close
  >
    <template #header>
      <div class="ai-case-drawer-header">
        <div>
          <div class="ai-case-drawer-title">
            <MagicStick />
            <span>AI 生成接口用例</span>
          </div>
        </div>
        <button type="button" class="definition-import-close" @click="emit('update:modelValue', false)">
          <LucideX />
        </button>
      </div>
    </template>

    <template #default>
      <div class="ai-case-drawer-body">
        <section class="ai-case-section">
          <div class="ai-case-section-title">
            <span>选择生成的用例类型</span>
            <small>已选 {{ selectedCount }} 项</small>
          </div>
          <div class="ai-case-option-groups">
            <div v-for="group in groups" :key="group.key" class="ai-case-option-group">
              <div class="ai-case-option-group-title">
                <strong>{{ group.label }}</strong>
                <button type="button" class="ai-case-select-all-link" @click="emit('toggleGroup', group.key, !isGroupAllSelected(group.key))">
                  全选
                </button>
              </div>
              <el-checkbox-group :model-value="selectedOptionKeys" class="ai-case-option-list" @update:model-value="emit('update:selectedOptionKeys', $event as string[])">
                <el-checkbox v-for="option in group.options" :key="option.key" :value="option.key">
                  {{ option.label }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </section>

        <section class="ai-case-section ai-case-form-section">
          <label class="ai-case-form-field">
            <span>用例数</span>
            <el-select :suffix-icon="AppSelectChevron" :model-value="caseCount" class="ai-case-form-control" @update:model-value="emit('update:caseCount', String($event))">
              <el-option label="自动" value="AUTO" />
              <el-option label="10 条" value="10" />
              <el-option label="20 条" value="20" />
              <el-option label="40 条" value="40" />
              <el-option label="80 条" value="80" />
            </el-select>
          </label>
          <label class="ai-case-form-field">
            <span>AI模型</span>
            <el-select :suffix-icon="AppSelectChevron"
              :model-value="providerId"
              class="ai-case-form-control"
              :loading="providersLoading"
              placeholder="选择 AI 连接池配置的模型"
              empty-text="暂无可用 AI 模型"
              @update:model-value="emit('update:providerId', $event == null ? null : Number($event))"
            >
              <el-option
                v-for="item in providers"
                :key="item.id"
                :label="`${item.connectionName} / ${item.modelName || '-'}`"
                :value="item.id"
              />
            </el-select>
          </label>
          <div class="ai-case-form-switch">
            <el-switch :model-value="noDuplicate" @update:model-value="emit('update:noDuplicate', Boolean($event))" />
            <span>
              <strong>不重复生成用例</strong>
              <small>不生成与已有用例同用例类型的用例。关闭后，生成不受已有用例的影响</small>
            </span>
          </div>
          <label class="ai-case-form-field">
            <el-input
              :model-value="prompt"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 5 }"
              placeholder="输入更多要求"
              class="ai-case-form-control"
              @update:model-value="emit('update:prompt', String($event))"
            />
          </label>
          <button type="button" class="ai-case-generate-submit" :disabled="!canGenerate" @click="emit('submit')">
            <MagicStick />
            {{ generationStatus === 'running' ? '生成中...' : '生成' }}
          </button>
        </section>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
:global(.api-ai-case-drawer .el-drawer__header) {
  margin: 0;
  padding: 0;
  border-bottom: 1px solid #f3f4f6;
}

:global(.api-ai-case-drawer .el-drawer__body) {
  padding: 0;
  background: #ffffff;
}

:global(.api-ai-case-drawer .el-drawer__footer) {
  padding: 0;
  border-top: 1px solid #f3f4f6;
}

.definition-import-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.definition-import-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.definition-import-close svg {
  width: 16px;
  height: 16px;
}

.ai-case-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 16px 20px;
}

.ai-case-drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.ai-case-drawer-title svg {
  width: 18px;
  height: 18px;
  color: #2563eb;
}

.ai-case-drawer-body {
  display: block;
  min-height: 0;
  overflow: auto;
}

.ai-case-section {
  display: grid;
  gap: 12px;
  padding: 18px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.ai-case-section-title,
.ai-case-option-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-case-section-title {
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.ai-case-section-title small {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
}

.ai-case-option-groups {
  display: grid;
  gap: 20px;
}

.ai-case-option-group {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
}

.ai-case-option-group:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.ai-case-option-group-title strong {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.ai-case-select-all-link {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.ai-case-option-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, max-content));
  gap: 12px 18px;
  justify-content: start;
}

.ai-case-option-list :deep(.el-checkbox) {
  height: 18px;
  min-width: 0;
  margin-right: 0;
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  white-space: nowrap;
}

.ai-case-section :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.ai-case-section :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: #2563eb;
  background: #2563eb;
}

.ai-case-section :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #374151;
}

:global(.api-ai-case-drawer .el-switch.is-checked .el-switch__core) {
  border-color: #2563eb;
  background-color: #2563eb;
}

.ai-case-form-section {
  gap: 16px;
  border-top: 1px solid #e5e7eb;
}

.ai-case-form-field {
  display: grid;
  gap: 6px;
}

.ai-case-form-field > span {
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.ai-case-form-control {
  width: 100%;
}

.ai-case-form-control :deep(.el-select__wrapper),
.ai-case-form-control :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #dbe2ea;
}

.ai-case-form-control :deep(.el-select__wrapper) {
  min-height: 36px;
  font-size: 13px;
}

.ai-case-form-control :deep(.el-textarea__inner) {
  min-height: 98px !important;
  padding: 12px;
  color: #374151;
  font-size: 13px;
  line-height: 1.5;
}

.ai-case-form-control :deep(.el-select__wrapper.is-focused),
.ai-case-form-control :deep(.el-textarea__inner:focus) {
  box-shadow: inset 0 0 0 1px #2563eb, 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.ai-case-form-switch {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px;
}

.ai-case-form-switch :deep(.el-switch) {
  height: 20px;
}

.ai-case-form-switch > span {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.ai-case-form-switch strong {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ai-case-form-switch small {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.55;
}

.ai-case-generate-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.ai-case-generate-submit:hover {
  background: #1d4ed8;
}

.ai-case-generate-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-case-generate-submit svg {
  width: 16px;
  height: 16px;
}
</style>
