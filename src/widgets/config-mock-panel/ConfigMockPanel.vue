<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Play,
  Plus as LucidePlus,
  X,
  Zap,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type ConfigReferenceSummary,
  type CreateMockApplicationPayload,
  type CreateMockBusinessScenarioPayload,
  type CreateMockEndpointPayload,
  type CreateMockScenarioPayload,
  type ConfigStatus,
  type MockApplicationItem,
  type MockBusinessScenarioItem,
  type MockCallLogItem,
  type MockEndpointItem,
  type MockReleaseItem,
  type MockScenarioItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import { AppFigmaSwitch, confirmAction, confirmDelete } from '@/shared/ui'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import ApiCodeEditor from '@/widgets/api-interface-workspace/ApiCodeEditor.vue'
import ConfigMockFigmaWorkspace from './ConfigMockFigmaWorkspace.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

type DialogMode = 'create' | 'edit'
interface BusinessScenarioFormItem {
  endpointId: number | null
  scenarioId: number | null
  sortOrder: number
  status: ConfigStatus
}

interface BusinessScenarioForm {
  appId: number
  scenarioName: string
  description: string
  variablesJson: string
  status: ConfigStatus
  items: BusinessScenarioFormItem[]
}

interface MatchRuleRow {
  source: string
  field: string
  operator: string
  value: string
}

interface HeaderRow {
  key: string
  value: string
}

const applications = ref<MockApplicationItem[]>([])
const endpoints = ref<MockEndpointItem[]>([])
const scenarios = ref<MockScenarioItem[]>([])
const businessScenarios = ref<MockBusinessScenarioItem[]>([])
const releases = ref<MockReleaseItem[]>([])
const logs = ref<MockCallLogItem[]>([])
const activeAppId = ref<number | null>(null)
const activeEndpointId = ref<number | null>(null)
const activeScenarioId = ref<number | null>(null)
const activeLog = ref<MockCallLogItem | null>(null)
const loading = ref(false)
const releaseLoading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const appDialogVisible = ref(false)
const endpointDialogVisible = ref(false)
const scenarioDialogVisible = ref(false)
const businessScenarioDialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const logDrawerVisible = ref(false)
const publishDialogVisible = ref(false)
const scenarioEditorTab = ref<'match' | 'response' | 'variables'>('match')
const matchMode = ref<'simple' | 'advanced'>('advanced')
const releaseName = ref('')
const matchRuleRows = ref<MatchRuleRow[]>([])
const responseHeaderRows = ref<HeaderRow[]>([])
const appDialogMode = ref<DialogMode>('create')
const endpointDialogMode = ref<DialogMode>('create')
const scenarioDialogMode = ref<DialogMode>('create')
const businessScenarioDialogMode = ref<DialogMode>('create')
const editingAppId = ref<number | null>(null)
const editingEndpointId = ref<number | null>(null)
const editingScenarioId = ref<number | null>(null)
const editingBusinessScenarioId = ref<number | null>(null)

const appForm = reactive<CreateMockApplicationPayload>({
  appName: '',
  appCode: '',
  description: '',
  status: 1,
})

const endpointForm = reactive<CreateMockEndpointPayload>({
  appId: 0,
  endpointName: '',
  httpMethod: 'POST',
  pathPattern: '/pay/notify',
  description: '',
  status: 1,
})

const scenarioForm = reactive<CreateMockScenarioPayload>({
  appId: 0,
  endpointId: 0,
  scenarioName: '',
  priority: 100,
  matchJson: '{}',
  responseStatus: 200,
  responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
  responseBody: '{"success":true}',
  responseDelayMs: 0,
  variablesJson: '{}',
  status: 1,
})

const businessScenarioForm = reactive<BusinessScenarioForm>({
  appId: 0,
  scenarioName: '',
  description: '',
  variablesJson: '{}',
  status: 1,
  items: [],
})

const activeApp = computed(() => applications.value.find(item => item.id === activeAppId.value) || null)
const activeEndpoint = computed(() => endpoints.value.find(item => item.id === activeEndpointId.value) || null)
const appEndpoints = computed(() => endpoints.value.filter(item => item.appId === activeAppId.value))
const endpointScenarios = computed(() => scenarios.value.filter(item => item.endpointId === activeEndpointId.value))
const appScenarios = computed(() => scenarios.value.filter(item => item.appId === activeAppId.value))
const activeRelease = computed(() => releases.value.find(item => item.active) || null)
const nextReleaseVersion = computed(() => Math.max(0, ...releases.value.map(item => item.versionNo)) + 1)
const environmentReferenceCount = computed(() => referenceSummary.value?.items.filter(item => item.sourceType.includes('环境')).length || 0)
const responseStatusOptions = [
  { value: '200', label: '200 OK' },
  { value: '201', label: '201 Created' },
  { value: '204', label: '204 No Content' },
  { value: '400', label: '400 Bad Request' },
  { value: '401', label: '401 Unauthorized' },
  { value: '403', label: '403 Forbidden' },
  { value: '404', label: '404 Not Found' },
  { value: '409', label: '409 Conflict' },
  { value: '422', label: '422 Unprocessable Entity' },
  { value: '500', label: '500 Internal Server Error' },
  { value: '502', label: '502 Bad Gateway' },
  { value: '503', label: '503 Service Unavailable' },
]
const responseStatusModel = computed({
  get: () => String(scenarioForm.responseStatus),
  set: (value: string) => {
    const status = Number(value)
    if (Number.isInteger(status) && status >= 100 && status <= 599) {
      scenarioForm.responseStatus = status
    }
  },
})
const responseContentType = computed({
  get: () => responseHeaderRows.value.find(item => item.key.toLowerCase() === 'content-type')?.value || 'application/json',
  set: (value: string) => {
    const row = responseHeaderRows.value.find(item => item.key.toLowerCase() === 'content-type')
    if (row) {
      row.value = value
    } else {
      responseHeaderRows.value.unshift({ key: 'Content-Type', value })
    }
  },
})
const scenarioVariableRows = computed(() => {
  const rows = new Map<string, { name: string; source: string; value: string; description: string }>()
  try {
    const variables = JSON.parse(scenarioForm.variablesJson || '{}') as Record<string, unknown>
    Object.entries(variables).forEach(([name, value]) => {
      rows.set(name, { name: `{{${name}}}`, source: '场景变量', value: String(value ?? ''), description: '当前场景配置' })
    })
  } catch {
    // JSON 校验由保存流程统一处理。
  }
  const sourceText = `${scenarioForm.matchJson || ''}\n${scenarioForm.responseBody || ''}`
  const matches = sourceText.matchAll(/\{\{\s*([^{}]+?)\s*\}\}|\$\{\s*([^{}]+?)\s*\}/g)
  for (const match of matches) {
    const name = (match[1] || match[2] || '').trim()
    if (!name || rows.has(name)) continue
    const source = name.startsWith('env.') ? '环境变量' : name.startsWith('request.') ? '请求上下文' : name.startsWith('ws.') ? '工作区变量' : '系统内置'
    rows.set(name, { name: match[0], source, value: '运行时解析', description: '响应模板引用' })
  }
  return Array.from(rows.values())
})

function formatJsonSource(value: string, fallback: string) {
  const source = value || fallback
  try {
    return JSON.stringify(JSON.parse(source), null, 2)
  } catch {
    return source
  }
}

function hydrateScenarioEditor() {
  matchRuleRows.value = []
  try {
    const parsed = JSON.parse(scenarioForm.matchJson || '{}') as { conditions?: MatchRuleRow[] }
    if (Array.isArray(parsed.conditions)) {
      matchRuleRows.value = parsed.conditions.map(item => ({
        source: item.source || 'Query',
        field: item.field || '',
        operator: item.operator || 'equals',
        value: item.value || '',
      }))
      matchMode.value = 'simple'
    } else {
      matchMode.value = 'advanced'
    }
  } catch {
    matchMode.value = 'advanced'
  }
  responseHeaderRows.value = []
  try {
    const parsedHeaders = JSON.parse(scenarioForm.responseHeadersJson || '{}') as Record<string, unknown>
    responseHeaderRows.value = Object.entries(parsedHeaders).map(([key, value]) => ({ key, value: String(value ?? '') }))
  } catch {
    responseHeaderRows.value = []
  }
  if (!responseHeaderRows.value.length) {
    responseHeaderRows.value.push({ key: 'Content-Type', value: 'application/json' })
  }
}

function addMatchRule() {
  matchRuleRows.value.push({ source: 'Query', field: '', operator: 'equals', value: '' })
}

function removeMatchRule(index: number) {
  matchRuleRows.value.splice(index, 1)
}

function addResponseHeader() {
  responseHeaderRows.value.push({ key: '', value: '' })
}

function removeResponseHeader(index: number) {
  responseHeaderRows.value.splice(index, 1)
}

function syncScenarioStructuredFields() {
  if (matchMode.value === 'simple') {
    scenarioForm.matchJson = JSON.stringify({ matchMode: 'all', conditions: matchRuleRows.value }, null, 2)
  }
  scenarioForm.responseHeadersJson = JSON.stringify(
    Object.fromEntries(responseHeaderRows.value.filter(item => item.key.trim()).map(item => [item.key.trim(), item.value])),
    null,
    2,
  )
}

async function loadAll() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [appPage, endpointPage, scenarioPage, businessScenarioPage, logPage] = await Promise.all([
      configApi.getMockApplications(props.workspaceCode),
      configApi.getMockEndpoints(props.workspaceCode),
      configApi.getMockScenarios(props.workspaceCode),
      configApi.getMockBusinessScenarios(props.workspaceCode),
      configApi.getMockCallLogs(props.workspaceCode),
    ])
    applications.value = appPage.items || []
    endpoints.value = endpointPage.items || []
    scenarios.value = scenarioPage.items || []
    businessScenarios.value = businessScenarioPage.items || []
    logs.value = logPage.items || []
    normalizeActiveApp()
    normalizeActiveEndpoint()
    normalizeActiveScenario()
    await loadReleases()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadReleases() {
  if (!activeAppId.value) {
    releases.value = []
    return
  }
  releaseLoading.value = true
  try {
    releases.value = await configApi.getMockReleases(props.workspaceCode, activeAppId.value)
  } catch {
    releases.value = []
  } finally {
    releaseLoading.value = false
  }
}

function normalizeActiveApp() {
  if (!activeAppId.value || !applications.value.some(item => item.id === activeAppId.value)) {
    activeAppId.value = applications.value[0]?.id ?? null
  }
}

function normalizeActiveEndpoint() {
  const candidates = appEndpoints.value
  if (!activeEndpointId.value || !candidates.some(item => item.id === activeEndpointId.value)) {
    activeEndpointId.value = candidates[0]?.id ?? null
  }
}

function normalizeActiveScenario() {
  const candidates = endpointScenarios.value
  if (!activeScenarioId.value || !candidates.some(item => item.id === activeScenarioId.value)) {
    activeScenarioId.value = candidates[0]?.id ?? null
  }
}

function selectApplication(app: MockApplicationItem) {
  activeAppId.value = app.id
  normalizeActiveEndpoint()
  normalizeActiveScenario()
}

function selectEndpoint(endpoint: MockEndpointItem) {
  activeEndpointId.value = endpoint.id
  normalizeActiveScenario()
}

function openCreateAppDialog() {
  appDialogMode.value = 'create'
  editingAppId.value = null
  Object.assign(appForm, {
    appName: '',
    appCode: '',
    description: '',
    status: 1,
  })
  appDialogVisible.value = true
}

function openEditAppDialog(app: MockApplicationItem) {
  appDialogMode.value = 'edit'
  editingAppId.value = app.id
  Object.assign(appForm, {
    appName: app.appName,
    appCode: app.appCode,
    description: app.description || '',
    status: app.status,
  })
  appDialogVisible.value = true
}

function openCreateEndpointDialog() {
  if (!activeAppId.value) {
    ElMessage.warning('请先创建或选择 Mock 应用')
    return
  }
  endpointDialogMode.value = 'create'
  editingEndpointId.value = null
  Object.assign(endpointForm, {
    appId: activeAppId.value,
    endpointName: '',
    httpMethod: 'POST',
    pathPattern: '/pay/notify',
    description: '',
    status: 1,
  })
  endpointDialogVisible.value = true
}

function openEditEndpointDialog(endpoint: MockEndpointItem) {
  endpointDialogMode.value = 'edit'
  editingEndpointId.value = endpoint.id
  Object.assign(endpointForm, {
    appId: endpoint.appId,
    endpointName: endpoint.endpointName,
    httpMethod: endpoint.httpMethod,
    pathPattern: endpoint.pathPattern,
    description: endpoint.description || '',
    status: endpoint.status,
  })
  endpointDialogVisible.value = true
}

function openCreateScenarioDialog() {
  if (!activeAppId.value || !activeEndpointId.value) {
    ElMessage.warning('请先选择 Mock 接口')
    return
  }
  scenarioDialogMode.value = 'create'
  editingScenarioId.value = null
  Object.assign(scenarioForm, {
    appId: activeAppId.value,
    endpointId: activeEndpointId.value,
    scenarioName: '',
    priority: 100,
    matchJson: formatJsonSource('{}', '{}'),
    responseStatus: 200,
    responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
    responseBody: formatJsonSource('{"success":true}', '{"success":true}'),
    responseDelayMs: 0,
    variablesJson: '{}',
    status: 1,
  })
  scenarioEditorTab.value = 'match'
  hydrateScenarioEditor()
  matchMode.value = 'simple'
  scenarioDialogVisible.value = true
}

function openEditScenarioDialog(scenario: MockScenarioItem) {
  scenarioDialogMode.value = 'edit'
  editingScenarioId.value = scenario.id
  Object.assign(scenarioForm, {
    appId: scenario.appId,
    endpointId: scenario.endpointId,
    scenarioName: scenario.scenarioName,
    priority: scenario.priority,
    matchJson: formatJsonSource(scenario.matchJson || '{}', '{}'),
    responseStatus: scenario.responseStatus || 200,
    responseHeadersJson: scenario.responseHeadersJson || '{}',
    responseBody: formatJsonSource(scenario.responseBody || '', ''),
    responseDelayMs: scenario.responseDelayMs || 0,
    variablesJson: scenario.variablesJson || '{}',
    status: scenario.status,
  })
  scenarioEditorTab.value = 'match'
  hydrateScenarioEditor()
  scenarioDialogVisible.value = true
}

function addBusinessScenarioItem() {
  businessScenarioForm.items.push({
    endpointId: null,
    scenarioId: null,
    sortOrder: businessScenarioForm.items.length + 1,
    status: 1,
  })
}

function removeBusinessScenarioItem(index: number) {
  businessScenarioForm.items.splice(index, 1)
  businessScenarioForm.items.forEach((item, itemIndex) => {
    item.sortOrder = itemIndex + 1
  })
}

function findScenario(id: number | null) {
  if (!id) {
    return null
  }
  return scenarios.value.find(item => item.id === id) || null
}

function scenarioSelectLabel(scenario: MockScenarioItem) {
  return `${scenario.endpointName} / ${scenario.scenarioName}`
}

function validateJson(text: string, label: string) {
  try {
    JSON.parse(text || '{}')
    return true
  } catch {
    ElMessage.warning(`${label} 不是合法 JSON`)
    return false
  }
}

async function submitApplication() {
  if (!appForm.appName.trim() || !appForm.appCode.trim()) {
    ElMessage.warning('请输入应用名称和应用编码')
    return
  }
  saving.value = true
  try {
    const saved = appDialogMode.value === 'edit' && editingAppId.value
      ? await configApi.updateMockApplication(props.workspaceCode, editingAppId.value, appForm)
      : await configApi.createMockApplication(props.workspaceCode, appForm)
    ElMessage.success(appDialogMode.value === 'edit' ? 'Mock 应用已更新' : 'Mock 应用已创建')
    activeAppId.value = saved.id
    appDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitEndpoint() {
  if (!endpointForm.endpointName.trim() || !endpointForm.pathPattern.trim()) {
    ElMessage.warning('请输入接口名称和匹配路径')
    return
  }
  saving.value = true
  try {
    const saved = endpointDialogMode.value === 'edit' && editingEndpointId.value
      ? await configApi.updateMockEndpoint(props.workspaceCode, editingEndpointId.value, endpointForm)
      : await configApi.createMockEndpoint(props.workspaceCode, endpointForm)
    ElMessage.success(endpointDialogMode.value === 'edit' ? 'Mock 接口已更新' : 'Mock 接口已创建')
    activeEndpointId.value = saved.id
    endpointDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitScenario() {
  if (!scenarioForm.scenarioName.trim()) {
    ElMessage.warning('请输入场景名称')
    return
  }
  syncScenarioStructuredFields()
  if (!validateJson(scenarioForm.matchJson || '{}', '匹配规则')) {
    return
  }
  if (!validateJson(scenarioForm.responseHeadersJson || '{}', '响应头')) {
    return
  }
  if (!validateJson(scenarioForm.variablesJson || '{}', '模板变量')) {
    return
  }
  saving.value = true
  try {
    const saved = scenarioDialogMode.value === 'edit' && editingScenarioId.value
      ? await configApi.updateMockScenario(props.workspaceCode, editingScenarioId.value, scenarioForm)
      : await configApi.createMockScenario(props.workspaceCode, scenarioForm)
    ElMessage.success(scenarioDialogMode.value === 'edit' ? 'Mock 场景已更新' : 'Mock 场景已创建')
    activeScenarioId.value = saved.id
    scenarioDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitBusinessScenario() {
  if (!businessScenarioForm.scenarioName.trim()) {
    ElMessage.warning('请输入业务场景名称')
    return
  }
  if (!validateJson(businessScenarioForm.variablesJson || '{}', '业务场景变量')) {
    return
  }
  const selectedItems = businessScenarioForm.items
    .map((item, index) => {
      const scenario = findScenario(item.scenarioId)
      return scenario
        ? {
            endpointId: scenario.endpointId,
            scenarioId: scenario.id,
            sortOrder: index + 1,
            status: item.status,
          }
        : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  if (!selectedItems.length) {
    ElMessage.warning('请至少选择一个 Mock 场景')
    return
  }
  const payload: CreateMockBusinessScenarioPayload = {
    appId: businessScenarioForm.appId,
    scenarioName: businessScenarioForm.scenarioName,
    description: businessScenarioForm.description,
    variablesJson: businessScenarioForm.variablesJson,
    status: businessScenarioForm.status,
    items: selectedItems,
  }
  saving.value = true
  try {
    const saved = businessScenarioDialogMode.value === 'edit' && editingBusinessScenarioId.value
      ? await configApi.updateMockBusinessScenario(props.workspaceCode, editingBusinessScenarioId.value, payload)
      : await configApi.createMockBusinessScenario(props.workspaceCode, payload)
    ElMessage.success(businessScenarioDialogMode.value === 'edit' ? '业务场景组合已更新' : '业务场景组合已创建')
    businessScenarioDialogVisible.value = false
    editingBusinessScenarioId.value = saved.id
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function loadApplicationReferences(row = activeApp.value) {
  if (!row) {
    referenceSummary.value = null
    return
  }
  referenceLoading.value = true
  referenceSummary.value = null
  try {
    referenceSummary.value = await configApi.getMockApplicationReferences(props.workspaceCode, row.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

function selectApplicationById(id: number) {
  const app = applications.value.find(item => item.id === id)
  if (app) {
    selectApplication(app)
  }
}

function selectEndpointAndCreateScenario(endpoint: MockEndpointItem) {
  selectEndpoint(endpoint)
  openCreateScenarioDialog()
}

function openCopyEndpointDialog(endpoint: MockEndpointItem) {
  endpointDialogMode.value = 'create'
  editingEndpointId.value = null
  Object.assign(endpointForm, {
    appId: endpoint.appId,
    endpointName: `${endpoint.endpointName} 副本`,
    httpMethod: endpoint.httpMethod,
    pathPattern: endpoint.pathPattern,
    description: endpoint.description || '',
    status: endpoint.status,
  })
  endpointDialogVisible.value = true
}

function openCopyScenarioDialog(scenario: MockScenarioItem) {
  scenarioDialogMode.value = 'create'
  editingScenarioId.value = null
  Object.assign(scenarioForm, {
    appId: scenario.appId,
    endpointId: scenario.endpointId,
    scenarioName: `${scenario.scenarioName} 副本`,
    priority: scenario.priority,
    matchJson: formatJsonSource(scenario.matchJson || '{}', '{}'),
    responseStatus: scenario.responseStatus || 200,
    responseHeadersJson: scenario.responseHeadersJson || '{}',
    responseBody: formatJsonSource(scenario.responseBody || '', ''),
    responseDelayMs: scenario.responseDelayMs || 0,
    variablesJson: scenario.variablesJson || '{}',
    status: scenario.status,
  })
  scenarioEditorTab.value = 'match'
  hydrateScenarioEditor()
  scenarioDialogVisible.value = true
}

async function publishCurrentRelease() {
  if (!activeApp.value) {
    return
  }
  await loadApplicationReferences(activeApp.value)
  releaseName.value = ''
  publishDialogVisible.value = true
}

async function confirmPublishRelease() {
  if (!activeApp.value) {
    return
  }
  releaseLoading.value = true
  try {
    await configApi.publishMockRelease(props.workspaceCode, activeApp.value.id, {
      releaseName: releaseName.value.trim() || null,
    })
    ElMessage.success('当前 Mock 配置已发布为不可变版本，可在环境配置中选择使用')
    publishDialogVisible.value = false
    await loadReleases()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    releaseLoading.value = false
  }
}

async function toggleApplication(row: MockApplicationItem) {
  const nextStatus: ConfigStatus = row.status === 1 ? 0 : 1
  try {
    await confirmAction({
      title: nextStatus === 1 ? '启用 Mock 应用' : '停用 Mock 应用',
      message: nextStatus === 1
        ? `确认启用 Mock 应用「${row.appName}」？`
        : `确认停用 Mock 应用「${row.appName}」？停用后该应用将不再响应 Mock 请求。`,
      confirmText: nextStatus === 1 ? '确认启用' : '确认停用',
      tone: nextStatus === 1 ? 'success' : 'warning',
    })
    saving.value = true
    await configApi.updateMockApplication(props.workspaceCode, row.id, {
      appName: row.appName,
      appCode: row.appCode,
      description: row.description,
      status: nextStatus,
    })
    ElMessage.success(nextStatus === 1 ? 'Mock 应用已启用' : 'Mock 应用已停用')
    await loadAll()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    saving.value = false
  }
}

async function activateRelease(release: MockReleaseItem) {
  if (!activeApp.value || release.active) {
    return
  }
  try {
    await confirmAction({
      title: '切换 Mock 运行版本',
      message: `确认将运行版本切换为 v${release.versionNo}「${release.releaseName}」？后续调用会使用该版本快照。`,
      confirmText: '确认切换',
      tone: 'warning',
    })
    releaseLoading.value = true
    await configApi.activateMockRelease(props.workspaceCode, activeApp.value.id, release.id)
    ElMessage.success(`已切换到 Mock v${release.versionNo}`)
    await loadReleases()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    releaseLoading.value = false
  }
}

async function removeEndpoint(row: MockEndpointItem) {
  await confirmAndRun(
    `删除 Mock 接口「${row.endpointName}」会同时删除下属场景和调用日志。确认删除？`,
    async () => {
      await configApi.deleteMockEndpoint(props.workspaceCode, row.id)
      if (activeEndpointId.value === row.id) {
        activeEndpointId.value = null
      }
    },
  )
}

async function removeScenario(row: MockScenarioItem) {
  await confirmAndRun(`确认删除 Mock 场景「${row.scenarioName}」？相关调用日志也会清理。`, async () => {
    await configApi.deleteMockScenario(props.workspaceCode, row.id)
    if (activeScenarioId.value === row.id) {
      activeScenarioId.value = null
    }
  })
}

async function confirmAndRun(message: string, action: () => Promise<void>) {
  try {
    await confirmDelete({
      title: '删除确认',
      message,
      confirmText: '确认删除',
    })
    await action()
    ElMessage.success('已删除')
    await loadAll()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

function openLog(row: MockCallLogItem) {
  activeLog.value = row
  logDrawerVisible.value = true
}

function prettyJson(value: string | null) {
  if (!value) {
    return '-'
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

watch(activeAppId, () => {
  normalizeActiveEndpoint()
  normalizeActiveScenario()
  referenceSummary.value = null
  void loadReleases()
  void loadApplicationReferences()
})

watch(activeEndpointId, () => {
  normalizeActiveScenario()
})

watch(
  () => props.workspaceCode,
  () => {
    activeAppId.value = null
    activeEndpointId.value = null
    activeScenarioId.value = null
    void loadAll()
  },
)

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <section class="config-mock-panel">
    <ConfigMockFigmaWorkspace
      :applications="applications"
      :endpoints="endpoints"
      :scenarios="scenarios"
      :releases="releases"
      :logs="logs"
      :active-app-id="activeAppId"
      :loading="loading"
      :error-message="errorMessage"
      :release-loading="releaseLoading"
      :reference-loading="referenceLoading"
      :reference-summary="referenceSummary"
      @select-app="selectApplicationById"
      @refresh="loadAll"
      @create-app="openCreateAppDialog"
      @edit-app="openEditAppDialog"
      @toggle-app="toggleApplication"
      @publish="publishCurrentRelease"
      @activate-release="activateRelease"
      @create-endpoint="openCreateEndpointDialog"
      @edit-endpoint="openEditEndpointDialog"
      @copy-endpoint="openCopyEndpointDialog"
      @delete-endpoint="removeEndpoint"
      @create-scenario="selectEndpointAndCreateScenario"
      @edit-scenario="openEditScenarioDialog"
      @copy-scenario="openCopyScenarioDialog"
      @delete-scenario="removeScenario"
      @open-log="openLog"
      @load-references="loadApplicationReferences()"
    />


    <el-dialog
      v-model="appDialogVisible"
      class="figma-mock-dialog"
      :class="{ 'is-create': appDialogMode === 'create' }"
      modal-class="figma-mock-app-overlay"
      :title="appDialogMode === 'edit' ? '编辑 Mock 应用' : '新建 Mock 应用'"
      width="520px"
      :close-on-click-modal="false"
    >
      <div class="config-mock-form figma-mock-app-form">
        <label>
          <span>应用名称 <b>*</b></span>
          <el-input v-model="appForm.appName" placeholder="例：支付网关 Mock" />
        </label>
        <label>
          <span>应用编码 <b>*</b></span>
          <el-input class="figma-mock-app-form__code" v-model="appForm.appCode" :disabled="appDialogMode === 'edit'" placeholder="例：payment-mock（仅英文、数字、-）" />
          <small class="figma-mock-form-tip">编码将作为 Mock 基础路径的一部分，创建后不可修改。</small>
        </label>
        <label>
          <span>描述</span>
          <el-input v-model="appForm.description" placeholder="说明此 Mock 应用的用途和范围" />
        </label>
        <div class="config-mock-form__grid">
          <label>
            <span>默认响应延迟 (ms)</span>
            <el-input model-value="50" readonly title="后端暂未提供应用级默认延迟字段" />
          </label>
          <label>
            <span>未匹配策略</span>
            <el-select class="figma-mock-app-form__readonly-select" model-value="strict" disabled title="后端暂未提供应用级未匹配策略字段">
              <el-option label="严格失败 (推荐)" value="strict" />
              <el-option label="返回空响应" value="empty" />
              <el-option label="透传真实服务" value="passthrough" />
            </el-select>
          </label>
        </div>
        <div class="figma-mock-credential-field">
          <div><strong>启用访问凭据</strong><p>启用后调用 Mock 接口需携带 Token，提升安全性</p></div>
          <AppFigmaSwitch :model-value="false" label="启用访问凭据" disabled title="后端暂未提供应用级 Token 配置字段" />
        </div>
        <label v-if="appDialogMode === 'edit'">
          <span>状态</span>
          <el-switch v-model="appForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </label>
      </div>
      <template #footer>
        <AppButton class="figma-mock-app-dialog__cancel" :disabled="saving" @click="appDialogVisible = false">取消</AppButton>
        <AppButton class="figma-mock-app-dialog__submit" type="primary" :loading="saving" @click="submitApplication">{{ appDialogMode === 'create' ? '创建' : '保存' }}</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="endpointDialogVisible" :title="endpointDialogMode === 'edit' ? '编辑 Mock 接口' : '新增 Mock 接口'" width="560px">
      <div class="config-mock-form">
        <div class="config-mock-form__grid">
          <label>
            <span>请求方法 *</span>
            <el-select v-model="endpointForm.httpMethod">
              <el-option label="ANY" value="ANY" />
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="PATCH" value="PATCH" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </label>
          <label>
            <span>状态</span>
            <el-switch v-model="endpointForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
          </label>
        </div>
        <label>
          <span>接口名称 *</span>
          <el-input v-model="endpointForm.endpointName" placeholder="例如：支付回调" />
        </label>
        <label>
          <span>匹配路径 *</span>
          <el-input v-model="endpointForm.pathPattern" placeholder="/pay/notify 或 /pay/**" />
        </label>
        <label>
          <span>描述</span>
          <el-input v-model="endpointForm.description" type="textarea" :rows="3" />
        </label>
      </div>
      <template #footer>
        <AppButton :disabled="saving" @click="endpointDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submitEndpoint">保存</AppButton>
      </template>
    </el-dialog>

    <el-drawer
      v-model="scenarioDialogVisible"
      class="figma-mock-scene-drawer"
      :with-header="false"
      size="760px"
      destroy-on-close
    >
      <div class="figma-mock-scene-editor">
        <header class="figma-mock-scene-editor__head">
          <div class="figma-mock-scene-editor__path">
            <span class="figma-mock-scene-method">{{ activeEndpoint?.httpMethod || 'ANY' }}</span>
            <code>{{ activeEndpoint?.pathPattern || '-' }}</code><i>/</i>
            <strong>{{ scenarioForm.scenarioName || (scenarioDialogMode === 'edit' ? '编辑场景' : '新建场景') }}</strong>
          </div>
          <div class="figma-mock-scene-editor__actions">
            <el-switch v-model="scenarioForm.status" :active-value="1" :inactive-value="0" />
            <span>启用</span>
            <span class="figma-mock-publish-chip">{{ activeRelease ? '已发布' : '草稿' }}</span>
            <button type="button" class="figma-mock-scene-btn" disabled title="后端暂未提供独立调试接口"><Play :size="13" />调试</button>
            <button type="button" class="figma-mock-scene-btn is-primary" :disabled="saving" @click="submitScenario">{{ saving ? '保存中...' : '保存' }}</button>
            <button type="button" class="figma-mock-scene-close" aria-label="关闭" @click="scenarioDialogVisible = false"><X :size="16" /></button>
          </div>
        </header>

        <div class="figma-mock-scene-editor__summary">
          <label class="is-inline-edit">场景名称 <el-input v-model="scenarioForm.scenarioName" /></label>
          <label class="is-inline-edit">优先级 <el-input-number v-model="scenarioForm.priority" :min="0" :max="9999" :controls="false" /></label>
          <span>默认场景 <b class="is-muted">—</b></span>
          <span>响应码 <b class="is-success">{{ scenarioForm.responseStatus }}</b></span>
          <span>延迟 <b>{{ scenarioForm.responseDelayMs }} ms</b></span>
        </div>

        <nav class="figma-mock-scene-tabs">
          <button type="button" :class="{ 'is-active': scenarioEditorTab === 'match' }" @click="scenarioEditorTab = 'match'">请求匹配</button>
          <button type="button" :class="{ 'is-active': scenarioEditorTab === 'response' }" @click="scenarioEditorTab = 'response'">响应配置</button>
          <button type="button" :class="{ 'is-active': scenarioEditorTab === 'variables' }" @click="scenarioEditorTab = 'variables'">变量替换</button>
        </nav>

        <div class="figma-mock-scene-editor__body app-soft-scrollbar">
          <section v-if="scenarioEditorTab === 'match'" class="figma-mock-scene-section is-match">
            <div class="figma-mock-scene-section__title">
              <div><strong>匹配条件</strong><p>所有条件均满足时命中此场景。按优先级从高到低匹配。</p></div>
              <div class="figma-mock-mode-switch"><span>模式：</span><div class="figma-mock-mode-switch__buttons"><button type="button" :class="{ 'is-active': matchMode === 'simple' }" @click="matchMode = 'simple'">简单配置</button><button type="button" :class="{ 'is-active': matchMode === 'advanced' }" @click="matchMode = 'advanced'">高级模式</button></div></div>
            </div>
            <template v-if="matchMode === 'simple'">
              <div class="figma-mock-simple-rules">
                <div class="figma-mock-rule-grid is-head"><span>来源</span><span>字段 / JSONPath</span><span>操作符</span><span>期望值</span><span /></div>
                <div v-for="(rule, index) in matchRuleRows" :key="index" class="figma-mock-rule-grid">
                  <el-select v-model="rule.source"><el-option label="Query" value="Query" /><el-option label="Header" value="Header" /><el-option label="Body.JSON" value="Body.JSON" /><el-option label="Path" value="Path" /><el-option label="Cookie" value="Cookie" /></el-select>
                  <el-input v-model="rule.field" placeholder="字段名或 JSONPath" />
                  <el-select v-model="rule.operator"><el-option label="等于" value="equals" /><el-option label="存在" value="exists" /><el-option label="包含" value="contains" /><el-option label="大于" value="greaterThan" /><el-option label="正则匹配" value="regex" /></el-select>
                  <el-input v-model="rule.value" placeholder="期望值" />
                  <button type="button" aria-label="删除匹配条件" @click="removeMatchRule(index)"><X :size="14" /></button>
                </div>
                <button type="button" class="figma-mock-add-row" @click="addMatchRule"><LucidePlus :size="13" />添加匹配条件</button>
              </div>
            </template>
            <template v-else>
              <div class="figma-mock-advanced">
                <div class="figma-mock-advanced-tip"><AlertTriangle :size="14" />高级模式下你可以使用 JSONPath / XPath / 正则表达式直接编写匹配规则。错误的规则将导致场景永不命中。</div>
                <ApiCodeEditor
                  v-model="scenarioForm.matchJson"
                  class="figma-mock-advanced-editor"
                  language="json"
                  height="162px"
                  theme-variant="figma-dark"
                  line-numbers="off"
                  :folding="false"
                  :font-size="12"
                  :line-height="22"
                  :padding-top="14"
                  :padding-bottom="14"
                  :line-decorations-width="16"
                  :show-format-button="false"
                />
              </div>
            </template>
          </section>

          <section v-else-if="scenarioEditorTab === 'response'" class="figma-mock-scene-section is-response">
            <div class="figma-mock-response-grid">
              <label><span>HTTP 状态码</span><el-select v-model="responseStatusModel" filterable allow-create default-first-option><el-option v-for="option in responseStatusOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></label>
              <label><span>Content-Type</span><el-select v-model="responseContentType"><el-option label="application/json" value="application/json" /><el-option label="application/xml" value="application/xml" /><el-option label="text/plain" value="text/plain" /><el-option label="text/html" value="text/html" /></el-select></label>
              <label><span>响应延迟 (ms)</span><el-input-number v-model="scenarioForm.responseDelayMs" :min="0" :max="10000" :controls="false" /></label>
            </div>
            <div class="figma-mock-response-headers">
              <div class="figma-mock-scene-section__title is-compact"><strong>响应 Headers</strong><button type="button" class="figma-mock-add-row" @click="addResponseHeader"><LucidePlus :size="12" />添加</button></div>
              <div class="figma-mock-response-header-rows">
                <div v-for="(header, index) in responseHeaderRows" :key="index" class="figma-mock-header-row"><el-input v-model="header.key" placeholder="Header 名称" /><span>:</span><el-input v-model="header.value" placeholder="Header 值" /><button type="button" aria-label="删除响应 Header" @click="removeResponseHeader(index)"><X :size="14" /></button></div>
              </div>
            </div>
            <div class="figma-mock-response-body">
              <div class="figma-mock-scene-section__title is-compact"><strong>响应 Body</strong><span class="figma-mock-available-vars">可用变量：<code>&#123;&#123;env.API_URL&#125;&#125;</code> <code>&#123;&#123;faker.uuid&#125;&#125;</code></span></div>
              <div class="figma-mock-response-editor">
                <div class="figma-mock-response-editor__head"><span>response.json</span><span>Monaco Editor</span></div>
                <ApiCodeEditor
                  v-model="scenarioForm.responseBody"
                  language="json"
                  height="189px"
                  theme-variant="figma-dark"
                  line-numbers="off"
                  :folding="false"
                  :font-size="12"
                  :line-height="21"
                  :padding-top="9.5"
                  :padding-bottom="9.5"
                  :line-decorations-width="10.5"
                  :show-format-button="false"
                />
              </div>
            </div>
          </section>

          <section v-else class="figma-mock-scene-section is-variables">
            <div class="figma-mock-variable-tip"><Zap :size="14" /><div><strong>变量替换说明</strong><p>在响应 Body 中使用 <code>&#123;&#123;变量名&#125;&#125;</code> 语法引用变量。系统将按作用域优先级解析：场景变量 › 环境变量 › 工作区变量 › 系统内置变量。</p></div></div>
            <table class="figma-mock-variable-table"><thead><tr><th>变量名</th><th>来源</th><th>当前值预览</th><th>说明</th><th>状态</th></tr></thead><tbody><tr v-for="row in scenarioVariableRows" :key="row.name"><td><code>{{ row.name }}</code></td><td><span class="figma-mock-variable-source">{{ row.source }}</span></td><td><code>{{ row.value }}</code></td><td>{{ row.description }}</td><td class="is-center"><CheckCircle2 :size="14" class="is-success" /></td></tr><tr v-if="!scenarioVariableRows.length"><td colspan="5" class="is-empty">当前响应模板未引用变量</td></tr></tbody></table>
          </section>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      v-model="businessScenarioDialogVisible"
      :title="businessScenarioDialogMode === 'edit' ? '编辑业务场景组合' : '新增业务场景组合'"
      width="780px"
    >
      <div class="config-mock-form">
        <div class="config-mock-form__grid">
          <label>
            <span>组合名称 *</span>
            <el-input v-model="businessScenarioForm.scenarioName" placeholder="例如：微信支付成功全链路" />
          </label>
          <label>
            <span>状态</span>
            <el-switch v-model="businessScenarioForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
          </label>
        </div>
        <label>
          <span>描述</span>
          <el-input v-model="businessScenarioForm.description" type="textarea" :rows="2" placeholder="说明这个组合适用的业务链路" />
        </label>
        <label>
          <span>组合变量 JSON</span>
          <el-input v-model="businessScenarioForm.variablesJson" type="textarea" :rows="3" placeholder='{"payStatus":"SUCCESS"}' />
        </label>
        <div class="config-mock-combo-items">
          <div class="config-mock-combo-items__header">
            <span>包含的 Mock 场景</span>
            <AppButton size="small" :icon="Plus" @click="addBusinessScenarioItem">添加场景</AppButton>
          </div>
          <div v-if="businessScenarioForm.items.length" class="config-mock-combo-items__list app-soft-scrollbar">
            <div v-for="(item, index) in businessScenarioForm.items" :key="index" class="config-mock-combo-item">
              <span class="config-mock-combo-item__order">{{ index + 1 }}</span>
              <el-select v-model="item.scenarioId" filterable placeholder="选择单接口 Mock 场景">
                <el-option
                  v-for="scenario in appScenarios"
                  :key="scenario.id"
                  :label="scenarioSelectLabel(scenario)"
                  :value="scenario.id"
                />
              </el-select>
              <el-switch v-model="item.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
              <button type="button" class="config-mock-combo-item__remove" @click="removeBusinessScenarioItem(index)">删除</button>
            </div>
          </div>
          <AppEmptyState v-else title="暂无组合场景" description="添加已有单接口 Mock 场景后即可组成支付成功、失败或超时链路。" />
        </div>
      </div>
      <template #footer>
        <AppButton :disabled="saving" @click="businessScenarioDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submitBusinessScenario">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="publishDialogVisible"
      class="figma-mock-publish-dialog"
      width="560px"
      destroy-on-close
    >
      <template #header>
        <div class="figma-mock-publish-dialog__heading"><h2>确认发布 — {{ activeApp?.appName || 'Mock 应用' }}</h2><p>发布后当前版本不可变，可由环境配置选择并启用新版本。</p></div>
      </template>
      <div class="figma-mock-publish-dialog__stats">
        <div><span>当前版本</span><strong>{{ activeRelease ? `v${activeRelease.versionNo}` : '尚未发布' }}</strong></div>
        <div><span>新版本</span><strong>v{{ nextReleaseVersion }}</strong></div>
        <div><span>引用环境</span><strong>{{ environmentReferenceCount }} 个环境</strong></div>
      </div>
      <strong class="figma-mock-publish-dialog__label">本次修改摘要</strong>
      <div class="figma-mock-publish-dialog__changes">
        <div class="figma-mock-publish-dialog__change is-edit"><span><Edit2 :size="11" /></span><div><strong><b>修改</b>接口配置</strong><p>{{ appEndpoints.length }} 个接口将写入新版本快照</p></div></div>
        <div class="figma-mock-publish-dialog__change is-add"><span><LucidePlus :size="11" /></span><div><strong><b>收录</b>场景配置</strong><p>{{ appScenarios.length }} 个场景将写入新版本快照</p></div></div>
        <div class="figma-mock-publish-dialog__change is-snapshot"><span><CheckCircle2 :size="11" /></span><div><strong><b>快照</b>生成不可变版本</strong><p>后端暂未提供新增、修改和删除的结构化差异</p></div></div>
      </div>
      <label class="figma-mock-publish-dialog__note"><span>发布说明 <small>（选填）</small></span><el-input v-model="releaseName" type="textarea" :rows="3" placeholder="描述本次发布的主要变更..." /></label>
      <template #footer>
        <div class="figma-mock-publish-dialog__footer">
          <span><AlertTriangle :size="14" />发布不会修改环境已选择的版本，请在环境配置中切换</span>
          <div><AppButton :disabled="releaseLoading" @click="publishDialogVisible = false">取消</AppButton><AppButton type="primary" :loading="releaseLoading" @click="confirmPublishRelease">确认发布</AppButton></div>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="logDrawerVisible" title="调用日志详情" size="560px">
      <div v-if="activeLog" class="config-mock-log-detail">
        <dl>
          <dt>接口</dt>
          <dd>{{ activeLog.endpointName || '-' }}</dd>
          <dt>场景</dt>
          <dd>{{ activeLog.scenarioName || '-' }}</dd>
          <dt>业务组合</dt>
          <dd>{{ activeLog.businessScenarioName || '-' }}</dd>
          <dt>请求</dt>
          <dd>{{ activeLog.httpMethod }} {{ activeLog.requestPath }}</dd>
          <dt>响应</dt>
          <dd>{{ activeLog.responseStatus || '-' }} / {{ activeLog.status }}</dd>
        </dl>
        <p v-if="activeLog.releaseVersion" class="config-mock-log-detail__release">Mock v{{ activeLog.releaseVersion }}</p>
        <h4>请求头</h4>
        <pre>{{ prettyJson(activeLog.requestHeadersJson) }}</pre>
        <h4>请求体</h4>
        <pre>{{ prettyJson(activeLog.requestBody) }}</pre>
        <h4>响应头</h4>
        <pre>{{ prettyJson(activeLog.responseHeadersJson) }}</pre>
        <h4>响应体</h4>
        <pre>{{ prettyJson(activeLog.responseBody) }}</pre>
      </div>
    </el-drawer>
    <ConfigReferenceDrawer
      v-model="referenceDrawerVisible"
      title="Mock 应用引用详情"
      :loading="referenceLoading"
      :summary="referenceSummary"
    />
  </section>
</template>

<style scoped>
.config-mock-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0;
}

:deep(.figma-mock-dialog),
:deep(.figma-mock-publish-dialog) {
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
}

:deep(.figma-mock-dialog .el-dialog__header),
:deep(.figma-mock-publish-dialog .el-dialog__header) {
  height: 64px;
  margin: 0;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  display: flex;
  align-items: center;
}

:deep(.figma-mock-dialog .el-dialog__title),
:deep(.figma-mock-publish-dialog .el-dialog__title) {
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
}

:deep(.figma-mock-dialog .el-dialog__body),
:deep(.figma-mock-publish-dialog .el-dialog__body) {
  padding: 20px 24px;
}

:deep(.figma-mock-dialog .el-dialog__footer),
:deep(.figma-mock-publish-dialog .el-dialog__footer) {
  padding: 14px 20px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

:global(.figma-mock-app-overlay) {
  background: rgba(29, 33, 41, 0.5);
}

:deep(.figma-mock-dialog) {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  font-family: var(--app-font-family);
}

:deep(.figma-mock-dialog.is-create) {
  display: flex;
  height: 494.75px;
  flex-direction: column;
  margin-top: max(16px, calc((100vh - 494.75px) / 2));
}

:deep(.figma-mock-dialog .el-dialog__header) {
  height: 59px;
  min-height: 59px;
  padding: 0 21px;
}

:deep(.figma-mock-dialog.is-create .el-dialog__header) {
  height: 60.5px;
  min-height: 60.5px;
  flex: 0 0 60.5px;
}

:deep(.figma-mock-dialog .el-dialog__title) {
  font-family: var(--app-font-family);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

:deep(.figma-mock-dialog .el-dialog__headerbtn) {
  top: 17px;
  right: 21px;
  width: 25px;
  height: 25px;
  border-radius: 7px;
}

:deep(.figma-mock-dialog .el-dialog__headerbtn:hover) {
  background: #f7f8fa;
}

:deep(.figma-mock-dialog .el-dialog__headerbtn .el-dialog__close) {
  width: 16px;
  height: 16px;
  color: #c9cdd4;
}

:deep(.figma-mock-dialog .el-dialog__body) {
  padding: 17.5px 21px;
}

:deep(.figma-mock-dialog.is-create .el-dialog__body) {
  height: 374.75px;
  min-height: 0;
  flex: 0 0 374.75px;
}

:deep(.figma-mock-dialog .el-dialog__footer) {
  min-height: 61px;
  padding: 14px 21px;
}

:deep(.figma-mock-dialog.is-create .el-dialog__footer) {
  display: flex;
  height: 61px;
  min-height: 61px;
  flex: 0 0 61px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 7px;
  padding: 14px 21px;
}

:deep(.figma-mock-dialog.is-create .el-dialog__headerbtn) {
  top: 17.5px;
  right: 21px;
  width: 24.5px;
  height: 24.5px;
}

:deep(.figma-mock-dialog.is-create .el-dialog__footer .el-button) {
  margin-left: 0;
}

:deep(.figma-mock-scene-drawer) {
  top: 31px;
  height: calc(100% - 31px);
  border-radius: 0;
}

:deep(.figma-mock-scene-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.figma-mock-scene-editor {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
  color: #1d2129;
  font-size: 12px;
}

.figma-mock-scene-editor__head {
  display: flex;
  height: 56px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
}

.figma-mock-scene-editor__path,
.figma-mock-scene-editor__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.figma-mock-scene-editor__path {
  min-width: 0;
}

.figma-mock-scene-editor__path code,
.figma-mock-scene-editor__path strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-mock-scene-editor__path code {
  color: #4e5969;
  font-family: Consolas, monospace;
}

.figma-mock-scene-editor__path i {
  color: #c9cdd4;
  font-style: normal;
}

.figma-mock-scene-method {
  padding: 3px 7px;
  border-radius: 4px;
  background: #fff3e8;
  color: #ff7d00;
  font: 600 10px Consolas, monospace;
}

.figma-mock-publish-chip {
  padding: 2px 7px;
  border-radius: 4px;
  background: #e8ffea;
  color: #00b42a;
  font-size: 10px;
}

.figma-mock-scene-btn {
  display: inline-flex;
  height: 29px;
  align-items: center;
  padding: 0 11px;
  border: 1px solid #d9dce3;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}

.figma-mock-scene-btn.is-primary {
  border-color: #165dff;
  background: #165dff;
  color: #fff;
}

.figma-mock-scene-btn:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.figma-mock-scene-close {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 20px;
}

.figma-mock-scene-editor__summary {
  display: flex;
  min-height: 38px;
  flex: 0 0 auto;
  align-items: center;
  gap: 18px;
  padding: 5px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
  color: #86909c;
}

.figma-mock-scene-editor__summary label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.figma-mock-scene-editor__summary label:first-child {
  width: 210px;
}

.figma-mock-scene-editor__summary label:nth-child(2) {
  width: 126px;
}

.figma-mock-scene-editor__summary label:first-child :deep(.el-input) {
  width: 145px;
}

.figma-mock-scene-editor__summary label:nth-child(2) :deep(.el-input-number) {
  width: 84px;
}

.figma-mock-scene-editor__summary :deep(.el-input__wrapper),
.figma-mock-scene-editor__summary :deep(.el-input-number) {
  height: 26px;
}

.figma-mock-scene-editor__summary span {
  white-space: nowrap;
}

.figma-mock-scene-editor__summary b {
  margin-left: 4px;
  color: #4e5969;
  font-family: Consolas, monospace;
}

.figma-mock-scene-tabs {
  display: flex;
  height: 42px;
  flex: 0 0 auto;
  align-items: stretch;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
}

.figma-mock-scene-tabs button {
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: #86909c;
  cursor: pointer;
  font: 500 12px inherit;
}

.figma-mock-scene-tabs button.is-active {
  border-bottom-color: #165dff;
  color: #165dff;
}

.figma-mock-scene-editor__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.figma-mock-scene-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.figma-mock-scene-section__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.figma-mock-scene-section__title > div:first-child {
  line-height: 19.5px;
}

.figma-mock-scene-section__title strong {
  font-size: 13px;
}

.figma-mock-scene-section__title p {
  margin: 2.25px 0 0;
  color: #86909c;
  font-size: 11px;
}

.figma-mock-scene-section__title.is-compact {
  align-items: center;
  margin-top: 4px;
}

.figma-mock-mode-switch {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 6.625px;
  color: #86909c;
}

.figma-mock-mode-switch__buttons {
  box-sizing: border-box;
  display: flex;
  width: 140px;
  height: 26.5px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
}

.figma-mock-mode-switch__buttons button {
  flex: 0 0 69px;
  height: 24.5px;
  padding: 0 10.5px;
  border: 0;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}

.figma-mock-mode-switch__buttons button.is-active {
  background: #165dff;
  color: #fff;
}

.figma-mock-simple-rules {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 14px;
}

.figma-mock-rule-grid {
  display: grid;
  box-sizing: border-box;
  height: 40.5px;
  min-height: 40.5px;
  align-items: center;
  grid-template-columns: 100px minmax(0, 1fr) 120px minmax(0, 1fr) 36px;
  gap: 10.5px;
  padding: 0 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
}

.figma-mock-rule-grid.is-head > span:nth-child(2),
.figma-mock-rule-grid.is-head > span:nth-child(4) {
  padding-left: 1.5px;
}

.figma-mock-rule-grid.is-head {
  height: 32.5px;
  min-height: 32.5px;
  background: #fafafa;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
}

.figma-mock-rule-grid button,
.figma-mock-header-row button {
  border: 0;
  background: none;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 16px;
}

.figma-mock-add-row {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: #165dff;
  cursor: pointer;
  font-size: 12px;
}

.figma-mock-simple-rules > .figma-mock-add-row {
  width: 100%;
  height: 21.5px;
  align-self: stretch;
  justify-content: flex-start;
  gap: 5.25px;
}

.figma-mock-advanced {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
  padding-top: 14px;
}

.figma-mock-advanced-tip,
.figma-mock-variable-tip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border: 1px solid #ffd09a;
  border-radius: 7px;
  background: #fff7e8;
  color: #ff7d00;
  font-size: 11px;
}

.figma-mock-advanced-tip {
  box-sizing: border-box;
  min-height: 37.5px;
  align-items: flex-start;
  padding: 8.75px 10.5px;
  border-color: #ffd595;
  background: #fff3e8;
}

.figma-mock-advanced-tip > svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.figma-mock-advanced-editor.api-code-editor.is-figma-dark {
  min-height: 160px;
  padding: 0;
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #1e1e1e;
}

.figma-mock-response-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.figma-mock-response-grid label {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
  color: #4e5969;
}

.figma-mock-response-grid :deep(.el-input-number),
.figma-mock-response-grid :deep(.el-select) {
  width: 100%;
}

.figma-mock-response-grid :deep(.el-select__wrapper),
.figma-mock-response-grid :deep(.el-input-number .el-input__wrapper) {
  height: 28px;
  min-height: 28px;
}

.figma-mock-response-headers,
.figma-mock-response-body {
  display: flex;
  flex-direction: column;
}

.figma-mock-response-header-rows {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
  padding-top: 7px;
  padding-bottom: 5.25px;
}

.figma-mock-response-body .figma-mock-response-editor {
  margin-top: 7px;
}

.figma-mock-response-headers .figma-mock-scene-section__title.is-compact,
.figma-mock-response-body .figma-mock-scene-section__title.is-compact {
  margin-top: 0;
}

.figma-mock-response-headers .figma-mock-scene-section__title.is-compact {
  height: 18px;
}

.figma-mock-response-body .figma-mock-scene-section__title.is-compact {
  height: 20.5px;
}

.figma-mock-header-row {
  display: grid;
  height: 28px;
  align-items: center;
  grid-template-columns: 147.59375px 4px minmax(0, 1fr) 15.5px;
  gap: 7px;
}

.figma-mock-header-row :deep(.el-input__wrapper) {
  height: 28px;
  min-height: 28px;
}

.figma-mock-available-vars {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
}

.figma-mock-available-vars code {
  margin-left: 4px;
  padding: 2px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #4e5969;
}

.figma-mock-variable-tip {
  display: block;
  border-color: #bed0ff;
  background: #f2f7ff;
  color: #165dff;
}

.figma-mock-variable-tip p {
  margin: 5px 0 0;
  color: #4e5969;
}

.figma-mock-variable-json {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.figma-mock-variable-table {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
}

.figma-mock-variable-table th,
.figma-mock-variable-table td {
  height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid #e5e6eb;
  color: #4e5969;
  font-size: 11px;
  text-align: left;
}

.figma-mock-variable-table th {
  height: 33px;
  background: #fafafa;
  color: #86909c;
  font-size: 10px;
}

.figma-mock-variable-table tr:last-child td {
  border-bottom: 0;
}

.figma-mock-variable-table td.is-empty {
  color: #86909c;
  text-align: center;
}

.figma-mock-publish-dialog__intro {
  margin: -6px 0 16px;
  color: #86909c;
  font-size: 12px;
}

.figma-mock-publish-dialog__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.figma-mock-publish-dialog__stats div {
  padding: 11px;
  border: 1px solid #e5e6eb;
  border-radius: 9px;
  background: #fafafa;
}

.figma-mock-publish-dialog__stats span,
.figma-mock-publish-dialog__stats strong {
  display: block;
}

.figma-mock-publish-dialog__stats span {
  margin-bottom: 7px;
  color: #86909c;
  font-size: 10px;
}

.figma-mock-publish-dialog__stats strong {
  color: #1d2129;
  font-size: 13px;
}

.figma-mock-publish-dialog__label {
  display: block;
  margin-bottom: 9px;
  color: #1d2129;
  font-size: 12px;
}

.figma-mock-publish-dialog__change {
  display: flex;
  gap: 10px;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fafafa;
}

.figma-mock-publish-dialog__change>span {
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
}

.figma-mock-publish-dialog__change strong {
  font-size: 12px;
}

.figma-mock-publish-dialog__change p {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 10px;
}

.figma-mock-publish-dialog__note {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: #4e5969;
  font-size: 12px;
}

.figma-mock-publish-dialog__note small {
  color: #c9cdd4;
}

.figma-mock-publish-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.figma-mock-publish-dialog__footer>span,
.figma-mock-publish-dialog__footer>div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.figma-mock-publish-dialog__footer>span {
  color: #ff7d00;
  font-size: 10px;
}

.config-mock-panel__header,
.config-mock-section__header,
.config-mock-summary,
.config-mock-release,
.config-mock-url {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-mock-panel__header h2,
.config-mock-section__header h3,
.config-mock-summary h3 {
  margin: 0;
  color: var(--app-text-primary);
}

.config-mock-panel__header p,
.config-mock-section__header p,
.config-mock-summary p {
  margin: 4px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-mock-panel__actions,
.config-mock-summary__actions,
.config-mock-table-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.config-mock-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--app-space-5);
}

.config-mock-apps,
.config-mock-workspace,
.config-mock-section,
.config-mock-release,
.config-mock-release-history,
.config-mock-url,
.config-mock-summary {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.config-mock-apps {
  display: flex;
  min-height: 640px;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
}

.config-mock-apps__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  overflow: auto;
}

.config-mock-app {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.config-mock-app:hover {
  background: var(--app-bg-muted);
}

.config-mock-app.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.config-mock-app strong,
.config-mock-app small {
  display: block;
}

.config-mock-app small {
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-mock-workspace {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
}

.config-mock-summary,
.config-mock-release,
.config-mock-url,
.config-mock-section,
.config-mock-release-history {
  padding: var(--app-space-4);
}

.config-mock-release {
  justify-content: space-between;
  background: var(--app-bg-muted);
}

.config-mock-release strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.config-mock-release p {
  margin: 4px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-mock-release__meta {
  flex: 0 0 auto;
}

.config-mock-release-history {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-release-history .config-mock-section__header {
  margin-bottom: 0;
}

.config-mock-summary__title {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.config-mock-url {
  justify-content: flex-start;
  background: var(--app-bg-muted);
}

.config-mock-url span {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-mock-url code {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-mock-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-advanced-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-advanced-section > summary {
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  list-style-position: inside;
}

.config-mock-advanced-section[open] > summary {
  color: var(--app-text-primary);
}

.config-mock-table-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
}

.config-mock-table-actions button:hover {
  color: var(--app-primary-hover);
}

.config-mock-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-mock-form label {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-mock-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-mock-form :deep(.el-select),
.config-mock-form :deep(.el-input-number) {
  width: 100%;
}

.figma-mock-form-tip {
  margin-top: -3px;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
}

.figma-mock-credential-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fafafa;
}

.figma-mock-credential-field strong {
  color: #1d2129;
  font-size: 12px;
}

.figma-mock-credential-field p {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 10px;
}

.figma-mock-app-form {
  gap: 14px;
}

.figma-mock-app-form label {
  gap: 5px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-app-form label > span {
  min-height: 18px;
}

.figma-mock-app-form label > span b {
  color: #f53f3f;
  font-weight: 500;
}

.figma-mock-app-form .config-mock-form__grid {
  gap: 14px;
}

.figma-mock-app-form :deep(.el-input__wrapper),
.figma-mock-app-form :deep(.el-select__wrapper) {
  min-height: 28px;
  padding: 1px 10px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.figma-mock-app-form :deep(.el-input__wrapper:hover),
.figma-mock-app-form :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #c9cdd4 inset;
}

.figma-mock-app-form :deep(.el-input__wrapper.is-focus),
.figma-mock-app-form :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #165dff inset;
}

.figma-mock-app-form :deep(.el-input__inner),
.figma-mock-app-form :deep(.el-select__selected-item),
.figma-mock-app-form :deep(.el-select__placeholder) {
  height: 20px;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-app-form :deep(.el-input__inner::placeholder),
.figma-mock-app-form :deep(.el-select__placeholder.is-transparent) {
  color: #c9cdd4;
}

.figma-mock-app-form__code :deep(.el-input__inner) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.figma-mock-app-form .figma-mock-form-tip {
  margin-top: -1px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-app-form :deep(.figma-mock-app-form__readonly-select .el-select__wrapper.is-disabled) {
  cursor: not-allowed;
  background: #fff;
  opacity: 1;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.figma-mock-app-form :deep(.figma-mock-app-form__readonly-select .el-select__selected-item),
.figma-mock-app-form :deep(.figma-mock-app-form__readonly-select .el-select__caret) {
  color: #4e5969;
  -webkit-text-fill-color: #4e5969;
}

.figma-mock-app-form .figma-mock-credential-field {
  min-height: 56px;
  gap: 14px;
  padding: 8.5px 10.5px;
  border-radius: 7px;
}

.figma-mock-app-form .figma-mock-credential-field strong {
  display: block;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-app-form .figma-mock-credential-field p {
  margin-top: 1px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

:deep(.figma-mock-app-dialog__cancel.el-button),
:deep(.figma-mock-app-dialog__submit.el-button) {
  margin-left: 7px;
  border-radius: 6px;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:deep(.figma-mock-app-dialog__cancel.el-button) {
  width: 49px;
  height: 28px;
  min-height: 28px;
  padding: 0 10.5px;
  color: #4e5969;
  background: transparent;
  border-color: transparent;
}

:deep(.figma-mock-app-dialog__submit.el-button) {
  width: 54px;
  height: 32px;
  min-height: 32px;
  padding: 0 13px;
  color: #fff;
  background: #165dff;
  border-color: #165dff;
}

.config-mock-combo-items {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-combo-items__header,
.config-mock-combo-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.config-mock-combo-items__header {
  justify-content: space-between;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-mock-combo-items__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-mock-combo-item {
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
}

.config-mock-combo-item__order {
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.config-mock-combo-item__remove {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-danger);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
}

.config-mock-combo-item__remove:hover {
  color: var(--app-danger-hover);
}

.config-mock-log-detail {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-log-detail dl {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: var(--app-space-2) var(--app-space-3);
  margin: 0;
}

.config-mock-log-detail dt {
  color: var(--app-text-secondary);
  font-weight: 600;
}

.config-mock-log-detail dd {
  min-width: 0;
  margin: 0;
  color: var(--app-text-primary);
  word-break: break-all;
}

.config-mock-log-detail h4 {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-primary);
}

.config-mock-log-detail pre {
  max-height: 240px;
  overflow: auto;
  margin: 0;
  padding: var(--app-space-3);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Mock Figma restoration: Design 342:22145 / 23309 / 24488. */
:deep(.figma-mock-scene-drawer) {
  top: 0;
  height: 100%;
  box-shadow: -4px 0 32px rgb(0 0 0 / 15%);
}

.figma-mock-scene-editor__head {
  padding: 0 24px;
}

.figma-mock-scene-editor__actions {
  flex: 0 0 auto;
}

.figma-mock-scene-btn {
  gap: 5px;
}

.figma-mock-scene-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: inherit;
}

.figma-mock-header-row button {
  width: 15.5px;
  height: 21px;
}

.figma-mock-scene-close:hover {
  background: #f5f6f8;
  color: #4e5969;
}

.figma-mock-scene-editor__summary {
  min-height: 39px;
  gap: 24px;
  padding: 0 24px;
}

.figma-mock-scene-editor__summary label:first-child {
  width: 190px;
}

.figma-mock-scene-editor__summary label:nth-child(2) {
  width: 96px;
}

.figma-mock-scene-editor__summary label:first-child :deep(.el-input) {
  width: 118px;
}

.figma-mock-scene-editor__summary label:nth-child(2) :deep(.el-input-number) {
  width: 44px;
}

.figma-mock-scene-editor__summary .is-inline-edit :deep(.el-input__wrapper),
.figma-mock-scene-editor__summary .is-inline-edit :deep(.el-input-number) {
  height: 24px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.figma-mock-scene-editor__summary .is-inline-edit :deep(.el-input__inner) {
  height: 24px;
  color: #1d2129;
  font: 500 13px/24px inherit;
  text-align: left;
}

.figma-mock-scene-editor__summary label:nth-child(2) :deep(.el-input__inner) {
  color: #165dff;
  font-family: Consolas, monospace;
  font-weight: 600;
}

.figma-mock-scene-editor__summary .is-inline-edit:focus-within :deep(.el-input__wrapper) {
  padding: 0 6px;
  background: #fff;
  box-shadow: 0 0 0 1px #165dff inset;
}

.figma-mock-scene-tabs {
  padding: 0 24px;
}

.figma-mock-scene-tabs button {
  font-size: 13px;
}

.figma-mock-scene-editor__body {
  padding: 21px;
}

.figma-mock-scene-section {
  gap: 20px;
}

.figma-mock-scene-section.is-match {
  gap: 0;
}

.figma-mock-scene-section.is-response {
  gap: 17.5px;
}

.figma-mock-scene-section.is-variables {
  gap: 0;
}

.figma-mock-add-row {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.figma-mock-rule-grid button,
.figma-mock-header-row button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  font-size: inherit;
}

.figma-mock-rule-grid button:hover,
.figma-mock-header-row button:hover {
  background: #fff0f0;
  color: #f53f3f;
}

.figma-mock-rule-grid:not(.is-head) :deep(.el-select__wrapper),
.figma-mock-rule-grid:not(.is-head) :deep(.el-input__wrapper) {
  box-sizing: border-box;
  height: 24.5px;
  min-height: 24.5px;
  padding: 0 8px;
  border-radius: 4px;
}

.figma-mock-rule-grid:not(.is-head) > .el-select:first-child :deep(.el-select__wrapper) {
  height: 21.5px;
  min-height: 21.5px;
  padding: 0 7px;
  background: #f2f3f5;
  box-shadow: none;
}

.figma-mock-rule-grid:not(.is-head) > .el-input:nth-child(2) :deep(.el-input__wrapper) {
  height: 18px;
  min-height: 18px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.figma-mock-response-grid :deep(.el-input-number) {
  width: 100%;
}

.figma-mock-response-grid :deep(.el-input-number .el-input__inner) {
  text-align: left;
}

.figma-mock-response-editor {
  min-height: 220px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #1e1e1e;
}

.figma-mock-response-editor__head {
  display: flex;
  height: 28.5px;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  border-bottom: 1px solid #333;
  background: #252526;
  color: #888;
  font-size: 11px;
}

.figma-mock-response-editor__head span:first-child {
  color: #9cdcfe;
}

.figma-mock-response-editor :deep(.api-code-editor),
.figma-mock-response-editor :deep(.api-code-editor__editor) {
  height: 189px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
}

.figma-mock-variable-tip {
  display: flex;
  align-items: flex-start;
  box-sizing: border-box;
  height: 81px;
  gap: 10.5px;
  padding: 8.75px 10.5px;
}

.figma-mock-variable-tip > svg {
  flex: 0 0 auto;
  margin-top: 2px;
}

.figma-mock-variable-tip strong {
  font-size: 12px;
  font-weight: 600;
}

.figma-mock-variable-tip p {
  font-size: 12px;
  line-height: 20px;
}

.figma-mock-variable-tip code {
  padding: 1px 4px;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
  font-family: Consolas, monospace;
}

.figma-mock-variable-source {
  display: inline-flex;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #4e5969;
}

.figma-mock-variable-table td.is-center {
  text-align: center;
}

.figma-mock-variable-table td.is-center svg {
  display: inline-block;
  vertical-align: middle;
}

:deep(.figma-mock-publish-dialog .el-dialog__header) {
  height: 80px;
  padding: 0 24px;
}

:deep(.figma-mock-publish-dialog) {
  display: flex;
  height: 596px;
  max-height: 85vh;
  flex-direction: column;
}

.figma-mock-publish-dialog__heading h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
}

.figma-mock-publish-dialog__heading p {
  display: flex;
  height: 21.5px;
  align-items: flex-end;
  margin: 0;
  color: #86909c;
  font-size: 12px;
}

:deep(.figma-mock-publish-dialog .el-dialog__body) {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.figma-mock-publish-dialog__stats {
  gap: 12px;
  margin-bottom: 20px;
}

.figma-mock-publish-dialog__stats div {
  min-height: 62px;
  padding: 11px 12px;
}

.figma-mock-publish-dialog__changes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.figma-mock-publish-dialog__change {
  min-height: 59px;
  margin: 0;
  padding: 10px 12px;
}

.figma-mock-publish-dialog__change strong {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.figma-mock-publish-dialog__change strong b {
  color: #165dff;
  font-size: 11px;
}

.figma-mock-publish-dialog__change.is-add > span {
  background: #e8ffea;
  color: #00b42a;
}

.figma-mock-publish-dialog__change.is-add strong b {
  color: #00b42a;
}

.figma-mock-publish-dialog__change.is-snapshot > span {
  background: #f2f3f5;
  color: #86909c;
}

.figma-mock-publish-dialog__change.is-snapshot strong b {
  color: #86909c;
}

:deep(.figma-mock-publish-dialog .el-dialog__footer) {
  min-height: 65px;
  padding: 14px 24px;
}

/* Mock typography restoration: Figma 342:19926 / 21058 / 22145 / 23309 / 24488. */
.figma-mock-scene-editor,
:deep(.figma-mock-publish-dialog) {
  font-family: var(--app-font-family);
}

.figma-mock-scene-method {
  font-family: var(--app-font-family);
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.figma-mock-scene-editor__path code {
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-scene-editor__path strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-mock-scene-editor__actions > span:not(.figma-mock-publish-chip) {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-publish-chip {
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-scene-btn {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-scene-editor__summary label > span {
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.figma-mock-scene-editor__summary label > b {
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-scene-editor__summary label:nth-child(2) > b,
.figma-mock-scene-editor__summary label:nth-child(4) > b {
  font-family: var(--app-font-family-mono);
  font-weight: 600;
}

.figma-mock-scene-editor__summary .is-inline-edit :deep(.el-input__inner) {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-scene-editor__summary label:nth-child(2) :deep(.el-input__inner) {
  font-family: var(--app-font-family-mono);
  font-weight: 600;
}

.figma-mock-scene-tabs button {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-scene-section__title strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-mock-scene-section__title p {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-scene-section__title.is-compact strong {
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-mode-switch span,
.figma-mock-mode-switch button,
.figma-mock-advanced-tip {
  font-family: var(--app-font-family);
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-mode-switch button {
  font-weight: 500;
}

.figma-mock-rule-grid.is-head > span,
.figma-mock-variable-table th {
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
}

.figma-mock-rule-grid :deep(.el-input__inner),
.figma-mock-rule-grid :deep(.el-select__selected-item),
.figma-mock-response-grid :deep(.el-input__inner),
.figma-mock-response-grid :deep(.el-select__selected-item),
.figma-mock-header-row :deep(.el-input__inner) {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-response-grid > label > span {
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-add-row,
.figma-mock-available-vars {
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-available-vars code {
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-response-editor__head {
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-mock-variable-tip strong,
.figma-mock-variable-tip p,
.figma-mock-variable-tip code {
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-variable-tip code,
.figma-mock-variable-table code {
  font-family: var(--app-font-family-mono);
}

.figma-mock-variable-table td {
  font-size: 12px;
  line-height: 18px;
}

.figma-mock-publish-dialog__heading h2 {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.figma-mock-publish-dialog__heading p {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-publish-dialog__stats span {
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.figma-mock-publish-dialog__stats strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-mock-publish-dialog__label {
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.figma-mock-publish-dialog__change strong {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-mock-publish-dialog__change strong b {
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.figma-mock-publish-dialog__change p {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-publish-dialog__note > span {
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-mock-publish-dialog__note small {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-publish-dialog__note :deep(.el-textarea__inner) {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-mock-publish-dialog__footer > span {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-mock-publish-dialog__footer :deep(.el-button) {
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

/* Publish dialog: exact geometry from Figma 342:25204. */
:deep(.figma-mock-publish-dialog) {
  height: 596.5px;
  margin-top: max(16px, calc((100vh - 596.5px) / 2));
}

:deep(.figma-mock-publish-dialog .el-dialog__header) {
  box-sizing: border-box;
  height: 81.5px;
  min-height: 81.5px;
  flex: 0 0 81.5px;
  padding: 0 21px;
}

:deep(.figma-mock-publish-dialog .el-dialog__body) {
  box-sizing: border-box;
  height: 454px;
  flex: 0 0 454px;
  padding: 17.5px 21px 16px;
}

:deep(.figma-mock-publish-dialog .el-dialog__footer) {
  box-sizing: border-box;
  height: 61px;
  min-height: 61px;
  flex: 0 0 61px;
  padding: 14px 21px;
}

.figma-mock-publish-dialog__stats {
  height: 62.5px;
  gap: 10.5px;
  margin-bottom: 17.5px;
}

.figma-mock-publish-dialog__stats div {
  box-sizing: border-box;
  height: 62.5px;
  min-height: 62.5px;
  padding: 11.5px;
}

.figma-mock-publish-dialog__label {
  height: 18px;
  margin-bottom: 0;
}

.figma-mock-publish-dialog__changes {
  box-sizing: border-box;
  height: 202.25px;
  gap: 7px;
  margin-bottom: 0;
  padding-top: 10.5px;
}

.figma-mock-publish-dialog__change {
  box-sizing: border-box;
  height: 59.25px;
  min-height: 59.25px;
  gap: 10.5px;
  padding: 8.75px 10.5px;
}

.figma-mock-publish-dialog__change > span {
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  margin-top: 1.75px;
}

.figma-mock-publish-dialog__change > div {
  height: 39.75px;
  flex: 1;
}

.figma-mock-publish-dialog__change strong {
  height: 20px;
  gap: 7px;
  line-height: 20px;
}

.figma-mock-publish-dialog__change p {
  height: 19.75px;
  margin: 0;
  line-height: 19.75px;
}

.figma-mock-publish-dialog__note {
  box-sizing: border-box;
  height: 120.25px;
  gap: 0;
  padding-top: 17.5px;
}

.figma-mock-publish-dialog__note > span {
  height: 23.25px;
}

.figma-mock-publish-dialog__note :deep(.el-textarea__inner) {
  box-sizing: border-box;
  height: 74.5px;
  min-height: 74.5px !important;
}

.figma-mock-publish-dialog__footer {
  height: 32px;
}

.figma-mock-publish-dialog__footer > span {
  gap: 5.25px;
}

.figma-mock-publish-dialog__footer > span svg {
  width: 13px;
  height: 13px;
}

.figma-mock-publish-dialog__footer > div {
  width: 136px;
  height: 32px;
  align-items: flex-start;
  gap: 7px;
}

.figma-mock-publish-dialog__footer > div :deep(.el-button) {
  margin: 0;
}

.figma-mock-publish-dialog__footer > div :deep(.el-button:first-child) {
  width: 49px;
  height: 28px;
  min-height: 28px;
  padding: 0 11.5px;
}

.figma-mock-publish-dialog__footer > div :deep(.el-button:last-child) {
  width: 80px;
  height: 32px;
  min-height: 32px;
  padding: 0 14px;
}

@media (max-width: 1100px) {
  .config-mock-layout {
    grid-template-columns: 1fr;
  }

  .config-mock-apps {
    min-height: auto;
  }
}
</style>
