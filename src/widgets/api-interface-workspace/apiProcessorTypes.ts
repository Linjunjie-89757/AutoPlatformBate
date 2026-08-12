export interface ApiProcessorOption {
  label: string
  value: string
}

export interface ApiProcessorSqlExtractParamRow {
  key?: string | null
  value?: string | null
  enabled?: boolean
}

export interface ApiProcessorExtractItemRow {
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

export interface ApiProcessorPanelRow {
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
  extractParams?: ApiProcessorSqlExtractParamRow[]
  delayMs?: number | null
  expression?: string | null
  variableName?: string | null
  sourceType?: string | null
  extractType?: string | null
  description?: string | null
  extractors?: ApiProcessorExtractItemRow[]
}
