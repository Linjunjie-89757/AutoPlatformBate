import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type ConfigReferenceSummary,
  type EnvConfigItem,
  type MockApplicationItem,
  type MockReleaseItem,
  type ParamSetItem,
} from '@/entities/config'
import {
  buildCreateEnvPayload,
  createConfigEnvFormFromItem,
  createDefaultConfigEnvForm,
  validateConfigEnvForm,
} from '@/features/config-env-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'

import type { EnvironmentDetailTab, EnvironmentEditorForm } from './configEnvironmentPanel.types'

interface UseConfigEnvironmentManagementOptions {
  workspaceCode: () => string
  activeTab: Ref<EnvironmentDetailTab>
}

export function useConfigEnvironmentManagement(options: UseConfigEnvironmentManagementOptions) {
  const envs = ref<EnvConfigItem[]>([])
  const variableSets = ref<ParamSetItem[]>([])
  const mockApplications = ref<MockApplicationItem[]>([])
  const mockReleases = ref<MockReleaseItem[]>([])
  const selectedEnvId = ref<number | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const operating = ref(false)
  const errorMessage = ref('')
  const referenceLoading = ref(false)
  const referenceSummary = ref<ConfigReferenceSummary | null>(null)
  const environmentDialogMode = ref<'create' | 'edit' | null>(null)
  const disableDialogVisible = ref(false)
  const variableSetVersions = ref<Record<number, number | null>>({})
  const mockEndpointCount = ref<number | null>(null)
  const mockScenarioCount = ref<number | null>(null)
  const mockUnmatched24hCount = ref<number | null>(null)
  const mockReferenceCount = ref<number | null>(null)
  const form = reactive(createDefaultConfigEnvForm(options.workspaceCode()))
  const environmentEditor = reactive<EnvironmentEditorForm>({
    envName: '',
    envType: 'TEST',
    automationType: 'API',
    description: '',
  })

  let environmentSelectedHandler: () => void = () => undefined

  const selectedEnv = computed(() => envs.value.find(item => item.id === selectedEnvId.value) || null)

  function setEnvironmentSelectedHandler(handler: () => void) {
    environmentSelectedHandler = handler
  }

  async function loadData(preferredId = selectedEnvId.value, preferredTab?: EnvironmentDetailTab) {
    loading.value = true
    errorMessage.value = ''
    try {
      const [envPage, variablePage, mockPage] = await Promise.all([
        configApi.getSettingsEnvs(options.workspaceCode()),
        configApi.getSettingsParams(options.workspaceCode(), { status: 1 }),
        configApi.getMockApplications(options.workspaceCode(), { status: 1 }),
      ])
      envs.value = envPage.items || []
      variableSets.value = variablePage.items || []
      mockApplications.value = mockPage.items || []
      const next = envs.value.find(item => item.id === preferredId) || envs.value[0] || null
      if (next) await selectEnv(next, preferredTab)
      else selectedEnvId.value = null
    } catch (error) {
      errorMessage.value = getRequestErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function loadVariableSetVersions() {
    const candidates = variableSets.value.filter(item => (
      item.id > 0
      && item.paramType !== 'GLOBAL'
      && !Object.prototype.hasOwnProperty.call(variableSetVersions.value, item.id)
    ))
    if (!candidates.length) return
    const entries = await Promise.all(candidates.map(async item => {
      try {
        const page = await configApi.getSettingsParamVersions(item.workspaceCode || options.workspaceCode(), item.id)
        const versions = page.items || []
        const latest = versions.find(version => version.latest) || versions.reduce((current, version) => (
          !current || version.versionNo > current.versionNo ? version : current
        ), versions[0])
        return [item.id, latest?.versionNo || null] as const
      } catch {
        return [item.id, null] as const
      }
    }))
    variableSetVersions.value = { ...variableSetVersions.value, ...Object.fromEntries(entries) }
  }

  async function selectEnv(env: EnvConfigItem, preferredTab: EnvironmentDetailTab = 'services') {
    selectedEnvId.value = env.id
    Object.assign(form, createConfigEnvFormFromItem(env))
    options.activeTab.value = preferredTab
    environmentSelectedHandler()
    await Promise.all([
      loadReferences(),
      loadMockReleases(form.mockApplicationId),
      loadMockMetadata(form.mockApplicationId),
    ])
  }

  async function loadReferences() {
    referenceSummary.value = null
    if (!selectedEnvId.value) return
    referenceLoading.value = true
    try {
      referenceSummary.value = await configApi.getSettingsEnvReferences(options.workspaceCode(), selectedEnvId.value)
    } catch {
      referenceSummary.value = null
    } finally {
      referenceLoading.value = false
    }
  }

  async function loadMockReleases(applicationId: number | null) {
    mockReleases.value = []
    if (!applicationId) return
    try {
      mockReleases.value = await configApi.getMockReleases(options.workspaceCode(), applicationId)
    } catch {
      mockReleases.value = []
    }
  }

  async function loadMockMetadata(applicationId: number | null) {
    mockEndpointCount.value = null
    mockScenarioCount.value = null
    mockUnmatched24hCount.value = null
    mockReferenceCount.value = null
    if (!applicationId) return
    try {
      const [endpointPage, logPage, references] = await Promise.all([
        configApi.getMockEndpoints(options.workspaceCode(), { appId: applicationId, status: 1 }),
        configApi.getMockCallLogs(options.workspaceCode(), { appId: applicationId }),
        configApi.getMockApplicationReferences(options.workspaceCode(), applicationId),
      ])
      mockEndpointCount.value = endpointPage.total
      mockReferenceCount.value = references.totalCount
      const scenarioPages = await Promise.all((endpointPage.items || []).map(endpoint => (
        configApi.getMockScenarios(options.workspaceCode(), { endpointId: endpoint.id, status: 1 })
          .catch(() => null)
      )))
      mockScenarioCount.value = scenarioPages.reduce((total, page) => total + (page?.total || 0), 0)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      mockUnmatched24hCount.value = (logPage.items || []).filter(item => (
        !item.matched && (!item.createdAt || new Date(item.createdAt).getTime() >= cutoff)
      )).length
    } catch {
      // Mock 主信息仍可展示；统计能力不可用时使用占位符，不伪造设计稿示例数据。
    }
  }

  async function saveCurrentForm(
    successMessage = '环境配置已保存',
    saveOptions: { reload?: boolean } = {},
  ) {
    if (!selectedEnv.value) return false
    const validationMessage = validateConfigEnvForm(form)
    if (validationMessage) {
      ElMessage.warning(validationMessage)
      return false
    }
    saving.value = true
    try {
      const currentTab = options.activeTab.value
      const updated = await configApi.updateSettingsEnv(
        options.workspaceCode(),
        selectedEnv.value.id,
        buildCreateEnvPayload(form),
      )
      if (saveOptions.reload === false) {
        const index = envs.value.findIndex(item => item.id === updated.id)
        if (index >= 0) envs.value.splice(index, 1, updated)
        else envs.value.push(updated)
        selectedEnvId.value = updated.id
        Object.assign(form, createConfigEnvFormFromItem(updated))
        options.activeTab.value = currentTab
      } else {
        await loadData(updated.id, currentTab)
      }
      ElMessage.success(successMessage)
      return true
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
      return false
    } finally {
      saving.value = false
    }
  }

  async function switchStatus() {
    if (!selectedEnv.value) return
    if (selectedEnv.value.status === 1) {
      await loadReferences()
      disableDialogVisible.value = true
      return
    }
    await submitStatusChange()
  }

  async function submitStatusChange() {
    if (!selectedEnv.value) return
    operating.value = true
    try {
      await toggleConfigEnvStatus(selectedEnv.value, options.workspaceCode())
      await loadData(selectedEnv.value.id)
      disableDialogVisible.value = false
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      operating.value = false
    }
  }

  async function removeEnvironment() {
    if (!selectedEnv.value) return
    const currentId = selectedEnv.value.id
    operating.value = true
    try {
      await deleteConfigEnv(selectedEnv.value, options.workspaceCode())
      await loadData(envs.value.find(item => item.id !== currentId)?.id || null)
      ElMessage.success('环境已删除')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    } finally {
      operating.value = false
    }
  }

  async function copyEnvironment() {
    if (!selectedEnv.value) return
    saving.value = true
    try {
      const payload = buildCreateEnvPayload(form)
      const created = await configApi.createSettingsEnv(options.workspaceCode(), {
        ...payload,
        envName: `副本 - ${form.envName}`,
      })
      await loadData(created.id)
      ElMessage.success('环境副本已创建')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  function editEnvironment() {
    Object.assign(environmentEditor, {
      envName: form.envName,
      envType: form.envType,
      automationType: form.automationType,
      description: form.description,
    })
    environmentDialogMode.value = 'edit'
  }

  function closeEnvironmentDialog() {
    environmentDialogMode.value = null
  }

  async function submitEnvironment() {
    if (!environmentEditor.envName.trim()) {
      ElMessage.warning('请输入环境名称')
      return
    }
    if (environmentDialogMode.value === 'create') {
      const createForm = createDefaultConfigEnvForm(options.workspaceCode())
      Object.assign(createForm, {
        envName: environmentEditor.envName.trim(),
        envType: environmentEditor.envType,
        automationType: environmentEditor.automationType,
        description: environmentEditor.description.trim(),
      })
      saving.value = true
      try {
        const created = await configApi.createSettingsEnv(options.workspaceCode(), buildCreateEnvPayload(createForm))
        await loadData(created.id)
        closeEnvironmentDialog()
        ElMessage.success('环境已创建')
      } catch (error) {
        ElMessage.error(getRequestErrorMessage(error))
      } finally {
        saving.value = false
      }
      return
    }
    const previous = {
      envName: form.envName,
      envType: form.envType,
      automationType: form.automationType,
      description: form.description,
    }
    Object.assign(form, {
      envName: environmentEditor.envName.trim(),
      envType: environmentEditor.envType,
      automationType: environmentEditor.automationType,
      description: environmentEditor.description.trim(),
    })
    const saved = await saveCurrentForm('环境已更新')
    if (saved) closeEnvironmentDialog()
    else Object.assign(form, previous)
  }

  function createEnvironment() {
    Object.assign(environmentEditor, {
      envName: '',
      envType: 'TEST',
      automationType: 'API_WEB_UI',
      description: '',
    })
    environmentDialogMode.value = 'create'
  }

  return {
    closeEnvironmentDialog,
    copyEnvironment,
    createEnvironment,
    disableDialogVisible,
    editEnvironment,
    environmentDialogMode,
    environmentEditor,
    envs,
    errorMessage,
    form,
    loadData,
    loading,
    loadVariableSetVersions,
    mockApplications,
    mockEndpointCount,
    mockReferenceCount,
    mockReleases,
    mockScenarioCount,
    mockUnmatched24hCount,
    operating,
    referenceLoading,
    referenceSummary,
    removeEnvironment,
    saveCurrentForm,
    saving,
    selectedEnv,
    selectedEnvId,
    selectEnv,
    setEnvironmentSelectedHandler,
    submitEnvironment,
    submitStatusChange,
    switchStatus,
    variableSets,
    variableSetVersions,
  }
}
