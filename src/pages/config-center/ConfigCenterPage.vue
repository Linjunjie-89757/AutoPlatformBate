<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { ConfigCenterTab } from '@/entities/config'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import ConfigComingSoonPanel from '@/widgets/config-coming-soon-panel/ConfigComingSoonPanel.vue'
import ConfigDbPanel from '@/widgets/config-db-panel/ConfigDbPanel.vue'
import ConfigEnvPanel from '@/widgets/config-env-panel/ConfigEnvPanel.vue'
import ConfigMockPanel from '@/widgets/config-mock-panel/ConfigMockPanel.vue'
import ConfigNotificationPanel from '@/widgets/config-notification-panel/ConfigNotificationPanel.vue'
import ConfigParamPanel from '@/widgets/config-param-panel/ConfigParamPanel.vue'
import ConfigRunnerPanel from '@/widgets/config-runner-panel/ConfigRunnerPanel.vue'
import ConfigSidebar from '@/widgets/config-sidebar/ConfigSidebar.vue'

const activeTab = ref<ConfigCenterTab>('env')
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceErrorMessage = ref('')
const workspaceCode = computed({
  get: () => selectedWorkspaceCode.value,
  set: (value: string) => setSelectedWorkspaceCode(value),
})

const workspaceOptions = computed(() => {
  const options = workspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some((item) => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some((item) => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }
  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    setSelectedWorkspaceCode(resolveDefaultWorkspaceCode(items))
  } catch (error) {
    setSelectedWorkspaceCode(selectedWorkspaceCode.value || 'ALL')
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
  }
}

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <AppPage
    title="配置中心"
    description="管理测试环境、全局参数和数据库连接。当前阶段先迁移配置中心骨架，后续按确认顺序接入接口和操作。"
    fill
  >
    <template #actions>
      <div class="config-workspace-select">
        <span class="config-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceCode"
          class="config-workspace-select__control"
          :disabled="workspaceLoading"
          :loading="workspaceLoading"
          size="default"
        >
          <el-option
            v-for="item in workspaceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="workspaceErrorMessage" class="config-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="config-center-page">
      <ConfigSidebar v-model:active-tab="activeTab" />

      <main class="config-center-page__content">
        <ConfigEnvPanel v-if="activeTab === 'env'" :workspace-code="workspaceCode" />
        <ConfigParamPanel v-else-if="activeTab === 'param'" :workspace-code="workspaceCode" />
        <ConfigMockPanel v-else-if="activeTab === 'mock'" :workspace-code="workspaceCode" />
        <ConfigRunnerPanel v-else-if="activeTab === 'runner'" />
        <ConfigNotificationPanel v-else-if="activeTab === 'notification'" :workspace-code="workspaceCode" />
        <ConfigComingSoonPanel
          v-else-if="activeTab === 'proxy'"
          title="网络代理"
          description="维护全局代理、空间代理和环境代理引用，代理账号密码按敏感字段处理。"
          :items="['代理地址与端口', '敏感账号密码', '环境级代理引用']"
        />
        <ConfigDbPanel v-else-if="activeTab === 'dbConnection'" :workspace-code="workspaceCode" />
      </main>
    </div>
  </AppPage>
</template>

<style scoped>
.config-center-page {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  gap: var(--app-space-4);
}

.config-center-page__content {
  min-width: 0;
  flex: 1;
  min-height: 0;
  padding: var(--app-space-5);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-elevated);
  box-shadow: var(--app-shadow-panel);
}

.config-workspace-select {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.config-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.config-workspace-select__control {
  width: 180px;
}

.config-workspace-select__error {
  max-width: 180px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .config-center-page {
    flex-direction: column;
  }

  .config-center-page__content {
    width: 100%;
    padding: var(--app-space-4);
  }
}

@media (max-width: 720px) {
  .config-workspace-select {
    flex-wrap: wrap;
  }

  .config-workspace-select__control {
    width: min(240px, 100%);
  }
}
</style>
