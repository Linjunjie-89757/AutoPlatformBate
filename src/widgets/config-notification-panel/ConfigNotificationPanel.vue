<script setup lang="ts">
import { toRef } from 'vue'

import { figmaConfigNotificationIcons } from '@/shared/assets/figma-icons'
import ConfigNotificationChannelList from './ConfigNotificationChannelList.vue'
import ConfigNotificationOverlays from './ConfigNotificationOverlays.vue'
import ConfigNotificationRecordList from './ConfigNotificationRecordList.vue'
import ConfigNotificationRuleList from './ConfigNotificationRuleList.vue'
import {
  useConfigNotificationManagement,
  type NotificationChannelTypeCard,
  type NotificationPanelTab,
} from './useConfigNotificationManagement'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

interface NotificationInnerTab {
  key: NotificationPanelTab
  label: string
  icon: string
}

interface RuleContentPreviewOption {
  key: string
  title: string
  description: string
  enabled: boolean
}

const notificationTabs: NotificationInnerTab[] = [
  { key: 'channels', label: '通知渠道', icon: figmaConfigNotificationIcons.tab.channel },
  { key: 'rules', label: '通知规则', icon: figmaConfigNotificationIcons.tab.rule },
  { key: 'records', label: '发送历史', icon: figmaConfigNotificationIcons.tab.history },
]

const ruleContentPreviewOptions: RuleContentPreviewOption[] = [
  { key: 'report', title: '包含报告链接', description: '在通知消息中附上测试报告的访问链接', enabled: true },
  { key: 'steps', title: '包含失败步骤', description: '在通知消息中展示前 5 个失败步骤详情', enabled: false },
  { key: 'ai', title: '包含 AI 分析摘要', description: '在通知消息中包含 AI 失败原因分析（需配置 AI 连接）', enabled: false },
]

const channelTypeCards: NotificationChannelTypeCard[] = [
  { value: 'WECOM_ROBOT', label: '企业微信', description: '群机器人', icon: 'wecom', color: '#07C160', bg: '#E8FFEA' },
  { value: 'DINGTALK', label: '钉钉', description: '暂未接入', icon: 'wecom', color: '#FF7D00', bg: '#FFF3E8', disabled: true },
  { value: 'EMAIL', label: '邮件', description: '暂未接入', icon: 'email', color: '#165DFF', bg: '#E8F3FF', disabled: true },
  { value: 'WEBHOOK', label: 'Webhook', description: '自定义推送', icon: 'webhook', color: '#8B5CF6', bg: '#F5F0FF' },
]

const {
  activeTab,
  eventTypes,
  channels,
  rules,
  records,
  recordsTotal,
  recordsPageNo,
  recordsPageSize,
  channelsLoading,
  rulesLoading,
  recordsLoading,
  saving,
  testingChannelDraft,
  testingChannelId,
  operatingId,
  errorMessage,
  channelKeyword,
  ruleKeyword,
  recordKeyword,
  recordStatusFilter,
  channelDialogVisible,
  channelDialogMode,
  channelForm,
  channelSecretVisible,
  channelTestResult,
  ruleDialogVisible,
  ruleDialogMode,
  ruleForm,
  historyDetailVisible,
  selectedHistoryRecord,
  enabledChannels,
  channelStats,
  selectedRuleChannelHint,
  selectTab,
  loadChannels,
  loadRecords,
  openHistoryDetail,
  retryHistoryRecord,
  openCreateChannelDialog,
  openEditChannelDialog,
  selectChannelType,
  toggleChannelFormStatus,
  toggleChannelSecretVisible,
  submitChannel,
  testChannel,
  toggleChannel,
  testChannelFromDrawer,
  removeChannel,
  openCreateRuleDialog,
  openEditRuleDialog,
  toggleRuleFormStatus,
  submitRule,
  toggleRule,
  removeRule,
  duplicateRule,
  onRecordsPageChange,
} = useConfigNotificationManagement(toRef(props, 'workspaceCode'))
</script>

<template>
  <section class="notification-panel">
    <div class="notification-panel__tabs" role="tablist" aria-label="通知配置">
      <button
        v-for="tab in notificationTabs"
        :key="tab.key"
        class="notification-panel__tab"
        :class="{ 'is-active': activeTab === tab.key }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="selectTab(tab.key)"
      >
        <img :src="tab.icon" alt="">
        {{ tab.label }}
      </button>
    </div>

    <div class="notification-panel__body">
      <el-alert
        v-if="errorMessage"
        class="notification-panel__workspace-tip"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />

      <template v-if="activeTab === 'channels'">
        <ConfigNotificationChannelList
          v-model:keyword="channelKeyword"
          :channels="channels"
          :rules="rules"
          :records="records"
          :loading="channelsLoading"
          :error-message="errorMessage"
          :testing-channel-id="testingChannelId"
          :operating-id="operatingId"
          :stats="channelStats"
          @create="openCreateChannelDialog"
          @retry="loadChannels"
          @test="testChannel"
          @edit="openEditChannelDialog"
          @toggle="toggleChannel"
          @remove="removeChannel"
        />
      </template>

      <template v-else-if="activeTab === 'rules'">
        <ConfigNotificationRuleList
          v-model:keyword="ruleKeyword"
          :rules="rules"
          :loading="rulesLoading"
          :operating-id="operatingId"
          @create="openCreateRuleDialog"
          @edit="openEditRuleDialog"
          @duplicate="duplicateRule"
          @toggle="toggleRule"
          @remove="removeRule"
        />
      </template>

      <template v-else>
        <ConfigNotificationRecordList
          v-model:keyword="recordKeyword"
          v-model:status-filter="recordStatusFilter"
          :records="records"
          :channels="channels"
          :loading="recordsLoading"
          :page-no="recordsPageNo"
          :page-size="recordsPageSize"
          :total="recordsTotal"
          @status-change="loadRecords"
          @open="openHistoryDetail"
          @retry="retryHistoryRecord"
          @page-change="onRecordsPageChange"
        />
      </template>
    </div>

    <ConfigNotificationOverlays
      v-model:channel-visible="channelDialogVisible"
      v-model:rule-visible="ruleDialogVisible"
      v-model:history-visible="historyDetailVisible"
      v-model:channel-form="channelForm"
      v-model:rule-form="ruleForm"
      :channel-dialog-mode="channelDialogMode"
      :rule-dialog-mode="ruleDialogMode"
      :channel-type-cards="channelTypeCards"
      :channel-secret-visible="channelSecretVisible"
      :channel-test-result="channelTestResult"
      :testing-channel-draft="testingChannelDraft"
      :saving="saving"
      :event-types="eventTypes"
      :enabled-channels="enabledChannels"
      :channels="channels"
      :selected-rule-channel-hint="selectedRuleChannelHint"
      :rule-content-preview-options="ruleContentPreviewOptions"
      :selected-history-record="selectedHistoryRecord"
      @select-channel-type="selectChannelType"
      @toggle-channel-status="toggleChannelFormStatus"
      @toggle-channel-secret="toggleChannelSecretVisible"
      @test-channel="testChannelFromDrawer"
      @submit-channel="submitChannel"
      @toggle-rule-status="toggleRuleFormStatus"
      @submit-rule="submitRule"
      @retry-history="retryHistoryRecord"
    />

  </section>
</template>

<style src="./config-notification-panel.css"></style>
