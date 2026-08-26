<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import {
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectDetail,
  type DefectSummaryItem,
} from '@/entities/defect'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'

import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  createDefectFormFromDetail,
  createDefectFormFromSummary,
  type DefectDialogMode,
  type DefectForm,
  validateDefectForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DefectDialogMode
    defectItem?: DefectSummaryItem | null
    defectDetail?: DefectDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
  }>(),
  {
    defectItem: null,
    defectDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveDefectPayload>]
  retryDetail: []
}>()

const form = reactive<DefectForm>(createDefaultDefectForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const visualForm = reactive({
  sourceType: '手工录入',
  reproduceSteps: '',
  expectedResult: '',
  actualResult: '',
})
const workspaceOptions = ref<WorkspaceItem[]>([])
const workspaceOptionsLoading = ref(false)
const workspaceOptionsError = ref('')
const caseOptions = ref<CaseSummaryItem[]>([])
const caseOptionsLoading = ref(false)
const caseOptionsError = ref('')
let workspaceOptionsLoaded = false
let caseOptionsRequestSeq = 0
let loadedCaseOptionsWorkspaceCode = ''
let loadingCaseOptionsWorkspaceCode = ''

const activeWorkspaceCode = computed(() => form.workspaceCode || props.defaultWorkspaceCode || 'ALL')
const dialogTitle = computed(() => (props.mode === 'create' ? '新增缺陷' : '编辑缺陷'))


function getCaseLabel(item: CaseSummaryItem) {
  const caseNo = item.caseNo || `#${item.id}`
  return item.title ? `${caseNo} · ${item.title}` : caseNo
}

function getConcreteWorkspaces() {
  return workspaceOptions.value.filter((item) => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
}

function getWorkspaceLabel(item: WorkspaceItem) {
  return item.workspaceName || item.workspaceCode
}

function ensureConcreteWorkspace() {
  if (props.mode === 'edit' && form.workspaceCode && form.workspaceCode !== 'ALL') {
    return
  }

  const concreteWorkspaces = getConcreteWorkspaces()
  if (!concreteWorkspaces.length) {
    return
  }

  const matchedWorkspace = concreteWorkspaces.find((item) => item.workspaceCode === form.workspaceCode)
  if (matchedWorkspace) {
    return
  }

  const preferredWorkspace =
    concreteWorkspaces.find((item) => item.current || item.default || item.isCurrent || item.isDefault) ||
    concreteWorkspaces[0]
  form.workspaceCode = preferredWorkspace.workspaceCode
}

async function loadWorkspaceOptions() {
  if (workspaceOptionsLoaded || workspaceOptionsLoading.value) {
    ensureConcreteWorkspace()
    return
  }

  workspaceOptionsLoading.value = true
  workspaceOptionsError.value = ''
  try {
    workspaceOptions.value = await workspaceApi.getSwitchableWorkspaces()
    workspaceOptionsLoaded = true
    ensureConcreteWorkspace()
  } catch (error) {
    workspaceOptionsError.value = getRequestErrorMessage(error)
  } finally {
    workspaceOptionsLoading.value = false
  }
}

async function loadCaseOptions(workspaceCode: string) {
  if (!workspaceCode || workspaceCode === 'ALL') {
    caseOptions.value = []
    loadedCaseOptionsWorkspaceCode = ''
    return
  }

  if (
    loadedCaseOptionsWorkspaceCode === workspaceCode ||
    (caseOptionsLoading.value && loadingCaseOptionsWorkspaceCode === workspaceCode)
  ) {
    return
  }

  const requestSeq = ++caseOptionsRequestSeq
  loadingCaseOptionsWorkspaceCode = workspaceCode
  caseOptionsLoading.value = true
  caseOptionsError.value = ''
  try {
    const page = await caseApi.getCases(workspaceCode, {
      pageNo: 1,
      pageSize: 50,
    })
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptions.value = Array.isArray(page.items) ? page.items : []
      loadedCaseOptionsWorkspaceCode = workspaceCode
    }
  } catch (error) {
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptions.value = []
      caseOptionsError.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptionsLoading.value = false
      loadingCaseOptionsWorkspaceCode = ''
    }
  }
}

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.defectDetail
      ? createDefectFormFromDetail(props.defectDetail)
      : props.mode === 'edit' && props.defectItem
        ? createDefectFormFromSummary(props.defectItem, props.defaultWorkspaceCode)
        : createDefaultDefectForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  Object.assign(visualForm, {
    sourceType: '手工录入',
    reproduceSteps: '',
    expectedResult: '',
    actualResult: '',
  })
  formError.message = ''
}

function submit() {
  const error = validateDefectForm(form, {
    assigneeRequired: props.mode === 'edit' && props.defectItem?.status !== 'TODO',
  })
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveDefectPayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      void loadWorkspaceOptions()
      if (activeWorkspaceCode.value !== 'ALL') {
        void loadCaseOptions(activeWorkspaceCode.value)
      }
    }
  },
)

watch(
  () => [props.defectItem, props.defectDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
      void loadWorkspaceOptions()
      if (activeWorkspaceCode.value !== 'ALL') {
        void loadCaseOptions(activeWorkspaceCode.value)
      }
    }
  },
)

watch(
  () => form.workspaceCode,
  (workspaceCode, oldWorkspaceCode) => {
    if (!props.modelValue || workspaceCode === oldWorkspaceCode) {
      return
    }

    form.relatedCaseId = ''
    void loadCaseOptions(workspaceCode)
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="640px"
    modal-class="defect-dialog-overlay"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-dialog">
      <div v-if="loadingDetail" class="defect-dialog__hint">正在加载缺陷详情...</div>
      <div v-else-if="detailErrorMessage" class="defect-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <AppButton size="small" @click="emit('retryDetail')">重试</AppButton>
      </div>

      <div class="defect-dialog__field is-full">
        <span class="is-required">缺陷标题</span>
        <el-input v-model="form.title" :disabled="loadingDetail" placeholder="请输入缺陷标题" />
      </div>

      <div class="defect-dialog__grid">
        <div class="defect-dialog__field">
          <span class="is-required">严重程度</span>
          <el-select v-model="form.severity" class="defect-dialog__select" :disabled="loadingDetail">
            <el-option
              v-for="item in defectSeverityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="defect-dialog__field">
          <span class="is-required">优先级</span>
          <el-select v-model="form.priority" class="defect-dialog__select" :disabled="loadingDetail">
            <el-option
              v-for="item in defectPriorityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="defect-dialog__field">
          <span class="is-required">所属模块</span>
          <el-select
            v-model="form.workspaceCode"
            class="defect-dialog__select"
            :disabled="mode === 'edit' || loadingDetail || workspaceOptionsLoading"
            :loading="workspaceOptionsLoading"
            filterable
            placeholder="请选择所属模块"
          >
            <el-option
              v-for="workspace in getConcreteWorkspaces()"
              :key="workspace.workspaceCode"
              :label="getWorkspaceLabel(workspace)"
              :value="workspace.workspaceCode"
            />
          </el-select>
          <small v-if="workspaceOptionsError" class="defect-dialog__field-error">{{ workspaceOptionsError }}</small>
        </div>

        <div class="defect-dialog__field">
          <span>指派给</span>
          <AppUserSelect
            v-model="form.assigneeId"
            :workspace-code="activeWorkspaceCode"
            :disabled="loadingDetail"
            :clearable="props.mode === 'create'"
            placeholder="请选择指派人"
          />
        </div>

        <div class="defect-dialog__field">
          <span>来源类型</span>
          <el-select v-model="visualForm.sourceType" class="defect-dialog__select" :disabled="loadingDetail">
            <el-option label="手工录入" value="手工录入" />
            <el-option label="用例执行" value="用例执行" />
            <el-option label="报告导入" value="报告导入" />
          </el-select>
        </div>

        <div class="defect-dialog__field">
          <span>关联用例</span>
          <el-select
            v-model="form.relatedCaseId"
            class="defect-dialog__select"
            :disabled="loadingDetail || caseOptionsLoading"
            :loading="caseOptionsLoading"
            clearable
            filterable
            placeholder="可选"
          >
            <el-option
              v-for="item in caseOptions"
              :key="item.id"
              :label="getCaseLabel(item)"
              :value="String(item.id)"
            />
          </el-select>
          <small v-if="caseOptionsError" class="defect-dialog__field-error">{{ caseOptionsError }}</small>
        </div>
      </div>

      <div class="defect-dialog__field is-full">
        <span>问题描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          resize="none"
          :disabled="loadingDetail"
          placeholder="详细描述问题现象、影响范围、触发条件..."
        />
      </div>

      <div class="defect-dialog__field is-full">
        <span>复现步骤</span>
        <el-input
          v-model="visualForm.reproduceSteps"
          type="textarea"
          resize="none"
          :disabled="loadingDetail"
          placeholder="1. 打开页面&#10;2. 执行操作&#10;3. 观察结果"
        />
      </div>

      <div class="defect-dialog__grid">
        <div class="defect-dialog__field">
          <span>预期结果</span>
          <el-input
            v-model="visualForm.expectedResult"
            type="textarea"
            resize="none"
            :disabled="loadingDetail"
            placeholder="描述期望的正确结果"
          />
        </div>
        <div class="defect-dialog__field">
          <span>实际结果</span>
          <el-input
            v-model="visualForm.actualResult"
            type="textarea"
            resize="none"
            :disabled="loadingDetail"
            placeholder="描述实际发生的错误结果"
          />
        </div>
      </div>

      <div class="defect-dialog__upload">
        <span>附件 / 截图</span>
        <div>
          <strong>点击或拖拽文件到此处上传</strong>
          <small>支持 PNG、JPG、GIF、MP4，最大 20MB</small>
        </div>
      </div>

      <p v-if="formError.message" class="defect-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="defect-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="loadingDetail || Boolean(detailErrorMessage)"
          @click="submit"
        >
          {{ mode === 'create' ? '提交缺陷' : '保存修改' }}
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-dialog {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
}

:global(.defect-dialog-overlay .el-dialog) {
  display: flex;
  height: min(775.797px, calc(100vh - 86px));
  max-height: calc(100vh - 86px);
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
}

:global(.defect-dialog-overlay .el-dialog)::before {
  display: block;
  width: 100%;
  height: 3.5px;
  flex: 0 0 auto;
  background: #f53f3f;
  content: '';
}

:global(.defect-dialog-overlay .el-dialog__header) {
  min-height: 53.5px;
  margin: 0;
  padding: 14px 21px 15px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.defect-dialog-overlay .el-dialog__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.defect-dialog-overlay .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 17.5px 21px;
  overflow: auto;
}

:global(.defect-dialog-overlay .el-dialog__footer) {
  padding: 14px 21px 15px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.defect-dialog__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 2px;
}

.defect-dialog__intro strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
  line-height: 20px;
}

.defect-dialog__intro span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__surface {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.defect-dialog__columns {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 0;
}

.defect-dialog__main,
.defect-dialog__side {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  flex-direction: column;
  gap: 16px;
}

.defect-dialog__main {
  padding: 18px 22px 20px;
}

.defect-dialog__side {
  padding: 18px 18px 20px;
  border-left: 1px solid var(--app-border-soft);
  background: #fbfcff;
}

.defect-dialog__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-dialog__section-header--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-dialog__section-header h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
  line-height: 20px;
}

.defect-dialog__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
}

.defect-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 292px));
  gap: 14px;
}

.defect-dialog__field.is-full {
  width: 100%;
}

.defect-dialog__field > span {
  height: 23.25px;
  padding-bottom: 5.25px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-dialog__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.defect-dialog__field :deep(.el-input__wrapper),
.defect-dialog__field :deep(.el-textarea__inner),
.defect-dialog__field :deep(.el-select__wrapper) {
  min-height: 31.5px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-dialog__field :deep(.el-input__inner),
.defect-dialog__field :deep(.el-select__selected-item),
.defect-dialog__field :deep(.el-select__placeholder),
.defect-dialog__field :deep(.el-textarea__inner) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.defect-dialog__field :deep(.el-textarea__inner) {
  min-height: 78px;
  padding: 9.75px 11.5px;
  line-height: 19.5px;
}

.defect-dialog__field.is-full:nth-of-type(4) :deep(.el-textarea__inner) {
  min-height: 97.5px;
}

.defect-dialog__grid .defect-dialog__field :deep(.el-textarea__inner) {
  min-height: 58.5px;
}

.defect-dialog__select {
  width: 100%;
}

.defect-dialog__option {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.defect-dialog__option span {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__option small {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__field-error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.defect-dialog__segment.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.defect-dialog__segment button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.defect-dialog__segment button:hover:not(:disabled) {
  border-color: #bfd7ff;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-dialog__segment button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.defect-dialog__hint,
.defect-dialog__error-panel,
.defect-dialog__error {
  padding: 10px 12px;
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.defect-dialog__hint {
  border: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
}

.defect-dialog__error-panel,
.defect-dialog__error {
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.defect-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__error {
  margin: 0;
}

.defect-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.defect-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

.defect-dialog__footer :deep(.app-button) {
  min-width: auto;
  height: 28px;
  padding: 0 11.5px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
}

.defect-dialog__footer :deep(.app-button--primary) {
  height: 32px;
  padding: 0 14px;
  background: #f53f3f;
  border-color: #f53f3f;
}

.defect-dialog__upload {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
}

.defect-dialog__upload > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-dialog__upload > div {
  display: flex;
  min-height: 111.75px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75px;
  border: 2px dashed #e5e6eb;
  border-radius: 11px;
  color: #86909c;
}

.defect-dialog__upload strong {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-dialog__upload small {
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

@media (max-width: 1200px) {
  .defect-dialog__columns {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .defect-dialog__side {
    border-top: 1px solid var(--app-border-soft);
    border-left: 0;
  }
}
</style>
