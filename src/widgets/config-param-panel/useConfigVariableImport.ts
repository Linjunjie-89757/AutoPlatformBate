import { computed, reactive, ref, type ComputedRef } from 'vue'

import type { WebUiVariableItem } from '@/features/config-param-create-edit'

export type ConflictAction = 'skip' | 'overwrite' | 'rename'

interface UseConfigVariableImportOptions {
  activeVariables: ComputedRef<WebUiVariableItem[]>
  cloneVariable: (variable: WebUiVariableItem) => WebUiVariableItem
  isSupportedVariableType: (value: string) => boolean
  persistActive: () => Promise<boolean>
  replaceVariables: (variables: WebUiVariableItem[]) => void
}

export function useConfigVariableImport(options: UseConfigVariableImportOptions) {
  const importVisible = ref(false)
  const importStep = ref(1)
  const importFileName = ref('')
  const importError = ref('')
  const importRows = ref<WebUiVariableItem[]>([])
  const importConflicts = reactive<Record<string, ConflictAction>>({})
  const importResult = reactive({ added: 0, overwritten: 0, skipped: 0 })
  const fileInput = ref<HTMLInputElement | null>(null)

  const conflictRows = computed(() => {
    const names = new Set(options.activeVariables.value.map(item => item.name.toUpperCase()))
    return importRows.value.filter(item => names.has(item.name.toUpperCase()))
  })

  const importTitle = computed(() => [
    '导入变量 — 选择文件',
    '导入变量 — 格式校验',
    '导入变量 — 导入预览',
    '导入变量 — 冲突处理',
    '导入变量 — 导入完成',
  ][importStep.value - 1])

  function openImport() {
    importVisible.value = true
    importStep.value = 1
    importFileName.value = ''
    importError.value = ''
    importRows.value = []
    Object.keys(importConflicts).forEach(key => delete importConflicts[key])
    Object.assign(importResult, { added: 0, overwritten: 0, skipped: 0 })
  }

  function triggerFileInput() {
    fileInput.value?.click()
  }

  function setFileInput(element: unknown) {
    fileInput.value = element instanceof HTMLInputElement ? element : null
  }

  function normalizeImportedVariable(value: unknown): WebUiVariableItem | null {
    if (!value || typeof value !== 'object') return null
    const item = value as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!name) return null
    const rawType = typeof item.valueType === 'string' ? item.valueType.toUpperCase() : 'TEXT'
    const valueType = options.isSupportedVariableType(rawType)
      ? rawType as NonNullable<WebUiVariableItem['valueType']>
      : 'TEXT'
    return {
      name,
      value: item.value == null ? '' : typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
      description: typeof item.description === 'string' ? item.description : '',
      sensitive: item.sensitive === true || valueType === 'SECRET',
      valueType,
      scopeType: 'ALL',
      stageType: 'COMMON',
      enabled: item.enabled !== false,
    }
  }

  function parseCsvLine(line: string) {
    const values: string[] = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"' && line[index + 1] === '"' && quoted) {
        current += '"'
        index += 1
      } else if (char === '"') {
        quoted = !quoted
      } else if (char === ',' && !quoted) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean)
    const headers = parseCsvLine(lines.shift() || '').map(item => item.toLowerCase())
    return lines.map(line => {
      const values = parseCsvLine(line)
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))
    })
  }

  function parseSimpleYaml(text: string) {
    const rows: Record<string, unknown>[] = []
    let current: Record<string, unknown> | null = null
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || line === 'variables:') continue
      if (line.startsWith('- ')) {
        if (current) rows.push(current)
        current = {}
        const pair = line.slice(2).split(/:(.*)/s)
        if (pair[0]) current[pair[0].trim()] = (pair[1] || '').trim().replace(/^['"]|['"]$/g, '')
      } else if (current && line.includes(':')) {
        const pair = line.split(/:(.*)/s)
        const rawValue = (pair[1] || '').trim().replace(/^['"]|['"]$/g, '')
        current[pair[0]!.trim()] = rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue
      }
    }
    if (current) rows.push(current)
    return rows
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    importError.value = ''
    if (file.size > 2 * 1024 * 1024) {
      importError.value = '文件不能超过 2MB'
      input.value = ''
      return
    }
    importFileName.value = file.name
    importStep.value = 2
    try {
      const text = await file.text()
      const extension = file.name.split('.').pop()?.toLowerCase()
      let source: unknown
      if (extension === 'csv') source = parseCsv(text)
      else if (extension === 'yaml' || extension === 'yml') source = parseSimpleYaml(text)
      else source = JSON.parse(text)
      const rawRows = Array.isArray(source)
        ? source
        : source && typeof source === 'object' && Array.isArray((source as { variables?: unknown[] }).variables)
          ? (source as { variables: unknown[] }).variables
          : []
      const rows = rawRows.map(normalizeImportedVariable).filter((item): item is WebUiVariableItem => Boolean(item))
      if (!rows.length) throw new Error('文件中没有可导入的变量')
      importRows.value = rows
      Object.keys(importConflicts).forEach(key => delete importConflicts[key])
      conflictRows.value.forEach(row => { importConflicts[row.name] = 'skip' })
      window.setTimeout(() => { importStep.value = 3 }, 500)
    } catch (error) {
      importStep.value = 1
      importError.value = error instanceof Error ? error.message : '文件解析失败'
    } finally {
      input.value = ''
    }
  }

  function goToConflictStep() {
    if (!conflictRows.value.length) {
      void commitImport()
      return
    }
    importStep.value = 4
  }

  async function commitImport() {
    const next = options.activeVariables.value.map(options.cloneVariable)
    let added = 0
    let overwritten = 0
    let skipped = 0
    for (const row of importRows.value) {
      const existingIndex = next.findIndex(item => item.name.toUpperCase() === row.name.toUpperCase())
      if (existingIndex < 0) {
        next.push(options.cloneVariable(row))
        added += 1
        continue
      }
      const action = importConflicts[row.name] || 'skip'
      if (action === 'overwrite') {
        next.splice(existingIndex, 1, options.cloneVariable(row))
        overwritten += 1
      } else if (action === 'rename') {
        const renamed = options.cloneVariable(row)
        let candidate = `${row.name}_IMPORT`
        let suffix = 1
        while (next.some(item => item.name.toUpperCase() === candidate.toUpperCase())) {
          suffix += 1
          candidate = `${row.name}_IMPORT_${suffix}`
        }
        renamed.name = candidate
        next.push(renamed)
        added += 1
      } else {
        skipped += 1
      }
    }
    options.replaceVariables(next)
    const saved = await options.persistActive()
    if (saved) {
      Object.assign(importResult, { added, overwritten, skipped })
      importStep.value = 5
    }
  }

  return {
    commitImport,
    conflictRows,
    goToConflictStep,
    handleFileChange,
    importConflicts,
    importError,
    importFileName,
    importResult,
    importRows,
    importStep,
    importTitle,
    importVisible,
    openImport,
    setFileInput,
    triggerFileInput,
  }
}
