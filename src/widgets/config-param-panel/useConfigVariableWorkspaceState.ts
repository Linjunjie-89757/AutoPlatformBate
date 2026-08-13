import { ElMessage } from 'element-plus'
import { computed, reactive, ref, type ComputedRef } from 'vue'

import { configApi, type ConfigReferenceSummary, type ParamSetItem } from '@/entities/config'
import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  createDefaultWebUiVariable,
  type ConfigParamForm,
  type WebUiVariableItem,
} from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'

export type ConfigVariableActiveView = 'global' | 'builtin' | number

interface UseConfigVariableWorkspaceStateOptions {
  afterHydrate?: () => void
  workspaceCode: ComputedRef<string>
}

export function useConfigVariableWorkspaceState(options: UseConfigVariableWorkspaceStateOptions) {
  const params = ref<ParamSetItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const activeView = ref<ConfigVariableActiveView>('global')
  const referenceSummary = ref<ConfigReferenceSummary | null>(null)
  const referenceLoading = ref(false)
  const activeForm = reactive<ConfigParamForm>(createDefaultConfigParamForm(options.workspaceCode.value))

  const globalParam = computed<ParamSetItem>(() => {
    const current = params.value.find(item => item.paramType === 'GLOBAL')
    if (current) return current
    return {
      id: -1,
      workspaceCode: options.workspaceCode.value,
      workspaceName: '',
      paramType: 'GLOBAL',
      paramName: '全局变量',
      contentJson: JSON.stringify({ description: '', stageType: 'COMMON', systemBuiltIn: true, variables: [] }),
      status: 1,
    }
  })

  const variableSets = computed(() => params.value.filter(item => item.paramType !== 'GLOBAL'))
  const activeParam = computed<ParamSetItem>(() => {
    if (activeView.value === 'global' || activeView.value === 'builtin') return globalParam.value
    return params.value.find(item => item.id === activeView.value) || globalParam.value
  })
  const isGlobalView = computed(() => activeView.value === 'global')
  const isBuiltinView = computed(() => activeView.value === 'builtin')
  const activeVariables = computed(() => activeForm.variables)

  function cloneVariable(variable: WebUiVariableItem): WebUiVariableItem {
    return { ...createDefaultWebUiVariable(), ...variable }
  }

  function hydrateActiveForm() {
    const next = createConfigParamFormFromItem(activeParam.value)
    Object.assign(activeForm, next, {
      workspaceCode: activeParam.value.workspaceCode || options.workspaceCode.value,
      variables: next.variables.map(cloneVariable),
    })
    options.afterHydrate?.()
  }

  async function loadReferences() {
    referenceSummary.value = null
    if (isGlobalView.value || isBuiltinView.value || activeParam.value.id < 0) return
    referenceLoading.value = true
    try {
      referenceSummary.value = await configApi.getSettingsParamReferences(
        activeParam.value.workspaceCode || options.workspaceCode.value,
        activeParam.value.id,
      )
    } catch {
      referenceSummary.value = null
    } finally {
      referenceLoading.value = false
    }
  }

  async function loadParams(preferredId?: number) {
    loading.value = true
    errorMessage.value = ''
    try {
      const page = await configApi.getSettingsParams(options.workspaceCode.value)
      params.value = page.items || []
      if (preferredId && params.value.some(item => item.id === preferredId && item.paramType !== 'GLOBAL')) {
        activeView.value = preferredId
      } else if (typeof activeView.value === 'number' && !params.value.some(item => item.id === activeView.value)) {
        activeView.value = 'global'
      }
      hydrateActiveForm()
      await loadReferences()
    } catch (error) {
      errorMessage.value = getRequestErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  async function selectView(view: ConfigVariableActiveView) {
    activeView.value = view
    if (view !== 'builtin') hydrateActiveForm()
    await loadReferences()
  }

  async function persistActive(successMessage?: string) {
    saving.value = true
    try {
      if (isGlobalView.value) {
        activeForm.paramName = '全局变量'
        activeForm.paramType = 'GLOBAL'
        activeForm.status = 1
      }
      const payload = buildCreateParamPayload(activeForm)
      const workspaceCode = activeParam.value.workspaceCode || options.workspaceCode.value
      const saved = activeParam.value.id < 0
        ? await configApi.createSettingsParam(workspaceCode, payload)
        : await configApi.updateSettingsParam(workspaceCode, activeParam.value.id, payload)
      const existingIndex = params.value.findIndex(item => item.id === saved.id)
      if (existingIndex >= 0) params.value.splice(existingIndex, 1, saved)
      else params.value.push(saved)
      if (!isGlobalView.value) activeView.value = saved.id
      hydrateActiveForm()
      if (successMessage) ElMessage.success(successMessage)
      return true
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
      return false
    } finally {
      saving.value = false
    }
  }

  function selectGlobalView() {
    activeView.value = 'global'
  }

  async function resetWorkspace() {
    activeView.value = 'global'
    await loadParams()
  }

  return {
    activeForm,
    activeParam,
    activeVariables,
    activeView,
    cloneVariable,
    errorMessage,
    globalParam,
    isBuiltinView,
    isGlobalView,
    loadParams,
    loading,
    persistActive,
    referenceLoading,
    referenceSummary,
    resetWorkspace,
    saving,
    selectGlobalView,
    selectView,
    variableSets,
  }
}
