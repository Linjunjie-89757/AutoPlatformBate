import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export type DefectTableColumnKey =
  | 'select'
  | 'bugNo'
  | 'title'
  | 'status'
  | 'priority'
  | 'severity'
  | 'assigneeName'
  | 'workspaceName'
  | 'tags'
  | 'reporterName'
  | 'createdAt'
  | 'updatedByName'
  | 'relatedCaseCount'
  | 'updatedAt'

export interface DefectTableColumnDefinition {
  key: DefectTableColumnKey
  label: string
  width?: number
  minWidth?: number
  showOverflowTooltip?: boolean
  required?: boolean
  defaultVisible?: boolean
}

interface UseDefectTableSettingsOptions {
  storageKey: string
  columns: MaybeRefOrGetter<DefectTableColumnDefinition[]>
}

interface PersistedDefectTableSettings {
  columns?: Partial<Record<DefectTableColumnKey, boolean>>
  columnOrder?: DefectTableColumnKey[]
}

export function useDefectTableSettings(options: UseDefectTableSettingsOptions) {
  const settingsVisible = ref(false)
  const draggingColumnKey = ref<DefectTableColumnKey | null>(null)
  const columnVisibility = ref<Partial<Record<DefectTableColumnKey, boolean>>>({})
  const columnOrder = ref<DefectTableColumnKey[]>([])

  const allColumns = computed(() => toValue(options.columns))
  const requiredColumns = computed(() => allColumns.value.filter(column => column.required))
  const optionalColumns = computed(() => allColumns.value.filter(column => !column.required))

  const orderedColumns = computed(() => columnOrder.value
    .map(key => allColumns.value.find(column => column.key === key))
    .filter((column): column is DefectTableColumnDefinition => Boolean(column)))

  const visibleColumns = computed(() => orderedColumns.value.filter(column => (
    column.required || Boolean(columnVisibility.value[column.key])
  )))

  const drawerColumns = computed(() => orderedColumns.value.map(column => ({
    key: column.key,
    label: column.label,
    required: Boolean(column.required),
    visible: column.required ? true : Boolean(columnVisibility.value[column.key]),
    draggable: !column.required,
  })))

  function buildDefaultOrder() {
    return [
      ...requiredColumns.value.map(column => column.key),
      ...optionalColumns.value.map(column => column.key),
    ]
  }

  function normalizeColumnOrder(nextOrder?: DefectTableColumnKey[]) {
    const requiredKeys = requiredColumns.value.map(column => column.key)
    const optionalKeys = optionalColumns.value.map(column => column.key)
    const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
    const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
    return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
  }

  function buildDefaultVisibility() {
    return allColumns.value.reduce<Partial<Record<DefectTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required ? true : Boolean(column.defaultVisible)
      return result
    }, {})
  }

  function syncState() {
    const currentVisibility = columnVisibility.value
    columnOrder.value = normalizeColumnOrder(columnOrder.value)
    columnVisibility.value = allColumns.value.reduce<Partial<Record<DefectTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (currentVisibility[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  }

  function persist() {
    if (typeof localStorage === 'undefined') {
      return
    }

    const payload: PersistedDefectTableSettings = {
      columns: columnVisibility.value,
      columnOrder: columnOrder.value,
    }

    localStorage.setItem(options.storageKey, JSON.stringify(payload))
  }

  function load() {
    const defaultOrder = buildDefaultOrder()
    const defaultVisibility = buildDefaultVisibility()

    if (typeof localStorage === 'undefined') {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
      return
    }

    const raw = localStorage.getItem(options.storageKey)
    if (!raw) {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
      return
    }

    try {
      const parsed = JSON.parse(raw) as PersistedDefectTableSettings
      columnOrder.value = normalizeColumnOrder(parsed.columnOrder)
      columnVisibility.value = allColumns.value.reduce<Partial<Record<DefectTableColumnKey, boolean>>>((result, column) => {
        result[column.key] = column.required
          ? true
          : (parsed.columns?.[column.key] ?? Boolean(column.defaultVisible))
        return result
      }, {})
    } catch {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
    }

    syncState()
  }

  function reset() {
    columnOrder.value = buildDefaultOrder()
    columnVisibility.value = buildDefaultVisibility()
    persist()
  }

  function isDefectTableColumnKey(key: string): key is DefectTableColumnKey {
    return allColumns.value.some(column => column.key === key)
  }

  function toggleColumnVisibility(key: string, value: boolean | string | number) {
    if (!isDefectTableColumnKey(key)) {
      return
    }
    const targetColumn = allColumns.value.find(column => column.key === key)
    if (!targetColumn || targetColumn.required) {
      return
    }

    columnVisibility.value = {
      ...columnVisibility.value,
      [key]: Boolean(value),
    }
    persist()
  }

  function canDragColumn(key: DefectTableColumnKey) {
    return optionalColumns.value.some(column => column.key === key)
  }

  function handleDragStart(key: string) {
    if (!isDefectTableColumnKey(key)) {
      return
    }
    if (!canDragColumn(key)) {
      return
    }

    draggingColumnKey.value = key
  }

  function handleDragEnd() {
    draggingColumnKey.value = null
  }

  function moveColumnToTarget(targetKey: string) {
    if (!isDefectTableColumnKey(targetKey)) {
      return
    }
    const sourceKey = draggingColumnKey.value
    if (!sourceKey || sourceKey === targetKey || !canDragColumn(sourceKey) || !canDragColumn(targetKey)) {
      return
    }

    const nextOrder = [...columnOrder.value]
    const sourceIndex = nextOrder.indexOf(sourceKey)
    const targetIndex = nextOrder.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    const [sourceColumn] = nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, sourceColumn)
    columnOrder.value = normalizeColumnOrder(nextOrder)
    draggingColumnKey.value = null
    persist()
  }

  watch(allColumns, syncState, { deep: true })

  return {
    settingsVisible,
    draggingColumnKey,
    drawerColumns,
    visibleColumns,
    load,
    reset,
    toggleColumnVisibility,
    handleDragStart,
    handleDragEnd,
    moveColumnToTarget,
  }
}
