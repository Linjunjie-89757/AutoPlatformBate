<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Delete, Edit, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { configApi, type ParamSetItem } from '@/entities/config'
import {
  formatBrowserType,
  formatEnvironmentStatus,
  webUiAutomationApi,
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_ENVIRONMENT_STATUS_OPTIONS,
  type SaveWebUiEnvironmentPayload,
  type WebUiBrowserType,
  type WebUiEnvironmentItem,
  type WebUiEnvironmentStatus,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'

interface EnvironmentForm {
  name: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  defaultVariableSetId: number | null
  status: WebUiEnvironmentStatus
}

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    environments?: WebUiEnvironmentItem[]
    loading?: boolean
  }>(),
  {
    environments: () => [],
    loading: false,
  },
)

const emit = defineEmits<{
  refresh: []
}>()

const dialogVisible = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const editingEnvironment = ref<WebUiEnvironmentItem | null>(null)
const form = ref<EnvironmentForm>(createEmptyForm())
const variableSets = ref<ParamSetItem[]>([])
const loadingVariableSets = ref(false)
const filterKeyword = ref('')
const filterStatus = ref('')
let variableSetRequestSeq = 0

const dialogTitle = computed(() => (editingEnvironment.value ? '编辑环境配置' : '新建环境配置'))
const enabledVariableSets = computed(() => variableSets.value.filter(item => item.status !== 0))
const filteredEnvironments = computed(() => {
  const keyword = filterKeyword.value.trim().toLowerCase()
  const status = filterStatus.value === '' ? null : Number(filterStatus.value)
  return props.environments.filter((environment) => {
    const matchesKeyword = !keyword
      || environment.name.toLowerCase().includes(keyword)
      || environment.baseUrl.toLowerCase().includes(keyword)
      || (environment.defaultVariableSetName || '').toLowerCase().includes(keyword)
    const matchesStatus = status === null || environment.status === status
    return matchesKeyword && matchesStatus
  })
})
const enabledEnvironmentCount = computed(() => props.environments.filter(item => item.status === 1).length)
const disabledEnvironmentCount = computed(() => props.environments.filter(item => item.status === 0).length)

function createEmptyForm(): EnvironmentForm {
  return {
    name: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    defaultVariableSetId: null,
    status: 1,
  }
}

function clampTimeout(value: unknown, fallback = 10000) {
  const numberValue = Number(value)
  const normalized = Number.isFinite(numberValue) ? numberValue : fallback
  return Math.min(60000, Math.max(1000, normalized))
}

function openCreateDialog() {
  editingEnvironment.value = null
  form.value = createEmptyForm()
  void loadVariableSets()
  dialogVisible.value = true
}

function resetFilters() {
  filterKeyword.value = ''
  filterStatus.value = ''
}

function openEditDialog(environment: WebUiEnvironmentItem) {
  editingEnvironment.value = environment
  form.value = {
    name: environment.name || '',
    baseUrl: environment.baseUrl || '',
    browserType: environment.browserType || 'CHROMIUM',
    headless: environment.headless !== false,
    defaultTimeoutMs: clampTimeout(environment.defaultTimeoutMs),
    defaultVariableSetId: environment.defaultVariableSetId ?? null,
    status: environment.status === 0 ? 0 : 1,
  }
  void loadVariableSets()
  dialogVisible.value = true
}

async function loadVariableSets() {
  const requestId = ++variableSetRequestSeq
  loadingVariableSets.value = true
  try {
    const page = await configApi.getSettingsParams(props.workspaceCode, {
      paramType: 'WEB_UI_VARIABLE_SET',
      status: 1,
    })
    if (requestId === variableSetRequestSeq) {
      variableSets.value = Array.isArray(page.items) ? page.items : []
    }
  } catch {
    if (requestId === variableSetRequestSeq) {
      variableSets.value = []
    }
  } finally {
    if (requestId === variableSetRequestSeq) {
      loadingVariableSets.value = false
    }
  }
}

function validateForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入环境名称')
    return false
  }
  if (!form.value.baseUrl.trim()) {
    ElMessage.warning('请输入 Base URL')
    return false
  }
  return true
}

function buildPayload(): SaveWebUiEnvironmentPayload {
  form.value.defaultTimeoutMs = clampTimeout(form.value.defaultTimeoutMs)

  return {
    workspaceCode: props.workspaceCode,
    name: form.value.name.trim(),
    baseUrl: form.value.baseUrl.trim(),
    browserType: form.value.browserType,
    headless: form.value.headless,
    defaultTimeoutMs: form.value.defaultTimeoutMs,
    defaultVariableSetId: form.value.defaultVariableSetId,
    status: form.value.status,
  }
}

async function saveEnvironment() {
  if (!validateForm()) {
    return
  }

  saving.value = true
  try {
    const payload = buildPayload()
    if (editingEnvironment.value) {
      await webUiAutomationApi.updateEnvironment(props.workspaceCode, editingEnvironment.value.id, payload)
      ElMessage.success('环境配置已更新')
    } else {
      await webUiAutomationApi.createEnvironment(props.workspaceCode, payload)
      ElMessage.success('环境配置已创建')
    }
    dialogVisible.value = false
    emit('refresh')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deleteEnvironment(environment: WebUiEnvironmentItem) {
  const workspaceCode = props.workspaceCode
  deletingId.value = environment.id
  try {
    await confirmDelete({
      title: '删除环境配置',
      message: `确认删除环境 "${environment.name}" 吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    if (props.workspaceCode !== workspaceCode) {
      ElMessage.warning('工作空间已切换，请刷新后重试')
      return
    }
    await webUiAutomationApi.deleteEnvironment(workspaceCode, environment.id)
    ElMessage.success('环境配置已删除')
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingId.value = null
  }
}

watch(
  () => props.workspaceCode,
  () => {
    dialogVisible.value = false
    editingEnvironment.value = null
    variableSets.value = []
  },
)
</script>

<template>
  <section class="web-ui-env-panel">
    <header class="web-ui-env-panel__header">
      <div>
        <h2>环境配置</h2>
        <p>运行时会优先使用所选环境；变量集留空时继承环境绑定的默认变量集。</p>
      </div>
      <div class="web-ui-env-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="emit('refresh')">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新建环境</AppButton>
      </div>
    </header>

    <div class="web-ui-env-stats">
      <div class="web-ui-env-stat">
        <span>环境总数</span>
        <strong>{{ environments.length }}</strong>
      </div>
      <div class="web-ui-env-stat">
        <span>启用环境</span>
        <strong>{{ enabledEnvironmentCount }}</strong>
      </div>
      <div class="web-ui-env-stat">
        <span>已停用</span>
        <strong>{{ disabledEnvironmentCount }}</strong>
      </div>
    </div>

    <div class="web-ui-env-toolbar">
      <el-input
        v-model="filterKeyword"
        class="web-ui-env-toolbar__search"
        clearable
        placeholder="搜索环境名称 / Base URL / 默认变量集"
        :prefix-icon="Search"
      />
      <el-select v-model="filterStatus" class="web-ui-env-toolbar__select" clearable placeholder="状态">
        <el-option
          v-for="item in WEB_UI_ENVIRONMENT_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="String(item.value)"
        />
      </el-select>
      <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
    </div>

    <div
      v-if="filteredEnvironments.length"
      v-loading="loading"
      class="web-ui-env-grid"
    >
      <article
        v-for="environment in filteredEnvironments"
        :key="`${environment.source}-${environment.id}`"
        class="web-ui-env-card"
        :class="{ 'is-disabled': environment.status === 0 }"
      >
        <div class="web-ui-env-card__main">
          <div class="web-ui-env-card__title">
            <div class="web-ui-env-card__name-row">
              <h3>{{ environment.name }}</h3>
              <span class="web-ui-env-card__status" :class="{ 'is-disabled': environment.status === 0 }">
                {{ formatEnvironmentStatus(environment.status) }}
              </span>
            </div>
            <p>{{ environment.source === 'CONFIG_CENTER' ? '来自配置中心' : 'Web UI 专属环境' }}</p>
          </div>
          <div class="web-ui-env-card__actions">
            <button
              type="button"
              title="编辑"
              aria-label="编辑环境"
              :disabled="environment.source === 'CONFIG_CENTER'"
              @click="openEditDialog(environment)"
            >
              <Edit />
            </button>
            <button
              type="button"
              class="is-danger"
              title="删除"
              aria-label="删除环境"
              :disabled="environment.source === 'CONFIG_CENTER' || deletingId === environment.id"
              @click="deleteEnvironment(environment)"
            >
              <Delete />
            </button>
          </div>
        </div>

        <div class="web-ui-env-card__body">
          <div class="web-ui-env-card__url">{{ environment.baseUrl }}</div>
          <div class="web-ui-env-card__meta">
            <span>浏览器：{{ formatBrowserType(environment.browserType) }}</span>
            <span>无头：{{ environment.headless ? '是' : '否' }}</span>
            <span>默认超时：{{ environment.defaultTimeoutMs }} ms</span>
            <span>默认变量集：{{ environment.defaultVariableSetName || '-' }}</span>
            <span>所属空间：{{ environment.workspaceName || environment.workspaceCode }}</span>
          </div>
        </div>
      </article>
    </div>

    <AppEmptyState
      v-if="!loading && !filteredEnvironments.length"
      title="暂无环境配置"
      :description="environments.length ? '当前筛选条件下没有环境配置。' : '当前空间还没有 Web UI 环境配置。'"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新建环境</AppButton>
      </template>
    </AppEmptyState>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      destroy-on-close
    >
      <el-form :model="form" label-width="108px">
        <el-form-item label="环境名称" required>
          <el-input v-model="form.name" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="Base URL" required>
          <el-input v-model="form.baseUrl" maxlength="500" clearable placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="浏览器">
          <el-select v-model="form.browserType">
            <el-option
              v-for="item in WEB_UI_BROWSER_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="无头模式">
          <el-switch v-model="form.headless" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="默认超时">
          <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="默认变量集">
          <el-select
            v-model="form.defaultVariableSetId"
            clearable
            filterable
            :loading="loadingVariableSets"
            placeholder="不绑定，运行时手动选择"
          >
            <el-option
              v-for="item in enabledVariableSets"
              :key="item.id"
              :label="item.paramName"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option
              v-for="item in WEB_UI_ENVIRONMENT_STATUS_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="web-ui-env-dialog__footer">
          <AppButton @click="dialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="saving" @click="saveEnvironment">保存</AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.web-ui-env-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-env-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-env-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-env-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.web-ui-env-panel__actions,
.web-ui-env-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-env-stats {
  display: grid;
  gap: var(--app-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.web-ui-env-stat {
  display: flex;
  min-height: 76px;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
  padding: var(--app-space-4);
}

.web-ui-env-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-env-stat strong {
  margin-top: var(--app-space-1);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: var(--app-line-height-lg);
}

.web-ui-env-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
}

.web-ui-env-toolbar__search {
  max-width: 360px;
}

.web-ui-env-toolbar__select {
  width: 140px;
}

.web-ui-env-grid {
  display: grid;
  gap: var(--app-space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.web-ui-env-card {
  min-width: 0;
  min-height: 188px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  padding: var(--app-space-5);
  transition: box-shadow 160ms ease, opacity 160ms ease;
}

.web-ui-env-card:hover {
  box-shadow: var(--app-shadow-card-hover);
}

.web-ui-env-card.is-disabled {
  opacity: 0.64;
}

.web-ui-env-card__main {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-4);
}

.web-ui-env-card__title {
  min-width: 0;
}

.web-ui-env-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-1);
}

.web-ui-env-card__name-row h3 {
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

.web-ui-env-card__title p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
}

.web-ui-env-card__status {
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--app-success-soft);
  color: var(--app-success);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
  padding: 2px 8px;
}

.web-ui-env-card__status.is-disabled {
  background: var(--app-border-soft);
  color: var(--app-text-secondary);
}

.web-ui-env-card__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-1);
}

.web-ui-env-card__actions button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.web-ui-env-card__actions button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-main);
}

.web-ui-env-card__actions button.is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.web-ui-env-card__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.web-ui-env-card__actions svg {
  width: 16px;
  height: 16px;
}

.web-ui-env-card__body {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-env-card__url {
  overflow: hidden;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  padding: var(--app-space-2) var(--app-space-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-env-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2) var(--app-space-4);
}

.web-ui-env-card__meta span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
}

.web-ui-env-panel :deep(.el-dialog .el-select),
.web-ui-env-panel :deep(.el-dialog .el-input-number) {
  width: 100%;
}

@media (max-width: 900px) {
  .web-ui-env-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .web-ui-env-stats,
  .web-ui-env-grid {
    grid-template-columns: 1fr;
  }

  .web-ui-env-toolbar,
  .web-ui-env-toolbar__search,
  .web-ui-env-toolbar__select {
    width: 100%;
    max-width: none;
  }
}
</style>
