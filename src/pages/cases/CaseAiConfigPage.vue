<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, CheckCircle, ChevronDown, ClipboardCheck, Info, RotateCcw, Save, Settings, Sparkles, Wrench, Zap } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  caseAiApi,
  type AiCaseConfigItem,
  type AiCaseConfigResponse,
  type SaveAiCaseConfigPayload,
} from '@/entities/case-ai'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  AppButton,
  AppEmptyState,
  AppLoadingState,
} from '@/shared/ui'
import CaseAiConfigFigmaWorkspace from '@/widgets/case-ai-config/CaseAiConfigFigmaWorkspace.vue'

type RoleType = 'CASE_GENERATOR' | 'CASE_REVIEWER'

interface RoleCardMeta {
  roleType: RoleType
  title: string
  subtitle: string
  iconClass: string
  iconType: 'generator' | 'reviewer'
}

interface ModelPoolOption {
  key: string
  providerId: number
  providerName: string
  providerType: string | null
  modelName: string
  displayName: string
}

interface RoleFormState {
  id: number | null
  providerConnectionId: number | null
  model: string
  promptTemplate: string
  reviewChecklist: string
  temperature: number
  topP: number
  maxCases: number
  supportsImageInput: boolean | null
}

const roleCards: RoleCardMeta[] = [
  {
    roleType: 'CASE_GENERATOR',
    title: '用例生成',
    subtitle: '根据接口信息或需求描述自动生成测试用例',
    iconClass: 'case-ai-role-card__icon--generator',
    iconType: 'generator',
  },
  {
    roleType: 'CASE_REVIEWER',
    title: '用例评审',
    subtitle: '对现有测试用例进行质量评审并给出改进建议',
    iconClass: 'case-ai-role-card__icon--reviewer',
    iconType: 'reviewer',
  },
]

const DEFAULT_GENERATOR_PROMPT = `你是一名资深测试工程师，负责根据需求文档、业务规则、接口说明、页面原型或图片素材设计高质量测试用例。
请优先产出真实有价值、可执行、可验证的测试用例，而不是为了数量堆重复场景。`

const DEFAULT_GENERATOR_CHECKLIST = '优先覆盖主流程、异常分支、边界条件、状态流转、组合场景和高风险回归点。'

const DEFAULT_REVIEW_PROMPT = `你是一名严格的测试评审专家，负责对 AI 生成的测试用例进行质量评审。
请先判断整体覆盖情况，再逐条给出结论与改进建议。`

const DEFAULT_REVIEW_CHECKLIST = '重点检查覆盖缺口、边界/等价类、组合条件、异常鲁棒性、可执行性和重复低价值用例。'

const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()

const loading = ref(false)
const savingRole = ref<RoleType | null>(null)
const testingRole = ref<RoleType | null>(null)
const loadingWorkspaces = ref(false)
const loadingProviders = ref(false)
const bootstrapping = ref(false)
const savingAll = ref(false)
const selectedTargetWorkspaceCode = ref('')
const configState = ref<AiCaseConfigResponse | null>(null)
const providers = ref<AiProviderConnectionItem[]>([])
const workspaces = ref<WorkspaceItem[]>([])
const openModelRole = ref<RoleType | null>(null)
const advancedVisible = ref(false)
const useFigmaLayout = true

const promptExpanded = reactive<Record<RoleType, boolean>>({
  CASE_GENERATOR: false,
  CASE_REVIEWER: false,
})

const forms = reactive<Record<RoleType, RoleFormState>>({
  CASE_GENERATOR: createDefaultForm('CASE_GENERATOR'),
  CASE_REVIEWER: createDefaultForm('CASE_REVIEWER'),
})

function createDefaultForm(roleType: RoleType): RoleFormState {
  return {
    id: null,
    providerConnectionId: null,
    model: '',
    promptTemplate: roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_PROMPT : DEFAULT_REVIEW_PROMPT,
    reviewChecklist: roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_CHECKLIST : DEFAULT_REVIEW_CHECKLIST,
    temperature: roleType === 'CASE_GENERATOR' ? 0.7 : 0.5,
    topP: roleType === 'CASE_GENERATOR' ? 0.9 : 0.7,
    maxCases: 50,
    supportsImageInput: null,
  }
}

function resetForm(roleType: RoleType) {
  Object.assign(forms[roleType], createDefaultForm(roleType))
}

function applyConfig(roleType: RoleType, config: AiCaseConfigItem | null) {
  resetForm(roleType)
  if (!config) {
    return
  }

  Object.assign(forms[roleType], {
    id: config.id,
    providerConnectionId: config.providerConnectionId,
    model: config.model ?? '',
    promptTemplate: config.promptTemplate?.trim()
      ? config.promptTemplate
      : (roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_PROMPT : DEFAULT_REVIEW_PROMPT),
    reviewChecklist: config.reviewChecklist?.trim()
      ? config.reviewChecklist
      : (roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_CHECKLIST : DEFAULT_REVIEW_CHECKLIST),
    temperature: config.temperature ?? (roleType === 'CASE_GENERATOR' ? 0.7 : 0.5),
    topP: config.topP ?? (roleType === 'CASE_GENERATOR' ? 0.9 : 0.7),
    maxCases: config.maxCases ?? 50,
    supportsImageInput: config.capabilityOverride?.imageInput ?? null,
  })
}

const isAllScope = computed(() => selectedWorkspaceCode.value === 'ALL')

const effectiveWorkspaceCode = computed(() => {
  if (isAllScope.value) {
    return selectedTargetWorkspaceCode.value
  }
  return selectedWorkspaceCode.value
})

const hasNoProviders = computed(() => providers.value.length === 0)

const modelPoolOptions = computed<ModelPoolOption[]>(() => {
  return providers.value
    .filter(item => item.status === 1)
    .filter(item => !!item.modelName?.trim())
    .map(item => ({
      value: `${item.id}::${item.modelName ?? ''}`,
      key: `${item.id}::${item.modelName ?? ''}`,
      providerId: item.id,
      providerName: item.connectionName,
      providerType: item.providerType ?? null,
      modelName: item.modelName?.trim() ?? '',
      displayName: item.modelName?.trim() ?? '',
    }))
})

const canBootstrapFromLegacy = computed(() => configState.value?.canBootstrapFromLegacy === true)

const showWorkspaceSelector = computed(() => isAllScope.value)
const totalModelCount = computed(() => modelPoolOptions.value.length)

const figmaSummaryCards = computed(() => [
  {
    roleType: 'CASE_GENERATOR' as const,
    label: '生成模型',
    name: forms.CASE_GENERATOR.model || 'GPT-4o',
    provider: selectedProviderText('CASE_GENERATOR') || 'OpenAI',
    tone: 'generator',
  },
  {
    roleType: 'CASE_REVIEWER' as const,
    label: '评审模型',
    name: forms.CASE_REVIEWER.model || 'Claude 3.5 Sonnet',
    provider: selectedProviderText('CASE_REVIEWER') || 'Anthropic',
    tone: 'reviewer',
  },
])
function getSelectedProvider(roleType: RoleType) {
  const form = forms[roleType]
  return providers.value.find(item => item.id === form.providerConnectionId) ?? null
}

function selectedModelKey(roleType: RoleType) {
  const form = forms[roleType]
  if (!form.providerConnectionId || !form.model) {
    return ''
  }
  return `${form.providerConnectionId}::${form.model}`
}

function selectedModelOption(roleType: RoleType) {
  const key = selectedModelKey(roleType)
  return modelPoolOptions.value.find(option => option.key === key) ?? null
}

function providerOptionClass(option: Pick<ModelPoolOption, 'providerName' | 'providerType' | 'modelName'>) {
  const providerType = option.providerType?.toLowerCase() ?? ''
  const source = `${option.providerName} ${option.modelName}`.toLowerCase()
  if (providerType === 'anthropic' || source.includes('anthropic') || source.includes('claude')) return 'provider-anthropic'
  if (providerType === 'deepseek' || source.includes('deepseek')) return 'provider-deepseek'
  if (providerType === 'google' || source.includes('google') || source.includes('gemini')) return 'provider-google'
  if (providerType === 'qwen' || source.includes('qwen') || source.includes('通义') || source.includes('dashscope') || source.includes('aliyun') || source.includes('阿里')) return 'provider-qwen'
  return 'provider-openai'
}

function providerOptionText(option: Pick<ModelPoolOption, 'providerName' | 'providerType' | 'modelName'>) {
  const providerType = option.providerType?.toLowerCase() ?? ''
  const source = `${option.providerName} ${option.modelName}`.toLowerCase()
  if (providerType === 'anthropic' || source.includes('anthropic') || source.includes('claude')) return 'Anthropic'
  if (providerType === 'deepseek' || source.includes('deepseek')) return 'DeepSeek'
  if (providerType === 'google' || source.includes('google') || source.includes('gemini')) return 'Google'
  if (providerType === 'qwen' || source.includes('qwen') || source.includes('通义') || source.includes('dashscope') || source.includes('aliyun') || source.includes('阿里')) return '阿里云'
  return option.providerName || 'OpenAI'
}

function selectedProviderClass(roleType: RoleType) {
  const option = selectedModelOption(roleType)
  return option ? providerOptionClass(option) : ''
}

function selectedProviderText(roleType: RoleType) {
  const option = selectedModelOption(roleType)
  return option ? providerOptionText(option) : ''
}

function isRecommendedModel(option: ModelPoolOption) {
  const modelName = option.displayName.toLowerCase()
  return modelName.includes('gpt-4o') || modelName.includes('sonnet')
}

function temperatureLabel(roleType: RoleType) {
  const value = forms[roleType].temperature
  if (value <= 0.3) return '保守'
  if (value <= 0.7) return '平衡'
  return '创意'
}

function temperatureTone(roleType: RoleType) {
  const value = forms[roleType].temperature
  if (value <= 0.3) return 'safe'
  if (value <= 0.7) return 'balanced'
  return 'creative'
}

function topPLabel(roleType: RoleType) {
  const value = forms[roleType].topP
  if (value <= 0.4) return '聚焦'
  if (value <= 0.7) return '均衡'
  return '发散'
}

function topPTone(roleType: RoleType) {
  const value = forms[roleType].topP
  if (value <= 0.4) return 'safe'
  if (value <= 0.7) return 'balanced'
  return 'creative'
}

function getPromptPreview(roleType: RoleType) {
  return forms[roleType].promptTemplate
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .join('\n')
}

function isRoleValid(roleType: RoleType) {
  const form = forms[roleType]
  return !!form.providerConnectionId
    && !!form.model.trim()
    && !!form.promptTemplate.trim()
    && form.temperature >= 0
    && form.temperature <= 1
    && form.topP >= 0.1
    && form.topP <= 1
}

function buildSavePayload(roleType: RoleType): SaveAiCaseConfigPayload {
  const form = forms[roleType]
  const provider = getSelectedProvider(roleType)

  return {
    roleType,
    providerConnectionId: form.providerConnectionId,
    model: form.model.trim(),
    promptTemplate: form.promptTemplate.trim(),
    reviewChecklist: form.reviewChecklist.trim()
      || (roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_CHECKLIST : DEFAULT_REVIEW_CHECKLIST),
    temperature: form.temperature,
    topP: form.topP,
    maxCases: form.maxCases,
    capabilityOverride: {
      imageInput: form.supportsImageInput,
    },
    status: 1,
    protocolType: provider?.protocolType ?? null,
    baseUrl: provider?.baseUrl ?? null,
    provider: provider?.providerType ?? null,
  }
}

function selectModelOption(roleType: RoleType, option: ModelPoolOption) {
  openModelRole.value = null
  const [providerIdText, model] = option.key.split('::')
  const providerConnectionId = Number(providerIdText)
  forms[roleType].providerConnectionId = Number.isFinite(providerConnectionId) ? providerConnectionId : null
  forms[roleType].model = model ?? ''
  forms[roleType].supportsImageInput = null
}

function handleFigmaModelSelect(payload: { role: RoleType, key: string }) {
  const option = modelPoolOptions.value.find(item => item.key === payload.key)
  if (option) {
    selectModelOption(payload.role, option)
  }
}

function handleFigmaPromptUpdate(payload: { role: RoleType, value: string }) {
  forms[payload.role].promptTemplate = payload.value
}

function handleFigmaMaxCasesUpdate(value: number) {
  forms.CASE_GENERATOR.maxCases = value
}

function toggleModelSelect(roleType: RoleType) {
  openModelRole.value = openModelRole.value === roleType ? null : roleType
}

function restoreDefaultPrompt(roleType: RoleType) {
  forms[roleType].promptTemplate = roleType === 'CASE_GENERATOR' ? DEFAULT_GENERATOR_PROMPT : DEFAULT_REVIEW_PROMPT
  forms[roleType].reviewChecklist = roleType === 'CASE_GENERATOR'
    ? DEFAULT_GENERATOR_CHECKLIST
    : DEFAULT_REVIEW_CHECKLIST
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.case-ai-role-card__model-select-native')) {
    return
  }
  openModelRole.value = null
}

function goToAiConnections() {
  void router.push({
    path: '/config-center',
    query: { tab: 'ai' },
  })
}

async function loadWorkspaces() {
  loadingWorkspaces.value = true
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items.filter(item => item.workspaceCode !== 'ALL')
    if (isAllScope.value) {
      selectedTargetWorkspaceCode.value = workspaces.value[0]?.workspaceCode ?? ''
    }
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    loadingWorkspaces.value = false
  }
}

async function loadProviders() {
  loadingProviders.value = true
  try {
    providers.value = await aiProviderApi.getProviderConnections('ALL')
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    loadingProviders.value = false
  }
}

async function loadConfig() {
  if (!effectiveWorkspaceCode.value) {
    configState.value = null
    resetForm('CASE_GENERATOR')
    resetForm('CASE_REVIEWER')
    return
  }

  loading.value = true
  try {
    const response = await caseAiApi.getConfig('ALL', effectiveWorkspaceCode.value)
    configState.value = response
    applyConfig('CASE_GENERATOR', response.generatorConfig)
    applyConfig('CASE_REVIEWER', response.reviewerConfig)
  }
  catch (error) {
    configState.value = null
    resetForm('CASE_GENERATOR')
    resetForm('CASE_REVIEWER')
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    loading.value = false
  }
}

async function testRole(roleType: RoleType) {
  if (!effectiveWorkspaceCode.value) {
    ElMessage.warning('请先选择工作空间')
    return
  }
  if (!isRoleValid(roleType)) {
    ElMessage.warning('请先补全当前角色配置')
    return
  }

  testingRole.value = roleType
  try {
    const result = await caseAiApi.testConfig('ALL', {
      ...buildSavePayload(roleType),
      workspaceCode: effectiveWorkspaceCode.value,
    })
    ElMessage.success(result.message || '测试连接成功')
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    testingRole.value = null
  }
}

async function saveRole(roleType: RoleType) {
  if (!effectiveWorkspaceCode.value) {
    ElMessage.warning('请先选择工作空间')
    return
  }
  if (!isRoleValid(roleType)) {
    ElMessage.warning('请先补全当前角色配置')
    return
  }

  savingRole.value = roleType
  try {
    const payload = {
      ...buildSavePayload(roleType),
      workspaceCode: effectiveWorkspaceCode.value,
    }

    const currentId = forms[roleType].id
    const saved = currentId
      ? await caseAiApi.updateConfig('ALL', currentId, payload)
      : await caseAiApi.createConfig('ALL', payload)

    applyConfig(roleType, saved)
    await loadConfig()
    ElMessage.success('配置保存成功')
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    savingRole.value = null
  }
}

async function saveAllRoles() {
  if (!effectiveWorkspaceCode.value) {
    ElMessage.warning('请先选择工作空间')
    return
  }
  if (!isRoleValid('CASE_GENERATOR') || !isRoleValid('CASE_REVIEWER')) {
    ElMessage.warning('请先补全生成模型和评审模型配置')
    return
  }

  savingAll.value = true
  try {
    const roles: RoleType[] = ['CASE_GENERATOR', 'CASE_REVIEWER']
    for (const roleType of roles) {
      const payload = {
        ...buildSavePayload(roleType),
        workspaceCode: effectiveWorkspaceCode.value,
      }
      const currentId = forms[roleType].id
      await (currentId
        ? caseAiApi.updateConfig('ALL', currentId, payload)
        : caseAiApi.createConfig('ALL', payload))
    }
    await loadConfig()
    ElMessage.success('AI 配置已保存')
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    savingAll.value = false
  }
}

async function bootstrapLegacyConfig() {
  if (!effectiveWorkspaceCode.value) {
    ElMessage.warning('请先选择工作空间')
    return
  }

  try {
    await ElMessageBox.confirm(
      '将尝试从旧配置初始化当前工作空间下的个人 AI 配置，是否继续？',
      '初始化 AI 配置',
      {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '取消',
      },
    )
  }
  catch {
    return
  }

  bootstrapping.value = true
  try {
    const response = await caseAiApi.bootstrapFromLegacy('ALL')
    configState.value = response
    applyConfig('CASE_GENERATOR', response.generatorConfig)
    applyConfig('CASE_REVIEWER', response.reviewerConfig)
    ElMessage.success('已从旧配置初始化')
  }
  catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
  finally {
    bootstrapping.value = false
  }
}

watch(
  () => selectedWorkspaceCode.value,
  async () => {
    if (isAllScope.value && !workspaces.value.length) {
      await loadWorkspaces()
    }
    if (!isAllScope.value) {
      selectedTargetWorkspaceCode.value = ''
    }
    await loadConfig()
  },
)

watch(
  () => selectedTargetWorkspaceCode.value,
  async () => {
    if (isAllScope.value) {
      await loadConfig()
    }
  },
)

onMounted(async () => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  await Promise.all([
    loadProviders(),
    loadWorkspaces(),
  ])
  await loadConfig()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
})
</script>

<template>
  <CaseAiConfigFigmaWorkspace
    v-if="useFigmaLayout"
    :loading="loading || loadingProviders"
    :saving="savingAll"
    :workspace-ready="!!effectiveWorkspaceCode"
    :config-complete="isRoleValid('CASE_GENERATOR') && isRoleValid('CASE_REVIEWER')"
    :model-options="modelPoolOptions"
    :generator-model-key="selectedModelKey('CASE_GENERATOR')"
    :reviewer-model-key="selectedModelKey('CASE_REVIEWER')"
    :generator-prompt="forms.CASE_GENERATOR.promptTemplate"
    :reviewer-prompt="forms.CASE_REVIEWER.promptTemplate"
    :default-generator-prompt="DEFAULT_GENERATOR_PROMPT"
    :default-reviewer-prompt="DEFAULT_REVIEW_PROMPT"
    :max-cases="forms.CASE_GENERATOR.maxCases"
    @manage-connections="goToAiConnections"
    @save="saveAllRoles"
    @select-model="handleFigmaModelSelect"
    @update-prompt="handleFigmaPromptUpdate"
    @update:max-cases="handleFigmaMaxCasesUpdate"
  />

  <section v-else class="case-ai-config-page">
    <header class="case-ai-config-page__figma-header">
      <h2>AI 配置</h2>
      <p>配置用于生成和评审测试用例的 AI 模型</p>
    </header>

    <div class="case-ai-config-page__summary-row">
      <article
        v-for="card in figmaSummaryCards"
        :key="card.roleType"
        class="case-ai-config-page__summary-card"
        :class="`is-${card.tone}`"
      >
        <div class="case-ai-config-page__summary-icon">
          <Zap v-if="card.tone === 'generator'" />
          <CheckCircle v-else />
        </div>
        <div class="case-ai-config-page__summary-copy">
          <div class="case-ai-config-page__summary-label">{{ card.label }}</div>
          <div class="case-ai-config-page__summary-model">
            <span>{{ card.name }}</span>
            <code>{{ card.provider }}</code>
          </div>
        </div>
        <button type="button" class="case-ai-config-page__summary-button" @click="advancedVisible = true">
          <Settings />
          配置
        </button>
      </article>
    </div>

    <p class="case-ai-config-page__figma-footer">
      更多 AI 连接配置请前往「配置中心 › AI 连接配置」进行管理。
    </p>

    <section v-if="advancedVisible" class="case-ai-config-page__advanced">
      <div class="case-ai-config-page__tip">
        <div class="case-ai-config-page__tip-copy">
          <Info class="case-ai-config-page__tip-icon" />
          <span>
            模型来自 AI 连接池，现有 <strong>{{ totalModelCount }}</strong> 个可选模型。若当前没有可用连接，请前往
            <button type="button" class="case-ai-config-page__tip-link" @click="goToAiConnections">
            配置中心 / AI 连接配置
            </button>
            创建或维护连接。
          </span>
        </div>

        <div class="case-ai-config-page__tip-actions">
          <el-select
            v-if="showWorkspaceSelector"
            v-model="selectedTargetWorkspaceCode"
            class="case-ai-config-page__workspace-select"
            placeholder="选择工作空间"
            :loading="loadingWorkspaces"
            filterable
          >
            <el-option
              v-for="workspace in workspaces"
              :key="workspace.workspaceCode"
              :label="workspace.workspaceName"
              :value="workspace.workspaceCode"
            />
          </el-select>

          <AppButton
            v-if="canBootstrapFromLegacy"
            class="case-ai-config-page__tip-button"
            :icon="Wrench"
            :loading="bootstrapping"
            @click="bootstrapLegacyConfig"
          >
            从旧配置初始化
          </AppButton>
        </div>
      </div>

      <div v-if="!effectiveWorkspaceCode && showWorkspaceSelector" class="case-ai-config-page__state">
        <AppEmptyState title="请选择工作空间" description="全部空间视角下，需要先选一个目标工作空间再配置 AI。" />
      </div>

      <div v-else-if="loading" class="case-ai-config-page__state">
        <AppLoadingState text="正在读取当前工作空间的生成和评审配置..." />
      </div>

      <div v-else-if="hasNoProviders && !loadingProviders" class="case-ai-config-page__state">
        <AppEmptyState title="暂无可用 AI 连接" description="先去配置中心创建连接，再回来配置生成和评审模型。">
          <template #actions>
            <AppButton type="primary" @click="goToAiConnections">
              去创建连接
            </AppButton>
          </template>
        </AppEmptyState>
      </div>

      <div v-else class="case-ai-config-page__grid">
        <article
          v-for="roleCard in roleCards"
          :key="roleCard.roleType"
          class="case-ai-role-card"
          :class="{ 'is-prompt-expanded': promptExpanded[roleCard.roleType] }"
        >
          <header class="case-ai-role-card__header">
            <div class="case-ai-role-card__heading">
              <div class="case-ai-role-card__icon" :class="roleCard.iconClass">
                <Zap v-if="roleCard.iconType === 'generator'" class="case-ai-role-card__icon-svg" />
                <ClipboardCheck v-else class="case-ai-role-card__icon-svg" />
              </div>
              <div>
                <h3>{{ roleCard.title }}</h3>
                <p>{{ roleCard.subtitle }}</p>
              </div>
            </div>
          </header>

          <div class="case-ai-role-card__body">
            <div class="case-ai-role-card__field">
              <label class="case-ai-role-card__label">选择模型</label>
              <div class="case-ai-role-card__help">从 AI 连接池中选择已配置的模型</div>

              <div class="case-ai-role-card__model-row">
                <div class="case-ai-role-card__model-select-native">
                  <button
                    type="button"
                    class="case-ai-role-card__model-trigger"
                    :class="{ 'is-open': openModelRole === roleCard.roleType }"
                    @click="toggleModelSelect(roleCard.roleType)"
                  >
                    <template v-if="selectedModelOption(roleCard.roleType)">
                      <span class="case-ai-role-card__model-name">
                        {{ selectedModelOption(roleCard.roleType)?.displayName }}
                      </span>
                      <span
                        class="case-ai-role-card__provider-chip"
                        :class="selectedProviderClass(roleCard.roleType)"
                      >
                        {{ selectedProviderText(roleCard.roleType) }}
                      </span>
                    </template>
                    <span v-else class="case-ai-role-card__model-placeholder">请选择模型</span>
                    <ChevronDown class="case-ai-role-card__model-chevron" />
                  </button>

                  <div v-if="openModelRole === roleCard.roleType" class="case-ai-role-card__model-dropdown">
                    <button
                      v-for="option in modelPoolOptions"
                      :key="option.key"
                      type="button"
                      class="case-ai-role-card__model-option"
                      :class="{ 'is-selected': selectedModelKey(roleCard.roleType) === option.key }"
                      @click="selectModelOption(roleCard.roleType, option)"
                    >
                      <div class="case-ai-role-card__model-option-copy">
                        <div class="case-ai-role-card__model-option-title-row">
                          <span class="case-ai-role-card__model-option-title">{{ option.displayName }}</span>
                          <span v-if="isRecommendedModel(option)" class="case-ai-role-card__model-badge">推荐</span>
                        </div>
                        <span
                          class="case-ai-role-card__provider-chip case-ai-role-card__provider-chip--option"
                          :class="providerOptionClass(option)"
                        >
                          {{ providerOptionText(option) }}
                        </span>
                      </div>
                      <Check
                        v-if="selectedModelKey(roleCard.roleType) === option.key"
                        class="case-ai-role-card__model-check"
                      />
                    </button>
                    <div v-if="modelPoolOptions.length === 0" class="case-ai-role-card__model-empty">
                      暂无可选模型
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="case-ai-role-card__test-button"
                  :disabled="!isRoleValid(roleCard.roleType)"
                  @click="testRole(roleCard.roleType)"
                >
                  <Sparkles :class="{ 'is-loading': testingRole === roleCard.roleType }" />
                  {{ testingRole === roleCard.roleType ? '连接中...' : '测试连接' }}
                </button>
              </div>
            </div>

            <div class="case-ai-role-card__slider-block">
              <div class="case-ai-role-card__slider-header">
                <div class="case-ai-role-card__slider-label">
                  <span>创造度 (Temperature)</span>
                  <span class="case-ai-role-card__tooltip">
                    <Info class="case-ai-role-card__info-icon" />
                    <span class="case-ai-role-card__tooltip-popover">
                      控制回答的随机性与创意程度。<br>
                      - 偏低：回答更稳定、一致。<br>
                      - 偏高：回答更多样、发散。<br>
                      建议生成任务用 0.7，评审任务用 0.5
                    </span>
                  </span>
                </div>
                <span class="case-ai-role-card__slider-value" :class="`tone-${temperatureTone(roleCard.roleType)}`">
                  {{ temperatureLabel(roleCard.roleType) }} ({{ forms[roleCard.roleType].temperature.toFixed(1) }})
                </span>
              </div>
              <input
                v-model.number="forms[roleCard.roleType].temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                class="case-ai-role-card__range"
              >
              <div class="case-ai-role-card__scale">
                <span>精准</span>
                <span>创意</span>
              </div>
            </div>

            <div class="case-ai-role-card__slider-block">
              <div class="case-ai-role-card__slider-header">
                <div class="case-ai-role-card__slider-label">
                  <span>采样范围 (Top-p)</span>
                  <span class="case-ai-role-card__tooltip">
                    <Info class="case-ai-role-card__info-icon" />
                    <span class="case-ai-role-card__tooltip-popover">
                      控制 AI 选词的候选范围。<br>
                      - 偏低：用词更精准、克制。<br>
                      - 偏高：表达更丰富、多样。<br>
                      建议生成任务用 0.9，评审任务用 0.7
                    </span>
                  </span>
                </div>
                <span class="case-ai-role-card__slider-value" :class="`tone-${topPTone(roleCard.roleType)}`">
                  {{ topPLabel(roleCard.roleType) }} ({{ forms[roleCard.roleType].topP.toFixed(1) }})
                </span>
              </div>
              <input
                v-model.number="forms[roleCard.roleType].topP"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                class="case-ai-role-card__range"
              >
              <div class="case-ai-role-card__scale">
                <span>聚焦</span>
                <span>发散</span>
              </div>
            </div>

            <div class="case-ai-role-card__prompt-block">
              <div class="case-ai-role-card__prompt-header">
                <label class="case-ai-role-card__label">角色提示词</label>
                <div class="case-ai-role-card__field-actions">
                  <button type="button" class="case-ai-role-card__text-action" @click="restoreDefaultPrompt(roleCard.roleType)">
                    <RotateCcw />
                    恢复默认
                  </button>
                  <button
                    type="button"
                    class="case-ai-role-card__toggle-action"
                    :class="{ 'is-expanded': promptExpanded[roleCard.roleType] }"
                    @click="promptExpanded[roleCard.roleType] = !promptExpanded[roleCard.roleType]"
                  >
                    {{ promptExpanded[roleCard.roleType] ? '收起编辑' : '展开编辑' }}
                    <ChevronDown />
                  </button>
                </div>
              </div>

              <button
                v-if="!promptExpanded[roleCard.roleType]"
                type="button"
                class="case-ai-role-card__prompt-preview"
                @click="promptExpanded[roleCard.roleType] = true"
              >
                {{ getPromptPreview(roleCard.roleType) }}
              </button>

              <el-input
                v-else
                v-model="forms[roleCard.roleType].promptTemplate"
                type="textarea"
                resize="none"
                :rows="7"
                class="case-ai-role-card__prompt-textarea"
              />

              <p class="case-ai-role-card__prompt-hint">
                <Info />
                提示词会附加在每次 AI 请求前，影响生成结果的风格和质量
              </p>
            </div>

            <div class="case-ai-role-card__footer">
              <button
                type="button"
                class="case-ai-role-card__save-button"
                :disabled="!isRoleValid(roleCard.roleType)"
                @click="saveRole(roleCard.roleType)"
              >
                <Save v-if="savingRole !== roleCard.roleType" />
                <Sparkles v-else class="is-loading" />
                保存配置
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.case-ai-config-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 17.5px;
  padding: 21px;
}

.case-ai-config-page__figma-header h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.case-ai-config-page__figma-header p {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-config-page__summary-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-config-page__summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 76px;
  min-width: 0;
  padding: 16px 19.5px;
  border: 2px solid rgb(22 93 255 / 19%);
  border-radius: 11px;
  background: #fff;
}

.case-ai-config-page__summary-card.is-generator {
  border-color: rgb(0 180 42 / 19%);
}

.case-ai-config-page__summary-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border-radius: 7px;
  background: rgb(22 93 255 / 8%);
  color: #165dff;
}

.case-ai-config-page__summary-card.is-generator .case-ai-config-page__summary-icon {
  background: rgb(0 180 42 / 8%);
  color: #00b42a;
}

.case-ai-config-page__summary-icon svg {
  width: 22px;
  height: 22px;
}

.case-ai-config-page__summary-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3.5px;
}

.case-ai-config-page__summary-label {
  color: #165dff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.275px;
  line-height: 16.5px;
}

.case-ai-config-page__summary-card.is-generator .case-ai-config-page__summary-label {
  color: #00b42a;
}

.case-ai-config-page__summary-model {
  display: flex;
  align-items: baseline;
  gap: 6.3px;
  min-width: 0;
}

.case-ai-config-page__summary-model span {
  overflow: hidden;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-config-page__summary-model code {
  color: #86909c;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.case-ai-config-page__summary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  width: 65.25px;
  height: 28px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.case-ai-config-page__summary-button svg {
  width: 13px;
  height: 13px;
}

.case-ai-config-page__figma-footer {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.case-ai-config-page__advanced {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-5);
  padding-top: 10.5px;
}

.case-ai-config-page__tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 52px;
  padding: 14px var(--app-space-4);
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-lg);
  background: var(--app-primary-soft);
}

.case-ai-config-page__tip-copy {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
  color: var(--app-primary-hover);
  font-size: 14px;
  line-height: 20px;
}

.case-ai-config-page__tip-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--app-primary);
  stroke-width: 2;
}

.case-ai-config-page__tip-link {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.case-ai-config-page__tip-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.case-ai-config-page__workspace-select {
  width: 228px;
}

.case-ai-config-page__workspace-select :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: var(--app-radius-lg);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.case-ai-config-page__workspace-select :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #bfdbfe inset;
}

.case-ai-config-page__workspace-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--app-primary) inset, 0 0 0 2px rgb(59 130 246 / 0.12);
}

.case-ai-config-page__tip-button {
  height: 38px;
  border-radius: var(--app-radius-lg);
  box-shadow: none;
}

.case-ai-config-page__state {
  display: flex;
  flex: 1;
  min-height: 320px;
}

.case-ai-config-page__grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-6);
  align-items: stretch;
}

.case-ai-role-card {
  display: flex;
  height: calc(100dvh - 205px);
  min-height: 520px;
  overflow: visible;
  flex-direction: column;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.case-ai-role-card.is-prompt-expanded {
  height: auto;
  min-height: 0;
}

.case-ai-role-card:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card-hover);
}

.case-ai-role-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 80px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--app-border-soft);
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-4);
}

.case-ai-role-card__heading {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
}

.case-ai-role-card__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--app-radius-lg);
}

.case-ai-role-card__icon--generator {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-ai-role-card__icon--reviewer {
  background: #ecfdf5;
  color: #22c55e;
}

.case-ai-role-card__icon-svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.case-ai-role-card__heading h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.case-ai-role-card__heading p {
  margin: 2px 0 0;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 16px;
}

.case-ai-role-card__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: var(--app-space-4) var(--app-space-6);
}

.case-ai-role-card__field,
.case-ai-role-card__prompt-block,
.case-ai-role-card__slider-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.case-ai-role-card__prompt-block {
  flex: 1 1 auto;
  min-height: 0;
}

.case-ai-role-card__prompt-header,
.case-ai-role-card__slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.case-ai-role-card__label,
.case-ai-role-card__slider-label {
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.case-ai-role-card__help {
  margin-top: -4px;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 16px;
}

.case-ai-role-card__field-actions,
.case-ai-role-card__slider-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.case-ai-role-card__field-actions {
  gap: 10px;
  flex: 0 0 auto;
}

.case-ai-role-card__text-action,
.case-ai-role-card__toggle-action,
.case-ai-role-card__test-button,
.case-ai-role-card__save-button,
.case-ai-role-card__model-trigger,
.case-ai-role-card__model-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  font: inherit;
  cursor: pointer;
}

.case-ai-role-card__text-action {
  gap: 4px;
  background: transparent;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  padding: 0;
  transition: color 150ms ease;
}

.case-ai-role-card__text-action:hover {
  color: var(--app-primary);
}

.case-ai-role-card__text-action svg {
  width: 12px;
  height: 12px;
  stroke-width: 2;
}

.case-ai-role-card__toggle-action {
  gap: 4px;
  background: transparent;
  color: var(--app-primary);
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  padding: 0;
}

.case-ai-role-card__toggle-action svg {
  width: 13px;
  height: 13px;
  transition: transform 150ms ease;
}

.case-ai-role-card__toggle-action.is-expanded svg {
  transform: rotate(180deg);
}

.case-ai-role-card__model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.case-ai-role-card__model-select-native {
  position: relative;
  min-width: 0;
}

.case-ai-role-card__model-trigger {
  width: 100%;
  height: 42px;
  gap: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  padding: 0 12px;
  font-size: 14px;
  line-height: 20px;
  box-shadow: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.case-ai-role-card__model-trigger:hover,
.case-ai-role-card__model-trigger.is-open {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.12);
}

.case-ai-role-card__model-name {
  overflow: hidden;
  flex: 1 1 auto;
  min-width: 0;
  color: #1f2937;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-role-card__model-placeholder {
  flex: 1 1 auto;
  color: var(--app-text-subtle);
  font-size: 14px;
  line-height: 20px;
  text-align: left;
}

.case-ai-role-card__model-chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--app-text-subtle);
  stroke-width: 2;
  transition: transform 150ms ease;
}

.case-ai-role-card__model-trigger.is-open .case-ai-role-card__model-chevron {
  transform: rotate(180deg);
}

.case-ai-role-card__model-dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-overlay);
  overscroll-behavior: contain;
  padding: 6px 0;
  scrollbar-width: thin;
}

.case-ai-role-card__model-option {
  width: 100%;
  min-height: 56px;
  justify-content: space-between;
  gap: 8px;
  border-radius: 0;
  background: var(--app-bg-panel);
  color: #1f2937;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 150ms ease;
}

.case-ai-role-card__model-option:hover {
  background: var(--app-bg-page);
}

.case-ai-role-card__model-option.is-selected {
  background: var(--app-primary-soft);
}

.case-ai-role-card__model-option-copy {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.case-ai-role-card__model-option-title-row {
  display: flex;
  align-items: center;
  max-width: 100%;
  gap: 8px;
}

.case-ai-role-card__model-option-title {
  overflow: hidden;
  color: #1f2937;
  font-size: var(--app-font-size-md);
  font-weight: 500;
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-role-card__model-badge {
  flex: 0 0 auto;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  padding: 1px 6px;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-ai-role-card__model-check {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--app-primary);
  stroke-width: 2;
}

.case-ai-role-card__model-empty {
  padding: 12px;
  color: var(--app-text-subtle);
  font-size: 13px;
  text-align: center;
}

.case-ai-role-card__provider-chip {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  white-space: nowrap;
}

.case-ai-role-card__provider-chip--option {
  padding: 1px 6px;
}

.provider-openai {
  background: #dcfce7;
  color: #15803d;
}

.provider-anthropic {
  background: #ffedd5;
  color: #c2410c;
}

.provider-google {
  background: #dbeafe;
  color: var(--app-primary);
}

.provider-deepseek {
  background: #f3e8ff;
  color: #7e22ce;
}

.provider-qwen {
  background: #fee2e2;
  color: #b91c1c;
}

.case-ai-role-card__test-button {
  height: 42px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  padding: 0 14px;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
  box-shadow: none;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.case-ai-role-card__test-button svg {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.case-ai-role-card__test-button:hover:not(:disabled) {
  border-color: #bfdbfe;
  background: var(--app-bg-page);
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.12);
}

.case-ai-role-card__test-button:disabled,
.case-ai-role-card__save-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.case-ai-role-card__tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: 0;
}

.case-ai-role-card__info-icon,
.case-ai-role-card__prompt-hint svg {
  width: 14px;
  height: 14px;
  color: var(--app-text-subtle);
  stroke-width: 2;
}

.case-ai-role-card__tooltip:hover .case-ai-role-card__info-icon {
  color: #60a5fa;
}

.case-ai-role-card__tooltip-popover {
  pointer-events: none;
  position: absolute;
  z-index: 30;
  top: 50%;
  left: calc(100% + 8px);
  width: 220px;
  transform: translateY(-50%) translateX(-2px);
  border-radius: var(--app-radius-lg);
  background: var(--app-text-primary);
  box-shadow: 0 20px 25px -5px rgb(15 23 42 / 0.22), 0 8px 10px -6px rgb(15 23 42 / 0.16);
  color: #fff;
  font-size: var(--app-font-size-xs);
  font-weight: 400;
  line-height: 20px;
  opacity: 0;
  padding: 10px 12px;
  text-align: left;
  white-space: normal;
  transition: opacity 120ms ease, transform 120ms ease;
}

.case-ai-role-card__tooltip-popover::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 100%;
  width: 0;
  height: 0;
  transform: translateY(-50%);
  border-top: 4px solid transparent;
  border-right: 4px solid var(--app-text-primary);
  border-bottom: 4px solid transparent;
}

.case-ai-role-card__tooltip:hover .case-ai-role-card__tooltip-popover {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.case-ai-role-card__slider-value {
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.tone-safe {
  color: var(--app-primary);
}

.tone-balanced {
  color: var(--app-success);
}

.tone-creative {
  color: #f97316;
}

.case-ai-role-card__range {
  width: 100%;
  height: 6px;
  margin: 5px 0 2px;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.case-ai-role-card__range:focus {
  outline: none;
}

.case-ai-role-card__range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: var(--app-border);
}

.case-ai-role-card__range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -4px;
  border: 0;
  border-radius: 999px;
  appearance: none;
  background: var(--app-primary);
  box-shadow: 0 0 0 2px #fff, 0 1px 4px rgb(37 99 235 / 0.35);
}

.case-ai-role-card__range::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: var(--app-border);
}

.case-ai-role-card__range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 999px;
  background: var(--app-primary);
  box-shadow: 0 0 0 2px #fff, 0 1px 4px rgb(37 99 235 / 0.35);
}

.case-ai-role-card__scale {
  display: flex;
  justify-content: space-between;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-ai-role-card__prompt-preview {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  align-items: flex-start;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 13px;
  line-height: 21px;
  padding: 12px;
  text-align: left;
  white-space: pre-line;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}

.case-ai-role-card__prompt-preview:hover {
  border-color: #bfdbfe;
  background: #fff;
  box-shadow: var(--app-shadow-card);
}

.case-ai-role-card__prompt-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0 0;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-ai-role-card__prompt-textarea :deep(.el-textarea__inner) {
  height: 320px !important;
  min-height: 320px !important;
  max-height: 320px !important;
  overflow-y: auto;
  border-radius: var(--app-radius-lg);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-md);
  line-height: 22px;
  padding: 12px;
  scrollbar-width: thin;
  transition: box-shadow 150ms ease;
}

.case-ai-role-card__model-dropdown::-webkit-scrollbar,
.case-ai-role-card__prompt-textarea :deep(.el-textarea__inner::-webkit-scrollbar) {
  width: 6px;
}

.case-ai-role-card__model-dropdown::-webkit-scrollbar-thumb,
.case-ai-role-card__prompt-textarea :deep(.el-textarea__inner::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--app-border-strong);
}

.case-ai-role-card__prompt-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--app-primary) inset, 0 0 0 2px rgb(59 130 246 / 0.12);
}

.case-ai-role-card__footer {
  display: block;
  margin-top: auto;
  padding-top: var(--app-space-1);
}

.case-ai-role-card__save-button {
  display: flex;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  height: 42px;
  align-self: stretch;
  margin-top: auto;
  border-radius: var(--app-radius-lg);
  background: var(--app-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  box-shadow: none;
  transition: background 150ms ease, transform 150ms ease;
}

.case-ai-role-card__save-button svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.case-ai-role-card__save-button:hover:not(:disabled) {
  background: var(--app-primary-hover);
}

.case-ai-role-card__save-button:active:not(:disabled) {
  transform: translateY(1px);
}

.is-loading {
  animation: case-ai-spin 0.9s linear infinite;
}

@keyframes case-ai-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1440px) {
  .case-ai-config-page__grid {
    grid-template-columns: 1fr;
  }

  .case-ai-role-card {
    height: auto;
    min-height: 0;
  }

  .case-ai-role-card__prompt-preview {
    min-height: 184px;
    flex: 0 0 auto;
  }
}

@media (max-width: 960px) {
  .case-ai-config-page__tip {
    align-items: flex-start;
    flex-direction: column;
  }

  .case-ai-config-page__tip-actions,
  .case-ai-role-card__model-row {
    width: 100%;
  }

  .case-ai-role-card__model-row {
    grid-template-columns: 1fr;
  }

  .case-ai-config-page__workspace-select {
    width: 100%;
  }
}
</style>
