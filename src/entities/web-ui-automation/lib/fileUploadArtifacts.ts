export interface WebUiFileUploadArtifactStep {
  type?: string | null
  inputValue?: string | null
  enabled?: boolean | null
}

export interface WebUiFileUploadArtifactBinding {
  fileId: string
  fileName: string
  contentType?: string | null
  contentBase64: string
  size?: number | null
}

export interface WebUiRecordedFileUploadArtifact {
  fileName?: string | null
  contentType?: string | null
  contentBase64?: string | null
  size?: number | null
  captureStatus?: WebUiRecordedFileUploadArtifactCaptureStatus | null
  limitBytes?: number | null
  fileCount?: number | null
}

export interface WebUiFileUploadArtifactRef {
  fileId: string
  artifactId: string
  fileName: string
  contentType: string
  contentBase64: string
  size?: number
}

export interface WebUiFileUploadArtifactRefBuildResult {
  artifactRefs: WebUiFileUploadArtifactRef[]
  missingFileIds: string[]
}

export type WebUiFileUploadArtifactBindingWithTimestamp = WebUiFileUploadArtifactBinding & { updatedAt: number }
export type WebUiFileUploadReplayIssue = 'MISSING_BINDING' | 'NON_REPLAYABLE_VALUE'
export type WebUiRecordedFileUploadArtifactCaptureStatus = 'READY' | 'TOO_LARGE' | 'UNSUPPORTED_MULTIPLE' | 'EMPTY_CONTENT' | 'READ_FAILED'
export type RecordedWebUiFileUploadArtifactBindStatus = 'BOUND' | 'TOO_LARGE' | 'UNSUPPORTED_MULTIPLE' | 'EMPTY_CONTENT' | 'INVALID_ARTIFACT'

export interface RecordedWebUiFileUploadArtifactBindResult {
  status: RecordedWebUiFileUploadArtifactBindStatus
  binding?: WebUiFileUploadArtifactBindingWithTimestamp
  size?: number | null
  limitBytes?: number | null
  fileCount?: number | null
}

export const RECORDED_WEB_UI_UPLOAD_ARTIFACT_MAX_SIZE_BYTES = 2 * 1024 * 1024

export interface WebUiFileUploadReplayIssueMatch {
  index: number
  issue: WebUiFileUploadReplayIssue
  fileId: string | null
}

export function artifactFileIdFromInputValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() || ''
  if (!normalized.toLowerCase().startsWith('artifact:')) {
    return null
  }
  const fileId = normalized.slice('artifact:'.length).trim()
  return fileId || null
}

export function isFileUploadArtifactValue(value: string | null | undefined) {
  return artifactFileIdFromInputValue(value) !== null
}

export function isReplayableWebUiFileUploadValue(value: string | null | undefined) {
  const normalized = value?.trim() || ''
  if (!normalized) {
    return false
  }
  return /^artifact:.+/i.test(normalized)
    || /^[A-Za-z]:[\\/].+/.test(normalized)
    || /^\\\\[^\\]+\\[^\\]+/.test(normalized)
    || /^\/\/[^/]+\/[^/]+/.test(normalized)
    || /^\/.+/.test(normalized)
}

export function getWebUiFileUploadReplayIssue(
  step: WebUiFileUploadArtifactStep | null | undefined,
  bindings: Record<string, WebUiFileUploadArtifactBinding | undefined> = {},
): WebUiFileUploadReplayIssue | null {
  if (!isEnabledFileUploadStep(step)) {
    return null
  }
  const inputValue = step?.inputValue?.trim() || ''
  const fileId = artifactFileIdFromInputValue(inputValue)
  if (fileId) {
    return bindings[fileId]?.contentBase64 ? null : 'MISSING_BINDING'
  }
  return isReplayableWebUiFileUploadValue(inputValue) ? null : 'NON_REPLAYABLE_VALUE'
}

export function findFirstWebUiFileUploadReplayIssue(
  steps: WebUiFileUploadArtifactStep[],
  bindings: Record<string, WebUiFileUploadArtifactBinding | undefined> = {},
): WebUiFileUploadReplayIssueMatch | null {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
    if (!step) {
      continue
    }
    const issue = getWebUiFileUploadReplayIssue(step, bindings)
    if (issue) {
      return {
        index,
        issue,
        fileId: artifactFileIdFromInputValue(step.inputValue) || null,
      }
    }
  }
  return null
}

export function buildWebUiFileUploadArtifactRefs(
  steps: WebUiFileUploadArtifactStep[],
  bindings: Record<string, WebUiFileUploadArtifactBinding | undefined>,
): WebUiFileUploadArtifactRefBuildResult {
  const artifactRefs: WebUiFileUploadArtifactRef[] = []
  const missingFileIds: string[] = []
  const seenFileIds = new Set<string>()

  for (const step of steps) {
    if (!isEnabledFileUploadStep(step)) {
      continue
    }
    const fileId = artifactFileIdFromInputValue(step.inputValue)
    if (!fileId || seenFileIds.has(fileId)) {
      continue
    }
    seenFileIds.add(fileId)

    const binding = bindings[fileId]
    if (!binding?.contentBase64) {
      missingFileIds.push(fileId)
      continue
    }

    artifactRefs.push({
      fileId,
      artifactId: fileId,
      fileName: binding.fileName || fileId,
      contentType: binding.contentType || 'application/octet-stream',
      contentBase64: binding.contentBase64,
      ...(typeof binding.size === 'number' && Number.isFinite(binding.size) ? { size: binding.size } : {}),
    })
  }

  return { artifactRefs, missingFileIds }
}

export function bindRecordedWebUiFileUploadArtifact<T extends WebUiFileUploadArtifactStep>(
  step: T,
  fileId: string,
  artifact: WebUiRecordedFileUploadArtifact | null | undefined,
  updatedAt = Date.now(),
): RecordedWebUiFileUploadArtifactBindResult {
  if (!isEnabledFileUploadStep(step)) {
    return { status: 'INVALID_ARTIFACT' }
  }
  const normalizedFileId = fileId.trim()
  if (!normalizedFileId) {
    return { status: 'INVALID_ARTIFACT' }
  }
  if (!artifact || typeof artifact !== 'object') {
    return { status: 'INVALID_ARTIFACT' }
  }

  const size = normalizePositiveNumber(artifact.size)
  const limitBytes = normalizePositiveNumber(artifact.limitBytes) || RECORDED_WEB_UI_UPLOAD_ARTIFACT_MAX_SIZE_BYTES
  const fileCount = normalizePositiveNumber(artifact.fileCount)
  const captureStatus = artifact.captureStatus || null

  if (captureStatus === 'UNSUPPORTED_MULTIPLE') {
    return {
      status: 'UNSUPPORTED_MULTIPLE',
      fileCount,
    }
  }

  if (captureStatus === 'TOO_LARGE' || (typeof size === 'number' && size > limitBytes)) {
    return {
      status: 'TOO_LARGE',
      size,
      limitBytes,
    }
  }

  if (captureStatus === 'EMPTY_CONTENT' || captureStatus === 'READ_FAILED') {
    return {
      status: 'EMPTY_CONTENT',
      size,
    }
  }

  const fileName = artifact.fileName?.trim() || normalizedFileId
  const contentBase64 = artifact.contentBase64?.trim() || ''
  if (!contentBase64) {
    return {
      status: 'EMPTY_CONTENT',
      size,
    }
  }

  step.inputValue = `artifact:${normalizedFileId}`
  return {
    status: 'BOUND',
    binding: {
      fileId: normalizedFileId,
      fileName,
      contentType: artifact.contentType?.trim() || 'application/octet-stream',
      contentBase64,
      ...(typeof size === 'number' ? { size } : {}),
      updatedAt,
    },
  }
}

export function applyRecordedWebUiFileUploadArtifact<T extends WebUiFileUploadArtifactStep>(
  step: T,
  fileId: string,
  artifact: WebUiRecordedFileUploadArtifact | null | undefined,
  updatedAt = Date.now(),
): WebUiFileUploadArtifactBindingWithTimestamp | null {
  const result = bindRecordedWebUiFileUploadArtifact(step, fileId, artifact, updatedAt)
  return result.status === 'BOUND' ? result.binding || null : null
}

export function hasUnsavedWebUiFileUploadArtifactChanges(
  currentSteps: WebUiFileUploadArtifactStep[],
  savedSteps: WebUiFileUploadArtifactStep[],
) {
  for (let index = 0; index < currentSteps.length; index += 1) {
    const currentStep = currentSteps[index]
    if (!isEnabledFileUploadStep(currentStep)) {
      continue
    }
    const currentFileId = artifactFileIdFromInputValue(currentStep.inputValue)
    if (!currentFileId) {
      continue
    }

    const savedStep = savedSteps[index]
    if (!isEnabledFileUploadStep(savedStep)) {
      return true
    }
    if (artifactFileIdFromInputValue(savedStep.inputValue) !== currentFileId) {
      return true
    }
  }

  return false
}

function isEnabledFileUploadStep(step?: WebUiFileUploadArtifactStep | null) {
  return step?.enabled !== false && String(step?.type || '').toUpperCase() === 'FILE_UPLOAD'
}

function normalizePositiveNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
