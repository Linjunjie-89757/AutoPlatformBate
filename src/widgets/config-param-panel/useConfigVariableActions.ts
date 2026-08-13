import { ElMessage } from 'element-plus'
import { reactive, ref, type ComputedRef } from 'vue'

import { createDefaultWebUiVariable, type WebUiVariableItem } from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'

type VariableType = NonNullable<WebUiVariableItem['valueType']>

interface UseConfigVariableActionsOptions {
  activeVariables: ComputedRef<WebUiVariableItem[]>
  cloneVariable: (variable: WebUiVariableItem) => WebUiVariableItem
  effectiveVariableType: (variable: WebUiVariableItem) => VariableType
  persistActive: (successMessage?: string) => Promise<boolean>
}

export function useConfigVariableActions(options: UseConfigVariableActionsOptions) {
  const revealedVariables = ref(new Set<string>())
  const variableDialogVisible = ref(false)
  const editingVariableIndex = ref(-1)
  const variableError = ref('')
  const variableDraft = reactive<WebUiVariableItem>(createDefaultWebUiVariable())

  function resetRevealedVariables() {
    revealedVariables.value = new Set()
  }

  function toggleReveal(variable: WebUiVariableItem) {
    const next = new Set(revealedVariables.value)
    if (next.has(variable.name)) next.delete(variable.name)
    else next.add(variable.name)
    revealedVariables.value = next
  }

  function displayedVariableValue(variable: WebUiVariableItem) {
    if (options.effectiveVariableType(variable) === 'SECRET' && !revealedVariables.value.has(variable.name)) {
      return '••••••••••••'
    }
    return variable.value || '—'
  }

  function validateVariable(variable: WebUiVariableItem, editingIndex = -1) {
    const name = variable.name.trim()
    if (!name) return '请输入变量名'
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return '变量名只能包含字母、数字、下划线，且不能以数字开头'
    const duplicate = options.activeVariables.value.some((item, index) => index !== editingIndex && item.name.toUpperCase() === name.toUpperCase())
    if (duplicate) return `变量名 ${name} 已存在`
    if (options.effectiveVariableType(variable) === 'JSON' && variable.value.trim()) {
      try {
        JSON.parse(variable.value)
      } catch {
        return 'JSON 值格式不正确'
      }
    }
    return ''
  }

  function openAddVariable() {
    editingVariableIndex.value = -1
    variableError.value = ''
    Object.assign(variableDraft, createDefaultWebUiVariable())
    variableDialogVisible.value = true
  }

  function openEditVariable(index: number) {
    const variable = options.activeVariables.value[index]
    if (!variable) return
    editingVariableIndex.value = index
    variableError.value = ''
    Object.assign(variableDraft, options.cloneVariable(variable))
    variableDialogVisible.value = true
  }

  function selectVariableType(type: VariableType) {
    variableDraft.valueType = type
    variableDraft.sensitive = type === 'SECRET'
  }

  async function submitVariable() {
    const error = validateVariable(variableDraft, editingVariableIndex.value)
    if (error) {
      variableError.value = error
      return
    }
    const next = options.cloneVariable(variableDraft)
    next.name = next.name.trim()
    next.description = next.description.trim()
    if (next.valueType === 'SECRET') next.sensitive = true
    if (editingVariableIndex.value >= 0) options.activeVariables.value.splice(editingVariableIndex.value, 1, next)
    else options.activeVariables.value.push(next)
    const saved = await options.persistActive(editingVariableIndex.value >= 0 ? '变量已更新' : '变量已添加')
    if (saved) variableDialogVisible.value = false
  }

  async function toggleVariable(index: number) {
    const row = options.activeVariables.value[index]
    if (!row) return
    const previous = row.enabled !== false
    row.enabled = !previous
    const saved = await options.persistActive(row.enabled ? '变量已启用' : '变量已停用')
    if (!saved) row.enabled = previous
  }

  async function copyVariable(index: number) {
    const source = options.activeVariables.value[index]
    if (!source) return
    const copy = options.cloneVariable(source)
    let suffix = 1
    let nextName = `${source.name}_COPY`
    while (options.activeVariables.value.some(item => item.name.toUpperCase() === nextName.toUpperCase())) {
      suffix += 1
      nextName = `${source.name}_COPY_${suffix}`
    }
    copy.name = nextName
    options.activeVariables.value.splice(index + 1, 0, copy)
    await options.persistActive('变量已复制')
  }

  async function removeVariable(index: number) {
    const row = options.activeVariables.value[index]
    if (!row) return
    try {
      await confirmDelete({
        title: '删除变量',
        message: `确认删除变量「${row.name}」吗？删除后使用该变量的测试可能受到影响。`,
        confirmText: '确认删除',
      })
      const removed = options.activeVariables.value.splice(index, 1)[0]
      const saved = await options.persistActive('变量已删除')
      if (!saved && removed) options.activeVariables.value.splice(index, 0, removed)
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    }
  }

  return {
    displayedVariableValue,
    editingVariableIndex,
    openAddVariable,
    openEditVariable,
    removeVariable,
    resetRevealedVariables,
    revealedVariables,
    selectVariableType,
    submitVariable,
    toggleReveal,
    toggleVariable,
    copyVariable,
    variableDialogVisible,
    variableDraft,
    variableError,
  }
}
