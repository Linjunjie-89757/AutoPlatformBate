<script setup lang="ts">
import { computed } from 'vue'
import { Cpu, InfoFilled } from '@element-plus/icons-vue'

import { type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  WEB_UI_LOCATOR_OPTIONS,
  type WebUiElementGroupItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiEnvironmentItem,
  type WebUiElementCollectFilterSummary,
  type WebUiElementCollectFilterDetail,
  type WebUiElementCollectTaskResponse,
  type LocalRunnerTaskDetailResponse,
  type WebUiLocatorContextPathItem,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import type { LocalRunnerHealthView } from '@/entities/web-ui-automation/lib/localRunnerClient'
import type { LocalRunnerTaskPollingStatus } from '@/entities/web-ui-automation/lib/localRunnerClient'
import {
  getCollectCandidateReviewLevel,
  getCollectCandidateReviewMessage,
  formatCollectFilterReason,
  isCollectCandidateSaveable as isAiCandidateSaveable,
  type WebUiCollectCandidateFilter,
} from '@/entities/web-ui-automation/lib/collectTask'
import WebUiElementCollectTaskPanel from './WebUiElementCollectTaskPanel.vue'

type AiCollectMode = 'ONLINE' | 'OFFLINE'
type AiCollectScope = 'ALL' | 'FORM' | 'BUTTON' | 'TABLE' | 'DIALOG'
type AiCollectGroupStrategy = 'AI' | 'CUSTOM'
type AiCandidateFilter = WebUiCollectCandidateFilter

interface AiCollectFormState {
  providerConnectionId: number | null
  environmentId: number | null
  pageUrl: string
  moduleId: number | null
  pageId: number | null
  pageName: string
  groupStrategy: AiCollectGroupStrategy
  groupId: number | null
  groupName: string
  scope: AiCollectScope
  htmlText: string
  screenshotNote: string
}

export interface AiElementCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  confidence: number
  reason: string
  tagName: string | null
  elementType: string | null
  businessMeaning: string | null
  candidateSource: string
  recommendedToSave: boolean
  notRecommendedReason: string | null
  maintenanceSuggestion: string | null
  stabilityNote: string | null
  validationStatus: string
  matchCount: number | null
  validationMessage: string | null
  screenshotBase64: string | null
  saveBlockedReason: string | null
  text?: string | null
  placeholder?: string | null
}

interface AiCandidateSummary {
  total: number
  recommended: number
  passed: number
  failed: number
  multiple: number
  unverified: number
  abnormal: number
  lowConfidence: number
  aiEnhanced: number
  aiSupplement: number
  blocked: number
}

const props = defineProps<{
  modelValue: boolean
  aiCollectMode: AiCollectMode
  aiCollectForm: AiCollectFormState
  aiProviderLoading: boolean
  availableAiProviders: AiProviderConnectionItem[]
  enabledEnvironments: WebUiEnvironmentItem[]
  modules: WebUiElementModuleItem[]
  pageOptions: WebUiElementPageItem[]
  groupOptions: WebUiElementGroupItem[]
  candidates: AiElementCandidate[]
  visibleCandidates: AiElementCandidate[]
  candidateSummary: AiCandidateSummary
  collectFilterSummary: WebUiElementCollectFilterSummary | null
  collectFilterDetails: WebUiElementCollectFilterDetail[]
  collectFilterDetailsLoading: boolean
  collectTask: WebUiElementCollectTaskResponse | null
  collectTaskRefreshing: boolean
  collectTaskPolling: boolean
  selectedCount: number
  candidateFilter: AiCandidateFilter
  collecting: boolean
  localRunnerChecking: boolean
  localRunnerOpening: boolean
  localRunnerCapturing: boolean
  localRunnerValidating: boolean
  localRunnerHealth: LocalRunnerHealthView | null
  localRunnerTaskPollingStatus: LocalRunnerTaskPollingStatus | null
  localRunnerTaskPollingStarting: boolean
  localRunnerDebugTaskCreating: boolean
  localRunnerDebugTask: LocalRunnerTaskDetailResponse | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:aiCollectMode': [value: AiCollectMode]
  'module-change': []
  'page-change': [value: number | null]
  'group-change': [value: number | null]
  'filter-change': [value: AiCandidateFilter]
  generate: []
  'select-recommended': []
  'unselect-risky': []
  'batch-update-group': []
  'preview-screenshot': [candidate: AiElementCandidate]
  'check-local-runner': []
  'open-local-runner-page': []
  'start-task-polling': []
  'create-debug-validate-task': []
  'refresh-debug-task': []
  'preview-debug-screenshot': [screenshotBase64: string]
  'capture-local-runner-page': []
  'refresh-collect-task': []
  'cancel-collect-task': []
  'revalidate-visible-candidates': []
  'restore-filter-detail': [detail: WebUiElementCollectFilterDetail]
  save: []
}>()

function formatAiValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 补充待验证'
  if (status === 'UNVERIFIED') return '未本地验证'
  if (status === 'PASSED') return '已验证'
  if (status === 'FAILED') return '未找到'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '未验证'
  return status || '未验证'
}

function getAiValidationTagType(status?: string | null) {
  if (status === 'AI_UNVERIFIED' || status === 'UNVERIFIED') return 'warning'
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'MULTIPLE') return 'warning'
  return 'info'
}

function formatAiElementType(type?: string | null) {
  if (type === 'FORM') return '表单'
  if (type === 'BUTTON') return '按钮'
  if (type === 'TABLE') return '表格'
  if (type === 'DIALOG') return '弹窗'
  return type || '-'
}

function formatAiCandidateSource(source?: string | null) {
  if (source === 'AI_SUPPLEMENT') return 'AI 补充'
  if (source === 'STATIC_RULE') return '静态规则'
  return '规则候选'
}

function isAiMetadataEnhanced(row: AiElementCandidate) {
  return row.candidateSource !== 'AI_SUPPLEMENT'
    && Boolean(row.businessMeaning || row.maintenanceSuggestion || row.stabilityNote)
}

function getAiCandidateSourceTagType(source?: string | null) {
  return source === 'AI_SUPPLEMENT' ? 'warning' : 'info'
}

function getAiCandidateRowClassName({ row }: { row: AiElementCandidate }) {
  const level = getCollectCandidateReviewLevel(row)
  if (level === 'danger') return 'web-ui-ai-collect__row--danger'
  if (level === 'warning') return 'web-ui-ai-collect__row--warning'
  return ''
}

function recoverableFilterDetailCount() {
  return props.collectFilterDetails.filter(item => item.recoverable).length
}

function formatDebugTaskStatus(status?: string | null) {
  if (status === 'SUCCESS') return '成功'
  if (status === 'FAILED') return '失败'
  if (status === 'DEGRADED') return '降级'
  if (status === 'RUNNING') return '执行中'
  if (status === 'ASSIGNED') return '已领取'
  if (status === 'PENDING') return '等待领取'
  return status || '暂无任务'
}

function getDebugTaskStatusType(status?: string | null) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'RUNNING' || status === 'ASSIGNED') return 'primary'
  return 'info'
}

type DebugTaskResultRow = {
  locatorId: string
  locatorType: string
  locatorValue: string
  validationStatus: string
  matchCount: number
  visible: boolean
  clickable: boolean
  inputtable: boolean
  validationMessage: string | null
  screenshotBase64: string | null
}

const debugTaskSummary = computed(() => {
  const result = props.localRunnerDebugTask?.result as {
    summary?: {
      mode?: string
      total?: number
      passed?: number
      failed?: number
    }
    durationMs?: number
  } | null
  return {
    mode: result?.summary?.mode || '-',
    total: Number(result?.summary?.total || 0),
    passed: Number(result?.summary?.passed || 0),
    failed: Number(result?.summary?.failed || 0),
    durationMs: Number(result?.durationMs || 0),
  }
})

const debugTaskResultRows = computed<DebugTaskResultRow[]>(() => {
  const result = props.localRunnerDebugTask?.result as {
    reportData?: {
      results?: unknown[]
    }
  } | null
  const rows = Array.isArray(result?.reportData?.results) ? result.reportData.results : []
  return rows
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      locatorId: String(item.locatorId || `locator-${index + 1}`),
      locatorType: String(item.locatorType || '-'),
      locatorValue: String(item.locatorValue || ''),
      validationStatus: String(item.validationStatus || 'UNVERIFIED'),
      matchCount: Number(item.matchCount || 0),
      visible: Boolean(item.visible),
      clickable: Boolean(item.clickable),
      inputtable: Boolean(item.inputtable),
      validationMessage: typeof item.validationMessage === 'string' ? item.validationMessage : null,
      screenshotBase64: typeof item.screenshotBase64 === 'string' ? item.screenshotBase64 : null,
    }))
})
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="860px"
    class="web-ui-ai-collect-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="web-ui-ai-collect__title">
        <span>AI 采集元素</span>
        <el-tooltip
          content="已接入智能采集：先用规则解析页面元素，再使用选择的 AI 连接池模型优化名称、分组和说明。"
          placement="bottom-start"
        >
          <el-icon class="web-ui-ai-collect__title-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
    </template>

    <el-scrollbar class="web-ui-ai-collect-scrollbar">
      <div class="web-ui-ai-collect">
        <el-radio-group
          :model-value="aiCollectMode"
          class="web-ui-ai-collect__mode"
          @update:model-value="emit('update:aiCollectMode', $event as AiCollectMode)"
        >
          <el-radio-button value="ONLINE">在线采集</el-radio-button>
          <el-radio-button value="OFFLINE">离线导入</el-radio-button>
        </el-radio-group>

        <el-form class="web-ui-ai-collect__form" label-width="104px">
          <el-form-item label="AI 采集模型" required>
            <el-select
              v-model="aiCollectForm.providerConnectionId"
              :loading="aiProviderLoading"
              clearable
              filterable
              placeholder="选择连接池中已配置模型的 AI 连接"
            >
              <el-option
                v-for="item in availableAiProviders"
                :key="item.id"
                :label="`${item.connectionName} / ${item.modelName || '-'}`"
                :value="item.id"
              >
                <div class="web-ui-ai-collect__provider-option">
                  <span>{{ item.connectionName }} / {{ item.modelName || '-' }}</span>
                  <small>{{ item.protocolType }}</small>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <template v-if="aiCollectMode === 'ONLINE'">
            <el-form-item label="运行环境">
              <el-select v-model="aiCollectForm.environmentId" clearable filterable placeholder="选择登录环境">
                <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标页地址">
              <el-input v-model="aiCollectForm.pageUrl" clearable placeholder="可选：用于让本地 Runner 打开页面，例如 https://example.com/orders" />
            </el-form-item>
            <el-form-item label="本地 Runner">
              <div class="web-ui-ai-collect__runner">
                <div class="web-ui-ai-collect__runner-status">
                  <el-tag :type="localRunnerHealth?.online ? 'success' : 'info'" effect="light">
                    {{ localRunnerHealth?.online ? '已连接' : '未连接' }}
                  </el-tag>
                  <span v-if="localRunnerHealth?.runnerVersion">Runner {{ localRunnerHealth.runnerVersion }}</span>
                  <span v-if="localRunnerHealth?.online">
                    Playwright {{ localRunnerHealth.playwrightAvailable ? '可用' : '不可用' }} /
                    Chromium {{ localRunnerHealth.chromiumInstalled ? '已安装' : '未安装' }}
                  </span>
                  <small v-if="localRunnerHealth?.currentUrl">当前页面：{{ localRunnerHealth.currentUrl }}</small>
                  <small v-else>先启动 npm run runner，再检测本地 Runner；目标页地址只用于打开页面，采集以当前页为准。</small>
                </div>
                <div class="web-ui-ai-collect__runner-actions">
                  <AppButton size="small" :loading="localRunnerChecking" @click="emit('check-local-runner')">
                    检测
                  </AppButton>
                  <AppButton size="small" :loading="localRunnerOpening" @click="emit('open-local-runner-page')">
                    打开目标页
                  </AppButton>
                  <AppButton size="small" :loading="localRunnerTaskPollingStarting" @click="emit('start-task-polling')">
                    启动本地调试
                  </AppButton>
                  <AppButton
                    size="small"
                    type="primary"
                    :loading="localRunnerDebugTaskCreating"
                    @click="emit('create-debug-validate-task')"
                  >
                    创建验证任务
                  </AppButton>
                </div>
                <div class="web-ui-ai-collect__runner-task-status">
                  <template v-if="localRunnerTaskPollingStatus?.poller">
                    <el-tag type="success" effect="light">任务轮询中</el-tag>
                    <span>Runner {{ localRunnerTaskPollingStatus.poller.runnerId || '-' }}</span>
                    <span>已拉取 {{ localRunnerTaskPollingStatus.poller.pulledCount }}，完成 {{ localRunnerTaskPollingStatus.poller.completedCount }}</span>
                    <small>{{ localRunnerTaskPollingStatus.poller.lastMessage || '等待任务' }}</small>
                  </template>
                  <template v-else>
                    <el-tag type="info" effect="light">任务轮询未启动</el-tag>
                    <small>用于调试本地自动验证链路：平台创建任务，本地 Runner 自动处理并回传结果。</small>
                  </template>
                </div>
                <div v-if="localRunnerDebugTask" class="web-ui-ai-collect__runner-task-status">
                  <el-tag :type="getDebugTaskStatusType(localRunnerDebugTask.status)" effect="light">
                    {{ formatDebugTaskStatus(localRunnerDebugTask.status) }}
                  </el-tag>
                  <span>{{ localRunnerDebugTask.runId }}</span>
                  <small>
                    {{ localRunnerDebugTask.statusMessage || localRunnerDebugTask.errorMessage || '验证任务已创建，可刷新查看最新结果' }}
                  </small>
                  <AppButton size="small" @click="emit('refresh-debug-task')">刷新任务</AppButton>
                </div>
                <section
                  v-if="localRunnerDebugTask && (debugTaskResultRows.length || localRunnerDebugTask.errorMessage)"
                  class="web-ui-ai-collect__debug-result"
                >
                  <div class="web-ui-ai-collect__debug-result-header">
                    <strong>调试验证结果</strong>
                    <el-tag type="info" effect="light">{{ debugTaskSummary.mode }}</el-tag>
                    <el-tag type="success" effect="light">通过 {{ debugTaskSummary.passed }}</el-tag>
                    <el-tag :type="debugTaskSummary.failed ? 'danger' : 'info'" effect="light">
                      失败 {{ debugTaskSummary.failed }}
                    </el-tag>
                    <span>共 {{ debugTaskSummary.total }} 个，耗时 {{ debugTaskSummary.durationMs }}ms</span>
                  </div>
                  <el-alert
                    v-if="localRunnerDebugTask.errorMessage"
                    :title="localRunnerDebugTask.errorMessage"
                    type="error"
                    show-icon
                    :closable="false"
                  />
                  <el-table
                    v-if="debugTaskResultRows.length"
                    :data="debugTaskResultRows"
                    size="small"
                    border
                    class="web-ui-ai-collect__debug-table"
                  >
                    <el-table-column label="定位方式" width="108">
                      <template #default="{ row }">
                        <el-tag effect="light">{{ row.locatorType }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="定位值" min-width="220" show-overflow-tooltip>
                      <template #default="{ row }">
                        <span>{{ row.locatorValue || '-' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="验证" width="112">
                      <template #default="{ row }">
                        <el-tag :type="getAiValidationTagType(row.validationStatus)" effect="light">
                          {{ formatAiValidationStatus(row.validationStatus) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="匹配" width="72" prop="matchCount" />
                    <el-table-column label="状态" min-width="150">
                      <template #default="{ row }">
                        <div class="web-ui-ai-collect__debug-flags">
                          <el-tag :type="row.visible ? 'success' : 'info'" effect="light">可见</el-tag>
                          <el-tag :type="row.clickable ? 'success' : 'info'" effect="light">可点</el-tag>
                          <el-tag :type="row.inputtable ? 'success' : 'info'" effect="light">可输入</el-tag>
                        </div>
                        <small v-if="row.validationMessage" class="web-ui-ai-collect__hint">
                          {{ row.validationMessage }}
                        </small>
                      </template>
                    </el-table-column>
                    <el-table-column label="证据" width="96">
                      <template #default="{ row }">
                        <el-button
                          v-if="row.screenshotBase64"
                          link
                          type="primary"
                          @click="emit('preview-debug-screenshot', row.screenshotBase64)"
                        >
                          查看截图
                        </el-button>
                        <span v-else>-</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </section>
              </div>
            </el-form-item>
          </template>

          <template v-else>
            <el-form-item label="HTML / DOM" required>
              <el-input
                v-model="aiCollectForm.htmlText"
                type="textarea"
                :rows="6"
                maxlength="30000"
                show-word-limit
                placeholder="粘贴页面 HTML、DOM 片段，或从浏览器复制出来的关键区域结构"
              />
            </el-form-item>
            <el-form-item label="截图说明">
              <el-input
                v-model="aiCollectForm.screenshotNote"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder="可补充截图里哪些区域要采集，例如：登录表单、查询按钮、结果表格"
              />
            </el-form-item>
          </template>

          <el-form-item label="所属模块" required>
            <el-select
              v-model="aiCollectForm.moduleId"
              clearable
              filterable
              placeholder="选择模块"
              @change="emit('module-change')"
            >
              <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="页面对象" required>
            <div class="web-ui-ai-collect__page-target">
              <el-select
                v-model="aiCollectForm.pageId"
                clearable
                filterable
                placeholder="选择已有页面对象"
                @change="emit('page-change', $event as number | null)"
              >
                <el-option v-for="item in pageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
              </el-select>
              <el-input v-model="aiCollectForm.pageName" clearable placeholder="或填写新页面对象名称" />
            </div>
          </el-form-item>

          <el-form-item label="分组策略">
            <el-radio-group v-model="aiCollectForm.groupStrategy">
              <el-radio-button value="AI">AI 建议分组</el-radio-button>
              <el-radio-button value="CUSTOM">自选分组</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="aiCollectForm.groupStrategy === 'CUSTOM'" label="自选分组" required>
            <div class="web-ui-ai-collect__group-target">
              <el-select
                v-model="aiCollectForm.groupId"
                clearable
                filterable
                placeholder="选择已有分组"
                :disabled="!aiCollectForm.pageId"
                @change="emit('group-change', $event as number | null)"
              >
                <el-option v-for="item in groupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
              </el-select>
              <el-input v-model="aiCollectForm.groupName" clearable placeholder="或填写新分组名称" />
            </div>
          </el-form-item>

          <el-form-item label="采集范围">
            <el-radio-group v-model="aiCollectForm.scope">
              <el-radio-button value="ALL">全部</el-radio-button>
              <el-radio-button value="FORM">表单</el-radio-button>
              <el-radio-button value="BUTTON">按钮</el-radio-button>
              <el-radio-button value="TABLE">表格</el-radio-button>
              <el-radio-button value="DIALOG">弹窗</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <WebUiElementCollectTaskPanel
          v-if="collectTask"
          :task="collectTask"
          :refreshing="collectTaskRefreshing"
          :polling="collectTaskPolling"
          @refresh="emit('refresh-collect-task')"
          @cancel="emit('cancel-collect-task')"
        />

        <el-alert
          v-if="localRunnerValidating"
          title="正在进行本地页面验证"
          description="本地 Runner 会在当前页面批量校验候选定位器，完成后自动更新通过、失败和多匹配状态。"
          type="info"
          show-icon
          :closable="false"
        />

        <div v-if="candidates.length" class="web-ui-ai-collect__summary">
          <el-tag type="info" effect="light">候选总数 {{ candidateSummary.total }}</el-tag>
          <template v-if="collectFilterSummary">
            <el-tag type="info" effect="light">原始采集 {{ collectFilterSummary.originalCount }}</el-tag>
            <el-tag :type="collectFilterSummary.emptyLocatorCount ? 'warning' : 'info'" effect="light">
              空定位 {{ collectFilterSummary.emptyLocatorCount }}
            </el-tag>
            <el-tag :type="collectFilterSummary.duplicateCount ? 'warning' : 'info'" effect="light">
              重复过滤 {{ collectFilterSummary.duplicateCount }}
            </el-tag>
            <el-tag :type="collectFilterSummary.lowStabilityCount ? 'warning' : 'info'" effect="light">
              低稳定过滤 {{ collectFilterSummary.lowStabilityCount }}
            </el-tag>
            <el-tag type="success" effect="light">最终候选 {{ collectFilterSummary.finalCount }}</el-tag>
          </template>
          <el-tag type="primary" effect="light">可保存 {{ candidateSummary.recommended }}</el-tag>
          <el-tag type="success" effect="light">验证通过 {{ candidateSummary.passed }}</el-tag>
          <el-tag :type="candidateSummary.failed ? 'danger' : 'info'" effect="light">
            验证失败 {{ candidateSummary.failed }}
          </el-tag>
          <el-tag :type="candidateSummary.multiple ? 'warning' : 'info'" effect="light">
            多匹配 {{ candidateSummary.multiple }}
          </el-tag>
          <el-tag :type="candidateSummary.unverified ? 'warning' : 'info'" effect="light">
            未验证 {{ candidateSummary.unverified }}
          </el-tag>
          <el-tag :type="candidateSummary.lowConfidence ? 'warning' : 'info'" effect="light">
            低稳定性 {{ candidateSummary.lowConfidence }}
          </el-tag>
          <el-tag :type="candidateSummary.aiEnhanced ? 'success' : 'info'" effect="light">
            AI 增强 {{ candidateSummary.aiEnhanced }}
          </el-tag>
          <el-tag :type="candidateSummary.aiSupplement ? 'warning' : 'info'" effect="light">
            AI 补充 {{ candidateSummary.aiSupplement }}
          </el-tag>
          <el-tag :type="candidateSummary.blocked ? 'danger' : 'info'" effect="light">
            禁止保存 {{ candidateSummary.blocked }}
          </el-tag>
        </div>

        <section
          v-if="collectFilterDetails.length || collectFilterDetailsLoading"
          class="web-ui-ai-collect__filter-details"
        >
          <div class="web-ui-ai-collect__filter-details-header">
            <strong>过滤明细</strong>
            <el-tag type="info" effect="light">共 {{ collectFilterDetails.length }}</el-tag>
            <el-tag :type="recoverableFilterDetailCount() ? 'warning' : 'info'" effect="light">
              可恢复 {{ recoverableFilterDetailCount() }}
            </el-tag>
          </div>
          <el-skeleton v-if="collectFilterDetailsLoading" :rows="2" animated />
          <div v-else class="web-ui-ai-collect__filter-detail-list">
            <div
              v-for="detail in collectFilterDetails"
              :key="detail.id"
              class="web-ui-ai-collect__filter-detail-item"
            >
              <div>
                <el-tag :type="detail.recoverable ? 'warning' : 'info'" effect="light">
                  {{ formatCollectFilterReason(detail.reason) }}
                </el-tag>
                <strong>{{ detail.candidate.elementName || detail.candidate.locatorValue || '未命名候选' }}</strong>
                <small>{{ detail.message || '暂无说明' }}</small>
              </div>
              <AppButton
                size="small"
                :disabled="!detail.recoverable"
                @click="emit('restore-filter-detail', detail)"
              >
                恢复待验证
              </AppButton>
            </div>
          </div>
        </section>

        <div class="web-ui-ai-collect__actions">
          <AppButton
            type="primary"
            :icon="Cpu"
            :loading="aiCollectMode === 'ONLINE' ? (localRunnerCapturing || localRunnerValidating) : collecting"
            @click="aiCollectMode === 'ONLINE' ? emit('capture-local-runner-page') : emit('generate')"
          >
            {{ localRunnerValidating ? '正在本地验证' : aiCollectMode === 'ONLINE' ? '采集当前页' : '生成候选元素' }}
          </AppButton>
          <div v-if="candidates.length" class="web-ui-ai-collect__batch-actions">
            <AppButton size="small" @click="emit('select-recommended')">选择推荐且通过</AppButton>
            <AppButton size="small" @click="emit('unselect-risky')">取消风险候选</AppButton>
            <AppButton size="small" @click="emit('batch-update-group')">批量改分组</AppButton>
            <AppButton
              size="small"
              :loading="localRunnerValidating"
              @click="emit('revalidate-visible-candidates')"
            >
              重新验证当前筛选
            </AppButton>
          </div>
          <div class="web-ui-ai-collect__filters">
            <AppButton size="small" :type="candidateFilter === 'ALL' ? 'primary' : 'default'" @click="emit('filter-change', 'ALL')">
              全部
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'RECOMMENDED' ? 'primary' : 'default'" @click="emit('filter-change', 'RECOMMENDED')">
              可保存
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'PASSED' ? 'primary' : 'default'" @click="emit('filter-change', 'PASSED')">
              验证通过
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'FAILED' ? 'primary' : 'default'" @click="emit('filter-change', 'FAILED')">
              验证失败
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'MULTIPLE' ? 'primary' : 'default'" @click="emit('filter-change', 'MULTIPLE')">
              多匹配
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'UNVERIFIED' ? 'primary' : 'default'" @click="emit('filter-change', 'UNVERIFIED')">
              未验证
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'BLOCKED' ? 'primary' : 'default'" @click="emit('filter-change', 'BLOCKED')">
              禁止保存
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'AI_SUPPLEMENT' ? 'primary' : 'default'" @click="emit('filter-change', 'AI_SUPPLEMENT')">
              AI 补充
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'AI_UNVERIFIED' ? 'primary' : 'default'" @click="emit('filter-change', 'AI_UNVERIFIED')">
              AI 待验证
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'LOW_CONFIDENCE' ? 'primary' : 'default'" @click="emit('filter-change', 'LOW_CONFIDENCE')">
              低稳定性
            </AppButton>
            <span>已选 {{ selectedCount }} / {{ candidates.length }}</span>
          </div>
        </div>

        <el-table
          v-if="candidates.length"
          :data="visibleCandidates"
          row-key="id"
          border
          class="web-ui-ai-collect__table"
          :row-class-name="getAiCandidateRowClassName"
          empty-text="当前筛选下暂无候选元素"
        >
          <el-table-column label="选择" width="72" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.selected" :disabled="!isAiCandidateSaveable(row)" />
            </template>
          </el-table-column>
          <el-table-column label="来源" width="118">
            <template #default="{ row }">
              <el-tag :type="getAiCandidateSourceTagType(row.candidateSource)" effect="light">
                {{ formatAiCandidateSource(row.candidateSource) }}
              </el-tag>
              <el-tag v-if="isAiMetadataEnhanced(row)" type="success" effect="light" class="web-ui-ai-collect__source-tag">
                AI 增强
              </el-tag>
              <small v-if="row.saveBlockedReason" class="web-ui-ai-collect__hint">{{ row.saveBlockedReason }}</small>
            </template>
          </el-table-column>
          <el-table-column label="推荐" width="110">
            <template #default="{ row }">
              <el-tag :type="row.recommendedToSave ? 'success' : 'info'" effect="light">
                {{ row.recommendedToSave ? '建议保存' : '谨慎保存' }}
              </el-tag>
              <small v-if="row.notRecommendedReason" class="web-ui-ai-collect__hint">{{ row.notRecommendedReason }}</small>
            </template>
          </el-table-column>
          <el-table-column label="建议分组" min-width="130">
            <template #default="{ row }">
              <el-input v-model="row.groupName" maxlength="80" />
            </template>
          </el-table-column>
          <el-table-column label="元素名称" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.elementName" maxlength="80" />
            </template>
          </el-table-column>
          <el-table-column label="定位方式" width="130">
            <template #default="{ row }">
              <el-select v-model="row.locatorType">
                <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="推荐定位器" min-width="220">
            <template #default="{ row }">
              <el-input v-model="row.locatorValue" maxlength="1000" />
            </template>
          </el-table-column>
          <el-table-column label="验证" min-width="150">
            <template #default="{ row }">
              <el-tag :type="getAiValidationTagType(row.validationStatus)" effect="light">
                {{ formatAiValidationStatus(row.validationStatus) }}
              </el-tag>
              <small
                class="web-ui-ai-collect__hint"
                :class="`web-ui-ai-collect__hint--${getCollectCandidateReviewLevel(row)}`"
              >
                {{ getCollectCandidateReviewMessage(row) }}
              </small>
              <el-button
                v-if="row.screenshotBase64"
                link
                :type="getCollectCandidateReviewLevel(row) === 'danger' ? 'danger' : 'primary'"
                class="web-ui-ai-collect__evidence-link"
                @click="emit('preview-screenshot', row)"
              >
                查看截图证据
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="104">
            <template #default="{ row }">
              <span>{{ formatAiElementType(row.elementType) }}</span>
              <small class="web-ui-ai-collect__hint">{{ row.tagName || '-' }}</small>
            </template>
          </el-table-column>
          <el-table-column label="稳定性" width="112">
            <template #default="{ row }">
              <el-progress :percentage="row.confidence" :stroke-width="8" :show-text="false" />
              <small class="web-ui-ai-collect__score">{{ row.confidence }}%</small>
            </template>
          </el-table-column>
          <el-table-column label="业务含义" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.businessMeaning || row.text || row.placeholder || '-' }}</span>
              <small v-if="row.stabilityNote" class="web-ui-ai-collect__hint">{{ row.stabilityNote }}</small>
            </template>
          </el-table-column>
          <el-table-column prop="maintenanceSuggestion" label="维护建议" min-width="180" show-overflow-tooltip />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
        </el-table>

        <AppEmptyState
          v-else
          title="暂无候选元素"
          description="填写采集信息后点击“生成候选元素”，先确认候选结果，再批量保存到元素库。"
        />
      </div>
    </el-scrollbar>

    <template #footer>
      <div class="web-ui-ai-collect__footer">
        <span v-if="candidates.length" class="web-ui-ai-collect__footer-hint">
          已选 {{ selectedCount }} 个，可保存 {{ candidateSummary.recommended }} 个，禁止保存 {{ candidateSummary.blocked }} 个
        </span>
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="!selectedCount"
          @click="emit('save')"
        >
          批量保存
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-ai-collect {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-ai-collect__title {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-primary);
  font-weight: 600;
}

.web-ui-ai-collect__title-icon {
  color: var(--app-text-muted);
  cursor: help;
}

.web-ui-ai-collect-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-ai-collect-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-ai-collect__mode {
  justify-self: flex-start;
}

.web-ui-ai-collect__form {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-ai-collect__page-target,
.web-ui-ai-collect__group-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--app-space-3);
  width: 100%;
}

.web-ui-ai-collect__provider-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-ai-collect__provider-option small {
  color: var(--app-text-muted);
}

.web-ui-ai-collect__runner {
  display: grid;
  gap: var(--app-space-3);
  width: 100%;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.web-ui-ai-collect__runner-status,
.web-ui-ai-collect__runner-actions,
.web-ui-ai-collect__runner-task-status {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-ai-collect__runner-status,
.web-ui-ai-collect__runner-task-status {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__runner-status small,
.web-ui-ai-collect__runner-task-status small {
  flex-basis: 100%;
  color: var(--app-text-muted);
}

.web-ui-ai-collect__actions,
.web-ui-ai-collect__footer,
.web-ui-ai-collect__summary,
.web-ui-ai-collect__batch-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-ai-collect__actions {
  justify-content: space-between;
  flex-wrap: wrap;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__summary,
.web-ui-ai-collect__batch-actions {
  flex-wrap: wrap;
}

.web-ui-ai-collect__filters {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-ai-collect__filter-details {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.web-ui-ai-collect__debug-result {
  display: grid;
  gap: var(--app-space-2);
  padding-top: var(--app-space-2);
  border-top: 1px solid var(--app-border-color);
}

.web-ui-ai-collect__debug-result-header,
.web-ui-ai-collect__debug-flags {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-ai-collect__debug-result-header {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__debug-table {
  width: 100%;
}

.web-ui-ai-collect__filter-details-header,
.web-ui-ai-collect__filter-detail-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-ai-collect__filter-detail-list {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-ai-collect__filter-detail-item {
  justify-content: space-between;
  padding: var(--app-space-2);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
}

.web-ui-ai-collect__filter-detail-item > div {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
  flex-wrap: wrap;
}

.web-ui-ai-collect__filter-detail-item small {
  color: var(--app-text-muted);
}

.web-ui-ai-collect__footer {
  justify-content: flex-end;
}

.web-ui-ai-collect__footer-hint {
  margin-right: auto;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__table {
  width: 100%;
}

.web-ui-ai-collect__table :deep(.web-ui-ai-collect__row--danger) {
  --el-table-tr-bg-color: var(--el-color-danger-light-9);
}

.web-ui-ai-collect__table :deep(.web-ui-ai-collect__row--warning) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

.web-ui-ai-collect__score {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  text-align: center;
}

.web-ui-ai-collect__source-tag {
  margin-top: var(--app-space-1);
}

.web-ui-ai-collect__evidence-link {
  margin-top: var(--app-space-1);
  padding: 0;
}

.web-ui-ai-collect__hint {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.4;
}

.web-ui-ai-collect__hint--danger {
  color: var(--el-color-danger);
}

.web-ui-ai-collect__hint--warning {
  color: var(--el-color-warning-dark-2);
}

.web-ui-ai-collect__hint--success {
  color: var(--el-color-success);
}

.web-ui-ai-collect :deep(.el-select),
.web-ui-ai-collect :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 700px) {
  .web-ui-ai-collect__page-target,
  .web-ui-ai-collect__group-target {
    grid-template-columns: 1fr;
  }
}
</style>
