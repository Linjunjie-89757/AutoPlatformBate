import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import type { ParamSetItem } from '@/entities/config'
import type { ConfigEnvForm, ConfigEnvLocalVariableForm } from '@/features/config-env-create-edit'

import { createLocalVariableEditor } from './configEnvironmentPanel.view'

type SaveCurrentForm = (successMessage?: string, options?: { reload?: boolean }) => Promise<boolean>

export function useConfigEnvironmentVariableActions(
  form: ConfigEnvForm,
  saveCurrentForm: SaveCurrentForm,
  loadVariableSetVersions: () => Promise<void>,
  isVariableSetEnabled: (item: ParamSetItem) => boolean,
) {
  const bindVariableSetVisible = ref(false)
  const bindVariableSetSelection = ref<number[]>([])
  const priorityDialogVisible = ref(false)
  const priorityDraft = ref<number[]>([])
  const localVariableDialogMode = ref<'create' | 'edit' | null>(null)
  const localVariableEditingIndex = ref<number | null>(null)
  const deleteLocalVariableIndex = ref<number | null>(null)
  const localVariableEditor = reactive(createLocalVariableEditor())

  function openBindVariableSetDialog() {
    bindVariableSetSelection.value = []
    bindVariableSetVisible.value = true
    void loadVariableSetVersions()
  }

  function toggleVariableSetSelection(id: number) {
    bindVariableSetSelection.value = bindVariableSetSelection.value.includes(id)
      ? bindVariableSetSelection.value.filter(item => item !== id)
      : [...bindVariableSetSelection.value, id]
  }

  async function bindSelectedVariableSets() {
    if (!bindVariableSetSelection.value.length) return
    const previous = [...form.variableSetIds]
    form.variableSetIds = Array.from(new Set([...form.variableSetIds, ...bindVariableSetSelection.value]))
    const saved = await saveCurrentForm('变量集已绑定')
    if (saved) bindVariableSetVisible.value = false
    else form.variableSetIds = previous
  }

  function openPriorityDialog() {
    priorityDraft.value = [...form.variableSetIds]
    priorityDialogVisible.value = true
  }

  function movePriorityDraft(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= priorityDraft.value.length) return
    const next = [...priorityDraft.value]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    priorityDraft.value = next
  }

  async function saveVariableSetPriority() {
    const previous = [...form.variableSetIds]
    form.variableSetIds = [...priorityDraft.value]
    const saved = await saveCurrentForm('变量集优先级已保存')
    if (saved) priorityDialogVisible.value = false
    else form.variableSetIds = previous
  }

  async function moveBoundVariableSet(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= form.variableSetIds.length) return
    const previous = [...form.variableSetIds]
    const next = [...form.variableSetIds]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    form.variableSetIds = next
    if (!await saveCurrentForm('变量集优先级已更新')) form.variableSetIds = previous
  }

  async function toggleVariableSetEnabled(item: ParamSetItem) {
    const previous = [...form.disabledVariableSetIds]
    form.disabledVariableSetIds = isVariableSetEnabled(item)
      ? [...form.disabledVariableSetIds, item.id]
      : form.disabledVariableSetIds.filter(id => id !== item.id)
    if (!await saveCurrentForm(isVariableSetEnabled(item) ? '变量集已启用' : '变量集已停用')) {
      form.disabledVariableSetIds = previous
    }
  }

  async function unbindVariableSet(item: ParamSetItem) {
    const previousIds = [...form.variableSetIds]
    const previousDisabledIds = [...form.disabledVariableSetIds]
    form.variableSetIds = form.variableSetIds.filter(id => id !== item.id)
    form.disabledVariableSetIds = form.disabledVariableSetIds.filter(id => id !== item.id)
    if (!await saveCurrentForm('变量集已解除绑定')) {
      form.variableSetIds = previousIds
      form.disabledVariableSetIds = previousDisabledIds
    }
  }

  function openLocalVariableDialog(index?: number) {
    const variable = index == null ? undefined : form.localVariables[index]
    localVariableEditingIndex.value = index ?? null
    Object.assign(localVariableEditor, createLocalVariableEditor(variable))
    localVariableDialogMode.value = variable ? 'edit' : 'create'
  }

  function closeLocalVariableDialog() {
    localVariableDialogMode.value = null
    localVariableEditingIndex.value = null
  }

  function syncLocalVariableType() {
    if (localVariableEditor.valueType === 'secret') localVariableEditor.sensitive = true
  }

  function validateLocalVariableEditor() {
    const name = localVariableEditor.name.trim()
    if (!name) return '请输入变量名'
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) return '变量名格式不正确'
    const duplicate = form.localVariables.some((variable, index) => (
      index !== localVariableEditingIndex.value && variable.name.trim().toUpperCase() === name.toUpperCase()
    ))
    return duplicate ? `变量名 ${name} 已存在` : ''
  }

  async function submitLocalVariable() {
    const validationMessage = validateLocalVariableEditor()
    if (validationMessage) {
      ElMessage.warning(validationMessage)
      return
    }
    const previous = form.localVariables.map(variable => ({ ...variable }))
    const variable: ConfigEnvLocalVariableForm = {
      name: localVariableEditor.name.trim(),
      value: localVariableEditor.value,
      valueType: localVariableEditor.valueType,
      sensitive: localVariableEditor.sensitive || localVariableEditor.valueType === 'secret',
      description: localVariableEditor.description.trim(),
      enabled: localVariableEditor.enabled,
    }
    if (localVariableEditingIndex.value == null) form.localVariables.push(variable)
    else form.localVariables.splice(localVariableEditingIndex.value, 1, variable)
    const saved = await saveCurrentForm(localVariableEditingIndex.value == null ? '局部变量已添加' : '局部变量已更新')
    if (saved) closeLocalVariableDialog()
    else form.localVariables = previous
  }

  async function toggleLocalVariable(index: number) {
    const variable = form.localVariables[index]
    if (!variable) return
    const previous = variable.enabled !== false
    variable.enabled = !previous
    if (!await saveCurrentForm(variable.enabled ? '局部变量已启用' : '局部变量已停用')) variable.enabled = previous
  }

  function requestDeleteLocalVariable(index: number) {
    deleteLocalVariableIndex.value = index
  }

  async function confirmDeleteLocalVariable() {
    if (deleteLocalVariableIndex.value == null) return
    const previous = form.localVariables.map(variable => ({ ...variable }))
    form.localVariables.splice(deleteLocalVariableIndex.value, 1)
    const saved = await saveCurrentForm('局部变量已删除')
    if (saved) deleteLocalVariableIndex.value = null
    else form.localVariables = previous
  }

  return {
    bindVariableSetVisible,
    bindVariableSetSelection,
    priorityDialogVisible,
    priorityDraft,
    localVariableDialogMode,
    deleteLocalVariableIndex,
    localVariableEditor,
    openBindVariableSetDialog,
    toggleVariableSetSelection,
    bindSelectedVariableSets,
    openPriorityDialog,
    movePriorityDraft,
    saveVariableSetPriority,
    moveBoundVariableSet,
    toggleVariableSetEnabled,
    unbindVariableSet,
    openLocalVariableDialog,
    closeLocalVariableDialog,
    syncLocalVariableType,
    submitLocalVariable,
    toggleLocalVariable,
    requestDeleteLocalVariable,
    confirmDeleteLocalVariable,
  }
}
