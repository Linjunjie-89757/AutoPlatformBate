import type { ConfigAutomationType, ConfigEnvLocalVariableForm } from '@/features/config-env-create-edit'

export type EnvironmentDetailTab = 'services' | 'variables' | 'mock' | 'effective' | 'references'

export interface EnvironmentStageMeta {
  label: string
  color: string
  background: string
}

export interface EnvironmentCardSummary {
  stage: EnvironmentStageMeta
  services: number
  variableSets: number
  issues: number
  mockEnabled: boolean
}

export type ServiceTestState = 'untested' | 'testing' | 'success' | 'failed' | 'timeout'

export interface ServiceEditorForm {
  key: string
  name: string
  baseUrl: string
  timeoutMs: number
  enabled: boolean
  isDefault: boolean
}

export interface EnvironmentEditorForm {
  envName: string
  envType: string
  automationType: ConfigAutomationType
  description: string
}

export interface LocalVariableEditorForm {
  name: string
  value: string
  valueType: NonNullable<ConfigEnvLocalVariableForm['valueType']>
  sensitive: boolean
  description: string
  enabled: boolean
}

export type ReferenceKind = 'api-scenario' | 'api-suite' | 'web-ui' | 'scheduled'

export interface ReferenceViewItem {
  key: string
  kind: ReferenceKind
  typeLabel: string
  sourceType: string
  sourceId: number | null
  name: string
  lastRun: string
  status: 'running' | 'idle' | 'unknown'
}

export type EffectiveVariableSourceType = 'local' | 'variable-set' | 'workspace'

export interface EffectiveVariableRow {
  name: string
  value: string
  rawValue: string
  source: string
  sourceType: EffectiveVariableSourceType
  overriddenSource: string | null
  description: string
  sensitive: boolean
  ok: boolean
  order: number
}
