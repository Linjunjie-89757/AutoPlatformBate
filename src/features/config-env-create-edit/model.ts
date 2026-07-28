import type { ConfigStatus, CreateEnvPayload, EnvConfigItem } from '@/entities/config'

export type ConfigEnvDialogMode = 'create' | 'edit'
export type ConfigAutomationType = 'API' | 'WEB_UI' | 'APP'
export type ConfigEnvironmentStage = 'DEV' | 'TEST' | 'STAGING' | 'PROD' | 'SANDBOX'

export interface ConfigEnvServiceEndpointForm {
  key: string
  name: string
  baseUrl: string
}

export interface ConfigEnvLocalVariableForm {
  name: string
  value: string
  sensitive: boolean
  description: string
}

export interface ConfigEnvForm {
  workspaceCode: string
  automationType: ConfigAutomationType
  envType: string
  envName: string
  baseUrl: string
  defaultServiceKey: string
  services: ConfigEnvServiceEndpointForm[]
  configJson: string
  description: string
  browserType: 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
  headless: boolean
  defaultTimeoutMs: number
  viewportWidth: number
  viewportHeight: number
  ignoreHttpsErrors: boolean
  defaultVariableSetId: number | null
  variableSetIds: number[]
  localVariables: ConfigEnvLocalVariableForm[]
  mockApplicationId: number | null
  appPlatform: 'ANDROID' | 'IOS'
  appPackage: string
  appActivity: string
  appBundleId: string
  appVersion: string
  appArtifactUrl: string
  deviceType: 'REAL' | 'EMULATOR'
  deviceModel: string
  osVersion: string
  runnerCapability: string
  resetStrategy: 'KEEP' | 'RESET' | 'REINSTALL'
  deepLink: string
  status: ConfigStatus
}

interface WebUiEnvConfig {
  scopeType?: string
  automationType?: string
  envGroup?: string
  description?: string
  defaultServiceKey?: string
  services?: Array<{
    key?: unknown
    name?: unknown
    baseUrl?: unknown
  }>
  sites?: Array<{
    key?: unknown
    name?: unknown
    baseUrl?: unknown
  }>
  browser?: string
  browserType?: string
  headless?: boolean
  defaultTimeoutMs?: number
  viewport?: {
    width?: number
    height?: number
  }
  ignoreHttpsErrors?: boolean
  defaultVariableSetId?: number | null
  variableSetIds?: unknown
  localVariables?: unknown
  mockApplicationId?: number | null
  appProfile?: Record<string, unknown>
}

export function createDefaultConfigEnvForm(workspaceCode = 'ALL'): ConfigEnvForm {
  return {
    workspaceCode,
    automationType: 'API',
    envType: 'TEST',
    envName: '',
    baseUrl: '',
    defaultServiceKey: 'default',
    services: [createDefaultServiceEndpoint()],
    configJson: '',
    description: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    viewportWidth: 1440,
    viewportHeight: 900,
    ignoreHttpsErrors: false,
    defaultVariableSetId: null,
    variableSetIds: [],
    localVariables: [],
    mockApplicationId: null,
    appPlatform: 'ANDROID',
    appPackage: '',
    appActivity: '',
    appBundleId: '',
    appVersion: '',
    appArtifactUrl: '',
    deviceType: 'REAL',
    deviceModel: '',
    osVersion: '',
    runnerCapability: '',
    resetStrategy: 'RESET',
    deepLink: '',
    status: 1,
  }
}

export function createConfigEnvFormFromItem(item: EnvConfigItem): ConfigEnvForm {
  const envConfig = parseEnvConfig(item.configJson)
  const services = normalizeServiceEndpoints(envConfig.services ?? envConfig.sites, item.baseUrl)
  const defaultServiceKey = normalizeDefaultServiceKey(envConfig.defaultServiceKey, services)
  const defaultService = services.find(service => service.key === defaultServiceKey) ?? services[0]
  const appProfile = envConfig.appProfile ?? {}
  const defaultVariableSetId = typeof envConfig.defaultVariableSetId === 'number' ? envConfig.defaultVariableSetId : null
  const variableSetIds = normalizeNumberList(envConfig.variableSetIds)
  if (defaultVariableSetId != null && !variableSetIds.includes(defaultVariableSetId)) {
    variableSetIds.unshift(defaultVariableSetId)
  }
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    automationType: normalizeAutomationType(envConfig.scopeType ?? envConfig.automationType, envConfig, item.envType),
    envType: normalizeEnvGroup(envConfig.envGroup ?? item.envType),
    envName: item.envName,
    baseUrl: defaultService?.baseUrl || item.baseUrl,
    defaultServiceKey,
    services,
    configJson: item.configJson ?? '',
    description: envConfig.description || '',
    browserType: normalizeBrowserType(envConfig.browserType ?? envConfig.browser),
    headless: envConfig.headless !== false,
    defaultTimeoutMs: clampNumber(envConfig.defaultTimeoutMs ?? envConfig.timeoutMs, 1000, 60000, 10000),
    viewportWidth: clampNumber(envConfig.viewport?.width, 320, 7680, 1440),
    viewportHeight: clampNumber(envConfig.viewport?.height, 240, 4320, 900),
    ignoreHttpsErrors: envConfig.ignoreHttpsErrors === true || envConfig.ignoreSsl === true,
    defaultVariableSetId,
    variableSetIds,
    localVariables: normalizeLocalVariables(envConfig.localVariables),
    mockApplicationId: typeof envConfig.mockApplicationId === 'number' ? envConfig.mockApplicationId : null,
    appPlatform: normalizeAppPlatform(appProfile.platform),
    appPackage: normalizeString(appProfile.packageName),
    appActivity: normalizeString(appProfile.activity),
    appBundleId: normalizeString(appProfile.bundleId),
    appVersion: normalizeString(appProfile.version),
    appArtifactUrl: normalizeString(appProfile.artifactUrl),
    deviceType: appProfile.deviceType === 'EMULATOR' ? 'EMULATOR' : 'REAL',
    deviceModel: normalizeString(appProfile.deviceModel),
    osVersion: normalizeString(appProfile.osVersion),
    runnerCapability: normalizeString(appProfile.runnerCapability),
    resetStrategy: normalizeResetStrategy(appProfile.resetStrategy),
    deepLink: normalizeString(appProfile.deepLink),
    status: item.status,
  }
}

export function buildCreateEnvPayload(form: ConfigEnvForm): CreateEnvPayload {
  const services = normalizeServiceEndpoints(form.services, form.baseUrl)
  const defaultServiceKey = normalizeDefaultServiceKey(form.defaultServiceKey, services)
  const defaultService = services.find(service => service.key === defaultServiceKey) ?? services[0]
  const configJson = JSON.stringify({
    scopeType: form.automationType,
    envGroup: normalizeEnvGroup(form.envType),
    description: form.description.trim(),
    defaultServiceKey,
    services,
    sites: form.automationType === 'WEB_UI' ? services : undefined,
    browserType: form.browserType,
    headless: form.headless,
    viewport: {
      width: clampNumber(form.viewportWidth, 320, 7680, 1440),
      height: clampNumber(form.viewportHeight, 240, 4320, 900),
    },
    timeoutMs: clampNumber(form.defaultTimeoutMs, 1000, 60000, 10000),
    ignoreSsl: form.ignoreHttpsErrors,
    defaultVariableSetId: form.variableSetIds[0] ?? null,
    variableSetIds: Array.from(new Set(form.variableSetIds)),
    localVariables: form.localVariables
      .map(variable => ({
        name: variable.name.trim(),
        value: variable.value,
        sensitive: variable.sensitive,
        description: variable.description.trim(),
      }))
      .filter(variable => variable.name),
    mockApplicationId: form.mockApplicationId,
    appProfile: form.automationType === 'APP'
      ? {
          platform: form.appPlatform,
          packageName: form.appPackage.trim(),
          activity: form.appActivity.trim(),
          bundleId: form.appBundleId.trim(),
          version: form.appVersion.trim(),
          artifactUrl: form.appArtifactUrl.trim(),
          deviceType: form.deviceType,
          deviceModel: form.deviceModel.trim(),
          osVersion: form.osVersion.trim(),
          runnerCapability: form.runnerCapability.trim(),
          resetStrategy: form.resetStrategy,
          deepLink: form.deepLink.trim(),
        }
      : undefined,
  })

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    envType: normalizeEnvGroup(form.envType),
    envName: form.envName.trim(),
    baseUrl: defaultService?.baseUrl.trim() || form.baseUrl.trim(),
    configJson,
    status: form.status,
  }
}

export function validateConfigEnvForm(form: ConfigEnvForm) {
  if (!form.envName.trim()) {
    return '请输入环境名称'
  }
  if (form.automationType === 'APP') {
    if (form.appPlatform === 'ANDROID' && !form.appPackage.trim()) return '请输入 Android Package'
    if (form.appPlatform === 'IOS' && !form.appBundleId.trim()) return '请输入 iOS Bundle ID'
    return validateLocalVariables(form.localVariables)
  }
  const services = normalizeServiceEndpoints(form.services, form.baseUrl)
  if (!services.some(service => service.baseUrl)) {
    return form.automationType === 'WEB_UI' ? '请至少配置一个站点地址' : '请至少配置一个服务地址'
  }
  const serviceKeys = new Set<string>()
  for (const service of services) {
    if (!service.key.trim()) {
      return '请输入服务标识'
    }
    if (serviceKeys.has(service.key)) {
      return '服务标识不能重复'
    }
    serviceKeys.add(service.key)
    if (!/^https?:\/\//i.test(service.baseUrl)) {
      return '服务地址必须以 http:// 或 https:// 开头'
    }
  }
  return validateLocalVariables(form.localVariables)
}

export function validateConfigEnvCreateForm(form: ConfigEnvForm) {
  if (!form.workspaceCode.trim() || form.workspaceCode === 'ALL') return '请选择具体目标空间'
  if (!form.envName.trim()) return '请输入环境名称'
  return ''
}

function parseEnvConfig(configJson: string): WebUiEnvConfig & {
  timeoutMs?: number
  ignoreSsl?: boolean
} {
  if (!configJson?.trim()) {
    return {}
  }
  try {
    return JSON.parse(configJson) as WebUiEnvConfig & {
      timeoutMs?: number
      ignoreSsl?: boolean
    }
  } catch {
    return { description: configJson.trim() }
  }
}

function normalizeBrowserType(value: unknown): ConfigEnvForm['browserType'] {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'FIREFOX' || normalized === 'WEBKIT') {
    return normalized
  }
  return 'CHROMIUM'
}

function normalizeEnvGroup(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'DEV' || normalized === 'STAGING' || normalized === 'PROD' || normalized === 'SANDBOX') {
    return normalized
  }
  return 'TEST'
}

function normalizeAutomationType(value: unknown, config: WebUiEnvConfig, legacyEnvType?: string): ConfigAutomationType {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'WEB_UI' || normalized === 'APP') return normalized
  const normalizedLegacyType = normalizeString(legacyEnvType).toUpperCase()
  if (normalizedLegacyType === 'APP') return 'APP'
  if (normalizedLegacyType === 'WEB' || normalizedLegacyType === 'WEB_UI') return 'WEB_UI'
  if (config.appProfile) return 'APP'
  if (config.browser || config.browserType || config.viewport) return 'WEB_UI'
  return 'API'
}

function normalizeAppPlatform(value: unknown): ConfigEnvForm['appPlatform'] {
  return normalizeString(value).toUpperCase() === 'IOS' ? 'IOS' : 'ANDROID'
}

function normalizeResetStrategy(value: unknown): ConfigEnvForm['resetStrategy'] {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'KEEP' || normalized === 'REINSTALL') return normalized
  return 'RESET'
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumberList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))))
}

function normalizeLocalVariables(value: unknown): ConfigEnvLocalVariableForm[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => ({
      name: normalizeString(item.name),
      value: normalizeString(item.value),
      sensitive: item.sensitive === true,
      description: normalizeString(item.description),
    }))
    .filter(item => item.name)
}

function validateLocalVariables(variables: ConfigEnvLocalVariableForm[]) {
  const names = new Set<string>()
  for (const variable of variables) {
    const name = variable.name.trim()
    if (!name) return '局部变量名不能为空'
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) return `局部变量名 ${name} 格式不正确`
    const key = name.toUpperCase()
    if (names.has(key)) return `局部变量名 ${name} 重复`
    names.add(key)
  }
  return ''
}

function normalizeServiceEndpoints(value: unknown, fallbackBaseUrl: string) {
  const endpoints = Array.isArray(value)
    ? value
      .filter((item): item is { key?: unknown; name?: unknown; baseUrl?: unknown } => typeof item === 'object' && item !== null)
      .map((item, index) => ({
        key: normalizeServiceKey(item.key, index),
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : normalizeServiceKey(item.key, index),
        baseUrl: typeof item.baseUrl === 'string' ? item.baseUrl.trim() : '',
      }))
      .filter(item => item.key && item.baseUrl)
    : []

  if (endpoints.length > 0) {
    return endpoints
  }

  return [{
    ...createDefaultServiceEndpoint(),
    baseUrl: fallbackBaseUrl.trim(),
  }]
}

function normalizeDefaultServiceKey(value: unknown, services: ConfigEnvServiceEndpointForm[]) {
  const key = typeof value === 'string' ? value.trim() : ''
  if (key && services.some(service => service.key === key)) {
    return key
  }
  return services[0]?.key ?? 'default'
}

function normalizeServiceKey(value: unknown, index: number) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || (index === 0 ? 'default' : `service-${index + 1}`)
}

export function createDefaultServiceEndpoint(): ConfigEnvServiceEndpointForm {
  return {
    key: 'default',
    name: '默认服务',
    baseUrl: '',
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(max, Math.max(min, numberValue))
}
