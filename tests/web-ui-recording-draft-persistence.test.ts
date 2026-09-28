import test from 'node:test'
import assert from 'node:assert/strict'

import { createRecordingDraftPersistence } from '../src/entities/web-ui-automation/lib/recordingDraftPersistence.ts'

function createHarness() {
  const values = new Map<string, string>()
  const timers = new Map<number, { callback: () => void; delayMs: number }>()
  let nextTimerId = 0
  let active = true
  let suppressed = false
  let draftValue = 'initial'
  let persistedCount = 0
  let failedCount = 0
  const persistence = createRecordingDraftPersistence({
    getKey: () => 'draft-key',
    getStorage: () => ({
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    }),
    readPreviousDraft: () => {
      const value = values.get('draft-key')
      return value ? JSON.parse(value) as { value: string; previousDraft: unknown } : null
    },
    createDraft: previousDraft => ({ value: draftValue, previousDraft }),
    isActive: () => active,
    isSuppressed: () => suppressed,
    onPersisted: () => { persistedCount += 1 },
    onPersistFailed: () => { failedCount += 1 },
    scheduleTimer: (callback, delayMs) => {
      const id = ++nextTimerId
      timers.set(id, { callback, delayMs })
      return id
    },
    clearTimer: timer => { timers.delete(timer as number) },
  })

  return {
    persistence,
    values,
    timers,
    setStoredDraft: (value: string) => { values.set('draft-key', value) },
    setActive: (value: boolean) => { active = value },
    setSuppressed: (value: boolean) => { suppressed = value },
    setDraftValue: (value: string) => { draftValue = value },
    getPersistedCount: () => persistedCount,
    getFailedCount: () => failedCount,
  }
}

test('debounces draft persistence and keeps the previous draft', () => {
  const harness = createHarness()
  harness.setStoredDraft(JSON.stringify({ value: 'saved-before' }))
  harness.persistence.schedule()
  harness.setDraftValue('latest')
  harness.persistence.schedule()

  assert.equal(harness.timers.size, 1)
  const [timer] = harness.timers.values()
  assert.equal(timer.delayMs, 400)
  timer.callback()

  assert.deepEqual(JSON.parse(harness.values.get('draft-key') || '{}'), {
    value: 'latest',
    previousDraft: { value: 'saved-before' },
  })
  assert.equal(harness.getPersistedCount(), 1)
})

test('flush persists pending changes once and clear cancels pending writes', () => {
  const harness = createHarness()
  harness.persistence.schedule()
  harness.persistence.flush()

  assert.equal(harness.getPersistedCount(), 1)
  assert.equal(harness.timers.size, 0)

  harness.persistence.schedule()
  harness.persistence.clearStorage()
  assert.equal(harness.values.has('draft-key'), false)
  assert.equal(harness.timers.size, 0)
})

test('skips scheduling while persistence is inactive or suppressed', () => {
  const harness = createHarness()
  harness.setActive(false)
  harness.persistence.schedule()
  harness.setActive(true)
  harness.setSuppressed(true)
  harness.persistence.schedule()

  assert.equal(harness.timers.size, 0)
})

test('reports write failures without throwing', () => {
  let failedCount = 0
  const persistence = createRecordingDraftPersistence({
    getKey: () => 'draft-key',
    getStorage: () => ({
      setItem: () => { throw new Error('quota exceeded') },
      removeItem: () => undefined,
    }),
    readPreviousDraft: () => null,
    createDraft: () => ({ value: 'draft' }),
    isActive: () => true,
    isSuppressed: () => false,
    onPersisted: () => undefined,
    onPersistFailed: () => { failedCount += 1 },
  })

  assert.doesNotThrow(() => persistence.persistNow())
  assert.equal(failedCount, 1)
})
