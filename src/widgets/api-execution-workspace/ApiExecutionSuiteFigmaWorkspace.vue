<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
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
  { id: 's1', type: 'scene', name: '产品管理-新增编辑删除闭环', desc: '获客中心 · 10 个步骤' },
  { id: 's2', type: 'scene', name: '用户注册登录完整流程', desc: '用户中心 · 6 个步骤' },
  { id: 's3', type: 'scene', name: '订单全链路压测场景', desc: '订单中心 · 5 个步骤' },
  { id: 's4', type: 'scene', name: '权限校验场景', desc: '权限中心 · 4 个步骤' },
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

const activeSuite = computed(() => suites.value.find(item => item.id === activeTab.value) || null)
const visibleSuites = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return suites.value.filter((suite) => {
    const matchesKeyword = !search || suite.name.toLowerCase().includes(search) || suite.desc.toLowerCase().includes(search)
    const matchesModule = moduleFilter.value === '全部' || suite.module === moduleFilter.value
    return matchesKeyword && matchesModule
  })
})
const pickerRows = computed(() => {
  const rows = pickerType.value === 'scene' ? sceneCandidates : caseCandidates
  const search = pickerKeyword.value.trim().toLowerCase()
  return rows.filter(item => !search || item.name.toLowerCase().includes(search))
})
const activeItemIds = computed(() => new Set(activeSuite.value?.items.map(item => item.id) || []))

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

      <div class="figma-suite__table-wrap">
        <table class="figma-suite__table">
          <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
          <thead><tr><th>套件名称</th><th>优先级</th><th>所属模块</th><th>编排项</th><th>最近结果</th><th>最近运行</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="suite in visibleSuites" :key="suite.id" @click="openSuite(suite.id)">
              <td><button type="button" @click.stop="openSuite(suite.id)">{{ suite.name }}</button><small>{{ suite.desc }}</small></td>
              <td><b class="figma-suite__priority" :class="`is-${suite.priority.toLowerCase()}`">{{ suite.priority }}</b></td>
              <td>{{ suite.module }}</td>
              <td>{{ suite.items.length }} 项</td>
              <td><span class="figma-suite__status" :class="`is-${suite.lastResult || 'empty'}`"><i />{{ suite.lastResult === 'pass' ? '通过' : suite.lastResult === 'fail' ? '失败' : '未运行' }}</span></td>
              <td class="figma-suite__last-date is-mono">{{ suite.lastRun || '-' }}</td>
              <td><div class="figma-suite__row-actions"><button title="编辑" type="button" @click.stop="openSuite(suite.id)"><Edit2 /></button><button title="运行" type="button" @click.stop="runSuite"><Play /></button><button title="删除" type="button" @click.stop="deleteSuite(suite.id)"><Trash2 /></button></div></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!visibleSuites.length" class="figma-suite__empty">没有匹配的执行套件</p>
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
          <table><thead><tr><th>开始时间</th><th>环境</th><th>通过/总数</th><th>失败</th><th>耗时</th><th>执行人</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="record in runRecords" :key="record.id"><td class="is-mono">{{ record.startTime }}</td><td>{{ record.env }}</td><td><strong class="is-pass">{{ record.pass }}</strong> / {{ record.total }}</td><td><strong :class="record.fail ? 'is-fail' : 'is-zero'">{{ record.fail }}</strong></td><td class="is-mono">{{ record.duration }}</td><td>{{ record.operator }}</td><td><span class="figma-suite__status" :class="`is-${record.status}`"><i />{{ record.status === 'pass' ? '通过' : record.status === 'fail' ? '失败' : '运行中' }}</span></td><td><button title="查看详情" type="button" @click="selectedRunRecord = record"><Eye /></button></td></tr></tbody></table>
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
          <fieldset><legend>运行模式</legend><div class="figma-suite__radio-row"><label><input v-model="activeSuite.runMode" type="radio" value="serial" />串行</label><label><input v-model="activeSuite.runMode" type="radio" value="parallel" />并行</label></div></fieldset>
          <div class="figma-suite__config-field is-location"><span>运行于</span><label class="figma-suite__select-shell"><select v-model="activeSuite.runLocation"><option value="server">服务端执行</option><option value="runner">本地执行器</option></select><ChevronDown aria-hidden="true" /></label></div>
          <section v-if="activeSuite.runLocation === 'runner'" class="figma-suite__runners"><label><i class="is-online" /><span><b>Runner-主机A</b><small>runner-001 · 在线</small></span><input checked name="runner" type="radio" /></label><label><i /><span><b>Runner-主机B</b><small>runner-002 · 离线</small></span><input disabled name="runner" type="radio" /></label></section>
          <div class="figma-suite__notify"><span>运行通知</span><button :class="{ 'is-on': activeSuite.notify }" type="button" @click="activeSuite.notify = !activeSuite.notify"><i /></button></div>
          <section v-if="activeSuite.lastRun" class="figma-suite__last-run"><p>上次运行结果</p><span class="figma-suite__status" :class="`is-${activeSuite.lastResult}`"><i />{{ activeSuite.lastResult === 'pass' ? '通过' : '失败' }}</span><small>{{ activeSuite.lastRun }}</small></section>
        </div>
      </aside>
    </div>

    <div v-if="pickerType" class="figma-suite__overlay" @click.self="pickerType = null">
      <section class="figma-suite__dialog" :class="{ 'is-scene': pickerType === 'scene' }">
        <header><strong>{{ pickerType === 'scene' ? '添加场景' : '添加接口用例' }}</strong><button title="关闭" type="button" @click="pickerType = null"><X /></button></header>
        <div class="figma-suite__dialog-tools"><select><option>X-MAN</option></select><select v-if="pickerType === 'api'"><option>HTTP</option></select><label><Search /><input v-model="pickerKeyword" :placeholder="pickerType === 'scene' ? '搜索场景名称' : '搜索用例名称'" /></label></div>
        <div class="figma-suite__dialog-table"><table><thead><tr><th /><th>ID</th><th>{{ pickerType === 'scene' ? '场景名称' : '用例名称' }}</th><th v-if="pickerType === 'api'">方法</th><th v-if="pickerType === 'api'">请求路径</th><th>{{ pickerType === 'scene' ? '所属模块 / 步骤数' : '所属接口' }}</th><th>运行状态</th></tr></thead><tbody><tr v-for="item in pickerRows" :key="item.id" :class="{ 'is-disabled': activeItemIds.has(item.id) }" @click="togglePickerItem(item.id)"><td><span v-if="activeItemIds.has(item.id)">已在套件</span><input v-else :checked="selectedPickerIds.includes(item.id)" type="checkbox" /></td><td class="is-mono">{{ item.id }}</td><td><strong>{{ item.name }}</strong></td><td v-if="pickerType === 'api'"><b class="figma-suite__method" :class="`is-${item.method?.toLowerCase()}`">{{ item.method }}</b></td><td v-if="pickerType === 'api'" class="is-mono">{{ item.path }}</td><td>{{ item.desc }}</td><td><span class="figma-suite__status is-empty"><i />未运行</span></td></tr></tbody></table></div>
        <footer><p>已选 <strong>{{ selectedPickerIds.length }}</strong> · 当前页 {{ pickerRows.length }} · 共 {{ pickerType === 'scene' ? sceneCandidates.length : caseCandidates.length }}</p><div><button type="button" @click="pickerType = null">取消</button><button :disabled="!selectedPickerIds.length" type="button" @click="addPickerItems">添加{{ selectedPickerIds.length ? ` (${selectedPickerIds.length})` : '' }}</button></div></footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.figma-suite { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; background:#f4f6fa; color:#1d2129; font-family:Inter,"Noto Sans SC",sans-serif; }
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
.figma-suite__table td { box-sizing:border-box; height:61.25px; padding:8px 14px; border-bottom:1px solid #e5e6eb; color:#4e5969; line-height:18px; vertical-align:middle; }
.figma-suite__table tbody tr { background:#fff; }
.figma-suite__table tbody tr:nth-child(even) { background:#fafbfe; }
.figma-suite__table tbody tr:hover { background:#f7faff; }
.figma-suite__table td:first-child { padding:11px 14px; vertical-align:top; }
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
.figma-suite__items { min-height:0; flex:1; overflow-x:hidden; overflow-y:auto; padding:7px 10.5px; background:#fafbfe; }.figma-suite__items article { position:relative; display:flex; box-sizing:border-box; height:44px; align-items:center; gap:7px; margin-bottom:5.25px; padding:10.5px; border:1px solid #e5e6eb; border-radius:11px; background:#fff; transition:box-shadow .15s; }.figma-suite__items article:hover { box-shadow:0 1px 2px rgba(0,0,0,.05); }.figma-suite__drag { width:14px; height:14px; flex:0 0 14px; color:#c9cdd4; cursor:grab; }.figma-suite__index { width:17.5px; flex:0 0 17.5px; color:#c9cdd4; font-size:11px; line-height:16.5px; text-align:center; }.figma-suite__type,.figma-suite__method { display:inline-flex; box-sizing:border-box; height:18.5px; align-items:center; justify-content:center; padding:0 5.25px; border-radius:3.5px; font-size:10px; font-weight:700; line-height:15px; white-space:nowrap; }.figma-suite__type.is-api { background:#e8f3ff; color:#165dff; }.figma-suite__type.is-scene { background:#e8ffea; color:#00b42a; }.figma-suite__method { width:49px; padding:0; }.figma-suite__method.is-get { background:#e8ffea; color:#00b42a; }.figma-suite__method.is-post { background:#e8f3ff; color:#165dff; }.figma-suite__method.is-put { background:#fff3e8; color:#ff7d00; }.figma-suite__method.is-delete { background:#ffeeee; color:#f53f3f; }.figma-suite__method.is-patch { background:#f5e8ff; color:#7816ff; }.figma-suite__items article p { min-width:0; height:19.5px; flex:1; overflow:hidden; margin:0; color:#1d2129; font-size:13px; font-weight:500; line-height:19.5px; text-overflow:ellipsis; white-space:nowrap; }.figma-suite__items code,.figma-suite__items article small { overflow:hidden; color:#86909c; font:400 11px/16.5px "JetBrains Mono",Consolas,monospace; text-overflow:ellipsis; white-space:nowrap; }.figma-suite__items article > div { position:absolute; top:50%; right:11.5px; display:flex; gap:2px; padding-left:8px; background:#fff; opacity:0; transform:translateY(-50%); }.figma-suite__items article:hover > div { opacity:1; }.figma-suite__items article > div button { display:inline-flex; width:24px; height:24px; align-items:center; justify-content:center; padding:0; border:0; border-radius:6px; background:transparent; color:#86909c; }.figma-suite__items article > div button:hover { background:#f2f3f5; color:#4e5969; }.figma-suite__items article > div button:last-child:hover { background:#ffeeee; color:#f53f3f; }.figma-suite__items article > div button:disabled { cursor:not-allowed; opacity:.3; }.figma-suite__items article > div svg { width:13px; height:13px; }.figma-suite__arrange-empty { display:flex; height:220px; flex-direction:column; align-items:center; justify-content:center; color:#86909c; }.figma-suite__arrange-empty > svg { width:32px; height:32px; color:#c9cdd4; }.figma-suite__arrange-empty p { margin:10px 0 12px; font-size:13px; }.figma-suite__arrange-empty div { display:flex; gap:8px; }
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
.figma-suite__config legend { height:18px; margin:0; padding:0; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__radio-row { display:flex; box-sizing:border-box; height:23.25px; align-items:flex-start; gap:10.5px; padding-top:5.25px; }
.figma-suite__config fieldset label { display:inline-flex; height:18px; align-items:center; gap:5.25px; color:#1d2129; font-size:12px; font-weight:500; line-height:18px; cursor:pointer; }
.figma-suite__config input[type="radio"] { position:relative; box-sizing:border-box; width:13px; height:13px; flex:0 0 13px; margin:0; border:1px solid #767676; border-radius:50%; appearance:none; background:#fff; }
.figma-suite__config input[type="radio"]:checked { border-color:#155dfc; }
.figma-suite__config input[type="radio"]:checked::after { position:absolute; top:1.5px; left:1.5px; width:8px; height:8px; border-radius:50%; background:#165dff; content:""; }
.figma-suite__runners { padding:8px 10px; margin:0 0 10.5px; border:1px solid #e5e6eb; border-radius:10px; }.figma-suite__runners label { display:flex; align-items:center; gap:8px; padding:4px 0; }.figma-suite__runners i { width:6px; height:6px; border-radius:50%; background:#c9cdd4; }.figma-suite__runners i.is-online { background:#00b42a; }.figma-suite__runners label > span { min-width:0; flex:1; }.figma-suite__runners b,.figma-suite__runners small { display:block; }.figma-suite__runners b { color:#1d2129; font-size:11px; font-weight:500; }.figma-suite__runners small { color:#86909c; font-size:10px; }
.figma-suite__notify { display:flex; box-sizing:border-box; width:198px; height:28.5px; align-items:flex-end; justify-content:space-between; padding-top:10.5px; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__notify button { position:relative; width:28px; height:16px; flex:0 0 28px; padding:0; border:0; border-radius:8px; background:#c9cdd4; }.figma-suite__notify button.is-on { background:#165dff; }.figma-suite__notify button i { position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#fff; transition:left .15s; }.figma-suite__notify button.is-on i { left:14px; }
.figma-suite__last-run { box-sizing:border-box; height:67.75px; margin-top:10.5px; padding-top:10.5px; border-top:1px solid #e5e6eb; }
.figma-suite__last-run p { height:18px; margin:0; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.figma-suite__last-run > .figma-suite__status { box-sizing:border-box; width:100%; height:21.5px; padding-top:3.5px; }
.figma-suite__last-run > small { display:block; box-sizing:border-box; width:100%; height:16.75px; margin:0; padding-top:1.75px; color:#c9cdd4; font-size:10px; line-height:15px; }
.figma-suite__results,.figma-suite__result-detail { min-height:0; flex:1; overflow:auto; padding:20px; }.figma-suite__results > header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }.figma-suite__results > header strong { font-size:13px; font-weight:600; }.figma-suite__results > header button,.figma-suite__result-detail > button { display:inline-flex; height:28px; align-items:center; gap:6px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; color:#4e5969; font-size:12px; }.figma-suite__results > header svg,.figma-suite__result-detail > button svg { width:12px; height:12px; }.figma-suite__results table { width:100%; border-collapse:collapse; font-size:12px; }.figma-suite__results th { height:37px; padding:0 16px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; color:#86909c; font-weight:500; text-align:left; }.figma-suite__results td { height:43px; padding:0 16px; border-bottom:1px solid #e5e6eb; color:#4e5969; }.figma-suite__results tbody tr:nth-child(even) { background:#fafbfe; }.is-pass { color:#00b42a!important; }.is-fail { color:#f53f3f!important; }.is-zero { color:#c9cdd4!important; }.is-primary { color:#165dff!important; }
.figma-suite__summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0 20px; }.figma-suite__summary article { padding:14px 16px; border:1px solid #e5e6eb; border-radius:10px; background:#fff; }.figma-suite__summary small,.figma-suite__summary strong { display:block; }.figma-suite__summary small { color:#86909c; font-size:11px; }.figma-suite__summary strong { margin-top:4px; color:#86909c; font-size:22px; font-weight:700; }.figma-suite__result-meta { display:flex; gap:16px; margin:0 0 16px; color:#86909c; font-size:12px; }.figma-suite__result-meta b { font-weight:600; }.figma-suite__result-items { display:grid; gap:8px; }.figma-suite__result-items article { overflow:hidden; border:1px solid #e5e6eb; border-radius:10px; }.figma-suite__result-items header { display:flex; height:42px; align-items:center; gap:10px; padding:0 14px; background:#fff; }.figma-suite__result-items header > svg:first-child { width:16px; height:16px; color:#00b42a; }.figma-suite__result-items article:nth-child(2) header > svg:first-child { color:#f53f3f; }.figma-suite__result-items header b { padding:2px 6px; border-radius:4px; background:#e8f3ff; color:#165dff; font-size:10px; }.figma-suite__result-items article:nth-child(2) header b { background:#e8ffea; color:#00b42a; }.figma-suite__result-items header strong { flex:1; font-size:13px; font-weight:500; }.figma-suite__result-items header span { color:#86909c; font-size:11px; }.figma-suite__result-items header svg { width:14px; height:14px; color:#86909c; }.figma-suite__result-items article:nth-child(2) > div { border-top:1px solid #e5e6eb; background:#f4f6fa; }.figma-suite__result-items article:nth-child(2) > div > p { display:flex; align-items:flex-start; gap:8px; margin:0; padding:9px 14px; border-bottom:1px solid #e5e6eb; color:#f53f3f; font-size:12px; }.figma-suite__result-items article:nth-child(2) > div > p svg { width:13px; height:13px; }.figma-suite__result-items article:nth-child(2) > div > div { display:grid; height:32px; grid-template-columns:18px minmax(0,1fr) 40px 48px 24px; align-items:center; gap:8px; padding:0 24px; border-bottom:1px solid #e5e6eb; color:#4e5969; font-size:11px; }.figma-suite__result-items article:nth-child(2) > div > div > svg { width:12px; height:12px; color:#00b42a; }.figma-suite__result-items article:nth-child(2) > div > div:last-child > svg { color:#f53f3f; }.figma-suite__result-items code,.figma-suite__result-items small { color:#86909c; font-size:10px; }.figma-suite__result-items article:nth-child(2) > div > div button { display:inline-flex; width:22px; height:22px; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:#86909c; }.figma-suite__result-items article:nth-child(2) > div > div button svg { width:12px; height:12px; }
.figma-suite__overlay { position:fixed; z-index:2000; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45); }.figma-suite__dialog { display:flex; width:680px; height:534px; flex-direction:column; overflow:hidden; border-radius:8px; background:#fff; box-shadow:0 12px 32px rgba(0,0,0,.18); }.figma-suite__dialog.is-scene { height:494px; }.figma-suite__dialog > header { display:flex; box-sizing:border-box; height:54px; flex:0 0 54px; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid #e5e6eb; }.figma-suite__dialog > header strong { font-size:14px; font-weight:600; }.figma-suite__dialog > header button { display:inline-flex; width:26px; height:26px; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:#86909c; }.figma-suite__dialog > header svg { width:15px; height:15px; }.figma-suite__dialog-tools { display:flex; box-sizing:border-box; height:49px; flex:0 0 49px; align-items:center; gap:8px; padding:0 16px; border-bottom:1px solid #e5e6eb; }.figma-suite__dialog-tools select { box-sizing:border-box; width:120px; height:28px; padding:0 8px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; color:#4e5969; font-size:12px; }.figma-suite__dialog-tools select:nth-child(2) { width:80px; }.figma-suite__dialog-tools label { display:flex; min-width:0; height:28px; flex:1; align-items:center; border:1px solid #e5e6eb; border-radius:8px; }.figma-suite__dialog-tools label svg { width:12px; height:12px; margin-left:8px; color:#86909c; }.figma-suite__dialog-tools input { min-width:0; width:100%; height:100%; padding:0 8px; border:0; outline:0; font-size:12px; }.figma-suite__dialog-table { min-height:0; flex:1; overflow:auto; }.figma-suite__dialog-table table { width:100%; border-collapse:collapse; table-layout:auto; font-size:12px; }.figma-suite__dialog-table th { height:34px; padding:0 8px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; color:#86909c; font-weight:500; text-align:left; white-space:nowrap; }.figma-suite__dialog-table th:first-child { width:90px; padding-left:16px; }.figma-suite__dialog-table td { height:40px; padding:0 8px; border-bottom:1px solid #e5e6eb; color:#4e5969; }.figma-suite__dialog-table td:first-child { padding-left:16px; }.figma-suite__dialog-table tr:nth-child(even) { background:#fafbfe; }.figma-suite__dialog-table tbody tr:not(.is-disabled) { cursor:pointer; }.figma-suite__dialog-table tr.is-disabled { opacity:.5; }.figma-suite__dialog-table td:first-child span { display:inline-flex; padding:2px 6px; border-radius:4px; background:#f2f3f5; color:#86909c; font-size:10px; }.figma-suite__dialog-table input { width:14px; height:14px; accent-color:#165dff; }.figma-suite__dialog-table strong { color:#1d2129; font-weight:500; }.figma-suite__dialog > footer { display:flex; box-sizing:border-box; height:54px; flex:0 0 54px; align-items:center; justify-content:space-between; padding:0 16px; border-top:1px solid #e5e6eb; }.figma-suite__dialog > footer p { margin:0; color:#86909c; font-size:12px; }.figma-suite__dialog > footer p strong { color:#165dff; }.figma-suite__dialog > footer div { display:flex; gap:8px; }.figma-suite__dialog > footer button { box-sizing:border-box; height:32px; padding:0 14px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; color:#4e5969; font-size:13px; font-weight:500; }.figma-suite__dialog > footer button:last-child { border-color:#165dff; background:#165dff; color:#fff; }.figma-suite__dialog > footer button:disabled { cursor:not-allowed; opacity:.5; }
/* Figma 226:3347: result content starts on a 17.5px inset grid. */
.figma-suite__results,.figma-suite__result-detail { padding:17.5px; }
.figma-suite__results > header { box-sizing:border-box; height:24.5px; margin-bottom:14px; }
.figma-suite__results > header button,.figma-suite__result-detail > button { box-sizing:border-box; height:24.5px; gap:5.25px; padding:0 11.5px; border-radius:7px; }
.figma-suite__results th { height:36px; padding:0 14px; }
</style>
