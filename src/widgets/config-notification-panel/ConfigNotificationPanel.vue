<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

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
import { debounce } from '@/shared/lib/debounce'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
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
const recordEventFilter = ref('')
const recordChannelFilter = ref<number | ''>('')
const recordStatusFilter = ref('')
const recordDateRange = ref<[Date, Date] | null>(null)

const concreteWorkspaceSelected = computed(() => props.workspaceCode !== 'ALL')

const channelDialogVisible = ref(false)
const channelDialogMode = ref<DialogMode>('create')
const editingChannel = ref<NotificationChannelItem | null>(null)
const channelForm = ref<CreateNotificationChannelPayload>(defaultChannelForm())

const ruleDialogVisible = ref(false)
const ruleDialogMode = ref<DialogMode>('create')
const editingRule = ref<NotificationRuleItem | null>(null)
const ruleForm = ref<CreateNotificationRulePayload>(defaultRuleForm())

const enabledChannels = computed(() => channels.value.filter(item => item.status === 1))
const channelStats = computed(() => ({
  total: channels.value.length,
  enabled: channels.value.filter(item => item.status === 1).length,
  wecom: channels.value.filter(item => item.channelType === 'WECOM_ROBOT').length,
  webhook: channels.value.filter(item => item.channelType === 'WEBHOOK').length,
}))
const ruleStats = computed(() => ({
  total: rules.value.length,
  enabled: rules.value.filter(item => item.status === 1).length,
}))

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

function resetRecordFilters() {
  recordEventFilter.value = ''
  recordChannelFilter.value = ''
  recordStatusFilter.value = ''
  recordDateRange.value = null
  recordsPageNo.value = 1
  void loadRecords()
}

function openCreateChannelDialog() {
  if (!concreteWorkspaceSelected.value) {
    ElMessage.warning('请先在右上角切换到具体工作空间')
    return
  }
  channelDialogMode.value = 'create'
  editingChannel.value = null
  channelForm.value = defaultChannelForm()
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
  channelDialogVisible.value = true
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

async function removeChannel(row: NotificationChannelItem) {
  const confirmed = await confirmDelete(`确定删除通知渠道「${row.channelName}」吗？`)
  if (!confirmed) {
    return
  }
  operatingId.value = row.id
  try {
    await configApi.deleteNotificationChannel(row.workspaceCode, row.id)
    ElMessage.success('通知渠道已删除')
    await Promise.all([loadChannels(), loadRules()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
  }
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

async function removeRule(row: NotificationRuleItem) {
  const confirmed = await confirmDelete(`确定删除通知规则「${row.ruleName}」吗？`)
  if (!confirmed) {
    return
  }
  operatingId.value = row.id
  try {
    await configApi.deleteNotificationRule(row.workspaceCode, row.id)
    ElMessage.success('通知规则已删除')
    await loadRules()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operatingId.value = null
  }
}

async function confirmDelete(message: string) {
  return ElMessageBox.confirm(message, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(
    () => true,
    () => false,
  )
}

function statusTagType(status: string | number) {
  if (status === 1 || status === 'SUCCESS') {
    return 'success'
  }
  if (status === 'FAILED') {
    return 'danger'
  }
  return 'info'
}

function formatStatus(status: ConfigStatus) {
  return status === 1 ? '启用' : '停用'
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
  <section class="config-panel notification-panel">
    <header class="config-panel__header">
      <div>
        <h2>通知配置</h2>
        <p>维护自动化执行结果的公共通知渠道、触发规则和发送记录。</p>
      </div>
      <div class="config-panel__actions">
        <AppButton :icon="RefreshRight" :loading="channelsLoading || rulesLoading || recordsLoading" @click="refreshAll">刷新</AppButton>
      </div>
    </header>

    <div class="notification-summary">
      <div class="notification-summary__item">
        <span>通知渠道</span>
        <strong>{{ channelStats.total }}</strong>
      </div>
      <div class="notification-summary__item">
        <span>启用渠道</span>
        <strong>{{ channelStats.enabled }}</strong>
      </div>
      <div class="notification-summary__item">
        <span>通知规则</span>
        <strong>{{ ruleStats.total }}</strong>
      </div>
      <div class="notification-summary__item">
        <span>启用规则</span>
        <strong>{{ ruleStats.enabled }}</strong>
      </div>
    </div>

    <el-alert
      v-if="!concreteWorkspaceSelected"
      class="notification-panel__workspace-tip"
      title="当前为全部空间视图，可以查看通知配置；新增渠道或规则前请切换到具体工作空间。"
      type="info"
      :closable="false"
      show-icon
    />
    <el-alert
      v-if="errorMessage"
      class="notification-panel__workspace-tip"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />

    <el-tabs v-model="activeTab" class="notification-tabs">
      <el-tab-pane label="通知渠道" name="channels">
        <div class="notification-tab-toolbar">
          <span>公共渠道列表</span>
          <AppButton type="primary" :icon="Plus" @click="openCreateChannelDialog">新建渠道</AppButton>
        </div>

        <AppLoadingState v-if="channelsLoading && !channels.length" text="正在加载通知渠道..." />
        <AppEmptyState
          v-else-if="!channels.length"
          title="暂无通知渠道"
          description="创建企业微信机器人或通用 Webhook 后，可在通知规则中引用。"
        />
        <el-table v-else v-loading="channelsLoading" :data="channels" border>
          <el-table-column prop="channelName" label="渠道名称" min-width="180" />
          <el-table-column prop="channelTypeName" label="渠道类型" width="150" />
          <el-table-column prop="workspaceName" label="工作空间" width="140" />
          <el-table-column label="状态" width="96">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ formatStatus(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column prop="updatedAt" label="更新时间" width="170">
            <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="270" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :loading="testingChannelId === row.id" @click="testChannel(row)">测试发送</el-button>
              <el-button type="primary" link size="small" @click="openEditChannelDialog(row)">编辑</el-button>
              <el-button type="primary" link size="small" :loading="operatingId === row.id" @click="toggleChannel(row)">
                {{ row.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button type="danger" link size="small" :loading="operatingId === row.id" @click="removeChannel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="通知规则" name="rules">
        <div class="notification-tab-toolbar">
          <span>触发规则列表</span>
          <AppButton type="primary" :icon="Plus" @click="openCreateRuleDialog">新建规则</AppButton>
        </div>

        <AppLoadingState v-if="rulesLoading && !rules.length" text="正在加载通知规则..." />
        <AppEmptyState
          v-else-if="!rules.length"
          title="暂无通知规则"
          description="规则负责把接口套件和 Web UI 的执行结果发送到指定渠道。"
        />
        <el-table v-else v-loading="rulesLoading" :data="rules" border>
          <el-table-column prop="ruleName" label="规则名称" min-width="190" />
          <el-table-column prop="eventName" label="触发场景" min-width="180" />
          <el-table-column label="关联渠道" min-width="220">
            <template #default="{ row }">
              <el-tag v-for="item in row.channelNames" :key="item" class="notification-tag" size="small">
                {{ item }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="触发条件" width="120">
            <template #default="{ row }">{{ formatCondition(row.triggerCondition) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="96">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ formatStatus(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="更新时间" width="170">
            <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openEditRuleDialog(row)">编辑</el-button>
              <el-button type="primary" link size="small" :loading="operatingId === row.id" @click="toggleRule(row)">
                {{ row.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button type="danger" link size="small" :loading="operatingId === row.id" @click="removeRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="通知记录" name="records">
        <div class="config-filter-toolbar notification-record-toolbar">
          <el-date-picker
            v-model="recordDateRange"
            class="notification-date-range"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            range-separator="至"
          />
          <el-select v-model="recordEventFilter" class="config-filter-control" clearable placeholder="触发场景">
            <el-option
              v-for="item in eventTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select v-model="recordChannelFilter" class="config-filter-control" clearable placeholder="通知渠道">
            <el-option
              v-for="item in channels"
              :key="item.id"
              :label="item.channelName"
              :value="item.id"
            />
          </el-select>
          <el-select v-model="recordStatusFilter" class="config-filter-control" clearable placeholder="发送状态">
            <el-option
              v-for="item in notificationSendStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <div class="notification-record-toolbar__actions">
            <AppButton type="primary" :icon="Search" @click="loadRecords">查询</AppButton>
            <AppButton :icon="RefreshRight" @click="resetRecordFilters">重置</AppButton>
          </div>
        </div>

        <AppLoadingState v-if="recordsLoading && !records.length" text="正在加载通知记录..." />
        <AppEmptyState
          v-else-if="!records.length"
          title="暂无通知记录"
          description="接口套件或 Web UI 执行触发通知后，会在这里留下发送结果。"
        />
        <template v-else>
          <el-table v-loading="recordsLoading" :data="records" border>
            <el-table-column prop="createdAt" label="触发时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="eventName" label="触发场景" min-width="170" />
            <el-table-column prop="targetName" label="执行对象" min-width="180" show-overflow-tooltip />
            <el-table-column prop="ruleName" label="规则名称" min-width="160" show-overflow-tooltip />
            <el-table-column prop="channelName" label="通知渠道" min-width="150" show-overflow-tooltip />
            <el-table-column label="发送状态" width="110">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.sendStatus)" size="small">
                  {{ row.sendStatus === 'SUCCESS' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
          </el-table>
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
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="channelDialogVisible"
      :title="channelDialogMode === 'edit' ? '编辑通知渠道' : '新建通知渠道'"
      width="620px"
      destroy-on-close
    >
      <el-form label-width="108px">
        <el-form-item label="渠道名称" required>
          <el-input v-model="channelForm.channelName" maxlength="80" placeholder="例如：测试执行告警群" />
        </el-form-item>
        <el-form-item label="渠道类型" required>
          <el-select v-model="channelForm.channelType" class="notification-form-control">
            <el-option
              v-for="item in notificationChannelTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Webhook" required>
          <el-input v-model="channelForm.webhookUrl" placeholder="https://..." />
        </el-form-item>
        <template v-if="channelForm.channelType === 'WEBHOOK'">
          <el-form-item label="请求方式">
            <el-select v-model="channelForm.httpMethod" class="notification-form-control">
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
            </el-select>
          </el-form-item>
          <el-form-item label="请求头">
            <el-input
              v-model="channelForm.headersJson"
              type="textarea"
              :rows="3"
              placeholder='{"Authorization":"Bearer token"}'
            />
          </el-form-item>
          <el-form-item label="请求体模板">
            <el-input
              v-model="channelForm.bodyTemplate"
              type="textarea"
              :rows="4"
              placeholder='{"text":"{{title}} {{targetName}} {{result}}"}'
            />
          </el-form-item>
        </template>
        <el-form-item label="超时/重试">
          <div class="notification-inline-fields">
            <el-input-number v-model="channelForm.timeoutMs" :min="1000" :max="60000" :step="1000" />
            <span>ms</span>
            <el-input-number v-model="channelForm.retryCount" :min="0" :max="5" />
            <span>次</span>
          </div>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="channelForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="channelForm.remark" type="textarea" :rows="2" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitChannel">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="ruleDialogMode === 'edit' ? '编辑通知规则' : '新建通知规则'"
      width="620px"
      destroy-on-close
    >
      <el-form label-width="108px">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.ruleName" maxlength="80" placeholder="例如：接口套件失败通知" />
        </el-form-item>
        <el-form-item label="触发场景" required>
          <el-select v-model="ruleForm.eventType" class="notification-form-control">
            <el-option
              v-for="item in eventTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="通知渠道" required>
          <el-select v-model="ruleForm.channelIds" class="notification-form-control" multiple collapse-tags collapse-tags-tooltip>
            <el-option
              v-for="item in enabledChannels"
              :key="item.id"
              :label="item.channelName"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="触发条件">
          <el-select v-model="ruleForm.triggerCondition" class="notification-form-control">
            <el-option
              v-for="item in notificationTriggerConditionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="频率限制">
          <div class="notification-inline-fields">
            <el-input-number v-model="ruleForm.frequencyLimitSeconds" :min="0" :max="3600" :step="30" />
            <span>秒内最多触发一次，0 表示不限制</span>
          </div>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="ruleForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRule">保存</el-button>
      </template>
    </el-dialog>
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
  display: grid;
  grid-template-columns: minmax(260px, 1.35fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr) minmax(130px, 0.7fr) auto;
  align-items: center;
  gap: var(--app-space-2);
}

.notification-date-range {
  width: 100%;
}

.notification-record-toolbar .config-filter-control {
  width: 100%;
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
</style>
