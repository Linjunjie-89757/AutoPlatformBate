<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FolderTree, ListFilter, MousePointerClick, Upload, X } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  caseApi,
  type CaseClientFilter,
  type CaseExportScope,
  type CaseImportDuplicateStrategy,
  type CaseImportResult,
} from '@/entities/case'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

const props = defineProps<{
  modelValue: boolean
  workspaceCode: string
  workspaceName: string
  directoryId: number | null
  directoryName: string
  defaultTab: 'import' | 'export'
  canImport: boolean
  canExport: boolean
  selectedCaseIds: number[]
  filter: CaseClientFilter
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const duplicateStrategy = ref<CaseImportDuplicateStrategy>('SKIP')
const importing = ref(false)
const downloading = ref(false)
const dragActive = ref(false)
const result = ref<CaseImportResult | null>(null)
const errorMessage = ref('')
const activeTab = ref<'import' | 'export'>('import')
const exportScope = ref<CaseExportScope>('FILTERED')
const exporting = ref(false)
const exportErrorMessage = ref('')

const canSubmitImport = computed(() => Boolean(selectedFile.value) && !importing.value)
const canSubmitExport = computed(() => props.canExport
  && !exporting.value
  && (exportScope.value !== 'SELECTED' || props.selectedCaseIds.length > 0))

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  selectedFile.value = null
  duplicateStrategy.value = 'SKIP'
  importing.value = false
  dragActive.value = false
  result.value = null
  errorMessage.value = ''
  activeTab.value = props.defaultTab === 'export' && props.canExport ? 'export' : 'import'
  exportScope.value = props.selectedCaseIds.length ? 'SELECTED' : 'FILTERED'
  exporting.value = false
  exportErrorMessage.value = ''
})

function closeDialog() {
  if (importing.value || exporting.value) return
  emit('update:modelValue', false)
}

function openFilePicker() {
  if (importing.value) return
  fileInputRef.value?.click()
}

function acceptFile(file?: File | null) {
  if (!file) return
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    ElMessage.warning('请选择 .xlsx 或 .xls 文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('Excel 文件不能超过 5 MB')
    return
  }
  selectedFile.value = file
  result.value = null
  errorMessage.value = ''
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFile(input.files?.[0])
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

function removeFile() {
  if (importing.value) return
  selectedFile.value = null
  result.value = null
  errorMessage.value = ''
}

async function downloadTemplate() {
  downloading.value = true
  try {
    const blob = await caseApi.downloadCaseImportTemplate()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = '用例导入模板.xlsx'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    downloading.value = false
  }
}

async function submitImport() {
  if (!selectedFile.value || importing.value) return
  importing.value = true
  result.value = null
  errorMessage.value = ''
  try {
    const response = await caseApi.importCases(props.workspaceCode, {
      file: selectedFile.value,
      directoryId: props.directoryId,
      duplicateStrategy: duplicateStrategy.value,
    })
    result.value = response
    if (response.createdCount > 0) {
      emit('imported')
    }
    if (response.failedCount > 0 || response.skippedCount > 0) {
      ElMessage.warning(`导入完成：成功 ${response.createdCount} 条，跳过 ${response.skippedCount} 条，失败 ${response.failedCount} 条`)
    } else {
      ElMessage.success(`已导入 ${response.createdCount} 条用例`)
    }
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    importing.value = false
  }
}

function buildExportFileName() {
  const safeWorkspaceName = props.workspaceName.replace(/[\\/:*?"<>|]/g, '_')
  const safeDirectoryName = props.directoryName.replace(/[\\/:*?"<>|]/g, '_')
  const date = new Date()
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  return `${safeWorkspaceName}_${safeDirectoryName}_测试用例_${timestamp}.xlsx`
}

async function submitExport() {
  if (!canSubmitExport.value) return
  exporting.value = true
  exportErrorMessage.value = ''
  try {
    const blob = await caseApi.exportCases(props.workspaceCode, {
      scope: exportScope.value,
      caseIds: exportScope.value === 'SELECTED' ? props.selectedCaseIds : undefined,
      directoryId: props.directoryId,
      keyword: exportScope.value === 'FILTERED' ? props.filter.keyword : undefined,
      priority: exportScope.value === 'FILTERED' ? props.filter.priority : undefined,
      reviewStatus: exportScope.value === 'FILTERED' ? props.filter.reviewStatus : undefined,
      executionStatus: exportScope.value === 'FILTERED' ? props.filter.executionStatus : undefined,
      executorName: exportScope.value === 'FILTERED' ? props.filter.executorName : undefined,
      createdByName: exportScope.value === 'FILTERED' ? props.filter.createdByName : undefined,
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = buildExportFileName()
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('Excel 导出成功')
    emit('update:modelValue', false)
  } catch (error) {
    exportErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="导入/导出用例"
    width="640px"
    dialog-class="case-import-dialog-shell"
    @update:model-value="value => { if (!value) closeDialog() }"
  >
    <div class="case-import-dialog">
      <el-tabs v-model="activeTab" class="case-import-dialog__tabs">
        <el-tab-pane label="导入用例" name="import" :disabled="!props.canImport" />
        <el-tab-pane label="导出用例" name="export" :disabled="!props.canExport" />
      </el-tabs>

      <section class="case-import-dialog__location">
        <div>
          <span>工作空间</span>
          <strong>{{ workspaceName }}</strong>
        </div>
        <i />
        <div>
          <span>用例路径</span>
          <strong :title="directoryName">{{ directoryName }}</strong>
        </div>
      </section>

      <template v-if="activeTab === 'import'">
      <section class="case-import-dialog__section">
        <header>
          <div>
            <h4>Excel 文件</h4>
            <p>.xlsx / .xls，单次最多 500 条</p>
          </div>
          <button type="button" :disabled="downloading" @click="downloadTemplate">
            <Download />
            {{ downloading ? '下载中' : '下载模板' }}
          </button>
        </header>

        <input
          ref="fileInputRef"
          class="case-import-dialog__file-input"
          type="file"
          accept=".xlsx,.xls"
          @change="handleFileChange"
        />

        <button
          v-if="!selectedFile"
          type="button"
          class="case-import-dialog__dropzone"
          :class="{ 'is-dragging': dragActive }"
          @click="openFilePicker"
          @dragenter.prevent="dragActive = true"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="handleDrop"
        >
          <span><Upload /></span>
          <strong>选择或拖入 Excel 文件</strong>
        </button>

        <div v-else class="case-import-dialog__file">
          <span><FileSpreadsheet /></span>
          <div>
            <strong :title="selectedFile.name">{{ selectedFile.name }}</strong>
            <small>{{ (selectedFile.size / 1024).toFixed(1) }} KB</small>
          </div>
          <button type="button" title="移除文件" :disabled="importing" @click="removeFile"><X /></button>
        </div>
      </section>

      <section class="case-import-dialog__section">
        <header><h4>同名用例</h4></header>
        <el-radio-group v-model="duplicateStrategy" :disabled="importing" class="case-import-dialog__radios">
          <el-radio value="SKIP">跳过当前路径中的同名用例</el-radio>
          <el-radio value="ALLOW">仍然创建</el-radio>
        </el-radio-group>
      </section>

      <div v-if="errorMessage" class="case-import-dialog__error">
        <AlertCircle />
        <span>{{ errorMessage }}</span>
      </div>

      <section v-if="result" class="case-import-dialog__result">
        <header>
          <CheckCircle2 />
          <div>
            <strong>导入完成</strong>
            <span>成功 {{ result.createdCount }} · 跳过 {{ result.skippedCount }} · 失败 {{ result.failedCount }}</span>
          </div>
        </header>
        <div v-if="result.issues.length" class="case-import-dialog__issues">
          <div v-for="issue in result.issues" :key="`${issue.rowNumber}-${issue.type}`">
            <span :class="`is-${issue.type.toLowerCase()}`">第 {{ issue.rowNumber }} 行</span>
            <strong :title="issue.title">{{ issue.title }}</strong>
            <small>{{ issue.message }}</small>
          </div>
        </div>
      </section>
      </template>

      <template v-else>
        <section class="case-import-dialog__section">
          <header>
            <div>
              <h4>导出范围</h4>
              <p>导出完整结果，不受列表当前分页影响</p>
            </div>
          </header>
          <el-radio-group v-model="exportScope" class="case-import-dialog__export-scopes" :disabled="exporting">
            <el-radio value="SELECTED" :disabled="selectedCaseIds.length === 0">
              <span class="case-import-dialog__export-icon"><MousePointerClick /></span>
              <span class="case-import-dialog__export-copy">
                <strong>导出选中用例</strong>
                <small>{{ selectedCaseIds.length ? `已选择 ${selectedCaseIds.length} 条用例` : '请先在用例列表中勾选用例' }}</small>
              </span>
            </el-radio>
            <el-radio value="FILTERED">
              <span class="case-import-dialog__export-icon"><ListFilter /></span>
              <span class="case-import-dialog__export-copy">
                <strong>当前筛选结果</strong>
                <small>按当前目录、关键词、优先级和状态等筛选条件导出</small>
              </span>
            </el-radio>
            <el-radio value="DIRECTORY">
              <span class="case-import-dialog__export-icon"><FolderTree /></span>
              <span class="case-import-dialog__export-copy">
                <strong>当前目录全部用例</strong>
                <small>包含“{{ directoryName }}”及其所有子目录中的用例</small>
              </span>
            </el-radio>
          </el-radio-group>
        </section>

        <section class="case-import-dialog__section">
          <header><h4>导出格式</h4></header>
          <div class="case-import-dialog__format">
            <span><FileSpreadsheet /></span>
            <div>
              <strong>Excel 工作簿</strong>
              <small>.xlsx，包含用例信息、步骤、预期结果和状态</small>
            </div>
            <em>Excel</em>
          </div>
        </section>

        <div v-if="exportErrorMessage" class="case-import-dialog__error">
          <AlertCircle />
          <span>{{ exportErrorMessage }}</span>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="case-import-dialog__footer">
        <AppButton :disabled="importing || exporting" @click="closeDialog">{{ activeTab === 'import' && result ? '关闭' : '取消' }}</AppButton>
        <AppButton v-if="activeTab === 'import' && !result" type="primary" :loading="importing" :disabled="!canSubmitImport" @click="submitImport">
          开始导入
        </AppButton>
        <AppButton v-if="activeTab === 'export'" type="primary" :loading="exporting" :disabled="!canSubmitExport" @click="submitExport">
          导出 Excel
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.case-import-dialog__tabs {
  margin: -8px 0 0;
}

.case-import-dialog__tabs :deep(.el-tabs__header) {
  margin: 0;
}

.case-import-dialog__tabs :deep(.el-tabs__content) {
  display: none;
}

.case-import-dialog__tabs :deep(.el-tabs__item) {
  height: 36px;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
}

.case-import-dialog__tabs :deep(.el-tabs__item.is-active) {
  color: #165dff;
}

.case-import-dialog__tabs :deep(.el-tabs__active-bar) {
  background: #165dff;
}

.case-import-dialog__location {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1.35fr);
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #f7f8fa;
}

.case-import-dialog__location div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.case-import-dialog__location span {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.case-import-dialog__location strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__location i {
  width: 1px;
  height: 28px;
  background: #e5e6eb;
}

.case-import-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.case-import-dialog__section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.case-import-dialog__section h4 {
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.case-import-dialog__section p {
  margin: 1px 0 0;
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.case-import-dialog__section > header button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.case-import-dialog__section > header button svg {
  width: 13px;
  height: 13px;
}

.case-import-dialog__file-input {
  display: none;
}

.case-import-dialog__dropzone {
  display: flex;
  min-height: 112px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  border: 1px dashed #c9cdd4;
  border-radius: 6px;
  background: #fafbfc;
  color: #4e5969;
  cursor: pointer;
}

.case-import-dialog__dropzone:hover,
.case-import-dialog__dropzone.is-dragging {
  border-color: #165dff;
  background: #f2f7ff;
  color: #165dff;
}

.case-import-dialog__dropzone span,
.case-import-dialog__file > span {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #e8f3ff;
  color: #165dff;
}

.case-import-dialog__dropzone svg,
.case-import-dialog__file > span svg {
  width: 16px;
  height: 16px;
}

.case-import-dialog__dropzone strong {
  font-size: 12px;
  font-weight: 500;
}

.case-import-dialog__file {
  display: grid;
  min-width: 0;
  grid-template-columns: 32px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.case-import-dialog__file div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.case-import-dialog__file strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__file small {
  color: #86909c;
  font-size: 11px;
}

.case-import-dialog__file > button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.case-import-dialog__file > button svg {
  width: 14px;
  height: 14px;
}

.case-import-dialog__radios {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 24px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.case-import-dialog__radios :deep(.el-radio) {
  height: 32px;
  margin-right: 0;
  color: #4e5969;
  font-size: 12px;
}

.case-import-dialog__export-scopes {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.case-import-dialog__export-scopes :deep(.el-radio) {
  display: grid;
  width: 100%;
  height: auto;
  min-height: 58px;
  grid-template-columns: 14px 32px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 9px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.case-import-dialog__export-scopes :deep(.el-radio.is-checked) {
  border-color: #94bfff;
  background: #f2f7ff;
}

.case-import-dialog__export-scopes :deep(.el-radio.is-disabled) {
  background: #f7f8fa;
}

.case-import-dialog__export-scopes :deep(.el-radio__label) {
  display: contents;
  padding: 0;
}

.case-import-dialog__export-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #f2f3f5;
  color: #4e5969;
}

.case-import-dialog__export-icon svg {
  width: 15px;
  height: 15px;
}

.case-import-dialog__export-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.case-import-dialog__export-copy strong,
.case-import-dialog__format strong {
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-import-dialog__export-copy small,
.case-import-dialog__format small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__format {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.case-import-dialog__format > span {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #e8f3ff;
  color: #165dff;
}

.case-import-dialog__format > span svg {
  width: 16px;
  height: 16px;
}

.case-import-dialog__format > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.case-import-dialog__format em {
  padding: 2px 7px;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
}

.case-import-dialog__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #ffd4d6;
  border-radius: 6px;
  background: #fff2f3;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.case-import-dialog__error svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin-top: 1px;
}

.case-import-dialog__result {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.case-import-dialog__result > header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #f0fff4;
  color: #00b42a;
}

.case-import-dialog__result > header svg {
  width: 18px;
  height: 18px;
}

.case-import-dialog__result > header div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.case-import-dialog__result > header strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
}

.case-import-dialog__result > header span {
  color: #4e5969;
  font-size: 11px;
}

.case-import-dialog__issues {
  max-height: 156px;
  overflow: auto;
}

.case-import-dialog__issues > div {
  display: grid;
  min-width: 0;
  grid-template-columns: 74px minmax(100px, .8fr) minmax(0, 1.4fr);
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 14px;
  border-top: 1px solid #f0f1f2;
}

.case-import-dialog__issues span {
  color: #86909c;
  font-size: 11px;
}

.case-import-dialog__issues span.is-failed {
  color: #f53f3f;
}

.case-import-dialog__issues strong,
.case-import-dialog__issues small {
  overflow: hidden;
  font-size: 11px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__issues strong {
  color: #1d2129;
}

.case-import-dialog__issues small {
  color: #86909c;
}

.case-import-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
