export interface AiCapabilityValue {
  supported: boolean | null
  source?: string | null
  detail?: string | null
}

export interface AiModelCapabilities {
  textChat?: AiCapabilityValue | null
  streamOutput?: AiCapabilityValue | null
  structuredOutput?: AiCapabilityValue | null
  imageInput?: AiCapabilityValue | null
  longContext?: AiCapabilityValue | null
  stableAvailability?: AiCapabilityValue | null
}

export interface AiCapabilityOverride {
  imageInput?: boolean | null
}

export interface AiCaseConfigItem {
  id: number
  workspaceCode: string
  workspaceName: string
  roleType: string
  providerConnectionId: number | null
  providerConnectionName: string | null
  protocolType: string | null
  provider: string | null
  model: string | null
  baseUrl: string | null
  apiKeyMasked: string | null
  apiKeyConfigured: boolean
  promptTemplate: string | null
  reviewChecklist: string | null
  temperature: number | null
  topP: number | null
  maxCases: number | null
  detectedCapabilities?: AiModelCapabilities | null
  effectiveCapabilities?: AiModelCapabilities | null
  capabilityOverride?: AiCapabilityOverride | null
  supportsImageInput: boolean
  status: number | null
}

export interface AiCaseConfigResponse {
  generatorConfig: AiCaseConfigItem | null
  reviewerConfig: AiCaseConfigItem | null
  hasLegacyConfig: boolean
  canBootstrapFromLegacy: boolean
}

export interface SaveAiCaseConfigPayload {
  workspaceCode?: string
  roleType: 'CASE_GENERATOR' | 'CASE_REVIEWER'
  providerConnectionId?: number | null
  protocolType?: string | null
  provider?: string | null
  model: string
  baseUrl?: string | null
  apiKey?: string | null
  promptTemplate: string
  reviewChecklist?: string | null
  temperature: number
  topP?: number | null
  maxCases?: number | null
  capabilityOverride?: AiCapabilityOverride | null
  supportsImageInput?: boolean | null
  status?: number | null
}

export interface TestAiCaseConfigResponse {
  success: boolean
  provider: string | null
  model: string | null
  message: string
}

export interface AiRequirementAssetItem {
  id: number
  sourceType: string
  fileName: string
  contentType: string | null
  fileSize: number | null
  extractedText: string | null
  downloadUrl: string | null
  createdAt: string | null
}

export interface ImportRequirementDocumentResult {
  fileName: string
  title: string
  content: string
  charCount: number
  assets: AiRequirementAssetItem[]
}

export interface AiInvalidCaseItem {
  index?: number | null
  title?: string | null
  reason?: string | null
}

export interface AiReviewCaseDecision {
  caseIndex: number
  status: string
  summary: string | null
  coverageComment: string | null
  evidenceComment: string | null
  reviewComment: string | null
  optimizationReason?: string | null
  supplementReason?: string | null
  coverageGap?: string | null
}

export interface GeneratedAiCaseItem {
  title: string
  caseType: string | null
  priority: string | null
  precondition: string | null
  steps: string | null
  expectedResult: string | null
  riskNotes?: string | null
  testAngle: string | null
  sceneFocus: string | null
  generationReason: string | null
  requirementEvidence: string | null
  aiSource: string | null
  reviewComment?: string | null
  optimizationReason?: string | null
  supplementReason?: string | null
  coverageGap?: string | null
  originalCaseSnapshot?: GeneratedAiCaseItem | null
  warnings?: string[] | null
  ownerId?: number | null
  ownerName?: string | null
  directoryId?: number | null
  directoryName?: string | null
  workspaceCode?: string | null
  workspaceName?: string | null
  tags?: string[] | null
  aiReviewStatus?: string | null
  aiReviewSummary?: string | null
  aiReviewStructured?: boolean | null
  aiCoverageComment?: string | null
  aiEvidenceComment?: string | null
  manualEdited?: boolean | null
  manualEditedByName?: string | null
  manualEditedAt?: string | null
}

export interface AiReviewResult {
  result: string | null
  summary: string | null
  issues: string[]
  suggestions: string[]
  caseDecisions: AiReviewCaseDecision[]
  supplementCases: GeneratedAiCaseItem[]
  unresolvedCoverageGaps: string[]
  rawContent: string | null
  structured: boolean
}

export interface AiGenerationTaskEventItem {
  id: number
  taskId: string
  seq: number
  eventType: string
  phase: string | null
  level: string | null
  message: string
  itemIndex: number | null
  itemTitle: string | null
  provider: string | null
  model: string | null
  payloadJson: string | null
  createdAt: string | null
}

export interface AiGenerationTaskItem {
  taskId: string
  workspaceCode: string
  workspaceName: string | null
  requirementTitle: string
  requirementContent: string
  outputMode: string
  status: string
  currentStep: number | null
  stepMessage: string | null
  errorMessage: string | null
  directoryId: number | null
  directoryName: string | null
  createdByName: string | null
  updatedByName: string | null
  provider: string | null
  model: string | null
  generatedCount: number | null
  savedCaseCount: number | null
  warnings: string[]
  invalidCases: AiInvalidCaseItem[]
  generatedCases: GeneratedAiCaseItem[]
  reviewResult: AiReviewResult | null
  generationRawOutput: string | null
  reviewRawOutput: string | null
  events: AiGenerationTaskEventItem[]
  adoptedCaseIndexes: number[]
  deletedCaseIndexes: number[]
  cancelRequested: boolean
  sourceTaskId: string | null
  createdAt: string | null
  updatedAt: string | null
  finishedAt: string | null
}

export interface CreateAiGenerationTaskPayload {
  workspaceCode: string
  requirementTitle: string
  requirementContent: string
  outputMode: 'STREAM' | 'COMPLETE'
  directoryId?: number | null
  directoryName?: string | null
  assetIds?: number[]
  ignoredAssetCount?: number
}

export interface UpdateAiGenerationTaskPayload {
  workspaceCode?: string
  directoryId?: number | null
  directoryName?: string | null
  generatedCases?: GeneratedAiCaseItem[]
  adoptedCaseIndexes?: number[]
  deletedCaseIndexes?: number[]
  savedCaseCount?: number
}

export interface ValidateAiGenerationImageSupportPayload {
  assetIds: number[]
}
