<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type {
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import ApiExecutionSuiteFigmaWorkspace from '@/widgets/api-execution-workspace/ApiExecutionSuiteFigmaWorkspace.vue'
import { ApiInterfaceWorkspace } from '@/widgets/api-interface-workspace'
import ApiScenarioFigmaWorkspace from '@/widgets/api-scenario-workspace/ApiScenarioFigmaWorkspace.vue'

type ApiAutomationSection = 'definitions' | 'scenarios' | 'execution' | 'reports' | 'settings'

const route = useRoute()
const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceReady = ref(false)
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const activeSection = computed<ApiAutomationSection>(() => {
  if (route.path.endsWith('/scenarios')) return 'scenarios'
  if (route.path.endsWith('/execution-suites')) return 'execution'
  if (route.path.endsWith('/reports')) return 'reports'
  if (route.path.endsWith('/settings')) return 'settings'
  return 'definitions'
})

function isKnownWorkspaceCode(workspaceCode: string, items: WorkspaceItem[]) {
  return workspaceCode === 'ALL' || items.some(item => item.workspaceCode === workspaceCode)
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (selectedWorkspaceCode.value && isKnownWorkspaceCode(selectedWorkspaceCode.value, items)) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceReady.value = false
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    setSelectedWorkspaceCode(workspaceCode.value)
  } catch {
    workspaceCode.value = 'ALL'
  } finally {
    workspaceReady.value = true
  }
}

function handleWorkspaceDataLoaded(
  _payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] },
) {}

onMounted(() => {
  void loadWorkspaces()
})

watch(selectedWorkspaceCode, (value) => {
  if (!workspaceReady.value || !value || value === workspaceCode.value || !isKnownWorkspaceCode(value, workspaces.value)) {
    return
  }

  workspaceCode.value = value
})
</script>

<template>
  <AppPage
    class="api-automation-app-page"
    title="接口自动化"
    description="管理接口、场景、执行套件、报告和设置。"
    fill
  >
    <div class="api-automation-page">
      <ApiScenarioFigmaWorkspace
        v-if="activeSection === 'scenarios'"
        :workspace-code="workspaceCode"
      />
      <ApiExecutionSuiteFigmaWorkspace
        v-else-if="activeSection === 'execution'"
        :workspace-code="workspaceCode"
      />
      <ApiInterfaceWorkspace
        v-else
        :active-section="activeSection"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        :workspaces="workspaces"
        @loaded="handleWorkspaceDataLoaded"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.api-automation-app-page {
  height: calc(100dvh - 86px);
  min-height: calc(100dvh - 86px);
  overflow: hidden;
}

.api-automation-page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
</style>

