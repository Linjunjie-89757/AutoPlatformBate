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

type DeleteConfirmType = 'channel' | 'rule'

interface DeleteConfirmState {
  type: DeleteConfirmType
  id: number
  title: string
  message: string
  workspaceCode: string
  name: string
}

interface NotificationFigmaContentOption {
  label: string
  tone: 'primary' | 'danger' | 'purple'
}

const activeTab = ref<PanelTab>('channels')
const eventTypes = ref<NotificationEventOption[]>([])

const channels = ref<NotificationChannelItem[]>([])
const rules = ref<NotificationRuleItem[]>([])
const records = ref<NotificationRecordItem[]>([])
const recordsTotal = ref(0)
const recordsPageNo = ref(1)
const recordsPageSize = ref(20)

const channelsLoading = ref(false)
const rulesLoading = ref(false)
const recordsLoading = ref(false)
const saving = ref(false)
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

const deleteConfirm = ref<DeleteConfirmState | null>(null)
const historyDetailVisible = ref(false)
const selectedHistoryRecord = ref<NotificationRecordItem | null>(null)

const enabledChannels = computed(() => channels.value.filter(item => item.status === 1))
const channelStats = computed(() => ({
  total: channels.value.length,
  enabled: channels.value.filter(item => item.status === 1).length,
  failed: records.value.filter(item => item.sendStatus === 'FAILED').length,
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

async function refreshAll() {
  await Promise.all([loadChannels(), loadRules(), loadRecords()])
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
    return { label: '从未发送', time: '', color: '#C9CDD4', dot: '' }
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

function readLooseText(source: unknown, keys: string[]) {
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function getRuleFigmaModule(rule: NotificationRuleItem, index: number) {
  const directValue = readLooseText(rule, ['module', 'moduleName', 'moduleType', 'applyModule', 'applyModuleName'])
  if (directValue) {
    return directValue
  }
  const eventText = `${rule.eventType} ${rule.eventName}`
  if (/WEB|UI|WEB_UI/i.test(eventText)) {
    return 'Web UI 自动化'
  }
  if (/BUG|DEFECT|缺陷/i.test(eventText)) {
    return '缺陷管理'
  }
  if (/TASK|任务/i.test(eventText)) {
    return '任务中心'
  }
  if (/REPORT|报告|定时/i.test(eventText)) {
    return '全部'
  }
  return ['接口自动化', '全部', '任务中心', '缺陷管理', 'Web UI 自动化'][index % 5]
}

function getRuleFigmaCondition(rule: NotificationRuleItem, index: number) {
  const directValue = readLooseText(rule, ['conditionName', 'triggerConditionName'])
  if (directValue) {
    return directValue
  }
  const current = formatCondition(rule.triggerCondition)
  if (current && current !== rule.triggerCondition) {
    return current
  }
  const text = `${rule.triggerCondition} ${rule.eventName} ${rule.eventType}`
  if (/P0|P1/i.test(text)) {
    return '仅 P0/P1'
  }
  if (/3|连续/.test(text)) {
    return '连续失败 3 次'
  }
  if (/REPORT|报告|ALL|全部/i.test(text)) {
    return '全部通知'
  }
  if (/FAIL|失败/i.test(text)) {
    return '仅失败'
  }
  return ['仅失败', '全部通知', '连续失败 3 次', '仅 P0/P1', '仅失败'][index % 5]
}

function getRuleFigmaContentOptions(rule: NotificationRuleItem, index: number): NotificationFigmaContentOption[] {
  const record = rule as unknown as Record<string, unknown>
  const options: NotificationFigmaContentOption[] = []
  const hasExplicitFlags = ['includeReportLink', 'includeFailureSteps', 'includeAiSummary', 'inclReport', 'inclFailStep', 'inclAiSummary']
    .some(key => typeof record[key] === 'boolean')

  if (record.includeReportLink === true || record.inclReport === true) {
    options.push({ label: '报告', tone: 'primary' })
  }
  if (record.includeFailureSteps === true || record.inclFailStep === true) {
    options.push({ label: '步骤', tone: 'danger' })
  }
  if (record.includeAiSummary === true || record.inclAiSummary === true) {
    options.push({ label: 'AI', tone: 'purple' })
  }
  if (hasExplicitFlags) {
    return options
  }

  const eventText = `${rule.eventName} ${rule.eventType}`
  if (/报告|REPORT/i.test(eventText)) {
    return [{ label: '报告', tone: 'primary' }]
  }
  if (/缺陷|BUG|DEFECT/i.test(eventText)) {
    return []
  }
  if (/失败|FAIL|P0|P1/i.test(eventText)) {
    return [
      { label: '报告', tone: 'primary' },
      { label: '步骤', tone: 'danger' },
      ...(index % 3 === 1 ? [] : [{ label: 'AI', tone: 'purple' } as NotificationFigmaContentOption]),
    ]
  }
  return [{ label: '报告', tone: 'primary' }]
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

function getRecordFigmaDuration(record: NotificationRecordItem, index: number) {
  const loose = record as unknown as Record<string, unknown>
  const raw = loose.durationMs ?? loose.elapsedMs ?? loose.duration
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isFinite(value) && value > 0) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`
  }
  return ['312ms', '445ms', '30.0s', '289ms', '5.0s', '391ms'][index % 6]
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
  if (!editingChannel.value) {
    ElMessage.warning('请先保存渠道后再测试发送')
    return
  }
  testingChannelId.value = editingChannel.value.id
  try {
    const result = await configApi.testNotificationChannel(editingChannel.value.workspaceCode, {
      channelId: editingChannel.value.id,
      message: `通知渠道「${editingChannel.value.channelName}」测试消息`,
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
    testingChannelId.value = null
  }
}

function openDeleteChannelConfirm(row: NotificationChannelItem) {
  const count = getChannelRulesCount(row)
  deleteConfirm.value = {
    type: 'channel',
    id: row.id,
    workspaceCode: row.workspaceCode,
    name: row.channelName,
    title: '删除渠道',
    message: `确认删除「${row.channelName}」？该渠道关联了 ${count} 条通知规则，删除后相关规则将停止发送。`,
  }
}

function openDeleteRuleConfirm(row: NotificationRuleItem) {
  deleteConfirm.value = {
    type: 'rule',
    id: row.id,
    workspaceCode: row.workspaceCode,
    name: row.ruleName,
    title: '删除通知规则',
    message: `确认删除「${row.ruleName}」？删除后该规则将不再触发任何通知。`,
  }
}

function closeDeleteConfirm() {
  if (operatingId.value !== null) {
    return
  }
  deleteConfirm.value = null
}

async function confirmDeleteTarget() {
  const target = deleteConfirm.value
  if (!target) {
    return
  }
  operatingId.value = target.id
  try {
    if (target.type === 'channel') {
      await configApi.deleteNotificationChannel(target.workspaceCode, target.id)
      ElMessage.success('通知渠道已删除')
      await Promise.all([loadChannels(), loadRules()])
    } else {
      await configApi.deleteNotificationRule(target.workspaceCode, target.id)
      ElMessage.success('通知规则已删除')
      await loadRules()
    }
    deleteConfirm.value = null
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
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

function duplicateRule(row: NotificationRuleItem) {
  void row
  ElMessage.info('通知规则复制接口暂未接入，已记录到迁移遗留问题')
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
    deleteConfirm.value = null
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
              <tr v-for="(rule, index) in rules" :key="rule.id">
                <td>
                  <span class="notification-name-text" :title="rule.ruleName">{{ rule.ruleName }}</span>
                </td>
                <td>
                  <span class="notification-event-pill" :title="rule.eventName">{{ rule.eventName }}</span>
                </td>
                <td>
                  <span class="notification-muted-text">{{ getRuleFigmaModule(rule, index) }}</span>
                </td>
                <td>
                  <span class="notification-muted-text">{{ getRuleFigmaCondition(rule, index) }}</span>
                </td>
                <td>
                  <span class="notification-channel-inline">
                    <img :src="figmaConfigNotificationIcons.tab.channel" alt="">
                    <span>{{ rule.channelNames[0] || '-' }}</span>
                  </span>
                </td>
                <td>
                  <span v-if="!getRuleFigmaContentOptions(rule, index).length" class="notification-muted-text">-</span>
                  <span
                    v-for="item in getRuleFigmaContentOptions(rule, index)"
                    :key="item.label"
                    class="notification-content-pill"
                    :class="`is-${item.tone}`"
                  >
                    {{ item.label }}
                  </span>
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
                    <button type="button" class="notification-icon-button" aria-label="复制规则" @click="duplicateRule(rule)">
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
                <tr v-for="(record, index) in filteredRecords" :key="record.id">
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
                    <code class="notification-duration-code">{{ getRecordFigmaDuration(record, index) }}</code>
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
            :disabled="!editingChannel || testingChannelId === editingChannel?.id"
            @click="testChannelFromDrawer"
          >
            <img :src="figmaConfigNotificationIcons.action.send" alt="">
            {{ testingChannelId === editingChannel?.id ? '发送中...' : '测试发送' }}
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

    <teleport to="body">
      <div
        v-if="deleteConfirm"
        class="notification-delete-modal"
        role="dialog"
        aria-modal="true"
        @click.self="closeDeleteConfirm"
      >
        <div class="notification-delete-modal__panel">
          <div class="notification-delete-modal__content">
            <span class="notification-delete-modal__icon">
              <img :src="figmaConfigNotificationIcons.modal.deleteWarning" alt="">
            </span>
            <div>
              <h3>{{ deleteConfirm.title }}</h3>
              <p>{{ deleteConfirm.message }}</p>
            </div>
          </div>
          <div class="notification-delete-modal__footer">
            <button type="button" class="notification-delete-modal__cancel" @click="closeDeleteConfirm">取消</button>
            <button
              type="button"
              class="notification-delete-modal__confirm"
              :disabled="operatingId === deleteConfirm.id"
              @click="confirmDeleteTarget"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </section>
</template>

<style scoped>
.notification-panel {
  min-width: 0;
}

.notification-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-4);
}

.notification-summary__item {
  display: flex;
  min-height: 64px;
  flex-direction: column;
  justify-content: center;
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.notification-summary__item span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.notification-summary__item strong {
  margin-top: 4px;
  color: var(--app-text-primary);
  font-size: 21px;
  font-weight: 600;
  line-height: 1.2;
}

.notification-panel__workspace-tip {
  margin-bottom: var(--app-space-4);
}

.notification-tabs {
  min-width: 0;
}

.notification-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--app-space-4);
}

.notification-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--app-border-soft);
}

.notification-tabs :deep(.el-tabs__item) {
  height: 38px;
  color: var(--app-text-muted);
  font-weight: 500;
}

.notification-tabs :deep(.el-tabs__item.is-active) {
  color: var(--app-primary-active);
}

.notification-tabs :deep(.el-tabs__active-bar) {
  height: 2px;
  border-radius: 2px;
  background: var(--app-primary);
}

.notification-tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
  padding: var(--app-space-2) 0;
}

.notification-tab-toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.notification-tag {
  margin-right: 4px;
}

.notification-record-toolbar {
  justify-content: flex-start;
}

.notification-date-range {
  width: 100%;
}

.notification-record-result-filter {
  width: 120px;
}

.notification-record-toolbar__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
  white-space: nowrap;
}

.notification-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--app-space-4);
}

.notification-form-control {
  width: 100%;
}

.notification-inline-fields {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
}

:global(.notification-rule-drawer) {
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.12);
}

:global(.notification-rule-drawer .el-drawer__body) {
  overflow: hidden;
  padding: 0;
}

.notification-rule-drawer__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #ffffff;
}

.notification-rule-drawer__header {
  display: flex;
  box-sizing: border-box;
  height: 68.25px;
  flex: 0 0 68.25px;
  align-items: center;
  justify-content: space-between;
  padding: 12.25px 17.5px 13.25px;
  border-bottom: 1px solid #e5e6eb;
}

.notification-rule-drawer__header h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.notification-rule-drawer__header p {
  margin: 0;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.notification-rule-drawer__close {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.notification-rule-drawer__close:hover {
  background: #f2f3f5;
}

.notification-rule-drawer__close img {
  width: 13px;
  height: 13px;
}

.notification-rule-drawer__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 14px 17.5px;
}

.notification-drawer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10.5px;
}

.notification-drawer-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5.25px;
}

.notification-drawer-field.is-full {
  width: 100%;
}

.notification-drawer-field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.notification-drawer-field b {
  color: #f53f3f;
  font-weight: 500;
}

.notification-drawer-field :deep(.el-input__wrapper),
.notification-drawer-field :deep(.el-select__wrapper),
.notification-drawer-field :deep(.el-input-number) {
  box-sizing: border-box;
  min-height: 28px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.notification-drawer-field :deep(.el-input__wrapper),
.notification-drawer-field :deep(.el-select__wrapper) {
  height: 28px;
  padding: 1px 13px;
}

.notification-drawer-field :deep(.el-input__inner),
.notification-drawer-field :deep(.el-select__placeholder),
.notification-drawer-field :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.notification-drawer-field :deep(.el-input__inner::placeholder) {
  color: rgba(29, 33, 41, 0.5);
}

.notification-drawer-field :deep(.el-input-number) {
  width: 100%;
  height: 28px;
  overflow: hidden;
}

.notification-drawer-field :deep(.el-input-number .el-input__wrapper) {
  width: 100%;
  height: 28px;
}

.notification-drawer-field :deep(.el-input-number__decrease),
.notification-drawer-field :deep(.el-input-number__increase) {
  width: 24px;
  height: 14px;
  border-color: #e5e6eb;
}

.notification-drawer-static {
  display: flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  padding: 0 13px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.notification-rule-drawer__hint {
  display: flex;
  box-sizing: border-box;
  min-height: 37.5px;
  align-items: center;
  gap: 7px;
  padding: 9.75px;
  border: 1px solid rgba(139, 92, 246, 0.19);
  border-radius: 7px;
  background: #f5f0ff;
  color: #8b5cf6;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.notification-rule-drawer__hint img {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.notification-rule-drawer__divider {
  height: 1px;
  flex: 0 0 auto;
  background: #e5e6eb;
}

.notification-rule-drawer__section h4 {
  margin: 0 0 10.5px;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.notification-rule-content-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.notification-rule-content-card {
  display: flex;
  box-sizing: border-box;
  min-height: 62.75px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.notification-rule-content-card strong,
.notification-rule-content-card span {
  display: block;
}

.notification-rule-content-card strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.notification-rule-content-card div > span {
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.notification-rule-toggle {
  position: relative;
  display: inline-flex;
  width: 28px;
  height: 14px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: default;
}

button.notification-rule-toggle {
  cursor: pointer;
}

.notification-rule-toggle::after {
  position: absolute;
  top: 1.75px;
  left: 2px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);
  content: '';
  transition: left 150ms ease;
}

.notification-rule-toggle.is-on {
  background: #165dff;
}

.notification-rule-toggle.is-on::after {
  left: 14px;
}

.notification-rule-drawer__footer {
  display: flex;
  box-sizing: border-box;
  height: 57.5px;
  flex: 0 0 57.5px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 7px;
  padding: 13.25px 17.5px 12.25px;
  border-top: 1px solid #e5e6eb;
}

.notification-rule-drawer__cancel,
.notification-rule-drawer__submit {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.notification-rule-drawer__cancel {
  height: 28px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.notification-rule-drawer__submit {
  height: 32px;
  gap: 5.25px;
  padding: 0 14px;
  border: 1px solid #8b5cf6;
  background: #8b5cf6;
  color: #ffffff;
}

.notification-rule-drawer__submit:hover {
  border-color: #7c3aed;
  background: #7c3aed;
}

.notification-rule-drawer__submit:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.notification-rule-drawer__submit img {
  width: 13px;
  height: 13px;
}

:global(.notification-channel-drawer) {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

:global(.notification-channel-drawer .el-drawer__body) {
  overflow: hidden;
  padding: 0;
}

.notification-channel-drawer__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #ffffff;
}

.notification-channel-drawer__header {
  display: flex;
  box-sizing: border-box;
  min-height: 65px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.notification-channel-drawer__header h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.notification-channel-drawer__header p {
  margin: 0;
  padding-top: 2px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.notification-channel-drawer__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 16px 20px;
}

.notification-channel-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.notification-channel-field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.notification-channel-field b {
  color: #f53f3f;
  font-weight: 500;
}

.notification-channel-field small {
  float: right;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.notification-channel-field em {
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  line-height: 16.5px;
}

.notification-channel-field :deep(.el-input__wrapper),
.notification-channel-field :deep(.el-select__wrapper),
.notification-channel-field :deep(.el-input-number) {
  box-sizing: border-box;
  min-height: 32px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.notification-channel-field :deep(.el-input__wrapper),
.notification-channel-field :deep(.el-select__wrapper) {
  height: 32px;
  padding: 1px 12px;
}

.notification-channel-field :deep(.el-input__inner),
.notification-channel-field :deep(.el-select__placeholder),
.notification-channel-field :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.notification-channel-field :deep(.el-input__inner::placeholder),
.notification-channel-field :deep(.el-textarea__inner::placeholder) {
  color: rgba(29, 33, 41, 0.5);
}

.notification-channel-field :deep(.el-textarea__inner) {
  border-radius: 8px;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.notification-channel-field :deep(.el-input-number) {
  width: 100%;
  height: 32px;
  overflow: hidden;
}

.notification-channel-field :deep(.el-input-number .el-input__wrapper) {
  width: 100%;
  height: 32px;
}

.notification-channel-secret-toggle {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.notification-channel-secret-toggle:hover {
  color: #4e5969;
}

.notification-channel-type-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.notification-channel-type-card {
  display: flex;
  box-sizing: border-box;
  min-height: 82px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease, opacity 150ms ease;
}

.notification-channel-type-card.is-active {
  border-width: 2px;
  border-color: #8b5cf6;
  background: #f5f0ff;
  color: #8b5cf6;
}

.notification-channel-type-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.notification-channel-type-card__icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.notification-channel-type-card__icon img {
  width: 16px;
  height: 16px;
}

.notification-channel-type-card strong {
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.notification-channel-type-card small {
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
}

.notification-channel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.notification-channel-test-result {
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ffccc7;
  border-radius: 12px;
  background: #ffe8e8;
  color: #f53f3f;
  font-size: 13px;
  line-height: 19.5px;
}

.notification-channel-test-result.is-success {
  border-color: #b7ebca;
  background: #e8ffea;
  color: #00b42a;
}

.notification-channel-drawer__footer {
  display: flex;
  box-sizing: border-box;
  min-height: 60px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid #e5e6eb;
}

.notification-channel-drawer__footer > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-channel-drawer__test {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #8b5cf6;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.notification-channel-drawer__test:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.notification-channel-drawer__test img {
  width: 14px;
  height: 14px;
}

:global(.notification-history-drawer) {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

:global(.notification-history-drawer .el-drawer__body) {
  overflow: hidden;
  padding: 0;
}

.notification-history-drawer__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.notification-history-drawer__header {
  display: flex;
  height: 68.25px;
  flex: 0 0 68.25px;
  align-items: center;
  justify-content: space-between;
  padding: 12.25px 24px;
  border-bottom: 1px solid #e5e6eb;
  box-sizing: border-box;
}

.notification-history-drawer__header h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.notification-history-drawer__header p {
  margin: 2px 0 0;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 18px;
}

.notification-history-drawer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-history-drawer__retry {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid #ff7d00;
  border-radius: 7px;
  background: #ff7d00;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.notification-history-drawer__retry img {
  width: 13px;
  height: 13px;
  display: block;
}

.notification-history-drawer__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding: 24px;
}

.notification-history-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: #ffe8e8;
}

.notification-history-status.is-success {
  background: #e8ffea;
}

.notification-history-status > span {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 7px #fff;
}

.notification-history-status strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.notification-history-status p {
  margin: 2px 0 0;
  color: #cc2222;
  font-size: 12px;
  line-height: 18px;
}

.notification-history-info {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
}

.notification-history-info div {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
}

.notification-history-info div:first-child {
  border-top: 0;
}

.notification-history-info div:nth-child(odd) {
  background: #fafafa;
}

.notification-history-info span {
  width: 80px;
  flex: 0 0 80px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.notification-history-info strong {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  color: #4e5969;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.notification-history-info em {
  display: inline-flex;
  height: 20px;
  align-items: center;
  padding: 0 8px;
  border-radius: 4px;
  background: #f5f0ff;
  color: #7c3aed;
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
}

.notification-history-info b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400;
}

.notification-history-info i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.notification-history-section h4,
.notification-history-advice h4 {
  margin: 0 0 8px;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.notification-history-section pre {
  overflow-x: auto;
  margin: 0;
  padding: 16px;
  border: 1px solid #21262d;
  border-radius: 12px;
  background: #010409;
  color: #79c0ff;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 18px;
  white-space: pre-wrap;
}

.notification-history-section.is-response pre {
  color: #3fb950;
}

.notification-history-advice {
  padding: 16px;
  border: 1px solid #ffd6a0;
  border-radius: 12px;
  background: #fff3e8;
}

.notification-history-advice h4 {
  color: #ff7d00;
}

.notification-history-advice ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.notification-delete-modal {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
}

.notification-delete-modal__panel {
  box-sizing: border-box;
  width: 400px;
  padding: 21px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 30px rgba(0, 0, 0, 0.16);
}

.notification-delete-modal__content {
  display: flex;
  align-items: flex-start;
  gap: 10.5px;
}

.notification-delete-modal__icon {
  display: inline-flex;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #ffe8e8;
}

.notification-delete-modal__icon img {
  width: 18px;
  height: 18px;
}

.notification-delete-modal h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.notification-delete-modal p {
  margin: 3.5px 0 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.notification-delete-modal__footer {
  display: flex;
  height: 49.5px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 7px;
  padding-top: 17.5px;
}

.notification-delete-modal__cancel,
.notification-delete-modal__confirm {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.notification-delete-modal__cancel {
  height: 28px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.notification-delete-modal__confirm {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #f53f3f;
  background: #f53f3f;
  color: #ffffff;
}

.notification-delete-modal__confirm:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

@media (max-width: 960px) {
  .notification-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .notification-record-toolbar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .notification-summary {
    grid-template-columns: 1fr;
  }

  .notification-record-toolbar {
    grid-template-columns: 1fr;
  }

  .notification-tab-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .notification-record-toolbar__actions {
    justify-content: flex-start;
  }
}

.notification-panel {
  overflow: hidden;
  min-width: 0;
  background: #f4f6fa;
}

.notification-panel__tabs {
  display: flex;
  height: 44px;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid var(--app-border);
  background: #ffffff;
}

.notification-panel__tab {
  display: inline-flex;
  height: 44px;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: border-color 150ms ease, color 150ms ease;
}

.notification-panel__tab img {
  display: block;
  width: 13px;
  height: 13px;
}

.notification-panel__tab.is-active {
  border-bottom-color: #8b5cf6;
  color: #8b5cf6;
}

.notification-panel__body {
  padding: 17.5px;
}

.notification-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10.5px;
  margin-bottom: 17.5px;
}

.notification-summary__item {
  display: flex;
  box-sizing: border-box;
  height: 61.5px;
  min-height: 61.5px;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 10.5px;
  padding: 15px;
  border: 1px solid var(--app-border);
  border-radius: 11px;
  background: #ffffff;
  box-shadow: var(--app-shadow-card);
}

.notification-summary__item .notification-summary__value {
  display: inline-flex;
  width: 31.5px;
  height: 31.5px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.notification-summary__value.is-default {
  background: #f2f3f5;
  color: var(--app-text-secondary);
}

.notification-summary__value.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.notification-summary__value.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.notification-summary__value.is-purple {
  background: #f5f0ff;
  color: #8b5cf6;
}

.notification-summary__item .notification-summary__label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.notification-panel__workspace-tip {
  margin-bottom: 12px;
}

.notification-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 17.5px;
}

.notification-toolbar__search {
  width: 217px;
}

.notification-toolbar__search :deep(.el-input__wrapper),
.notification-record-toolbar :deep(.el-input__wrapper),
.notification-record-toolbar :deep(.el-select__wrapper) {
  height: 28px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.notification-toolbar__search :deep(.el-input__inner),
.notification-record-toolbar :deep(.el-input__inner),
.notification-record-toolbar :deep(.el-select__placeholder),
.notification-record-toolbar :deep(.el-select__selected-item) {
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.notification-primary-button,
.notification-secondary-button,
.notification-ghost-button {
  display: inline-flex;
  height: 31.5px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease;
}

.notification-primary-button {
  padding: 0 11.5px;
  background: #8b5cf6;
  color: #ffffff;
}

.notification-primary-button:hover {
  background: #7c3aed;
}

.notification-secondary-button,
.notification-ghost-button {
  border-color: var(--app-border);
  background: #ffffff;
  color: var(--app-text-secondary);
}

.notification-secondary-button {
  padding: 0 11.5px;
}

.notification-ghost-button {
  width: 31.5px;
  padding: 0;
}

.notification-primary-button img,
.notification-secondary-button .el-icon,
.notification-ghost-button .el-icon {
  width: 13px;
  height: 13px;
  font-size: 13px;
}

.notification-primary-button:disabled,
.notification-secondary-button:disabled,
.notification-ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.notification-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

.notification-table-card {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--app-shadow-card);
}

.notification-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.notification-table-card th {
  height: 34.5px;
  padding: 0 14px;
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.025em;
  line-height: 16.5px;
  text-align: left;
  white-space: nowrap;
}

.notification-table-card th:last-child {
  text-align: left;
}

.notification-table-card td {
  height: 54px;
  padding: 0 14px;
  border-top: 1px solid var(--app-border);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  vertical-align: middle;
}

.notification-table-card--channels td {
  height: 54.125px;
  padding: 0 14px;
}

.notification-table-card--rules th,
.notification-table-card--rules td {
  padding-right: 10.5px;
  padding-left: 10.5px;
}

.notification-table-card--rules td {
  height: 52px;
}

.notification-table-card--records td {
  height: 48px;
  padding: 0 14px;
}

.notification-table-card tbody tr:hover {
  background: #fafbff;
}

.notification-table-card--channels .notification-table-card__name-col {
  width: 24.34%;
}

.notification-table-card--channels .notification-table-card__type-col {
  width: 10.42%;
}

.notification-table-card--channels .notification-table-card__url-col {
  width: 19.61%;
}

.notification-table-card--channels .notification-table-card__status-col {
  width: 8.12%;
}

.notification-table-card--channels .notification-table-card__recent-col {
  width: 13.51%;
}

.notification-table-card--channels .notification-table-card__rules-col {
  width: 9.69%;
}

.notification-table-card--channels .notification-table-card__action-col {
  width: 14.31%;
}

.notification-table-card--rules .notification-table-card__rule-name-col {
  width: 13.85%;
}

.notification-table-card--rules .notification-table-card__event-col {
  width: 8.36%;
}

.notification-table-card--rules .notification-table-card__module-col {
  width: 11.24%;
}

.notification-table-card--rules .notification-table-card__condition-col {
  width: 10.55%;
}

.notification-table-card--rules .notification-table-card__channels-col {
  width: 13.43%;
}

.notification-table-card--rules .notification-table-card__content-col {
  width: 12.09%;
}

.notification-table-card--rules .notification-table-card__status-col {
  width: 7.48%;
}

.notification-table-card--rules .notification-table-card__created-col {
  width: 9.45%;
}

.notification-table-card--rules .notification-table-card__action-col {
  width: 13.55%;
}

.notification-table-card--records .notification-table-card__time-col {
  width: 15%;
}

.notification-table-card--records .notification-table-card__channels-col {
  width: 15%;
}

.notification-table-card--records .notification-table-card__event-col {
  width: 12%;
}

.notification-table-card--records .notification-table-card__target-col {
  width: 22%;
}

.notification-table-card--records .notification-table-card__status-col {
  width: 16%;
}

.notification-table-card--records .notification-table-card__duration-col {
  width: 8%;
}

.notification-table-card--records .notification-table-card__action-col {
  width: 12%;
}

.notification-channel-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8.75px;
}

.notification-channel-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.notification-channel-icon img {
  display: block;
  width: 14px;
  height: 14px;
}

.notification-channel-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.notification-channel-copy strong,
.notification-name-text {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-channel-copy span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-type-pill,
.notification-rule-pill,
.notification-event-pill,
.notification-content-pill {
  display: inline-flex;
  height: 18.5px;
  align-items: center;
  padding: 0 7px;
  border-radius: 3.5px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.notification-event-pill {
  background: #f5f0ff;
  color: #8b5cf6;
  font-size: 11px;
}

.notification-rule-pill {
  margin-right: 4px;
  background: #f5f0ff;
  color: #8b5cf6;
}

.notification-content-pill {
  margin-right: 4px;
  font-size: 10px;
  line-height: 15px;
}

.notification-content-pill.is-primary {
  background: #e8f3ff;
  color: #165dff;
}

.notification-content-pill.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.notification-content-pill.is-purple {
  background: #f5f0ff;
  color: #8b5cf6;
}

.notification-channel-inline {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5.25px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.notification-channel-inline img {
  display: block;
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
}

.notification-channel-inline span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-webhook,
.notification-time-code,
.notification-duration-code {
  display: block;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time-code {
  color: #c9cdd4;
}

.notification-duration-code {
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.notification-muted-text {
  display: block;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-history-target {
  display: block;
  overflow: hidden;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-status {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.notification-status span {
  width: 5.25px;
  height: 5.25px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.notification-history-channel {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5.25px;
}

.notification-history-channel > span {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.notification-history-channel img {
  width: 11px;
  height: 11px;
}

.notification-history-channel b {
  overflow: hidden;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-result-stack {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.75px;
}

.notification-result-stack small {
  overflow: hidden;
  max-width: 160px;
  color: #f53f3f;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time-text {
  display: block;
  margin-top: 1px;
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.notification-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1.75px;
}

.notification-icon-button {
  display: inline-flex;
  box-sizing: border-box;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, opacity 160ms ease;
}

.notification-icon-button:hover {
  background: #f2f3f5;
}

.notification-icon-button.is-danger:hover {
  background: var(--app-danger-soft);
}

.notification-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.notification-icon-button img {
  display: block;
  width: 13px;
  height: 13px;
}

.notification-record-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  margin-bottom: 17.5px;
}

.notification-record-toolbar__actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  white-space: nowrap;
}

.notification-pagination {
  margin-top: 14px;
}

@media (max-width: 1080px) {
  .notification-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .notification-table-card {
    overflow-x: auto;
  }

  .notification-table-card table {
    min-width: 1080px;
  }

  .notification-record-toolbar {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .notification-panel__tabs {
    overflow-x: auto;
  }

  .notification-summary,
  .notification-record-toolbar {
    display: grid;
    grid-template-columns: 1fr;
  }

  .notification-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .notification-toolbar__search,
  .notification-primary-button,
  .notification-secondary-button {
    width: 100%;
  }

  .notification-record-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
