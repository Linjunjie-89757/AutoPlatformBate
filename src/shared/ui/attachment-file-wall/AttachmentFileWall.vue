<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, File as FileIcon, Trash2, Upload } from '@lucide/vue'
import { ElImageViewer, ElMessage } from 'element-plus'

export type AttachmentFileWallItem = {
  id: string | number
  fileName: string
  fileSize?: number | null
  contentType?: string | null
  imageUrl?: string
  createdAt?: string | null
  metaText?: string | null
  pending?: boolean
}

const props = withDefaults(
  defineProps<{
    items: AttachmentFileWallItem[]
    disabled?: boolean
    uploading?: boolean
    showDownload?: boolean
    showRemove?: boolean
    multiple?: boolean
    accept?: string
    allowedExtensions?: string[]
    maxFileSize?: number
    emptyTitle?: string
    emptyDescription?: string
    downloadingId?: string | number | null
    removingId?: string | number | null
  }>(),
  {
    disabled: false,
    uploading: false,
    showDownload: true,
    showRemove: true,
    multiple: true,
    accept: '',
    allowedExtensions: () => [
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
    ],
    maxFileSize: 20 * 1024 * 1024,
    emptyTitle: '点击上传，或将文件拖拽至此处',
    emptyDescription: '支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB',
    downloadingId: null,
    removingId: null,
  },
)

const emit = defineEmits<{
  addFiles: [files: File[]]
  download: [item: AttachmentFileWallItem]
  remove: [item: AttachmentFileWallItem]
  reject: [payload: { reason: 'type' | 'size'; files: File[] }]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)
const imagePreviewVisible = ref(false)
const imagePreviewUrlList = ref<string[]>([])
const imagePreviewInitialIndex = ref(0)

const normalizedAllowedExtensions = computed(() => (
  props.allowedExtensions.map(item => item.replace(/^\./, '').toLowerCase()).filter(Boolean)
))
const inputAccept = computed(() => {
  if (props.accept) {
    return props.accept
  }
  return normalizedAllowedExtensions.value.map(item => `.${item}`).join(',')
})
const imageItems = computed(() => props.items.filter(item => Boolean(item.imageUrl)))

function getFileExt(fileName: string) {
  return fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE'
}

function getFileExtValue(fileName: string) {
  return getFileExt(fileName).toLowerCase()
}

function isImageItem(item: AttachmentFileWallItem) {
  if (item.imageUrl) {
    return true
  }
  if (item.contentType?.startsWith('image/')) {
    return true
  }
  return ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG'].includes(getFileExt(item.fileName))
}

function getTypeTone(item: AttachmentFileWallItem) {
  const label = getFileExt(item.fileName)
  if (isImageItem(item)) {
    return 'image'
  }
  if (label === 'PDF') {
    return 'pdf'
  }
  if (['DOC', 'DOCX'].includes(label)) {
    return 'doc'
  }
  if (['XLS', 'XLSX', 'CSV'].includes(label)) {
    return 'xls'
  }
  if (['PPT', 'PPTX'].includes(label)) {
    return 'ppt'
  }
  if (['ZIP', 'RAR', '7Z'].includes(label)) {
    return 'zip'
  }
  return 'neutral'
}

function formatFileSize(size: number | null | undefined) {
  if (!size || size <= 0) {
    return '-'
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getMetaText(item: AttachmentFileWallItem) {
  if (item.metaText) {
    return item.metaText
  }
  if (item.pending) {
    return '待上传'
  }
  return formatFileSize(item.fileSize)
}

function openFilePicker() {
  if (props.disabled || props.uploading) {
    return
  }
  fileInputRef.value?.click()
}

function filterFiles(files: File[]) {
  const validFiles: File[] = []
  const rejectedTypeFiles: File[] = []
  const rejectedSizeFiles: File[] = []
  const allowed = normalizedAllowedExtensions.value

  files.forEach((file) => {
    if (allowed.length && !allowed.includes(getFileExtValue(file.name))) {
      rejectedTypeFiles.push(file)
      return
    }
    if (props.maxFileSize && file.size > props.maxFileSize) {
      rejectedSizeFiles.push(file)
      return
    }
    validFiles.push(file)
  })

  if (rejectedTypeFiles.length) {
    emit('reject', { reason: 'type', files: rejectedTypeFiles })
    ElMessage.warning(`暂不支持上传：${rejectedTypeFiles.slice(0, 3).map(item => item.name).join('、')}${rejectedTypeFiles.length > 3 ? ' 等文件' : ''}`)
  }
  if (rejectedSizeFiles.length) {
    emit('reject', { reason: 'size', files: rejectedSizeFiles })
    ElMessage.warning(`文件大小超出限制：${rejectedSizeFiles.slice(0, 3).map(item => item.name).join('、')}${rejectedSizeFiles.length > 3 ? ' 等文件' : ''}`)
  }

  return validFiles
}

function addFiles(files: File[]) {
  if (props.disabled || props.uploading || !files.length) {
    return
  }
  const validFiles = filterFiles(files)
  if (validFiles.length) {
    emit('addFiles', validFiles)
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  if (input) {
    input.value = ''
  }
  addFiles(files)
}

function handlePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((item): item is File => Boolean(item))
  if (!files.length) {
    return
  }
  event.preventDefault()
  addFiles(files)
}

function handleDrop(event: DragEvent) {
  dropActive.value = false
  addFiles(Array.from(event.dataTransfer?.files ?? []))
}

function previewItem(item: AttachmentFileWallItem) {
  if (!item.imageUrl) {
    if (props.showDownload && !item.pending) {
      emit('download', item)
    }
    return
  }
  imagePreviewUrlList.value = imageItems.value.map(imageItem => imageItem.imageUrl).filter(Boolean) as string[]
  imagePreviewInitialIndex.value = Math.max(0, imageItems.value.findIndex(imageItem => imageItem.id === item.id))
  imagePreviewVisible.value = true
}

function closeImagePreview() {
  imagePreviewVisible.value = false
  imagePreviewUrlList.value = []
  imagePreviewInitialIndex.value = 0
}
</script>

<template>
  <div
    class="attachment-file-wall"
    :class="{ 'is-drop-active': dropActive, 'is-disabled': disabled || uploading }"
    tabindex="0"
    @paste="handlePaste"
    @dragenter.prevent="dropActive = true"
    @dragover.prevent
    @dragleave="dropActive = false"
    @drop.prevent="handleDrop"
  >
    <div
      class="attachment-file-wall__drop-zone"
      :class="{ 'has-files': items.length }"
      @click="openFilePicker"
    >
      <template v-if="items.length">
        <div class="attachment-file-wall__files">
          <article
            v-for="item in items"
            :key="item.id"
            class="attachment-file-wall__file"
            @click.stop
          >
            <button
              type="button"
              class="attachment-file-wall__preview"
              :aria-label="item.imageUrl ? '预览附件图片' : '下载附件'"
              @click.stop="previewItem(item)"
            >
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.fileName">
              <span
                v-else
                class="attachment-file-wall__type-card"
                :data-tone="getTypeTone(item)"
              >
                <FileIcon class="attachment-file-wall__type-icon" :size="22" :stroke-width="1.7" />
                <strong>{{ getFileExt(item.fileName) }}</strong>
              </span>
            </button>
            <div class="attachment-file-wall__meta">
              <strong :title="item.fileName">{{ item.fileName }}</strong>
              <div class="attachment-file-wall__meta-row">
                <span>{{ getMetaText(item) }}</span>
                <div class="attachment-file-wall__actions">
                  <button
                    v-if="showDownload && !item.pending"
                    type="button"
                    :disabled="downloadingId === item.id"
                    aria-label="下载附件"
                    title="下载"
                    @click.stop="emit('download', item)"
                  >
                    <Download :size="13" :stroke-width="1.8" />
                  </button>
                  <button
                    v-if="showRemove"
                    type="button"
                    :disabled="removingId === item.id"
                    aria-label="删除附件"
                    title="删除"
                    @click.stop="emit('remove', item)"
                  >
                    <Trash2 :size="13" :stroke-width="1.8" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </template>
      <template v-else>
        <Upload class="attachment-file-wall__drop-icon" :size="20" :stroke-width="1.8" />
        <span>{{ uploading ? '上传中...' : emptyTitle }}</span>
        <em>{{ emptyDescription }}</em>
      </template>
    </div>
    <input
      ref="fileInputRef"
      class="attachment-file-wall__input"
      type="file"
      :multiple="multiple"
      :accept="inputAccept"
      :disabled="disabled || uploading"
      @change="handleFileChange"
    >
  </div>

  <ElImageViewer
    v-if="imagePreviewVisible"
    :url-list="imagePreviewUrlList"
    :initial-index="imagePreviewInitialIndex"
    :teleported="true"
    :hide-on-click-modal="true"
    :infinite="false"
    @close="closeImagePreview"
  />
</template>

<style scoped>
.attachment-file-wall {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  outline: none;
}

.attachment-file-wall.is-disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.attachment-file-wall__drop-zone {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 18px;
  border: 2px dashed #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
  color: #4e5969;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.attachment-file-wall__drop-zone.has-files {
  min-height: 180px;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 12px;
}

.attachment-file-wall:not(.is-disabled) .attachment-file-wall__drop-zone:hover,
.attachment-file-wall.is-drop-active .attachment-file-wall__drop-zone {
  border-color: #165dff;
  background: rgba(22, 93, 255, 0.04);
}

.attachment-file-wall__drop-icon {
  margin-bottom: 4px;
  color: #c9cdd4;
  flex: 0 0 auto;
}

.attachment-file-wall__drop-zone > span {
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.attachment-file-wall__drop-zone > em {
  color: #c9cdd4;
  font-size: 11px;
  font-style: normal;
  line-height: 17px;
}

.attachment-file-wall__files {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 12px;
  text-align: left;
}

.attachment-file-wall__file {
  display: flex;
  width: 170px;
  min-height: 192px;
  flex: 0 0 170px;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin: 0;
  padding: 10px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  cursor: default;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.attachment-file-wall__file:hover {
  border-color: #d3d4d6;
  box-shadow: 0 4px 12px rgba(29, 33, 41, 0.05);
}

.attachment-file-wall__preview {
  display: flex;
  width: 100%;
  height: 132px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: #f2f3f5;
  color: #86909c;
  cursor: pointer;
}

.attachment-file-wall__preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attachment-file-wall__type-card {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(201, 205, 212, 0.8);
  border-radius: 6px;
  background: #f7f8fa;
  color: #86909c;
}

.attachment-file-wall__type-card strong {
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.attachment-file-wall__type-icon {
  flex: 0 0 auto;
}

.attachment-file-wall__type-card[data-tone='pdf'] {
  border-color: #ffd5d5;
  background: #fff1f0;
  color: #f53f3f;
}

.attachment-file-wall__type-card[data-tone='doc'] {
  border-color: #bedaff;
  background: #eef5ff;
  color: #165dff;
}

.attachment-file-wall__type-card[data-tone='xls'] {
  border-color: #b2efbb;
  background: #e8ffea;
  color: #00b42a;
}

.attachment-file-wall__type-card[data-tone='ppt'] {
  border-color: #ffcf8b;
  background: #fff7e8;
  color: #ff7d00;
}

.attachment-file-wall__type-card[data-tone='zip'] {
  border-color: #d6c9ff;
  background: #f3f0ff;
  color: #7816ff;
}

.attachment-file-wall__meta {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 6px;
}

.attachment-file-wall__meta > strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-file-wall__meta-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.attachment-file-wall__meta-row > span {
  min-width: 0;
  overflow: hidden;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-file-wall__actions {
  display: flex;
  min-height: 18px;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.attachment-file-wall__file:hover .attachment-file-wall__actions,
.attachment-file-wall__file:focus-within .attachment-file-wall__actions {
  opacity: 1;
}

.attachment-file-wall__actions button {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
}

.attachment-file-wall__actions button:hover:not(:disabled) {
  background: #f2f3f5;
  color: #165dff;
}

.attachment-file-wall__actions button:last-child:hover:not(:disabled) {
  background: #fff1f0;
  color: #f53f3f;
}

.attachment-file-wall__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.attachment-file-wall__input {
  display: none;
}
</style>
