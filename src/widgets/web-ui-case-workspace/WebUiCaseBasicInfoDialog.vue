<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

import {
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_CASE_STATUS_OPTIONS,
  type SaveWebUiCasePayload,
  type WebUiBrowserType,
  type WebUiCaseDetail,
  type WebUiCaseStatus,
  type WebUiCaseStepItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

interface CaseBasicInfoForm {
  name: string
  moduleName: string
  description: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode?: 'create' | 'edit'
    loading?: boolean
    caseDetail?: WebUiCaseDetail | null
  }>(),
  {
    mode: 'create',
    loading: false,
    caseDetail: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: SaveWebUiCasePayload]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const form = reactive<CaseBasicInfoForm>(createEmptyForm())
const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑用例信息' : '新建用例'))
const submitText = computed(() => (props.mode === 'edit' ? '保存' : '创建'))

function createEmptyForm(): CaseBasicInfoForm {
  return {
    name: '',
    moduleName: '',
    description: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
  }
}

function fillForm(detail?: WebUiCaseDetail | null) {
  const source = detail || createEmptyForm()
  form.name = source.name || ''
  form.moduleName = source.moduleName || ''
  form.description = source.description || ''
  form.baseUrl = source.baseUrl || ''
  form.browserType = source.browserType || 'CHROMIUM'
  form.headless = source.headless !== false
  form.defaultTimeoutMs = clampTimeout(source.defaultTimeoutMs)
  form.status = source.status || 'ENABLED'
}

function clampTimeout(value: unknown, fallback = 10000) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(60000, Math.max(1000, numberValue))
}

function getCurrentSteps(): WebUiCaseStepItem[] {
  return props.caseDetail?.steps ? props.caseDetail.steps.map(normalizeStep) : []
}

function normalizeStep(step: WebUiCaseStepItem, index: number): WebUiCaseStepItem {
  return {
    id: step.id ?? null,
    name: step.name || `步骤 ${index + 1}`,
    type: step.type || 'OPEN',
    elementId: step.elementId ?? null,
    locatorType: step.locatorType ?? null,
    locatorValue: step.locatorValue ?? null,
    framePath: Array.isArray(step.framePath) ? step.framePath : [],
    shadowPath: Array.isArray(step.shadowPath) ? step.shadowPath : [],
    inputValue: step.inputValue ?? null,
    timeoutMs: step.timeoutMs ?? null,
    continueOnFailure: Boolean(step.continueOnFailure),
    screenshotPolicy: step.screenshotPolicy || 'NONE',
    enabled: step.enabled !== false,
    sortOrder: Number(step.sortOrder || index + 1),
  }
}

function buildPayload(): SaveWebUiCasePayload {
  form.defaultTimeoutMs = clampTimeout(form.defaultTimeoutMs)

  return {
    name: form.name.trim(),
    moduleName: form.moduleName.trim() || null,
    description: form.description.trim() || null,
    baseUrl: form.baseUrl.trim() || null,
    browserType: form.browserType,
    headless: form.headless,
    defaultTimeoutMs: form.defaultTimeoutMs,
    status: form.status,
    steps: getCurrentSteps(),
  }
}

function submitForm() {
  if (props.loading) {
    return
  }
  if (!form.name.trim()) {
    ElMessage.warning('请输入用例名称')
    return
  }
  emit('submit', buildPayload())
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      fillForm(props.caseDetail)
    }
  },
)

watch(
  () => props.caseDetail,
  (detail) => {
    if (props.modelValue) {
      fillForm(detail)
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="640px"
    destroy-on-close
    class="web-ui-case-basic-dialog"
  >
    <el-form v-loading="loading" label-width="96px">
      <el-form-item label="用例名称" required>
        <el-input v-model="form.name" maxlength="80" show-word-limit placeholder="请输入用例名称" />
      </el-form-item>
      <el-form-item label="模块">
        <el-input v-model="form.moduleName" maxlength="80" clearable placeholder="例如：登录、订单、审批" />
      </el-form-item>
      <el-form-item label="起始地址">
        <el-input v-model="form.baseUrl" maxlength="500" clearable placeholder="https://example.com" />
      </el-form-item>
      <el-form-item label="浏览器">
        <el-select :suffix-icon="AppSelectChevron" v-model="form.browserType">
          <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="无头模式">
        <el-switch v-model="form.headless" active-text="开启" inactive-text="关闭" />
      </el-form-item>
      <el-form-item label="默认超时">
        <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select :suffix-icon="AppSelectChevron" v-model="form.status">
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="mode === 'edit'" label="步骤数">
        <span>{{ caseDetail?.steps?.length ?? 0 }} 步</span>
        <div class="web-ui-case-basic-dialog__tip">步骤请在列表操作列点击“步骤”维护。</div>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="visible = false">取消</AppButton>
      <AppButton type="primary" :loading="loading" @click="submitForm">{{ submitText }}</AppButton>
    </template>
  </el-dialog>
</template>

<style scoped>
.web-ui-case-basic-dialog :deep(.el-select),
.web-ui-case-basic-dialog :deep(.el-input-number) {
  width: 100%;
}

.web-ui-case-basic-dialog__tip {
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-md);
}
</style>
