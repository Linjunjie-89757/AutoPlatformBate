<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { reactive, watch } from 'vue'

import { apiMethodOptions, type ApiDefinitionDetail, type ApiDefinitionItem } from '@/entities/api-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveApiDefinitionPayload,
  createApiDefinitionFormFromDetail,
  createApiDefinitionFormFromSummary,
  createDefaultApiDefinitionForm,
  type ApiDefinitionDialogMode,
  type ApiDefinitionForm,
  validateApiDefinitionForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ApiDefinitionDialogMode
    definitionItem?: ApiDefinitionItem | null
    definitionDetail?: ApiDefinitionDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
  }>(),
  {
    definitionItem: null,
    definitionDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveApiDefinitionPayload>]
  retryDetail: []
}>()

const form = reactive<ApiDefinitionForm>(createDefaultApiDefinitionForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.definitionDetail
      ? createApiDefinitionFormFromDetail(props.definitionDetail)
      : props.mode === 'edit' && props.definitionItem
        ? createApiDefinitionFormFromSummary(props.definitionItem, props.defaultWorkspaceCode)
        : createDefaultApiDefinitionForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateApiDefinitionForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveApiDefinitionPayload(form))
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
  () => [props.definitionItem, props.definitionDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增接口定义' : '编辑接口定义'"
    width="760px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="api-definition-dialog">
      <div v-if="loadingDetail" class="api-definition-dialog__hint">正在加载接口详情...</div>
      <div v-else-if="detailErrorMessage" class="api-definition-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <AppButton size="small" @click="emit('retryDetail')">重试</AppButton>
      </div>

      <div class="api-definition-dialog__grid">
        <div class="api-definition-dialog__field">
          <span>工作空间</span>
          <el-input v-model="form.workspaceCode" disabled placeholder="ALL" />
        </div>

        <div class="api-definition-dialog__field">
          <span>模块目录</span>
          <el-input v-model="form.directoryName" :disabled="loadingDetail" placeholder="例如：订单/查询" />
        </div>
      </div>

      <div class="api-definition-dialog__field">
        <span>接口名称 *</span>
        <el-input v-model="form.name" :disabled="loadingDetail" placeholder="请输入接口名称" />
      </div>

      <div class="api-definition-dialog__grid is-request">
        <div class="api-definition-dialog__field">
          <span>请求方法 *</span>
          <el-select :suffix-icon="AppSelectChevron" v-model="form.method" class="api-definition-dialog__select" :disabled="loadingDetail">
            <el-option v-for="item in apiMethodOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>

        <div class="api-definition-dialog__field">
          <span>接口路径 *</span>
          <el-input v-model="form.path" :disabled="loadingDetail" placeholder="/api/example 或完整 URL" />
        </div>
      </div>

      <div class="api-definition-dialog__grid">
        <div class="api-definition-dialog__field">
          <span>超时时间 ms *</span>
          <el-input v-model="form.timeoutMs" :disabled="loadingDetail" placeholder="10000" />
        </div>

        <div class="api-definition-dialog__field">
          <span>标签</span>
          <el-input v-model="form.tagsText" :disabled="loadingDetail" placeholder="多个标签用逗号或换行分隔" />
        </div>
      </div>

      <div class="api-definition-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          :disabled="loadingDetail"
          placeholder="补充接口用途、调用场景或注意事项"
        />
      </div>

      <p v-if="formError.message" class="api-definition-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="api-definition-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="loadingDetail || Boolean(detailErrorMessage)"
          @click="submit"
        >
          保存
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.api-definition-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.api-definition-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3) var(--app-space-4);
}

.api-definition-dialog__grid.is-request {
  grid-template-columns: 160px minmax(0, 1fr);
}

.api-definition-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.api-definition-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-definition-dialog__select {
  width: 100%;
}

.api-definition-dialog__hint,
.api-definition-dialog__error-panel {
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.api-definition-dialog__hint {
  border: 1px solid var(--app-border);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
}

.api-definition-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-definition-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.api-definition-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.api-definition-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 720px) {
  .api-definition-dialog__grid,
  .api-definition-dialog__grid.is-request {
    grid-template-columns: 1fr;
  }
}
</style>
