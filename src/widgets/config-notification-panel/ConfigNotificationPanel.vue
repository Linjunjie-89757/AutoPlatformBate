<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshRight, Search } from '@element-plus/icons-vue'
import { Eye, EyeOff } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  notificationChannelTypeOptions,
  notificationSendStatusOptions,
  notificationTriggerConditionOptions,
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
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

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
const filteredRecords = computed(() => {
  const keyword = recordKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return records.value
  }
  return records.value.filter(record =>
    [
      record.channelName,
      record.eventName,
      record.eventType,
      record.targetName,
    ].some(value => String(value || '').toLowerCase().includes(keyword)),
  )
})
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

function normalizeChannelType(type: string) {
  return type.trim().toUpperCase()
}

function getChannelTypeLabel(channel: NotificationChannelItem) {
  return channel.channelTypeName || notificationChannelTypeOptions.find(item => item.value === channel.channelType)?.label || channel.channelType
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
  return rules.value.filter(rule => rule.channelIds.includes(channel.id)).length
}

function getChannelLastRecord(channel: NotificationChannelItem) {
  return records.value.find(item => item.channelId === channel.id || item.channelName === channel.channelName) || null
}

function getChannelLastSendMeta(channel: NotificationChannelItem) {
  if (testingChannelId.value === channel.id) {
    return { label: '发送中', time: '', color: '#4E5969', dot: '#165DFF' }
  }
  const record = getChannelLastRecord(channel)
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

function getRuleStatusMeta(rule: NotificationRuleItem) {
  if (rule.status === 1) {
    return { label: '已启用', color: '#4E5969', dot: '#00B42A' }
  }
  return { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
}

function getRuleModule(rule: NotificationRuleItem) {
  if (rule.eventType.startsWith('WEB_UI_')) {
    return 'Web UI 自动化'
  }
  if (rule.eventType.startsWith('API_SUITE_')) {
    return '接口自动化'
  }
  return '—'
}

function getRecordStatusMeta(record: NotificationRecordItem) {
  if (record.sendStatus === 'SUCCESS') {
    return { label: '成功', color: '#00B42A', dot: '#00B42A', bg: '#E8FFEA' }
  }
  return { label: '失败', color: '#F53F3F', dot: '#F53F3F', bg: '#FFE8E8' }
}

function getRecordChannelIcon(record: NotificationRecordItem) {
  const channel = channels.value.find(item => item.id === record.channelId || item.channelName === record.channelName)
  return figmaConfigNotificationIcons.channel[getChannelIconKey(channel?.channelType || '')]
}

function getRecordChannelTone(record: NotificationRecordItem) {
  const channel = channels.value.find(item => item.id === record.channelId || item.channelName === record.channelName)
  return getChannelTypeTone(channel?.channelType || '')
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

function getRecordChannelTypeLabel(record: NotificationRecordItem) {
  const channel = channels.value.find(item => item.id === record.channelId || item.channelName === record.channelName)
  return channel ? getChannelTypeLabel(channel) : '-'
}

function getRecordTargetText(record: NotificationRecordItem) {
  return record.targetName || record.targetType || '-'
}

function getRecordResponseText(record: NotificationRecordItem) {
  return record.responseBody || record.errorMessage || ''
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

function formatCondition(value: string) {
  return notificationTriggerConditionOptions.find(item => item.value === value)?.label || value
}

function formatTime(value: string | null) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 19)
}

function formatShortTime(value: string | null) {
  if (!value) {
    return ''
  }
  return value.replace('T', ' ').slice(0, 16)
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
        <div class="notification-summary">
          <div class="notification-summary__item">
            <span class="notification-summary__value is-default">{{ channelStats.total }}</span>
            <span class="notification-summary__label">渠道总数</span>
          </div>
          <div class="notification-summary__item">
            <span class="notification-summary__value is-success">{{ channelStats.enabled }}</span>
            <span class="notification-summary__label">已启用</span>
          </div>
          <div class="notification-summary__item">
            <span class="notification-summary__value is-danger">{{ channelStats.failed }}</span>
            <span class="notification-summary__label">发送异常</span>
          </div>
          <div class="notification-summary__item">
            <span class="notification-summary__value is-purple">{{ channelStats.rules }}</span>
            <span class="notification-summary__label">关联规则</span>
          </div>
        </div>

        <div v-if="!errorMessage" class="notification-toolbar">
          <el-input
            v-model="channelKeyword"
            class="notification-toolbar__search"
            clearable
            placeholder="搜索渠道名称或类型"
            :prefix-icon="Search"
          />
          <button type="button" class="notification-primary-button" @click="openCreateChannelDialog">
            <img :src="figmaConfigNotificationIcons.plus" alt="">
            新增渠道
          </button>
        </div>

        <div v-else-if="channels.length" class="notification-inline-error">
          {{ errorMessage }}
          <button type="button" class="notification-secondary-button" @click="loadChannels">
            <el-icon><RefreshRight /></el-icon>
            重试
          </button>
        </div>

        <AppLoadingState v-if="channelsLoading && !channels.length" text="正在加载通知渠道..." />
        <AppEmptyState
          v-else-if="!channels.length"
          title="暂无通知渠道"
          description="创建企业微信机器人或通用 Webhook 后，可在通知规则中引用。"
        />
        <div v-else class="notification-table-card notification-table-card--channels" v-loading="channelsLoading">
          <table>
            <colgroup>
              <col class="notification-table-card__name-col">
              <col class="notification-table-card__type-col">
              <col class="notification-table-card__url-col">
              <col class="notification-table-card__status-col">
              <col class="notification-table-card__recent-col">
              <col class="notification-table-card__rules-col">
              <col class="notification-table-card__action-col">
            </colgroup>
            <thead>
              <tr>
                <th>渠道名称</th>
                <th>类型</th>
                <th>Webhook 地址</th>
                <th>状态</th>
                <th>最近发送</th>
                <th>关联规则</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="channel in channels" :key="channel.id">
                <td>
                  <div class="notification-channel-cell">
                    <span
                      class="notification-channel-icon"
                      :style="{ color: getChannelTypeTone(channel.channelType).color, backgroundColor: getChannelTypeTone(channel.channelType).bg }"
                    >
                      <img :src="figmaConfigNotificationIcons.channel[getChannelIconKey(channel.channelType)]" alt="">
                    </span>
                    <span class="notification-channel-copy">
                      <strong :title="channel.channelName">{{ channel.channelName }}</strong>
                      <span :title="getChannelSummary(channel)">{{ getChannelSummary(channel) }}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    class="notification-type-pill"
                    :style="{ color: getChannelTypeTone(channel.channelType).color, backgroundColor: getChannelTypeTone(channel.channelType).bg }"
                  >
                    {{ getChannelTypeLabel(channel) }}
                  </span>
                </td>
                <td>
                  <code class="notification-webhook" :title="channel.webhookUrl">{{ channel.webhookUrl }}</code>
                </td>
                <td>
                  <span class="notification-status" :style="{ color: getChannelStatusMeta(channel).color }">
                    <span :style="{ backgroundColor: getChannelStatusMeta(channel).dot }" />
                    {{ getChannelStatusMeta(channel).label }}
                  </span>
                </td>
                <td>
                  <span
                    v-if="getChannelLastSendMeta(channel).dot"
                    class="notification-status"
                    :style="{ color: getChannelLastSendMeta(channel).color }"
                  >
                    <span :style="{ backgroundColor: getChannelLastSendMeta(channel).dot }" />
                    {{ getChannelLastSendMeta(channel).label }}
                  </span>
                  <span v-else class="notification-muted-text">{{ getChannelLastSendMeta(channel).label }}</span>
                  <small v-if="getChannelLastSendMeta(channel).time" class="notification-time-text">
                    {{ getChannelLastSendMeta(channel).time }}
                  </small>
                </td>
                <td>
                  <span class="notification-rule-pill">{{ getChannelRulesCount(channel) }} 条规则</span>
                </td>
                <td>
                  <div class="notification-row-actions">
                    <button
                      type="button"
                      class="notification-icon-button"
                      aria-label="测试发送"
                      :disabled="testingChannelId === channel.id"
                      @click="testChannel(channel)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.send" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button"
                      aria-label="编辑渠道"
                      @click="openEditChannelDialog(channel)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.edit" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button"
                      :aria-label="channel.status === 1 ? '停用渠道' : '启用渠道'"
                      :disabled="operatingId === channel.id"
                      @click="toggleChannel(channel)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.power" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button is-danger"
                      aria-label="删除渠道"
                      :disabled="operatingId === channel.id"
                      @click="removeChannel(channel)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.delete" alt="">
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeTab === 'rules'">
        <div class="notification-toolbar">
          <el-input
            v-model="ruleKeyword"
            class="notification-toolbar__search"
            clearable
            placeholder="搜索规则名称或事件"
            :prefix-icon="Search"
          />
          <button type="button" class="notification-primary-button" @click="openCreateRuleDialog">
            <img :src="figmaConfigNotificationIcons.plus" alt="">
            新增规则
          </button>
        </div>

        <AppLoadingState v-if="rulesLoading && !rules.length" text="正在加载通知规则..." />
        <AppEmptyState
          v-else-if="!rules.length"
          title="暂无通知规则"
          description="规则负责把接口套件和 Web UI 的执行结果发送到指定渠道。"
        />
        <div v-else class="notification-table-card notification-table-card--rules" v-loading="rulesLoading">
          <table>
            <colgroup>
              <col class="notification-table-card__rule-name-col">
              <col class="notification-table-card__event-col">
              <col class="notification-table-card__module-col">
              <col class="notification-table-card__condition-col">
              <col class="notification-table-card__channels-col">
              <col class="notification-table-card__content-col">
              <col class="notification-table-card__status-col">
              <col class="notification-table-card__created-col">
              <col class="notification-table-card__action-col">
            </colgroup>
            <thead>
              <tr>
                <th>规则名称</th>
                <th>触发事件</th>
                <th>适用模块</th>
                <th>触发条件</th>
                <th>通知渠道</th>
                <th>内容选项</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in rules" :key="rule.id">
                <td>
                  <span class="notification-name-text" :title="rule.ruleName">{{ rule.ruleName }}</span>
                </td>
                <td>
                  <span class="notification-event-pill" :title="rule.eventName">{{ rule.eventName }}</span>
                </td>
                <td>
                  <span class="notification-muted-text">{{ getRuleModule(rule) }}</span>
                </td>
                <td>
                  <span class="notification-muted-text">{{ formatCondition(rule.triggerCondition) }}</span>
                </td>
                <td>
                  <span class="notification-channel-inline">
                    <img :src="figmaConfigNotificationIcons.tab.channel" alt="">
                    <span>{{ rule.channelNames[0] || '-' }}</span>
                  </span>
                </td>
                <td>
                  <span class="notification-muted-text">—</span>
                </td>
                <td>
                  <span class="notification-status" :style="{ color: getRuleStatusMeta(rule).color }">
                    <span :style="{ backgroundColor: getRuleStatusMeta(rule).dot }" />
                    {{ getRuleStatusMeta(rule).label }}
                  </span>
                </td>
                <td>
                  <code class="notification-time-code">{{ formatTime(rule.createdAt) }}</code>
                </td>
                <td>
                  <div class="notification-row-actions">
                    <button type="button" class="notification-icon-button" aria-label="编辑规则" @click="openEditRuleDialog(rule)">
                      <img :src="figmaConfigNotificationIcons.action.edit" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button"
                      aria-label="复制规则"
                      :disabled="operatingId === rule.id"
                      @click="duplicateRule(rule)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.copy" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button"
                      :aria-label="rule.status === 1 ? '停用规则' : '启用规则'"
                      :disabled="operatingId === rule.id"
                      @click="toggleRule(rule)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.power" alt="">
                    </button>
                    <button
                      type="button"
                      class="notification-icon-button is-danger"
                      aria-label="删除规则"
                      :disabled="operatingId === rule.id"
                      @click="removeRule(rule)"
                    >
                      <img :src="figmaConfigNotificationIcons.action.delete" alt="">
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <div class="notification-toolbar notification-record-toolbar">
          <el-input
            v-model="recordKeyword"
            class="notification-toolbar__search"
            clearable
            placeholder="搜索渠道、事件或关联对象"
            :prefix-icon="Search"
          />
          <el-select v-model="recordStatusFilter" class="notification-record-result-filter" clearable placeholder="全部结果" @change="loadRecords">
            <el-option
              v-for="item in notificationSendStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <AppLoadingState v-if="recordsLoading && !records.length" text="正在加载通知记录..." />
        <AppEmptyState
          v-else-if="!records.length"
          title="暂无通知记录"
          description="接口套件或 Web UI 执行触发通知后，会在这里留下发送结果。"
        />
        <template v-else>
          <div class="notification-table-card notification-table-card--records" v-loading="recordsLoading">
            <table>
              <colgroup>
                <col class="notification-table-card__time-col">
                <col class="notification-table-card__channels-col">
                <col class="notification-table-card__event-col">
                <col class="notification-table-card__target-col">
                <col class="notification-table-card__status-col">
                <col class="notification-table-card__duration-col">
                <col class="notification-table-card__action-col">
              </colgroup>
              <thead>
                <tr>
                  <th>发送时间</th>
                  <th>通知渠道</th>
                  <th>触发事件</th>
                  <th>关联对象</th>
                  <th>结果</th>
                  <th>耗时</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in filteredRecords" :key="record.id">
                  <td><code class="notification-time-code">{{ formatTime(record.sentAt || record.triggeredAt || record.createdAt) }}</code></td>
                  <td>
                    <span class="notification-history-channel">
                      <span :style="{ color: getRecordChannelTone(record).color, backgroundColor: getRecordChannelTone(record).bg }">
                        <img :src="getRecordChannelIcon(record)" alt="">
                      </span>
                      <b :title="record.channelName || ''">{{ record.channelName || '-' }}</b>
                    </span>
                  </td>
                  <td><span class="notification-event-pill" :title="record.eventName">{{ record.eventName }}</span></td>
                  <td><span class="notification-history-target" :title="record.targetName || ''">{{ record.targetName || '-' }}</span></td>
                  <td>
                    <div class="notification-result-stack">
                      <span class="notification-status" :style="{ color: getRecordStatusMeta(record).color }">
                        <span :style="{ backgroundColor: getRecordStatusMeta(record).dot }" />
                        {{ getRecordStatusMeta(record).label }}
                      </span>
                      <small v-if="record.sendStatus !== 'SUCCESS' && record.errorMessage" :title="record.errorMessage">{{ record.errorMessage }}</small>
                    </div>
                  </td>
                  <td>
                    <code class="notification-duration-code">—</code>
                  </td>
                  <td>
                    <div class="notification-row-actions">
                      <button type="button" class="notification-icon-button" aria-label="查看发送详情" @click="openHistoryDetail(record)">
                        <img :src="figmaConfigNotificationIcons.action.eye" alt="">
                      </button>
                      <button
                        v-if="record.sendStatus !== 'SUCCESS'"
                        type="button"
                        class="notification-icon-button"
                        aria-label="重试发送"
                        @click="retryHistoryRecord(record)"
                      >
                        <img :src="figmaConfigNotificationIcons.action.retry" alt="">
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="notification-pagination">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :current-page="recordsPageNo"
              :page-size="recordsPageSize"
              :total="recordsTotal"
              @current-change="onRecordsPageChange"
            />
          </div>
        </template>
      </template>
    </div>

    <el-drawer
      v-model="channelDialogVisible"
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
          <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="channelDialogVisible = false">
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
                @click="selectChannelType(card)"
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
                  @click="toggleChannelSecretVisible"
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
              <el-input
                v-model="channelForm.headersJson"
                type="textarea"
                :rows="3"
                placeholder='{"Authorization":"Bearer token"}'
              />
            </label>
            <label class="notification-channel-field">
              <span>请求体模板</span>
              <el-input
                v-model="channelForm.bodyTemplate"
                type="textarea"
                :rows="4"
                placeholder='{"text":"{{title}} {{targetName}} {{result}}"}'
              />
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
              @click="toggleChannelFormStatus"
            />
          </article>

          <label class="notification-channel-field">
            <span>备注</span>
            <el-input v-model="channelForm.remark" type="textarea" :rows="2" maxlength="200" placeholder="可选，描述该渠道的用途" />
          </label>

          <div
            v-if="channelTestResult"
            class="notification-channel-test-result"
            :class="{ 'is-success': channelTestResult.success }"
          >
            {{ channelTestResult.message }}
          </div>
        </div>

        <footer class="notification-channel-drawer__footer">
          <button
            type="button"
            class="notification-channel-drawer__test"
            :disabled="testingChannelDraft || !channelForm.webhookUrl.trim()"
            @click="testChannelFromDrawer"
          >
            <img :src="figmaConfigNotificationIcons.action.send" alt="">
            {{ testingChannelDraft ? '发送中...' : '测试发送' }}
          </button>
          <div>
            <button type="button" class="notification-rule-drawer__cancel" @click="channelDialogVisible = false">取消</button>
            <button type="button" class="notification-rule-drawer__submit" :disabled="saving" @click="submitChannel">
              <img :src="figmaConfigNotificationIcons.drawer.save" alt="">
              {{ channelDialogMode === 'edit' ? '保存修改' : '添加渠道' }}
            </button>
          </div>
        </footer>
      </div>
    </el-drawer>

    <el-drawer
      v-model="ruleDialogVisible"
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
          <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="ruleDialogVisible = false">
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
                <el-option
                  v-for="item in eventTypes"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
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
                <el-option
                  v-for="item in notificationTriggerConditionOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </label>
            <label class="notification-drawer-field">
              <span>通知渠道 <b>*</b></span>
              <el-select
                v-model="ruleForm.channelIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择通知渠道"
              >
                <el-option
                  v-for="item in enabledChannels"
                  :key="item.id"
                  :label="item.channelName"
                  :value="item.id"
                />
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
              <article
                v-for="item in ruleContentPreviewOptions"
                :key="item.key"
                class="notification-rule-content-card"
              >
                <div>
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.description }}</span>
                </div>
                <span
                  class="notification-rule-toggle"
                  :class="{ 'is-on': item.enabled }"
                  aria-hidden="true"
                />
              </article>
            </div>
          </section>

          <div class="notification-rule-drawer__divider" />

          <article class="notification-rule-content-card">
            <div>
              <strong>启用此规则</strong>
              <span>停用后该规则不会触发任何通知</span>
            </div>
            <button
              type="button"
              class="notification-rule-toggle"
              :class="{ 'is-on': ruleForm.status === 1 }"
              :aria-pressed="ruleForm.status === 1"
              @click="toggleRuleFormStatus"
            />
          </article>
        </div>

        <footer class="notification-rule-drawer__footer">
          <button type="button" class="notification-rule-drawer__cancel" @click="ruleDialogVisible = false">取消</button>
          <button type="button" class="notification-rule-drawer__submit" :disabled="saving" @click="submitRule">
            <img :src="figmaConfigNotificationIcons.drawer.save" alt="">
            {{ ruleDialogMode === 'edit' ? '保存规则' : '创建规则' }}
          </button>
        </footer>
      </div>
    </el-drawer>

    <el-drawer
      v-model="historyDetailVisible"
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
              @click="retryHistoryRecord(selectedHistoryRecord)"
            >
              <img :src="figmaConfigNotificationIcons.action.send" alt="">
              重试发送
            </button>
            <button type="button" class="notification-rule-drawer__close" aria-label="关闭" @click="historyDetailVisible = false">
              <img :src="figmaConfigNotificationIcons.drawer.close" alt="">
            </button>
          </div>
        </header>

        <div class="notification-history-drawer__body">
          <article
            class="notification-history-status"
            :class="{ 'is-success': selectedHistoryRecord.sendStatus === 'SUCCESS' }"
          >
            <span :style="{ backgroundColor: getRecordStatusMeta(selectedHistoryRecord).dot }" />
            <div>
              <strong>{{ selectedHistoryRecord.sendStatus === 'SUCCESS' ? '通知发送成功' : '通知发送失败' }}</strong>
              <p v-if="selectedHistoryRecord.errorMessage">{{ selectedHistoryRecord.errorMessage }}</p>
            </div>
          </article>

          <section class="notification-history-info">
            <div>
              <span>发送时间</span>
              <strong>{{ formatTime(selectedHistoryRecord.sentAt || selectedHistoryRecord.createdAt) }}</strong>
            </div>
            <div>
              <span>通知渠道</span>
              <strong>{{ selectedHistoryRecord.channelName || '-' }}</strong>
            </div>
            <div>
              <span>渠道类型</span>
              <strong>{{ getRecordChannelTypeLabel(selectedHistoryRecord) }}</strong>
            </div>
            <div>
              <span>触发事件</span>
              <strong>
                <em>{{ selectedHistoryRecord.eventName || selectedHistoryRecord.eventType }}</em>
              </strong>
            </div>
            <div>
              <span>关联对象</span>
              <strong>{{ getRecordTargetText(selectedHistoryRecord) }}</strong>
            </div>
            <div>
              <span>发送结果</span>
              <strong>
                <b :style="{ color: getRecordStatusMeta(selectedHistoryRecord).color }">
                  <i :style="{ backgroundColor: getRecordStatusMeta(selectedHistoryRecord).dot }" />
                  {{ getRecordStatusMeta(selectedHistoryRecord).label }}
                </b>
              </strong>
            </div>
            <div>
              <span>耗时</span>
              <strong>-</strong>
            </div>
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

  </section>
</template>

<style scoped src="./config-notification-panel.css"></style>
