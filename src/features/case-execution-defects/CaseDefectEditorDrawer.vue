<script setup lang="ts">
import { computed } from 'vue'

import {
  defectPriorityOptions,
  defectSeverityOptions,
} from '@/entities/defect'
import DefectRichTextEditor from '@/features/defect-create-edit/DefectRichTextEditor.vue'
import type { DefectForm } from '@/features/defect-create-edit/model'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'
import { AttachmentFileWall, type AttachmentFileWallItem } from '@/shared/ui'

export type CaseDefectPendingFile = {
  id: string
  file: File
  previewUrl: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    form: DefectForm
    saving?: boolean
    canSubmit?: boolean
    pendingFiles?: CaseDefectPendingFile[]
  }>(),
  {
    saving: false,
    canSubmit: true,
    pendingFiles: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
  'submit-and-continue': []
  'add-files': [files: File[]]
  'remove-file': [id: string]
  'add-inline-image': [payload: { file: File; src: string }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const attachmentWallItems = computed<AttachmentFileWallItem[]>(() => (
  props.pendingFiles.map(item => ({
    id: item.id,
    fileName: item.file.name,
    fileSize: item.file.size,
    contentType: item.file.type,
    imageUrl: item.previewUrl || undefined,
    metaText: '待上传',
    pending: true,
  }))
))

function addFiles(files: File[]) {
  if (!files.length || props.saving) {
    return
  }
  emit('add-files', files)
}
</script>

<template>
  <AppDrawer
    v-model="visible"
    title="创建缺陷"
    size="1198px"
    drawer-class="case-defect-editor-drawer-host"
  >
    <div class="case-defect-editor-drawer">
      <section class="case-defect-editor-drawer__main">
        <div class="case-defect-editor-drawer__field">
          <span class="is-required">缺陷标题</span>
          <el-input
            v-model="form.title"
            maxlength="120"
            show-word-limit
            placeholder="请输入缺陷标题"
            :disabled="saving"
          />
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">缺陷描述</span>
          <DefectRichTextEditor
            v-model="form.description"
            :disabled="saving"
            @add-inline-image="emit('add-inline-image', $event)"
          />
        </div>

        <div class="case-defect-editor-drawer__field">
          <span>附件 / 截图</span>
          <AttachmentFileWall
            :items="attachmentWallItems"
            :disabled="saving"
            :show-download="false"
            empty-title="点击上传，或将文件拖拽至此处"
            empty-description="支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB"
            @add-files="addFiles"
            @remove="emit('remove-file', String($event.id))"
          />
        </div>
      </section>

      <aside class="case-defect-editor-drawer__side">
        <div class="case-defect-editor-drawer__field">
          <span class="is-required">优先级</span>
          <div class="case-defect-editor-drawer__priority">
            <button
              v-for="item in defectPriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': form.priority === item.value }"
              :disabled="saving"
              @click="form.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">严重级别</span>
          <el-select v-model="form.severity" :disabled="saving" placeholder="请选择严重级别">
            <el-option
              v-for="item in defectSeverityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">处理人</span>
          <AppUserSelect
            v-model="form.assigneeId"
            :workspace-code="form.workspaceCode"
            :disabled="saving"
            placeholder="请选择处理人"
          />
        </div>

        <div class="case-defect-editor-drawer__field">
          <span>标签</span>
          <AppTagInput v-model="form.tags" :disabled="saving" placeholder="输入内容后回车可直接添加标签" />
        </div>
      </aside>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="visible = false">取消</AppButton>
      <AppButton :disabled="saving || !canSubmit" @click="emit('submit-and-continue')">
        保存并继续创建
      </AppButton>
      <AppButton type="primary" :loading="saving" :disabled="!canSubmit" @click="emit('submit')">
        创建
      </AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
:global(.case-defect-editor-drawer-host) {
  --case-defect-drawer-border: #e5e6eb;
  --case-defect-drawer-text-primary: #1d2129;
  --case-defect-drawer-text-secondary: #4e5969;
  --case-defect-drawer-text-muted: #86909c;
  --case-defect-drawer-bg-muted: #f7f8fa;
  --case-defect-drawer-primary: #165dff;
  --case-defect-drawer-danger: #f53f3f;
}

:global(.case-defect-editor-drawer-host.el-drawer) {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.case-defect-editor-drawer {
  display: grid;
  min-height: 100%;
  grid-template-columns: minmax(0, 1fr) 360px;
  background: #fff;
}

:global(.case-defect-editor-drawer-host .el-drawer__header) {
  box-sizing: border-box;
  flex: 0 0 52px;
  margin-bottom: 0;
  height: 52px;
  min-height: 52px;
  max-height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--case-defect-drawer-border);
  color: var(--case-defect-drawer-text-primary);
}

:global(.case-defect-editor-drawer-host .el-drawer__title) {
  color: var(--case-defect-drawer-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.case-defect-editor-drawer-host .el-drawer__close-btn) {
  width: 28px;
  height: 28px;
  padding: 6px;
  border-radius: 6px;
  color: var(--case-defect-drawer-text-muted);
}

:global(.case-defect-editor-drawer-host .el-drawer__close-btn:hover) {
  background: var(--case-defect-drawer-bg-muted);
  color: var(--case-defect-drawer-text-primary);
}

:global(.case-defect-editor-drawer-host .el-drawer__close-btn .el-icon) {
  width: 16px;
  height: 16px;
}

:global(.case-defect-editor-drawer-host .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
  overflow: auto;
}

:global(.case-defect-editor-drawer-host .el-drawer__footer) {
  padding: 0;
}

:global(.case-defect-editor-drawer-host .app-drawer__footer) {
  min-height: 58px;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--case-defect-drawer-border);
  background: var(--case-defect-drawer-bg-muted);
}

:global(.case-defect-editor-drawer-host .app-button.el-button) {
  min-height: 32px;
  padding: 6px 13px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-defect-editor-drawer-host .app-button.el-button--primary) {
  border-color: var(--case-defect-drawer-primary);
  background: var(--case-defect-drawer-primary);
}

.case-defect-editor-drawer__main,
.case-defect-editor-drawer__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px;
}

.case-defect-editor-drawer__side {
  border-left: 1px solid var(--case-defect-drawer-border);
  background: var(--case-defect-drawer-bg-muted);
}

.case-defect-editor-drawer__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.case-defect-editor-drawer__field > span {
  color: var(--case-defect-drawer-text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.case-defect-editor-drawer__field > span.is-required::after {
  margin-left: 3px;
  color: var(--case-defect-drawer-danger);
  content: '*';
}

.case-defect-editor-drawer__field :deep(.el-input__wrapper),
.case-defect-editor-drawer__field :deep(.el-select__wrapper) {
  min-height: 34px;
  padding: 1px 13px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--case-defect-drawer-border) inset;
}

.case-defect-editor-drawer__field :deep(.el-input__wrapper.is-focus),
.case-defect-editor-drawer__field :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--case-defect-drawer-primary) inset, 0 0 0 2px rgba(22, 93, 255, 0.1);
}

.case-defect-editor-drawer__field :deep(.el-input__inner),
.case-defect-editor-drawer__field :deep(.el-select__placeholder),
.case-defect-editor-drawer__field :deep(.el-select__selected-item) {
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-defect-editor-drawer__priority {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.case-defect-editor-drawer__priority button {
  box-sizing: border-box;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--case-defect-drawer-border);
  border-radius: 4px;
  background: #fff;
  color: var(--case-defect-drawer-text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.case-defect-editor-drawer__priority button:hover,
.case-defect-editor-drawer__priority button.is-active {
  border-color: var(--case-defect-drawer-primary);
  background: rgba(22, 93, 255, 0.08);
  color: var(--case-defect-drawer-primary);
}

.case-defect-editor-drawer__priority button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor) {
  border-color: var(--case-defect-drawer-border);
  border-radius: 6px;
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor__toolbar) {
  min-height: 38px;
  padding: 4px 8px;
  border-bottom-color: var(--case-defect-drawer-border);
  background: var(--case-defect-drawer-bg-muted);
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor__button),
.case-defect-editor-drawer :deep(.defect-rich-text-editor__select) {
  height: 28px;
  border-radius: 4px;
  color: var(--case-defect-drawer-text-secondary);
  font-size: 12px;
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor__button:hover),
.case-defect-editor-drawer :deep(.defect-rich-text-editor__select:hover),
.case-defect-editor-drawer :deep(.defect-rich-text-editor__button.is-active) {
  background: #fff;
  color: var(--case-defect-drawer-primary);
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor__content) {
  min-height: 300px;
}

.case-defect-editor-drawer :deep(.defect-rich-text-editor__content .defect-rich-text-editor__input) {
  min-height: 272px;
  padding: 12px 14px;
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
  line-height: 22px;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__drop-zone) {
  min-height: 112px;
  border-color: var(--case-defect-drawer-border);
  border-radius: 4px;
  background: var(--case-defect-drawer-bg-muted);
}

.case-defect-editor-drawer :deep(.attachment-file-wall__drop-zone.has-files) {
  min-height: 180px;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__drop-zone > span) {
  color: var(--case-defect-drawer-text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__drop-zone > em) {
  color: var(--case-defect-drawer-text-muted);
  font-size: 11px;
  line-height: 17px;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__file) {
  border-color: var(--case-defect-drawer-border);
  box-shadow: none;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__meta > strong) {
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.case-defect-editor-drawer :deep(.attachment-file-wall__meta-row > span) {
  color: var(--case-defect-drawer-text-muted);
}

@media (max-width: 1080px) {
  .case-defect-editor-drawer {
    grid-template-columns: 1fr;
  }

  .case-defect-editor-drawer__side {
    border-top: 1px solid var(--app-border-soft);
    border-left: 0;
  }
}
</style>
