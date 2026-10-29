<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { Bot, LoaderCircle, X as LucideX } from '@lucide/vue'

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
  method?: string
  path?: string
  endpointName?: string
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

const totalOptionCount = computed(() => props.groups.reduce((total, group) => total + group.options.length, 0))
const allOptionsSelected = computed(() => totalOptionCount.value > 0 && props.selectedCount === totalOptionCount.value)

function toggleAllOptions() {
  const checked = !allOptionsSelected.value
  props.groups.forEach(group => emit('toggleGroup', group.key, checked))
}

function isGroupPartiallySelected(groupKey: string) {
  const group = props.groups.find(item => item.key === groupKey)
  if (!group) return false
  const selected = group.options.filter(option => props.selectedOptionKeys.includes(option.key)).length
  return selected > 0 && selected < group.options.length
}
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
        <div class="ai-case-drawer-heading">
          <div class="ai-case-drawer-icon" aria-hidden="true"><Bot /></div>
          <div class="ai-case-drawer-heading-copy">
            <div class="ai-case-drawer-title">AI 生成接口用例</div>
            <div v-if="method || path || endpointName" class="ai-case-drawer-subtitle">
              <span v-if="method" :class="['ai-case-method', `method-${String(method).toLowerCase()}`]">{{ method }}</span>
              <span v-if="path" class="ai-case-path">{{ path }}</span>
              <span v-if="endpointName" class="ai-case-endpoint">{{ endpointName }}</span>
            </div>
          </div>
        </div>
        <button type="button" class="definition-import-close" @click="emit('update:modelValue', false)">
          <LucideX />
        </button>
      </div>
    </template>

    <template #default>
      <div class="ai-case-drawer-body">
        <div v-if="generationStatus === 'failed'" class="ai-case-status-banner is-error" role="alert">
          生成任务创建失败，请检查 AI 服务连接后重试。
        </div>
        <section class="ai-case-section">
          <div class="ai-case-section-title">
            <span class="ai-case-section-heading">
              <span>选择生成的用例类型</span>
              <el-checkbox
                :model-value="allOptionsSelected"
                :indeterminate="selectedCount > 0 && !allOptionsSelected"
                class="ai-case-global-checkbox"
                @change="toggleAllOptions"
              >
                全选
              </el-checkbox>
            </span>
            <div class="ai-case-selection-summary">
              <span>已选 {{ selectedCount }} / {{ totalOptionCount }} 项</span>
            </div>
          </div>
          <div class="ai-case-option-groups">
            <div v-for="group in groups" :key="group.key" class="ai-case-option-group">
              <div class="ai-case-option-group-title">
                <span class="ai-case-group-heading">
                  <el-checkbox
                    :model-value="isGroupAllSelected(group.key)"
                    :indeterminate="isGroupPartiallySelected(group.key)"
                    class="ai-case-group-checkbox"
                    :aria-label="`${group.label}全选`"
                    @change="emit('toggleGroup', group.key, Boolean($event))"
                  />
                  <strong>{{ group.label }}</strong>
                </span>
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
            <el-select v-if="!providersLoading && providers.length" :suffix-icon="AppSelectChevron"
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
            <div v-else-if="providersLoading" class="ai-case-model-status is-loading">正在加载可用模型...</div>
            <div v-else class="ai-case-model-status is-empty">暂无可用 AI 模型，请先配置 AI 连接。</div>
          </label>
          <div class="ai-case-form-switch">
            <el-switch :model-value="noDuplicate" @update:model-value="emit('update:noDuplicate', Boolean($event))" />
            <span>
              <strong>不重复生成用例</strong>
              <small>不生成与已有用例同用例类型的用例。关闭后，生成不受已有用例的影响</small>
            </span>
          </div>
          <label class="ai-case-form-field">
            <span>补充要求 <em>（可选）</em></span>
            <el-input
              :model-value="prompt"
              type="textarea"
              maxlength="1000"
              show-word-limit
              :autosize="{ minRows: 3, maxRows: 5 }"
              placeholder="例如：重点覆盖鉴权失败、边界值和重复提交场景"
              class="ai-case-form-control"
              @update:model-value="emit('update:prompt', String($event))"
            />
          </label>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="ai-case-drawer-footer">
        <div v-if="!selectedCount" class="ai-case-footer-hint is-warning">请至少选择一个生成类型</div>
        <div v-else-if="!providers.length && !providersLoading" class="ai-case-footer-hint">请先配置可用的 AI 模型</div>
        <button type="button" class="ai-case-generate-submit" :disabled="!canGenerate" @click="emit('submit')">
          <LoaderCircle v-if="generationStatus === 'running'" class="is-spinning" />
          <MagicStick v-else />
          {{ generationStatus === 'running' ? '生成中...' : generationStatus === 'failed' ? '重新生成' : '生成' }}
        </button>
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

.ai-case-drawer-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.ai-case-drawer-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #f1eaff;
  color: #7816ff;
}

.ai-case-drawer-icon svg {
  width: 16px;
  height: 16px;
}

.ai-case-drawer-heading-copy {
  min-width: 0;
}

.ai-case-drawer-title {
  display: block;
  font-size: 14px;
  line-height: 18px;
}

.ai-case-drawer-subtitle {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  max-width: 460px;
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
}

.ai-case-method {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  background: #e8f7ed;
  color: #00b42a;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
}

.ai-case-method.method-post { background: #fff3e8; color: #ff7d00; }
.ai-case-method.method-put { background: #e8f3ff; color: #165dff; }
.ai-case-method.method-delete { background: #ffefef; color: #f53f3f; }
.ai-case-method.method-patch { background: #f1eaff; color: #7816ff; }

.ai-case-path,
.ai-case-endpoint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-case-path {
  color: #4e5969;
  font-family: Consolas, Monaco, monospace;
}

.ai-case-endpoint::before {
  margin-right: 6px;
  color: #c9cdd4;
  content: '·';
}

.ai-case-status-banner {
  margin: 12px 20px 0;
  padding: 9px 12px;
  border: 1px solid #ffbaba;
  border-radius: 7px;
  background: #fff0f0;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.ai-case-section {
  padding: 16px 20px;
}

.ai-case-section-title {
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
}

.ai-case-selection-summary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
}

.ai-case-section-heading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-case-global-checkbox,
.ai-case-group-checkbox {
  height: 18px;
  margin-right: 0;
  color: #4e5969;
  font-size: 11px;
  font-weight: 400;
}

.ai-case-global-checkbox :deep(.el-checkbox__label) {
  padding-left: 5px;
}

.ai-case-group-checkbox :deep(.el-checkbox__label) {
  display: none;
}

.ai-case-option-groups {
  gap: 10px;
}

.ai-case-option-group {
  gap: 0;
  padding-bottom: 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.ai-case-option-group-title {
  min-height: 32px;
  padding: 0 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #e5e6eb;
}

.ai-case-group-heading {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.ai-case-group-mark {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: #165dff;
}

.ai-case-option-group-title strong {
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.ai-case-option-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 16px;
  padding: 9px 12px 10px;
}

.ai-case-option-list :deep(.el-checkbox) {
  height: 18px;
  color: #4e5969;
  font-size: 12px;
}

.ai-case-form-section {
  gap: 14px;
  border-top: 0;
}

.ai-case-form-field {
  gap: 5px;
}

.ai-case-form-field > span {
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.ai-case-form-field > span em {
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.ai-case-form-control :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: 7px;
  font-size: 12px;
}

.ai-case-form-control :deep(.el-textarea__inner) {
  min-height: 90px !important;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 1.6;
}

.ai-case-model-status {
  margin-top: 5px;
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.ai-case-model-status.is-empty {
  color: #f53f3f;
}

.ai-case-drawer-footer {
  display: grid;
  gap: 7px;
  padding: 10px 20px 12px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.ai-case-footer-hint {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.ai-case-footer-hint.is-warning {
  color: #ff7d00;
}

.ai-case-generate-submit {
  height: 36px;
  border-radius: 7px;
  background: #165dff;
  font-size: 13px;
}

.ai-case-generate-submit:hover {
  background: #0e4ecc;
}

.ai-case-generate-submit .is-spinning {
  animation: ai-case-drawer-spin 1s linear infinite;
}

@keyframes ai-case-drawer-spin {
  to { transform: rotate(360deg); }
}
</style>
