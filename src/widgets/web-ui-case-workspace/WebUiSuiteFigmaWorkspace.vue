<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Edit2,
  GripVertical,
  Monitor,
  Plus,
  Play,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  formatBrowserType,
  formatDurationMs,
  webUiAutomationApi,
  type WebUiCaseItem,
  type WebUiEnvironmentItem,
  type WebUiRunBatchSummary,
  type WebUiRunStatus,
} from '@/entities/web-ui-automation'
import {
  isRunnerOnline,
  isRunnerSelectable,
  localRunnerApi,
  runnerDisplayName,
  runnerStatusText,
  selectDefaultRunnerId,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { getRequestErrorMessage } from '@/shared/api/error'
import WebUiModuleTabs from './WebUiModuleTabs.vue'

const props = withDefaults(defineProps<{
  workspaceCode?: string
  workspaceReady?: boolean
}>(), {
  workspaceCode: 'ALL',
  workspaceReady: false,
})

type Priority = 'P0' | 'P1' | 'P2' | 'P3' | '—'
type Result = 'pass' | 'fail' | 'running' | null
type RunMode = 'serial' | 'parallel'
type RunLocation = 'server' | 'runner'
type SubTab = 'arrange' | 'records'

type SuiteCase = {
  id: string
  caseId: number
  name: string
  directory: string
  priority: Priority
  status: 'enabled' | 'disabled' | 'draft'
  enabled: boolean
  result: Result
  browser: string
  headless: boolean
}

type Suite = {
  id: string
  name: string
  priority: Priority
  cases: SuiteCase[]
  environmentId: number | null
  browser: string
  runMode: RunMode
  runLocation: RunLocation
  runnerId: string
  notify: boolean
  failurePolicy: string
  screenshotPolicy: string
  timeout: number
  lastRun: string | null
  lastResult: Result
}

type AvailableCase = Omit<SuiteCase, 'id' | 'enabled'> & { id: number }

type RunRecord = {
  id: number
  time: string
  environment: string
  browser: string
  pass: number
  total: number
  duration: string
  operator: string
  result: Result
  source: WebUiRunBatchSummary
}

const priorityStyles: Record<Priority, { color: string; background: string }> = {
  P0: { color: '#f53f3f', background: '#ffeeee' },
  P1: { color: '#ff7d00', background: '#fff3e8' },
  P2: { color: '#165dff', background: '#e8f3ff' },
  P3: { color: '#86909c', background: '#f2f3f5' },
  '—': { color: '#86909c', background: '#f2f3f5' },
}

const availableCases = ref<AvailableCase[]>([])
const environments = ref<WebUiEnvironmentItem[]>([])
const runners = ref<RunnerNodeSummary[]>([])
const suites = ref<Suite[]>([])
const runRecords = ref<RunRecord[]>([])

const suiteSearch = ref('')
const selectedSuiteId = ref<string | null>(null)
const subTab = ref<SubTab>('arrange')
const editingName = ref(false)
const addCaseVisible = ref(false)
const selectedAvailableCaseIds = ref<number[]>([])
const loading = ref(false)
const running = ref(false)
let draftSequence = 0
let workspaceRequestVersion = 0

const selectedSuite = computed(() => suites.value.find(item => item.id === selectedSuiteId.value) || null)
const filteredSuites = computed(() => {
  const keyword = suiteSearch.value.trim().toLowerCase()
  return keyword ? suites.value.filter(item => item.name.toLowerCase().includes(keyword)) : suites.value
})
const selectedSuiteCaseIds = computed(() => new Set(selectedSuite.value?.cases.map(item => item.caseId) || []))
const selectedCaseCount = computed(() => selectedAvailableCaseIds.value.length)

function updateSuite(patch: Partial<Suite>) {
  const suite = selectedSuite.value
  if (!suite) return
  suites.value = suites.value.map(item => item.id === suite.id ? { ...item, ...patch } : item)
}

function updateSuiteCases(cases: SuiteCase[]) {
  updateSuite({ cases })
}

function createSuite(focusName = true) {
  const id = `draft-suite-${Date.now()}-${++draftSequence}`
  suites.value.push({
    id,
    name: '未命名套件',
    priority: 'P2',
    cases: [],
    environmentId: environments.value.find(item => item.status !== 0)?.id ?? null,
    browser: 'Chrome',
    runMode: 'serial',
    runLocation: 'server',
    runnerId: selectDefaultRunnerId(runners.value, null, 'WEB_CASE_RUN') || '',
    notify: false,
    failurePolicy: '遇到失败继续执行',
    screenshotPolicy: '仅失败时截图',
    timeout: 60,
    lastRun: null,
    lastResult: null,
  })
  selectedSuiteId.value = id
  subTab.value = 'arrange'
  editingName.value = focusName
}

function moveSuiteCase(index: number, direction: -1 | 1) {
  const cases = [...(selectedSuite.value?.cases || [])]
  const next = index + direction
  if (next < 0 || next >= cases.length) return
  ;[cases[index], cases[next]] = [cases[next], cases[index]]
  updateSuiteCases(cases)
}

function removeSuiteCase(id: string) {
  updateSuiteCases((selectedSuite.value?.cases || []).filter(item => item.id !== id))
}

function toggleSuiteCase(id: string) {
  updateSuiteCases((selectedSuite.value?.cases || []).map(item => item.id === id ? { ...item, enabled: !item.enabled } : item))
}

async function openAddCaseDialog() {
  if (!availableCases.value.length) {
    await loadCases(workspaceRequestVersion)
  }
  selectedAvailableCaseIds.value = []
  addCaseVisible.value = true
}

function toggleAvailableCase(id: number) {
  selectedAvailableCaseIds.value = selectedAvailableCaseIds.value.includes(id)
    ? selectedAvailableCaseIds.value.filter(item => item !== id)
    : [...selectedAvailableCaseIds.value, id]
}

function addSelectedCases() {
  const suite = selectedSuite.value
  if (!suite) return
  const additions = availableCases.value
    .filter(item => selectedAvailableCaseIds.value.includes(item.id))
    .map(item => ({ ...item, id: `${suite.id}-${item.id}-${Date.now()}`, enabled: true }))
  updateSuiteCases([...(selectedSuite.value?.cases || []), ...additions])
  addCaseVisible.value = false
}

function priorityStyle(priority: Priority) {
  return priorityStyles[priority]
}

function resultText(result: Result) {
  return result === 'pass' ? '通过' : result === 'fail' ? '失败' : result === 'running' ? '运行中' : '未运行'
}

function statusText(status: SuiteCase['status']) {
  return status === 'enabled' ? '已启用' : status === 'disabled' ? '已停用' : '草稿'
}

function statusColor(status: SuiteCase['status']) {
  return status === 'enabled' ? '#00b42a' : status === 'disabled' ? '#c9cdd4' : '#ff7d00'
}

function mapCaseStatus(status: WebUiCaseItem['status']): SuiteCase['status'] {
  if (status === 'ENABLED') return 'enabled'
  if (status === 'DISABLED') return 'disabled'
  return 'draft'
}

function mapRunResult(status?: WebUiRunStatus | string | null): Result {
  if (status === 'SUCCESS') return 'pass'
  if (status === 'RUNNING') return 'running'
  if (status === 'FAILED' || status === 'CANCELED') return 'fail'
  return null
}

function formatDateTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—'
}

function mapAvailableCase(item: WebUiCaseItem): AvailableCase {
  return {
    id: item.id,
    caseId: item.id,
    name: item.name,
    directory: item.moduleName || '未归属模块',
    priority: '—',
    status: mapCaseStatus(item.status),
    result: mapRunResult(item.lastRunResult),
    browser: formatBrowserType(item.browserType),
    headless: item.headless,
  }
}

function mapRunRecord(item: WebUiRunBatchSummary): RunRecord {
  return {
    id: item.id,
    time: formatDateTime(item.startedAt || item.createdAt),
    environment: item.environmentName || '用例默认环境',
    browser: '浏览器由用例决定',
    pass: item.successCases,
    total: item.totalCases,
    duration: formatDurationMs(item.durationMs).replace(' s', 's'),
    operator: item.operatorName || item.source || '—',
    result: mapRunResult(item.status),
    source: item,
  }
}

async function loadCases(requestVersion: number) {
  try {
    const response = await webUiAutomationApi.getCases(props.workspaceCode, { pageNo: 1, pageSize: 1000 })
    if (requestVersion !== workspaceRequestVersion) return
    availableCases.value = response.items.map(mapAvailableCase)
  } catch (error) {
    if (requestVersion !== workspaceRequestVersion) return
    availableCases.value = []
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadEnvironments(requestVersion: number) {
  try {
    const response = await webUiAutomationApi.getEnvironments(props.workspaceCode)
    if (requestVersion !== workspaceRequestVersion) return
    environments.value = response.items
  } catch (error) {
    if (requestVersion !== workspaceRequestVersion) return
    environments.value = []
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadRunners(requestVersion: number) {
  try {
    const response = await localRunnerApi.getRunnerNodes({ taskType: 'WEB_CASE_RUN', resourceCost: 1 })
    if (requestVersion !== workspaceRequestVersion) return
    runners.value = response
  } catch (error) {
    if (requestVersion !== workspaceRequestVersion) return
    runners.value = []
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadRunRecords(requestVersion = workspaceRequestVersion) {
  try {
    const response = await webUiAutomationApi.getBatches(props.workspaceCode, { pageNo: 1, pageSize: 20 })
    if (requestVersion !== workspaceRequestVersion) return
    runRecords.value = response.items.map(mapRunRecord)
    syncSelectedSuiteLastRun()
  } catch (error) {
    if (requestVersion !== workspaceRequestVersion) return
    runRecords.value = []
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function syncSelectedSuiteLastRun() {
  const suite = selectedSuite.value
  if (!suite) return
  const latest = runRecords.value.find(item => item.source.batchName === suite.name)
  if (!latest) return
  updateSuite({ lastRun: latest.time, lastResult: latest.result })
}

async function reloadWorkspaceData() {
  const requestVersion = ++workspaceRequestVersion
  suites.value = []
  selectedSuiteId.value = null
  availableCases.value = []
  environments.value = []
  runners.value = []
  runRecords.value = []
  if (!props.workspaceReady) return

  loading.value = true
  await Promise.all([
    loadCases(requestVersion),
    loadEnvironments(requestVersion),
    loadRunners(requestVersion),
    loadRunRecords(requestVersion),
  ])
  if (requestVersion === workspaceRequestVersion) {
    loading.value = false
    createSuite(false)
  }
}

function saveSuite() {
  ElMessage.info('后台尚无 Web UI 套件 CRUD，当前编排是未保存草稿；已记录到遗留问题')
}

async function runSuite() {
  const suite = selectedSuite.value
  if (!suite || running.value) return
  const enabledCases = suite.cases.filter(item => item.enabled)
  if (!enabledCases.length) {
    ElMessage.warning('请先添加并启用至少一个 Web UI 用例')
    return
  }
  if (enabledCases.some(item => item.status !== 'enabled')) {
    ElMessage.warning('批量运行只支持已启用用例，请先移除或停用草稿/已停用用例')
    return
  }
  if (suite.runLocation === 'runner') {
    ElMessage.info('当前批量运行接口不接收 Runner ID，无法按所选 Runner 执行；已记录到遗留问题')
    return
  }
  if (suite.runMode === 'parallel') {
    ElMessage.info('当前批量运行接口只按用例顺序执行，不支持并行模式；已记录到遗留问题')
    return
  }
  if (suite.notify) {
    ElMessage.info('当前批量运行接口没有本次运行通知开关，请关闭通知后运行')
    return
  }
  if (suite.failurePolicy === '当前用例失败跳过') {
    ElMessage.info('当前批量运行接口不支持“当前用例失败跳过”策略；已记录到遗留问题')
    return
  }

  running.value = true
  try {
    const result = await webUiAutomationApi.runBatch(props.workspaceCode, {
      batchName: suite.name.trim() || `Web UI 批量运行 ${new Date().toLocaleString()}`,
      caseIds: enabledCases.map(item => item.caseId),
      environmentId: suite.environmentId,
      headless: suite.browser.includes('无头'),
      stopOnFailure: suite.failurePolicy === '遇到失败立即中止',
    })
    updateSuite({
      lastRun: formatDateTime(new Date().toISOString()),
      lastResult: mapRunResult(result.status),
    })
    ElMessage.success(result.status === 'SUCCESS' ? '批量运行成功' : '批量运行完成，请查看运行结果')
    await loadRunRecords()
    subTab.value = 'records'
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    running.value = false
  }
}

function openRunRecord(record: RunRecord) {
  ElMessage.info(`批次 #${record.id} 已有真实详情数据，但当前 Figma 页面没有批次详情抽屉设计`)
}

function handleUnsupportedSetting(setting: string) {
  ElMessage.info(`${setting}没有进入当前 Web UI 批量运行接口，本次草稿不会把该值伪装成已保存配置`)
}

watch(() => [props.workspaceCode, props.workspaceReady] as const, () => {
  void reloadWorkspaceData()
}, { immediate: true })

watch(selectedSuiteId, syncSelectedSuiteLastRun)
</script>

<template>
  <section class="web-ui-suite-workspace">
    <WebUiModuleTabs active="suites" />

    <div class="web-ui-suite-workspace__body">
      <aside class="web-ui-suite-list">
        <header class="web-ui-suite-list__search">
          <label>
            <Search aria-hidden="true" />
            <input v-model="suiteSearch" placeholder="搜索套件..." />
          </label>
          <button type="button" aria-label="新建套件" @click="createSuite()"><Plus /></button>
        </header>

        <div class="web-ui-suite-list__items">
          <button
            v-for="suite in filteredSuites"
            :key="suite.id"
            class="web-ui-suite-list__item"
            :class="{ 'is-active': suite.id === selectedSuiteId }"
            type="button"
            @click="selectedSuiteId = suite.id; subTab = 'arrange'; editingName = false"
          >
            <span class="web-ui-suite-list__name">
              <b :style="priorityStyle(suite.priority)">{{ suite.priority }}</b>
              <strong>{{ suite.name }}</strong>
            </span>
            <span class="web-ui-suite-list__meta">
              <span>{{ suite.cases.length }} 个用例</span><i>·</i>
              <em :class="suite.lastResult || 'is-pending'">{{ resultText(suite.lastResult) }}</em>
            </span>
          </button>
        </div>

        <footer class="web-ui-suite-list__footer">
          <button type="button" @click="createSuite()"><Plus />新建套件</button>
        </footer>
      </aside>

      <main v-if="selectedSuite" class="web-ui-suite-editor">
        <header class="web-ui-suite-editor__toolbar">
          <select v-model="selectedSuite.priority" class="web-ui-suite-priority" :style="priorityStyle(selectedSuite.priority)" aria-label="套件优先级">
            <option v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority">{{ priority }}</option>
          </select>

          <input
            v-if="editingName"
            v-model="selectedSuite.name"
            class="web-ui-suite-name-input"
            autofocus
            @blur="editingName = false"
            @keydown.enter="editingName = false"
          />
          <button v-else type="button" class="web-ui-suite-name" @click="editingName = true">
            <strong>{{ selectedSuite.name }}</strong><Edit2 />
          </button>

          <div class="web-ui-suite-editor__spacer" />
          <div class="web-ui-suite-segmented web-ui-suite-run-mode">
            <button :class="{ 'is-active': selectedSuite.runMode === 'serial' }" type="button" @click="updateSuite({ runMode: 'serial' })">串行</button>
            <button :class="{ 'is-active': selectedSuite.runMode === 'parallel' }" type="button" @click="updateSuite({ runMode: 'parallel' })">并行</button>
          </div>
          <label class="web-ui-suite-toolbar-select">
            <span>环境</span>
            <select v-model="selectedSuite.environmentId" aria-label="执行环境">
              <option :value="null">用例默认环境</option><option v-for="environment in environments" :key="environment.id" :value="environment.id">{{ environment.name }}</option>
            </select>
          </label>
          <label class="web-ui-suite-toolbar-select web-ui-suite-toolbar-select--browser">
            <Monitor aria-hidden="true" />
            <select v-model="selectedSuite.browser" aria-label="浏览器" @change="handleUnsupportedSetting('浏览器类型覆盖')">
              <option>Chrome</option><option>Firefox</option><option>Safari</option><option>Edge</option><option>Chrome (无头)</option>
            </select>
          </label>
          <label class="web-ui-suite-notify">通知
            <button
              class="web-ui-suite-switch"
              :class="{ 'is-on': selectedSuite.notify }"
              type="button"
              role="switch"
              :aria-checked="selectedSuite.notify"
              @click="updateSuite({ notify: !selectedSuite.notify })"
            ><i /></button>
          </label>
          <button class="web-ui-suite-save" type="button" :disabled="loading || running" @click="saveSuite"><Save />保存</button>
          <button class="web-ui-suite-run" type="button" :disabled="loading || running" @click="runSuite"><Play />{{ running ? '运行中' : '运行' }}</button>
        </header>

        <nav class="web-ui-suite-sub-tabs" role="tablist" aria-label="套件详情">
          <button :class="{ 'is-active': subTab === 'arrange' }" type="button" role="tab" :aria-selected="subTab === 'arrange'" @click="subTab = 'arrange'">用例编排 ({{ selectedSuite.cases.length }})</button>
          <button :class="{ 'is-active': subTab === 'records' }" type="button" role="tab" :aria-selected="subTab === 'records'" @click="subTab = 'records'">运行结果</button>
        </nav>

        <div v-if="subTab === 'arrange'" class="web-ui-suite-arrange">
          <section class="web-ui-suite-arrange__cases">
            <header>
              <span>共 <b>{{ selectedSuite.cases.length }}</b> 个用例，按顺序执行</span>
              <button type="button" @click="openAddCaseDialog"><Plus />添加用例</button>
            </header>
            <div class="web-ui-suite-arrange__list">
              <template v-if="selectedSuite.cases.length">
                <article
                  v-for="(suiteCase, index) in selectedSuite.cases"
                  :key="suiteCase.id"
                  class="web-ui-suite-case"
                  :class="{ 'is-disabled': !suiteCase.enabled }"
                >
                  <GripVertical class="web-ui-suite-case__grip" />
                  <button class="web-ui-suite-switch" :class="{ 'is-on': suiteCase.enabled }" type="button" role="switch" :aria-checked="suiteCase.enabled" @click="toggleSuiteCase(suiteCase.id)"><i /></button>
                  <span class="web-ui-suite-case__order">{{ index + 1 }}</span>
                  <b class="web-ui-suite-case__priority" :style="priorityStyle(suiteCase.priority)">{{ suiteCase.priority }}</b>
                  <strong>{{ suiteCase.name }}</strong>
                  <span class="web-ui-suite-case__directory">{{ suiteCase.directory }}</span>
                  <em :class="suiteCase.result || 'is-pending'">{{ suiteCase.result === 'pass' ? '✓ 通过' : suiteCase.result === 'fail' ? '✗ 失败' : '未运行' }}</em>
                  <span class="web-ui-suite-case__actions">
                    <button type="button" :disabled="index === 0" aria-label="上移" @click="moveSuiteCase(index, -1)"><ArrowUp /></button>
                    <button type="button" :disabled="index === selectedSuite.cases.length - 1" aria-label="下移" @click="moveSuiteCase(index, 1)"><ArrowDown /></button>
                    <button type="button" aria-label="删除用例" @click="removeSuiteCase(suiteCase.id)"><Trash2 /></button>
                  </span>
                </article>
                <button class="web-ui-suite-add-line" type="button" @click="openAddCaseDialog"><Plus />添加用例</button>
              </template>
              <div v-else class="web-ui-suite-empty">
                <p>套件还没有用例</p>
                <button type="button" @click="openAddCaseDialog"><Plus />添加 Web UI 用例</button>
              </div>
            </div>
          </section>

          <aside class="web-ui-suite-settings">
            <section>
              <h3>运行位置</h3>
              <div class="web-ui-suite-segmented">
                <button :class="{ 'is-active': selectedSuite.runLocation === 'server' }" type="button" @click="updateSuite({ runLocation: 'server' })">服务端</button>
                <button :class="{ 'is-active': selectedSuite.runLocation === 'runner' }" type="button" @click="updateSuite({ runLocation: 'runner' })">Runner</button>
              </div>
            </section>
            <section v-if="selectedSuite.runLocation === 'runner'" class="web-ui-suite-runners">
              <label v-for="runner in runners" :key="runner.runnerId">
                <input v-model="selectedSuite.runnerId" type="radio" name="web-ui-suite-runner" :value="runner.runnerId" :disabled="!isRunnerSelectable(runner, 'WEB_CASE_RUN')" />
                <i :class="{ 'is-online': isRunnerOnline(runner) }" />
                <span><b>{{ runnerDisplayName(runner) }}</b><small>{{ runnerStatusText(runner) }}</small></span>
              </label>
            </section>
            <label class="web-ui-suite-setting-field">失败策略<select v-model="selectedSuite.failurePolicy"><option>遇到失败继续执行</option><option>遇到失败立即中止</option><option>当前用例失败跳过</option></select></label>
            <label class="web-ui-suite-setting-field">截图策略<select v-model="selectedSuite.screenshotPolicy" @change="handleUnsupportedSetting('截图策略')"><option>仅失败时截图</option><option>每步都截图</option><option>不截图</option></select></label>
            <label class="web-ui-suite-setting-field">超时 (s)<input v-model.number="selectedSuite.timeout" type="number" min="1" @change="handleUnsupportedSetting('套件级超时')" /></label>
            <section v-if="selectedSuite.lastRun" class="web-ui-suite-last-run">
              <h3>上次运行</h3>
              <b :class="selectedSuite.lastResult">{{ resultText(selectedSuite.lastResult) }}</b>
              <small>{{ selectedSuite.lastRun }}</small>
            </section>
          </aside>
        </div>

        <section v-else class="web-ui-suite-records">
          <header><strong>最近运行记录</strong><button type="button" @click="loadRunRecords()"><RefreshCw />刷新</button></header>
          <button v-for="record in runRecords" :key="record.id" type="button" class="web-ui-suite-record" @click="openRunRecord(record)">
            <b :class="record.result">{{ resultText(record.result) }}</b>
            <span><strong>{{ record.browser }} · {{ record.environment }}</strong><small>{{ record.time }} · {{ record.operator }}</small></span>
            <em :class="record.result">{{ record.pass }}/{{ record.total }} 通过<small>{{ record.duration }}</small></em>
            <ChevronRight />
          </button>
        </section>
      </main>
    </div>

    <Teleport to="body">
      <div v-if="addCaseVisible" class="web-ui-suite-dialog" role="dialog" aria-modal="true" aria-label="添加 Web UI 用例">
        <div class="web-ui-suite-dialog__mask" @click="addCaseVisible = false" />
        <section class="web-ui-suite-dialog__panel">
          <header><h2>添加 Web UI 用例</h2><button type="button" aria-label="关闭" @click="addCaseVisible = false"><X /></button></header>
          <div class="web-ui-suite-dialog__table">
            <div class="web-ui-suite-dialog__thead"><span /><span>用例名称</span><span>所属目录</span><span>优先级</span><span>状态</span><span>最近结果</span></div>
            <label v-for="caseItem in availableCases" :key="caseItem.id" class="web-ui-suite-dialog__row" :class="{ 'is-existing': selectedSuiteCaseIds.has(caseItem.caseId) }">
              <span v-if="selectedSuiteCaseIds.has(caseItem.caseId)" class="web-ui-suite-dialog__existing">已在套件</span>
              <input v-else type="checkbox" :checked="selectedAvailableCaseIds.includes(caseItem.id)" @change="toggleAvailableCase(caseItem.id)" />
              <strong>{{ caseItem.name }}</strong><span>{{ caseItem.directory }}</span><b :style="priorityStyle(caseItem.priority)">{{ caseItem.priority }}</b>
              <span class="web-ui-suite-dialog__status"><i :style="{ background: statusColor(caseItem.status) }" />{{ statusText(caseItem.status) }}</span>
              <em :class="caseItem.result || 'is-pending'">{{ resultText(caseItem.result) }}</em>
            </label>
          </div>
          <footer><p>已选 <b>{{ selectedCaseCount }}</b> 个用例</p><span><button type="button" @click="addCaseVisible = false">取消</button><button type="button" :disabled="!selectedCaseCount" @click="addSelectedCases">添加 {{ selectedCaseCount ? `(${selectedCaseCount})` : '' }} 个用例</button></span></footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.web-ui-suite-workspace { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; color: #1d2129; font-family: Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-workspace__body { display: flex; min-width: 0; min-height: 0; flex: 1; overflow: hidden; }
.web-ui-suite-list { display: flex; box-sizing: border-box; width: 252px; min-width: 252px; min-height: 0; flex-direction: column; border-right: 1px solid #e5e6eb; background: #fff; }
.web-ui-suite-list__search { display: flex; height: 43px; flex: 0 0 auto; align-items: center; gap: 7px; padding: 0 10.5px; border-bottom: 1px solid #e5e6eb; }
.web-ui-suite-list__search label { position: relative; flex: 1; }
.web-ui-suite-list__search svg { position: absolute; top: 6px; left: 7px; width: 12px; height: 12px; color: #86909c; }
.web-ui-suite-list__search input { box-sizing: border-box; width: 100%; height: 24.5px; padding: 0 7px 0 25.5px; border: 1px solid #e5e6eb; border-radius: 6px; outline: 0; background: #f4f6fa; color: #1d2129; font: 400 11px/15px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-list__search input:focus { border-color: #0fc6c2; background: #fff; }
.web-ui-suite-list__search button { display: inline-flex; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #0fc6c2; cursor: pointer; }
.web-ui-suite-list__search button svg { position: static; width: 14px; height: 14px; }
.web-ui-suite-list__items { min-height: 0; flex: 1; overflow-y: auto; }
.web-ui-suite-list__item { display: block; box-sizing: border-box; width: 100%; height: 61px; padding: 8.75px 10.5px; border: 0; border-bottom: 1px solid rgba(229, 230, 235, .38); background: transparent; text-align: left; cursor: pointer; }
.web-ui-suite-list__item:hover { background: #f4f6fa; }
.web-ui-suite-list__item.is-active { background: #e0fffe; }
.web-ui-suite-list__name { display: flex; align-items: center; gap: 5.25px; min-width: 0; }
.web-ui-suite-list__name b, .web-ui-suite-case__priority, .web-ui-suite-dialog__row > b { display: inline-flex; height: 17px; align-items: center; box-sizing: border-box; padding: 0 5.25px; border-radius: 3px; font: 700 10px/15px Inter, sans-serif; font-style: normal; }
.web-ui-suite-list__name strong { overflow: hidden; color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-suite-list__item.is-active strong { color: #0fc6c2; }
.web-ui-suite-list__meta { display: flex; align-items: center; gap: 7px; margin-top: 3px; color: #86909c; font-size: 10px; line-height: 15px; }
.web-ui-suite-list__meta i { color: #c9cdd4; font-style: normal; }
.web-ui-suite-list__meta em, .web-ui-suite-case em, .web-ui-suite-dialog__row em { font-style: normal; font-weight: 500; }
.web-ui-suite-list__meta em.pass, .web-ui-suite-case em.pass, .web-ui-suite-dialog__row em.pass, .web-ui-suite-last-run b.pass, .web-ui-suite-record b.pass, .web-ui-suite-record em.pass { color: #00b42a; }
.web-ui-suite-list__meta em.fail, .web-ui-suite-case em.fail, .web-ui-suite-dialog__row em.fail, .web-ui-suite-last-run b.fail, .web-ui-suite-record b.fail, .web-ui-suite-record em.fail { color: #f53f3f; }
.web-ui-suite-list__meta em.is-pending, .web-ui-suite-case em.is-pending, .web-ui-suite-dialog__row em.is-pending { color: #c9cdd4; font-weight: 400; }
.web-ui-suite-list__footer { flex: 0 0 auto; padding: 9.75px 8.75px; border-top: 1px solid #e5e6eb; }
.web-ui-suite-list__footer button { display: inline-flex; box-sizing: border-box; width: 100%; height: 28px; align-items: center; justify-content: center; gap: 5px; border: 1px dashed #0fc6c2; border-radius: 7px; background: #fff; color: #0fc6c2; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-list__footer button:hover { background: #f1fffe; }
.web-ui-suite-list__footer svg { width: 13px; height: 13px; }
.web-ui-suite-editor { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; }
.web-ui-suite-editor__toolbar { display: flex; box-sizing: border-box; height: 46px; flex: 0 0 auto; align-items: center; gap: 8.75px; padding: 0 14px; border-bottom: 1px solid #e5e6eb; }
.web-ui-suite-priority { box-sizing: border-box; width: 47.5px; height: 21px; padding: 0 4px; border: 1px solid currentColor; border-radius: 6px; outline: 0; font: 700 11px/17px Inter, sans-serif; }
.web-ui-suite-name { display: inline-flex; min-width: 0; align-items: center; gap: 6px; padding: 0; border: 0; background: transparent; color: #1d2129; cursor: text; }
.web-ui-suite-name strong { overflow: hidden; max-width: 300px; font-size: 14px; font-weight: 600; line-height: 21px; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-suite-name svg { width: 12px; height: 12px; color: #86909c; opacity: 0; }
.web-ui-suite-name:hover svg { opacity: 1; }
.web-ui-suite-name-input { box-sizing: border-box; min-width: 200px; height: 24px; padding: 0 2px; border: 0; border-bottom: 1px solid #0fc6c2; outline: 0; color: #1d2129; font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-editor__spacer { min-width: 0; flex: 1; }
.web-ui-suite-segmented { display: inline-flex; box-sizing: border-box; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.web-ui-suite-segmented button { box-sizing: border-box; height: 23.5px; min-width: 43px; padding: 0 10.5px; border: 0; border-left: 1px solid #e5e6eb; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-segmented button:first-child { border-left: 0; }
.web-ui-suite-segmented button.is-active { background: #e8fffb; color: #0fc6c2; }
.web-ui-suite-toolbar-select { display: inline-flex; box-sizing: border-box; height: 28px; align-items: center; gap: 5px; padding: 0 9.75px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #86909c; font: 400 11px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-toolbar-select select { width: 101px; padding: 0; border: 0; outline: 0; background: transparent; color: #4e5969; font: 500 12px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-toolbar-select--browser svg { width: 12px; height: 12px; color: #86909c; }
.web-ui-suite-notify { display: inline-flex; align-items: center; gap: 5px; color: #86909c; font: 400 11px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-switch { position: relative; display: inline-flex; box-sizing: border-box; width: 28px; height: 14px; flex: 0 0 auto; padding: 0; border: 0; border-radius: 99px; background: #c9cdd4; cursor: pointer; transition: background .15s ease; }
.web-ui-suite-switch i { position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #fff; transition: transform .15s ease; }
.web-ui-suite-switch.is-on { background: #165dff; }
.web-ui-suite-switch.is-on i { transform: translateX(14px); }
.web-ui-suite-save, .web-ui-suite-run { display: inline-flex; box-sizing: border-box; height: 28px; align-items: center; gap: 5px; border-radius: 7px; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-save { padding: 0 11.5px; border: 1px solid #e5e6eb; background: #fff; color: #1d2129; }
.web-ui-suite-save svg { width: 13px; height: 13px; }
.web-ui-suite-run { padding: 0 14px; border: 0; background: #0fc6c2; color: #fff; font-weight: 600; }
.web-ui-suite-run svg { width: 13px; height: 13px; }
.web-ui-suite-sub-tabs { display: flex; box-sizing: border-box; height: 36px; flex: 0 0 auto; align-items: center; padding: 0 14px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.web-ui-suite-sub-tabs button { box-sizing: border-box; height: 36px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #86909c; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-sub-tabs button.is-active { border-bottom-color: #0fc6c2; color: #0fc6c2; }
.web-ui-suite-arrange { display: flex; min-width: 0; min-height: 0; flex: 1; overflow: hidden; }
.web-ui-suite-arrange__cases { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; }
.web-ui-suite-arrange__cases > header { display: flex; height: 43px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid #e5e6eb; color: #86909c; font-size: 12px; line-height: 18px; }
.web-ui-suite-arrange__cases > header b { color: #1d2129; }
.web-ui-suite-arrange__cases > header button { display: inline-flex; height: 24.5px; align-items: center; gap: 5px; padding: 0 10.5px; border: 0; border-radius: 6px; background: #0fc6c2; color: #fff; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-arrange__cases > header svg, .web-ui-suite-add-line svg, .web-ui-suite-empty svg { width: 12px; height: 12px; }
.web-ui-suite-arrange__list { min-height: 0; flex: 1; overflow-y: auto; padding: 14px; background: #f7f8fc; }
.web-ui-suite-case { display: flex; box-sizing: border-box; height: 39px; align-items: center; gap: 8.75px; margin-bottom: 5.25px; padding: 0 11px; border: 1px solid #0fc6c2; border-left: 3px solid #0fc6c2; border-radius: 11px; background: #fff; }
.web-ui-suite-case.is-disabled { border-color: #e5e6eb; border-left-color: #c9cdd4; opacity: .55; }
.web-ui-suite-case__grip { width: 13px; height: 13px; color: #86909c; opacity: .3; cursor: grab; }
.web-ui-suite-case:hover .web-ui-suite-case__grip { opacity: .55; }
.web-ui-suite-case__order { width: 17.5px; color: #c9cdd4; font-family: var(--app-font-family-mono); font-size: 11px; line-height: 17px; text-align: center; }
.web-ui-suite-case__priority { height: 17px; }
.web-ui-suite-case > strong { min-width: 0; flex: 1; overflow: hidden; color: #1d2129; font-size: 13px; font-weight: 500; line-height: 19.5px; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-suite-case__directory { width: 92px; overflow: hidden; color: #86909c; font-size: 11px; line-height: 16.5px; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-suite-case em { width: 35px; flex: 0 0 auto; font-size: 11px; line-height: 16.5px; white-space: nowrap; }
.web-ui-suite-case__actions { display: inline-flex; width: 60px; flex: 0 0 auto; opacity: 0; transition: opacity .15s ease; }
.web-ui-suite-case:hover .web-ui-suite-case__actions { opacity: 1; }
.web-ui-suite-case__actions button { display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #86909c; cursor: pointer; }
.web-ui-suite-case__actions button:disabled { cursor: default; opacity: .3; }
.web-ui-suite-case__actions button:hover:not(:disabled) { background: #f2f3f5; }
.web-ui-suite-case__actions button:last-child { color: #f53f3f; }
.web-ui-suite-case__actions button:last-child:hover { background: #fff0f0; }
.web-ui-suite-case__actions svg { width: 11px; height: 11px; }
.web-ui-suite-add-line { display: flex; box-sizing: border-box; width: 100%; height: 41px; align-items: center; justify-content: center; gap: 5px; margin-top: 5.25px; border: 1px dashed #e5e6eb; border-radius: 11px; background: transparent; color: #86909c; cursor: pointer; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-add-line:hover { background: rgba(232, 255, 251, .6); border-color: #0fc6c2; color: #0fc6c2; }
.web-ui-suite-empty { display: flex; min-height: 260px; align-items: center; justify-content: center; flex-direction: column; color: #4e5969; }
.web-ui-suite-empty p { margin: 0 0 16px; font-size: 14px; font-weight: 500; }
.web-ui-suite-empty button { display: inline-flex; height: 32px; align-items: center; gap: 6px; padding: 0 16px; border: 0; border-radius: 8px; background: #0fc6c2; color: #fff; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-settings { box-sizing: border-box; width: 212px; min-width: 212px; overflow-y: auto; padding: 14px 15px; border-left: 1px solid #e5e6eb; background: #fafbfe; }
.web-ui-suite-settings section, .web-ui-suite-setting-field { display: block; margin: 0 0 14px; }
.web-ui-suite-settings h3, .web-ui-suite-setting-field { color: #4e5969; font-size: 12px; font-weight: 500; line-height: 18px; }
.web-ui-suite-settings h3 { margin: 0 0 5px; }
.web-ui-suite-settings .web-ui-suite-segmented { width: 100%; }
.web-ui-suite-settings .web-ui-suite-segmented button { flex: 1; height: 27px; }
.web-ui-suite-setting-field select, .web-ui-suite-setting-field input { display: block; box-sizing: border-box; width: 100%; height: 24.5px; margin-top: 5px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; background: #fff; color: #1d2129; font: 400 11px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-setting-field input { text-align: center; }
.web-ui-suite-runners { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.web-ui-suite-runners label { display: flex; height: 50px; align-items: center; gap: 7px; padding: 0 10.5px; border-top: 1px solid #e5e6eb; cursor: pointer; }
.web-ui-suite-runners label:first-child { border-top: 0; }
.web-ui-suite-runners input { width: 13px; height: 13px; margin: 0; accent-color: #0fc6c2; }
.web-ui-suite-runners > label > i { width: 5.25px; height: 5.25px; border-radius: 50%; background: #c9cdd4; }
.web-ui-suite-runners > label > i.is-online { background: #00b42a; }
.web-ui-suite-runners label > span { min-width: 0; }
.web-ui-suite-runners b, .web-ui-suite-runners small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-suite-runners b { color: #1d2129; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.web-ui-suite-runners small { color: #86909c; font-size: 10px; line-height: 15px; }
.web-ui-suite-last-run { padding-top: 14px; border-top: 1px solid #e5e6eb; }
.web-ui-suite-last-run b, .web-ui-suite-last-run small { display: block; }
.web-ui-suite-last-run b { font-size: 12px; font-weight: 500; line-height: 18px; }
.web-ui-suite-last-run small { margin-top: 1px; color: #c9cdd4; font-size: 10px; line-height: 15px; }
.web-ui-suite-records { min-height: 0; flex: 1; overflow-y: auto; padding: 17.5px; background: #f7f8fc; }
.web-ui-suite-records > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.web-ui-suite-records > header strong { color: #1d2129; font-size: 13px; font-weight: 600; }
.web-ui-suite-records > header button { display: inline-flex; height: 28px; align-items: center; gap: 5px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/17px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-records > header svg { width: 11px; height: 11px; }
.web-ui-suite-record { display: flex; box-sizing: border-box; width: 100%; align-items: center; gap: 14px; margin-bottom: 7px; padding: 10.5px 14px; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; text-align: left; cursor: pointer; }
.web-ui-suite-record:hover { box-shadow: 0 2px 6px rgba(29, 33, 41, .06); }
.web-ui-suite-record > b { padding: 2px 10px; border-radius: 99px; background: #e8ffea; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.web-ui-suite-record > b.fail { background: #ffeeee; }
.web-ui-suite-record > span { min-width: 0; flex: 1; }
.web-ui-suite-record > span strong, .web-ui-suite-record > span small { display: block; }
.web-ui-suite-record > span strong { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.web-ui-suite-record > span small { color: #86909c; font-size: 11px; line-height: 16.5px; }
.web-ui-suite-record > em { font-style: normal; font-size: 13px; font-weight: 700; text-align: right; }
.web-ui-suite-record > em small { display: block; color: #86909c; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.web-ui-suite-record > svg { width: 14px; height: 14px; color: #c9cdd4; }
.web-ui-suite-dialog { position: fixed; z-index: 3000; inset: 0; display: flex; align-items: center; justify-content: center; }
.web-ui-suite-dialog__mask { position: absolute; inset: 0; background: rgba(29, 33, 41, .5); }
.web-ui-suite-dialog__panel { position: relative; display: flex; box-sizing: border-box; width: 680px; max-width: calc(100vw - 48px); max-height: 78vh; flex-direction: column; overflow: hidden; border-radius: 16px; background: #fff; box-shadow: 0 24px 64px rgba(0, 0, 0, .22); }
.web-ui-suite-dialog__panel > header { display: flex; height: 49px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 17.5px; border-bottom: 1px solid #e5e6eb; }
.web-ui-suite-dialog__panel h2 { margin: 0; color: #1d2129; font-size: 14px; font-weight: 600; line-height: 21px; }
.web-ui-suite-dialog__panel > header button { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #86909c; cursor: pointer; }
.web-ui-suite-dialog__panel > header button:hover { background: #f2f3f5; }
.web-ui-suite-dialog__panel > header svg { width: 14px; height: 14px; }
.web-ui-suite-dialog__table { min-height: 0; overflow-y: auto; }
.web-ui-suite-dialog__thead, .web-ui-suite-dialog__row { display: grid; grid-template-columns: 40px 1.35fr 1.15fr .58fr .72fr .7fr; align-items: center; column-gap: 7px; padding: 0 14px; }
.web-ui-suite-dialog__thead { position: sticky; z-index: 1; top: 0; height: 38px; background: #f4f6fa; color: #86909c; font-size: 12px; font-weight: 500; line-height: 18px; }
.web-ui-suite-dialog__row { box-sizing: border-box; min-height: 50px; border-bottom: 1px solid #e5e6eb; background: #fff; color: #86909c; font-size: 12px; line-height: 18px; }
.web-ui-suite-dialog__row:nth-child(odd) { background: rgba(244, 246, 250, .5); }
.web-ui-suite-dialog__row.is-existing { opacity: .5; }
.web-ui-suite-dialog__row input { width: 13px; height: 13px; margin: 0; accent-color: #0fc6c2; }
.web-ui-suite-dialog__existing { width: max-content; padding: 2px 6px; border-radius: 3px; background: #f2f3f5; color: #86909c; font-size: 10px; line-height: 15px; }
.web-ui-suite-dialog__row strong { color: #1d2129; font-size: 12px; font-weight: 500; }
.web-ui-suite-dialog__row > b { width: max-content; }
.web-ui-suite-dialog__status { display: flex; align-items: center; gap: 6px; color: #4e5969; }
.web-ui-suite-dialog__status i { width: 6px; height: 6px; border-radius: 50%; }
.web-ui-suite-dialog__row em { font-size: 12px; }
.web-ui-suite-dialog__panel footer { display: flex; height: 54px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 17.5px; border-top: 1px solid #e5e6eb; }
.web-ui-suite-dialog__panel footer p { color: #86909c; font-size: 12px; line-height: 18px; }
.web-ui-suite-dialog__panel footer p b { color: #0fc6c2; }
.web-ui-suite-dialog__panel footer > span { display: inline-flex; gap: 7px; }
.web-ui-suite-dialog__panel footer button { height: 28px; padding: 0 14px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-suite-dialog__panel footer button:last-child { border-color: #0fc6c2; background: #0fc6c2; color: #fff; font-weight: 600; }
.web-ui-suite-dialog__panel footer button:last-child:disabled { border-color: #a8ebe9; background: #a8ebe9; cursor: not-allowed; }
@media (max-width: 1100px) { .web-ui-suite-list { width: 220px; min-width: 220px; } .web-ui-suite-toolbar-select--browser, .web-ui-suite-notify { display: none; } .web-ui-suite-case__directory { display: none; } .web-ui-suite-settings { width: 196px; min-width: 196px; } }
</style>
