<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Search } from '@element-plus/icons-vue'
import { Bug, Check, Clock, Edit2, Link, Plus } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
  loadCaseExecutionContext,
  matchesCaseClientFilter,
  type CaseDetail,
  type CaseClientFilter,
  type CaseDirectoryWorkspace,
  type CaseExecutionAttachment,
  type CaseExecutionHistoryItem,
  type CaseExecutionContext,
  type CaseSummaryItem,
  type RunCasePayload,
  type SaveCasePayload,
} from '@/entities/case'
import {
  defectApi,
  formatDefectDateTime,
  type DefectSummaryItem,
} from '@/entities/defect'
import { CaseCreateEditDrawer } from '@/features/case-create-edit'
import {
  CaseDefectAssociateDrawer,
  CaseDefectEditorDrawer,
  type CaseDefectPendingFile,
} from '@/features/case-execution-defects'
import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  type DefectForm,
  validateDefectForm,
} from '@/features/defect-create-edit/model'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { AttachmentFileWall, confirmAction, confirmDelete, type AttachmentFileWallItem } from '@/shared/ui'
import DefectDetailDrawer from '@/widgets/defect-detail-drawer/DefectDetailDrawer.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const detail = ref<CaseDetail | null>(null)
const contextState = ref<CaseExecutionContext | null>(null)
const executionCases = ref<CaseSummaryItem[]>([])
const activeTab = ref('detail')
const sidebarKeyword = ref('')
const sidebarExecutionStatus = ref('')
const executionHistory = ref<CaseExecutionHistoryItem[]>([])
const historyLoading = ref(false)
const historyErrorMessage = ref('')
const actualResult = ref('')
const executionNote = ref('')
const pendingAttachments = ref<Array<{
  id: string
  file: File
  previewUrl: string | null
  sortAt: number
}>>([])
const attachmentImageUrls = ref<Record<number, string>>({})
const uploadingAttachments = ref(false)
const downloadingAttachmentId = ref<number | string | null>(null)
const removingAttachmentId = ref<number | string | null>(null)
const autoNext = ref(false)
const submittingStatus = ref('')
const relatedDefects = ref<DefectSummaryItem[]>([])
const defectsLoading = ref(false)
const defectsErrorMessage = ref('')
const defectAssociateVisible = ref(false)
const defectAssociateKeyword = ref('')
const defectAssociateCandidates = ref<DefectSummaryItem[]>([])
const defectAssociateLoading = ref(false)
const defectAssociating = ref(false)
const defectCreateVisible = ref(false)
const defectSaving = ref(false)
const defectDetailVisible = ref(false)
const activeDefectId = ref<number | null>(null)
const defectDetailRefreshKey = ref(0)
const defectForm = reactive<DefectForm>(createDefaultDefectForm())
const pendingDefectFiles = ref<CaseDefectPendingFile[]>([])
const inlineDefectImages = ref<Array<{ file: File; src: string }>>([])
const editDrawerVisible = ref(false)
const editSaving = ref(false)
const directories = ref<CaseDirectoryWorkspace[]>([])
let detailRequestSeq = 0
let historyRequestSeq = 0
let defectsRequestSeq = 0
let defectAssociateRequestSeq = 0
let queueRequestSeq = 0

const currentCaseId = computed(() => {
  const rawId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(rawId)
  return Number.isFinite(parsed) ? parsed : null
})

const routeWorkspaceCode = computed(() => {
  const workspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  return workspace || 'ALL'
})

const effectiveWorkspaceCode = computed(() => detail.value?.workspaceCode || contextState.value?.workspaceCode || routeWorkspaceCode.value)

const executionStatusFilters = computed(() => {
  const counts = executionCases.value.reduce<Record<string, number>>((acc, item) => {
    const status = item.executionStatus || 'NOT_RUN'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  return [
    { label: `全部 (${executionCases.value.length})`, value: '' },
    { label: '未执行', value: 'NOT_RUN', count: counts.NOT_RUN || 0 },
    { label: '通过', value: 'PASSED', count: counts.PASSED || 0 },
    { label: '失败', value: 'FAILED', count: counts.FAILED || 0 },
    { label: '阻塞', value: 'BLOCKED', count: counts.BLOCKED || 0 },
  ]
})

const sortedExecutionCases = computed(() => (
  [...executionCases.value].sort((first, second) => {
    const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : Number.POSITIVE_INFINITY
    const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : Number.POSITIVE_INFINITY
    if (firstTime !== secondTime) {
      return firstTime - secondTime
    }
    return first.id - second.id
  })
))

const visibleExecutionCases = computed(() => {
  const keyword = sidebarKeyword.value.trim().toLowerCase()
  return sortedExecutionCases.value.filter((item) => {
    const matchesKeyword = !keyword
      || item.caseNo.toLowerCase().includes(keyword)
      || item.title.toLowerCase().includes(keyword)
    const matchesStatus = !sidebarExecutionStatus.value || item.executionStatus === sidebarExecutionStatus.value
    return matchesKeyword && matchesStatus
  })
})

const currentVisibleIndex = computed(() => visibleExecutionCases.value.findIndex(item => item.id === currentCaseId.value))
const activeCaseDisplayIndex = computed(() => (currentVisibleIndex.value >= 0 ? currentVisibleIndex.value + 1 : 0))
const canMovePrevious = computed(() => currentVisibleIndex.value > 0)
const canMoveNext = computed(() => currentVisibleIndex.value >= 0 && currentVisibleIndex.value < visibleExecutionCases.value.length - 1)

const pageCaseNo = computed(() => {
  if (!detail.value) {
    return ''
  }
  return detail.value.caseNo
})

const pageTitle = computed(() => {
  if (!detail.value) {
    return '用例执行'
  }
  return detail.value.title
})

const modulePath = computed(() => {
  if (!detail.value) {
    return '-'
  }
  const segments = [detail.value.workspaceName || detail.value.workspaceCode]
  const directory = getCaseDirectoryText(detail.value)
  if (directory && directory !== '空间根目录') {
    segments.push(directory)
  }
  return segments.join(' / ')
})

const historyRows = computed(() => executionHistory.value.map(item => ({
  id: item.id,
  status: item.executionStatus || 'NOT_RUN',
  executorName: item.executorName || '-',
  executedAt: formatCaseDateTime(item.executedAt),
  executionComment: item.executionComment || '-',
  executionNote: item.executionNote || '-',
})))

const caseStepRows = computed(() => {
  if (!detail.value) {
    return []
  }

  const steps = extractPlainTextFromHtml(detail.value.steps || '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
  const expectedResult = extractPlainTextFromHtml(detail.value.expectedResult || '').trim()

  if (!steps.length) {
    return [{ step: '-', expected: expectedResult || '-' }]
  }

  return steps.map((step, index) => ({
    step,
    expected: index === steps.length - 1 ? (expectedResult || '-') : '按步骤描述继续执行',
  }))
})

const EVIDENCE_MAX_FILE_SIZE = 20 * 1024 * 1024
const EVIDENCE_ALLOWED_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'pdf',
  'txt',
  'log',
  'json',
  'csv',
  'zip',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
])

const attachmentWallItems = computed<AttachmentFileWallItem[]>(() => {
  const items: AttachmentFileWallItem[] = [
    ...(detail.value?.attachments ?? []).map(item => ({
      id: item.id,
      fileName: item.fileName,
      fileSize: item.fileSize,
      uploadedByName: item.uploadedByName,
      createdAt: item.createdAt,
      contentType: item.contentType,
      imageUrl: isImageAttachment(item) ? getAttachmentImageUrl(item) : undefined,
    })),
    ...pendingAttachments.value.map(item => ({
      id: item.id,
      fileName: item.file.name,
      fileSize: item.file.size,
      contentType: item.file.type,
      imageUrl: item.previewUrl || undefined,
      metaText: '待上传',
      createdAt: new Date(item.sortAt).toISOString(),
      pending: true,
    })),
  ]
  return items.sort(compareEvidenceAttachmentItems)
})

const availableAssociateDefects = computed(() => {
  const keyword = defectAssociateKeyword.value.trim().toLowerCase()
  const relatedIds = new Set(relatedDefects.value.map(item => item.id))

  return defectAssociateCandidates.value
    .filter(item => !relatedIds.has(item.id) && item.relatedCaseId !== currentCaseId.value)
    .filter((item) => {
      if (!keyword) {
        return true
      }
      return item.bugNo.toLowerCase().includes(keyword) || item.title.toLowerCase().includes(keyword)
    })
})

const canSubmitDefect = computed(() => !defectSaving.value)

function canDefectSummaryBelongToCase(item: DefectSummaryItem, caseId: number) {
  if (item.relatedCaseId === caseId) {
    return true
  }

  return item.relatedCaseCount > 0
}

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function getWorkstationExecutionStatusMeta(status: string | null | undefined) {
  if (status === 'PASSED') {
    return { label: '通过', tone: 'success' }
  }
  if (status === 'FAILED') {
    return { label: '失败', tone: 'danger' }
  }
  if (status === 'BLOCKED') {
    return { label: '阻塞', tone: 'warning' }
  }
  return { label: '未执行', tone: 'default' }
}

function getCaseSourceText(value: string | null | undefined) {
  const sourceMap: Record<string, string> = {
    MANUAL: '人工创建',
    AI: 'AI 生成',
    AI_GENERATED: 'AI 生成',
    IMPORT: '导入创建',
  }
  return value ? (sourceMap[value] || value) : '-'
}

function getCasePriorityMeta(priority: string | null | undefined) {
  if (priority === 'P0') {
    return { label: 'P0', tone: 'danger' }
  }
  if (priority === 'P1') {
    return { label: 'P1', tone: 'warning' }
  }
  if (priority === 'P2') {
    return { label: 'P2', tone: 'primary' }
  }
  return { label: priority || 'P3', tone: 'default' }
}

function getReviewStatusMeta(status: string | null | undefined) {
  const normalized = status || ''
  if (['APPROVED', 'PASSED', 'REVIEWED'].includes(normalized)) {
    return { label: '已通过', tone: 'success' }
  }
  if (['REJECTED', 'FAILED'].includes(normalized)) {
    return { label: '未通过', tone: 'danger' }
  }
  if (['PENDING', 'WAITING', 'IN_REVIEW'].includes(normalized)) {
    return { label: '评审中', tone: 'primary' }
  }
  return { label: status || '-', tone: 'default' }
}

function getDefectPriorityMeta(priority: string | null | undefined) {
  if (priority === 'P0') {
    return { label: 'P0', tone: 'danger' }
  }
  if (priority === 'P1') {
    return { label: 'P1', tone: 'warning' }
  }
  if (priority === 'P2') {
    return { label: 'P2', tone: 'primary' }
  }
  return { label: priority || 'P3', tone: 'default' }
}

function getDefectSeverityMeta(severity: string | null | undefined) {
  const severityMap: Record<string, { label: string; tone: string }> = {
    CRITICAL: { label: '致命', tone: 'danger' },
    HIGH: { label: '严重', tone: 'warning' },
    MEDIUM: { label: '一般', tone: 'primary' },
    LOW: { label: '轻微', tone: 'success' },
  }
  return severity ? (severityMap[severity] || { label: severity, tone: 'default' }) : { label: '-', tone: 'default' }
}

function getDefectStatusMeta(status: string | null | undefined) {
  const statusMap: Record<string, { label: string; tone: string }> = {
    TODO: { label: '待处理', tone: 'danger' },
    ASSIGNED: { label: '已指派', tone: 'primary' },
    IN_PROGRESS: { label: '处理中', tone: 'primary' },
    PENDING_VERIFY: { label: '待验证', tone: 'warning' },
    CLOSED: { label: '已关闭', tone: 'success' },
    REJECTED: { label: '已驳回', tone: 'default' },
  }
  return status ? (statusMap[status] || { label: status, tone: 'default' }) : { label: '-', tone: 'default' }
}

function getEvidenceFileExt(fileName: string) {
  return fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE'
}

function getEvidenceFileExtValue(fileName: string) {
  return getEvidenceFileExt(fileName).toLowerCase()
}

function isEvidenceImageFile(file: File) {
  return file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(getEvidenceFileExtValue(file.name))
}

function getEvidenceAttachmentSortTime(item: AttachmentFileWallItem) {
  const timestamp = item.createdAt ? new Date(item.createdAt).getTime() : 0
  if (!Number.isNaN(timestamp) && timestamp > 0) {
    return timestamp
  }
  if (typeof item.id === 'number') {
    return item.id
  }
  const idTime = Number(String(item.id).split('-')[0])
  return Number.isNaN(idTime) ? 0 : idTime
}

function compareEvidenceAttachmentItems(first: AttachmentFileWallItem, second: AttachmentFileWallItem) {
  const timeDiff = getEvidenceAttachmentSortTime(second) - getEvidenceAttachmentSortTime(first)
  if (timeDiff !== 0) {
    return timeDiff
  }
  const firstId = typeof first.id === 'number' ? first.id : Number(String(first.id).split('-')[1] || 0)
  const secondId = typeof second.id === 'number' ? second.id : Number(String(second.id).split('-')[1] || 0)
  return secondId - firstId
}

function validateEvidenceFiles(files: File[]) {
  const validFiles: File[] = []
  const rejectedNames: string[] = []
  const oversizedNames: string[] = []

  files.forEach((file) => {
    const extension = getEvidenceFileExtValue(file.name)
    if (!EVIDENCE_ALLOWED_EXTENSIONS.has(extension)) {
      rejectedNames.push(file.name)
      return
    }
    if (file.size > EVIDENCE_MAX_FILE_SIZE) {
      oversizedNames.push(file.name)
      return
    }
    validFiles.push(file)
  })

  if (rejectedNames.length) {
    ElMessage.warning(`暂不支持上传：${rejectedNames.slice(0, 3).join('、')}${rejectedNames.length > 3 ? ' 等文件' : ''}`)
  }
  if (oversizedNames.length) {
    ElMessage.warning(`单个附件不能超过 20MB：${oversizedNames.slice(0, 3).join('、')}${oversizedNames.length > 3 ? ' 等文件' : ''}`)
  }

  return validFiles
}

function escapeHtml(value: string | null | undefined) {
  return displayText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractPlainTextFromHtml(content: string) {
  if (typeof DOMParser === 'undefined') {
    return content.replace(/<[^>]*>/g, '').trim()
  }
  const doc = new DOMParser().parseFromString(content, 'text/html')
  return doc.body.textContent?.trim() || ''
}

function buildExecutionDefectDescription(row: CaseDetail) {
  return [
    { label: '用例标题：', content: row.title },
    { label: '前置条件：', content: row.precondition },
    { label: '测试步骤：', content: row.steps },
    { label: '预期结果：', content: row.expectedResult },
    { label: '实际结果：', content: actualResult.value.trim() },
  ]
    .map(item => `<p><strong>${item.label}</strong><br>${escapeHtml(item.content)}</p>`)
    .join('')
}

function syncExecutionInputs(row: CaseDetail) {
  actualResult.value = row.executionComment || ''
  executionNote.value = row.executionNote || ''
}

function isImageAttachment(item: CaseExecutionAttachment) {
  return Boolean(item.contentType?.startsWith('image/'))
}

function getAttachmentImageUrl(item: CaseExecutionAttachment) {
  return attachmentImageUrls.value[item.id] || ''
}

function revokeAttachmentImageUrls() {
  Object.values(attachmentImageUrls.value).forEach((url) => {
    URL.revokeObjectURL(url)
  })
  attachmentImageUrls.value = {}
}

async function loadAttachmentImageUrls(row: CaseDetail | null) {
  revokeAttachmentImageUrls()
  if (!row) {
    return
  }

  const nextUrls: Record<number, string> = {}
  for (const attachment of (row.attachments ?? []).filter(isImageAttachment)) {
    try {
      const blob = await caseApi.downloadCaseExecutionAttachment(row.workspaceCode, row.id, attachment.id)
      nextUrls[attachment.id] = URL.createObjectURL(blob)
    } catch {
      // Keep thumbnail failures local to the attachment card; download still remains available.
    }
  }
  attachmentImageUrls.value = nextUrls
}

async function loadExecutionHistory(caseId: number) {
  const requestSeq = ++historyRequestSeq
  historyLoading.value = true
  historyErrorMessage.value = ''
  try {
    const page = await caseApi.getCaseExecutionHistory(caseId, effectiveWorkspaceCode.value)
    if (requestSeq !== historyRequestSeq) {
      return
    }
    executionHistory.value = page.items ?? []
  } catch (error) {
    if (requestSeq === historyRequestSeq) {
      executionHistory.value = []
      historyErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === historyRequestSeq) {
      historyLoading.value = false
    }
  }
}

function addPendingAttachments(files: File[]) {
  const validFiles = validateEvidenceFiles(files)
  if (!validFiles.length) {
    return
  }
  const now = Date.now()
  const nextItems = validFiles.map((file, index) => ({
    id: `${now}-${index}-${file.name}`,
    file,
    previewUrl: isEvidenceImageFile(file) ? URL.createObjectURL(file) : null,
    sortAt: now + index,
  }))
  pendingAttachments.value = [...pendingAttachments.value, ...nextItems]
  void uploadPendingAttachments(nextItems)
}

function removePendingAttachment(id: string, revokePreview = true) {
  const target = pendingAttachments.value.find(item => item.id === id)
  if (revokePreview && target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  pendingAttachments.value = pendingAttachments.value.filter(item => item.id !== id)
}

function clearPendingAttachments() {
  pendingAttachments.value.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  pendingAttachments.value = []
}

function addPendingDefectFiles(files: File[]) {
  if (!files.length) {
    return
  }
  const nextFiles = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }))
  pendingDefectFiles.value = [...pendingDefectFiles.value, ...nextFiles]
}

function removePendingDefectFile(id: string) {
  const target = pendingDefectFiles.value.find(item => item.id === id)
  if (target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  pendingDefectFiles.value = pendingDefectFiles.value.filter(item => item.id !== id)
}

function clearPendingDefectFiles() {
  pendingDefectFiles.value.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  pendingDefectFiles.value = []
}

function addInlineDefectImage(payload: { file: File; src: string }) {
  inlineDefectImages.value = [...inlineDefectImages.value, payload]
}

function clearInlineDefectImages() {
  inlineDefectImages.value.forEach((item) => {
    URL.revokeObjectURL(item.src)
  })
  inlineDefectImages.value = []
}

function resetDefectForm(row: CaseDetail) {
  Object.assign(defectForm, createDefaultDefectForm(row.workspaceCode || effectiveWorkspaceCode.value))
  defectForm.title = `【${row.caseNo}】${row.title}`
  defectForm.description = buildExecutionDefectDescription(row)
  defectForm.priority = 'P1'
  defectForm.severity = 'HIGH'
  defectForm.relatedCaseId = String(row.id)
  defectForm.relatedCaseIds = [String(row.id)]
  clearPendingDefectFiles()
  clearInlineDefectImages()
}

function findInlineDefectImageBySrc(src: string) {
  return inlineDefectImages.value.find(item => item.src === src) || null
}

async function uploadDefectInlineImages(defectId: number, workspaceCode: string, html: string) {
  if (!inlineDefectImages.value.length || !html.trim()) {
    clearInlineDefectImages()
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild as HTMLElement | null
  if (!container) {
    clearInlineDefectImages()
    return html
  }

  const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
  for (const image of images) {
    const src = image.getAttribute('src') || ''
    if (!/^blob:|^data:/i.test(src)) {
      continue
    }
    const matched = findInlineDefectImageBySrc(src)
    if (!matched) {
      continue
    }
    const [attachment] = await defectApi.uploadDefectAttachments(workspaceCode, defectId, [matched.file])
    const nextSrc = attachment.downloadUrl || `/api/bugs/${defectId}/attachments/${attachment.id}/download`
    image.setAttribute('src', nextSrc)
  }

  clearInlineDefectImages()
  return container.innerHTML
}

async function uploadPendingDefectAttachments(defectId: number, workspaceCode: string) {
  if (!pendingDefectFiles.value.length) {
    return
  }
  await defectApi.uploadDefectAttachments(workspaceCode, defectId, pendingDefectFiles.value.map(item => item.file))
  clearPendingDefectFiles()
}

async function uploadPendingAttachments(items = pendingAttachments.value) {
  if (!detail.value || !items.length || uploadingAttachments.value) {
    return
  }

  let uploadSucceeded = false
  uploadingAttachments.value = true
  try {
    const uploadedAttachments = await caseApi.uploadCaseExecutionAttachments(
      detail.value.workspaceCode || effectiveWorkspaceCode.value,
      detail.value.id,
      items.map(item => item.file),
    )
    uploadSucceeded = true
    const nextImageUrls = { ...attachmentImageUrls.value }
    items.forEach((item, index) => {
      const uploaded = uploadedAttachments[index]
      const shouldKeepPreview = Boolean(uploaded && item.previewUrl && isImageAttachment(uploaded))
      if (uploaded && item.previewUrl && shouldKeepPreview) {
        nextImageUrls[uploaded.id] = item.previewUrl
      }
      removePendingAttachment(item.id, !shouldKeepPreview)
    })
    attachmentImageUrls.value = nextImageUrls
    const existingAttachments = detail.value.attachments ?? []
    const uploadedIds = new Set(uploadedAttachments.map(item => item.id))
    detail.value = {
      ...detail.value,
      attachments: [
        ...uploadedAttachments,
        ...existingAttachments.filter(item => !uploadedIds.has(item.id)),
      ],
    }
    ElMessage.success('附件已上传')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    uploadingAttachments.value = false
    if (uploadSucceeded && pendingAttachments.value.length) {
      void uploadPendingAttachments()
    }
  }
}

async function downloadAttachment(item: CaseExecutionAttachment) {
  if (!detail.value || downloadingAttachmentId.value !== null) {
    return
  }

  downloadingAttachmentId.value = item.id
  try {
    const blob = await caseApi.downloadCaseExecutionAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.fileName || 'attachment'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    downloadingAttachmentId.value = null
  }
}

async function deleteAttachment(item: CaseExecutionAttachment) {
  if (!detail.value || removingAttachmentId.value !== null) {
    return
  }

  try {
    await confirmDelete({
      title: '删除附件',
      message: `确认删除附件“${item.fileName}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    removingAttachmentId.value = item.id
    await caseApi.deleteCaseExecutionAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    detail.value = {
      ...detail.value,
      attachments: (detail.value.attachments ?? []).filter(attachment => attachment.id !== item.id),
    }
    const removedImageUrl = attachmentImageUrls.value[item.id]
    if (removedImageUrl) {
      URL.revokeObjectURL(removedImageUrl)
      const nextUrls = { ...attachmentImageUrls.value }
      delete nextUrls[item.id]
      attachmentImageUrls.value = nextUrls
    }
    ElMessage.success('附件已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    removingAttachmentId.value = null
  }
}

function handleAttachmentPanelDownload(item: AttachmentFileWallItem) {
  if (item.pending) {
    return
  }
  const matched = detail.value?.attachments?.find(attachment => attachment.id === item.id)
  if (matched) {
    void downloadAttachment(matched)
  }
}

function handleAttachmentPanelRemove(item: AttachmentFileWallItem) {
  if (item.pending) {
    removePendingAttachment(String(item.id))
    return
  }
  const matched = detail.value?.attachments?.find(attachment => attachment.id === item.id)
  if (matched) {
    void deleteAttachment(matched)
  }
}

function updateExecutionCollection(row: CaseDetail) {
  const summary = row as CaseSummaryItem
  const index = executionCases.value.findIndex(item => item.id === row.id)
  if (index >= 0) {
    executionCases.value = executionCases.value.map(item => (item.id === row.id ? { ...item, ...summary } : item))
    return
  }
  executionCases.value = [summary]
}

function buildFallbackQueue(row: CaseDetail) {
  if (executionCases.value.length) {
    return
  }
  executionCases.value = [row as CaseSummaryItem]
}

function filterExecutionQueueItems(items: CaseSummaryItem[], filter: CaseClientFilter | null) {
  return items.filter((item) => {
    if (!filter) {
      return true
    }

    if (!matchesCaseClientFilter(item, filter)) {
      return false
    }
    if (filter.executorName && item.executorName !== filter.executorName) {
      return false
    }
    if (filter.createdByName && item.createdByName !== filter.createdByName) {
      return false
    }
    if (filter.workspaceCode && item.workspaceCode !== filter.workspaceCode) {
      return false
    }
    return true
  })
}

async function loadExecutionQueue(row: CaseDetail) {
  const requestSeq = ++queueRequestSeq
  const context = contextState.value
  const workspaceCode = row.workspaceCode || effectiveWorkspaceCode.value
  const filter = context?.filter ?? null

  if (!context) {
    executionCases.value = [row as CaseSummaryItem]
    return
  }

  try {
    const firstPage = await caseApi.getCases(workspaceCode, {
      pageNo: 1,
      pageSize: 100,
      directoryId: context.selectedDirectoryId,
      keyword: filter?.keyword,
      priority: filter?.priority,
      reviewStatus: filter?.reviewStatus,
      executionStatus: filter?.executionStatus,
    })

    if (requestSeq !== queueRequestSeq) {
      return
    }

    const totalPages = Math.max(firstPage.totalPages || 0, 1)
    const pages = totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) => caseApi.getCases(workspaceCode, {
            pageNo: index + 2,
            pageSize: 100,
            directoryId: context.selectedDirectoryId,
            keyword: filter?.keyword,
            priority: filter?.priority,
            reviewStatus: filter?.reviewStatus,
            executionStatus: filter?.executionStatus,
          })),
        )
      : []

    if (requestSeq !== queueRequestSeq) {
      return
    }

    const items = [firstPage, ...pages].flatMap(page => page.items)
    const filteredItems = filterExecutionQueueItems(items, filter)
    executionCases.value = filteredItems.length ? filteredItems : [row as CaseSummaryItem]
  } catch {
    executionCases.value = context.items.length ? context.items : [row as CaseSummaryItem]
  }
}

async function loadRelatedDefects(row: CaseDetail) {
  const requestSeq = ++defectsRequestSeq
  defectsLoading.value = true
  defectsErrorMessage.value = ''
  try {
    const workspaceCode = row.workspaceCode || effectiveWorkspaceCode.value
    const page = await defectApi.getDefects(row.workspaceCode || effectiveWorkspaceCode.value, {
      pageNo: 1,
      pageSize: 100,
    })
    if (requestSeq !== defectsRequestSeq) {
      return
    }

    const candidateItems = page.items.filter(item => canDefectSummaryBelongToCase(item, row.id))
    const relatedFlags = await Promise.all(candidateItems.map(async (item) => {
      if (item.relatedCaseId === row.id) {
        return true
      }

      const relatedCases = await defectApi.getDefectCases(workspaceCode, item.id)
      return relatedCases.some(caseItem => caseItem.id === row.id)
    }))

    if (requestSeq === defectsRequestSeq) {
      relatedDefects.value = candidateItems.filter((_, index) => relatedFlags[index])
    }
  } catch (error) {
    if (requestSeq === defectsRequestSeq) {
      defectsErrorMessage.value = getRequestErrorMessage(error)
      relatedDefects.value = []
    }
  } finally {
    if (requestSeq === defectsRequestSeq) {
      defectsLoading.value = false
    }
  }
}

async function loadDefectAssociateCandidates(row: CaseDetail) {
  const requestSeq = ++defectAssociateRequestSeq
  defectAssociateLoading.value = true
  try {
    const page = await defectApi.getDefects(row.workspaceCode || effectiveWorkspaceCode.value, {
      pageNo: 1,
      pageSize: 100,
    })
    if (requestSeq === defectAssociateRequestSeq) {
      defectAssociateCandidates.value = page.items
    }
  } catch (error) {
    if (requestSeq === defectAssociateRequestSeq) {
      defectAssociateCandidates.value = []
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestSeq === defectAssociateRequestSeq) {
      defectAssociateLoading.value = false
    }
  }
}

function openDefectAssociateDrawer() {
  if (!detail.value) {
    return
  }
  defectAssociateKeyword.value = ''
  defectAssociateVisible.value = true
  void loadDefectAssociateCandidates(detail.value)
}

function openCreateDefectDrawer() {
  if (!detail.value) {
    return
  }
  resetDefectForm(detail.value)
  defectCreateVisible.value = true
}

function openDefectDetail(row: DefectSummaryItem) {
  activeDefectId.value = row.id
  defectDetailVisible.value = true
}

async function associateDefects(bugIds: number[]) {
  if (!detail.value || !currentCaseId.value || defectAssociating.value) {
    return
  }

  defectAssociating.value = true
  try {
    const workspaceCode = detail.value.workspaceCode || effectiveWorkspaceCode.value
    for (const bugId of bugIds) {
      const bugDetail = await defectApi.getDefectDetail(workspaceCode, bugId)
      const caseIds = new Set<number>()
      bugDetail.relatedCases?.forEach((caseItem) => {
        if (Number.isFinite(caseItem.id)) {
          caseIds.add(caseItem.id)
        }
      })
      if (bugDetail.relatedCaseId) {
        caseIds.add(bugDetail.relatedCaseId)
      }
      caseIds.add(currentCaseId.value)
      await defectApi.replaceDefectCases(workspaceCode, bugId, {
        caseIds: Array.from(caseIds),
      })
    }
    ElMessage.success(`已关联 ${bugIds.length} 条缺陷`)
    defectAssociateVisible.value = false
    await loadRelatedDefects(detail.value)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    defectAssociating.value = false
  }
}

async function unlinkDefect(row: DefectSummaryItem) {
  if (!detail.value || !currentCaseId.value) {
    return
  }

  try {
    await confirmAction({
      title: '取消关联缺陷',
      message: '确认取消关联当前缺陷吗？',
      confirmText: '取消关联',
      cancelText: '保留',
      tone: 'warning',
    })
  } catch {
    return
  }

  try {
    await defectApi.deleteDefectCase(detail.value.workspaceCode || effectiveWorkspaceCode.value, row.id, currentCaseId.value)
    ElMessage.success('已取消关联缺陷')
    await loadRelatedDefects(detail.value)
    defectDetailRefreshKey.value += 1
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function submitCreateDefect(keepCreating = false) {
  if (!detail.value || !currentCaseId.value || defectSaving.value) {
    return
  }

  const error = validateDefectForm(defectForm)
  if (error) {
    ElMessage.error(error)
    return
  }
  if (!extractPlainTextFromHtml(defectForm.description)) {
    ElMessage.error('请输入缺陷描述')
    return
  }

  defectSaving.value = true
  try {
    const workspaceCode = detail.value.workspaceCode || effectiveWorkspaceCode.value
    const payload = {
      ...buildSaveDefectPayload(defectForm),
      relatedCaseId: currentCaseId.value,
    }
    const created = await defectApi.createDefectFromCase(workspaceCode, currentCaseId.value, payload)
    const description = await uploadDefectInlineImages(created.id, workspaceCode, payload.description)
    if (description !== payload.description) {
      await defectApi.updateDefect(workspaceCode, created.id, {
        ...payload,
        description,
      })
    }
    await uploadPendingDefectAttachments(created.id, workspaceCode)
    ElMessage.success('缺陷创建成功')
    activeTab.value = 'bugs'
    await loadRelatedDefects(detail.value)
    if (keepCreating) {
      resetDefectForm(detail.value)
      return
    }
    defectCreateVisible.value = false
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    defectSaving.value = false
  }
}

async function loadCaseDetail(caseId: number) {
  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  executionHistory.value = []
  historyErrorMessage.value = ''
  try {
    const row = await caseApi.getCaseDetail(caseId, effectiveWorkspaceCode.value)
    if (requestSeq !== detailRequestSeq) {
      return
    }
    detail.value = row
    syncExecutionInputs(row)
    updateExecutionCollection(row)
    buildFallbackQueue(row)
    void loadExecutionQueue(row)
    void loadAttachmentImageUrls(row)
    void loadRelatedDefects(row)
    void loadExecutionHistory(row.id)
  } catch (error) {
    if (requestSeq === detailRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === detailRequestSeq) {
      loading.value = false
    }
  }
}

function bootstrapContext() {
  const savedContext = loadCaseExecutionContext()
  if (savedContext && savedContext.items.some(item => item.id === currentCaseId.value)) {
    contextState.value = savedContext
    executionCases.value = savedContext.items
  }
}

function navigateToCase(caseId: number) {
  if (caseId === currentCaseId.value) {
    return
  }
  activeTab.value = 'detail'
  actualResult.value = ''
  executionNote.value = ''
  void router.replace({
    name: 'case-execution',
    params: { id: caseId },
    query: {
      ...route.query,
      workspace: effectiveWorkspaceCode.value,
    },
  })
}

function moveCase(offset: -1 | 1) {
  const nextRow = visibleExecutionCases.value[currentVisibleIndex.value + offset]
  if (nextRow) {
    navigateToCase(nextRow.id)
  }
}

function applySidebarExecutionStatus(value: string | number | object) {
  sidebarExecutionStatus.value = typeof value === 'string' ? value : ''
}

function goBackToCaseManagement() {
  const query = contextState.value?.returnQuery
  void router.push({
    name: 'cases-manage',
    query: query && Object.keys(query).length ? query : { workspace: effectiveWorkspaceCode.value },
  })
}

async function loadDirectories() {
  const workspaceCode = effectiveWorkspaceCode.value
  if (!workspaceCode || workspaceCode === 'ALL') {
    directories.value = []
    return
  }

  try {
    directories.value = await caseApi.getCaseDirectories(workspaceCode)
  } catch {
    directories.value = []
  }
}

function openCaseEdit() {
  if (!detail.value) {
    return
  }
  void loadDirectories()
  editDrawerVisible.value = true
}

async function saveCaseEdit(payload: SaveCasePayload) {
  if (!detail.value || editSaving.value) {
    return
  }

  editSaving.value = true
  try {
    await caseApi.updateCase(detail.value.id, detail.value.workspaceCode || effectiveWorkspaceCode.value, payload)
    ElMessage.success('用例已更新')
    editDrawerVisible.value = false
    await loadCaseDetail(detail.value.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    editSaving.value = false
  }
}

function handleAddDefect() {
  activeTab.value = 'bugs'
  openCreateDefectDrawer()
}

async function submitExecution(status: string) {
  if (!detail.value || !currentCaseId.value || submittingStatus.value) {
    return
  }

  submittingStatus.value = status
  try {
    const payload: RunCasePayload = {
      executionStatus: status,
      executionComment: actualResult.value.trim(),
      executionNote: executionNote.value.trim(),
    }
    const row = await caseApi.runCase(currentCaseId.value, effectiveWorkspaceCode.value, payload)
    detail.value = row
    syncExecutionInputs(row)
    updateExecutionCollection(row)
    void loadExecutionHistory(row.id)
    ElMessage.success('执行结果已更新')
    if (autoNext.value && canMoveNext.value) {
      moveCase(1)
      return
    }
    if (autoNext.value && !canMoveNext.value) {
      ElMessage.info('已经是最后一条用例')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submittingStatus.value = ''
  }
}

watch(
  currentCaseId,
  (caseId) => {
    if (caseId !== null) {
      void loadCaseDetail(caseId)
    }
  },
)

watch(
  activeTab,
  (tab) => {
    if (tab === 'history' && detail.value) {
      void loadExecutionHistory(detail.value.id)
    }
  },
)

watch(
  visibleExecutionCases,
  (rows) => {
    if (!rows.length || currentVisibleIndex.value >= 0 || !rows[0]) {
      return
    }
    navigateToCase(rows[0].id)
  },
)

onMounted(() => {
  bootstrapContext()
  if (currentCaseId.value !== null) {
    void loadCaseDetail(currentCaseId.value)
  }
})

onBeforeUnmount(() => {
  clearPendingAttachments()
  clearPendingDefectFiles()
  clearInlineDefectImages()
})
</script>

<template>
  <section class="case-execution-page">
    <header class="case-execution-page__topbar">
      <button type="button" class="case-execution-page__back-button" @click="goBackToCaseManagement">
        <el-icon><ArrowLeft /></el-icon>
        <span>用例管理</span>
      </button>
      <span class="case-execution-page__divider" />
      <span
        v-if="detail"
        class="case-execution-page__status-chip case-execution-page__top-status"
        :class="`case-badge--${getWorkstationExecutionStatusMeta(detail.executionStatus || 'NOT_RUN').tone}`"
      >
        {{ getWorkstationExecutionStatusMeta(detail.executionStatus || 'NOT_RUN').label }}
      </span>
      <span v-if="pageCaseNo" class="case-execution-page__title-code">{{ pageCaseNo }}</span>
      <h1 class="case-execution-page__title-text">{{ pageTitle }}</h1>
      <button
        type="button"
        class="case-execution-page__edit-button"
        :disabled="!detail"
        @click="openCaseEdit"
      >
        <Edit2 :size="14" :stroke-width="1.8" />
        编辑用例
      </button>
    </header>

    <div class="case-execution-page__workspace">
      <aside class="case-execution-page__sidebar">
        <div class="case-execution-page__sidebar-tools">
          <el-input
            v-model="sidebarKeyword"
            clearable
            size="small"
            placeholder="搜索编号或标题…"
            :prefix-icon="Search"
            class="case-execution-page__sidebar-search"
          />
        </div>

        <div class="case-execution-page__filter-strip">
          <button
            v-for="item in executionStatusFilters"
            :key="item.value || 'ALL'"
            type="button"
            class="case-execution-page__filter-chip"
            :class="{ 'is-active': sidebarExecutionStatus === item.value }"
            :title="item.count !== undefined ? `${item.label}：${item.count}` : item.label"
            @click="applySidebarExecutionStatus(item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="case-execution-page__queue">
          <button
            v-for="item in visibleExecutionCases"
            :key="item.id"
            type="button"
            class="case-execution-page__queue-item"
            :class="{ 'is-active': item.id === currentCaseId }"
            @click="navigateToCase(item.id)"
          >
            <div class="case-execution-page__queue-top">
              <span class="case-execution-page__queue-code">{{ item.caseNo }}</span>
              <span
                class="case-execution-page__status-chip case-execution-page__queue-status"
                :class="`case-badge--${getWorkstationExecutionStatusMeta(item.executionStatus || 'NOT_RUN').tone}`"
              >
                {{ getWorkstationExecutionStatusMeta(item.executionStatus || 'NOT_RUN').label }}
              </span>
            </div>
            <p>{{ item.title }}</p>
          </button>
          <AppEmptyState
            v-if="!visibleExecutionCases.length"
            title="暂无匹配用例"
            description="调整搜索或状态筛选后再查看。"
          />
        </div>

        <footer class="case-execution-page__sidebar-footer">
          <div class="case-execution-page__sidebar-stats">
            <span>{{ executionStatusFilters[2]?.count || 0 }} 通过</span>
            <span>{{ executionStatusFilters[3]?.count || 0 }} 失败</span>
            <span>{{ executionStatusFilters[4]?.count || 0 }} 阻塞</span>
          </div>
          <strong class="case-execution-page__sidebar-count">
            <span>{{ activeCaseDisplayIndex }}</span>
            <span class="case-execution-page__count-slash">/</span>
            <span>{{ visibleExecutionCases.length || 0 }}</span>
          </strong>
        </footer>
      </aside>

      <main class="case-execution-page__main">
        <AppLoadingState v-if="loading && !detail" class="case-execution-page__state" text="正在加载执行用例..." />

        <AppEmptyState
          v-else-if="errorMessage && !detail"
          class="case-execution-page__state"
          title="执行用例加载失败"
          :description="errorMessage"
        >
          <template #actions>
            <AppButton @click="currentCaseId !== null && loadCaseDetail(currentCaseId)">重试</AppButton>
          </template>
        </AppEmptyState>

        <template v-else-if="detail">
          <div v-if="errorMessage" class="case-execution-page__inline-error">
            {{ errorMessage }}
            <AppButton size="small" @click="loadCaseDetail(detail.id)">重试</AppButton>
          </div>

          <section class="case-execution-page__body">
            <el-tabs v-model="activeTab" class="case-execution-page__tabs">
              <el-tab-pane label="基本信息" name="basic">
                <div class="case-execution-page__info-table">
                  <div class="case-execution-page__info-row">
                    <span>所属模块</span>
                    <strong>{{ modulePath }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>优先级</span>
                    <strong>
                      <span
                        class="case-execution-page__mini-tag"
                        :class="`case-tag--${getCasePriorityMeta(detail.priority).tone}`"
                      >
                        {{ getCasePriorityMeta(detail.priority).label }}
                      </span>
                    </strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>用例来源</span>
                    <strong>{{ getCaseSourceText(detail.sourceType) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>评审状态</span>
                    <strong
                      class="case-execution-page__review-text"
                      :class="`case-text--${getReviewStatusMeta(detail.reviewStatus).tone}`"
                    >
                      {{ getReviewStatusMeta(detail.reviewStatus).label }}
                    </strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>评审人</span>
                    <strong>{{ displayText(detail.reviewedByName) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>评审时间</span>
                    <strong>{{ formatCaseDateTime(detail.reviewedAt) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>执行人</span>
                    <strong>{{ displayText(detail.executorName) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>执行时间</span>
                    <strong>{{ formatCaseDateTime(detail.executedAt) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>创建人</span>
                    <strong>{{ displayText(detail.createdByName) }}</strong>
                  </div>
                  <div class="case-execution-page__info-row">
                    <span>更新时间</span>
                    <strong>{{ formatCaseDateTime(detail.updatedAt) }}</strong>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane label="详情" name="detail">
                <div class="case-execution-page__detail-stack">
                  <div class="case-execution-page__detail-overview">
                    <section class="case-execution-page__detail-section case-execution-page__detail-card">
                      <span class="case-execution-page__detail-label">前置条件</span>
                      <div class="case-execution-page__rich-text">{{ displayText(detail.precondition) }}</div>
                    </section>

                    <section class="case-execution-page__detail-section case-execution-page__detail-card">
                      <span class="case-execution-page__detail-label">测试步骤</span>
                      <div class="case-execution-page__step-list">
                        <div
                          v-for="(item, index) in caseStepRows"
                          :key="`${index}-${item.step}`"
                          class="case-execution-page__step-list-item"
                        >
                          <span>{{ index + 1 }}.</span>
                          <p>{{ item.step }}</p>
                        </div>
                      </div>
                    </section>

                    <section class="case-execution-page__detail-section case-execution-page__detail-card">
                      <span class="case-execution-page__detail-label">预期结果</span>
                      <div class="case-execution-page__rich-text is-expected">{{ displayText(detail.expectedResult) }}</div>
                    </section>

                    <section class="case-execution-page__detail-section case-execution-page__detail-card">
                      <span class="case-execution-page__detail-label">实际结果</span>
                      <el-input
                        v-model="actualResult"
                        type="textarea"
                        :rows="8"
                        resize="none"
                        placeholder="请填写本次执行的实际结果…"
                      />
                    </section>
                  </div>

                  <section class="case-execution-page__detail-section">
                    <span class="case-execution-page__detail-label">执行备注</span>
                    <el-input
                      v-model="executionNote"
                      type="textarea"
                      :rows="3"
                      resize="none"
                      placeholder="可填写执行过程中的补充说明（选填）…"
                    />
                  </section>

                  <section class="case-execution-page__detail-section">
                    <span class="case-execution-page__detail-label">执行证据</span>
                    <AttachmentFileWall
                      :items="attachmentWallItems"
                      :uploading="uploadingAttachments"
                      :downloading-id="downloadingAttachmentId"
                      :removing-id="removingAttachmentId"
                      empty-title="点击上传，或将文件拖拽至此处"
                      empty-description="支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB"
                      @add-files="addPendingAttachments"
                      @download="handleAttachmentPanelDownload"
                      @remove="handleAttachmentPanelRemove"
                    />
                  </section>
                </div>
              </el-tab-pane>

              <el-tab-pane :label="`关联缺陷 (${relatedDefects.length})`" name="bugs">
                <section class="case-execution-page__bugs" v-loading="defectsLoading">
                  <div v-if="relatedDefects.length" class="case-execution-page__bug-actions">
                    <button type="button" class="case-execution-page__bug-action-button" @click="openDefectAssociateDrawer">
                      <Link :size="13" :stroke-width="1.8" />
                      关联已有缺陷
                    </button>
                    <button type="button" class="case-execution-page__bug-action-button is-primary" @click="openCreateDefectDrawer">
                      <Plus :size="13" :stroke-width="1.8" />
                      新建缺陷
                    </button>
                  </div>
                  <div v-if="defectsErrorMessage" class="case-execution-page__inline-error">
                    {{ defectsErrorMessage }}
                    <AppButton size="small" @click="loadRelatedDefects(detail)">重试</AppButton>
                  </div>
                  <div v-if="relatedDefects.length" class="case-execution-page__bug-table">
                    <div class="case-execution-page__bug-header">
                      <span>缺陷编号</span>
                      <span>缺陷标题</span>
                      <span>优先级</span>
                      <span>严重级别</span>
                      <span>状态</span>
                      <span>负责人</span>
                      <span>更新时间</span>
                      <span>操作</span>
                    </div>
                    <div
                      v-for="item in relatedDefects"
                      :key="item.id"
                      class="case-execution-page__bug-row"
                    >
                      <span class="case-execution-page__bug-code">{{ item.bugNo }}</span>
                      <span class="case-execution-page__bug-title">{{ item.title }}</span>
                      <span>
                        <span
                          class="case-execution-page__mini-tag"
                          :class="`case-tag--${getDefectPriorityMeta(item.priority).tone}`"
                        >
                          {{ getDefectPriorityMeta(item.priority).label }}
                        </span>
                      </span>
                      <span
                        class="case-execution-page__bug-tone-text"
                        :class="`case-text--${getDefectSeverityMeta(item.severity).tone}`"
                      >
                        {{ getDefectSeverityMeta(item.severity).label }}
                      </span>
                      <span>
                        <span
                          class="case-execution-page__mini-tag is-wide"
                          :class="`case-tag--${getDefectStatusMeta(item.status).tone}`"
                        >
                          {{ getDefectStatusMeta(item.status).label }}
                        </span>
                      </span>
                      <span>{{ item.assigneeName || '-' }}</span>
                      <span>{{ formatDefectDateTime(item.updatedAt) }}</span>
                      <span class="case-execution-page__bug-row-actions">
                        <el-button text type="primary" @click="openDefectDetail(item)">查看</el-button>
                        <el-button text type="danger" @click="unlinkDefect(item)">取消关联</el-button>
                      </span>
                    </div>
                  </div>
                  <div
                    v-else-if="!defectsLoading && !defectsErrorMessage"
                    class="case-execution-page__defect-empty"
                  >
                    <Bug class="case-execution-page__defect-empty-icon" :size="32" :stroke-width="1.8" />
                    <strong>暂无关联缺陷</strong>
                    <p>执行失败或阻塞时，可在此关联或新建缺陷进行跟踪管理</p>
                    <div class="case-execution-page__defect-empty-actions">
                      <button type="button" class="case-execution-page__bug-action-button" @click="openDefectAssociateDrawer">
                        <Link :size="13" :stroke-width="1.8" />
                        关联已有缺陷
                      </button>
                      <button type="button" class="case-execution-page__bug-action-button is-primary" @click="openCreateDefectDrawer">
                        <Plus :size="13" :stroke-width="1.8" />
                        新建缺陷
                      </button>
                    </div>
                  </div>
                </section>
              </el-tab-pane>

              <el-tab-pane label="执行历史" name="history">
                <section class="case-execution-page__history">
                  <AppLoadingState v-if="historyLoading" text="正在加载执行历史..." />
                  <div v-else-if="historyRows.length" class="case-execution-page__history-list">
                    <article
                      v-for="item in historyRows"
                      :key="item.id"
                      class="case-execution-page__history-item"
                    >
                      <div>
                        <span
                          class="case-execution-page__status-chip case-execution-page__history-status"
                          :class="`case-badge--${getWorkstationExecutionStatusMeta(item.status).tone}`"
                        >
                          {{ getWorkstationExecutionStatusMeta(item.status).label }}
                        </span>
                        <span>{{ item.executedAt }}</span>
                        <span>执行人：<strong>{{ item.executorName }}</strong></span>
                      </div>
                      <div class="case-execution-page__history-body">
                        <section>
                          <span>实际结果</span>
                          <p>{{ item.executionComment }}</p>
                        </section>
                        <section>
                          <span>备注</span>
                          <p>{{ item.executionNote }}</p>
                        </section>
                      </div>
                    </article>
                  </div>
                  <AppEmptyState
                    v-else-if="historyErrorMessage"
                    title="执行历史加载失败"
                    :description="historyErrorMessage"
                  >
                    <template #actions>
                      <AppButton v-if="detail" @click="loadExecutionHistory(detail.id)">重试</AppButton>
                    </template>
                  </AppEmptyState>
                  <div v-else class="case-execution-page__history-empty">
                    <Clock :size="36" :stroke-width="1.6" />
                    <p>该用例尚未执行，暂无历史记录</p>
                  </div>
                </section>
              </el-tab-pane>
            </el-tabs>
          </section>

          <footer class="case-execution-page__footer">
            <div class="case-execution-page__footer-nav">
              <button
                type="button"
                class="case-execution-page__footer-button"
                :disabled="!canMovePrevious"
                @click="moveCase(-1)"
              >
                <el-icon><ArrowLeft /></el-icon>
                上一条
              </button>
              <span class="case-execution-page__footer-count">
                <strong>{{ activeCaseDisplayIndex }}</strong><span>/{{ visibleExecutionCases.length || 0 }}</span>
              </span>
              <button
                type="button"
                class="case-execution-page__footer-button"
                :disabled="!canMoveNext"
                @click="moveCase(1)"
              >
                下一条
                <el-icon><ArrowRight /></el-icon>
              </button>
              <span class="case-execution-page__footer-separator" />
              <label class="case-execution-page__auto-next">
                <button
                  type="button"
                  class="case-execution-page__auto-switch"
                  :class="{ 'is-on': autoNext }"
                  role="switch"
                  :aria-checked="autoNext"
                  @click="autoNext = !autoNext"
                >
                  <span />
                </button>
                <span>自动下一条</span>
              </label>
            </div>
            <div class="case-execution-page__footer-actions">
              <button type="button" class="case-execution-page__footer-button is-defect" @click="handleAddDefect">
                <Bug :size="13" :stroke-width="1.8" />
                添加缺陷
              </button>
              <span class="case-execution-page__footer-separator is-tall" />
              <button
                type="button"
                class="case-execution-page__status-button is-blocked"
                :disabled="!!submittingStatus"
                @click="submitExecution('BLOCKED')"
              >
                标记阻塞
              </button>
              <button
                type="button"
                class="case-execution-page__status-button is-failed"
                :disabled="!!submittingStatus"
                @click="submitExecution('FAILED')"
              >
                标记失败
              </button>
              <button
                type="button"
                class="case-execution-page__status-button is-passed"
                :disabled="!!submittingStatus"
                @click="submitExecution('PASSED')"
              >
                <Check :size="14" :stroke-width="2" />
                标记通过
              </button>
            </div>
          </footer>
        </template>
      </main>
    </div>
  </section>

  <CaseCreateEditDrawer
    v-if="detail"
    v-model="editDrawerVisible"
    mode="edit"
    :case-item="detail"
    :case-detail="detail"
    :directories="directories"
    :default-workspace-code="detail.workspaceCode || effectiveWorkspaceCode"
    :default-directory-id="detail.directoryId"
    :saving="editSaving"
    :show-navigator="visibleExecutionCases.length > 1"
    :can-go-prev="canMovePrevious"
    :can-go-next="canMoveNext"
    :current-index="activeCaseDisplayIndex"
    :total-count="visibleExecutionCases.length"
    @submit="saveCaseEdit"
    @prev="moveCase(-1)"
    @next="moveCase(1)"
  />

  <CaseDefectAssociateDrawer
    v-model="defectAssociateVisible"
    v-model:keyword="defectAssociateKeyword"
    :bugs="availableAssociateDefects"
    :loading="defectAssociateLoading"
    :associating="defectAssociating"
    @associate="associateDefects"
  />

  <CaseDefectEditorDrawer
    v-model="defectCreateVisible"
    :form="defectForm"
    :saving="defectSaving"
    :can-submit="canSubmitDefect"
    :pending-files="pendingDefectFiles"
    @submit="submitCreateDefect(false)"
    @submit-and-continue="submitCreateDefect(true)"
    @add-files="addPendingDefectFiles"
    @remove-file="removePendingDefectFile"
    @add-inline-image="addInlineDefectImage"
  />

  <DefectDetailDrawer
    v-model="defectDetailVisible"
    :defect-id="activeDefectId"
    :workspace-code="detail?.workspaceCode || effectiveWorkspaceCode"
    :refresh-key="defectDetailRefreshKey"
  />

</template>

<style scoped>
.case-execution-page {
  --exec-bg: #f7f8fa;
  --exec-panel: #ffffff;
  --exec-border: #e5e6eb;
  --exec-border-strong: #d3d4d6;
  --exec-text: #1d2129;
  --exec-text-secondary: #4e5969;
  --exec-text-muted: #86909c;
  --exec-text-disabled: #c9cdd4;
  --exec-primary: #165dff;
  --exec-primary-soft: #ebf3ff;
  --exec-success: #00b42a;
  --exec-success-soft: #e8ffea;
  --exec-danger: #f53f3f;
  --exec-danger-soft: #ffece8;
  --exec-warning: #ff7d00;
  --exec-warning-soft: #fff3e8;

  position: fixed;
  top: 43px;
  right: 0;
  bottom: 0;
  left: var(--app-current-sidebar-width, var(--app-sidebar-width));
  z-index: 1;
  display: flex;
  height: auto;
  max-height: none;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--exec-bg);
  color: var(--exec-text);
  font-family: Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

:global(.app-layout__main:has(.case-execution-page)) {
  height: calc(100dvh - 43px);
  min-height: 0;
  overflow: hidden;
}

:global(.app-layout.has-secondary-nav .app-layout__main:has(.case-execution-page)) {
  height: calc(100dvh - 88px);
}

:global(.app-layout.has-secondary-nav) .case-execution-page {
  top: 88px;
  height: auto;
  max-height: none;
}

.case-execution-page__topbar {
  display: flex;
  height: 52px;
  flex: 0 0 52px;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid var(--exec-border);
  background: var(--exec-panel);
}

.case-execution-page__back-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--exec-text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  padding: 0;
  transition: color 0.16s ease;
}

.case-execution-page__back-button:hover,
.case-execution-page__back-button:focus-visible {
  color: var(--exec-primary);
  outline: none;
}

.case-execution-page__divider {
  width: 1px;
  height: 16px;
  background: var(--exec-border);
}

.case-execution-page__top-status {
  flex: 0 0 auto;
}

.case-execution-page__status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  white-space: nowrap;
}

.case-execution-page__top-status,
.case-execution-page__queue-status,
.case-execution-page__history-status {
  box-sizing: border-box;
  gap: 5px;
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-execution-page__top-status::before,
.case-execution-page__queue-status::before,
.case-execution-page__history-status::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--case-execution-status-dot, currentColor);
  content: "";
  flex: 0 0 6px;
}

.case-execution-page__top-status.case-badge--default,
.case-execution-page__queue-status.case-badge--default,
.case-execution-page__history-status.case-badge--default {
  --case-execution-status-dot: var(--exec-text-disabled);
  border-color: var(--exec-border-strong);
  background: #f4f4f5;
  color: var(--exec-text-muted);
}

.case-execution-page__top-status.case-badge--success,
.case-execution-page__queue-status.case-badge--success,
.case-execution-page__history-status.case-badge--success {
  --case-execution-status-dot: var(--exec-success);
  border-color: #b2efbb;
  background: var(--exec-success-soft);
  color: var(--exec-success);
}

.case-execution-page__top-status.case-badge--danger,
.case-execution-page__queue-status.case-badge--danger,
.case-execution-page__history-status.case-badge--danger {
  --case-execution-status-dot: var(--exec-danger);
  border-color: #fbbbbb;
  background: var(--exec-danger-soft);
  color: var(--exec-danger);
}

.case-execution-page__top-status.case-badge--warning,
.case-execution-page__queue-status.case-badge--warning,
.case-execution-page__history-status.case-badge--warning {
  --case-execution-status-dot: var(--exec-warning);
  border-color: #ffd595;
  background: var(--exec-warning-soft);
  color: var(--exec-warning);
}

.case-execution-page__top-status.case-badge--primary,
.case-execution-page__queue-status.case-badge--primary,
.case-execution-page__history-status.case-badge--primary {
  --case-execution-status-dot: var(--exec-primary);
  border-color: #bedaff;
  background: var(--exec-primary-soft);
  color: var(--exec-primary);
}

.case-execution-page__title-code {
  flex: 0 0 auto;
  color: var(--exec-text-disabled);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  line-height: 18px;
}

.case-execution-page__title-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  margin: 0;
  color: var(--exec-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__edit-button {
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 15px;
  border: 1px solid var(--exec-border);
  border-color: var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
  color: var(--exec-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.case-execution-page__edit-button:hover:not(:disabled),
.case-execution-page__edit-button:focus-visible {
  border-color: #d3d4d6;
  background: #f7f8fa;
  color: var(--exec-text);
  outline: none;
}

.case-execution-page__edit-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.case-execution-page__workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.case-execution-page__sidebar {
  display: flex;
  width: 260px;
  min-width: 260px;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
  border-right: 1px solid var(--exec-border);
  background: var(--exec-panel);
}

.case-execution-page__sidebar-tools {
  padding: 10px 10px 6px;
}

.case-execution-page__sidebar-search {
  width: 100%;
}

.case-execution-page__sidebar-search :deep(.el-input__wrapper) {
  height: 30px;
  min-height: 30px;
  padding-top: 0;
  padding-bottom: 0;
  border-radius: 4px;
  background: var(--exec-bg);
  box-shadow: 0 0 0 1px var(--exec-border) inset;
}

.case-execution-page__sidebar-search :deep(.el-input__inner) {
  height: 28px;
  color: var(--exec-text);
  font-size: 12px;
  line-height: 28px;
}

.case-execution-page__sidebar-search :deep(.el-input__wrapper:hover),
.case-execution-page__sidebar-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--exec-primary) inset, 0 0 0 2px rgba(22, 93, 255, 0.08);
}

.case-execution-page__filter-strip {
  display: flex;
  gap: 3px;
  padding: 0 10px 8px;
  border-bottom: 1px solid var(--exec-border);
}

.case-execution-page__filter-chip {
  display: inline-flex;
  height: 21px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--exec-text-muted);
  cursor: pointer;
  font-size: 11px;
  line-height: 16px;
  padding: 2px 8px;
  transition: background 0.16s ease, color 0.16s ease;
  white-space: nowrap;
}

.case-execution-page__filter-chip:hover {
  background: var(--exec-primary-soft);
  color: var(--exec-primary);
}

.case-execution-page__filter-chip.is-active {
  background: var(--exec-primary);
  color: #fff;
  font-weight: 500;
}

.case-execution-page__queue {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: auto;
}

.case-execution-page__queue-item {
  position: relative;
  width: 100%;
  min-height: 73px;
  border: 0;
  border-bottom: 1px solid var(--exec-border);
  border-left: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  padding: 8px 10px 9px 12px;
  text-align: left;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.case-execution-page__queue-item:hover {
  background: rgba(22, 93, 255, 0.04);
}

.case-execution-page__queue-item.is-active {
  border-left-color: var(--exec-primary);
  background: var(--exec-primary-soft);
}

.case-execution-page__queue-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.case-execution-page__queue-code {
  color: var(--exec-text-disabled);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 17px;
}

.case-execution-page__queue-item.is-active .case-execution-page__queue-code,
.case-execution-page__queue-item.is-active p {
  color: var(--exec-primary);
  font-weight: 500;
}

.case-execution-page__queue-status {
  border-radius: 4px;
}

.case-execution-page__queue-status.case-badge--success {
  border-color: #b2efbb;
  background: var(--exec-success-soft);
  color: var(--exec-success);
}

.case-execution-page__queue-status.case-badge--default {
  border-color: var(--exec-border-strong);
  background: #f4f4f5;
  color: var(--exec-text-muted);
}

.case-execution-page__queue-status.case-badge--warning {
  border-color: #ffd595;
  background: var(--exec-warning-soft);
  color: var(--exec-warning);
}

.case-execution-page__queue-status.case-badge--danger {
  border-color: #fbbbbb;
  background: var(--exec-danger-soft);
  color: var(--exec-danger);
}

.case-execution-page__queue-item p {
  display: -webkit-box;
  display: -webkit-box;
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--exec-text);
  font-size: 12px;
  line-height: 17px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.case-execution-page__sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  flex: 0 0 auto;
  padding: 8px 12px;
  border-top: 1px solid var(--exec-border);
  background: var(--exec-bg);
  color: var(--exec-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.case-execution-page__sidebar-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.case-execution-page__sidebar-stats span:nth-child(1) {
  color: var(--exec-success);
}

.case-execution-page__sidebar-stats span:nth-child(2) {
  color: var(--exec-danger);
}

.case-execution-page__sidebar-stats span:nth-child(3) {
  color: var(--exec-warning);
}

.case-execution-page__sidebar-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--exec-text-secondary);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-execution-page__count-slash {
  color: var(--exec-text-disabled);
  font-weight: 600;
}

.case-execution-page__main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  flex-direction: column;
  background: var(--exec-panel);
}

.case-execution-page__body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.case-execution-page__tabs {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.case-execution-page__state {
  flex: 1;
}

.case-execution-page__tabs :deep(.el-tabs__header) {
  height: 44px;
  flex: 0 0 44px;
  margin: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--exec-border);
}

.case-execution-page__tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.case-execution-page__tabs :deep(.el-tabs__item) {
  height: 44px;
  color: var(--exec-text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 44px;
  padding: 0 14px;
}

.case-execution-page__tabs :deep(.el-tabs__item.is-active) {
  color: var(--exec-primary);
}

.case-execution-page__tabs :deep(.el-tabs__active-bar) {
  height: 2px;
  background: var(--exec-primary);
}

.case-execution-page__tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.case-execution-page__tabs :deep(.el-tab-pane) {
  min-height: 100%;
  padding: 20px 24px 22px;
}

.case-execution-page__info-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--exec-border);
  border-radius: 6px;
  background: var(--exec-panel);
}

.case-execution-page__info-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  min-height: 40.5px;
  border-bottom: 1px solid var(--exec-border);
}

.case-execution-page__info-row:last-child {
  border-bottom: 0;
}

.case-execution-page__info-row > span,
.case-execution-page__info-row > strong {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 10px 16px;
  font-size: 13px;
  line-height: 19.5px;
}

.case-execution-page__info-row > span {
  border-right: 1px solid var(--exec-border);
  background: var(--exec-bg);
  color: var(--exec-text-muted);
  font-weight: 500;
}

.case-execution-page__info-row > strong {
  color: var(--exec-text);
  font-weight: 400;
  overflow-wrap: anywhere;
}

.case-execution-page__mini-tag {
  display: inline-flex;
  box-sizing: border-box;
  height: 19px;
  align-items: center;
  justify-content: center;
  min-width: 29px;
  border-radius: 4px;
  padding: 1px 8px 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-execution-page__mini-tag.is-wide {
  min-width: 52px;
  font-weight: 500;
}

.case-tag--danger {
  background: var(--exec-danger-soft);
  color: var(--exec-danger);
}

.case-tag--warning {
  background: var(--exec-warning-soft);
  color: var(--exec-warning);
}

.case-tag--primary {
  background: #e8f3ff;
  color: var(--exec-primary);
}

.case-tag--success {
  background: var(--exec-success-soft);
  color: var(--exec-success);
}

.case-tag--default {
  background: #f4f4f5;
  color: var(--exec-text-muted);
}

.case-execution-page__review-text,
.case-execution-page__bug-tone-text {
  font-weight: 500;
}

.case-text--success {
  color: var(--exec-success) !important;
}

.case-text--danger {
  color: var(--exec-danger) !important;
}

.case-text--warning {
  color: var(--exec-warning) !important;
}

.case-text--primary {
  color: var(--exec-primary) !important;
}

.case-text--default {
  color: var(--exec-text-muted) !important;
}

.case-execution-page__detail-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.case-execution-page__detail-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.case-execution-page__detail-card {
  box-sizing: border-box;
  padding: 14px;
  border: 1px solid var(--exec-border) !important;
  border-radius: 6px;
  background: var(--exec-panel) !important;
  gap: 10px;
}

.case-execution-page__detail-section,
.case-execution-page__bugs,
.case-execution-page__history {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  border: 0;
  background: transparent;
}

.case-execution-page__detail-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--exec-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.case-execution-page__detail-label::before {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--exec-primary);
  content: '';
}

.case-execution-page__rich-text {
  min-height: 84px;
  overflow: visible;
  padding: 12px 14px;
  border: 1px solid var(--exec-border);
  border-radius: 8px;
  background: var(--exec-bg);
  color: var(--exec-text-secondary);
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.case-execution-page__detail-card .case-execution-page__rich-text {
  min-height: 216px;
  background: #f2f3f5;
}

.case-execution-page__rich-text.is-expected {
  border-color: var(--exec-border);
  background: #f2f3f5;
  color: var(--exec-text-secondary);
}

.case-execution-page__step-list {
  display: flex;
  min-height: 216px;
  overflow: visible;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--exec-border);
  border-radius: 8px;
  background: #f2f3f5;
  color: var(--exec-text-secondary);
  font-size: 13px;
  line-height: 22px;
}

.case-execution-page__step-list-item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.case-execution-page__step-list-item span {
  flex: 0 0 auto;
  color: var(--exec-text-secondary);
  font-weight: 500;
}

.case-execution-page__step-list-item p {
  min-width: 0;
  margin: 0;
}

.case-execution-page__steps-table {
  overflow: hidden;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
}

.case-execution-page__steps-head,
.case-execution-page__steps-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr);
}

.case-execution-page__steps-head {
  border-bottom: 1px solid var(--exec-border);
  background: #fafafa;
  color: var(--exec-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
}

.case-execution-page__steps-head span,
.case-execution-page__steps-row span,
.case-execution-page__steps-row p {
  min-width: 0;
  margin: 0;
  padding: 9px 12px;
  border-right: 1px solid var(--exec-border);
}

.case-execution-page__steps-head span:last-child,
.case-execution-page__steps-row p:last-child {
  border-right: 0;
}

.case-execution-page__steps-row {
  border-bottom: 1px solid var(--exec-border);
  color: var(--exec-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.case-execution-page__steps-row:nth-child(odd) {
  background: #fafafa;
}

.case-execution-page__steps-row:last-child {
  border-bottom: 0;
}

.case-execution-page__steps-row > span {
  color: var(--exec-text-disabled);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.case-execution-page__detail-section :deep(.el-textarea__inner) {
  min-height: 86px !important;
  padding: 10px 14px;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  color: var(--exec-text);
  font-size: 13px;
  line-height: 21px;
  box-shadow: none;
}

.case-execution-page__detail-card :deep(.el-textarea__inner) {
  min-height: 216px !important;
  padding: 12px 14px;
  border-radius: 8px;
  resize: none;
  background: #fff;
  font-size: 13px;
  line-height: 22px;
}

.case-execution-page__detail-section :deep(.el-textarea__inner:hover) {
  border-color: rgba(22, 93, 255, 0.42);
}

.case-execution-page__detail-section :deep(.el-textarea__inner:focus) {
  border-color: var(--exec-primary);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.1);
}

.case-execution-page__bugs,
.case-execution-page__history {
  min-height: 280px;
  gap: 12px;
}

.case-execution-page__bug-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
}

.case-execution-page__bug-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.case-execution-page__bug-action-button {
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 15px;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
  color: var(--exec-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.case-execution-page__bug-action-button.is-primary {
  border-color: var(--exec-primary);
  background: var(--exec-primary);
  color: #fff;
  padding-right: 14px;
  padding-left: 14px;
}

.case-execution-page__bug-header,
.case-execution-page__bug-row {
  display: grid;
  min-width: 800px;
  grid-template-columns: 130px minmax(360px, 1fr) 60px 60px 80px 68px 140px 84px;
  align-items: center;
  padding: 0 12px;
}

.case-execution-page__bug-header {
  min-height: 33px;
  border-bottom: 1px solid var(--exec-border);
  background: var(--exec-bg);
  color: var(--exec-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-execution-page__bug-row {
  min-height: 40.5px;
  border-bottom: 1px solid var(--exec-border);
  color: var(--exec-text-secondary);
  font-size: 13px;
  line-height: 19.5px;
}

.case-execution-page__bug-row:nth-child(odd) {
  background: #f7f8fa;
}

.case-execution-page__bug-row:last-child {
  border-bottom: 0;
}

.case-execution-page__bug-code {
  color: var(--exec-primary);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  line-height: 18px;
}

.case-execution-page__bug-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__bug-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.case-execution-page__bug-row-actions :deep(.el-button) {
  height: 18px;
  margin-left: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-execution-page__defect-empty {
  display: flex;
  min-height: 236px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  border: 1px dashed var(--exec-border);
  border-radius: 4px;
  background: var(--exec-bg);
  color: var(--exec-text-muted);
  text-align: center;
}

.case-execution-page__defect-empty-icon {
  color: var(--exec-text-disabled);
}

.case-execution-page__defect-empty strong {
  color: var(--exec-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.case-execution-page__defect-empty p {
  margin: 0;
  color: var(--exec-text-muted);
  font-size: 13px;
  line-height: 19.5px;
}

.case-execution-page__defect-empty-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.case-execution-page__history-empty {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 40px 0;
  color: var(--exec-text-disabled);
}

.case-execution-page__history-empty p {
  margin: 0;
  color: var(--exec-text-muted);
  font-size: 13px;
  line-height: 19.5px;
}

.case-execution-page__history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-execution-page__history-item {
  display: flex;
  flex-direction: column;
  height: 156px;
  overflow: hidden;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
}

.case-execution-page__history-item > div {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--exec-border);
  background: var(--exec-bg);
  color: var(--exec-text-secondary);
  font-size: 12px;
}

.case-execution-page__history-item > div:first-child {
  min-height: 43px;
  padding: 9px 14px 10px;
}

.case-execution-page__history-item > div:first-child span:not(.case-execution-page__history-status) {
  color: var(--exec-text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  line-height: 18px;
}

.case-execution-page__history-item > div:first-child span:last-child {
  color: var(--exec-text-secondary);
  font-family: inherit;
  font-size: 13px;
  line-height: 19.5px;
}

.case-execution-page__history-item > div:first-child span:last-child strong {
  color: var(--exec-text);
  font-weight: 500;
}

.case-execution-page__history-item > .case-execution-page__history-body {
  display: flex;
  flex: 1;
  align-items: stretch;
  justify-content: flex-start;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 0 !important;
  background: #fff !important;
}

.case-execution-page__history-body section {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.case-execution-page__history-body span {
  color: var(--exec-text-disabled);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.66px;
  line-height: 16.5px;
}

.case-execution-page__history-body p {
  margin: 0;
  padding-top: 4px;
  color: var(--exec-text);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.case-execution-page__history-body section:last-child p {
  color: var(--exec-text-secondary);
}

.case-execution-page__footer {
  display: flex;
  height: 56px;
  flex: 0 0 56px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 20px;
  border-top: 1px solid var(--exec-border);
  background: var(--exec-panel);
}

.case-execution-page__footer-nav,
.case-execution-page__footer-actions,
.case-execution-page__auto-next {
  display: flex;
  align-items: center;
  gap: 8px;
}

.case-execution-page__footer-button,
.case-execution-page__status-button {
  display: inline-flex;
  min-width: 0;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--exec-border);
  border-radius: 4px;
  background: var(--exec-panel);
  color: var(--exec-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  padding: 6px 13px;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.case-execution-page__footer-button:hover:not(:disabled) {
  border-color: #d3d4d6;
  background: #f7f8fa;
}

.case-execution-page__footer-button:disabled,
.case-execution-page__status-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.case-execution-page__footer-button .el-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.case-execution-page__footer-button.is-defect {
  gap: 5px;
  padding: 7px 15px;
}

.case-execution-page__footer-count {
  display: inline-flex;
  min-width: 40px;
  justify-content: center;
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.case-execution-page__footer-count strong {
  color: var(--exec-text);
  font-weight: 700;
}

.case-execution-page__footer-count span {
  color: var(--exec-text-muted);
  font-weight: 400;
}

.case-execution-page__footer-separator {
  width: 1px;
  height: 18px;
  background: var(--exec-border);
}

.case-execution-page__footer-separator.is-tall {
  height: 20px;
}

.case-execution-page__auto-next {
  gap: 8px;
  color: var(--exec-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-execution-page__auto-switch {
  position: relative;
  width: 32px;
  height: 16px;
  flex: 0 0 32px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
  transition: background 0.16s ease;
}

.case-execution-page__auto-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(29, 33, 41, 0.12);
  transition: transform 0.16s ease;
}

.case-execution-page__auto-switch.is-on {
  background: var(--exec-success);
}

.case-execution-page__auto-switch.is-on span {
  transform: translateX(16px);
}

.case-execution-page__status-button.is-blocked {
  border-color: #ffd595;
  background: var(--exec-warning-soft);
  color: var(--exec-warning);
  padding: 6px 17px;
}

.case-execution-page__status-button.is-failed {
  border-color: #fbbbbb;
  background: var(--exec-danger-soft);
  color: var(--exec-danger);
  padding: 6px 17px;
}

.case-execution-page__status-button.is-passed {
  gap: 6px;
  border-color: transparent;
  background: var(--exec-success);
  color: #fff;
  font-weight: 600;
  padding: 5px 20px;
}

.case-execution-page__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 20px 0;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: var(--exec-danger-soft);
  color: var(--exec-danger);
  font-size: 13px;
}

@media (max-width: 1180px) {
  .case-execution-page__sidebar {
    width: 236px;
    min-width: 236px;
  }

  .case-execution-page__filter-strip {
    overflow-x: auto;
  }
}

@media (max-width: 860px) {
  .case-execution-page {
    height: auto;
    min-height: calc(100dvh - 64px);
  }

  .case-execution-page__workspace {
    flex-direction: column;
  }

  .case-execution-page__sidebar {
    width: 100%;
    min-width: 0;
    max-height: 340px;
    border-right: 0;
    border-bottom: 1px solid var(--exec-border);
  }

  .case-execution-page__topbar {
    flex-wrap: wrap;
    height: auto;
    min-height: 52px;
    padding: 10px 14px;
  }

  .case-execution-page__steps-head,
  .case-execution-page__steps-row {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .case-execution-page__steps-head span:last-child,
  .case-execution-page__steps-row p:last-child {
    display: none;
  }

  .case-execution-page__footer {
    align-items: flex-start;
    flex-direction: column;
    height: auto;
    padding: 12px 14px;
  }
}
</style>
