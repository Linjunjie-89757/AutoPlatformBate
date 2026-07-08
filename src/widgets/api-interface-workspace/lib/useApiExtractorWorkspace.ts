import type { ComputedRef } from 'vue'

import type { ApiDefinitionDetail } from '@/entities/api-automation'
import type { EditorTab } from './useApiRequestEditor'

export interface ApiExtractorConfig {
  id?: string
  name?: string
  enabled?: boolean
  source?: string
  sourceType?: string
  extractType?: string
  expressionType?: string
  expression?: string
  variableName?: string
  defaultValue?: string | null
  required?: boolean
  failOnMissing?: boolean
  description?: string | null
}

interface UseApiExtractorWorkspaceOptions {
  activeEditor: ComputedRef<EditorTab | null>
  markDirty: () => void
}

export function useApiExtractorWorkspace(options: UseApiExtractorWorkspaceOptions) {
  function extractorRowsFor(detail: ApiDefinitionDetail): ApiExtractorConfig[] {
    const rows = detail.extractors as ApiExtractorConfig[]
    rows.forEach(normalizeExtractor)
    return rows
  }

  function normalizeExtractor(extractor: ApiExtractorConfig) {
    extractor.enabled = extractor.enabled !== false
    extractor.source = extractor.source || extractor.sourceType || 'RESPONSE_BODY'
    extractor.sourceType = extractor.sourceType || extractor.source
    extractor.extractType = extractor.extractType || extractor.expressionType || 'JSON_PATH'
    extractor.expressionType = extractor.expressionType || extractor.extractType
    extractor.name = extractor.name || extractor.variableName || '响应提取'
    extractor.variableName = extractor.variableName || extractor.name
    extractor.expression = extractor.expression || '$.data'
  }

  function createExtractor(name = '响应提取', expression = '$.data', variableName?: string): ApiExtractorConfig {
    const normalizedName = name.trim() || '响应提取'
    return {
      id: `extractor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedName,
      enabled: true,
      source: 'RESPONSE_BODY',
      sourceType: 'RESPONSE_BODY',
      extractType: 'JSON_PATH',
      expressionType: 'JSON_PATH',
      expression: expression.trim() || '$.data',
      variableName: variableName?.trim() || normalizedName,
      defaultValue: '',
      required: false,
      failOnMissing: false,
      description: '',
    }
  }

  function addExtractor() {
    if (!options.activeEditor.value) return
    extractorRowsFor(options.activeEditor.value.detail).push(createExtractor())
    options.markDirty()
  }

  function removeExtractor(index: number) {
    if (!options.activeEditor.value) return
    extractorRowsFor(options.activeEditor.value.detail).splice(index, 1)
    options.markDirty()
  }

  return {
    extractorRowsFor,
    createExtractor,
    addExtractor,
    removeExtractor,
  }
}
