export type AiProviderStatus = 0 | 1
export type AiProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'azure'
  | 'xiaomi'
  | 'zhipu'
  | 'kimi'
  | 'minimax'
  | 'ollama'
  | 'custom'

export interface AiProviderConnectionItem {
  id: number
  workspaceCode: string
  workspaceName: string
  providerType?: AiProviderType | null
  connectionName: string
  protocolType: string
  baseUrl: string
  requestTimeoutSeconds: number | null
  modelName: string | null
  apiKeyMasked: string | null
  apiKeyConfigured: boolean
  status: AiProviderStatus
  modelCount: number | null
  lastVerifiedAt: string | null
  lastFetchModelsAt: string | null
  lastTestAt: string | null
  lastTestStatus: 'SUCCESS' | 'FAILED' | null
  lastTestMessage: string | null
}

export interface SaveAiProviderConnectionPayload {
  workspaceCode?: string
  providerType?: AiProviderType
  connectionName: string
  protocolType: string
  baseUrl: string
  requestTimeoutSeconds?: number | null
  modelName?: string | null
  apiKey?: string | null
  status?: AiProviderStatus
}

export interface AiProviderModelItem {
  id: number
  connectionId: number
  modelName: string
  displayName: string | null
  detectedCapabilities: unknown | null
  selectable: boolean
  rawMetadataJson: string | null
  lastProbedAt: string | null
}

export interface AiProviderTestResult {
  success: boolean
  connectionId: number
  connectionName: string
  protocolType: string
  message: string
  verifiedAt: string | null
}

export interface AiProviderSyncModelsResult {
  connectionId: number
  connectionName: string
  models: AiProviderModelItem[]
  fetchedAt: string | null
  message: string | null
}

export interface PreviewAiProviderModelsPayload {
  protocolType: string
  baseUrl: string
  requestTimeoutSeconds?: number | null
  apiKey: string
}

export interface PreviewAiProviderModelsResult {
  models: AiProviderModelItem[]
  fetchedAt: string | null
  message: string | null
}

export interface ProbeAiProviderModelPayload {
  modelName: string
}

export interface UpdateAiProviderModelStatusPayload {
  selectable: boolean
}

export interface UpdateAiProviderStatusPayload extends SaveAiProviderConnectionPayload {
  status: AiProviderStatus
}

export interface AiProviderStat {
  label: string
  value: number | string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
