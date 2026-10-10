<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Server as Service, Smartphone } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import { type ParamSetItem } from '@/entities/config'
import { parseWebUiVariables } from '@/features/config-param-create-edit'

import ConfigEnvironmentEffectivePanel from './ConfigEnvironmentEffectivePanel.vue'
import ConfigEnvironmentApiPanel from './ConfigEnvironmentApiPanel.vue'
import ConfigEnvironmentDetailHeader from './ConfigEnvironmentDetailHeader.vue'
import ConfigEnvironmentDetailTabs from './ConfigEnvironmentDetailTabs.vue'
import ConfigEnvironmentEditorDialogs from './ConfigEnvironmentEditorDialogs.vue'
import ConfigEnvironmentMockPanel from './ConfigEnvironmentMockPanel.vue'
import ConfigEnvironmentMockDialogs from './ConfigEnvironmentMockDialogs.vue'
import ConfigEnvironmentReferencesPanel from './ConfigEnvironmentReferencesPanel.vue'
import ConfigEnvironmentSidebar from './ConfigEnvironmentSidebar.vue'
import ConfigEnvironmentVariableDialogs from './ConfigEnvironmentVariableDialogs.vue'
import ConfigEnvironmentVariablesPanel from './ConfigEnvironmentVariablesPanel.vue'
import {
  buildEffectiveVariables,
  buildReferenceRows,
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

const activeTab = ref<EnvironmentDetailTab>('basic')
const keyword = ref('')
const savedFormSnapshot = ref('')
const effectiveSourceFilter = ref<'all' | EffectiveVariableSourceType>('all')
const effectiveKeyword = ref('')

const {
  closeEnvironmentDialog,
  copyEnvironment,
  createEnvironment,
  disableDialogVisible,
  environmentDialogMode,
  environmentDialogSubmitted,
  environmentEditor,
  envs,
  errorMessage,
  fieldErrors,
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
const localVariableTypeOptions: LocalVariableEditorForm['valueType'][] = ['string', 'integer', 'boolean', 'secret']

const selectedStage = computed(() => environmentStageMeta[form.envType] || environmentStageMeta.TEST)
const lastUpdatedText = computed(() => {
  const item = selectedEnv.value
  if (!item?.updatedAt) return '暂无更新时间'
  return `${item.updatedAt}${item.updatedBy ? ` · ${item.updatedBy}` : ''}`
})
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
const isDirty = computed(() => savedFormSnapshot.value !== JSON.stringify(form))
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

async function discardChanges() {
  if (!selectedEnv.value) return
  await selectEnv(selectedEnv.value, activeTab.value)
}

const {
  serviceDialogVisible,
  serviceEditingIndex,
  serviceEditor,
  resetServiceTests,
  closeServiceDialog,
  submitService,
  testConnection,
} = useConfigEnvironmentServiceActions(form, saveCurrentForm)

setEnvironmentSelectedHandler(() => {
  savedFormSnapshot.value = JSON.stringify(form)
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
  if (tab === 'basic') return '基础信息'
  if (tab === 'api') return 'API'
  if (tab === 'webui') return 'Web UI'
  if (tab === 'app') return 'APP'
  if (tab === 'variables') return `变量绑定${form.variableSetIds.length ? ` ${form.variableSetIds.length}` : ''}`
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
  basic: tabLabel('basic'),
  api: tabLabel('api'),
  webui: tabLabel('webui'),
  app: tabLabel('app'),
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
      :environment-count="envs.length"
      :keyword="keyword"
      :loading="loading"
      :error-message="errorMessage"
      :card-summary="environmentCardSummary"
      @update:keyword="keyword = $event"
      @create="createEnvironment"
      @select="selectEnv"
      @remove="selectEnv($event).then(() => removeEnvironment())"
      @retry="loadData()"
    />

    <main v-if="selectedEnv" class="figma-env__detail" data-node-id="311:3923">
      <ConfigEnvironmentDetailHeader
        :environment-name="form.envName"
        :environment-identifier="form.identifier"
        :description="form.description"
        :stage="selectedStage"
        :enabled="selectedEnv.status === 1"
        :is-production="form.isProd"
        :dirty="isDirty"
        :operating="operating"
        :saving="saving"
        :save-disabled="!isDirty"
        @copy="copyEnvironment"
        @switch-status="switchStatus"
        @save="saveCurrentForm('环境配置已保存')"
      />

      <ConfigEnvironmentDetailTabs :active-tab="activeTab" :labels="detailTabLabels" @select="selectDetailTab" />

      <div class="figma-env__detail-content">
      <section v-if="activeTab === 'basic'" class="figma-env__basic-panel">
        <div class="figma-env__config-card"><header><div><h3>基础信息</h3><p>用于识别和说明当前测试环境</p></div></header><div class="figma-env__basic-grid"><label class="figma-env__field" :class="{ 'has-error': fieldErrors.envName }"><span>环境名称 <b>*</b></span><input v-model="form.envName" :aria-invalid="Boolean(fieldErrors.envName)"><small v-if="fieldErrors.envName" class="figma-env__field-error">{{ fieldErrors.envName }}</small></label><label class="figma-env__field" :class="{ 'has-error': fieldErrors.identifier }"><span>环境标识符 <small>系统内部识别，不作为变量引用</small></span><input v-model="form.identifier" class="is-mono" :aria-invalid="Boolean(fieldErrors.identifier)" placeholder="例：test-env"><small v-if="fieldErrors.identifier" class="figma-env__field-error">{{ fieldErrors.identifier }}</small></label><label class="figma-env__field figma-env__field--wide"><span>描述</span><input v-model="form.description" placeholder="说明该环境的用途和范围"></label></div><div class="figma-env__basic-stage"><span>环境阶段</span><div class="figma-env__stage-options"><button v-for="option in environmentStageOptions" :key="option.value" type="button" :class="{ 'is-selected': form.envType === option.value }" @click="form.envType = option.value">{{ option.label }}</button></div></div></div>
        <div class="figma-env__config-card"><header><div><h3>环境属性</h3></div></header><div class="figma-env__property-list"><div class="figma-env__property-row"><div><strong>标记为生产环境</strong><small>保存时将弹出额外确认；建议仅对直连线上系统的环境开启</small></div><button type="button" class="figma-env__mini-switch" :class="{ 'is-on': form.isProd }" :aria-label="form.isProd ? '取消生产环境标记' : '标记为生产环境'" @click="form.isProd = !form.isProd"><i /></button></div><div class="figma-env__property-row"><div><strong>启用环境</strong><small>停用后该环境不可被测试任务选择</small></div><button type="button" class="figma-env__mini-switch" :class="{ 'is-on': form.status === 1 }" :aria-label="form.status === 1 ? '停用环境' : '启用环境'" @click="void switchStatus()"><i /></button></div></div></div>
        <div class="figma-env__updated"><span>最后更新：{{ lastUpdatedText }}</span></div>
      </section>
      <ConfigEnvironmentApiPanel v-else-if="activeTab === 'api'" v-model="form.apiConfig" :base-url-error="fieldErrors.apiBaseUrl" />
      <section v-else-if="activeTab === 'webui'" class="figma-env__webui-panel"><div class="figma-env__config-card"><header><div><h3>Web UI 连接参数</h3></div></header><div class="figma-env__basic-grid"><label class="figma-env__field figma-env__field--wide"><span>入口 URL <b>*</b><small>浏览器测试的起始页面地址</small></span><input :value="form.webUIConfig?.entryUrl || ''" class="is-mono" placeholder="https://app.example.com" @input="form.webUIConfig = { ...(form.webUIConfig || { pageLoadTimeout: 30000, enabled: true }), entryUrl: ($event.target as HTMLInputElement).value }"></label><label class="figma-env__field"><span>页面加载超时 (ms)</span><input :value="form.webUIConfig?.pageLoadTimeout || 30000" type="number" @input="form.webUIConfig = { ...(form.webUIConfig || { entryUrl: '', enabled: true }), pageLoadTimeout: Number(($event.target as HTMLInputElement).value) || 30000 }"></label></div><div class="figma-env__webui-enabled"><div><strong>启用 Web UI 配置</strong><small>停用后 Web UI 测试任务不可选择此环境</small></div><button type="button" class="figma-env__mini-switch" :class="{ 'is-on': form.webUIConfig?.enabled !== false }" :aria-label="form.webUIConfig?.enabled !== false ? '停用 Web UI 配置' : '启用 Web UI 配置'" @click="form.webUIConfig = { ...(form.webUIConfig || { entryUrl: '', pageLoadTimeout: 30000, enabled: true }), enabled: form.webUIConfig?.enabled === false }"><i /></button></div></div><div v-if="!form.webUIConfig?.entryUrl" class="figma-env__info-banner">填写入口 URL 后，Web UI 测试任务才能在此环境中执行。</div></section>
      <section v-else-if="activeTab === 'app'" class="figma-env__app-panel"><Smartphone :size="40" /><strong>APP 配置待开放</strong><p>APP 自动化环境参数配置功能即将上线，请关注版本更新。</p></section>

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
      </div>

      <footer v-if="isDirty" class="figma-env__save-bar">
        <span>有未保存的修改</span>
        <button type="button" @click="void discardChanges()">放弃修改</button>
        <button class="is-primary" type="button" :disabled="saving" @click="void saveCurrentForm('环境配置已保存')">保存配置</button>
      </footer>
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
      :disable-visible="disableDialogVisible"
      :running-references="runningReferences"
      :reference-count="referenceCount"
      :service-visible="serviceDialogVisible"
      :service-editing-index="serviceEditingIndex"
      :service-editor="serviceEditor"
      :saving="saving"
      :operating="operating"
      :environment-errors="environmentDialogSubmitted ? { envName: !environmentEditor.envName.trim() ? '请输入环境名称' : undefined, identifier: environmentEditor.identifier.trim() && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(environmentEditor.identifier.trim()) ? '仅支持字母开头，以及字母、数字、下划线和连字符' : undefined } : undefined"
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
