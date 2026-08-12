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

<style scoped src="./config-mock-panel.css"></style>
