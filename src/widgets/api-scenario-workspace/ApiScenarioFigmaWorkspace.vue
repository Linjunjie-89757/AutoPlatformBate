<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  ArrowDown, ArrowUp, ChevronRight, Clock, Copy, CornerDownRight, Database, Edit2, FileText, Filter, Globe, GripVertical, Layers,
  Link2, MoreHorizontal, Play, Plus, Repeat, Save, Search, Settings, Shield, Terminal, Trash2,
  Upload, X,
} from '@lucide/vue'

type ScenarioResult = 'pass' | 'fail' | 'idle'
type ScenarioPriority = 'P0' | 'P1' | 'P2'
type EditorTab = 'steps' | 'test-data' | 'settings'
type StepType = 'import' | 'custom' | 'ref-api' | 'ref-case' | 'ref-scene' | 'loop' | 'condition' | 'once' | 'script' | 'wait'

type ScenarioStep = {
  id: string
  type: StepType
  label: string
  detail: string
  method?: string
  enabled: boolean
  children?: ScenarioStep[]
}

type Scenario = {
  id: number
  name: string
  priority: ScenarioPriority
  status: '进行中'
  result: ScenarioResult
  module: string
  tags: string[]
  steps: ScenarioStep[]
  environment: string
  testData: string
  iterations: number
  threads: number
  runLocation: 'server' | 'runner'
  runner: string
  variableSet: string
  lastRun?: string
  lastResult?: ScenarioResult
}

type Dataset = {
  id: string
  name: string
  enabled: boolean
  columns: string[]
  rows: string[][]
}

const stepTypeConfig: Record<StepType, { label: string; description: string; color: string; background: string; icon: unknown }> = {
  import: { label: '导入', description: '从系统导入接口 / 用例', color: '#ff7d00', background: '#fff3e8', icon: Upload },
  custom: { label: '自定义', description: '配置自定义 HTTP 请求', color: '#165dff', background: '#e8f3ff', icon: Globe },
  'ref-api': { label: '引用接口', description: '引用已有接口定义', color: '#7816ff', background: '#f5e8ff', icon: Link2 },
  'ref-case': { label: '引用用例', description: '引用接口用例', color: '#0fc6c2', background: '#e0f7fa', icon: FileText },
  'ref-scene': { label: '引用场景', description: '引用已有场景', color: '#00b42a', background: '#e8ffea', icon: Layers },
  loop: { label: '循环', description: '循环执行子步骤', color: '#4e5ac8', background: '#eeeeff', icon: Repeat },
  condition: { label: '条件', description: '按条件分支执行', color: '#e91e8c', background: '#ffe8f5', icon: Filter },
  once: { label: '仅一次', description: '整个场景只执行一次', color: '#6b7280', background: '#f2f3f5', icon: Shield },
  script: { label: '脚本', description: '执行 JavaScript 脚本', color: '#f59e0b', background: '#fffbeb', icon: Terminal },
  wait: { label: '等待', description: '等待指定时间 (ms)', color: '#64748b', background: '#f8fafc', icon: Clock },
}
const stepTypeEntries = Object.entries(stepTypeConfig) as Array<[StepType, (typeof stepTypeConfig)[StepType]]>

const stepTemplate = (): ScenarioStep[] => [
  { id: 'step-1', type: 'ref-scene', label: '登录', detail: '登录场景', enabled: true },
  { id: 'step-2', type: 'script', label: '生成本次测试数据', detail: '初始化变量', enabled: true },
  { id: 'step-3', type: 'custom', method: 'POST', label: '新增产品', detail: '/api/products', enabled: true },
  { id: 'step-4', type: 'custom', method: 'GET', label: '查询新增产品并提取ID', detail: '/api/products', enabled: true },
  { id: 'step-5', type: 'custom', method: 'PUT', label: '编辑产品', detail: '/api/products/{id}', enabled: true },
  { id: 'step-6', type: 'custom', method: 'GET', label: '查询验证产品已编辑', detail: '/api/products/{id}', enabled: true },
  { id: 'step-7', type: 'custom', method: 'POST', label: '停用产品', detail: '/api/products/{id}/disable', enabled: true },
  { id: 'step-8', type: 'custom', method: 'GET', label: '查询验证产品已停用', detail: '/api/products/{id}', enabled: true },
  { id: 'step-9', type: 'custom', method: 'DELETE', label: '删除产品', detail: '/api/products/{id}', enabled: true },
  { id: 'step-10', type: 'custom', method: 'GET', label: '查询验证产品已删除', detail: '/api/products/{id}', enabled: true },
]

function makeScenario(id: number, name: string, result: ScenarioResult, priority: ScenarioPriority, module: string, tags: string[], stepCount: number): Scenario {
  return {
    id, name, priority, status: '进行中', result, module, tags,
    steps: stepTemplate().slice(0, stepCount), environment: '测试环境', testData: '不使用测试数据', iterations: 1,
    threads: 1, runLocation: 'server', runner: 'Runner-上海-01', variableSet: '请选择变量集',
    lastRun: result === 'idle' ? undefined : '2026-07-14 09:30', lastResult: result === 'idle' ? undefined : result,
  }
}

const keyword = ref('')
const moduleFilter = ref('全部')
const statusFilter = ref('全部')
const activeEditorTab = ref<EditorTab>('steps')
const activeScenarioId = ref<number | null>(null)
// The Figma list state keeps the first scene tab open while "全部场景" is active.
const openScenarioIds = ref<number[]>([1])
const selectedDataset = ref('register')
const showAddStep = ref(false)
const showImportSteps = ref(false)
const configuringStep = ref<ScenarioStep | null>(null)
const showMoreTabs = ref(false)
const isEditingSceneName = ref(false)
const sceneNameInput = ref<HTMLInputElement | null>(null)
const sceneSettings = ref({ continueOnFailure: false, timeout: 30000, retryCount: 0, waitTime: 0 })

const scenarios = ref<Scenario[]>([
  makeScenario(1, '产品管理-新增编辑删除闭环', 'pass', 'P1', '获客中心', ['获客中心', 'CRUD闭环', 'Codex生成'], 10),
  makeScenario(2, '用户注册登录完整流程', 'fail', 'P0', '用户中心', ['用户中心', '核心链路'], 6),
  makeScenario(3, '订单全链路压测场景', 'pass', 'P0', '订单中心', ['订单', '压测', '主链路'], 5),
  makeScenario(4, '权限校验场景', 'idle', 'P2', '权限中心', ['权限', '安全'], 4),
])

const datasets = ref<Dataset[]>([
  {
    id: 'register', name: '注册测试数据集', enabled: true,
    columns: ['描述(caseDesc)', '用户名', '密码', '手机号', '期望状态'],
    rows: [
      ['正常注册', 'user_001', 'Aa123456', '13800001001', 'success'],
      ['重复手机号', 'user_002', 'Aa123456', '13800001001', 'fail'],
      ['弱密码', 'user_003', '123456', '13800001003', 'fail'],
      ['正常注册2', 'user_004', 'Aa123456', '13800001004', 'success'],
      ['特殊字符', 'user_005', 'Aa!@#456', '13800001005', 'success'],
    ],
  },
  {
    id: 'import', name: '批量导入数据', enabled: false,
    columns: ['批次', '用户编号', '期望状态'],
    rows: Array.from({ length: 20 }, (_, index) => [`第 ${index + 1} 批`, `batch_${String(index + 1).padStart(3, '0')}`, 'success']),
  },
])

const activeScenario = computed(() => scenarios.value.find(item => item.id === activeScenarioId.value) || null)
const activeDataset = computed(() => datasets.value.find(item => item.id === selectedDataset.value) || datasets.value[0])
const isNewScenario = computed(() => activeScenario.value?.name.startsWith('新建场景') ?? false)
// Compatibility aliases keep the inactive legacy markup type-safe while its visual state is replaced below.
const editingScenario = activeScenario
const datasetColumns = computed(() => activeDataset.value?.columns || [])
const datasetRows = computed(() => activeDataset.value?.rows || [])
const filteredScenarios = computed(() => {
  const term = keyword.value.trim()
  return scenarios.value.filter(item => {
    if (term && !item.name.includes(term)) return false
    if (moduleFilter.value !== '全部' && item.module !== moduleFilter.value) return false
    if (statusFilter.value !== '全部') {
      const isActive = item.status === '进行中'
      if ((statusFilter.value === '进行中' && !isActive) || (statusFilter.value === '未激活' && isActive)) return false
    }
    return true
  })
})

function openEditor(item: Scenario) {
  if (!openScenarioIds.value.includes(item.id)) openScenarioIds.value.push(item.id)
  activeScenarioId.value = item.id
  activeEditorTab.value = 'steps'
}

function closeEditor(id: number) {
  const next = openScenarioIds.value.filter(item => item !== id)
  openScenarioIds.value = next
  if (activeScenarioId.value === id) activeScenarioId.value = next.at(-1) || null
}

function createScenario() {
  const draft = makeScenario(Date.now(), `新建场景 ${scenarios.value.length + 1}`, 'idle', 'P2', '获客中心', [], 0)
  draft.testData = ''
  draft.variableSet = ''
  scenarios.value.push(draft)
  openEditor(draft)
}

function removeScenario(item: Scenario) {
  scenarios.value = scenarios.value.filter(candidate => candidate.id !== item.id)
  closeEditor(item.id)
}

function updateActiveScenario(patch: Partial<Scenario>) {
  if (!activeScenario.value) return
  Object.assign(activeScenario.value, patch)
}

function startSceneNameEdit() {
  isEditingSceneName.value = true
  nextTick(() => sceneNameInput.value?.focus())
}

function reorderStep(index: number, direction: -1 | 1) {
  const scenario = activeScenario.value
  if (!scenario || index + direction < 0 || index + direction >= scenario.steps.length) return
  const next = [...scenario.steps]
  ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
  scenario.steps = next
}

function duplicateStep(index: number) {
  const scenario = activeScenario.value
  if (!scenario) return
  const source = scenario.steps[index]
  scenario.steps.splice(index + 1, 0, { ...source, id: `${source.id}-${Date.now()}`, label: `${source.label}（副本）` })
}

function addStep(type: StepType = 'custom') {
  const scenario = activeScenario.value
  if (!scenario) return
  const suffix = scenario.steps.length + 1
  const config = stepTypeConfig[type]
  scenario.steps.push({
    id: `step-${Date.now()}`, type,
    label: type === 'custom' ? '自定义请求' : config.label,
    detail: type === 'custom' ? '/api/path' : config.description,
    method: type === 'custom' ? 'POST' : undefined,
    enabled: true,
    children: ['loop', 'condition', 'once'].includes(type) ? [] : undefined,
  })
  showAddStep.value = false
  if (suffix > 0) activeEditorTab.value = 'steps'
}

function importSteps() {
  const scenario = activeScenario.value
  if (!scenario) return
  scenario.steps.push(
    { id: `import-${Date.now()}-1`, type: 'import', method: 'POST', label: '导入的接口步骤', detail: '/resource/import', enabled: true },
    { id: `import-${Date.now()}-2`, type: 'script', label: '导入的脚本步骤', detail: '校验导入结果', enabled: true },
  )
  showImportSteps.value = false
}

function addDataset() {
  const id = `dataset-${Date.now()}`
  datasets.value.push({ id, name: '未命名数据集', enabled: false, columns: ['变量名'], rows: [['变量值']] })
  selectedDataset.value = id
}

function addDatasetColumn() {
  const dataset = activeDataset.value
  if (!dataset) return
  dataset.columns.push(`变量${dataset.columns.length + 1}`)
  dataset.rows.forEach(row => row.push(''))
}

function removeDatasetColumn(index: number) {
  const dataset = activeDataset.value
  if (!dataset || dataset.columns.length === 1) return
  dataset.columns.splice(index, 1)
  dataset.rows.forEach(row => row.splice(index, 1))
}

function addDatasetRow() {
  const dataset = activeDataset.value
  if (dataset) dataset.rows.push(dataset.columns.map(() => ''))
}

function removeDatasetRow(index: number) {
  const dataset = activeDataset.value
  if (dataset) dataset.rows.splice(index, 1)
}

function resultLabel(result: ScenarioResult) {
  return result === 'pass' ? '通过' : result === 'fail' ? '失败' : '未运行'
}

function stepTypeLabel(type: StepType) {
  return stepTypeConfig[type].label
}

function isControllerStep(type: StepType) {
  return ['loop', 'condition', 'once'].includes(type)
}

function addChildStep(parent: ScenarioStep) {
  parent.children ||= []
  parent.children.push({
    id: `step-child-${Date.now()}`,
    type: 'custom',
    method: 'POST',
    label: '自定义请求',
    detail: '/api/path',
    enabled: true,
  })
}
</script>

<template>
  <section class="figma-api-scenarios">
    <main v-if="!activeScenario" class="figma-api-scenarios__list">
      <header v-if="false" class="figma-api-scenarios__page-head">
        <h1>接口场景</h1>
        <p>多接口串联编排，支持数据驱动和场景级断言</p>
      </header>

      <div v-if="false" class="figma-api-scenarios__toolbar">
        <label class="figma-api-scenarios__search">
          <Search />
          <input v-model="keyword" placeholder="搜索场景名称" />
        </label>
        <div class="figma-api-scenarios__toolbar-spacer" />
        <button class="figma-api-scenarios__primary" type="button" @click="createScenario()"><Plus />新建场景</button>
      </div>

      <section v-if="false" class="figma-api-scenarios__table" aria-label="接口场景列表">
        <header class="figma-api-scenarios__table-head">
          <span>ID</span><span>场景名称</span><span>优先级</span><span>状态</span><span>最近结果</span><span>所属模块</span><span>操作</span>
        </header>
        <div class="figma-api-scenarios__table-body">
          <article v-for="item in filteredScenarios" :key="item.id" class="figma-api-scenarios__row">
            <span class="is-muted">{{ item.id }}</span>
            <button class="figma-api-scenarios__name" type="button" @click="openEditor(item)">{{ item.name }}</button>
            <span><b class="figma-api-scenarios__priority">{{ item.priority }}</b></span>
            <span class="figma-api-scenarios__status"><i />{{ item.status }}</span>
            <span class="figma-api-scenarios__result" :class="`is-${item.result}`"><i />{{ resultLabel(item.result) }}</span>
            <span class="is-muted">{{ item.module }}</span>
            <span class="figma-api-scenarios__actions">
              <button type="button" title="编辑" aria-label="编辑" @click.stop="openEditor(item)"><Edit2 /></button>
              <button type="button" title="执行" aria-label="执行" @click.stop><Play /></button>
              <button type="button" title="删除" aria-label="删除" @click.stop="removeScenario(item)"><Trash2 /></button>
            </span>
          </article>
          <p v-if="!filteredScenarios.length" class="figma-api-scenarios__empty">暂无场景数据</p>
        </div>
        <footer class="figma-api-scenarios__table-footer"><span>共 {{ filteredScenarios.length }} 条</span><button type="button" aria-current="page">1</button></footer>
      </section>
      <header class="figma-api-scenarios__scene-tabbar">
        <button class="is-active" type="button">全部场景</button><i />
        <div class="figma-api-scenarios__scene-tab-strip">
          <button v-for="id in openScenarioIds" :key="id" type="button" :title="scenarios.find(item => item.id === id)?.name" @click="activeScenarioId = id">
            <span>{{ scenarios.find(item => item.id === id)?.name || '未命名场景' }}</span>
          </button>
        </div>
        <button type="button" title="新建场景" @click="createScenario()"><Plus /></button>
        <button class="figma-api-scenarios__scene-more" type="button" title="更多场景">···</button>
      </header>
      <section class="figma-api-scenarios__scene-list" aria-label="接口场景列表">
        <div class="figma-api-scenarios__scene-filters">
          <label class="figma-api-scenarios__scene-search"><Search /><input v-model="keyword" placeholder="搜索场景名称" /></label>
          <select v-model="moduleFilter" aria-label="所属模块筛选"><option>全部</option><option>获客中心</option><option>用户中心</option><option>订单中心</option><option>权限中心</option><option>结算中心</option></select>
          <select v-model="statusFilter" aria-label="场景状态筛选"><option>全部</option><option>进行中</option><option>未激活</option></select>
          <span /><button class="figma-api-scenarios__primary" type="button" @click="createScenario()"><Plus />新建场景</button>
        </div>
        <div class="figma-api-scenarios__scene-table">
          <header><span>ID</span><span>场景名称</span><span>优先级</span><span>所属模块</span><span>步骤数</span><span>最近结果</span><span>操作</span></header>
          <article v-for="item in filteredScenarios" :key="item.id" :class="{ 'is-alt': item.id % 2 === 0 }">
            <span class="figma-api-scenarios__scene-id">s{{ item.id }}</span>
            <div class="figma-api-scenarios__scene-name"><button type="button" @click="openEditor(item)">{{ item.name }}</button><div><em v-for="tag in item.tags" :key="tag">{{ tag }}</em></div></div>
            <span><b class="figma-api-scenarios__scene-priority" :class="`is-${item.priority.toLowerCase()}`">{{ item.priority }}</b></span>
            <span class="figma-api-scenarios__scene-module">{{ item.module }}</span>
            <span class="figma-api-scenarios__scene-step-count">{{ item.steps.length }} 个</span>
            <span class="figma-api-scenarios__scene-result" :class="`is-${item.result}`"><i v-if="item.result !== 'idle'" />{{ resultLabel(item.result) }}</span>
            <span class="figma-api-scenarios__scene-actions"><button type="button" title="编辑" @click="openEditor(item)"><Edit2 /></button><button type="button" title="执行"><Play /></button><button type="button" title="复制"><Copy /></button><button type="button" title="删除" @click="removeScenario(item)"><Trash2 /></button></span>
          </article>
          <p v-if="!filteredScenarios.length" class="figma-api-scenarios__scene-empty">暂无符合条件的场景</p>
        </div>
      </section>
    </main>

    <main v-else class="figma-api-scenarios__editor">
      <header class="figma-api-scenarios__editor-head">
        <button :class="{ 'is-active': activeScenarioId === null }" type="button" @click="activeScenarioId = null">全部场景</button>
        <i />
        <div class="figma-api-scenarios__editor-open-tabs">
          <button v-for="id in openScenarioIds" :key="id" :class="{ 'is-active': id === activeScenarioId }" type="button" @click="activeScenarioId = id">
            <span>{{ scenarios.find(item => item.id === id)?.name }}</span><X @click.stop="closeEditor(id)" />
          </button>
        </div>
        <button class="figma-api-scenarios__tool-icon" type="button" title="新建场景" @click="createScenario()"><Plus /></button>
        <button class="figma-api-scenarios__tool-icon" type="button" title="更多场景" @click="showMoreTabs = !showMoreTabs"><MoreHorizontal /></button>
        <div v-if="showMoreTabs" class="figma-api-scenarios__tab-menu"><button v-for="id in openScenarioIds" :key="id" type="button" @click="activeScenarioId = id; showMoreTabs = false">{{ scenarios.find(item => item.id === id)?.name }}</button></div>
      </header>
      <div class="figma-api-scenarios__editor-body">
        <section class="figma-api-scenarios__editor-main">
          <nav class="figma-api-scenarios__editor-tabs" :class="{ 'is-empty': activeScenario.steps.length === 0 }" role="tablist" aria-label="场景编辑">
            <button :class="{ 'is-active': activeEditorTab === 'steps' }" type="button" @click="activeEditorTab = 'steps'">步骤 ({{ activeScenario.steps.length }})</button>
            <button :class="{ 'is-active': activeEditorTab === 'test-data' }" type="button" @click="activeEditorTab = 'test-data'">测试数据</button>
            <button :class="{ 'is-active': activeEditorTab === 'settings' }" type="button" @click="activeEditorTab = 'settings'">设置</button>
          </nav>
          <div v-if="false" class="figma-api-scenarios__steps">
            <div class="figma-api-scenarios__scene-info"><div><select><option>P1</option></select><input :value="editingScenario?.name" /></div><p>由 Codex 根据获客中心低风险新增编辑删除接口生成的可重复闭环场景。</p><small>X-MAN · 更新于 2026-07-14 · 获客中心</small></div>
            <div class="figma-api-scenarios__steps-toolbar"><p>共 <b>10</b> 个步骤</p><div><button type="button">导入步骤</button><button type="button">+ 添加步骤</button></div></div>
            <div class="figma-api-scenarios__step-list"><div v-for="(label, index) in ['引用场景 登录', '脚本操作 生成本次测试数据', 'POST 新增产品', 'POST 查询并提取 ID', 'PUT 编辑产品', 'DELETE 删除产品']" :key="label" class="figma-api-scenarios__step-row"><span>{{ index + 1 }}</span><b :class="{ 'is-script': index === 1, 'is-scene': index === 0 }">{{ index === 0 ? '引用场景' : index === 1 ? '脚本' : '自定义' }}</b><p>{{ label }}</p><button type="button">...</button></div><button class="figma-api-scenarios__add-step" type="button"><Plus />添加测试步骤</button></div>
          </div>
          <div v-else-if="false" class="figma-api-scenarios__test-data">
            <aside class="figma-api-scenarios__dataset-list"><div class="figma-api-scenarios__dataset-list-head"><b>数据集列表</b><button type="button"><Plus /></button></div><button v-for="dataset in datasets" :key="dataset.id" :class="{ 'is-active': selectedDataset === dataset.id }" type="button" @click="selectedDataset = dataset.id"><i :class="{ 'is-on': dataset.enabled }"><span /></i><span><b>{{ dataset.name }}</b><small>{{ dataset.rows }} 行数据</small></span><em>...</em></button></aside>
            <section class="figma-api-scenarios__dataset-editor"><header><b>注册测试数据集</b><div><button type="button">导入 CSV</button><button type="button">导入 JSON</button><i /><button type="button">导出 CSV</button><button type="button">添加变量列</button><button class="is-primary" type="button"><Plus />添加数据行</button></div></header><div class="figma-api-scenarios__dataset-table-scroll"><table><thead><tr><th>#</th><th v-for="column in datasetColumns" :key="column">{{ column }} <button type="button" aria-label="删除列"><Trash2 /></button></th><th /></tr></thead><tbody><tr v-for="(row, index) in datasetRows" :key="row[1]"><td>{{ index + 1 }}</td><td v-for="cell in row" :key="cell"><input :value="cell" /></td><td><button type="button" aria-label="删除行"><Trash2 /></button></td></tr></tbody></table></div></section>
          </div>
          <div v-else-if="false" class="figma-api-scenarios__settings">
            <div><p><b>失败后继续执行</b><span>单步失败后继续执行后续步骤</span></p><button class="is-on" type="button"><i /></button></div>
            <div><p><b>全局超时时间 (ms)</b><span>整个场景的最大执行时间</span></p><input value="30000" /></div>
            <div><p><b>步骤失败重试次数</b><span>单步失败时自动重试次数，0 表示不重试</span></p><input value="0" /></div>
            <div><p><b>步骤间默认等待 (ms)</b><span>每个步骤执行前的默认等待时间</span></p><input value="0" /></div>
          </div>
          <div v-if="activeEditorTab === 'steps'" class="figma-api-scenarios__steps">
            <div class="figma-api-scenarios__scene-info" :class="{ 'is-new': isNewScenario }">
              <div>
                <select v-model="activeScenario.priority"><option>P0</option><option>P1</option><option>P2</option></select>
                <input v-if="isEditingSceneName" ref="sceneNameInput" :value="activeScenario.name" @blur="isEditingSceneName = false" @input="updateActiveScenario({ name: ($event.target as HTMLInputElement).value })" @keydown.enter="isEditingSceneName = false" />
                <button v-else class="figma-api-scenarios__scene-name-button" type="button" @click="startSceneNameEdit"><span>{{ activeScenario.name }}</span><Edit2 /></button>
              </div>
              <p v-if="!isNewScenario">由 Codex 根据获客中心低风险新增编辑删除接口生成的可重复闭环场景。</p><small>X-MAN · 更新于 2026-07-14 · {{ activeScenario.module }}</small>
            </div>
            <div class="figma-api-scenarios__steps-toolbar"><p>共 <b>{{ activeScenario.steps.length }}</b> 个步骤</p><div><button type="button" @click="showImportSteps = true"><Upload />导入步骤</button><button type="button" @click="showAddStep = true"><Plus />添加步骤</button></div></div>
            <div v-if="activeScenario.steps.length" class="figma-api-scenarios__step-list">
              <div v-for="(step, index) in activeScenario.steps" :key="step.id" class="figma-api-scenarios__step-group">
                <article class="figma-api-scenarios__step-row" :class="{ 'is-disabled': !step.enabled, 'is-controller': isControllerStep(step.type) }" :style="{ '--step-color': stepTypeConfig[step.type].color }">
                  <div class="figma-api-scenarios__step-row-main">
                    <GripVertical class="figma-api-scenarios__drag-handle" />
                    <button class="figma-api-scenarios__step-toggle" :class="{ 'is-on': step.enabled }" type="button" @click="step.enabled = !step.enabled"><i /></button>
                    <span class="figma-api-scenarios__step-index">{{ index + 1 }}</span>
                    <b class="figma-api-scenarios__step-type" :style="{ color: stepTypeConfig[step.type].color, background: stepTypeConfig[step.type].background }">{{ stepTypeLabel(step.type) }}</b>
                    <b v-if="step.method" class="figma-api-scenarios__method" :class="`is-${step.method.toLowerCase()}`">{{ step.method }}</b>
                    <p><strong>{{ step.label }}</strong></p>
                    <small v-if="step.method && step.detail" class="figma-api-scenarios__step-path">{{ step.detail }}</small>
                    <em v-if="isControllerStep(step.type)" :style="{ color: stepTypeConfig[step.type].color, background: stepTypeConfig[step.type].background }">{{ step.children?.length || 0 }} 子步骤</em>
                    <div class="figma-api-scenarios__step-actions"><button type="button" title="配置" @click="configuringStep = step"><ChevronRight /></button><button type="button" title="上移" :disabled="index === 0" @click="reorderStep(index, -1)"><ArrowUp /></button><button type="button" title="下移" :disabled="index === activeScenario.steps.length - 1" @click="reorderStep(index, 1)"><ArrowDown /></button><button type="button" title="复制" @click="duplicateStep(index)"><Copy /></button><button type="button" title="删除" @click="activeScenario.steps.splice(index, 1)"><Trash2 /></button></div>
                  </div>
                  <button v-if="isControllerStep(step.type)" class="figma-api-scenarios__add-child" type="button" :style="{ color: stepTypeConfig[step.type].color }" @click="addChildStep(step)"><Plus />添加子步骤</button>
                </article>
                <template v-if="isControllerStep(step.type)">
                  <article v-for="(child, childIndex) in step.children" :key="child.id" class="figma-api-scenarios__step-row figma-api-scenarios__step-row--child" :class="{ 'is-disabled': !child.enabled }">
                    <CornerDownRight class="figma-api-scenarios__child-indent" />
                    <button class="figma-api-scenarios__step-toggle" :class="{ 'is-on': child.enabled }" type="button" @click="child.enabled = !child.enabled"><i /></button>
                    <span class="figma-api-scenarios__step-index">{{ childIndex + 1 }}</span>
                    <b class="figma-api-scenarios__step-type" :style="{ color: stepTypeConfig[child.type].color, background: stepTypeConfig[child.type].background }">{{ stepTypeLabel(child.type) }}</b>
                    <b v-if="child.method" class="figma-api-scenarios__method" :class="`is-${child.method.toLowerCase()}`">{{ child.method }}</b>
                    <p><strong>{{ child.label }}</strong></p><small class="figma-api-scenarios__step-path">{{ child.detail }}</small>
                    <div class="figma-api-scenarios__step-actions"><button type="button" title="配置" @click="configuringStep = child"><ChevronRight /></button><button type="button" title="删除" @click="step.children?.splice(childIndex, 1)"><Trash2 /></button></div>
                  </article>
                </template>
              </div>
              <button class="figma-api-scenarios__add-step" type="button" @click="showAddStep = true"><Plus />添加测试步骤</button>
            </div>
            <div v-else class="figma-api-scenarios__step-empty"><Layers /><p>还没有步骤，点击添加开始编排</p><button type="button" @click="showAddStep = true"><Plus />添加步骤</button></div>
            </div>
          <div v-else-if="activeEditorTab === 'test-data'" class="figma-api-scenarios__test-data">
            <aside class="figma-api-scenarios__dataset-list"><div class="figma-api-scenarios__dataset-list-head"><b>数据集列表</b><button type="button" @click="addDataset()"><Plus /></button></div><div v-for="dataset in datasets" :key="dataset.id" :class="{ 'is-active': selectedDataset === dataset.id }" class="figma-api-scenarios__dataset-item"><button type="button" @click="selectedDataset = dataset.id"><i :class="{ 'is-on': dataset.enabled }" @click.stop="dataset.enabled = !dataset.enabled"><span /></i><span><b>{{ dataset.name }}</b><small>{{ dataset.rows.length }} 行数据</small></span></button><button class="figma-api-scenarios__dataset-more" type="button" title="操作" @click.stop><MoreHorizontal /></button></div></aside>
            <section class="figma-api-scenarios__dataset-editor"><header><b>{{ activeDataset.name }}</b><div><button type="button"><Upload />导入 CSV</button><button type="button"><Database />导入 JSON</button><i /><button type="button"><Database />导出 CSV</button><button type="button" @click="addDatasetColumn()">添加变量列</button><button class="is-primary" type="button" @click="addDatasetRow()"><Plus />添加数据行</button></div></header><div class="figma-api-scenarios__dataset-table-scroll"><table><colgroup><col class="figma-api-scenarios__dataset-index-column" /><col v-for="column in activeDataset.columns" :key="column" class="figma-api-scenarios__dataset-value-column" /><col class="figma-api-scenarios__dataset-action-column" /></colgroup><thead><tr><th>#</th><th v-for="(column, columnIndex) in activeDataset.columns" :key="`${activeDataset.id}-${columnIndex}`">{{ column }} <button type="button" title="删除列" @click="removeDatasetColumn(columnIndex)"><Trash2 /></button></th><th /></tr></thead><tbody><tr v-for="(row, rowIndex) in activeDataset.rows" :key="`${activeDataset.id}-${rowIndex}`"><td>{{ rowIndex + 1 }}</td><td v-for="(_, columnIndex) in activeDataset.columns" :key="columnIndex"><input v-model="row[columnIndex]" /></td><td><button type="button" title="删除行" @click="removeDatasetRow(rowIndex)"><Trash2 /></button></td></tr></tbody></table></div></section>
          </div>
          <div v-else class="figma-api-scenarios__settings">
            <div class="figma-api-scenarios__settings-panel">
              <article><p><b>失败后继续执行</b><span>单步失败后继续执行后续步骤</span></p><button :class="{ 'is-on': sceneSettings.continueOnFailure }" type="button" @click="sceneSettings.continueOnFailure = !sceneSettings.continueOnFailure"><i /></button></article>
              <article><p><b>全局超时时间 (ms)</b><span>整个场景的最大执行时间</span></p><input v-model.number="sceneSettings.timeout" type="number" /></article>
              <article><p><b>步骤失败重试次数</b><span>单步失败时自动重试次数，0 表示不重试</span></p><input v-model.number="sceneSettings.retryCount" type="number" /></article>
              <article><p><b>步骤间默认等待 (ms)</b><span>每个步骤执行前的默认等待时间</span></p><input v-model.number="sceneSettings.waitTime" type="number" /></article>
            </div>
          </div>
        </section>
        <aside v-if="false" class="figma-api-scenarios__run-config">
          <div class="figma-api-scenarios__run-actions"><select><option>测试环境</option></select><button type="button">运行</button><button type="button">保存</button></div>
          <label>* 所属模块<select><option>获客中心</option></select></label>
          <label>测试数据<select><option>请选择</option></select></label>
          <div class="figma-api-scenarios__numbers"><label>循环次数<input value="1" /></label><label>线程数<input value="1" /></label></div>
          <label>运行于<select><option>服务端</option></select></label>
          <label>变量集<select><option>请选择</option></select></label>
          <label>标签<button type="button">+ 添加</button></label>
        </aside>
        <aside class="figma-api-scenarios__run-config" :class="{ 'is-new': isNewScenario }">
          <div class="figma-api-scenarios__run-actions"><div><select v-model="activeScenario.environment"><option>测试环境</option><option>预发布环境</option></select><button type="button" title="环境设置"><Settings /></button></div><button type="button"><Play />运行</button><button type="button"><Save />保存</button></div>
          <div class="figma-api-scenarios__run-fields">
          <label><em>*</em> 所属模块<select v-model="activeScenario.module"><option value="">请选择所属模块</option><option>获客中心</option><option>订单中心</option></select></label>
          <label>测试数据<select v-model="activeScenario.testData"><option value="">请选择测试数据</option><option>不使用测试数据</option><option v-for="dataset in datasets" :key="dataset.id">{{ dataset.name }}</option></select></label>
          <div class="figma-api-scenarios__numbers"><label>循环次数<input v-model.number="activeScenario.iterations" type="number" min="1" /></label><label>线程数<input v-model.number="activeScenario.threads" type="number" min="1" /></label></div>
          <label>运行于<select v-model="activeScenario.runLocation"><option value="server">服务端执行</option><option value="runner">本地执行器</option></select></label>
          <label v-if="activeScenario.runLocation === 'runner'">选择 Runner<select v-model="activeScenario.runner"><option>Runner-上海-01</option><option>Runner-北京-02</option></select></label>
          <label>变量集<select v-model="activeScenario.variableSet"><option value="">请选择变量集</option><option>公共变量集</option><option>测试变量集</option></select></label>
          <label>标签<div class="figma-api-scenarios__tag-list"><span v-for="tag in activeScenario.tags" :key="tag">{{ tag }}<X @click="activeScenario.tags = activeScenario.tags.filter(item => item !== tag)" /></span><button type="button" @click="activeScenario.tags.push('新标签')">+ 添加</button></div></label>
          </div>
          <section v-if="activeScenario.lastRun" class="figma-api-scenarios__last-run"><p>上次运行</p><strong :class="`is-${activeScenario.lastResult}`"><i />{{ activeScenario.lastResult === 'pass' ? '通过' : '失败' }}</strong><small>{{ activeScenario.lastRun }}</small></section>
        </aside>
      </div>
      <div v-if="showAddStep || showImportSteps" class="figma-api-scenarios__overlay" @click.self="showAddStep = false; showImportSteps = false"><section class="figma-api-scenarios__dialog" :class="{ 'is-import': showImportSteps }"><header><b>{{ showImportSteps ? '导入步骤' : '选择步骤类型' }}</b><button type="button" @click="showAddStep = false; showImportSteps = false"><X /></button></header><p v-if="showImportSteps">选择资源后会将对应接口和脚本步骤追加到当前场景。</p><div v-else class="figma-api-scenarios__step-type-grid"><button v-for="[type, config] in stepTypeEntries" :key="type" type="button" @click="addStep(type)"><span :style="{ color: config.color, background: config.background }"><component :is="config.icon" /></span><b>{{ config.label }}</b><small>{{ config.description }}</small></button></div><footer v-if="showImportSteps"><button type="button" @click="showAddStep = false; showImportSteps = false">取消</button><button type="button" @click="importSteps()">确认导入</button></footer></section></div>
      <aside v-if="configuringStep" class="figma-api-scenarios__step-drawer"><header><div><b>配置步骤</b><small>{{ stepTypeLabel(configuringStep.type) }}</small></div><button type="button" @click="configuringStep = null"><X /></button></header><nav><button class="is-active" type="button">基础信息</button><button v-if="configuringStep.type === 'custom'" type="button">Params</button><button v-if="configuringStep.type === 'custom'" type="button">Headers</button><button v-if="configuringStep.type === 'custom'" type="button">Body</button><button v-if="configuringStep.type === 'custom'" type="button">Auth</button><button type="button">前置处理</button><button type="button">后置处理</button><button type="button">断言</button><button type="button">设置</button></nav><div class="figma-api-scenarios__drawer-content"><label>步骤名称<input v-model="configuringStep.label" /></label><div v-if="configuringStep.type === 'custom'" class="figma-api-scenarios__request-line"><label>请求方式<select v-model="configuringStep.method"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option></select></label><label>请求路径<input v-model="configuringStep.detail" /></label></div><label v-else>步骤内容<input v-model="configuringStep.detail" /></label><section class="figma-api-scenarios__debug-response"><header><span>调试响应</span><button type="button"><Play />发送</button></header><p>配置完成后可发送请求并查看响应结果。</p></section></div><footer><button type="button" @click="configuringStep = null">关闭</button><button type="button" @click="configuringStep = null">保存配置</button></footer></aside>
    </main>
  </section>
</template>

<style scoped>
.figma-api-scenarios { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; color: #1d2129; font-family: Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__toolbar-spacer, .figma-api-scenarios__editor-spacer { flex: 1; }
.figma-api-scenarios__list { min-height: 0; flex: 1; overflow-y: auto; padding: 17.5px; }
.figma-api-scenarios__page-head { height: 43.75px; }
.figma-api-scenarios__page-head h1 { margin: 0; color: #1d2129; font-size: 18px; font-weight: 600; line-height: 24px; }
.figma-api-scenarios__page-head p { margin: 0; color: #86909c; font-size: 12px; font-weight: 400; line-height: 19.75px; }
.figma-api-scenarios__toolbar { display: flex; box-sizing: border-box; height: 49.5px; align-items: flex-end; padding-bottom: 1.5px; }
.figma-api-scenarios__search { display: flex; box-sizing: border-box; width: 200px; height: 28px; align-items: center; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__search svg { width: 13px; height: 13px; margin-left: 8.75px; color: #86909c; }
.figma-api-scenarios__search input { min-width: 0; width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__search input::placeholder { color: rgba(29, 33, 41, .5); }
.figma-api-scenarios__primary { display: inline-flex; box-sizing: border-box; width: 98.25px; height: 32px; align-items: center; justify-content: center; gap: 5.25px; padding: 0; border: 0; border-radius: 7px; background: #165dff; color: #fff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__primary svg { width: 13px; height: 13px; }
.figma-api-scenarios__primary:hover { background: #0e4fd8; }
.figma-api-scenarios__table { overflow: hidden; margin-top: 14px; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .04); }
.figma-api-scenarios__table-head, .figma-api-scenarios__row { display: grid; grid-template-columns: 8% 30% 7% 8% 8% 14% 25%; align-items: center; }
.figma-api-scenarios__table-head { box-sizing: border-box; height: 34.5px; border-bottom: 1px solid #e5e6eb; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; letter-spacing: .275px; line-height: 16.5px; }
.figma-api-scenarios__table-head span, .figma-api-scenarios__row > span, .figma-api-scenarios__row > strong { min-width: 0; padding: 0 14px; }
.figma-api-scenarios__table-head span:last-child { text-align: right; }
.figma-api-scenarios__row { box-sizing: border-box; height: 46px; border-bottom: 1px solid #e5e6eb; background: #fff; color: #86909c; cursor: pointer; font-size: 13px; font-weight: 400; line-height: 20px; transition: background .15s ease; }
.figma-api-scenarios__row:last-child { border-bottom: 0; }
.figma-api-scenarios__row:hover, .figma-api-scenarios__row:focus { outline: 0; background: #fafcff; }
.figma-api-scenarios__row strong { overflow: hidden; color: #165dff; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__row .is-muted { color: #86909c; }
.figma-api-scenarios__priority { display: inline-flex; box-sizing: border-box; height: 17.5px; align-items: center; padding: 0 7px; border-radius: 3.5px; background: #fff3e8; color: #ff7d00; font-size: 11px; font-weight: 600; line-height: 17px; }
.figma-api-scenarios__status, .figma-api-scenarios__result { display: inline-flex; align-items: center; gap: 5.25px; color: #00b42a; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__status i, .figma-api-scenarios__result i { width: 5.25px; height: 5.25px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__result.is-fail { color: #f53f3f; }
.figma-api-scenarios__actions { display: inline-flex; justify-content: flex-end; gap: 0; padding-right: 14px !important; }
.figma-api-scenarios__actions button { display: inline-flex; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #c9cdd4; cursor: pointer; }
.figma-api-scenarios__actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__actions button:last-child:hover { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__empty { margin: 0; padding: 48px 0; color: #86909c; font-size: 13px; text-align: center; }
.figma-api-scenarios__table-footer { display: flex; box-sizing: border-box; height: 43px; align-items: center; justify-content: space-between; padding: 0 14px; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__table-footer button { display: inline-flex; box-sizing: border-box; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 1px solid #165dff; border-radius: 5px; background: #165dff; color: #fff; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; }
.figma-api-scenarios__editor-head { display: flex; box-sizing: border-box; height: 38px; align-items: center; gap: 10.5px; padding: 0 7px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.figma-api-scenarios__editor-head > button:first-child { height: 25px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 5px; background: #fff; color: #4e5969; cursor: pointer; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor-head > i { width: 1px; height: 14px; background: #e5e6eb; }
.figma-api-scenarios__editor-head strong { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__tool-icon { width: 24.5px; height: 24.5px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__editor-body { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.figma-api-scenarios__editor-main { display: flex; min-width: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; }
.figma-api-scenarios__editor-tabs { display: flex; height: 38px; flex: 0 0 auto; padding: 0 14px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__editor-tabs button { height: 38px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #86909c; cursor: pointer; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor-tabs button.is-active { border-bottom-color: #165dff; color: #165dff; }
.figma-api-scenarios__steps { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.figma-api-scenarios__scene-info { flex: 0 0 auto; padding: 12px 14px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__scene-info > div { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.figma-api-scenarios__scene-info select { box-sizing: border-box; width: 46px; height: 24px; padding: 0 7px; border: 1px solid #ff7d00; border-radius: 4px; background: #fff3e8; color: #ff7d00; font: 600 11px/16px Inter, sans-serif; }
.figma-api-scenarios__scene-info input { min-width: 0; width: 420px; padding: 0; border: 0; outline: 0; background: transparent; color: #1d2129; font: 600 14px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info p { margin: 0 0 3px; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__scene-info small { color: #c9cdd4; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__steps-toolbar { display: flex; height: 42px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__steps-toolbar p { margin: 0; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__steps-toolbar b { color: #1d2129; }
.figma-api-scenarios__steps-toolbar div { display: flex; gap: 8px; }
.figma-api-scenarios__steps-toolbar button { box-sizing: border-box; height: 26px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__steps-toolbar button:last-child { border-color: #165dff; background: #165dff; color: #fff; }
.figma-api-scenarios__step-list { min-height: 0; flex: 1; overflow-y: auto; padding: 8px 12px; background: #fafbfe; }
.figma-api-scenarios__step-row { display: flex; box-sizing: border-box; height: 42px; align-items: center; gap: 10px; margin-bottom: 4px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__step-row > span { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; border-radius: 50%; background: #f2f3f5; color: #86909c; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__step-row > b { padding: 2px 6px; border-radius: 3px; background: #e8f3ff; color: #165dff; font-size: 10px; line-height: 15px; }
.figma-api-scenarios__step-row > b.is-script { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__step-row > b.is-scene { background: #e8ffea; color: #00b42a; }
.figma-api-scenarios__step-row p { flex: 1; margin: 0; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__step-row button { border: 0; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__add-step { display: inline-flex; box-sizing: border-box; width: 100%; height: 36px; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; border: 1px dashed #c9cdd4; border-radius: 7px; background: transparent; color: #86909c; cursor: pointer; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__add-step svg { width: 13px; height: 13px; }
.figma-api-scenarios__test-data { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.figma-api-scenarios__dataset-list { box-sizing: border-box; width: 220px; flex: 0 0 220px; overflow-y: auto; padding: 12px; border-right: 1px solid #e5e6eb; background: #f4f6fa; }
.figma-api-scenarios__dataset-list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.figma-api-scenarios__dataset-list-head b { color: #4e5969; font-size: 12px; font-weight: 600; }
.figma-api-scenarios__dataset-list-head button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #165dff; cursor: pointer; }
.figma-api-scenarios__dataset-list-head svg { width: 13px; height: 13px; }
.figma-api-scenarios__dataset-list > button { display: flex; box-sizing: border-box; width: 100%; align-items: center; gap: 8px; padding: 10px; border: 0; border-radius: 7px; background: transparent; color: #1d2129; cursor: pointer; text-align: left; }
.figma-api-scenarios__dataset-list > button.is-active { background: #e8f3ff; }
.figma-api-scenarios__dataset-list > button > i { position: relative; width: 28px; height: 16px; flex: 0 0 28px; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__dataset-list > button > i.is-on { background: #165dff; }
.figma-api-scenarios__dataset-list > button > i span { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__dataset-list > button > i.is-on span { left: 14px; }
.figma-api-scenarios__dataset-list > button > span { min-width: 0; flex: 1; }
.figma-api-scenarios__dataset-list > button b, .figma-api-scenarios__dataset-list > button small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__dataset-list > button b { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__dataset-list > button.is-active b { color: #165dff; }
.figma-api-scenarios__dataset-list > button small { color: #86909c; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__dataset-list > button em { color: #86909c; font-size: 12px; font-style: normal; }
.figma-api-scenarios__dataset-editor { display: flex; min-width: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; }
.figma-api-scenarios__dataset-editor > header { display: flex; min-height: 48px; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dataset-editor > header > b { flex: 1; color: #1d2129; font-size: 13px; font-weight: 600; }
.figma-api-scenarios__dataset-editor > header > div { display: flex; align-items: center; gap: 7px; }
.figma-api-scenarios__dataset-editor > header button { box-sizing: border-box; height: 26px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__dataset-editor > header button.is-primary { display: inline-flex; align-items: center; gap: 4px; border-color: #00b42a; background: #00b42a; color: #fff; }
.figma-api-scenarios__dataset-editor > header button svg { width: 11px; height: 11px; }
.figma-api-scenarios__dataset-editor > header i { width: 1px; height: 16px; background: #e5e6eb; }
.figma-api-scenarios__dataset-table-scroll { min-height: 0; flex: 1; overflow: auto; }
.figma-api-scenarios__dataset-table-scroll table { min-width: 100%; border-collapse: collapse; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__dataset-table-scroll th { height: 36px; min-width: 120px; padding: 0 12px; background: #f4f6fa; color: #86909c; font-size: 11px; font-weight: 500; text-align: left; white-space: nowrap; }
.figma-api-scenarios__dataset-table-scroll th:first-child { min-width: 32px; width: 32px; }
.figma-api-scenarios__dataset-table-scroll th button, .figma-api-scenarios__dataset-table-scroll td:last-child button { display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: #f53f3f; vertical-align: middle; }
.figma-api-scenarios__dataset-table-scroll svg { width: 11px; height: 11px; }
.figma-api-scenarios__dataset-table-scroll td { height: 37px; padding: 0 8px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dataset-table-scroll td:first-child { padding: 0 12px; color: #c9cdd4; text-align: center; }
.figma-api-scenarios__dataset-table-scroll input { box-sizing: border-box; width: 100%; height: 24px; padding: 0 8px; border: 1px solid transparent; border-radius: 4px; outline: 0; background: transparent; color: #1d2129; font: 400 11px/16px Inter, sans-serif; }
.figma-api-scenarios__dataset-table-scroll input:focus { border-color: #165dff; background: #fff; }
.figma-api-scenarios__settings { width: min(448px, 100%); }
.figma-api-scenarios__settings > div { display: flex; box-sizing: border-box; min-height: 69.75px; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #f2f3f5; }
.figma-api-scenarios__settings p { margin: 0; }
.figma-api-scenarios__settings b, .figma-api-scenarios__settings span { display: block; }
.figma-api-scenarios__settings b { color: #1d2129; font-size: 13px; font-weight: 500; line-height: 20px; }
.figma-api-scenarios__settings span { color: #86909c; font-size: 12px; line-height: 19.75px; }
.figma-api-scenarios__settings input { box-sizing: border-box; width: 84px; height: 28px; padding: 0 11.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; font: 400 13px/20px Inter, sans-serif; }
.figma-api-scenarios__settings button { position: relative; width: 28px; height: 16px; padding: 0; border: 0; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__settings button.is-on { background: #165dff; }
.figma-api-scenarios__settings button i { position: absolute; top: 2px; left: 14px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__run-config { box-sizing: border-box; width: 220px; flex: 0 0 220px; overflow-y: auto; border-left: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__run-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 10.5px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__run-actions select { grid-column: 1 / -1; }
.figma-api-scenarios__run-config label { display: block; margin: 10.5px; color: #4e5969; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__run-config select, .figma-api-scenarios__run-config input { box-sizing: border-box; width: 100%; height: 24.5px; margin-top: 3.5px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__run-config button { box-sizing: border-box; height: 28px; border: 1px solid #165dff; border-radius: 7px; background: #fff; color: #165dff; cursor: pointer; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__run-config .figma-api-scenarios__run-actions > button:first-of-type { background: #165dff; color: #fff; }
.figma-api-scenarios__numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.figma-api-scenarios__numbers label { margin: 0; }
.figma-api-scenarios__run-config label > button { display: block; width: auto; height: auto; margin-top: 3.5px; padding: 0; border: 0; color: #165dff; }

/* Editor states from Figma Make: multiple documents, compact step cards, data editing and local dialogs. */
.figma-api-scenarios__name { min-width: 0; overflow: hidden; padding: 0 14px; border: 0; background: transparent; color: #165dff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__row { cursor: default; }
.figma-api-scenarios__editor-head { position: relative; gap: 7px; }
.figma-api-scenarios__editor-head > button:first-child { flex: 0 0 auto; }
.figma-api-scenarios__editor-head > button:first-child.is-active { border-color: #bfd4ff; background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__editor-open-tabs { display: flex; min-width: 0; flex: 1; align-items: center; gap: 2px; overflow: hidden; }
.figma-api-scenarios__editor-open-tabs > button { display: inline-flex; min-width: 0; max-width: 190px; height: 26px; align-items: center; gap: 6px; padding: 0 8px 0 10px; border: 0; border-radius: 5px; background: transparent; color: #4e5969; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__editor-open-tabs > button.is-active { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__editor-open-tabs span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__editor-open-tabs svg { width: 12px; height: 12px; flex: 0 0 auto; color: #86909c; }
.figma-api-scenarios__tool-icon { display: inline-flex; align-items: center; justify-content: center; }
.figma-api-scenarios__tool-icon svg { width: 14px; height: 14px; }
.figma-api-scenarios__tab-menu { position: absolute; z-index: 12; top: 34px; right: 6px; width: 220px; padding: 4px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; box-shadow: 0 5px 16px rgba(29, 33, 41, .14); }
.figma-api-scenarios__tab-menu button { display: block; width: 100%; overflow: hidden; padding: 7px 8px; border: 0; border-radius: 4px; background: transparent; color: #4e5969; cursor: pointer; font-size: 12px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__tab-menu button:hover { background: #f2f3f5; color: #165dff; }
.figma-api-scenarios__steps-toolbar button { display: inline-flex; align-items: center; gap: 4px; }
.figma-api-scenarios__steps-toolbar button svg { width: 12px; height: 12px; }
.figma-api-scenarios__step-row { height: 48px; gap: 8px; padding: 0 10px; transition: border-color .15s ease, box-shadow .15s ease; }
.figma-api-scenarios__step-row:hover { border-color: #bfd4ff; box-shadow: 0 1px 3px rgba(22, 93, 255, .08); }
.figma-api-scenarios__step-row.is-disabled { background: #fafafa; opacity: .62; }
.figma-api-scenarios__step-toggle { position: relative; width: 28px; height: 16px; flex: 0 0 28px; padding: 0 !important; border-radius: 9px !important; background: #c9cdd4 !important; }
.figma-api-scenarios__step-toggle.is-on { background: #165dff !important; }
.figma-api-scenarios__step-toggle i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left .15s ease; }
.figma-api-scenarios__step-toggle.is-on i { left: 14px; }
.figma-api-scenarios__step-row p { display: flex; min-width: 0; align-items: baseline; gap: 7px; }
.figma-api-scenarios__step-row p strong { overflow: hidden; color: #4e5969; font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-row p small { overflow: hidden; color: #86909c; font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-actions { display: flex; margin-left: auto; opacity: 0; transition: opacity .15s ease; }
.figma-api-scenarios__step-row:hover .figma-api-scenarios__step-actions { opacity: 1; }
.figma-api-scenarios__step-actions button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border-radius: 4px; }
.figma-api-scenarios__step-actions button:hover:not(:disabled) { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__step-actions button:last-child:hover:not(:disabled) { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__step-actions button:disabled { cursor: not-allowed; opacity: .35; }
.figma-api-scenarios__step-actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__dataset-item { display: flex; align-items: center; border-radius: 7px; }
.figma-api-scenarios__dataset-item.is-active { background: #e8f3ff; }
.figma-api-scenarios__dataset-item > button:first-child { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; padding: 10px; border: 0; border-radius: 7px; background: transparent; color: #1d2129; cursor: pointer; text-align: left; }
.figma-api-scenarios__dataset-item > button:first-child > i { position: relative; width: 28px; height: 16px; flex: 0 0 28px; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__dataset-item > button:first-child > i.is-on { background: #165dff; }
.figma-api-scenarios__dataset-item > button:first-child > i span { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__dataset-item > button:first-child > i.is-on span { left: 14px; }
.figma-api-scenarios__dataset-item > button:first-child > span { min-width: 0; flex: 1; }
.figma-api-scenarios__dataset-item > button:first-child b, .figma-api-scenarios__dataset-item > button:first-child small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__dataset-item > button:first-child b { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__dataset-item.is-active > button:first-child b { color: #165dff; }
.figma-api-scenarios__dataset-item > button:first-child small { color: #86909c; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__dataset-more { display: inline-flex; width: 21px; height: 21px; align-items: center; justify-content: center; margin: 0; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__dataset-more:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__dataset-more svg { width: 13px; height: 13px; }
.figma-api-scenarios__settings { box-sizing: border-box; padding: 24px; background: #fff; }
.figma-api-scenarios__settings > article { display: flex; box-sizing: border-box; min-height: 74px; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 15px; border: 1px solid #e5e6eb; border-radius: 9px; background: #fff; }
.figma-api-scenarios__settings > article:last-child { margin-bottom: 0; }
.figma-api-scenarios__settings > article p { min-width: 0; padding-right: 20px; }
.figma-api-scenarios__run-config { background: #fafbfe; }
.figma-api-scenarios__run-actions { display: grid; grid-template-columns: 1fr 1fr; }
.figma-api-scenarios__run-actions > div { display: flex; grid-column: 1 / -1; gap: 6px; }
.figma-api-scenarios__run-actions > div select { flex: 1; }
.figma-api-scenarios__run-actions > div button { display: inline-flex; width: 28px; align-items: center; justify-content: center; padding: 0; border-color: #e5e6eb; background: #fff; color: #86909c; }
.figma-api-scenarios__run-actions > div button svg { width: 12px; height: 12px; }
.figma-api-scenarios__run-actions > button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.figma-api-scenarios__run-actions > button svg { width: 12px; height: 12px; }
.figma-api-scenarios__run-config label em { color: #f53f3f; font-style: normal; }
.figma-api-scenarios__tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.figma-api-scenarios__tag-list span { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 4px; background: #e8f3ff; color: #165dff; font-size: 11px; }
.figma-api-scenarios__tag-list span svg { width: 10px; height: 10px; cursor: pointer; }
.figma-api-scenarios__tag-list button { margin: 0; font-size: 11px; }
.figma-api-scenarios__overlay { position: absolute; z-index: 20; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(29, 33, 41, .34); }
.figma-api-scenarios__dialog { width: 440px; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(29, 33, 41, .2); }
.figma-api-scenarios__dialog header, .figma-api-scenarios__step-drawer header { display: flex; height: 48px; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dialog header b, .figma-api-scenarios__step-drawer header b { color: #1d2129; font-size: 14px; font-weight: 600; }
.figma-api-scenarios__dialog header button, .figma-api-scenarios__step-drawer header button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__dialog header svg, .figma-api-scenarios__step-drawer header svg { width: 14px; height: 14px; }
.figma-api-scenarios__dialog p { margin: 18px 16px; color: #4e5969; font-size: 13px; line-height: 20px; }
.figma-api-scenarios__step-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 18px 16px; }
.figma-api-scenarios__step-type-grid button { height: 70px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; cursor: pointer; font-size: 12px; }
.figma-api-scenarios__step-type-grid button:hover { border-color: #165dff; background: #f2f7ff; color: #165dff; }
.figma-api-scenarios__dialog footer, .figma-api-scenarios__step-drawer footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e6eb; }
.figma-api-scenarios__dialog footer button, .figma-api-scenarios__step-drawer footer button { height: 28px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font-size: 12px; }
.figma-api-scenarios__dialog footer button:last-child, .figma-api-scenarios__step-drawer footer button:last-child { border-color: #165dff; background: #165dff; color: #fff; }
.figma-api-scenarios__step-drawer { position: absolute; z-index: 18; top: 38px; right: 0; bottom: 0; width: 360px; border-left: 1px solid #e5e6eb; background: #fff; box-shadow: -6px 0 18px rgba(29, 33, 41, .12); }
.figma-api-scenarios__step-drawer label { display: block; margin: 16px; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__step-drawer input, .figma-api-scenarios__step-drawer select { box-sizing: border-box; width: 100%; height: 30px; margin-top: 6px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 6px; color: #1d2129; font-size: 12px; outline: 0; }
.figma-api-scenarios__step-drawer footer { position: absolute; right: 0; bottom: 0; left: 0; }

/* Figma node 210:2 scene list: compact document tabs, filter rail and full-width rows. */
.figma-api-scenarios__list { display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 0; overflow: hidden; background: #f4f6fa; }
.figma-api-scenarios__scene-tabbar { display: flex; box-sizing: border-box; height: 38px; flex: 0 0 38px; align-items: center; padding: 0 7px 1px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__scene-tabbar > button { display: inline-flex; box-sizing: border-box; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__scene-tabbar > button:first-child { width: auto; height: 25px; margin-right: 3.5px; padding: 0 10.5px; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-tabbar > button:first-child.is-active { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__scene-tabbar > button:hover:not(:first-child) { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-tabbar > i { width: 1px; height: 14px; margin-right: 0; background: #e5e6eb; }
.figma-api-scenarios__scene-tabbar svg { width: 14px; height: 14px; }
.figma-api-scenarios__scene-tabbar > button, .figma-api-scenarios__scene-tabbar > i, .figma-api-scenarios__scene-tab-strip { transform: translateY(.5px); }
.figma-api-scenarios__scene-tab-strip { display: flex; min-width: 0; height: 25px; flex: 1; align-items: center; overflow: hidden; padding: 0 3.5px; }
.figma-api-scenarios__scene-tab-strip > button { display: flex; box-sizing: border-box; width: 160.25px; height: 25px; flex: 0 0 160.25px; align-items: center; justify-content: flex-start; overflow: hidden; padding: 3.5px 10.5px; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-tab-strip > button > span { display: block; width: 120px; overflow: hidden; text-align: center; white-space: nowrap; }
.figma-api-scenarios__scene-tab-strip > button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-more { width: 24px !important; color: #c9cdd4 !important; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif !important; }
.figma-api-scenarios__scene-list { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: auto; background: #f4f6fa; }
.figma-api-scenarios__scene-filters { display: flex; box-sizing: border-box; height: 54px; flex: 0 0 54px; align-items: center; gap: 7px; padding: 11px 14px; border-bottom: 1px solid #e5e6eb; background: #f4f6fa; }
.figma-api-scenarios__scene-search { display: flex; box-sizing: border-box; width: 220px; height: 28px; align-items: center; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__scene-search svg { width: 13px; height: 13px; flex: 0 0 auto; margin-left: 8.75px; color: #86909c; }
.figma-api-scenarios__scene-search input { min-width: 0; width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: 400 12px/normal Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-search input::placeholder { color: rgba(29, 33, 41, .5); }
.figma-api-scenarios__scene-filters > select { box-sizing: border-box; width: 120px; height: 24.5px; padding: 0 24px 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; appearance: auto; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-filters > select:nth-of-type(2) { width: 100px; }
.figma-api-scenarios__scene-filters > span { flex: 1; }
.figma-api-scenarios__scene-list > .figma-api-scenarios__scene-filters .figma-api-scenarios__primary { flex: 0 0 98.25px; }
.figma-api-scenarios__scene-table { min-width: 0; flex: 0 0 auto; }
.figma-api-scenarios__scene-table > header, .figma-api-scenarios__scene-table > article { display: grid; grid-template-columns: 6.57% 31.84% 9.92% 11.78% 9.92% 23.17% 6.8%; min-width: 960px; align-items: center; }
.figma-api-scenarios__scene-table > header { box-sizing: border-box; height: 36px; border-bottom: 1px solid #e5e6eb; background: #f4f6fa; color: #86909c; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-table > header span { padding: 0 14px; }
.figma-api-scenarios__scene-table > header span:last-child { padding-right: 14px; text-align: right; }
.figma-api-scenarios__scene-table > article { box-sizing: border-box; min-height: 65px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__scene-table > article.is-alt { background: #fafbfe; }
.figma-api-scenarios__scene-table > article:hover { background: #f5f8ff; }
.figma-api-scenarios__scene-table > article > span { min-width: 0; padding: 0 14px; }
.figma-api-scenarios__scene-id { color: #86909c; font: 400 12px/18px "JetBrains Mono", Consolas, monospace; }
.figma-api-scenarios__scene-name { min-width: 0; padding: 9px 0 8px 14px; }
.figma-api-scenarios__scene-name > button { display: block; max-width: 100%; overflow: hidden; padding: 0; border: 0; background: transparent; color: #165dff; cursor: pointer; font: 500 14px/21px Inter, "Noto Sans SC", sans-serif; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-name > button:hover { text-decoration: underline; }
.figma-api-scenarios__scene-name > div { display: flex; gap: 3.5px; min-height: 18.5px; margin-top: 3.5px; overflow: hidden; }
.figma-api-scenarios__scene-name em { display: inline-flex; box-sizing: border-box; height: 18.5px; align-items: center; padding: 0 5.25px; border-radius: 3.5px; background: #f2f3f5; color: #86909c; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; font-style: normal; white-space: nowrap; }
.figma-api-scenarios__scene-priority { display: inline-flex; box-sizing: border-box; height: 17.5px; align-items: center; padding: 0 5.25px; border-radius: 3.5px; font: 700 11px/16.5px Inter, sans-serif; }
.figma-api-scenarios__scene-priority.is-p0 { background: #fee; color: #f53f3f; }
.figma-api-scenarios__scene-priority.is-p1 { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__scene-priority.is-p2 { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__scene-module, .figma-api-scenarios__scene-step-count { color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-result { display: inline-flex; align-items: center; gap: 5.25px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-result i { width: 5.25px; height: 5.25px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__scene-result.is-fail { color: #f53f3f; }
.figma-api-scenarios__scene-result.is-idle { color: #c9cdd4; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.figma-api-scenarios__scene-actions { display: inline-flex; justify-content: flex-end; gap: 1.75px; padding-right: 14px !important; opacity: 1; }
.figma-api-scenarios__scene-actions button { display: inline-flex; width: 21px; height: 21px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__scene-actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-actions button:last-child:hover { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__scene-actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__scene-empty { margin: 0; padding: 60px 0; color: #86909c; font-size: 13px; text-align: center; }

/* Figma scene detail states: design dimensions override the former compact prototype rules. */
.figma-api-scenarios__scene-info { box-sizing: border-box; height: 86.75px; padding: 10.5px 14px 11.5px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__scene-info.is-new { height: 65.25px; padding-bottom: 11.5px; }
.figma-api-scenarios__scene-info > div { display: flex; align-items: center; gap: 7px; height: 21px; margin: 0; }
.figma-api-scenarios__scene-info select { box-sizing: border-box; width: 51px; height: 21px; padding: 0 5px; border: 1px solid #ff7d00; border-radius: 3.5px; background: #fff3e8; color: #ff7d00; font: 700 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info > div > span { display: inline-flex; min-width: 0; align-items: center; gap: 5.25px; }
.figma-api-scenarios__scene-info input { width: 175px; height: 21px; padding: 0; border: 0; outline: 0; background: transparent; color: #1d2129; font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-name-button { display: inline-flex; min-width: 0; height: 21px; align-items: center; gap: 5.25px; padding: 0; border: 0; background: transparent; color: #1d2129; cursor: text; font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-name-button > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-info svg { width: 12px; height: 12px; flex: 0 0 auto; color: #86909c; }
.figma-api-scenarios__scene-info p { box-sizing: border-box; height: 23.25px; overflow: hidden; margin: 0; padding-top: 5.25px; color: #86909c; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-info small { box-sizing: border-box; display: block; height: 20.5px; margin: 0; padding-top: 3.5px; color: #c9cdd4; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info.is-new small { height: 22.25px; padding-top: 10.5px; }
.figma-api-scenarios__steps-toolbar { box-sizing: border-box; height: 41px; flex: 0 0 41px; padding: 0 14px; background: #f7f8fa; }
.figma-api-scenarios__steps-toolbar p { width: 69px; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__steps-toolbar p b { color: #1d2129; font-weight: 700; }
.figma-api-scenarios__steps-toolbar button { height: 26px; border-radius: 7px; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; white-space: nowrap; }
.figma-api-scenarios__steps-toolbar > div { gap: 7px; }
.figma-api-scenarios__steps-toolbar button:first-child { width: 88.25px; height: 24.5px; margin-top: .75px; padding-inline: 11.5px; }
.figma-api-scenarios__steps-toolbar button:last-child { width: 80.25px; padding-inline: 10px; font-size: 11px; line-height: 16.5px; }
.figma-api-scenarios__step-list { padding: 7px 10.5px 12px; background: #f7f8fa; }
.figma-api-scenarios__step-group { margin-bottom: 3.5px; }
.figma-api-scenarios__step-row { position: relative; height: 40.5px; min-height: 40.5px; gap: 7px; margin: 0; padding: 0 10.5px 0 15px; border-radius: 7px; box-shadow: none; }
.figma-api-scenarios__step-row-main { display: flex; min-width: 0; height: 100%; align-items: center; gap: 7px; }
.figma-api-scenarios__step-row.is-controller { display: block; height: 67.5px; padding: 0; border-left: 3px solid var(--step-color); }
.figma-api-scenarios__step-row.is-controller .figma-api-scenarios__step-row-main { box-sizing: border-box; height: 38px; padding: 0 10.5px 0 12px; }
.figma-api-scenarios__step-row:hover { border-color: #b9cbff; box-shadow: 0 2px 6px rgba(22, 93, 255, .06); }
.figma-api-scenarios__drag-handle { width: 14px; height: 14px; flex: 0 0 14px; color: #c9cdd4; cursor: grab; }
.figma-api-scenarios__step-row:hover .figma-api-scenarios__drag-handle { color: #86909c; }
.figma-api-scenarios__step-index { width: 17.5px !important; height: auto !important; flex: 0 0 17.5px; border-radius: 0 !important; background: transparent !important; color: #c9cdd4 !important; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif !important; text-align: center; }
.figma-api-scenarios__step-type, .figma-api-scenarios__method { display: inline-flex; box-sizing: border-box; height: 18.5px; flex: 0 0 auto; align-items: center; padding: 0 5.25px !important; border-radius: 3.5px; font: 700 10px/15px Inter, "Noto Sans SC", sans-serif !important; white-space: nowrap; }
.figma-api-scenarios__method { width: 49px; justify-content: center; padding: 0 !important; }
.figma-api-scenarios__method.is-get { background: #e8ffea; color: #00b42a; }
.figma-api-scenarios__method.is-post { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__method.is-put { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__method.is-delete { background: #ffeeee; color: #f53f3f; }
.figma-api-scenarios__method.is-patch { background: #f5e8ff; color: #7816ff; }
.figma-api-scenarios__step-row p { min-width: 0; margin: 0; }
.figma-api-scenarios__step-row p strong { color: #1d2129; font: 400 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-path { max-width: min(28vw, 260px); overflow: hidden; margin-left: auto; color: #86909c; font: 400 11px/16px "JetBrains Mono", Consolas, monospace; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-row em { display: inline-flex; box-sizing: border-box; height: 18px; align-items: center; padding: 0 5px; border-radius: 3px; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; font-style: normal; white-space: nowrap; }
.figma-api-scenarios__step-actions { position: absolute; z-index: 1; top: 8.25px; right: 10.5px; gap: 1px; background: #fff; }
.figma-api-scenarios__step-actions button { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 4px; }
.figma-api-scenarios__step-actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__step-actions button:last-child:hover { background: #ffeeee; color: #f53f3f; }
.figma-api-scenarios__step-actions svg { width: 12px; height: 12px; }
.figma-api-scenarios__step-row--child { margin-top: 2px; margin-left: 28px; padding-left: 10px; background: #fafbff; }
.figma-api-scenarios__child-indent { width: 14px; height: 14px; flex: 0 0 14px; color: #c9cdd4; }
.figma-api-scenarios__add-child { display: inline-flex; box-sizing: border-box; width: 103.25px; height: 27px; align-items: center; justify-content: center; gap: 5.25px; margin: 0 0 0 10.5px; padding: 0; border: 0; background: transparent; cursor: pointer; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__add-child svg { width: 11px; height: 11px; }
.figma-api-scenarios__add-step { box-sizing: border-box; height: 41px; margin-top: 3.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty { display: flex; box-sizing: border-box; height: 208.5px; min-height: 0; flex: 0 0 208.5px; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 63px; color: #86909c; background: #f7f8fa; }
.figma-api-scenarios__step-empty > svg { width: 32px; height: 32px; color: #c9cdd4; }
.figma-api-scenarios__step-empty p { margin: 10px 0; font: 400 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty button { display: inline-flex; height: 28px; align-items: center; gap: 4px; padding: 0 10px; border: 0; border-radius: 6px; background: #165dff; color: #fff; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty button svg { width: 12px; height: 12px; }

.figma-api-scenarios__test-data > .figma-api-scenarios__dataset-list { width: 220px; flex: 0 0 220px; }
.figma-api-scenarios__dataset-editor > header { box-sizing: border-box; height: 44.5px; min-height: 44.5px; padding: 0 12px; background: #fff; }
.figma-api-scenarios__dataset-editor > header b { font: 600 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-editor > header > div { gap: 7px; }
.figma-api-scenarios__dataset-editor > header button { display: inline-flex; height: 24.5px; align-items: center; gap: 5.25px; padding: 0 11.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-editor > header button svg { width: 12px; height: 12px; }
.figma-api-scenarios__dataset-editor > header i { margin: 0 3.5px; }
.figma-api-scenarios__dataset-table-scroll { background: #f4f6fa; }
.figma-api-scenarios__dataset-table-scroll table { width: 100%; table-layout: fixed; }
.figma-api-scenarios__dataset-index-column { width: 30px; }
.figma-api-scenarios__dataset-action-column { width: 33.75px; }
.figma-api-scenarios__dataset-editor thead,
.figma-api-scenarios__dataset-table-scroll th { height: 35px; }
.figma-api-scenarios__dataset-table-scroll th { min-width: 0; padding: 0 10px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll th:first-child { width: 30px; min-width: 30px; padding: 0; text-align: center; }
.figma-api-scenarios__dataset-editor tbody tr,
.figma-api-scenarios__dataset-table-scroll td { height: 33px; }
.figma-api-scenarios__dataset-table-scroll td { box-sizing: border-box; padding: 0 10px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll td:first-child { width: 30px; min-width: 30px; padding: 0; }
.figma-api-scenarios__dataset-table-scroll th:last-child,
.figma-api-scenarios__dataset-table-scroll td:last-child { width: 33.75px; padding: 0; text-align: center; }
.figma-api-scenarios__dataset-editor td input { height: 21px; padding: 0 6px; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll th button,
.figma-api-scenarios__dataset-table-scroll td:last-child button { width: 21px; height: 21px; }
.figma-api-scenarios__dataset-table-scroll svg { width: 13px; height: 13px; }
.figma-api-scenarios__settings { box-sizing: border-box; width: auto; min-width: 0; min-height: 0; flex: 1; padding: 21px 22px; background: #f4f6fa; }
.figma-api-scenarios__settings > .figma-api-scenarios__settings-panel { display: block; box-sizing: border-box; width: 448px; min-height: 0; padding: 0; border: 0; }
.figma-api-scenarios__settings-panel > article { display: flex; box-sizing: border-box; min-height: 69.75px; align-items: center; justify-content: space-between; margin: 0 0 17.5px; padding: 14px; border: 1px solid #e5e6eb; border-radius: 8px; background: #f4f6fa; }
.figma-api-scenarios__settings-panel > article:last-child { margin-bottom: 0; }
.figma-api-scenarios__settings-panel > article p { min-width: 0; margin: 0; padding-right: 15px; }
.figma-api-scenarios__settings-panel b { font: 500 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__settings-panel span { font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__settings-panel input { box-sizing: border-box; width: 84px; height: 28px; padding: 0 11.5px; color: #1d2129; font: 400 13px/19.5px Inter, "Noto Sans SC", sans-serif; text-align: right; }

.figma-api-scenarios__last-run { margin-top: auto; padding: 11px 10.5px; border-top: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__last-run p { margin: 0 0 5px; color: #86909c; font: 500 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong { display: inline-flex; align-items: center; gap: 5px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong.is-fail { color: #f53f3f; }
.figma-api-scenarios__last-run strong i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__last-run small { display: block; margin-top: 2px; color: #86909c; font: 400 10px/15px "JetBrains Mono", Consolas, monospace; }

/* Figma 204:825: scene editor sub-tabs are fixed 37px controls in a 38px rail. */
.figma-api-scenarios__editor-tabs { box-sizing: border-box; padding: 0 14px; background: #fff; }
.figma-api-scenarios__editor-tabs button { display: inline-flex; box-sizing: border-box; height: 37px; align-items: center; justify-content: center; padding: 0 14px 2px; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__editor-tabs button:nth-child(1) { width: 78px; }
.figma-api-scenarios__editor-tabs.is-empty button:nth-child(1) { width: 72px; }
.figma-api-scenarios__editor-tabs button:nth-child(2) { width: 76px; }
.figma-api-scenarios__editor-tabs button:nth-child(3) { width: 52px; }

/* Figma 204:825: the run rail is a fixed form block followed by a bottom-anchored result block. */
.figma-api-scenarios__run-config { display: flex; height: 100%; flex-direction: column; overflow: hidden; }
.figma-api-scenarios__run-fields { box-sizing: border-box; height: 370.25px; flex: 0 0 370.25px; padding: 10.5px; }
.figma-api-scenarios__run-config.is-new .figma-api-scenarios__run-fields { height: 343.25px; flex-basis: 343.25px; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label { display: block; width: 198px; height: 46px; margin: 0; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label + label,
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers + label { margin-top: 10.5px; }
.figma-api-scenarios .figma-api-scenarios__run-fields select,
.figma-api-scenarios .figma-api-scenarios__run-fields input { box-sizing: border-box; width: 100%; height: 24.5px; margin-top: 3.5px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers { display: grid; box-sizing: border-box; width: 198px; height: 46px; grid-template-columns: 95.5px 95.5px; gap: 7px; margin: 10.5px 0; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers label { width: 95.5px; height: 46px; margin: 0; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers input { width: 56px; color: #1d2129; text-align: center; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label:last-child { height: 66.75px; }
.figma-api-scenarios__tag-list { gap: 3px 3.5px; margin-top: 5.25px; }
.figma-api-scenarios__tag-list span { box-sizing: border-box; height: 20.5px; gap: 1.75px; padding: 1.75px 7px; border-radius: 999px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__tag-list span svg { width: 9px; height: 9px; }
.figma-api-scenarios__tag-list button { box-sizing: border-box; width: 33px; height: 20px; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; color: #86909c; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run { box-sizing: border-box; display: flex; width: 219px; height: 77.25px; flex: 0 0 77.25px; flex-direction: column; margin-top: auto; padding: 10.5px 10.5px; border-top: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__last-run p { height: 17px; margin: 0; color: #86909c; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong { box-sizing: border-box; height: 21.5px; gap: 5.25px; padding-top: 3.5px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong i { width: 5.25px; height: 5.25px; }
.figma-api-scenarios__last-run small { box-sizing: border-box; height: 16.75px; margin: 0; padding-top: 1.75px; color: #c9cdd4; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; }

/* Figma 206:2158: right-side run configuration uses a compact 220px form rail. */
.figma-api-scenarios__run-config label { box-sizing: border-box; margin: 10.5px; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__run-config select, .figma-api-scenarios__run-config input { height: 24.5px; margin-top: 3.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__run-actions { box-sizing: border-box; grid-template-columns: 94.5px 96.5px; grid-template-rows: 24.5px 28px; gap: 7px; padding: 10.5px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__run-actions > div { gap: 5.25px; }
.figma-api-scenarios__run-actions > div select { margin-top: 0; }
.figma-api-scenarios__run-actions > div button { width: 24.5px; height: 24.5px; border-radius: 7px; }
.figma-api-scenarios__run-actions > button { height: 28px; border-radius: 7px; }
.figma-api-scenarios__run-actions > button:first-of-type { font-weight: 600; }
.figma-api-scenarios__run-actions > button:last-of-type { border-color: #e5e6eb; color: #4e5969; font-weight: 500; }

.figma-api-scenarios__dialog { width: 640px; border-radius: 8px; }
.figma-api-scenarios__dialog:not(.is-import) { height: 476.75px; }
.figma-api-scenarios__dialog:not(.is-import) > header { box-sizing: border-box; height: 53.5px; padding: 0 17.5px; }
.figma-api-scenarios__dialog:not(.is-import) > header b { font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dialog:not(.is-import) > header button { width: 24.5px; height: 24.5px; }
.figma-api-scenarios__dialog:not(.is-import) > header svg { width: 15px; height: 15px; }
.figma-api-scenarios__step-type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(5, 69.25px); gap: 10.5px; padding: 17.5px; }
.figma-api-scenarios__step-type-grid button { display: grid; box-sizing: border-box; height: 69.25px; min-height: 69.25px; grid-template-columns: 28px minmax(0, 1fr); grid-template-rows: 19.5px 18px; column-gap: 10.5px; padding: 15px; border-radius: 11px; text-align: left; }
.figma-api-scenarios__step-type-grid button > span { display: inline-flex; width: 28px; height: 28px; grid-row: 1 / 3; align-self: start; align-items: center; justify-content: center; margin-top: 1.75px; border-radius: 7px; }
.figma-api-scenarios__step-type-grid button > span svg { width: 16px; height: 16px; }
.figma-api-scenarios__step-type-grid button b { color: #1d2129; font: 600 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-type-grid button small { color: #86909c; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }

.figma-api-scenarios__step-drawer { top: 38px; width: 640px; display: flex; flex-direction: column; }
.figma-api-scenarios__step-drawer > header { flex: 0 0 48px; }
.figma-api-scenarios__step-drawer > header > div { display: flex; align-items: baseline; gap: 8px; }
.figma-api-scenarios__step-drawer > header small { color: #86909c; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer > nav { display: flex; height: 36px; flex: 0 0 36px; gap: 18px; padding: 0 16px; overflow-x: auto; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__step-drawer > nav button { height: 36px; flex: 0 0 auto; padding: 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #4e5969; cursor: pointer; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer > nav button.is-active { border-bottom-color: #165dff; color: #165dff; font-weight: 500; }
.figma-api-scenarios__drawer-content { min-height: 0; flex: 1; overflow: auto; padding: 18px 20px 72px; }
.figma-api-scenarios__drawer-content > label, .figma-api-scenarios__request-line > label { display: block; margin: 0 0 16px; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__drawer-content input, .figma-api-scenarios__drawer-content select { box-sizing: border-box; width: 100%; height: 30px; margin-top: 6px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 6px; color: #1d2129; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; outline: 0; }
.figma-api-scenarios__request-line { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; }
.figma-api-scenarios__debug-response { margin-top: 24px; border: 1px solid #e5e6eb; border-radius: 7px; overflow: hidden; }
.figma-api-scenarios__debug-response > header { display: flex; height: 34px; align-items: center; justify-content: space-between; padding: 0 10px; border: 0; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__debug-response > header span { color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__debug-response > header button { display: inline-flex; width: auto; height: 22px; align-items: center; gap: 3px; padding: 0 7px; border: 0; border-radius: 4px; background: #e8f3ff; color: #165dff; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__debug-response > header button svg { width: 11px; height: 11px; }
.figma-api-scenarios__debug-response p { margin: 0; padding: 14px; color: #86909c; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer footer { z-index: 1; flex: 0 0 53px; }
</style>
