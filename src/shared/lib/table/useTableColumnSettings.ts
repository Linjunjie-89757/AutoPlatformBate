import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { AppTableColumnDefinition, AppTableColumnSettingsItem } from './types'

interface PersistedColumnSettings {
  order: string[]
  visible: string[]
}

interface UseTableColumnSettingsOptions {
  columns: MaybeRefOrGetter<AppTableColumnDefinition[]>
  storageKey: MaybeRefOrGetter<string>
  immediate?: boolean
}

export function useTableColumnSettings(options: UseTableColumnSettingsOptions) {
  const drawerVisible = ref(false)
  const activeOrder = ref<string[]>([])
  const activeVisible = ref<string[]>([])
  const draftOrder = ref<string[]>([])
  const draftVisible = ref<string[]>([])
  const draggingKey = ref<string | null>(null)

  const definitions = computed(() => toValue(options.columns))
  const definitionMap = computed(() => new Map(definitions.value.map(column => [column.key, column])))

  function defaultState(): PersistedColumnSettings {
    return {
      order: definitions.value.map(column => column.key),
      visible: definitions.value
        .filter(column => column.required || column.defaultVisible)
        .map(column => column.key),
    }
  }

  function normalizeState(value?: Partial<PersistedColumnSettings> | null): PersistedColumnSettings {
    const fallback = defaultState()
    const knownKeys = new Set(fallback.order)
    const order = (value?.order || []).filter(key => knownKeys.has(key))
    fallback.order.forEach(key => {
      if (!order.includes(key)) order.push(key)
    })

    const requestedVisible = new Set((value?.visible || fallback.visible).filter(key => knownKeys.has(key)))
    definitions.value.forEach(column => {
      if (column.required) requestedVisible.add(column.key)
    })
    return { order, visible: Array.from(requestedVisible) }
  }

  function readPersistedState() {
    if (typeof window === 'undefined') return defaultState()
    try {
      const raw = window.localStorage.getItem(toValue(options.storageKey))
      return normalizeState(raw ? JSON.parse(raw) as PersistedColumnSettings : null)
    } catch {
      return defaultState()
    }
  }

  function load() {
    const value = readPersistedState()
    activeOrder.value = value.order
    activeVisible.value = value.visible
    draftOrder.value = [...value.order]
    draftVisible.value = [...value.visible]
  }

  function persist() {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(toValue(options.storageKey), JSON.stringify({
      order: activeOrder.value,
      visible: activeVisible.value,
    } satisfies PersistedColumnSettings))
  }

  const visibleColumns = computed(() => activeOrder.value
    .map(key => definitionMap.value.get(key))
    .filter((column): column is AppTableColumnDefinition => Boolean(column && activeVisible.value.includes(column.key))))

  const drawerColumns = computed<AppTableColumnSettingsItem[]>(() => draftOrder.value
    .map(key => definitionMap.value.get(key))
    .filter((column): column is AppTableColumnDefinition => Boolean(column))
    .map(column => ({
      ...column,
      required: Boolean(column.required),
      draggable: column.draggable !== false && !column.required,
      visible: column.required || draftVisible.value.includes(column.key),
    })))

  function open() {
    draftOrder.value = [...activeOrder.value]
    draftVisible.value = [...activeVisible.value]
    drawerVisible.value = true
  }

  function cancel() {
    draftOrder.value = [...activeOrder.value]
    draftVisible.value = [...activeVisible.value]
    draggingKey.value = null
    drawerVisible.value = false
  }

  function commit(closeDrawer: boolean) {
    const value = normalizeState({ order: draftOrder.value, visible: draftVisible.value })
    activeOrder.value = value.order
    activeVisible.value = value.visible
    persist()
    if (closeDrawer) {
      drawerVisible.value = false
    }
  }

  function apply() {
    commit(true)
  }

  function resetDraft() {
    const value = defaultState()
    draftOrder.value = value.order
    draftVisible.value = value.visible
    draggingKey.value = null
    if (options.immediate) commit(false)
  }

  function toggleColumn(key: string, value: boolean | string | number) {
    const definition = definitionMap.value.get(key)
    if (!definition || definition.required) return
    const visible = Boolean(value)
    draftVisible.value = visible
      ? Array.from(new Set([...draftVisible.value, key]))
      : draftVisible.value.filter(item => item !== key)
    if (options.immediate) commit(false)
  }

  function dragStart(key: string) {
    if (definitionMap.value.get(key)?.required) return
    draggingKey.value = key
  }

  function dragEnd() {
    draggingKey.value = null
  }

  function dropColumn(targetKey: string) {
    const sourceKey = draggingKey.value
    if (!sourceKey || sourceKey === targetKey) return
    const next = [...draftOrder.value]
    const sourceIndex = next.indexOf(sourceKey)
    const targetIndex = next.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) return
    next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, sourceKey)
    draftOrder.value = next
    if (options.immediate) commit(false)
  }

  watch(
    () => [toValue(options.storageKey), definitions.value.map(column => `${column.key}:${column.defaultVisible}:${column.required}`)],
    load,
    { immediate: true, deep: true },
  )

  return {
    drawerVisible,
    draggingKey,
    visibleColumns,
    drawerColumns,
    open,
    cancel,
    apply,
    resetDraft,
    toggleColumn,
    dragStart,
    dragEnd,
    dropColumn,
  }
}
