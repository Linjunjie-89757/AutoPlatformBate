import { computed, ref, type ComputedRef } from 'vue'

import type { ApiDefinitionDetail } from '@/entities/api-automation'
import {
  processorBodyExtractScopeOptions,
  processorRegexExtractScopeOptions,
} from './apiWorkspaceOptions'
import type { EditorTab } from './useApiRequestEditor'

export interface ApiProcessorConfig {
  id?: string
  processorType?: string
  name?: string
  enabled?: boolean
  script?: string | null
  sql?: string | null
  dataSourceId?: string | number | null
  dataSourceName?: string | null
  queryTimeout?: number | null
  variableNames?: string | null
  resultVariable?: string | null
  extractParams?: ApiProcessorSqlExtractParam[]
  delayMs?: number | null
  expression?: string | null
  variableName?: string | null
  sourceType?: string | null
  extractType?: string | null
  description?: string | null
  extractors?: ApiProcessorExtractItem[]
}

export interface ApiProcessorSqlExtractParam {
  key?: string | null
  value?: string | null
  enabled?: boolean
}

export interface ApiProcessorExtractItem {
  id?: string
  enabled?: boolean
  name?: string | null
  variableName?: string | null
  description?: string | null
  variableType?: string | null
  sourceType?: string | null
  extractScope?: string | null
  extractType?: string | null
  expression?: string | null
  expressionMatchingRule?: string | null
  resultMatchingRule?: string | null
  resultMatchingRuleNum?: number | null
  responseFormat?: string | null
}

interface UseApiProcessorWorkspaceOptions {
  activeEditor: ComputedRef<EditorTab | null>
  clone: <T>(value: T) => T
  markDirty: () => void
}

export function useApiProcessorWorkspace(options: UseApiProcessorWorkspaceOptions) {
  const activeProcessorId = ref('')
  const processorExtractMoreSettingsVisibleKey = ref<string | null>(null)

  function processorRowsFor(detail: ApiDefinitionDetail, stage: 'pre' | 'post'): ApiProcessorConfig[] {
    const rows = (stage === 'pre' ? detail.preProcessors : detail.postProcessors) as ApiProcessorConfig[]
    rows.forEach(row => normalizeProcessorDefaults(row, stage))
    return rows
  }

  function activeProcessorRows() {
    if (!options.activeEditor.value) return []
    const stage = options.activeEditor.value.activeTab === 'pre' ? 'pre' : 'post'
    return processorRowsFor(options.activeEditor.value.detail, stage)
  }

  function activeProcessorStage(): 'pre' | 'post' {
    return options.activeEditor.value?.activeTab === 'pre' ? 'pre' : 'post'
  }

  const activeProcessor = computed(() => {
    const rows = activeProcessorRows()
    if (!rows.length) return null
    return rows.find(item => item.id === activeProcessorId.value) || rows[0]
  })

  function normalizeProcessorDefaults(processor: ApiProcessorConfig, stage: 'pre' | 'post') {
    const type = processor.processorType || 'SCRIPT'
    processor.id = processor.id || `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    processor.enabled = processor.enabled !== false
    processor.name = processor.name || processorDefaultName(stage, type)
    if (type === 'TIME_WAITING') {
      processor.delayMs = processor.delayMs || 1000
    }
    if (type === 'SCRIPT') {
      processor.script = processor.script ?? ''
    }
    if (type === 'SQL') {
      processor.sql = processor.sql ?? processor.script ?? ''
      processor.script = processor.sql
      processor.dataSourceId = processor.dataSourceId ?? null
      processor.dataSourceName = processor.dataSourceName ?? ''
      processor.queryTimeout = processor.queryTimeout || 30000
      processor.variableNames = processor.variableNames ?? ''
      processor.resultVariable = processor.resultVariable ?? ''
      processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
    }
    if (type === 'EXTRACT') {
      processor.sourceType = processor.sourceType || 'RESPONSE_BODY'
      processor.extractType = processor.extractType || 'JSON_PATH'
      processor.expression = processor.expression ?? processor.script ?? ''
      processor.variableName = processor.variableName ?? ''
      processor.script = processor.expression
      processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
    }
  }

  function createProcessor(stage: 'pre' | 'post', type = 'SCRIPT'): ApiProcessorConfig {
    const processor: ApiProcessorConfig = {
      id: `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      processorType: type,
      name: processorDefaultName(stage, type),
      enabled: true,
      script: type === 'TIME_WAITING' ? null : '',
      sql: type === 'SQL' ? '' : null,
      dataSourceId: type === 'SQL' ? null : null,
      dataSourceName: type === 'SQL' ? '' : null,
      queryTimeout: type === 'SQL' ? 30000 : null,
      variableNames: type === 'SQL' ? '' : null,
      resultVariable: type === 'SQL' ? '' : null,
      extractParams: type === 'SQL' ? [] : [],
      delayMs: type === 'TIME_WAITING' ? 1000 : null,
      sourceType: type === 'EXTRACT' ? 'RESPONSE_BODY' : null,
      extractType: type === 'EXTRACT' ? 'JSON_PATH' : null,
      expression: type === 'EXTRACT' ? '' : null,
      variableName: type === 'EXTRACT' ? '' : null,
      extractors: type === 'EXTRACT' ? [createProcessorExtractItem()] : [],
    }
    return processor
  }

  function createProcessorExtractItem(patch: Partial<ApiProcessorExtractItem> = {}): ApiProcessorExtractItem {
    return {
      id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      enabled: true,
      name: '',
      variableName: '',
      description: '',
      variableType: 'TEMPORARY',
      sourceType: 'RESPONSE_BODY',
      extractScope: 'BODY',
      extractType: 'JSON_PATH',
      expression: '',
      expressionMatchingRule: 'EXPRESSION',
      resultMatchingRule: 'RANDOM',
      resultMatchingRuleNum: 1,
      responseFormat: 'JSON',
      ...patch,
    }
  }

  function processorExtractScopeFromSource(source?: string | null) {
    if (source === 'RESPONSE_HEADER') return 'RESPONSE_HEADERS'
    if (source === 'REQUEST_HEADER') return 'REQUEST_HEADERS'
    if (source === 'STATUS_CODE') return 'RESPONSE_CODE'
    if (source === 'URL') return 'URL'
    return 'BODY'
  }

  function processorSourceFromExtractScope(scope?: string | null) {
    if (scope === 'RESPONSE_HEADERS') return 'RESPONSE_HEADER'
    if (scope === 'REQUEST_HEADERS') return 'REQUEST_HEADER'
    if (scope === 'RESPONSE_CODE') return 'STATUS_CODE'
    if (scope === 'URL') return 'URL'
    return 'RESPONSE_BODY'
  }

  function processorExtractScopeOptions(item: ApiProcessorExtractItem) {
    return item.extractType === 'REGEX' ? processorRegexExtractScopeOptions : processorBodyExtractScopeOptions
  }

  function showProcessorExtractRegexSettings(item: ApiProcessorExtractItem) {
    return item.extractType === 'REGEX'
  }

  function showProcessorExtractXPathSettings(item: ApiProcessorExtractItem) {
    return item.extractType === 'X_PATH'
  }

  function showProcessorExtractSpecificIndex(item: ApiProcessorExtractItem) {
    return (item.resultMatchingRule || 'RANDOM') === 'SPECIFIC'
  }

  function normalizeProcessorExtractByType(item: ApiProcessorExtractItem) {
    const scopeOptions = processorExtractScopeOptions(item)
    if (!scopeOptions.some(option => option.value === item.extractScope)) {
      item.extractScope = 'BODY'
    }
    item.sourceType = processorSourceFromExtractScope(item.extractScope)
    if (item.extractType !== 'REGEX') {
      item.expressionMatchingRule = 'EXPRESSION'
    }
    if (item.extractType === 'JSON_PATH') {
      item.responseFormat = 'JSON'
    } else if (item.extractType === 'X_PATH') {
      item.responseFormat = item.responseFormat === 'HTML' ? 'HTML' : 'XML'
    } else {
      item.responseFormat = item.responseFormat || 'JSON'
    }
  }

  function processorExtractExpressionPlaceholder(item: ApiProcessorExtractItem) {
    if (item.extractType === 'X_PATH') return '例如 /response/data/token'
    if (item.extractType === 'REGEX') return '例如 \"token\":\"([^\"]+)\"'
    return '例如 $.data.token'
  }

  function handleProcessorExtractTypeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
    normalizeProcessorExtractByType(item)
    syncProcessorScript(processor)
  }

  function handleProcessorExtractScopeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
    item.sourceType = processorSourceFromExtractScope(item.extractScope)
    syncProcessorScript(processor)
  }

  function setProcessorExtractMoreSettingsVisible(processorId: string | undefined, index: number, visible: boolean) {
    processorExtractMoreSettingsVisibleKey.value = visible && processorId ? `${processorId}-${index}` : null
  }

  function normalizeProcessorExtractItem(item: ApiProcessorExtractItem): ApiProcessorExtractItem {
    item.id = item.id || `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    item.enabled = item.enabled !== false
    item.name = item.name ?? ''
    item.variableName = item.variableName ?? ''
    item.description = item.description ?? ''
    item.variableType = item.variableType || 'TEMPORARY'
    item.sourceType = item.sourceType || 'RESPONSE_BODY'
    item.extractScope = item.extractScope || processorExtractScopeFromSource(item.sourceType)
    item.extractType = item.extractType || 'JSON_PATH'
    item.expression = item.expression ?? ''
    item.expressionMatchingRule = item.expressionMatchingRule || 'EXPRESSION'
    item.resultMatchingRule = item.resultMatchingRule || 'RANDOM'
    item.resultMatchingRuleNum = item.resultMatchingRuleNum || 1
    item.responseFormat = item.responseFormat || (item.extractType === 'X_PATH' ? 'XML' : 'JSON')
    normalizeProcessorExtractByType(item)
    return item
  }

  function normalizeProcessorExtractItems(items: ApiProcessorExtractItem[] | undefined, processor: ApiProcessorConfig) {
    const source = items?.length
      ? items
      : [createProcessorExtractItem({
          name: processor.name || '提取项',
          variableName: processor.variableName || '',
          sourceType: processor.sourceType || 'RESPONSE_BODY',
          extractType: processor.extractType || 'JSON_PATH',
          expression: processor.expression || '',
          description: processor.description || '',
        })]
    source.forEach(normalizeProcessorExtractItem)
    return source
  }

  function normalizeSqlExtractParams(items: ApiProcessorSqlExtractParam[] | undefined) {
    const rows = Array.isArray(items) ? items : []
    rows.forEach(row => {
      row.key = row.key ?? ''
      row.value = row.value ?? ''
      row.enabled = row.enabled !== false
    })
    return rows
  }

  function addSqlExtractParam(processor: ApiProcessorConfig) {
    processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
    processor.extractParams.push({ key: '', value: '', enabled: true })
    syncProcessorScript(processor)
  }

  function removeSqlExtractParam(processor: ApiProcessorConfig, index: number) {
    const rows = normalizeSqlExtractParams(processor.extractParams)
    rows.splice(index, 1)
    processor.extractParams = rows
    syncProcessorScript(processor)
  }

  function processorDefaultName(stage: 'pre' | 'post', type?: string) {
    if (type === 'SCRIPT') return stage === 'pre' ? '前置脚本' : '后置脚本'
    if (type === 'SQL') return 'SQL 处理器'
    if (type === 'TIME_WAITING') return '等待处理器'
    if (type === 'EXTRACT') return '提取处理器'
    return stage === 'pre' ? '前置处理器' : '后置处理器'
  }

  function processorTypeLabel(type?: string | null) {
    if (type === 'SCRIPT') return '脚本处理器'
    if (type === 'SQL') return 'SQL 处理器'
    if (type === 'TIME_WAITING') return '等待处理器'
    if (type === 'EXTRACT') return '提取处理器'
    return type || '处理器'
  }

  function addProcessor(stage: 'pre' | 'post', type = 'SCRIPT') {
    if (!options.activeEditor.value) return
    const processor = createProcessor(stage, type)
    processorRowsFor(options.activeEditor.value.detail, stage).push(processor)
    activeProcessorId.value = processor.id || ''
    options.markDirty()
  }

  function addProcessorFromCommand(stage: 'pre' | 'post', command: string | number | object) {
    const type = String(command)
    if (stage === 'pre' && type === 'EXTRACT') {
      return
    }
    addProcessor(stage, type)
  }

  function removeProcessor(stage: 'pre' | 'post', index: number) {
    if (!options.activeEditor.value) return
    const rows = processorRowsFor(options.activeEditor.value.detail, stage)
    const removed = rows.splice(index, 1)
    if (removed.some(item => item.id === activeProcessorId.value)) {
      activeProcessorId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
    }
    options.markDirty()
  }

  function copyProcessor(stage: 'pre' | 'post', index: number) {
    if (!options.activeEditor.value) return
    const rows = processorRowsFor(options.activeEditor.value.detail, stage)
    const source = rows[index]
    if (!source) return
    const copied = {
      ...options.clone(source),
      id: `${stage}-${String(source.processorType || 'SCRIPT').toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${source.name || processorDefaultName(stage, source.processorType)} 副本`,
    }
    rows.splice(index + 1, 0, copied)
    activeProcessorId.value = copied.id || ''
    options.markDirty()
  }

  function moveProcessor(stage: 'pre' | 'post', index: number, direction: -1 | 1) {
    if (!options.activeEditor.value) return
    const rows = processorRowsFor(options.activeEditor.value.detail, stage)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= rows.length) return
    const [row] = rows.splice(index, 1)
    rows.splice(targetIndex, 0, row)
    activeProcessorId.value = row.id || ''
    options.markDirty()
  }

  function selectProcessor(processor: ApiProcessorConfig) {
    activeProcessorId.value = processor.id || ''
  }

  function syncProcessorScript(processor: ApiProcessorConfig) {
    if (processor.processorType === 'SQL') {
      processor.script = processor.sql ?? ''
    } else if (processor.processorType === 'EXTRACT') {
      const firstExtractor = processor.extractors?.[0]
      processor.expression = firstExtractor?.expression ?? processor.expression ?? ''
      processor.variableName = firstExtractor?.variableName ?? processor.variableName ?? ''
      processor.sourceType = firstExtractor?.sourceType ?? processor.sourceType ?? 'RESPONSE_BODY'
      processor.extractType = firstExtractor?.extractType ?? processor.extractType ?? 'JSON_PATH'
      processor.script = processor.expression ?? ''
    }
    options.markDirty()
  }

  function addProcessorExtractItem(processor: ApiProcessorConfig) {
    processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
    processor.extractors.push(createProcessorExtractItem())
    syncProcessorScript(processor)
  }

  function copyProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
    const rows = normalizeProcessorExtractItems(processor.extractors, processor)
    const source = rows[index]
    if (!source) return
    rows.splice(index + 1, 0, { ...options.clone(source), id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
    processor.extractors = rows
    syncProcessorScript(processor)
  }

  function removeProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
    const rows = normalizeProcessorExtractItems(processor.extractors, processor)
    rows.splice(index, 1)
    if (!rows.length) rows.push(createProcessorExtractItem())
    processor.extractors = rows
    syncProcessorScript(processor)
  }

  return {
    activeProcessor,
    processorExtractMoreSettingsVisibleKey,
    activeProcessorRows,
    activeProcessorStage,
    normalizeSqlExtractParams,
    normalizeProcessorExtractItems,
    processorExtractScopeOptions,
    processorDefaultName,
    processorTypeLabel,
    processorExtractExpressionPlaceholder,
    showProcessorExtractSpecificIndex,
    showProcessorExtractRegexSettings,
    showProcessorExtractXPathSettings,
    addProcessorFromCommand,
    selectProcessor,
    moveProcessor,
    copyProcessor,
    removeProcessor,
    syncProcessorScript,
    addSqlExtractParam,
    removeSqlExtractParam,
    addProcessorExtractItem,
    copyProcessorExtractItem,
    removeProcessorExtractItem,
    handleProcessorExtractTypeChange,
    handleProcessorExtractScopeChange,
    setProcessorExtractMoreSettingsVisible,
  }
}
