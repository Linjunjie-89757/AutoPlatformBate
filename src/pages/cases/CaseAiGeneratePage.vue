<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CircleClose,
  DocumentAdd,
  FolderOpened,
  MagicStick,
  RefreshRight,
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskItem, type AiRequirementAssetItem } from '@/entities/case-ai'
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
const directoryPickerVisible = ref(false)

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

const processSteps = [
  {
    index: 1 as const,
    title: '任务已创建',
    description: '已记录需求内容、目标空间和输出模式。',
  },
  {
    index: 2 as const,
    title: 'AI 生成用例',
    description: '正在根据需求描述和附件生成候选测试用例。',
  },
  {
    index: 3 as const,
    title: 'AI 自动评审',
    description: '正在自动完成用例评审和建议汇总。',
  },
  {
    index: 4 as const,
    title: '任务完成',
    description: '生成结果已进入 AI 生成记录。',
  },
]

let taskPollingTimer: number | null = null
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
  return currentWorkspaceName.value
    ? `${currentWorkspaceName.value} / ${manualForm.value.manualDirectoryPath}`
    : manualForm.value.manualDirectoryPath
})

const documentDirectoryDisplayPath = computed(() => {
  if (!documentForm.value.directoryPath) {
    return ''
  }
  return currentWorkspaceName.value
    ? `${currentWorkspaceName.value} / ${documentForm.value.directoryPath}`
    : documentForm.value.directoryPath
})

const canGenerate = computed(() => !manualGenerateBlockReason.value)

const canGenerateDocument = computed(() => !documentGenerateBlockReason.value)

const selectedRequirementAssetIds = computed(() => requirementAssets.value.map(item => item.id))
const imageCapabilityNotices = computed(() => {
  const supportsImageInput = generatorConfig.value?.supportsImageInput ?? false
  return supportsImageInput
    ? ['模型支持图文输入，如文档中包含图片素材，将一并参与本次测试用例生成。']
    : ['模型不支持图片识别。若文档中包含图片素材，生成时可选择忽略图片并仅基于文本继续。']
})

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

  return [{
    key: `workspace:${targetWorkspaceCode.value}`,
    name: currentWorkspaceName.value,
    fullPath: currentWorkspaceName.value,
    selectable: false,
    children: appendFullPath(currentWorkspace?.children ?? []),
  }]
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

const directoryPickerPreviewPath = computed(() => {
  if (!directoryPickerSelectedPath.value) {
    return ''
  }

  const title = directoryPickerMode.value === 'manual'
    ? manualForm.value.requirementTitle
    : importedRequirementTitle.value
  const fullDirectoryPath = buildDirectoryPath(directoryPickerSelectedPath.value, title)
  return currentWorkspaceName.value
    ? `${currentWorkspaceName.value} / ${fullDirectoryPath}`
    : fullDirectoryPath
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
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function getTaskStatusLabel(status: string) {
  const labelMap: Record<string, string> = {
    PENDING: '待开始',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return labelMap[status] ?? status
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

function getFailureStepLabel(step: number | null) {
  const labelMap: Record<number, string> = {
    1: '任务创建',
    2: 'AI 生成用例',
    3: 'AI 自动评审',
    4: '任务完成',
  }
  return step ? labelMap[step] || '未知阶段' : '未知阶段'
}

function isStepDone(step: number) {
  const record = getCurrentProcessRecord()
  if (!record?.currentStep) {
    return false
  }
  if (record.status === 'FAILED') {
    return step < record.currentStep
  }
  if (record.status === 'COMPLETED') {
    return step <= 4
  }
  return step < record.currentStep
}

function isStepActive(step: number) {
  const record = getCurrentProcessRecord()
  return !!record?.currentStep && record.currentStep === step && ['PENDING', 'GENERATING', 'REVIEWING'].includes(record.status)
}

function isStepFailed(step: number) {
  const record = getCurrentProcessRecord()
  return record?.status === 'FAILED' && record.currentStep === step
}

function getStepStatusLabel(step: number) {
  const record = getCurrentProcessRecord()
  if (!record) {
    return ''
  }
  if (record.status === 'FAILED') {
    return record.currentStep === step ? '失败' : ''
  }
  if (record.status === 'COMPLETED') {
    return step === 4 ? '已完成' : ''
  }
  if (record.currentStep === step) {
    const labelMap: Record<string, string> = {
      PENDING: '等待中',
      GENERATING: '进行中',
      REVIEWING: '进行中',
    }
    return labelMap[record.status] ?? ''
  }
  return ''
}

function isTaskResultAvailable(task: AiGenerationTaskItem | null | undefined) {
  return task?.status === 'COMPLETED'
}

function getTaskDetailActionLabel(task: AiGenerationTaskItem) {
  if (task.status === 'COMPLETED') {
    return '查看结果'
  }
  if (task.status === 'FAILED') {
    return '查看记录'
  }
  return '查看详情'
}

function stopTaskPolling() {
  if (taskPollingTimer != null) {
    window.clearInterval(taskPollingTimer)
    taskPollingTimer = null
  }
}

function startTaskPolling() {
  stopTaskPolling()
  taskPollingTimer = window.setInterval(() => {
    void refreshLatestTaskRecord()
  }, 2500)
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
    return
  }

  taskRecords.value = await caseAiApi.listTasks(targetWorkspaceCode.value)
  if (processDialogVisible.value && activeProcessTaskId.value) {
    latestTaskRecord.value = await caseAiApi.getTask(targetWorkspaceCode.value, activeProcessTaskId.value)
  } else {
    latestTaskRecord.value = pickLatestTaskRecord(taskRecords.value)
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
  if (!file || !targetWorkspaceCode.value) {
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
    input.value = ''
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

function handleManualDirectorySelect(value: string) {
  const normalizedPath = normalizeDirectoryPath(value)
  manualDirectoryBasePath.value = findDirectoryBasePath(normalizedPath)
  syncingManualDirectoryPath = true
  manualForm.value.manualDirectoryPath = buildDirectoryPath(
    manualDirectoryBasePath.value || normalizedPath,
    manualForm.value.requirementTitle,
  )
}

function handleDocumentDirectorySelect(value: string) {
  const normalizedPath = normalizeDirectoryPath(value)
  documentDirectoryBasePath.value = findDirectoryBasePath(normalizedPath)
  syncingDocumentDirectoryPath = true
  documentForm.value.directoryPath = buildDirectoryPath(
    documentDirectoryBasePath.value || normalizedPath,
    importedRequirementTitle.value,
  )
}

function openDirectoryPicker(mode: DirectoryPickerMode) {
  if (!targetWorkspaceCode.value) {
    ElMessage.warning('请先选择目标空间')
    return
  }

  directoryPickerMode.value = mode
  directoryPickerKeyword.value = ''
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

  if (directoryPickerMode.value === 'manual') {
    handleManualDirectorySelect(directoryPickerSelectedPath.value)
  } else {
    handleDocumentDirectorySelect(directoryPickerSelectedPath.value)
  }
  directoryPickerVisible.value = false
}

async function openTaskProcessDialog(taskId?: string) {
  await refreshLatestTaskRecord()
  activeProcessTaskId.value = taskId || ''
  latestTaskRecord.value = taskId && targetWorkspaceCode.value
    ? await caseAiApi.getTask(targetWorkspaceCode.value, taskId)
    : pickLatestTaskRecord(taskRecords.value)

  if (!latestTaskRecord.value) {
    ElMessage.info('暂无可查看的任务')
    return
  }

  activeProcessTaskId.value = latestTaskRecord.value.taskId
  processDialogVisible.value = true
}

async function openScopedProcessDialog(source: DirectoryPickerMode) {
  const taskId = source === 'manual' ? manualTaskRecordId.value : documentTaskRecordId.value
  if (!taskId) {
    ElMessage.info('请先生成测试用例')
    return
  }

  if (!targetWorkspaceCode.value) {
    ElMessage.info('请先选择目标空间')
    return
  }

  latestTaskRecord.value = await caseAiApi.getTask(targetWorkspaceCode.value, taskId)
  if (!latestTaskRecord.value) {
    ElMessage.info('当前任务记录不存在或已被删除')
    return
  }

  activeProcessTaskId.value = latestTaskRecord.value.taskId
  processDialogVisible.value = true
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

function goToAiConnections() {
  void router.push({
    path: '/settings',
    query: {
      tab: 'aiConnection',
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
    latestTaskRecord.value = baseRecord
    await refreshLatestTaskRecord()
    activeProcessTaskId.value = baseRecord.taskId
    processDialogVisible.value = true
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

  latestTaskRecord.value = await caseAiApi.cancelTask(targetWorkspaceCode.value, currentRecord.taskId)
  await refreshLatestTaskRecord()
  ElMessage.success('已取消当前生成任务')
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
    if (!manualDirectoryBasePath.value) {
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
    if (!documentDirectoryBasePath.value) {
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
})
</script>

<template>
  <section class="ai-generate-page">
    <header class="ai-generate-page__heading">
      <h2>AI 用例生成</h2>
      <p>基于需求文档或手动输入，自动生成并 AI 评审测试用例草稿</p>
    </header>

    <div v-if="isAllScope" class="workspace-select-bar panel-card ai-generate-page__legacy-workspace">
      <div class="workspace-select-bar__label">目标空间</div>
      <el-select
        v-model="selectedTargetWorkspaceCode"
        class="workspace-select-bar__select"
        :loading="loadingWorkspaces"
        clearable
        filterable
        placeholder="请选择目标空间"
      >
        <el-option
          v-for="workspace in workspaces"
          :key="workspace.workspaceCode"
          :label="workspace.workspaceName"
          :value="workspace.workspaceCode"
        />
      </el-select>
    </div>

    <div class="main-content-grid">
      <div class="panel-card input-panel">
        <div class="panel-title-row">
          <div>
            <div class="section-title section-title-with-icon">
              <span class="section-title-icon" aria-hidden="true">✍️</span>
              <span>手动输入需求描述</span>
            </div>
          </div>
        </div>

        <div class="form-stack">
          <div class="field-label">需求标题 <span class="field-required">*</span></div>
          <el-input
            v-model="manualForm.requirementTitle"
            maxlength="120"
            placeholder="请输入需求标题，例如：用户登录功能需求"
          />

          <div class="field-label">用例保存路径 <span class="field-required">*</span></div>
          <el-input
            :model-value="manualDirectoryDisplayPath"
            class="directory-path-input directory-path-input-with-action"
            readonly
            :placeholder="loadingDirectories ? '正在加载目录...' : '请选择模块路径，选中后会自动拼接需求标题'"
          >
            <template #suffix>
              <el-tooltip content="选择保存路径" placement="top">
                <button type="button" class="path-action-icon-button" @click="openDirectoryPicker('manual')">
                  <el-icon><FolderOpened /></el-icon>
                </button>
              </el-tooltip>
            </template>
          </el-input>

          <div class="field-label">需求描述 <span class="field-required">*</span></div>
          <el-input
            v-model="manualForm.requirementContent"
            class="requirement-textarea"
            type="textarea"
            :autosize="{ minRows: 10, maxRows: 18 }"
            resize="vertical"
            placeholder="请详细描述您的需求，包括功能描述、使用场景、业务流程等"
          />
          <div class="char-count">{{ manualForm.requirementContent.length }}/5000</div>

          <div class="path-action-stack">
            <el-button
              class="generate-primary-btn"
              type="success"
              :icon="MagicStick"
              :loading="generating"
              :disabled="!canGenerate"
              @click="handleGenerateCases('manual')"
            >
              生成测试用例
            </el-button>
            <el-button
              class="flow-secondary-btn"
              :icon="View"
              :disabled="!manualTaskRecordId"
              @click="openScopedProcessDialog('manual')"
            >
              查看生成流程
            </el-button>
          </div>
        </div>
      </div>

      <div class="panel-card upload-panel">
        <div class="panel-title-row">
          <div>
            <div class="section-title section-title-with-icon">
              <span class="section-title-icon" aria-hidden="true">📄</span>
              <span>上传需求文档</span>
            </div>
          </div>
        </div>

        <div class="upload-panel-body">
          <template v-if="importedDocument">
            <div class="upload-success-shell">
              <div class="upload-success-box">
                <div class="upload-success-file">
                  <el-icon class="upload-success-icon"><DocumentAdd /></el-icon>
                  <div class="upload-success-meta">
                    <div class="upload-success-name">{{ importedDocument.fileName }}</div>
                    <div class="upload-success-size">{{ formatFileSize(importedDocument.fileSize) }}</div>
                  </div>
                  <button class="upload-remove-btn" type="button" @click="clearImportedDocument">×</button>
                </div>
              </div>

              <div class="upload-detail-form">
                <div class="field-label">文档标题</div>
                <el-input v-model="importedRequirementTitle" placeholder="请输入文档标题" />

                <div class="field-label">用例保存路径 <span class="field-required">*</span></div>
                <el-input
                  :model-value="documentDirectoryDisplayPath"
                  class="directory-path-input directory-path-input-with-action"
                  readonly
                  :placeholder="loadingDirectories ? '正在加载目录...' : '请选择模块路径，选中后会自动拼接文档标题'"
                >
                  <template #suffix>
                    <el-tooltip content="选择保存路径" placement="top">
                      <button type="button" class="path-action-icon-button" @click="openDirectoryPicker('document')">
                        <el-icon><FolderOpened /></el-icon>
                      </button>
                    </el-tooltip>
                  </template>
                </el-input>

                <div class="field-label">图片能力提示</div>
                <div class="upload-hint-box">
                  <div v-for="notice in imageCapabilityNotices" :key="notice">{{ notice }}</div>
                </div>

                <div class="upload-card-actions">
                  <el-button
                    class="generate-primary-btn"
                    type="success"
                    :icon="MagicStick"
                    :loading="generating"
                    :disabled="!canGenerateDocument"
                    @click="handleGenerateCases('document')"
                  >
                    生成测试用例
                  </el-button>
                  <el-button
                    class="flow-secondary-btn"
                    :icon="View"
                    :disabled="!documentTaskRecordId"
                    @click="openScopedProcessDialog('document')"
                  >
                    查看生成流程
                  </el-button>
                </div>
              </div>
            </div>
          </template>

          <button
            v-else
            class="upload-large-box"
            type="button"
            @click="triggerRequirementImport"
          >
            <el-icon class="upload-box-icon"><DocumentAdd /></el-icon>
            <div class="upload-box-center">
              <div class="upload-box-title">拖拽文件到此处或点击选择文件</div>
              <div class="upload-box-desc">支持 PDF、Word、TXT、Markdown 格式</div>
            </div>
            <span class="upload-primary-btn">选择文件</span>
          </button>
        </div>
      </div>
    </div>

    <div class="panel-card ai-config-card">
      <div class="panel-title-row">
        <div>
            <div class="section-title section-title-with-icon">
              <span class="section-title-icon output-section-icon" aria-hidden="true">📤</span>
              <span>输出模式设置</span>
            </div>
          <div class="section-desc">先选择本次任务的输出方式。</div>
        </div>
      </div>

      <div class="output-mode-grid output-mode-grid-visual">
        <label class="output-mode-card output-mode-card-visual" :class="{ 'output-mode-card-active': manualForm.outputMode === 'STREAM' }">
          <input v-model="manualForm.outputMode" type="radio" value="STREAM">
          <div class="output-mode-title">
            <span class="output-mode-icon output-mode-icon-stream" aria-hidden="true">⚡</span>
            <span>实时流式输出</span>
          </div>
          <div class="output-mode-desc">优先展示任务执行进度和阶段状态。适合需要实时观察生成过程、希望尽快看到部分结果的场景。每条用例生成后立即展示。</div>
        </label>
        <label class="output-mode-card output-mode-card-visual" :class="{ 'output-mode-card-active': manualForm.outputMode === 'COMPLETE' }">
          <input v-model="manualForm.outputMode" type="radio" value="COMPLETE">
          <div class="output-mode-title">
            <span class="output-mode-icon output-mode-icon-complete" aria-hidden="true">📋</span>
            <span>完整输出</span>
          </div>
          <div class="output-mode-desc">等待生成和评审全部完成后统一返回结果。适合需要批量处理、追求结果完整性的场景。所有用例评审完成后一次性展示。</div>
        </label>
      </div>
    </div>

    <div class="panel-card ai-config-card ai-generate-page__legacy-config">
      <div class="panel-title-row">
        <div>
            <div class="section-title section-title-with-icon">
              <span class="section-title-icon" aria-hidden="true">🤖</span>
              <span>当前 AI 配置</span>
            </div>
          <div class="section-desc">展示当前空间下本次生成任务会使用的 AI 配置摘要。</div>
        </div>
        <div class="ai-config-actions">
          <el-button v-if="!aiConfigReady" text @click="goToAiConnections">去创建连接</el-button>
          <el-button v-if="!aiConfigReady" text @click="goToAiConfig">去配置AI</el-button>
          <el-button :icon="RefreshRight" text @click="refreshPageData">刷新配置</el-button>
        </div>
      </div>

      <div class="ai-config-grid ai-config-grid-five">
        <div class="config-info-item config-info-item-status">
          <div class="config-info-label">配置状态</div>
          <div class="config-status-panel" :class="aiConfigStatusClass">
            <span class="config-status-dot" />
            <span class="config-status-text">{{ aiConfigStatusText }}</span>
          </div>
        </div>
        <div class="config-info-item">
          <div class="config-info-label">当前空间</div>
          <div class="config-info-value">{{ currentWorkspaceName || '-' }}</div>
        </div>
        <div class="config-info-item">
          <div class="config-info-label">编写模型</div>
          <div class="config-info-value" :class="{ 'config-info-value-danger': generatorConfigIssue }">
            {{ generatorConfigIssue || generatorConfig?.providerConnectionName || '-' }}
          </div>
        </div>
        <div class="config-info-item">
          <div class="config-info-label">评审模型</div>
          <div class="config-info-value" :class="{ 'config-info-value-danger': reviewerConfigIssue }">
            {{ reviewerConfigIssue || reviewerConfig?.providerConnectionName || '-' }}
          </div>
        </div>
        <div class="config-info-item">
          <div class="config-info-label">输出模式</div>
          <div class="config-info-value">{{ manualForm.outputMode === 'STREAM' ? '实时流式输出' : '完整输出' }}</div>
        </div>
      </div>

      <div v-if="!aiConfigReady" class="ai-config-empty-hint">
        当前账号的 AI 配置还没准备好。先在“系统设置 > AI连接”里创建个人连接，再到“AI配置”页绑定生成模型和评审模型。
      </div>
    </div>

    <div class="recent-task-card ai-generate-page__legacy-recent">
      <div class="panel-title-row recent-task-header">
        <div>
          <div class="section-title section-title-with-icon">
            <span class="section-title-icon" aria-hidden="true">🕘</span>
            <span>最近任务</span>
          </div>
          <div class="section-desc">展示最近 3 条任务，优先显示进行中、失败和待处理任务。</div>
        </div>
        <el-button :icon="RefreshRight" text @click="refreshLatestTaskRecord">刷新任务</el-button>
      </div>

      <div v-if="recentTaskRecords.length" class="recent-task-list">
        <div v-for="task in recentTaskRecords" :key="task.taskId" class="recent-task-item">
          <div class="recent-task-main">
            <div class="recent-task-top">
              <div class="recent-task-title">{{ task.requirementTitle }}</div>
              <span class="status-pill" :class="getTaskStatusTone(task.status)">
                {{ getTaskStatusLabel(task.status) }}
              </span>
            </div>
            <div class="recent-task-meta">
              <span>{{ task.workspaceName || currentWorkspaceName }}</span>
              <span>{{ task.outputMode === 'STREAM' ? '实时流式输出' : '完整输出' }}</span>
              <span>{{ formatTaskTime(task.updatedAt || task.createdAt) }}</span>
            </div>
          </div>
          <div class="recent-task-actions">
            <el-button class="recent-task-button recent-task-button-primary" :icon="View" @click="openTaskProcessDialog(task.taskId)">查看流程</el-button>
            <el-button
              class="recent-task-button recent-task-button-secondary"
              @click="isTaskResultAvailable(task) ? openTaskResult(task.taskId) : openTaskDetail(task.taskId)"
            >
              {{ getTaskDetailActionLabel(task) }}
            </el-button>
          </div>
        </div>
      </div>
      <div v-else class="recent-task-empty">还没有最近任务，生成一次测试用例后会显示在这里。</div>

      <div class="recent-task-footer">
        <el-button text @click="openTaskRecordsPage">查看全部记录</el-button>
      </div>
    </div>

    <input
      ref="requirementFileInput"
      type="file"
      class="hidden-file-input"
      accept=".pdf,.doc,.docx,.txt,.md,.markdown"
      @change="handleRequirementFileChange"
    >

    <el-dialog v-model="processDialogVisible" title="AI生成用例流程" width="760px" destroy-on-close>
      <template v-if="getCurrentProcessRecord()">
        <div class="process-dialog-meta">
          <div>
            <div class="process-dialog-title">{{ getCurrentProcessRecord()?.requirementTitle }}</div>
            <div class="process-dialog-subtitle">
              {{ getCurrentProcessRecord()?.workspaceName || currentWorkspaceName }} /
              {{ getCurrentProcessRecord()?.outputMode === 'STREAM' ? '实时流式输出' : '完整输出' }}
            </div>
          </div>
        </div>

        <div class="process-step-list">
          <div
            v-for="step in processSteps"
            :key="step.index"
            class="process-step-card"
            :class="{
              'process-step-card-active': isStepActive(step.index),
              'process-step-card-done': isStepDone(step.index),
              'process-step-card-failed': isStepFailed(step.index),
            }"
          >
            <div
              class="process-step-index"
              :class="{
                'process-step-index-active': isStepActive(step.index),
                'process-step-index-done': isStepDone(step.index),
                'process-step-index-failed': isStepFailed(step.index),
              }"
            >
              {{ step.index }}
            </div>
            <div>
              <div class="process-step-title">
                {{ step.title }}
                <span v-if="getStepStatusLabel(step.index)" class="process-step-status">{{ getStepStatusLabel(step.index) }}</span>
              </div>
              <div class="process-step-desc">{{ step.description }}</div>
            </div>
          </div>
        </div>

        <div class="process-current-log">
          <div class="process-current-label">当前进度</div>
          <div class="process-current-text">{{ getCurrentProcessRecord()?.stepMessage || '等待任务执行...' }}</div>
        </div>

        <div v-if="getCurrentProcessRecord()?.status === 'FAILED'" class="process-failure-card">
          <div class="process-failure-stage">失败阶段：{{ getFailureStepLabel(getCurrentProcessRecord()?.currentStep ?? null) }}</div>
          <div class="process-failure-text">失败原因：{{ getCurrentProcessRecord()?.errorMessage || getCurrentProcessRecord()?.stepMessage || '-' }}</div>
        </div>
      </template>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="getCurrentProcessRecord() && isTaskResultAvailable(getCurrentProcessRecord())"
            type="primary"
            @click="openTaskResult(getCurrentProcessRecord()!.taskId)"
          >
            查看结果
          </el-button>
          <el-button
            v-if="getCurrentProcessRecord() && ['PENDING', 'GENERATING', 'REVIEWING'].includes(getCurrentProcessRecord()!.status)"
            type="danger"
            :icon="CircleClose"
            @click="cancelCurrentTask"
          >
            取消生成
          </el-button>
          <el-button @click="processDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="directoryPickerVisible" width="720px" destroy-on-close class="path-picker-dialog">
      <template #header>
        <div class="adopt-dialog-title">选择保存路径</div>
      </template>
      <div class="path-picker-layout">
        <el-input
          v-model="directoryPickerKeyword"
          clearable
          placeholder="搜索目录名称"
          class="path-picker-search"
        />
        <div class="path-picker-tree-panel">
          <div v-if="loadingDirectories" class="path-picker-empty">
            正在加载目录...
          </div>
          <div v-else-if="!filteredDirectoryPickerTree.length" class="path-picker-empty">
            未找到匹配的目录
          </div>
          <el-tree
            v-else
            :data="filteredDirectoryPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="targetWorkspaceCode ? [`workspace:${targetWorkspaceCode}`] : []"
            :current-node-key="directoryPickerSelectedPath || undefined"
            class="path-picker-tree"
            @node-click="handleDirectoryPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="path-picker-tree-node" :class="{ 'is-workspace': !data.selectable }">
                <span class="path-picker-tree-node-label">{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>
        <div class="path-picker-selected-panel">
          <div class="path-picker-selected-label">已选路径</div>
          <div class="path-picker-selected-value">
            {{ directoryPickerPreviewPath || '请在上方目录树中选择保存路径' }}
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="directoryPickerVisible = false">取消</el-button>
          <el-button type="primary" :icon="FolderOpened" :disabled="!directoryPickerSelectedPath" @click="confirmDirectoryPickerSelection">确认修改</el-button>
        </div>
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




