<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import {
  casePriorityOptions,
  type CaseDetail,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveCasePayload,
  caseSourceTypeOptions,
  caseTypeOptions,
  createCaseFormFromDetail,
  createCaseFormFromSummary,
  createDefaultCaseForm,
  flattenCaseDirectoryOptions,
  type CaseDialogMode,
  type CaseForm,
  validateCaseForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: CaseDialogMode
    caseItem?: CaseSummaryItem | null
    caseDetail?: CaseDetail | null
    directories?: CaseDirectoryWorkspace[]
    saving?: boolean
    loadingDetail?: boolean
    defaultWorkspaceCode?: string
    defaultDirectoryId?: number | null
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    directories: () => [],
    defaultWorkspaceCode: 'ALL',
    defaultDirectoryId: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveCasePayload>]
}>()

const form = reactive<CaseForm>(createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId))
const formError = reactive({
  message: '',
})

const dialogTitle = computed(() => {
  if (props.mode === 'copy') {
    return '复制用例'
  }
  return props.mode === 'create' ? '新增用例' : '编辑用例'
})

const directoryOptions = computed(() => {
  return flattenCaseDirectoryOptions(props.directories).filter((item) => {
    return form.workspaceCode === 'ALL' || item.workspaceCode === form.workspaceCode
  })
})

function resetForm() {
  const nextForm =
    props.mode !== 'create' && props.caseDetail
      ? createCaseFormFromDetail(props.caseDetail, props.mode)
      : props.mode !== 'create' && props.caseItem
        ? createCaseFormFromSummary(props.caseItem, props.defaultWorkspaceCode, props.mode)
        : createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveCasePayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => [props.caseItem, props.caseDetail, props.defaultWorkspaceCode, props.defaultDirectoryId],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)

watch(
  () => form.workspaceCode,
  () => {
    if (
      form.directoryId
      && !directoryOptions.value.some((item) => item.value === form.directoryId)
    ) {
      form.directoryId = null
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-dialog">
      <div v-if="loadingDetail" class="case-dialog__hint">正在加载用例详情...</div>

      <div class="case-dialog__field">
        <span>工作空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </div>

      <div class="case-dialog__field">
        <span>用例名称 *</span>
        <el-input v-model="form.title" placeholder="请输入用例名称" />
      </div>

      <div class="case-dialog__grid">
        <div class="case-dialog__field">
          <span>用例类型</span>
          <div class="case-dialog__segment">
            <button
              v-for="item in caseTypeOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': form.caseType === item.value }"
              @click="form.caseType = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="case-dialog__field">
          <span>优先级</span>
          <div class="case-dialog__segment is-four">
            <button
              v-for="item in casePriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': form.priority === item.value }"
              @click="form.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="case-dialog__grid">
        <div class="case-dialog__field">
          <span>来源</span>
          <el-select v-model="form.sourceType" class="case-dialog__select">
            <el-option
              v-for="item in caseSourceTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="case-dialog__field"></div>
      </div>

      <div class="case-dialog__grid">
        <div class="case-dialog__field">
          <span>所属目录</span>
          <el-select
            v-model="form.directoryId"
            class="case-dialog__select"
            clearable
            filterable
            placeholder="空间根目录"
          >
            <el-option
              v-for="item in directoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="case-dialog__field">
          <span>负责人 ID</span>
          <el-input v-model="form.ownerId" placeholder="可选" />
        </div>
      </div>

      <div class="case-dialog__field">
        <span>前置条件</span>
        <el-input v-model="form.precondition" type="textarea" :rows="2" placeholder="可选" />
      </div>

      <div class="case-dialog__field">
        <span>测试步骤</span>
        <el-input v-model="form.steps" type="textarea" :rows="4" placeholder="请输入测试步骤" />
      </div>

      <div class="case-dialog__field">
        <span>预期结果</span>
        <el-input v-model="form.expectedResult" type="textarea" :rows="3" placeholder="请输入预期结果" />
      </div>

      <p v-if="formError.message" class="case-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" :disabled="loadingDetail" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3) var(--app-space-4);
}

.case-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-dialog__select {
  width: 100%;
}

.case-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.case-dialog__segment.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.case-dialog__segment button {
  min-height: var(--app-control-height-md);
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.case-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.case-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-dialog__hint {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.case-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .case-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
