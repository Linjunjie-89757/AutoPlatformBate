<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { WebUiCaseWorkspace } from '@/widgets/web-ui-case-workspace'
import WebUiCaseDetailWorkspace from '@/widgets/web-ui-case-workspace/WebUiCaseDetailWorkspace.vue'
import WebUiElementCollectTaskWorkspace from '@/widgets/web-ui-case-workspace/WebUiElementCollectTaskWorkspace.vue'
import WebUiElementFigmaLibrary from '@/widgets/web-ui-case-workspace/WebUiElementFigmaLibrary.vue'
import WebUiRunRecordsFigmaPage from '@/widgets/web-ui-case-workspace/WebUiRunRecordsFigmaPage.vue'
import WebUiSuiteFigmaWorkspace from '@/widgets/web-ui-case-workspace/WebUiSuiteFigmaWorkspace.vue'
import WebUiVariableSetDetailPage from '@/widgets/web-ui-case-workspace/WebUiVariableSetDetailPage.vue'
import WebUiVariableSetPanel from '@/widgets/web-ui-case-workspace/WebUiVariableSetPanel.vue'
import { webUiAutomationApi, type WebUiEnvironmentItem } from '@/entities/web-ui-automation'

const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const environments = ref<WebUiEnvironmentItem[]>([])
const workspaceReady = ref(false)
const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()

type WebUiSection = 'cases' | 'caseDetail' | 'elements' | 'suites' | 'collectTask' | 'templates' | 'runs' | 'batches' | 'environments' | 'variables' | 'variableDetail'

const routeSectionMap: Record<string, WebUiSection> = {
  'automation-web-cases': 'cases',
  'automation-web-case-detail': 'caseDetail',
  'automation-web-elements': 'elements',
  'automation-web-suites': 'suites',
  'automation-web-element-collect-task': 'collectTask',
  'automation-web-templates': 'templates',
  'automation-web-runs': 'runs',
  'automation-web-batches': 'batches',
  'automation-web-environments': 'environments',
  'automation-web-variables': 'variables',
  'automation-web-variable-detail': 'variableDetail',
}

const activeSection = computed<WebUiSection>(() => {
  const routeName = typeof route.name === 'string' ? route.name : ''
  return routeSectionMap[routeName] || 'cases'
})
const workspaceMode = computed<'cases' | 'templates' | 'runs' | 'batches' | 'environments'>(() =>
  activeSection.value === 'caseDetail' || activeSection.value === 'elements' || activeSection.value === 'suites' || activeSection.value === 'runs' || activeSection.value === 'collectTask' || activeSection.value === 'variables' || activeSection.value === 'variableDetail'
    ? 'cases'
    : activeSection.value,
)

const pageCopy = computed(() => {
  if (activeSection.value === 'elements') {
    return {
      title: 'Web UI 自动化',
      description: '',
    }
  }
  if (activeSection.value === 'suites') {
    return {
      title: 'Web UI 自动化',
      description: '',
    }
  }
  if (activeSection.value === 'runs') {
    return {
      title: 'Web UI 自动化',
      description: '',
    }
  }
  if (activeSection.value === 'collectTask') {
    return {
      title: 'Web UI AI 采集工作台',
      description: '查看采集任务进度、候选元素、过滤明细、本地验证和入库操作。',
    }
  }
  if (activeSection.value === 'templates') {
    return {
      title: 'Web UI 模板库',
      description: '沉淀登录、查询、表单、审批等常用 Web UI 用例模板。',
    }
  }
  if (activeSection.value === 'batches') {
    return {
      title: 'Web UI 批次报告',
      description: '查看批量运行、CI 触发、批次结果和失败用例摘要。',
    }
  }
  if (activeSection.value === 'environments') {
    return {
      title: 'Web UI 环境配置',
      description: '管理 Web UI 运行环境、默认变量集和环境继承规则。',
    }
  }
  if (activeSection.value === 'variables') {
    return {
      title: 'Web UI 变量集设置',
      description: '维护 Web UI 用例运行、调试、元素验证和智能采集可复用的测试数据。',
    }
  }
  if (activeSection.value === 'variableDetail') {
    return {
      title: 'Web UI 变量集详情',
      description: '查看和维护变量集基础信息、变量列表和 JSON 导入导出。',
    }
  }
  if (activeSection.value === 'caseDetail') {
    return {
      title: 'Web UI 自动化',
      description: '管理 Web UI 自动化用例、步骤和调试运行。',
    }
  }
  return {
    title: 'Web UI 自动化',
    description: '管理 Web UI 自动化用例、步骤和调试运行。',
  }
})

function isKnownWorkspaceCode(workspaceCode: string, items: WorkspaceItem[]) {
  return workspaceCode === 'ALL' || items.some(item => item.workspaceCode === workspaceCode)
}

function firstWritableWorkspaceCode(items: WorkspaceItem[]) {
  return items.find(item => item.workspaceCode !== 'ALL' && !item.allScope)?.workspaceCode || 'ALL'
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (
    selectedWorkspaceCode.value
    && selectedWorkspaceCode.value !== 'ALL'
    && isKnownWorkspaceCode(selectedWorkspaceCode.value, items)
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) =>
    item.workspaceCode !== 'ALL'
    && !item.allScope
    && (item.current || item.isCurrent || item.default || item.isDefault)
  )
  return selected?.workspaceCode || firstWritableWorkspaceCode(items)
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

async function loadEnvironments() {
  if (!workspaceReady.value || activeSection.value !== 'elements') {
    return
  }
  try {
    const page = await webUiAutomationApi.getEnvironments(workspaceCode.value)
    environments.value = page.items
  } catch {
    environments.value = []
  }
}

onMounted(() => {
  void loadWorkspaces()
})

watch(selectedWorkspaceCode, (value) => {
  if (!workspaceReady.value || !value || value === workspaceCode.value || !isKnownWorkspaceCode(value, workspaces.value)) {
    return
  }

  workspaceCode.value = value === 'ALL' ? firstWritableWorkspaceCode(workspaces.value) : value
})

watch(
  () => [workspaceCode.value, workspaceReady.value, activeSection.value] as const,
  () => {
    void loadEnvironments()
  },
  { immediate: true },
)

watch(
  () => [route.path, route.query.tab] as const,
  () => {
    if (!route.path.startsWith('/automation/web')) {
      return
    }

    const tab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
    if (tab !== 'runs' && tab !== 'batches' && tab !== 'environments' && tab !== 'variables') {
      return
    }

    const query = { ...route.query }
    delete query.tab
    void router.replace({
      path: `/automation/web/${tab}`,
      query,
      hash: route.hash,
    })
  },
  { immediate: true },
)
</script>

<template>
  <AppPage
    :title="pageCopy.title"
    :description="pageCopy.description"
    fill
  >
    <div class="web-automation-page">
      <WebUiCaseWorkspace
        v-if="activeSection !== 'caseDetail' && activeSection !== 'elements' && activeSection !== 'suites' && activeSection !== 'runs' && activeSection !== 'collectTask' && activeSection !== 'variables' && activeSection !== 'variableDetail'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        :workspaces="workspaces"
        :mode="workspaceMode"
      />
      <WebUiCaseDetailWorkspace
        v-else-if="activeSection === 'caseDetail'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <WebUiElementFigmaLibrary
        v-else-if="activeSection === 'elements'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        :environments="environments"
      />
      <WebUiSuiteFigmaWorkspace
        v-else-if="activeSection === 'suites'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <WebUiRunRecordsFigmaPage
        v-else-if="activeSection === 'runs'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <WebUiElementCollectTaskWorkspace
        v-else-if="activeSection === 'collectTask'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <WebUiVariableSetPanel
        v-else-if="activeSection === 'variables'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <WebUiVariableSetDetailPage
        v-else-if="activeSection === 'variableDetail'"
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
      />
      <AppEmptyState
        v-else
        title="模板库独立页即将接入"
        description="当前模板能力仍在用例管理里可用，后续会拆成独立二级菜单页面。"
      >
        <template #actions>
          <AppButton type="primary">继续使用用例管理中的模板库</AppButton>
        </template>
      </AppEmptyState>
    </div>
  </AppPage>
</template>

<style scoped>
.web-automation-page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
</style>
