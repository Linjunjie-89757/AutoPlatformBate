<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertCircle, AlertTriangle, FileText, LoaderCircle, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from '@lucide/vue'

import type { ApiDefinitionCaseItem } from '@/entities/api-automation'

const props = defineProps<{
  definitionId: number | null
  endpointName: string
  method: string
  path: string
  loading: boolean
  error: string
  cases: ApiDefinitionCaseItem[]
  pagedCases: ApiDefinitionCaseItem[]
  totalPages: number
  currentPage: number
  pageSize: number
  pageSizes: number[]
  runningId: number | null
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
  caseProtocolLabel: () => string
  casePriorityLabel: (row: ApiDefinitionCaseItem) => string
  caseStatusLabel: (row: ApiDefinitionCaseItem) => string
  formatCaseTags: (tags?: string[] | null) => string
}>()

const emit = defineEmits<{
  refresh: []
  create: []
  aiGenerate: []
  edit: [row: ApiDefinitionCaseItem]
  run: [row: ApiDefinitionCaseItem]
  detail: [row: ApiDefinitionCaseItem]
  duplicate: [row: ApiDefinitionCaseItem]
  delete: [row: ApiDefinitionCaseItem]
  'update:currentPage': [value: number]
  'update:pageSize': [value: number]
}>()

const search = ref('')
const resultFilter = ref('all')
const columns = [
  { key: 'id', label: 'ID' }, { key: 'priority', label: '等级' },
  { key: 'type', label: '类型' }, { key: 'source', label: '来源' },
  { key: 'result', label: '最近执行' }, { key: 'creator', label: '创建人' },
  { key: 'protocol', label: '协议' }, { key: 'path', label: '路径' },
  { key: 'tags', label: '标签' }, { key: 'lastRunAt', label: '最近执行时间' },
  { key: 'updatedAt', label: '更新时间' },
]
const visibleColumns = ref(['id', 'priority', 'type', 'source', 'result', 'creator'])
const resultLabels: Record<string, string> = { PASSED: '通过', FAILED: '失败', ERROR: '执行异常', PENDING: '未执行', RUNNING: '执行中', CANCELLED: '已取消' }
function resultKey(row: ApiDefinitionCaseItem) {
  if (props.runningId === row.id) return 'RUNNING'
  const result = row.lastRunResult?.toUpperCase() || 'PENDING'
  if (['SUCCESS', 'DONE'].includes(result)) return 'PASSED'
  return result
}
const filteredCases = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.cases.filter(row => (!query || row.name.toLowerCase().includes(query) || String(row.id).includes(query))
    && (resultFilter.value === 'all' || resultKey(row) === resultFilter.value))
})
const filteredPages = computed(() => Math.max(1, Math.ceil(filteredCases.value.length / props.pageSize)))
const visibleCases = computed(() => filteredCases.value.slice((props.currentPage - 1) * props.pageSize, props.currentPage * props.pageSize))
const hasFilters = computed(() => !!search.value.trim() || resultFilter.value !== 'all')
const methodColor = computed(() => ({ GET: '#00B42A', POST: '#FF7D00', PUT: '#165DFF', DELETE: '#F53F3F', PATCH: '#7816FF' })[props.method as 'GET'] || '#86909C')
watch([search, resultFilter, () => props.pageSize], () => emit('update:currentPage', 1))
watch(() => props.definitionId, () => { clearFilters(); emit('update:currentPage', 1) })
watch(filteredPages, pages => { if (props.currentPage > pages) emit('update:currentPage', pages) })
function clearFilters() { search.value = ''; resultFilter.value = 'all' }
</script>

<template>
  <div class="ms-like-request-body case-list-request-body">
    <div class="request-section case-list-panel">
      <div v-if="!definitionId && !loading" class="case-unsaved-banner">
        <AlertTriangle :size="14" />
        <span>请先<strong>保存当前接口</strong>，再创建或生成用例</span>
        <small>未保存的接口不支持绑定用例</small>
      </div>
      <div class="editor-actions left">
        <div class="case-endpoint"><b :style="{ color: methodColor }">{{ method }}</b><code :title="path">{{ path || '未填写路径' }}</code><span>·</span><span>{{ cases.length }} 条用例</span></div>
        <el-button
          v-if="canCreate !== false"
          type="primary"
          :title="definitionId ? '新建用例' : '请先保存接口，再创建用例'"
          :disabled="!definitionId"
          @click="emit('create')"
        >
          <Plus :size="13" />新建用例
        </el-button>
        <button
          v-if="canCreate !== false"
          type="button"
          class="case-ai-generate-button"
          :disabled="!definitionId"
          :title="definitionId ? 'AI 生成接口用例' : '请先保存接口，再使用 AI 生成用例'"
          @click="emit('aiGenerate')"
        >
          <Sparkles :size="13" />
          <span>AI 生成</span>
        </button>
        <div class="case-toolbar-spacer"></div>
        <div class="case-search">
          <Search :size="12" aria-hidden="true" />
          <input v-model="search" aria-label="搜索用例名称或 ID" placeholder="搜索用例名称 / ID" :disabled="!definitionId" />
          <button v-if="search" type="button" aria-label="清空搜索" @click="search = ''"><X :size="11" /></button>
        </div>
        <select v-model="resultFilter" class="case-filter" :class="{ 'is-filtered': resultFilter !== 'all' }" aria-label="执行状态" :disabled="!definitionId">
          <option value="all">全部状态</option><option v-for="(label, key) in resultLabels" :key="key" :value="key">{{ label }}</option>
        </select>
        <select class="case-filter" aria-label="用例等级" disabled title="当前用例数据尚未提供等级，暂不支持筛选"><option>全部等级</option></select>
        <select class="case-filter" aria-label="用例来源" disabled title="当前用例数据尚未提供来源，暂不支持筛选"><option>全部来源</option></select>
        <button type="button" class="case-toolbar-icon" aria-label="刷新用例" title="刷新" :disabled="!definitionId || loading" @click="emit('refresh')"><RefreshCw :size="13" :class="{ 'is-spinning': loading }" /></button>
        <el-popover placement="bottom-end" trigger="click" :width="200">
          <template #reference><button type="button" class="case-toolbar-icon" aria-label="列设置" title="列设置"><SlidersHorizontal :size="13" /></button></template>
          <div class="case-column-settings"><strong>列设置</strong><el-checkbox :model-value="true" disabled>用例名称（必选）</el-checkbox><el-checkbox-group v-model="visibleColumns"><el-checkbox v-for="column in columns" :key="column.key" :value="column.key">{{ column.label }}</el-checkbox></el-checkbox-group></div>
        </el-popover>
      </div>

      <div v-if="loading" class="case-skeleton" role="status" aria-label="正在加载用例">
        <div v-for="row in 6" :key="row" class="case-skeleton-row"><i v-for="cell in 9" :key="cell"></i></div>
      </div>
      <div v-else-if="!definitionId" class="case-state is-unsaved">
        <div class="case-state-icon"><AlertTriangle :size="22" /></div><h3>接口尚未保存</h3>
        <p>请先保存当前接口，再创建或通过 AI 生成用例。</p><small>已有用例不受影响，保存后即可访问</small>
      </div>
      <div v-else-if="error" class="case-state is-error" role="alert">
        <div class="case-state-icon"><AlertCircle :size="22" /></div><h3>加载失败</h3><p>{{ error }}</p>
        <button type="button" class="case-state-button" @click="emit('refresh')"><RefreshCw :size="12" />重新加载</button><small>加载失败不影响接口其他配置的编辑</small>
      </div>
      <div v-else-if="!filteredCases.length && hasFilters" class="case-state is-no-results">
        <Search :size="32" class="case-state-search" /><h3>未找到匹配用例</h3><p>当前筛选条件下没有结果，共 {{ cases.length }} 条用例</p>
        <button type="button" class="case-state-button" @click="clearFilters"><X :size="12" />清除筛选条件</button>
      </div>
      <div v-else-if="!cases.length" class="case-state is-empty">
        <div class="case-state-icon"><FileText :size="28" /></div><h3>{{ endpointName }} 暂无用例</h3><p>为当前接口创建测试用例，覆盖正向流程、异常场景和边界条件。</p>
        <div v-if="canCreate !== false" class="case-state-actions"><button type="button" class="case-state-button is-primary" @click="emit('create')"><Plus :size="13" />新建用例</button><button type="button" class="case-state-button is-ai" @click="emit('aiGenerate')"><Sparkles :size="13" />AI 生成</button></div>
      </div>
      <div v-else class="case-list-table-wrap">
        <el-table :data="visibleCases" size="small" class="case-list-table" height="100%">
          <el-table-column v-if="visibleColumns.includes('id')" prop="id" label="ID" width="88" class-name="case-id-cell" />
          <el-table-column prop="name" label="用例名称" min-width="200" show-overflow-tooltip />
          <el-table-column v-if="visibleColumns.includes('protocol')" label="协议" width="90">
            <template #default>
              {{ caseProtocolLabel() }}
            </template>
          </el-table-column>
          <el-table-column v-if="visibleColumns.includes('priority')" label="等级" width="64">
            <template #default="{ row }">
              {{ casePriorityLabel(row) }}
            </template>
          </el-table-column>
          <el-table-column v-if="visibleColumns.includes('type')" label="类型" width="92"><template #default><span title="当前用例数据未提供类型">—</span></template></el-table-column>
          <el-table-column v-if="visibleColumns.includes('source')" label="来源" width="88"><template #default><span title="当前用例数据未提供来源">—</span></template></el-table-column>
          <el-table-column v-if="visibleColumns.includes('result')" label="最近执行" width="108">
            <template #default="{ row }">
              <span class="case-result" :class="`is-${resultKey(row).toLowerCase()}`"><i></i>{{ resultLabels[resultKey(row)] || row.lastRunResult }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="visibleColumns.includes('path')" prop="path" label="路径" min-width="240" show-overflow-tooltip />
          <el-table-column v-if="visibleColumns.includes('tags')" label="标签" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatCaseTags(row.tags) }}
            </template>
          </el-table-column>
          <el-table-column v-if="visibleColumns.includes('creator')" label="创建人" width="80">
            <template #default>-</template>
          </el-table-column>
          <el-table-column v-if="visibleColumns.includes('lastRunAt')" prop="lastRunAt" label="最近执行时间" width="180" />
          <el-table-column v-if="visibleColumns.includes('updatedAt')" prop="updatedAt" label="更新时间" width="180" />
          <el-table-column label="操作" width="108" fixed="right" align="center" header-align="center">
            <template #default="{ row }">
              <div class="case-list-actions">
                <button v-if="canEdit !== false" type="button" class="case-list-more-button" title="编辑用例" aria-label="编辑用例" @click="emit('edit', row)"><Pencil :size="13" /></button>
                <button v-if="canExecute !== false" type="button" class="case-list-more-button" title="执行用例" aria-label="执行用例" :disabled="runningId !== null" @click="emit('run', row)"><LoaderCircle v-if="runningId === row.id" :size="13" class="is-spinning" /><Play v-else :size="13" /></button>
                <el-dropdown trigger="click" placement="bottom-end">
                  <button type="button" class="case-list-more-button" aria-label="更多操作" title="更多操作">
                    <MoreHorizontal :size="14" aria-hidden="true" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="case-list-more-menu">
                      <el-dropdown-item class="case-list-menu-item" @click="emit('detail', row)">查看详情</el-dropdown-item>
                      <el-dropdown-item v-if="canCreate !== false" class="case-list-menu-item" @click="emit('duplicate', row)">复制</el-dropdown-item>
                      <el-dropdown-item v-if="canDelete !== false" class="case-list-menu-item is-danger" @click="emit('delete', row)">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="case-list-pagination">
          <div class="case-list-pagination-summary">共 {{ filteredCases.length }} 条</div>
          <el-pagination
            :current-page="currentPage"
            :page-size="pageSize"
            :page-sizes="pageSizes"
            size="small"
            layout="sizes, prev, pager, next"
            :total="filteredCases.length"
            @update:current-page="emit('update:currentPage', $event)"
            @update:page-size="emit('update:pageSize', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-list-request-body {
  display: flex;
  min-height: 0;
  padding: 0;
}

.case-list-panel {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.case-list-panel .editor-actions.left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.case-ai-generate-button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  height: 31.5px;
  padding: 0 11.5px;
  border: 1px solid rgba(120, 22, 255, 0.19);
  border-radius: 7px;
  background: #f5e8ff;
  color: #7816ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.case-ai-generate-button:hover:not(:disabled) {
  border-color: rgba(120, 22, 255, 0.3);
  background: #f5e8ff;
  color: #7816ff;
}

.case-ai-generate-button:disabled {
  border-color: rgba(120, 22, 255, 0.12);
  background: rgba(245, 232, 255, 0.55);
  color: rgba(120, 22, 255, 0.45);
  cursor: not-allowed;
}

.case-ai-generate-button__icon {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.case-list-panel .empty-hint {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #9ca3af;
  font-size: 13px;
}

.case-list-table-wrap {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.case-list-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-list-table :deep(.el-table__row td) {
  height: 42px;
  color: #374151;
  font-size: 13px;
}

.case-list-operation-header,
.case-list-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.case-list-settings-trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  color: #6b7280;
}

.case-list-action-button,
.case-list-more-button {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 500;
}

.case-list-more-button {
  display: inline-flex;
  box-sizing: border-box;
  width: 26px;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  line-height: 0;
}

.case-list-more-button:hover,
.case-list-more-button:focus-visible {
  background: #f2f3f5;
  color: #4e5969;
  outline: 0;
}

.case-list-menu-item {
  height: 32px;
  font-size: 13px;
}

.case-list-menu-item.is-danger {
  color: #dc2626;
}

.case-list-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.case-list-pagination-summary {
  color: #6b7280;
  font-size: 12px;
}

/* Figma interface workspace visual pass */
.case-list-request-body {
  color: #1d2129;
  font-size: 13px;
}

.case-list-panel .editor-actions.left {
  min-height: 31.5px;
  margin-bottom: 14px;
}

.case-list-panel .editor-actions.left :deep(.el-button),
.case-ai-generate-button {
  height: 28px;
  min-height: 28px;
  padding: 0 11.5px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-ai-generate-button {
  border-color: rgba(120, 22, 255, 0.19);
  background: #f5e8ff;
  color: #7816ff;
}

.case-list-table-wrap {
  border-color: #e5e6eb;
  border-radius: 7px;
  box-shadow: none;
}

.case-list-table :deep(.el-table__header th) {
  height: 31px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-list-table :deep(.el-table__row td) {
  height: 34.5px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
}

.case-list-action-button {
  height: 28px;
  color: #165dff;
  font-size: 12px;
}

.case-list-pagination {
  min-height: 40px;
  padding: 0 10.5px;
  border-top-color: #e5e6eb;
}
</style>

<style scoped>
.case-list-request-body { flex: 1; width: 100%; overflow: hidden; }
.case-list-panel { display: flex; flex-direction: column; overflow: hidden; }
.case-list-panel .editor-actions.left { box-sizing: border-box; flex: 0 0 auto; flex-wrap: wrap; min-height: 51px; margin: 0; padding: 10px 16px; border-bottom: 1px solid #e5e6eb; }
.case-endpoint { display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-right: 4px; color: #86909c; font-size: 11px; white-space: nowrap; }
.case-endpoint code { max-width: 200px; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.case-toolbar-spacer { flex: 1; }
.case-list-panel .editor-actions.left :deep(.el-button) { gap: 5px; padding: 5px 14px; border: 0; border-radius: 6px; }
.case-list-panel .editor-actions.left :deep(.el-button > span) { gap: 5px; }
.case-list-panel .editor-actions.left .case-ai-generate-button { height: 30px; padding: 5px 12px; border: 1.5px solid #7816ff40; border-radius: 6px; background: #7816ff08; }
.case-search { position: relative; flex: 0 0 180px; height: 30px; }
.case-search > svg { position: absolute; top: 9px; left: 9px; color: #c9cdd4; }
.case-search input { box-sizing: border-box; width: 100%; height: 30px; padding: 5px 28px; border: 1.5px solid #e5e6eb; border-radius: 6px; color: #1d2129; background: white; font: inherit; font-size: 12px; outline: none; }
.case-search input:focus { border-color: #165dff; }
.case-search button { position: absolute; top: 9px; right: 8px; padding: 0; border: 0; background: transparent; color: #c9cdd4; cursor: pointer; line-height: 0; }
.case-filter { box-sizing: border-box; width: 86px; height: 30px; flex-shrink: 0; padding: 5px 8px; border: 1.5px solid #e5e6eb; border-radius: 6px; background: white; color: #4e5969; font-size: 12px; }
.case-filter.is-filtered { border-color: #165dff; color: #165dff; }
.case-filter:disabled { color: #86909c; cursor: not-allowed; }
.case-toolbar-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 30px; width: 30px; height: 30px; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: white; color: #4e5969; cursor: pointer; }
.case-toolbar-icon:disabled, .case-list-more-button:disabled { opacity: .45; cursor: not-allowed; }
.case-toolbar-icon:hover:not(:disabled) { background: #f2f3f5; }
.case-column-settings, .case-column-settings :deep(.el-checkbox-group) { display: flex; flex-direction: column; }
.case-column-settings strong { margin-bottom: 8px; color: #1d2129; font-size: 13px; }
.case-list-table-wrap { display: flex; flex: 1; min-height: 0; flex-direction: column; border: 0; border-radius: 0; }
.case-list-table { flex: 1; min-height: 0; --el-table-border-color: #e5e6eb; --el-table-row-hover-bg-color: #f7f9ff; }
.case-list-table :deep(.el-table__header th) { height: 40px; padding: 9px 0; background: #f7f8fa; color: #86909c; font-size: 12px; line-height: 18px; }
.case-list-table :deep(.el-table__row td) { height: 49px; padding: 11px 0; }
.case-list-table :deep(.cell) { padding: 0 12px; line-height: 18px; }
.case-list-table :deep(td.case-id-cell) { font-family: monospace; font-size: 11px; color: #86909c; }
.case-list-actions { gap: 2px; }
.case-list-more-button { height: 26px; color: #4e5969; }
.case-result { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #86909c; }
.case-result i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.case-result.is-passed { color: #00b42a; }
.case-result.is-failed, .case-result.is-error { color: #f53f3f; }
.case-result.is-running { color: #165dff; }
.case-list-pagination { flex-shrink: 0; padding: 8px 16px; min-height: 45px; }
.case-unsaved-banner { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 10px 16px; background: #fff7e6; border-bottom: 1px solid #ff7d0030; color: #ff7d00; font-size: 12px; line-height: 18px; }
.case-unsaved-banner span { flex: 1; }
.case-unsaved-banner small { color: #c9cdd4; font-size: 11px; }
.case-state { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; min-height: 240px; padding: 40px; text-align: center; overflow: auto; }
.case-state h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; line-height: 21px; color: #1d2129; }
.case-state p { max-width: 320px; margin: 0 0 16px; color: #86909c; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.case-state small { color: #c9cdd4; font-size: 11px; line-height: 16.5px; }
.case-state-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; margin-bottom: 14px; border-radius: 14px; color: #ff7d00; background: #ff7d0010; }
.is-unsaved p { max-width: 300px; margin-bottom: 6px; }
.is-error .case-state-icon { color: #f53f3f; background: #f53f3f10; border-radius: 50%; }
.is-error p { max-width: 600px; font-size: 12px; }
.is-error small { margin-top: 10px; }
.is-empty .case-state-icon { width: 56px; height: 56px; border-radius: 16px; margin-bottom: 16px; color: #165dff; background: #165dff0a; }
.is-empty p { margin-bottom: 24px; }
.case-state-search { margin-bottom: 12px; color: #c9cdd4; }
.is-no-results h3 { color: #4e5969; }
.case-state-actions { display: flex; gap: 10px; }
.case-state-button { display: inline-flex; align-items: center; gap: 5px; padding: 6px 16px; border: 1px solid #e5e6eb; border-radius: 6px; background: white; color: #4e5969; font-size: 13px; line-height: 19.5px; cursor: pointer; }
.case-state-button.is-primary { background: #165dff; color: white; border-color: #165dff; }
.case-state-button.is-ai { background: #7816ff08; color: #7816ff; border-color: #7816ff40; }
.case-skeleton { flex: 1; overflow: hidden; }
.case-skeleton-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e5e6eb; }
.case-skeleton-row i { width: 60px; height: 12px; border-radius: 4px; background: linear-gradient(90deg, #f2f3f5 25%, #e5e6eb 50%, #f2f3f5 75%); background-size: 200% 100%; animation: case-shimmer 1.4s infinite; }
.case-skeleton-row i:first-child { width: 16px; height: 16px; }
.case-skeleton-row i:nth-child(3) { flex: 1; }
.case-skeleton-row i:last-child { width: 80px; height: 24px; }
.is-spinning { animation: case-spin 1s linear infinite; }
@keyframes case-shimmer { to { background-position: -200% 0; } }
@keyframes case-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .case-skeleton-row i, .is-spinning { animation: none; } }
</style>
