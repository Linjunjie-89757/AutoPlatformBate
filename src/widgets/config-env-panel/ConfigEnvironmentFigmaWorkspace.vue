<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Server as Service } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import { type ParamSetItem } from '@/entities/config'
import { type ConfigAutomationType } from '@/features/config-env-create-edit'
import { parseWebUiVariables } from '@/features/config-param-create-edit'

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
  LocalVariableEditorForm,
  ReferenceKind,
  ReferenceViewItem,
} from './configEnvironmentPanel.types'
import { useConfigEnvironmentServiceActions } from './useConfigEnvironmentServiceActions'
import { useConfigEnvironmentVariableActions } from './useConfigEnvironmentVariableActions'
import { useConfigEnvironmentMockActions } from './useConfigEnvironmentMockActions'
import { useConfigEnvironmentManagement } from './useConfigEnvironmentManagement'

const props = withDefaults(defineProps<{ workspaceCode?: string }>(), { workspaceCode: 'ALL' })
const route = useRoute()
const router = useRouter()

const activeTab = ref<EnvironmentDetailTab>('services')
const keyword = ref('')
const effectiveSourceFilter = ref<'all' | EffectiveVariableSourceType>('all')
const effectiveKeyword = ref('')

const {
  closeEnvironmentDialog,
  copyEnvironment,
  createEnvironment,
  disableDialogVisible,
  editEnvironment,
  environmentDialogMode,
  environmentEditor,
  envs,
  errorMessage,
  form,
  loadData,
  loading,
  loadVariableSetVersions,
  mockApplications,
  mockEndpointCount,
  mockReferenceCount,
  mockReleases,
  mockScenarioCount,
  mockUnmatched24hCount,
  operating,
  referenceLoading,
  referenceSummary,
  removeEnvironment,
  saveCurrentForm,
  saving,
  selectedEnv,
  selectedEnvId,
  selectEnv,
  setEnvironmentSelectedHandler,
  submitEnvironment,
  submitStatusChange,
  switchStatus,
  variableSets,
  variableSetVersions,
} = useConfigEnvironmentManagement({
  workspaceCode: () => props.workspaceCode,
  activeTab,
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

setEnvironmentSelectedHandler(() => {
  effectiveSourceFilter.value = 'all'
  effectiveKeyword.value = ''
  resetServiceTests()
})

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
