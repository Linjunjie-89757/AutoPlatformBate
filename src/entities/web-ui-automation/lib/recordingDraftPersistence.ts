export interface RecordingDraftStorage {
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface RecordingDraftPersistenceOptions<TDraft> {
  getKey: () => string
  getStorage: () => RecordingDraftStorage | null
  readPreviousDraft: () => TDraft | null
  createDraft: (previousDraft: TDraft | null) => TDraft
  isActive: () => boolean
  isSuppressed: () => boolean
  onPersisted: () => void
  onPersistFailed: () => void
  delayMs?: number
  scheduleTimer?: (callback: () => void, delayMs: number) => unknown
  clearTimer?: (timer: unknown) => void
}

export function createRecordingDraftPersistence<TDraft>(options: RecordingDraftPersistenceOptions<TDraft>) {
  const scheduleTimer = options.scheduleTimer || ((callback, delayMs) => setTimeout(callback, delayMs))
  const clearTimer = options.clearTimer || (timer => clearTimeout(timer as ReturnType<typeof setTimeout>))
  let timer: unknown = null

  function persistNow() {
    const key = options.getKey()
    if (!key) return
    try {
      const storage = options.getStorage()
      if (!storage) return
      storage.setItem(key, JSON.stringify(options.createDraft(options.readPreviousDraft())))
      options.onPersisted()
    } catch {
      options.onPersistFailed()
    }
  }

  function cancel() {
    if (timer === null) return
    clearTimer(timer)
    timer = null
  }

  function schedule() {
    if (!options.isActive() || options.isSuppressed()) return
    cancel()
    timer = scheduleTimer(() => {
      timer = null
      persistNow()
    }, options.delayMs ?? 400)
  }

  function flush() {
    if (timer === null) return
    cancel()
    if (options.isActive() && !options.isSuppressed()) {
      persistNow()
    }
  }

  function clearStorage() {
    const key = options.getKey()
    cancel()
    if (!key) return
    try {
      options.getStorage()?.removeItem(key)
    } catch {
      // Browser storage can be unavailable in restricted modes.
    }
  }

  return { cancel, clearStorage, flush, persistNow, schedule }
}
