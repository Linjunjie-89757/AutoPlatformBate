<script setup lang="ts">
import { RefreshRight, Search } from '@element-plus/icons-vue'

import {
  notificationChannelTypeOptions,
  type NotificationChannelItem,
  type NotificationRecordItem,
  type NotificationRuleItem,
} from '@/entities/config'
import {
  figmaConfigNotificationIcons,
  type FigmaConfigNotificationChannelIcon,
} from '@/shared/assets/figma-icons'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = defineProps<{
  channels: NotificationChannelItem[]
  rules: NotificationRuleItem[]
  records: NotificationRecordItem[]
  loading: boolean
  errorMessage: string
  testingChannelId: number | null
  operatingId: number | null
  stats: {
    total: number
    enabled: number
    failed: number
    rules: number
  }
}>()

const emit = defineEmits<{
  create: []
  retry: []
  test: [channel: NotificationChannelItem]
  edit: [channel: NotificationChannelItem]
  toggle: [channel: NotificationChannelItem]
  remove: [channel: NotificationChannelItem]
}>()

const keyword = defineModel<string>('keyword', { required: true })

function normalizeChannelType(type: string) {
  return type.trim().toUpperCase()
}

function getChannelTypeLabel(channel: NotificationChannelItem) {
  return channel.channelTypeName
    || notificationChannelTypeOptions.find(item => item.value === channel.channelType)?.label
    || channel.channelType
}

function getChannelTypeTone(type: string) {
  const normalized = normalizeChannelType(type)
  if (normalized === 'WECOM_ROBOT') {
    return { color: '#07C160', bg: '#E8FFEA' }
  }
  if (normalized === 'EMAIL' || normalized === 'MAIL') {
    return { color: '#165DFF', bg: '#E8F3FF' }
  }
  return { color: '#8B5CF6', bg: '#F5F0FF' }
}

function getChannelIconKey(type: string): FigmaConfigNotificationChannelIcon {
  const normalized = normalizeChannelType(type)
  if (normalized === 'EMAIL' || normalized === 'MAIL') {
    return 'email'
  }
  if (normalized === 'WEBHOOK') {
    return 'webhook'
  }
  return 'wecom'
}

function getChannelSummary(channel: NotificationChannelItem) {
  return channel.remark || (channel.status === 1 ? '公共通知渠道' : '备用通知渠道')
}

function getChannelStatusMeta(channel: NotificationChannelItem) {
  if (channel.status === 1) {
    return { label: '已启用', color: '#4E5969', dot: '#00B42A' }
  }
  return { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
}

function getChannelRulesCount(channel: NotificationChannelItem) {
  return props.rules.filter(rule => rule.channelIds.includes(channel.id)).length
}

function formatShortTime(value: string | null) {
  return value ? value.replace('T', ' ').slice(0, 16) : ''
}

function getChannelLastSendMeta(channel: NotificationChannelItem) {
  if (props.testingChannelId === channel.id) {
    return { label: '发送中', time: '', color: '#4E5969', dot: '#165DFF' }
  }
  const record = props.records.find(item => item.channelId === channel.id || item.channelName === channel.channelName)
  if (!record) {
    return { label: '暂无近期记录', time: '', color: '#C9CDD4', dot: '' }
  }
  const success = record.sendStatus === 'SUCCESS'
  return {
    label: success ? '成功' : '失败',
    time: formatShortTime(record.sentAt || record.triggeredAt || record.createdAt),
    color: success ? '#4E5969' : '#F53F3F',
    dot: success ? '#00B42A' : '#F53F3F',
  }
}
</script>

<template>
  <div class="notification-summary">
    <div class="notification-summary__item"><span class="notification-summary__value is-default">{{ stats.total }}</span><span class="notification-summary__label">渠道总数</span></div>
    <div class="notification-summary__item"><span class="notification-summary__value is-success">{{ stats.enabled }}</span><span class="notification-summary__label">已启用</span></div>
    <div class="notification-summary__item"><span class="notification-summary__value is-danger">{{ stats.failed }}</span><span class="notification-summary__label">发送异常</span></div>
    <div class="notification-summary__item"><span class="notification-summary__value is-purple">{{ stats.rules }}</span><span class="notification-summary__label">关联规则</span></div>
  </div>

  <div v-if="!errorMessage" class="notification-toolbar">
    <el-input v-model="keyword" class="notification-toolbar__search" clearable placeholder="搜索渠道名称或类型" :prefix-icon="Search" />
    <button type="button" class="notification-primary-button" @click="emit('create')">
      <img :src="figmaConfigNotificationIcons.plus" alt="">
      新增渠道
    </button>
  </div>
  <div v-else-if="channels.length" class="notification-inline-error">
    {{ errorMessage }}
    <button type="button" class="notification-secondary-button" @click="emit('retry')">
      <el-icon><RefreshRight /></el-icon>
      重试
    </button>
  </div>

  <AppLoadingState v-if="loading && !channels.length" text="正在加载通知渠道..." />
  <AppEmptyState v-else-if="!channels.length" title="暂无通知渠道" description="创建企业微信机器人或通用 Webhook 后，可在通知规则中引用。" />
  <div v-else class="notification-table-card notification-table-card--channels" v-loading="loading">
    <table>
      <colgroup>
        <col class="notification-table-card__name-col"><col class="notification-table-card__type-col"><col class="notification-table-card__url-col">
        <col class="notification-table-card__status-col"><col class="notification-table-card__recent-col"><col class="notification-table-card__rules-col"><col class="notification-table-card__action-col">
      </colgroup>
      <thead><tr><th>渠道名称</th><th>类型</th><th>Webhook 地址</th><th>状态</th><th>最近发送</th><th>关联规则</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="channel in channels" :key="channel.id">
          <td>
            <div class="notification-channel-cell">
              <span class="notification-channel-icon" :style="{ color: getChannelTypeTone(channel.channelType).color, backgroundColor: getChannelTypeTone(channel.channelType).bg }">
                <img :src="figmaConfigNotificationIcons.channel[getChannelIconKey(channel.channelType)]" alt="">
              </span>
              <span class="notification-channel-copy"><strong :title="channel.channelName">{{ channel.channelName }}</strong><span :title="getChannelSummary(channel)">{{ getChannelSummary(channel) }}</span></span>
            </div>
          </td>
          <td><span class="notification-type-pill" :style="{ color: getChannelTypeTone(channel.channelType).color, backgroundColor: getChannelTypeTone(channel.channelType).bg }">{{ getChannelTypeLabel(channel) }}</span></td>
          <td><code class="notification-webhook" :title="channel.webhookUrl">{{ channel.webhookUrl }}</code></td>
          <td><span class="notification-status" :style="{ color: getChannelStatusMeta(channel).color }"><span :style="{ backgroundColor: getChannelStatusMeta(channel).dot }" />{{ getChannelStatusMeta(channel).label }}</span></td>
          <td>
            <span v-if="getChannelLastSendMeta(channel).dot" class="notification-status" :style="{ color: getChannelLastSendMeta(channel).color }"><span :style="{ backgroundColor: getChannelLastSendMeta(channel).dot }" />{{ getChannelLastSendMeta(channel).label }}</span>
            <span v-else class="notification-muted-text">{{ getChannelLastSendMeta(channel).label }}</span>
            <small v-if="getChannelLastSendMeta(channel).time" class="notification-time-text">{{ getChannelLastSendMeta(channel).time }}</small>
          </td>
          <td><span class="notification-rule-pill">{{ getChannelRulesCount(channel) }} 条规则</span></td>
          <td>
            <div class="notification-row-actions">
              <button type="button" class="notification-icon-button" aria-label="测试发送" :disabled="testingChannelId === channel.id" @click="emit('test', channel)"><img :src="figmaConfigNotificationIcons.action.send" alt=""></button>
              <button type="button" class="notification-icon-button" aria-label="编辑渠道" @click="emit('edit', channel)"><img :src="figmaConfigNotificationIcons.action.edit" alt=""></button>
              <button type="button" class="notification-icon-button" :aria-label="channel.status === 1 ? '停用渠道' : '启用渠道'" :disabled="operatingId === channel.id" @click="emit('toggle', channel)"><img :src="figmaConfigNotificationIcons.action.power" alt=""></button>
              <button type="button" class="notification-icon-button is-danger" aria-label="删除渠道" :disabled="operatingId === channel.id" @click="emit('remove', channel)"><img :src="figmaConfigNotificationIcons.action.delete" alt=""></button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
