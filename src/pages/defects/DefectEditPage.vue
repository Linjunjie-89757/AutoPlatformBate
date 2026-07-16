<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import {
  defectApi,
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectAttachment,
  type DefectCaseSummary,
  type DefectDetail,
} from '@/entities/defect'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import DefectCaseAssociateDialog from '@/features/defect-case-associate/DefectCaseAssociateDialog.vue'
import DefectRichTextEditor from '@/features/defect-create-edit/DefectRichTextEditor.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
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

const route = useRoute()
const router = useRouter()

const form = reactive<DefectForm>(createDefaultDefectForm())
const detail = ref<DefectDetail | null>(null)
const workspaces = ref<WorkspaceItem[]>([])
const caseOptions = ref<CaseSummaryItem[]>([])
const selectedCases = ref<Array<CaseSummaryItem | DefectCaseSummary>>([])
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
const primaryActionText = computed(() => (isCreateMode.value ? '创建' : '保存'))
const canSubmit = computed(() => !loading.value && !errorMessage.value)
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

const selectedCaseLabel = computed(() => {
  if (!selectedCases.value.length) {
    return '未关联用例'
  }

  return `已关联 ${selectedCases.value.length} 条用例`
})

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
  }
  Object.assign(form, createDefaultDefectForm(keepDefaults ? preserved.workspaceCode : 'ALL'))
  if (keepDefaults) {
    form.priority = preserved.priority
    form.severity = preserved.severity
    form.assigneeId = preserved.assigneeId
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

function handleCaseAssociated(caseIds: number[]) {
  form.relatedCaseIds = caseIds.map(String)
  form.relatedCaseId = form.relatedCaseIds[0] ?? ''
  selectedCases.value = [
    ...selectedCases.value.filter(item => caseIds.includes(item.id)),
    ...caseOptions.value.filter(item => caseIds.includes(item.id) && !selectedCases.value.some(selected => selected.id === item.id)),
  ]
  caseAssociateVisible.value = false
}

function clearAssociatedCase() {
  form.relatedCaseId = ''
  form.relatedCaseIds = []
  selectedCases.value = []
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
        <div class="defect-edit-page__backbar">
          <el-button :icon="ArrowLeft" class="defect-edit-page__back-button" @click="goBack">
            返回缺陷管理
          </el-button>
        </div>
        <div class="defect-edit-page__titlebar">
          <div>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>
      </header>

      <main class="defect-edit-page__content">
        <AppLoadingState v-if="loading" title="正在加载缺陷详情" description="请稍候，系统正在读取最新缺陷信息。" />
        <div v-else-if="errorMessage" class="defect-edit-page__error">
          <span>{{ errorMessage }}</span>
          <AppButton size="small" @click="loadDefectDetail">重试</AppButton>
        </div>

        <div v-else class="defect-edit-page__form-surface">
          <section class="defect-edit-page__main">
            <div class="defect-edit-page__field">
              <span class="is-required">缺陷标题</span>
              <el-input
                v-model="form.title"
                maxlength="120"
                show-word-limit
                placeholder="请输入缺陷标题"
                :disabled="saving"
              />
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">缺陷描述</span>
              <DefectRichTextEditor
                v-model="form.description"
                :disabled="saving"
                @add-inline-image="addInlineImage"
              />
            </div>

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
          </section>

          <aside class="defect-edit-page__side">
            <div class="defect-edit-page__field">
              <span class="is-required">工作空间</span>
              <el-select
                v-model="form.workspaceCode"
                class="defect-edit-page__select"
                :disabled="!isCreateMode"
                filterable
                placeholder="请选择工作空间"
              >
                <el-option
                  v-for="workspace in getConcreteWorkspaces()"
                  :key="workspace.workspaceCode"
                  :label="getWorkspaceLabel(workspace)"
                  :value="workspace.workspaceCode"
                />
              </el-select>
            </div>

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
                  :class="{ 'is-active': form.priority === item.value }"
                  @click="form.priority = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">严重级别</span>
              <el-select v-model="form.severity" class="defect-edit-page__select">
                <el-option
                  v-for="item in defectSeverityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="defect-edit-page__field">
              <span>关联用例</span>
              <div class="defect-edit-page__case-picker" :class="{ 'is-empty': !form.relatedCaseIds.length }">
                <div class="defect-edit-page__case-picker-main">
                  <strong>{{ selectedCaseLabel }}</strong>
                </div>
                <div class="defect-edit-page__case-picker-actions">
                  <AppButton size="small" :disabled="saving || caseOptionsLoading" @click="openCaseAssociateDialog">
                    选择
                  </AppButton>
                  <AppButton v-if="form.relatedCaseIds.length" size="small" :disabled="saving" @click="clearAssociatedCase">
                    清除
                  </AppButton>
                </div>
              </div>
            </div>

            <div class="defect-edit-page__field">
              <span>标签</span>
              <AppTagInput
                v-model="form.tags"
                placeholder="输入内容后回车可直接添加标签"
              />
            </div>

            <p v-if="optionErrorMessage" class="defect-edit-page__inline-error">{{ optionErrorMessage }}</p>
          </aside>
        </div>

        <p v-if="formError" class="defect-edit-page__inline-error">{{ formError }}</p>
      </main>

      <footer class="defect-edit-page__footer">
        <AppButton :disabled="saving" @click="goBack">取消</AppButton>
        <AppButton v-if="isCreateMode" :disabled="saving || !canSubmit" @click="submit(true)">
          保存并继续创建
        </AppButton>
        <AppButton type="primary" :loading="saving" :disabled="!canSubmit" @click="submit(false)">
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
  margin-right: 4px;
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
