<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Connection, Delete, MoreFilled, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type ConfigReferenceSummary,
  type CreateEnvPayload,
  type EnvConfigItem,
  type MockApplicationItem,
  type ParamSetItem,
} from '@/entities/config'
import {
  buildCreateEnvPayload,
  ConfigEnvCreateDialog,
  createConfigEnvFormFromItem,
  createDefaultServiceEndpoint,
  type ConfigEnvForm,
  type ConfigEnvLocalVariableForm,
  validateConfigEnvForm,
} from '@/features/config-env-create-edit'
import { parseVariableSetMetadata, parseWebUiVariables } from '@/features/config-param-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'

type DetailTab = 'overview' | 'resources' | 'variables'

const props = withDefaults(defineProps<{ workspaceCode?: string }>(), { workspaceCode: 'ALL' })

const envs = ref<EnvConfigItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const selectedEnvId = ref<number | null>(null)
const activeTab = ref<DetailTab>('overview')
const keyword = ref('')
const scopeFilter = ref('ALL')
const loading = ref(false)
const saving = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const detailError = ref('')
const createVisible = ref(false)
const referenceVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const form = reactive<ConfigEnvForm>(createConfigEnvFormFromItem(createPlaceholderEnv()))

const scopeOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'API', label: 'API' },
  { value: 'WEB_UI', label: 'Web UI' },
  { value: 'APP', label: 'APP' },
]
const stageOptions = [
  { value: 'DEV', label: '开发' },
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发布' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
]
const scopeLabelMap = new Map(scopeOptions.map(item => [item.value, item.label]))
const stageLabelMap = new Map(stageOptions.map(item => [item.value, item.label]))

const selectedEnv = computed(() => envs.value.find(item => item.id === selectedEnvId.value) || null)
const filteredEnvs = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return envs.value.filter(item => {
    const itemForm = createConfigEnvFormFromItem(item)
    if (scopeFilter.value !== 'ALL' && itemForm.automationType !== scopeFilter.value) return false
    return !query || `${item.envName} ${item.workspaceName} ${item.baseUrl}`.toLowerCase().includes(query)
  })
})
const availableVariableSets = computed(() => variableSets.value.filter(item => {
  if (item.status === 0 || item.paramType === 'GLOBAL') return false
  const scopeCompatible = item.paramType === 'BUSINESS'
    || (form.automationType === 'API' && item.paramType === 'API_VARIABLE_SET')
    || (form.automationType === 'WEB_UI' && item.paramType === 'WEB_UI_VARIABLE_SET')
    || (form.automationType === 'APP' && item.paramType === 'APP_UI_VARIABLE_SET')
  const stage = parseVariableSetMetadata(item.contentJson).stageType
  return scopeCompatible && (stage === 'COMMON' || stage === form.envType)
}))
const boundVariableSets = computed(() => form.variableSetIds
  .map(id => variableSets.value.find(item => item.id === id))
  .filter((item): item is ParamSetItem => Boolean(item)))
const effectiveVariables = computed(() => {
  const result = new Map<string, { name: string; value: string; sensitive: boolean; source: string; overridden: boolean }>()
  const apply = (name: string, value: string, sensitive: boolean, source: string) => {
    const key = name.toUpperCase()
    const previous = result.get(key)
    result.set(key, { name, value, sensitive, source, overridden: Boolean(previous) })
  }

  variableSets.value
    .filter(item => item.paramType === 'GLOBAL' && item.status !== 0)
    .flatMap(item => parseWebUiVariables(item.contentJson))
    .filter(item => item.enabled !== false && ((item.scopeType || 'ALL') === 'ALL' || item.scopeType === form.automationType))
    .filter(item => (item.stageType || 'COMMON') === 'COMMON' || item.stageType === form.envType)
    .forEach(item => apply(item.name, item.value, item.sensitive, '全局变量'))

  boundVariableSets.value.forEach(set => {
    parseWebUiVariables(set.contentJson)
      .filter(item => item.enabled !== false)
      .forEach(item => apply(item.name, item.value, item.sensitive, set.paramName))
  })
  form.localVariables.forEach(item => apply(item.name, item.value, item.sensitive, '环境局部覆盖'))
  return Array.from(result.values())
})
const resourceLabel = computed(() => form.automationType === 'WEB_UI' ? '站点与入口' : '服务配置')

function createPlaceholderEnv(): EnvConfigItem {
  return { id: 0, workspaceCode: props.workspaceCode, workspaceName: '', envType: 'TEST', envName: '', baseUrl: '', configJson: '', status: 1 }
}

function selectEnv(env: EnvConfigItem) {
  selectedEnvId.value = env.id
  Object.assign(form, createConfigEnvFormFromItem(env))
  detailError.value = ''
  activeTab.value = 'overview'
}

async function loadData(preferredId = selectedEnvId.value) {
  loading.value = true
  errorMessage.value = ''
  try {
    const [envPage, variablePage, mockPage] = await Promise.all([
      configApi.getSettingsEnvs(props.workspaceCode),
      configApi.getSettingsParams(props.workspaceCode, { status: 1 }),
      configApi.getMockApplications(props.workspaceCode, { status: 1 }),
    ])
    envs.value = envPage.items || []
    variableSets.value = variablePage.items || []
    mockApplications.value = mockPage.items || []
    const next = envs.value.find(item => item.id === preferredId) || envs.value[0]
    if (next) selectEnv(next)
    else selectedEnvId.value = null
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function createEnv(payload: CreateEnvPayload) {
  saving.value = true
  try {
    const created = await configApi.createSettingsEnv(props.workspaceCode, payload)
    createVisible.value = false
    await loadData(created.id)
    ElMessage.success('环境已创建，请继续完成详细配置')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function saveEnv() {
  if (!selectedEnv.value) return
  const error = validateConfigEnvForm(form)
  if (error) {
    detailError.value = error
    return
  }
  saving.value = true
  try {
    const updated = await configApi.updateSettingsEnv(props.workspaceCode, selectedEnv.value.id, buildCreateEnvPayload(form))
    detailError.value = ''
    await loadData(updated.id)
    ElMessage.success('环境配置已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function switchStatus() {
  if (!selectedEnv.value) return
  operating.value = true
  try {
    await toggleConfigEnvStatus(selectedEnv.value, props.workspaceCode)
    await loadData(selectedEnv.value.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operating.value = false
  }
}

async function removeSelectedEnv() {
  if (!selectedEnv.value) return
  const id = selectedEnv.value.id
  operating.value = true
  try {
    await deleteConfigEnv(selectedEnv.value, props.workspaceCode)
    await loadData(envs.value.find(item => item.id !== id)?.id ?? null)
    ElMessage.success('环境已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  } finally {
    operating.value = false
  }
}

async function openReferences() {
  if (!selectedEnv.value) return
  referenceVisible.value = true
  referenceLoading.value = true
  try {
    referenceSummary.value = await configApi.getSettingsEnvReferences(props.workspaceCode, selectedEnv.value.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

function addEndpoint() {
  const index = form.services.length + 1
  form.services.push({ ...createDefaultServiceEndpoint(), key: `service-${index}`, name: form.automationType === 'WEB_UI' ? `站点 ${index}` : `服务 ${index}` })
}

function removeEndpoint(index: number) {
  const removed = form.services[index]
  form.services.splice(index, 1)
  if (removed?.key === form.defaultServiceKey) form.defaultServiceKey = form.services[0]?.key || 'default'
}

function setDefaultEndpoint(index: number) {
  const endpoint = form.services[index]
  if (!endpoint) return
  form.defaultServiceKey = endpoint.key
  form.baseUrl = endpoint.baseUrl
}

function addLocalVariable() {
  const variable: ConfigEnvLocalVariableForm = { name: '', value: '', sensitive: false, description: '' }
  form.localVariables.push(variable)
}

function moveVariableSet(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= form.variableSetIds.length) return
  const next = [...form.variableSetIds]
  const [item] = next.splice(index, 1)
  if (item == null) return
  next.splice(target, 0, item)
  form.variableSetIds = next
}

onMounted(() => void loadData())
watch(() => props.workspaceCode, () => void loadData(null))
</script>

<template>
  <section class="environment-page">
    <header class="environment-page__header">
      <div><h2>环境配置</h2><p>统一管理接口、Web UI 和 APP 自动化的运行环境。</p></div>
      <div><AppButton :icon="RefreshRight" :loading="loading" @click="loadData()">刷新</AppButton><AppButton type="primary" :icon="Plus" @click="createVisible = true">新建环境</AppButton></div>
    </header>

    <div v-if="errorMessage" class="environment-page__error">{{ errorMessage }}<AppButton size="small" @click="loadData()">重试</AppButton></div>
    <AppLoadingState v-if="loading && !envs.length" text="正在加载环境配置..." />

    <div v-else class="environment-workspace">
      <aside class="environment-sidebar">
        <el-input v-model="keyword" clearable placeholder="搜索环境" :prefix-icon="Search" />
        <div class="environment-sidebar__scopes">
          <button v-for="item in scopeOptions" :key="item.value" type="button" :class="{ 'is-active': scopeFilter === item.value }" @click="scopeFilter = item.value">{{ item.label }}</button>
        </div>
        <div class="environment-sidebar__list app-soft-scrollbar">
          <button v-for="env in filteredEnvs" :key="env.id" type="button" :class="{ 'is-active': selectedEnvId === env.id }" @click="selectEnv(env)">
            <span class="environment-sidebar__item-main"><strong>{{ env.envName }}</strong><small>{{ stageLabelMap.get(createConfigEnvFormFromItem(env).envType) }} · {{ scopeLabelMap.get(createConfigEnvFormFromItem(env).automationType) }}</small></span>
            <i :class="{ 'is-enabled': env.status === 1 }" />
          </button>
          <AppEmptyState v-if="!filteredEnvs.length" title="没有匹配的环境" description="调整搜索条件或新建环境。" />
        </div>
      </aside>

      <main v-if="selectedEnv" class="environment-detail">
        <header class="environment-detail__head">
          <div><div class="environment-detail__title"><h3>{{ selectedEnv.envName }}</h3><span>{{ scopeLabelMap.get(form.automationType) }}</span><span :class="{ 'is-production': form.envType === 'PROD' }">{{ stageLabelMap.get(form.envType) }}</span></div><p>{{ form.description || '暂未填写环境说明' }}</p></div>
          <div class="environment-detail__actions"><AppButton :icon="Connection" @click="openReferences">引用</AppButton><el-dropdown trigger="click" @command="(command: string) => command === 'toggle' ? switchStatus() : removeSelectedEnv()"><AppButton :icon="MoreFilled" :disabled="operating">更多</AppButton><template #dropdown><el-dropdown-menu><el-dropdown-item command="toggle">{{ selectedEnv.status === 1 ? '停用环境' : '启用环境' }}</el-dropdown-item><el-dropdown-item command="delete" class="is-danger">删除环境</el-dropdown-item></el-dropdown-menu></template></el-dropdown><AppButton type="primary" :loading="saving" @click="saveEnv">保存配置</AppButton></div>
        </header>

        <nav class="environment-detail__tabs">
          <button type="button" :class="{ 'is-active': activeTab === 'overview' }" @click="activeTab = 'overview'">基本信息</button>
          <button type="button" :class="{ 'is-active': activeTab === 'resources' }" @click="activeTab = 'resources'">{{ form.automationType === 'APP' ? '应用与设备' : resourceLabel }}</button>
          <button type="button" :class="{ 'is-active': activeTab === 'variables' }" @click="activeTab = 'variables'">变量配置</button>
        </nav>

        <div v-if="detailError" class="environment-page__error">{{ detailError }}</div>

        <section v-if="activeTab === 'overview'" class="environment-section">
          <header><h4>基本信息</h4><p>自动化类型创建后不可修改，部署阶段用于约束可绑定变量集。</p></header>
          <div class="environment-form-grid">
            <label><span>环境名称</span><el-input v-model="form.envName" /></label>
            <label><span>自动化类型</span><el-input :model-value="scopeLabelMap.get(form.automationType)" disabled /></label>
            <label><span>部署阶段</span><el-select v-model="form.envType"><el-option v-for="item in stageOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
            <label><span>状态</span><el-select v-model="form.status"><el-option label="启用" :value="1" /><el-option label="停用" :value="0" /></el-select></label>
            <label class="is-wide"><span>环境描述</span><el-input v-model="form.description" type="textarea" :rows="4" maxlength="200" show-word-limit /></label>
          </div>
        </section>

        <section v-else-if="activeTab === 'resources'" class="environment-section">
          <template v-if="form.automationType !== 'APP'">
            <header><div><h4>{{ resourceLabel }}</h4><p>{{ form.automationType === 'API' ? '为同一环境配置多个接口服务和默认请求地址。' : '配置可访问站点、默认入口和浏览器运行参数。' }}</p></div><AppButton type="primary" :icon="Plus" @click="addEndpoint">{{ form.automationType === 'API' ? '新增服务' : '新增站点' }}</AppButton></header>
            <div class="environment-endpoints">
              <div class="environment-endpoints__head"><span>标识</span><span>名称</span><span>地址</span><span>默认</span><span>操作</span></div>
              <div v-for="(endpoint, index) in form.services" :key="index" class="environment-endpoints__row">
                <el-input v-model="endpoint.key" placeholder="service-key" /><el-input v-model="endpoint.name" placeholder="名称" /><el-input v-model="endpoint.baseUrl" placeholder="https://example.com" /><el-radio :model-value="form.defaultServiceKey" :value="endpoint.key" @change="setDefaultEndpoint(index)">默认</el-radio><el-button type="danger" link :icon="Delete" @click="removeEndpoint(index)" />
              </div>
            </div>
            <div class="environment-form-grid is-compact">
              <label><span>默认超时</span><el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" /></label>
              <label><span>忽略 HTTPS 证书错误</span><el-switch v-model="form.ignoreHttpsErrors" /></label>
              <label v-if="form.automationType === 'API'"><span>关联 Mock 应用</span><el-select v-model="form.mockApplicationId" clearable placeholder="不使用 Mock"><el-option v-for="item in mockApplications" :key="item.id" :label="item.appName" :value="item.id" /></el-select></label>
              <template v-else><label><span>浏览器</span><el-select v-model="form.browserType"><el-option label="Chromium" value="CHROMIUM" /><el-option label="Firefox" value="FIREFOX" /><el-option label="WebKit" value="WEBKIT" /></el-select></label><label><span>无头模式</span><el-switch v-model="form.headless" /></label><label><span>视口尺寸</span><div class="environment-inline-inputs"><el-input-number v-model="form.viewportWidth" :min="320" /><span>×</span><el-input-number v-model="form.viewportHeight" :min="240" /></div></label></template>
            </div>
          </template>
          <template v-else>
            <header><h4>应用与设备</h4><p>APP 环境围绕安装包、应用标识、设备和 Runner 能力配置。</p></header>
            <div class="environment-form-grid">
              <label><span>平台</span><el-select v-model="form.appPlatform"><el-option label="Android" value="ANDROID" /><el-option label="iOS" value="IOS" /></el-select></label>
              <label><span>应用版本</span><el-input v-model="form.appVersion" placeholder="例如：2.4.0 (120)" /></label>
              <label v-if="form.appPlatform === 'ANDROID'"><span>Package</span><el-input v-model="form.appPackage" placeholder="com.example.app" /></label>
              <label v-if="form.appPlatform === 'ANDROID'"><span>Activity</span><el-input v-model="form.appActivity" placeholder=".MainActivity" /></label>
              <label v-else><span>Bundle ID</span><el-input v-model="form.appBundleId" placeholder="com.example.app" /></label>
              <label><span>设备类型</span><el-select v-model="form.deviceType"><el-option label="真机" value="REAL" /><el-option label="模拟器" value="EMULATOR" /></el-select></label>
              <label><span>设备型号</span><el-input v-model="form.deviceModel" /></label><label><span>系统版本</span><el-input v-model="form.osVersion" /></label>
              <label class="is-wide"><span>安装包或下载地址</span><el-input v-model="form.appArtifactUrl" /></label>
              <label><span>Runner 能力</span><el-input v-model="form.runnerCapability" placeholder="例如：android-real-device" /></label>
              <label><span>重置策略</span><el-select v-model="form.resetStrategy"><el-option label="保留数据" value="KEEP" /><el-option label="重置应用" value="RESET" /><el-option label="重新安装" value="REINSTALL" /></el-select></label>
              <label class="is-wide"><span>Deep Link / Scheme</span><el-input v-model="form.deepLink" /></label>
            </div>
          </template>
        </section>

        <section v-else class="environment-section environment-variables">
          <header><h4>绑定变量集</h4><p>仅展示与当前自动化类型和部署阶段兼容的变量集，排序靠后的变量集优先级更高。</p></header>
          <el-select v-model="form.variableSetIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择变量集"><el-option v-for="item in availableVariableSets" :key="item.id" :label="item.paramName" :value="item.id" /></el-select>
          <div v-if="boundVariableSets.length" class="environment-variable-order"><div v-for="(item, index) in boundVariableSets" :key="item.id"><span><b>{{ index + 1 }}</b><strong>{{ item.paramName }}</strong><small>{{ parseVariableSetMetadata(item.contentJson).stageType }}</small></span><span><el-button circle :icon="ArrowUp" :disabled="index === 0" @click="moveVariableSet(index, -1)" /><el-button circle :icon="ArrowDown" :disabled="index === boundVariableSets.length - 1" @click="moveVariableSet(index, 1)" /></span></div></div>

          <header class="environment-section__subhead"><div><h4>环境局部变量</h4><p>局部变量优先级最高，只在当前环境生效。</p></div><AppButton :icon="Plus" @click="addLocalVariable">新增变量</AppButton></header>
          <el-table :data="form.localVariables" border empty-text="暂无局部变量">
            <el-table-column label="变量名" min-width="170"><template #default="{ row }"><el-input v-model="row.name" placeholder="VARIABLE_NAME" /></template></el-table-column>
            <el-table-column label="变量值" min-width="220"><template #default="{ row }"><el-input v-model="row.value" :type="row.sensitive ? 'password' : 'text'" show-password /></template></el-table-column>
            <el-table-column label="敏感" width="80" align="center"><template #default="{ row }"><el-switch v-model="row.sensitive" /></template></el-table-column>
            <el-table-column label="说明" min-width="180"><template #default="{ row }"><el-input v-model="row.description" /></template></el-table-column>
            <el-table-column label="操作" width="70" align="center"><template #default="{ $index }"><el-button type="danger" link :icon="Delete" @click="form.localVariables.splice($index, 1)" /></template></el-table-column>
          </el-table>

          <header class="environment-section__subhead"><div><h4>最终生效预览</h4><p>按照全局变量、绑定变量集、环境局部覆盖的顺序解析。</p></div></header>
          <el-table :data="effectiveVariables" border empty-text="暂无生效变量">
            <el-table-column prop="name" label="变量名" min-width="180" /><el-table-column label="最终值" min-width="220"><template #default="{ row }"><code>{{ row.sensitive ? '******' : row.value }}</code></template></el-table-column><el-table-column prop="source" label="来源" min-width="180" /><el-table-column label="覆盖" width="80" align="center"><template #default="{ row }"><span :class="['environment-variable-state', { 'is-overridden': row.overridden }]">{{ row.overridden ? '已覆盖' : '原始' }}</span></template></el-table-column>
          </el-table>
        </section>
      </main>

      <AppEmptyState v-else class="environment-detail is-empty" title="选择一个环境" description="从左侧选择环境，或新建一个运行环境。"><template #actions><AppButton type="primary" :icon="Plus" @click="createVisible = true">新建环境</AppButton></template></AppEmptyState>
    </div>

    <ConfigEnvCreateDialog v-model="createVisible" :saving="saving" :default-workspace-code="workspaceCode" @submit="createEnv" />
    <ConfigReferenceDrawer v-model="referenceVisible" title="环境引用详情" :loading="referenceLoading" :summary="referenceSummary" />
  </section>
</template>

<style scoped>
.environment-page { display: flex; min-height: 0; flex-direction: column; gap: 16px; }
.environment-page__header, .environment-page__header > div, .environment-detail__head, .environment-detail__actions, .environment-section > header, .environment-section__subhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.environment-page__header h2, .environment-detail h3, .environment-section h4 { margin: 0; color: var(--app-text-primary); font-weight: 600; }
.environment-page__header h2 { font-size: 18px; line-height: 27px; }
.environment-page__header p, .environment-detail__head p, .environment-section header p { margin: 2px 0 0; color: var(--app-text-muted); font-size: 12px; line-height: 18px; }
.environment-page__error { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #fecaca; border-radius: 6px; background: var(--app-danger-soft); color: var(--app-danger); font-size: 12px; }
.environment-workspace { display: grid; overflow: hidden; min-height: 620px; height: calc(100dvh - 166px); grid-template-columns: 264px minmax(0, 1fr); border: 1px solid var(--app-border); border-radius: 7px; background: #fff; }
.environment-sidebar { display: flex; min-height: 0; flex-direction: column; gap: 12px; padding: 14px 12px; border-right: 1px solid var(--app-border); background: #fbfcfe; }
.environment-sidebar__scopes { display: flex; gap: 4px; }
.environment-sidebar__scopes button { flex: 1; height: 28px; padding: 0 6px; border: 0; border-radius: 4px; background: transparent; color: var(--app-text-muted); cursor: pointer; font-size: 11px; }
.environment-sidebar__scopes button.is-active { background: var(--app-primary-soft); color: var(--app-primary); font-weight: 500; }
.environment-sidebar__list { display: flex; overflow-y: auto; min-height: 0; flex: 1; flex-direction: column; gap: 4px; }
.environment-sidebar__list > button { display: flex; width: 100%; min-height: 58px; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--app-text-primary); cursor: pointer; text-align: left; }
.environment-sidebar__list > button:hover { background: #f3f6fa; }
.environment-sidebar__list > button.is-active { border-color: #bedaff; background: var(--app-primary-soft); }
.environment-sidebar__item-main { display: grid; min-width: 0; gap: 3px; }
.environment-sidebar__item-main strong { overflow: hidden; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.environment-sidebar__item-main small { color: var(--app-text-muted); font-size: 11px; }
.environment-sidebar__list i { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: #c9cdd4; }
.environment-sidebar__list i.is-enabled { background: #00b42a; }
.environment-detail { display: flex; overflow: hidden; min-width: 0; min-height: 0; flex-direction: column; }
.environment-detail.is-empty { align-self: center; }
.environment-detail__head { flex: 0 0 auto; padding: 16px 20px; border-bottom: 1px solid var(--app-border); }
.environment-detail__title { display: flex; align-items: center; gap: 8px; }
.environment-detail__title h3 { font-size: 16px; }
.environment-detail__title span { padding: 2px 7px; border-radius: 4px; background: #f2f3f5; color: var(--app-text-secondary); font-size: 11px; }
.environment-detail__title span.is-production { background: #ffece8; color: #f53f3f; }
.environment-detail__tabs { display: flex; flex: 0 0 auto; height: 40px; align-items: flex-end; gap: 22px; padding: 0 20px; border-bottom: 1px solid var(--app-border); }
.environment-detail__tabs button { height: 40px; padding: 0 2px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--app-text-muted); cursor: pointer; font-size: 12px; }
.environment-detail__tabs button.is-active { border-bottom-color: var(--app-primary); color: var(--app-primary); font-weight: 500; }
.environment-section { overflow-y: auto; min-height: 0; flex: 1; padding: 20px; }
.environment-section > header { align-items: flex-start; margin-bottom: 18px; }
.environment-section h4 { font-size: 14px; }
.environment-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; max-width: 920px; }
.environment-form-grid.is-compact { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--app-border); }
.environment-form-grid label { display: flex; min-width: 0; flex-direction: column; gap: 7px; }
.environment-form-grid label > span { color: var(--app-text-secondary); font-size: 12px; }
.environment-form-grid label.is-wide { grid-column: 1 / -1; }
.environment-form-grid :deep(.el-select), .environment-form-grid :deep(.el-input-number) { width: 100%; }
.environment-inline-inputs { display: flex; align-items: center; gap: 8px; }
.environment-endpoints { display: flex; flex-direction: column; border: 1px solid var(--app-border); border-radius: 6px; }
.environment-endpoints__head, .environment-endpoints__row { display: grid; grid-template-columns: minmax(110px, .8fr) minmax(130px, 1fr) minmax(260px, 2fr) 86px 52px; align-items: center; gap: 10px; padding: 9px 12px; }
.environment-endpoints__head { background: #f7f8fa; color: var(--app-text-muted); font-size: 11px; font-weight: 500; }
.environment-endpoints__row { border-top: 1px solid var(--app-border); }
.environment-variables :deep(.el-select) { width: min(720px, 100%); }
.environment-variable-order { display: grid; max-width: 720px; gap: 6px; margin-top: 10px; }
.environment-variable-order > div { display: flex; min-height: 38px; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 8px 6px 12px; border: 1px solid var(--app-border); border-radius: 5px; }
.environment-variable-order span { display: flex; align-items: center; gap: 9px; }
.environment-variable-order b { display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 4px; background: #f2f3f5; color: var(--app-text-muted); font-size: 11px; }
.environment-variable-order strong { font-size: 12px; font-weight: 500; }
.environment-variable-order small { color: var(--app-text-muted); font-size: 11px; }
.environment-section__subhead { margin-top: 26px !important; padding-top: 20px; border-top: 1px solid var(--app-border); }
.environment-variable-state { color: var(--app-text-muted); font-size: 11px; }
.environment-variable-state.is-overridden { color: #ff7d00; }
.environment-variables code { color: var(--app-text-secondary); font-family: Consolas, Monaco, monospace; font-size: 12px; }
@media (max-width: 980px) { .environment-workspace { height: auto; grid-template-columns: 1fr; } .environment-sidebar { border-right: 0; border-bottom: 1px solid var(--app-border); } .environment-sidebar__list { max-height: 220px; } .environment-detail { min-height: 640px; } }
</style>
