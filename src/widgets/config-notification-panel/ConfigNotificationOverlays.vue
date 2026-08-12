<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue'

import {
  notificationChannelTypeOptions,
  notificationTriggerConditionOptions,
  type CreateNotificationChannelPayload,
  type CreateNotificationRulePayload,
  type NotificationChannelItem,
  type NotificationEventOption,
  type NotificationRecordItem,
} from '@/entities/config'
import {
  figmaConfigNotificationIcons,
  type FigmaConfigNotificationChannelIcon,
} from '@/shared/assets/figma-icons'

type DialogMode = 'create' | 'edit'

interface ChannelTypeCard {
  value: string
  label: string
  description: string
  icon: FigmaConfigNotificationChannelIcon
  color: string
  bg: string
  disabled?: boolean
}

interface RuleContentPreviewOption {
  key: string
  title: string
  description: string
  enabled: boolean
}

const props = defineProps<{
  channelDialogMode: DialogMode
  ruleDialogMode: DialogMode
  channelTypeCards: ChannelTypeCard[]
  channelSecretVisible: boolean
  channelTestResult: { success: boolean, message: string } | null
  testingChannelDraft: boolean
  saving: boolean
  eventTypes: NotificationEventOption[]
  enabledChannels: NotificationChannelItem[]
  channels: NotificationChannelItem[]
  selectedRuleChannelHint: string
  ruleContentPreviewOptions: RuleContentPreviewOption[]
  selectedHistoryRecord: NotificationRecordItem | null
}>()

const emit = defineEmits<{
  selectChannelType: [card: ChannelTypeCard]
  toggleChannelStatus: []
  toggleChannelSecret: []
  testChannel: []
  submitChannel: []
  toggleRuleStatus: []
  submitRule: []
  retryHistory: [record: NotificationRecordItem]
}>()

const channelVisible = defineModel<boolean>('channelVisible', { required: true })
const ruleVisible = defineModel<boolean>('ruleVisible', { required: true })
const historyVisible = defineModel<boolean>('historyVisible', { required: true })
const channelForm = defineModel<CreateNotificationChannelPayload>('channelForm', { required: true })
const ruleForm = defineModel<CreateNotificationRulePayload>('ruleForm', { required: true })

function getChannelTypeLabel(channel: NotificationChannelItem) {
  return channel.channelTypeName
    || notificationChannelTypeOptions.find(item => item.value === channel.channelType)?.label
    || channel.channelType
}

function getRecordStatusMeta(record: NotificationRecordItem) {
  if (record.sendStatus === 'SUCCESS') {
    return { label: '成功', color: '#00B42A', dot: '#00B42A' }
  }
  return { label: '失败', color: '#F53F3F', dot: '#F53F3F' }
}

function getRecordChannelTypeLabel(record: NotificationRecordItem) {
  const channel = props.channels.find(item => item.id === record.channelId || item.channelName === record.channelName)
  return channel ? getChannelTypeLabel(channel) : '-'
}

function getRecordTargetText(record: NotificationRecordItem) {
  return record.targetName || record.targetType || '-'
}

function getRecordResponseText(record: NotificationRecordItem) {
  return record.responseBody || record.errorMessage || ''
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 19)
}
</script>

<template>
  <el-drawer
    v-model="channelVisible"
    class="notification-channel-drawer"
    direction="rtl"
    size="520px"
    :with-header="false"
    destroy-on-close
  >
    <div class="notification-channel-drawer__shell">
      <header class="notification-channel-drawer__header">
        <div>
          <h3>{{ channelDialogMode === 'edit' ? '编辑通知渠道' : '新增通知渠道' }}</h3>
          <p>配置 Webhook 地址和发送策略</p>
        </div>
        <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="channelVisible = false">
          <img :src="figmaConfigNotificationIcons.drawer.close" alt="">
        </button>
      </header>

      <div class="notification-channel-drawer__body">
        <label class="notification-channel-field">
          <span>渠道名称 <b>*</b></span>
          <el-input v-model="channelForm.channelName" maxlength="80" placeholder="输入渠道名称" />
        </label>

        <section class="notification-channel-field">
          <span>渠道类型 <b>*</b></span>
          <div class="notification-channel-type-grid">
            <button
              v-for="card in channelTypeCards"
              :key="card.value"
              type="button"
              class="notification-channel-type-card"
              :class="{ 'is-active': channelForm.channelType === card.value, 'is-disabled': card.disabled }"
              :disabled="card.disabled"
              @click="emit('selectChannelType', card)"
            >
              <span class="notification-channel-type-card__icon" :style="{ color: card.color, backgroundColor: card.bg }">
                <img :src="figmaConfigNotificationIcons.channel[card.icon]" alt="">
              </span>
              <strong>{{ card.label }}</strong>
              <small>{{ card.description }}</small>
            </button>
          </div>
        </section>

        <label class="notification-channel-field">
          <span>
            Webhook 地址 <b>*</b>
            <small v-if="channelDialogMode === 'edit'">已配置，输入新地址以替换</small>
          </span>
          <el-input
            v-model="channelForm.webhookUrl"
            :placeholder="channelDialogMode === 'edit' ? '••••••••••••• (已配置)' : 'https://qyapi.weixin.qq.com/...'"
          />
        </label>

        <label class="notification-channel-field">
          <span>{{ channelForm.channelType === 'WECOM_ROBOT' ? '机器人密钥（可选）' : '认证 Token' }}</span>
          <el-input
            v-model="channelForm.secretKey"
            :type="channelSecretVisible ? 'text' : 'password'"
            :placeholder="channelDialogMode === 'edit' ? '已配置' : '输入密钥（可选）'"
          >
            <template #suffix>
              <button
                type="button"
                class="notification-channel-secret-toggle"
                :aria-label="channelSecretVisible ? '隐藏密钥' : '显示密钥'"
                @click="emit('toggleChannelSecret')"
              >
                <EyeOff v-if="channelSecretVisible" :size="14" :stroke-width="1.8" />
                <Eye v-else :size="14" :stroke-width="1.8" />
              </button>
            </template>
          </el-input>
          <em>密钥加密存储，配置后以脱敏形式展示</em>
        </label>

        <template v-if="channelForm.channelType === 'WEBHOOK'">
          <div class="notification-rule-drawer__divider" />
          <div class="notification-channel-grid">
            <label class="notification-channel-field">
              <span>请求方式</span>
              <el-select v-model="channelForm.httpMethod">
                <el-option label="POST" value="POST" />
                <el-option label="PUT" value="PUT" />
              </el-select>
            </label>
            <label class="notification-channel-field">
              <span>超时毫秒</span>
              <el-input-number v-model="channelForm.timeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
            </label>
          </div>
          <label class="notification-channel-field">
            <span>请求头</span>
            <el-input v-model="channelForm.headersJson" type="textarea" :rows="3" placeholder='{"Authorization":"Bearer token"}' />
          </label>
          <label class="notification-channel-field">
            <span>请求体模板</span>
            <el-input v-model="channelForm.bodyTemplate" type="textarea" :rows="4" placeholder='{"text":"{{title}} {{targetName}} {{result}}"}' />
          </label>
        </template>

        <div class="notification-channel-grid">
          <label class="notification-channel-field">
            <span>重试次数</span>
            <el-input-number v-model="channelForm.retryCount" :min="0" :max="5" controls-position="right" />
          </label>
          <label v-if="channelForm.channelType !== 'WEBHOOK'" class="notification-channel-field">
            <span>超时毫秒</span>
            <el-input-number v-model="channelForm.timeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
          </label>
        </div>

        <div class="notification-rule-drawer__divider" />
        <article class="notification-rule-content-card">
          <div>
            <strong>启用此渠道</strong>
            <span>停用后该渠道将不再接收任何通知</span>
          </div>
          <button
            type="button"
            class="notification-rule-toggle"
            :class="{ 'is-on': channelForm.status === 1 }"
            :aria-pressed="channelForm.status === 1"
            @click="emit('toggleChannelStatus')"
          />
        </article>

        <label class="notification-channel-field">
          <span>备注</span>
          <el-input v-model="channelForm.remark" type="textarea" :rows="2" maxlength="200" placeholder="可选，描述该渠道的用途" />
        </label>
        <div v-if="channelTestResult" class="notification-channel-test-result" :class="{ 'is-success': channelTestResult.success }">
          {{ channelTestResult.message }}
        </div>
      </div>

      <footer class="notification-channel-drawer__footer">
        <button
          type="button"
          class="notification-channel-drawer__test"
          :disabled="testingChannelDraft || !channelForm.webhookUrl.trim()"
          @click="emit('testChannel')"
        >
          <img :src="figmaConfigNotificationIcons.action.send" alt="">
          {{ testingChannelDraft ? '发送中...' : '测试发送' }}
        </button>
        <div>
          <button type="button" class="notification-rule-drawer__cancel" @click="channelVisible = false">取消</button>
          <button type="button" class="notification-rule-drawer__submit" :disabled="saving" @click="emit('submitChannel')">
            <img :src="figmaConfigNotificationIcons.drawer.save" alt="">
            {{ channelDialogMode === 'edit' ? '保存修改' : '添加渠道' }}
          </button>
        </div>
      </footer>
    </div>
  </el-drawer>

  <el-drawer
    v-model="ruleVisible"
    class="notification-rule-drawer"
    direction="rtl"
    size="560px"
    :with-header="false"
    destroy-on-close
  >
    <div class="notification-rule-drawer__shell">
      <header class="notification-rule-drawer__header">
        <div>
          <h3>{{ ruleDialogMode === 'edit' ? '编辑通知规则' : '新增通知规则' }}</h3>
          <p>定义触发事件、通知渠道和内容策略</p>
        </div>
        <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="ruleVisible = false">
          <img :src="figmaConfigNotificationIcons.drawer.close" alt="">
        </button>
      </header>

      <div class="notification-rule-drawer__body">
        <label class="notification-drawer-field is-full">
          <span>规则名称 <b>*</b></span>
          <el-input v-model="ruleForm.ruleName" maxlength="80" placeholder="输入规则名称" />
        </label>
        <div class="notification-drawer-grid">
          <label class="notification-drawer-field">
            <span>触发事件 <b>*</b></span>
            <el-select v-model="ruleForm.eventType" placeholder="选择触发事件">
              <el-option v-for="item in eventTypes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="notification-drawer-field">
            <span>适用模块</span>
            <el-input model-value="暂未接入" disabled />
          </label>
        </div>
        <div class="notification-drawer-grid">
          <label class="notification-drawer-field">
            <span>触发条件</span>
            <el-select v-model="ruleForm.triggerCondition" placeholder="选择触发条件">
              <el-option v-for="item in notificationTriggerConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="notification-drawer-field">
            <span>通知渠道 <b>*</b></span>
            <el-select v-model="ruleForm.channelIds" multiple collapse-tags collapse-tags-tooltip placeholder="选择通知渠道">
              <el-option v-for="item in enabledChannels" :key="item.id" :label="item.channelName" :value="item.id" />
            </el-select>
          </label>
        </div>
        <div class="notification-drawer-grid">
          <label class="notification-drawer-field">
            <span>频率限制</span>
            <el-input-number v-model="ruleForm.frequencyLimitSeconds" :min="0" :max="3600" :step="30" controls-position="right" />
          </label>
          <div class="notification-drawer-field">
            <span>限制说明</span>
            <div class="notification-drawer-static">秒内最多触发一次，0 表示不限制</div>
          </div>
        </div>
        <div class="notification-rule-drawer__hint">
          <img :src="figmaConfigNotificationIcons.drawer.hint" alt="">
          <span>{{ selectedRuleChannelHint }}</span>
        </div>
        <div class="notification-rule-drawer__divider" />
        <section class="notification-rule-drawer__section">
          <h4>通知内容</h4>
          <div class="notification-rule-content-list">
            <article v-for="item in ruleContentPreviewOptions" :key="item.key" class="notification-rule-content-card">
              <div><strong>{{ item.title }}</strong><span>{{ item.description }}</span></div>
              <span class="notification-rule-toggle" :class="{ 'is-on': item.enabled }" aria-hidden="true" />
            </article>
          </div>
        </section>
        <div class="notification-rule-drawer__divider" />
        <article class="notification-rule-content-card">
          <div><strong>启用此规则</strong><span>停用后该规则不会触发任何通知</span></div>
          <button
            type="button"
            class="notification-rule-toggle"
            :class="{ 'is-on': ruleForm.status === 1 }"
            :aria-pressed="ruleForm.status === 1"
            @click="emit('toggleRuleStatus')"
          />
        </article>
      </div>
      <footer class="notification-rule-drawer__footer">
        <button type="button" class="notification-rule-drawer__cancel" @click="ruleVisible = false">取消</button>
        <button type="button" class="notification-rule-drawer__submit" :disabled="saving" @click="emit('submitRule')">
          <img :src="figmaConfigNotificationIcons.drawer.save" alt="">
          {{ ruleDialogMode === 'edit' ? '保存规则' : '创建规则' }}
        </button>
      </footer>
    </div>
  </el-drawer>

  <el-drawer
    v-model="historyVisible"
    class="notification-history-drawer"
    direction="rtl"
    size="680px"
    :with-header="false"
    destroy-on-close
  >
    <div v-if="selectedHistoryRecord" class="notification-history-drawer__shell">
      <header class="notification-history-drawer__header">
        <div>
          <h3>发送详情</h3>
          <p>{{ formatTime(selectedHistoryRecord.sentAt || selectedHistoryRecord.triggeredAt || selectedHistoryRecord.createdAt) }}</p>
        </div>
        <div class="notification-history-drawer__actions">
          <button
            v-if="selectedHistoryRecord.sendStatus !== 'SUCCESS'"
            type="button"
            class="notification-history-drawer__retry"
            @click="emit('retryHistory', selectedHistoryRecord)"
          >
            <img :src="figmaConfigNotificationIcons.action.send" alt="">
            重试发送
          </button>
          <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="historyVisible = false">
            <img :src="figmaConfigNotificationIcons.drawer.close" alt="">
          </button>
        </div>
      </header>
      <div class="notification-history-drawer__body">
        <article class="notification-history-status" :class="{ 'is-success': selectedHistoryRecord.sendStatus === 'SUCCESS' }">
          <span :style="{ backgroundColor: getRecordStatusMeta(selectedHistoryRecord).dot }" />
          <div>
            <strong>{{ selectedHistoryRecord.sendStatus === 'SUCCESS' ? '通知发送成功' : '通知发送失败' }}</strong>
            <p v-if="selectedHistoryRecord.errorMessage">{{ selectedHistoryRecord.errorMessage }}</p>
          </div>
        </article>
        <section class="notification-history-info">
          <div><span>发送时间</span><strong>{{ formatTime(selectedHistoryRecord.sentAt || selectedHistoryRecord.createdAt) }}</strong></div>
          <div><span>通知渠道</span><strong>{{ selectedHistoryRecord.channelName || '-' }}</strong></div>
          <div><span>渠道类型</span><strong>{{ getRecordChannelTypeLabel(selectedHistoryRecord) }}</strong></div>
          <div><span>触发事件</span><strong><em>{{ selectedHistoryRecord.eventName || selectedHistoryRecord.eventType }}</em></strong></div>
          <div><span>关联对象</span><strong>{{ getRecordTargetText(selectedHistoryRecord) }}</strong></div>
          <div>
            <span>发送结果</span>
            <strong><b :style="{ color: getRecordStatusMeta(selectedHistoryRecord).color }"><i :style="{ backgroundColor: getRecordStatusMeta(selectedHistoryRecord).dot }" />{{ getRecordStatusMeta(selectedHistoryRecord).label }}</b></strong>
          </div>
          <div><span>耗时</span><strong>-</strong></div>
        </section>
        <section v-if="selectedHistoryRecord.eventTitle" class="notification-history-section">
          <h4>通知内容（Payload）</h4>
          <pre>{{ selectedHistoryRecord.eventTitle }}</pre>
        </section>
        <section v-if="getRecordResponseText(selectedHistoryRecord)" class="notification-history-section is-response">
          <h4>Webhook 响应</h4>
          <pre>{{ getRecordResponseText(selectedHistoryRecord) }}</pre>
        </section>
        <section v-if="selectedHistoryRecord.sendStatus !== 'SUCCESS'" class="notification-history-advice">
          <h4>排查建议</h4>
          <ul>
            <li>确认 Webhook 地址是否有效，可在渠道管理中点击「测试发送」验证</li>
            <li>检查机器人密钥或签名是否配置正确</li>
            <li>若超时，可适当提高网络超时配置，或检查企业微信服务状态</li>
          </ul>
        </section>
      </div>
    </div>
  </el-drawer>
</template>
