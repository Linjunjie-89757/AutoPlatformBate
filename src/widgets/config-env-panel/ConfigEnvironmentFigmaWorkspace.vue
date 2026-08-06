<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Activity as Connection,
  AlertTriangle as Warning,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle as CircleCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy as CopyDocument,
  Edit2 as Edit,
  Eye,
  Globe,
  Layers,
  Link2 as Link,
  Minus,
  Monitor,
  Plus,
  Power as SwitchButton,
  RefreshCw,
  Search,
  Server as Service,
  Trash2 as Delete,
  Timer,
  Variable,
  X as Close,
  XCircle as CircleClose,
  Zap,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  configApi,
  parseParamContent,
  type ConfigReferenceItem,
  type ConfigReferenceSummary,
  type EnvConfigItem,
  type MockApplicationItem,
  type MockReleaseItem,
  type ParamSetItem,
} from '@/entities/config'
import {
  buildCreateEnvPayload,
  createConfigEnvFormFromItem,
  createDefaultConfigEnvForm,
  createDefaultServiceEndpoint,
  type ConfigAutomationType,
  type ConfigEnvForm,
  type ConfigEnvLocalVariableForm,
  type ConfigEnvServiceEndpointForm,
  validateConfigEnvForm,
} from '@/features/config-env-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { parseWebUiVariables, type WebUiVariableItem } from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui/app-delete-confirm/confirmDelete'

type DetailTab = 'services' | 'variables' | 'mock' | 'effective' | 'references'
type ServiceTestState = 'untested' | 'testing' | 'success' | 'failed' | 'timeout'

interface ServiceEditorForm {
  key: string
  name: string
  baseUrl: string
  timeoutMs: number
  enabled: boolean
  isDefault: boolean
}

interface StageMeta {
  label: string
  color: string
  background: string
}

interface EnvironmentEditorForm {
  envName: string
  envType: string
  automationType: ConfigAutomationType
  description: string
}

interface LocalVariableEditorForm {
  name: string
  value: string
  valueType: NonNullable<ConfigEnvLocalVariableForm['valueType']>
  sensitive: boolean
  description: string
  enabled: boolean
}

interface RuntimeReferenceState {
  running?: boolean
  status?: string | null
  executionStatus?: string | null
}

type ReferenceKind = 'api-scenario' | 'api-suite' | 'web-ui' | 'scheduled'

interface ReferenceViewItem {
  key: string
  kind: ReferenceKind
  typeLabel: string
  sourceType: string
  sourceId: number | null
  name: string
  lastRun: string
  status: 'running' | 'idle' | 'unknown'
}

type EffectiveVariableSourceType = 'local' | 'variable-set' | 'workspace'

interface EffectiveVariableRow {
  name: string
  value: string
  rawValue: string
  source: string
  sourceType: EffectiveVariableSourceType
  overriddenSource: string | null
  description: string
  sensitive: boolean
  ok: boolean
  order: number
}

const props = withDefaults(defineProps<{ workspaceCode?: string }>(), { workspaceCode: 'ALL' })
const route = useRoute()
const router = useRouter()

const stageMeta: Record<string, StageMeta> = {
  DEV: { label: '开发', color: '#4e5969', background: '#f2f3f5' },
  TEST: { label: '测试', color: '#165dff', background: '#e8f3ff' },
  STAGING: { label: '预发布', color: '#7816ff', background: '#f5e8ff' },
  PROD: { label: '生产', color: '#f53f3f', background: '#ffe8e8' },
  SANDBOX: { label: '沙箱', color: '#0fc6c2', background: '#e8fffe' },
}

const envs = ref<EnvConfigItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const mockReleases = ref<MockReleaseItem[]>([])
const selectedEnvId = ref<number | null>(null)
const activeTab = ref<DetailTab>('services')
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const environmentDialogMode = ref<'create' | 'edit' | null>(null)
const disableDialogVisible = ref(false)
const serviceDialogVisible = ref(false)
const serviceEditingIndex = ref<number | null>(null)
const serviceTests = ref<Record<string, ServiceTestState>>({})
const variableSetVersions = ref<Record<number, number | null>>({})
const bindVariableSetVisible = ref(false)
const bindVariableSetSelection = ref<number[]>([])
const priorityDialogVisible = ref(false)
const priorityDraft = ref<number[]>([])
const localVariableDialogMode = ref<'create' | 'edit' | null>(null)
const localVariableEditingIndex = ref<number | null>(null)
const deleteLocalVariableIndex = ref<number | null>(null)
const mockBindDialogVisible = ref(false)
const mockBindApplicationId = ref<number | null>(null)
const mockBindReleaseId = ref<number | null>(null)
const mockBindReleases = ref<MockReleaseItem[]>([])
const mockVersionDialogVisible = ref(false)
const mockVersionSelection = ref<number | null>(null)
const mockUnbindDialogVisible = ref(false)
const mockEndpointCount = ref<number | null>(null)
const mockScenarioCount = ref<number | null>(null)
const mockUnmatched24hCount = ref<number | null>(null)
const mockReferenceCount = ref<number | null>(null)
const effectiveSourceFilter = ref<'all' | EffectiveVariableSourceType>('all')
const effectiveKeyword = ref('')
const form = reactive<ConfigEnvForm>(createDefaultConfigEnvForm(props.workspaceCode))
const environmentEditor = reactive<EnvironmentEditorForm>({
  envName: '',
  envType: 'TEST',
  automationType: 'API',
  description: '',
})
const serviceEditor = reactive<ServiceEditorForm>(createServiceEditor())
const localVariableEditor = reactive<LocalVariableEditorForm>(createLocalVariableEditor())

const environmentStageOptions = [
  { value: 'DEV', label: '开发' },
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发布' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
]
const environmentApplicabilityOptions: Array<{ value: ConfigAutomationType; label: string; icon: 'api' | 'web' | 'both' }> = [
  { value: 'API', label: '接口自动化', icon: 'api' },
  { value: 'WEB_UI', label: 'Web UI 自动化', icon: 'web' },
  { value: 'API_WEB_UI', label: '接口 + Web UI', icon: 'both' },
]
const localVariableTypeOptions: LocalVariableEditorForm['valueType'][] = ['string', 'integer', 'boolean', 'secret']

const selectedEnv = computed(() => envs.value.find(item => item.id === selectedEnvId.value) || null)
const selectedStage = computed(() => stageMeta[form.envType] || stageMeta.TEST)
const filteredEnvs = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return envs.value.filter(item => !query || item.envName.toLowerCase().includes(query))
})
const selectedVariableSets = computed(() => form.variableSetIds
  .map(id => variableSets.value.find(item => item.id === id))
  .filter((item): item is ParamSetItem => Boolean(item)))
const availableVariableSets = computed(() => variableSets.value.filter(item => (
  item.paramType !== 'GLOBAL' && !form.variableSetIds.includes(item.id)
)))
const deleteLocalVariable = computed(() => (
  deleteLocalVariableIndex.value == null ? null : form.localVariables[deleteLocalVariableIndex.value] || null
))
const priorityPreviewSets = computed(() => priorityDraft.value
  .map(id => variableSets.value.find(item => item.id === id))
  .filter((item): item is ParamSetItem => Boolean(item)))
const variableSetConflicts = computed(() => {
  const owners = new Map<string, Array<{ name: string; set: ParamSetItem }>>()
  selectedVariableSets.value.forEach(set => {
    parseWebUiVariables(set.contentJson).forEach(variable => {
      if (!variable.name || variable.enabled === false) return
      const key = variable.name.toUpperCase()
      const list = owners.get(key) || []
      list.push({ name: variable.name, set })
      owners.set(key, list)
    })
  })
  return Array.from(owners.values()).filter(items => items.length > 1)
})
const referenceCount = computed(() => referenceSummary.value?.totalCount || 0)
const runningReferences = computed(() => (referenceSummary.value?.items || []).filter(item => {
  const runtime = item as typeof item & RuntimeReferenceState
  const status = String(runtime.executionStatus || runtime.status || '').toUpperCase()
  return runtime.running === true || status === 'RUNNING' || status === 'EXECUTING' || status === 'IN_PROGRESS'
}))
const referenceRows = computed<ReferenceViewItem[]>(() => (referenceSummary.value?.items || []).map((item, index) => {
  const kind = referenceKind(item.sourceType)
  return {
    key: `${item.sourceType}-${item.sourceId ?? index}-${index}`,
    kind,
    typeLabel: referenceTypeMeta(kind).label,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    name: item.sourceName || '未命名引用',
    lastRun: formatReferenceTime(item.updatedAt),
    status: referenceRuntimeStatus(item),
  }
}))
const referenceStats = computed(() => (['api-scenario', 'api-suite', 'web-ui', 'scheduled'] as ReferenceKind[])
  .map(kind => ({ kind, count: referenceRows.value.filter(item => item.kind === kind).length }))
  .filter(item => item.count > 0))
const referenceListIsSampled = computed(() => referenceCount.value > referenceRows.value.length)
const configIssueCount = computed(() => calculateConfigIssues(form))
const configComplete = computed(() => configIssueCount.value === 0)
const applicationLabel = computed(() => {
  if (form.automationType === 'API_WEB_UI') return '接口 + Web UI'
  if (form.automationType === 'WEB_UI') return 'Web UI 自动化'
  if (form.automationType === 'APP') return 'APP 自动化'
  return '接口自动化'
})
const variableCount = computed(() => form.variableSetIds.length + form.localVariables.length)
const defaultServiceCount = computed(() => form.services.filter(item => item.key === form.defaultServiceKey).length)
const selectedMockApplication = computed(() => mockApplications.value.find(item => item.id === form.mockApplicationId) || null)
const selectedMockRelease = computed(() => mockReleases.value.find(item => item.id === form.mockReleaseId) || null)
const mockBound = computed(() => form.mockApplicationId != null && form.mockReleaseId != null)
const mockBaseUrl = computed(() => selectedMockApplication.value ? `/api/mock/${selectedMockApplication.value.appCode}` : '—')
const mockVersionOptions = computed(() => [...mockReleases.value].sort((left, right) => right.versionNo - left.versionNo))
const selectedMockVersionOption = computed(() => mockVersionOptions.value.find(item => item.id === mockVersionSelection.value) || null)
const productionEnvironment = computed(() => form.envType === 'PROD')
const effectiveVariables = computed<EffectiveVariableRow[]>(() => buildEffectiveVariables())
const filteredEffectiveVariables = computed(() => {
  const query = effectiveKeyword.value.trim().toLowerCase()
  return effectiveVariables.value.filter(item => (
    (effectiveSourceFilter.value === 'all' || item.sourceType === effectiveSourceFilter.value)
    && (!query || item.name.toLowerCase().includes(query))
  ))
})

function createServiceEditor(service?: ConfigEnvServiceEndpointForm, isDefault = false): ServiceEditorForm {
  const initial = service || createDefaultServiceEndpoint()
  return {
    key: initial.key,
    name: service?.name || '',
    baseUrl: service?.baseUrl || '',
    timeoutMs: service?.timeoutMs || 30000,
    enabled: service?.enabled !== false,
    isDefault,
  }
}

function paramSetVariables(item: ParamSetItem): WebUiVariableItem[] {
  const variables = parseWebUiVariables(item.contentJson)
  if (variables.length) return variables
  const legacy = parseParamContent(item.contentJson)
  if (!item.paramName.trim() || !legacy.value) return []
  return [{
    name: item.paramName,
    value: legacy.value,
    sensitive: legacy.sensitive,
    description: legacy.description,
    enabled: true,
  }]
}

function variableAppliesToEnvironment(item: WebUiVariableItem) {
  if (item.enabled === false) return false
  const stage = item.stageType || 'COMMON'
  if (stage !== 'COMMON' && stage !== form.envType) return false
  const scope = item.scopeType || 'ALL'
  if (scope === 'ALL') return true
  if (form.automationType === 'API_WEB_UI') return scope === 'API' || scope === 'WEB_UI'
  return scope === form.automationType
}

function buildEffectiveVariables(): EffectiveVariableRow[] {
  const resolvedRows = new Map<string, EffectiveVariableRow>()
  let order = 0
  const put = (
    variable: Pick<WebUiVariableItem, 'name' | 'value' | 'sensitive'>,
    source: string,
    sourceType: EffectiveVariableSourceType,
  ) => {
    const name = variable.name.trim()
    if (!name) return
    const key = name.toUpperCase()
    const previous = resolvedRows.get(key)
    resolvedRows.set(key, {
      name,
      value: variable.value,
      rawValue: variable.value,
      source,
      sourceType,
      overriddenSource: previous && previous.source !== source ? previous.source : null,
      description: '',
      sensitive: variable.sensitive,
      ok: true,
      order: order++,
    })
  }

  variableSets.value
    .filter(item => item.paramType === 'GLOBAL' && item.status === 1)
    .forEach(item => paramSetVariables(item).filter(variableAppliesToEnvironment).forEach(variable => (
      put(variable, '工作区全局变量', 'workspace')
    )))

  const boundVariableSets = [...selectedVariableSets.value]
  boundVariableSets
    .reverse()
    .filter(item => !form.disabledVariableSetIds.includes(item.id))
    .forEach(item => paramSetVariables(item).filter(variableAppliesToEnvironment).forEach(variable => (
      put(variable, item.paramName, 'variable-set')
    )))

  form.localVariables
    .filter(item => item.enabled !== false)
    .forEach(variable => put(variable, '环境局部覆盖', 'local'))

  const referencePattern = /\{\{\s*([\w.-]+)\s*}}|\$\{\s*([\w.-]+)\s*}/g
  const resolveValue = (row: EffectiveVariableRow, stack = new Set<string>()): { value: string; unresolved: string[] } => {
    const key = row.name.toUpperCase()
    if (stack.has(key)) return { value: row.rawValue, unresolved: [row.name] }
    const nextStack = new Set(stack)
    nextStack.add(key)
    const unresolved: string[] = []
    const value = row.rawValue.replace(referencePattern, (token, first: string | undefined, second: string | undefined) => {
      const reference = first || second || ''
      const target = resolvedRows.get(reference.toUpperCase())
      if (!target) {
        unresolved.push(token)
        return token
      }
      const nested = resolveValue(target, nextStack)
      unresolved.push(...nested.unresolved)
      return nested.value
    })
    return { value, unresolved: Array.from(new Set(unresolved)) }
  }

  const sourceRank: Record<EffectiveVariableSourceType, number> = {
    local: 0,
    'variable-set': 1,
    workspace: 2,
  }
  return Array.from(resolvedRows.values())
    .map(row => {
      const resolution = resolveValue(row)
      const unresolved = resolution.unresolved
      const overrideDescription = row.overriddenSource
        ? row.sourceType === 'local'
          ? '局部变量覆盖了变量集或全局配置中的同名变量'
          : `按变量集优先级覆盖了 ${row.overriddenSource} 中的同名变量`
        : ''
      return {
        ...row,
        value: row.sensitive ? '••••••••' : unresolved.length ? '—' : resolution.value,
        description: unresolved.length
          ? `引用了无法解析的变量 ${unresolved.join('、')}`
          : row.sensitive
            ? '敏感变量，已脱敏'
            : overrideDescription || '—',
        ok: unresolved.length === 0,
      }
    })
    .sort((left, right) => sourceRank[left.sourceType] - sourceRank[right.sourceType] || left.order - right.order)
}

function createLocalVariableEditor(variable?: ConfigEnvLocalVariableForm): LocalVariableEditorForm {
  const valueType = variable?.valueType || (variable?.sensitive ? 'secret' : 'string')
  return {
    name: variable?.name || '',
    value: variable?.value || '',
    valueType,
    sensitive: variable?.sensitive === true || valueType === 'secret',
    description: variable?.description || '',
    enabled: variable?.enabled !== false,
  }
}

function variableSetScopeLabel(item: ParamSetItem) {
  const labels: Record<string, string> = {
    BUSINESS: '通用',
    API_VARIABLE_SET: '接口自动化',
    WEB_UI_VARIABLE_SET: 'Web UI',
    APP_UI_VARIABLE_SET: 'APP 自动化',
    PAYMENT_CHANNEL: '支付渠道',
  }
  return labels[item.paramType] || item.workspaceName || '当前工作区'
}

function variableSetHasSensitive(item: ParamSetItem) {
  return parseWebUiVariables(item.contentJson).some(variable => variable.sensitive)
}

function variableSetVersionLabel(item: ParamSetItem) {
  const version = variableSetVersions.value[item.id]
  return version ? `v${version}` : 'v—'
}

function isVariableSetEnabled(item: ParamSetItem) {
  return !form.disabledVariableSetIds.includes(item.id)
}

function formForEnv(env: EnvConfigItem) {
  return createConfigEnvFormFromItem(env)
}

function calculateConfigIssues(target: ConfigEnvForm) {
  let issues = 0
  if (!target.services.length) issues += 1
  if (target.services.some(service => !service.name.trim() || !service.baseUrl.trim())) issues += 1
  if ((target.mockApplicationId || target.mockReleaseId) && (!target.mockApplicationId || !target.mockReleaseId)) issues += 1
  return issues
}

function environmentCardSummary(env: EnvConfigItem) {
  const envForm = formForEnv(env)
  return {
    stage: stageMeta[envForm.envType] || stageMeta.TEST,
    services: envForm.services.filter(service => service.baseUrl).length,
    variableSets: envForm.variableSetIds.length,
    issues: calculateConfigIssues(envForm),
    mockEnabled: Boolean(envForm.mockApplicationId && envForm.mockReleaseId),
  }
}

async function loadData(preferredId = selectedEnvId.value, preferredTab?: DetailTab) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [envPage, variablePage, mockPage] = await Promise.all([
      configApi.getSettingsEnvs(props.workspaceCode),
      configApi.getSettingsParams(props.workspaceCode, { status: 1 }),
      configApi.getMockApplications(props.workspaceCode, { status: 1 }),
    ])
    envs.value = envPage.items || []
    variableSets.value = variablePage.items || []
    mockApplications.value = mockPage.items || []
    const next = envs.value.find(item => item.id === preferredId) || envs.value[0] || null
    if (next) await selectEnv(next, preferredTab)
    else selectedEnvId.value = null
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadVariableSetVersions() {
  const candidates = variableSets.value.filter(item => (
    item.id > 0
    && item.paramType !== 'GLOBAL'
    && !Object.prototype.hasOwnProperty.call(variableSetVersions.value, item.id)
  ))
  if (!candidates.length) return
  const entries = await Promise.all(candidates.map(async item => {
    try {
      const page = await configApi.getSettingsParamVersions(item.workspaceCode || props.workspaceCode, item.id)
      const versions = page.items || []
      const latest = versions.find(version => version.latest) || versions.reduce((current, version) => (
        !current || version.versionNo > current.versionNo ? version : current
      ), versions[0])
      return [item.id, latest?.versionNo || null] as const
    } catch {
      return [item.id, null] as const
    }
  }))
  variableSetVersions.value = { ...variableSetVersions.value, ...Object.fromEntries(entries) }
}

async function selectEnv(env: EnvConfigItem, preferredTab: DetailTab = 'services') {
  selectedEnvId.value = env.id
  Object.assign(form, createConfigEnvFormFromItem(env))
  activeTab.value = preferredTab
  effectiveSourceFilter.value = 'all'
  effectiveKeyword.value = ''
  serviceTests.value = {}
  await Promise.all([
    loadReferences(),
    loadMockReleases(form.mockApplicationId),
    loadMockMetadata(form.mockApplicationId),
  ])
}

async function loadReferences() {
  referenceSummary.value = null
  if (!selectedEnvId.value) return
  referenceLoading.value = true
  try {
    referenceSummary.value = await configApi.getSettingsEnvReferences(props.workspaceCode, selectedEnvId.value)
  } catch {
    referenceSummary.value = null
  } finally {
    referenceLoading.value = false
  }
}

async function loadMockReleases(applicationId: number | null) {
  mockReleases.value = []
  if (!applicationId) return
  try {
    mockReleases.value = await configApi.getMockReleases(props.workspaceCode, applicationId)
  } catch {
    mockReleases.value = []
  }
}

async function loadMockMetadata(applicationId: number | null) {
  mockEndpointCount.value = null
  mockScenarioCount.value = null
  mockUnmatched24hCount.value = null
  mockReferenceCount.value = null
  if (!applicationId) return
  try {
    const [endpointPage, logPage, references] = await Promise.all([
      configApi.getMockEndpoints(props.workspaceCode, { appId: applicationId, status: 1 }),
      configApi.getMockCallLogs(props.workspaceCode, { appId: applicationId }),
      configApi.getMockApplicationReferences(props.workspaceCode, applicationId),
    ])
    mockEndpointCount.value = endpointPage.total
    mockReferenceCount.value = references.totalCount
    const scenarioPages = await Promise.all((endpointPage.items || []).map(endpoint => (
      configApi.getMockScenarios(props.workspaceCode, { endpointId: endpoint.id, status: 1 })
        .catch(() => null)
    )))
    mockScenarioCount.value = scenarioPages.reduce((total, page) => total + (page?.total || 0), 0)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    mockUnmatched24hCount.value = (logPage.items || []).filter(item => (
      !item.matched && (!item.createdAt || new Date(item.createdAt).getTime() >= cutoff)
    )).length
  } catch {
    // Mock 主信息仍可展示；统计能力不可用时使用占位符，不伪造设计稿示例数据。
  }
}

async function saveCurrentForm(
  successMessage = '环境配置已保存',
  options: { reload?: boolean } = {},
) {
  if (!selectedEnv.value) return false
  const validationMessage = validateConfigEnvForm(form)
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return false
  }
  saving.value = true
  try {
    const currentTab = activeTab.value
    const updated = await configApi.updateSettingsEnv(
      props.workspaceCode,
      selectedEnv.value.id,
      buildCreateEnvPayload(form),
    )
    if (options.reload === false) {
      const index = envs.value.findIndex(item => item.id === updated.id)
      if (index >= 0) envs.value.splice(index, 1, updated)
      else envs.value.push(updated)
      selectedEnvId.value = updated.id
      Object.assign(form, createConfigEnvFormFromItem(updated))
      activeTab.value = currentTab
    } else {
      await loadData(updated.id, currentTab)
    }
    ElMessage.success(successMessage)
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return false
  } finally {
    saving.value = false
  }
}

function openAddService() {
  serviceEditingIndex.value = null
  Object.assign(serviceEditor, createServiceEditor())
  serviceEditor.key = `service-${Date.now()}`
  serviceDialogVisible.value = true
}

function openEditService(index: number) {
  const service = form.services[index]
  if (!service) return
  serviceEditingIndex.value = index
  Object.assign(serviceEditor, createServiceEditor(service, service.key === form.defaultServiceKey))
  serviceDialogVisible.value = true
}

function closeServiceDialog() {
  serviceDialogVisible.value = false
  serviceEditingIndex.value = null
}

async function submitService() {
  if (!serviceEditor.name.trim()) {
    ElMessage.warning('请输入服务名称')
    return
  }
  if (!/^https?:\/\//i.test(serviceEditor.baseUrl.trim())) {
    ElMessage.warning('Base URL 必须以 http:// 或 https:// 开头')
    return
  }
  const next: ConfigEnvServiceEndpointForm = {
    key: serviceEditor.key || `service-${Date.now()}`,
    name: serviceEditor.name.trim(),
    baseUrl: serviceEditor.baseUrl.trim(),
    timeoutMs: Math.min(120000, Math.max(1000, Number(serviceEditor.timeoutMs) || 30000)),
    enabled: serviceEditor.enabled,
  }
  if (serviceEditingIndex.value == null) form.services.push(next)
  else form.services.splice(serviceEditingIndex.value, 1, next)
  if (serviceEditor.isDefault || form.services.length === 1) {
    form.defaultServiceKey = next.key
    form.baseUrl = next.baseUrl
  }
  const saved = await saveCurrentForm(serviceEditingIndex.value == null ? '服务已添加' : '服务已更新')
  if (saved) closeServiceDialog()
}

async function copyService(index: number) {
  const source = form.services[index]
  if (!source) return
  form.services.splice(index + 1, 0, {
    ...source,
    key: `service-${Date.now()}`,
    name: `副本 - ${source.name}`,
  })
  await saveCurrentForm('服务已复制')
}

async function removeService(index: number) {
  const service = form.services[index]
  if (!service) return
  try {
    await confirmDelete({
      title: '删除服务',
      message: `确认删除服务「${service.name}」吗？`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }
  form.services.splice(index, 1)
  if (service.key === form.defaultServiceKey) {
    form.defaultServiceKey = form.services[0]?.key || 'default'
    form.baseUrl = form.services[0]?.baseUrl || ''
  }
  await saveCurrentForm('服务已删除')
}

function testConnection(service?: ConfigEnvServiceEndpointForm) {
  const key = service?.key || serviceEditor.key || 'draft'
  serviceTests.value = { ...serviceTests.value, [key]: 'testing' }
  window.setTimeout(() => {
    serviceTests.value = { ...serviceTests.value, [key]: 'untested' }
    ElMessage.warning('服务连接测试接口暂未接入，未伪造测试结果')
  }, 450)
}

function batchTestConnections() {
  ElMessage.warning('批量连接测试接口暂未接入，未伪造测试结果')
}

async function switchStatus() {
  if (!selectedEnv.value) return
  if (selectedEnv.value.status === 1) {
    await loadReferences()
    disableDialogVisible.value = true
    return
  }
  await submitStatusChange()
}

async function submitStatusChange() {
  if (!selectedEnv.value) return
  operating.value = true
  try {
    await toggleConfigEnvStatus(selectedEnv.value, props.workspaceCode)
    await loadData(selectedEnv.value.id)
    disableDialogVisible.value = false
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operating.value = false
  }
}

async function removeEnvironment() {
  if (!selectedEnv.value) return
  const currentId = selectedEnv.value.id
  operating.value = true
  try {
    await deleteConfigEnv(selectedEnv.value, props.workspaceCode)
    await loadData(envs.value.find(item => item.id !== currentId)?.id || null)
    ElMessage.success('环境已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operating.value = false
  }
}

async function copyEnvironment() {
  if (!selectedEnv.value) return
  saving.value = true
  try {
    const payload = buildCreateEnvPayload(form)
    const created = await configApi.createSettingsEnv(props.workspaceCode, {
      ...payload,
      envName: `副本 - ${form.envName}`,
    })
    await loadData(created.id)
    ElMessage.success('环境副本已创建')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function editEnvironment() {
  Object.assign(environmentEditor, {
    envName: form.envName,
    envType: form.envType,
    automationType: form.automationType,
    description: form.description,
  })
  environmentDialogMode.value = 'edit'
}

function closeEnvironmentDialog() {
  environmentDialogMode.value = null
}

async function submitEnvironment() {
  if (!environmentEditor.envName.trim()) {
    ElMessage.warning('请输入环境名称')
    return
  }
  if (environmentDialogMode.value === 'create') {
    const createForm = createDefaultConfigEnvForm(props.workspaceCode)
    Object.assign(createForm, {
      envName: environmentEditor.envName.trim(),
      envType: environmentEditor.envType,
      automationType: environmentEditor.automationType,
      description: environmentEditor.description.trim(),
    })
    saving.value = true
    try {
      const created = await configApi.createSettingsEnv(props.workspaceCode, buildCreateEnvPayload(createForm))
      await loadData(created.id)
      closeEnvironmentDialog()
      ElMessage.success('环境已创建')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      saving.value = false
    }
    return
  }
  const previous = {
    envName: form.envName,
    envType: form.envType,
    automationType: form.automationType,
    description: form.description,
  }
  Object.assign(form, {
    envName: environmentEditor.envName.trim(),
    envType: environmentEditor.envType,
    automationType: environmentEditor.automationType,
    description: environmentEditor.description.trim(),
  })
  const saved = await saveCurrentForm('环境已更新')
  if (saved) closeEnvironmentDialog()
  else Object.assign(form, previous)
}

function createEnvironment() {
  Object.assign(environmentEditor, {
    envName: '',
    envType: 'TEST',
    automationType: 'API_WEB_UI',
    description: '',
  })
  environmentDialogMode.value = 'create'
}

function openBindVariableSetDialog() {
  bindVariableSetSelection.value = []
  bindVariableSetVisible.value = true
  void loadVariableSetVersions()
}

function toggleVariableSetSelection(id: number) {
  bindVariableSetSelection.value = bindVariableSetSelection.value.includes(id)
    ? bindVariableSetSelection.value.filter(item => item !== id)
    : [...bindVariableSetSelection.value, id]
}

async function bindSelectedVariableSets() {
  if (!bindVariableSetSelection.value.length) return
  const previous = [...form.variableSetIds]
  form.variableSetIds = Array.from(new Set([...form.variableSetIds, ...bindVariableSetSelection.value]))
  const saved = await saveCurrentForm('变量集已绑定')
  if (saved) bindVariableSetVisible.value = false
  else form.variableSetIds = previous
}

function openPriorityDialog() {
  priorityDraft.value = [...form.variableSetIds]
  priorityDialogVisible.value = true
}

function movePriorityDraft(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= priorityDraft.value.length) return
  const next = [...priorityDraft.value]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  priorityDraft.value = next
}

async function saveVariableSetPriority() {
  const previous = [...form.variableSetIds]
  form.variableSetIds = [...priorityDraft.value]
  const saved = await saveCurrentForm('变量集优先级已保存')
  if (saved) priorityDialogVisible.value = false
  else form.variableSetIds = previous
}

async function moveBoundVariableSet(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= form.variableSetIds.length) return
  const previous = [...form.variableSetIds]
  const next = [...form.variableSetIds]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  form.variableSetIds = next
  if (!await saveCurrentForm('变量集优先级已更新')) form.variableSetIds = previous
}

async function toggleVariableSetEnabled(item: ParamSetItem) {
  const previous = [...form.disabledVariableSetIds]
  form.disabledVariableSetIds = isVariableSetEnabled(item)
    ? [...form.disabledVariableSetIds, item.id]
    : form.disabledVariableSetIds.filter(id => id !== item.id)
  if (!await saveCurrentForm(isVariableSetEnabled(item) ? '变量集已启用' : '变量集已停用')) {
    form.disabledVariableSetIds = previous
  }
}

async function unbindVariableSet(item: ParamSetItem) {
  const previousIds = [...form.variableSetIds]
  const previousDisabledIds = [...form.disabledVariableSetIds]
  form.variableSetIds = form.variableSetIds.filter(id => id !== item.id)
  form.disabledVariableSetIds = form.disabledVariableSetIds.filter(id => id !== item.id)
  if (!await saveCurrentForm('变量集已解除绑定')) {
    form.variableSetIds = previousIds
    form.disabledVariableSetIds = previousDisabledIds
  }
}

function goToVariableSetConfig() {
  void router.push({
    path: route.path,
    query: { ...route.query, tab: 'param' },
  })
}

function goToMockService() {
  void router.push({
    path: route.path,
    query: { ...route.query, tab: 'mock' },
  })
}

async function openMockBindDialog() {
  if (productionEnvironment.value) {
    ElMessage.warning('生产环境禁止绑定 Mock')
    return
  }
  mockBindApplicationId.value = form.mockApplicationId || mockApplications.value[0]?.id || null
  mockBindReleaseId.value = null
  mockBindReleases.value = []
  if (mockBindApplicationId.value) {
    try {
      mockBindReleases.value = await configApi.getMockReleases(props.workspaceCode, mockBindApplicationId.value)
      const activeRelease = mockBindReleases.value.find(item => item.active) || mockBindReleases.value[0]
      mockBindReleaseId.value = activeRelease?.id || null
    } catch {
      mockBindReleases.value = []
    }
  }
  mockBindDialogVisible.value = true
}

async function changeMockBindApplication(applicationId: number | null) {
  mockBindReleaseId.value = null
  mockBindReleases.value = []
  if (!applicationId) return
  try {
    mockBindReleases.value = await configApi.getMockReleases(props.workspaceCode, applicationId)
    const activeRelease = mockBindReleases.value.find(item => item.active) || mockBindReleases.value[0]
    mockBindReleaseId.value = activeRelease?.id || null
  } catch {
    ElMessage.error('Mock 发布版本加载失败')
  }
}

async function confirmMockBinding() {
  if (!mockBindApplicationId.value || !mockBindReleaseId.value) {
    ElMessage.warning('请选择 Mock 应用和发布版本')
    return
  }
  const previous = {
    enabled: form.mockEnabled,
    applicationId: form.mockApplicationId,
    releaseId: form.mockReleaseId,
  }
  form.mockApplicationId = mockBindApplicationId.value
  form.mockReleaseId = mockBindReleaseId.value
  form.mockEnabled = true
  const saved = await saveCurrentForm('Mock 应用已绑定')
  if (saved) mockBindDialogVisible.value = false
  else {
    form.mockEnabled = previous.enabled
    form.mockApplicationId = previous.applicationId
    form.mockReleaseId = previous.releaseId
  }
}

async function toggleMockEnabled() {
  if (!mockBound.value) {
    await openMockBindDialog()
    return
  }
  if (!form.mockEnabled && productionEnvironment.value) {
    ElMessage.warning('生产环境禁止启用 Mock')
    return
  }
  const previous = form.mockEnabled
  form.mockEnabled = !previous
  if (!await saveCurrentForm(
    form.mockEnabled ? 'Mock 已启用' : 'Mock 已停用',
    { reload: false },
  )) form.mockEnabled = previous
}

function openMockVersionDialog() {
  const next = mockVersionOptions.value.find(item => item.id !== form.mockReleaseId)
  if (!next) {
    ElMessage.warning('暂无其他可切换的发布版本')
    return
  }
  mockVersionSelection.value = next.id
  mockVersionDialogVisible.value = true
}

async function confirmMockVersionSwitch() {
  if (!mockVersionSelection.value || mockVersionSelection.value === form.mockReleaseId) return
  const previous = form.mockReleaseId
  form.mockReleaseId = mockVersionSelection.value
  const version = selectedMockVersionOption.value?.versionNo
  const saved = await saveCurrentForm(version == null ? 'Mock 版本已切换' : `Mock 版本已切换至 v${version}`)
  if (saved) mockVersionDialogVisible.value = false
  else form.mockReleaseId = previous
}

async function confirmMockUnbind() {
  const previous = {
    enabled: form.mockEnabled,
    applicationId: form.mockApplicationId,
    releaseId: form.mockReleaseId,
  }
  form.mockEnabled = false
  form.mockApplicationId = null
  form.mockReleaseId = null
  const saved = await saveCurrentForm('Mock 绑定已解除')
  if (saved) mockUnbindDialogVisible.value = false
  else {
    form.mockEnabled = previous.enabled
    form.mockApplicationId = previous.applicationId
    form.mockReleaseId = previous.releaseId
  }
}

function openLocalVariableDialog(index?: number) {
  const variable = index == null ? undefined : form.localVariables[index]
  localVariableEditingIndex.value = index ?? null
  Object.assign(localVariableEditor, createLocalVariableEditor(variable))
  localVariableDialogMode.value = variable ? 'edit' : 'create'
}

function closeLocalVariableDialog() {
  localVariableDialogMode.value = null
  localVariableEditingIndex.value = null
}

function syncLocalVariableType() {
  if (localVariableEditor.valueType === 'secret') localVariableEditor.sensitive = true
}

function validateLocalVariableEditor() {
  const name = localVariableEditor.name.trim()
  if (!name) return '请输入变量名'
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) return '变量名格式不正确'
  const duplicate = form.localVariables.some((variable, index) => (
    index !== localVariableEditingIndex.value && variable.name.trim().toUpperCase() === name.toUpperCase()
  ))
  return duplicate ? `变量名 ${name} 已存在` : ''
}

async function submitLocalVariable() {
  const validationMessage = validateLocalVariableEditor()
  if (validationMessage) {
    ElMessage.warning(validationMessage)
    return
  }
  const previous = form.localVariables.map(variable => ({ ...variable }))
  const variable: ConfigEnvLocalVariableForm = {
    name: localVariableEditor.name.trim(),
    value: localVariableEditor.value,
    valueType: localVariableEditor.valueType,
    sensitive: localVariableEditor.sensitive || localVariableEditor.valueType === 'secret',
    description: localVariableEditor.description.trim(),
    enabled: localVariableEditor.enabled,
  }
  if (localVariableEditingIndex.value == null) form.localVariables.push(variable)
  else form.localVariables.splice(localVariableEditingIndex.value, 1, variable)
  const saved = await saveCurrentForm(localVariableEditingIndex.value == null ? '局部变量已添加' : '局部变量已更新')
  if (saved) closeLocalVariableDialog()
  else form.localVariables = previous
}

async function toggleLocalVariable(index: number) {
  const variable = form.localVariables[index]
  if (!variable) return
  const previous = variable.enabled !== false
  variable.enabled = !previous
  if (!await saveCurrentForm(variable.enabled ? '局部变量已启用' : '局部变量已停用')) variable.enabled = previous
}

function requestDeleteLocalVariable(index: number) {
  deleteLocalVariableIndex.value = index
}

async function confirmDeleteLocalVariable() {
  if (deleteLocalVariableIndex.value == null) return
  const previous = form.localVariables.map(variable => ({ ...variable }))
  form.localVariables.splice(deleteLocalVariableIndex.value, 1)
  const saved = await saveCurrentForm('局部变量已删除')
  if (saved) deleteLocalVariableIndex.value = null
  else form.localVariables = previous
}

const REFERENCE_TYPE_META = {
  'api-scenario': { label: '接口场景', color: '#ff7d00', background: '#fff3e8', icon: Zap },
  'api-suite': { label: '接口套件', color: '#165dff', background: '#e8f3ff', icon: Layers },
  'web-ui': { label: 'Web UI', color: '#0fc6c2', background: '#e8fffe', icon: Monitor },
  scheduled: { label: '定时任务', color: '#7816ff', background: '#f5e8ff', icon: Timer },
} as const

function referenceKind(sourceType: string): ReferenceKind {
  const normalized = sourceType.toLowerCase()
  if (normalized.includes('web ui') || normalized.includes('webui')) return 'web-ui'
  if (normalized.includes('定时') || normalized.includes('任务')) return 'scheduled'
  if (normalized.includes('套件')) return 'api-suite'
  return 'api-scenario'
}

function referenceTypeMeta(kind: ReferenceKind) {
  return REFERENCE_TYPE_META[kind]
}

function referenceRuntimeStatus(item: ConfigReferenceItem): ReferenceViewItem['status'] {
  const runtime = item as ConfigReferenceItem & RuntimeReferenceState
  const status = String(runtime.executionStatus || runtime.status || '').toUpperCase()
  if (runtime.running === true || status === 'RUNNING' || status === 'EXECUTING' || status === 'IN_PROGRESS') return 'running'
  if (runtime.running === false || status === 'IDLE' || status === 'COMPLETED' || status === 'SUCCESS' || status === 'FAILED') return 'idle'
  return 'unknown'
}

function formatReferenceTime(value: string | null) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function viewReference(item: ReferenceViewItem) {
  const query: Record<string, string> = { workspace: props.workspaceCode }
  let path = '/automation/api/scenarios'
  if (item.kind === 'scheduled') {
    path = '/tasks'
    if (item.sourceId != null) query.taskId = String(item.sourceId)
  } else if (item.kind === 'web-ui') {
    const isBatch = item.sourceType.includes('批次')
    path = isBatch ? '/automation/web/batches' : '/automation/web/runs'
    if (item.sourceId != null) query[isBatch ? 'batchId' : 'runId'] = String(item.sourceId)
  } else if (item.sourceType.includes('历史') || item.sourceType.includes('调试')) {
    path = '/automation/api/reports'
  } else if (item.kind === 'api-suite') {
    path = '/automation/api/execution-suites'
  }
  void router.push({ path, query })
}

function tabLabel(tab: DetailTab) {
  if (tab === 'services') return `服务配置 (${form.services.filter(item => item.baseUrl).length})`
  if (tab === 'variables') return `变量配置 (${variableCount.value})`
  if (tab === 'mock') return mockBound.value ? 'Mock 已启用' : 'Mock 配置'
  if (tab === 'effective') return '最终生效预览'
  return `引用分析 (${referenceCount.value})`
}

function selectDetailTab(tab: DetailTab) {
  activeTab.value = tab
  if (tab === 'variables') void loadVariableSetVersions()
}

function serviceStatus(service: ConfigEnvServiceEndpointForm) {
  return serviceTests.value[service.key] || 'untested'
}

function formatTimeout(timeoutMs: number) {
  return `${Math.round(timeoutMs / 1000)}s`
}

onMounted(() => void loadData())
watch(() => props.workspaceCode, () => void loadData(null))
</script>

<template>
  <section class="figma-env" data-node-id="311:3773">
    <aside class="figma-env__sidebar" data-node-id="311:3774">
      <header class="figma-env__sidebar-head">
        <div class="figma-env__sidebar-title-row">
          <strong>测试环境</strong>
          <button class="figma-env__primary-button is-small" type="button" @click="createEnvironment">
            <el-icon><Plus /></el-icon><span>新建</span>
          </button>
        </div>
        <label class="figma-env__search">
          <el-icon><Search /></el-icon>
          <input v-model="keyword" type="text" placeholder="搜索环境名称">
        </label>
      </header>

      <div class="figma-env__sidebar-list app-soft-scrollbar">
        <template v-if="loading && !envs.length">
          <div v-for="index in 5" :key="index" class="figma-env__env-card is-skeleton" />
        </template>
        <button
          v-for="env in filteredEnvs"
          v-else
          :key="env.id"
          class="figma-env__env-card"
          :class="{ 'is-active': selectedEnvId === env.id }"
          :style="{
            '--stage-color': environmentCardSummary(env).stage.color,
            '--stage-background': environmentCardSummary(env).stage.background,
          }"
          type="button"
          @click="selectEnv(env)"
        >
          <span class="figma-env__env-card-main">
            <i class="figma-env__stage-line" />
            <span class="figma-env__env-card-copy">
              <span class="figma-env__env-name-row">
                <strong>{{ env.envName }}</strong>
                <em v-if="env.status === 0">停用</em>
              </span>
              <span class="figma-env__env-meta-row">
                <b>{{ environmentCardSummary(env).stage.label }}</b>
                <small>{{ environmentCardSummary(env).services }} 服务 · {{ environmentCardSummary(env).variableSets }} 变量集</small>
              </span>
            </span>
          </span>
          <span class="figma-env__env-card-foot">
            <span :class="{ 'is-warning': environmentCardSummary(env).issues > 0 }">
              <el-icon><Warning v-if="environmentCardSummary(env).issues > 0" /><CircleCheck v-else /></el-icon>
              {{ environmentCardSummary(env).issues > 0 ? `${environmentCardSummary(env).issues} 项待完善` : '配置完整' }}
            </span>
            <small v-if="environmentCardSummary(env).mockEnabled">Mock 已接入</small>
          </span>
        </button>
        <div v-if="!loading && !filteredEnvs.length" class="figma-env__sidebar-empty">暂无环境</div>
      </div>
    </aside>

    <main v-if="selectedEnv" class="figma-env__detail" data-node-id="311:3923">
      <header class="figma-env__detail-head">
        <div class="figma-env__detail-summary">
          <span class="figma-env__detail-icon" :style="{ color: selectedStage.color, background: selectedStage.background }"><el-icon><Globe /></el-icon></span>
          <div class="figma-env__detail-copy">
            <div class="figma-env__detail-title-row">
              <h2>{{ form.envName }}</h2>
              <span class="figma-env__stage-badge" :style="{ color: selectedStage.color, background: selectedStage.background }">{{ selectedStage.label }}</span>
              <span class="figma-env__apply-badge">
                <el-icon><Layers :size="10" /></el-icon>
                {{ applicationLabel }}
              </span>
            </div>
            <div class="figma-env__detail-description">
              <span>{{ form.description || '暂未填写环境说明' }}</span>
              <i>·</i><span>更新人：—</span><i>·</i><span>—</span>
              <template v-if="!configComplete"><i>·</i><span class="is-warning"><el-icon><Warning /></el-icon>{{ configIssueCount }} 项配置待完善</span></template>
            </div>
          </div>
        </div>

        <div class="figma-env__detail-actions">
          <div v-for="metric in [{ value: form.services.filter(item => item.baseUrl).length, label: '服务' }, { value: form.variableSetIds.length, label: '变量集' }, { value: referenceCount, label: '引用任务' }]" :key="metric.label" class="figma-env__metric">
            <strong>{{ metric.value }}</strong><span>{{ metric.label }}</span>
          </div>
          <i class="figma-env__action-divider" />
          <button type="button" @click="copyEnvironment"><el-icon><CopyDocument /></el-icon>复制</button>
          <button type="button" @click="editEnvironment"><el-icon><Edit /></el-icon>编辑</button>
          <button type="button" :disabled="operating" @click="switchStatus"><el-icon><SwitchButton /></el-icon>{{ selectedEnv.status === 1 ? '停用' : '启用' }}</button>
          <button class="figma-env__icon-button" type="button" title="删除环境" :disabled="operating" @click="removeEnvironment"><el-icon><Delete /></el-icon></button>
        </div>
      </header>

      <nav class="figma-env__tabs">
        <button
          v-for="tab in (['services', 'variables', 'mock', 'effective', 'references'] as DetailTab[])"
          :key="tab"
          type="button"
          :class="{ 'is-active': activeTab === tab }"
          @click="selectDetailTab(tab)"
        >
          {{ tabLabel(tab) }}
        </button>
      </nav>

      <section v-if="activeTab === 'services'" class="figma-env__services" data-node-id="311:4040">
        <div class="figma-env__service-toolbar">
          <span>共 {{ form.services.filter(item => item.baseUrl).length }} 个服务，其中 {{ defaultServiceCount }} 个默认入口</span>
          <i />
          <button type="button" @click="batchTestConnections"><el-icon><Connection /></el-icon>批量连接测试</button>
          <button class="is-primary" type="button" @click="openAddService"><el-icon><Plus /></el-icon>添加服务</button>
        </div>

        <div v-if="form.services.length" class="figma-env__service-list">
          <article v-for="(service, index) in form.services" :key="service.key" class="figma-env__service-card">
            <span class="figma-env__service-icon" :class="{ 'is-default': service.key === form.defaultServiceKey }">
              <el-icon v-if="service.key === form.defaultServiceKey"><Globe /></el-icon>
              <el-icon v-else><Service /></el-icon>
            </span>
            <div class="figma-env__service-copy">
              <div><strong>{{ service.name }}</strong><b v-if="service.key === form.defaultServiceKey">默认入口</b><b v-if="!service.enabled" class="is-disabled">已停用</b></div>
              <p><code>{{ service.baseUrl }}</code><i>·</i><span>超时 {{ formatTimeout(service.timeoutMs) }}</span></p>
            </div>
            <div class="figma-env__service-actions">
              <span class="figma-env__service-status" :class="`is-${serviceStatus(service)}`">
                <el-icon><CircleCheck v-if="serviceStatus(service) === 'success'" /><Warning v-else-if="serviceStatus(service) === 'failed'" /><Clock v-else /></el-icon>
                {{ serviceStatus(service) === 'testing' ? '测试中...' : serviceStatus(service) === 'success' ? '连通' : serviceStatus(service) === 'failed' ? '失败' : serviceStatus(service) === 'timeout' ? '超时' : '未检测' }}
              </span>
              <button type="button" @click="testConnection(service)"><el-icon><Connection /></el-icon>测试连接</button>
              <span class="figma-env__row-actions">
                <button type="button" title="编辑" @click="openEditService(index)"><el-icon><Edit /></el-icon></button>
                <button type="button" title="复制" @click="copyService(index)"><el-icon><CopyDocument /></el-icon></button>
                <button type="button" title="删除" @click="removeService(index)"><el-icon><Delete /></el-icon></button>
              </span>
            </div>
          </article>
        </div>

        <div v-else class="figma-env__service-empty" data-node-id="311:6146">
          <el-icon><Service /></el-icon>
          <strong>暂无服务配置</strong>
          <p>添加业务服务地址，接口和 UI 测试将使用这些地址发起请求</p>
          <button class="figma-env__primary-button" type="button" @click="openAddService"><el-icon><Plus /></el-icon>添加第一个服务</button>
        </div>
      </section>

      <section v-else-if="activeTab === 'variables'" class="figma-env__variables" data-node-id="332:2871">
        <div class="figma-env__variable-priority">
          <el-icon><Zap /></el-icon>
          <span>变量优先级：</span>
          <strong>环境局部覆盖</strong><el-icon><ChevronRight /></el-icon>
          <strong>环境绑定变量集</strong><el-icon><ChevronRight /></el-icon>
          <strong>工作区全局变量</strong>
          <small>（优先级从高到低）</small>
        </div>

        <section class="figma-env__variable-section">
          <header class="figma-env__variable-heading">
            <div><h3>绑定变量集</h3><p>从变量配置页面选择已有变量集，多个变量集按优先级顺序生效</p></div>
            <div>
              <button v-if="selectedVariableSets.length > 1" type="button" @click="openPriorityDialog"><el-icon><ArrowUp /></el-icon>调整优先级</button>
              <button type="button" @click="openBindVariableSetDialog"><el-icon><Plus /></el-icon>绑定变量集</button>
            </div>
          </header>

          <div v-if="selectedVariableSets.length" class="figma-env__variable-set-list">
            <article v-for="(item, index) in selectedVariableSets" :key="item.id" :class="{ 'is-disabled': !isVariableSetEnabled(item) }">
              <button class="figma-env__priority-index" type="button" title="调整优先级" @click="openPriorityDialog">{{ index + 1 }}</button>
              <div class="figma-env__variable-set-copy">
                <div><strong>{{ item.paramName }}</strong><span>{{ variableSetScopeLabel(item) }}</span><span v-if="variableSetHasSensitive(item)" class="is-sensitive">含敏感变量</span></div>
                <p>{{ parseWebUiVariables(item.contentJson).length }} 个变量 <i>·</i> <code>{{ variableSetVersionLabel(item) }}</code></p>
              </div>
              <button class="figma-env-switch" :class="{ 'is-on': isVariableSetEnabled(item) }" type="button" :title="isVariableSetEnabled(item) ? '停用变量集' : '启用变量集'" @click="toggleVariableSetEnabled(item)"><i /></button>
              <span class="figma-env__variable-order-actions">
                <button type="button" title="上移" :disabled="index === 0" @click="moveBoundVariableSet(index, -1)"><el-icon><ArrowUp /></el-icon></button>
                <button type="button" title="下移" :disabled="index === selectedVariableSets.length - 1" @click="moveBoundVariableSet(index, 1)"><el-icon><ArrowDown /></el-icon></button>
              </span>
              <span class="figma-env__row-actions">
                <button type="button" title="查看变量集" @click="goToVariableSetConfig"><el-icon><Eye /></el-icon></button>
                <button type="button" title="解除绑定" @click="unbindVariableSet(item)"><el-icon><Minus /></el-icon></button>
              </span>
            </article>
          </div>
          <div v-else class="figma-env__variable-empty">
            <el-icon><Variable /></el-icon><span>尚未绑定变量集，请前往「变量配置」创建后在此绑定</span>
          </div>
        </section>

        <section class="figma-env__variable-section">
          <header class="figma-env__variable-heading">
            <div><h3>环境局部变量</h3><p>用于覆盖少量环境差异，此处定义的变量优先级最高</p></div>
            <button type="button" @click="openLocalVariableDialog()"><el-icon><Plus /></el-icon>添加变量</button>
          </header>

          <div v-if="form.localVariables.length" class="figma-env__local-variable-table">
            <table>
              <colgroup><col class="is-name"><col class="is-value"><col class="is-type"><col><col class="is-status"><col class="is-actions"></colgroup>
              <thead><tr><th>变量名</th><th>值</th><th>类型</th><th>说明</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="(variable, index) in form.localVariables" :key="`${variable.name}-${index}`" :class="{ 'is-disabled': variable.enabled === false }">
                  <td><code>{{ variable.name }}</code></td>
                  <td><code :class="{ 'is-masked': variable.sensitive }">{{ variable.sensitive ? '••••••••' : variable.value }}</code></td>
                  <td><span>{{ variable.valueType || (variable.sensitive ? 'secret' : 'string') }}</span></td>
                  <td>{{ variable.description || '—' }}</td>
                  <td><button class="figma-env-switch" :class="{ 'is-on': variable.enabled !== false }" type="button" :title="variable.enabled === false ? '启用变量' : '停用变量'" @click="toggleLocalVariable(index)"><i /></button></td>
                  <td><span class="figma-env__row-actions"><button type="button" title="编辑" @click="openLocalVariableDialog(index)"><el-icon><Edit /></el-icon></button><button type="button" title="删除" @click="requestDeleteLocalVariable(index)"><el-icon><Delete /></el-icon></button></span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="figma-env__variable-empty is-local"><span>暂无局部变量，当需要覆盖特定环境差异时添加</span></div>
        </section>
      </section>

      <section v-else-if="activeTab === 'mock'" class="figma-env__mock-panel" data-node-id="334:7687">
        <div v-if="productionEnvironment" class="figma-env__mock-production-warning">
          <el-icon><Warning /></el-icon>
          <div><strong>生产环境禁止启用 Mock</strong><span>生产阶段的环境中不允许绑定 Mock 版本，以防止生产请求被拦截或返回模拟数据。</span></div>
        </div>

        <template v-if="mockBound && selectedMockApplication && selectedMockRelease">
          <div class="figma-env__mock-toolbar">
            <h3>当前绑定</h3>
            <span />
            <button type="button" :disabled="mockVersionOptions.length < 2" @click="openMockVersionDialog"><el-icon><RefreshCw /></el-icon>切换版本</button>
            <button type="button" @click="mockUnbindDialogVisible = true"><el-icon><Minus /></el-icon>解除绑定</button>
          </div>

          <article class="figma-env__mock-card">
            <header>
              <div>
                <button class="figma-env-switch" :class="{ 'is-on': form.mockEnabled }" type="button" :aria-label="form.mockEnabled ? '停用 Mock' : '启用 Mock'" @click="toggleMockEnabled"><i /></button>
                <strong>{{ form.mockEnabled ? 'Mock 已启用，接口请求将被拦截' : 'Mock 已停用，接口请求将直接到达真实服务' }}</strong>
              </div>
              <button type="button" @click="goToMockService">前往 Mock 服务查看详情 →</button>
            </header>
            <div class="figma-env__mock-grid">
              <div><span>Mock 应用</span><strong>{{ selectedMockApplication.appName }}</strong></div>
              <div><span>应用编码</span><code>{{ selectedMockApplication.appCode }}</code></div>
              <div><span>当前版本</span><code class="is-version">v{{ selectedMockRelease.versionNo }}</code></div>
              <div><span>Mock 基础地址</span><code class="is-link">{{ mockBaseUrl }}</code></div>
              <div><span>接口 / 场景</span><strong>{{ mockEndpointCount ?? '—' }} 接口 · {{ mockScenarioCount ?? '—' }} 场景</strong></div>
              <div><span>访问凭据</span><strong class="is-credential">未启用</strong></div>
              <div><span>未匹配策略</span><strong>严格失败</strong></div>
              <div class="is-empty" />
            </div>
            <footer v-if="mockUnmatched24hCount">
              <el-icon><Warning /></el-icon>
              <span>过去 24 小时内有 {{ mockUnmatched24hCount }} 次请求未匹配到任何场景，可在 Mock 服务调用日志中查看详情</span>
              <button type="button" @click="goToMockService">查看日志 →</button>
            </footer>
          </article>
        </template>

        <div v-else-if="!productionEnvironment" class="figma-env__mock-empty">
          <el-icon><Code2 /></el-icon>
          <strong>尚未绑定 Mock</strong>
          <p>绑定后，测试执行中的接口请求将由 Mock 服务拦截并返回模拟响应</p>
          <button class="figma-env__primary-button" type="button" @click="openMockBindDialog"><el-icon><Plus /></el-icon>绑定 Mock 应用</button>
        </div>
      </section>

      <section v-else-if="activeTab === 'effective'" class="figma-env__effective-panel" data-node-id="336:9791">
        <div class="figma-env__effective-toolbar" data-node-id="336:9793">
          <p>下表展示当前环境执行时各变量的最终生效值及来源。敏感变量已脱敏，同名变量按优先级覆盖。</p>
          <span />
          <label class="figma-env__effective-filter" data-node-id="336:9798">
            <select v-model="effectiveSourceFilter" aria-label="筛选变量来源">
              <option value="all">全部变量</option>
              <option value="local">环境局部覆盖</option>
              <option value="variable-set">变量集变量</option>
              <option value="workspace">工作区变量</option>
            </select>
            <el-icon><ChevronDown /></el-icon>
          </label>
          <label class="figma-env__effective-search" data-node-id="336:9805">
            <el-icon><Search /></el-icon>
            <input v-model="effectiveKeyword" type="text" placeholder="搜索变量名" aria-label="搜索变量名">
          </label>
        </div>

        <div v-if="!effectiveVariables.length" class="figma-env__effective-empty">
          <el-icon><Variable /></el-icon>
          <p>尚未配置任何变量，请先绑定变量集或添加局部变量</p>
        </div>

        <div v-else class="figma-env__effective-table-shell" data-node-id="336:9812">
          <div class="figma-env__effective-table-scroll app-soft-scrollbar">
            <table class="figma-env__effective-table" data-node-id="336:9813">
              <colgroup><col><col><col><col><col><col></colgroup>
              <thead><tr data-node-id="336:9815"><th>变量名</th><th>最终值</th><th>来源</th><th>是否覆盖</th><th>说明</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in filteredEffectiveVariables" :key="item.name">
                  <td><code class="figma-env__effective-name">{{ item.name }}</code></td>
                  <td><code class="figma-env__effective-value" :class="{ 'is-sensitive': item.sensitive }">{{ item.value || '—' }}</code></td>
                  <td><span class="figma-env__effective-source" :class="`is-${item.sourceType}`">{{ item.source }}</span></td>
                  <td><span v-if="item.overriddenSource" class="figma-env__effective-override">覆盖自 {{ item.overriddenSource }}</span><span v-else class="figma-env__effective-dash">—</span></td>
                  <td><span class="figma-env__effective-description">{{ item.description }}</span></td>
                  <td><el-icon v-if="item.ok" class="figma-env__effective-status is-ok" title="解析正常"><CircleCheck /></el-icon><el-icon v-else class="figma-env__effective-status is-error" title="存在无法解析的变量"><Warning /></el-icon></td>
                </tr>
                <tr v-if="!filteredEffectiveVariables.length" class="figma-env__effective-no-result"><td colspan="6">没有符合当前筛选条件的变量</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-else class="figma-env__references" data-node-id="337:10369">
        <div v-if="runningReferences.length" class="figma-env__reference-warning" data-node-id="337:10371">
          <el-icon><Warning /></el-icon>
          <span>当前有任务正在使用此环境运行，停用或删除操作将被阻止。</span>
        </div>

        <div v-if="referenceLoading" class="figma-env__reference-empty is-loading">
          <el-icon class="is-spinning"><RefreshCw /></el-icon>
          <strong>正在加载引用数据</strong>
        </div>

        <template v-else-if="referenceRows.length">
          <div class="figma-env__reference-stats" data-node-id="337:10379">
            <article
              v-for="stat in referenceStats"
              :key="stat.kind"
              class="figma-env__reference-stat"
              :class="`is-${stat.kind}`"
              :title="referenceListIsSampled ? '当前接口只返回部分引用明细，卡片数量为当前已返回记录数' : ''"
            >
              <el-icon><component :is="referenceTypeMeta(stat.kind).icon" /></el-icon>
              <div><strong>{{ stat.count }}</strong><span>{{ referenceTypeMeta(stat.kind).label }}</span></div>
            </article>
          </div>

          <div class="figma-env__reference-table-shell" data-node-id="337:10430">
            <div class="figma-env__reference-table-scroll app-soft-scrollbar">
              <table class="figma-env__reference-table" data-node-id="337:10431">
                <colgroup><col><col><col><col><col></colgroup>
                <thead><tr data-node-id="337:10433"><th>类型</th><th>资源名称</th><th>最近执行</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="item in referenceRows" :key="item.key">
                    <td>
                      <span class="figma-env__reference-type" :class="`is-${item.kind}`" :title="item.sourceType">
                        <el-icon><component :is="referenceTypeMeta(item.kind).icon" /></el-icon>{{ item.typeLabel }}
                      </span>
                    </td>
                    <td><strong class="figma-env__reference-name">{{ item.name }}</strong></td>
                    <td><code class="figma-env__reference-time" :title="item.sourceType.includes('历史') ? '执行时间' : '当前接口仅提供资源更新时间'">{{ item.lastRun }}</code></td>
                    <td class="figma-env__reference-status-cell">
                      <span v-if="item.status === 'running'" class="figma-env__reference-status is-running"><el-icon><Connection /></el-icon>运行中</span>
                      <span v-else-if="item.status === 'idle'" class="figma-env__reference-status is-idle">空闲</span>
                      <span v-else class="figma-env__reference-status is-unknown">—</span>
                    </td>
                    <td class="figma-env__reference-action-cell"><button type="button" :aria-label="`查看 ${item.name}`" @click="viewReference(item)">查看</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <div v-else class="figma-env__reference-empty">
          <el-icon><Connection /></el-icon>
          <strong>暂无引用</strong>
          <span>此环境尚未被任何接口场景、套件或定时任务引用</span>
        </div>
      </section>
    </main>

    <div v-else class="figma-env__detail figma-env__no-selection">
      <el-icon><Service /></el-icon><strong>{{ errorMessage || '暂无环境配置' }}</strong><p>新建环境后，可以继续添加服务地址。</p>
    </div>

    <Teleport to="body">
      <div v-if="bindVariableSetVisible" class="figma-env-modal" data-node-id="332:4204" @mousedown.self="bindVariableSetVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--bind-variable">
          <header>
            <div class="figma-env-modal__heading-copy"><h2>绑定变量集</h2><p>已绑定 {{ selectedVariableSets.length }} 个，可绑定 {{ availableVariableSets.length }} 个</p></div>
            <button type="button" @click="bindVariableSetVisible = false"><el-icon><Close /></el-icon></button>
          </header>
          <div class="figma-env-modal__variable-set-options app-soft-scrollbar">
            <button v-for="item in availableVariableSets" :key="item.id" type="button" :class="{ 'is-selected': bindVariableSetSelection.includes(item.id) }" @click="toggleVariableSetSelection(item.id)">
              <span class="figma-env-modal__checkbox"><el-icon v-if="bindVariableSetSelection.includes(item.id)"><Check /></el-icon></span>
              <span class="figma-env-modal__variable-set-option-copy">
                <span><strong>{{ item.paramName }}</strong><em>{{ variableSetScopeLabel(item) }}</em><em v-if="variableSetHasSensitive(item)" class="is-sensitive">含敏感变量</em></span>
                <small>{{ parseWebUiVariables(item.contentJson).length }} 个变量 <i>·</i> <code>{{ variableSetVersionLabel(item) }}</code></small>
              </span>
            </button>
            <div v-if="!availableVariableSets.length" class="figma-env-modal__variable-empty">暂无可绑定的变量集</div>
          </div>
          <footer><span>已选 {{ bindVariableSetSelection.length }} 个</span><button type="button" @click="bindVariableSetVisible = false">取消</button><button class="is-primary" type="button" :disabled="!bindVariableSetSelection.length || saving" @click="bindSelectedVariableSets">确认绑定</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="priorityDialogVisible" class="figma-env-modal" data-node-id="332:4969" @mousedown.self="priorityDialogVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--priority">
          <header>
            <div class="figma-env-modal__heading-copy"><h2>调整优先级</h2><p>数字越小优先级越高，同名变量将以高优先级变量集为准</p></div>
            <button type="button" @click="priorityDialogVisible = false"><el-icon><Close /></el-icon></button>
          </header>
          <div class="figma-env-modal__priority-body">
            <div class="figma-env-modal__priority-columns">
              <section><h3>当前顺序（可调整）</h3><article v-for="(item, index) in priorityPreviewSets" :key="item.id"><b>{{ index + 1 }}</b><span><strong>{{ item.paramName }}</strong><small>{{ parseWebUiVariables(item.contentJson).length }} 变量 · {{ variableSetVersionLabel(item) }}</small></span><i><button type="button" :disabled="index === 0" @click="movePriorityDraft(index, -1)"><el-icon><ArrowUp /></el-icon></button><button type="button" :disabled="index === priorityPreviewSets.length - 1" @click="movePriorityDraft(index, 1)"><el-icon><ArrowDown /></el-icon></button></i></article></section>
              <section><h3>调整后预览</h3><article v-for="(item, index) in priorityPreviewSets" :key="item.id" class="is-preview"><b>{{ index + 1 }}</b><strong>{{ item.paramName }}</strong></article></section>
            </div>
            <section v-if="variableSetConflicts.length" class="figma-env-modal__conflicts"><header>以下变量存在同名冲突，高优先级将覆盖低优先级</header><div><p v-for="items in variableSetConflicts" :key="items[0]?.name"><code>{{ items[0]?.name }}</code><span>存在于</span><template v-for="(owner, index) in items" :key="owner.set.id"><span>{{ owner.set.paramName }}</span><i v-if="index < items.length - 1">和</i></template><span>，以</span><strong>{{ priorityPreviewSets[0]?.paramName }}</strong><span>为准</span></p></div></section>
          </div>
          <footer><button type="button" @click="priorityDialogVisible = false">取消</button><button class="is-primary" type="button" :disabled="saving" @click="saveVariableSetPriority">保存优先级</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="localVariableDialogMode" class="figma-env-modal" :data-node-id="localVariableDialogMode === 'create' ? '332:5784' : '332:6521'" @mousedown.self="closeLocalVariableDialog">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--local-variable">
          <header><h2>{{ localVariableDialogMode === 'create' ? '添加局部变量' : '编辑局部变量' }}</h2><button type="button" @click="closeLocalVariableDialog"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__body figma-env-modal__body--local-variable">
            <label><span>变量名 <b>*</b></span><input v-model="localVariableEditor.name" class="is-mono" type="text" placeholder="例：API_GATEWAY_URL"></label>
            <label><span>值</span><input v-model="localVariableEditor.value" :type="localVariableEditor.sensitive ? 'password' : 'text'" :placeholder="localVariableEditor.valueType === 'secret' ? '输入后将按敏感变量存储' : ''"></label>
            <div class="figma-env-modal__row figma-env-modal__row--local-variable">
              <label><span>类型</span><select v-model="localVariableEditor.valueType" @change="syncLocalVariableType"><option v-for="option in localVariableTypeOptions" :key="option" :value="option">{{ option }}</option></select></label>
              <div class="figma-env-modal__default"><span>敏感变量</span><button type="button" class="figma-env-switch" :class="{ 'is-on': localVariableEditor.sensitive }" @click="localVariableEditor.sensitive = !localVariableEditor.sensitive"><i /></button></div>
            </div>
            <label><span>说明</span><input v-model="localVariableEditor.description" type="text" placeholder="简要描述此变量的用途"></label>
            <div class="figma-env-modal__local-enabled"><span>是否启用</span><button type="button" class="figma-env-switch" :class="{ 'is-on': localVariableEditor.enabled }" @click="localVariableEditor.enabled = !localVariableEditor.enabled"><i /></button></div>
          </div>
          <footer><button type="button" @click="closeLocalVariableDialog">取消</button><button class="is-primary" type="button" :disabled="saving" @click="submitLocalVariable">保存</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="deleteLocalVariable" class="figma-env-modal" data-node-id="332:7259" @mousedown.self="deleteLocalVariableIndex = null">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--delete-variable">
          <header><h2>删除局部变量</h2><button type="button" @click="deleteLocalVariableIndex = null"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__delete-variable-copy">确认删除变量「<strong>{{ deleteLocalVariable.name }}</strong>」？此操作不可恢复。</div>
          <footer><button type="button" @click="deleteLocalVariableIndex = null">取消</button><button class="is-danger" type="button" :disabled="saving" @click="confirmDeleteLocalVariable">确认删除</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="mockBindDialogVisible" class="figma-env-modal" @mousedown.self="mockBindDialogVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-bind">
          <header><h2>绑定 Mock 应用</h2><button type="button" @click="mockBindDialogVisible = false"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__mock-bind-body">
            <label><span>Mock 应用 <b>*</b></span><select v-model="mockBindApplicationId" @change="changeMockBindApplication(mockBindApplicationId)"><option :value="null" disabled>请选择 Mock 应用</option><option v-for="item in mockApplications" :key="item.id" :value="item.id">{{ item.appName }}（{{ item.appCode }}）</option></select></label>
            <label><span>发布版本 <b>*</b></span><select v-model="mockBindReleaseId" :disabled="!mockBindApplicationId"><option :value="null" disabled>请选择发布版本</option><option v-for="item in mockBindReleases" :key="item.id" :value="item.id">v{{ item.versionNo }} · {{ item.releaseName || '未命名版本' }}</option></select></label>
            <div class="figma-env-modal__mock-bind-tip"><el-icon><Warning /></el-icon><span>绑定后默认启用 Mock，请求将按所选不可变发布版本执行。</span></div>
          </div>
          <footer><button type="button" @click="mockBindDialogVisible = false">取消</button><button class="is-primary" type="button" :disabled="saving || !mockBindApplicationId || !mockBindReleaseId" @click="confirmMockBinding">确认绑定</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="mockVersionDialogVisible && selectedMockRelease" class="figma-env-modal" data-node-id="334:8784" @mousedown.self="mockVersionDialogVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-version" data-node-id="334:8785">
          <header><h2>切换 Mock 版本</h2><button type="button" @click="mockVersionDialogVisible = false"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__mock-version-body">
            <div class="figma-env-modal__mock-current"><span>当前版本：</span><code>v{{ selectedMockRelease.versionNo }}</code></div>
            <div class="figma-env-modal__mock-version-list app-soft-scrollbar">
              <button
                v-for="release in mockVersionOptions"
                :key="release.id"
                type="button"
                :class="{ 'is-selected': mockVersionSelection === release.id && release.id !== form.mockReleaseId, 'is-current': release.id === form.mockReleaseId }"
                :disabled="release.id === form.mockReleaseId"
                @click="mockVersionSelection = release.id"
              >
                <i><span /></i><code>v{{ release.versionNo }}</code><em v-if="release.id === form.mockReleaseId">当前</em><small v-else-if="release.active">当前启用</small>
              </button>
            </div>
            <div class="figma-env-modal__mock-version-warning">
              <el-icon><Warning /></el-icon>
              <div><p>版本切换将立即生效，当前正在运行的测试任务会在下次调用时使用新版本</p><small>{{ selectedMockVersionOption?.releaseName || '该发布版本暂无说明' }}</small></div>
            </div>
          </div>
          <footer><button type="button" @click="mockVersionDialogVisible = false">取消</button><button class="is-primary" type="button" :disabled="saving || !mockVersionSelection || mockVersionSelection === form.mockReleaseId" @click="confirmMockVersionSwitch">确认切换</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="mockUnbindDialogVisible && selectedMockApplication && selectedMockRelease" class="figma-env-modal" data-node-id="334:9351" @mousedown.self="mockUnbindDialogVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-unbind" data-node-id="334:9352">
          <header><h2>解除 Mock 绑定</h2><button type="button" @click="mockUnbindDialogVisible = false"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__mock-unbind-body">
            <p>解除后，测试请求将直接发送到真实服务，不再经过 Mock 拦截</p>
            <div v-if="mockReferenceCount" class="figma-env-modal__mock-unbind-warning"><el-icon><Warning /></el-icon><span>当前 Mock 应用有 {{ mockReferenceCount }} 个引用，解除当前环境绑定后请确认相关任务配置</span></div>
            <div class="figma-env-modal__mock-unbind-target">即将解除：<strong>{{ selectedMockApplication.appName }}</strong><i>·</i><code>v{{ selectedMockRelease.versionNo }}</code></div>
          </div>
          <footer><button type="button" @click="mockUnbindDialogVisible = false">取消</button><button class="is-danger" type="button" :disabled="saving" @click="confirmMockUnbind">确认解除绑定</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="environmentDialogMode" class="figma-env-modal" :data-node-id="environmentDialogMode === 'create' ? '331:2778' : '330:730'" @mousedown.self="closeEnvironmentDialog">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--environment" :class="{ 'is-create': environmentDialogMode === 'create' }">
          <header>
            <div class="figma-env-modal__heading-copy">
              <h2>{{ environmentDialogMode === 'create' ? '新建环境' : '编辑环境' }}</h2>
              <p v-if="environmentDialogMode === 'create'">先创建环境，再配置服务地址、变量和 Mock</p>
            </div>
            <button type="button" @click="closeEnvironmentDialog"><el-icon><Close /></el-icon></button>
          </header>
          <div class="figma-env-modal__body figma-env-modal__body--environment">
            <label><span>环境名称 <b>*</b></span><input v-model="environmentEditor.envName" type="text" :placeholder="environmentDialogMode === 'create' ? '例：功能测试环境、性能测试环境' : '请输入环境名称'"></label>
            <fieldset class="figma-env-modal__choice-field">
              <legend>环境阶段</legend>
              <div class="figma-env-modal__stage-options">
                <button
                  v-for="option in environmentStageOptions"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-selected': environmentEditor.envType === option.value }"
                  @click="environmentEditor.envType = option.value"
                >{{ option.label }}</button>
              </div>
            </fieldset>
            <fieldset class="figma-env-modal__choice-field">
              <legend>适用范围</legend>
              <div class="figma-env-modal__applicability-options">
                <button
                  v-for="option in environmentApplicabilityOptions"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-selected': environmentEditor.automationType === option.value }"
                  @click="environmentEditor.automationType = option.value"
                >
                  <el-icon><Link v-if="option.icon === 'api'" /><Monitor v-else-if="option.icon === 'web'" /><Layers v-else /></el-icon>
                  {{ option.label }}
                </button>
              </div>
            </fieldset>
            <label><span>描述</span><input v-model="environmentEditor.description" type="text" :placeholder="environmentDialogMode === 'create' ? '说明该环境的用途和范围' : '请输入环境说明'"></label>
          </div>
          <footer><button type="button" @click="closeEnvironmentDialog">取消</button><button class="is-primary" type="button" :disabled="saving" @click="submitEnvironment">{{ environmentDialogMode === 'create' ? '创建环境' : '保存' }}</button></footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="disableDialogVisible" class="figma-env-modal" :data-node-id="runningReferences.length ? '330:2031' : '330:1272'" @mousedown.self="disableDialogVisible = false">
        <section class="figma-env-modal__dialog figma-env-modal__dialog--confirm" :class="{ 'is-blocked': runningReferences.length > 0 }">
          <header><h2>停用环境</h2><button type="button" @click="disableDialogVisible = false"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__confirm-body">
            <div v-if="runningReferences.length" class="figma-env-modal__notice is-danger">
              <el-icon><CircleClose /></el-icon>
              <div><strong>存在运行中任务，无法停用</strong><span v-for="item in runningReferences" :key="`${item.sourceType}-${item.sourceId}`">· {{ item.sourceName || '未命名任务' }}</span></div>
            </div>
            <div v-else class="figma-env-modal__notice is-warning">
              <el-icon><Warning /></el-icon>
              <span>停用后以下 <b>{{ referenceCount }}</b> 个引用任务将无法使用此环境</span>
            </div>
          </div>
          <footer>
            <button type="button" @click="disableDialogVisible = false">取消</button>
            <button v-if="runningReferences.length" class="is-disabled-action" type="button" disabled>存在运行中任务，无法停用</button>
            <button v-else class="is-warning-action" type="button" :disabled="operating" @click="submitStatusChange">确认停用</button>
          </footer>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="serviceDialogVisible" class="figma-env-modal" data-node-id="311:6625" @mousedown.self="closeServiceDialog">
        <section class="figma-env-modal__dialog" data-node-id="311:6626">
          <header><h2>{{ serviceEditingIndex == null ? '添加服务' : '编辑服务' }}</h2><button type="button" @click="closeServiceDialog"><el-icon><Close /></el-icon></button></header>
          <div class="figma-env-modal__body">
            <label><span>服务名称 <b>*</b></span><input v-model="serviceEditor.name" type="text" placeholder="例：订单服务"></label>
            <label><span>Base URL <b>*</b></span><div class="figma-env-modal__url"><input v-model="serviceEditor.baseUrl" type="text" placeholder="https://api.example.com"><button type="button" @click="testConnection()"><el-icon><Connection /></el-icon>连接测试</button></div></label>
            <div class="figma-env-modal__row"><label><span>连接超时 (ms)</span><input v-model.number="serviceEditor.timeoutMs" type="number" min="1000" max="120000"></label><div class="figma-env-modal__default"><span>设为默认入口</span><button type="button" class="figma-env-switch" :class="{ 'is-on': serviceEditor.isDefault }" @click="serviceEditor.isDefault = !serviceEditor.isDefault"><i /></button></div></div>
            <div class="figma-env-modal__enabled"><span><strong>是否启用</strong><small>停用后此服务地址不参与执行</small></span><button type="button" class="figma-env-switch" :class="{ 'is-on': serviceEditor.enabled }" @click="serviceEditor.enabled = !serviceEditor.enabled"><i /></button></div>
          </div>
          <footer><button type="button" @click="closeServiceDialog">取消</button><button class="is-primary" type="button" :disabled="saving" @click="submitService">保存</button></footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.figma-env,
.figma-env * {
  box-sizing: border-box;
}

.figma-env {
  display: grid;
  width: 100%;
  min-width: 1180px;
  height: 624.25px;
  grid-template-columns: 260px minmax(0, 1fr);
  align-items: start;
  color: #1d2129;
  font-family: var(--app-font-family);
}

button,
input {
  font: inherit;
}

.figma-env__sidebar {
  display: flex;
  overflow: hidden;
  width: 260px;
  height: 624.25px;
  flex-direction: column;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.figma-env__sidebar-head {
  height: 89.25px;
  flex: 0 0 89.25px;
  padding: 14px;
}

.figma-env__sidebar-title-row {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: space-between;
}

.figma-env__sidebar-title-row > strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.figma-env__primary-button,
.figma-env__detail-actions > button,
.figma-env__service-toolbar button,
.figma-env__service-actions > button,
.figma-env-modal button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env__primary-button,
.figma-env__service-toolbar button.is-primary,
.figma-env-modal button.is-primary {
  height: 32px;
  padding: 0 14px;
  border-color: #165dff;
  background: #165dff;
  color: #fff;
}

.figma-env__primary-button.is-small {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__search {
  position: relative;
  display: flex;
  height: 28px;
  align-items: center;
  margin-top: 8.75px;
}

.figma-env__search .el-icon {
  position: absolute;
  z-index: 1;
  left: 8.75px;
  width: 12px;
  height: 12px;
  color: #86909c;
}

.figma-env__search input {
  width: 100%;
  height: 28px;
  padding: 0 10.5px 0 29px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
}

.figma-env__search input::placeholder {
  color: rgba(29, 33, 41, .5);
}

.figma-env__search input:focus {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, .08);
}

.figma-env__sidebar-list {
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  padding-bottom: 12px;
}

.figma-env__env-card {
  display: flex;
  width: calc(100% - 21px);
  height: 81px;
  flex-direction: column;
  margin: 0 10.5px 5.25px;
  padding: 9.75px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  color: #1d2129;
  cursor: pointer;
  text-align: left;
}

.figma-env__env-card:hover,
.figma-env__env-card.is-active {
  border-color: color-mix(in srgb, var(--stage-color) 25%, transparent);
  background: color-mix(in srgb, var(--stage-background) 55%, #fff);
}

.figma-env__env-card.is-skeleton {
  animation: figma-env-pulse 1.2s ease-in-out infinite alternate;
  background: #f7f8fa;
}

.figma-env__env-card-main {
  display: flex;
  height: 39.75px;
  align-items: center;
  gap: 10.5px;
}

.figma-env__stage-line {
  width: 3.5px;
  height: 28px;
  flex: 0 0 3.5px;
  border-radius: 999px;
  background: var(--stage-color);
}

.figma-env__env-card-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.figma-env__env-name-row,
.figma-env__env-meta-row,
.figma-env__env-card-foot {
  display: flex;
  align-items: center;
}

.figma-env__env-name-row {
  height: 19.5px;
  gap: 5.25px;
}

.figma-env__env-name-row strong {
  overflow: hidden;
  color: var(--stage-color);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__env-name-row em {
  padding: 1.75px 5.25px;
  border-radius: 999px;
  background: #f2f3f5;
  color: #c9cdd4;
  font-size: 10px;
  font-style: normal;
  line-height: 15px;
}

.figma-env__env-meta-row {
  height: 20.25px;
  gap: 7px;
}

.figma-env__env-meta-row b {
  padding: 1.75px 5.25px;
  border-radius: 999px;
  background: var(--stage-background);
  color: var(--stage-color);
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
}

.figma-env__env-meta-row small {
  color: #c9cdd4;
  font-size: 10px;
  line-height: 15px;
}

.figma-env__env-card-foot {
  height: 17px;
  justify-content: space-between;
  padding-left: 10.5px;
  margin-top: 5.25px;
}

.figma-env__env-card-foot > span {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  color: #00b42a;
  font-size: 11px;
  line-height: 17px;
}

.figma-env__env-card-foot > span.is-warning {
  color: #ff7d00;
}

.figma-env__env-card-foot .el-icon {
  width: 12px;
  height: 12px;
}

.figma-env__env-card-foot small {
  color: #0fc6c2;
  font-size: 10px;
  line-height: 15px;
}

.figma-env__sidebar-empty {
  padding: 60px 20px;
  color: #86909c;
  font-size: 13px;
  text-align: center;
}

.figma-env__detail {
  overflow: hidden;
  min-width: 0;
  height: 624.25px;
}

.figma-env__detail-head {
  display: flex;
  height: 74.25px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 21px;
  background: #fff;
}

.figma-env__detail-summary {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 14px;
}

.figma-env__detail-icon {
  display: inline-flex;
  width: 35px;
  height: 35px;
  flex: 0 0 35px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
}

.figma-env__detail-icon .el-icon {
  width: 20px;
  height: 20px;
}

.figma-env__detail-copy {
  min-width: 0;
}

.figma-env__detail-title-row {
  display: flex;
  height: 24px;
  align-items: center;
  gap: 8.75px;
}

.figma-env__detail-title-row h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.figma-env__stage-badge,
.figma-env__apply-badge {
  display: inline-flex;
  height: 20.5px;
  align-items: center;
  font-size: 11px;
  line-height: 16.5px;
}

.figma-env__stage-badge {
  padding: 0 7px;
  font-weight: 600;
}

.figma-env__apply-badge {
  gap: 3.5px;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
}

.figma-env__apply-badge .el-icon {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
}

.figma-env__apply-badge .el-icon svg {
  width: 10px;
  height: 10px;
}

.figma-env__detail-description {
  display: flex;
  overflow: hidden;
  height: 21.5px;
  align-items: center;
  gap: 10.5px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.figma-env__detail-description > span:first-child {
  overflow: hidden;
  max-width: 360px;
  text-overflow: ellipsis;
}

.figma-env__detail-description i {
  color: #c9cdd4;
  font-style: normal;
}

.figma-env__detail-description .is-warning {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  color: #ff7d00;
}

.figma-env__detail-description .el-icon {
  width: 12px;
  height: 12px;
}

.figma-env__detail-actions {
  display: flex;
  height: 46.25px;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.figma-env__metric {
  display: flex;
  min-width: 48px;
  height: 46.25px;
  padding: 5.25px 8.75px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
}

.figma-env__metric strong {
  font-size: 17px;
  font-weight: 700;
  line-height: 17px;
}

.figma-env__metric span {
  margin-top: 1.75px;
  color: #c9cdd4;
  font-size: 10px;
  line-height: 15px;
}

.figma-env__action-divider {
  width: 1px;
  height: 28px;
  margin-right: 0;
  background: #e5e6eb;
}

.figma-env__detail-actions > button {
  height: 28px;
  padding: 0 10.5px;
}

.figma-env__detail-actions > button .el-icon {
  width: 13px;
  height: 13px;
}

.figma-env__detail-actions > button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.figma-env__detail-actions > button.figma-env__icon-button {
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  border-color: transparent;
  color: #c9cdd4;
}

.figma-env__tabs {
  display: flex;
  height: 37px;
  align-items: flex-end;
  padding: 0 21px;
  border-top: 1px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.figma-env__tabs button {
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env__tabs button.is-active {
  border-bottom-color: #4e5ac8;
  color: #4e5ac8;
}

.figma-env__services,
.figma-env__variables,
.figma-env__secondary-panel {
  height: 513px;
  padding: 17.5px;
  background: #f4f6fa;
}

.figma-env__service-toolbar {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 7px;
  margin-bottom: 14px;
}

.figma-env__service-toolbar > span {
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.figma-env__service-toolbar > i {
  min-width: 24px;
  flex: 1;
}

.figma-env__service-toolbar button {
  height: 28px;
  padding: 0 10.5px;
}

.figma-env__service-toolbar button.is-primary {
  height: 32px;
  padding: 0 14px;
}

.figma-env__service-list {
  display: flex;
  flex-direction: column;
  gap: 12.25px;
}

.figma-env__service-card {
  display: flex;
  width: 100%;
  height: 65.25px;
  align-items: center;
  gap: 14px;
  padding: 10.5px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .04);
}

.figma-env__service-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: #f2f3f5;
  color: #c9cdd4;
}

.figma-env__service-icon.is-default {
  background: rgba(22, 93, 255, .08);
  color: #165dff;
}

.figma-env__service-icon .el-icon {
  width: 15px;
  height: 15px;
}

.figma-env__service-copy {
  min-width: 0;
  flex: 1;
}

.figma-env__service-copy > div,
.figma-env__service-copy p {
  display: flex;
  align-items: center;
}

.figma-env__service-copy > div {
  height: 19.5px;
  gap: 7px;
}

.figma-env__service-copy strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.figma-env__service-copy b {
  padding: 0 5.25px;
  border-radius: 4px;
  background: rgba(22, 93, 255, .08);
  color: #165dff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.figma-env__service-copy b.is-disabled {
  background: #f2f3f5;
  color: #c9cdd4;
}

.figma-env__service-copy p {
  height: 22.75px;
  gap: 7px;
  padding-top: 1.75px;
  margin: 0;
}

.figma-env__service-copy code {
  overflow: hidden;
  color: #4e5969;
  font-family: var(--app-font-mono);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__service-copy p i {
  color: #c9cdd4;
  font-style: normal;
}

.figma-env__service-copy p span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__service-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10.5px;
}

.figma-env__service-status {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__service-status.is-success { color: #00b42a; }
.figma-env__service-status.is-failed { color: #f53f3f; }
.figma-env__service-status.is-timeout { color: #ff7d00; }
.figma-env__service-status.is-testing { color: #165dff; }

.figma-env__service-status .el-icon {
  width: 13px;
  height: 13px;
}

.figma-env__service-actions > button {
  height: 25px;
  padding: 0 8.75px;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__row-actions {
  display: flex;
}

.figma-env__row-actions button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.figma-env__row-actions button:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.figma-env__row-actions .el-icon {
  width: 13px;
  height: 13px;
}

.figma-env__variables {
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  gap: 17.5px;
  scrollbar-width: none;
}

.figma-env__variables::-webkit-scrollbar { display: none; }

.figma-env__variable-priority {
  display: flex;
  min-height: 37.5px;
  flex: 0 0 37.5px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid rgba(22, 93, 255, .18);
  border-radius: 11px;
  background: #f0f5ff;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__variable-priority > .el-icon:first-child {
  width: 13px;
  height: 13px;
  color: #165dff;
}

.figma-env__variable-priority > .el-icon:not(:first-child) {
  width: 12px;
  height: 12px;
  color: #c9cdd4;
}

.figma-env__variable-priority strong {
  color: #165dff;
  font-weight: 600;
}

.figma-env__variable-priority small {
  margin-left: 3.5px;
  color: #c9cdd4;
  font-size: 12px;
}

.figma-env__variable-section {
  min-width: 0;
}

.figma-env__variable-heading {
  display: flex;
  min-height: 39.5px;
  align-items: flex-start;
  justify-content: space-between;
}

.figma-env__variable-heading h3,
.figma-env__variable-heading p {
  margin: 0;
}

.figma-env__variable-heading h3 {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-env__variable-heading p {
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__variable-heading > div:last-child {
  display: flex;
  gap: 7px;
}

.figma-env__variable-heading button,
.figma-env__priority-index {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  padding: 0 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-env__variable-heading button .el-icon {
  width: 13px;
  height: 13px;
}

.figma-env__variable-set-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10.5px;
}

.figma-env__variable-set-list article {
  display: flex;
  min-height: 62px;
  align-items: center;
  gap: 14px;
  padding: 10.5px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
}

.figma-env__variable-set-list article.is-disabled,
.figma-env__local-variable-table tr.is-disabled {
  opacity: .62;
}

.figma-env__priority-index {
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  padding: 0;
  border: 0;
  background: rgba(22, 93, 255, .08);
  color: #165dff;
  font-size: 11px;
  font-weight: 700;
}

.figma-env__variable-set-copy {
  min-width: 0;
  flex: 1;
}

.figma-env__variable-set-copy > div {
  display: flex;
  height: 19.5px;
  align-items: center;
  gap: 7px;
}

.figma-env__variable-set-copy strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__variable-set-copy span {
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
}

.figma-env__variable-set-copy span.is-sensitive {
  background: #fff3e8;
  color: #ff7d00;
}

.figma-env__variable-set-copy p {
  display: flex;
  height: 19.75px;
  align-items: center;
  gap: 7px;
  padding-top: 1.75px;
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__variable-set-copy p i,
.figma-env__variable-set-copy p code {
  color: #c9cdd4;
  font-style: normal;
}

.figma-env__variable-set-copy p code {
  font-family: var(--app-font-mono);
}

.figma-env__variable-order-actions {
  display: flex;
}

.figma-env__variable-order-actions button {
  display: inline-flex;
  width: 14px;
  height: 21px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
}

.figma-env__variable-order-actions button:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.figma-env__variable-order-actions .el-icon {
  width: 13px;
  height: 13px;
}

.figma-env__variable-empty {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  margin-top: 10.5px;
  border: 1px dashed #e5e6eb;
  border-radius: 11px;
  background: #fafafa;
  color: #86909c;
  font-size: 13px;
}

.figma-env__variable-empty > .el-icon {
  width: 20px;
  height: 20px;
  color: #c9cdd4;
}

.figma-env__variable-empty.is-local {
  min-height: 84px;
}

.figma-env__local-variable-table {
  overflow: hidden;
  margin-top: 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .04);
}

.figma-env__local-variable-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.figma-env__local-variable-table col.is-name { width: 22%; }
.figma-env__local-variable-table col.is-value { width: 28%; }
.figma-env__local-variable-table col.is-type { width: 10%; }
.figma-env__local-variable-table col.is-status { width: 8%; }
.figma-env__local-variable-table col.is-actions { width: 10%; }

.figma-env__local-variable-table thead {
  height: 34.5px;
  background: #fafafa;
}

.figma-env__local-variable-table th {
  padding: 0 14px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .275px;
  line-height: 16.5px;
  text-align: left;
  text-transform: uppercase;
}

.figma-env__local-variable-table th:last-child,
.figma-env__local-variable-table td:last-child { text-align: right; }

.figma-env__local-variable-table td {
  height: 46px;
  padding: 0 14px;
  border-top: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-env__local-variable-table td > code {
  color: #4e5969;
  font-family: var(--app-font-mono);
  font-size: 12px;
  line-height: 18px;
}

.figma-env__local-variable-table td:first-child > code {
  color: #1d2129;
  font-weight: 600;
}

.figma-env__local-variable-table td > code.is-masked { color: #c9cdd4; }

.figma-env__local-variable-table td > span {
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.figma-env__local-variable-table td:last-child > span {
  padding: 0;
  background: transparent;
}

.figma-env__service-empty {
  display: flex;
  height: 295px;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 84px;
}

.figma-env__service-empty > .el-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 10.5px;
  color: #c9cdd4;
}

.figma-env__service-empty > strong {
  color: #4e5969;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
}

.figma-env__service-empty p {
  margin: 3.5px 0 14px;
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.figma-env__mock-panel {
  overflow-y: auto;
  height: 513px;
  padding: 17.5px;
  background: #f4f6fa;
}

.figma-env__mock-production-warning {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 10.5px 14px;
  margin-bottom: 17.5px;
  border: 1px solid #fbbbb9;
  border-radius: 11px;
  background: #ffe8e8;
  color: #f53f3f;
}

.figma-env__mock-production-warning > .el-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin-top: 1px;
}

.figma-env__mock-production-warning div {
  display: grid;
  gap: 1.75px;
}

.figma-env__mock-production-warning strong { font-size: 13px; line-height: 20px; }
.figma-env__mock-production-warning span { font-size: 12px; line-height: 18px; }

.figma-env__mock-toolbar {
  display: flex;
  height: 28px;
  align-items: center;
  gap: 7px;
  margin-bottom: 14px;
}

.figma-env__mock-toolbar h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.figma-env__mock-toolbar > span { flex: 1; }

.figma-env__mock-toolbar button,
.figma-env__mock-card header > button,
.figma-env__mock-card footer > button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  padding: 0 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env__mock-toolbar button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.figma-env__mock-toolbar button .el-icon { width: 13px; height: 13px; }

.figma-env__mock-card {
  overflow: hidden;
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
}

.figma-env__mock-card > header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 10.5px 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.figma-env__mock-card > header > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.figma-env__mock-card > header strong {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env__mock-card header > button,
.figma-env__mock-card footer > button {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__mock-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.figma-env__mock-grid > div {
  display: flex;
  min-width: 0;
  height: 43.75px;
  align-items: center;
  gap: 10.5px;
  padding: 10.5px 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.figma-env__mock-grid > div:nth-child(odd) { border-right: 1px solid #e5e6eb; }

.figma-env__mock-grid > div > span {
  min-width: 80px;
  flex: 0 0 80px;
  color: #c9cdd4;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.figma-env__mock-grid strong,
.figma-env__mock-grid code {
  overflow: hidden;
  min-width: 0;
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__mock-grid code { color: #4e5969; font-family: var(--app-font-mono); font-size: 12px; font-weight: 400; }
.figma-env__mock-grid code.is-version { color: #00b42a; font-size: 13px; font-weight: 600; }
.figma-env__mock-grid code.is-link { color: #165dff; }
.figma-env__mock-grid strong.is-credential { color: #c9cdd4; font-size: 12px; font-weight: 400; }

.figma-env__mock-card > footer {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 8.75px 17.5px;
  background: #fff3e8;
  color: #ff7d00;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__mock-card > footer > .el-icon { width: 13px; height: 13px; flex: 0 0 13px; }
.figma-env__mock-card > footer > span { overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
.figma-env__mock-card footer > button { color: #ff7d00; font-weight: 500; }

.figma-env__mock-empty {
  display: flex;
  height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
}

.figma-env__mock-empty > .el-icon { width: 40px; height: 40px; margin-bottom: 10.5px; }
.figma-env__mock-empty > strong { color: #4e5969; font-size: 14px; font-weight: 500; line-height: 21px; }
.figma-env__mock-empty > p { margin: 3.5px 0 14px; color: #86909c; font-size: 13px; line-height: 20px; }

.figma-env__effective-panel {
  overflow: hidden;
  height: 513px;
  padding: 17.5px;
  background: #f4f6fa;
}

.figma-env__effective-toolbar {
  display: flex;
  width: 100%;
  height: 28px;
  align-items: center;
  gap: 7px;
}

.figma-env__effective-toolbar > p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.figma-env__effective-toolbar > span {
  min-width: 7px;
  flex: 1;
}

.figma-env__effective-filter,
.figma-env__effective-search {
  position: relative;
  display: flex;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
}

.figma-env__effective-filter {
  width: 130px;
}

.figma-env__effective-filter select {
  width: 100%;
  height: 28px;
  padding: 0 30px 0 12.75px;
  appearance: none;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
}

.figma-env__effective-filter > .el-icon {
  position: absolute;
  right: 9px;
  width: 10px;
  height: 10px;
  pointer-events: none;
  color: #86909c;
}

.figma-env__effective-filter:focus-within select,
.figma-env__effective-search:focus-within input {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, .08);
}

.figma-env__effective-search {
  width: 180px;
}

.figma-env__effective-search > .el-icon {
  position: absolute;
  left: 8.75px;
  z-index: 1;
  width: 12px;
  height: 12px;
  color: #86909c;
}

.figma-env__effective-search input {
  width: 100%;
  height: 28px;
  padding: 0 10.5px 0 28px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
}

.figma-env__effective-search input::placeholder {
  color: rgba(29, 33, 41, .5);
}

.figma-env__effective-table-shell {
  overflow: hidden;
  width: 100%;
  max-height: calc(100% - 42px);
  margin-top: 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .04);
}

.figma-env__effective-table-scroll {
  overflow: auto;
  max-height: 434px;
}

.figma-env__effective-table {
  width: 100%;
  min-width: 1100px;
  border-spacing: 0;
  table-layout: fixed;
}

.figma-env__effective-table col:nth-child(1),
.figma-env__effective-table col:nth-child(2) { width: 22%; }
.figma-env__effective-table col:nth-child(3) { width: 16%; }
.figma-env__effective-table col:nth-child(4) { width: 10%; }
.figma-env__effective-table col:nth-child(5) { width: 22%; }
.figma-env__effective-table col:nth-child(6) { width: 8%; }

.figma-env__effective-table th,
.figma-env__effective-table td {
  overflow: hidden;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__effective-table th {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 34.5px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .275px;
  line-height: 16.5px;
}

.figma-env__effective-table th:last-child {
  text-align: center;
}

.figma-env__effective-table td {
  height: 46px;
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-env__effective-table tbody tr:last-child td {
  border-bottom: 0;
}

.figma-env__effective-table tbody tr:not(.figma-env__effective-no-result):hover td {
  background: #fbfdff;
}

.figma-env__effective-name,
.figma-env__effective-value {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.figma-env__effective-value {
  color: #4e5969;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-env__effective-value.is-sensitive,
.figma-env__effective-dash {
  color: #c9cdd4;
}

.figma-env__effective-source {
  display: inline-flex;
  height: 17.5px;
  align-items: center;
  padding: .5px 5.25px;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.figma-env__effective-source.is-local {
  background: rgba(22, 93, 255, .08);
  color: #165dff;
}

.figma-env__effective-source.is-variable-set {
  background: #f5e8ff;
  color: #7816ff;
}

.figma-env__effective-source.is-workspace {
  background: #f2f3f5;
  color: #86909c;
}

.figma-env__effective-override {
  color: #ff7d00;
  font-size: 11px;
  line-height: 16.5px;
}

.figma-env__effective-description {
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-env__effective-status {
  width: 14px;
  height: 14px;
  vertical-align: middle;
}

.figma-env__effective-status.is-ok { color: #00b42a; }
.figma-env__effective-status.is-error { color: #f53f3f; }

.figma-env__effective-empty {
  display: flex;
  height: 340px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
}

.figma-env__effective-empty > .el-icon {
  width: 36px;
  height: 36px;
  margin-bottom: 10.5px;
}

.figma-env__effective-empty p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.figma-env__effective-no-result td {
  height: 92px;
  color: #86909c;
  text-align: center;
}

.figma-env__secondary-panel {
  overflow-y: auto;
  background: #fff;
}

.figma-env__secondary-panel > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.figma-env__secondary-panel h3,
.figma-env__secondary-panel p {
  margin: 0;
}

.figma-env__secondary-panel h3 {
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.figma-env__secondary-panel header p,
.figma-env__secondary-grid label > span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env__secondary-panel :deep(.el-select) {
  width: min(720px, 100%);
}

.figma-env__bound-list,
.figma-env__reference-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.figma-env__bound-list > span,
.figma-env__reference-list article {
  display: flex;
  max-width: 720px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.figma-env__bound-list strong,
.figma-env__reference-list strong {
  font-size: 13px;
  font-weight: 500;
}

.figma-env__bound-list small,
.figma-env__reference-list span,
.figma-env__reference-empty {
  color: #86909c;
  font-size: 12px;
}

.figma-env__secondary-grid {
  display: grid;
  max-width: 760px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.figma-env__secondary-grid label {
  display: grid;
  gap: 6px;
}

.figma-env__secondary-grid :deep(.el-select) { width: 100%; }

.figma-env__ready {
  max-width: 760px;
  padding: 9px 12px;
  margin-bottom: 14px !important;
  border-radius: 7px;
  background: #e8ffea;
  color: #00b42a;
  font-size: 12px;
}

.figma-env__no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f4f6fa;
  color: #86909c;
}

.figma-env__no-selection > .el-icon { width: 40px; height: 40px; }
.figma-env__no-selection strong { margin-top: 10px; color: #4e5969; font-size: 14px; }
.figma-env__no-selection p { margin: 4px 0 0; font-size: 12px; }

.figma-env-modal {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, .5);
  font-family: var(--app-font-family);
}

.figma-env-modal,
.figma-env-modal * { box-sizing: border-box; }

.figma-env-modal__dialog {
  overflow: hidden;
  width: 520px;
  height: 402.5px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .15);
}

.figma-env-modal__dialog--environment {
  width: 500px;
  height: 405px;
}

.figma-env-modal__dialog--environment.is-create {
  height: 422.75px;
}

.figma-env-modal__dialog--confirm {
  width: 480px;
  height: 187px;
}

.figma-env-modal__dialog--confirm.is-blocked {
  height: 215.25px;
}

.figma-env-modal__dialog--bind-variable {
  width: 480px;
  height: 361px;
}

.figma-env-modal__dialog--priority {
  width: 620px;
  height: 421.25px;
}

.figma-env-modal__dialog--local-variable {
  width: 500px;
  height: 449.5px;
}

.figma-env-modal__dialog--delete-variable {
  width: 420px;
  height: 169px;
}

.figma-env-modal__dialog--mock-bind {
  width: 500px;
  height: 335px;
}

.figma-env-modal__dialog--mock-version {
  width: 500px;
  height: 467px;
}

.figma-env-modal__dialog--mock-unbind {
  width: 460px;
  height: 290px;
}

.figma-env-modal__dialog > header {
  display: flex;
  height: 53.5px;
  align-items: center;
  justify-content: space-between;
  padding: 0 21px;
  border-bottom: 1px solid #e5e6eb;
}

.figma-env-modal__dialog--environment.is-create > header {
  height: 71.25px;
  align-items: flex-start;
  padding: 14px 21px;
}

.figma-env-modal__dialog--bind-variable > header,
.figma-env-modal__dialog--priority > header {
  height: 71.25px;
  align-items: flex-start;
  padding: 14px 21px;
}

.figma-env-modal__heading-copy {
  min-width: 0;
}

.figma-env-modal__heading-copy p {
  height: 19.75px;
  padding-top: 1.75px;
  margin: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-env-modal__dialog h2 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.figma-env-modal__dialog > header button {
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  border-color: transparent;
  color: #c9cdd4;
}

.figma-env-modal__dialog > header .el-icon { width: 16px; height: 16px; }

.figma-env-modal__body {
  display: flex;
  height: 288px;
  flex-direction: column;
  gap: 14px;
  padding: 17.5px 21px;
}

.figma-env-modal__body--environment {
  height: 290.5px;
}

.figma-env-modal__choice-field {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}

.figma-env-modal__choice-field legend {
  height: 18px;
  padding: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-env-modal__stage-options,
.figma-env-modal__applicability-options {
  display: flex;
  gap: 7px;
  margin-top: 5.25px;
}

.figma-env-modal__stage-options button,
.figma-env-modal__applicability-options button {
  height: 28px;
  padding: 0 10.5px;
  border-color: #e5e6eb;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__stage-options button.is-selected,
.figma-env-modal__applicability-options button.is-selected {
  border-color: #165dff;
  background: #e8f3ff;
  color: #165dff;
}

.figma-env-modal__applicability-options button {
  height: 34px;
  min-width: 0;
  flex: 1;
  padding: 0 10.5px;
  background: #fff;
}

.figma-env-modal__applicability-options button.is-selected {
  background: rgba(22, 93, 255, .03);
}

.figma-env-modal__applicability-options .el-icon {
  width: 12px;
  height: 12px;
}

.figma-env-modal__confirm-body {
  height: 72.5px;
  padding: 17.5px 21px;
}

.figma-env-modal__variable-set-options {
  display: flex;
  overflow-y: auto;
  height: 228.75px;
  flex-direction: column;
  gap: 7px;
  padding: 14px 21px;
}

.figma-env-modal__variable-set-options > button {
  display: flex;
  min-height: 62px;
  flex: 0 0 62px;
  justify-content: flex-start;
  gap: 10.5px;
  padding: 10.5px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  text-align: left;
}

.figma-env-modal__variable-set-options > button.is-selected {
  border-color: #165dff;
  background: rgba(22, 93, 255, .025);
}

.figma-env-modal__checkbox {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  background: #e5e6eb;
  color: #fff;
}

.is-selected > .figma-env-modal__checkbox { background: #165dff; }
.figma-env-modal__checkbox .el-icon { width: 10px; height: 10px; }

.figma-env-modal__variable-set-option-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.figma-env-modal__variable-set-option-copy > span {
  display: flex;
  height: 19.5px;
  align-items: center;
  gap: 7px;
}

.figma-env-modal__variable-set-option-copy strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env-modal__variable-set-option-copy em {
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: 15px;
}

.figma-env-modal__variable-set-option-copy em.is-sensitive {
  background: #fff3e8;
  color: #ff7d00;
}

.figma-env-modal__variable-set-option-copy small {
  display: flex;
  height: 19.75px;
  align-items: center;
  gap: 7px;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.figma-env-modal__variable-set-option-copy small i,
.figma-env-modal__variable-set-option-copy small code {
  color: #c9cdd4;
  font-style: normal;
}

.figma-env-modal__variable-set-option-copy small code { font-family: var(--app-font-mono); }

.figma-env-modal__variable-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 13px;
}

.figma-env-modal__priority-body {
  display: flex;
  overflow-y: auto;
  height: 289px;
  flex-direction: column;
  gap: 14px;
  padding: 14px 21px;
}

.figma-env-modal__priority-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.figma-env-modal__priority-columns section > h3 {
  height: 18px;
  margin: 0 0 7px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.figma-env-modal__priority-columns article {
  display: flex;
  height: 55.5px;
  align-items: center;
  gap: 10.5px;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
}

.figma-env-modal__priority-columns article + article { margin-top: 7px; }
.figma-env-modal__priority-columns article.is-preview { height: 39px; background: #fafafa; }

.figma-env-modal__priority-columns article > b {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgba(22, 93, 255, .08);
  color: #165dff;
  font-size: 11px;
  font-weight: 700;
}

.figma-env-modal__priority-columns article > span {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.figma-env-modal__priority-columns article strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env-modal__priority-columns article small {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.figma-env-modal__priority-columns article > i {
  display: flex;
  flex-direction: column;
  gap: 1.75px;
}

.figma-env-modal__priority-columns article > i button {
  width: 17.5px;
  height: 17.5px;
  padding: 0;
  border: 0;
  color: #4e5969;
}

.figma-env-modal__priority-columns article > i button:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.figma-env-modal__priority-columns article > i .el-icon { width: 12px; height: 12px; }

.figma-env-modal__conflicts {
  overflow: hidden;
  border: 1px solid rgba(255, 125, 0, .35);
  border-radius: 11px;
  background: #fff;
}

.figma-env-modal__conflicts > header {
  height: 35px;
  padding: 8.75px 14px;
  border-bottom: 1px solid rgba(255, 125, 0, .25);
  background: #fff3e8;
  color: #ff7d00;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.figma-env-modal__conflicts > div {
  display: flex;
  min-height: 54px;
  flex-direction: column;
  gap: 7px;
  padding: 10.5px 14px;
}

.figma-env-modal__conflicts p {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.figma-env-modal__conflicts p > span,
.figma-env-modal__conflicts p > strong {
  overflow: hidden;
  max-width: 116px;
  flex: 0 1 auto;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env-modal__conflicts code {
  color: #1d2129;
  font-family: var(--app-font-mono);
  font-weight: 600;
}

.figma-env-modal__conflicts p > span:not(:first-of-type),
.figma-env-modal__conflicts i { color: #4e5969; font-style: normal; }
.figma-env-modal__conflicts strong { color: #165dff; font-weight: 600; }

.figma-env-modal__body--local-variable {
  height: 335px;
}

.figma-env-modal__body input.is-mono { font-family: var(--app-font-mono); }

.figma-env-modal__row--local-variable {
  grid-template-columns: 222px 222px;
}

.figma-env-modal__row--local-variable select {
  width: 100%;
  height: 28px;
  padding: 0 10.5px;
  margin-top: 5.25px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
}

.figma-env-modal__local-enabled {
  display: flex;
  height: 39.5px;
  align-items: center;
  justify-content: space-between;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
}

.figma-env-modal__local-enabled > span {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env-modal__delete-variable-copy {
  height: 55px;
  padding: 17.5px 21px;
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
  white-space: nowrap;
}

.figma-env-modal__delete-variable-copy strong {
  color: #4e5969;
  font-weight: 700;
}

.figma-env-modal__mock-bind-body,
.figma-env-modal__mock-version-body,
.figma-env-modal__mock-unbind-body {
  display: flex;
  flex-direction: column;
}

.figma-env-modal__mock-bind-body {
  height: 219px;
  gap: 14px;
  padding: 17.5px 21px;
}

.figma-env-modal__mock-bind-body label {
  display: grid;
  gap: 5.25px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__mock-bind-body label b { color: #f53f3f; }

.figma-env-modal__mock-bind-body select {
  width: 100%;
  height: 32px;
  padding: 0 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font: inherit;
  font-size: 13px;
}

.figma-env-modal__mock-bind-body select:focus { border-color: #165dff; }
.figma-env-modal__mock-bind-body select:disabled { background: #f7f8fa; color: #c9cdd4; }

.figma-env-modal__mock-bind-tip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8.75px 10.5px;
  border: 1px solid rgba(255, 125, 0, .25);
  border-radius: 7px;
  background: #fff3e8;
  color: #ff7d00;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__mock-bind-tip .el-icon { width: 14px; height: 14px; flex: 0 0 14px; }

.figma-env-modal__mock-version-body {
  height: 350px;
  gap: 14px;
  padding: 17.5px 21px;
}

.figma-env-modal__mock-current {
  display: flex;
  min-height: 39px;
  align-items: center;
  gap: 7px;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
}

.figma-env-modal__mock-current span { color: #86909c; font-size: 12px; line-height: 18px; }
.figma-env-modal__mock-current code { color: #00b42a; font-family: var(--app-font-mono); font-size: 13px; font-weight: 600; line-height: 20px; }

.figma-env-modal__mock-version-list {
  display: flex;
  overflow-y: auto;
  max-height: 194px;
  flex-direction: column;
  gap: 7px;
}

.figma-env-modal__mock-version-list > button {
  display: flex;
  min-height: 43px;
  flex: 0 0 43px;
  justify-content: flex-start;
  gap: 10.5px;
  padding: 10.5px 14px;
  border: 1.5px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
}

.figma-env-modal__mock-version-list > button.is-selected {
  border-color: #165dff;
  background: rgba(22, 93, 255, .02);
}

.figma-env-modal__mock-version-list > button.is-current {
  cursor: default;
  opacity: .6;
  background: #fafafa;
}

.figma-env-modal__mock-version-list > button > i {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5e6eb;
}

.figma-env-modal__mock-version-list > button.is-selected > i { background: #165dff; }
.figma-env-modal__mock-version-list > button.is-selected > i > span { width: 6px; height: 6px; border-radius: 50%; background: #fff; }
.figma-env-modal__mock-version-list code { color: #1d2129; font-family: var(--app-font-mono); font-size: 13px; line-height: 20px; }
.figma-env-modal__mock-version-list em,
.figma-env-modal__mock-version-list small { margin-left: auto; padding: 1.75px 5.25px; border-radius: 4px; background: #e8f3ff; color: #165dff; font-size: 11px; font-style: normal; font-weight: 400; line-height: 17px; }

.figma-env-modal__mock-version-warning {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8.75px 10.5px;
  border: 1px solid rgba(255, 125, 0, .25);
  border-radius: 7px;
  background: #fff3e8;
}

.figma-env-modal__mock-version-warning > .el-icon { width: 14px; height: 14px; flex: 0 0 14px; margin-top: 1px; color: #ff7d00; }
.figma-env-modal__mock-version-warning p { margin: 0; color: #4e5969; font-size: 12px; line-height: 18px; }
.figma-env-modal__mock-version-warning small { display: block; padding-top: 3.5px; color: #86909c; font-size: 12px; line-height: 18px; }

.figma-env-modal__mock-unbind-body {
  height: 173px;
  gap: 14px;
  padding: 17.5px 21px;
}

.figma-env-modal__mock-unbind-body > p {
  margin: 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.figma-env-modal__mock-unbind-warning {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8.75px 10.5px;
  border: 1px solid #fbbbb9;
  border-radius: 7px;
  background: #ffe8e8;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__mock-unbind-warning .el-icon { width: 14px; height: 14px; flex: 0 0 14px; margin-top: 1px; }

.figma-env-modal__mock-unbind-target {
  display: flex;
  min-height: 39px;
  align-items: center;
  gap: 5.25px;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__mock-unbind-target strong { color: #1d2129; font-weight: 600; }
.figma-env-modal__mock-unbind-target i { color: #c9cdd4; font-style: normal; }
.figma-env-modal__mock-unbind-target code { color: #4e5969; font-family: var(--app-font-mono); }

.figma-env-modal__dialog--confirm.is-blocked .figma-env-modal__confirm-body {
  height: 100.75px;
}

.figma-env-modal__notice {
  display: flex;
  width: 438px;
  min-height: 37.5px;
  align-items: flex-start;
  gap: 7px;
  padding: 8.75px 10.5px;
  border: 1px solid;
  border-radius: 7px;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__notice > .el-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin-top: 2px;
}

.figma-env-modal__notice.is-warning {
  border-color: #ffd591;
  background: #fff3e8;
  color: #4e5969;
}

.figma-env-modal__notice.is-warning > .el-icon {
  color: #ff7d00;
}

.figma-env-modal__notice b {
  color: #1d2129;
  font-weight: 600;
}

.figma-env-modal__notice.is-danger {
  min-height: 66.25px;
  padding: 10.5px;
  border-color: #fbbbbb;
  background: #ffe8e8;
  color: #f53f3f;
}

.figma-env-modal__notice.is-danger > div {
  display: flex;
  flex-direction: column;
}

.figma-env-modal__notice.is-danger strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.figma-env-modal__notice.is-danger span {
  margin-top: 5.25px;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__body > label,
.figma-env-modal__row > label {
  display: flex;
  width: 100%;
  height: 51.25px;
  flex-direction: column;
}

.figma-env-modal__body label > span {
  height: 18px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-env-modal__body label > span b {
  color: #f53f3f;
  font-weight: 500;
}

.figma-env-modal__body input {
  width: 100%;
  height: 28px;
  padding: 0 10.5px;
  margin-top: 5.25px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
}

.figma-env-modal__body input:focus {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgba(22, 93, 255, .08);
}

.figma-env-modal__body input::placeholder { color: rgba(29, 33, 41, .5); }

.figma-env-modal__url {
  display: flex;
  height: 33.25px;
  gap: 7px;
}

.figma-env-modal__url input {
  min-width: 0;
  flex: 1;
  font-family: var(--app-font-mono);
}

.figma-env-modal__url button {
  height: 28px;
  flex: 0 0 auto;
  align-self: flex-end;
  padding: 0 10.5px;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__url .el-icon { width: 12px; height: 12px; }

.figma-env-modal__row {
  display: grid;
  height: 51.25px;
  grid-template-columns: 232px 232px;
  gap: 14px;
}

.figma-env-modal__default {
  display: flex;
  align-items: flex-end;
  gap: 10.5px;
  padding-bottom: 1.75px;
}

.figma-env-modal__default > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-env-modal__enabled {
  display: flex;
  height: 58.25px;
  align-items: center;
  justify-content: space-between;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
}

.figma-env-modal__enabled > span {
  display: flex;
  flex-direction: column;
}

.figma-env-modal__enabled strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.figma-env-modal__enabled small {
  color: #86909c;
  font-size: 11px;
  line-height: 17px;
}

.figma-env-switch {
  position: relative;
  width: 28px !important;
  height: 14px !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 999px !important;
  background: #c9cdd4 !important;
}

.figma-env-switch i {
  position: absolute;
  top: 1.75px;
  left: 2px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px rgba(0, 0, 0, .1);
  transition: left 150ms ease;
}

.figma-env-switch.is-on { background: #165dff !important; }
.figma-env-switch.is-on i { left: 15.5px; }

.figma-env-modal__dialog > footer {
  display: flex;
  height: 61px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 7px;
  padding: 14px 21px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.figma-env-modal__dialog > footer > span {
  margin-right: auto;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.figma-env-modal__dialog > footer button {
  height: 28px;
  padding: 0 10.5px;
}

.figma-env-modal__dialog > footer button.is-primary {
  height: 32px;
  padding: 0 14px;
}

.figma-env-modal__dialog > footer button.is-danger {
  height: 32px;
  padding: 0 14px;
  border-color: #f53f3f;
  background: #f53f3f;
  color: #fff;
}

.figma-env-modal__dialog > footer button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.figma-env-modal__dialog > footer button.is-warning-action {
  height: 32px;
  padding: 0 14px;
  border-color: #ff7d00;
  background: #ff7d00;
  color: #fff;
}

.figma-env-modal__dialog > footer button.is-disabled-action {
  height: 32px;
  padding: 0 14px;
  border-color: #c9cdd4;
  background: #c9cdd4;
  color: #fff;
  cursor: not-allowed;
  opacity: 1;
}

.figma-env__references {
  height: 513px;
  padding: 17.5px;
  overflow: hidden;
  box-sizing: border-box;
  background: #fff;
}

.figma-env__reference-warning {
  display: flex;
  width: 100%;
  height: 39.5px;
  box-sizing: border-box;
  align-items: center;
  gap: 7px;
  padding: 8.75px 14px;
  border: 1px solid #ffd595;
  border-radius: 11px;
  background: #fff3e8;
  color: #ff7d00;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.figma-env__reference-warning .el-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  font-size: 14px;
}

.figma-env__reference-stats {
  display: flex;
  width: 100%;
  height: 71.75px;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 10.5px;
  padding-top: 14px;
}

.figma-env__reference-stat {
  display: flex;
  height: 57.75px;
  box-sizing: border-box;
  align-items: center;
  gap: 8.75px;
  padding: 8.75px 14px;
  border: 1px solid transparent;
  border-radius: 11px;
}

.figma-env__reference-stat > .el-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  font-size: 16px;
}

.figma-env__reference-stat > div {
  display: flex;
  min-width: 37.5px;
  flex-direction: column;
  align-items: flex-start;
}

.figma-env__reference-stat strong {
  font-size: 20px;
  font-weight: 700;
  line-height: 20px;
}

.figma-env__reference-stat span {
  padding-top: 1.75px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  white-space: nowrap;
}

.figma-env__reference-stat.is-api-scenario { border-color: rgba(255, 125, 0, 0.14); background: #fff3e8; color: #ff7d00; }
.figma-env__reference-stat.is-api-suite { border-color: rgba(22, 93, 255, 0.14); background: #e8f3ff; color: #165dff; }
.figma-env__reference-stat.is-web-ui { border-color: rgba(15, 198, 194, 0.14); background: #e8fffe; color: #0fc6c2; }
.figma-env__reference-stat.is-scheduled { border-color: rgba(120, 22, 255, 0.14); background: #f5e8ff; color: #7816ff; }

.figma-env__reference-table-shell {
  width: 100%;
  height: 266.5px;
  margin-top: 17.5px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  background: #fff;
}

.figma-env__reference-table-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.figma-env__reference-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed;
}

.figma-env__reference-table col:nth-child(1) { width: 12%; }
.figma-env__reference-table col:nth-child(2) { width: 52%; }
.figma-env__reference-table col:nth-child(3) { width: 18%; }
.figma-env__reference-table col:nth-child(4) { width: 10%; }
.figma-env__reference-table col:nth-child(5) { width: 8%; }

.figma-env__reference-table th {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 34.5px;
  box-sizing: border-box;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
  text-align: left;
}

.figma-env__reference-table th:nth-child(4) { text-align: center; }
.figma-env__reference-table th:last-child { text-align: right; }

.figma-env__reference-table td {
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
  vertical-align: middle;
}

.figma-env__reference-table tbody tr:last-child td { border-bottom: 0; }

.figma-env__reference-type {
  display: inline-flex;
  height: 20px;
  box-sizing: border-box;
  align-items: center;
  gap: 3.5px;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  white-space: nowrap;
}

.figma-env__reference-type .el-icon { width: 10px; height: 10px; font-size: 10px; }
.figma-env__reference-type.is-api-scenario { background: #fff3e8; color: #ff7d00; }
.figma-env__reference-type.is-api-suite { background: #e8f3ff; color: #165dff; }
.figma-env__reference-type.is-web-ui { background: #e8fffe; color: #0fc6c2; }
.figma-env__reference-type.is-scheduled { background: #f5e8ff; color: #7816ff; }

.figma-env__reference-name {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-env__reference-time {
  color: #86909c;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.figma-env__reference-status-cell { text-align: center; }
.figma-env__reference-action-cell { text-align: right; }

.figma-env__reference-status {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  white-space: nowrap;
}

.figma-env__reference-status.is-running { color: #165dff; }
.figma-env__reference-status.is-idle,
.figma-env__reference-status.is-unknown { color: #c9cdd4; }
.figma-env__reference-status .el-icon { width: 11px; height: 11px; font-size: 11px; }

.figma-env__reference-action-cell button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.figma-env__reference-action-cell button:hover { color: #0e42d2; }

.figma-env__reference-empty {
  display: flex;
  min-height: 280px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #c9cdd4;
  text-align: center;
}

.figma-env__reference-empty > .el-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  font-size: 40px;
}

.figma-env__reference-empty strong { color: #4e5969; font-size: 14px; font-weight: 500; line-height: 21px; }
.figma-env__reference-empty span { margin-top: 4px; color: #86909c; font-size: 13px; line-height: 19.5px; }
.figma-env__reference-empty.is-loading > .el-icon { animation: figma-env-reference-spin 1s linear infinite; }

@keyframes figma-env-reference-spin {
  to { transform: rotate(360deg); }
}

@keyframes figma-env-pulse {
  from { opacity: .55; }
  to { opacity: 1; }
}

@media (max-width: 1300px) {
  .figma-env__detail-description > span:first-child { max-width: 220px; }
  .figma-env__metric { display: none; }
}
</style>
