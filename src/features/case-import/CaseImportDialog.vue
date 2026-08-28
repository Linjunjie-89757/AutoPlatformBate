<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertCircle, AlertTriangle, CheckCircle, Download, FileText, Folder, RefreshCw, Upload, X } from '@lucide/vue'
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
const importFailureMessage = ref('')
const activeTab = ref<'import' | 'export'>('import')
const exportScope = ref<CaseExportScope>('ALL')
const exporting = ref(false)
const exportErrorMessage = ref('')
const exportFormat = ref<'xlsx' | 'csv' | 'xmind'>('xlsx')
const exportCounts = ref({ all: 0, directory: 0 })

const dialogClass = computed(() => {
  if (activeTab.value === 'export') {
    return `case-import-dialog-shell case-import-dialog-shell--export ${props.selectedCaseIds.length === 0 ? 'case-import-dialog-shell--export-empty' : ''}`
  }
  if (result.value) {
    return `case-import-dialog-shell case-import-dialog-shell--import-result ${result.value.failedCount === 0 && result.value.skippedCount === 0 ? 'case-import-dialog-shell--import-success' : 'case-import-dialog-shell--import-partial'}`
  }
  if (importFailureMessage.value) return 'case-import-dialog-shell case-import-dialog-shell--import-failed'
  if (importing.value) return 'case-import-dialog-shell case-import-dialog-shell--import-parsing'
  if (selectedFile.value) return 'case-import-dialog-shell case-import-dialog-shell--import-selected'
  return 'case-import-dialog-shell case-import-dialog-shell--import-default'
})

const canSubmitImport = computed(() => Boolean(selectedFile.value) && !importing.value)
const canSubmitExport = computed(() => props.canExport
  && !exporting.value
  && (exportScope.value !== 'SELECTED' || props.selectedCaseIds.length > 0))

const importResultTitle = '导入 / 导出用例'

function switchTab(tab: 'import' | 'export') {
  if (activeTab.value === tab) return
  activeTab.value = tab
  selectedFile.value = null
  duplicateStrategy.value = 'SKIP'
  importing.value = false
  dragActive.value = false
  result.value = null
  errorMessage.value = ''
  importFailureMessage.value = ''
  exportErrorMessage.value = ''
  exportScope.value = 'ALL'
  exportFormat.value = 'xlsx'
  exporting.value = false
}

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  selectedFile.value = null
  duplicateStrategy.value = 'SKIP'
  importing.value = false
  dragActive.value = false
  result.value = null
  errorMessage.value = ''
  importFailureMessage.value = ''
  activeTab.value = props.defaultTab === 'export' && props.canExport ? 'export' : 'import'
  exportScope.value = 'ALL'
  exportFormat.value = 'xlsx'
  exporting.value = false
  exportErrorMessage.value = ''
  void loadExportCounts()
})

async function loadExportCounts() {
  if (!props.canExport) return
  try {
    const [allCases, directoryCases] = await Promise.all([
      caseApi.getCases(props.workspaceCode, { pageNo: 1, pageSize: 1 }),
      caseApi.getCases(props.workspaceCode, { pageNo: 1, pageSize: 1, directoryId: props.directoryId }),
    ])
    exportCounts.value = {
      all: allCases.total,
      directory: directoryCases.total,
    }
  } catch {
    exportCounts.value = { all: 0, directory: 0 }
  }
}

function closeDialog() {
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
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('Excel 文件不能超过 10 MB')
    return
  }
  selectedFile.value = file
  result.value = null
  errorMessage.value = ''
  importFailureMessage.value = ''
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
  importFailureMessage.value = ''
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
  if (duplicateStrategy.value === 'OVERWRITE' || duplicateStrategy.value === 'RENAME') {
    errorMessage.value = `当前暂不支持“${duplicateStrategy.value === 'OVERWRITE' ? '覆盖' : '重命名'}”策略，请先选择“跳过”`
    return
  }
  importing.value = true
  result.value = null
  errorMessage.value = ''
  importFailureMessage.value = ''
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
    importFailureMessage.value = getRequestErrorMessage(error)
  } finally {
    importing.value = false
  }
}

function downloadImportIssues() {
  if (!result.value?.issues.length) return
  const rows = [
    ['行号', '用例标题', '处理结果', '原因'],
    ...result.value.issues.map(issue => [
      String(issue.rowNumber),
      issue.title,
      issue.type === 'SKIPPED' ? '跳过' : '失败',
      issue.message,
    ]),
  ]
  const csv = `\uFEFF${rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '用例导入处理明细.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function resetImport() {
  if (importing.value) return
  selectedFile.value = null
  result.value = null
  errorMessage.value = ''
  importFailureMessage.value = ''
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
  if (exportFormat.value !== 'xlsx') {
    ElMessage.info('当前仅支持 Excel (.xlsx) 导出')
    return
  }
  exporting.value = true
  exportErrorMessage.value = ''
  try {
    const blob = await caseApi.exportCases(props.workspaceCode, {
      scope: exportScope.value,
      caseIds: exportScope.value === 'SELECTED' ? props.selectedCaseIds : undefined,
      directoryId: exportScope.value === 'DIRECTORY' ? props.directoryId : undefined,
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
    :title="importResultTitle"
    width="640px"
    modal-class="case-import-dialog-modal"
    :dialog-class="dialogClass"
    align-center
    @update:model-value="value => { if (!value) closeDialog() }"
  >
    <template #header>
      <div class="case-import-dialog__header">
        <div class="case-import-dialog__header-main">
          <strong>{{ importResultTitle }}</strong>
          <button type="button" class="case-import-dialog__close" title="关闭" @click="closeDialog">
            <X />
          </button>
        </div>
        <div class="case-import-dialog__tabs" role="tablist" aria-label="用例导入导出">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'import'"
            :disabled="!props.canImport"
            :class="{ 'is-active': activeTab === 'import' }"
            @click="switchTab('import')"
          >导入用例</button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'export'"
            :disabled="!props.canExport"
            :class="{ 'is-active': activeTab === 'export' }"
            @click="switchTab('export')"
          >导出用例</button>
        </div>
      </div>
    </template>

    <div class="case-import-dialog">

      <section v-if="!result" class="case-import-dialog__location">
        <Folder />
        <span><strong>{{ activeTab === 'import' ? '导入目录：' : '当前目录：' }}</strong>{{ directoryName }}</span>
        <button v-if="activeTab === 'import'" type="button" @click="ElMessage.info('请先在用例列表中切换目标目录')">更改</button>
      </section>

      <template v-if="activeTab === 'import' && importing">
        <section class="case-import-dialog__parsing">
          <span class="case-import-dialog__parsing-icon"><RefreshCw /></span>
          <strong>正在解析文件...</strong>
          <span>{{ selectedFile?.name }}</span>
          <div class="case-import-dialog__progress"><i /></div>
          <small>正在校验字段格式与目录映射...</small>
        </section>
      </template>

      <template v-else-if="activeTab === 'import' && importFailureMessage">
        <section class="case-import-dialog__failure-result">
          <span class="case-import-dialog__failure-icon"><X /></span>
          <strong>解析失败</strong>
          <p>文件格式错误或数据无法解析，请检查文件后重试</p>
          <div class="case-import-dialog__failure-message">错误信息：{{ importFailureMessage }}</div>
        </section>
      </template>

      <template v-else-if="activeTab === 'import' && !result">
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
          <strong>{{ dragActive ? '松开鼠标即可上传' : '拖拽文件到此处，或点击选择文件' }}</strong>
          <small>支持 .xlsx / .xls 格式，文件大小不超过 10MB</small>
        </button>

        <div v-else class="case-import-dialog__file">
            <span><FileText /></span>
            <div>
              <strong :title="selectedFile.name">{{ selectedFile.name }}</strong>
            <small>{{ (selectedFile.size / 1024).toFixed(1) }} KB · Excel 文件</small>
          </div>
          <button type="button" title="移除文件" :disabled="importing" @click="removeFile"><X /></button>
        </div>

      <section class="case-import-dialog__section">
        <header><h4>同名用例处理方式</h4></header>
        <div class="case-import-dialog__radios" :class="{ 'is-disabled': importing }">
          <label class="case-import-dialog__radio-option" :class="{ 'is-active': duplicateStrategy === 'SKIP' }">
            <input v-model="duplicateStrategy" type="radio" value="SKIP" :disabled="importing" />
            <span class="case-import-dialog__radio-indicator"><i /></span>
            <span class="case-import-dialog__radio-copy">
              <strong>跳过</strong>
              <small>保留现有用例，不导入同名用例</small>
            </span>
          </label>
          <label class="case-import-dialog__radio-option" :class="{ 'is-active': duplicateStrategy === 'OVERWRITE' }">
            <input v-model="duplicateStrategy" type="radio" value="OVERWRITE" :disabled="importing" />
            <span class="case-import-dialog__radio-indicator"><i /></span>
            <span class="case-import-dialog__radio-copy">
              <strong>覆盖</strong>
              <small>用导入数据替换现有同名用例</small>
            </span>
          </label>
          <label class="case-import-dialog__radio-option" :class="{ 'is-active': duplicateStrategy === 'RENAME' }">
            <input v-model="duplicateStrategy" type="radio" value="RENAME" :disabled="importing" />
            <span class="case-import-dialog__radio-indicator"><i /></span>
            <span class="case-import-dialog__radio-copy">
              <strong>重命名</strong>
              <small>自动在标题后加序号，如：登录测试 (2)</small>
            </span>
          </label>
        </div>
      </section>

      <button type="button" class="case-import-dialog__template-link" :disabled="downloading" @click="downloadTemplate">
        <Download />
        {{ downloading ? '下载中' : '下载导入模板' }}
      </button>

      <div v-if="errorMessage" class="case-import-dialog__error">
        <AlertCircle />
        <span>{{ errorMessage }}</span>
      </div>

      </template>

      <template v-if="activeTab === 'import' && result">
        <section v-if="result.failedCount === 0 && result.skippedCount === 0" class="case-import-dialog__success-result">
          <span class="case-import-dialog__result-icon is-success"><CheckCircle /></span>
          <strong>全部导入成功</strong>
          <p>共 {{ result.createdCount }} 条用例已成功导入到“{{ directoryName }}”目录</p>
          <div class="case-import-dialog__result-stats">
            <div><strong>{{ result.createdCount }}</strong><span>成功导入</span></div>
            <div><strong>{{ result.skippedCount }}</strong><span>跳过</span></div>
            <div><strong>{{ result.failedCount }}</strong><span>失败</span></div>
          </div>
        </section>
        <section v-else class="case-import-dialog__partial-result">
          <header>
            <span class="case-import-dialog__result-icon is-warning"><AlertTriangle /></span>
            <div>
              <strong>部分导入成功</strong>
              <span>
                共 {{ result.totalRows }} 条 · 成功 <em class="is-success">{{ result.createdCount }}</em> ·
                跳过 <em class="is-skipped">{{ result.skippedCount }}</em> ·
                失败 <em class="is-failed">{{ result.failedCount }}</em>
              </span>
            </div>
            <button v-if="result.issues.length" type="button" @click="downloadImportIssues">
              <Download />下载明细
            </button>
          </header>
          <div class="case-import-dialog__result-stats">
            <div><strong>{{ result.createdCount }}</strong><span>成功导入</span></div>
            <div><strong>{{ result.skippedCount }}</strong><span>跳过（重名）</span></div>
            <div><strong>{{ result.failedCount }}</strong><span>导入失败</span></div>
          </div>
          <div v-if="result.issues.length" class="case-import-dialog__issues">
            <div class="case-import-dialog__issues-title"><AlertTriangle />失败明细<span>共 {{ result.issues.length }} 条</span></div>
            <div v-for="issue in result.issues" :key="`${issue.rowNumber}-${issue.type}`">
              <span :class="`is-${issue.type.toLowerCase()}`">第 {{ issue.rowNumber }} 行</span>
              <strong :title="issue.title">{{ issue.title || '（空）' }}</strong>
              <small>{{ issue.message }}</small>
            </div>
          </div>
        </section>
      </template>

      <template v-if="activeTab === 'export'">
        <section class="case-import-dialog__section case-import-dialog__export-section">
          <header><h4>导出范围</h4></header>
          <div class="case-import-dialog__export-scopes">
            <button type="button" class="case-import-dialog__scope-card" :class="{ 'is-active': exportScope === 'ALL' }" :disabled="exporting" @click="exportScope = 'ALL'">
              <strong>{{ exportCounts.all }}</strong>
              <span>全部用例</span>
            </button>
            <button type="button" class="case-import-dialog__scope-card" :class="{ 'is-active': exportScope === 'DIRECTORY' }" :disabled="exporting" @click="exportScope = 'DIRECTORY'">
              <strong>{{ exportCounts.directory }}</strong>
              <span>当前目录</span>
            </button>
            <button type="button" class="case-import-dialog__scope-card" :class="{ 'is-active': exportScope === 'SELECTED' }" :disabled="selectedCaseIds.length === 0 || exporting" @click="exportScope = 'SELECTED'">
              <strong>{{ selectedCaseIds.length }}</strong>
              <span>已选用例</span>
              <small v-if="selectedCaseIds.length === 0">请先勾选用例</small>
            </button>
          </div>
        </section>

        <section class="case-import-dialog__section case-import-dialog__export-section">
          <header><h4>导出格式</h4></header>
          <div class="case-import-dialog__formats">
            <button type="button" class="case-import-dialog__format" :class="{ 'is-active': exportFormat === 'xlsx' }" :disabled="exporting" @click="exportFormat = 'xlsx'">
              <strong>Excel (.xlsx)</strong>
              <small>表格格式，可直接编辑与再导入</small>
            </button>
            <button type="button" class="case-import-dialog__format" :class="{ 'is-active': exportFormat === 'csv' }" :disabled="exporting" @click="exportFormat = 'csv'">
              <strong>CSV (.csv)</strong>
              <small>轻量文本，适合数据清洗与处理</small>
            </button>
            <button type="button" class="case-import-dialog__format" :class="{ 'is-active': exportFormat === 'xmind' }" :disabled="exporting" @click="exportFormat = 'xmind'">
              <strong>XMind (.xmind)</strong>
              <small>思维导图，适合用例结构梳理</small>
            </button>
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
        <AppButton v-if="activeTab === 'import' && importing" class="case-import-dialog__parsing-button" :icon="RefreshCw" disabled>解析中...</AppButton>
        <AppButton v-else-if="activeTab === 'import' && importFailureMessage" @click="closeDialog">取消</AppButton>
        <AppButton v-else-if="activeTab === 'import' && result" :disabled="importing || exporting" @click="resetImport">
          {{ result.failedCount === 0 && result.skippedCount === 0 ? '继续导入' : '重新导入' }}
        </AppButton>
        <AppButton v-else-if="activeTab === 'import' && selectedFile" :disabled="importing || exporting" @click="resetImport">重新选择</AppButton>
        <AppButton v-else :disabled="importing || exporting" @click="closeDialog">取消</AppButton>
        <AppButton v-if="activeTab === 'import' && importFailureMessage" type="primary" :icon="RefreshCw" @click="resetImport">重新上传</AppButton>
        <AppButton v-if="activeTab === 'import' && result" type="primary" @click="closeDialog">完成</AppButton>
        <AppButton v-if="activeTab === 'import' && selectedFile && !result" type="primary" :icon="Upload" :loading="importing" :disabled="!canSubmitImport" @click="submitImport">
          开始导入
        </AppButton>
        <AppButton v-if="activeTab === 'export'" :type="exportErrorMessage ? 'danger' : 'primary'" :class="{ 'is-busy': exporting }" :icon="exporting ? RefreshCw : Download" :loading="false" :disabled="!canSubmitExport" @click="submitExport">
          {{ exporting ? '导出中...' : exportErrorMessage ? '重新导出' : '导出' }}
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-import-dialog {
  display: block;
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

.case-import-dialog__dropzone.is-dragging {
  border-color: #165dff;
  background: #165dff06;
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
  background: rgba(22, 93, 255, 0.024);
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
  background: rgba(22, 93, 255, 0.071);
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

/* This shell is scoped to the case import/export dialog so the shared dialog
   and button defaults remain unchanged for other workflows. */
:global(.el-dialog.case-import-dialog-shell) {
  box-sizing: border-box;
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: 88vh;
  padding: 0;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

:global(.case-import-dialog-modal) {
  background: rgba(29, 33, 41, 0.5);
}

:global(.case-import-dialog-modal .el-overlay-dialog) {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

:global(.case-import-dialog-modal .el-dialog.case-import-dialog-shell) {
  margin: 0;
}

:global(.el-dialog.case-import-dialog-shell .el-dialog__header) {
  box-sizing: border-box;
  height: 97.5px;
  min-height: 97.5px;
  margin: 0;
  padding: 18px 24px 0;
  border-bottom: 1px solid #e5e6eb;
}

:global(.el-dialog.case-import-dialog-shell .el-dialog__headerbtn) {
  display: none;
}

:global(.el-dialog.case-import-dialog-shell .el-dialog__body) {
  box-sizing: border-box;
  min-height: 0;
  padding: 20px 24px;
  overflow: auto;
}

:global(.el-dialog.case-import-dialog-shell--export .el-dialog__body) {
  height: 344px;
  flex: 0 0 344px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--export-empty .el-dialog__body) {
  height: 362px;
  flex: 0 0 362px;
}

:global(.el-dialog.case-import-dialog-shell .el-dialog__footer) {
  box-sizing: border-box;
  min-height: 61px;
  padding: 14px 24px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.case-import-dialog__header {
  height: 79.5px;
}

.case-import-dialog__header-main {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: space-between;
}

.case-import-dialog__header-main > strong {
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.case-import-dialog__close {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #86909c;
  cursor: pointer;
}

.case-import-dialog__close:hover:not(:disabled) {
  background: #f4f6fa;
}

.case-import-dialog__close:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.case-import-dialog__close svg {
  width: 14px;
  height: 14px;
}

.case-import-dialog__tabs {
  margin: 0;
  display: flex;
  height: 50.5px;
  align-items: flex-start;
  padding-top: 14px;
}

.case-import-dialog__tabs > button {
  box-sizing: border-box;
  height: 37.5px;
  padding: 8px 20px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.case-import-dialog__tabs > button.is-active {
  border-bottom-color: #165dff;
  color: #165dff;
  font-weight: 600;
}

.case-import-dialog__tabs > button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.case-import-dialog__location {
  display: flex;
  min-width: 0;
  height: 40px;
  box-sizing: border-box;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #f7f8fa;
}

.case-import-dialog__location > svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  color: #ff7d00;
}

.case-import-dialog__location > span {
  min-width: 0;
  overflow: hidden;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__location > span strong {
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-import-dialog__location > button {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.case-import-dialog__location > button:hover {
  color: #0e42d2;
}

.case-import-dialog__location {
  margin-bottom: 16px;
}

:global(.el-dialog.case-import-dialog-shell--export) .case-import-dialog__location {
  margin-bottom: 18px;
}

.case-import-dialog__export-section {
  gap: 0;
}

.case-import-dialog__export-section:nth-of-type(2) {
  margin-top: 0;
}

.case-import-dialog__export-section:nth-of-type(2) > header {
  height: 36px;
  box-sizing: border-box;
  align-items: flex-start;
  padding-top: 18px;
}

.case-import-dialog__export-section:nth-of-type(2) > header h4,
.case-import-dialog__export-section:nth-of-type(3) > header h4 {
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-import-dialog__export-scopes {
  display: flex;
  height: 99px;
  box-sizing: border-box;
  gap: 10px;
  padding-top: 10px;
}

.case-import-dialog__scope-card {
  display: flex;
  min-width: 0;
  height: 89px;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  border: 1.5px solid #e5e6eb;
  border-radius: 10px;
  background: #fff;
  color: #1d2129;
  cursor: pointer;
  font-family: inherit;
}

.case-import-dialog__scope-card.is-active {
  border-color: #165dff;
  background: rgba(22, 93, 255, 0.03);
}

.case-import-dialog__scope-card:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.case-import-dialog__scope-card > strong {
  color: #1d2129;
  font-size: 22px;
  font-weight: 700;
  line-height: 33px;
}

.case-import-dialog__scope-card.is-active > strong,
.case-import-dialog__scope-card.is-active > span {
  color: #165dff;
}

.case-import-dialog__scope-card > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-import-dialog__scope-card > small {
  margin-top: 3px;
  color: #c9cdd4;
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

:global(.el-dialog.case-import-dialog-shell--export-empty) .case-import-dialog__export-scopes,
:global(.el-dialog.case-import-dialog-shell--export-empty) .case-import-dialog__scope-card {
  height: 117px;
}

.case-import-dialog__export-section:nth-of-type(3) > header {
  height: 38px;
  box-sizing: border-box;
  align-items: flex-start;
  padding-top: 20px;
}

.case-import-dialog__formats {
  display: flex;
  height: 92px;
  box-sizing: border-box;
  gap: 10px;
  padding: 10px 0 16px;
}

.case-import-dialog__format {
  display: flex;
  min-width: 0;
  height: 66px;
  flex: 1 1 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 12px 14px;
  border: 1.5px solid #e5e6eb;
  border-radius: 10px;
  background: #fff;
  color: #1d2129;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.case-import-dialog__format.is-active {
  border-color: #165dff;
  background: rgba(22, 93, 255, 0.03);
}

.case-import-dialog__format > strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__format.is-active > strong {
  color: #165dff;
}

.case-import-dialog__format > small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-import-dialog__footer {
  min-height: 32px;
  align-items: center;
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button) {
  box-sizing: border-box;
  min-width: 49px;
  min-height: 32px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button--primary) {
  min-width: 72px;
  min-height: 32px;
  height: 32px;
  padding: 0 14px;
  border-color: #165dff;
  background: #165dff;
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button--primary:hover:not(:disabled)) {
  border-color: #165dff;
  background: #165dff;
  filter: brightness(1.1);
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button:hover:not(:disabled)) {
  border-color: #165dff;
  background: #fff;
  color: #165dff;
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button--danger) {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #fff;
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button--danger:hover:not(:disabled)) {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #fff;
  filter: brightness(1.1);
}

:global(.case-import-dialog-shell .case-import-dialog__footer .app-button.el-button:active:not(:disabled)) {
  transform: scale(0.98);
}

.case-import-dialog__radio-option {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 10px;
  align-items: start;
  box-sizing: border-box;
  width: 100%;
  min-height: 58px;
  padding: 9px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  cursor: pointer;
}

.case-import-dialog__radios {
  display: flex;
  min-height: 0;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #f7f8fa;
}

.case-import-dialog__radios.is-disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.case-import-dialog__radio-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.case-import-dialog__radio-option.is-active {
  border-color: #165dff;
  background: #fff;
}

.case-import-dialog__radio-indicator {
  display: inline-flex;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  border: 2px solid #c9cdd4;
  border-radius: 50%;
  background: #fff;
}

.case-import-dialog__radio-indicator i {
  display: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
}

.case-import-dialog__radio-option.is-active .case-import-dialog__radio-indicator {
  border-color: #165dff;
  background: #165dff;
}

.case-import-dialog__radio-option.is-active .case-import-dialog__radio-indicator i {
  display: block;
}

.case-import-dialog__radio-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.case-import-dialog__radio-copy strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-import-dialog__radio-option.is-active .case-import-dialog__radio-copy strong {
  color: #165dff;
}

.case-import-dialog__radio-copy small {
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.case-import-dialog__radio-option.is-active .case-import-dialog__radio-copy strong {
  font-weight: 600;
}

/* Import states mirror the Make flow while keeping the API-backed Vue flow. */
:global(.el-dialog.case-import-dialog-shell--import-default .el-dialog__body) {
  height: 549.5px;
  flex: 0 0 549.5px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-default),
:global(.el-dialog.case-import-dialog-shell--import-selected),
:global(.el-dialog.case-import-dialog-shell--import-parsing),
:global(.el-dialog.case-import-dialog-shell--import-partial),
:global(.el-dialog.case-import-dialog-shell--import-failed) {
  box-sizing: border-box;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-default) {
  height: 704px;
}

:global(.el-dialog.case-import-dialog-shell--import-default .el-dialog__footer) {
  height: 61px;
  min-height: 61px;
}

:global(.el-dialog.case-import-dialog-shell--import-default .el-dialog__body) {
  height: 545.5px;
  flex: 0 0 545.5px;
}

:global(.el-dialog.case-import-dialog-shell--import-selected) {
  height: 618.5px;
}

:global(.el-dialog.case-import-dialog-shell--import-parsing) {
  height: 525px;
}

:global(.el-dialog.case-import-dialog-shell--import-partial) {
  height: 590.5px;
}

:global(.el-dialog.case-import-dialog-shell--import-failed) {
  height: 525px;
}

:global(.el-dialog.case-import-dialog-shell--import-success) {
  height: 479.5px;
}

:global(.el-dialog.case-import-dialog-shell--export) {
  height: 502.5px;
}

:global(.el-dialog.case-import-dialog-shell--export-empty) {
  height: 520.5px;
}

:global(.el-dialog.case-import-dialog-shell--import-selected .el-dialog__body) {
  height: 460px;
  flex: 0 0 460px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-parsing .el-dialog__body) {
  height: 366.5px;
  flex: 0 0 366.5px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-partial .el-dialog__body) {
  height: 432px;
  flex: 0 0 432px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-failed .el-dialog__body) {
  height: 366.5px;
  flex: 0 0 366.5px;
  overflow: hidden;
}

:global(.el-dialog.case-import-dialog-shell--import-success .el-dialog__body) {
  height: 321px;
  flex: 0 0 321px;
  overflow: hidden;
}

.case-import-dialog__dropzone {
  height: 162px;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  gap: 0;
  padding: 28px 20px;
  border: 2px dashed #e5e6eb;
  border-radius: 12px;
  background: #fafbfc;
  margin-bottom: 16px;
  font-family: inherit;
}

.case-import-dialog__dropzone span {
  width: 48px;
  height: 48px;
  margin-bottom: 0;
  border-radius: 12px;
  background: #eef0f5;
  color: #86909c;
}

.case-import-dialog__dropzone span svg {
  width: 22px;
  height: 22px;
}

.case-import-dialog__dropzone strong {
  margin-top: 12px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.case-import-dialog__dropzone small {
  margin-top: 4px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.case-import-dialog__dropzone.is-dragging strong,
.case-import-dialog__dropzone.is-dragging small {
  color: #165dff;
}

.case-import-dialog__dropzone.is-dragging span {
  background: #165dff12;
  color: #165dff;
}

.case-import-dialog__file {
  box-sizing: border-box;
  grid-template-columns: 40px minmax(0, 1fr) 24px;
  gap: 12px;
  padding: 14px 18px;
  border: 2px dashed #00b42a;
  border-radius: 12px;
  background: #00b42a06;
  margin-bottom: 16px;
}

.case-import-dialog__file > span {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #00b42a12;
  color: #00b42a;
}

.case-import-dialog__file > span svg {
  width: 18px;
  height: 18px;
}

.case-import-dialog__file strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.case-import-dialog__file small {
  font-size: 11px;
  line-height: 16.5px;
}

.case-import-dialog__file > button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(245, 63, 63, 0.07);
  color: #f53f3f;
}

.case-import-dialog__section:has(.case-import-dialog__radio-option) {
  padding: 14px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #f7f8fa;
  gap: 0;
}

.case-import-dialog__section:has(.case-import-dialog__radio-option) > header {
  min-height: 18px;
}

.case-import-dialog__section:has(.case-import-dialog__radio-option) > header h4 {
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-import-dialog__section:has(.case-import-dialog__radio-option) .case-import-dialog__radios {
  height: auto;
  box-sizing: border-box;
  padding: 10px 0 0;
  border: 0;
  background: transparent;
}

.case-import-dialog__template-link {
  display: inline-flex;
  width: fit-content;
  height: 18px;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-import-dialog__template-link svg {
  width: 12px;
  height: 12px;
}

.case-import-dialog__failure-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 20px 20px;
  text-align: center;
}

.case-import-dialog__failure-icon {
  display: inline-flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 50%;
  background: #f53f3f10;
  color: #f53f3f;
}

.case-import-dialog__failure-icon svg {
  width: 28px;
  height: 28px;
}

.case-import-dialog__failure-result > strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

.case-import-dialog__failure-result > p {
  margin: 6px 0 20px;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.case-import-dialog__failure-message {
  width: min(400px, 100%);
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid #f53f3f20;
  border-radius: 8px;
  background: #f53f3f07;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.case-import-dialog__template-link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.case-import-dialog__parsing {
  height: 287px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin-top: 0;
  padding: 64px 20px 0;
  text-align: center;
}

.case-import-dialog__parsing-icon {
  display: inline-flex;
  width: 60px;
  height: 60px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #165dff12;
  color: #165dff;
  animation: case-import-dialog-spin 1s linear infinite;
}

.case-import-dialog__parsing-icon svg {
  width: 26px;
  height: 26px;
}

.case-import-dialog__parsing > strong {
  margin-top: 16px;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.case-import-dialog__parsing > span:not(.case-import-dialog__parsing-icon),
.case-import-dialog__parsing > small {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.case-import-dialog__parsing > span:not(.case-import-dialog__parsing-icon) {
  height: 22px;
  box-sizing: border-box;
  padding-top: 4px;
}

.case-import-dialog__parsing > small {
  margin-top: 16px;
}

.case-import-dialog__progress {
  width: 280px;
  height: 4px;
  overflow: hidden;
  border-radius: 4px;
  background: #eaecf0;
}

.case-import-dialog__progress i {
  display: block;
  width: 65%;
  height: 100%;
  border-radius: 4px;
  background: #165dff;
  animation: case-import-dialog-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes case-import-dialog-spin {
  to { transform: rotate(360deg); }
}

@keyframes case-import-dialog-pulse {
  50% { opacity: 0.5; }
}

.case-import-dialog__success-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px 20px;
  text-align: center;
}

.case-import-dialog__result-icon {
  display: inline-flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 50%;
}

.case-import-dialog__result-icon.is-success {
  background: #00b42a12;
  color: #00b42a;
}

.case-import-dialog__result-icon.is-warning {
  width: 36px;
  height: 36px;
  margin: 0;
  background: #ff7d0015;
  color: #ff7d00;
}

.case-import-dialog__result-icon svg {
  width: 30px;
  height: 30px;
}

.case-import-dialog__result-icon.is-warning svg {
  width: 17px;
  height: 17px;
}

.case-import-dialog__success-result > strong {
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.case-import-dialog__success-result > p {
  margin: 6px 0 20px;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.case-import-dialog__result-stats {
  display: flex;
  width: 100%;
  gap: 8px;
}

.case-import-dialog__result-stats > div {
  min-width: 0;
  flex: 1;
  padding: 11px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  text-align: center;
}

.case-import-dialog__result-stats strong,
.case-import-dialog__result-stats span {
  display: block;
}

.case-import-dialog__result-stats strong {
  color: #1d2129;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.case-import-dialog__result-stats span {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.case-import-dialog__success-result > .case-import-dialog__result-stats {
  width: fit-content;
  gap: 0;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  overflow: hidden;
}

.case-import-dialog__success-result > .case-import-dialog__result-stats > div {
  flex: 0 0 auto;
  padding: 14px 28px;
  border: 0;
  border-left: 1px solid #e5e6eb;
  border-radius: 0;
}

.case-import-dialog__success-result > .case-import-dialog__result-stats > div:first-child {
  border-left: 0;
}

.case-import-dialog__success-result > .case-import-dialog__result-stats strong {
  font-size: 22px;
  line-height: 33px;
}

.case-import-dialog__success-result > .case-import-dialog__result-stats span {
  margin-top: 2px;
}

.case-import-dialog__partial-result > header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid #ff7d0035;
  border-radius: 10px;
  background: #ff7d000c;
}

.case-import-dialog__partial-result > header > div {
  min-width: 0;
  flex: 1;
}

.case-import-dialog__partial-result > header strong,
.case-import-dialog__partial-result > header > div > span {
  display: block;
}

.case-import-dialog__partial-result > header strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.case-import-dialog__partial-result > header > div > span {
  margin-top: 1px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.case-import-dialog__partial-result > header > div > span em {
  font-style: normal;
  font-weight: 600;
}

.case-import-dialog__partial-result > header > div > span em.is-success {
  color: #00b42a;
}

.case-import-dialog__partial-result > header > div > span em.is-skipped {
  color: #86909c;
}

.case-import-dialog__partial-result > header > div > span em.is-failed {
  color: #f53f3f;
}

.case-import-dialog__partial-result > header button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid #165dff40;
  border-radius: 6px;
  background: #fff;
  color: #165dff;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
}

.case-import-dialog__partial-result > header button svg {
  width: 11px;
  height: 11px;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats {
  margin: 14px 0;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats > div:nth-child(1) {
  border: 0;
  background: #00b42a0e;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats > div:nth-child(1) strong {
  color: #00b42a;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats > div:nth-child(2) {
  border: 0;
  background: #f0f1f5;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats > div:nth-child(3) {
  border: 0;
  background: #f53f3f0e;
}

.case-import-dialog__partial-result > .case-import-dialog__result-stats > div:nth-child(3) strong {
  color: #f53f3f;
}

.case-import-dialog__partial-result .case-import-dialog__issues {
  max-height: 190px;
  overflow: auto;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
}

.case-import-dialog__issues-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafbfc;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
}

.case-import-dialog__issues-title svg {
  width: 12px;
  height: 12px;
  color: #f53f3f;
}

.case-import-dialog__issues-title span {
  margin-left: 2px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
}

.case-import-dialog__partial-result .case-import-dialog__issues > div:not(.case-import-dialog__issues-title) {
  grid-template-columns: 52px minmax(0, 1fr) minmax(0, 220px);
  min-height: 34px;
  padding: 0 14px;
}

.case-import-dialog__partial-result .case-import-dialog__issues > div:not(.case-import-dialog__issues-title) small {
  color: #f53f3f;
}

:global(.case-import-dialog-shell .case-import-dialog__parsing-button svg) {
  animation: case-import-dialog-spin 1s linear infinite;
}

@media (max-width: 680px) {
  :global(.el-dialog.case-import-dialog-shell) {
    max-width: calc(100vw - 20px);
  }

  .case-import-dialog__formats,
  .case-import-dialog__export-scopes {
    overflow-x: auto;
  }

  .case-import-dialog__format,
  .case-import-dialog__scope-card {
    min-width: 160px;
  }
}
</style>
