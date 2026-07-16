<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Edit, Filter, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  CaseExecutionStatusBadge,
  CasePriorityBadge,
  CaseReviewStatusBadge,
  caseApi,
  caseExecutionStatusOptions,
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
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
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
import { AttachmentFileWall, confirmDelete, type AttachmentFileWallItem } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
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
}>>([])
const attachmentImageUrls = ref<Record<number, string>>({})
const uploadingAttachments = ref(false)
const downloadingAttachmentId = ref<number | string | null>(null)
const removingAttachmentId = ref<number | string | null>(null)
const autoNext = ref(true)
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

const sidebarStatusOptions = computed(() => [
  { label: '全部状态', value: '' },
  ...caseExecutionStatusOptions,
])

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
  return `[${detail.value.caseNo}]`
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

const attachmentWallItems = computed<AttachmentFileWallItem[]>(() => [
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
    pending: true,
  })),
])

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
  if (!files.length) {
    return
  }
  const nextItems = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }))
  pendingAttachments.value = [...pendingAttachments.value, ...nextItems]
  void uploadPendingAttachments(nextItems)
}

function removePendingAttachment(id: string) {
  const target = pendingAttachments.value.find(item => item.id === id)
  if (target?.previewUrl) {
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
    await caseApi.uploadCaseExecutionAttachments(
      detail.value.workspaceCode || effectiveWorkspaceCode.value,
      detail.value.id,
      items.map(item => item.file),
    )
    uploadSucceeded = true
    items.forEach(item => removePendingAttachment(item.id))
    ElMessage.success('附件已上传')
    const row = await caseApi.getCaseDetail(detail.value.id, detail.value.workspaceCode || effectiveWorkspaceCode.value)
    detail.value = row
    updateExecutionCollection(row)
    void loadAttachmentImageUrls(row)
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
    await ElMessageBox.confirm('确认取消关联当前缺陷吗？', '取消关联缺陷', {
      type: 'warning',
      confirmButtonText: '取消关联',
      cancelButtonText: '保留',
      confirmButtonClass: 'el-button--danger',
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
    <aside class="case-execution-page__sidebar">
      <header class="case-execution-page__sidebar-header">
        <div class="case-execution-page__source">
          <strong>{{ contextState?.sourceLabel || '当前用例' }}</strong>
        </div>
      </header>
      <div class="case-execution-page__sidebar-tools">
        <el-input
          v-model="sidebarKeyword"
          clearable
          size="small"
          placeholder="支持 ID / 标题模糊搜索"
          :prefix-icon="Search"
          class="case-execution-page__sidebar-search"
        />
        <el-dropdown
          trigger="click"
          popper-class="case-execution-page__status-menu"
          @command="applySidebarExecutionStatus"
        >
          <el-button
            class="case-execution-page__filter-button"
            :class="{ 'is-active': !!sidebarExecutionStatus }"
          >
            <el-icon><Filter /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in sidebarStatusOptions"
                :key="item.value || 'ALL'"
                :command="item.value"
                :class="{ 'is-active': sidebarExecutionStatus === item.value }"
              >
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
            <span>{{ item.caseNo }}</span>
            <CaseExecutionStatusBadge
              class="case-execution-page__queue-status"
              :status="item.executionStatus || 'NOT_RUN'"
            />
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
        <span>共 {{ executionCases.length }} 条</span>
        <span>{{ activeCaseDisplayIndex }}/{{ visibleExecutionCases.length || 0 }}</span>
      </footer>
    </aside>

    <main class="case-execution-page__main">
      <div class="case-execution-page__backbar">
        <el-button class="case-execution-page__back-button" :icon="ArrowLeft" @click="goBackToCaseManagement">返回用例管理</el-button>
      </div>

      <AppLoadingState v-if="loading && !detail" text="正在加载执行用例..." />

      <AppEmptyState v-else-if="errorMessage && !detail" title="执行用例加载失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="currentCaseId !== null && loadCaseDetail(currentCaseId)">重试</AppButton>
        </template>
      </AppEmptyState>

      <template v-else-if="detail">
        <header class="case-execution-page__header">
          <div class="case-execution-page__title-block">
            <CaseExecutionStatusBadge :status="detail.executionStatus || 'NOT_RUN'" />
            <h1>
              <span v-if="pageCaseNo" class="case-execution-page__title-code">{{ pageCaseNo }}</span>
              <span class="case-execution-page__title-text">{{ pageTitle }}</span>
            </h1>
          </div>
          <AppButton :icon="Edit" @click="openCaseEdit">编辑</AppButton>
        </header>

        <div v-if="errorMessage" class="case-execution-page__inline-error">
          {{ errorMessage }}
          <AppButton size="small" @click="loadCaseDetail(detail.id)">重试</AppButton>
        </div>

        <section class="case-execution-page__body">
          <el-tabs v-model="activeTab" class="case-execution-page__tabs">
            <el-tab-pane label="基本信息" name="basic">
              <div class="case-execution-page__meta-grid">
                <section class="case-execution-page__meta-item">
                  <span>所属模块</span>
                  <strong>{{ modulePath }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>优先级</span>
                  <strong><CasePriorityBadge :priority="detail.priority" /></strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>用例来源</span>
                  <strong>{{ displayText(detail.sourceType) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审状态</span>
                  <strong><CaseReviewStatusBadge :status="detail.reviewStatus" /></strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审人</span>
                  <strong>{{ displayText(detail.reviewedByName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审时间</span>
                  <strong>{{ formatCaseDateTime(detail.reviewedAt) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>执行人</span>
                  <strong>{{ displayText(detail.executorName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>执行时间</span>
                  <strong>{{ formatCaseDateTime(detail.executedAt) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>创建人</span>
                  <strong>{{ displayText(detail.createdByName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>更新时间</span>
                  <strong>{{ formatCaseDateTime(detail.updatedAt) }}</strong>
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane label="详情" name="detail">
              <div class="case-execution-page__detail-stack">
                <div class="case-execution-page__detail-row">
                  <section class="case-execution-page__detail-column">
                    <span class="case-execution-page__detail-label">前置条件</span>
                    <div class="case-execution-page__rich-text">{{ displayText(detail.precondition) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span class="case-execution-page__detail-label">测试步骤</span>
                    <div class="case-execution-page__rich-text">{{ displayText(detail.steps) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span class="case-execution-page__detail-label">预期结果</span>
                    <div class="case-execution-page__rich-text">{{ displayText(detail.expectedResult) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span class="case-execution-page__detail-label">实际结果</span>
                    <el-input
                      v-model="actualResult"
                      type="textarea"
                      :rows="8"
                      resize="vertical"
                      placeholder="请输入实际结果"
                    />
                  </section>
                </div>
                <section class="case-execution-page__evidence">
                  <strong class="case-execution-page__detail-label">附件 / 截图</strong>
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
                <section class="case-execution-page__note">
                  <span class="case-execution-page__detail-label">备注</span>
                  <el-input
                    v-model="executionNote"
                    type="textarea"
                    :rows="4"
                    resize="none"
                    placeholder="请输入备注"
                  />
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`缺陷列表（${relatedDefects.length}）`" name="bugs">
              <section class="case-execution-page__bugs" v-loading="defectsLoading">
                <div class="case-execution-page__bug-actions">
                  <AppButton @click="openDefectAssociateDrawer">关联缺陷</AppButton>
                  <AppButton type="primary" @click="openCreateDefectDrawer">新建缺陷</AppButton>
                </div>
                <div v-if="defectsErrorMessage" class="case-execution-page__inline-error">
                  {{ defectsErrorMessage }}
                  <AppButton size="small" @click="loadRelatedDefects(detail)">重试</AppButton>
                </div>
                <div v-if="relatedDefects.length" class="case-execution-page__bug-table">
                  <div class="case-execution-page__bug-header">
                    <span>缺陷编号</span>
                    <span>标题</span>
                    <span>优先级</span>
                    <span>严重级别</span>
                    <span>状态</span>
                    <span>处理人</span>
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
                    <span><DefectPriorityBadge :priority="item.priority" /></span>
                    <span><DefectSeverityBadge :severity="item.severity" /></span>
                    <span><DefectStatusBadge :status="item.status" /></span>
                    <span>{{ item.assigneeName || '-' }}</span>
                    <span>{{ formatDefectDateTime(item.updatedAt) }}</span>
                    <span class="case-execution-page__bug-row-actions">
                      <el-button text type="primary" @click="openDefectDetail(item)">查看</el-button>
                      <el-button text type="danger" @click="unlinkDefect(item)">取消关联</el-button>
                    </span>
                  </div>
                </div>
                <AppEmptyState
                  v-else-if="!defectsLoading && !defectsErrorMessage"
                  title="暂无关联缺陷"
                  description="可通过关联缺陷或新建缺陷补充本次执行发现的问题。"
                />
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
                      <CaseExecutionStatusBadge :status="item.status" />
                      <span>{{ item.executedAt }}</span>
                    </div>
                    <p>执行人：{{ item.executorName }}</p>
                    <p>实际结果：{{ item.executionComment }}</p>
                    <p>备注：{{ item.executionNote }}</p>
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
                <AppEmptyState
                  v-else
                  title="暂无执行历史"
                  description="当前用例还没有真实执行记录。"
                />
              </section>
            </el-tab-pane>
          </el-tabs>
        </section>

        <footer v-if="activeTab === 'detail'" class="case-execution-page__footer">
          <div class="case-execution-page__footer-nav">
            <AppButton :disabled="!canMovePrevious" @click="moveCase(-1)">
              <el-icon><ArrowLeft /></el-icon>
              上一条
            </AppButton>
            <span>{{ activeCaseDisplayIndex }}/{{ visibleExecutionCases.length || 0 }}</span>
            <AppButton :disabled="!canMoveNext" @click="moveCase(1)">
              下一条
              <el-icon><ArrowRight /></el-icon>
            </AppButton>
            <label class="case-execution-page__auto-next">
              <span>自动下一条</span>
              <el-switch v-model="autoNext" />
            </label>
          </div>
          <div class="case-execution-page__footer-actions">
            <AppButton @click="handleAddDefect">添加缺陷</AppButton>
            <AppButton
              type="danger"
              plain
              :loading="submittingStatus === 'FAILED'"
              @click="submitExecution('FAILED')"
            >
              失败
            </AppButton>
            <AppButton
              type="warning"
              plain
              :loading="submittingStatus === 'BLOCKED'"
              @click="submitExecution('BLOCKED')"
            >
              阻塞
            </AppButton>
            <AppButton
              type="success"
              :loading="submittingStatus === 'PASSED'"
              @click="submitExecution('PASSED')"
            >
              通过
            </AppButton>
          </div>
        </footer>
      </template>
    </main>
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
  display: grid;
  height: calc(100dvh - 64px - var(--app-space-6) * 2);
  min-height: 0;
  grid-template-columns: 284px minmax(0, 1fr);
  gap: var(--app-space-4);
  overflow: hidden;
}

.case-execution-page__sidebar,
.case-execution-page__main {
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.case-execution-page__sidebar {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.case-execution-page__sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: 18px 18px 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.case-execution-page__source {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
}

.case-execution-page__meta-item span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-execution-page__source strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.case-execution-page__sidebar-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 0;
}

.case-execution-page__sidebar-search {
  min-width: 0;
}

.case-execution-page__sidebar-search :deep(.el-input__wrapper) {
  height: 34px;
  min-height: 34px;
  padding-top: 0;
  padding-bottom: 0;
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.case-execution-page__sidebar-search :deep(.el-input__inner) {
  height: 32px;
  line-height: 32px;
}

.case-execution-page__sidebar-search :deep(.el-input__wrapper:hover),
.case-execution-page__sidebar-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #bfdbfe inset;
}

.case-execution-page__filter-button {
  width: 34px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  border-color: var(--app-border);
  border-radius: var(--app-radius-md);
  color: var(--app-text-subtle);
}

.case-execution-page__filter-button:hover,
.case-execution-page__filter-button.is-active {
  border-color: #93c5fd;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

:global(.case-execution-page__status-menu .el-dropdown-menu__item.is-active) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-execution-page__queue {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-2);
  overflow: auto;
  padding: var(--app-space-3);
}

.case-execution-page__queue-item {
  position: relative;
  width: 100%;
  min-height: 94px;
  max-height: 94px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: transparent;
  cursor: pointer;
  padding: var(--app-space-3);
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.case-execution-page__queue-item::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: -1px;
  width: 3px;
  border-radius: 999px;
  background: transparent;
}

.case-execution-page__queue-item:hover {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
}

.case-execution-page__queue-item.is-active {
  border-color: #93c5fd;
  background: var(--app-primary-soft);
  box-shadow: inset 3px 0 0 var(--app-primary), 0 1px 2px rgba(15, 23, 42, 0.04);
  transform: translateY(-1px);
}

.case-execution-page__queue-item.is-active::before {
  background: var(--app-primary);
}

.case-execution-page__queue-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.case-execution-page__queue-top > span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.case-execution-page__queue-status {
  border-radius: var(--app-radius-md);
}

.case-execution-page__queue-status.case-badge--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.case-execution-page__queue-status.case-badge--default {
  border-color: var(--app-border);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
}

.case-execution-page__queue-status.case-badge--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.case-execution-page__queue-status.case-badge--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.case-execution-page__queue-item p {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.case-execution-page__sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.case-execution-page__main {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.case-execution-page__backbar {
  padding: var(--app-space-3) var(--app-space-4) 0;
}

.case-execution-page__back-button {
  min-height: 32px;
  padding: 0 12px;
  border-color: var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.case-execution-page__back-button:hover,
.case-execution-page__back-button:focus-visible {
  border-color: #93c5fd;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  outline: none;
}

.case-execution-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-3) var(--app-space-5) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-execution-page__title-block {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
}

.case-execution-page__title-block h1 {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
  overflow: hidden;
  margin: 0;
}

.case-execution-page__title-code {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 15px;
  font-weight: 500;
  line-height: 24px;
}

.case-execution-page__title-text {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  font-weight: 600;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0 var(--app-space-5) var(--app-space-5);
}

.case-execution-page__tabs :deep(.el-tabs__header) {
  margin-bottom: var(--app-space-4);
}

.case-execution-page__meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-execution-page__meta-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.case-execution-page__meta-item strong {
  min-height: 24px;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.case-execution-page__detail-stack {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-execution-page__detail-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-execution-page__detail-column,
.case-execution-page__bugs,
.case-execution-page__history {
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.case-execution-page__detail-column,
.case-execution-page__note,
.case-execution-page__evidence {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-execution-page__detail-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
}

.case-execution-page__rich-text {
  min-height: 216px;
  overflow: auto;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.case-execution-page__detail-column :deep(.el-textarea__inner) {
  min-height: 216px !important;
}

.case-execution-page__note :deep(.el-textarea__inner) {
  min-height: 64px !important;
  padding: 14px 16px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-execution-page__note :deep(.el-textarea__inner:hover) {
  border-color: #bfdbfe;
}

.case-execution-page__note :deep(.el-textarea__inner:focus) {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.case-execution-page__bugs,
.case-execution-page__history {
  min-height: 280px;
  padding: var(--app-space-4);
}

.case-execution-page__bug-table {
  overflow: auto;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-execution-page__bug-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-3);
}

.case-execution-page__bug-actions :deep(.app-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--app-radius-sm);
}

.case-execution-page__bug-header,
.case-execution-page__bug-row {
  display: grid;
  min-width: 1120px;
  grid-template-columns: 148px minmax(260px, 1fr) 92px 108px 120px 120px 148px 128px;
  align-items: center;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
}

.case-execution-page__bug-header {
  min-height: 44px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.case-execution-page__bug-row {
  min-height: 52px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}

.case-execution-page__bug-row:last-child {
  border-bottom: 0;
}

.case-execution-page__bug-code {
  color: var(--app-primary);
}

.case-execution-page__bug-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__bug-row-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
}

.case-execution-page__bug-row-actions :deep(.el-button) {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.case-execution-page__history-list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-execution-page__history-item {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-execution-page__history-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.case-execution-page__history-item p {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
}

.case-execution-page__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  margin-top: auto;
  min-height: 72px;
  padding: var(--app-space-3) var(--app-space-5);
  border-top: 1px solid var(--app-border);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.04);
}

.case-execution-page__footer-nav,
.case-execution-page__footer-actions,
.case-execution-page__auto-next {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.case-execution-page__footer-nav > span {
  min-width: 48px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-align: center;
}

.case-execution-page__auto-next {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.case-execution-page__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-3) var(--app-space-5);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 1180px) {
  .case-execution-page {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .case-execution-page__detail-row,
  .case-execution-page__meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .case-execution-page {
    grid-template-columns: 1fr;
  }

  .case-execution-page__sidebar {
    min-height: 320px;
  }

  .case-execution-page__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
