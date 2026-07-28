import {
  configDbTypeOptions,
  type ConfigStatus,
  type CreateDbConnectionPayload,
  type DbConnectionItem,
} from '@/entities/config'

export type ConfigDbDialogMode = 'create' | 'edit'

export interface ConfigDbForm {
  workspaceCode: string
  connectionName: string
  dbType: string
  driverClassName: string
  host: string
  port: string
  database: string
  username: string
  password: string
  poolMax: number
  timeoutMs: number
  description: string
  status: ConfigStatus
}

export function getDbTypeMeta(dbType: string) {
  return configDbTypeOptions.find((item) => item.value === dbType) ?? configDbTypeOptions[0]
}

export function createDefaultConfigDbForm(workspaceCode = 'ALL'): ConfigDbForm {
  const meta = getDbTypeMeta('MYSQL')
  return {
    workspaceCode,
    connectionName: '',
    dbType: meta.value,
    driverClassName: meta.driver,
    host: '',
    port: meta.port,
    database: '',
    username: '',
    password: '',
    poolMax: 10,
    timeoutMs: 5000,
    description: '',
    status: 1,
  }
}

export function parseJdbcUrl(jdbcUrl: string) {
  const match = jdbcUrl.match(/^jdbc:([^:]+):\/\/([^:/?]+)(?::(\d+))?(?:\/([^?]+))?/)
  return {
    dbType: match?.[1]?.toUpperCase() || 'MYSQL',
    host: match?.[2] || '',
    port: match?.[3] || '',
    database: match?.[4] || '',
  }
}

export function createConfigDbFormFromItem(item: DbConnectionItem): ConfigDbForm {
  const parsed = parseJdbcUrl(item.jdbcUrl)
  const meta = getDbTypeMeta(item.dbType || parsed.dbType)

  return {
    workspaceCode: item.workspaceCode || 'ALL',
    connectionName: item.connectionName,
    dbType: meta.value,
    driverClassName: item.driverClassName ?? meta.driver,
    host: parsed.host,
    port: parsed.port || meta.port,
    database: parsed.database || (meta.value === 'REDIS' ? '0' : ''),
    username: item.username ?? '',
    password: '',
    poolMax: item.poolMax ?? 10,
    timeoutMs: item.timeoutMs ?? 5000,
    description: item.description ?? '',
    status: item.status,
  }
}

export function applyDbTypeDefaults(form: ConfigDbForm, dbType: string) {
  const meta = getDbTypeMeta(dbType)
  form.dbType = meta.value
  form.driverClassName = meta.driver
  form.port = meta.port
  if (meta.value === 'REDIS' && !form.database.trim()) {
    form.database = '0'
  }
}

export function buildJdbcUrl(form: ConfigDbForm) {
  const typeMap: Record<string, string> = {
    MYSQL: 'mysql',
    POSTGRESQL: 'postgresql',
    REDIS: 'redis',
    MONGODB: 'mongodb',
  }
  const type = typeMap[form.dbType] ?? form.dbType.toLowerCase()
  return `jdbc:${type}://${form.host.trim()}:${form.port.trim()}/${form.database.trim()}`
}

export function buildCreateDbConnectionPayload(
  form: ConfigDbForm,
  options: { includePassword: boolean },
): CreateDbConnectionPayload {
  const payload: CreateDbConnectionPayload = {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    connectionName: form.connectionName.trim(),
    dbType: form.dbType,
    driverClassName: form.driverClassName.trim() || null,
    jdbcUrl: buildJdbcUrl(form),
    username: form.username.trim() || null,
    poolMax: form.poolMax,
    timeoutMs: form.timeoutMs,
    description: form.description.trim() || null,
    status: form.status,
  }

  if (options.includePassword) {
    payload.password = form.password || null
  }

  return payload
}

export function validateConfigDbForm(form: ConfigDbForm) {
  if (!form.workspaceCode.trim() || form.workspaceCode.trim().toUpperCase() === 'ALL') {
    return '请填写具体目标空间编码'
  }
  if (!form.connectionName.trim()) {
    return '请输入连接名称'
  }
  if (form.dbType !== 'MYSQL') {
    return '当前后台仅支持 MySQL，其他数据库类型待接入'
  }
  if (!form.host.trim()) {
    return '请输入主机地址'
  }
  if (!form.port.trim()) {
    return '请输入端口'
  }
  if (!/^\d+$/.test(form.port.trim())) {
    return '端口必须是数字'
  }
  if (!form.database.trim()) {
    return '请输入数据库名'
  }
  return ''
}
