import { ElMessage } from 'element-plus'
import { reactive, ref, type ComputedRef, type Ref } from 'vue'

import { configApi, type ParamSetItem } from '@/entities/config'
import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  type ConfigParamForm,
  type WebUiVariableItem,
} from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'

type VariableSetDialogMode = 'create' | 'edit'

interface UseConfigVariableSetActionsOptions {
  activeParam: ComputedRef<ParamSetItem>
  cloneVariable: (variable: WebUiVariableItem) => WebUiVariableItem
  loadParams: (preferredId?: number) => Promise<void>
  saving: Ref<boolean>
  selectGlobalView: () => void
  workspaceCode: ComputedRef<string>
}

export function useConfigVariableSetActions(options: UseConfigVariableSetActionsOptions) {
  const variableSetDialogVisible = ref(false)
  const variableSetDialogMode = ref<VariableSetDialogMode>('create')
  const variableSetError = ref('')
  const variableSetDraft = reactive<ConfigParamForm>(createDefaultConfigParamForm(options.workspaceCode.value))
  const deleteSetVisible = ref(false)
  const deletingSet = ref(false)

  function openCreateVariableSet() {
    variableSetDialogMode.value = 'create'
    variableSetError.value = ''
    Object.assign(variableSetDraft, createDefaultConfigParamForm(options.workspaceCode.value), {
      workspaceCode: options.workspaceCode.value,
      paramType: 'API_VARIABLE_SET',
      variables: [],
    })
    variableSetDialogVisible.value = true
  }

  function openEditVariableSet() {
    variableSetDialogMode.value = 'edit'
    variableSetError.value = ''
    const next = createConfigParamFormFromItem(options.activeParam.value)
    Object.assign(variableSetDraft, next, { variables: next.variables.map(options.cloneVariable) })
    variableSetDialogVisible.value = true
  }

  async function submitVariableSet() {
    if (!variableSetDraft.paramName.trim()) {
      variableSetError.value = '请输入变量集名称'
      return
    }
    if (!options.workspaceCode.value || options.workspaceCode.value === 'ALL') {
      variableSetError.value = '请先选择具体工作区'
      return
    }
    options.saving.value = true
    try {
      const payload = buildCreateParamPayload(variableSetDraft)
      const saved = variableSetDialogMode.value === 'create'
        ? await configApi.createSettingsParam(options.workspaceCode.value, payload)
        : await configApi.updateSettingsParam(
            options.activeParam.value.workspaceCode || options.workspaceCode.value,
            options.activeParam.value.id,
            payload,
          )
      variableSetDialogVisible.value = false
      await options.loadParams(saved.id)
      ElMessage.success(variableSetDialogMode.value === 'create' ? '变量集已创建' : '变量集已更新')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      options.saving.value = false
    }
  }

  async function confirmDeleteVariableSet() {
    if (options.activeParam.value.paramType === 'GLOBAL' || options.activeParam.value.id < 0) return
    deletingSet.value = true
    try {
      await configApi.deleteSettingsParam(
        options.activeParam.value.workspaceCode || options.workspaceCode.value,
        options.activeParam.value.id,
      )
      deleteSetVisible.value = false
      options.selectGlobalView()
      await options.loadParams()
      ElMessage.success('变量集已删除')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      deletingSet.value = false
    }
  }

  return {
    confirmDeleteVariableSet,
    deleteSetVisible,
    deletingSet,
    openCreateVariableSet,
    openEditVariableSet,
    submitVariableSet,
    variableSetDialogMode,
    variableSetDialogVisible,
    variableSetDraft,
    variableSetError,
  }
}
