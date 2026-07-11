import type { ApiAiCaseGenerationOptionPayload, ApiAiGeneratedCaseDraft, ApiRequestConfigInput } from '@/entities/api-automation'

export type RequestContentTab = 'headers' | 'body' | 'params' | 'cookies' | 'auth' | 'pre' | 'post' | 'extractors' | 'tests' | 'settings' | 'cases' | 'definition'
export type BodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'
export type RawBodyType = Extract<BodyType, 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT'>
export type ApiBodyLanguage = 'json' | 'xml' | 'text'
export type BodyJsonViewMode = 'json' | 'schema'
export type DefinitionSchemaViewMode = 'schema' | 'json'
export type ResponseTab = 'body' | 'header' | 'cookies' | 'assertions' | 'console' | 'actualRequest'
export type ApiAiGeneratedCaseStatus = 'generating' | 'pending' | 'accepted' | 'discarded' | 'failed'
export type ApiAiCaseResultFilter = 'all' | 'pending' | 'accepted' | 'discarded'

export interface ApiRequestContentTabItem {
  label: string
  value: RequestContentTab
  count?: number
}

export interface ApiAiCaseGenerationGroup {
  key: string
  label: string
  options: ApiAiCaseGenerationOptionPayload[]
}

export interface ApiAiGeneratedCaseResult {
  id: string
  status: ApiAiGeneratedCaseStatus
  draft: ApiAiGeneratedCaseDraft
  message?: string | null
  runResult?: string | null
  runMessage?: string | null
}

export interface AiCaseGenerationTabState {
  definitionId: number
  workspaceCode: string
  definitionName: string
  method: string
  path: string
  description: string | null
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  results: ApiAiGeneratedCaseResult[]
  generating: boolean
  message: string
  logs: string[]
  abortController?: AbortController | null
}
