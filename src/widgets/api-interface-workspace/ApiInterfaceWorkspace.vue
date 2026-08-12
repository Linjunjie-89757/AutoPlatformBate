<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

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
import ApiAutomationSettingsPlaceholder from './ApiAutomationSettingsPlaceholder.vue'
import ApiDefinitionWorkspaceModule from './ApiDefinitionWorkspaceModule.vue'

type ApiTopTab = 'definitions' | 'scenarios' | 'execution' | 'settings'

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

const activeTopTab = computed<ApiTopTab>(() => props.activeSection || 'definitions')
const environments = ref<ApiAutomationEnvironmentItem[]>([])
const variableSets = ref<ApiAutomationVariableSetItem[]>([])
const runOptionsLoading = ref(false)
const runOptionsErrorMessage = ref('')

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
