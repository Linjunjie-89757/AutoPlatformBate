<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  notificationChannelTypeOptions,
  type ConfigStatus,
  type CreateNotificationChannelPayload,
  type CreateNotificationRulePayload,
  type NotificationChannelItem,
  type NotificationEventOption,
  type NotificationRecordItem,
  type NotificationRuleItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaConfigNotificationIcons, type FigmaConfigNotificationChannelIcon } from '@/shared/assets/figma-icons'
import { debounce } from '@/shared/lib/debounce'
import { confirmDelete } from '@/shared/ui'
import ConfigNotificationChannelList from './ConfigNotificationChannelList.vue'
import ConfigNotificationOverlays from './ConfigNotificationOverlays.vue'
import ConfigNotificationRecordList from './ConfigNotificationRecordList.vue'
import ConfigNotificationRuleList from './ConfigNotificationRuleList.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

type PanelTab = 'channels' | 'rules' | 'records'
type DialogMode = 'create' | 'edit'

interface NotificationInnerTab {
  key: PanelTab
  label: string
  icon: string
}

interface RuleContentPreviewOption {
  key: string
  title: string
  description: string
  enabled: boolean
}

interface ChannelTypeCard {
  value: string
  label: string
  description: string
  icon: FigmaConfigNotificationChannelIcon
  color: string
  bg: string
  disabled?: boolean
}

const activeTab = ref<PanelTab>('channels')
const eventTypes = ref<NotificationEventOption[]>([])

const channels = ref<NotificationChannelItem[]>([])
const rules = ref<NotificationRuleItem[]>([])
const records = ref<NotificationRecordItem[]>([])
const recordsTotal = ref(0)
const failedRecordsTotal = ref(0)
const recordsPageNo = ref(1)
const recordsPageSize = ref(20)

const channelsLoading = ref(false)
const rulesLoading = ref(false)
const recordsLoading = ref(false)
const saving = ref(false)
const testingChannelDraft = ref(false)
const testingChannelId = ref<number | null>(null)
const operatingId = ref<number | null>(null)
const errorMessage = ref('')

const channelKeyword = ref('')
const channelTypeFilter = ref('')
const channelStatusFilter = ref('')
const ruleKeyword = ref('')
const ruleEventFilter = ref('')
const ruleStatusFilter = ref('')
const recordKeyword = ref('')
const recordEventFilter = ref('')
const recordChannelFilter = ref<number | ''>('')
const recordStatusFilter = ref('')
const recordDateRange = ref<[Date, Date] | null>(null)

const concreteWorkspaceSelected = computed(() => props.workspaceCode !== 'ALL')

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

const channelTypeCards: ChannelTypeCard[] = [
  { value: 'WECOM_ROBOT', label: '企业微信', description: '群机器人', icon: 'wecom', color: '#07C160', bg: '#E8FFEA' },
  { value: 'DINGTALK', label: '钉钉', description: '暂未接入', icon: 'wecom', color: '#FF7D00', bg: '#FFF3E8', disabled: true },
  { value: 'EMAIL', label: '邮件', description: '暂未接入', icon: 'email', color: '#165DFF', bg: '#E8F3FF', disabled: true },
  { value: 'WEBHOOK', label: 'Webhook', description: '自定义推送', icon: 'webhook', color: '#8B5CF6', bg: '#F5F0FF' },
]

const channelDialogVisible = ref(false)
const channelDialogMode = ref<DialogMode>('create')
const editingChannel = ref<NotificationChannelItem | null>(null)
const channelForm = ref<CreateNotificationChannelPayload>(defaultChannelForm())
const channelSecretVisible = ref(false)
const channelTestResult = ref<{ success: boolean, message: string } | null>(null)

const ruleDialogVisible = ref(false)
const ruleDialogMode = ref<DialogMode>('create')
const editingRule = ref<NotificationRuleItem | null>(null)
const ruleForm = ref<CreateNotificationRulePayload>(defaultRuleForm())

const historyDetailVisible = ref(false)
const selectedHistoryRecord = ref<NotificationRecordItem | null>(null)

const enabledChannels = computed(() => channels.value.filter(item => item.status === 1))
const channelStats = computed(() => ({
  total: channels.value.length,
  enabled: channels.value.filter(item => item.status === 1).length,
  failed: failedRecordsTotal.value,
  rules: rules.value.length,
}))
const selectedRuleChannels = computed(() =>
  ruleForm.value.channelIds
    .map(id => channels.value.find(channel => channel.id === id))
    .filter((channel): channel is NotificationChannelItem => Boolean(channel)),
)
const selectedRuleChannelHint = computed(() => {
  const [firstChannel] = selectedRuleChannels.value
  if (!firstChannel) {
    return '请选择通知渠道'
  }
  const label = getChannelTypeLabel(firstChannel)
  if (selectedRuleChannels.value.length === 1) {
    return `将通知到「${firstChannel.channelName}」(${label})`
  }
  return `将通知到「${firstChannel.channelName}」等 ${selectedRuleChannels.value.length} 个渠道`
})
const debouncedLoadChannels = debounce(() => {
  void loadChannels()
}, 300)
const debouncedLoadRules = debounce(() => {
  void loadRules()
}, 300)

function defaultChannelForm(): CreateNotificationChannelPayload {
  return {
    workspaceCode: concreteWorkspaceSelected.value ? props.workspaceCode : undefined,
    channelName: '',
    channelType: 'WECOM_ROBOT',
    webhookUrl: '',
    secretKey: '',
    httpMethod: 'POST',
    headersJson: '',
    bodyTemplate: '',
    timeoutMs: 5000,
    retryCount: 2,
    status: 1,
    remark: '',
  }
}

function defaultRuleForm(): CreateNotificationRulePayload {
  return {
    workspaceCode: concreteWorkspaceSelected.value ? props.workspaceCode : undefined,
    ruleName: '',
    eventType: 'API_SUITE_FAILED',
    triggerCondition: 'ALWAYS',
    channelIds: [],
    frequencyLimitSeconds: 0,
    status: 1,
  }
}

async function loadEventTypes() {
  try {
    eventTypes.value = await configApi.getNotificationEventTypes()
  } catch (error) {
    eventTypes.value = []
    errorMessage.value = errorMessage.value || getRequestErrorMessage(error)
  }
}

async function loadChannels() {
  channelsLoading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getNotificationChannels(props.workspaceCode, {
      keyword: channelKeyword.value.trim(),
      channelType: channelTypeFilter.value,
      status: channelStatusFilter.value === '' ? undefined : Number(channelStatusFilter.value) as ConfigStatus,
    })
    channels.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    channelsLoading.value = false
  }
}

async function loadRules() {
  rulesLoading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getNotificationRules(props.workspaceCode, {
      keyword: ruleKeyword.value.trim(),
      eventType: ruleEventFilter.value,
      status: ruleStatusFilter.value === '' ? undefined : Number(ruleStatusFilter.value) as ConfigStatus,
    })
    rules.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    rulesLoading.value = false
  }
}

async function loadRecords() {
  recordsLoading.value = true
  errorMessage.value = ''
  try {
    const [createdFrom, createdTo] = recordDateRange.value || []
    const page = await configApi.getNotificationRecords(props.workspaceCode, {
      eventType: recordEventFilter.value,
      channelId: recordChannelFilter.value === '' ? undefined : recordChannelFilter.value,
      sendStatus: recordStatusFilter.value,
      createdFrom: createdFrom ? createdFrom.toISOString() : undefined,
      createdTo: createdTo ? createdTo.toISOString() : undefined,
      pageNo: recordsPageNo.value,
      pageSize: recordsPageSize.value,
    })
    records.value = Array.isArray(page.items) ? page.items : []
    recordsTotal.value = Number(page.total || 0)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    recordsLoading.value = false
  }
}

async function loadRecordStats() {
  try {
    const page = await configApi.getNotificationRecords(props.workspaceCode, {
      sendStatus: 'FAILED',
      pageNo: 1,
      pageSize: 1,
    })
    failedRecordsTotal.value = Number(page.total || 0)
  } catch {
    failedRecordsTotal.value = 0
  }
}

async function refreshAll() {
  await Promise.all([loadChannels(), loadRules(), loadRecords(), loadRecordStats()])
}

function selectTab(tab: PanelTab) {
  activeTab.value = tab
}

function getChannelTypeLabel(channel: NotificationChannelItem) {
  return channel.channelTypeName || notificationChannelTypeOptions.find(item => item.value === channel.channelType)?.label || channel.channelType
}

function getChannelRulesCount(channel: NotificationChannelItem) {
  return rules.value.filter(rule => rule.channelIds.includes(channel.id)).length
}


function openHistoryDetail(record: NotificationRecordItem) {
  selectedHistoryRecord.value = record
  historyDetailVisible.value = true
}

function retryHistoryRecord(record: NotificationRecordItem | null) {
  if (!record) {
    return
  }
  ElMessage.info('通知历史重试发送接口暂未接入，已记录到迁移遗留问题')
}

function resetChannelDrawerState() {
  channelSecretVisible.value = false
  channelTestResult.value = null
}

function openCreateChannelDialog() {
  if (!concreteWorkspaceSelected.value) {
    ElMessage.warning('请先在右上角切换到具体工作空间')
    return
  }
  channelDialogMode.value = 'create'
  editingChannel.value = null
  channelForm.value = defaultChannelForm()
  resetChannelDrawerState()
  channelDialogVisible.value = true
}

function openEditChannelDialog(row: NotificationChannelItem) {
  channelDialogMode.value = 'edit'
  editingChannel.value = row
  channelForm.value = {
    workspaceCode: row.workspaceCode,
    channelName: row.channelName,
    channelType: row.channelType,
    webhookUrl: row.webhookUrl,
    secretKey: '',
    httpMethod: row.httpMethod || 'POST',
    headersJson: row.headersJson || '',
    bodyTemplate: row.bodyTemplate || '',
    timeoutMs: row.timeoutMs,
    retryCount: row.retryCount,
    status: row.status,
    remark: row.remark || '',
  }
  resetChannelDrawerState()
  channelDialogVisible.value = true
}

function selectChannelType(card: ChannelTypeCard) {
  if (card.disabled) {
    ElMessage.info(`${card.label} 通知暂未接入`)
    return
  }
  channelForm.value.channelType = card.value
}

function toggleChannelFormStatus() {
  channelForm.value.status = channelForm.value.status === 1 ? 0 : 1
}

function toggleChannelSecretVisible() {
  channelSecretVisible.value = !channelSecretVisible.value
}

async function submitChannel() {
  if (!channelForm.value.channelName.trim() || !channelForm.value.webhookUrl.trim()) {
    ElMessage.warning('请填写渠道名称和 Webhook 地址')
    return
  }
  saving.value = true
  try {
    const workspaceCode = channelForm.value.workspaceCode || props.workspaceCode
    if (channelDialogMode.value === 'edit' && editingChannel.value) {
      await configApi.updateNotificationChannel(workspaceCode, editingChannel.value.id, channelForm.value)
      ElMessage.success('通知渠道已更新')
    } else {
      await configApi.createNotificationChannel(workspaceCode, channelForm.value)
      ElMessage.success('通知渠道已创建')
    }
    channelDialogVisible.value = false
    await loadChannels()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function testChannel(row: NotificationChannelItem) {
  testingChannelId.value = row.id
  try {
    const result = await configApi.testNotificationChannel(row.workspaceCode, {
      channelId: row.id,
      message: `通知渠道「${row.channelName}」测试消息`,
    })
    if (result.success === false) {
      ElMessage.error(result.message || '测试发送失败')
    } else {
      ElMessage.success(result.message || '测试发送成功')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    testingChannelId.value = null
  }
}

async function toggleChannel(row: NotificationChannelItem) {
  operatingId.value = row.id
  try {
    const next = row.status === 1 ? 0 : 1
    await configApi.updateNotificationChannelStatus(row.workspaceCode, row.id, next)
    ElMessage.success(next === 1 ? '通知渠道已启用' : '通知渠道已停用')
    await loadChannels()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
  }
}

async function testChannelFromDrawer() {
  if (!channelForm.value.webhookUrl.trim()) {
    ElMessage.warning('请先填写 Webhook 地址')
    return
  }
  if (!concreteWorkspaceSelected.value && !editingChannel.value) {
    ElMessage.warning('请先在右上角切换到具体工作空间')
    return
  }
  testingChannelDraft.value = true
  testingChannelId.value = editingChannel.value?.id || null
  try {
    const workspaceCode = editingChannel.value?.workspaceCode || props.workspaceCode
    const result = editingChannel.value
      ? await configApi.testNotificationChannel(workspaceCode, {
          channelId: editingChannel.value.id,
          message: `通知渠道「${editingChannel.value.channelName}」测试消息`,
        })
      : await configApi.testNotificationChannel(workspaceCode, {
          channelType: channelForm.value.channelType,
          webhookUrl: channelForm.value.webhookUrl,
          secretKey: channelForm.value.secretKey,
          httpMethod: channelForm.value.httpMethod,
          headersJson: channelForm.value.headersJson,
          bodyTemplate: channelForm.value.bodyTemplate,
          timeoutMs: channelForm.value.timeoutMs,
          retryCount: channelForm.value.retryCount,
          message: `通知渠道「${channelForm.value.channelName || '未命名渠道'}」测试消息`,
        })
    channelTestResult.value = {
      success: result.success,
      message: result.message || (result.success ? '测试发送成功，消息已送达目标渠道' : '测试发送失败，请检查 Webhook 地址是否正确'),
    }
  } catch (error) {
    const message = getRequestErrorMessage(error)
    channelTestResult.value = { success: false, message }
    ElMessage.error(message)
  } finally {
    testingChannelDraft.value = false
    testingChannelId.value = null
  }
}

async function openDeleteChannelConfirm(row: NotificationChannelItem) {
  const count = getChannelRulesCount(row)
  try {
    await confirmDelete({
      title: '删除渠道',
      message: `确认删除「${row.channelName}」？该渠道关联了 ${count} 条通知规则，删除后相关规则将停止发送。`,
      confirmText: '确认删除',
      density: 'compact',
      zIndex: 3000,
      beforeConfirm: async () => {
        operatingId.value = row.id
        try {
          await configApi.deleteNotificationChannel(row.workspaceCode, row.id)
          ElMessage.success('通知渠道已删除')
          await Promise.all([loadChannels(), loadRules()])
        } catch (error) {
          ElMessage.error(getRequestErrorMessage(error))
          throw error
        } finally {
          operatingId.value = null
        }
      },
    })
  } catch {
    // 用户取消或关闭弹窗时不需要提示。
  }
}

async function openDeleteRuleConfirm(row: NotificationRuleItem) {
  try {
    await confirmDelete({
      title: '删除通知规则',
      message: `确认删除「${row.ruleName}」？删除后该规则将不再触发任何通知。`,
      confirmText: '确认删除',
      density: 'compact',
      zIndex: 3000,
      beforeConfirm: async () => {
        operatingId.value = row.id
        try {
          await configApi.deleteNotificationRule(row.workspaceCode, row.id)
          ElMessage.success('通知规则已删除')
          await loadRules()
        } catch (error) {
          ElMessage.error(getRequestErrorMessage(error))
          throw error
        } finally {
          operatingId.value = null
        }
      },
    })
  } catch {
    // 用户取消或关闭弹窗时不需要提示。
  }
}

function removeChannel(row: NotificationChannelItem) {
  openDeleteChannelConfirm(row)
}

function openCreateRuleDialog() {
  if (!concreteWorkspaceSelected.value) {
    ElMessage.warning('请先在右上角切换到具体工作空间')
    return
  }
  if (!enabledChannels.value.length) {
    ElMessage.warning('请先创建并启用通知渠道')
    return
  }
  ruleDialogMode.value = 'create'
  editingRule.value = null
  ruleForm.value = defaultRuleForm()
  ruleDialogVisible.value = true
}

function openEditRuleDialog(row: NotificationRuleItem) {
  ruleDialogMode.value = 'edit'
  editingRule.value = row
  ruleForm.value = {
    workspaceCode: row.workspaceCode,
    ruleName: row.ruleName,
    eventType: row.eventType,
    triggerCondition: row.triggerCondition || 'ALWAYS',
    channelIds: [...row.channelIds],
    frequencyLimitSeconds: row.frequencyLimitSeconds,
    status: row.status,
  }
  ruleDialogVisible.value = true
}

function toggleRuleFormStatus() {
  ruleForm.value.status = ruleForm.value.status === 1 ? 0 : 1
}

async function submitRule() {
  if (!ruleForm.value.ruleName.trim() || !ruleForm.value.eventType || !ruleForm.value.channelIds.length) {
    ElMessage.warning('请填写规则名称、触发场景和通知渠道')
    return
  }
  saving.value = true
  try {
    const workspaceCode = ruleForm.value.workspaceCode || props.workspaceCode
    if (ruleDialogMode.value === 'edit' && editingRule.value) {
      await configApi.updateNotificationRule(workspaceCode, editingRule.value.id, ruleForm.value)
      ElMessage.success('通知规则已更新')
    } else {
      await configApi.createNotificationRule(workspaceCode, ruleForm.value)
      ElMessage.success('通知规则已创建')
    }
    ruleDialogVisible.value = false
    await loadRules()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function toggleRule(row: NotificationRuleItem) {
  operatingId.value = row.id
  try {
    const next = row.status === 1 ? 0 : 1
    await configApi.updateNotificationRuleStatus(row.workspaceCode, row.id, next)
    ElMessage.success(next === 1 ? '通知规则已启用' : '通知规则已停用')
    await loadRules()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
  }
}

function removeRule(row: NotificationRuleItem) {
  openDeleteRuleConfirm(row)
}

async function duplicateRule(row: NotificationRuleItem) {
  operatingId.value = row.id
  try {
    await configApi.createNotificationRule(row.workspaceCode, {
      workspaceCode: row.workspaceCode,
      ruleName: `${row.ruleName} - 副本`,
      eventType: row.eventType,
      triggerCondition: row.triggerCondition,
      channelIds: [...row.channelIds],
      frequencyLimitSeconds: row.frequencyLimitSeconds,
      status: 0,
    })
    ElMessage.success('通知规则副本已创建，默认处于停用状态')
    await loadRules()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
  }
}

function onRecordsPageChange(pageNo: number) {
  recordsPageNo.value = pageNo
  void loadRecords()
}

onMounted(() => {
  void loadEventTypes()
  void refreshAll()
})

watch(
  () => props.workspaceCode,
  () => {
    channelDialogVisible.value = false
    ruleDialogVisible.value = false
    void refreshAll()
  },
)

watch([channelKeyword, channelTypeFilter, channelStatusFilter], () => {
  debouncedLoadChannels()
})

watch([ruleKeyword, ruleEventFilter, ruleStatusFilter], () => {
  debouncedLoadRules()
})
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
