import {
  parseParamContent,
  type ConfigStatus,
  type CreateParamPayload,
  type ParamSetItem,
} from '@/entities/config'

export type ConfigVariableStage = 'COMMON' | 'DEV' | 'TEST' | 'STAGING' | 'PROD' | 'SANDBOX'
export type ConfigVariableScope = 'API' | 'WEB_UI' | 'APP'

export interface WebUiVariableItem {
  name: string
  value: string
  sensitive: boolean
  description: string
  valueType?: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET'
  scopeType?: 'ALL' | 'API' | 'WEB_UI' | 'APP'
  stageType?: ConfigVariableStage
  enabled?: boolean
}

export interface ConfigParamForm {
  workspaceCode: string
  paramType: string
  paramName: string
  value: string
  description: string
  stageType: ConfigVariableStage
  applicableTypes: ConfigVariableScope[]
  sensitive: boolean
  variables: WebUiVariableItem[]
  status: ConfigStatus
}

export function createDefaultConfigParamForm(workspaceCode = 'ALL'): ConfigParamForm {
  return {
    workspaceCode,
    paramType: 'API_VARIABLE_SET',
    paramName: '',
    value: '',
    description: '',
    stageType: 'COMMON',
    applicableTypes: ['API'],
    sensitive: false,
    variables: [createDefaultWebUiVariable()],
    status: 1,
  }
}

export function createDefaultWebUiVariableSetForm(workspaceCode = 'ALL'): ConfigParamForm {
  return {
    ...createDefaultConfigParamForm(workspaceCode),
    paramType: 'WEB_UI_VARIABLE_SET',
  }
}

export function createConfigParamFormFromItem(item: ParamSetItem): ConfigParamForm {
  const content = parseParamContent(item.contentJson)
  const variables = parseWebUiVariables(item.contentJson)
  const metadata = parseVariableSetMetadata(item.contentJson, item.paramType)
  const variableCollectionDefined = hasVariableCollection(item.contentJson)

  return {
    workspaceCode: item.workspaceCode || 'ALL',
    paramType: item.paramType || 'GLOBAL',
    paramName: item.paramName,
    value: content.value,
    description: metadata.description || content.description,
    stageType: metadata.stageType,
    applicableTypes: metadata.applicableTypes,
    sensitive: content.sensitive,
    variables: variables.length > 0
      ? variables
      : !variableCollectionDefined && content.value
        ? [{
            ...createDefaultWebUiVariable(),
            name: item.paramName || '',
            value: content.value,
            sensitive: content.sensitive,
            description: content.description,
          }]
        : [],
    status: item.status,
  }
}

export function buildCreateParamPayload(form: ConfigParamForm): CreateParamPayload {
  const contentJson = isVariableSetParamType(form.paramType)
    ? JSON.stringify({
        description: form.description.trim(),
        stageType: form.stageType,
        applicableTypes: form.applicableTypes,
        systemBuiltIn: form.paramType === 'GLOBAL',
        variables: form.variables
          .map(variable => ({
            name: variable.name.trim(),
            value: variable.value,
            sensitive: variable.sensitive,
            description: variable.description.trim(),
            valueType: variable.valueType === 'SECRET' ? 'TEXT' : (variable.valueType || 'TEXT'),
            scopeType: variable.scopeType || 'ALL',
            stageType: variable.stageType || 'COMMON',
            enabled: variable.enabled !== false,
          }))
          .filter(variable => variable.name),
      })
    : JSON.stringify({
        value: form.value.trim(),
        description: form.description.trim(),
        sensitive: form.sensitive,
      })

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    paramType: form.paramType,
    paramName: form.paramName.trim(),
    contentJson,
    status: form.status,
  }
}

export function validateConfigParamForm(form: ConfigParamForm) {
  if (!form.workspaceCode.trim() || form.workspaceCode === 'ALL') {
    return '请选择具体目标空间'
  }
  if (!form.paramName.trim()) {
    return '请输入名称'
  }
  if (isVariableSetParamType(form.paramType)) {
    const activeVariables = form.variables.filter(variable => variable.name.trim() || variable.value.trim())
    const names = new Set<string>()
    for (const variable of activeVariables) {
      const name = variable.name.trim()
      if (!name) {
        return '变量名不能为空'
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return `变量名 ${name} 只能包含字母、数字、下划线，且不能以数字开头`
      }

      const upperName = name.toUpperCase()
      if (names.has(upperName)) {
        return `变量名 ${name} 重复`
      }
      names.add(upperName)
    }
    return ''
  }
  if (!form.value.trim()) {
    return '请输入参数值'
  }
  return ''
}

export function createDefaultWebUiVariable(): WebUiVariableItem {
  return {
    name: '',
    value: '',
    sensitive: false,
    description: '',
    valueType: 'TEXT',
    scopeType: 'ALL',
    stageType: 'COMMON',
    enabled: true,
  }
}

export function parseWebUiVariables(contentJson: string): WebUiVariableItem[] {
  const raw = contentJson?.trim()
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const source = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.variables)
        ? parsed.variables
        : []

    return source
      .filter(isRecord)
      .map(item => ({
        name: typeof item.name === 'string' ? item.name : '',
        value: typeof item.value === 'string' ? item.value : '',
        sensitive: item.sensitive === true || item.isSecret === true,
        description: typeof item.description === 'string'
          ? item.description
          : typeof item.desc === 'string'
            ? item.desc
            : '',
        valueType: normalizeVariableValueType(item.valueType),
        scopeType: normalizeVariableScope(item.scopeType),
        stageType: normalizeVariableStage(item.stageType),
        enabled: item.enabled !== false,
      }))
      .filter(item => item.name.trim())
  } catch {
    return []
  }
}

export function parseVariableSetMetadata(contentJson: string, legacyParamType?: string) {
  const raw = contentJson?.trim()
  if (!raw) return { description: '', stageType: 'COMMON' as ConfigVariableStage, applicableTypes: ['API'] as ConfigVariableScope[] }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || Array.isArray(parsed)) {
      return { description: '', stageType: 'COMMON' as ConfigVariableStage, applicableTypes: ['API'] as ConfigVariableScope[] }
    }
    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      stageType: normalizeVariableStage(parsed.stageType),
      applicableTypes: normalizeApplicableTypes(parsed.applicableTypes, legacyParamType),
    }
  } catch {
    return { description: '', stageType: 'COMMON' as ConfigVariableStage, applicableTypes: ['API'] as ConfigVariableScope[] }
  }
}

export function isVariableSetParamType(paramType: string) {
  return ['GLOBAL', 'BUSINESS', 'PAYMENT_CHANNEL', 'WEB_UI_VARIABLE_SET', 'APP_UI_VARIABLE_SET', 'API_VARIABLE_SET'].includes(paramType)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasVariableCollection(contentJson: string) {
  const raw = contentJson?.trim()
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) || (isRecord(parsed) && Array.isArray(parsed.variables))
  } catch {
    return false
  }
}

function normalizeVariableValueType(value: unknown): NonNullable<WebUiVariableItem['valueType']> {
  const normalized = typeof value === 'string' ? value.toUpperCase() : ''
  if (normalized === 'NUMBER' || normalized === 'BOOLEAN' || normalized === 'JSON') return normalized
  return 'TEXT'
}

function normalizeApplicableTypes(value: unknown, legacyParamType?: string): ConfigVariableScope[] {
  const values = Array.isArray(value) ? value : []
  const scopes = values
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.toUpperCase())
    .filter((item): item is ConfigVariableScope => item === 'API' || item === 'WEB_UI' || item === 'APP')
  if (scopes.length) return [...new Set(scopes)]
  if (legacyParamType === 'WEB_UI_VARIABLE_SET') return ['WEB_UI']
  if (legacyParamType === 'APP_UI_VARIABLE_SET') return ['APP']
  return ['API']
}

function normalizeVariableScope(value: unknown): NonNullable<WebUiVariableItem['scopeType']> {
  const normalized = typeof value === 'string' ? value.toUpperCase() : ''
  if (normalized === 'API' || normalized === 'WEB_UI' || normalized === 'APP') return normalized
  return 'ALL'
}

function normalizeVariableStage(value: unknown): ConfigVariableStage {
  const normalized = typeof value === 'string' ? value.toUpperCase() : ''
  if (normalized === 'DEV' || normalized === 'TEST' || normalized === 'STAGING' || normalized === 'PROD' || normalized === 'SANDBOX') {
    return normalized
  }
  return 'COMMON'
}
