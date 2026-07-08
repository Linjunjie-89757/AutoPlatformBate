import { computed, ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'

import type {
  FastExtractionConfig,
  FastExtractionMode,
  FastExtractionResponseFormat,
} from '../fastExtraction'

interface ApiAssertionConfig {
  assertionType?: string
  type?: string
  expressionType?: string
  expression?: string
  expectedValue?: string
  assertionBodyType?: ApiAssertionExpressionType
  jsonPathAssertion?: ApiAssertionGroupConfig
  xpathAssertion?: ApiAssertionGroupConfig
  regexAssertion?: ApiAssertionGroupConfig
}

type ApiAssertionExpressionType = 'JSON_PATH' | 'X_PATH' | 'REGEX' | 'HEADER' | 'VARIABLE' | 'SCRIPT'

interface ApiAssertionItemConfig {
  expression?: string | null
  expectedValue?: string | null
}

interface ApiAssertionGroupConfig {
  assertions: ApiAssertionItemConfig[]
  responseFormat?: string | null
}

interface ApiProcessorConfig {
  expression?: string | null
}

interface ApiProcessorExtractItem {
  extractType?: string | null
  expression?: string | null
}

type FastExtractionTarget =
  | { kind: 'assertionBody'; assertion: ApiAssertionConfig; item: ApiAssertionItemConfig }
  | { kind: 'processorExtract'; processor: ApiProcessorConfig; item: ApiProcessorExtractItem }

interface UseApiFastExtractionOptions {
  hasLatestResponseBody: ComputedRef<boolean>
  activeAssertionBodyGroup: (assertion: ApiAssertionConfig) => ApiAssertionGroupConfig
  syncProcessorScript: (processor: ApiProcessorConfig) => void
  markDirty: () => void
}

export function useApiFastExtraction(options: UseApiFastExtractionOptions) {
  const fastExtractionVisible = ref(false)
  const fastExtractionTarget = ref<FastExtractionTarget | null>(null)
  const fastExtractionTitle = computed(() => (
    options.hasLatestResponseBody.value ? '从最近响应快速提取' : '请先发送请求，再使用快速提取'
  ))
  const fastExtractionMode = computed<FastExtractionMode>(() => {
    const target = fastExtractionTarget.value
    if (!target) return 'JSON_PATH'
    if (target.kind === 'assertionBody') {
      return normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType)
    }
    return normalizeFastExtractionMode(target.item.extractType)
  })
  const fastExtractionConfig = computed<FastExtractionConfig>(() => {
    const target = fastExtractionTarget.value
    if (!target) return { extractType: 'JSON_PATH', expression: '$' }
    if (target.kind === 'assertionBody') {
      return {
        extractType: normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType),
        expression: target.item.expression || target.assertion.expression || '',
        responseFormat: normalizeFastExtractionResponseFormat(options.activeAssertionBodyGroup(target.assertion).responseFormat),
      }
    }
    return {
      extractType: normalizeFastExtractionMode(target.item.extractType),
      expression: target.item.expression || '',
      responseFormat: 'JSON',
    }
  })

  function normalizeFastExtractionMode(type?: string | null): FastExtractionMode {
    if (type === 'X_PATH' || type === 'REGEX') return type
    return 'JSON_PATH'
  }

  function normalizeFastExtractionResponseFormat(format?: string | null): FastExtractionResponseFormat {
    if (format === 'XML' || format === 'HTML') return format
    return 'JSON'
  }

  function openAssertionFastExtraction(assertion: ApiAssertionConfig, item: ApiAssertionItemConfig) {
    if (!options.hasLatestResponseBody.value) return
    fastExtractionTarget.value = { kind: 'assertionBody', assertion, item }
    fastExtractionVisible.value = true
  }

  function openProcessorFastExtraction(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
    if (!options.hasLatestResponseBody.value) return
    fastExtractionTarget.value = { kind: 'processorExtract', processor, item }
    fastExtractionVisible.value = true
  }

  function applyFastExtraction(config: FastExtractionConfig, matchResult: string[]) {
    const target = fastExtractionTarget.value
    if (!target) return
    const expression = config.expression || ''
    if (target.kind === 'assertionBody') {
      target.assertion.assertionType = 'RESPONSE_BODY'
      target.assertion.type = 'RESPONSE_BODY'
      target.assertion.assertionBodyType = config.extractType || 'JSON_PATH'
      target.assertion.expressionType = target.assertion.assertionBodyType
      const group = options.activeAssertionBodyGroup(target.assertion)
      if (config.responseFormat) group.responseFormat = config.responseFormat
      target.item.expression = expression
      target.assertion.expression = expression
      if (matchResult[0] !== undefined) {
        target.item.expectedValue = matchResult[0]
        target.assertion.expectedValue = matchResult[0]
      }
    } else {
      target.item.extractType = config.extractType || 'JSON_PATH'
      target.item.expression = expression
      options.syncProcessorScript(target.processor)
    }
    options.markDirty()
    ElMessage.success('已回填快速提取表达式')
  }

  return {
    fastExtractionVisible,
    fastExtractionTitle,
    fastExtractionMode,
    fastExtractionConfig,
    openAssertionFastExtraction,
    openProcessorFastExtraction,
    applyFastExtraction,
  }
}
