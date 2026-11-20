<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw, Search, X } from '@lucide/vue'

import { apiAutomationApi } from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import { AppDialog } from '@/shared/ui'

import {
  normalizeScenarioRunResult,
  type ScenarioResource,
  type ScenarioResourceKind,
  type ScenarioResourceSelection,
} from './lib/apiScenarioStepRequestUtils'

const props = defineProps<{
  kind: ScenarioResourceKind
  workspaceCode: string
  workspaceName?: string | null
  currentScenarioId: number | null
}>()
const emit = defineEmits<{
  close: []
  add: [items: ScenarioResourceSelection[]]
}>()

const resourceLabels = {
  api: { name: '接口', search: '搜索接口名称 / 路径', columns: ['接口名称', '方法', '请求路径', '所属模块'] },
  case: { name: '接口用例', search: '搜索用例名称 / 路径', columns: ['用例名称', '方法', '请求路径', '所属接口'] },
  scene: { name: '场景', search: '搜索场景名称 / 模块', columns: ['场景名称', '所属模块', '步骤数', '状态'] },
}[props.kind]
const isScene = props.kind === 'scene'
const pageSize = 50
const search = ref('')
const mode = ref<'reference' | 'copy'>('reference')
const rows = ref<ScenarioResource[]>([])
const selected = ref(new Map<number, ScenarioResource>())
const workspaceLabel = ref(props.workspaceName || props.workspaceCode)
const tableBody = ref<HTMLElement | null>(null)
const currentPage = ref(0)
const totalPages = ref(0)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const submitError = ref('')
const needsWorkspace = props.workspaceCode === 'ALL'
const hasMore = computed(() => currentPage.value < totalPages.value)
const selectableRows = computed(() => rows.value.filter(row => !isCurrentScene(row)))
const allSelected = computed(() => selectableRows.value.length > 0 && selectableRows.value.every(row => selected.value.has(row.id)))
const partiallySelected = computed(() => !allSelected.value && selectableRows.value.some(row => selected.value.has(row.id)))
const modeHint = computed(() => mode.value === 'reference'
  ? (isScene ? '引用后将嵌套执行所选场景，并跟随源场景更新。' : '引用后保留与源资源的关联，并跟随源资源更新。')
  : '复制后生成独立步骤，后续修改不会影响源资源。')
const resultLabels = { pass: '通过', fail: '失败', idle: '未运行' } as const
let requestVersion = 0
let disposed = false

function isCurrentScene(row: ScenarioResource) {
  return isScene && row.id === props.currentScenarioId
}

function fetchPage(pageNo: number, keyword: string) {
  if (props.kind === 'case') return apiAutomationApi.getCases(props.workspaceCode, { pageNo, pageSize })
  if (isScene) return apiAutomationApi.getScenarios(props.workspaceCode, { pageNo, pageSize })
  return apiAutomationApi.getDefinitions(props.workspaceCode, { pageNo, pageSize, keyword })
}

function matchesSearch(item: ScenarioResource, keyword: string) {
  if (!keyword || props.kind === 'api') return true
  const extra = 'path' in item ? item.path : item.moduleName || ''
  return [item.name, extra].some(value => value.toLowerCase().includes(keyword))
}

async function loadPage(pageNo: number) {
  const version = ++requestVersion
  loading.value = true
  loadError.value = ''
  try {
    const keyword = search.value.trim()
    // The case and scenario list endpoints do not search the displayed path or module.
    do {
      const page = await fetchPage(pageNo, keyword)
      if (version !== requestVersion) return
      const workspaceItems = page.items.filter(item => item.workspaceCode === props.workspaceCode)
      const items = workspaceItems.filter(item => matchesSearch(item, keyword.toLowerCase()))
      if (workspaceItems[0]?.workspaceName) workspaceLabel.value = workspaceItems[0].workspaceName
      currentPage.value = page.pageNo
      totalPages.value = page.totalPages
      if (items.length) {
        const displayedIds = new Set(rows.value.map(item => item.id))
        rows.value = [...rows.value, ...items.filter(item => !displayedIds.has(item.id))]
        break
      }
      pageNo = page.pageNo + 1
    } while (hasMore.value)
  } catch {
    if (version === requestVersion) loadError.value = `${resourceLabels.name}加载失败，请重试。`
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(search, (_, previous, onCleanup) => {
  if (needsWorkspace) return
  requestVersion++
  rows.value = []
  currentPage.value = 0
  totalPages.value = 0
  loading.value = true
  loadError.value = ''
  if (tableBody.value) tableBody.value.scrollTop = 0
  if (previous === undefined) {
    void loadPage(1)
    return
  }
  const timer = window.setTimeout(() => { void loadPage(1) }, 220)
  onCleanup(() => window.clearTimeout(timer))
}, { immediate: true })

onBeforeUnmount(() => {
  disposed = true
  requestVersion++
})

function loadMoreOnScroll(event: Event) {
  const body = event.currentTarget as HTMLElement
  if (hasMore.value && !loading.value && !loadError.value && body.scrollHeight - body.scrollTop - body.clientHeight < 80) {
    void loadPage(currentPage.value + 1)
  }
}

function toggleRow(row: ScenarioResource) {
  if (isCurrentScene(row)) return
  if (selected.value.has(row.id)) selected.value.delete(row.id)
  else selected.value.set(row.id, row)
}

function toggleAll() {
  const clear = allSelected.value
  for (const row of selectableRows.value) {
    if (clear) selected.value.delete(row.id)
    else selected.value.set(row.id, row)
  }
}

function close() {
  if (!submitting.value) emit('close')
}

async function addSelected() {
  if (!selected.value.size || submitting.value) return
  const resources = [...selected.value.values()]
  submitError.value = ''
  if (isScene || mode.value === 'reference') {
    emit('add', resources.map(resource => ({ resource })))
    return
  }
  submitting.value = true
  try {
    const items: ScenarioResourceSelection[] = []
    for (const resource of resources) {
      const snapshot = props.kind === 'case'
        ? await apiAutomationApi.getCaseDetail(props.workspaceCode, resource.id)
        : await apiAutomationApi.getDefinitionDetail(props.workspaceCode, resource.id)
      if (disposed) return
      items.push({ resource, snapshot })
    }
    emit('add', items)
  } catch (error) {
    if (!disposed) submitError.value = getRequestErrorMessage(error) || '复制失败，请重试。'
  } finally {
    if (!disposed) submitting.value = false
  }
}
</script>

<template>
  <AppDialog
    :model-value="true"
    :title="'选择' + resourceLabels.name"
    width="720px"
    dialog-class="api-scenario-api-picker-dialog"
    modal-class="api-scenario-api-picker-overlay"
    align-center
    :show-close="false"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    @update:model-value="close"
  >
    <template #header>
      <div class="api-scenario-api-picker__header">
        <strong>选择{{ resourceLabels.name }}</strong>
        <button type="button" aria-label="关闭" :disabled="submitting" @click="close"><X :size="15" aria-hidden="true" /></button>
      </div>
    </template>
    <div class="api-scenario-api-picker" :data-kind="kind">
      <div class="api-scenario-api-picker__toolbar">
        <span class="api-scenario-api-picker__workspace" aria-label="场景所属工作空间" :title="workspaceLabel">{{ needsWorkspace ? '全部工作空间' : workspaceLabel }}</span>
        <label class="api-scenario-api-picker__search">
          <Search :size="12" aria-hidden="true" />
          <input v-model="search" :placeholder="resourceLabels.search" :aria-label="resourceLabels.search" :disabled="needsWorkspace || submitting" />
        </label>
      </div>

      <div ref="tableBody" class="api-scenario-api-picker__table-scroll" @scroll.passive="loadMoreOnScroll">
        <div v-if="loading && !rows.length" class="api-scenario-api-picker__state" role="status">
          <RefreshCw :size="20" class="is-spinning" aria-hidden="true" />
          正在加载资源…
        </div>
        <table v-else :aria-label="'可添加的' + resourceLabels.name">
          <colgroup><col class="picker-check"><col class="picker-id"><col class="picker-name"><col class="picker-method"><col class="picker-path"><col></colgroup>
          <thead>
            <tr>
              <th scope="col"><input type="checkbox" aria-label="全选当前列表" :checked="allSelected" :indeterminate.prop="partiallySelected" :disabled="!selectableRows.length || submitting" @change="toggleAll" /></th>
              <th scope="col">ID</th>
              <th v-for="column in resourceLabels.columns" :key="column" scope="col">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" :class="{ 'is-current': isCurrentScene(row) }">
              <td><input type="checkbox" :aria-label="'选择 ' + row.name" :checked="selected.has(row.id)" :disabled="submitting || isCurrentScene(row)" @change="toggleRow(row)" /></td>
              <td class="picker-id-text">{{ row.id }}</td>
              <td class="picker-name-text" :title="row.name">
                <span v-if="isCurrentScene(row)" class="picker-current-tag">当前场景</span>{{ row.name }}
              </td>
              <template v-if="'stepCount' in row">
                <td :title="row.moduleName || undefined">{{ row.moduleName || '—' }}</td>
                <td class="picker-step-count">{{ row.stepCount }} 个</td>
                <td><span class="picker-result" :class="'is-' + normalizeScenarioRunResult(row.lastRunResult)">{{ resultLabels[normalizeScenarioRunResult(row.lastRunResult)] }}</span></td>
              </template>
              <template v-else>
                <td><span class="picker-method-tag" :class="'is-' + row.method.toLowerCase()">{{ row.method }}</span></td>
                <td class="picker-path-text" :title="row.path">{{ row.path }}</td>
                <td v-if="'definitionName' in row" :title="row.definitionName">{{ row.definitionName || '—' }}</td>
                <td v-else :title="row.directoryName || undefined">{{ row.directoryName || '—' }}</td>
              </template>
            </tr>
            <tr v-if="!rows.length || loading || loadError || hasMore" class="picker-state-row">
              <td colspan="6">
                <div v-if="needsWorkspace" class="api-scenario-api-picker__state">请先切换到场景所属的具体工作空间</div>
                <div v-else-if="loadError" class="api-scenario-api-picker__state" role="alert">
                  {{ loadError }} <button type="button" @click="loadPage(currentPage + 1)">重试</button>
                </div>
                <div v-else-if="loading" class="api-scenario-api-picker__more" role="status">正在加载资源…</div>
                <div v-else-if="!rows.length" class="api-scenario-api-picker__state" role="status">
                  <Search :size="26" aria-hidden="true" />
                  <span>未找到匹配的{{ resourceLabels.name }}</span>
                  <small>请调整搜索关键词</small>
                </div>
                <div v-else-if="hasMore" class="api-scenario-api-picker__more"><button type="button" @click="loadPage(currentPage + 1)">加载更多</button></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="api-scenario-api-picker__footer">
        <div>
          <p aria-live="polite">已选择 <strong>{{ selected.size }}</strong> 项</p>
          <small v-if="submitError" class="picker-submit-error" role="alert">{{ submitError }}</small>
          <small v-else>{{ modeHint }}</small>
        </div>
        <div class="api-scenario-api-picker__actions">
          <span>添加方式：</span>
          <button class="picker-mode" type="button" :aria-pressed="mode === 'reference'" :disabled="submitting" @click="mode = 'reference'">引用</button>
          <button class="picker-mode" type="button" :aria-pressed="mode === 'copy'" :disabled="submitting || isScene" @click="mode = 'copy'">{{ isScene ? '复制步骤（待接入）' : '复制' }}</button>
          <i aria-hidden="true"></i>
          <button class="picker-cancel" type="button" :disabled="submitting" @click="close">取消</button>
          <button class="picker-add" type="button" :disabled="!selected.size || submitting" @click="addSelected">{{ submitting ? '添加中…' : selected.size ? `添加 (${selected.size})` : '添加' }}</button>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
:global(.el-overlay.api-scenario-api-picker-overlay) { background: rgb(0 0 0 / 36%); }
:global(.el-dialog.api-scenario-api-picker-dialog) {
  max-width: calc(100% - 32px);
  max-height: 82vh;
  padding: 0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
  font-family: Inter, "Noto Sans SC", sans-serif;
}
:global(.api-scenario-api-picker-dialog > .el-dialog__header) { min-height: 0; flex: none; padding: 16px 20px; border-bottom: 1px solid #e5e6eb; }
:global(.api-scenario-api-picker-dialog > .el-dialog__body) { display: flex; min-height: 0; flex-direction: column; padding: 0; overflow: hidden; }
.api-scenario-api-picker__header { display: flex; align-items: center; justify-content: space-between; color: #1d2129; font-size: 15px; line-height: 22.5px; }
.api-scenario-api-picker__header strong { font-weight: 600; }
.api-scenario-api-picker__header button { display: grid; width: 28px; height: 28px; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #86909c; }
.api-scenario-api-picker__header button:not(:disabled):hover { background: #f3f4f6; }
.api-scenario-api-picker { display: flex; width: 100%; height: 500px; min-height: 0; flex-direction: column; color: #86909c; font-size: 12px; line-height: 18px; }
.api-scenario-api-picker button:not(:disabled), .api-scenario-api-picker__header button:not(:disabled) { cursor: pointer; }
.api-scenario-api-picker button:disabled { cursor: not-allowed; }
.api-scenario-api-picker__toolbar { display: flex; flex: none; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.api-scenario-api-picker__workspace,
.api-scenario-api-picker__search input { box-sizing: border-box; height: 28px; border: 1px solid #e5e6eb; border-radius: 10px; color: #1d2129; font: inherit; }
.api-scenario-api-picker__workspace { width: 120px; flex: 0 0 120px; overflow: hidden; padding: 4px 10px; background: #fff; text-overflow: ellipsis; white-space: nowrap; }
.api-scenario-api-picker__search { position: relative; width: 210px; min-width: 0; }
.api-scenario-api-picker__search svg { position: absolute; top: 8px; left: 8px; pointer-events: none; }
.api-scenario-api-picker__search input { width: 100%; padding: 0 12px 0 28px; background: transparent; }
.api-scenario-api-picker__search input:focus { border-color: #165dff; outline: none; }
.api-scenario-api-picker__search input::placeholder { color: #86909c; }
.api-scenario-api-picker__table-scroll { min-height: 0; flex: 1; overflow: auto; }
.api-scenario-api-picker table { width: 100%; min-width: 540px; table-layout: fixed; border-spacing: 0; border-collapse: separate; }
.picker-check { width: 6.25%; }
.picker-id { width: 14%; }
.picker-name { width: 22.1%; }
.picker-method { width: 10.8%; }
.picker-path { width: 30.7%; }
[data-kind="case"] .picker-id { width: 11.67%; }
[data-kind="case"] .picker-name { width: 24.03%; }
[data-kind="case"] .picker-method { width: 14.44%; }
[data-kind="case"] .picker-path { width: 26.11%; }
[data-kind="scene"] .picker-id { width: 7.64%; }
[data-kind="scene"] .picker-name { width: 42.64%; }
[data-kind="scene"] .picker-method { width: 16.53%; }
[data-kind="scene"] .picker-path { width: 13.47%; }
.api-scenario-api-picker th, .api-scenario-api-picker td { overflow: hidden; padding-inline: 8px; border-bottom: 1px solid #e5e6eb; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.api-scenario-api-picker th { position: sticky; top: 0; z-index: 1; height: 35px; background: #f4f6fa; font-weight: 500; }
.api-scenario-api-picker td { height: 39px; }
.api-scenario-api-picker th:first-child, .api-scenario-api-picker td:first-child { padding-left: 16px; }
.api-scenario-api-picker tbody tr:not(.picker-state-row):nth-child(even) { background: #f4f6fa80; }
.api-scenario-api-picker input[type="checkbox"] { width: 13px; height: 13px; margin: 0; accent-color: #165dff; vertical-align: middle; }
.picker-id-text, .picker-path-text { font-family: ui-monospace, Consolas, monospace; }
.picker-path-text { color: #4e5969; }
.picker-name-text { color: #1d2129; font-weight: 500; }
.picker-step-count { color: #4e5969; }
.api-scenario-api-picker tr.is-current { opacity: .55; }
.picker-current-tag { margin-right: 6px; padding: 2px 6px; border-radius: 4px; background: #f2f3f5; color: #86909c; font-size: 10px; }
.picker-result { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.picker-result.is-pass { color: #00b42a; }
.picker-result.is-fail { color: #f53f3f; }
.picker-result.is-idle { color: #c9cdd4; font-size: 11px; font-weight: 400; }
.picker-result:not(.is-idle)::before { width: 6px; height: 6px; border-radius: 50%; background: currentColor; content: ""; }
.picker-method-tag { padding-block: 2px; border-radius: 4px; background: #f2f3f5; color: #4e5969; font-size: 10px; font-weight: 700; }
.picker-method-tag.is-get { background: #e8ffea; color: #00b42a; }
.picker-method-tag.is-post { background: #e8f3ff; color: #165dff; }
.picker-method-tag.is-put { background: #fff3e8; color: #ff7d00; }
.picker-method-tag.is-delete { background: #ffeeee; color: #f53f3f; }
.picker-method-tag.is-patch { background: #f5e8ff; color: #7816ff; }
.api-scenario-api-picker td[colspan] { padding: 0; border: 0; }
.api-scenario-api-picker__state { display: flex; height: 100%; min-height: 166px; flex-direction: column; align-items: center; justify-content: center; gap: 8px; white-space: normal; }
.api-scenario-api-picker__state span { font-size: 13px; }
.api-scenario-api-picker__state svg { color: #c9cdd4; }
.api-scenario-api-picker__state .is-spinning { color: #86909c; animation: api-picker-spin 1s linear infinite; }
@keyframes api-picker-spin { to { transform: rotate(360deg); } }
.api-scenario-api-picker__more { padding: 8px; text-align: center; }
.api-scenario-api-picker__state button, .api-scenario-api-picker__more button { padding: 0; border: 0; background: transparent; color: #165dff; font: inherit; }
.api-scenario-api-picker__footer { display: flex; flex: none; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 12px 16px; border-top: 1px solid #e5e6eb; }
.api-scenario-api-picker__footer p { margin: 0; }
.api-scenario-api-picker__footer strong { color: #165dff; }
.api-scenario-api-picker__footer small { display: block; margin-top: 4px; color: #c9cdd4; font-size: 11px; line-height: 16.5px; }
.api-scenario-api-picker__footer .picker-submit-error { color: #f53f3f; }
.api-scenario-api-picker__actions { display: flex; flex: none; align-items: center; gap: 8px; white-space: nowrap; }
.api-scenario-api-picker__actions button { font-family: inherit; font-weight: 500; }
.api-scenario-api-picker__actions i { width: 1px; height: 16px; margin-inline: 4px; background: #e5e6eb; }
.picker-mode, .picker-cancel { border: 1px solid #e5e6eb; background: #fff; color: #4e5969; }
.picker-mode { height: 24px; padding: 0 10px; border-radius: 4px; font-size: 11px; }
.picker-mode:disabled { opacity: .5; }
.picker-mode[aria-pressed="true"] { border-color: #165dff; background: #e8f3ff; color: #165dff; }
.picker-cancel { height: 28px; padding: 0 12px; border-radius: 10px; font-size: 12px; }
.picker-cancel:not(:disabled):hover { background: #f4f6fa; }
.picker-add { height: 32px; padding: 0 14px; border: 0; border-radius: 10px; background: #165dff; color: #fff; font-size: 13px; }
.picker-add:disabled { opacity: .5; }
.picker-add:not(:disabled):hover { background: #4080ff; }
@media (max-width: 660px) {
  .api-scenario-api-picker__footer { flex-wrap: wrap; gap: 8px; }
  .api-scenario-api-picker__actions { margin-left: auto; }
}
@media (max-width: 375px) {
  .api-scenario-api-picker__actions > span { display: none; }
}
</style>
