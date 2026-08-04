<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Connection, Delete, Lock, MoreFilled, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type ConfigReferenceSummary,
  type CreateParamPayload,
  type ParamSetChangeHistoryItem,
  type ParamSetItem,
  type ParamSetVersionItem,
} from '@/entities/config'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import {
  buildCreateParamPayload,
  ConfigVariableSetCreateDialog,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  createDefaultWebUiVariable,
  parseVariableSetMetadata,
  parseWebUiVariables,
  type ConfigParamForm,
} from '@/features/config-param-create-edit'
import { deleteConfigParam } from '@/features/config-param-delete'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import ConfigParamChangeHistoryDrawer from '@/widgets/config-param-change-history-drawer/ConfigParamChangeHistoryDrawer.vue'
import ConfigParamVersionDrawer from '@/widgets/config-param-version-drawer/ConfigParamVersionDrawer.vue'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'

const props = withDefaults(defineProps<{
  workspaceCode?: string
  mode?: 'all' | 'global'
}>(), {
  workspaceCode: 'ALL',
  mode: 'all',
})

const params = ref<ParamSetItem[]>([])
const workspaces = ref<WorkspaceItem[]>([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const errorMessage = ref('')
const keyword = ref('')
const scopeFilter = ref('ALL')
const stageFilter = ref('ALL')
const createVisible = ref(false)
const detailParam = ref<ParamSetItem | null>(null)
const detailForm = reactive<ConfigParamForm>(createDefaultConfigParamForm(props.workspaceCode))
const globalWorkspaceCode = ref('')
const detailKeyword = ref('')
const detailError = ref('')
const referenceVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const historyVisible = ref(false)
const historyLoading = ref(false)
const historyItems = ref<ParamSetChangeHistoryItem[]>([])
const versionVisible = ref(false)
const versionLoading = ref(false)
const versionItems = ref<ParamSetVersionItem[]>([])
const versionParam = ref<ParamSetItem | null>(null)
const rollbackingId = ref<number | null>(null)

const scopeOptions = [
  { value: 'ALL', label: '全部范围' },
  { value: 'BUSINESS', label: '通用' },
  { value: 'API_VARIABLE_SET', label: '接口自动化' },
  { value: 'WEB_UI_VARIABLE_SET', label: 'Web UI' },
  { value: 'APP_UI_VARIABLE_SET', label: 'APP 自动化' },
]
const stageOptions = [
  { value: 'ALL', label: '全部阶段' },
  { value: 'COMMON', label: '通用' },
  { value: 'DEV', label: '开发' },
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发布' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
]
const rowScopeOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'API', label: 'API' },
  { value: 'WEB_UI', label: 'Web UI' },
  { value: 'APP', label: 'APP' },
]
const valueTypeOptions = [
  { value: 'TEXT', label: '文本' },
  { value: 'NUMBER', label: '数字' },
  { value: 'BOOLEAN', label: '布尔' },
  { value: 'JSON', label: 'JSON' },
  { value: 'SECRET', label: '密钥' },
]
const scopeLabelMap = new Map(scopeOptions.map(item => [item.value, item.label]))
const stageLabelMap = new Map(stageOptions.map(item => [item.value, item.label]))

const globalWorkspaceOptions = computed(() => {
  const options = new Map<string, { workspaceCode: string; workspaceName: string }>()
  for (const workspace of workspaces.value) {
    if (!workspace.workspaceCode || workspace.workspaceCode === 'ALL' || workspace.allScope) continue
    if (props.workspaceCode !== 'ALL' && workspace.workspaceCode !== props.workspaceCode) continue
    options.set(workspace.workspaceCode, {
      workspaceCode: workspace.workspaceCode,
      workspaceName: workspace.workspaceName || workspace.workspaceCode,
    })
  }
  for (const item of params.value) {
    if (!item.workspaceCode || item.workspaceCode === 'ALL') continue
    if (props.workspaceCode !== 'ALL' && item.workspaceCode !== props.workspaceCode) continue
    if (!options.has(item.workspaceCode)) {
      options.set(item.workspaceCode, {
        workspaceCode: item.workspaceCode,
        workspaceName: item.workspaceName || item.workspaceCode,
      })
    }
  }
  if (props.workspaceCode !== 'ALL' && !options.has(props.workspaceCode)) {
    options.set(props.workspaceCode, { workspaceCode: props.workspaceCode, workspaceName: props.workspaceCode })
  }
  return [...options.values()]
})
const currentGlobalParam = computed<ParamSetItem | null>(() => {
  const workspace = globalWorkspaceOptions.value.find(item => item.workspaceCode === globalWorkspaceCode.value)
  if (!workspace) return null
  return params.value.find(item => isGlobalParam(item) && item.workspaceCode === workspace.workspaceCode) || {
    id: -1,
    workspaceCode: workspace.workspaceCode,
    workspaceName: workspace.workspaceName,
    paramType: 'GLOBAL',
    paramName: '全局变量',
    contentJson: JSON.stringify({ description: '工作区内自动生效的系统全局变量', stageType: 'COMMON', systemBuiltIn: true, variables: [] }),
    status: 1,
  }
})
const globalParams = computed(() => currentGlobalParam.value ? [currentGlobalParam.value] : [])
const normalParams = computed(() => params.value.filter(item => !isGlobalParam(item)))
const filteredNormalParams = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return normalParams.value.filter(item => {
    const stage = parseVariableSetMetadata(item.contentJson).stageType
    if (scopeFilter.value !== 'ALL' && item.paramType !== scopeFilter.value) return false
    if (stageFilter.value !== 'ALL' && stage !== stageFilter.value) return false
    return !query || `${item.paramName} ${parseVariableSetMetadata(item.contentJson).description}`.toLowerCase().includes(query)
  })
})
const displayedParams = computed(() => props.mode === 'global'
  ? globalParams.value
  : [...globalParams.value, ...filteredNormalParams.value])
const detailIsGlobal = computed(() => Boolean(detailParam.value && isGlobalParam(detailParam.value)))
const detailVariableRows = computed(() => {
  const query = detailKeyword.value.trim().toLowerCase()
  return detailForm.variables
    .map((variable, index) => ({ variable, index }))
    .filter(item => !query || `${item.variable.name} ${item.variable.value} ${item.variable.description}`.toLowerCase().includes(query))
})

function isGlobalParam(item: ParamSetItem) {
  return item.paramType === 'GLOBAL'
}

function scopeLabel(item: ParamSetItem) {
  if (isGlobalParam(item)) return '全部范围'
  return scopeLabelMap.get(item.paramType) || item.paramType
}

function stageLabel(item: ParamSetItem) {
  if (isGlobalParam(item)) return '按变量设置'
  const stage = parseVariableSetMetadata(item.contentJson).stageType
  return stageLabelMap.get(stage) || stage
}

function variableCount(item: ParamSetItem) {
  return parseWebUiVariables(item.contentJson).length
}

function description(item: ParamSetItem) {
  if (isGlobalParam(item)) return '工作区内自动生效，无需环境手动绑定'
  return parseVariableSetMetadata(item.contentJson).description || '暂未填写说明'
}

async function loadParams(preferredId = detailParam.value?.id) {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsParams(props.workspaceCode)
    params.value = page.items || []
    if (preferredId != null) {
      const next = preferredId < 0
        ? currentGlobalParam.value
        : params.value.find(item => item.id === preferredId)
      if (next) openDetail(next)
    }
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadWorkspaces() {
  try {
    workspaces.value = await workspaceApi.getSwitchableWorkspaces()
  } catch {
    workspaces.value = []
  }
}

function openDetail(item: ParamSetItem) {
  detailParam.value = item
  Object.assign(detailForm, createConfigParamFormFromItem(item))
  if (isGlobalParam(item)) {
    detailForm.paramName = '全局变量'
    detailForm.paramType = 'GLOBAL'
    detailForm.status = 1
  }
  detailKeyword.value = ''
  detailError.value = ''
}

function switchGlobalWorkspace() {
  if (currentGlobalParam.value) openDetail(currentGlobalParam.value)
}

function closeDetail() {
  detailParam.value = null
  detailKeyword.value = ''
  detailError.value = ''
}

async function createVariableSet(payload: CreateParamPayload) {
  saving.value = true
  try {
    const created = await configApi.createSettingsParam(props.workspaceCode, payload)
    createVisible.value = false
    await loadParams(created.id)
    ElMessage.success('变量集已创建，请继续添加变量')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function addVariable() {
  detailForm.variables.push(createDefaultWebUiVariable())
}

function removeVariable(index: number) {
  detailForm.variables.splice(index, 1)
}

function syncSensitive(row: { valueType?: string; sensitive: boolean }) {
  row.sensitive = row.valueType === 'SECRET'
}

function validateDetail() {
  const names = new Set<string>()
  for (const variable of detailForm.variables) {
    const name = variable.name.trim()
    if (!name) return '变量名不能为空'
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) return `变量名 ${name} 格式不正确`
    const key = name.toUpperCase()
    if (names.has(key)) return `变量名 ${name} 重复`
    names.add(key)
  }
  return ''
}

async function saveDetail() {
  if (!detailParam.value) return
  const error = validateDetail()
  if (error) {
    detailError.value = error
    return
  }
  if (detailIsGlobal.value) {
    detailForm.paramName = '全局变量'
    detailForm.paramType = 'GLOBAL'
    detailForm.status = 1
  }
  saving.value = true
  try {
    const payload = buildCreateParamPayload(detailForm)
    const targetWorkspaceCode = detailParam.value.workspaceCode || props.workspaceCode
    const saved = detailParam.value.id < 0
      ? await configApi.createSettingsParam(targetWorkspaceCode, payload)
      : await configApi.updateSettingsParam(targetWorkspaceCode, detailParam.value.id, payload)
    await loadParams(saved.id)
    detailError.value = ''
    ElMessage.success(detailIsGlobal.value ? '全局变量已保存' : '变量集已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeParam(item: ParamSetItem) {
  if (isGlobalParam(item)) return
  deletingId.value = item.id
  try {
    await deleteConfigParam(item, item.workspaceCode || props.workspaceCode)
    await loadParams()
    ElMessage.success('变量集已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingId.value = null
  }
}

async function openReferences(item: ParamSetItem) {
  if (item.id < 0) return
  referenceVisible.value = true
  referenceLoading.value = true
  try {
    referenceSummary.value = await configApi.getSettingsParamReferences(item.workspaceCode || props.workspaceCode, item.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

async function openHistory(item: ParamSetItem) {
  if (item.id < 0) return
  historyVisible.value = true
  historyLoading.value = true
  try {
    const page = await configApi.getSettingsParamChangeHistory(item.workspaceCode || props.workspaceCode, item.id)
    historyItems.value = page.items || []
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    historyLoading.value = false
  }
}

async function openVersions(item: ParamSetItem) {
  if (item.id < 0) return
  versionParam.value = item
  versionVisible.value = true
  versionLoading.value = true
  try {
    const page = await configApi.getSettingsParamVersions(item.workspaceCode || props.workspaceCode, item.id)
    versionItems.value = page.items || []
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    versionLoading.value = false
  }
}

async function rollbackVersion(version: ParamSetVersionItem) {
  if (!versionParam.value || version.latest) return
  rollbackingId.value = version.id
  try {
    await configApi.rollbackSettingsParamVersion(versionParam.value.workspaceCode || props.workspaceCode, versionParam.value.id, version.id)
    await Promise.all([loadParams(versionParam.value.id), openVersions(versionParam.value)])
    ElMessage.success('变量集版本已回滚')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    rollbackingId.value = null
  }
}

onMounted(() => void Promise.all([loadWorkspaces(), loadParams()]))
watch(globalWorkspaceOptions, (options) => {
  if (!options.some(item => item.workspaceCode === globalWorkspaceCode.value)) {
    globalWorkspaceCode.value = options[0]?.workspaceCode || ''
  }
}, { immediate: true })
watch(() => props.workspaceCode, () => {
  closeDetail()
  void Promise.all([loadWorkspaces(), loadParams()])
})
</script>

<template>
  <section class="variable-page" :class="{ 'is-global-mode': mode === 'global' }">
    <header class="variable-page__header">
      <div><h2>{{ mode === 'global' ? '全局变量' : '变量配置' }}</h2><p>{{ mode === 'global' ? '当前工作区内自动生效，环境变量和本次执行变量可覆盖同名值。' : '统一管理自动生效的全局变量和环境可绑定的业务变量集。' }}</p></div>
      <div><AppButton :icon="RefreshRight" :loading="loading" @click="loadParams()">刷新</AppButton><AppButton v-if="mode === 'all'" type="primary" :icon="Plus" @click="createVisible = true">新建变量集</AppButton></div>
    </header>

    <div v-if="mode === 'all'" class="variable-page__toolbar">
      <el-input v-model="keyword" clearable placeholder="搜索变量集名称或说明" :prefix-icon="Search" />
      <el-select v-model="scopeFilter"><el-option v-for="item in scopeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select>
      <el-select v-model="stageFilter"><el-option v-for="item in stageOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select>
    </div>

    <div v-if="errorMessage" class="variable-page__error">{{ errorMessage }}<AppButton size="small" @click="loadParams()">重试</AppButton></div>
    <AppLoadingState v-if="loading && !params.length" text="正在加载变量配置..." />

    <div v-else class="variable-table">
      <table v-if="displayedParams.length">
        <colgroup><col class="is-name"><col class="is-count"><col class="is-scope"><col class="is-stage"><col><col class="is-status"><col class="is-actions"></colgroup>
        <thead><tr><th>变量集</th><th>变量数</th><th>适用范围</th><th>部署阶段</th><th>说明</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in displayedParams" :key="item.id" :class="{ 'is-global': isGlobalParam(item) }">
            <td><div class="variable-table__name"><span v-if="isGlobalParam(item)" class="variable-table__lock"><el-icon><Lock /></el-icon></span><span><strong>{{ isGlobalParam(item) ? '全局变量' : item.paramName }}</strong><small>{{ isGlobalParam(item) ? (workspaceCode === 'ALL' ? '工作区级 · 按工作区管理' : `工作区级 · ${item.workspaceName || item.workspaceCode}`) : (item.workspaceName || item.workspaceCode) }}</small></span></div></td>
            <td><b>{{ variableCount(item) }}</b></td><td><span class="variable-table__tag">{{ scopeLabel(item) }}</span></td><td><span class="variable-table__tag">{{ stageLabel(item) }}</span></td><td><span class="variable-table__description">{{ description(item) }}</span></td><td><span :class="['variable-table__status', { 'is-enabled': item.status === 1 }]">{{ item.status === 1 ? '启用' : '停用' }}</span></td>
            <td><button type="button" class="variable-table__action" @click="openDetail(item)">{{ isGlobalParam(item) ? '配置' : '编辑' }}</button><button v-if="item.id > 0" type="button" class="variable-table__action" @click="openReferences(item)"><el-icon><Connection /></el-icon>引用</button><el-dropdown v-if="!isGlobalParam(item)" trigger="click" @command="(command: string) => { if (command === 'history') openHistory(item); if (command === 'versions') openVersions(item); if (command === 'delete') removeParam(item) }"><button type="button" class="variable-table__more"><el-icon><MoreFilled /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item command="history">变更历史</el-dropdown-item><el-dropdown-item command="versions">版本管理</el-dropdown-item><el-dropdown-item command="delete" class="is-danger">删除变量集</el-dropdown-item></el-dropdown-menu></template></el-dropdown></td>
          </tr>
        </tbody>
      </table>
      <AppEmptyState v-else :title="mode === 'global' ? '暂无全局变量' : '暂无变量集'" :description="mode === 'global' ? '当前工作区还没有配置全局变量。' : '当前筛选条件下没有普通变量集，全局变量仍会固定保留。'" />
    </div>

    <el-drawer :model-value="!!detailParam" :title="detailIsGlobal ? `全局变量 · ${detailParam?.workspaceName || detailParam?.workspaceCode}` : '变量集详情'" size="min(1120px, 94vw)" class="variable-detail-drawer" @update:model-value="(value: boolean) => { if (!value) closeDetail() }">
      <div v-if="detailParam" class="variable-detail">
        <div v-if="detailIsGlobal" class="variable-detail__system-note"><el-icon><Lock /></el-icon><div><strong>工作区全局变量 · {{ detailParam.workspaceName || detailParam.workspaceCode }}</strong><span>全局变量集不可删除、重命名或停用；符合范围和阶段的变量会自动应用到环境。</span></div></div>
        <div class="variable-detail__meta" :class="{ 'has-workspace': detailIsGlobal && workspaceCode === 'ALL' }">
          <label v-if="detailIsGlobal && workspaceCode === 'ALL'"><span>目标空间</span><el-select v-model="globalWorkspaceCode" @change="switchGlobalWorkspace"><el-option v-for="item in globalWorkspaceOptions" :key="item.workspaceCode" :label="item.workspaceName" :value="item.workspaceCode" /></el-select></label>
          <label><span>变量集名称</span><el-input v-model="detailForm.paramName" :disabled="detailIsGlobal" /></label>
          <label><span>适用范围</span><el-select v-model="detailForm.paramType" :disabled="detailIsGlobal"><el-option v-for="item in scopeOptions.filter(option => option.value !== 'ALL')" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
          <label><span>部署阶段</span><el-select v-model="detailForm.stageType" :disabled="detailIsGlobal"><el-option v-for="item in stageOptions.filter(option => option.value !== 'ALL')" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
          <label><span>状态</span><el-select v-model="detailForm.status" :disabled="detailIsGlobal"><el-option label="启用" :value="1" /><el-option label="停用" :value="0" /></el-select></label>
          <label class="is-wide"><span>说明</span><el-input v-model="detailForm.description" maxlength="200" show-word-limit /></label>
        </div>
        <div class="variable-detail__toolbar"><el-input v-model="detailKeyword" clearable placeholder="搜索变量名、值或说明" :prefix-icon="Search" /><AppButton type="primary" :icon="Plus" @click="addVariable">新增变量</AppButton></div>
        <div v-if="detailError" class="variable-page__error">{{ detailError }}</div>
        <el-table :data="detailVariableRows" border empty-text="暂无变量">
          <el-table-column label="变量名" min-width="150"><template #default="{ row }"><el-input v-model="row.variable.name" placeholder="VARIABLE_NAME" /></template></el-table-column>
          <el-table-column label="变量值" min-width="190"><template #default="{ row }"><el-input v-model="row.variable.value" :type="row.variable.sensitive ? 'password' : 'text'" show-password /></template></el-table-column>
          <el-table-column label="类型" width="105"><template #default="{ row }"><el-select v-model="row.variable.valueType" @change="syncSensitive(row.variable)"><el-option v-for="option in valueTypeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></template></el-table-column>
          <el-table-column v-if="detailIsGlobal" label="范围" width="110"><template #default="{ row }"><el-select v-model="row.variable.scopeType"><el-option v-for="option in rowScopeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></template></el-table-column>
          <el-table-column v-if="detailIsGlobal" label="阶段" width="110"><template #default="{ row }"><el-select v-model="row.variable.stageType"><el-option v-for="option in stageOptions.filter(item => item.value !== 'ALL')" :key="option.value" :label="option.label" :value="option.value" /></el-select></template></el-table-column>
          <el-table-column label="说明" min-width="150"><template #default="{ row }"><el-input v-model="row.variable.description" /></template></el-table-column>
          <el-table-column label="启用" width="72" align="center"><template #default="{ row }"><el-switch v-model="row.variable.enabled" /></template></el-table-column>
          <el-table-column label="操作" width="64" align="center"><template #default="{ row }"><el-button type="danger" link :icon="Delete" @click="removeVariable(row.index)" /></template></el-table-column>
        </el-table>
      </div>
      <template #footer><AppButton :disabled="saving" @click="closeDetail">关闭</AppButton><AppButton type="primary" :loading="saving" @click="saveDetail">保存</AppButton></template>
    </el-drawer>

    <ConfigVariableSetCreateDialog v-model="createVisible" :saving="saving" :default-workspace-code="workspaceCode" @submit="createVariableSet" />
    <ConfigReferenceDrawer v-model="referenceVisible" title="变量集引用详情" :loading="referenceLoading" :summary="referenceSummary" />
    <ConfigParamChangeHistoryDrawer v-model="historyVisible" :loading="historyLoading" :items="historyItems" />
    <ConfigParamVersionDrawer v-model="versionVisible" :loading="versionLoading" :items="versionItems" :rollbacking-id="rollbackingId" @rollback="rollbackVersion" />
  </section>
</template>

<style scoped>
.variable-page { display: flex; min-width: 0; flex-direction: column; gap: 16px; }
.variable-page__header, .variable-page__header > div, .variable-page__toolbar, .variable-detail__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.variable-page__header h2 { margin: 0; color: var(--app-text-primary); font-size: 18px; font-weight: 600; line-height: 27px; }
.variable-page__header p { margin: 0; color: var(--app-text-muted); font-size: 12px; line-height: 18px; }
.variable-page__toolbar { justify-content: flex-start; padding: 12px; border: 1px solid var(--app-border); border-radius: 6px; background: #fff; }
.variable-page__toolbar :deep(.el-input) { width: 300px; }
.variable-page__toolbar :deep(.el-select) { width: 160px; }
.variable-page__error { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #fecaca; border-radius: 6px; background: var(--app-danger-soft); color: var(--app-danger); font-size: 12px; }
.variable-table { overflow-x: auto; min-height: 240px; border: 1px solid var(--app-border); border-radius: 7px; background: #fff; }
.variable-table table { width: 100%; min-width: 1100px; border-collapse: collapse; table-layout: fixed; }
.variable-page.is-global-mode .variable-table table { min-width: 880px; }
.variable-page.is-global-mode .variable-table col.is-scope { width: 105px; }
.variable-page.is-global-mode .variable-table col.is-stage { width: 100px; }
.variable-page.is-global-mode .variable-table col.is-actions { width: 130px; }
.variable-table col.is-name { width: 220px; }.variable-table col.is-count { width: 88px; }.variable-table col.is-scope { width: 130px; }.variable-table col.is-stage { width: 110px; }.variable-table col.is-status { width: 90px; }.variable-table col.is-actions { width: 160px; }
.variable-table thead { background: #f7f8fa; }
.variable-table th { height: 38px; padding: 0 16px; color: var(--app-text-muted); font-size: 11px; font-weight: 500; text-align: left; }
.variable-table td { height: 58px; padding: 8px 16px; border-top: 1px solid var(--app-border); color: var(--app-text-secondary); font-size: 12px; }
.variable-table tr.is-global { background: #fbfdff; }
.variable-table__name { display: flex; min-width: 0; align-items: center; gap: 9px; }
.variable-table__name > span:last-child { display: grid; min-width: 0; gap: 2px; }
.variable-table__name strong { overflow: hidden; color: var(--app-text-primary); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.variable-table__name small { color: var(--app-text-muted); font-size: 11px; }
.variable-table__lock { display: inline-flex; width: 28px; height: 28px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 5px; background: var(--app-primary-soft); color: var(--app-primary); }
.variable-table td > b { color: var(--app-text-primary); font-size: 13px; font-weight: 500; }
.variable-table__tag { display: inline-flex; padding: 2px 7px; border-radius: 4px; background: #f2f3f5; color: var(--app-text-secondary); font-size: 11px; }
.variable-table__description { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variable-table__status { display: inline-flex; align-items: center; gap: 5px; color: var(--app-text-muted); font-size: 11px; }
.variable-table__status::before { width: 6px; height: 6px; border-radius: 50%; background: #c9cdd4; content: ''; }
.variable-table__status.is-enabled { color: #00b42a; }.variable-table__status.is-enabled::before { background: #00b42a; }
.variable-table__action, .variable-table__more { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; padding: 0; border: 0; background: transparent; color: var(--app-primary); cursor: pointer; font-size: 11px; }
.variable-table__more { width: 24px; height: 24px; justify-content: center; margin: 0; border-radius: 4px; color: var(--app-text-muted); }
.variable-table__more:hover { background: #f2f3f5; }
.variable-detail { display: flex; flex-direction: column; gap: 18px; }
.variable-detail-drawer :deep(.el-drawer__body) { padding: 18px 20px; }.variable-detail-drawer :deep(.el-drawer__footer) { padding: 12px 20px; border-top: 1px solid var(--app-border); }
.variable-detail__system-note { display: flex; align-items: flex-start; gap: 10px; padding: 11px 12px; border: 1px solid #bedaff; border-radius: 6px; background: var(--app-primary-soft); color: var(--app-primary); }
.variable-detail__system-note div { display: grid; gap: 2px; }.variable-detail__system-note strong { font-size: 12px; font-weight: 600; }.variable-detail__system-note span { color: var(--app-text-secondary); font-size: 11px; }
.variable-detail__meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.variable-detail__meta.has-workspace { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.variable-detail__meta label { display: flex; min-width: 0; flex-direction: column; gap: 6px; }.variable-detail__meta label.is-wide { grid-column: 1 / -1; }.variable-detail__meta label > span { color: var(--app-text-muted); font-size: 11px; }.variable-detail__meta :deep(.el-select) { width: 100%; }
.variable-detail__toolbar :deep(.el-input) { width: 320px; }
@media (max-width: 760px) { .variable-page__header, .variable-page__toolbar { align-items: stretch; flex-direction: column; } .variable-page__toolbar :deep(.el-input), .variable-page__toolbar :deep(.el-select) { width: 100%; } .variable-detail__meta, .variable-detail__meta.has-workspace { grid-template-columns: 1fr; } .variable-detail__meta label.is-wide { grid-column: auto; } }
</style>
