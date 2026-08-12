<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Server as Service } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  configApi,
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
  type ConfigAutomationType,
  type ConfigEnvForm,
  validateConfigEnvForm,
} from '@/features/config-env-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { parseWebUiVariables } from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'

import ConfigEnvironmentEffectivePanel from './ConfigEnvironmentEffectivePanel.vue'
import ConfigEnvironmentDetailHeader from './ConfigEnvironmentDetailHeader.vue'
import ConfigEnvironmentDetailTabs from './ConfigEnvironmentDetailTabs.vue'
import ConfigEnvironmentEditorDialogs from './ConfigEnvironmentEditorDialogs.vue'
import ConfigEnvironmentMockPanel from './ConfigEnvironmentMockPanel.vue'
import ConfigEnvironmentMockDialogs from './ConfigEnvironmentMockDialogs.vue'
import ConfigEnvironmentReferencesPanel from './ConfigEnvironmentReferencesPanel.vue'
import ConfigEnvironmentServicesPanel from './ConfigEnvironmentServicesPanel.vue'
import ConfigEnvironmentSidebar from './ConfigEnvironmentSidebar.vue'
import ConfigEnvironmentVariableDialogs from './ConfigEnvironmentVariableDialogs.vue'
import ConfigEnvironmentVariablesPanel from './ConfigEnvironmentVariablesPanel.vue'
import {
  buildEffectiveVariables,
  buildReferenceRows,
  calculateConfigIssues,
  environmentCardSummary,
  environmentStageMeta,
  variableSetHasSensitive,
  variableSetScopeLabel,
} from './configEnvironmentPanel.view'
import type {
  EffectiveVariableRow,
  EffectiveVariableSourceType,
  EnvironmentDetailTab,
  EnvironmentEditorForm,
  LocalVariableEditorForm,
  ReferenceKind,
  ReferenceViewItem,
} from './configEnvironmentPanel.types'
import { useConfigEnvironmentServiceActions } from './useConfigEnvironmentServiceActions'
import { useConfigEnvironmentVariableActions } from './useConfigEnvironmentVariableActions'
import { useConfigEnvironmentMockActions } from './useConfigEnvironmentMockActions'

const props = withDefaults(defineProps<{ workspaceCode?: string }>(), { workspaceCode: 'ALL' })
const route = useRoute()
const router = useRouter()

const envs = ref<EnvConfigItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const mockReleases = ref<MockReleaseItem[]>([])
const selectedEnvId = ref<number | null>(null)
const activeTab = ref<EnvironmentDetailTab>('services')
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const environmentDialogMode = ref<'create' | 'edit' | null>(null)
const disableDialogVisible = ref(false)
const variableSetVersions = ref<Record<number, number | null>>({})
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
const selectedStage = computed(() => environmentStageMeta[form.envType] || environmentStageMeta.TEST)
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
  const runtime = item as typeof item & { running?: boolean; status?: string | null; executionStatus?: string | null }
  const status = String(runtime.executionStatus || runtime.status || '').toUpperCase()
  return runtime.running === true || status === 'RUNNING' || status === 'EXECUTING' || status === 'IN_PROGRESS'
}))
const referenceRows = computed<ReferenceViewItem[]>(() => buildReferenceRows(referenceSummary.value?.items || []))
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
const mockBaseUrl = computed(() => selectedMockApplication.value ? `/api/mock/${selectedMockApplication.value.appCode}` : '—')
const effectiveVariables = computed<EffectiveVariableRow[]>(() => buildEffectiveVariables(form, variableSets.value, selectedVariableSets.value))
const filteredEffectiveVariables = computed(() => {
  const query = effectiveKeyword.value.trim().toLowerCase()
  return effectiveVariables.value.filter(item => (
    (effectiveSourceFilter.value === 'all' || item.sourceType === effectiveSourceFilter.value)
    && (!query || item.name.toLowerCase().includes(query))
  ))
})

function variableSetVersionLabel(item: ParamSetItem) {
  const version = variableSetVersions.value[item.id]
  return version ? `v${version}` : 'v—'
}

function isVariableSetEnabled(item: ParamSetItem) {
  return !form.disabledVariableSetIds.includes(item.id)
}

async function loadData(preferredId = selectedEnvId.value, preferredTab?: EnvironmentDetailTab) {
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

async function selectEnv(env: EnvConfigItem, preferredTab: EnvironmentDetailTab = 'services') {
  selectedEnvId.value = env.id
  Object.assign(form, createConfigEnvFormFromItem(env))
  activeTab.value = preferredTab
  effectiveSourceFilter.value = 'all'
  effectiveKeyword.value = ''
  resetServiceTests()
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

const {
  serviceDialogVisible,
  serviceEditingIndex,
  serviceEditor,
  resetServiceTests,
  openAddService,
  openEditService,
  closeServiceDialog,
  submitService,
  copyService,
  removeService,
  testConnection,
  batchTestConnections,
  serviceStatus,
  formatTimeout,
} = useConfigEnvironmentServiceActions(form, saveCurrentForm)

const {
  bindVariableSetVisible,
  bindVariableSetSelection,
  priorityDialogVisible,
  priorityDraft,
  localVariableDialogMode,
  deleteLocalVariableIndex,
  localVariableEditor,
  openBindVariableSetDialog,
  toggleVariableSetSelection,
  bindSelectedVariableSets,
  openPriorityDialog,
  movePriorityDraft,
  saveVariableSetPriority,
  moveBoundVariableSet,
  toggleVariableSetEnabled,
  unbindVariableSet,
  openLocalVariableDialog,
  closeLocalVariableDialog,
  syncLocalVariableType,
  submitLocalVariable,
  toggleLocalVariable,
  requestDeleteLocalVariable,
  confirmDeleteLocalVariable,
} = useConfigEnvironmentVariableActions(
  form,
  saveCurrentForm,
  loadVariableSetVersions,
  isVariableSetEnabled,
)

const {
  mockBindDialogVisible,
  mockBindApplicationId,
  mockBindReleaseId,
  mockBindReleases,
  mockVersionDialogVisible,
  mockVersionSelection,
  mockUnbindDialogVisible,
  productionEnvironment,
  mockBound,
  mockVersionOptions,
  selectedMockVersionOption,
  openMockBindDialog,
  changeMockBindApplication,
  confirmMockBinding,
  toggleMockEnabled,
  openMockVersionDialog,
  confirmMockVersionSwitch,
  confirmMockUnbind,
} = useConfigEnvironmentMockActions(
  () => props.workspaceCode,
  form,
  mockApplications,
  mockReleases,
  saveCurrentForm,
)

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

function tabLabel(tab: EnvironmentDetailTab) {
  if (tab === 'services') return `服务配置 (${form.services.filter(item => item.baseUrl).length})`
  if (tab === 'variables') return `变量配置 (${variableCount.value})`
  if (tab === 'mock') return mockBound.value ? 'Mock 已启用' : 'Mock 配置'
  if (tab === 'effective') return '最终生效预览'
  return `引用分析 (${referenceCount.value})`
}

function selectDetailTab(tab: EnvironmentDetailTab) {
  activeTab.value = tab
  if (tab === 'variables') void loadVariableSetVersions()
}

onMounted(() => void loadData())
watch(() => props.workspaceCode, () => void loadData(null))

const detailTabLabels = computed<Record<EnvironmentDetailTab, string>>(() => ({
  services: tabLabel('services'),
  variables: tabLabel('variables'),
  mock: tabLabel('mock'),
  effective: tabLabel('effective'),
  references: tabLabel('references'),
}))
</script>

<template>
  <section class="figma-env" data-node-id="311:3773">
    <ConfigEnvironmentSidebar
      :environments="filteredEnvs"
      :selected-environment-id="selectedEnvId"
      :keyword="keyword"
      :loading="loading"
      :card-summary="environmentCardSummary"
      @update:keyword="keyword = $event"
      @create="createEnvironment"
      @select="selectEnv"
    />

    <main v-if="selectedEnv" class="figma-env__detail" data-node-id="311:3923">
      <ConfigEnvironmentDetailHeader
        :environment-name="form.envName"
        :description="form.description"
        :stage="selectedStage"
        :application-label="applicationLabel"
        :config-complete="configComplete"
        :config-issue-count="configIssueCount"
        :service-count="form.services.filter(item => item.baseUrl).length"
        :variable-set-count="form.variableSetIds.length"
        :reference-count="referenceCount"
        :enabled="selectedEnv.status === 1"
        :operating="operating"
        @copy="copyEnvironment"
        @edit="editEnvironment"
        @switch-status="switchStatus"
        @remove="removeEnvironment"
      />

      <ConfigEnvironmentDetailTabs :active-tab="activeTab" :labels="detailTabLabels" @select="selectDetailTab" />

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
