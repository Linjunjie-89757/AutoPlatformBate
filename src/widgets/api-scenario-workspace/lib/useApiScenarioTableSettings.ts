import { computed, type Ref } from 'vue'

import type { AppTableColumnSettingsItem } from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'

export type ScenarioTableColumnKey =
  | 'id'
  | 'name'
  | 'priority'
  | 'status'
  | 'lastRunResult'
  | 'tags'
  | 'environment'
  | 'stepCount'
  | 'passRate'
  | 'moduleName'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'

export interface ScenarioTableColumnDefinition {
  key: ScenarioTableColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
}

interface UseApiScenarioTableSettingsOptions {
  columnVisibility: Ref<Partial<Record<ScenarioTableColumnKey, boolean>>>
  columnOrder: Ref<ScenarioTableColumnKey[]>
  draggingColumnKey: Ref<ScenarioTableColumnKey | null>
}

const SCENARIO_TABLE_SETTINGS_KEY = 'api-scenario-list-table-settings-v1'

const scenarioTableColumnDefinitions = computed<ScenarioTableColumnDefinition[]>(() => [
  { key: 'id', label: 'ID', width: 120, required: true, defaultVisible: true },
  { key: 'name', label: '场景名称', minWidth: 220, required: true, defaultVisible: true },
  { key: 'priority', label: '场景等级', width: 110, defaultVisible: true },
  { key: 'status', label: '状态', width: 110, defaultVisible: true },
  { key: 'lastRunResult', label: '执行结果', width: 120, defaultVisible: true },
  { key: 'tags', label: '标签', minWidth: 160, defaultVisible: true },
  { key: 'environment', label: '场景环境', width: 140, defaultVisible: true },
  { key: 'stepCount', label: '步骤数', width: 100, defaultVisible: false },
  { key: 'passRate', label: '通过率', width: 100, defaultVisible: false },
  { key: 'moduleName', label: '所属模块', width: 140, defaultVisible: false },
  { key: 'createdAt', label: '创建时间', width: 168, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', width: 168, defaultVisible: false },
  { key: 'createdBy', label: '创建人', width: 120, defaultVisible: true },
  { key: 'updatedBy', label: '更新人', width: 120, defaultVisible: true },
])

export function useApiScenarioTableSettings(options: UseApiScenarioTableSettingsOptions) {
  const scenarioTableRequiredColumns = computed(() => scenarioTableColumnDefinitions.value.filter(column => column.required))
  const scenarioTableOptionalColumns = computed(() => scenarioTableColumnDefinitions.value.filter(column => !column.required))

  const scenarioTableOrderedColumns = computed(() => options.columnOrder.value
    .map(key => scenarioTableColumnDefinitions.value.find(column => column.key === key))
    .filter((column): column is ScenarioTableColumnDefinition => Boolean(column)))

  const scenarioTableVisibleColumns = computed(() => scenarioTableOrderedColumns.value.filter(column => (
    column.required || Boolean(options.columnVisibility.value[column.key])
  )))

  const scenarioTableDrawerColumns = computed<AppTableColumnSettingsItem[]>(() => scenarioTableOrderedColumns.value.map(column => ({
    key: column.key,
    label: column.label,
    required: Boolean(column.required),
    visible: column.required ? true : Boolean(options.columnVisibility.value[column.key]),
    draggable: !column.required,
  })))

  const scenarioTableGridMinWidth = computed(() => {
    const columnWidth = scenarioTableVisibleColumns.value.reduce((total, column) => {
      if (typeof column.width === 'number') return total + column.width
      if (typeof column.minWidth === 'number') return total + column.minWidth
      return total + 120
    }, 0)

    return `${columnWidth}px`
  })

  const scenarioTableGridTemplateColumns = computed(() => scenarioTableVisibleColumns.value.map((column) => {
    if (typeof column.width === 'number') return `${column.width}px`
    if (column.key === 'name' && typeof column.minWidth === 'number') return `minmax(${column.minWidth}px, 1fr)`
    if (typeof column.minWidth === 'number') return `${column.minWidth}px`
    return '120px'
  }).join(' '))

  function buildDefaultScenarioTableColumnOrder() {
    return [
      ...scenarioTableRequiredColumns.value.map(column => column.key),
      ...scenarioTableOptionalColumns.value.map(column => column.key),
    ]
  }

  function buildDefaultScenarioTableColumnVisibility() {
    return scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required ? true : Boolean(column.defaultVisible)
      return result
    }, {})
  }

  function normalizeScenarioTableColumnOrder(nextOrder?: ScenarioTableColumnKey[]) {
    const requiredKeys = scenarioTableRequiredColumns.value.map(column => column.key)
    const optionalKeys = scenarioTableOptionalColumns.value.map(column => column.key)
    const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
    const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
    return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
  }

  function isScenarioTableColumnKey(key: string): key is ScenarioTableColumnKey {
    return scenarioTableColumnDefinitions.value.some(column => column.key === key)
  }

  function syncScenarioTableSettings() {
    const currentVisibility = options.columnVisibility.value
    options.columnOrder.value = normalizeScenarioTableColumnOrder(options.columnOrder.value)
    options.columnVisibility.value = scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (currentVisibility[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  }

  function persistScenarioTableSettings() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SCENARIO_TABLE_SETTINGS_KEY, JSON.stringify({
      columns: options.columnVisibility.value,
      columnOrder: options.columnOrder.value,
    }))
  }

  function loadScenarioTableSettings() {
    const defaultOrder = buildDefaultScenarioTableColumnOrder()
    const defaultVisibility = buildDefaultScenarioTableColumnVisibility()
    if (typeof localStorage === 'undefined') {
      options.columnOrder.value = defaultOrder
      options.columnVisibility.value = defaultVisibility
      return
    }
    const raw = localStorage.getItem(SCENARIO_TABLE_SETTINGS_KEY)
    if (!raw) {
      options.columnOrder.value = defaultOrder
      options.columnVisibility.value = defaultVisibility
      return
    }
    try {
      const parsed = JSON.parse(raw) as {
        columns?: Partial<Record<ScenarioTableColumnKey, boolean>>
        columnOrder?: ScenarioTableColumnKey[]
      }
      options.columnOrder.value = normalizeScenarioTableColumnOrder(parsed.columnOrder)
      options.columnVisibility.value = scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
        result[column.key] = column.required
          ? true
          : (parsed.columns?.[column.key] ?? Boolean(column.defaultVisible))
        return result
      }, {})
    } catch {
      options.columnOrder.value = defaultOrder
      options.columnVisibility.value = defaultVisibility
    }
    syncScenarioTableSettings()
  }

  function resetScenarioTableSettings() {
    options.columnOrder.value = buildDefaultScenarioTableColumnOrder()
    options.columnVisibility.value = buildDefaultScenarioTableColumnVisibility()
    persistScenarioTableSettings()
  }

  function toggleScenarioTableColumnVisibility(key: string, value: boolean | string | number) {
    if (!isScenarioTableColumnKey(key)) return
    const targetColumn = scenarioTableColumnDefinitions.value.find(column => column.key === key)
    if (!targetColumn || targetColumn.required) return
    options.columnVisibility.value = {
      ...options.columnVisibility.value,
      [key]: Boolean(value),
    }
    persistScenarioTableSettings()
  }

  function canDragScenarioTableColumn(key: ScenarioTableColumnKey) {
    return scenarioTableOptionalColumns.value.some(column => column.key === key)
  }

  function handleScenarioTableColumnDragStart(key: string) {
    if (!isScenarioTableColumnKey(key) || !canDragScenarioTableColumn(key)) return
    options.draggingColumnKey.value = key
  }

  function handleScenarioTableColumnDragEnd() {
    options.draggingColumnKey.value = null
  }

  function moveScenarioTableColumnToTarget(targetKey: string) {
    if (!isScenarioTableColumnKey(targetKey)) return
    const sourceKey = options.draggingColumnKey.value
    if (!sourceKey || sourceKey === targetKey || !canDragScenarioTableColumn(sourceKey) || !canDragScenarioTableColumn(targetKey)) return
    const nextOrder = [...options.columnOrder.value]
    const sourceIndex = nextOrder.indexOf(sourceKey)
    const targetIndex = nextOrder.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [sourceColumn] = nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, sourceColumn)
    options.columnOrder.value = normalizeScenarioTableColumnOrder(nextOrder)
    options.draggingColumnKey.value = null
    persistScenarioTableSettings()
  }

  return {
    scenarioTableColumnDefinitions,
    scenarioTableRequiredColumns,
    scenarioTableOptionalColumns,
    scenarioTableOrderedColumns,
    scenarioTableVisibleColumns,
    scenarioTableDrawerColumns,
    scenarioTableGridMinWidth,
    scenarioTableGridTemplateColumns,
    buildDefaultScenarioTableColumnOrder,
    buildDefaultScenarioTableColumnVisibility,
    normalizeScenarioTableColumnOrder,
    isScenarioTableColumnKey,
    syncScenarioTableSettings,
    persistScenarioTableSettings,
    loadScenarioTableSettings,
    resetScenarioTableSettings,
    toggleScenarioTableColumnVisibility,
    canDragScenarioTableColumn,
    handleScenarioTableColumnDragStart,
    handleScenarioTableColumnDragEnd,
    moveScenarioTableColumnToTarget,
  }
}
