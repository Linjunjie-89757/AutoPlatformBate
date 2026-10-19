<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Edit, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  configStatusOptions,
  getParamDescriptionText,
  type ConfigStatus,
  type CreateParamPayload,
  type ParamSetItem,
} from '@/entities/config'
import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultWebUiVariable,
  createDefaultWebUiVariableSetForm,
  parseWebUiVariables,
  validateConfigParamForm,
  type ConfigParamForm,
  type WebUiVariableItem,
} from '@/features/config-param-create-edit'
import { deleteConfigParam } from '@/features/config-param-delete'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
  }>(),
  {
    workspaceReady: true,
  },
)

const router = useRouter()
const variableSets = ref<ParamSetItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const createDialogVisible = ref(false)
const appendDialogVisible = ref(false)
const editingVariableSet = ref<ParamSetItem | null>(null)
const deletingId = ref<number | null>(null)
const keyword = ref('')
const status = ref('')
const form = reactive<ConfigParamForm>(createDefaultWebUiVariableSetForm(props.workspaceCode))
const appendVariable = reactive<WebUiVariableItem>(createDefaultWebUiVariable())
const formError = ref('')
const appendError = ref('')

const enabledCount = computed(() => variableSets.value.filter(item => item.status !== 0).length)
const disabledCount = computed(() => variableSets.value.filter(item => item.status === 0).length)

const query = computed(() => ({
  keyword: keyword.value.trim(),
  paramType: 'WEB_UI_VARIABLE_SET',
  status: status.value === '' ? undefined : (Number(status.value) as ConfigStatus),
}))

async function loadVariableSets() {
  if (!props.workspaceReady) {
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsParams(props.workspaceCode, query.value)
    variableSets.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function searchVariableSets() {
  void loadVariableSets()
}

function resetFilters() {
  keyword.value = ''
  status.value = ''
  void loadVariableSets()
}

function resetForm(nextForm = createDefaultWebUiVariableSetForm(props.workspaceCode)) {
  Object.assign(form, nextForm)
  form.paramType = 'WEB_UI_VARIABLE_SET'
  formError.value = ''
}

function resetAppendVariable() {
  Object.assign(appendVariable, createDefaultWebUiVariable())
  appendError.value = ''
}

function openCreateDialog() {
  editingVariableSet.value = null
  resetForm()
  createDialogVisible.value = true
}

function openAppendVariableDialog(variableSet: ParamSetItem) {
  editingVariableSet.value = variableSet
  resetAppendVariable()
  appendDialogVisible.value = true
}

function openDetailPage(variableSet: ParamSetItem) {
  void router.push(`/automation/web/variables/${variableSet.id}`)
}

function addVariable() {
  form.variables.push(createDefaultWebUiVariable())
}

function removeVariable(index: number) {
  form.variables.splice(index, 1)
  if (form.variables.length === 0) {
    addVariable()
  }
}

async function submitVariableSet() {
  const error = validateConfigParamForm(form)
  if (error) {
    formError.value = error
    return
  }

  const payload = buildCreateParamPayload(form)
  saving.value = true
  try {
    const nextPayload: CreateParamPayload = {
      ...payload,
      workspaceCode: props.workspaceCode === 'ALL' ? payload.workspaceCode : props.workspaceCode,
      paramType: 'WEB_UI_VARIABLE_SET',
    }
    await configApi.createSettingsParam(props.workspaceCode, nextPayload)
    ElMessage.success('变量集已创建')
    createDialogVisible.value = false
    await loadVariableSets()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitAppendVariable() {
  if (!editingVariableSet.value) {
    return
  }

  const variableName = appendVariable.name.trim()
  if (!variableName) {
    appendError.value = '请输入变量名'
    return
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName)) {
    appendError.value = `变量名 ${variableName} 只能包含字母、数字、下划线，且不能以数字开头`
    return
  }

  const currentVariables = parseWebUiVariables(editingVariableSet.value.contentJson)
  const upperName = variableName.toUpperCase()
  if (currentVariables.some(variable => variable.name.trim().toUpperCase() === upperName)) {
    appendError.value = `变量名 ${variableName} 已存在`
    return
  }

  const nextForm = createConfigParamFormFromItem(editingVariableSet.value)
  nextForm.variables = [
    ...currentVariables,
    {
      name: variableName,
      value: appendVariable.value,
      sensitive: appendVariable.sensitive,
      description: appendVariable.description.trim(),
    },
  ]

  saving.value = true
  try {
    await configApi.updateSettingsParam(props.workspaceCode, editingVariableSet.value.id, {
      ...buildCreateParamPayload(nextForm),
      workspaceCode: props.workspaceCode === 'ALL' ? nextForm.workspaceCode : props.workspaceCode,
      paramType: 'WEB_UI_VARIABLE_SET',
    })
    ElMessage.success('变量已新增')
    appendDialogVisible.value = false
    await loadVariableSets()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeVariableSet(variableSet: ParamSetItem) {
  deletingId.value = variableSet.id
  try {
    await deleteConfigParam(variableSet, props.workspaceCode)
    ElMessage.success('变量集已删除')
    await loadVariableSets()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingId.value = null
  }
}

async function toggleVariableSetStatus(variableSet: ParamSetItem) {
  saving.value = true
  try {
    const nextForm = createConfigParamFormFromItem(variableSet)
    nextForm.status = variableSet.status === 1 ? 0 : 1
    await configApi.updateSettingsParam(props.workspaceCode, variableSet.id, {
      ...buildCreateParamPayload(nextForm),
      workspaceCode: props.workspaceCode === 'ALL' ? nextForm.workspaceCode : props.workspaceCode,
      paramType: 'WEB_UI_VARIABLE_SET',
    })
    ElMessage.success(nextForm.status === 1 ? '变量集已启用' : '变量集已停用')
    await loadVariableSets()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function getVariableCount(variableSet: ParamSetItem) {
  return parseWebUiVariables(variableSet.contentJson).length
}

function getSensitiveVariableCount(variableSet: ParamSetItem) {
  return parseWebUiVariables(variableSet.contentJson).filter(variable => variable.sensitive).length
}

function getVariablePreview(variableSet: ParamSetItem) {
  const variables = parseWebUiVariables(variableSet.contentJson)
  if (!variables.length) {
    return getParamDescriptionText(variableSet)
  }
  const names = variables.slice(0, 4).map(variable => variable.name).join('、')
  return `${names}${variables.length > 4 ? ' 等' : ''}`
}

function getWorkspaceLabel(variableSet: ParamSetItem) {
  return variableSet.workspaceName || variableSet.workspaceCode || '-'
}

onMounted(() => {
  void loadVariableSets()
})

onBeforeUnmount(() => {
})

watch(
  () => [props.workspaceCode, props.workspaceReady] as const,
  () => {
    resetForm()
    resetAppendVariable()
    void loadVariableSets()
  },
)
</script>

<template>
  <section class="web-ui-variable-panel">
    <header class="web-ui-variable-panel__header">
      <div>
        <h2>变量集设置</h2>
        <p>维护 Web UI 用例运行时可复用的测试数据，步骤里可通过 <code v-pre>{{变量名}}</code> 引用。</p>
      </div>
      <div class="web-ui-variable-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadVariableSets">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集</AppButton>
      </div>
    </header>

    <div class="web-ui-variable-stats">
      <div class="web-ui-variable-stat">
        <span>全部变量集</span>
        <strong>{{ variableSets.length }}</strong>
      </div>
      <div class="web-ui-variable-stat">
        <span>启用中</span>
        <strong>{{ enabledCount }}</strong>
      </div>
      <div class="web-ui-variable-stat">
        <span>已停用</span>
        <strong>{{ disabledCount }}</strong>
      </div>
    </div>

    <div v-if="!errorMessage" class="web-ui-variable-toolbar">
      <el-input
        v-model="keyword"
        class="web-ui-variable-toolbar__search"
        clearable
        placeholder="搜索变量集名称 / 变量名 / 说明"
        :prefix-icon="Search"
        @keyup.enter="searchVariableSets"
      />
      <el-select :suffix-icon="AppSelectChevron" v-model="status" class="web-ui-variable-toolbar__select" clearable placeholder="状态">
        <el-option
          v-for="item in configStatusOptions"
          :key="item.value"
          :label="item.label"
          :value="String(item.value)"
        />
      </el-select>
      <AppButton type="primary" :icon="Search" @click="searchVariableSets">查询</AppButton>
      <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
    </div>

    <AppLoadingState v-if="loading && !variableSets.length" text="正在加载变量集..." />

    <AppEmptyState
      v-else-if="errorMessage && !variableSets.length"
      title="变量集加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadVariableSets">重试</AppButton>
      </template>
    </AppEmptyState>

    <div
      v-else
      v-loading="loading"
      class="web-ui-variable-card-grid"
    >
      <article
        v-for="variableSet in variableSets"
        :key="variableSet.id"
        class="web-ui-variable-card"
        :class="{ 'is-disabled': variableSet.status === 0 }"
      >
        <div class="web-ui-variable-card__main">
          <div class="web-ui-variable-card__head">
            <div class="web-ui-variable-card__icon" aria-hidden="true">
              <span>{{ getVariableCount(variableSet) }}</span>
            </div>
            <div class="web-ui-variable-card__title">
              <div class="web-ui-variable-card__name-row">
                <h3>{{ variableSet.paramName }}</h3>
                <span class="web-ui-variable-card__status" :class="{ 'is-disabled': variableSet.status === 0 }">
                  {{ variableSet.status === 1 ? '启用' : '停用' }}
                </span>
              </div>
              <p>{{ getVariablePreview(variableSet) }}</p>
            </div>
          </div>
          <div class="web-ui-variable-card__actions">
            <button
              type="button"
              :title="variableSet.status === 1 ? '停用' : '启用'"
              :aria-label="variableSet.status === 1 ? '停用变量集' : '启用变量集'"
              :disabled="saving"
              @click="toggleVariableSetStatus(variableSet)"
            >
              {{ variableSet.status === 1 ? '停' : '启' }}
            </button>
            <button type="button" title="新增变量" aria-label="新增变量" @click="openAppendVariableDialog(variableSet)">
              <Plus />
            </button>
            <button type="button" title="编辑" aria-label="编辑变量集" @click="openDetailPage(variableSet)">
              <Edit />
            </button>
            <button
              type="button"
              class="is-danger"
              title="删除"
              aria-label="删除变量集"
              :disabled="deletingId === variableSet.id"
              @click="removeVariableSet(variableSet)"
            >
              <Delete />
            </button>
          </div>
        </div>

        <footer class="web-ui-variable-card__meta">
          <span>所属空间：{{ getWorkspaceLabel(variableSet) }}</span>
          <span>{{ getVariableCount(variableSet) }} 个变量</span>
          <span>{{ getSensitiveVariableCount(variableSet) }} 个敏感变量</span>
          <span>{{ getParamDescriptionText(variableSet) }}</span>
        </footer>
      </article>
    </div>

    <AppEmptyState
      v-if="!loading && !errorMessage && !variableSets.length"
      title="暂无变量集"
      description="当前空间还没有 Web UI 变量集。"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集</AppButton>
      </template>
    </AppEmptyState>

    <el-dialog
      v-model="createDialogVisible"
      title="新增变量集"
      width="760px"
      destroy-on-close
    >
      <div class="web-ui-variable-dialog">
        <el-form label-width="96px">
          <el-form-item label="变量集名称" required>
            <el-input v-model="form.paramName" maxlength="80" show-word-limit placeholder="例如：测试环境管理员变量集" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select :suffix-icon="AppSelectChevron" v-model="form.status">
              <el-option
                v-for="item in configStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <div class="web-ui-variable-dialog__toolbar">
          <span>初始变量</span>
          <el-button size="small" type="primary" @click="addVariable">新增变量</el-button>
        </div>
        <el-table class="web-ui-variable-dialog__table" :data="form.variables" border>
          <el-table-column label="变量名" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="USERNAME" />
            </template>
          </el-table-column>
          <el-table-column label="变量值" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.value" :type="row.sensitive ? 'password' : 'text'" show-password placeholder="变量值" />
            </template>
          </el-table-column>
          <el-table-column label="敏感" width="82" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.sensitive" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.description" placeholder="用途说明" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link @click="removeVariable($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="formError" class="web-ui-variable-dialog__error">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="web-ui-variable-dialog__footer">
          <AppButton :disabled="saving" @click="createDialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="saving" @click="submitVariableSet">保存</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="appendDialogVisible"
      title="新增变量"
      width="560px"
      destroy-on-close
    >
      <el-form class="web-ui-variable-append-form" label-width="88px">
        <el-form-item label="变量集">
          <el-input :model-value="editingVariableSet?.paramName || '-'" disabled />
        </el-form-item>
        <el-form-item label="变量名" required>
          <el-input v-model="appendVariable.name" maxlength="80" placeholder="USERNAME" />
        </el-form-item>
        <el-form-item label="变量值">
          <el-input
            v-model="appendVariable.value"
            :type="appendVariable.sensitive ? 'password' : 'text'"
            show-password
            placeholder="变量值"
          />
        </el-form-item>
        <el-form-item label="敏感">
          <el-switch v-model="appendVariable.sensitive" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="appendVariable.description" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <p v-if="appendError" class="web-ui-variable-dialog__error">{{ appendError }}</p>
      <template #footer>
        <div class="web-ui-variable-dialog__footer">
          <AppButton :disabled="saving" @click="appendDialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="saving" @click="submitAppendVariable">保存</AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.web-ui-variable-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-variable-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-variable-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-variable-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.web-ui-variable-panel__actions,
.web-ui-variable-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-variable-stats {
  display: grid;
  gap: var(--app-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.web-ui-variable-stat {
  display: flex;
  min-height: 76px;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
  padding: var(--app-space-4);
}

.web-ui-variable-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-variable-stat strong {
  margin-top: var(--app-space-1);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: var(--app-line-height-lg);
}

.web-ui-variable-toolbar {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.web-ui-variable-toolbar__search {
  max-width: 320px;
}

.web-ui-variable-toolbar__select {
  width: 140px;
}

.web-ui-variable-card-grid {
  display: grid;
  gap: var(--app-space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.web-ui-variable-card {
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  padding: var(--app-space-5);
  transition: border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
}

.web-ui-variable-card:hover {
  border-color: var(--app-border);
  box-shadow: var(--app-shadow-sm);
}

.web-ui-variable-card.is-disabled {
  opacity: 0.64;
}

.web-ui-variable-card__main {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-variable-card__head {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: var(--app-space-3);
}

.web-ui-variable-card__icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-md);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 700;
}

.web-ui-variable-card__title {
  min-width: 0;
  flex: 1;
}

.web-ui-variable-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-1);
}

.web-ui-variable-card__name-row h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-variable-card__title p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.web-ui-variable-card__status {
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--app-success-soft);
  color: var(--app-success);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
  padding: 2px 8px;
}

.web-ui-variable-card__status.is-disabled {
  background: var(--app-border-soft);
  color: var(--app-text-secondary);
}

.web-ui-variable-card__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-1);
  opacity: 0;
  transition: opacity 180ms ease;
}

.web-ui-variable-card:hover .web-ui-variable-card__actions {
  opacity: 1;
}

.web-ui-variable-card__actions button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease;
}

.web-ui-variable-card__actions button:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.web-ui-variable-card__actions button.is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.web-ui-variable-card__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.web-ui-variable-card__actions svg {
  width: 16px;
  height: 16px;
}

.web-ui-variable-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2) var(--app-space-4);
  margin-top: var(--app-space-4);
}

.web-ui-variable-card__meta span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
}

.web-ui-variable-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.web-ui-variable-dialog__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-variable-dialog__toolbar span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-variable-dialog__table {
  width: 100%;
}

.web-ui-variable-dialog__error {
  margin: var(--app-space-3) 0 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.web-ui-variable-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-variable-panel :deep(.el-dialog .el-select) {
  width: 100%;
}

@media (max-width: 900px) {
  .web-ui-variable-panel__header,
  .web-ui-variable-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .web-ui-variable-panel__actions,
  .web-ui-variable-toolbar {
    width: 100%;
  }

  .web-ui-variable-stats {
    grid-template-columns: 1fr;
  }

  .web-ui-variable-card-grid {
    grid-template-columns: 1fr;
  }

  .web-ui-variable-toolbar__search,
  .web-ui-variable-toolbar__select {
    width: 100%;
    max-width: none;
  }
}
</style>
