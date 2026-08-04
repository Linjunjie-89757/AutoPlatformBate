<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Connection, CopyDocument, Delete, MoreFilled, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type ConfigReferenceSummary,
  type CreateEnvPayload,
  type EnvConfigItem,
  type MockApplicationItem,
  type MockReleaseItem,
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
import ConfigVariableWorkspace from '@/widgets/config-param-panel/ConfigVariableWorkspace.vue'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'

type DetailTab = 'services' | 'variables' | 'mock'
type ManagerView = 'global' | 'builtIn' | 'environment'

const props = withDefaults(defineProps<{ workspaceCode?: string }>(), { workspaceCode: 'ALL' })

const envs = ref<EnvConfigItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const mockReleases = ref<MockReleaseItem[]>([])
const selectedEnvId = ref<number | null>(null)
const activeView = ref<ManagerView>('environment')
const activeTab = ref<DetailTab>('services')
const keyword = ref('')
const scopeFilter = ref('ALL')
const loading = ref(false)
const mockReleaseLoading = ref(false)
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
const builtInGroups = [
  {
    title: '运行变量',
    description: '执行开始时由系统自动生成，可直接通过变量名引用。',
    items: [
      { name: 'TIMESTAMP', syntax: '{{TIMESTAMP}}', description: '当前执行时间，格式为 yyyyMMddHHmmss' },
      { name: 'TODAY', syntax: '{{TODAY}}', description: '当前日期，格式为 yyyy-MM-dd' },
      { name: 'RANDOM_STRING', syntax: '{{RANDOM_STRING}}', description: '当前执行生成的 8 位随机字符串' },
    ],
  },
  {
    title: '动态函数',
    description: '在请求参数、断言和变量值中调用，执行时动态计算。',
    items: [
      { name: 'timestamp', syntax: '{{$timestamp()}}', description: '当前毫秒时间戳' },
      { name: 'date', syntax: "{{$date('YYYY-MM-DD HH:mm:ss')}}", description: '按指定格式输出当前时间' },
      { name: 'randomInt', syntax: '{{$randomInt(1000, 9999)}}', description: '生成指定范围内的随机整数' },
      { name: 'randomStr', syntax: '{{$randomStr(8)}}', description: '生成指定长度的随机字符串' },
      { name: 'uuid', syntax: '{{$uuid()}}', description: '生成随机 UUID' },
      { name: 'randomMobile', syntax: '{{$randomMobile()}}', description: '生成测试手机号' },
    ],
  },
]

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
const selectedMockApplication = computed(() => mockApplications.value.find(item => item.id === form.mockApplicationId) || null)
const selectedMockRelease = computed(() => mockReleases.value.find(item => item.id === form.mockReleaseId) || null)

function createPlaceholderEnv(): EnvConfigItem {
  return { id: 0, workspaceCode: props.workspaceCode, workspaceName: '', envType: 'TEST', envName: '', baseUrl: '', configJson: '', status: 1 }
}

function selectEnv(env: EnvConfigItem) {
  activeView.value = 'environment'
  selectedEnvId.value = env.id
  Object.assign(form, createConfigEnvFormFromItem(env))
  detailError.value = ''
  activeTab.value = 'services'
}

function selectGlobalVariables() {
  activeView.value = 'global'
}

function selectBuiltInVariables() {
  activeView.value = 'builtIn'
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

async function loadMockReleases(appId: number | null) {
  mockReleases.value = []
  if (!appId) {
    form.mockReleaseId = null
    return
  }
  mockReleaseLoading.value = true
  try {
    mockReleases.value = await configApi.getMockReleases(props.workspaceCode, appId)
    if (!mockReleases.value.some(item => item.id === form.mockReleaseId)) {
      form.mockReleaseId = mockReleases.value.find(item => item.active)?.id ?? mockReleases.value[0]?.id ?? null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    mockReleaseLoading.value = false
  }
}

function handleMockEnabledChange(enabled: boolean | string | number) {
  form.mockEnabled = Boolean(enabled)
  if (form.mockEnabled && !form.mockApplicationId) {
    form.mockApplicationId = mockApplications.value[0]?.id ?? null
  }
  if (!form.mockEnabled) {
    mockReleases.value = []
  }
}

async function copyBuiltInSyntax(syntax: string) {
  try {
    await navigator.clipboard.writeText(syntax)
    ElMessage.success('变量语法已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择变量语法')
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
watch(() => form.mockApplicationId, appId => {
  if (form.mockEnabled) void loadMockReleases(appId)
})
</script>

<template>
  <section class="environment-page">
    <header class="environment-page__header">
      <div><h2>环境管理</h2><p>统一管理当前工作区的全局变量、内置变量和各环境运行配置。</p></div>
      <AppButton :icon="RefreshRight" :loading="loading" @click="loadData()">刷新</AppButton>
    </header>

    <div v-if="errorMessage" class="environment-page__error">{{ errorMessage }}<AppButton size="small" @click="loadData()">重试</AppButton></div>
    <AppLoadingState v-if="loading && !envs.length" text="正在加载环境配置..." />

    <div v-else class="environment-workspace">
      <aside class="environment-sidebar">
        <section class="environment-sidebar__group">
          <h3>工作区级</h3>
          <button type="button" class="environment-sidebar__nav-item" :class="{ 'is-active': activeView === 'global' }" @click="selectGlobalVariables">
            <span class="environment-sidebar__nav-icon">全</span>
            <span><strong>全局变量</strong><small>当前工作区自动生效</small></span>
          </button>
          <button type="button" class="environment-sidebar__nav-item" :class="{ 'is-active': activeView === 'builtIn' }" @click="selectBuiltInVariables">
            <span class="environment-sidebar__nav-icon">内</span>
            <span><strong>内置变量</strong><small>系统提供，只读</small></span>
          </button>
        </section>

        <section class="environment-sidebar__group environment-sidebar__environment-group">
          <div class="environment-sidebar__group-head">
            <h3>环境</h3>
            <button type="button" title="新建环境" @click="createVisible = true"><el-icon><Plus /></el-icon></button>
          </div>
          <el-input v-model="keyword" clearable placeholder="搜索环境" :prefix-icon="Search" />
          <div class="environment-sidebar__list app-soft-scrollbar">
            <button v-for="env in filteredEnvs" :key="env.id" type="button" :class="{ 'is-active': activeView === 'environment' && selectedEnvId === env.id }" @click="selectEnv(env)">
              <span class="environment-sidebar__stage">{{ stageLabelMap.get(createConfigEnvFormFromItem(env).envType)?.slice(0, 1) }}</span>
              <span class="environment-sidebar__item-main"><strong>{{ env.envName }}</strong><small>{{ stageLabelMap.get(createConfigEnvFormFromItem(env).envType) }} · {{ scopeLabelMap.get(createConfigEnvFormFromItem(env).automationType) }}</small></span>
              <i :class="{ 'is-enabled': env.status === 1 }" />
            </button>
            <AppEmptyState v-if="!filteredEnvs.length" title="没有匹配的环境" description="调整搜索条件或新建环境。" />
          </div>
          <button type="button" class="environment-sidebar__create" @click="createVisible = true"><el-icon><Plus /></el-icon>新建环境</button>
        </section>
      </aside>

      <main v-if="activeView === 'global'" class="environment-global-pane app-soft-scrollbar">
        <ConfigVariableWorkspace :workspace-code="workspaceCode" mode="global" />
      </main>

      <main v-else-if="activeView === 'builtIn'" class="environment-built-in app-soft-scrollbar">
        <header class="environment-built-in__header">
          <div><h3>内置变量</h3><p>系统在执行时生成，不需要保存到变量集；内置变量不可修改或删除。</p></div>
          <span>只读</span>
        </header>
        <section v-for="group in builtInGroups" :key="group.title" class="environment-built-in__group">
          <header><h4>{{ group.title }}</h4><p>{{ group.description }}</p></header>
          <div class="environment-built-in__table">
            <div class="environment-built-in__row is-head"><span>名称</span><span>使用方式</span><span>说明</span><span>操作</span></div>
            <div v-for="item in group.items" :key="item.name" class="environment-built-in__row">
              <strong>{{ item.name }}</strong>
              <code>{{ item.syntax }}</code>
              <span>{{ item.description }}</span>
              <button type="button" @click="copyBuiltInSyntax(item.syntax)"><el-icon><CopyDocument /></el-icon>复制</button>
            </div>
          </div>
        </section>
      </main>

      <main v-else-if="selectedEnv" class="environment-detail">
        <header class="environment-detail__head">
          <div><div class="environment-detail__title"><h3>{{ form.envName }}</h3><span>{{ scopeLabelMap.get(form.automationType) }}</span><span :class="{ 'is-production': form.envType === 'PROD' }">{{ stageLabelMap.get(form.envType) }}</span><span :class="['environment-detail__status', { 'is-enabled': form.status === 1 }]">{{ form.status === 1 ? '已启用' : '已停用' }}</span></div><p>{{ form.description || '暂未填写环境说明' }}</p></div>
          <div class="environment-detail__actions"><AppButton :icon="Connection" @click="openReferences">引用</AppButton><el-dropdown trigger="click" @command="(command: string) => command === 'toggle' ? switchStatus() : removeSelectedEnv()"><AppButton :icon="MoreFilled" :disabled="operating">更多</AppButton><template #dropdown><el-dropdown-menu><el-dropdown-item command="toggle">{{ selectedEnv.status === 1 ? '停用环境' : '启用环境' }}</el-dropdown-item><el-dropdown-item command="delete" class="is-danger">删除环境</el-dropdown-item></el-dropdown-menu></template></el-dropdown><AppButton type="primary" :loading="saving" @click="saveEnv">保存配置</AppButton></div>
        </header>

        <nav class="environment-detail__tabs">
          <button type="button" :class="{ 'is-active': activeTab === 'services' }" @click="activeTab = 'services'">{{ form.automationType === 'APP' ? '应用与设备' : '服务配置' }}</button>
          <button type="button" :class="{ 'is-active': activeTab === 'variables' }" @click="activeTab = 'variables'">变量集</button>
          <button type="button" :class="{ 'is-active': activeTab === 'mock' }" @click="activeTab = 'mock'">Mock 配置<span v-if="form.mockEnabled" class="environment-detail__tab-state" /></button>
        </nav>

        <div v-if="detailError" class="environment-page__error">{{ detailError }}</div>

        <section v-if="activeTab === 'services'" class="environment-section">
          <header><h4>环境信息</h4><p>环境名称和部署阶段用于识别、筛选以及约束可绑定的变量集。</p></header>
          <div class="environment-form-grid environment-form-grid--meta">
            <label><span>环境名称</span><el-input v-model="form.envName" /></label>
            <label><span>自动化类型</span><el-input :model-value="scopeLabelMap.get(form.automationType)" disabled /></label>
            <label><span>部署阶段</span><el-select v-model="form.envType"><el-option v-for="item in stageOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
            <label><span>状态</span><el-select v-model="form.status"><el-option label="启用" :value="1" /><el-option label="停用" :value="0" /></el-select></label>
            <label class="is-wide"><span>环境描述</span><el-input v-model="form.description" maxlength="200" show-word-limit /></label>
          </div>

          <template v-if="form.automationType !== 'APP'">
            <header class="environment-section__subhead"><div><h4>{{ resourceLabel }}</h4><p>{{ form.automationType === 'API' ? '为同一环境配置多个接口服务和默认请求地址。' : '配置可访问站点、默认入口和浏览器运行参数。' }}</p></div><AppButton type="primary" :icon="Plus" @click="addEndpoint">{{ form.automationType === 'API' ? '新增服务' : '新增站点' }}</AppButton></header>
            <div class="environment-endpoints">
              <div class="environment-endpoints__head"><span>标识</span><span>名称</span><span>地址</span><span>默认</span><span>操作</span></div>
              <div v-for="(endpoint, index) in form.services" :key="index" class="environment-endpoints__row">
                <el-input v-model="endpoint.key" placeholder="service-key" /><el-input v-model="endpoint.name" placeholder="名称" /><el-input v-model="endpoint.baseUrl" placeholder="https://example.com" /><el-radio :model-value="form.defaultServiceKey" :value="endpoint.key" @change="setDefaultEndpoint(index)">默认</el-radio><el-button type="danger" link :icon="Delete" @click="removeEndpoint(index)" />
              </div>
            </div>
            <div class="environment-form-grid is-compact">
              <label><span>默认超时</span><el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" /></label>
              <label><span>忽略 HTTPS 证书错误</span><el-switch v-model="form.ignoreHttpsErrors" /></label>
              <template v-if="form.automationType === 'WEB_UI'"><label><span>浏览器</span><el-select v-model="form.browserType"><el-option label="Chromium" value="CHROMIUM" /><el-option label="Firefox" value="FIREFOX" /><el-option label="WebKit" value="WEBKIT" /></el-select></label><label><span>无头模式</span><el-switch v-model="form.headless" /></label><label><span>视口尺寸</span><div class="environment-inline-inputs"><el-input-number v-model="form.viewportWidth" :min="320" /><span>×</span><el-input-number v-model="form.viewportHeight" :min="240" /></div></label></template>
            </div>
          </template>
          <template v-else>
            <header class="environment-section__subhead"><h4>应用与设备</h4><p>APP 自动化暂未接入执行链路，当前配置继续保留。</p></header>
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

        <section v-else-if="activeTab === 'variables'" class="environment-section environment-variables">
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

          <header class="environment-section__subhead"><div><h4>最终生效预览</h4><p>本次执行覆盖 &gt; 环境局部变量 &gt; 绑定变量集 &gt; 全局变量 &gt; 内置变量。</p></div></header>
          <el-table :data="effectiveVariables" border empty-text="暂无生效变量">
            <el-table-column prop="name" label="变量名" min-width="180" /><el-table-column label="最终值" min-width="220"><template #default="{ row }"><code>{{ row.sensitive ? '******' : row.value }}</code></template></el-table-column><el-table-column prop="source" label="来源" min-width="180" /><el-table-column label="覆盖" width="80" align="center"><template #default="{ row }"><span :class="['environment-variable-state', { 'is-overridden': row.overridden }]">{{ row.overridden ? '已覆盖' : '原始' }}</span></template></el-table-column>
          </el-table>
        </section>

        <section v-else class="environment-section environment-mock">
          <template v-if="form.automationType === 'APP'">
            <AppEmptyState title="APP Mock 暂未接入" description="APP 自动化暂时跳过；后续接入时继续复用当前环境、变量集和 Mock 版本模型。" />
          </template>
          <template v-else>
            <header><div><h4>环境默认 Mock</h4><p>为当前环境指定 Mock 应用和不可变发布版本，执行接入后会记录版本快照。</p></div><div class="environment-mock__switch"><span>{{ form.mockEnabled ? '已启用' : '已关闭' }}</span><el-switch :model-value="form.mockEnabled" @update:model-value="handleMockEnabledChange" /></div></header>
            <div v-if="!form.mockEnabled" class="environment-mock__disabled">
              <strong>当前环境使用真实服务</strong>
              <p>启用后可以选择 Mock 应用和已发布版本；未匹配请求将严格失败，不会静默转发到真实服务。</p>
            </div>
            <div v-if="form.mockEnabled" class="environment-mock__form">
              <label><span>Mock 应用</span><el-select v-model="form.mockApplicationId" filterable placeholder="请选择 Mock 应用"><el-option v-for="item in mockApplications" :key="item.id" :label="item.appName" :value="item.id" /></el-select></label>
              <label><span>Mock 版本</span><el-select v-model="form.mockReleaseId" :loading="mockReleaseLoading" :disabled="!form.mockApplicationId" placeholder="请选择已发布版本"><el-option v-for="item in mockReleases" :key="item.id" :label="`v${item.versionNo} · ${item.releaseName}`" :value="item.id" /></el-select></label>
              <label><span>未匹配请求</span><el-input model-value="严格失败" disabled /></label>
            </div>
            <div v-if="form.mockEnabled && selectedMockApplication && selectedMockRelease" class="environment-mock__status">
              <span>已就绪</span>
              当前环境默认使用 {{ selectedMockApplication.appName }} 的 v{{ selectedMockRelease.versionNo }}，之后编辑草稿不会影响该版本。
            </div>
            <div v-else-if="form.mockEnabled && !mockApplications.length" class="environment-mock__warning">当前工作区没有可用的 Mock 应用，请先在 Mock 服务中创建应用。</div>
            <div v-else-if="form.mockEnabled && form.mockApplicationId && !mockReleaseLoading && !mockReleases.length" class="environment-mock__warning">当前 Mock 应用没有已发布版本，请先完成配置并发布。</div>
          </template>
        </section>
      </main>

      <AppEmptyState v-else class="environment-detail is-empty" title="选择一个环境" description="从左侧选择环境，或新建一个运行环境。"><template #actions><AppButton type="primary" :icon="Plus" @click="createVisible = true">新建环境</AppButton></template></AppEmptyState>
    </div>

    <ConfigEnvCreateDialog v-model="createVisible" :saving="saving" :default-workspace-code="workspaceCode" @submit="createEnv" />
    <ConfigReferenceDrawer v-model="referenceVisible" title="环境引用详情" :loading="referenceLoading" :summary="referenceSummary" />
  </section>
</template>

<style scoped>
.environment-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
}

.environment-page__header,
.environment-page__header > div,
.environment-detail__head,
.environment-detail__actions,
.environment-section > header,
.environment-section__subhead,
.environment-built-in__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.environment-page__header h2,
.environment-detail h3,
.environment-section h4,
.environment-built-in h3,
.environment-built-in h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-weight: 600;
}

.environment-page__header h2 {
  font-size: 18px;
  line-height: 27px;
}

.environment-page__header p,
.environment-detail__head p,
.environment-section header p,
.environment-built-in header p {
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.environment-page__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
}

.environment-workspace {
  display: grid;
  overflow: hidden;
  min-height: 650px;
  height: calc(100dvh - 164px);
  grid-template-columns: 248px minmax(0, 1fr);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.environment-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  background: #fafbfc;
}

.environment-sidebar__group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 15px 12px;
}

.environment-sidebar__group + .environment-sidebar__group {
  border-top: 1px solid var(--app-border);
}

.environment-sidebar__group h3 {
  margin: 0 0 5px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
}

.environment-sidebar__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.environment-sidebar__group-head h3 {
  margin: 0;
}

.environment-sidebar__group-head button {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.environment-sidebar__group-head button:hover {
  background: #f2f3f5;
  color: var(--app-primary);
}

.environment-sidebar__nav-item {
  display: flex;
  width: 100%;
  min-height: 46px;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.environment-sidebar__nav-item:hover,
.environment-sidebar__nav-item.is-active {
  background: var(--app-primary-soft);
}

.environment-sidebar__nav-item.is-active {
  color: var(--app-primary);
}

.environment-sidebar__nav-item > span:last-child,
.environment-sidebar__item-main {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.environment-sidebar__nav-item strong,
.environment-sidebar__item-main strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.environment-sidebar__nav-item small,
.environment-sidebar__item-main small {
  color: var(--app-text-muted);
  font-size: 10px;
}

.environment-sidebar__nav-icon,
.environment-sidebar__stage {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: #eef0fa;
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 600;
}

.environment-sidebar__environment-group {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.environment-sidebar__environment-group :deep(.el-input) {
  margin: 4px 0 3px;
}

.environment-sidebar__list {
  display: flex;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.environment-sidebar__list > button {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.environment-sidebar__list > button:hover,
.environment-sidebar__list > button.is-active {
  background: var(--app-primary-soft);
}

.environment-sidebar__list > button.is-active .environment-sidebar__stage {
  background: var(--app-primary);
  color: #fff;
}

.environment-sidebar__list i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  margin-left: auto;
  border-radius: 50%;
  background: #c9cdd4;
}

.environment-sidebar__list i.is-enabled {
  background: #00b42a;
}

.environment-sidebar__create {
  display: flex;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 3px;
  border: 1px dashed var(--app-border);
  border-radius: 5px;
  background: #fff;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
}

.environment-sidebar__create:hover {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.environment-global-pane,
.environment-built-in {
  overflow-y: auto;
  min-width: 0;
  min-height: 0;
  padding: 20px;
}

.environment-built-in__header {
  margin-bottom: 24px;
}

.environment-built-in__header h3 {
  font-size: 16px;
}

.environment-built-in__header > span {
  padding: 3px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: var(--app-text-muted);
  font-size: 11px;
}

.environment-built-in__group + .environment-built-in__group {
  margin-top: 28px;
}

.environment-built-in__group > header {
  margin-bottom: 10px;
}

.environment-built-in__group h4 {
  font-size: 14px;
}

.environment-built-in__table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.environment-built-in__row {
  display: grid;
  min-height: 46px;
  grid-template-columns: 150px minmax(220px, 1fr) minmax(240px, 1.2fr) 70px;
  align-items: center;
}

.environment-built-in__row + .environment-built-in__row {
  border-top: 1px solid var(--app-border);
}

.environment-built-in__row > * {
  min-width: 0;
  padding: 8px 12px;
}

.environment-built-in__row.is-head {
  min-height: 36px;
  background: #f7f8fa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.environment-built-in__row strong {
  color: var(--app-text-primary);
  font-size: 12px;
  font-weight: 500;
}

.environment-built-in__row code {
  overflow: hidden;
  color: var(--app-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.environment-built-in__row > span {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.environment-built-in__row button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 11px;
}

.environment-detail {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.environment-detail.is-empty {
  align-self: center;
}

.environment-detail__head {
  flex: 0 0 auto;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border);
}

.environment-detail__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.environment-detail__title h3 {
  font-size: 16px;
}

.environment-detail__title span {
  padding: 2px 7px;
  border-radius: 4px;
  background: #f2f3f5;
  color: var(--app-text-secondary);
  font-size: 11px;
}

.environment-detail__title span.is-production {
  background: #ffece8;
  color: #f53f3f;
}

.environment-detail__title .environment-detail__status.is-enabled {
  background: #e8ffea;
  color: #00b42a;
}

.environment-detail__tabs {
  display: flex;
  flex: 0 0 auto;
  height: 42px;
  align-items: flex-end;
  gap: 24px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border);
}

.environment-detail__tabs button {
  position: relative;
  display: inline-flex;
  height: 42px;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
}

.environment-detail__tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.environment-detail__tab-state {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00b42a;
}

.environment-section {
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  padding: 20px;
}

.environment-section > header {
  align-items: flex-start;
  margin-bottom: 18px;
}

.environment-section h4 {
  font-size: 14px;
}

.environment-form-grid {
  display: grid;
  max-width: 920px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.environment-form-grid--meta {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.environment-form-grid.is-compact {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--app-border);
}

.environment-form-grid label,
.environment-mock__form label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.environment-form-grid label > span,
.environment-mock__form label > span {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.environment-form-grid label.is-wide {
  grid-column: 1 / -1;
}

.environment-form-grid :deep(.el-select),
.environment-form-grid :deep(.el-input-number),
.environment-mock__form :deep(.el-select) {
  width: 100%;
}

.environment-inline-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.environment-endpoints {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.environment-endpoints__head,
.environment-endpoints__row {
  display: grid;
  grid-template-columns: minmax(110px, .8fr) minmax(130px, 1fr) minmax(260px, 2fr) 86px 52px;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
}

.environment-endpoints__head {
  background: #f7f8fa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.environment-endpoints__row {
  border-top: 1px solid var(--app-border);
}

.environment-variables :deep(.el-select) {
  width: min(720px, 100%);
}

.environment-variable-order {
  display: grid;
  max-width: 720px;
  gap: 6px;
  margin-top: 10px;
}

.environment-variable-order > div {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px 6px 12px;
  border: 1px solid var(--app-border);
  border-radius: 5px;
}

.environment-variable-order span {
  display: flex;
  align-items: center;
  gap: 9px;
}

.environment-variable-order b {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #f2f3f5;
  color: var(--app-text-muted);
  font-size: 11px;
}

.environment-variable-order strong {
  font-size: 12px;
  font-weight: 500;
}

.environment-variable-order small {
  color: var(--app-text-muted);
  font-size: 11px;
}

.environment-section__subhead {
  margin-top: 26px !important;
  padding-top: 20px;
  border-top: 1px solid var(--app-border);
}

.environment-variable-state {
  color: var(--app-text-muted);
  font-size: 11px;
}

.environment-variable-state.is-overridden {
  color: #ff7d00;
}

.environment-variables code {
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.environment-mock__form {
  display: grid;
  max-width: 920px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.environment-mock__switch {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.environment-mock__disabled {
  max-width: 720px;
  padding: 18px 0;
}

.environment-mock__disabled strong {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
}

.environment-mock__disabled p {
  max-width: 620px;
  margin: 5px 0 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 20px;
}

.environment-mock__status,
.environment-mock__warning {
  max-width: 920px;
  margin-top: 18px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 18px;
}

.environment-mock__status {
  background: #e8ffea;
  color: #166534;
}

.environment-mock__status span {
  margin-right: 8px;
  font-weight: 600;
}

.environment-mock__warning {
  background: #fff7e8;
  color: #b45309;
}

@media (max-width: 1100px) {
  .environment-form-grid--meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .environment-workspace {
    height: auto;
    grid-template-columns: 1fr;
  }

  .environment-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }

  .environment-sidebar__list {
    max-height: 220px;
  }

  .environment-detail {
    min-height: 640px;
  }
}

@media (max-width: 720px) {
  .environment-detail__head,
  .environment-page__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .environment-form-grid,
  .environment-form-grid--meta,
  .environment-mock__form {
    grid-template-columns: 1fr;
  }

  .environment-built-in__table {
    overflow-x: auto;
  }

  .environment-built-in__row {
    min-width: 760px;
  }
}
</style>
