<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { Plus, X } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import {
  defectApi,
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectAttachment,
  type DefectDetail,
} from '@/entities/defect'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import DefectCaseAssociateDialog from '@/features/defect-case-associate/DefectCaseAssociateDialog.vue'
import DefectRichTextEditor from '@/features/defect-create-edit/DefectRichTextEditor.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'
import { AttachmentFileWall, confirmDelete, type AttachmentFileWallItem } from '@/shared/ui'
import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  createDefectFormFromDetail,
  type DefectForm,
  validateDefectForm,
} from '@/features/defect-create-edit/model'

type PendingDefectFile = {
  id: string
  file: File
  previewUrl: string | null
}

type SelectedCaseSummary = {
  id: number
  caseNo: string | null
  title: string | null
}

const route = useRoute()
const router = useRouter()

const form = reactive<DefectForm>(createDefaultDefectForm())
const detail = ref<DefectDetail | null>(null)
const workspaces = ref<WorkspaceItem[]>([])
const caseOptions = ref<CaseSummaryItem[]>([])
const selectedCases = ref<SelectedCaseSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const optionsLoading = ref(false)
const caseOptionsLoading = ref(false)
const caseAssociateVisible = ref(false)
const errorMessage = ref('')
const formError = ref('')
const optionErrorMessage = ref('')
const inlineImages = ref<Array<{ file: File; src: string }>>([])
const pendingFiles = ref<PendingDefectFile[]>([])
const existingAttachments = ref<DefectAttachment[]>([])
const attachmentImageUrls = ref<Record<number, string>>({})
const initialSnapshot = ref('')
const suppressLeaveGuard = ref(false)
const deletingAttachmentIds = ref<Set<number>>(new Set())
const tagDraft = ref('')
const defectModuleOptions = ['用户中心', '订单中心', '获客中心', '风控中心', '接口自动化', '报告']
const defectSourceTypeOptions = [
  { value: 'MANUAL', label: '手动发现' },
  { value: 'CASE', label: '用例执行' },
  { value: 'REPORT', label: '测试报告' },
  { value: 'AI_DETECTION', label: 'AI 检测' },
  { value: 'CODE_REVIEW', label: '代码审查' },
]

const defectId = computed(() => {
  const rawId = route.params.id
  const id = Array.isArray(rawId) ? Number(rawId[0]) : Number(rawId)
  return Number.isFinite(id) ? id : null
})

const isCreateMode = computed(() => route.name === 'bug-create')

const routeWorkspaceCode = computed(() => {
  const rawWorkspace = route.query.workspace
  const workspaceCode = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace
  return workspaceCode || 'ALL'
})

const pageTitle = computed(() => (isCreateMode.value ? '新增缺陷' : '编辑缺陷'))
const primaryActionText = computed(() => (isCreateMode.value ? '创建缺陷' : '保存修改'))
const canSubmit = computed(() => !loading.value && !errorMessage.value)
const currentWorkspaceLabel = computed(() => {
  const matched = getConcreteWorkspaces().find(item => item.workspaceCode === form.workspaceCode)
  return matched ? getWorkspaceLabel(matched) : form.workspaceCode || '未选择'
})
const attachmentWallItems = computed<AttachmentFileWallItem[]>(() => [
  ...existingAttachments.value.map(item => ({
    id: item.id,
    fileName: item.fileName,
    fileSize: item.fileSize,
    uploadedByName: item.uploadedByName,
    createdAt: item.createdAt,
    contentType: item.contentType,
    imageUrl: isImageAttachment(item) ? getAttachmentImageUrl(item) : undefined,
  })),
  ...pendingFiles.value.map(item => ({
    id: item.id,
    fileName: item.file.name,
    fileSize: item.file.size,
    contentType: item.file.type,
    imageUrl: item.previewUrl || undefined,
    metaText: '待上传',
    pending: true,
  })),
])
const isDirty = computed(() => buildDirtySnapshot() !== initialSnapshot.value)

function getConcreteWorkspaces() {
  return workspaces.value.filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
}

function getWorkspaceLabel(item: WorkspaceItem) {
  return item.workspaceName || item.workspaceCode
}

function isImageAttachment(item: DefectAttachment) {
  return Boolean(item.contentType?.startsWith('image/'))
}

function getAttachmentImageUrl(item: DefectAttachment) {
  return attachmentImageUrls.value[item.id] || ''
}

function revokeAttachmentImageUrls() {
  Object.values(attachmentImageUrls.value).forEach((url) => {
    URL.revokeObjectURL(url)
  })
  attachmentImageUrls.value = {}
}

async function loadAttachmentImageUrls(nextDetail: DefectDetail | null) {
  revokeAttachmentImageUrls()
  if (!nextDetail) {
    return
  }
  const nextUrls: Record<number, string> = {}
  for (const attachment of (nextDetail.attachments ?? []).filter(isImageAttachment)) {
    try {
      const blob = await defectApi.downloadDefectAttachment(nextDetail.workspaceCode, nextDetail.id, attachment.id)
      nextUrls[attachment.id] = URL.createObjectURL(blob)
    } catch {
      // Keep broken thumbnails local to the image card; download still remains available.
    }
  }
  attachmentImageUrls.value = nextUrls
}

function buildDirtySnapshot() {
  return JSON.stringify({
    workspaceCode: form.workspaceCode,
    title: form.title,
    description: form.description,
    reproductionSteps: form.reproductionSteps,
    expectedResult: form.expectedResult,
    actualResult: form.actualResult,
    moduleName: form.moduleName,
    versionName: form.versionName,
    priority: form.priority,
    severity: form.severity,
    assigneeId: form.assigneeId,
    relatedCaseId: form.relatedCaseId,
    relatedCaseIds: [...form.relatedCaseIds],
    tags: [...form.tags],
    pendingFiles: pendingFiles.value.map(item => item.file.name),
    inlineImages: inlineImages.value.map(item => item.src),
  })
}

function markClean() {
  initialSnapshot.value = buildDirtySnapshot()
}

function resetCreateForm(keepDefaults = true) {
  const preserved = {
    workspaceCode: form.workspaceCode,
    priority: form.priority,
    severity: form.severity,
    assigneeId: form.assigneeId,
    moduleName: form.moduleName,
  }
  Object.assign(form, createDefaultDefectForm(keepDefaults ? preserved.workspaceCode : 'ALL'))
  if (keepDefaults) {
    form.priority = preserved.priority
    form.severity = preserved.severity
    form.assigneeId = preserved.assigneeId
    form.moduleName = preserved.moduleName
  }
  formError.value = ''
  clearPendingFiles()
  clearInlineImages()
  markClean()
}

function addInlineImage(payload: { file: File; src: string }) {
  inlineImages.value = [...inlineImages.value, payload]
}

function clearInlineImages() {
  inlineImages.value.forEach((item) => {
    URL.revokeObjectURL(item.src)
  })
  inlineImages.value = []
}

function addPendingFiles(files: File[]) {
  const nextFiles = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }))
  pendingFiles.value = [...pendingFiles.value, ...nextFiles]
}

function removePendingFile(id: string) {
  const target = pendingFiles.value.find(item => item.id === id)
  if (target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  pendingFiles.value = pendingFiles.value.filter(item => item.id !== id)
}

function clearPendingFiles() {
  pendingFiles.value.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  pendingFiles.value = []
}

async function downloadAttachment(item: DefectAttachment) {
  if (!detail.value) {
    return
  }
  try {
    const blob = await defectApi.downloadDefectAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.fileName || 'attachment'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteAttachment(item: DefectAttachment) {
  if (!detail.value) {
    return
  }
  try {
    await confirmDelete({
      title: '删除附件',
      message: `确认删除附件“${item.fileName}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    const nextIds = new Set(deletingAttachmentIds.value)
    nextIds.add(item.id)
    deletingAttachmentIds.value = nextIds
    await defectApi.deleteDefectAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    existingAttachments.value = existingAttachments.value.filter(attachment => attachment.id !== item.id)
    const removedImageUrl = attachmentImageUrls.value[item.id]
    if (removedImageUrl) {
      URL.revokeObjectURL(removedImageUrl)
      const nextUrls = { ...attachmentImageUrls.value }
      delete nextUrls[item.id]
      attachmentImageUrls.value = nextUrls
    }
    markClean()
    ElMessage.success('附件已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    const nextIds = new Set(deletingAttachmentIds.value)
    nextIds.delete(item.id)
    deletingAttachmentIds.value = nextIds
  }
}

function handleAttachmentPanelDownload(item: AttachmentFileWallItem) {
  if (item.pending) {
    return
  }
  const matched = existingAttachments.value.find(attachment => attachment.id === item.id)
  if (matched) {
    void downloadAttachment(matched)
  }
}

function handleAttachmentPanelRemove(item: AttachmentFileWallItem) {
  if (item.pending) {
    removePendingFile(String(item.id))
    return
  }
  const matched = existingAttachments.value.find(attachment => attachment.id === item.id)
  if (matched) {
    void deleteAttachment(matched)
  }
}

function resolveInitialWorkspaceCode(items: WorkspaceItem[]) {
  const concreteWorkspaces = items.filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
  if (routeWorkspaceCode.value !== 'ALL' && concreteWorkspaces.some(item => item.workspaceCode === routeWorkspaceCode.value)) {
    return routeWorkspaceCode.value
  }
  const selected = concreteWorkspaces.find(item => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || concreteWorkspaces[0]?.workspaceCode || ''
}

function findInlineImageBySrc(src: string) {
  return inlineImages.value.find(item => item.src === src) || null
}

async function uploadInlineImages(defectIdValue: number, workspaceCode: string, html: string) {
  if (!inlineImages.value.length || !html.trim()) {
    clearInlineImages()
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild as HTMLElement | null
  if (!container) {
    clearInlineImages()
    return html
  }

  const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
  for (const image of images) {
    const src = image.getAttribute('src') || ''
    if (!/^blob:|^data:/i.test(src)) {
      continue
    }
    const matched = findInlineImageBySrc(src)
    if (!matched) {
      continue
    }
    const [attachment] = await defectApi.uploadDefectAttachments(workspaceCode, defectIdValue, [matched.file])
    const nextSrc = attachment.downloadUrl || `/api/bugs/${defectIdValue}/attachments/${attachment.id}/download`
    image.setAttribute('src', nextSrc)
  }

  clearInlineImages()
  return container.innerHTML
}

async function uploadPendingAttachments(defectIdValue: number, workspaceCode: string) {
  if (!pendingFiles.value.length) {
    return []
  }
  const uploaded = await defectApi.uploadDefectAttachments(workspaceCode, defectIdValue, pendingFiles.value.map(item => item.file))
  clearPendingFiles()
  return uploaded
}

async function loadOptions() {
  optionsLoading.value = true
  optionErrorMessage.value = ''
  try {
    const workspaceList = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = workspaceList
    if (isCreateMode.value && (!form.workspaceCode || form.workspaceCode === 'ALL')) {
      form.workspaceCode = resolveInitialWorkspaceCode(workspaceList)
      await loadCaseOptions(form.workspaceCode)
    }
  } catch (error) {
    optionErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    optionsLoading.value = false
  }
}

async function loadCaseOptions(workspaceCode: string) {
  if (!workspaceCode || workspaceCode === 'ALL') {
    caseOptions.value = []
    selectedCases.value = []
    return
  }

  caseOptionsLoading.value = true
  try {
    const page = await caseApi.getCases(workspaceCode, {
      pageNo: 1,
      pageSize: 50,
    })
    caseOptions.value = Array.isArray(page.items) ? page.items : []
    if (!selectedCases.value.length && form.relatedCaseIds.length) {
      selectedCases.value = caseOptions.value.filter(item => form.relatedCaseIds.includes(String(item.id)))
    }
  } catch {
    caseOptions.value = []
  } finally {
    caseOptionsLoading.value = false
  }
}

function openCaseAssociateDialog() {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    ElMessage.warning('请先选择具体工作空间')
    return
  }

  caseAssociateVisible.value = true
}

function handleCaseAssociated(caseIds: number[], cases: SelectedCaseSummary[]) {
  form.relatedCaseIds = caseIds.map(String)
  form.relatedCaseId = form.relatedCaseIds[0] ?? ''
  const selectedMap = new Map<number, SelectedCaseSummary>()
  selectedCases.value.forEach(item => selectedMap.set(item.id, item))
  caseOptions.value.forEach(item => selectedMap.set(item.id, item))
  cases.forEach(item => selectedMap.set(item.id, item))
  selectedCases.value = caseIds
    .map(caseId => selectedMap.get(caseId))
    .filter((item): item is SelectedCaseSummary => Boolean(item))
  caseAssociateVisible.value = false
}

function removeAssociatedCase(caseId: number) {
  form.relatedCaseIds = form.relatedCaseIds.filter(id => Number(id) !== caseId)
  form.relatedCaseId = form.relatedCaseIds[0] ?? ''
  selectedCases.value = selectedCases.value.filter(item => item.id !== caseId)
}

function commitDefectTag() {
  const tag = tagDraft.value.trim().replace(/[,，]+$/, '').trim()
  if (tag && !form.tags.includes(tag)) {
    form.tags = [...form.tags, tag]
  }
  tagDraft.value = ''
}

function handleTagKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ',' && event.key !== '，') {
    return
  }
  event.preventDefault()
  commitDefectTag()
}

function removeDefectTag(tag: string) {
  form.tags = form.tags.filter(item => item !== tag)
}

async function loadDefectDetail() {
  if (isCreateMode.value) {
    detail.value = null
    errorMessage.value = ''
    return
  }

  if (!defectId.value) {
    errorMessage.value = '缺陷不存在或链接参数无效。'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const nextDetail = await defectApi.getDefectDetail(routeWorkspaceCode.value, defectId.value)
    detail.value = nextDetail
    existingAttachments.value = nextDetail.attachments ?? []
    await loadAttachmentImageUrls(nextDetail)
    Object.assign(form, createDefectFormFromDetail(nextDetail))
    await loadCaseOptions(nextDetail.workspaceCode)
    selectedCases.value = nextDetail.relatedCases?.length
      ? nextDetail.relatedCases
      : caseOptions.value.filter(item => form.relatedCaseIds.includes(String(item.id)))
    markClean()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function confirmLeave() {
  if (!isDirty.value || suppressLeaveGuard.value) {
    return true
  }
  try {
    await ElMessageBox.confirm('系统不会保存尚未提交的修改，确认离开吗？', '离开此页面？', {
      type: 'warning',
      confirmButtonText: '离开',
      cancelButtonText: '留下',
    })
    return true
  } catch {
    return false
  }
}

async function goBack() {
  if (!await confirmLeave()) {
    return
  }
  suppressLeaveGuard.value = true
  const workspaceCode = detail.value?.workspaceCode || form.workspaceCode || routeWorkspaceCode.value
  try {
    await router.push({
      path: '/bugs',
      query: workspaceCode ? { workspace: workspaceCode } : undefined,
    })
  } catch {
    suppressLeaveGuard.value = false
  }
}

async function submit(keepCreating = false) {
  const error = validateDefectForm(form)
  if (error) {
    formError.value = error
    return
  }
  if (!isCreateMode.value && !defectId.value) {
    formError.value = '缺陷不存在或链接参数无效。'
    return
  }

  formError.value = ''
  saving.value = true
  try {
    const workspaceCode = detail.value?.workspaceCode || form.workspaceCode || routeWorkspaceCode.value
    const payload = buildSaveDefectPayload(form)
    if (isCreateMode.value) {
      const created = await defectApi.createDefect(workspaceCode, payload)
      const description = await uploadInlineImages(created.id, workspaceCode, payload.description)
      if (description !== payload.description) {
        await defectApi.updateDefect(workspaceCode, created.id, {
          ...payload,
          description,
        })
      }
      if (form.relatedCaseIds.length !== (payload.relatedCaseId ? 1 : 0)) {
        await defectApi.replaceDefectCases(workspaceCode, created.id, {
          caseIds: form.relatedCaseIds.map(Number).filter(Number.isFinite),
        })
      }
      await uploadPendingAttachments(created.id, workspaceCode)
      ElMessage.success('缺陷创建成功')
      if (keepCreating) {
        resetCreateForm(true)
        return
      }
    } else if (defectId.value) {
      const description = await uploadInlineImages(defectId.value, workspaceCode, payload.description)
      const updated = await defectApi.updateDefect(workspaceCode, defectId.value, {
        ...payload,
        description,
      })
      const uploaded = await uploadPendingAttachments(defectId.value, workspaceCode)
      if (form.relatedCaseIds.length !== (payload.relatedCaseId ? 1 : 0)) {
        await defectApi.replaceDefectCases(workspaceCode, defectId.value, {
          caseIds: form.relatedCaseIds.map(Number).filter(Number.isFinite),
        })
      }
      existingAttachments.value = [...(updated.attachments ?? existingAttachments.value), ...uploaded]
      await loadAttachmentImageUrls({
        ...updated,
        attachments: existingAttachments.value,
      })
      ElMessage.success('缺陷更新成功')
    }
    markClean()
    suppressLeaveGuard.value = true
    await goBack()
  } catch (requestError) {
    formError.value = getRequestErrorMessage(requestError)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void (async () => {
    await Promise.all([loadOptions(), loadDefectDetail()])
    if (isCreateMode.value) {
      markClean()
    }
  })()
})

onBeforeUnmount(() => {
  clearPendingFiles()
  clearInlineImages()
  revokeAttachmentImageUrls()
})

onBeforeRouteLeave(async () => {
  if (suppressLeaveGuard.value) {
    return true
  }
  return confirmLeave()
})

watch(
  () => form.workspaceCode,
  (workspaceCode, oldWorkspaceCode) => {
    if (!isCreateMode.value || workspaceCode === oldWorkspaceCode) {
      return
    }
    form.relatedCaseId = ''
    form.assigneeId = ''
    void loadCaseOptions(workspaceCode)
  },
)
</script>

<template>
  <section class="defect-edit-page">
    <div class="defect-edit-page__shell">
      <header class="defect-edit-page__header">
        <div class="defect-edit-page__heading">
          <button type="button" class="defect-edit-page__back-button" @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回缺陷管理</span>
          </button>
          <span class="defect-edit-page__heading-divider" />
          <h1>{{ pageTitle }}</h1>
        </div>
        <span class="defect-edit-page__workspace-context">当前项目：{{ currentWorkspaceLabel }} · 测试平台</span>
      </header>

      <main class="defect-edit-page__content">
        <AppLoadingState v-if="loading" title="正在加载缺陷详情" description="请稍候，系统正在读取最新缺陷信息。" />
        <div v-else-if="errorMessage" class="defect-edit-page__error">
          <span>{{ errorMessage }}</span>
          <AppButton size="small" @click="loadDefectDetail">重试</AppButton>
        </div>

        <div v-else class="defect-edit-page__form-surface">
          <section class="defect-edit-page__main">
            <div class="defect-edit-page__card defect-edit-page__title-card">
              <div class="defect-edit-page__field">
                <span class="is-required">缺陷标题</span>
                <div class="defect-edit-page__title-input-wrap">
                  <el-input
                    v-model="form.title"
                    maxlength="120"
                    placeholder="简洁描述问题，例如：登录页输入正确密码后提示密码错误"
                    :disabled="saving"
                  />
                  <span :class="{ 'is-warning': form.title.length > 100 }">{{ form.title.length }}/120</span>
                </div>
              </div>
            </div>

            <div class="defect-edit-page__card defect-edit-page__description-card">
              <div class="defect-edit-page__editor-label">
                缺陷描述 <span>*</span>
              </div>
              <DefectRichTextEditor
                v-model="form.description"
                :disabled="saving"
                @add-inline-image="addInlineImage"
              />
            </div>

            <div class="defect-edit-page__card defect-edit-page__reproduction-card">
              <div class="defect-edit-page__field defect-edit-page__steps-field">
                <span>复现步骤</span>
                <el-input
                  v-model="form.reproductionSteps"
                  type="textarea"
                  :rows="5"
                  resize="none"
                  placeholder="1. 打开登录页&#10;2. 输入正确的账号密码&#10;3. 点击登录按钮&#10;4. 观察结果"
                  :disabled="saving"
                />
              </div>
              <div class="defect-edit-page__result-grid">
                <div class="defect-edit-page__field defect-edit-page__result-field">
                  <span>预期结果</span>
                  <el-input
                    v-model="form.expectedResult"
                    type="textarea"
                    :rows="3"
                    resize="none"
                    placeholder="描述期望的正确结果"
                    :disabled="saving"
                  />
                </div>
                <div class="defect-edit-page__field defect-edit-page__result-field">
                  <span>实际结果</span>
                  <el-input
                    v-model="form.actualResult"
                    type="textarea"
                    :rows="3"
                    resize="none"
                    placeholder="描述实际发生的错误结果"
                    :disabled="saving"
                  />
                </div>
              </div>
            </div>

            <div class="defect-edit-page__card defect-edit-page__attachment-card">
              <div class="defect-edit-page__field">
                <span>附件 / 截图</span>
                <AttachmentFileWall
                  :items="attachmentWallItems"
                  :disabled="saving"
                  :removing-id="Array.from(deletingAttachmentIds)[0] ?? null"
                  empty-title="点击上传，或将文件拖拽至此处"
                  empty-description="支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB"
                  @add-files="addPendingFiles"
                  @download="handleAttachmentPanelDownload"
                  @remove="handleAttachmentPanelRemove"
                />
              </div>
            </div>
          </section>

          <aside class="defect-edit-page__side">
            <div class="defect-edit-page__card defect-edit-page__properties-card">
              <div class="defect-edit-page__field">
                <span class="is-required">处理人</span>
                <AppUserSelect
                  v-model="form.assigneeId"
                  :workspace-code="form.workspaceCode"
                  :disabled="saving"
                  :fallback-label="detail?.assigneeName"
                  placeholder="请选择处理人"
                />
              </div>

              <div class="defect-edit-page__field">
                <span class="is-required">优先级</span>
                <div class="defect-edit-page__priority">
                  <button
                    v-for="item in defectPriorityOptions"
                    :key="item.value"
                    type="button"
                    :data-priority="item.value"
                    :class="{ 'is-active': form.priority === item.value }"
                    :disabled="saving"
                    @click="form.priority = item.value"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>

              <div class="defect-edit-page__field">
                <span class="is-required">严重级别</span>
                <el-select v-model="form.severity" class="defect-edit-page__select" :disabled="saving">
                  <el-option
                    v-for="item in defectSeverityOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>

              <div class="defect-edit-page__field">
                <span>所属模块</span>
                <el-select
                  v-model="form.moduleName"
                  class="defect-edit-page__select"
                  :disabled="saving"
                  placeholder="请选择模块"
                >
                  <el-option
                    v-for="item in defectModuleOptions"
                    :key="item"
                    :label="item"
                    :value="item"
                  />
                </el-select>
              </div>

              <div class="defect-edit-page__field">
                <span>影响版本</span>
                <el-input
                  v-model="form.versionName"
                  :disabled="saving"
                  maxlength="128"
                  placeholder="请输入影响版本（选填）"
                />
              </div>
            </div>

            <div class="defect-edit-page__card defect-edit-page__case-card">
              <div class="defect-edit-page__card-heading">
                <span>关联用例</span>
                <button
                  type="button"
                  class="defect-edit-page__case-action"
                  :disabled="saving || caseOptionsLoading"
                  @click="openCaseAssociateDialog"
                >
                  <Plus />
                  {{ selectedCases.length ? '管理关联' : '选择用例' }}
                </button>
              </div>
              <div v-if="selectedCases.length" class="defect-edit-page__selected-cases">
                <div v-for="item in selectedCases" :key="item.id" class="defect-edit-page__selected-case">
                  <strong>{{ item.caseNo || `#${item.id}` }}</strong>
                  <span>{{ item.title || '' }}</span>
                  <button
                    type="button"
                    :aria-label="`移除 ${item.caseNo || item.id}`"
                    :disabled="saving"
                    @click="removeAssociatedCase(item.id)"
                  >
                    <X />
                  </button>
                </div>
              </div>
              <div v-else class="defect-edit-page__case-empty">
                未关联用例 — 点击「选择用例」从用例库中选择
              </div>
            </div>

            <div class="defect-edit-page__card defect-edit-page__tags-card">
              <div
                class="defect-edit-page__field"
                :class="{ 'is-tags-empty': !form.tags.length }"
              >
                <span>标签</span>
                <div v-if="form.tags.length" class="defect-edit-page__tag-list">
                  <span v-for="tag in form.tags" :key="tag" class="defect-edit-page__tag-chip">
                    {{ tag }}
                    <button type="button" :aria-label="`移除标签 ${tag}`" :disabled="saving" @click="removeDefectTag(tag)">×</button>
                  </span>
                </div>
                <input
                  v-model="tagDraft"
                  type="text"
                  class="defect-edit-page__tag-input"
                  placeholder="输入后按回车添加标签"
                  :disabled="saving"
                  @keydown="handleTagKeydown"
                />
              </div>
            </div>

            <div class="defect-edit-page__card defect-edit-page__source-card">
              <div class="defect-edit-page__field">
                <span>来源类型</span>
                <el-select
                  v-model="form.sourceType"
                  class="defect-edit-page__source-select"
                  :disabled="saving"
                  aria-label="缺陷来源类型"
                >
                  <el-option
                    v-for="item in defectSourceTypeOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </div>

            <div v-if="optionErrorMessage" class="defect-edit-page__card">
              <p class="defect-edit-page__inline-error">{{ optionErrorMessage }}</p>
            </div>
          </aside>
        </div>

        <p v-if="formError" class="defect-edit-page__inline-error">{{ formError }}</p>
      </main>

      <footer class="defect-edit-page__footer">
        <AppButton class="defect-edit-page__cancel" :disabled="saving" @click="goBack">取消</AppButton>
        <AppButton v-if="isCreateMode" class="defect-edit-page__continue" :disabled="saving || !canSubmit" @click="submit(true)">
          保存并继续创建
        </AppButton>
        <AppButton class="defect-edit-page__submit" type="primary" :loading="saving" :disabled="!canSubmit" @click="submit(false)">
          {{ primaryActionText }}
        </AppButton>
      </footer>
    </div>

  </section>

  <DefectCaseAssociateDialog
    v-model="caseAssociateVisible"
    :workspace-code="form.workspaceCode"
    :current-case-id="form.relatedCaseId ? Number(form.relatedCaseId) : null"
    :current-case-ids="form.relatedCaseIds.map(Number).filter(Number.isFinite)"
    :current-cases="selectedCases"
    @associate="handleCaseAssociated"
  />
</template>

<style scoped>
.defect-edit-page {
  display: flex;
  min-height: 0;
  height: calc(100dvh - 64px - var(--app-space-6) * 2);
  background: #f4f6fa;
}

.defect-edit-page__shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) 64px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.defect-edit-page__header {
  display: grid;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-edit-page__backbar {
  display: flex;
  align-items: center;
  padding: 16px 24px 0;
}

.defect-edit-page__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px 16px;
}

.defect-edit-page__titlebar h1 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.defect-edit-page__back-button {
  min-height: 30px;
  padding: 0 12px;
  border-color: #e5e6eb;
  border-radius: 4px;
  background: #ffffff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
}

.defect-edit-page__back-button:hover,
.defect-edit-page__back-button:focus-visible {
  border-color: #c9cdd4;
  background: #f7f8fa;
  color: #f53f3f;
  outline: none;
}

.defect-edit-page__content {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: 18px 24px;
  background: #ffffff;
}

.defect-edit-page__form-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 0;
  overflow: visible;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
}

.defect-edit-page__main,
.defect-edit-page__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
}

.defect-edit-page__side {
  border-left: 1px solid #e5e6eb;
  background: #f7f8fa;
}

.defect-edit-page__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.defect-edit-page__field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-edit-page__field > span.is-required::before {
  margin-right: 2px;
  color: #f53f3f;
  content: '*';
}

.defect-edit-page__field :deep(.el-input__wrapper),
.defect-edit-page__field :deep(.el-select__wrapper) {
  min-height: 34px;
  padding: 1px 13px;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-edit-page__field :deep(.el-input__wrapper:hover),
.defect-edit-page__field :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #c9cdd4 inset;
}

.defect-edit-page__field :deep(.el-input__wrapper.is-focus),
.defect-edit-page__field :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #f53f3f inset, 0 0 0 2px rgba(245, 63, 63, 0.1);
}

.defect-edit-page__field :deep(.el-input__inner),
.defect-edit-page__field :deep(.el-select__placeholder),
.defect-edit-page__field :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.defect-edit-page__field :deep(.el-input__count-inner) {
  color: #c9cdd4;
  font-size: 11px;
}

.defect-edit-page__select {
  width: 100%;
}

.defect-edit-page__case-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #ffffff;
}

.defect-edit-page__case-picker.is-empty {
  border-style: dashed;
  background: #fafafa;
}

.defect-edit-page__case-picker-main {
  display: grid;
  min-width: 0;
}

.defect-edit-page__case-picker-main strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-edit-page__case-picker.is-empty .defect-edit-page__case-picker-main strong {
  color: #86909c;
}

.defect-edit-page__case-picker-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.defect-edit-page__case-picker-actions :deep(.app-button) {
  height: 26px;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.defect-edit-page__priority {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.defect-edit-page__priority button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.defect-edit-page__priority button:hover,
.defect-edit-page__priority button.is-active {
  border-color: rgba(245, 63, 63, 0.5);
  background: #fff0f0;
  color: #f53f3f;
}

.defect-edit-page__error,
.defect-edit-page__inline-error {
  padding: 9px 12px;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  background: #fff0f0;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.defect-edit-page__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.defect-edit-page__inline-error {
  margin: 0;
}

.defect-edit-page__footer {
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.defect-edit-page__footer :deep(.app-button) {
  min-width: 82px;
  height: 36px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.defect-edit-page :deep(.defect-rich-text-editor) {
  border-color: #e5e6eb;
  border-radius: 6px;
}

.defect-edit-page :deep(.defect-rich-text-editor__toolbar) {
  min-height: 38px;
  padding: 4px 8px;
  border-bottom-color: #e5e6eb;
  background: #f7f8fa;
}

.defect-edit-page :deep(.defect-rich-text-editor__button),
.defect-edit-page :deep(.defect-rich-text-editor__select) {
  height: 28px;
  border-radius: 4px;
  color: #4e5969;
  font-size: 12px;
}

.defect-edit-page :deep(.defect-rich-text-editor__button:hover),
.defect-edit-page :deep(.defect-rich-text-editor__select:hover),
.defect-edit-page :deep(.defect-rich-text-editor__button.is-active) {
  background: #ffffff;
  color: #f53f3f;
}

.defect-edit-page :deep(.defect-rich-text-editor__content) {
  min-height: 270px;
}

.defect-edit-page :deep(.defect-rich-text-editor__content .defect-rich-text-editor__input) {
  min-height: 242px;
  padding: 12px 14px;
  color: #1d2129;
  font-size: 13px;
  line-height: 22px;
}

.defect-edit-page :deep(.attachment-file-wall__drop-zone) {
  min-height: 112px;
  border-color: #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
}

.defect-edit-page :deep(.attachment-file-wall__drop-zone.has-files) {
  min-height: 180px;
}

.defect-edit-page :deep(.attachment-file-wall__drop-zone > span) {
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.defect-edit-page :deep(.attachment-file-wall__drop-zone > em) {
  color: #86909c;
  font-size: 11px;
  line-height: 17px;
}

.defect-edit-page :deep(.attachment-file-wall__file) {
  border-color: #e5e6eb;
  box-shadow: none;
}

.defect-edit-page :deep(.attachment-file-wall__meta > strong) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
}

.defect-edit-page :deep(.attachment-file-wall__meta-row > span) {
  color: #86909c;
}

@media (max-width: 1080px) {
  .defect-edit-page__form-surface {
    grid-template-columns: 1fr;
  }

  .defect-edit-page__side {
    border-top: 1px solid #e5e6eb;
    border-left: 0;
  }
}

@media (max-width: 720px) {
  .defect-edit-page {
    padding: 12px;
  }

  .defect-edit-page__content,
  .defect-edit-page__titlebar,
  .defect-edit-page__footer {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>

<style scoped>
.defect-edit-page {
  height: calc(100dvh - 42px);
  background: #f4f6fa;
}

.defect-edit-page__shell {
  grid-template-rows: 48px minmax(0, 1fr) 56px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #f4f6fa;
  box-shadow: none;
}

.defect-edit-page__header {
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-edit-page__heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.defect-edit-page__heading h1 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.defect-edit-page__back-button {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: auto;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  transition: color 150ms ease, background-color 150ms ease;
}

.defect-edit-page__back-button:hover,
.defect-edit-page__back-button:focus-visible {
  border: 0;
  background: #fff1f0;
  color: #f53f3f;
  outline: none;
}

.defect-edit-page__heading-divider {
  width: 1px;
  height: 14px;
  background: #e5e6eb;
}

.defect-edit-page__workspace-context {
  overflow: hidden;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-edit-page__content {
  display: block;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: #f4f6fa;
}

.defect-edit-page__form-surface {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  min-height: 0;
  margin: 0 auto;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.defect-edit-page__main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.defect-edit-page__side {
  display: flex;
  width: 260px;
  flex: 0 0 260px;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
}

.defect-edit-page__card {
  min-width: 0;
  padding: 16px 20px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #ffffff;
}

.defect-edit-page__description-card {
  position: relative;
  padding: 0;
  overflow: hidden;
}

.defect-edit-page__properties-card,
.defect-edit-page__case-card,
.defect-edit-page__tags-card,
.defect-edit-page__source-card {
  padding: 16px;
}

.defect-edit-page__properties-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.defect-edit-page__field > span {
  font-weight: 600;
}

.defect-edit-page__title-input-wrap {
  position: relative;
}

.defect-edit-page__title-input-wrap > span {
  position: absolute;
  top: 50%;
  right: 10px;
  z-index: 1;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 17px;
  transform: translateY(-50%);
  pointer-events: none;
}

.defect-edit-page__title-input-wrap > span.is-warning {
  color: #ff7d00;
}

.defect-edit-page__title-input-wrap :deep(.el-input__wrapper) {
  padding-right: 58px;
}

.defect-edit-page__field :deep(.el-input__wrapper),
.defect-edit-page__field :deep(.el-select__wrapper) {
  min-height: 34px;
  padding: 1px 12px;
  border-radius: 8px;
}

.defect-edit-page__priority {
  gap: 6px;
}

.defect-edit-page__priority button {
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  transition: all 120ms ease;
}

.defect-edit-page__priority button:not(.is-active):hover {
  border-color: #c9cdd4;
  background: #ffffff;
  color: #4e5969;
  font-weight: 400;
}

.defect-edit-page__priority button[data-priority='P0'].is-active {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #ffffff;
  font-weight: 700;
}

.defect-edit-page__priority button[data-priority='P1'].is-active {
  border-color: #ff7d00;
  background: #ff7d00;
  color: #ffffff;
  font-weight: 700;
}

.defect-edit-page__priority button[data-priority='P2'].is-active {
  border-color: #165dff;
  background: #165dff;
  color: #ffffff;
  font-weight: 700;
}

.defect-edit-page__priority button[data-priority='P3'].is-active {
  border-color: #e5e6eb;
  background: #ffffff;
  color: #4e5969;
  font-weight: 700;
}

.defect-edit-page__priority button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.defect-edit-page__editor-label {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  height: 50px;
  padding-left: 16px;
  color: #4e5969;
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  pointer-events: none;
}

.defect-edit-page__editor-label span {
  margin-left: 3px;
  color: #f53f3f;
}

.defect-edit-page__reproduction-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.defect-edit-page__result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.defect-edit-page__reproduction-card :deep(.el-textarea__inner) {
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  color: #1d2129;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 22.1px;
  box-shadow: 0 0 0 1.5px #e5e6eb inset;
}

.defect-edit-page__reproduction-card :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1.5px #c9cdd4 inset;
}

.defect-edit-page__reproduction-card :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1.5px #f53f3f inset;
}

.defect-edit-page__steps-field :deep(.el-textarea__inner) {
  height: 132px;
}

.defect-edit-page__result-field :deep(.el-textarea__inner) {
  height: 88px;
}

.defect-edit-page__card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.defect-edit-page__case-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #f53f3f;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  height: 28px;
  padding: 4px 12px;
  border: 1px solid #f53f3f;
  border-radius: 6px;
  background: rgba(245, 63, 63, 0.024);
}

.defect-edit-page__case-action:hover {
  background: #fff1f0;
}

.defect-edit-page__case-action svg {
  width: 11px;
  height: 11px;
  stroke-width: 2;
}

.defect-edit-page__case-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.defect-edit-page__case-empty {
  min-height: 57px;
  padding: 10px 12px;
  border: 1.5px dashed #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.defect-edit-page__selected-cases {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.defect-edit-page__selected-case {
  display: flex;
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fafbfe;
}

.defect-edit-page__selected-case strong {
  flex: 0 0 auto;
  color: #165dff;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
  white-space: nowrap;
}

.defect-edit-page__selected-case > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-edit-page__selected-case > button {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.defect-edit-page__selected-case > button:hover {
  color: #f53f3f;
}

.defect-edit-page__selected-case > button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.defect-edit-page__selected-case > button svg {
  width: 12px;
  height: 12px;
  stroke-width: 2;
}

.defect-edit-page__tag-list {
  display: flex;
  min-height: 36.5px;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 5px;
  padding: 6px 0 8px;
}

.defect-edit-page__tags-card .defect-edit-page__field {
  gap: 0;
}

.defect-edit-page__tags-card .defect-edit-page__field.is-tags-empty {
  gap: 6px;
}

.defect-edit-page__tag-chip {
  display: inline-flex;
  height: 22.5px;
  box-sizing: border-box;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid rgba(245, 63, 63, 0.19);
  border-radius: 12px;
  background: rgba(245, 63, 63, 0.07);
  color: #f53f3f;
  font-size: 11px;
  font-weight: 400;
  line-height: 17px;
}

.defect-edit-page__tag-chip > button {
  display: inline-flex;
  height: 14px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #f53f3f;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 0;
  opacity: 0.6;
}

.defect-edit-page__tag-chip > button:hover {
  opacity: 1;
}

.defect-edit-page__tag-chip > button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.defect-edit-page__tag-input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #ffffff;
  color: #1d2129;
  font: inherit;
  font-size: 12px;
  line-height: 30px;
}

.defect-edit-page__tag-input::placeholder {
  color: rgba(29, 33, 41, 0.5);
}

.defect-edit-page__tag-input:focus {
  border-color: #f53f3f;
  box-shadow: 0 0 0 0.5px #f53f3f;
}

.defect-edit-page__tag-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.defect-edit-page__source-card :deep(.el-select__wrapper) {
  min-height: 34px;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-edit-page__source-card :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
}

.defect-edit-page__error {
  max-width: 1280px;
  margin: 0 auto;
}

.defect-edit-page__footer {
  padding: 10px 24px;
  border-top: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-edit-page__footer :deep(.app-button) {
  min-width: 64px;
  height: 34px;
  border-radius: 8px;
}

.defect-edit-page__footer :deep(.defect-edit-page__continue) {
  border-color: #ff7875;
  color: #f53f3f;
}

.defect-edit-page__footer :deep(.defect-edit-page__continue:hover) {
  background: #fff1f0;
}

.defect-edit-page__footer :deep(.defect-edit-page__submit) {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #ffffff;
}

.defect-edit-page__footer :deep(.defect-edit-page__submit:hover) {
  border-color: #d9363e;
  background: #d9363e;
}

.defect-edit-page :deep(.defect-rich-text-editor) {
  border: 0;
  border-radius: 0;
}

.defect-edit-page :deep(.defect-rich-text-editor__toolbar) {
  min-height: 50px;
  padding: 11px 12px 11px 92px;
  border-bottom-color: #e5e6eb;
  background: #ffffff;
}

.defect-edit-page :deep(.defect-rich-text-editor__content) {
  min-height: 190px;
  padding: 14px 16px;
}

.defect-edit-page :deep(.defect-rich-text-editor__content .defect-rich-text-editor__input) {
  min-height: 162px;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
}

.defect-edit-page :deep(.attachment-file-wall__drop-zone) {
  min-height: 128px;
  border-color: #e5e6eb;
  border-radius: 10px;
  background: #fafbfe;
}

@media (max-width: 1080px) {
  .defect-edit-page__form-surface {
    flex-direction: column;
  }

  .defect-edit-page__side {
    display: grid;
    width: 100%;
    flex: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .defect-edit-page__header,
  .defect-edit-page__content,
  .defect-edit-page__footer {
    padding-right: 16px;
    padding-left: 16px;
  }

  .defect-edit-page__workspace-context {
    display: none;
  }

  .defect-edit-page__side {
    display: flex;
  }

  .defect-edit-page__result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
