<script setup lang="ts">
import { MagicStick, Search } from '@element-plus/icons-vue'
import { Loader2, Play as LucidePlay } from '@lucide/vue'

import type { AiCaseGenerationTabState, ApiAiGeneratedCaseResult, ApiAiCaseResultFilter } from './apiInterfaceTypes'

interface SelectOption {
  value: string
  label: string
}

const props = defineProps<{
  state: AiCaseGenerationTabState
  resultFilter: ApiAiCaseResultFilter
  pendingCount: number
  acceptedCount: number
  discardedCount: number
  keyword: string
  group: string
  type: string
  groupOptions: SelectOption[]
  typeOptions: SelectOption[]
  selectedPendingCount: number
  savingId: string
  pendingActionCount: number
  filteredResults: ApiAiGeneratedCaseResult[]
  emptyText: string
  selectionAllChecked: boolean
  selectionIndeterminate: boolean
  selectedResultIds: string[]
  requestMethodClass: (method?: string) => string
  caseTypeLabel: (result: ApiAiGeneratedCaseResult | null) => string
  caseGroupLabel: (result: ApiAiGeneratedCaseResult | null) => string
}>()

const emit = defineEmits<{
  'update:resultFilter': [value: ApiAiCaseResultFilter]
  'update:keyword': [value: string]
  'update:group': [value: string]
  'update:type': [value: string]
  generateOrStop: []
  runSelected: []
  acceptSelected: []
  discardSelected: []
  toggleAll: [checked: string | number | boolean]
  toggleSelection: [id: string, checked: string | number | boolean]
  openDetail: [result: ApiAiGeneratedCaseResult]
  runCase: [result: ApiAiGeneratedCaseResult]
  saveCase: [result: ApiAiGeneratedCaseResult]
  discardCase: [result: ApiAiGeneratedCaseResult]
}>()
</script>

<template>
  <div class="ai-generation-workspace">
    <div class="ai-generation-page-header">
      <div>
        <h3 class="ai-generation-title-line">
          <span>AI 生成单接口用例</span>
          <span class="ai-generation-title-source">
            <span class="ai-generation-source-name">{{ props.state.definitionName }}</span>
            <span :class="['api-method', props.requestMethodClass(props.state.method)]">
              {{ props.state.method || 'GET' }}
            </span>
            <span class="ai-generation-source-path">{{ props.state.path || '-' }}</span>
          </span>
        </h3>
      </div>
      <button
        type="button"
        :class="['ai-generation-header-action', { 'is-stop': props.state.generating }]"
        @click="emit('generateOrStop')"
      >
        <MagicStick v-if="!props.state.generating" />
        {{ props.state.generating ? '停止' : '生成新用例' }}
      </button>
    </div>

    <div class="ai-generation-detail-workspace">
      <div class="ai-generation-detail-status-row">
        <div class="ai-generation-detail-status-tabs">
          <button type="button" :class="{ active: props.resultFilter === 'pending' }" @click="emit('update:resultFilter', 'pending')">
            待处理 ({{ props.pendingCount }})
          </button>
          <button type="button" :class="{ active: props.resultFilter === 'accepted' }" @click="emit('update:resultFilter', 'accepted')">
            已采纳 ({{ props.acceptedCount }})
          </button>
          <button type="button" :class="{ active: props.resultFilter === 'discarded' }" @click="emit('update:resultFilter', 'discarded')">
            废弃 ({{ props.discardedCount }})
          </button>
        </div>
      </div>

      <div class="ai-generation-detail-toolbar">
        <div class="ai-generation-detail-search">
          <Search />
          <input :value="props.keyword" type="text" placeholder="搜索" @input="emit('update:keyword', ($event.target as HTMLInputElement).value)" />
        </div>
        <el-select :model-value="props.group" class="ai-generation-detail-filter" placeholder="分组" clearable @update:model-value="emit('update:group', String($event || ''))">
          <el-option v-for="item in props.groupOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select :model-value="props.type" class="ai-generation-detail-filter is-wide" placeholder="类型" clearable @update:model-value="emit('update:type', String($event || ''))">
          <el-option v-for="item in props.typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <div class="ai-generation-detail-actions">
          <button type="button" class="ai-generation-run-selected" :disabled="!props.selectedPendingCount" @click="emit('runSelected')">
            <LucidePlay />
            运行选中
          </button>
          <button type="button" class="ai-generation-accept-selected" :disabled="!props.selectedPendingCount || Boolean(props.savingId)" @click="emit('acceptSelected')">采纳选中</button>
          <button type="button" class="ai-generation-discard-selected" :disabled="!props.pendingActionCount || Boolean(props.savingId)" @click="emit('discardSelected')">废弃选中</button>
        </div>
      </div>

      <div class="ai-generation-detail-table">
        <div class="ai-generation-detail-head">
          <div class="ai-generation-row-selector">
            <el-checkbox
              :model-value="props.selectionAllChecked"
              :indeterminate="props.selectionIndeterminate"
              @update:model-value="emit('toggleAll', $event)"
            />
          </div>
          <span>名称</span>
          <span>类型</span>
          <span>分组</span>
          <span>运行结果</span>
          <span></span>
        </div>

        <div class="ai-generation-detail-body">
          <div v-if="!props.filteredResults.length" class="ai-generation-empty-state">
            <MagicStick />
            <span>{{ props.emptyText }}</span>
          </div>
          <div
            v-for="(row, index) in props.filteredResults"
            :key="row.id"
            class="ai-generation-detail-row"
            @click="emit('openDetail', row)"
          >
            <div class="ai-generation-row-selector" @click.stop>
              <template v-if="row.status === 'generating' || row.runResult === '运行中'">
                <Loader2 class="ai-generation-row-loading" :size="16" aria-hidden="true" />
              </template>
              <template v-else>
                <span class="ai-generation-row-index">{{ index + 1 }}</span>
                <el-checkbox
                  v-if="row.status === 'pending'"
                  class="ai-generation-row-checkbox"
                  :model-value="props.selectedResultIds.includes(row.id)"
                  @update:model-value="emit('toggleSelection', row.id, $event)"
                />
              </template>
            </div>
            <div class="ai-generation-detail-name">
              <span>{{ row.draft.name || 'AI 生成接口用例' }}</span>
            </div>
            <div class="ai-generation-detail-group-cell">
              <span class="ai-generation-case-tag">{{ props.caseTypeLabel(row) }}</span>
            </div>
            <span :class="['ai-generation-detail-group-type', String(row.draft.groupKey || row.draft.group || '').includes('negative') ? 'is-negative' : 'is-positive']">{{ props.caseGroupLabel(row) }}</span>
            <span :class="['ai-generation-run-result', { 'is-success': row.runResult === '通过', 'is-failed': row.runResult === '失败' || row.status === 'failed' }]">
              {{ row.runResult || '-' }}
            </span>
            <div class="ai-generation-row-actions">
              <button type="button" class="ai-generation-row-run" :disabled="row.status === 'generating' || row.status === 'failed' || row.status !== 'pending' || row.runResult === '运行中'" @click.stop="emit('runCase', row)">
                <LucidePlay />
                运行
              </button>
              <button type="button" class="ai-generation-row-accept" :disabled="row.status === 'generating' || row.status === 'failed' || row.status !== 'pending' || props.savingId === row.id" @click.stop="emit('saveCase', row)">
                {{ props.savingId === row.id ? '保存中' : '采纳' }}
              </button>
              <button type="button" class="ai-generation-row-discard" :disabled="row.status === 'generating' || row.status === 'discarded' || row.runResult === '运行中'" @click.stop="emit('discardCase', row)">废弃</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-generation-workspace {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 14px 16px 0;
  background: #ffffff;
}

.ai-generation-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0 12px;
}

.ai-generation-page-header h3 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.ai-generation-title-line {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.ai-generation-title-source {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid #e5e7eb;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
}

.ai-generation-source-name,
.ai-generation-source-path {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-source-name {
  max-width: 160px;
  color: #475569;
}

.ai-generation-source-path {
  max-width: 360px;
  color: #344054;
}

.api-method {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.method-get { color: #15803d; }
.method-post { color: #ea580c; }
.method-put { color: #2563eb; }
.method-patch { color: #7c3aed; }
.method-delete { color: #dc2626; }
.method-head,
.method-options { color: #64748b; }

.ai-generation-header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 86px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
}

.ai-generation-header-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-generation-header-action.is-stop {
  border-color: #d1d5db;
  color: #374151;
}

.ai-generation-header-action svg {
  width: 13px;
  height: 13px;
  color: #64748b;
}

.ai-generation-detail-workspace {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
}

.ai-generation-detail-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  border-bottom: 1px solid #f1f5f9;
}

.ai-generation-detail-status-tabs {
  display: inline-flex;
  overflow: hidden;
  min-width: 360px;
  padding: 2px;
  border-radius: 8px;
  background: #f5f7fb;
}

.ai-generation-detail-status-tabs button {
  min-width: 112px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.ai-generation-detail-status-tabs button.active {
  background: #ffffff;
  color: #334155;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.ai-generation-detail-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border-bottom: 1px solid #edf2f7;
}

.ai-generation-detail-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 160px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
}

.ai-generation-detail-search .el-icon,
.ai-generation-detail-search svg {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

.ai-generation-detail-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #334155;
  font-size: 12px;
}

.ai-generation-detail-search input::placeholder {
  color: #cbd5e1;
}

.ai-generation-detail-filter {
  width: 112px;
}

.ai-generation-detail-filter.is-wide {
  width: 168px;
}

.ai-generation-detail-filter :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.ai-generation-detail-filter :deep(.el-select__placeholder),
.ai-generation-detail-filter :deep(.el-select__selected-item) {
  color: #64748b;
  font-size: 12px;
}

.ai-generation-detail-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.ai-generation-detail-actions button,
.ai-generation-row-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.ai-generation-detail-actions button:disabled,
.ai-generation-row-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ai-generation-detail-actions svg,
.ai-generation-row-actions svg {
  width: 13px;
  height: 13px;
}

.ai-generation-run-selected,
.ai-generation-row-run {
  border: 0;
  background: #334155;
  color: #ffffff;
}

.ai-generation-accept-selected,
.ai-generation-row-accept {
  border: 0;
  background: #5b7cff;
  color: #ffffff;
}

.ai-generation-discard-selected,
.ai-generation-row-discard {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #475569;
}

.ai-generation-detail-table {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  scrollbar-color: rgba(148, 163, 184, 0.64) transparent;
  scrollbar-width: thin;
}

.ai-generation-detail-table::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ai-generation-detail-table::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.64);
  background-clip: padding-box;
}

.ai-generation-detail-table::-webkit-scrollbar-track {
  background: transparent;
}

.ai-generation-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  color: #64748b;
  font-size: 13px;
}

.ai-generation-empty-state svg {
  width: 16px;
  height: 16px;
  color: #3b82f6;
}

.ai-generation-detail-head,
.ai-generation-detail-row {
  display: grid;
  grid-template-columns: 32px minmax(320px, 1fr) 170px 92px 110px 190px;
  align-items: center;
  column-gap: 12px;
}

.ai-generation-detail-head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 34px;
  border-bottom: 1px solid #eef2f7;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.ai-generation-detail-head span {
  text-align: left;
}

.ai-generation-detail-row {
  min-height: 42px;
  border-bottom: 1px solid #edf2f7;
  color: #334155;
  cursor: pointer;
  font-size: 13px;
}

.ai-generation-detail-row:hover {
  background: #f4f7fb;
}

.ai-generation-row-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  justify-self: center;
}

.ai-generation-row-index {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1;
}

.ai-generation-row-loading {
  width: 16px;
  height: 16px;
  color: #3b82f6;
  animation: ai-generation-row-spin 1s linear infinite;
}

@keyframes ai-generation-row-spin {
  to { transform: rotate(360deg); }
}

.ai-generation-row-checkbox {
  display: none;
}

.ai-generation-detail-row:hover .ai-generation-row-index {
  display: none;
}

.ai-generation-detail-row:hover .ai-generation-row-checkbox {
  display: inline-flex;
}

.ai-generation-detail-name {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.ai-generation-detail-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-detail-group-cell {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.ai-generation-case-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  overflow: hidden;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-detail-group-type {
  color: #334155;
  font-size: 12px;
}

.ai-generation-detail-group-type.is-negative {
  color: #475569;
}

.ai-generation-run-result {
  color: #94a3b8;
}

.ai-generation-run-result.is-success {
  color: #16a34a;
}

.ai-generation-run-result.is-failed {
  color: #dc2626;
}

.ai-generation-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.ai-generation-detail-row:hover .ai-generation-row-actions {
  opacity: 1;
  pointer-events: auto;
}

.ai-generation-row-actions button {
  flex: 0 0 auto;
  white-space: nowrap;
}
</style>
