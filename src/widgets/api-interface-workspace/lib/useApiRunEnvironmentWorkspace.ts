import { computed, ref, watch, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import {
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiRunPayload,
} from '@/entities/api-automation'
import {
  configApi,
  getEnvServiceDetails,
  getParamDescriptionText,
  getParamValueText,
  type EnvConfigItem,
  type MockApplicationItem,
  type MockBusinessScenarioItem,
  type ParamSetItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  formatApiEnvironmentWorkspace,
  formatRunEnvironmentSsl,
  formatRunEnvironmentStatus,
  formatRunEnvironmentTimeout,
  normalizeRunEnvironmentHeaders,
  parseRunEnvironmentConfig,
} from './apiRunEnvironmentView'

interface UseApiRunEnvironmentWorkspaceOptions {
  workspaceCode: ComputedRef<string>
  environments: ComputedRef<ApiAutomationEnvironmentItem[]>
  variableSets: ComputedRef<ApiAutomationVariableSetItem[]>
}

function isAbsoluteRequestPath(path: string) {
  return /^https?:\/\//i.test(path.trim())
}

function startsWithVariable(path: string) {
  return /^(\{\{\s*[\w.-]+\s*}}|\$\{\s*[\w.-]+\s*})/.test(path.trim())
}

export function useApiRunEnvironmentWorkspace(options: UseApiRunEnvironmentWorkspaceOptions) {
  const router = useRouter()
  const selectedEnvironmentId = ref<number | null>(null)
  const selectedVariableSetId = ref<number | null>(null)
  const selectedMockBusinessScenarioId = ref<number | null>(null)
  const runEnvironmentDrawerVisible = ref(false)
  const runEnvironmentDetailLoading = ref(false)
  const runEnvironmentDetailErrorMessage = ref('')
  const runEnvironmentConfig = ref<EnvConfigItem | null>(null)
  const runEnvironmentParamSets = ref<ParamSetItem[]>([])
  const runEnvironmentMockApplications = ref<MockApplicationItem[]>([])
  const runEnvironmentMockBusinessScenarios = ref<MockBusinessScenarioItem[]>([])

  const selectedEnvironment = computed(() =>
    options.environments.value.find(item => item.id === selectedEnvironmentId.value) || null,
  )
  const selectedEnvironmentDefaultVariableSet = computed(() => {
    const defaultId = selectedEnvironment.value?.defaultVariableSetId
    return defaultId ? options.variableSets.value.find(item => item.id === defaultId) || null : null
  })
  const runEnvironmentConfigJson = computed(() => parseRunEnvironmentConfig(runEnvironmentConfig.value?.configJson || ''))
  const runEnvironmentServices = computed(() =>
    runEnvironmentConfig.value
      ? getEnvServiceDetails(runEnvironmentConfig.value)
      : selectedEnvironment.value?.baseUrl
        ? [{ key: 'default', name: '默认服务', baseUrl: selectedEnvironment.value.baseUrl, isDefault: true }]
        : [],
  )
  const runEnvironmentDefaultVariableSetId = computed(() => {
    const value = runEnvironmentConfigJson.value.defaultVariableSetId
    return typeof value === 'number' ? value : selectedEnvironment.value?.defaultVariableSetId ?? null
  })
  const runEnvironmentDefaultParamSet = computed(() => {
    const id = runEnvironmentDefaultVariableSetId.value
    return id ? runEnvironmentParamSets.value.find(item => item.id === id) || null : null
  })
  const runEnvironmentMockApplication = computed(() => {
    const id = runEnvironmentConfigJson.value.mockApplicationId
    return typeof id === 'number' ? runEnvironmentMockApplications.value.find(item => item.id === id) || null : null
  })
  const selectedMockBusinessScenario = computed(() =>
    runEnvironmentMockBusinessScenarios.value.find(item => item.id === selectedMockBusinessScenarioId.value) || null,
  )
  const runEnvironmentHeaders = computed(() => normalizeRunEnvironmentHeaders(runEnvironmentConfigJson.value.headers))
  const runEnvironmentWorkspaceLabel = computed(() =>
    selectedEnvironment.value ? formatApiEnvironmentWorkspace(selectedEnvironment.value) : '',
  )
  const runEnvironmentStatusLabel = computed(() => formatRunEnvironmentStatus(selectedEnvironment.value?.status))
  const runEnvironmentDefaultParamSetValueText = computed(() =>
    runEnvironmentDefaultParamSet.value ? getParamValueText(runEnvironmentDefaultParamSet.value) : '',
  )
  const runEnvironmentDefaultParamSetDescriptionText = computed(() =>
    runEnvironmentDefaultParamSet.value ? getParamDescriptionText(runEnvironmentDefaultParamSet.value) : '',
  )
  const selectedMockBusinessScenarioDescription = computed(() => selectedMockBusinessScenario.value?.description || '')
  const runEnvironmentTimeoutLabel = computed(() => formatRunEnvironmentTimeout(runEnvironmentConfigJson.value))
  const runEnvironmentSslLabel = computed(() => formatRunEnvironmentSsl(runEnvironmentConfigJson.value))
  const currentEnvironmentName = computed(() => selectedEnvironment.value?.name || '未选择环境')
  const currentVariableSetName = computed(() => selectedEnvironmentDefaultVariableSet.value?.name || '跟随环境')

  function runOptionStorageKey(kind: 'environment' | 'variableSet') {
    return `api-interface:${options.workspaceCode.value}:${kind}`
  }

  function restoreRunOptions() {
    const environmentId = Number(localStorage.getItem(runOptionStorageKey('environment')) || '')
    selectedEnvironmentId.value = environmentId && options.environments.value.some(item => item.id === environmentId) ? environmentId : null
    selectedVariableSetId.value = null
    selectedMockBusinessScenarioId.value = null
    localStorage.removeItem(runOptionStorageKey('variableSet'))
  }

  function persistRunOptions() {
    if (selectedEnvironmentId.value) {
      localStorage.setItem(runOptionStorageKey('environment'), String(selectedEnvironmentId.value))
    } else {
      localStorage.removeItem(runOptionStorageKey('environment'))
    }
  }

  function currentRunPayload(): ApiRunPayload {
    return {
      workspaceCode: options.workspaceCode.value === 'ALL' ? undefined : options.workspaceCode.value,
      environmentId: selectedEnvironmentId.value || null,
      variableSetId: null,
      mockBusinessScenarioId: selectedMockBusinessScenarioId.value || null,
    }
  }

  function selectedEnvironmentHasBaseUrl() {
    const environment = options.environments.value.find(item => item.id === selectedEnvironmentId.value)
    return Boolean(environment?.baseUrl?.trim())
  }

  function guardRunEnvironmentForPath(path: string) {
    const normalizedPath = path.trim()
    if (!normalizedPath || isAbsoluteRequestPath(normalizedPath) || startsWithVariable(normalizedPath)) {
      return true
    }
    if (selectedEnvironmentHasBaseUrl()) {
      return true
    }
    ElMessage.warning('相对路径请求需要先选择带 Base URL 的运行环境，或直接填写完整 URL')
    return false
  }

  async function loadRunEnvironmentDetail() {
    const environment = selectedEnvironment.value
    if (!environment) {
      return
    }
    runEnvironmentDetailLoading.value = true
    runEnvironmentDetailErrorMessage.value = ''
    runEnvironmentConfig.value = null
    runEnvironmentMockBusinessScenarios.value = []
    try {
      const workspaceCode = environment.workspaceCode || options.workspaceCode.value
      const [envPage, paramPage, mockPage] = await Promise.all([
        configApi.getSettingsEnvs(workspaceCode, { keyword: environment.name }),
        configApi.getSettingsParams(workspaceCode),
        configApi.getMockApplications(workspaceCode),
      ])
      runEnvironmentConfig.value = envPage.items.find(item => item.id === environment.id) || null
      runEnvironmentParamSets.value = paramPage.items
      runEnvironmentMockApplications.value = mockPage.items
      const mockApplicationId = runEnvironmentConfigJson.value.mockApplicationId
      if (typeof mockApplicationId === 'number') {
        const businessScenarioPage = await configApi.getMockBusinessScenarios(workspaceCode, {
          appId: mockApplicationId,
          status: 1,
        })
        runEnvironmentMockBusinessScenarios.value = businessScenarioPage.items
        if (
          selectedMockBusinessScenarioId.value
          && !businessScenarioPage.items.some(item => item.id === selectedMockBusinessScenarioId.value)
        ) {
          selectedMockBusinessScenarioId.value = null
        }
      } else {
        selectedMockBusinessScenarioId.value = null
      }
    } catch (error) {
      runEnvironmentDetailErrorMessage.value = getRequestErrorMessage(error)
    } finally {
      runEnvironmentDetailLoading.value = false
    }
  }

  async function openRunEnvironmentDrawer() {
    if (!selectedEnvironment.value) {
      ElMessage.info('请先选择运行环境')
      return
    }
    runEnvironmentDrawerVisible.value = true
    await loadRunEnvironmentDetail()
  }

  function goConfigCenterEnv() {
    void router.push('/config-center')
  }

  watch(selectedEnvironmentId, () => {
    selectedMockBusinessScenarioId.value = null
    runEnvironmentConfig.value = null
    runEnvironmentMockBusinessScenarios.value = []
  })

  return {
    selectedEnvironmentId,
    selectedVariableSetId,
    selectedMockBusinessScenarioId,
    runEnvironmentDrawerVisible,
    runEnvironmentDetailLoading,
    runEnvironmentDetailErrorMessage,
    runEnvironmentConfig,
    runEnvironmentParamSets,
    runEnvironmentMockApplications,
    runEnvironmentMockBusinessScenarios,
    selectedEnvironment,
    selectedEnvironmentDefaultVariableSet,
    runEnvironmentConfigJson,
    runEnvironmentServices,
    runEnvironmentDefaultVariableSetId,
    runEnvironmentDefaultParamSet,
    runEnvironmentMockApplication,
    selectedMockBusinessScenario,
    runEnvironmentHeaders,
    runEnvironmentWorkspaceLabel,
    runEnvironmentStatusLabel,
    runEnvironmentDefaultParamSetValueText,
    runEnvironmentDefaultParamSetDescriptionText,
    selectedMockBusinessScenarioDescription,
    runEnvironmentTimeoutLabel,
    runEnvironmentSslLabel,
    currentEnvironmentName,
    currentVariableSetName,
    restoreRunOptions,
    persistRunOptions,
    currentRunPayload,
    guardRunEnvironmentForPath,
    openRunEnvironmentDrawer,
    loadRunEnvironmentDetail,
    goConfigCenterEnv,
  }
}
