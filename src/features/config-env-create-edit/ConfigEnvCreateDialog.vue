<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateEnvPayload,
  createDefaultConfigEnvForm,
  type ConfigAutomationType,
  type ConfigEnvironmentStage,
  type ConfigEnvForm,
  validateConfigEnvCreateForm,
} from './model'

const props = withDefaults(defineProps<{
  modelValue: boolean
  saving?: boolean
  defaultWorkspaceCode?: string
}>(), {
  defaultWorkspaceCode: 'ALL',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateEnvPayload>]
}>()

const automationOptions: Array<{ value: ConfigAutomationType; label: string; description: string }> = [
  { value: 'API', label: '接口自动化', description: '多服务、鉴权及请求策略' },
  { value: 'WEB_UI', label: 'Web UI', description: '站点、浏览器及会话配置' },
  { value: 'APP', label: 'APP 自动化', description: '应用、设备及运行能力' },
]

const stageOptions: Array<{ value: ConfigEnvironmentStage; label: string }> = [
  { value: 'DEV', label: '开发' },
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发布' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
]

const form = reactive<ConfigEnvForm>(createDefaultConfigEnvForm(props.defaultWorkspaceCode))
const errorMessage = ref('')

function resetForm() {
  Object.assign(form, createDefaultConfigEnvForm(props.defaultWorkspaceCode))
  errorMessage.value = ''
}

function submit() {
  const error = validateConfigEnvCreateForm(form)
  if (error) {
    errorMessage.value = error
    return
  }
  errorMessage.value = ''
  emit('submit', buildCreateEnvPayload(form))
}

watch(() => props.modelValue, (visible) => {
  if (!visible) return
  resetForm()
})
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="新建环境"
    width="600px"
    dialog-class="config-env-create-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-env-create">
      <label class="config-env-create__field">
        <span>环境名称</span>
        <el-input v-model="form.envName" maxlength="64" show-word-limit placeholder="例如：订单中心测试环境" />
      </label>

      <div class="config-env-create__field">
        <span>自动化类型</span>
        <div class="config-env-create__type-grid">
          <button
            v-for="item in automationOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.automationType === item.value }"
            @click="form.automationType = item.value"
          >
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </button>
        </div>
      </div>

      <div class="config-env-create__field">
        <span>部署阶段</span>
        <div class="config-env-create__stage-list">
          <button
            v-for="item in stageOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.envType === item.value }"
            @click="form.envType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <label class="config-env-create__field">
        <span>描述</span>
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="说明该环境的用途或使用限制" />
      </label>

      <label class="config-env-create__status">
        <div><strong>创建后启用</strong><small>停用的环境不能用于新执行任务</small></div>
        <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
      </label>

      <p v-if="errorMessage" class="config-env-create__error">{{ errorMessage }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">创建环境</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-env-create { display: flex; min-height: 0; flex-direction: column; gap: 18px; overflow-y: auto; padding-right: 4px; }
.config-env-create__field { display: flex; flex-direction: column; gap: 8px; }
.config-env-create__field > span { color: var(--app-text-secondary); font-size: 13px; font-weight: 500; }
.config-env-create__field :deep(.el-select) { width: 100%; }
.config-env-create__type-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.config-env-create__type-grid button { display: flex; min-height: 74px; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px; padding: 12px; border: 1px solid var(--app-border); border-radius: 6px; background: #fff; color: var(--app-text-primary); cursor: pointer; text-align: left; }
.config-env-create__type-grid button:hover { border-color: #94bfff; background: #f7fbff; }
.config-env-create__type-grid button.is-active { border-color: var(--app-primary); background: var(--app-primary-soft); color: var(--app-primary); }
.config-env-create__type-grid strong { font-size: 13px; font-weight: 600; }
.config-env-create__type-grid small { color: var(--app-text-muted); font-size: 11px; line-height: 16px; }
.config-env-create__stage-list { display: flex; flex-wrap: wrap; gap: 8px; }
.config-env-create__stage-list button { height: 32px; padding: 0 16px; border: 1px solid var(--app-border); border-radius: 5px; background: #fff; color: var(--app-text-secondary); cursor: pointer; font-size: 12px; }
.config-env-create__stage-list button.is-active { border-color: var(--app-primary); background: var(--app-primary-soft); color: var(--app-primary); font-weight: 500; }
.config-env-create__status { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-bg-page); }
.config-env-create__status div { display: grid; gap: 2px; }
.config-env-create__status strong { color: var(--app-text-primary); font-size: 13px; font-weight: 500; }
.config-env-create__status small { color: var(--app-text-muted); font-size: 11px; }
.config-env-create__error { margin: 0; color: var(--app-danger); font-size: 12px; }

:global(.config-env-create-dialog) {
  display: flex;
  max-height: calc(100dvh - 32px);
  flex-direction: column;
  margin: 16px auto 0;
}

:global(.config-env-create-dialog .el-dialog__header),
:global(.config-env-create-dialog .el-dialog__footer) {
  flex: 0 0 auto;
}

:global(.config-env-create-dialog .el-dialog__body) {
  display: flex;
  min-height: 0;
  overflow: hidden;
}
</style>
