<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue'
import {
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
} from '@lucide/vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'
import ConfigRunnerDownloadDrawer from './ConfigRunnerDownloadDrawer.vue'
import ConfigRunnerEditorDrawer from './ConfigRunnerEditorDrawer.vue'
import ConfigRunnerNodeDetailDrawer from './ConfigRunnerNodeDetailDrawer.vue'
import ConfigRunnerNodeTable from './ConfigRunnerNodeTable.vue'
import ConfigRunnerTaskDetailDrawer from './ConfigRunnerTaskDetailDrawer.vue'
import { useConfigRunnerManagement } from './useConfigRunnerManagement'

const {
  runners,
  loading,
  scanning,
  errorMessage,
  guideVisible,
  runnerReleaseLoading,
  runnerReleaseErrorMessage,
  taskDetailVisible,
  taskDetailLoading,
  taskDetailErrorMessage,
  selectedTaskDetail,
  runnerDetailVisible,
  selectedRunner,
  runnerEditorVisible,
  runnerEditorMode,
  runnerEditorTarget,
  runnerDetailTab,
  runnerKeyword,
  runnerStatusFilter,
  runnerEnvFilter,
  runnerStartCommand,
  platformApiBaseUrl,
  runnerReleaseVersion,
  runnerReleaseSize,
  runnerDownloadUrl,
  stats,
  envOptions,
  filteredRunners,
  loadRunners,
  copyRunnerCommand,
  openRunnerGuide,
  copyPlatformAddress,
  refreshRunnerConnection,
  triggerOfflineScan,
  openRunnerDetail,
  openFirstRunnerTask,
  notifyUnsupportedRunnerAction,
  openRunnerEditor,
  openRunnerDelete,
  toggleRunnerStatus,
  openTaskDetail,
  copySelectedTaskRunId,
  copySelectedTaskLogs,
  warningSummaryText,
} = useConfigRunnerManagement()
</script>

<template>
  <section class="config-runner-panel">
    <div class="config-runner-panel__tabs" role="tablist" aria-label="Runner 配置">
      <button class="config-runner-panel__tab is-active" type="button" role="tab" aria-selected="true">
        Runner 节点
      </button>
    </div>

    <div class="config-runner-panel__body">
    <div class="config-runner-panel__stats">
      <article v-for="stat in stats" :key="stat.label" class="config-runner-stat-card">
        <span class="config-runner-stat-card__value" :style="{ color: stat.color, backgroundColor: stat.bg }">
          {{ stat.value }}
        </span>
        <span>{{ stat.label }}</span>
      </article>
    </div>

    <div v-if="errorMessage && runners.length" class="config-runner-panel__inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadRunners">重试</AppButton>
    </div>

      <div class="config-runner-toolbar">
        <div class="config-runner-search">
          <Search :size="12" :stroke-width="1.8" />
          <input v-model="runnerKeyword" type="search" placeholder="搜索节点名称或 IP">
        </div>
        <select v-model="runnerStatusFilter" class="config-runner-filter" aria-label="状态筛选">
          <option value="">全部状态</option>
          <option value="online">在线</option>
          <option value="busy">忙碌</option>
          <option value="offline">离线</option>
          <option value="disabled">已禁用</option>
        </select>
        <select v-model="runnerEnvFilter" class="config-runner-filter" aria-label="环境筛选">
          <option value="">全部环境</option>
          <option v-for="env in envOptions" :key="env" :value="env">{{ env }}</option>
        </select>
        <div class="config-runner-toolbar__spacer" />
        <button type="button" class="config-runner-secondary-button" :disabled="loading" @click="loadRunners">
          <RefreshCw :size="13" :stroke-width="1.8" />
          刷新
        </button>
        <button type="button" class="config-runner-secondary-button" @click="openRunnerGuide">
          <Download :size="13" :stroke-width="1.8" />
          下载 Runner
        </button>
        <button type="button" class="config-runner-secondary-button" :disabled="scanning" @click="triggerOfflineScan">
          <AlertTriangle :size="13" :stroke-width="1.8" />
          离线扫描
        </button>
        <button type="button" class="config-runner-primary-button" @click="openRunnerEditor('create')">
          <img :src="figmaConfigRunnerIcons.action.plus" alt="">
          注册节点
        </button>
      </div>

    <AppLoadingState v-if="loading && !runners.length" text="正在加载本地执行器..." />

    <AppEmptyState
      v-else-if="errorMessage && !runners.length"
      title="本地执行器状态加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadRunners">重试</AppButton>
      </template>
    </AppEmptyState>

      <ConfigRunnerNodeTable
        v-else-if="filteredRunners.length"
        :runners="filteredRunners"
        :warning-text="warningSummaryText()"
        @open-detail="openRunnerDetail"
        @open-first-task="openFirstRunnerTask"
        @edit="runner => openRunnerEditor('edit', runner)"
        @toggle="toggleRunnerStatus"
        @delete="openRunnerDelete"
      />

      <AppEmptyState
        v-else-if="runners.length"
        title="暂无匹配 Runner 节点"
        description="调整搜索关键词或筛选条件后重试。"
      />

    <AppEmptyState
      v-else
      title="暂无本地执行器"
      description="启动本地执行器后，它会自动注册并上报心跳。"
    >
      <template #actions>
        <AppButton :icon="Download" @click="openRunnerGuide">下载并连接 Runner</AppButton>
        <AppButton :icon="RefreshRight" @click="loadRunners">刷新状态</AppButton>
      </template>
      </AppEmptyState>
    </div>

    <ConfigRunnerNodeDetailDrawer
      v-model="runnerDetailVisible"
      v-model:active-tab="runnerDetailTab"
      :runner="selectedRunner"
      @unsupported="notifyUnsupportedRunnerAction"
      @open-first-task="openFirstRunnerTask"
      @open-task-detail="openTaskDetail"
    />

    <ConfigRunnerEditorDrawer
      v-model="runnerEditorVisible"
      :mode="runnerEditorMode"
      :target="runnerEditorTarget"
      @unsupported="notifyUnsupportedRunnerAction"
    />

    <ConfigRunnerDownloadDrawer
      v-model="guideVisible"
      :release-version="runnerReleaseVersion"
      :release-size="runnerReleaseSize"
      :download-url="runnerDownloadUrl"
      :release-loading="runnerReleaseLoading"
      :release-error-message="runnerReleaseErrorMessage"
      :platform-api-base-url="platformApiBaseUrl"
      :runner-start-command="runnerStartCommand"
      :runner-loading="loading"
      @copy-platform-address="copyPlatformAddress"
      @copy-runner-command="copyRunnerCommand"
      @refresh-connection="refreshRunnerConnection"
    />

    <ConfigRunnerTaskDetailDrawer
      v-model="taskDetailVisible"
      :loading="taskDetailLoading"
      :error-message="taskDetailErrorMessage"
      :detail="selectedTaskDetail"
      @copy-run-id="copySelectedTaskRunId"
      @copy-logs="copySelectedTaskLogs"
    />
  </section>
</template>

<style scoped src="./config-runner-panel.css"></style>
