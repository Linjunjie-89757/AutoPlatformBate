<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import {
  configApi,
  configEnvTypeOptions,
  configParamTypeOptions,
  configStatusOptions,
  type MockApplicationItem,
  type EnvConfigItem,
  type ParamSetItem,
} from '@/entities/config'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateEnvPayload,
  createConfigEnvFormFromItem,
  createDefaultConfigEnvForm,
  createDefaultServiceEndpoint,
  type ConfigEnvDialogMode,
  type ConfigEnvForm,
  type ConfigEnvServiceEndpointForm,
  validateConfigEnvForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigEnvDialogMode
    env?: EnvConfigItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    env: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateEnvPayload>]
}>()

const form = reactive<ConfigEnvForm>(createDefaultConfigEnvForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const workspaces = ref<WorkspaceItem[]>([])
const loadingWorkspaces = ref(false)
const loadingVariableSets = ref(false)
const loadingMockApplications = ref(false)
let workspaceRequestSeq = 0
let variableSetRequestSeq = 0
let mockApplicationRequestSeq = 0
const serviceKeySnapshots = new WeakMap<ConfigEnvServiceEndpointForm, string>()

const paramTypeLabelMap = new Map<string, string>(configParamTypeOptions.map(item => [item.value, item.label]))

const enabledVariableSets = computed(() => variableSets.value.filter(item => item.status !== 0))
const enabledMockApplications = computed(() => mockApplications.value.filter(item => item.status !== 0))
const workspaceOptions = computed(() => {
  const options = workspaces.value
    .filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
    .map(item => ({
      label: item.workspaceName || item.workspaceCode,
      value: item.workspaceCode,
    }))

  if (form.workspaceCode && form.workspaceCode !== 'ALL' && !options.some(item => item.value === form.workspaceCode)) {
    options.unshift({
      label: form.workspaceCode,
      value: form.workspaceCode,
    })
  }

  return options
})
const defaultService = computed(() => {
  return form.services.find(service => service.key === form.defaultServiceKey) ?? form.services[0] ?? null
})
const duplicateServiceKeys = computed(() => {
  const counter = new Map<string, number>()
  for (const service of form.services) {
    const key = service.key.trim()
    if (key) {
      counter.set(key, (counter.get(key) || 0) + 1)
    }
  }
  return new Set(Array.from(counter.entries()).filter(([, count]) => count > 1).map(([key]) => key))
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.env
      ? createConfigEnvFormFromItem(props.env)
      : createDefaultConfigEnvForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  ensureSelectedWorkspace()
  formError.message = ''
}

function ensureSelectedWorkspace() {
  if (!workspaceOptions.value.length) {
    return
  }

  if (form.workspaceCode === 'ALL' || !workspaceOptions.value.some(item => item.value === form.workspaceCode)) {
    form.workspaceCode = workspaceOptions.value[0].value
  }
}

function submit() {
  const error = validateConfigEnvForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateEnvPayload(form))
}

function syncBaseUrlFromDefaultService() {
  if (defaultService.value) {
    form.baseUrl = defaultService.value.baseUrl
  }
}

function addServiceEndpoint() {
  const index = form.services.length + 1
  form.services.push({
    key: `service-${index}`,
    name: `服务 ${index}`,
    baseUrl: '',
    timeoutMs: 30000,
    enabled: true,
  })
}

function removeServiceEndpoint(service: ConfigEnvServiceEndpointForm) {
  if (form.services.length <= 1) {
    return
  }
  const index = form.services.indexOf(service)
  if (index >= 0) {
    form.services.splice(index, 1)
  }
  if (!form.services.some(item => item.key === form.defaultServiceKey)) {
    form.defaultServiceKey = form.services[0]?.key ?? createDefaultServiceEndpoint().key
  }
  syncBaseUrlFromDefaultService()
}

function markDefaultService(service: ConfigEnvServiceEndpointForm) {
  form.defaultServiceKey = service.key
  syncBaseUrlFromDefaultService()
}

function handleServiceKeyChange(service: ConfigEnvServiceEndpointForm, oldKey: string) {
  service.key = service.key.trim()
  if (form.defaultServiceKey === oldKey) {
    form.defaultServiceKey = service.key
  }
}

function rememberServiceKey(service: ConfigEnvServiceEndpointForm) {
  serviceKeySnapshots.set(service, service.key)
}

function isDuplicateServiceKey(service: ConfigEnvServiceEndpointForm) {
  return duplicateServiceKeys.value.has(service.key.trim())
}

async function loadWorkspaces() {
  const requestId = ++workspaceRequestSeq
  loadingWorkspaces.value = true
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    if (requestId === workspaceRequestSeq) {
      workspaces.value = Array.isArray(items) ? items : []
      ensureSelectedWorkspace()
    }
  } catch (error) {
    if (requestId === workspaceRequestSeq) {
      formError.message = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === workspaceRequestSeq) {
      loadingWorkspaces.value = false
    }
  }
}

async function loadVariableSets() {
  const requestId = ++variableSetRequestSeq
  loadingVariableSets.value = true
  try {
    const page = await configApi.getSettingsParams(props.defaultWorkspaceCode, {
      status: 1,
    })
    if (requestId === variableSetRequestSeq) {
      variableSets.value = Array.isArray(page.items) ? page.items : []
    }
  } catch (error) {
    if (requestId === variableSetRequestSeq) {
      formError.message = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === variableSetRequestSeq) {
      loadingVariableSets.value = false
    }
  }
}

async function loadMockApplications() {
  const requestId = ++mockApplicationRequestSeq
  loadingMockApplications.value = true
  try {
    const page = await configApi.getMockApplications(props.defaultWorkspaceCode, {
      status: 1,
    })
    if (requestId === mockApplicationRequestSeq) {
      mockApplications.value = Array.isArray(page.items) ? page.items : []
    }
  } catch (error) {
    if (requestId === mockApplicationRequestSeq) {
      formError.message = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === mockApplicationRequestSeq) {
      loadingMockApplications.value = false
    }
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      void loadWorkspaces()
      void loadVariableSets()
      void loadMockApplications()
    }
  },
)

watch(
  () => props.env,
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <component
    :is="mode === 'edit' ? 'el-drawer' : AppDialog"
    :model-value="modelValue"
    :title="mode === 'create' ? '新增环境' : '编辑环境'"
    :width="mode === 'create' ? '560px' : undefined"
    :size="mode === 'edit' ? '760px' : undefined"
    class="config-env-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-env-dialog">
      <div class="config-env-dialog__field">
        <span>目标空间</span>
        <el-select
          v-model="form.workspaceCode"
          filterable
          :loading="loadingWorkspaces"
          placeholder="请选择目标空间"
        >
          <el-option
            v-for="workspace in workspaceOptions"
            :key="workspace.value"
            :label="workspace.label"
            :value="workspace.value"
          />
        </el-select>
      </div>

      <div class="config-env-dialog__field">
        <span>环境名称 *</span>
        <el-input v-model="form.envName" placeholder="例如：测试环境" />
      </div>

      <div class="config-env-dialog__field">
        <span>环境分组</span>
        <div class="config-env-dialog__segment">
          <button
            v-for="item in configEnvTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.envType === item.value }"
            @click="form.envType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="config-env-dialog__field">
        <span>Base URL *</span>
        <el-input
          v-model="form.baseUrl"
          placeholder="https://api.example.com"
          @change="() => { if (defaultService) defaultService.baseUrl = form.baseUrl }"
        />
      </div>

      <div v-if="mode === 'edit'" class="config-env-dialog__field">
        <div class="config-env-dialog__field-header">
          <span>服务地址</span>
          <AppButton size="small" @click="addServiceEndpoint">新增服务</AppButton>
        </div>
        <div class="config-env-dialog__services">
          <div class="config-env-dialog__service-head">
            <span>服务标识</span>
            <span>服务名称</span>
            <span>服务地址</span>
            <span>默认</span>
            <span>操作</span>
          </div>
          <div
            v-for="(service, serviceIndex) in form.services"
            :key="`${service.key}-${serviceIndex}`"
            class="config-env-dialog__service-row"
            :class="{ 'is-default': service.key === form.defaultServiceKey, 'has-error': isDuplicateServiceKey(service) }"
          >
            <el-input
              v-model="service.key"
              placeholder="服务标识"
              @focus="rememberServiceKey(service)"
              @change="handleServiceKeyChange(service, serviceKeySnapshots.get(service) || service.key)"
            />
            <el-input v-model="service.name" placeholder="服务名称" />
            <el-input
              v-model="service.baseUrl"
              class="config-env-dialog__service-url"
              placeholder="https://service.example.com"
              @change="() => { if (service.key === form.defaultServiceKey) form.baseUrl = service.baseUrl }"
            />
            <button
              type="button"
              class="config-env-dialog__service-default"
              :class="{ 'is-active': service.key === form.defaultServiceKey }"
              @click="markDefaultService(service)"
            >
              {{ service.key === form.defaultServiceKey ? '默认' : '设为默认' }}
            </button>
            <button
              type="button"
              class="config-env-dialog__service-remove"
              :disabled="form.services.length <= 1"
              @click="removeServiceEndpoint(service)"
            >
              删除
            </button>
            <p v-if="isDuplicateServiceKey(service)" class="config-env-dialog__service-error">服务标识重复</p>
          </div>
        </div>
        <p class="config-env-dialog__hint">
          默认服务地址会同步为兼容 Base URL，后续接口和 Web UI 可按服务标识引用。
        </p>
      </div>

      <div v-if="mode === 'edit'" class="config-env-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该环境的用途或注意事项"
        />
      </div>

      <div v-if="mode === 'edit'" class="config-env-dialog__field">
        <span>默认变量集</span>
        <el-select
          v-model="form.defaultVariableSetId"
          clearable
          filterable
          :loading="loadingVariableSets"
          placeholder="请选择默认变量集"
        >
          <el-option
            v-for="variableSet in enabledVariableSets"
            :key="variableSet.id"
            :label="`${variableSet.paramName}（${paramTypeLabelMap.get(variableSet.paramType) ?? variableSet.paramType}）`"
            :value="variableSet.id"
          />
        </el-select>
      </div>

      <div v-if="mode === 'edit'" class="config-env-dialog__field">
        <span>关联 Mock 应用</span>
        <el-select
          v-model="form.mockApplicationId"
          clearable
          filterable
          :loading="loadingMockApplications"
          placeholder="请选择 Mock 应用"
        >
          <el-option
            v-for="mockApplication in enabledMockApplications"
            :key="mockApplication.id"
            :label="`${mockApplication.appName}（${mockApplication.appCode}）`"
            :value="mockApplication.id"
          />
        </el-select>
      </div>

      <div v-if="mode === 'edit'" class="config-env-dialog__grid">
        <label>
          <span>默认超时</span>
          <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </label>
        <label>
          <span>忽略 SSL</span>
          <el-switch v-model="form.ignoreHttpsErrors" />
        </label>
      </div>

      <div class="config-env-dialog__field">
        <span>状态</span>
        <div class="config-env-dialog__segment is-two">
          <button
            v-for="item in configStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.status === item.value }"
            @click="form.status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError.message" class="config-env-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </component>
</template>

<style scoped>
.config-env-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-env-drawer :deep(.el-drawer__body) {
  padding: var(--app-space-5);
}

.config-env-drawer :deep(.el-drawer__footer) {
  padding: var(--app-space-4) var(--app-space-5);
  border-top: 1px solid var(--app-border);
}

.config-env-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-env-dialog__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.config-env-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-env-dialog__field-header > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-env-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-env-dialog__grid label,
.config-env-dialog__switches label {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-env-dialog__switches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-env-dialog :deep(.el-select),
.config-env-dialog :deep(.el-input-number) {
  width: 100%;
}

.config-env-dialog__services {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-env-dialog__service-head,
.config-env-dialog__service-row {
  display: grid;
  grid-template-columns: minmax(92px, 0.8fr) minmax(96px, 1fr) minmax(180px, 1.6fr) 84px 62px;
  gap: var(--app-space-2);
  align-items: center;
}

.config-env-dialog__service-head {
  color: var(--app-text-tertiary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.config-env-dialog__service-row {
  position: relative;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.config-env-dialog__service-row.is-default {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.config-env-dialog__service-row.has-error {
  border-color: var(--app-danger);
}

.config-env-dialog__service-default,
.config-env-dialog__service-remove {
  min-height: var(--app-control-height-md);
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  padding: 0 var(--app-space-3);
}

.config-env-dialog__service-default:hover,
.config-env-dialog__service-remove:hover {
  background: var(--app-bg-page);
}

.config-env-dialog__service-default.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-env-dialog__service-remove:disabled {
  color: var(--app-text-disabled);
  cursor: not-allowed;
}

.config-env-dialog__service-error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.config-env-dialog__hint {
  margin: 0;
  color: var(--app-text-tertiary);
  font-size: var(--app-font-size-sm);
}

.config-env-dialog__segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.config-env-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-env-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-env-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.config-env-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-env-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
