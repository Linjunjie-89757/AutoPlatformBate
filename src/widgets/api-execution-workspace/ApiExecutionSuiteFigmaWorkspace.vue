<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  FileText,
  GripVertical,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import { useSession } from '@/entities/session'
import {
  type AppTableColumnDefinition,
  useLocalPagedTable,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { AppFigmaActionColumn } from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

const props = withDefaults(defineProps<{
  workspaceCode?: string
}>(), {
  workspaceCode: 'ALL',
})

type Priority = 'P0' | 'P1' | 'P2' | 'P3'
type SuiteResult = 'pass' | 'fail' | null
type SuiteItemType = 'api' | 'scene'

interface SuiteItem {
  id: string
  type: SuiteItemType
  name: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path?: string
  desc?: string
  module?: string
  steps?: number
  status?: 'pass' | 'fail' | 'running'
}

interface Suite {
  id: string
  name: string
  module: string
  priority: Priority
  desc: string
  items: SuiteItem[]
  env: string
  runMode: 'serial' | 'parallel'
  runLocation: 'server' | 'runner'
  notify: boolean
  lastRun: string | null
  lastResult: SuiteResult
}

interface RunRecord {
  id: string
  startTime: string
  env: string
  pass: number
  total: number
  fail: number
  duration: string
  operator: string
  status: 'pass' | 'fail' | 'running'
}

const moduleOptions = ['全部', '获客中心', '用户中心', '订单中心', '权限中心', '结算中心']
const environmentOptions = ['测试环境', '预发布环境', '生产环境(只读)', '本地联调']

const suites = ref<Suite[]>([
  {
    id: 'su1',
    name: '核心业务回归套件',
    module: '全部',
    priority: 'P0',
    desc: '每次发版前必跑，覆盖用户、产品、订单核心链路',
    env: '测试环境',
    runMode: 'serial',
    runLocation: 'server',
    notify: true,
    lastRun: '2026-07-14 08:00',
    lastResult: 'pass',
    items: [
      { id: 'i1', type: 'api', name: '用户注册', method: 'POST', path: '/auth/register' },
      { id: 'i2', type: 'api', name: '用户登录', method: 'POST', path: '/auth/login' },
      { id: 'i3', type: 'scene', name: '产品管理-新增编辑删除闭环', desc: '10个步骤' },
      { id: 'i4', type: 'scene', name: '订单全链路压测场景', desc: '5个步骤，循环嵌套' },
      { id: 'i5', type: 'api', name: '获取订单列表', method: 'GET', path: '/orders' },
    ],
  },
  {
    id: 'su2',
    name: '权限安全回归套件',
    module: '权限中心',
    priority: 'P1',
    desc: '验证各角色权限边界，安全合规必跑',
    env: '测试环境',
    runMode: 'parallel',
    runLocation: 'runner',
    notify: false,
    lastRun: '2026-07-13 20:00',
    lastResult: 'fail',
    items: [
      { id: 'i6', type: 'scene', name: '权限校验场景', desc: '4个步骤' },
      { id: 'i7', type: 'api', name: '查询用户权限', method: 'GET', path: '/permissions' },
    ],
  },
  {
    id: 'su3',
    name: 'P0 接口冒烟套件',
    module: '全部',
    priority: 'P0',
    desc: '上线前快速冒烟，核心接口可用性验证',
    env: '预发布环境',
    runMode: 'parallel',
    runLocation: 'server',
    notify: true,
    lastRun: '2026-07-14 07:30',
    lastResult: 'pass',
    items: [
      { id: 'i8', type: 'api', name: '健康检查', method: 'GET', path: '/health' },
      { id: 'i9', type: 'api', name: '获取配置', method: 'GET', path: '/config' },
      { id: 'i10', type: 'api', name: '用户登录', method: 'POST', path: '/auth/login' },
    ],
  },
])

const caseCandidates: SuiteItem[] = [
  { id: 'c001', type: 'api', name: '查询商品列表', method: 'GET', path: '/products', desc: '商品接口' },
  { id: 'c002', type: 'api', name: '新增商品', method: 'POST', path: '/products', desc: '商品接口' },
  { id: 'c003', type: 'api', name: '获取用户信息', method: 'GET', path: '/users/{id}', desc: '用户接口' },
  { id: 'c004', type: 'api', name: '更新用户信息', method: 'PUT', path: '/users/{id}', desc: '用户接口' },
  { id: 'c005', type: 'api', name: '删除订单', method: 'DELETE', path: '/orders/{id}', desc: '订单接口' },
  { id: 'c006', type: 'api', name: '创建订单', method: 'POST', path: '/orders', desc: '订单接口' },
]

const sceneCandidates: SuiteItem[] = [
  { id: 's1', type: 'scene', name: '产品管理-新增编辑删除闭环', desc: '获客中心 · 10 个步骤', module: '获客中心', steps: 10, status: 'pass' },
  { id: 's2', type: 'scene', name: '用户注册登录完整流程', desc: '用户中心 · 6 个步骤', module: '用户中心', steps: 6, status: 'pass' },
  { id: 's3', type: 'scene', name: '订单全链路压测场景', desc: '订单中心 · 5 个步骤', module: '订单中心', steps: 5, status: 'pass' },
  { id: 's4', type: 'scene', name: '权限校验场景', desc: '权限中心 · 4 个步骤', module: '权限中心', steps: 4 },
]

const runRecords: RunRecord[] = [
  { id: 'r1', startTime: '2026-07-14 08:00:12', env: '测试环境', pass: 18, total: 20, fail: 2, duration: '2m 34s', operator: '张程远', status: 'fail' },
  { id: 'r2', startTime: '2026-07-13 20:01:05', env: '测试环境', pass: 20, total: 20, fail: 0, duration: '2m 01s', operator: '自动调度', status: 'pass' },
  { id: 'r3', startTime: '2026-07-13 12:00:00', env: '测试环境', pass: 19, total: 20, fail: 1, duration: '2m 18s', operator: '李雷', status: 'fail' },
  { id: 'r4', startTime: '2026-07-12 08:00:10', env: '预发布环境', pass: 20, total: 20, fail: 0, duration: '1m 58s', operator: '自动调度', status: 'pass' },
]

const keyword = ref('')
const moduleFilter = ref('全部')
const activeTab = ref('list')
const openedIds = ref<string[]>([])
const editorTab = ref<'arrange' | 'results'>('arrange')
const editingName = ref(false)
const editingNameDraft = ref('')
const pickerType = ref<SuiteItemType | null>(null)
const pickerKeyword = ref('')
const selectedPickerIds = ref<string[]>([])
const selectedRunRecord = ref<RunRecord | null>(null)
const expandedResultItems = ref<string[]>(['failure-scene'])
const suiteTableFrameRef = ref<HTMLElement | null>(null)
const suiteTableFrameWidth = ref(0)
const { currentUser } = useSession()
let suiteTableFrameObserver: ResizeObserver | null = null

const activeSuite = computed(() => suites.value.find(item => item.id === activeTab.value) || null)
const visibleSuites = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return suites.value.filter((suite) => {
    const matchesKeyword = !search || suite.name.toLowerCase().includes(search) || suite.desc.toLowerCase().includes(search)
    const matchesModule = moduleFilter.value === '全部' || suite.module === moduleFilter.value
    return matchesKeyword && matchesModule
  })
})

const suiteTableColumns: AppTableColumnDefinition[] = [
  { key: 'name', label: '套件名称', defaultVisible: true, required: true },
  { key: 'priority', label: '优先级', defaultVisible: true },
  { key: 'module', label: '所属模块', defaultVisible: true },
  { key: 'items', label: '编排项', defaultVisible: true },
  { key: 'lastResult', label: '最近结果', defaultVisible: true },
  { key: 'lastRun', label: '最近运行', defaultVisible: true },
  { key: 'id', label: '套件 ID', defaultVisible: false, minWidth: 120 },
  { key: 'env', label: '执行环境', defaultVisible: false, minWidth: 120 },
  { key: 'runMode', label: '运行模式', defaultVisible: false, minWidth: 100 },
  { key: 'runLocation', label: '运行于', defaultVisible: false, minWidth: 120 },
  { key: 'notify', label: '运行通知', defaultVisible: false, minWidth: 100 },
]

const suiteColumnSettings = useTableColumnSettings({
  columns: suiteTableColumns,
  storageKey: computed(() => `app-figma-table:api-execution-suites:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  immediate: true,
})

const {
  items: pagedSuites,
  total: filteredSuiteTotal,
  pageNo: suitePageNo,
  pageSize: suitePageSize,
  setPage: setSuitePage,
  setPageSize: setSuitePageSize,
  resetPage: resetSuitePage,
} = useLocalPagedTable(visibleSuites, { initialPageSize: 10 })

const suiteDefaultColumnWeights: Record<string, number> = {
  name: 0.347,
  priority: 0.08225,
  module: 0.09766,
  items: 0.08225,
  lastResult: 0.09766,
  lastRun: 0.2355,
}

const suiteOperationActionCount = 3
const suiteTableBaselineWidth = computed(() => Math.max(960, suiteTableFrameWidth.value || 960))
const suiteOperationWidth = computed(() => Math.max(96, Math.round(suiteTableBaselineWidth.value * 0.05768)))
const hasAdditionalSuiteColumns = computed(() => suiteColumnSettings.visibleColumns.value.some(column => column.defaultVisible === false))
const suiteDefaultColumnWidths = computed<Record<string, number>>(() => {
  const keys = Object.keys(suiteDefaultColumnWeights)
  const targetWidth = suiteTableBaselineWidth.value - suiteOperationWidth.value
  let allocatedWidth = 0

  return keys.reduce<Record<string, number>>((widths, key, index) => {
    const width = index === keys.length - 1
      ? targetWidth - allocatedWidth
      : Math.round(suiteTableBaselineWidth.value * suiteDefaultColumnWeights[key])
    widths[key] = width
    allocatedWidth += width
    return widths
  }, {})
})

function getSuiteColumnWidth(column: AppTableColumnDefinition) {
  return suiteDefaultColumnWidths.value[column.key] || column.width || column.minWidth || 140
}

function suiteResultLabel(result: SuiteResult) {
  return result === 'pass' ? '通过' : result === 'fail' ? '失败' : '未运行'
}

function formatSuiteColumn(suite: Suite, key: string) {
  if (key === 'runMode') return suite.runMode === 'serial' ? '串行' : '并行'
  if (key === 'runLocation') return suite.runLocation === 'server' ? '服务端执行' : '本地执行器'
  if (key === 'notify') return suite.notify ? '已开启' : '未开启'
  return suite[key as keyof Suite] ?? '-'
}

function suiteRowClassName({ rowIndex }: { rowIndex: number }) {
  return rowIndex % 2 === 1 ? 'is-alt' : ''
}

watch([keyword, moduleFilter], resetSuitePage)

watch(suiteTableFrameRef, element => {
  suiteTableFrameObserver?.disconnect()
  suiteTableFrameObserver = null
  if (!element) return

  const syncWidth = () => {
    suiteTableFrameWidth.value = element.clientWidth
  }
  syncWidth()
  suiteTableFrameObserver = new ResizeObserver(syncWidth)
  suiteTableFrameObserver.observe(element)
})

onBeforeUnmount(() => {
  suiteTableFrameObserver?.disconnect()
})
const pickerRows = computed(() => {
  const rows = pickerType.value === 'scene' ? sceneCandidates : caseCandidates
  const search = pickerKeyword.value.trim().toLowerCase()
  return rows.filter(item => !search || item.name.toLowerCase().includes(search))
})
const activeItemIds = computed(() => new Set(activeSuite.value?.items.map(item => item.id) || []))
const selectablePickerIds = computed(() => pickerRows.value.filter(item => !activeItemIds.value.has(item.id)).map(item => item.id))
const pickerAllSelected = computed(() => selectablePickerIds.value.length > 0 && selectablePickerIds.value.every(id => selectedPickerIds.value.includes(id)))
const pickerPartiallySelected = computed(() => !pickerAllSelected.value && selectablePickerIds.value.some(id => selectedPickerIds.value.includes(id)))

function openSuite(id: string) {
  if (!openedIds.value.includes(id)) openedIds.value.push(id)
  activeTab.value = id
  editorTab.value = 'arrange'
  selectedRunRecord.value = null
}

function closeSuite(id: string) {
  const index = openedIds.value.indexOf(id)
  openedIds.value = openedIds.value.filter(item => item !== id)
  if (activeTab.value === id) activeTab.value = openedIds.value[index] || openedIds.value[index - 1] || 'list'
}

function createSuite() {
  const id = `new-${Date.now()}`
  suites.value.push({
    id,
    name: '未命名套件',
    module: '全部',
    priority: 'P2',
    desc: '',
    items: [],
    env: '测试环境',
    runMode: 'serial',
    runLocation: 'server',
    notify: false,
    lastRun: null,
    lastResult: null,
  })
  openSuite(id)
  startNameEdit()
}

function startNameEdit() {
  if (!activeSuite.value) return
  editingNameDraft.value = activeSuite.value.name
  editingName.value = true
  void nextTick(() => document.querySelector<HTMLInputElement>('.figma-suite__name-input')?.focus())
}

function finishNameEdit() {
  if (activeSuite.value && editingNameDraft.value.trim()) activeSuite.value.name = editingNameDraft.value.trim()
  editingName.value = false
}

function moveItem(index: number, direction: -1 | 1) {
  if (!activeSuite.value) return
  const target = index + direction
  if (target < 0 || target >= activeSuite.value.items.length) return
  const items = activeSuite.value.items
  const current = items[index]
  items[index] = items[target]
  items[target] = current
}

function removeItem(id: string) {
  if (!activeSuite.value) return
  activeSuite.value.items = activeSuite.value.items.filter(item => item.id !== id)
}

function openPicker(type: SuiteItemType) {
  pickerType.value = type
  pickerKeyword.value = ''
  selectedPickerIds.value = []
}

function togglePickerItem(id: string) {
  if (activeItemIds.value.has(id)) return
  selectedPickerIds.value = selectedPickerIds.value.includes(id)
    ? selectedPickerIds.value.filter(item => item !== id)
    : [...selectedPickerIds.value, id]
}

function toggleAllPickerItems(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const visibleIds = new Set(selectablePickerIds.value)
  selectedPickerIds.value = checked
    ? [...new Set([...selectedPickerIds.value, ...visibleIds])]
    : selectedPickerIds.value.filter(id => !visibleIds.has(id))
}

function addPickerItems() {
  if (!activeSuite.value || !pickerType.value) return
  const source = pickerType.value === 'scene' ? sceneCandidates : caseCandidates
  activeSuite.value.items.push(...source.filter(item => selectedPickerIds.value.includes(item.id)).map(item => ({ ...item })))
  pickerType.value = null
}

function runSuite() {
  ElMessage.success('套件已开始运行')
}

function saveSuite() {
  ElMessage.success('套件已保存')
}

function deleteSuite(id: string) {
  suites.value = suites.value.filter(item => item.id !== id)
  closeSuite(id)
}

function toggleResultItem(id: string) {
  expandedResultItems.value = expandedResultItems.value.includes(id)
    ? expandedResultItems.value.filter(item => item !== id)
    : [...expandedResultItems.value, id]
}
</script>

<template>
  <section class="figma-suite">
    <header class="figma-suite__tabs">
      <button :class="{ 'is-active': activeTab === 'list' }" type="button" @click="activeTab = 'list'">全部套件</button>
      <i />
      <div class="figma-suite__opened-tabs" :class="{ 'is-empty': !openedIds.length }">
        <button
          v-for="id in openedIds"
          :key="id"
          :class="{ 'is-active': activeTab === id }"
          type="button"
          @click="activeTab = id"
        >
          <span class="figma-suite__opened-name">{{ suites.find(item => item.id === id)?.name || '未命名套件' }}</span>
          <span class="figma-suite__tab-close" title="关闭" @click.stop="closeSuite(id)"><X /></span>
        </button>
      </div>
      <button class="figma-suite__new-tab" title="新建套件" type="button" @click="createSuite"><Plus /></button>
    </header>

    <div v-if="activeTab === 'list'" class="figma-suite__list-view">
      <div class="figma-suite__toolbar">
        <label class="figma-suite__search"><Search /><input v-model="keyword" placeholder="搜索套件名称" /></label>
        <label class="figma-suite__filter-select">
          <select v-model="moduleFilter" aria-label="所属模块筛选">
            <option v-for="item in moduleOptions" :key="item">{{ item }}</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
        <span />
        <button class="figma-suite__primary" type="button" @click="createSuite"><Plus />新建套件</button>
      </div>

      <div ref="suiteTableFrameRef" class="figma-suite__table-wrap">
        <AppFigmaTable
          class="figma-suite__data-table"
          :data="pagedSuites"
          :page-no="suitePageNo"
          :page-size="suitePageSize"
          :total="filteredSuiteTotal"
          show-page-size
          show-jumper
          :header-height="36"
          :row-height="60"
          :row-class-name="suiteRowClassName"
          row-key="id"
          empty-text="没有匹配的执行套件"
          @page-change="setSuitePage"
          @page-size-change="setSuitePageSize"
          @row-click="suite => openSuite(suite.id)"
        >
          <el-table-column
            v-for="column in suiteColumnSettings.visibleColumns.value"
            :key="column.key"
            :label="column.label"
            :width="getSuiteColumnWidth(column)"
            show-overflow-tooltip
          >
            <template #default="{ row: suite }">
              <div v-if="column.key === 'name'" class="figma-suite__table-name"><button type="button" @click.stop="openSuite(suite.id)">{{ suite.name }}</button><small>{{ suite.desc }}</small></div>
              <b v-else-if="column.key === 'priority'" class="figma-suite__priority" :class="`is-${suite.priority.toLowerCase()}`">{{ suite.priority }}</b>
              <span v-else-if="column.key === 'module'" class="figma-suite__table-text">{{ suite.module }}</span>
              <span v-else-if="column.key === 'items'" class="figma-suite__table-text">{{ suite.items.length }} 项</span>
              <span v-else-if="column.key === 'lastResult'" class="figma-suite__status" :class="`is-${suite.lastResult || 'empty'}`"><i />{{ suiteResultLabel(suite.lastResult) }}</span>
              <span v-else-if="column.key === 'lastRun'" class="figma-suite__last-date is-mono">{{ suite.lastRun || '-' }}</span>
              <span v-else class="figma-suite__table-extra">{{ formatSuiteColumn(suite, column.key) }}</span>
            </template>
          </el-table-column>

          <AppFigmaActionColumn
            :action-count="suiteOperationActionCount"
            :width="suiteOperationWidth"
            :button-size="24"
            :action-gap="2"
            :scroll-shadow="hasAdditionalSuiteColumns"
          >
            <template #settings>
              <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="suiteColumnSettings.open()" />
            </template>
            <template #default="{ row: suite }">
              <button title="编辑" aria-label="编辑" type="button" @click.stop="openSuite(suite.id)"><Edit2 /></button>
              <button title="运行" aria-label="运行" type="button" @click.stop="runSuite"><Play /></button>
              <button title="删除" aria-label="删除" data-danger="true" type="button" @click.stop="deleteSuite(suite.id)"><Trash2 /></button>
            </template>
          </AppFigmaActionColumn>
        </AppFigmaTable>
      </div>
    </div>

    <div v-else-if="activeSuite" class="figma-suite__editor">
      <main class="figma-suite__editor-main">
        <nav class="figma-suite__subtabs">
          <button :class="{ 'is-active': editorTab === 'arrange' }" type="button" @click="editorTab = 'arrange'; selectedRunRecord = null">编排 ({{ activeSuite.items.length }})</button>
          <button :class="{ 'is-active': editorTab === 'results' }" type="button" @click="editorTab = 'results'">运行结果</button>
        </nav>

        <template v-if="editorTab === 'arrange'">
          <section class="figma-suite__suite-info">
            <div>
              <label class="figma-suite__priority-field" :class="`is-${activeSuite.priority.toLowerCase()}`">
                <select v-model="activeSuite.priority" class="figma-suite__priority-select">
                  <option>P0</option><option>P1</option><option>P2</option><option>P3</option>
                </select>
                <ChevronDown aria-hidden="true" />
              </label>
              <input v-if="editingName" v-model="editingNameDraft" class="figma-suite__name-input" @blur="finishNameEdit" @keydown.enter="finishNameEdit" />
              <button v-else class="figma-suite__name" type="button" @click="startNameEdit">{{ activeSuite.name }}<Edit2 /></button>
            </div>
            <p v-if="activeSuite.desc">{{ activeSuite.desc }}</p>
          </section>

          <section class="figma-suite__arrange-toolbar">
            <p>共 <strong>{{ activeSuite.items.length }}</strong> 个编排项，执行顺序即保存顺序</p>
            <div><button type="button" @click="openPicker('api')"><FileText />添加接口用例</button><button type="button" @click="openPicker('scene')"><Layers />添加场景</button></div>
          </section>

          <section class="figma-suite__items">
            <template v-if="activeSuite.items.length">
              <article v-for="(item, index) in activeSuite.items" :key="item.id">
                <GripVertical class="figma-suite__drag" />
                <span class="figma-suite__index">{{ index + 1 }}</span>
                <b class="figma-suite__type" :class="`is-${item.type}`">{{ item.type === 'api' ? '接口' : '场景' }}</b>
                <b v-if="item.method" class="figma-suite__method" :class="`is-${item.method.toLowerCase()}`">{{ item.method }}</b>
                <p>{{ item.name }}</p>
                <code v-if="item.path">{{ item.path }}</code><small v-else>{{ item.desc }}</small>
                <div><button title="上移" :disabled="index === 0" type="button" @click="moveItem(index, -1)"><ArrowUp /></button><button title="下移" :disabled="index === activeSuite.items.length - 1" type="button" @click="moveItem(index, 1)"><ArrowDown /></button><button title="移除" type="button" @click="removeItem(item.id)"><Trash2 /></button></div>
              </article>
            </template>
            <div v-else class="figma-suite__arrange-empty"><FileText /><p>还没有编排项，添加接口用例或场景开始</p><div><button type="button" @click="openPicker('api')"><FileText />添加用例</button><button type="button" @click="openPicker('scene')"><Layers />添加场景</button></div></div>
          </section>
        </template>

        <section v-else-if="!selectedRunRecord" class="figma-suite__results">
          <header><strong>运行记录</strong><button type="button"><RefreshCw />刷新</button></header>
          <table>
            <colgroup>
              <col style="width:390.578125px" /><col style="width:224.046875px" /><col style="width:204.796875px" /><col style="width:132.390625px" />
              <col style="width:172.125px" /><col style="width:193.5px" /><col style="width:159.125px" /><col style="width:132.4375px" />
            </colgroup>
            <thead><tr><th>开始时间</th><th>环境</th><th>通过/总数</th><th>失败</th><th>耗时</th><th>执行人</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="record in runRecords" :key="record.id"><td class="is-mono">{{ record.startTime }}</td><td>{{ record.env }}</td><td><strong class="is-pass">{{ record.pass }}</strong><span class="figma-suite__result-total"> / {{ record.total }}</span></td><td><strong :class="record.fail ? 'is-fail' : 'is-zero'">{{ record.fail }}</strong></td><td class="is-mono">{{ record.duration }}</td><td>{{ record.operator }}</td><td><span class="figma-suite__status" :class="`is-${record.status}`"><i />{{ record.status === 'pass' ? '通过' : record.status === 'fail' ? '失败' : '运行中' }}</span></td><td><button title="查看详情" type="button" @click="selectedRunRecord = record"><Eye /></button></td></tr></tbody>
          </table>
        </section>

        <section v-else class="figma-suite__result-detail">
          <button type="button" @click="selectedRunRecord = null"><ArrowLeft />返回运行结果列表</button>
          <div class="figma-suite__summary"><article><small>通过</small><strong class="is-pass">{{ selectedRunRecord.pass }}</strong></article><article><small>失败</small><strong class="is-fail">{{ selectedRunRecord.fail }}</strong></article><article><small>跳过</small><strong>0</strong></article><article><small>耗时</small><strong class="is-primary">{{ selectedRunRecord.duration }}</strong></article></div>
          <p class="figma-suite__result-meta"><span><b>环境：</b>{{ selectedRunRecord.env }}</span><span><b>变量集：</b>公共变量集</span><span><b>失败后继续：</b>是</span><span><b>重试次数：</b>0</span></p>
          <div class="figma-suite__result-items">
            <article><header><CheckCircle2 /><b>接口用例</b><strong>用户注册</strong><span>3 步骤 · 1.2s</span><ChevronDown /></header></article>
            <article><header role="button" tabindex="0" @click="toggleResultItem('failure-scene')"><XCircle /><b>场景</b><strong>产品管理-新增编辑删除闭环</strong><span>10 步骤 · 8.4s</span><AlertCircle /><component :is="expandedResultItems.includes('failure-scene') ? ChevronUp : ChevronDown" /></header><div v-if="expandedResultItems.includes('failure-scene')"><p><AlertCircle />步骤 4 断言失败：期望 200 实际 404</p><div v-for="index in 4" :key="index"><component :is="index === 4 ? XCircle : CheckCircle2" /><span>步骤 {{ index }} · {{ ['发送验证码', '注册账户', '登录获取Token', '查询用户(失败)'][index - 1] }}</span><code>{{ index === 4 ? 404 : 200 }}</code><small>{{ [120, 340, 280, 150][index - 1] }}ms</small><button title="查看详情" type="button"><Eye /></button></div></div></article>
            <article><header><CheckCircle2 /><b>接口用例</b><strong>创建订单</strong><span>2 步骤 · 0.8s</span><ChevronDown /></header></article>
          </div>
        </section>
      </main>

      <aside class="figma-suite__config">
        <header><label class="figma-suite__select-shell"><select v-model="activeSuite.env"><option v-for="item in environmentOptions" :key="item">{{ item }}</option></select><ChevronDown aria-hidden="true" /></label><div><button type="button" @click="runSuite"><Play />运行</button><button type="button" @click="saveSuite"><Save />保存</button></div></header>
        <div class="figma-suite__config-body">
          <div class="figma-suite__config-field is-module"><span><em>*</em> 所属模块</span><label class="figma-suite__select-shell"><select v-model="activeSuite.module"><option v-for="item in moduleOptions" :key="item">{{ item }}</option></select><ChevronDown aria-hidden="true" /></label></div>
          <fieldset><legend>运行模式</legend><div class="figma-suite__radio-row"><label><input v-model="activeSuite.runMode" class="figma-suite__radio-input" type="radio" value="serial" />串行</label><label><input v-model="activeSuite.runMode" class="figma-suite__radio-input" type="radio" value="parallel" />并行</label></div></fieldset>
          <div class="figma-suite__config-field is-location"><span>运行于</span><label class="figma-suite__select-shell"><select v-model="activeSuite.runLocation"><option value="server">服务端执行</option><option value="runner">本地执行器</option></select><ChevronDown aria-hidden="true" /></label></div>
          <section v-if="activeSuite.runLocation === 'runner'" class="figma-suite__runners"><label><i class="is-online" /><span><b>Runner-主机A</b><small>runner-001 · 在线</small></span><input checked name="runner" type="radio" /></label><label><i /><span><b>Runner-主机B</b><small>runner-002 · 离线</small></span><input disabled name="runner" type="radio" /></label></section>
          <div class="figma-suite__notify"><span>运行通知</span><button :class="{ 'is-on': activeSuite.notify }" type="button" @click="activeSuite.notify = !activeSuite.notify"><i /></button></div>
          <section v-if="activeSuite.lastRun" class="figma-suite__last-run"><p>上次运行结果</p><span class="figma-suite__status" :class="`is-${activeSuite.lastResult}`"><i />{{ activeSuite.lastResult === 'pass' ? '通过' : '失败' }}</span><small>{{ activeSuite.lastRun }}</small></section>
        </div>
      </aside>
    </div>

    <AppTableColumnSettingsDrawer
      :model-value="suiteColumnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="suiteColumnSettings.drawerColumns.value"
      :dragging-key="suiteColumnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) suiteColumnSettings.cancel() }"
      @toggle-column="suiteColumnSettings.toggleColumn"
      @drag-start="suiteColumnSettings.dragStart"
      @drag-end="suiteColumnSettings.dragEnd"
      @drop-column="suiteColumnSettings.dropColumn"
      @reset="suiteColumnSettings.resetDraft"
    />

    <div v-if="pickerType" class="figma-suite__overlay">
      <section class="figma-suite__dialog" :class="{ 'is-scene': pickerType === 'scene' }">
        <header><strong>{{ pickerType === 'scene' ? '添加场景' : '添加接口用例' }}</strong><button title="关闭" type="button" @click="pickerType = null"><X /></button></header>
        <div class="figma-suite__dialog-tools"><select><option>X-MAN</option></select><select v-if="pickerType === 'api'"><option>HTTP</option></select><label><Search /><input v-model="pickerKeyword" :placeholder="pickerType === 'scene' ? '搜索场景名称' : '搜索用例名称'" /></label></div>
        <div class="figma-suite__dialog-table">
          <table :class="pickerType === 'scene' ? 'is-scene-picker' : 'is-api-picker'">
            <colgroup v-if="pickerType === 'api'">
              <col style="width:41px" /><col style="width:68.78125px" /><col style="width:138.1875px" /><col style="width:83px" /><col style="width:149.75px" /><col style="width:99.609375px" /><col style="width:99.671875px" />
            </colgroup>
            <colgroup v-else>
              <col style="width:41px" /><col style="width:51.484375px" /><col style="width:296.515625px" /><col style="width:112.390625px" /><col style="width:90.640625px" /><col style="width:87.96875px" />
            </colgroup>
            <thead><tr><th><input :checked="pickerAllSelected" :indeterminate="pickerPartiallySelected" aria-label="全选当前页" type="checkbox" @change="toggleAllPickerItems" /></th><th>ID</th><th>{{ pickerType === 'scene' ? '场景名称' : '用例名称' }}</th><th v-if="pickerType === 'api'">方法</th><th v-if="pickerType === 'api'">请求路径</th><th>{{ pickerType === 'scene' ? '所属模块' : '所属接口' }}</th><th v-if="pickerType === 'scene'">步骤数</th><th>{{ pickerType === 'scene' ? '状态' : '运行状态' }}</th></tr></thead>
            <tbody><tr v-for="item in pickerRows" :key="item.id" :class="{ 'is-disabled': activeItemIds.has(item.id) }" @click="togglePickerItem(item.id)"><td><span v-if="activeItemIds.has(item.id)">已在套件</span><input v-else :checked="selectedPickerIds.includes(item.id)" type="checkbox" /></td><td class="figma-suite__picker-id">{{ item.id }}</td><td><strong>{{ item.name }}</strong></td><td v-if="pickerType === 'api'"><b class="figma-suite__picker-method" :class="`is-${item.method?.toLowerCase()}`">{{ item.method }}</b></td><td v-if="pickerType === 'api'" class="figma-suite__picker-path">{{ item.path }}</td><td>{{ pickerType === 'scene' ? item.module : item.desc }}</td><td v-if="pickerType === 'scene'">{{ item.steps }} 个</td><td><span v-if="pickerType === 'scene' && item.status" class="figma-suite__picker-status" :class="`is-${item.status}`"><i />{{ item.status === 'pass' ? '通过' : item.status === 'fail' ? '失败' : '运行中' }}</span><span v-else class="figma-suite__picker-empty-status">未运行</span></td></tr></tbody>
          </table>
        </div>
        <footer><p>已选 <strong>{{ selectedPickerIds.length }}</strong> · 当前页 {{ pickerRows.length }} · 共 {{ pickerType === 'scene' ? sceneCandidates.length : caseCandidates.length }}</p><div><button type="button" @click="pickerType = null">取消</button><button :disabled="!selectedPickerIds.length" type="button" @click="addPickerItems">添加{{ selectedPickerIds.length ? ` (${selectedPickerIds.length})` : '' }}</button></div></footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.figma-suite { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; background:#f4f6fa; color:#1d2129; font-family:var(--app-font-family); }
button,input,select { font-family:inherit; }
button { cursor:pointer; }
.figma-suite__tabs { display:flex; box-sizing:border-box; height:38px; flex:0 0 38px; align-items:center; gap:0; padding:0 7px; border-bottom:1px solid #e5e6eb; background:#fff; }
.figma-suite__tabs > button:first-child,.figma-suite__opened-tabs button { display:inline-flex; box-sizing:border-box; height:25px; align-items:center; gap:5.25px; padding:0 10.5px; border:0; border-radius:5px; background:transparent; color:#86909c; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__tabs > button.is-active,.figma-suite__opened-tabs button.is-active { background:#e8f3ff; color:#165dff; }
.figma-suite__tabs > i { width:1px; height:14px; flex:0 0 1px; margin-left:3.5px; background:#e5e6eb; }
.figma-suite__opened-tabs { display:flex; min-width:0; flex:1; align-items:center; gap:2px; padding:0 3.5px; overflow-x:auto; scrollbar-width:none; }
.figma-suite__opened-tabs.is-empty { flex:0 0 0; }
.figma-suite__opened-tabs button { max-width:190px; }
.figma-suite__opened-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.figma-suite__tab-close { display:inline-flex; width:14px; height:14px; flex:0 0 14px; align-items:center; justify-content:center; border-radius:3.5px; opacity:0; transition:opacity .15s,background-color .15s; }
.figma-suite__opened-tabs button:hover .figma-suite__tab-close { opacity:1; }
.figma-suite__tab-close:hover { background:rgba(190,218,255,.6); }
.figma-suite__tab-close svg { width:10px; height:10px; }
.figma-suite__new-tab { display:inline-flex; width:24.5px; height:24.5px; flex:0 0 24.5px; align-items:center; justify-content:center; padding:0; border:0; border-radius:5.25px; background:transparent; color:#86909c; }
.figma-suite__new-tab:hover { background:#f2f3f5; }
.figma-suite__new-tab svg { width:14px; height:14px; }
.figma-suite__list-view { display:flex; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.figma-suite__toolbar { display:flex; box-sizing:border-box; height:54px; flex:0 0 54px; align-items:center; gap:7px; padding:0 14px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; }
.figma-suite__toolbar > span { flex:1; }
.figma-suite__search { display:flex; box-sizing:border-box; width:220px; height:28px; align-items:center; border:1px solid #e5e6eb; border-radius:7px; background:#fff; }
.figma-suite__search svg { width:13px; height:13px; flex:0 0 13px; margin-left:7.75px; color:#86909c; }
.figma-suite__search input { min-width:0; width:100%; height:100%; padding:0 10px 0 7px; border:0; outline:0; background:transparent; color:#1d2129; font-size:12px; }
.figma-suite__search input::placeholder { color:rgba(29,33,41,.5); opacity:1; }
.figma-suite__filter-select { position:relative; display:block; box-sizing:border-box; width:120px; height:24.5px; flex:0 0 120px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; }
.figma-suite__filter-select select { box-sizing:border-box; width:100%; height:100%; padding:0 26px 0 8px; border:0; border-radius:inherit; outline:0; appearance:none; background:transparent; color:#4e5969; font-size:12px; line-height:18px; }
.figma-suite__filter-select > svg { position:absolute; top:50%; right:7px; width:12px; height:12px; color:#86909c; pointer-events:none; transform:translateY(-50%); }
.figma-suite__primary { display:inline-flex; box-sizing:border-box; width:98.25px; height:32px; align-items:center; justify-content:center; gap:5.25px; padding:0; border:0; border-radius:7px; background:#165dff; color:#fff; font-size:13px; font-weight:500; line-height:19.5px; }
.figma-suite__primary svg { width:13px; height:13px; }
.figma-suite__table-wrap { min-height:0; flex:1; overflow:auto; background:#f4f6fa; }
.figma-suite__table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }
.figma-suite__table col:nth-child(1) { width:34.7%; }.figma-suite__table col:nth-child(2) { width:8.225%; }.figma-suite__table col:nth-child(3) { width:9.766%; }.figma-suite__table col:nth-child(4) { width:8.225%; }.figma-suite__table col:nth-child(5) { width:9.766%; }.figma-suite__table col:nth-child(6) { width:23.55%; }.figma-suite__table col:nth-child(7) { width:5.768%; }
.figma-suite__table th { box-sizing:border-box; height:36px; padding:0 14px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; color:#86909c; font-size:12px; font-weight:500; line-height:18px; text-align:left; }
.figma-suite__table th:last-child { text-align:right; }
.figma-suite__table td { box-sizing:border-box; height:60px; padding:8px 14px; border-bottom:1px solid #e5e6eb; color:#4e5969; line-height:18px; vertical-align:middle; }
.figma-suite__table tbody tr { background:#fff; }
.figma-suite__table tbody tr:nth-child(even) { background:#fafbfe; }
.figma-suite__table tbody tr:hover { background:#f7faff; }
.figma-suite__table td:first-child { padding:10.5px 14px; vertical-align:top; }
.figma-suite__table td:first-child button { display:block; max-width:100%; overflow:hidden; padding:0; border:0; background:transparent; color:#165dff; font-size:14px; font-weight:600; line-height:21px; text-align:left; text-overflow:ellipsis; white-space:nowrap; }
.figma-suite__table td:first-child small { display:block; width:max-content; max-width:100%; overflow:hidden; margin-top:1.75px; color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; text-overflow:ellipsis; white-space:nowrap; }
.is-mono { font-family:"JetBrains Mono",Consolas,monospace!important; font-size:11px!important; }
.figma-suite__priority { position:relative; top:-.25px; display:inline-flex; box-sizing:border-box; width:24.86px; height:17.5px; align-items:center; justify-content:center; padding:0 5.25px; border-radius:3.5px; font-size:11px; font-weight:700; line-height:16.5px; }
.figma-suite__priority.is-p0,.figma-suite__priority-field.is-p0 { border-color:#f53f3f; background:#ffeeee; color:#f53f3f; }.figma-suite__priority.is-p1,.figma-suite__priority-field.is-p1 { border-color:#ff7d00; background:#fff3e8; color:#ff7d00; }.figma-suite__priority.is-p2,.figma-suite__priority-field.is-p2 { border-color:#165dff; background:#e8f3ff; color:#165dff; }.figma-suite__priority.is-p3,.figma-suite__priority-field.is-p3 { border-color:#86909c; background:#f2f3f5; color:#86909c; }
.figma-suite__status { display:inline-flex; align-items:center; gap:5.25px; color:#86909c; font-size:12px; font-weight:500; line-height:18px; white-space:nowrap; }.figma-suite__status i { width:5.25px; height:5.25px; flex:0 0 5.25px; border-radius:50%; background:currentColor; }.figma-suite__status.is-pass { color:#00b42a; }.figma-suite__status.is-fail { color:#f53f3f; }.figma-suite__status.is-running { color:#165dff; }.figma-suite__status.is-empty { color:#c9cdd4; }
.figma-suite__table td:nth-child(5) > .figma-suite__status { position:relative; top:-.6875px; width:100%; }
.figma-suite__last-date { color:#86909c!important; font-size:11px!important; line-height:16.5px!important; }
.figma-suite__row-actions { display:flex; justify-content:flex-end; gap:2px; opacity:0; }.figma-suite__table tr:hover .figma-suite__row-actions { opacity:1; }.figma-suite__row-actions button,.figma-suite__results td:last-child button { display:inline-flex; box-sizing:border-box; width:24px; height:24px; flex:0 0 24px; align-items:center; justify-content:center; padding:0; border:0; border-radius:6px; background:transparent; color:#86909c; }.figma-suite__row-actions button:hover,.figma-suite__results td:last-child button:hover { background:#f2f3f5; color:#4e5969; opacity:.8; }.figma-suite__row-actions button:last-child:hover { background:#ffeeee; color:#f53f3f; }.figma-suite__row-actions svg,.figma-suite__results td:last-child svg { width:13px; height:13px; flex:0 0 13px; }
.figma-suite__empty { margin:80px 0; color:#86909c; font-size:13px; text-align:center; }
.figma-suite__editor { display:flex; min-width:0; min-height:0; flex:1; overflow:hidden; }.figma-suite__editor-main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.figma-suite__subtabs { display:flex; box-sizing:border-box; height:38px; flex:0 0 38px; align-items:flex-start; padding:0 14px 1px; border-bottom:1px solid #e5e6eb; background:#fff; }.figma-suite__subtabs button { box-sizing:border-box; height:37px; padding:0 14px 2px; border:0; border-bottom:2px solid transparent; background:transparent; color:#86909c; font-size:12px; font-weight:500; line-height:18px; white-space:nowrap; }.figma-suite__subtabs button:first-child { width:72px; }.figma-suite__subtabs button:nth-child(2) { width:76px; }.figma-suite__subtabs button.is-active { border-bottom-color:#165dff; color:#165dff; }
.figma-suite__suite-info { box-sizing:border-box; height:64.5px; flex:0 0 64.5px; padding:10.5px 14px 11.5px; border-bottom:1px solid #e5e6eb; background:#fafbfe; }.figma-suite__suite-info > div { display:flex; height:21px; align-items:center; gap:7px; }.figma-suite__priority-field { position:relative; display:block; box-sizing:border-box; width:51px; height:21px; flex:0 0 51px; border:1px solid; border-radius:3.5px; }.figma-suite__priority-select { width:100%; height:100%; padding:0 15px 0 5.25px; border:0; border-radius:inherit; outline:0; appearance:none; background:transparent; color:inherit; font-size:11px; font-weight:700; line-height:16.5px; }.figma-suite__priority-field > svg { position:absolute; top:50%; right:3.5px; width:8px; height:8px; color:inherit; pointer-events:none; transform:translateY(-50%); }.figma-suite__name { display:inline-flex; min-width:0; height:21px; align-items:center; gap:5.25px; padding:0; border:0; background:transparent; color:#1d2129; font-size:14px; font-weight:600; line-height:21px; }.figma-suite__name svg { width:12px; height:12px; color:#86909c; }.figma-suite__name-input { width:360px; height:21px; padding:0 3px; border:0; border-bottom:1px solid #165dff; outline:0; background:transparent; color:#1d2129; font-size:14px; font-weight:600; line-height:21px; }.figma-suite__suite-info p { box-sizing:border-box; height:21.5px; margin:0; padding-top:3.5px; color:#86909c; font-size:12px; line-height:18px; }
.figma-suite__arrange-toolbar { display:flex; box-sizing:border-box; height:39.5px; flex:0 0 39.5px; align-items:center; justify-content:space-between; padding:7px 14px 8px; border-bottom:1px solid #e5e6eb; background:#fff; }.figma-suite__arrange-toolbar > p,.figma-suite__arrange-toolbar > div { position:relative; top:.5px; }.figma-suite__arrange-toolbar p { margin:0; color:#4e5969; font-size:12px; line-height:18px; }.figma-suite__arrange-toolbar strong { color:#1d2129; font-weight:700; }.figma-suite__arrange-toolbar div { display:flex; gap:7px; }.figma-suite__arrange-toolbar button,.figma-suite__arrange-empty button { display:inline-flex; box-sizing:border-box; height:24.5px; align-items:center; gap:5.25px; padding:0 10.5px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }.figma-suite__arrange-toolbar svg,.figma-suite__arrange-empty button svg { width:12px; height:12px; }
.figma-suite__items { min-height:0; flex:1; overflow-x:hidden; overflow-y:auto; padding:7px 10.5px; background:#fafbfe; }.figma-suite__items article { position:relative; display:flex; box-sizing:border-box; height:44px; align-items:center; gap:7px; margin-bottom:5.25px; padding:10.5px; border:1px solid #e5e6eb; border-radius:11px; background:#fff; transition:box-shadow .15s; }.figma-suite__items article:hover { box-shadow:0 1px 2px rgba(0,0,0,.05); }.figma-suite__drag { width:14px; height:14px; flex:0 0 14px; color:#c9cdd4; cursor:grab; }.figma-suite__index { width:17.5px; flex:0 0 17.5px; color:#c9cdd4; font-size:11px; line-height:16.5px; text-align:center; }.figma-suite__type,.figma-suite__method { display:inline-flex; box-sizing:border-box; height:18.5px; align-items:center; justify-content:center; padding:0 5.25px; border-radius:3.5px; font-size:10px; font-weight:700; line-height:15px; white-space:nowrap; }.figma-suite__type.is-api { background:#e8f3ff; color:#165dff; }.figma-suite__type.is-scene { background:#e8ffea; color:#00b42a; }.figma-suite__method { width:49px; padding:0; }.figma-suite__method.is-get { background:#e8ffea; color:#00b42a; }.figma-suite__method.is-post { background:#e8f3ff; color:#165dff; }.figma-suite__method.is-put { background:#fff3e8; color:#ff7d00; }.figma-suite__method.is-delete { background:#ffeeee; color:#f53f3f; }.figma-suite__method.is-patch { background:#f5e8ff; color:#7816ff; }.figma-suite__items article p { min-width:0; height:19.5px; flex:1; overflow:hidden; margin:0; color:#1d2129; font-size:13px; font-weight:500; line-height:19.5px; text-overflow:ellipsis; white-space:nowrap; }.figma-suite__items code,.figma-suite__items article small { overflow:hidden; flex:0 1 auto; color:#86909c; font:400 11px/16.5px "JetBrains Mono",Consolas,monospace; text-overflow:ellipsis; white-space:nowrap; }.figma-suite__items article > div { display:flex; flex:0 0 76px; align-items:center; gap:2px; opacity:0; transition:opacity .15s; }.figma-suite__items article:hover > div { opacity:1; }.figma-suite__items article > div button { display:inline-flex; width:24px; height:24px; align-items:center; justify-content:center; padding:0; border:0; border-radius:6px; background:transparent; color:#86909c; }.figma-suite__items article > div button:hover { background:#f2f3f5; color:#4e5969; }.figma-suite__items article > div button:last-child:hover { background:#ffeeee; color:#f53f3f; }.figma-suite__items article > div button:disabled { cursor:not-allowed; opacity:.3; }.figma-suite__items article > div svg { width:13px; height:13px; }.figma-suite__arrange-empty { display:flex; height:220px; flex-direction:column; align-items:center; justify-content:center; color:#86909c; }.figma-suite__arrange-empty > svg { width:32px; height:32px; color:#c9cdd4; }.figma-suite__arrange-empty p { margin:10px 0 12px; font-size:13px; }.figma-suite__arrange-empty div { display:flex; gap:8px; }
.figma-suite__config { box-sizing:border-box; width:220px; flex:0 0 220px; overflow-x:hidden; overflow-y:auto; border-left:1px solid #e5e6eb; background:#fafbfe; }
.figma-suite__config > header { box-sizing:border-box; height:81.5px; padding:10.5px 10.5px 11.5px; border-bottom:1px solid #e5e6eb; }
.figma-suite__select-shell { position:relative; display:block; box-sizing:border-box; width:100%; height:24.5px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; }
.figma-suite__select-shell select { box-sizing:border-box; width:100%; height:100%; padding:0 24px 0 8px; border:0; border-radius:inherit; outline:0; appearance:none; background:transparent; color:#1d2129; font-size:12px; line-height:18px; }
.figma-suite__select-shell > svg { position:absolute; top:50%; right:7px; width:10px; height:10px; color:#86909c; pointer-events:none; transform:translateY(-50%); }
.figma-suite__config > header > div { display:flex; gap:7px; margin-top:7px; }
.figma-suite__config > header button { display:inline-flex; box-sizing:border-box; height:28px; align-items:center; justify-content:center; gap:5.25px; padding:0; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__config > header button:first-child { width:94.5px; flex:0 0 94.5px; border-color:#165dff; background:#165dff; color:#fff; font-weight:600; }
.figma-suite__config > header button:last-child { width:96.5px; flex:0 0 96.5px; }
.figma-suite__config > header button svg { width:12px; height:12px; }
.figma-suite__config-body { box-sizing:border-box; height:282px; padding:10.5px; color:#4e5969; font-size:12px; }
.figma-suite__config-field { width:198px; }
.figma-suite__config-field > span { display:block; box-sizing:border-box; height:21.5px; padding-bottom:3.5px; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__config-field.is-module { height:46px; }
.figma-suite__config-field.is-location { height:56.5px; padding-top:10.5px; }
.figma-suite__config-body em { color:#f53f3f; font-style:normal; }
.figma-suite__config fieldset { box-sizing:border-box; width:198px; height:51.75px; margin:0; padding:10.5px 0 0; border:0; }
.figma-suite__config legend { height:18px; margin:0; padding:0; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; transform:translateY(10.5px); }
.figma-suite__radio-row { display:flex; box-sizing:border-box; height:23.25px; align-items:flex-start; gap:10.5px; padding-top:5.25px; }
.figma-suite__config fieldset label { display:inline-flex; height:18px; align-items:center; gap:5.25px; color:#1d2129; font-size:12px; font-weight:500; line-height:18px; cursor:pointer; }
.figma-suite__radio-input { box-sizing:border-box; width:13px; height:13px; flex:0 0 13px; margin:0; appearance:auto; accent-color:#155dfc; }
.figma-suite__runners input[type="radio"] { position:relative; box-sizing:border-box; width:13px; height:13px; flex:0 0 13px; margin:0; border:1px solid #767676; border-radius:50%; appearance:none; background:#fff; }
.figma-suite__runners input[type="radio"]:checked { border-color:#155dfc; }
.figma-suite__runners input[type="radio"]:checked::after { position:absolute; top:1.5px; left:1.5px; width:8px; height:8px; border-radius:50%; background:#155dfc; content:""; }
.figma-suite__runners { padding:8px 10px; margin:0 0 10.5px; border:1px solid #e5e6eb; border-radius:10px; }.figma-suite__runners label { display:flex; align-items:center; gap:8px; padding:4px 0; }.figma-suite__runners i { width:6px; height:6px; border-radius:50%; background:#c9cdd4; }.figma-suite__runners i.is-online { background:#00b42a; }.figma-suite__runners label > span { min-width:0; flex:1; }.figma-suite__runners b,.figma-suite__runners small { display:block; }.figma-suite__runners b { color:#1d2129; font-size:11px; font-weight:500; }.figma-suite__runners small { color:#86909c; font-size:10px; }
.figma-suite__notify { display:flex; box-sizing:border-box; width:198px; height:28.5px; align-items:flex-end; justify-content:space-between; padding-top:10.5px; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__notify button { position:relative; width:28px; height:16px; flex:0 0 28px; padding:0; border:0; border-radius:8px; background:#c9cdd4; }.figma-suite__notify button.is-on { background:#165dff; }.figma-suite__notify button i { position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#fff; transition:left .15s; }.figma-suite__notify button.is-on i { left:14px; }
.figma-suite__last-run { box-sizing:border-box; height:67.75px; margin-top:10.5px; padding-top:10.5px; border-top:1px solid #e5e6eb; }
.figma-suite__last-run p { height:18px; margin:0; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__last-run > .figma-suite__status { box-sizing:border-box; width:100%; height:21.5px; padding-top:3.5px; }
.figma-suite__last-run > small { display:block; box-sizing:border-box; width:100%; height:16.75px; margin:0; padding-top:1.75px; color:#c9cdd4; font-size:10px; line-height:15px; }
.figma-suite__results,.figma-suite__result-detail { min-height:0; flex:1; overflow:auto; padding:20px; }.figma-suite__results > header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }.figma-suite__results > header strong { display:block; height:20px; font-size:13px; font-weight:600; line-height:19.5px; }.figma-suite__results > header button,.figma-suite__result-detail > button { display:inline-flex; height:28px; align-items:center; gap:6px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; color:#4e5969; font-size:12px; }.figma-suite__results > header svg,.figma-suite__result-detail > button svg { width:12px; height:12px; }.figma-suite__results table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }.figma-suite__results th { height:37px; padding:0 16px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; color:#86909c; font-weight:500; text-align:left; }.figma-suite__results td { height:43px; padding:0 16px; border-bottom:1px solid #e5e6eb; color:#4e5969; }.figma-suite__results tbody tr:nth-child(even) { background:#fafbfe; }.is-pass { color:#00b42a!important; }.is-fail { color:#f53f3f!important; }.is-zero { color:#c9cdd4!important; }.is-primary { color:#165dff!important; }
.figma-suite__summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0 20px; }.figma-suite__summary article { padding:14px 16px; border:1px solid #e5e6eb; border-radius:10px; background:#fff; }.figma-suite__summary small,.figma-suite__summary strong { display:block; }.figma-suite__summary small { color:#86909c; font-size:11px; }.figma-suite__summary strong { margin-top:4px; color:#86909c; font-size:22px; font-weight:700; }.figma-suite__result-meta { display:flex; gap:16px; margin:0 0 16px; color:#86909c; font-size:12px; }.figma-suite__result-meta b { font-weight:600; }.figma-suite__result-items { display:grid; gap:8px; }.figma-suite__result-items article { overflow:hidden; border:1px solid #e5e6eb; border-radius:10px; }.figma-suite__result-items header { display:flex; height:42px; align-items:center; gap:10px; padding:0 14px; background:#fff; }.figma-suite__result-items header > svg:first-child { width:16px; height:16px; color:#00b42a; }.figma-suite__result-items article:nth-child(2) header > svg:first-child { color:#f53f3f; }.figma-suite__result-items header b { padding:2px 6px; border-radius:4px; background:#e8f3ff; color:#165dff; font-size:10px; }.figma-suite__result-items article:nth-child(2) header b { background:#e8ffea; color:#00b42a; }.figma-suite__result-items header strong { flex:1; font-size:13px; font-weight:500; }.figma-suite__result-items header span { color:#86909c; font-size:11px; }.figma-suite__result-items header svg { width:14px; height:14px; color:#86909c; }.figma-suite__result-items article:nth-child(2) > div { border-top:1px solid #e5e6eb; background:#f4f6fa; }.figma-suite__result-items article:nth-child(2) > div > p { display:flex; align-items:flex-start; gap:8px; margin:0; padding:9px 14px; border-bottom:1px solid #e5e6eb; color:#f53f3f; font-size:12px; }.figma-suite__result-items article:nth-child(2) > div > p svg { width:13px; height:13px; }.figma-suite__result-items article:nth-child(2) > div > div { display:grid; height:32px; grid-template-columns:18px minmax(0,1fr) 40px 48px 24px; align-items:center; gap:8px; padding:0 24px; border-bottom:1px solid #e5e6eb; color:#4e5969; font-size:11px; }.figma-suite__result-items article:nth-child(2) > div > div > svg { width:12px; height:12px; color:#00b42a; }.figma-suite__result-items article:nth-child(2) > div > div:last-child > svg { color:#f53f3f; }.figma-suite__result-items code,.figma-suite__result-items small { color:#86909c; font-size:10px; }.figma-suite__result-items article:nth-child(2) > div > div button { display:inline-flex; width:22px; height:22px; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:#86909c; }.figma-suite__result-items article:nth-child(2) > div > div button svg { width:12px; height:12px; }
.figma-suite__overlay { position:fixed; z-index:2000; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.36); }
.figma-suite__dialog { display:flex; box-sizing:border-box; width:680px; height:533.5px; max-height:82vh; flex-direction:column; overflow:hidden; border-radius:14px; background:#fff; box-shadow:0 25px 50px -12px rgba(0,0,0,.25); }
.figma-suite__dialog.is-scene { height:493.5px; }
.figma-suite__dialog > header { display:flex; box-sizing:border-box; height:53.5px; flex:0 0 53.5px; align-items:center; justify-content:space-between; padding:0 17.5px; border-bottom:1px solid #e5e6eb; }
.figma-suite__dialog > header strong { color:#1d2129; font-size:15px; font-weight:600; line-height:22.5px; }
.figma-suite__dialog > header button { display:inline-flex; width:24.5px; height:24.5px; align-items:center; justify-content:center; padding:0; border:0; border-radius:5px; background:transparent; color:#86909c; }
.figma-suite__dialog > header button:hover { background:#f2f3f5; }
.figma-suite__dialog > header svg { width:15px; height:15px; }
.figma-suite__dialog-tools { display:flex; box-sizing:border-box; height:43px; flex:0 0 43px; align-items:center; gap:7px; padding:0 14px; border-bottom:1px solid #e5e6eb; }
.figma-suite__dialog-tools select { box-sizing:border-box; width:120px; height:24.5px; padding:0 7px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#4e5969; font-size:12px; line-height:18px; }
.figma-suite__dialog-tools select:nth-child(2) { width:80px; }
.figma-suite__dialog-tools label { position:relative; display:flex; min-width:0; height:24.5px; flex:1; align-items:center; border:1px solid #e5e6eb; border-radius:7px; }
.figma-suite__dialog-tools label svg { position:absolute; top:6.25px; left:7px; width:12px; height:12px; color:#86909c; }
.figma-suite__dialog-tools input { box-sizing:border-box; min-width:0; width:100%; height:100%; padding:1px 11.5px 1px 25.5px; border:0; outline:0; background:transparent; color:#1d2129; font-size:12px; font-weight:400; line-height:normal; }
.figma-suite__dialog-tools input::placeholder { color:rgba(29,33,41,.5); }
.figma-suite__dialog-table { min-height:0; flex:1; overflow:auto; }
.figma-suite__dialog-table table { width:680px; border-collapse:collapse; table-layout:fixed; font-size:12px; }
.figma-suite__dialog-table th { box-sizing:border-box; height:32.5px; padding:0 7px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; color:#86909c; font-size:12px; font-weight:500; line-height:18px; text-align:left; white-space:nowrap; }
.figma-suite__dialog-table th:first-child,.figma-suite__dialog-table td:first-child { position:relative; padding:0 14px; }
.figma-suite__dialog-table td { box-sizing:border-box; height:36.5px; padding:0 7px; border-bottom:1px solid #e5e6eb; color:#4e5969; font-size:12px; font-weight:400; line-height:18px; white-space:nowrap; }
.figma-suite__dialog-table tbody tr:nth-child(even) { background:rgba(244,246,250,.5); }
.figma-suite__dialog-table tbody tr:not(.is-disabled) { cursor:pointer; }
.figma-suite__dialog-table tr.is-disabled { opacity:.5; }
.figma-suite__dialog-table td:first-child span { display:inline-flex; padding:1.75px 5.25px; border-radius:3.5px; background:#f2f3f5; color:#86909c; font-size:10px; line-height:15px; }
.figma-suite__dialog-table input[type="checkbox"] { box-sizing:border-box; width:13px; height:13px; margin:0; border-radius:2px; accent-color:#165dff; vertical-align:middle; }
.figma-suite__dialog-table th:first-child input[type="checkbox"],.figma-suite__dialog-table td:first-child input[type="checkbox"] { position:absolute; left:14px; }
.figma-suite__dialog-table th:first-child input[type="checkbox"] { top:7px; }
.figma-suite__dialog-table td:first-child input[type="checkbox"] { top:8.75px; }
.figma-suite__dialog-table strong { color:#1d2129; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__picker-id { color:#86909c!important; font:400 12px/18px "JetBrains Mono",Consolas,monospace!important; }
.figma-suite__picker-path { color:#4e5969!important; font:400 11px/16.5px "JetBrains Mono",Consolas,monospace!important; }
.figma-suite__picker-method { display:inline-flex; width:max-content; height:15.5px; align-items:center; justify-content:center; padding:0; border-radius:3.5px; font-size:10px; font-weight:700; line-height:15px; }
.figma-suite__picker-method.is-get { background:#e8ffea; color:#00b42a; }.figma-suite__picker-method.is-post { background:#e8f3ff; color:#165dff; }.figma-suite__picker-method.is-put { background:#fff3e8; color:#ff7d00; }.figma-suite__picker-method.is-delete { background:#fee; color:#f53f3f; }.figma-suite__picker-method.is-patch { background:#f5e8ff; color:#7816ff; }
.figma-suite__picker-status { display:inline-flex; height:18px; align-items:center; gap:5.25px; font-size:12px; font-weight:500; line-height:18px; }.figma-suite__picker-status i { width:5.25px; height:5.25px; flex:0 0 5.25px; border-radius:50%; background:currentColor; }.figma-suite__picker-status.is-pass { color:#00b42a; }.figma-suite__picker-status.is-fail { color:#f53f3f; }.figma-suite__picker-status.is-running { color:#165dff; }
.figma-suite__picker-empty-status { color:#c9cdd4; font-size:11px; font-weight:400; line-height:16.5px; }
.figma-suite__dialog > footer { display:flex; box-sizing:border-box; height:54px; flex:0 0 54px; align-items:center; justify-content:space-between; padding:0 14px; border-top:1px solid #e5e6eb; }
.figma-suite__dialog > footer p { margin:0; color:#86909c; font-size:12px; font-weight:400; line-height:18px; }
.figma-suite__dialog > footer p strong { color:#165dff; font-weight:700; }
.figma-suite__dialog > footer div { display:flex; height:32px; align-items:flex-start; gap:7px; }
.figma-suite__dialog > footer button { display:inline-flex; box-sizing:border-box; align-items:center; justify-content:center; border-radius:7px; font-weight:500; }
.figma-suite__dialog > footer button:first-child { width:47px; height:24.5px; padding:0; border:1px solid #e5e6eb; background:#fff; color:#4e5969; font-size:12px; line-height:18px; white-space:nowrap; }
.figma-suite__dialog > footer button:last-child { min-width:54px; height:32px; padding:0 14px; border:0; background:#165dff; color:#fff; font-size:13px; line-height:19.5px; }
.figma-suite__dialog > footer button:disabled { cursor:not-allowed; opacity:.5; }
/* Figma 226:3347: result content starts on a 17.5px inset grid. */
.figma-suite__results,.figma-suite__result-detail { padding:17.5px; }
.figma-suite__results > header { box-sizing:border-box; height:24.5px; margin-bottom:14px; }
.figma-suite__results > header button,.figma-suite__result-detail > button { box-sizing:border-box; height:24.5px; gap:5.25px; padding:0 11.5px; border-radius:7px; }
.figma-suite__results > header button { width:64.25px; padding:0 10.5px; font-weight:500; line-height:18px; }
.figma-suite__results th { height:36px; padding:0 14px; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__results th:last-child { text-align:right; }
.figma-suite__results td { height:43px; padding:0 14px; font-size:12px; font-weight:400; line-height:18px; vertical-align:middle; }
.figma-suite__results td.is-mono { line-height:16.5px; }
.figma-suite__result-total { color:#86909c; font-weight:400; }
.figma-suite__results td:nth-child(7) > .figma-suite__status { position:relative; top:-.359375px; width:100%; vertical-align:middle; }
.figma-suite__results td:last-child button { width:21px; height:21px; flex:0 0 21px; border-radius:5px; vertical-align:middle; }

/* The shared table keeps the Figma 226:661 suite-list measurements page-scoped. */
.figma-suite__table-wrap :deep(.app-figma-table) { min-width:960px; border:0; border-radius:0; box-shadow:none; }
.figma-suite :deep(.figma-suite__data-table) {
  --app-figma-table-header-background:#f4f6fa;
  --app-figma-table-header-color:#86909c;
  --app-figma-table-header-font-size:12px;
  --app-figma-table-header-font-weight:500;
  --app-figma-table-header-letter-spacing:0;
  --app-figma-table-header-line-height:18px;
  --app-figma-table-text-color:#4e5969;
  --app-figma-table-font-size:12px;
  --app-figma-table-line-height:18px;
  --app-figma-table-cell-padding:14px;
  --app-figma-table-row-hover-background:#f7faff;
  --app-figma-table-muted-color:#86909c;
  --app-figma-table-primary-color:#165dff;
  min-width:960px;
  font-family:var(--app-font-family);
}
.figma-suite :deep(.figma-suite__data-table .el-table__fixed-right-patch) { background:#f4f6fa; }
.figma-suite :deep(.figma-suite__data-table .el-table__body tr.is-alt > td.el-table__cell) { background:#fafbfe; }
.figma-suite :deep(.figma-suite__data-table .el-table__body tr:hover > td.el-table__cell) { background:#f7faff; }
.figma-suite :deep(.figma-suite__data-table .el-table__body tr) { cursor:pointer; }
.figma-suite :deep(.figma-suite__data-table .app-figma-action-column__actions button) { color:#86909c; }
.figma-suite :deep(.figma-suite__data-table .app-figma-table__empty) { padding:80px 0; }
.figma-suite__table-name { box-sizing:border-box; padding:10.5px 0 8px; }
.figma-suite__table-name button { display:block; max-width:100%; overflow:hidden; padding:0; border:0; background:transparent; color:#165dff; font-size:14px; font-weight:600; line-height:21px; text-align:left; text-overflow:ellipsis; white-space:nowrap; }
.figma-suite__table-name small { display:block; width:max-content; max-width:100%; overflow:hidden; margin-top:1.75px; color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; text-overflow:ellipsis; white-space:nowrap; }
.figma-suite__table-text,.figma-suite__table-extra { display:block; overflow:hidden; color:#4e5969; text-overflow:ellipsis; white-space:nowrap; }
.figma-suite__table-wrap .figma-suite__status { position:relative; top:-.6875px; }
.figma-suite__table-wrap .figma-suite__last-date { display:block; }
</style>
