import type { ConfigCenterTab } from './types'

export const configCenterTabs: Array<{
  id: ConfigCenterTab
  label: string
  description: string
}> = [
  { id: 'env', label: '环境配置', description: '测试环境管理' },
  { id: 'param', label: '变量集', description: '运行参数与敏感变量' },
  { id: 'mock', label: 'Mock 服务', description: '第三方响应模拟' },
  { id: 'runner', label: '本地执行器', description: '本地执行与服务端执行' },
  { id: 'notification', label: '通知配置', description: '失败通知与渠道' },
  { id: 'proxy', label: '网络代理', description: '网络出口与代理' },
  { id: 'dbConnection', label: '数据库连接', description: '数据源配置' },
]

export const configEnvTypeOptions = [
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发' },
  { value: 'PROD', label: '生产' },
  { value: 'SANDBOX', label: '沙箱' },
] as const

export const configStatusOptions = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
] as const

export const configParamTypeOptions = [
  { value: 'GLOBAL', label: '全局公共变量' },
  { value: 'BUSINESS', label: '通用业务变量' },
  { value: 'API_VARIABLE_SET', label: '接口变量' },
  { value: 'WEB_UI_VARIABLE_SET', label: 'Web UI变量' },
  { value: 'APP_UI_VARIABLE_SET', label: 'APP UI变量' },
] as const

export const configDbTypeOptions = [
  { value: 'MYSQL', label: 'MySQL', port: '3306', driver: 'com.mysql.cj.jdbc.Driver' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', port: '5432', driver: 'org.postgresql.Driver' },
  { value: 'REDIS', label: 'Redis', port: '6379', driver: '' },
  { value: 'MONGODB', label: 'MongoDB', port: '27017', driver: '' },
] as const
