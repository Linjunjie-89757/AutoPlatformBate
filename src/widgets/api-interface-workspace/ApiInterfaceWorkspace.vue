<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  apiAutomationApi,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import type { WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { ApiExecutionWorkspace } from '@/widgets/api-execution-workspace'
import { ApiScenarioWorkspace } from '@/widgets/api-scenario-workspace'
import ApiAutomationSettingsPlaceholder from './ApiAutomationSettingsPlaceholder.vue'
import ApiDefinitionWorkspaceModule from './ApiDefinitionWorkspaceModule.vue'
import ApiReportModule from './ApiReportModule.vue'

type ApiTopTab = 'definitions' | 'scenarios' | 'execution' | 'reports' | 'settings'

const props = defineProps<{
  activeSection?: ApiTopTab
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
  canExport?: boolean
}>()

const emit = defineEmits<{
  loaded: [payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] }]
}>()

const route = useRoute()
const activeTopTab = computed<ApiTopTab>(() => props.activeSection || 'definitions')
const environments = ref<ApiAutomationEnvironmentItem[]>([])
const variableSets = ref<ApiAutomationVariableSetItem[]>([])
const runOptionsLoading = ref(false)
const runOptionsErrorMessage = ref('')

function firstRouteQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }
  return typeof value === 'string' ? value : null
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(value?: number | null) {
  if (value === null || value === undefined) return '-'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(2)}s`
}

function formatResponseSize(value?: number | null) {
  if (value === null || value === undefined) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function runResultLabel(result?: string | null) {
  switch ((result || '').toUpperCase()) {
    case 'PASSED':
    case 'SUCCESS':
      return '通过'
    case 'FAILED':
      return '失败'
    case 'ERROR':
      return '异常'
    case 'SKIPPED':
      return '跳过'
    default:
      return '未执行'
  }
}

function runResultClass(result?: string | null) {
  switch ((result || '').toUpperCase()) {
    case 'PASSED':
    case 'SUCCESS':
      return 'is-success'
    case 'FAILED':
    case 'ERROR':
      return 'is-danger'
    case 'SKIPPED':
      return 'is-warning'
    default:
      return 'is-muted'
  }
}

async function loadRunOptions() {
  if (!props.workspaceReady) {
    environments.value = []
    variableSets.value = []
    runOptionsErrorMessage.value = ''
    return
  }

  runOptionsLoading.value = true
  runOptionsErrorMessage.value = ''
  try {
    const [environmentPage, variableSetPage] = await Promise.all([
      apiAutomationApi.getEnvironments(props.workspaceCode),
      apiAutomationApi.getVariableSets(props.workspaceCode),
    ])
    environments.value = environmentPage.items
    variableSets.value = variableSetPage.items
  } catch (error) {
    runOptionsErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    runOptionsLoading.value = false
  }
}

watch(
  () => [props.workspaceCode, props.workspaceReady] as const,
  () => {
    void loadRunOptions()
  },
)

onMounted(() => {
  void loadRunOptions()
})
</script>

<template>
  <section class="api-interface-workspace">
    <ApiDefinitionWorkspaceModule
      v-if="activeTopTab === 'definitions'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :workspaces="props.workspaces"
      :environments="environments"
      :variable-sets="variableSets"
      :run-options-loading="runOptionsLoading"
      :run-options-error-message="runOptionsErrorMessage"
      :can-create="props.canCreate"
      :can-edit="props.canEdit"
      :can-delete="props.canDelete"
      :can-execute="props.canExecute"
      :can-export="props.canExport"
      @loaded="payload => emit('loaded', payload)"
    />

    <ApiScenarioWorkspace
      v-else-if="activeTopTab === 'scenarios'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :workspaces="props.workspaces"
      :environments="environments"
      :variable-sets="variableSets"
    />

    <ApiExecutionWorkspace
      v-else-if="activeTopTab === 'execution'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :workspaces="props.workspaces"
      :environments="environments"
      :variable-sets="variableSets"
    />

    <ApiReportModule
      v-else-if="activeTopTab === 'reports'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :report-key="firstRouteQueryValue(route.query.reportKey)"
      :format-date-time="formatDateTime"
      :format-duration="formatDuration"
      :format-response-size="formatResponseSize"
      :run-result-class="runResultClass"
      :run-result-label="runResultLabel"
    />

    <ApiAutomationSettingsPlaceholder v-else-if="activeTopTab === 'settings'" />
  </section>
</template>

<style scoped>
.api-interface-workspace {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
</style>
