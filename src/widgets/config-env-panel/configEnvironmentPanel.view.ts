import {
  parseParamContent,
  type ConfigReferenceItem,
  type EnvConfigItem,
  type ParamSetItem,
} from '@/entities/config'
import {
  createConfigEnvFormFromItem,
  createDefaultServiceEndpoint,
  type ConfigEnvForm,
  type ConfigEnvLocalVariableForm,
  type ConfigEnvServiceEndpointForm,
} from '@/features/config-env-create-edit'
import { parseWebUiVariables, type WebUiVariableItem } from '@/features/config-param-create-edit'

import type {
  EffectiveVariableRow,
  EffectiveVariableSourceType,
  EnvironmentCardSummary,
  EnvironmentStageMeta,
  LocalVariableEditorForm,
  ReferenceKind,
  ReferenceViewItem,
  ServiceEditorForm,
} from './configEnvironmentPanel.types'

interface RuntimeReferenceState {
  running?: boolean
  status?: string | null
  executionStatus?: string | null
}

export const environmentStageMeta: Record<string, EnvironmentStageMeta> = {
  DEV: { label: '开发', color: '#4e5969', background: '#f2f3f5' },
  TEST: { label: '测试', color: '#165dff', background: '#e8f3ff' },
  STAGING: { label: '预发布', color: '#7816ff', background: '#f5e8ff' },
  PROD: { label: '生产', color: '#f53f3f', background: '#ffe8e8' },
  SANDBOX: { label: '沙箱', color: '#0fc6c2', background: '#e8fffe' },
}

export function createServiceEditor(service?: ConfigEnvServiceEndpointForm, isDefault = false): ServiceEditorForm {
  const initial = service || createDefaultServiceEndpoint()
  return {
    key: initial.key,
    name: service?.name || '',
    baseUrl: service?.baseUrl || '',
    timeoutMs: service?.timeoutMs || 30000,
    enabled: service?.enabled !== false,
    isDefault,
  }
}

export function createLocalVariableEditor(variable?: ConfigEnvLocalVariableForm): LocalVariableEditorForm {
  const valueType = variable?.valueType || (variable?.sensitive ? 'secret' : 'string')
  return {
    name: variable?.name || '',
    value: variable?.value || '',
    valueType,
    sensitive: variable?.sensitive === true || valueType === 'secret',
    description: variable?.description || '',
    enabled: variable?.enabled !== false,
  }
}

export function paramSetVariables(item: ParamSetItem): WebUiVariableItem[] {
  const variables = parseWebUiVariables(item.contentJson)
  if (variables.length) return variables
  const legacy = parseParamContent(item.contentJson)
  if (!item.paramName.trim() || !legacy.value) return []
  return [{
    name: item.paramName,
    value: legacy.value,
    sensitive: legacy.sensitive,
    description: legacy.description,
    enabled: true,
  }]
}

export function buildEffectiveVariables(
  form: ConfigEnvForm,
  variableSets: ParamSetItem[],
  selectedVariableSets: ParamSetItem[],
): EffectiveVariableRow[] {
  const variableAppliesToEnvironment = (item: WebUiVariableItem) => {
    if (item.enabled === false) return false
    const stage = item.stageType || 'COMMON'
    if (stage !== 'COMMON' && stage !== form.envType) return false
    const scope = item.scopeType || 'ALL'
    if (scope === 'ALL') return true
    if (form.automationType === 'API_WEB_UI') return scope === 'API' || scope === 'WEB_UI'
    return scope === form.automationType
  }

  const resolvedRows = new Map<string, EffectiveVariableRow>()
  let order = 0
  const put = (
    variable: Pick<WebUiVariableItem, 'name' | 'value' | 'sensitive'>,
    source: string,
    sourceType: EffectiveVariableSourceType,
  ) => {
    const name = variable.name.trim()
    if (!name) return
    const key = name.toUpperCase()
    const previous = resolvedRows.get(key)
    resolvedRows.set(key, {
      name,
      value: variable.value,
      rawValue: variable.value,
      source,
      sourceType,
      overriddenSource: previous && previous.source !== source ? previous.source : null,
      description: '',
      sensitive: variable.sensitive,
      ok: true,
      order: order++,
    })
  }

  variableSets
    .filter(item => item.paramType === 'GLOBAL' && item.status === 1)
    .forEach(item => paramSetVariables(item).filter(variableAppliesToEnvironment).forEach(variable => (
      put(variable, '工作区全局变量', 'workspace')
    )))

  ;[...selectedVariableSets]
    .reverse()
    .filter(item => !form.disabledVariableSetIds.includes(item.id))
    .forEach(item => paramSetVariables(item).filter(variableAppliesToEnvironment).forEach(variable => (
      put(variable, item.paramName, 'variable-set')
    )))

  form.localVariables
    .filter(item => item.enabled !== false)
    .forEach(variable => put(variable, '环境局部覆盖', 'local'))

  const referencePattern = /\{\{\s*([\w.-]+)\s*}}|\$\{\s*([\w.-]+)\s*}/g
  const resolveValue = (row: EffectiveVariableRow, stack = new Set<string>()): { value: string; unresolved: string[] } => {
    const key = row.name.toUpperCase()
    if (stack.has(key)) return { value: row.rawValue, unresolved: [row.name] }
    const nextStack = new Set(stack)
    nextStack.add(key)
    const unresolved: string[] = []
    const value = row.rawValue.replace(referencePattern, (token, first: string | undefined, second: string | undefined) => {
      const reference = first || second || ''
      const target = resolvedRows.get(reference.toUpperCase())
      if (!target) {
        unresolved.push(token)
        return token
      }
      const nested = resolveValue(target, nextStack)
      unresolved.push(...nested.unresolved)
      return nested.value
    })
    return { value, unresolved: Array.from(new Set(unresolved)) }
  }

  const sourceRank: Record<EffectiveVariableSourceType, number> = {
    local: 0,
    'variable-set': 1,
    workspace: 2,
  }
  return Array.from(resolvedRows.values())
    .map(row => {
      const resolution = resolveValue(row)
      const unresolved = resolution.unresolved
      const overrideDescription = row.overriddenSource
        ? row.sourceType === 'local'
          ? '局部变量覆盖了变量集或全局配置中的同名变量'
          : `按变量集优先级覆盖了 ${row.overriddenSource} 中的同名变量`
        : ''
      return {
        ...row,
        value: row.sensitive ? '••••••••' : unresolved.length ? '—' : resolution.value,
        description: unresolved.length
          ? `引用了无法解析的变量 ${unresolved.join('、')}`
          : row.sensitive
            ? '敏感变量，已脱敏'
            : overrideDescription || '—',
        ok: unresolved.length === 0,
      }
    })
    .sort((left, right) => sourceRank[left.sourceType] - sourceRank[right.sourceType] || left.order - right.order)
}

export function variableSetScopeLabel(item: ParamSetItem) {
  const labels: Record<string, string> = {
    BUSINESS: '通用',
    API_VARIABLE_SET: '接口自动化',
    WEB_UI_VARIABLE_SET: 'Web UI',
    APP_UI_VARIABLE_SET: 'APP 自动化',
    PAYMENT_CHANNEL: '支付渠道',
  }
  return labels[item.paramType] || item.workspaceName || '当前工作区'
}

export function variableSetHasSensitive(item: ParamSetItem) {
  return parseWebUiVariables(item.contentJson).some(variable => variable.sensitive)
}

export function calculateConfigIssues(target: ConfigEnvForm) {
  let issues = 0
  if (!target.services.length) issues += 1
  if (target.services.some(service => !service.name.trim() || !service.baseUrl.trim())) issues += 1
  if ((target.mockApplicationId || target.mockReleaseId) && (!target.mockApplicationId || !target.mockReleaseId)) issues += 1
  return issues
}

export function environmentCardSummary(environment: EnvConfigItem): EnvironmentCardSummary {
  const form = createConfigEnvFormFromItem(environment)
  return {
    stage: environmentStageMeta[form.envType] || environmentStageMeta.TEST,
    services: form.services.filter(service => service.baseUrl).length,
    variableSets: form.variableSetIds.length,
    issues: calculateConfigIssues(form),
    mockEnabled: Boolean(form.mockApplicationId && form.mockReleaseId),
  }
}

export function referenceKind(sourceType: string): ReferenceKind {
  const normalized = sourceType.toLowerCase()
  if (normalized.includes('web ui') || normalized.includes('webui')) return 'web-ui'
  if (normalized.includes('定时') || normalized.includes('任务')) return 'scheduled'
  if (normalized.includes('套件')) return 'api-suite'
  return 'api-scenario'
}

export function referenceRuntimeStatus(item: ConfigReferenceItem): ReferenceViewItem['status'] {
  const runtime = item as ConfigReferenceItem & RuntimeReferenceState
  const status = String(runtime.executionStatus || runtime.status || '').toUpperCase()
  if (runtime.running === true || status === 'RUNNING' || status === 'EXECUTING' || status === 'IN_PROGRESS') return 'running'
  if (runtime.running === false || status === 'IDLE' || status === 'COMPLETED' || status === 'SUCCESS' || status === 'FAILED') return 'idle'
  return 'unknown'
}

export function formatReferenceTime(value: string | null) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

export function buildReferenceRows(items: ConfigReferenceItem[]): ReferenceViewItem[] {
  return items.map((item, index) => {
    const kind = referenceKind(item.sourceType)
    const labels: Record<ReferenceKind, string> = {
      'api-scenario': '接口场景',
      'api-suite': '接口套件',
      'web-ui': 'Web UI',
      scheduled: '定时任务',
    }
    return {
      key: `${item.sourceType}-${item.sourceId ?? index}-${index}`,
      kind,
      typeLabel: labels[kind],
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      name: item.sourceName || '未命名引用',
      lastRun: formatReferenceTime(item.updatedAt),
      status: referenceRuntimeStatus(item),
    }
  })
}
