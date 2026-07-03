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

function isEnabledFileUploadStep(step: WebUiFileUploadArtifactStep) {
  return step.enabled !== false && String(step.type || '').toUpperCase() === 'FILE_UPLOAD'
}
