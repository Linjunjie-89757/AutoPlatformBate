import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WEB_UI_RECORDING_DRAFT_TTL_MS,
  buildWebUiRecordingDraftStorageKey,
  createWebUiRecordingDraft,
  parseWebUiRecordingDraft,
  shouldOfferWebUiRecordingDraftReplay,
  shouldRestoreWebUiRecordingDraft,
} from '../src/entities/web-ui-automation/lib/recordingDraft.ts'

test('builds stable per-workspace case recording draft storage keys', () => {
  assert.equal(
    buildWebUiRecordingDraftStorageKey('account open', 42),
    'web-ui-recording-draft:v1:account%20open:42',
  )
})

test('creates and parses valid recording drafts', () => {
  const draft = createWebUiRecordingDraft({
    workspaceCode: 'account-open',
    caseId: 42,
    caseUpdatedAt: '2026-07-02T12:00:00.000Z',
    savedStepCount: 1,
    draftStepCount: 3,
    recorderId: 'rec-1',
    recordedStepCount: 2,
    form: { steps: [{ type: 'CLICK' }] },
    now: '2026-07-02T12:10:00.000Z',
  })

  const parsed = parseWebUiRecordingDraft(JSON.stringify(draft), {
    nowMs: Date.parse('2026-07-02T12:11:00.000Z'),
  })

  assert.deepEqual(parsed, draft)
})

test('rejects expired or incompatible recording drafts', () => {
  const draft = createWebUiRecordingDraft({
    workspaceCode: 'account-open',
    caseId: 42,
    savedStepCount: 1,
    draftStepCount: 2,
    form: { steps: [] },
    now: '2026-07-02T12:00:00.000Z',
  })

  assert.equal(parseWebUiRecordingDraft('{bad json'), null)
  assert.equal(parseWebUiRecordingDraft(JSON.stringify({ ...draft, version: 99 })), null)
  assert.equal(parseWebUiRecordingDraft(JSON.stringify(draft), {
    nowMs: Date.parse('2026-07-02T12:00:00.000Z') + WEB_UI_RECORDING_DRAFT_TTL_MS + 1,
  }), null)
})

test('restores recording drafts only for the same case version', () => {
  const draft = createWebUiRecordingDraft({
    workspaceCode: 'account-open',
    caseId: 42,
    caseUpdatedAt: '2026-07-02T12:00:00.000Z',
    savedStepCount: 1,
    draftStepCount: 2,
    form: { steps: [] },
  })

  assert.equal(shouldRestoreWebUiRecordingDraft(draft, {
    workspaceCode: 'account-open',
    caseId: 42,
    caseUpdatedAt: '2026-07-02T12:00:00.000Z',
  }), true)
  assert.equal(shouldRestoreWebUiRecordingDraft(draft, {
    workspaceCode: 'account-open',
    caseId: 43,
    caseUpdatedAt: '2026-07-02T12:00:00.000Z',
  }), false)
  assert.equal(shouldRestoreWebUiRecordingDraft(draft, {
    workspaceCode: 'account-open',
    caseId: 42,
    caseUpdatedAt: '2026-07-02T12:05:00.000Z',
  }), false)
})

test('offers local replay only for active recording drafts with recorded changes', () => {
  assert.equal(shouldOfferWebUiRecordingDraftReplay({
    draftActive: false,
    savedStepCount: 1,
    draftStepCount: 2,
  }), false)
  assert.equal(shouldOfferWebUiRecordingDraftReplay({
    draftActive: true,
    savedStepCount: 2,
    draftStepCount: 2,
  }), false)
  assert.equal(shouldOfferWebUiRecordingDraftReplay({
    draftActive: true,
    savedStepCount: 1,
    draftStepCount: 2,
  }), true)
  assert.equal(shouldOfferWebUiRecordingDraftReplay({
    draftActive: true,
    savedStepCount: 2,
    draftStepCount: 2,
    recorderId: 'rec-1',
  }), true)
})
