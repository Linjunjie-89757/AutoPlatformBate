import type { ApiAiCaseGenerationOptionPayload } from '@/entities/api-automation'
import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import type { ApiAiGeneratedCaseResult } from './apiInterfaceTypes'

export interface ApiAiCaseGenerationSubmitPayload {
  provider: AiProviderConnectionItem
  caseCount: string
  noDuplicate: boolean
  prompt: string
  selectedOptions: ApiAiCaseGenerationOptionPayload[]
}

export interface ApiAiCaseBatchPayload {
  selected: ApiAiGeneratedCaseResult[]
  pending: ApiAiGeneratedCaseResult[]
}
