import { ElMessage } from 'element-plus'
import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'

import {
  configApi,
  type CreateMockScenarioPayload,
  type MockScenarioItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'

type DialogMode = 'create' | 'edit'
type ScenarioEditorTab = 'match' | 'response' | 'variables'
type MatchMode = 'simple' | 'advanced'

interface MatchRuleRow {
  source: string
  field: string
  operator: string
  value: string
}

interface HeaderRow {
  key: string
  value: string
}

interface UseConfigMockScenarioActionsOptions {
  activeAppId: Ref<number | null>
  activeEndpointId: Ref<number | null>
  activeScenarioId: Ref<number | null>
  loadAll: () => Promise<void>
  saving: Ref<boolean>
  workspaceCode: ComputedRef<string>
}

function formatJsonSource(value: string, fallback: string) {
  const source = value || fallback
  try {
    return JSON.stringify(JSON.parse(source), null, 2)
  } catch {
    return source
  }
}

function validateJson(text: string, label: string) {
  try {
    JSON.parse(text || '{}')
    return true
  } catch {
    ElMessage.warning(`${label} 不是合法 JSON`)
    return false
  }
}

export function useConfigMockScenarioActions(options: UseConfigMockScenarioActionsOptions) {
  const scenarioDialogVisible = ref(false)
  const scenarioDialogMode = ref<DialogMode>('create')
  const scenarioEditorTab = ref<ScenarioEditorTab>('match')
  const matchMode = ref<MatchMode>('advanced')
  const matchRuleRows = ref<MatchRuleRow[]>([])
  const responseHeaderRows = ref<HeaderRow[]>([])
  const editingScenarioId = ref<number | null>(null)
  const scenarioForm = reactive<CreateMockScenarioPayload>({
    appId: 0,
    endpointId: 0,
    scenarioName: '',
    priority: 100,
    matchJson: '{}',
    responseStatus: 200,
    responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
    responseBody: '{"success":true}',
    responseDelayMs: 0,
    variablesJson: '{}',
    status: 1,
  })

  const responseStatusOptions = [
    { value: '200', label: '200 OK' },
    { value: '201', label: '201 Created' },
    { value: '204', label: '204 No Content' },
    { value: '400', label: '400 Bad Request' },
    { value: '401', label: '401 Unauthorized' },
    { value: '403', label: '403 Forbidden' },
    { value: '404', label: '404 Not Found' },
    { value: '409', label: '409 Conflict' },
    { value: '422', label: '422 Unprocessable Entity' },
    { value: '500', label: '500 Internal Server Error' },
    { value: '502', label: '502 Bad Gateway' },
    { value: '503', label: '503 Service Unavailable' },
  ]
  const responseStatusModel = computed({
    get: () => String(scenarioForm.responseStatus),
    set: (value: string) => {
      const status = Number(value)
      if (Number.isInteger(status) && status >= 100 && status <= 599) scenarioForm.responseStatus = status
    },
  })
  const responseContentType = computed({
    get: () => responseHeaderRows.value.find(item => item.key.toLowerCase() === 'content-type')?.value || 'application/json',
    set: (value: string) => {
      const row = responseHeaderRows.value.find(item => item.key.toLowerCase() === 'content-type')
      if (row) row.value = value
      else responseHeaderRows.value.unshift({ key: 'Content-Type', value })
    },
  })
  const scenarioVariableRows = computed(() => {
    const rows = new Map<string, { name: string; source: string; value: string; description: string }>()
    try {
      const variables = JSON.parse(scenarioForm.variablesJson || '{}') as Record<string, unknown>
      Object.entries(variables).forEach(([name, value]) => {
        rows.set(name, { name: `{{${name}}}`, source: '场景变量', value: String(value ?? ''), description: '当前场景配置' })
      })
    } catch {
      // JSON 校验由保存流程统一处理。
    }
    const sourceText = `${scenarioForm.matchJson || ''}\n${scenarioForm.responseBody || ''}`
    const matches = sourceText.matchAll(/\{\{\s*([^{}]+?)\s*\}\}|\$\{\s*([^{}]+?)\s*\}/g)
    for (const match of matches) {
      const name = (match[1] || match[2] || '').trim()
      if (!name || rows.has(name)) continue
      const source = name.startsWith('env.')
        ? '环境变量'
        : name.startsWith('request.')
          ? '请求上下文'
          : name.startsWith('ws.')
            ? '工作区变量'
            : '系统内置'
      rows.set(name, { name: match[0], source, value: '运行时解析', description: '响应模板引用' })
    }
    return Array.from(rows.values())
  })

  function hydrateScenarioEditor() {
    matchRuleRows.value = []
    try {
      const parsed = JSON.parse(scenarioForm.matchJson || '{}') as { conditions?: MatchRuleRow[] }
      if (Array.isArray(parsed.conditions)) {
        matchRuleRows.value = parsed.conditions.map(item => ({
          source: item.source || 'Query',
          field: item.field || '',
          operator: item.operator || 'equals',
          value: item.value || '',
        }))
        matchMode.value = 'simple'
      } else matchMode.value = 'advanced'
    } catch {
      matchMode.value = 'advanced'
    }

    responseHeaderRows.value = []
    try {
      const parsedHeaders = JSON.parse(scenarioForm.responseHeadersJson || '{}') as Record<string, unknown>
      responseHeaderRows.value = Object.entries(parsedHeaders).map(([key, value]) => ({ key, value: String(value ?? '') }))
    } catch {
      responseHeaderRows.value = []
    }
    if (!responseHeaderRows.value.length) responseHeaderRows.value.push({ key: 'Content-Type', value: 'application/json' })
  }

  function assignScenarioForm(scenario: MockScenarioItem, name: string) {
    Object.assign(scenarioForm, {
      appId: scenario.appId,
      endpointId: scenario.endpointId,
      scenarioName: name,
      priority: scenario.priority,
      matchJson: formatJsonSource(scenario.matchJson || '{}', '{}'),
      responseStatus: scenario.responseStatus || 200,
      responseHeadersJson: scenario.responseHeadersJson || '{}',
      responseBody: formatJsonSource(scenario.responseBody || '', ''),
      responseDelayMs: scenario.responseDelayMs || 0,
      variablesJson: scenario.variablesJson || '{}',
      status: scenario.status,
    })
    scenarioEditorTab.value = 'match'
    hydrateScenarioEditor()
    scenarioDialogVisible.value = true
  }

  function openCreateScenarioDialog() {
    if (!options.activeAppId.value || !options.activeEndpointId.value) {
      ElMessage.warning('请先选择 Mock 接口')
      return
    }
    scenarioDialogMode.value = 'create'
    editingScenarioId.value = null
    Object.assign(scenarioForm, {
      appId: options.activeAppId.value,
      endpointId: options.activeEndpointId.value,
      scenarioName: '',
      priority: 100,
      matchJson: formatJsonSource('{}', '{}'),
      responseStatus: 200,
      responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
      responseBody: formatJsonSource('{"success":true}', '{"success":true}'),
      responseDelayMs: 0,
      variablesJson: '{}',
      status: 1,
    })
    scenarioEditorTab.value = 'match'
    hydrateScenarioEditor()
    matchMode.value = 'simple'
    scenarioDialogVisible.value = true
  }

  function openEditScenarioDialog(scenario: MockScenarioItem) {
    scenarioDialogMode.value = 'edit'
    editingScenarioId.value = scenario.id
    assignScenarioForm(scenario, scenario.scenarioName)
  }

  function openCopyScenarioDialog(scenario: MockScenarioItem) {
    scenarioDialogMode.value = 'create'
    editingScenarioId.value = null
    assignScenarioForm(scenario, `${scenario.scenarioName} 副本`)
  }

  function addMatchRule() {
    matchRuleRows.value.push({ source: 'Query', field: '', operator: 'equals', value: '' })
  }

  function removeMatchRule(index: number) {
    matchRuleRows.value.splice(index, 1)
  }

  function addResponseHeader() {
    responseHeaderRows.value.push({ key: '', value: '' })
  }

  function removeResponseHeader(index: number) {
    responseHeaderRows.value.splice(index, 1)
  }

  function syncScenarioStructuredFields() {
    if (matchMode.value === 'simple') {
      scenarioForm.matchJson = JSON.stringify({ matchMode: 'all', conditions: matchRuleRows.value }, null, 2)
    }
    scenarioForm.responseHeadersJson = JSON.stringify(
      Object.fromEntries(responseHeaderRows.value.filter(item => item.key.trim()).map(item => [item.key.trim(), item.value])),
      null,
      2,
    )
  }

  async function submitScenario() {
    if (!scenarioForm.scenarioName.trim()) {
      ElMessage.warning('请输入场景名称')
      return
    }
    syncScenarioStructuredFields()
    if (!validateJson(scenarioForm.matchJson || '{}', '匹配规则')) return
    if (!validateJson(scenarioForm.responseHeadersJson || '{}', '响应头')) return
    if (!validateJson(scenarioForm.variablesJson || '{}', '模板变量')) return

    options.saving.value = true
    try {
      const saved = scenarioDialogMode.value === 'edit' && editingScenarioId.value
        ? await configApi.updateMockScenario(options.workspaceCode.value, editingScenarioId.value, scenarioForm)
        : await configApi.createMockScenario(options.workspaceCode.value, scenarioForm)
      ElMessage.success(scenarioDialogMode.value === 'edit' ? 'Mock 场景已更新' : 'Mock 场景已创建')
      options.activeScenarioId.value = saved.id
      scenarioDialogVisible.value = false
      await options.loadAll()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      options.saving.value = false
    }
  }

  async function removeScenario(row: MockScenarioItem) {
    try {
      await confirmDelete({
        title: '删除确认',
        message: `确认删除 Mock 场景「${row.scenarioName}」？相关调用日志也会清理。`,
        confirmText: '确认删除',
      })
      await configApi.deleteMockScenario(options.workspaceCode.value, row.id)
      if (options.activeScenarioId.value === row.id) options.activeScenarioId.value = null
      ElMessage.success('已删除')
      await options.loadAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    }
  }

  return {
    addMatchRule,
    addResponseHeader,
    matchMode,
    matchRuleRows,
    openCopyScenarioDialog,
    openCreateScenarioDialog,
    openEditScenarioDialog,
    removeMatchRule,
    removeResponseHeader,
    removeScenario,
    responseContentType,
    responseHeaderRows,
    responseStatusModel,
    responseStatusOptions,
    scenarioDialogMode,
    scenarioDialogVisible,
    scenarioEditorTab,
    scenarioForm,
    scenarioVariableRows,
    submitScenario,
  }
}
