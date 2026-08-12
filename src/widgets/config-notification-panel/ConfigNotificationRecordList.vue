<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'

import { notificationSendStatusOptions, type NotificationChannelItem, type NotificationRecordItem } from '@/entities/config'
import { figmaConfigNotificationIcons, type FigmaConfigNotificationChannelIcon } from '@/shared/assets/figma-icons'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = defineProps<{
  records: NotificationRecordItem[]
  channels: NotificationChannelItem[]
  loading: boolean
  pageNo: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  statusChange: []
  open: [record: NotificationRecordItem]
  retry: [record: NotificationRecordItem]
  pageChange: [pageNo: number]
}>()

const keyword = defineModel<string>('keyword', { required: true })
const statusFilter = defineModel<string>('statusFilter', { required: true })

const filteredRecords = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return props.records
  return props.records.filter(record => [record.channelName, record.eventName, record.eventType, record.targetName]
    .some(value => String(value || '').toLowerCase().includes(search)))
})

function normalizeChannelType(type: string) {
  return type.trim().toUpperCase()
}

function getChannelIconKey(type: string): FigmaConfigNotificationChannelIcon {
  const normalized = normalizeChannelType(type)
  if (normalized === 'EMAIL' || normalized === 'MAIL') return 'email'
  if (normalized === 'WEBHOOK') return 'webhook'
  return 'wecom'
}

function getChannelTypeTone(type: string) {
  const normalized = normalizeChannelType(type)
  if (normalized === 'WECOM_ROBOT') return { color: '#07C160', bg: '#E8FFEA' }
  if (normalized === 'EMAIL' || normalized === 'MAIL') return { color: '#165DFF', bg: '#E8F3FF' }
  return { color: '#8B5CF6', bg: '#F5F0FF' }
}

function findRecordChannel(record: NotificationRecordItem) {
  return props.channels.find(item => item.id === record.channelId || item.channelName === record.channelName)
}

function getRecordChannelIcon(record: NotificationRecordItem) {
  return figmaConfigNotificationIcons.channel[getChannelIconKey(findRecordChannel(record)?.channelType || '')]
}

function getRecordChannelTone(record: NotificationRecordItem) {
  return getChannelTypeTone(findRecordChannel(record)?.channelType || '')
}

function getRecordStatusMeta(record: NotificationRecordItem) {
  return record.sendStatus === 'SUCCESS'
    ? { label: '成功', color: '#00B42A', dot: '#00B42A' }
    : { label: '失败', color: '#F53F3F', dot: '#F53F3F' }
}

function formatTime(value: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-'
}
</script>

<template>
  <div class="notification-toolbar notification-record-toolbar">
    <el-input v-model="keyword" class="notification-toolbar__search" clearable placeholder="搜索渠道、事件或关联对象" :prefix-icon="Search" />
    <el-select v-model="statusFilter" class="notification-record-result-filter" clearable placeholder="全部结果" @change="emit('statusChange')">
      <el-option v-for="item in notificationSendStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
  </div>
  <AppLoadingState v-if="loading && !records.length" text="正在加载通知记录..." />
  <AppEmptyState v-else-if="!records.length" title="暂无通知记录" description="接口套件或 Web UI 执行触发通知后，会在这里留下发送结果。" />
  <template v-else>
    <div class="notification-table-card notification-table-card--records" v-loading="loading">
      <table>
        <colgroup><col class="notification-table-card__time-col"><col class="notification-table-card__channels-col"><col class="notification-table-card__event-col"><col class="notification-table-card__target-col"><col class="notification-table-card__status-col"><col class="notification-table-card__duration-col"><col class="notification-table-card__action-col"></colgroup>
        <thead><tr><th>发送时间</th><th>通知渠道</th><th>触发事件</th><th>关联对象</th><th>结果</th><th>耗时</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.id">
            <td><code class="notification-time-code">{{ formatTime(record.sentAt || record.triggeredAt || record.createdAt) }}</code></td>
            <td><span class="notification-history-channel"><span :style="{ color: getRecordChannelTone(record).color, backgroundColor: getRecordChannelTone(record).bg }"><img :src="getRecordChannelIcon(record)" alt=""></span><b :title="record.channelName || ''">{{ record.channelName || '-' }}</b></span></td>
            <td><span class="notification-event-pill" :title="record.eventName">{{ record.eventName }}</span></td>
            <td><span class="notification-history-target" :title="record.targetName || ''">{{ record.targetName || '-' }}</span></td>
            <td><div class="notification-result-stack"><span class="notification-status" :style="{ color: getRecordStatusMeta(record).color }"><span :style="{ backgroundColor: getRecordStatusMeta(record).dot }" />{{ getRecordStatusMeta(record).label }}</span><small v-if="record.sendStatus !== 'SUCCESS' && record.errorMessage" :title="record.errorMessage">{{ record.errorMessage }}</small></div></td>
            <td><code class="notification-duration-code">—</code></td>
            <td><div class="notification-row-actions"><button type="button" class="notification-icon-button" aria-label="查看发送详情" @click="emit('open', record)"><img :src="figmaConfigNotificationIcons.action.eye" alt=""></button><button v-if="record.sendStatus !== 'SUCCESS'" type="button" class="notification-icon-button" aria-label="重试发送" @click="emit('retry', record)"><img :src="figmaConfigNotificationIcons.action.retry" alt=""></button></div></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="notification-pagination">
      <el-pagination background layout="prev, pager, next, total" :current-page="pageNo" :page-size="pageSize" :total="total" @current-change="emit('pageChange', $event)" />
    </div>
  </template>
</template>
