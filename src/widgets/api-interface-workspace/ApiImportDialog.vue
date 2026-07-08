<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Check as LucideCheck,
  FileJson as LucideFileJson,
  FileText as LucideFileText,
  Link as LucideLink,
  Upload as LucideUpload,
  X as LucideX,
} from '@lucide/vue'

type ApiImportMode = 'swagger' | 'postman' | 'har'
type ApiImportInputMode = 'url' | 'file'

interface ImportModuleOption {
  label: string
  value: string
  workspaceCode: string
}

const props = defineProps<{
  modelValue: boolean
  mode: ApiImportMode
  inputMode: ApiImportInputMode
  url: string
  fileName: string
  directoryName: string
  submitting: boolean
  moduleOptions: ImportModuleOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:mode': [value: ApiImportMode]
  'update:inputMode': [value: ApiImportInputMode]
  'update:url': [value: string]
  'update:directoryName': [value: string]
  close: []
  submit: []
  'file-change': [file: File | null]
}>()

const importCapabilityItems: Array<{
  mode: ApiImportMode
  name: string
  description: string
  status: string
  accept: string
  icon: Component
  tone: 'green' | 'orange' | 'purple' | 'blue'
}> = [
  {
    mode: 'swagger',
    name: 'Swagger / OpenAPI',
    description: '支持 Swagger 2.0 / OpenAPI 3.x',
    status: '已支持批量导入',
    accept: '.json,.yaml,.yml',
    icon: LucideLink,
    tone: 'green',
  },
  {
    mode: 'postman',
    name: 'Postman Collection',
    description: '支持 Postman v2.0 / v2.1 格式',
    status: '已支持批量导入',
    accept: '.json',
    icon: LucideFileJson,
    tone: 'orange',
  },
  {
    mode: 'har',
    name: 'HAR 文件',
    description: '浏览器导出的 HTTP 存档文件',
    status: '已支持批量导入',
    accept: '.har',
    icon: LucideFileText,
    tone: 'purple',
  },
]

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const selectedImportCapability = computed(() => (
  importCapabilityItems.find(item => item.mode === props.mode) || importCapabilityItems[0]
))

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('file-change', input.files?.[0] || null)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="520px"
    append-to-body
    destroy-on-close
    :show-close="false"
    class="api-import-dialog-shell"
  >
    <div class="api-import-dialog">
      <div class="api-import-header">
        <div class="api-import-title">
          <LucideUpload class="api-import-title-icon" />
          <span>导入接口</span>
        </div>
        <button type="button" class="api-import-close" @click="emit('close')">
          <LucideX />
        </button>
      </div>

      <div class="api-import-body">
        <section class="api-import-section">
          <div class="api-import-section-title">选择导入格式</div>
          <div class="api-import-format-list">
            <button
              v-for="item in importCapabilityItems"
              :key="item.mode"
              type="button"
              :class="['api-import-format', `is-${item.tone}`, { 'is-active': mode === item.mode }]"
              @click="emit('update:mode', item.mode)"
            >
              <span class="api-import-format-icon">
                <component :is="item.icon" />
              </span>
              <span class="api-import-format-copy">
                <span>{{ item.name }}</span>
                <small>{{ item.description }}</small>
              </span>
              <span class="api-import-check">
                <LucideCheck v-if="mode === item.mode" />
              </span>
            </button>
          </div>
        </section>

        <section class="api-import-section">
          <div class="api-import-section-title">导入方式</div>
          <div class="api-import-mode-switch">
            <button
              type="button"
              :class="{ 'is-active': inputMode === 'url' }"
              @click="emit('update:inputMode', 'url')"
            >
              URL 导入
            </button>
            <button
              type="button"
              :class="{ 'is-active': inputMode === 'file' }"
              @click="emit('update:inputMode', 'file')"
            >
              文件上传
            </button>
          </div>
          <el-input
            v-if="inputMode === 'url'"
            :model-value="url"
            class="api-import-url"
            :placeholder="mode === 'swagger' ? 'https://api.example.com/v3/api-docs' : '输入文件远程地址'"
            @update:model-value="(value: string) => emit('update:url', value)"
          />
          <label v-else class="api-import-upload">
            <LucideUpload class="api-import-upload-icon" />
            <span>{{ fileName || '点击或拖拽文件到此处' }}</span>
            <small>支持 {{ selectedImportCapability.accept }}</small>
            <input
              type="file"
              :accept="selectedImportCapability.accept"
              @change="handleFileChange"
            >
          </label>
          <div class="api-import-field">
            <span>所属模块</span>
            <el-select
              :model-value="directoryName"
              clearable
              filterable
              placeholder="根目录"
              @update:model-value="(value: string) => emit('update:directoryName', value || '')"
            >
              <el-option
                v-for="item in moduleOptions"
                :key="`${item.workspaceCode}:${item.value || 'root'}`"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </section>
      </div>

      <div class="api-import-footer">
        <button type="button" class="api-import-cancel" :disabled="submitting" @click="emit('close')">取消</button>
        <button type="button" class="api-import-submit" :disabled="submitting" @click="emit('submit')">
          {{ submitting ? '导入中...' : '开始导入' }}
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:global(.el-dialog.api-import-dialog-shell),
:global(.el-dialog.api-import-dialog-shell .el-button),
:global(.el-dialog.api-import-dialog-shell .el-input__inner),
:global(.el-dialog.api-import-dialog-shell .el-upload) {
  font-family: Inter, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
}

:global(.el-dialog.api-import-dialog-shell) {
  overflow: hidden;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 16px;
  line-height: 24px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header),
:global(.el-dialog.api-import-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header) {
  display: block;
  height: 64px;
}

.api-import-dialog {
  display: grid;
  gap: 0;
  overflow: hidden;
  background: #fff;
  color: #374151;
  font-size: 13px;
  line-height: 21px;
}

.api-import-header,
.api-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.api-import-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.api-import-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-import-title-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.api-import-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  line-height: normal;
}

.api-import-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-import-close svg {
  width: 16px;
  height: 16px;
}

.api-import-body {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.api-import-section {
  display: grid;
  gap: 12px;
}

.api-import-section-title {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  height: 21px;
  line-height: 21px;
}

.api-import-format-list {
  display: grid;
  gap: 8px;
}

.api-import-format {
  display: grid;
  width: 100%;
  height: 64px;
  grid-template-columns: 36px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 13.3333px;
  line-height: normal;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-format:nth-child(3) {
  height: 68px;
}

.api-import-format:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.api-import-format.is-active.is-green {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.api-import-format.is-active.is-orange {
  border-color: #fed7aa;
  background: #fff7ed;
}

.api-import-format.is-active.is-purple {
  border-color: #e9d5ff;
  background: #faf5ff;
}

.api-import-format-icon,
.api-import-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.api-import-format-icon {
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  color: #9ca3af;
}

.api-import-format.is-active.is-green .api-import-format-icon {
  background: #dcfce7;
  color: #16a34a;
}

.api-import-format.is-active.is-orange .api-import-format-icon {
  background: #ffedd5;
  color: #ea580c;
}

.api-import-format.is-active.is-purple .api-import-format-icon {
  background: #f3e8ff;
  color: #9333ea;
}

.api-import-format-icon svg {
  width: 18px;
  height: 18px;
}

.api-import-format-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  line-height: normal;
}

.api-import-format-copy > span {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.api-import-format-copy small {
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-import-check {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  color: #2563eb;
}

.api-import-check svg {
  width: 12px;
  height: 12px;
}

.api-import-mode-switch {
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: #f3f4f6;
}

.api-import-mode-switch button {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.api-import-mode-switch button.is-active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.api-import-url :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-import-url :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-import-upload {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-upload:hover {
  border-color: #60a5fa;
  background: #eff6ff;
}

.api-import-upload input {
  display: none;
}

.api-import-upload-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
}

.api-import-upload small {
  color: #9ca3af;
  font-size: 12px;
}

.api-import-field {
  display: grid;
  gap: 6px;
}

.api-import-field > span {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.api-import-field small {
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
}

.api-import-field :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-import-field :deep(.el-select__wrapper.is-focused) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-import-footer {
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
}

.api-import-cancel,
.api-import-submit {
  height: 36px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.api-import-cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #374151;
}

.api-import-cancel:hover {
  background: #f3f4f6;
}

.api-import-submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-import-submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}
</style>
