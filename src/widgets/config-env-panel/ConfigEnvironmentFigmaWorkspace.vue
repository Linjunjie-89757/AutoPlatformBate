<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AlertTriangle as Warning,
  CheckCircle as CircleCheck,
  Copy as CopyDocument,
  Edit2 as Edit,
  Globe,
  Layers,
  Monitor,
  Plus,
  Power as SwitchButton,
  Search,
  Server as Service,
  Trash2 as Delete,
  Timer,
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

import ConfigEnvironmentEffectivePanel from './ConfigEnvironmentEffectivePanel.vue'
import ConfigEnvironmentEditorDialogs from './ConfigEnvironmentEditorDialogs.vue'
import ConfigEnvironmentMockPanel from './ConfigEnvironmentMockPanel.vue'
import ConfigEnvironmentMockDialogs from './ConfigEnvironmentMockDialogs.vue'
import ConfigEnvironmentReferencesPanel from './ConfigEnvironmentReferencesPanel.vue'
import ConfigEnvironmentServicesPanel from './ConfigEnvironmentServicesPanel.vue'
import ConfigEnvironmentVariableDialogs from './ConfigEnvironmentVariableDialogs.vue'
import ConfigEnvironmentVariablesPanel from './ConfigEnvironmentVariablesPanel.vue'
import type {
  EffectiveVariableRow,
  EffectiveVariableSourceType,
  EnvironmentEditorForm,
  LocalVariableEditorForm,
  ReferenceKind,
  ReferenceViewItem,
  ServiceEditorForm,
  ServiceTestState,
} from './configEnvironmentPanel.types'

type DetailTab = 'services' | 'variables' | 'mock' | 'effective' | 'references'

interface StageMeta {
  label: string
  color: string
  background: string
}

interface RuntimeReferenceState {
  running?: boolean
  status?: string | null
  executionStatus?: string | null
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
    path = '/reports'
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

      <ConfigEnvironmentServicesPanel
        v-if="activeTab === 'services'"
        :services="form.services"
        :default-service-key="form.defaultServiceKey"
        :default-service-count="defaultServiceCount"
        :service-status="serviceStatus"
        :format-timeout="formatTimeout"
        @batch-test="batchTestConnections"
        @add="openAddService"
        @test="testConnection"
        @edit="openEditService"
        @copy="copyService"
        @remove="removeService"
      />

      <ConfigEnvironmentVariablesPanel
        v-else-if="activeTab === 'variables'"
        :variable-sets="selectedVariableSets"
        :local-variables="form.localVariables"
        :scope-label="variableSetScopeLabel"
        :has-sensitive="variableSetHasSensitive"
        :version-label="variableSetVersionLabel"
        :is-enabled="isVariableSetEnabled"
        @adjust-priority="openPriorityDialog"
        @bind="openBindVariableSetDialog"
        @toggle-set="toggleVariableSetEnabled"
        @move-set="moveBoundVariableSet"
        @view-sets="goToVariableSetConfig"
        @unbind="unbindVariableSet"
        @add-local="openLocalVariableDialog()"
        @toggle-local="toggleLocalVariable"
        @edit-local="openLocalVariableDialog"
        @delete-local="requestDeleteLocalVariable"
      />

      <ConfigEnvironmentMockPanel
        v-else-if="activeTab === 'mock'"
        :production-environment="productionEnvironment"
        :mock-bound="mockBound"
        :application="selectedMockApplication"
        :release="selectedMockRelease"
        :version-option-count="mockVersionOptions.length"
        :mock-enabled="form.mockEnabled"
        :mock-base-url="mockBaseUrl"
        :endpoint-count="mockEndpointCount"
        :scenario-count="mockScenarioCount"
        :unmatched24h-count="mockUnmatched24hCount"
        @switch-version="openMockVersionDialog"
        @unbind="mockUnbindDialogVisible = true"
        @toggle-enabled="toggleMockEnabled"
        @view-mock="goToMockService"
        @bind="openMockBindDialog"
      />

      <ConfigEnvironmentEffectivePanel
        v-else-if="activeTab === 'effective'"
        :variables="effectiveVariables"
        :filtered-variables="filteredEffectiveVariables"
        :source-filter="effectiveSourceFilter"
        :keyword="effectiveKeyword"
        @update:source-filter="effectiveSourceFilter = $event"
        @update:keyword="effectiveKeyword = $event"
      />

      <ConfigEnvironmentReferencesPanel
        v-else
        :running-count="runningReferences.length"
        :loading="referenceLoading"
        :rows="referenceRows"
        :stats="referenceStats"
        :sampled="referenceListIsSampled"
        @view="viewReference"
      />
    </main>

    <div v-else class="figma-env__detail figma-env__no-selection">
      <el-icon><Service /></el-icon><strong>{{ errorMessage || '暂无环境配置' }}</strong><p>新建环境后，可以继续添加服务地址。</p>
    </div>

    <ConfigEnvironmentVariableDialogs
      :bind-visible="bindVariableSetVisible"
      :selected-set-count="selectedVariableSets.length"
      :available-sets="availableVariableSets"
      :bind-selection="bindVariableSetSelection"
      :priority-visible="priorityDialogVisible"
      :priority-sets="priorityPreviewSets"
      :conflicts="variableSetConflicts"
      :local-mode="localVariableDialogMode"
      :local-editor="localVariableEditor"
      :local-type-options="localVariableTypeOptions"
      :delete-variable="deleteLocalVariable"
      :saving="saving"
      :scope-label="variableSetScopeLabel"
      :has-sensitive="variableSetHasSensitive"
      :version-label="variableSetVersionLabel"
      @close-bind="bindVariableSetVisible = false"
      @toggle-set="toggleVariableSetSelection"
      @confirm-bind="bindSelectedVariableSets"
      @close-priority="priorityDialogVisible = false"
      @move-priority="movePriorityDraft"
      @save-priority="saveVariableSetPriority"
      @close-local="closeLocalVariableDialog"
      @sync-local-type="syncLocalVariableType"
      @submit-local="submitLocalVariable"
      @close-delete="deleteLocalVariableIndex = null"
      @confirm-delete="confirmDeleteLocalVariable"
    />

    <ConfigEnvironmentMockDialogs
      :bind-visible="mockBindDialogVisible"
      :applications="mockApplications"
      :bind-application-id="mockBindApplicationId"
      :bind-release-id="mockBindReleaseId"
      :bind-releases="mockBindReleases"
      :version-visible="mockVersionDialogVisible"
      :current-release="selectedMockRelease"
      :version-options="mockVersionOptions"
      :version-selection="mockVersionSelection"
      :selected-version-name="selectedMockVersionOption?.releaseName || ''"
      :current-release-id="form.mockReleaseId"
      :unbind-visible="mockUnbindDialogVisible"
      :current-application="selectedMockApplication"
      :reference-count="mockReferenceCount"
      :saving="saving"
      @close-bind="mockBindDialogVisible = false"
      @update:bind-application-id="mockBindApplicationId = $event"
      @update:bind-release-id="mockBindReleaseId = $event"
      @change-application="changeMockBindApplication"
      @confirm-bind="confirmMockBinding"
      @close-version="mockVersionDialogVisible = false"
      @update:version-selection="mockVersionSelection = $event"
      @confirm-version="confirmMockVersionSwitch"
      @close-unbind="mockUnbindDialogVisible = false"
      @confirm-unbind="confirmMockUnbind"
    />

    <ConfigEnvironmentEditorDialogs
      :environment-mode="environmentDialogMode"
      :environment-editor="environmentEditor"
      :stage-options="environmentStageOptions"
      :applicability-options="environmentApplicabilityOptions"
      :disable-visible="disableDialogVisible"
      :running-references="runningReferences"
      :reference-count="referenceCount"
      :service-visible="serviceDialogVisible"
      :service-editing-index="serviceEditingIndex"
      :service-editor="serviceEditor"
      :saving="saving"
      :operating="operating"
      @close-environment="closeEnvironmentDialog"
      @submit-environment="submitEnvironment"
      @close-disable="disableDialogVisible = false"
      @submit-status="submitStatusChange"
      @close-service="closeServiceDialog"
      @test-service="testConnection()"
      @submit-service="submitService"
    />
  </section>
</template>

<style src="./config-environment-figma-workspace.css"></style>
