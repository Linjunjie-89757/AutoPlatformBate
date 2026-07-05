export const WEB_UI_RECORDING_DRAFT_VERSION = 1
export const WEB_UI_RECORDING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface WebUiRecordingDraftPayload<TForm = unknown, TUploadArtifactBindings = unknown> {
  version: typeof WEB_UI_RECORDING_DRAFT_VERSION
  workspaceCode: string
  caseId: number
  caseUpdatedAt: string | null
  savedStepCount: number
  draftStepCount: number
  recorderId: string | null
  recordedStepCount: number
  createdAt: string
  updatedAt: string
  form: TForm
  uploadArtifactBindings?: TUploadArtifactBindings | null
}
export interface WebUiRecordingDraftTarget {
  workspaceCode: string
  caseId: number
  caseUpdatedAt: string | null
}

export function buildWebUiRecordingDraftStorageKey(workspaceCode: string, caseId: number) {
  return [
    'web-ui-recording-draft',
    `v${WEB_UI_RECORDING_DRAFT_VERSION}`,
    encodeURIComponent(workspaceCode || 'ALL'),
    String(caseId),
  ].join(':')
}

export function createWebUiRecordingDraft<TForm, TUploadArtifactBindings = unknown>(input: {
  workspaceCode: string
  caseId: number
  caseUpdatedAt?: string | null
  savedStepCount: number
  draftStepCount: number
  recorderId?: string | null
  recordedStepCount?: number
  form: TForm
  uploadArtifactBindings?: TUploadArtifactBindings | null
  previousDraft?: WebUiRecordingDraftPayload<TForm, TUploadArtifactBindings> | null
  now?: string
}): WebUiRecordingDraftPayload<TForm, TUploadArtifactBindings> {
  const now = input.now || new Date().toISOString()
  return {
    version: WEB_UI_RECORDING_DRAFT_VERSION,
    workspaceCode: input.workspaceCode || 'ALL',
    caseId: input.caseId,
    caseUpdatedAt: input.caseUpdatedAt || null,
    savedStepCount: Math.max(0, Number(input.savedStepCount || 0)),
    draftStepCount: Math.max(0, Number(input.draftStepCount || 0)),
    recorderId: input.recorderId || null,
    recordedStepCount: Math.max(0, Number(input.recordedStepCount || 0)),
    createdAt: input.previousDraft?.createdAt || now,
    updatedAt: now,
    form: input.form,
    uploadArtifactBindings: input.uploadArtifactBindings || null,
  }
}

export function parseWebUiRecordingDraft<TForm = unknown, TUploadArtifactBindings = unknown>(
  raw: string | null | undefined,
  options: { nowMs?: number; ttlMs?: number } = {},
): WebUiRecordingDraftPayload<TForm, TUploadArtifactBindings> | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WebUiRecordingDraftPayload<TForm, TUploadArtifactBindings>>
    if (
      parsed.version !== WEB_UI_RECORDING_DRAFT_VERSION
      || !parsed.workspaceCode
      || !Number.isFinite(Number(parsed.caseId))
      || !parsed.updatedAt
      || !parsed.form
    ) {
      return null
    }

    const updatedAtMs = Date.parse(parsed.updatedAt)
    if (!Number.isFinite(updatedAtMs)) {
      return null
    }

    const ttlMs = options.ttlMs ?? WEB_UI_RECORDING_DRAFT_TTL_MS
    const nowMs = options.nowMs ?? Date.now()
    if (ttlMs > 0 && nowMs - updatedAtMs > ttlMs) {
      return null
    }

    return {
      version: WEB_UI_RECORDING_DRAFT_VERSION,
      workspaceCode: parsed.workspaceCode,
      caseId: Number(parsed.caseId),
      caseUpdatedAt: parsed.caseUpdatedAt || null,
      savedStepCount: Math.max(0, Number(parsed.savedStepCount || 0)),
      draftStepCount: Math.max(0, Number(parsed.draftStepCount || 0)),
      recorderId: parsed.recorderId || null,
      recordedStepCount: Math.max(0, Number(parsed.recordedStepCount || 0)),
      createdAt: parsed.createdAt || parsed.updatedAt,
      updatedAt: parsed.updatedAt,
      form: parsed.form as TForm,
      uploadArtifactBindings: parsed.uploadArtifactBindings as TUploadArtifactBindings | null | undefined || null,
    }
  } catch {
    return null
  }
}

export function shouldRestoreWebUiRecordingDraft(
  draft: Pick<WebUiRecordingDraftPayload, 'workspaceCode' | 'caseId' | 'caseUpdatedAt'> | null | undefined,
  target: WebUiRecordingDraftTarget,
) {
  return Boolean(
    draft
    && draft.workspaceCode === (target.workspaceCode || 'ALL')
    && Number(draft.caseId) === Number(target.caseId)
    && (draft.caseUpdatedAt || null) === (target.caseUpdatedAt || null),
  )
}

export function shouldOfferWebUiRecordingDraftReplay(input: {
  draftActive: boolean
  savedStepCount: number
  draftStepCount: number
  recorderId?: string | null
}) {
  if (!input.draftActive) {
    return false
  }
  return Boolean(
    input.recorderId
    || Math.max(0, Number(input.draftStepCount || 0)) > Math.max(0, Number(input.savedStepCount || 0)),
  )
}
