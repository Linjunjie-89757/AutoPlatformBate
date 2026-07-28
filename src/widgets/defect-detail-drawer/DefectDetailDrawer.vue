<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  getDefectStatusMeta,
  type DefectAttachment,
  type DefectComment,
  type DefectDetail,
} from '@/entities/defect'
import DefectCaseAssociateDialog from '@/features/defect-case-associate/DefectCaseAssociateDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { AttachmentFileWall, confirmDelete, type AttachmentFileWallItem } from '@/shared/ui'

type DefectActivityRecord = Record<string, unknown>
type DetailTab = 'basic' | 'detail' | 'case' | 'comment' | 'history'
type DefectCaseRow = {
  id: number
  caseNo?: string | null
  title?: string | null
  workspaceName?: string | null
  workspaceCode?: string | null
  caseType?: string | null
}
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defectId?: number | null
    workspaceCode?: string
    currentIndex?: number | null
    totalCount?: number
    refreshKey?: number
  }>(),
  {
    defectId: null,
    workspaceCode: 'ALL',
    currentIndex: null,
    totalCount: 0,
    refreshKey: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: []
  transition: []
  delete: []
  'navigate-prev': []
  'navigate-next': []
}>()

const router = useRouter()
const detail = ref<DefectDetail | null>(null)
const comments = ref<DefectComment[]>([])
const loading = ref(false)
const errorMessage = ref('')
const commentsLoading = ref(false)
const commentsErrorMessage = ref('')
const commentDraft = ref('')
const commentSubmitting = ref(false)
const commentSubmitError = ref('')
const attachmentDownloadingId = ref<number | null>(null)
const attachmentRemovingId = ref<number | null>(null)
const attachmentUploading = ref(false)
const attachmentErrorMessage = ref('')
const attachmentImageUrls = ref<Record<number, string>>({})
const activeTab = ref<DetailTab>('detail')
const caseKeyword = ref('')
const caseAssociateVisible = ref(false)
const caseAssociating = ref(false)
const caseErrorMessage = ref('')
let detailRequestSeq = 0
let commentsRequestSeq = 0
let attachmentImageRequestSeq = 0

const detailTabs = computed(() => [
  { key: 'detail' as const, label: '缺陷详情' },
  { key: 'history' as const, label: `流转记录（${activityCount.value}）` },
  { key: 'comment' as const, label: `评论（${comments.value.length}）` },
])

const activityCount = computed(() => {
  if (!Array.isArray(detail.value?.activities)) {
    return 0
  }

  return detail.value.activities.length
})

const attachmentWallItems = computed<AttachmentFileWallItem[]>(() => getAttachments(detail.value).map(attachment => ({
  id: attachment.id,
  fileName: attachment.fileName,
  fileSize: attachment.fileSize,
  uploadedByName: attachment.uploadedByName,
  createdAt: attachment.createdAt,
  contentType: attachment.contentType,
  imageUrl: isImageAttachment(attachment) ? getAttachmentImageUrl(attachment) : undefined,
})))
const caseRows = computed(() => {
  const keyword = caseKeyword.value.trim().toLowerCase()
  const rows = getCaseRows(detail.value)
  if (!keyword) {
    return rows
  }

  return rows.filter((caseItem) => {
    const haystack = [
      caseItem.caseNo,
      caseItem.title,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

function closeDrawer() {
  emit('update:modelValue', false)
}

function emitIfDetail(event: 'edit' | 'transition' | 'delete') {
  if (!detail.value) {
    return
  }

  if (event === 'edit') {
    emit('edit')
    return
  }
  if (event === 'transition') {
    emit('transition')
    return
  }
  emit('delete')
}

function getCaseRowKey(caseItem: DefectCaseRow, index: number) {
  return String(caseItem.id ?? caseItem.caseNo ?? `case-${index}`)
}

function openCase(caseItem: DefectCaseRow) {
  if (!caseItem.id) {
    ElMessage.info('当前关联用例缺少详情 ID，暂不能打开。')
    return
  }

  const workspaceCode = caseItem.workspaceCode || detail.value?.workspaceCode || props.workspaceCode
  void router.push({
    name: 'cases-manage',
    query: {
      workspace: workspaceCode,
      caseId: String(caseItem.id),
    },
  })
}

function openCaseAssociateDialog() {
  if (!detail.value?.workspaceCode || detail.value.workspaceCode === 'ALL') {
    ElMessage.warning('当前缺陷缺少具体工作空间，暂不能关联用例。')
    return
  }

  caseAssociateVisible.value = true
}

async function associateCase(caseIds: number[]) {
  if (!detail.value) {
    return
  }

  caseAssociating.value = true
  caseErrorMessage.value = ''
  try {
    detail.value = await defectApi.replaceDefectCases(detail.value.workspaceCode, detail.value.id, {
      caseIds,
    })
    caseAssociateVisible.value = false
    ElMessage.success('关联用例已更新')
    void loadDetail()
  } catch (error) {
    caseErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseAssociating.value = false
  }
}

async function unlinkCase(caseItem: DefectCaseRow) {
  if (!detail.value) {
    return
  }

  try {
    await ElMessageBox.confirm('确认取消关联当前用例吗？', '取消关联用例', {
      type: 'warning',
      confirmButtonText: '取消关联',
      cancelButtonText: '保留',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  caseAssociating.value = true
  caseErrorMessage.value = ''
  try {
    detail.value = await defectApi.deleteDefectCase(detail.value.workspaceCode, detail.value.id, caseItem.id)
    ElMessage.success('已取消关联用例')
    void loadDetail()
  } catch (error) {
    caseErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseAssociating.value = false
  }
}

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function displayRichText(value: string | null | undefined) {
  const text = displayText(value)
  if (text === '-' || !/[<>]/.test(text)) {
    return text
  }

  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')

  if (typeof DOMParser === 'undefined') {
    return normalized.replace(/<[^>]+>/g, '').trim() || '-'
  }

  const doc = new DOMParser().parseFromString(normalized, 'text/html')
  return doc.body.textContent?.trim() || '-'
}

function getAttachments(value: DefectDetail | null): DefectAttachment[] {
  return Array.isArray(value?.attachments) ? value.attachments : []
}

function getActivities(value: DefectDetail | null): DefectActivityRecord[] {
  return Array.isArray(value?.activities) ? (value.activities as DefectActivityRecord[]) : []
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function getCaseRows(value: DefectDetail | null): DefectCaseRow[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value.relatedCases) && value.relatedCases.length) {
    return value.relatedCases.map(item => ({
      id: item.id,
      caseNo: item.caseNo,
      title: item.title,
      workspaceName: item.workspaceName,
      workspaceCode: item.workspaceCode,
      caseType: '功能用例',
    }))
  }

  const context = readRecord(value.sourceContext)
  const caseSummary = readRecord(context?.caseSummary)
  if (caseSummary) {
    const caseId = typeof caseSummary.id === 'number' ? caseSummary.id : value.relatedCaseId
    if (!caseId) {
      return []
    }
    return [{
      id: caseId,
      caseNo: typeof caseSummary.caseNo === 'string' ? caseSummary.caseNo : null,
      title: typeof caseSummary.title === 'string' ? caseSummary.title : null,
      workspaceName: typeof caseSummary.workspaceName === 'string' ? caseSummary.workspaceName : value.workspaceName,
      workspaceCode: value.workspaceCode,
      caseType: typeof caseSummary.caseType === 'string' ? caseSummary.caseType : null,
    }]
  }

  if (value.relatedCaseId) {
    return [{
      id: value.relatedCaseId,
      caseNo: `#${value.relatedCaseId}`,
      title: null,
      workspaceName: value.workspaceName,
      workspaceCode: value.workspaceCode,
      caseType: null,
    }]
  }

  return []
}

function readSourceContextText(value: DefectDetail | null, keys: string[]) {
  const context = readRecord(value?.sourceContext)
  if (!context) {
    return ''
  }

  for (const key of keys) {
    const field = context[key]
    if (typeof field === 'string' && field.trim()) {
      return field.trim()
    }
    if (typeof field === 'number') {
      return String(field)
    }
  }

  return ''
}

function getRelatedCaseLabel(value: DefectDetail | null) {
  const rows = getCaseRows(value)
  const firstCase = rows[0]
  if (!firstCase) {
    return '-'
  }

  return firstCase.caseNo || firstCase.title || `#${firstCase.id}`
}

function getReproduceSteps(value: DefectDetail | null) {
  const raw = readSourceContextText(value, ['reproduceSteps', 'steps', 'stepText', 'reproductionSteps'])
  if (!raw) {
    return []
  }

  return raw
    .split(/\n+/)
    .map(item => item.replace(/^\s*\d+[.)、]\s*/, '').trim())
    .filter(Boolean)
}

function getExpectedResult(value: DefectDetail | null) {
  return readSourceContextText(value, ['expectedResult', 'expected', 'expectation'])
}

function getActualResult(value: DefectDetail | null) {
  return readSourceContextText(value, ['actualResult', 'actual', 'actualBehavior'])
}

function isImageAttachment(attachment: DefectAttachment) {
  if (attachment.contentType?.startsWith('image/')) {
    return true
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.fileName || '')
}

function revokeAttachmentImageUrls() {
  Object.values(attachmentImageUrls.value).forEach((url) => {
    window.URL.revokeObjectURL(url)
  })
  attachmentImageUrls.value = {}
}

async function loadAttachmentImageUrls(value: DefectDetail | null) {
  const requestSeq = ++attachmentImageRequestSeq
  revokeAttachmentImageUrls()
  if (!value || !props.defectId) {
    return
  }

  const nextUrls: Record<number, string> = {}
  for (const attachment of getAttachments(value).filter(isImageAttachment)) {
    try {
      const blob = await defectApi.downloadDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
      if (requestSeq !== attachmentImageRequestSeq) {
        return
      }
      nextUrls[attachment.id] = window.URL.createObjectURL(blob)
    } catch {
      // Keep broken thumbnails local to the image card; download still remains available.
    }
  }

  if (requestSeq === attachmentImageRequestSeq) {
    attachmentImageUrls.value = nextUrls
  } else {
    Object.values(nextUrls).forEach(url => window.URL.revokeObjectURL(url))
  }
}

function getAttachmentImageUrl(attachment: DefectAttachment) {
  return attachmentImageUrls.value[attachment.id] || ''
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function readActivityString(activity: DefectActivityRecord, keys: string[]) {
  for (const key of keys) {
    const value = activity[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }

  return ''
}

function getActivityKey(activity: DefectActivityRecord, index: number) {
  return readActivityString(activity, ['id', 'activityId', 'createdAt', 'occurredAt']) || `activity-${index}`
}

function getActivityTime(activity: DefectActivityRecord) {
  return formatDefectDateTime(readActivityString(activity, ['occurredAt', 'createdAt', 'updatedAt']))
}

function getActivityActor(activity: DefectActivityRecord) {
  return readActivityString(activity, ['operatorName', 'actorName', 'createdByName', 'userName']) || '系统记录'
}

function getActivityFromStatus(activity: DefectActivityRecord) {
  return readActivityString(activity, ['fromStatus', 'fromStatusCode', 'from'])
}

function getActivityToStatus(activity: DefectActivityRecord) {
  return readActivityString(activity, ['toStatus', 'toStatusCode', 'to', 'status'])
}

function getActivityStatusLabel(status: string) {
  return status ? getDefectStatusMeta(status).label : ''
}

function getActivityStatusTone(status: string) {
  return status ? getDefectStatusMeta(status).tone : 'neutral'
}

function getActivityTone(activity: DefectActivityRecord, index: number) {
  const toStatus = getActivityToStatus(activity)
  if (toStatus) {
    return getActivityStatusTone(toStatus)
  }
  return index === 0 ? 'new' : 'neutral'
}

function getActivityMarker(activity: DefectActivityRecord, index: number) {
  if (index === 0 && !getActivityFromStatus(activity)) {
    return '🐞'
  }
  return '→'
}

function getActivityActionText(activity: DefectActivityRecord, index: number) {
  if (getActivityFromStatus(activity) && getActivityToStatus(activity)) {
    return '将状态从'
  }

  const action = readActivityString(activity, ['title', 'type', 'action'])
  if (action && !/create|created|new|新增|创建/i.test(action)) {
    return action
  }

  return index === 0 ? '创建了缺陷' : '更新了缺陷'
}

function getActivityDescription(activity: DefectActivityRecord) {
  const detailText = readActivityString(activity, ['detail', 'content', 'comment', 'description', 'message'])
  const attachmentName = readActivityString(activity, ['attachmentName', 'fileName'])
  return [detailText, attachmentName].filter(Boolean).join(' / ') || '-'
}

function getAvatarText(value: string | null | undefined) {
  const text = displayText(value)
  return text === '-' ? '?' : text.trim().slice(0, 1).toUpperCase()
}

async function loadDetail() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    const nextDetail = await defectApi.getDefectDetail(props.workspaceCode, props.defectId)
    if (requestSeq === detailRequestSeq) {
      detail.value = nextDetail
      comments.value = Array.isArray(nextDetail.comments) ? nextDetail.comments : comments.value
      void loadAttachmentImageUrls(nextDetail)
    }
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

async function loadComments() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++commentsRequestSeq
  commentsLoading.value = true
  commentsErrorMessage.value = ''
  try {
    const nextComments = await defectApi.getDefectComments(props.workspaceCode, props.defectId)
    if (requestSeq === commentsRequestSeq) {
      comments.value = nextComments
    }
  } catch (error) {
    if (requestSeq === commentsRequestSeq) {
      commentsErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === commentsRequestSeq) {
      commentsLoading.value = false
    }
  }
}

async function submitComment() {
  if (!props.defectId || commentSubmitting.value) {
    return
  }

  const content = commentDraft.value.trim()
  if (!content) {
    commentSubmitError.value = '请输入评论内容。'
    return
  }

  commentSubmitting.value = true
  commentSubmitError.value = ''
  try {
    const nextComment = await defectApi.addDefectComment(props.workspaceCode, props.defectId, { content })
    comments.value = [...comments.value, nextComment]
    commentDraft.value = ''
    void loadDetail()
  } catch (error) {
    commentSubmitError.value = getRequestErrorMessage(error)
  } finally {
    commentSubmitting.value = false
  }
}

async function downloadAttachment(attachment: DefectAttachment) {
  if (!props.defectId || attachmentDownloadingId.value) {
    return
  }

  attachmentDownloadingId.value = attachment.id
  attachmentErrorMessage.value = ''
  try {
    const blob = await defectApi.downloadDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
    triggerBlobDownload(blob, attachment.fileName)
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentDownloadingId.value = null
  }
}

async function uploadAttachments(files: File[]) {
  if (!props.defectId || attachmentUploading.value) {
    return
  }

  if (!files.length) {
    return
  }

  attachmentUploading.value = true
  attachmentErrorMessage.value = ''
  try {
    const nextAttachments = await defectApi.uploadDefectAttachments(props.workspaceCode, props.defectId, files)
    if (detail.value) {
      detail.value = {
        ...detail.value,
        attachments: [...getAttachments(detail.value), ...nextAttachments],
      }
    }
    ElMessage.success('附件已上传。')
    void loadDetail()
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentUploading.value = false
  }
}

async function removeAttachment(attachment: DefectAttachment) {
  if (!props.defectId || attachmentRemovingId.value || !detail.value) {
    return
  }

  await confirmDelete({
    title: '删除附件',
    message: `确认删除附件“${attachment.fileName}”吗？删除后不可恢复。`,
    confirmText: '确认删除',
  })

  attachmentRemovingId.value = attachment.id
  attachmentErrorMessage.value = ''
  try {
    await defectApi.deleteDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
    detail.value = {
      ...detail.value,
      attachments: getAttachments(detail.value).filter(item => item.id !== attachment.id),
    }
    ElMessage.success('附件已删除。')
    void loadDetail()
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentRemovingId.value = null
  }
}

function handleAttachmentPanelDownload(item: AttachmentFileWallItem) {
  const attachment = getAttachments(detail.value).find(entry => entry.id === item.id)
  if (attachment) {
    void downloadAttachment(attachment)
  }
}

function handleAttachmentPanelRemove(item: AttachmentFileWallItem) {
  const attachment = getAttachments(detail.value).find(entry => entry.id === item.id)
  if (attachment) {
    void removeAttachment(attachment)
  }
}

watch(
  () => [props.modelValue, props.defectId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      activeTab.value = 'detail'
      commentDraft.value = ''
      commentSubmitError.value = ''
      attachmentErrorMessage.value = ''
      attachmentUploading.value = false
      attachmentRemovingId.value = null
      void loadDetail()
      void loadComments()
    } else {
      attachmentImageRequestSeq += 1
      revokeAttachmentImageUrls()
    }
  },
  { immediate: true },
)

watch(
  () => props.refreshKey,
  () => {
    if (!props.modelValue || !props.defectId) {
      return
    }

    void loadDetail()
    void loadComments()
  },
)

onBeforeUnmount(() => {
  attachmentImageRequestSeq += 1
  revokeAttachmentImageUrls()
})
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :with-header="false"
    size="720px"
    drawer-class="defect-detail-drawer-host"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-detail-drawer">
      <div class="defect-detail-drawer__accent" aria-hidden="true" />
      <header class="defect-detail-drawer__topbar">
        <div class="defect-detail-drawer__title-wrap">
          <div class="defect-detail-drawer__badge-line">
            <span class="defect-detail-drawer__code">{{ displayText(detail?.bugNo) }}</span>
            <DefectSeverityBadge v-if="detail" :severity="detail.severity" />
            <DefectStatusBadge v-if="detail" :status="detail.status" />
            <DefectPriorityBadge v-if="detail" :priority="detail.priority" />
            <span
              v-for="tag in (detail?.tags ?? []).slice(0, 2)"
              :key="tag"
              class="defect-detail-drawer__tag"
            >
              {{ tag }}
            </span>
          </div>
          <strong class="defect-detail-drawer__title">{{ displayText(detail?.title || '缺陷详情') }}</strong>
          <p class="defect-detail-drawer__subtitle">
            <span>{{ displayText(detail?.workspaceName || detail?.workspaceCode) }}</span>
            <span>创建人：{{ displayText(detail?.reporterName) }}</span>
            <span>{{ formatDefectDateTime(detail?.createdAt) }}</span>
            <span>负责人：<strong>{{ displayText(detail?.assigneeName) }}</strong></span>
          </p>
        </div>

        <div class="defect-detail-drawer__actions">
          <button v-if="detail" type="button" class="defect-detail-drawer__edit-button" @click="emitIfDetail('edit')">
            <img :src="figmaDefectIcons.drawerEdit" alt="" />
            <span>编辑</span>
          </button>
          <button type="button" class="defect-detail-drawer__close-button" aria-label="关闭" @click="closeDrawer">
            ×
          </button>
        </div>
      </header>

      <div v-if="detail" class="defect-detail-drawer__flowbar">
        <span>流转至：</span>
        <button type="button" class="is-verify" @click="emitIfDetail('transition')">提交验证</button>
        <button type="button" class="is-close" @click="emitIfDetail('transition')">直接关闭</button>
      </div>

      <nav v-if="detail" class="defect-detail-drawer__tabs" aria-label="缺陷详情分区">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          type="button"
          class="defect-detail-drawer__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="defect-detail-drawer__content">
        <AppLoadingState v-if="loading && !detail" text="正在加载缺陷详情..." />

        <AppEmptyState v-else-if="errorMessage && !detail" title="缺陷详情加载失败" :description="errorMessage">
          <template #actions>
            <AppButton @click="loadDetail">重试</AppButton>
          </template>
        </AppEmptyState>

        <template v-else-if="detail">
          <div v-if="errorMessage" class="defect-detail-drawer__inline-error">
            {{ errorMessage }}
            <AppButton size="small" @click="loadDetail">重试</AppButton>
          </div>

          <section v-show="activeTab === 'basic'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section defect-detail-drawer__section--hero">
              <div class="defect-detail-drawer__section-header">
                <h4>基础信息</h4>
                <span>缺陷流转中的核心字段</span>
              </div>
              <dl class="defect-detail-drawer__meta">
                <div class="defect-detail-drawer__meta-row">
                  <dt>所属空间</dt>
                  <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>处理人</dt>
                  <dd>{{ displayText(detail.assigneeName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>报告人</dt>
                  <dd>{{ displayText(detail.reporterName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>关联用例</dt>
                  <dd>{{ detail.relatedCaseCount ? `${detail.relatedCaseCount} 条` : '-' }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>创建时间</dt>
                  <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>更新时间</dt>
                  <dd>{{ formatDefectDateTime(detail.updatedAt) }}</dd>
                </div>
              </dl>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>状态</h4>
                <span>当前处理状态、优先级和严重级别</span>
              </div>
              <div class="defect-detail-drawer__badges">
                <DefectStatusBadge :status="detail.status" />
                <DefectPriorityBadge :priority="detail.priority" />
                <DefectSeverityBadge :severity="detail.severity" />
              </div>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>标签</h4>
                <span>用于快速归类和筛选</span>
              </div>
              <div class="defect-detail-drawer__content-card defect-detail-drawer__content-card--soft">
                <p class="defect-detail-drawer__text is-compact">{{ formatDefectTags(detail.tags) }}</p>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'detail'" class="defect-detail-drawer__pane">
            <dl class="defect-detail-drawer__figma-meta">
              <div>
                <dt>所属模块</dt>
                <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>{{ displayText(detail.assigneeName) }}</dd>
              </div>
              <div>
                <dt>创建人</dt>
                <dd>{{ displayText(detail.reporterName) }}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
              </div>
              <div>
                <dt>最后更新</dt>
                <dd>{{ formatDefectDateTime(detail.updatedAt) }}</dd>
              </div>
              <div>
                <dt>关联用例</dt>
                <dd>{{ getRelatedCaseLabel(detail) }}</dd>
              </div>
            </dl>

            <section class="defect-detail-drawer__figma-section">
              <h4>问题描述</h4>
              <div class="defect-detail-drawer__description-box">
                {{ displayRichText(detail.description) }}
              </div>
            </section>

            <section class="defect-detail-drawer__figma-section">
              <h4>复现步骤</h4>
              <div v-if="getReproduceSteps(detail).length" class="defect-detail-drawer__step-list">
                <div v-for="(step, index) in getReproduceSteps(detail)" :key="`${index}-${step}`">
                  <span>{{ index + 1 }}</span>
                  <p>{{ step }}</p>
                </div>
              </div>
              <div v-else class="defect-detail-drawer__step-list is-empty">
                <div>
                  <span>1</span>
                  <p>-</p>
                </div>
              </div>
            </section>

            <section class="defect-detail-drawer__result-grid">
              <div>
                <h4>预期结果</h4>
                <p class="is-expected">{{ displayText(getExpectedResult(detail)) }}</p>
              </div>
              <div>
                <h4>实际结果</h4>
                <p class="is-actual">{{ displayText(getActualResult(detail)) }}</p>
              </div>
            </section>

            <section class="defect-detail-drawer__figma-section">
              <div class="defect-detail-drawer__attachment-heading">
                <h4>附件 / 截图</h4>
              </div>
              <AttachmentFileWall
                :items="attachmentWallItems"
                :uploading="attachmentUploading"
                :downloading-id="attachmentDownloadingId"
                :removing-id="attachmentRemovingId"
                empty-title="点击上传，或将文件拖拽至此处"
                empty-description="支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB"
                @add-files="uploadAttachments"
                @download="handleAttachmentPanelDownload"
                @remove="handleAttachmentPanelRemove"
              />
              <p v-if="attachmentErrorMessage" class="defect-detail-drawer__form-error">
                {{ attachmentErrorMessage }}
              </p>
            </section>
          </section>

          <section v-show="activeTab === 'case'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__case-toolbar">
                <el-button type="primary" plain :loading="caseAssociating" @click="openCaseAssociateDialog">
                  关联用例
                </el-button>
                <el-input
                  v-model="caseKeyword"
                  clearable
                  class="defect-detail-drawer__case-search"
                  placeholder="按用例编号或名称搜索"
                />
              </div>

              <el-table
                v-if="caseRows.length"
                :data="caseRows"
                :row-key="(row: DefectCaseRow, index: number) => getCaseRowKey(row, index)"
                class="defect-detail-drawer__case-table"
              >
                <el-table-column prop="caseNo" label="用例编号" min-width="150">
                  <template #default="{ row }">
                    <el-button text type="primary" class="defect-detail-drawer__case-link" @click="openCase(row)">
                      {{ displayText(row.caseNo || row.id) }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="title" label="用例名称" min-width="260" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="defect-detail-drawer__case-title">{{ displayText(row.title) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="workspaceName" label="所属项目" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ displayText(row.workspaceName) }}
                  </template>
                </el-table-column>
                <el-table-column prop="caseType" label="用例类型" width="120">
                  <template #default="{ row }">
                    {{ displayText(row.caseType || '功能用例') }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" fixed="right">
                  <template #default="{ row }">
                    <el-button text type="danger" class="defect-detail-drawer__case-action" :loading="caseAssociating" @click="unlinkCase(row)">
                      取消关联
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>

              <el-empty v-else description="暂无关联用例" :image-size="72" />
              <p v-if="caseErrorMessage" class="defect-detail-drawer__form-error">
                {{ caseErrorMessage }}
              </p>
            </div>
          </section>

          <section v-show="activeTab === 'comment'" class="defect-detail-drawer__comment-pane">
            <div class="defect-detail-drawer__comment-scroll">
              <AppLoadingState v-if="commentsLoading && !comments.length" text="正在加载评论..." />

              <div v-else-if="commentsErrorMessage && !comments.length" class="defect-detail-drawer__inline-error">
                <span>{{ commentsErrorMessage }}</span>
                <AppButton size="small" @click="loadComments">重试</AppButton>
              </div>

              <div v-else-if="comments.length" class="defect-detail-drawer__comment-list">
                <div v-for="comment in comments" :key="comment.id" class="defect-detail-drawer__comment-item">
                  <div class="defect-detail-drawer__comment-avatar">
                    {{ getAvatarText(comment.commenterName) }}
                  </div>
                  <div class="defect-detail-drawer__comment-main">
                    <div class="defect-detail-drawer__comment-top">
                      <strong>{{ displayText(comment.commenterName) }}</strong>
                      <span>{{ formatDefectDateTime(comment.createdAt) }}</span>
                    </div>
                    <div class="defect-detail-drawer__comment-bubble">
                      <p>{{ displayText(comment.content) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <AppEmptyState
                v-else
                title="暂无评论"
                description="还没有人在这条缺陷下留言，可以补充处理说明、现象说明或验证结果。"
              />
            </div>

            <div class="defect-detail-drawer__comment-composer">
              <el-input
                v-model="commentDraft"
                type="textarea"
                :rows="3"
                maxlength="500"
                placeholder="添加评论，可以 @提及成员..."
                :disabled="commentSubmitting"
              />
              <p v-if="commentSubmitError" class="defect-detail-drawer__form-error">
                {{ commentSubmitError }}
              </p>
              <div class="defect-detail-drawer__comment-actions">
                <button
                  type="button"
                  class="defect-detail-drawer__comment-submit"
                  :disabled="!commentDraft.trim() || commentSubmitting"
                  @click="submitComment"
                >
                  <img :src="figmaDefectIcons.commentSubmit" alt="" />
                  <span>{{ commentSubmitting ? '提交中' : '提交评论' }}</span>
                </button>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'history'" class="defect-detail-drawer__history-pane">
            <div v-if="getActivities(detail).length" class="defect-detail-drawer__timeline">
              <div
                v-for="(activity, index) in getActivities(detail)"
                :key="getActivityKey(activity, index)"
                class="defect-detail-drawer__timeline-item"
              >
                <div class="defect-detail-drawer__timeline-rail">
                  <span
                    class="defect-detail-drawer__timeline-marker"
                    :class="`is-${getActivityTone(activity, index)}`"
                  >
                    {{ getActivityMarker(activity, index) }}
                  </span>
                  <i v-if="index < getActivities(detail).length - 1" />
                </div>
                <div class="defect-detail-drawer__timeline-main">
                  <div class="defect-detail-drawer__timeline-title">
                    <strong>{{ getActivityActor(activity) }}</strong>
                    <span>{{ getActivityActionText(activity, index) }}</span>
                    <em
                      v-if="getActivityFromStatus(activity)"
                      :class="`is-${getActivityStatusTone(getActivityFromStatus(activity))}`"
                    >
                      {{ getActivityStatusLabel(getActivityFromStatus(activity)) }}
                    </em>
                    <span v-if="getActivityFromStatus(activity) && getActivityToStatus(activity)">改为</span>
                    <em
                      v-if="getActivityToStatus(activity)"
                      :class="`is-${getActivityStatusTone(getActivityToStatus(activity))}`"
                    >
                      {{ getActivityStatusLabel(getActivityToStatus(activity)) }}
                    </em>
                  </div>
                  <p>{{ getActivityDescription(activity) }}</p>
                  <time>{{ getActivityTime(activity) }}</time>
                </div>
              </div>
            </div>
            <AppEmptyState
              v-else
              title="暂无历史"
              description="当前缺陷还没有更多流转或操作记录。"
            />
          </section>
        </template>
      </div>
    </div>
    <DefectCaseAssociateDialog
      v-model="caseAssociateVisible"
      :workspace-code="detail?.workspaceCode || props.workspaceCode"
      :current-case-id="detail?.relatedCaseId ?? null"
      :current-case-ids="getCaseRows(detail).map(item => item.id).filter((id): id is number => typeof id === 'number')"
      :associating="caseAssociating"
      :error-message="caseErrorMessage"
      @associate="associateCase"
    />
  </AppDrawer>
</template>

<style scoped>
.defect-detail-drawer {
  display: flex;
  height: 100%;
  flex-direction: column;
  min-height: 0;
  background: var(--app-bg-panel);
}

:global(.defect-detail-drawer-host .el-drawer__body) {
  min-height: 0;
  padding: 0;
}

:global(.defect-detail-drawer-host .el-overlay) {
  backdrop-filter: blur(10px);
}

:global(.defect-detail-drawer-host .el-drawer) {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.defect-detail-drawer__accent {
  width: 100%;
  height: 3.5px;
  flex: 0 0 auto;
  background: #ff7d00;
}

.defect-detail-drawer__topbar {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10.5px;
  padding: 14px 21px 15px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-detail-drawer__title-wrap {
  min-width: 0;
  flex: 1;
}

.defect-detail-drawer__badge-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.defect-detail-drawer__code {
  flex: 0 0 auto;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.defect-detail-drawer__tag {
  display: inline-flex;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.defect-detail-drawer__title {
  display: block;
  min-width: 0;
  overflow: hidden;
  margin-top: 7px;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-drawer__subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 10.5px;
  margin: 5.25px 0 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-detail-drawer__subtitle strong {
  color: #1d2129;
  font-weight: 500;
}

.defect-detail-drawer__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.defect-detail-drawer__record-nav {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  margin-right: var(--app-space-2);
  padding-right: var(--app-space-3);
  border-right: 1px solid var(--app-border);
}

.defect-detail-drawer__edit-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-detail-drawer__edit-button img {
  display: block;
  width: 13px;
  height: 13px;
}

.defect-detail-drawer__close-button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 18px;
  font-weight: 500;
  line-height: 27px;
}

:global(.defect-detail-drawer__more-menu .el-dropdown-menu__item.is-danger) {
  color: var(--app-danger);
}

:global(.defect-detail-drawer__more-menu .el-dropdown-menu__item.is-danger:hover) {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.defect-detail-drawer__tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0;
  min-height: 35px;
  padding: 0 21px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-detail-drawer__tab {
  position: relative;
  height: 35px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  white-space: nowrap;
  transition: color 160ms ease;
}

.defect-detail-drawer__tab:hover,
.defect-detail-drawer__tab:focus-visible {
  color: var(--app-primary);
  outline: none;
}

.defect-detail-drawer__tab.is-active {
  border-bottom-color: #f53f3f;
  color: #f53f3f;
  font-weight: 500;
}

.defect-detail-drawer__tab.is-active::after {
  content: none;
}

.defect-detail-drawer__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 17.5px 21px;
  background: #ffffff;
}

.defect-detail-drawer__pane {
  display: grid;
  gap: 17.5px;
}

.defect-detail-drawer__flowbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding: 10.5px 21px 11.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-detail-drawer__flowbar span {
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.defect-detail-drawer__flowbar button {
  height: 24.5px;
  padding: 1px 11.5px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-detail-drawer__flowbar .is-verify {
  border: 1px solid rgba(200, 155, 0, 0.25);
  background: rgba(200, 155, 0, 0.05);
  color: #c89b00;
}

.defect-detail-drawer__flowbar .is-close {
  border: 1px solid rgba(0, 180, 42, 0.25);
  background: rgba(0, 180, 42, 0.05);
  color: #00b42a;
}

.defect-detail-drawer__figma-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10.5px 21px;
  margin: 0;
  padding-bottom: 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.defect-detail-drawer__figma-meta div {
  min-width: 0;
}

.defect-detail-drawer__figma-meta dt {
  margin: 0 0 1.75px;
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.defect-detail-drawer__figma-meta dd {
  margin: 0;
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-drawer__figma-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.defect-detail-drawer__figma-section h4,
.defect-detail-drawer__result-grid h4 {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.defect-detail-drawer__description-box {
  min-height: 64px;
  padding: 10.5px 14px;
  border-radius: 11px;
  background: #f7f8fa;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 21.125px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__step-list {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
}

.defect-detail-drawer__step-list div {
  display: flex;
  min-height: 38.25px;
  align-items: flex-start;
  gap: 10.5px;
  padding: 8.75px 14px 9.75px;
  border-bottom: 1px solid #e5e6eb;
}

.defect-detail-drawer__step-list div:last-child {
  border-bottom: 0;
}

.defect-detail-drawer__step-list span {
  display: inline-flex;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(245, 63, 63, 0.08);
  color: #f53f3f;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.defect-detail-drawer__step-list p {
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.defect-detail-drawer__result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.defect-detail-drawer__result-grid > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.defect-detail-drawer__result-grid p {
  min-height: 65.25px;
  margin: 0;
  padding: 11.5px 15px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 21.125px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__result-grid .is-expected {
  border-color: #b7eb8f;
  background: #f6ffed;
}

.defect-detail-drawer__result-grid .is-actual {
  border-color: #ffa39e;
  background: #fff0f0;
}

.defect-detail-drawer__attachment-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.defect-detail-drawer__content-card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__content-card--soft {
  background: var(--app-bg-subtle);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.defect-detail-drawer__badges {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.defect-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: 0;
  border: 0;
  background: transparent;
}

.defect-detail-drawer__section--hero {
  gap: var(--app-space-4);
}

.defect-detail-drawer__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-1);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__section-header h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.defect-detail-drawer__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__meta {
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__meta-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  min-height: 42px;
  min-width: 0;
  align-items: center;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__meta-row:last-child {
  border-bottom: 0;
}

.defect-detail-drawer__meta dt {
  height: 100%;
  margin: 0;
  padding: 11px var(--app-space-4);
  background: var(--app-bg-subtle);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__meta dd {
  margin: 0;
  padding: 11px var(--app-space-4);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text {
  margin: 0;
  padding: var(--app-space-4);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 24px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text.is-compact {
  padding-top: var(--app-space-3);
  padding-bottom: var(--app-space-3);
}

.defect-detail-drawer__attachment-list,
.defect-detail-drawer__comment-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  min-width: 0;
  gap: var(--app-space-3);
  align-items: flex-start;
}

.defect-detail-drawer__comment-item strong {
  min-width: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 1;
}

.defect-detail-drawer__comment-bubble {
  min-width: 0;
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.defect-detail-drawer__comment-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-top span {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__comment-bubble p {
  margin: 0;
  padding-top: var(--app-space-2);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-editor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-actions {
  display: flex;
  justify-content: flex-end;
}

.defect-detail-drawer__comment-pane {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 0;
  margin: -17.5px -21px;
}

.defect-detail-drawer__comment-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 17.5px 21px;
}

.defect-detail-drawer__comment-list {
  gap: 0;
}

.defect-detail-drawer__comment-item {
  display: flex;
  gap: 10.5px;
}

.defect-detail-drawer__comment-item + .defect-detail-drawer__comment-item {
  padding-top: 17.5px;
}

.defect-detail-drawer__comment-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3.5px;
}

.defect-detail-drawer__comment-item strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-detail-drawer__comment-avatar {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  background: #165dff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.defect-detail-drawer__comment-top {
  justify-content: flex-start;
  gap: 7px;
}

.defect-detail-drawer__comment-top span {
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.defect-detail-drawer__comment-bubble {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.defect-detail-drawer__comment-bubble p {
  padding: 10.5px 14px;
  border-radius: 11px;
  background: #f7f8fa;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 21.125px;
}

.defect-detail-drawer__comment-composer {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  padding: 15px 21px 14px;
  border-top: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-detail-drawer__comment-composer :deep(.el-textarea__inner) {
  min-height: 78px;
  padding: 9.75px 11.5px;
  border-radius: 11px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-detail-drawer__comment-composer :deep(.el-textarea__inner::placeholder) {
  color: rgba(29, 33, 41, 0.5);
}

.defect-detail-drawer__comment-actions {
  padding-top: 7px;
}

.defect-detail-drawer__comment-submit {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #165dff;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-detail-drawer__comment-submit img {
  display: block;
  width: 13px;
  height: 13px;
}

.defect-detail-drawer__comment-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.defect-detail-drawer__form-error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-detail-drawer__list-item span,
.defect-detail-drawer__muted {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__attachment-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__attachment-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: -2px;
}

.defect-detail-drawer__case-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.defect-detail-drawer__case-toolbar :deep(.el-button) {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--app-radius-sm);
  font-size: 13px;
  font-weight: 400;
}

.defect-detail-drawer__case-search {
  width: min(280px, 100%);
}

.defect-detail-drawer__case-search :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-sm);
}

.defect-detail-drawer__case-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__case-table :deep(.el-table__header th.el-table__cell) {
  height: 42px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-detail-drawer__case-table :deep(.el-table__row) {
  height: 46px;
}

.defect-detail-drawer__case-table :deep(.el-table__cell) {
  padding: 7px 0;
}

.defect-detail-drawer__case-table :deep(.cell) {
  font-size: 13px;
  line-height: 20px;
}

.defect-detail-drawer__case-table :deep(.el-table__fixed-right::before) {
  box-shadow: -1px 0 0 var(--app-border-soft);
}

.defect-detail-drawer__case-link {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.defect-detail-drawer__case-title {
  color: var(--app-text-primary);
  font-size: 13px;
  line-height: 20px;
}

.defect-detail-drawer__case-action {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.defect-detail-drawer__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-detail-drawer__timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.defect-detail-drawer__timeline-item:not(:last-child)::before {
  position: absolute;
  top: 100%;
  left: 9px;
  width: 1px;
  height: var(--app-space-2);
  background: var(--app-border);
  content: '';
}

.defect-detail-drawer__timeline-dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border: 2px solid var(--app-primary);
  border-radius: 999px;
  background: var(--app-bg-panel);
}

.defect-detail-drawer__timeline-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
}

.defect-detail-drawer__timeline-main strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__timeline-main small,
.defect-detail-drawer__timeline-item time {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__timeline-main small {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.defect-detail-drawer__timeline-item time {
  white-space: nowrap;
}

.defect-detail-drawer__history-pane {
  min-height: 0;
}

.defect-detail-drawer__timeline {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  padding: 0;
}

.defect-detail-drawer__timeline-item {
  display: flex;
  min-width: 0;
  gap: 14px;
  align-items: flex-start;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.defect-detail-drawer__timeline-item::before {
  content: none !important;
}

.defect-detail-drawer__timeline-rail {
  display: flex;
  width: 36px;
  min-height: 79px;
  flex: 0 0 36px;
  flex-direction: column;
  align-items: center;
}

.defect-detail-drawer__timeline-marker {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border: 2px solid #86909c;
  border-radius: 999px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-detail-drawer__timeline-marker.is-new {
  border-color: #165dff;
  background: #e8f3ff;
  color: #165dff;
}

.defect-detail-drawer__timeline-marker.is-assigned {
  border-color: #7816ff;
  background: #f5e8ff;
  color: #7816ff;
}

.defect-detail-drawer__timeline-marker.is-processing {
  border-color: #ff7d00;
  background: #fff3e8;
  color: #ff7d00;
}

.defect-detail-drawer__timeline-marker.is-verify {
  border-color: #c89b00;
  background: #fff7e8;
  color: #c89b00;
}

.defect-detail-drawer__timeline-marker.is-closed {
  border-color: #00b42a;
  background: #e8ffea;
  color: #00b42a;
}

.defect-detail-drawer__timeline-marker.is-hold {
  border-color: #f53f3f;
  background: #ffe8e8;
  color: #f53f3f;
}

.defect-detail-drawer__timeline-rail i {
  display: block;
  width: 1.75px;
  min-height: 44px;
  flex: 1 1 auto;
  margin: 3.5px 0;
  background: #e5e6eb;
}

.defect-detail-drawer__timeline-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0;
  padding-bottom: 17.5px;
}

.defect-detail-drawer__timeline-title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}

.defect-detail-drawer__timeline-title strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-detail-drawer__timeline-title span {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-detail-drawer__timeline-title em {
  display: inline-flex;
  align-items: center;
  padding: 1.75px 7px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
}

.defect-detail-drawer__timeline-title em.is-new {
  background: #e8f3ff;
  color: #165dff;
}

.defect-detail-drawer__timeline-title em.is-assigned {
  background: #f5e8ff;
  color: #7816ff;
}

.defect-detail-drawer__timeline-title em.is-processing {
  background: #fff3e8;
  color: #ff7d00;
}

.defect-detail-drawer__timeline-title em.is-verify {
  background: #fff7e8;
  color: #c89b00;
}

.defect-detail-drawer__timeline-title em.is-closed {
  background: #e8ffea;
  color: #00b42a;
}

.defect-detail-drawer__timeline-title em.is-hold {
  background: #ffe8e8;
  color: #f53f3f;
}

.defect-detail-drawer__timeline-main p {
  margin: 0;
  padding-top: 3.5px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__timeline-main time {
  padding-top: 3.5px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  white-space: nowrap;
}

.defect-detail-drawer__muted {
  margin: 0;
  padding: var(--app-space-4) 0;
  text-align: center;
}

.defect-detail-drawer__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .defect-detail-drawer__topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .defect-detail-drawer__close {
    position: absolute;
    top: var(--app-space-3);
    right: var(--app-space-3);
  }

  .defect-detail-drawer__tabs {
    gap: var(--app-space-4);
    overflow-x: auto;
  }

  .defect-detail-drawer__case-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .defect-detail-drawer__case-search {
    width: 100%;
  }

  .defect-detail-drawer__badges {
    justify-content: flex-start;
  }

  .defect-detail-drawer__meta {
    grid-template-columns: 1fr;
  }

  .defect-detail-drawer__meta-row,
  .defect-detail-drawer__timeline-item {
    grid-template-columns: 1fr;
  }
}
</style>

