<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

import { notificationTriggerConditionOptions, type NotificationRuleItem } from '@/entities/config'
import { figmaConfigNotificationIcons } from '@/shared/assets/figma-icons'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

defineProps<{
  rules: NotificationRuleItem[]
  loading: boolean
  operatingId: number | null
}>()

const emit = defineEmits<{
  create: []
  edit: [rule: NotificationRuleItem]
  duplicate: [rule: NotificationRuleItem]
  toggle: [rule: NotificationRuleItem]
  remove: [rule: NotificationRuleItem]
}>()

const keyword = defineModel<string>('keyword', { required: true })

function getRuleStatusMeta(rule: NotificationRuleItem) {
  return rule.status === 1
    ? { label: '已启用', color: '#4E5969', dot: '#00B42A' }
    : { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
}

function getRuleModule(rule: NotificationRuleItem) {
  if (rule.eventType.startsWith('WEB_UI_')) return 'Web UI 自动化'
  if (rule.eventType.startsWith('API_SUITE_')) return '接口自动化'
  return '—'
}

function formatCondition(value: string) {
  return notificationTriggerConditionOptions.find(item => item.value === value)?.label || value
}

function formatTime(value: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-'
}
</script>

<template>
  <div class="notification-toolbar">
    <el-input v-model="keyword" class="notification-toolbar__search" clearable placeholder="搜索规则名称或事件" :prefix-icon="Search" />
    <button type="button" class="notification-primary-button" @click="emit('create')"><img :src="figmaConfigNotificationIcons.plus" alt="">新增规则</button>
  </div>
  <AppLoadingState v-if="loading && !rules.length" text="正在加载通知规则..." />
  <AppEmptyState v-else-if="!rules.length" title="暂无通知规则" description="规则负责把接口套件和 Web UI 的执行结果发送到指定渠道。" />
  <div v-else class="notification-table-card notification-table-card--rules" v-loading="loading">
    <table>
      <colgroup>
        <col class="notification-table-card__rule-name-col"><col class="notification-table-card__event-col"><col class="notification-table-card__module-col"><col class="notification-table-card__condition-col">
        <col class="notification-table-card__channels-col"><col class="notification-table-card__content-col"><col class="notification-table-card__status-col"><col class="notification-table-card__created-col"><col class="notification-table-card__action-col">
      </colgroup>
      <thead><tr><th>规则名称</th><th>触发事件</th><th>适用模块</th><th>触发条件</th><th>通知渠道</th><th>内容选项</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="rule in rules" :key="rule.id">
          <td><span class="notification-name-text" :title="rule.ruleName">{{ rule.ruleName }}</span></td>
          <td><span class="notification-event-pill" :title="rule.eventName">{{ rule.eventName }}</span></td>
          <td><span class="notification-muted-text">{{ getRuleModule(rule) }}</span></td>
          <td><span class="notification-muted-text">{{ formatCondition(rule.triggerCondition) }}</span></td>
          <td><span class="notification-channel-inline"><img :src="figmaConfigNotificationIcons.tab.channel" alt=""><span>{{ rule.channelNames[0] || '-' }}</span></span></td>
          <td><span class="notification-muted-text">—</span></td>
          <td><span class="notification-status" :style="{ color: getRuleStatusMeta(rule).color }"><span :style="{ backgroundColor: getRuleStatusMeta(rule).dot }" />{{ getRuleStatusMeta(rule).label }}</span></td>
          <td><code class="notification-time-code">{{ formatTime(rule.createdAt) }}</code></td>
          <td>
            <div class="notification-row-actions">
              <button type="button" class="notification-icon-button" aria-label="编辑规则" @click="emit('edit', rule)"><img :src="figmaConfigNotificationIcons.action.edit" alt=""></button>
              <button type="button" class="notification-icon-button" aria-label="复制规则" :disabled="operatingId === rule.id" @click="emit('duplicate', rule)"><img :src="figmaConfigNotificationIcons.action.copy" alt=""></button>
              <button type="button" class="notification-icon-button" :aria-label="rule.status === 1 ? '停用规则' : '启用规则'" :disabled="operatingId === rule.id" @click="emit('toggle', rule)"><img :src="figmaConfigNotificationIcons.action.power" alt=""></button>
              <button type="button" class="notification-icon-button is-danger" aria-label="删除规则" :disabled="operatingId === rule.id" @click="emit('remove', rule)"><img :src="figmaConfigNotificationIcons.action.delete" alt=""></button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
