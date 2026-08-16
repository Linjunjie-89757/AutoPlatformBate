<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheckBig,
  ChevronRight,
  CircleStop,
  FileText,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  X,
  XCircle,
} from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskEventItem, type AiGenerationTaskItem, type AiRequirementAssetItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode, type CaseDirectoryWorkspace } from '@/entities/case'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'

type OutputMode = 'STREAM' | 'COMPLETE'
type DirectoryPickerMode = 'manual' | 'document'

interface DirectoryOption {
  value: string
  label: string
  directoryId: number | null
}

interface DirectoryPickerNode {
  key: string
  name: string
  fullPath: string
  selectable: boolean
  children: DirectoryPickerNode[]
}

interface AiConfigSummary {
  providerConnectionId: number | null
  providerConnectionName: string | null
  model: string | null
  promptTemplate: string | null
  supportsImageInput: boolean
  status: number | null
}

const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()

const loadingWorkspaces = ref(false)
const loadingConfig = ref(false)
const loadingDirectories = ref(false)
const importingRequirement = ref(false)
const generating = ref(false)
const processDialogVisible = ref(false)
const processPending = ref(false)
const directoryPickerVisible = ref(false)
const confirmGenerateVisible = ref(false)
const inputMode = ref<DirectoryPickerMode>('manual')
const pendingGenerateSource = ref<DirectoryPickerMode>('manual')
const autoCreateSubdirectory = ref(true)
const manualAutoCreateSubdirectory = ref(true)
const documentAutoCreateSubdirectory = ref(true)

const workspaces = ref<WorkspaceItem[]>([])
const selectedTargetWorkspaceCode = ref('')
const generatorConfig = ref<AiConfigSummary | null>(null)
const reviewerConfig = ref<AiConfigSummary | null>(null)
const taskRecords = ref<AiGenerationTaskItem[]>([])
const latestTaskRecord = ref<AiGenerationTaskItem | null>(null)
const activeProcessTaskId = ref('')
const manualTaskRecordId = ref('')
const documentTaskRecordId = ref('')

const importedDocument = ref<{
  fileName: string
  fileSize: number
} | null>(null)
const importedRequirementTitle = ref('')
const importedRequirementContent = ref('')
const requirementAssets = ref<AiRequirementAssetItem[]>([])

const requirementFileInput = ref<HTMLInputElement | null>(null)
const directoryWorkspaces = ref<CaseDirectoryWorkspace[]>([])
const directoryOptions = ref<DirectoryOption[]>([])
const manualDirectoryBasePath = ref('')
const documentDirectoryBasePath = ref('')
const directoryPickerKeyword = ref('')
const directoryPickerMode = ref<DirectoryPickerMode>('manual')
const directoryPickerSelectedPath = ref('')

const manualForm = ref({
  requirementTitle: '',
  requirementContent: '',
  manualDirectoryPath: '',
  outputMode: 'STREAM' as OutputMode,
})

const documentForm = ref({
  directoryPath: '',
})

let taskPollingTimer: number | null = null
let streamAbortController: AbortController | null = null
let streamTaskId: string | null = null
let streamRefreshTimer: number | null = null
let syncingManualDirectoryPath = false
let syncingDocumentDirectoryPath = false

const IMAGE_UNSUPPORTED_CONFIRM_MESSAGE = '当前生成模型不支持图片识别。可以取消生成，或忽略图片素材，仅基于文档文本继续生成。'

const isAllScope = computed(() => selectedWorkspaceCode.value === 'ALL')

const targetWorkspaceCode = computed(() => {
  if (isAllScope.value) {
    return selectedTargetWorkspaceCode.value
  }
  return selectedWorkspaceCode.value
})

const currentWorkspaceName = computed(() => {
  if (!targetWorkspaceCode.value) {
    return ''
  }
  return workspaces.value.find(item => item.workspaceCode === targetWorkspaceCode.value)?.workspaceName
    || targetWorkspaceCode.value
})

const generatorConfigIssue = computed(() => describeAiRoleConfigIssue(generatorConfig.value, '生成模型'))
const reviewerConfigIssue = computed(() => describeAiRoleConfigIssue(reviewerConfig.value, '评审模型'))
const aiConfigMissingReasons = computed(() => [
  currentWorkspaceName.value ? '' : '未选择目标空间',
  generatorConfigIssue.value,
  reviewerConfigIssue.value,
].filter(Boolean))
const aiConfigReady = computed(() => aiConfigMissingReasons.value.length === 0 && !!manualForm.value.outputMode)
const aiConfigStatusText = computed(() => (
  aiConfigReady.value ? '配置完整，可直接生成' : `配置缺失：${aiConfigMissingReasons.value.join('、') || '输出模式未选择'}`
))
const aiConfigStatusClass = computed(() => (
  aiConfigReady.value ? 'config-status-success' : 'config-status-danger'
))

function getGenerateBlockReason(source: DirectoryPickerMode) {
  if (!targetWorkspaceCode.value) {
    return '请先选择目标空间'
  }

  if (!aiConfigReady.value) {
    return `AI 配置缺失：${aiConfigMissingReasons.value.join('、') || '输出模式未选择'}`
  }

  if (source === 'document') {
    if (!importedDocument.value) {
      return '请先上传需求文档'
    }
    if (!importedRequirementTitle.value.trim()) {
      return '请先填写文档标题'
    }
    if (!importedRequirementContent.value.trim()) {
      return '导入结果为空，请确认文档内容'
    }
    if (!documentForm.value.directoryPath.trim()) {
      return '请先选择保存路径'
    }
    if (requirementAssets.value.some(item => !item.id || item.id <= 0)) {
      return '附件还未准备完成，请稍后重试'
    }
    return ''
  }

  if (!manualForm.value.requirementTitle.trim()) {
    return '请先填写需求标题'
  }
  if (!manualForm.value.requirementContent.trim()) {
    return '请先填写需求描述'
  }
  if (!manualForm.value.manualDirectoryPath.trim()) {
    return '请先选择保存路径'
  }

  return ''
}

const manualGenerateBlockReason = computed(() => getGenerateBlockReason('manual'))
const documentGenerateBlockReason = computed(() => getGenerateBlockReason('document'))

const manualDirectoryDisplayPath = computed(() => {
  if (!manualForm.value.manualDirectoryPath) {
    return ''
  }
  return formatDirectoryDisplayPath(manualForm.value.manualDirectoryPath)
})

const documentDirectoryDisplayPath = computed(() => {
  if (!documentForm.value.directoryPath) {
    return ''
  }
  return formatDirectoryDisplayPath(documentForm.value.directoryPath)
})

const directoryPickerPreviewPath = computed(() => {
  if (!directoryPickerSelectedPath.value) {
    return ''
  }

  const title = directoryPickerMode.value === 'manual'
    ? manualForm.value.requirementTitle
    : importedRequirementTitle.value
  const previewPath = autoCreateSubdirectory.value && title.trim()
    ? buildDirectoryPath(directoryPickerSelectedPath.value, title.trim().slice(0, 20))
    : directoryPickerSelectedPath.value
  return formatDirectoryDisplayPath(previewPath)
})

const canGenerate = computed(() => !manualGenerateBlockReason.value)

const canGenerateDocument = computed(() => !documentGenerateBlockReason.value)

const selectedRequirementAssetIds = computed(() => requirementAssets.value.map(item => item.id))
const activeProcessRecord = computed(() => getCurrentProcessRecord())
const activeProcessGeneratedCount = computed(() => activeProcessRecord.value?.generatedCount ?? activeProcessRecord.value?.generatedCases?.length ?? 0)
const activeProcessReviewedCount = computed(() => activeProcessRecord.value?.reviewResult?.caseDecisions?.length ?? 0)
const activeProcessTotal = computed(() => Math.max(activeProcessGeneratedCount.value, 12))
const activeProcessStep = computed(() => {
  const record = activeProcessRecord.value
  if (!record) return 0
  if (record.status === 'COMPLETED') return 5
  if (record.status === 'REVIEWING') return 3
  return Math.max(0, Math.min(4, Number(record.currentStep ?? (record.status === 'GENERATING' ? 2 : 0))))
})
const activeProcessPercent = computed(() => {
  if (activeProcessRecord.value?.status === 'COMPLETED') return 100
  return Math.min(99, Math.round(((activeProcessGeneratedCount.value + activeProcessReviewedCount.value) / Math.max(activeProcessTotal.value * 2, 1)) * 100))
})
const activeProcessElapsed = computed(() => {
  const createdAt = activeProcessRecord.value?.createdAt
  if (!createdAt) return '0s'
  const createdAtTimestamp = new Date(createdAt).getTime()
  if (!Number.isFinite(createdAtTimestamp)) return '0s'
  const seconds = Math.max(0, Math.floor((Date.now() - createdAtTimestamp) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`
})
const generationSteps = ['解析需求', '提取测试点', '生成用例', 'AI 评审', '保存结果']
function getTaskSortTimestamp(task: AiGenerationTaskItem) {
  return new Date(task.updatedAt || task.createdAt || 0).getTime()
}

function sortTasksByRecent(tasks: AiGenerationTaskItem[]) {
  return [...tasks].sort((left, right) => getTaskSortTimestamp(right) - getTaskSortTimestamp(left))
}

const recentTaskRecords = computed(() => {
  const sortedTasks = sortTasksByRecent(taskRecords.value)
  const selectedTaskIds = new Set<string>()
  const recentTasks: AiGenerationTaskItem[] = []

  const pushTask = (task: AiGenerationTaskItem | undefined) => {
    if (!task || selectedTaskIds.has(task.taskId)) {
      return
    }
    selectedTaskIds.add(task.taskId)
    recentTasks.push(task)
  }

  sortedTasks.filter(task => ['PENDING', 'GENERATING', 'REVIEWING'].includes(task.status)).forEach(pushTask)
  pushTask(sortedTasks.find(task => task.status === 'COMPLETED'))
  sortedTasks.forEach(pushTask)

  return recentTasks.slice(0, 3)
})

const directoryPickerTree = computed<DirectoryPickerNode[]>(() => {
  if (!targetWorkspaceCode.value || !currentWorkspaceName.value) {
    return []
  }

  const currentWorkspace = directoryWorkspaces.value.find(item => item.workspaceCode === targetWorkspaceCode.value)
  const appendFullPath = (nodes: CaseDirectoryNode[], prefix = ''): DirectoryPickerNode[] => nodes.map((node) => {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name
    return {
      key: fullPath,
      name: node.name,
      fullPath,
      selectable: true,
      children: appendFullPath(node.children ?? [], fullPath),
    }
  })

  return appendFullPath(currentWorkspace?.children ?? [])
})

const filteredDirectoryPickerTree = computed<DirectoryPickerNode[]>(() => {
  const keyword = directoryPickerKeyword.value.trim().toLowerCase()
  const filterNodes = (nodes: DirectoryPickerNode[]): DirectoryPickerNode[] => nodes.reduce<DirectoryPickerNode[]>((result, node) => {
    const children = filterNodes(node.children ?? [])
    const matched = !keyword || node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    if (matched || children.length) {
      result.push({
        ...node,
        children,
      })
    }
    return result
  }, [])

  return filterNodes(directoryPickerTree.value)
})

function describeAiRoleConfigIssue(config: AiConfigSummary | null, roleLabel: string) {
  if (!config) return `${roleLabel}未配置`
  if (!config.providerConnectionId && !config.providerConnectionName?.trim()) return `${roleLabel}缺少连接`
  if (!config.model?.trim()) return `${roleLabel}缺少模型`
  if (!config.promptTemplate?.trim()) return `${roleLabel}缺少提示词`
  if (config.status !== 1) return `${roleLabel}未启用`
  return ''
}

function normalizeDirectorySegments(path: string) {
  return path
    .split(/[\\/]+/)
    .map(segment => segment.trim())
    .filter(Boolean)
}

function normalizeDirectoryPath(path: string) {
  return normalizeDirectorySegments(path).join('/')
}

function formatDirectoryDisplayPath(path: string) {
  return normalizeDirectorySegments(path).join(' / ')
}

function buildDirectoryPath(basePath: string, title: string) {
  const normalizedBasePath = normalizeDirectoryPath(basePath)
  const normalizedTitle = title.trim()
  if (!normalizedBasePath) {
    return normalizedTitle
  }
  return normalizedTitle ? `${normalizedBasePath}/${normalizedTitle}` : normalizedBasePath
}

function flattenDirectories(nodes: CaseDirectoryNode[], prefix = ''): DirectoryOption[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix}/${node.name}` : node.name
    return [
      { value: label, label, directoryId: node.id },
      ...flattenDirectories(node.children ?? [], label),
    ]
  })
}

function findDirectoryBasePath(path: string) {
  const normalizedPath = normalizeDirectoryPath(path)
  if (!normalizedPath) {
    return ''
  }
  const matchedOption = [...directoryOptions.value]
    .sort((left, right) => right.value.length - left.value.length)
    .find(item => normalizedPath === item.value || normalizedPath.startsWith(`${item.value}/`))
  return matchedOption?.value ?? ''
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function formatTaskTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return '-'
  }
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatEventTime(value?: string | null) {
  if (!value) {
    return '--:--:--'
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return '--:--:--'
  }
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getTaskStatusTone(status: string) {
  const toneMap: Record<string, string> = {
    PENDING: 'status-info',
    GENERATING: 'status-info',
    REVIEWING: 'status-warning',
    COMPLETED: 'status-success',
    FAILED: 'status-danger',
    CANCELED: 'status-neutral',
  }
  return toneMap[status] ?? 'status-info'
}

function pickLatestTaskRecord(records: AiGenerationTaskItem[]) {
  const sortedRecords = sortTasksByRecent(records)
  return sortedRecords.find(item => ['PENDING', 'GENERATING', 'REVIEWING'].includes(item.status))
    ?? sortedRecords[0]
    ?? null
}

function getCurrentProcessRecord() {
  if (activeProcessTaskId.value) {
    return taskRecords.value.find(item => item.taskId === activeProcessTaskId.value) ?? latestTaskRecord.value
  }
  return latestTaskRecord.value
}

function getTaskDetailActionLabel(task: AiGenerationTaskItem) {
  if (task.status === 'COMPLETED') {
    return '查看结果'
  }
  if (task.status === 'FAILED') {
    return '重试'
  }
  if (isRunningTask(task)) {
    return '恢复查看'
  }
  return '查看详情'
}

function stopTaskPolling() {
  if (taskPollingTimer != null) {
    window.clearInterval(taskPollingTimer)
    taskPollingTimer = null
  }
}

function stopEventStream() {
  if (streamAbortController) {
    streamAbortController.abort()
    streamAbortController = null
  }
  streamTaskId = null
}

function startTaskPolling() {
  stopTaskPolling()
  taskPollingTimer = window.setInterval(() => {
    void refreshLatestTaskRecord()
  }, 2500)
}

function isRunningTask(record: AiGenerationTaskItem | null | undefined) {
  return Boolean(record && ['PENDING', 'GENERATING', 'REVIEWING'].includes(record.status))
}

function mergeTaskEvents(
  incomingEvents: AiGenerationTaskEventItem[] | null | undefined,
  existingEvents: AiGenerationTaskEventItem[] | null | undefined,
) {
  const eventMap = new Map<number, AiGenerationTaskEventItem>()
  for (const event of existingEvents ?? []) {
    eventMap.set(event.seq, event)
  }
  for (const event of incomingEvents ?? []) {
    eventMap.set(event.seq, event)
  }
  return [...eventMap.values()].sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0))
}

function mergeTaskRecord(incoming: AiGenerationTaskItem, existing?: AiGenerationTaskItem | null) {
  if (!existing || existing.taskId !== incoming.taskId) {
    return incoming
  }
  return {
    ...incoming,
    events: mergeTaskEvents(incoming.events, existing.events),
  }
}

function updateTaskRecordSnapshot(record: AiGenerationTaskItem) {
  const nextRecord = mergeTaskRecord(record, latestTaskRecord.value)
  latestTaskRecord.value = nextRecord
  const existingIndex = taskRecords.value.findIndex(item => item.taskId === nextRecord.taskId)
  if (existingIndex >= 0) {
    taskRecords.value = taskRecords.value.map(item => (item.taskId === nextRecord.taskId ? mergeTaskRecord(nextRecord, item) : item))
  } else {
    taskRecords.value = [nextRecord, ...taskRecords.value]
  }
  syncEventStream(nextRecord)
}

function shouldRefreshForEvent(event: AiGenerationTaskEventItem) {
  return [
    'CASE_GENERATED',
    'CASE_REVIEWED',
    'CASE_SUPPLEMENTED',
    'GENERATION_COMPLETED',
    'REVIEW_COMPLETED',
    'TASK_COMPLETED',
    'TASK_FAILED',
    'TASK_CANCELED',
  ].includes(event.eventType)
}

function mergeTaskEvent(event: AiGenerationTaskEventItem) {
  if (!latestTaskRecord.value || latestTaskRecord.value.taskId !== event.taskId) {
    return
  }
  latestTaskRecord.value = {
    ...latestTaskRecord.value,
    events: mergeTaskEvents([event], latestTaskRecord.value.events),
  }
  taskRecords.value = taskRecords.value.map(item => item.taskId === event.taskId
    ? { ...item, events: mergeTaskEvents([event], item.events) }
    : item)
  if (shouldRefreshForEvent(event)) {
    scheduleStreamRecordRefresh()
  }
}

function scheduleStreamRecordRefresh() {
  if (streamRefreshTimer != null) {
    return
  }
  streamRefreshTimer = window.setTimeout(() => {
    streamRefreshTimer = null
    void refreshLatestTaskRecord()
  }, 350)
}

function startEventStream(record: AiGenerationTaskItem) {
  if (streamTaskId === record.taskId && streamAbortController) {
    return
  }
  stopEventStream()
  const controller = new AbortController()
  streamAbortController = controller
  streamTaskId = record.taskId
  void caseAiApi.streamTaskEvents(record.workspaceCode, record.taskId, {
    signal: controller.signal,
    onEvent: mergeTaskEvent,
  }).then(() => {
    if (streamTaskId === record.taskId) {
      streamAbortController = null
      streamTaskId = null
      void refreshLatestTaskRecord()
    }
  }).catch((error) => {
    if ((error as Error).name !== 'AbortError' && streamTaskId === record.taskId) {
      void refreshLatestTaskRecord()
    }
    if (streamTaskId === record.taskId) {
      streamAbortController = null
      streamTaskId = null
    }
  })
}

function syncEventStream(record: AiGenerationTaskItem | null) {
  if (processDialogVisible.value && record?.outputMode === 'STREAM' && isRunningTask(record)) {
    startEventStream(record)
    return
  }
  stopEventStream()
}

async function loadWorkspaces() {
  loadingWorkspaces.value = true
  try {
    workspaces.value = await workspaceApi.getSwitchableWorkspaces()
    const matched = workspaces.value.find(item => item.workspaceCode === selectedWorkspaceCode.value)
      ?? workspaces.value.find(item => item.current)
      ?? workspaces.value[0]
    if (!isAllScope.value) {
      selectedTargetWorkspaceCode.value = selectedWorkspaceCode.value
    } else if (!selectedTargetWorkspaceCode.value) {
      selectedTargetWorkspaceCode.value = matched?.workspaceCode || ''
    }
  } catch (error) {
    workspaces.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingWorkspaces.value = false
  }
}

async function loadConfig() {
  if (!targetWorkspaceCode.value) {
    generatorConfig.value = null
    reviewerConfig.value = null
    return
  }

  loadingConfig.value = true
  try {
    const response = await caseAiApi.getConfig(selectedWorkspaceCode.value || 'ALL', targetWorkspaceCode.value)
    generatorConfig.value = response.generatorConfig
      ? {
          providerConnectionId: response.generatorConfig.providerConnectionId,
          providerConnectionName: response.generatorConfig.providerConnectionName,
          model: response.generatorConfig.model,
          promptTemplate: response.generatorConfig.promptTemplate,
          supportsImageInput: response.generatorConfig.supportsImageInput,
          status: response.generatorConfig.status,
        }
      : null
    reviewerConfig.value = response.reviewerConfig
      ? {
          providerConnectionId: response.reviewerConfig.providerConnectionId,
          providerConnectionName: response.reviewerConfig.providerConnectionName,
          model: response.reviewerConfig.model,
          promptTemplate: response.reviewerConfig.promptTemplate,
          supportsImageInput: response.reviewerConfig.supportsImageInput,
          status: response.reviewerConfig.status,
        }
      : null
  } catch (error) {
    generatorConfig.value = null
    reviewerConfig.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingConfig.value = false
  }
}

async function loadDirectoryOptions() {
  if (!targetWorkspaceCode.value) {
    directoryWorkspaces.value = []
    directoryOptions.value = []
    return
  }

  loadingDirectories.value = true
  try {
    const workspacesResponse = await caseApi.getCaseDirectories(targetWorkspaceCode.value)
    directoryWorkspaces.value = workspacesResponse
    const current = workspacesResponse.find(item => item.workspaceCode === targetWorkspaceCode.value)
    directoryOptions.value = flattenDirectories(current?.children ?? [])
  } catch (error) {
    directoryWorkspaces.value = []
    directoryOptions.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingDirectories.value = false
  }
}

async function refreshLatestTaskRecord() {
  if (!targetWorkspaceCode.value) {
    taskRecords.value = []
    latestTaskRecord.value = null
    activeProcessTaskId.value = ''
    stopTaskPolling()
    stopEventStream()
    return
  }

  const records = await caseAiApi.listTasks(targetWorkspaceCode.value)
  taskRecords.value = records.map((record) => {
    const existing = record.taskId === latestTaskRecord.value?.taskId
      ? latestTaskRecord.value
      : taskRecords.value.find(item => item.taskId === record.taskId)
    return mergeTaskRecord(record, existing)
  })
  if (processDialogVisible.value && activeProcessTaskId.value) {
    updateTaskRecordSnapshot(await caseAiApi.getTask(targetWorkspaceCode.value, activeProcessTaskId.value))
  } else {
    latestTaskRecord.value = pickLatestTaskRecord(taskRecords.value)
    syncEventStream(latestTaskRecord.value)
  }

  if (taskRecords.value.some(item => ['PENDING', 'GENERATING', 'REVIEWING'].includes(item.status))) {
    startTaskPolling()
  } else {
    stopTaskPolling()
  }
}

async function refreshPageData() {
  await Promise.all([
    loadConfig(),
    loadDirectoryOptions(),
    refreshLatestTaskRecord(),
  ])
}

async function ensureDirectoryPath(path: string) {
  if (!targetWorkspaceCode.value) {
    throw new Error('请先选择目标空间')
  }

  const segments = normalizeDirectorySegments(path)
  if (!segments.length) {
    throw new Error('请先填写用例保存路径')
  }

  const getWorkspaceChildren = () => {
    return directoryWorkspaces.value.find(item => item.workspaceCode === targetWorkspaceCode.value)?.children ?? []
  }

  let siblings = getWorkspaceChildren()
  let parentId: number | null = null
  let currentNode: CaseDirectoryNode | null = null
  let createdAny = false

  for (const segment of segments) {
    let matchedNode = siblings.find(item => item.name === segment) ?? null
    if (!matchedNode) {
      matchedNode = await caseApi.createCaseDirectory(targetWorkspaceCode.value, {
        workspaceCode: selectedWorkspaceCode.value === 'ALL' ? targetWorkspaceCode.value : undefined,
        parentId,
        name: segment,
      })
      createdAny = true
      siblings.push(matchedNode)
    }
    currentNode = matchedNode
    parentId = matchedNode.id
    siblings = matchedNode.children ?? []
  }

  if (createdAny) {
    await loadDirectoryOptions()
  }

  return {
    directoryId: currentNode?.id ?? null,
    directoryName: segments.join('/'),
  }
}

function triggerRequirementImport() {
  if (!targetWorkspaceCode.value) {
    ElMessage.warning('请先选择目标空间')
    return
  }
  requirementFileInput.value?.click()
}

async function handleRequirementFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  await importRequirementFile(file)
  input.value = ''
}

function getTaskSourceLabel(task: AiGenerationTaskItem) {
  if (task.taskId === documentTaskRecordId.value) return '上传文档'
  if (task.taskId === manualTaskRecordId.value) return '手动输入'
  if (task.sourceTaskId === documentTaskRecordId.value) return '上传文档'
  return '手动输入'
}

function getTaskSourceDisplay(task: AiGenerationTaskItem) {
  return getTaskSourceLabel(task) === '上传文档' ? '📎 上传文档' : '✏️ 手动输入'
}

async function handleRecentTaskAction(task: AiGenerationTaskItem) {
  if (isRunningTask(task)) {
    await openTaskProcessDialog(task.taskId)
    return
  }
  if (task.status === 'COMPLETED') {
    openTaskResult(task.taskId)
    return
  }
  if (task.status === 'FAILED') {
    try {
      const source = getTaskSourceLabel(task)
      const next = await caseAiApi.retryTask(task.workspaceCode || targetWorkspaceCode.value, task.taskId)
      if (source === '上传文档') {
        documentTaskRecordId.value = next.taskId
      } else {
        manualTaskRecordId.value = next.taskId
      }
      updateTaskRecordSnapshot(next)
      await openTaskProcessDialog(next.taskId)
      ElMessage.success('已创建新的重试任务，后台会继续执行')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    }
    return
  }
  openTaskDetail(task.taskId)
}

async function handleRequirementDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) {
    return
  }
  await importRequirementFile(file)
}

async function importRequirementFile(file: File) {
  if (!targetWorkspaceCode.value) {
    ElMessage.warning('请先选择目标空间')
    return
  }

  importingRequirement.value = true
  try {
    const response = await caseAiApi.importRequirementDocument(targetWorkspaceCode.value, file)
    importedRequirementTitle.value = response.title || file.name.replace(/\.[^.]+$/, '')
    importedRequirementContent.value = response.content
    requirementAssets.value = response.assets
    importedDocument.value = {
      fileName: response.fileName || file.name,
      fileSize: file.size,
    }
    ElMessage.success(`已导入需求文档：${response.fileName}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    importingRequirement.value = false
  }
}

function clearImportedDocument() {
  importedDocument.value = null
  requirementAssets.value = []
  importedRequirementTitle.value = ''
  importedRequirementContent.value = ''
  documentDirectoryBasePath.value = ''
  documentForm.value.directoryPath = ''
}

function openDirectoryPicker(mode: DirectoryPickerMode) {
  if (!targetWorkspaceCode.value) {
    ElMessage.warning('请先选择目标空间')
    return
  }

  directoryPickerMode.value = mode
  directoryPickerKeyword.value = ''
  autoCreateSubdirectory.value = true
  directoryPickerSelectedPath.value = mode === 'manual'
    ? (manualDirectoryBasePath.value || findDirectoryBasePath(manualForm.value.manualDirectoryPath))
    : (documentDirectoryBasePath.value || findDirectoryBasePath(documentForm.value.directoryPath))
  directoryPickerVisible.value = true
}

function handleDirectoryPickerNodeSelect(node: DirectoryPickerNode) {
  if (!node.selectable) {
    return
  }
  directoryPickerSelectedPath.value = node.fullPath
}

function confirmDirectoryPickerSelection() {
  if (!directoryPickerSelectedPath.value) {
    ElMessage.warning('请先选择用例保存路径')
    return
  }

  const selectedPath = normalizeDirectoryPath(directoryPickerSelectedPath.value)
  if (directoryPickerMode.value === 'manual') {
    manualDirectoryBasePath.value = selectedPath
    manualAutoCreateSubdirectory.value = autoCreateSubdirectory.value
    syncingManualDirectoryPath = true
    manualForm.value.manualDirectoryPath = autoCreateSubdirectory.value
      ? buildDirectoryPath(selectedPath, manualForm.value.requirementTitle)
      : selectedPath
  } else {
    documentDirectoryBasePath.value = selectedPath
    documentAutoCreateSubdirectory.value = autoCreateSubdirectory.value
    syncingDocumentDirectoryPath = true
    documentForm.value.directoryPath = autoCreateSubdirectory.value
      ? buildDirectoryPath(selectedPath, importedRequirementTitle.value)
      : selectedPath
  }
  directoryPickerVisible.value = false
}

function requestGenerateCases(source: DirectoryPickerMode) {
  const blockReason = source === 'document'
    ? documentGenerateBlockReason.value
    : manualGenerateBlockReason.value
  if (blockReason) {
    ElMessage.warning(blockReason)
    return
  }
  pendingGenerateSource.value = source
  confirmGenerateVisible.value = true
}

async function confirmGenerateCases() {
  const source = pendingGenerateSource.value
  confirmGenerateVisible.value = false
  await handleGenerateCases(source)
}

async function openTaskProcessDialog(taskId?: string) {
  await refreshLatestTaskRecord()
  activeProcessTaskId.value = taskId || ''
  const record = taskId && targetWorkspaceCode.value
    ? await caseAiApi.getTask(targetWorkspaceCode.value, taskId)
    : pickLatestTaskRecord(taskRecords.value)
  if (record) {
    updateTaskRecordSnapshot(record)
  } else {
    latestTaskRecord.value = null
  }

  if (!latestTaskRecord.value) {
    ElMessage.info('暂无可查看的任务')
    return
  }

  activeProcessTaskId.value = latestTaskRecord.value.taskId
  processDialogVisible.value = true
  syncEventStream(latestTaskRecord.value)
}

function openTaskDetail(taskId: string) {
  void router.push({
    name: 'cases-ai-record-detail',
    params: {
      taskId,
    },
    query: {
      workspace: targetWorkspaceCode.value || undefined,
    },
  })
}

function openTaskResult(taskId: string) {
  openTaskDetail(taskId)
}

function openTaskRecordsPage() {
  void router.push({
    name: 'cases-ai-records',
    query: {
      workspace: targetWorkspaceCode.value || undefined,
    },
  })
}

function goToAiConfig() {
  void router.push({
    name: 'cases-ai-config',
    query: {
      workspace: targetWorkspaceCode.value || undefined,
    },
  })
}

async function handleGenerateCases(source: DirectoryPickerMode = 'manual') {
  const blockReason = source === 'document'
    ? documentGenerateBlockReason.value
    : manualGenerateBlockReason.value
  const requirementTitle = source === 'document'
    ? importedRequirementTitle.value.trim()
    : manualForm.value.requirementTitle.trim()
  const requirementContent = source === 'document'
    ? importedRequirementContent.value.trim()
    : manualForm.value.requirementContent.trim()
  const directoryPath = source === 'document'
    ? normalizeDirectoryPath(documentForm.value.directoryPath)
    : normalizeDirectoryPath(manualForm.value.manualDirectoryPath)
  const canRun = source === 'document' ? canGenerateDocument.value : canGenerate.value

  if (!canRun || !targetWorkspaceCode.value || blockReason) {
    ElMessage.warning(blockReason || (source === 'document'
      ? '请先上传需求文档，并确认文档标题、用例保存路径、目标空间和 AI 配置可用'
      : '请先补充需求标题、需求描述、用例保存路径，并确认目标空间和 AI 配置可用'))
    return
  }

  if (!directoryPath) {
    ElMessage.warning(source === 'document'
      ? '请先选择用例保存模块路径，并确认文档标题已填写'
      : '请先选择用例保存模块路径，并确认需求标题已填写')
    return
  }

  const selectedAssetIds = source === 'document' ? selectedRequirementAssetIds.value : []
  generating.value = true

  try {
    const resolvedDirectory = await ensureDirectoryPath(directoryPath)
    let finalAssetIds = selectedAssetIds
    let ignoredAssetCount = 0

    if (source === 'document' && selectedAssetIds.length) {
      try {
        await caseAiApi.validateImageSupport(targetWorkspaceCode.value, { assetIds: selectedAssetIds })
      } catch (error) {
        const message = getRequestErrorMessage(error)
        try {
          await ElMessageBox.confirm(
            message || IMAGE_UNSUPPORTED_CONFIRM_MESSAGE,
            '模型不支持图片',
            {
              type: 'warning',
              confirmButtonText: '忽略图片继续生成',
              cancelButtonText: '取消生成',
              distinguishCancelAndClose: true,
            },
          )
        } catch {
          return
        }

        ignoredAssetCount = selectedAssetIds.length
        finalAssetIds = []
        ElMessage.warning(`已忽略 ${ignoredAssetCount} 个图片素材，将按纯文本需求继续生成。`)
      }
    }

    const baseRecord = await caseAiApi.createTask(targetWorkspaceCode.value, {
      workspaceCode: targetWorkspaceCode.value,
      requirementTitle,
      requirementContent,
      outputMode: manualForm.value.outputMode,
      directoryId: resolvedDirectory.directoryId,
      directoryName: resolvedDirectory.directoryName ?? directoryPath,
      assetIds: finalAssetIds,
      ignoredAssetCount,
    })

    if (source === 'document') {
      documentTaskRecordId.value = baseRecord.taskId
    } else {
      manualTaskRecordId.value = baseRecord.taskId
    }
    activeProcessTaskId.value = baseRecord.taskId
    updateTaskRecordSnapshot(baseRecord)
    processDialogVisible.value = true
    syncEventStream(baseRecord)
    await refreshLatestTaskRecord()
    startTaskPolling()
    ElMessage.success('AI 生成与评审任务已创建，后台会继续执行')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    generating.value = false
  }
}

async function cancelCurrentTask() {
  const currentRecord = getCurrentProcessRecord()
  if (!currentRecord?.taskId || !targetWorkspaceCode.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '取消后当前任务将停止继续生成，是否确认取消？',
      '取消生成',
      {
        type: 'warning',
        confirmButtonText: '确认取消',
        cancelButtonText: '继续生成',
      },
    )
  } catch {
    return
  }

  processPending.value = true
  try {
    updateTaskRecordSnapshot(await caseAiApi.cancelTask(targetWorkspaceCode.value, currentRecord.taskId))
    await refreshLatestTaskRecord()
    ElMessage.success('已取消当前生成任务')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

function continueCurrentTaskInBackground() {
  processDialogVisible.value = false
  ElMessage.warning('已切换至后台执行')
}

watch(
  () => selectedWorkspaceCode.value,
  () => {
    if (!isAllScope.value) {
      selectedTargetWorkspaceCode.value = selectedWorkspaceCode.value
    }
  },
)

watch(
  () => manualForm.value.requirementTitle,
  (value) => {
    if (!manualDirectoryBasePath.value || !manualAutoCreateSubdirectory.value) {
      return
    }
    if (syncingManualDirectoryPath) {
      syncingManualDirectoryPath = false
      return
    }
    manualForm.value.manualDirectoryPath = buildDirectoryPath(manualDirectoryBasePath.value, value)
  },
)

watch(
  () => importedRequirementTitle.value,
  (value) => {
    if (!documentDirectoryBasePath.value || !documentAutoCreateSubdirectory.value) {
      return
    }
    if (syncingDocumentDirectoryPath) {
      syncingDocumentDirectoryPath = false
      return
    }
    documentForm.value.directoryPath = buildDirectoryPath(documentDirectoryBasePath.value, value)
  },
)

watch(
  () => targetWorkspaceCode.value,
  async () => {
    requirementAssets.value = []
    manualTaskRecordId.value = ''
    documentTaskRecordId.value = ''
    manualDirectoryBasePath.value = ''
    documentDirectoryBasePath.value = ''
    manualForm.value.manualDirectoryPath = ''
    documentForm.value.directoryPath = ''
    await refreshPageData()
  },
)

watch(
  () => processDialogVisible.value,
  (visible) => {
    if (!visible) {
      stopEventStream()
      activeProcessTaskId.value = ''
      latestTaskRecord.value = pickLatestTaskRecord(taskRecords.value)
    }
  },
)

onMounted(async () => {
  await loadWorkspaces()
  await refreshPageData()
})

onBeforeUnmount(() => {
  stopTaskPolling()
  stopEventStream()
  if (streamRefreshTimer != null) {
    window.clearTimeout(streamRefreshTimer)
    streamRefreshTimer = null
  }
})
</script>

<template>
  <section class="figma-ai-case-generation">
    <template v-if="processDialogVisible && activeProcessRecord">
      <div class="figma-ai-case-generation__process">
        <main class="figma-ai-case-generation__process-main">
          <header class="figma-ai-case-generation__process-header">
            <div class="figma-ai-case-generation__process-title">
              <span class="figma-ai-case-generation__status-dot"></span>
              <strong>生成任务进行中</strong>
            </div>
            <div class="figma-ai-case-generation__process-actions">
              <span>耗时 {{ activeProcessElapsed }}</span>
              <button type="button" class="figma-ai-case-generation__ghost-button" @click="continueCurrentTaskInBackground">后台继续</button>
              <button type="button" class="figma-ai-case-generation__danger-button" :disabled="processPending" @click="cancelCurrentTask">
                <CircleStop :size="13" />取消
              </button>
            </div>
          </header>

          <section class="figma-ai-case-generation__step-panel">
            <div class="figma-ai-case-generation__steps">
              <template v-for="(step, index) in generationSteps" :key="step">
                <div
                  class="figma-ai-case-generation__step"
                  :class="{ 'is-active': activeProcessStep === index, 'is-finished': activeProcessStep > index }"
                >
                  <span class="figma-ai-case-generation__step-circle">
                    <Check v-if="activeProcessStep > index" :size="13" />
                    <LoaderCircle v-else-if="activeProcessStep === index" :size="14" />
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <span>{{ step }}</span>
                </div>
                <span
                  v-if="index < generationSteps.length - 1"
                  class="figma-ai-case-generation__step-connector"
                  :class="{ 'is-finished': activeProcessStep > index }"
                ></span>
              </template>
            </div>
            <div class="figma-ai-case-generation__process-metrics">
              <div><strong>{{ activeProcessGeneratedCount }}</strong><span>/ {{ activeProcessTotal }} 已生成</span></div>
              <i></i>
              <div><strong>{{ activeProcessReviewedCount }}</strong><span>/ {{ activeProcessTotal }} 已评审</span></div>
              <div class="figma-ai-case-generation__progress">
                <div><span :style="{ width: activeProcessPercent + '%' }"></span></div>
                <em>{{ activeProcessPercent }}%</em>
              </div>
            </div>
          </section>

          <section class="figma-ai-case-generation__log-panel">
            <div class="figma-ai-case-generation__section-caption">生成日志</div>
            <div v-if="activeProcessRecord.events?.length" class="figma-ai-case-generation__log-list">
              <div
                v-for="event in activeProcessRecord.events"
                :key="event.id || event.seq"
                class="figma-ai-case-generation__log-row"
                :class="'is-' + String(event.level || 'info').toLowerCase()"
              >
                <time>{{ formatEventTime(event.createdAt) }}</time><span></span><p>{{ event.message }}</p>
              </div>
            </div>
            <div v-else class="figma-ai-case-generation__log-empty">
              <LoaderCircle :size="16" />{{ activeProcessRecord.stepMessage || '正在准备生成任务...' }}
            </div>
          </section>
        </main>

        <aside class="figma-ai-case-generation__process-aside">
          <section>
            <div class="figma-ai-case-generation__section-caption">本次任务信息</div>
            <dl class="figma-ai-case-generation__task-info">
              <div><dt>需求标题</dt><dd>{{ activeProcessRecord.requirementTitle }}</dd></div>
              <div><dt>来源</dt><dd>{{ getTaskSourceLabel(activeProcessRecord) }}</dd></div>
              <div><dt>保存路径</dt><dd>{{ activeProcessRecord.directoryName || '-' }}</dd></div>
              <div><dt>生成模型</dt><dd>{{ activeProcessRecord.model || generatorConfig?.model || '-' }}</dd></div>
              <div><dt>评审模型</dt><dd>{{ reviewerConfig?.model || '-' }}</dd></div>
              <div><dt>输出模式</dt><dd>{{ activeProcessRecord.outputMode === 'STREAM' ? '⚡ 实时流式' : '📋 完整输出' }}</dd></div>
            </dl>
          </section>
          <section v-if="activeProcessRecord.outputMode === 'STREAM'" class="figma-ai-case-generation__preview-section">
            <div class="figma-ai-case-generation__section-caption">实时预览（{{ activeProcessRecord.generatedCases?.length || 0 }} 条）</div>
            <div class="figma-ai-case-generation__preview-list">
              <article v-for="(item, index) in activeProcessRecord.generatedCases" :key="index" class="figma-ai-case-generation__preview-item">
                <span :class="'is-' + String(item.priority || 'P2').toLowerCase()">{{ item.priority || 'P2' }}</span>
                <p>{{ item.title || '生成用例 #' + (index + 1) }}</p>
              </article>
              <div v-if="!activeProcessRecord.generatedCases?.length" class="figma-ai-case-generation__preview-empty">用例生成后将在这里实时展示</div>
            </div>
          </section>
          <section v-else class="figma-ai-case-generation__complete-output">
            <LoaderCircle :size="28" />
            <strong>完整输出模式</strong>
            <span>生成和评审完成后统一展示</span>
          </section>
          <footer>关闭页面后任务将在后台继续执行</footer>
        </aside>
      </div>
    </template>

    <template v-else>
      <aside class="figma-ai-case-generation__recent">
        <header>
          <strong>最近生成任务</strong>
          <button type="button" @click="openTaskRecordsPage">全部记录 <ArrowRight :size="11" /></button>
        </header>
        <div class="figma-ai-case-generation__recent-list">
          <article
            v-for="task in recentTaskRecords"
            :key="task.taskId"
            class="figma-ai-case-generation__recent-item"
            :class="{ 'is-failed': task.status === 'FAILED' }"
          >
            <div class="figma-ai-case-generation__recent-title">
              <span :class="getTaskStatusTone(task.status)">
                <i v-if="isRunningTask(task)" class="figma-ai-case-generation__running-dot" aria-hidden="true"></i>
                <CircleCheckBig v-else-if="task.status === 'COMPLETED'" :size="12" />
                <XCircle v-else-if="task.status === 'FAILED'" :size="12" />
                <CircleStop v-else :size="12" />
              </span>
              <strong>{{ task.requirementTitle || '未命名生成任务' }}</strong>
            </div>
            <div class="figma-ai-case-generation__recent-meta">
              <span>{{ getTaskSourceDisplay(task) }}</span><span>{{ isRunningTask(task) ? '进行中' : formatTaskTime(task.createdAt) }}</span>
            </div>
            <div class="figma-ai-case-generation__recent-counts">
              <span v-if="task.status === 'FAILED'" class="is-failed">生成失败</span>
              <template v-else>
                <span>生成 {{ task.generatedCount || task.generatedCases?.length || 0 }} 条</span>
                <span v-if="task.savedCaseCount" class="is-adopted">采纳 {{ task.savedCaseCount }} 条</span>
              </template>
            </div>
            <button
              type="button"
              class="figma-ai-case-generation__task-action"
              :class="{ 'is-primary': isRunningTask(task), 'is-danger': task.status === 'FAILED' }"
              @click="handleRecentTaskAction(task)"
            >
              <RotateCcw v-if="task.status === 'FAILED'" :size="11" />{{ getTaskDetailActionLabel(task) }}
            </button>
          </article>
          <div v-if="!recentTaskRecords.length" class="figma-ai-case-generation__recent-empty">暂无生成任务</div>
        </div>
        <section class="figma-ai-case-generation__guide">
          <h4><BookOpen :size="12" /> 如何开始</h4>
          <ol>
            <li><span>1</span>在右侧填写需求标题和描述</li>
            <li><span>2</span>选择用例保存路径</li>
            <li><span>3</span>点击「开始生成」</li>
          </ol>
        </section>
      </aside>

      <main class="figma-ai-case-generation__workspace">
        <div v-if="isAllScope" class="figma-ai-case-generation__workspace-select">
          <span>目标空间</span>
          <el-select v-model="selectedTargetWorkspaceCode" :loading="loadingWorkspaces" clearable filterable placeholder="请选择目标空间">
            <el-option v-for="workspace in workspaces" :key="workspace.workspaceCode" :label="workspace.workspaceName" :value="workspace.workspaceCode" />
          </el-select>
        </div>
        <div class="figma-ai-case-generation__content">
          <header class="figma-ai-case-generation__hero">
            <div><Sparkles :size="18" /><h1>AI 用例生成</h1></div>
            <p>输入需求描述，AI 自动生成结构化测试用例并完成双模型评审</p>
          </header>
          <div class="figma-ai-case-generation__mode-tabs" role="tablist" aria-label="需求来源">
            <button type="button" :class="{ 'is-active': inputMode === 'manual' }" @click="inputMode = 'manual'">✏️ 手动输入</button>
            <button type="button" :class="{ 'is-active': inputMode === 'document' }" @click="inputMode = 'document'">📎 上传文档</button>
          </div>

          <section v-if="inputMode === 'manual'" class="figma-ai-case-generation__card figma-ai-case-generation__requirement-card">
            <label>
              <span>需求标题 <em>*</em></span>
              <input v-model="manualForm.requirementTitle" maxlength="120" type="text" placeholder="简要描述这批用例的需求主题，如：用户登录与认证流程" />
            </label>
            <label class="figma-ai-case-generation__description-field">
              <span>需求描述 <em>*</em><small>{{ manualForm.requirementContent.length }} / 3000</small></span>
              <textarea
                v-model="manualForm.requirementContent"
                maxlength="3000"
                placeholder="详细说明功能逻辑、使用场景、用户角色、业务规则、异常处理和验收标准&#10;&#10;示例（可描述以下内容）：&#10;• 正常流程与步骤&#10;• 边界条件与异常场景&#10;• 角色权限与数据范围&#10;• 验收标准"
              ></textarea>
            </label>
          </section>

          <section v-else class="figma-ai-case-generation__card figma-ai-case-generation__upload-card">
            <template v-if="importedDocument">
              <div class="figma-ai-case-generation__uploaded-file">
              <CircleCheckBig :size="16" />
                <div>
                  <strong>{{ importedDocument.fileName }}</strong>
                  <span>{{ formatFileSize(importedDocument.fileSize) }} · 解析成功，识别到 {{ importedRequirementContent.length }} 字</span>
                </div>
                <button type="button" aria-label="移除文档" @click="clearImportedDocument"><X :size="15" /></button>
              </div>
              <label>
                <span>需求标题 <em>*</em></span>
                <input v-model="importedRequirementTitle" maxlength="120" type="text" placeholder="从文档提取或手动填写需求标题" />
              </label>
            </template>
            <button
              v-else
              type="button"
              class="figma-ai-case-generation__dropzone"
              :class="{ 'is-loading': importingRequirement }"
              @click="triggerRequirementImport"
              @dragover.prevent
              @drop.prevent="handleRequirementDrop"
            >
              <LoaderCircle v-if="importingRequirement" :size="32" />
              <Upload v-else :size="32" />
              <strong>{{ importingRequirement ? '正在上传并解析文档...' : '拖拽文件到此处或点击上传' }}</strong>
              <span>支持 PDF、DOC、DOCX、TXT、Markdown · 最大 20MB</span>
            </button>
          </section>

          <section class="figma-ai-case-generation__card figma-ai-case-generation__config-card">
            <header>生成配置</header>
            <div class="figma-ai-case-generation__config-row">
              <label>保存路径 <em>*</em></label>
              <button
                type="button"
                class="figma-ai-case-generation__path-button"
                :class="{ 'has-value': inputMode === 'manual' ? !!manualDirectoryDisplayPath : !!documentDirectoryDisplayPath }"
                :disabled="loadingDirectories"
                @click="openDirectoryPicker(inputMode)"
              >
                <FolderOpen :size="14" />
                <span>{{ inputMode === 'manual' ? (manualDirectoryDisplayPath || '点击选择保存目录...') : (documentDirectoryDisplayPath || '点击选择保存目录...') }}</span>
              <CircleCheckBig v-if="inputMode === 'manual' ? !!manualDirectoryDisplayPath : !!documentDirectoryDisplayPath" :size="13" />
                <ChevronRight v-else :size="14" />
              </button>
            </div>
            <div class="figma-ai-case-generation__config-row">
              <label>AI 配置</label>
              <div class="figma-ai-case-generation__ai-config" :class="aiConfigStatusClass">
                <CircleCheckBig v-if="aiConfigReady" :size="14" />
                <AlertTriangle v-else :size="15" />
                <span v-if="aiConfigReady">
                  生成：{{ generatorConfig?.model || '-' }} · 评审：{{ reviewerConfig?.model || '-' }}
                  <template v-if="generatorConfig?.supportsImageInput"> · 支持图片识别</template>
                </span>
                <span v-else>{{ aiConfigStatusText }}</span>
                <button type="button" @click="goToAiConfig">AI 配置 <ArrowRight :size="12" /></button>
              </div>
            </div>
            <div class="figma-ai-case-generation__config-row figma-ai-case-generation__output-row">
              <label>输出模式</label>
              <div class="figma-ai-case-generation__output-options">
                <button type="button" :class="{ 'is-active': manualForm.outputMode === 'STREAM' }" @click="manualForm.outputMode = 'STREAM'">
                  <strong>⚡ 实时流式</strong><span>逐步展示生成过程，适合观察</span>
                </button>
                <button type="button" :class="{ 'is-active': manualForm.outputMode === 'COMPLETE' }" @click="manualForm.outputMode = 'COMPLETE'">
                  <strong>📋 完整输出</strong><span>全部完成后统一展示，适合批量</span>
                </button>
              </div>
            </div>
          </section>

          <div class="figma-ai-case-generation__submit-row">
            <span>{{ inputMode === 'manual' ? manualGenerateBlockReason : documentGenerateBlockReason }}</span>
            <button
              type="button"
              class="figma-ai-case-generation__primary-button"
              :disabled="generating || (inputMode === 'manual' ? !canGenerate : !canGenerateDocument)"
              @click="requestGenerateCases(inputMode)"
            >
              <LoaderCircle v-if="generating" :size="15" /><Sparkles v-else :size="15" />开始生成
            </button>
          </div>
        </div>
        <input ref="requirementFileInput" class="figma-ai-case-generation__hidden-input" type="file" accept=".pdf,.doc,.docx,.md,.markdown,.txt" @change="handleRequirementFileChange" />
      </main>
    </template>

    <el-dialog v-model="directoryPickerVisible" class="figma-ai-case-generation-path-dialog" width="480px" :close-on-click-modal="false" align-center append-to-body>
      <template #header><div class="figma-ai-case-generation-path-dialog__title">选择保存路径</div></template>
      <div class="figma-ai-case-generation-path-dialog__body">
        <p>当前工作区：{{ currentWorkspaceName || targetWorkspaceCode || '-' }}</p>
        <div class="figma-ai-case-generation-path-dialog__tree">
          <el-tree
            :data="filteredDirectoryPickerTree"
            node-key="key"
            :props="{ label: 'name', children: 'children' }"
            :current-node-key="directoryPickerSelectedPath"
            :default-expand-all="false"
            highlight-current
            @node-click="handleDirectoryPickerNodeSelect"
          >
            <template #default="{ data }">
              <span class="figma-ai-case-generation-path-dialog__node">
                <FolderOpen v-if="data.children?.length" :size="14" /><FileText v-else :size="14" />{{ data.name }}
              </span>
            </template>
          </el-tree>
        </div>
        <div v-if="directoryPickerPreviewPath" class="figma-ai-case-generation-path-dialog__preview">
          <span>保存路径预览</span>
          <strong>{{ directoryPickerPreviewPath }}</strong>
        </div>
        <label class="figma-ai-case-generation-path-dialog__checkbox">
          <input v-model="autoCreateSubdirectory" type="checkbox" /><span>根据需求标题自动创建子目录</span>
        </label>
      </div>
      <template #footer>
        <button type="button" class="figma-ai-case-generation__ghost-button" @click="directoryPickerVisible = false">取消</button>
        <button type="button" class="figma-ai-case-generation__primary-button" :disabled="!directoryPickerSelectedPath" @click="confirmDirectoryPickerSelection">确认选择</button>
      </template>
    </el-dialog>

    <el-dialog v-model="confirmGenerateVisible" class="figma-ai-case-generation-confirm-dialog" width="440px" :close-on-click-modal="false" align-center append-to-body>
      <template #header><div class="figma-ai-case-generation-confirm-dialog__title"><Sparkles :size="18" />确认生成配置</div></template>
      <dl class="figma-ai-case-generation-confirm-dialog__summary">
        <div><dt>需求来源</dt><dd>{{ pendingGenerateSource === 'manual' ? '手动输入' : '上传文档' }}</dd></div>
        <div><dt>需求标题</dt><dd>{{ pendingGenerateSource === 'manual' ? manualForm.requirementTitle : importedRequirementTitle }}</dd></div>
        <div><dt>保存路径</dt><dd>{{ pendingGenerateSource === 'manual' ? manualDirectoryDisplayPath : documentDirectoryDisplayPath }}</dd></div>
        <div><dt>生成模型</dt><dd>{{ generatorConfig?.model || '-' }}</dd></div>
        <div><dt>评审模型</dt><dd>{{ reviewerConfig?.model || '-' }}</dd></div>
        <div><dt>输出模式</dt><dd>{{ manualForm.outputMode === 'STREAM' ? '⚡ 实时流式' : '📋 完整输出' }}</dd></div>
      </dl>
      <div class="figma-ai-case-generation-confirm-dialog__warning"><AlertTriangle :size="14" />生成过程不可中断建议，完成前请保持页面打开或选择后台执行</div>
      <template #footer>
        <button type="button" class="figma-ai-case-generation__ghost-button" @click="confirmGenerateVisible = false">取消</button>
        <button type="button" class="figma-ai-case-generation__primary-button" :disabled="generating" @click="confirmGenerateCases"><Sparkles :size="14" />开始生成</button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.ai-generate-page {
  display: grid;
  align-content: start;
  gap: 17.5px;
  padding: 21px;
}

.ai-generate-page__heading h2 {
  margin: 0;
  color: #1d2129;
  font-size: 17px;
  font-weight: 600;
  line-height: 25.5px;
}

.ai-generate-page__heading p {
  margin: 3.5px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
}

.panel-card {
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.workspace-select-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
}

.workspace-select-bar__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  white-space: nowrap;
}

.workspace-select-bar__select {
  width: 260px;
}

.ai-generate-page :deep(.el-input__wrapper),
.ai-generate-page :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
  font-size: 13px;
}

.ai-generate-page :deep(.el-input__inner) {
  height: 28px;
  color: #1d2129;
  font-size: 13px;
  line-height: 28px;
}

.ai-output-mode-card,
.input-panel,
.upload-panel,
.bottom-action-card {
  padding: 18.5px;
}

.input-panel,
.upload-panel {
  min-height: 462.25px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  color: #1d2129;
}

.section-title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.section-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 21px;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.output-section-icon {
  font-size: 20px;
  transform: translateY(-1px);
}

.section-desc,
.char-count,
.upload-box-desc,
.process-dialog-subtitle,
.process-step-desc,
.process-current-text {
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}

.section-desc {
  margin-top: 6px;
}

.ai-config-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-config-empty-hint {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--app-text-muted);
}

.output-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.output-mode-grid-visual {
  gap: 14px;
}

.output-mode-card {
  display: grid;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.78);
  cursor: pointer;
}

.output-mode-card-visual {
  display: flex;
  flex-direction: column;
  min-height: 79.5px;
  align-items: stretch;
  justify-content: flex-start;
  padding: 16px;
  border: 2px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: none;
}

.output-mode-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.output-mode-card-active {
  border-color: #165dff;
  background: rgb(22 93 255 / 2%);
  box-shadow: none;
}

.output-mode-title {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  color: #1d2129;
}

.output-mode-card-active .output-mode-title {
  color: #165dff;
}

.output-mode-card-active .output-mode-title::after {
  content: '✓';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: auto;
  border-radius: 50%;
  background: #165dff;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.output-mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.output-mode-desc {
  margin-top: 7px;
  font-size: 12px;
  font-weight: 500;
  line-height: 19.5px;
  color: #86909c;
  max-width: none;
}

.main-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10.5px;
  align-items: stretch;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 21px;
  margin-bottom: 14px;
}

.form-stack {
  display: grid;
  gap: 10.5px;
  min-height: 100%;
  align-content: start;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  color: #4e5969;
}

.field-required {
  color: #ef4444;
}

.directory-path-input {
  width: 100%;
}

.directory-path-input :deep(.el-input__wrapper) {
  cursor: default;
}

.directory-path-input-with-action :deep(.el-input__suffix) {
  margin-left: 8px;
}

.path-action-icon-button {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.path-action-icon-button:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #175cd3;
}

.requirement-textarea :deep(.el-textarea__inner) {
  min-height: 175.5px !important;
  padding: 9.75px 11.5px;
  border-radius: 7px;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.char-count {
  text-align: right;
  margin-top: -2px;
  padding-bottom: 8px;
}

.path-action-stack,
.upload-card-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10.5px;
  margin-top: 0;
}

.generate-primary-btn {
  width: 100%;
  height: 35px;
  border-radius: 11px;
  border-color: #c9cdd4;
  background: #c9cdd4;
  font-size: 13px;
  font-weight: 600;
}

.generate-primary-btn:hover,
.generate-primary-btn:focus {
  border-color: #24974d;
  background: #24974d;
}

.generate-primary-btn:disabled {
  border-color: #c7cdd6;
  background: #c7cdd6;
  color: #fff;
}

.flow-secondary-btn {
  width: auto;
  height: 35px;
  margin-left: 0;
  border-radius: 11px;
  border-color: #e5e6eb;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
}

.flow-secondary-btn:hover,
.flow-secondary-btn:focus {
  border-color: rgba(36, 107, 255, 0.28);
  color: #175cd3;
  background: rgba(239, 246, 255, 0.72);
}

.upload-large-box {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3.5px;
  width: 100%;
  min-height: 260px;
  border: 2px dashed #e5e6eb;
  border-radius: 11px;
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  padding: 20px;
  margin-bottom: 0;
}

.upload-large-box:hover {
  border-color: rgba(36, 107, 255, 0.34);
  background: rgba(233, 240, 255, 0.72);
}

.upload-panel-body {
  display: grid;
  align-content: start;
  padding-top: 14px;
}

.upload-success-shell {
  display: grid;
  align-content: start;
  gap: 16px;
  min-height: 432px;
}

.upload-success-box {
  padding: 14px;
  border: 1px dashed var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.upload-success-file {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
}

.upload-success-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(237, 233, 254, 0.8);
  color: #7c3aed;
  font-size: 20px;
}

.upload-success-meta {
  min-width: 0;
  text-align: center;
}

.upload-success-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  line-height: 1.6;
  word-break: break-word;
}

.upload-success-size {
  margin-top: 4px;
  font-size: 13px;
  color: var(--app-text-muted);
}

.upload-remove-btn {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #f43f5e;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}

.upload-detail-form {
  display: grid;
  gap: 12px;
}

.upload-hint-box {
  padding: 12px 14px;
  border: 1px solid rgba(36, 107, 255, 0.14);
  border-radius: 10px;
  background: rgba(239, 246, 255, 0.82);
  font-size: 13px;
  line-height: 1.75;
  color: #1d4ed8;
}

.upload-box-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: #f2f3f5;
  color: #c9cdd4;
  font-size: 24px;
}

.upload-box-center {
  display: grid;
  gap: 10px;
  text-align: center;
}

.upload-box-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  color: #4e5969;
}

.upload-primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 77px;
  height: 28px;
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
}

.ai-config-card {
  padding: 18.5px;
}

.ai-generate-page__legacy-workspace,
.ai-generate-page__legacy-config,
.ai-generate-page__legacy-recent {
  display: none;
}

.ai-config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 6px;
}

.ai-config-grid-five {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.config-info-item {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 12px;
  min-height: 108px;
  padding: 16px 18px;
  border: 1px solid rgba(221, 229, 240, 0.9);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.config-info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
  line-height: 1.4;
}

.config-info-value {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.65;
  color: var(--app-text-primary);
  word-break: break-word;
}

.config-info-value-danger {
  color: #b42318;
  font-weight: 600;
}

.config-status-panel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.config-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  flex-shrink: 0;
}

.config-status-success {
  color: #067647;
  background: rgba(236, 253, 243, 0.95);
  border-color: rgba(18, 183, 106, 0.2);
}

.config-status-danger {
  color: #b42318;
  background: rgba(254, 242, 242, 0.96);
  border-color: rgba(240, 68, 56, 0.18);
}

.recent-task-card {
  padding: 18px 20px 16px;
  border: 1px solid rgba(221, 229, 240, 0.9);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.recent-task-header {
  margin-bottom: 14px;
}

.recent-task-list {
  display: grid;
  gap: 10px;
}

.recent-task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
}

.recent-task-main {
  min-width: 0;
  display: grid;
  gap: 4px;
  flex: 1;
}

.recent-task-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-task-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--app-text-primary);
  word-break: break-word;
}

.recent-task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.recent-task-meta span:not(:last-child)::after {
  content: '路';
  margin-left: 8px;
  color: #c0c8d2;
}

.recent-task-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.recent-task-button {
  min-width: 84px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.recent-task-button-primary {
  border-color: rgba(36, 107, 255, 0.18);
  background: rgba(239, 246, 255, 0.88);
  color: #175cd3;
}

.recent-task-button-secondary {
  border-color: rgba(208, 213, 221, 0.9);
  color: #475467;
}

.recent-task-empty {
  padding: 16px 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--app-text-muted);
}

.recent-task-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-info {
  background: rgba(219, 234, 254, 0.92);
  color: #175cd3;
}

.status-warning {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.status-success {
  background: rgba(233, 248, 241, 0.92);
  color: #067647;
}

.status-danger {
  background: rgba(254, 228, 226, 0.92);
  color: #b42318;
}

.status-neutral {
  background: rgba(242, 244, 247, 0.96);
  color: #475467;
}

.hidden-file-input {
  display: none;
}

.process-dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.process-dialog-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.process-step-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.process-step-card {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.process-step-card-active {
  border-color: rgba(36, 107, 255, 0.36);
  background: rgba(233, 240, 255, 0.82);
}

.process-step-card-done {
  border-color: rgba(20, 163, 109, 0.22);
}

.process-step-card-failed {
  border-color: rgba(240, 68, 56, 0.26);
  background: rgba(254, 242, 242, 0.92);
}

.process-step-index {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.process-step-index-active,
.process-step-index-done {
  background: #2f88ff;
  color: #ffffff;
}

.process-step-index-failed {
  background: #f04438;
  color: #ffffff;
}

.process-step-title,
.process-current-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.process-step-status {
  margin-left: 8px;
  font-size: 12px;
  color: var(--app-text-muted);
}

.process-current-log {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
}

.process-failure-card {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(240, 68, 56, 0.18);
  border-radius: 10px;
  background: rgba(254, 242, 242, 0.96);
}

.process-failure-stage {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #b42318;
}

.process-failure-text {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #7a271a;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.path-picker-layout {
  display: grid;
  gap: 16px;
}

.path-picker-tree-panel {
  min-height: 320px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.path-picker-empty {
  min-height: 296px;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: #98a2b3;
  text-align: center;
}

.path-picker-tree-node {
  display: flex;
  align-items: center;
  min-height: 34px;
  width: 100%;
}

.path-picker-tree-node.is-workspace {
  font-weight: 700;
  color: #101828;
  cursor: default;
}

.path-picker-tree-node-label,
.path-picker-selected-value {
  font-size: 13px;
  line-height: 1.7;
  color: #344054;
  word-break: break-word;
}

.path-picker-selected-panel {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.path-picker-selected-label {
  font-size: 12px;
  color: #667085;
  line-height: 1.5;
}

@media (max-width: 1280px) {
  .main-content-grid {
    grid-template-columns: 1fr;
  }

  .input-panel,
  .upload-panel {
    min-height: auto;
  }

  .upload-panel-body {
    padding-top: 0;
  }

  .ai-config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-config-grid-five {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recent-task-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .recent-task-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .output-mode-grid {
    grid-template-columns: 1fr;
  }

  .ai-config-grid {
    grid-template-columns: 1fr;
  }

  .ai-config-grid-five {
    grid-template-columns: 1fr;
  }

  .path-action-stack,
  .upload-card-actions {
    grid-template-columns: 1fr;
  }

  .workspace-select-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-select-bar__select {
    width: 100%;
  }
}
</style>
<style scoped>
.figma-ai-case-generation {
  --ai-primary: #165dff;
  --ai-primary-hover: #0e42d2;
  --ai-success: #00b42a;
  --ai-danger: #f53f3f;
  --ai-warning: #ff7d00;
  --ai-text-1: #1d2129;
  --ai-text-2: #4e5969;
  --ai-text-3: #86909c;
  --ai-text-4: #c9cdd4;
  --ai-border: #e5e6eb;
  --ai-fill: #f2f3f5;
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  color: var(--ai-text-1);
  background: var(--ai-fill);
  font-family: inherit;
  font-size: 13px;
}

.figma-ai-case-generation *,
.figma-ai-case-generation *::before,
.figma-ai-case-generation *::after {
  box-sizing: border-box;
}

.figma-ai-case-generation button,
.figma-ai-case-generation input,
.figma-ai-case-generation textarea {
  font: inherit;
}

.figma-ai-case-generation button {
  border: 0;
  cursor: pointer;
}

.figma-ai-case-generation__recent {
  position: relative;
  display: flex;
  flex: 0 0 280px;
  flex-direction: column;
  min-width: 280px;
  height: auto;
  align-self: stretch;
  overflow: hidden;
  border-right: 1px solid var(--ai-border);
  background: #fff;
}

.figma-ai-case-generation__recent > header {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-case-generation__recent > header strong {
  color: var(--ai-text-3);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  line-height: 18px;
}

.figma-ai-case-generation__recent > header button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  color: var(--ai-primary);
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.figma-ai-case-generation__recent-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.figma-ai-case-generation__recent-item {
  height: 127px;
  min-height: 127px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--ai-border);
  background: #fff;
}

.figma-ai-case-generation__recent-item.is-failed {
  height: 132px;
  min-height: 132px;
}

.figma-ai-case-generation__recent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.figma-ai-case-generation__recent-title > span {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--ai-text-3);
}

.figma-ai-case-generation__running-dot {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ai-success);
}

.figma-ai-case-generation__recent-title > span.status-info {
  color: var(--ai-success);
}

.figma-ai-case-generation__recent-title > span.status-success {
  color: var(--ai-success);
}

.figma-ai-case-generation__recent-title > span.status-danger {
  color: var(--ai-danger);
}

.figma-ai-case-generation__recent-title > span.status-warning {
  color: var(--ai-warning);
}

.figma-ai-case-generation__recent-title > span.status-neutral {
  color: var(--ai-text-3);
}

.figma-ai-case-generation__recent-title > span.status-info svg {
  animation: figma-ai-spin 1s linear infinite;
}

.figma-ai-case-generation__recent-title strong {
  overflow: hidden;
  color: var(--ai-text-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__recent-meta,
.figma-ai-case-generation__recent-counts {
  display: flex;
  align-items: flex-start;
  height: 22px;
  padding-top: 5px;
  color: var(--ai-text-3);
  font-size: 11px;
  line-height: 16.5px;
}

.figma-ai-case-generation__recent-counts {
  height: 22.5px;
  gap: 10px;
  padding-top: 6px;
}

.figma-ai-case-generation__recent-item.is-failed .figma-ai-case-generation__recent-meta {
  height: 28px;
  padding-top: 5px;
  padding-bottom: 6px;
}

.figma-ai-case-generation__recent-item.is-failed .figma-ai-case-generation__recent-counts {
  height: 21px;
  padding-top: 3px;
}

.figma-ai-case-generation__recent-meta span + span::before {
  margin-right: 7px;
  content: "·";
}

.figma-ai-case-generation__recent-counts .is-adopted {
  color: var(--ai-success);
}

.figma-ai-case-generation__recent-counts .is-failed {
  color: var(--ai-danger);
}

.figma-ai-case-generation .figma-ai-case-generation__task-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  margin-top: 8px;
  padding: 0 12px;
  border: 1px solid var(--ai-border);
  border-radius: 6px;
  color: var(--ai-primary);
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.figma-ai-case-generation .figma-ai-case-generation__task-action.is-primary {
  border-color: var(--ai-primary);
  color: #fff;
  background: var(--ai-primary);
}

.figma-ai-case-generation .figma-ai-case-generation__task-action.is-primary:hover {
  border-color: var(--ai-primary-hover);
  color: #fff;
  background: var(--ai-primary-hover);
}

.figma-ai-case-generation .figma-ai-case-generation__task-action:hover {
  border-color: var(--ai-primary);
  background: #f2f7ff;
}

.figma-ai-case-generation .figma-ai-case-generation__task-action.is-danger {
  border-color: rgba(245, 63, 63, 0.19);
  color: var(--ai-danger);
}

.figma-ai-case-generation__recent-empty {
  padding: 48px 20px;
  color: var(--ai-text-4);
  text-align: center;
}

.figma-ai-case-generation__guide {
  height: 123px;
  min-height: 123px;
  flex: 0 0 123px;
  padding: 14px 18px;
  border-top: 1px solid var(--ai-border);
  background: rgb(22 93 255 / 2%);
}

.figma-ai-case-generation__guide h4 {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 16.5px;
  margin: 0;
  color: var(--ai-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.figma-ai-case-generation__guide ol {
  display: block;
  margin: 0;
  padding: 0;
  list-style: none;
}

.figma-ai-case-generation__guide li {
  display: flex;
  height: 23px;
  align-items: flex-start;
  gap: 8px;
  padding-top: 5px;
  color: var(--ai-text-2);
  font-size: 12px;
  line-height: 18px;
}

.figma-ai-case-generation__guide li:first-child {
  height: 26px;
  padding-top: 8px;
}

.figma-ai-case-generation__guide li:last-child {
  height: 28px;
  padding-bottom: 5px;
}

.figma-ai-case-generation__guide li span {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: var(--ai-primary);
  font-size: 10px;
  line-height: 15px;
}

.figma-ai-case-generation__workspace {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: auto;
  align-self: stretch;
  overflow-y: auto;
  background: var(--ai-fill);
}

.figma-ai-case-generation__workspace-select {
  position: sticky;
  z-index: 3;
  top: 0;
  display: flex;
  width: min(720px, calc(100% - 48px));
  height: 52px;
  align-items: center;
  gap: 16px;
  margin: 0 auto;
  padding: 8px 0;
  background: var(--ai-fill);
}

.figma-ai-case-generation__workspace-select > span {
  color: var(--ai-text-2);
  white-space: nowrap;
}

.figma-ai-case-generation__workspace-select :deep(.el-select) {
  width: 260px;
}

.figma-ai-case-generation__content {
  width: 720px;
  max-width: calc(100% - 48px);
  margin: 0 auto;
  padding: 32px 0 36px;
}

.figma-ai-case-generation__workspace-select + .figma-ai-case-generation__content {
  padding-top: 10px;
}

.figma-ai-case-generation__hero {
  position: relative;
  margin-bottom: 28px;
}

.figma-ai-case-generation__hero > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.figma-ai-case-generation__hero svg {
  color: var(--ai-primary);
  stroke-width: 2;
}

.figma-ai-case-generation__hero h1 {
  margin: 0;
  color: var(--ai-text-1);
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.figma-ai-case-generation__hero p {
  margin: 6px 0 0;
  color: var(--ai-text-3);
  font-size: 13px;
  line-height: 20px;
}

.figma-ai-case-generation__mode-tabs {
  display: flex;
  width: 216px;
  align-items: center;
  gap: 0;
  height: 38px;
  margin-bottom: 24px;
  padding: 3px;
}

.figma-ai-case-generation__mode-tabs button {
  width: 105px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  color: var(--ai-text-3);
  background: transparent;
  font-size: 13px;
}

.figma-ai-case-generation__mode-tabs button.is-active {
  border: 1px solid var(--ai-border);
  color: var(--ai-text-1);
  background: #fff;
  box-shadow: 0 2px 5px rgb(0 0 0 / 6%);
  font-weight: 500;
}

.figma-ai-case-generation__card {
  overflow: hidden;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  background: #fff;
}

.figma-ai-case-generation__requirement-card {
  display: block;
  height: 352px;
  min-height: 0;
  padding: 0;
}

.figma-ai-case-generation__requirement-card > label:first-child {
  height: 85px;
  padding: 20px 24px 0;
}

.figma-ai-case-generation__requirement-card > .figma-ai-case-generation__description-field {
  height: 265px;
  padding: 18px 24px;
}

.figma-ai-case-generation__card label {
  display: block;
}

.figma-ai-case-generation__card label > span {
  display: flex;
  height: 24px;
  margin-bottom: 0;
  padding-bottom: 6px;
  color: var(--ai-text-2);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.figma-ai-case-generation em {
  margin-left: 3px;
  color: var(--ai-danger);
  font-style: normal;
}

.figma-ai-case-generation__description-field > span small {
  margin-left: auto;
  color: var(--ai-text-4);
  font-size: 11px;
  font-weight: 400;
}

.figma-ai-case-generation__card input,
.figma-ai-case-generation__card textarea {
  width: 100%;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  outline: 0;
  color: var(--ai-text-1);
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.figma-ai-case-generation__card input {
  height: 41px;
  padding: 0 13px;
}

.figma-ai-case-generation__card textarea {
  height: 200px;
  padding: 10px 12px;
  resize: none;
  line-height: 22.1px;
}

.figma-ai-case-generation__card input::placeholder,
.figma-ai-case-generation__card textarea::placeholder {
  color: #a9afb8;
}

.figma-ai-case-generation__card input:focus,
.figma-ai-case-generation__card textarea:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 2px rgb(22 93 255 / 10%);
}

.figma-ai-case-generation__upload-card {
  padding: 24px;
}

.figma-ai-case-generation__upload-card > label {
  margin-top: 18px;
}

button.figma-ai-case-generation__dropzone {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 2px dashed var(--ai-border);
  border-radius: 8px;
  color: var(--ai-text-3);
  background: #fff;
}

button.figma-ai-case-generation__dropzone:hover {
  border-color: var(--ai-primary);
  background: #f7f9ff;
}

.figma-ai-case-generation__dropzone svg {
  margin-bottom: 12px;
  color: var(--ai-text-4);
}

.figma-ai-case-generation__dropzone.is-loading svg {
  animation: figma-ai-spin 1s linear infinite;
}

.figma-ai-case-generation__dropzone strong {
  margin-bottom: 4px;
  color: var(--ai-text-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
}

.figma-ai-case-generation__dropzone span {
  font-size: 12px;
  line-height: 18px;
}

.figma-ai-case-generation__uploaded-file {
  display: flex;
  min-height: 65px;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border: 1px solid #b7ebc6;
  border-radius: 7px;
  color: var(--ai-success);
  background: #f7fcf8;
}

.figma-ai-case-generation__uploaded-file > div {
  display: grid;
  flex: 1;
  gap: 3px;
}

.figma-ai-case-generation__uploaded-file strong {
  color: var(--ai-text-1);
  font-size: 13px;
  font-weight: 500;
}

.figma-ai-case-generation__uploaded-file span {
  color: var(--ai-text-3);
  font-size: 12px;
}

.figma-ai-case-generation__uploaded-file button {
  display: inline-flex;
  color: var(--ai-text-3);
  background: transparent;
}

.figma-ai-case-generation__config-card {
  margin-top: 16px;
}

.figma-ai-case-generation__config-card > header {
  height: 47px;
  padding: 0 24px;
  border-bottom: 1px solid var(--ai-border);
  color: var(--ai-text-3);
  font-size: 12px;
  font-weight: 600;
  line-height: 47px;
}

.figma-ai-case-generation__config-row {
  display: grid;
  min-height: 66px;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  padding: 12px 24px;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-case-generation__config-row:last-child {
  border-bottom: 0;
}

.figma-ai-case-generation__config-row > label {
  color: var(--ai-text-2);
  font-size: 12px;
  font-weight: 400;
}

.figma-ai-case-generation .figma-ai-case-generation__path-button {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  color: var(--ai-text-4);
  background: #f7f8fa;
  text-align: left;
}

.figma-ai-case-generation .figma-ai-case-generation__path-button.has-value {
  border-color: rgb(22 93 255 / 38%);
  color: var(--ai-text-1);
  background: rgb(22 93 255 / 2.4%);
}

.figma-ai-case-generation__path-button span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__path-button svg {
  flex: 0 0 auto;
}

.figma-ai-case-generation__path-button.has-value svg:first-child {
  color: var(--ai-primary);
}

.figma-ai-case-generation__path-button.has-value svg:last-child {
  color: var(--ai-success);
}

.figma-ai-case-generation__ai-config {
  display: grid;
  height: 38px;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid #b7ebc6;
  border-radius: 6px;
  color: var(--ai-text-2);
  background: #f7fcf8;
  font-size: 12px;
}

.figma-ai-case-generation__ai-config.config-status-success > svg {
  color: var(--ai-success);
}

.figma-ai-case-generation__ai-config.config-status-danger {
  border-color: #ffccc7;
  color: #a8071a;
  background: #fff8f7;
}

.figma-ai-case-generation__ai-config.config-status-danger > svg {
  color: var(--ai-danger);
}

.figma-ai-case-generation__ai-config > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__ai-config button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  color: var(--ai-primary);
  background: transparent;
  font-size: 12px;
}

.figma-ai-case-generation__output-row {
  min-height: 88px;
}

.figma-ai-case-generation__output-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.figma-ai-case-generation__output-options button {
  display: grid;
  min-height: 63px;
  gap: 4px;
  align-content: center;
  padding: 8px 13px;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  color: var(--ai-text-3);
  background: #fff;
  text-align: left;
}

.figma-ai-case-generation__output-options button.is-active {
  border: 2px solid var(--ai-primary);
  padding: 7px 12px;
  background: #f7f9ff;
}

.figma-ai-case-generation__output-options button.is-active > strong {
  color: var(--ai-primary);
}

.figma-ai-case-generation__output-options strong {
  color: var(--ai-text-1);
  font-size: 13px;
  font-weight: 600;
}

.figma-ai-case-generation__output-options span {
  font-size: 11px;
}

.figma-ai-case-generation__submit-row {
  display: flex;
  min-height: 59px;
  align-items: center;
  justify-content: flex-end;
  gap: 15px;
}

.figma-ai-case-generation__submit-row > span {
  max-width: 480px;
  overflow: hidden;
  color: var(--ai-text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__primary-button,
.figma-ai-case-generation__ghost-button,
.figma-ai-case-generation__danger-button {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
}

.figma-ai-case-generation__primary-button {
  color: #fff;
  background: var(--ai-primary);
}

.figma-ai-case-generation__primary-button:hover {
  background: var(--ai-primary-hover);
}

.figma-ai-case-generation__primary-button:disabled,
.figma-ai-case-generation__ghost-button:disabled,
.figma-ai-case-generation__danger-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.figma-ai-case-generation__primary-button svg:first-child:is(.lucide-loader-circle) {
  animation: figma-ai-spin 1s linear infinite;
}

.figma-ai-case-generation__ghost-button {
  border: 1px solid #d9dce1;
  color: var(--ai-primary);
  background: #fff;
}

.figma-ai-case-generation__danger-button {
  border: 1px solid #ffccc7;
  color: var(--ai-danger);
  background: #fff;
}

.figma-ai-case-generation__hidden-input {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  opacity: 0;
  pointer-events: none;
}

.figma-ai-case-generation__process {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: 3fr 2fr;
  background: #fff;
}

.figma-ai-case-generation__process-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--ai-border);
  background: var(--ai-fill);
}

.figma-ai-case-generation__process-header {
  display: flex;
  height: 59px;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px 7px;
  border-bottom: 1px solid var(--ai-border);
  background: #fff;
}

.figma-ai-case-generation__process-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.figma-ai-case-generation__process-title strong {
  font-size: 15px;
  font-weight: 600;
}

.figma-ai-case-generation__status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--ai-success);
  animation: figma-ai-pulse 1.5s ease-in-out infinite;
}

.figma-ai-case-generation__process-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.figma-ai-case-generation__process-actions > span {
  margin-right: 2px;
  color: var(--ai-text-3);
  font-size: 12px;
}

.figma-ai-case-generation__process-actions button {
  height: 32px;
  padding: 0 13px;
}

.figma-ai-case-generation__step-panel {
  height: 109px;
  padding: 6px 28px 12px;
  border-bottom: 1px solid var(--ai-border);
  background: #fff;
}

.figma-ai-case-generation__steps {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14px;
}

.figma-ai-case-generation__step {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: var(--ai-text-4);
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}

.figma-ai-case-generation__step-connector {
  flex: 1;
  height: 2px;
  margin: 13px 4px 0;
  background: #dfe2e8;
  transition: background-color 0.3s;
}

.figma-ai-case-generation__step-connector.is-finished {
  background: var(--ai-success);
}

.figma-ai-case-generation__step-circle {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 2px solid #dfe2e8;
  border-radius: 50%;
  color: var(--ai-text-4);
  background: #f7f8fa;
  font-size: 11px;
  transition: all 0.3s;
}

.figma-ai-case-generation__step.is-active {
  color: var(--ai-primary);
}

.figma-ai-case-generation__step.is-active .figma-ai-case-generation__step-circle {
  border-color: var(--ai-primary);
  color: #fff;
  background: var(--ai-primary);
}

.figma-ai-case-generation__step.is-finished {
  color: var(--ai-success);
}

.figma-ai-case-generation__step.is-finished .figma-ai-case-generation__step-circle {
  border-color: var(--ai-success);
  color: #fff;
  background: var(--ai-success);
}

.figma-ai-case-generation__step.is-active .figma-ai-case-generation__step-circle svg {
  animation: figma-ai-spin 1s linear infinite;
}

.figma-ai-case-generation__process-metrics {
  display: flex;
  height: 22px;
  align-items: center;
  gap: 8px;
}

.figma-ai-case-generation__process-metrics > div:not(.figma-ai-case-generation__progress) {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.figma-ai-case-generation__process-metrics strong {
  font-size: 22px;
  line-height: 22px;
}

.figma-ai-case-generation__process-metrics span {
  color: var(--ai-text-3);
  font-size: 12px;
}

.figma-ai-case-generation__process-metrics > i {
  width: 1px;
  height: 20px;
  margin: 0 8px;
  background: var(--ai-border);
}

.figma-ai-case-generation__progress {
  display: flex;
  width: 200px;
  flex: 0 0 200px;
  align-items: center;
  gap: 9px;
  margin-left: auto;
}

.figma-ai-case-generation__progress > div {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: #e8eaed;
}

.figma-ai-case-generation__progress > div span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ai-primary);
  transition: width 0.4s;
}

.figma-ai-case-generation__progress em {
  width: 30px;
  color: var(--ai-text-3);
  font-size: 11px;
  text-align: right;
}

.figma-ai-case-generation__log-panel {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.figma-ai-case-generation__log-panel > .figma-ai-case-generation__section-caption {
  padding: 10px 28px 6px;
  color: var(--ai-text-4);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  letter-spacing: 0.5px;
}

.figma-ai-case-generation__log-list {
  min-height: 0;
  flex: 1 1 0;
  overflow-y: auto;
  padding: 0 28px 20px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.figma-ai-case-generation__log-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px solid #ebecef;
}

.figma-ai-case-generation__log-row time {
  color: var(--ai-text-4);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.figma-ai-case-generation__log-row > span {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--ai-primary);
}

.figma-ai-case-generation__log-row p {
  margin: 0;
  color: var(--ai-text-2);
  font-size: 12px;
  line-height: 18px;
}

.figma-ai-case-generation__log-row.is-success > span {
  background: var(--ai-success);
}

.figma-ai-case-generation__log-row.is-success p {
  color: var(--ai-success);
}

.figma-ai-case-generation__log-row.is-error > span {
  background: var(--ai-danger);
}

.figma-ai-case-generation__log-row.is-error p {
  color: var(--ai-danger);
}

.figma-ai-case-generation__log-row.is-warn > span,
.figma-ai-case-generation__log-row.is-warning > span {
  background: #ff7d00;
}

.figma-ai-case-generation__log-row.is-warn p,
.figma-ai-case-generation__log-row.is-warning p {
  color: #ff7d00;
}

.figma-ai-case-generation__log-empty {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  color: var(--ai-text-3);
  font-size: 12px;
}

.figma-ai-case-generation__log-empty svg {
  animation: figma-ai-spin 1s linear infinite;
}

.figma-ai-case-generation__process-aside {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.figma-ai-case-generation__process-aside > section:first-child {
  flex: 0 0 auto;
  padding: 20px 22px;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-case-generation__process-aside > section:first-child > .figma-ai-case-generation__section-caption {
  color: var(--ai-text-4);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  letter-spacing: 0.5px;
}

.figma-ai-case-generation__task-info {
  display: grid;
  gap: 0;
  margin: 12px 0 0;
}

.figma-ai-case-generation__task-info > div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.figma-ai-case-generation__task-info dt {
  margin: 0;
  padding-top: 1px;
  color: var(--ai-text-3);
  font-size: 11px;
  line-height: 17px;
}

.figma-ai-case-generation__task-info dd {
  margin: 0;
  overflow: hidden;
  color: var(--ai-text-1);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__preview-section {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.figma-ai-case-generation__preview-section > .figma-ai-case-generation__section-caption {
  flex: 0 0 auto;
  padding: 10px 22px 6px;
  color: var(--ai-text-4);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  letter-spacing: 0.5px;
}

.figma-ai-case-generation__preview-list {
  min-height: 0;
  flex: 1 1 0;
  overflow-y: auto;
  padding: 0 22px 16px;
  scrollbar-width: none;
}

.figma-ai-case-generation__preview-list::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.figma-ai-case-generation__preview-item {
  display: flex;
  min-height: 0;
  align-items: center;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-case-generation__preview-item > span {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 3px;
  color: #165dff;
  background: #e8f0ff;
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
}

.figma-ai-case-generation__preview-item > span.is-p0 {
  color: #f53f3f;
  background: #fff0f0;
}

.figma-ai-case-generation__preview-item > span.is-p1 {
  color: #ff7d00;
  background: #fff7e6;
}

.figma-ai-case-generation__preview-item > span.is-p3 {
  color: #86909c;
  background: #f2f3f5;
}

.figma-ai-case-generation__preview-item p {
  min-width: 0;
  flex: 1 1 0;
  margin: 0;
  overflow: hidden;
  color: var(--ai-text-1);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation__preview-empty {
  padding: 35px 0 19px;
  color: var(--ai-text-4);
  font-size: 12px;
  text-align: center;
}

.figma-ai-case-generation__complete-output {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--ai-text-3);
}

.figma-ai-case-generation__complete-output svg {
  color: var(--ai-text-4);
  animation: figma-ai-spin 1.5s linear infinite;
}

.figma-ai-case-generation__complete-output strong {
  color: var(--ai-text-2);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.figma-ai-case-generation__complete-output span {
  color: var(--ai-text-3);
  font-size: 12px;
  line-height: 18px;
}

.figma-ai-case-generation__process-aside > footer {
  flex: 0 0 auto;
  padding: 10px 22px;
  border-top: 1px solid #f0f1f2;
  color: var(--ai-text-3);
  background: #fffdf5;
  font-size: 11px;
  line-height: 17px;
}

:global(.el-dialog.figma-ai-case-generation-path-dialog),
:global(.el-dialog.figma-ai-case-generation-confirm-dialog) {
  padding: 0;
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 18%);
  font-family: inherit;
}

:global(.figma-ai-case-generation-path-dialog .el-dialog__header),
:global(.figma-ai-case-generation-confirm-dialog .el-dialog__header) {
  height: 62px;
  margin: 0;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.figma-ai-case-generation-path-dialog .el-dialog__headerbtn),
:global(.figma-ai-case-generation-confirm-dialog .el-dialog__headerbtn) {
  top: 12px;
  right: 14px;
  width: 38px;
  height: 38px;
}

.figma-ai-case-generation-path-dialog__title,
.figma-ai-case-generation-confirm-dialog__title {
  display: flex;
  height: 62px;
  align-items: center;
  gap: 8px;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
}

.figma-ai-case-generation-path-dialog__title {
  font-size: 15px;
  line-height: 22.5px;
}

.figma-ai-case-generation-confirm-dialog__title svg {
  color: #165dff;
}

:global(.figma-ai-case-generation-path-dialog .el-dialog__body) {
  padding: 16px 24px;
}

:global(.figma-ai-case-generation-confirm-dialog .el-dialog__body) {
  padding: 16px 24px 15px;
}

.figma-ai-case-generation-path-dialog__body > p {
  margin: 0 0 12px;
  color: #86909c;
  font-size: 12px;
}

.figma-ai-case-generation-path-dialog__tree {
  height: 260px;
  overflow-y: auto;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.figma-ai-case-generation-path-dialog__tree :deep(.el-tree-node__content) {
  height: 38px;
  border-bottom: 1px solid #e5e6eb;
}

.figma-ai-case-generation-path-dialog__tree :deep(.el-tree-node:last-child > .el-tree-node__content) {
  border-bottom: 0;
}

.figma-ai-case-generation-path-dialog__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: #165dff;
  background: #f2f7ff;
}

.figma-ai-case-generation-path-dialog__node {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #4e5969;
  font-size: 13px;
}

.figma-ai-case-generation-path-dialog__node svg {
  color: #86909c;
}

.figma-ai-case-generation-path-dialog__node svg.lucide-folder-open {
  color: #ff7d00;
}

.figma-ai-case-generation-path-dialog__tree :deep(.el-tree-node.is-current > .el-tree-node__content .figma-ai-case-generation-path-dialog__node),
.figma-ai-case-generation-path-dialog__tree :deep(.el-tree-node.is-current > .el-tree-node__content .figma-ai-case-generation-path-dialog__node svg) {
  color: #165dff;
}

.figma-ai-case-generation-path-dialog__preview {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgb(22 93 255 / 19%);
  border-radius: 6px;
  background: rgb(22 93 255 / 3.2%);
}

.figma-ai-case-generation-path-dialog__preview span,
.figma-ai-case-generation-path-dialog__preview strong {
  display: block;
}

.figma-ai-case-generation-path-dialog__preview span {
  margin-bottom: 2px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.figma-ai-case-generation-path-dialog__preview strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation-path-dialog__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: #4e5969;
  font-size: 12px;
}

.figma-ai-case-generation-path-dialog__checkbox input {
  width: 14px;
  height: 14px;
  accent-color: #165dff;
}

:global(.figma-ai-case-generation-path-dialog .el-dialog__footer),
:global(.figma-ai-case-generation-confirm-dialog .el-dialog__footer) {
  display: flex;
  height: 66px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 0;
  padding: 0 24px;
  border-top: 1px solid #e5e6eb;
}

.figma-ai-case-generation-confirm-dialog__summary {
  height: 244px;
  overflow: hidden;
  margin: 0;
  border: 1px solid #d9dce1;
  border-radius: 6px;
}

.figma-ai-case-generation-confirm-dialog__summary > div {
  display: grid;
  height: 40.5px;
  grid-template-columns: 90px minmax(0, 1fr);
  border-bottom: 1px solid #e5e6eb;
}

.figma-ai-case-generation-confirm-dialog__summary > div:last-child {
  height: 39.5px;
  border-bottom: 0;
}

.figma-ai-case-generation-confirm-dialog__summary dt,
.figma-ai-case-generation-confirm-dialog__summary dd {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0 13px;
  font-size: 12px;
}

.figma-ai-case-generation-confirm-dialog__summary dt {
  color: #86909c;
  background: #f7f8fa;
}

.figma-ai-case-generation-confirm-dialog__summary dd {
  overflow: hidden;
  color: #1d2129;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-case-generation-confirm-dialog__warning {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  padding: 8px 11px;
  border: 1px solid #ffcc99;
  border-radius: 6px;
  color: #4e5969;
  background: #fff7e8;
  font-size: 12px;
}

.figma-ai-case-generation-confirm-dialog__warning svg {
  flex: 0 0 auto;
  color: #ff7d00;
}

:global(.figma-ai-case-generation-path-dialog .figma-ai-case-generation__primary-button),
:global(.figma-ai-case-generation-confirm-dialog .figma-ai-case-generation__primary-button) {
  color: #fff;
  background: #165dff;
}

:global(.figma-ai-case-generation-path-dialog .figma-ai-case-generation__primary-button),
:global(.figma-ai-case-generation-path-dialog .figma-ai-case-generation__ghost-button) {
  height: 38px;
  padding: 0 20px;
}

:global(.figma-ai-case-generation-path-dialog .figma-ai-case-generation__primary-button:disabled) {
  opacity: 0.5;
}

:global(.figma-ai-case-generation-path-dialog .figma-ai-case-generation__ghost-button),
:global(.figma-ai-case-generation-confirm-dialog .figma-ai-case-generation__ghost-button) {
  border: 1px solid #d9dce1;
  color: #165dff;
  background: #fff;
}

@keyframes figma-ai-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes figma-ai-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

@media (max-width: 1180px) {
  .figma-ai-case-generation__recent {
    flex-basis: 248px;
    min-width: 248px;
  }

  .figma-ai-case-generation__content {
    max-width: calc(100% - 32px);
  }

  .figma-ai-case-generation__process {
    grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
  }
}
</style>
