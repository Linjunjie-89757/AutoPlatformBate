<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateParamPayload,
  createDefaultConfigParamForm,
  type ConfigParamForm,
  type ConfigVariableStage,
  validateConfigParamForm,
} from './model'

const props = withDefaults(defineProps<{ modelValue: boolean; saving?: boolean; defaultWorkspaceCode?: string }>(), {
  defaultWorkspaceCode: 'ALL',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateParamPayload>]
}>()

const scopeOptions = [
  { value: 'BUSINESS', label: '通用' },
  { value: 'API_VARIABLE_SET', label: '接口自动化' },
  { value: 'WEB_UI_VARIABLE_SET', label: 'Web UI' },
  { value: 'APP_UI_VARIABLE_SET', label: 'APP 自动化' },
]
const stageOptions: Array<{ value: ConfigVariableStage; label: string }> = [
  { value: 'COMMON', label: '通用' },
  { value: 'DEV', label: '开发' },
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发布' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
]

const form = reactive<ConfigParamForm>(createDefaultConfigParamForm(props.defaultWorkspaceCode))
const workspaces = ref<WorkspaceItem[]>([])
const loadingWorkspaces = ref(false)
const errorMessage = ref('')
const workspaceOptions = computed(() => workspaces.value
  .filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
  .map(item => ({ label: item.workspaceName || item.workspaceCode, value: item.workspaceCode })))

function ensureWorkspace() {
  if (!workspaceOptions.value.length) return
  if (form.workspaceCode === 'ALL' || !workspaceOptions.value.some(item => item.value === form.workspaceCode)) {
    form.workspaceCode = workspaceOptions.value[0].value
  }
}

async function loadWorkspaces() {
  loadingWorkspaces.value = true
  try {
    workspaces.value = await workspaceApi.getSwitchableWorkspaces()
    ensureWorkspace()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loadingWorkspaces.value = false
  }
}

function submit() {
  const error = validateConfigParamForm(form)
  if (error) {
    errorMessage.value = error
    return
  }
  emit('submit', buildCreateParamPayload(form))
}

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  Object.assign(form, createDefaultConfigParamForm(props.defaultWorkspaceCode))
  form.variables = []
  errorMessage.value = ''
  void loadWorkspaces()
})
</script>

<template>
  <AppDialog :model-value="modelValue" title="新建变量集" width="560px" dialog-class="variable-set-create-dialog" @update:model-value="emit('update:modelValue', $event)">
    <div class="variable-set-create">
      <label><span>目标空间</span><el-select v-model="form.workspaceCode" filterable :loading="loadingWorkspaces" placeholder="请选择目标空间"><el-option v-for="item in workspaceOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
      <label><span>变量集名称</span><el-input v-model="form.paramName" maxlength="64" show-word-limit placeholder="例如：订单业务测试数据" /></label>
      <div><span>适用范围</span><div class="variable-set-create__options"><button v-for="item in scopeOptions" :key="item.value" type="button" :class="{ 'is-active': form.paramType === item.value }" @click="form.paramType = item.value">{{ item.label }}</button></div></div>
      <div><span>部署阶段</span><div class="variable-set-create__options"><button v-for="item in stageOptions" :key="item.value" type="button" :class="{ 'is-active': form.stageType === item.value }" @click="form.stageType = item.value">{{ item.label }}</button></div></div>
      <label><span>描述</span><el-input v-model="form.description" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="说明变量集的用途和使用范围" /></label>
      <label class="variable-set-create__status"><div><strong>创建后启用</strong><small>停用后不参与环境变量解析</small></div><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></label>
      <p v-if="errorMessage" class="variable-set-create__error">{{ errorMessage }}</p>
    </div>
    <template #footer><AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton><AppButton type="primary" :loading="saving" @click="submit">创建变量集</AppButton></template>
  </AppDialog>
</template>

<style scoped>
.variable-set-create { display: flex; min-height: 0; flex-direction: column; gap: 18px; overflow-y: auto; padding-right: 4px; }
.variable-set-create > label, .variable-set-create > div { display: flex; flex-direction: column; gap: 8px; }
.variable-set-create span { color: var(--app-text-secondary); font-size: 13px; font-weight: 500; }
.variable-set-create :deep(.el-select) { width: 100%; }
.variable-set-create__options { display: flex; flex-wrap: wrap; gap: 8px; }
.variable-set-create__options button { height: 32px; padding: 0 14px; border: 1px solid var(--app-border); border-radius: 5px; background: #fff; color: var(--app-text-secondary); cursor: pointer; font-size: 12px; }
.variable-set-create__options button.is-active { border-color: var(--app-primary); background: var(--app-primary-soft); color: var(--app-primary); font-weight: 500; }
.variable-set-create__status { flex-direction: row !important; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-bg-page); }
.variable-set-create__status div { display: grid; gap: 2px; }
.variable-set-create__status strong { color: var(--app-text-primary); font-size: 13px; font-weight: 500; }
.variable-set-create__status small { color: var(--app-text-muted); font-size: 11px; }
.variable-set-create__error { margin: 0; color: var(--app-danger); font-size: 12px; }

:global(.variable-set-create-dialog) {
  display: flex;
  max-height: calc(100dvh - 32px);
  flex-direction: column;
  margin: 16px auto 0;
}

:global(.variable-set-create-dialog .el-dialog__header),
:global(.variable-set-create-dialog .el-dialog__footer) {
  flex: 0 0 auto;
}

:global(.variable-set-create-dialog .el-dialog__body) {
  display: flex;
  min-height: 0;
  overflow: hidden;
}
</style>
