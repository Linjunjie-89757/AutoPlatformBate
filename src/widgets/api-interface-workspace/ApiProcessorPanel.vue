<script setup lang="ts">
import ApiProcessorDetail from './ApiProcessorDetail.vue'
import ApiProcessorSidebar from './ApiProcessorSidebar.vue'
import type {
  ApiProcessorExtractItemRow,
  ApiProcessorOption,
  ApiProcessorPanelRow,
  ApiProcessorSqlExtractParamRow,
} from './apiProcessorTypes'

export type { ApiProcessorExtractItemRow, ApiProcessorPanelRow, ApiProcessorSqlExtractParamRow } from './apiProcessorTypes'

const props = defineProps<{
  stage: 'pre' | 'post'
  rows: ApiProcessorPanelRow[]
  activeProcessor: ApiProcessorPanelRow | null
  typeOptions: ApiProcessorOption[]
  extractVariableTypeOptions: ApiProcessorOption[]
  extractTypeOptions: ApiProcessorOption[]
  hasLatestResponseBody: boolean
  fastExtractionTitle: string
  moreSettingsVisibleKey: string | null
  processorDefaultName: (stage: 'pre' | 'post', type?: string) => string
  processorTypeLabel: (type?: string | null) => string
  normalizeSqlExtractParams: (items: ApiProcessorSqlExtractParamRow[] | undefined) => ApiProcessorSqlExtractParamRow[]
  normalizeProcessorExtractItems: (items: ApiProcessorExtractItemRow[] | undefined, processor: ApiProcessorPanelRow) => ApiProcessorExtractItemRow[]
  processorExtractScopeOptions: (item: ApiProcessorExtractItemRow) => ApiProcessorOption[]
  processorExtractExpressionPlaceholder: (item: ApiProcessorExtractItemRow) => string
  showProcessorExtractSpecificIndex: (item: ApiProcessorExtractItemRow) => boolean
  showProcessorExtractRegexSettings: (item: ApiProcessorExtractItemRow) => boolean
  showProcessorExtractXpathSettings: (item: ApiProcessorExtractItemRow) => boolean
}>()

const emit = defineEmits<{
  addFromCommand: [stage: 'pre' | 'post', command: string | number | object]
  select: [processor: ApiProcessorPanelRow]
  move: [stage: 'pre' | 'post', index: number, direction: -1 | 1]
  copy: [stage: 'pre' | 'post', index: number]
  remove: [stage: 'pre' | 'post', index: number]
  syncScript: [processor: ApiProcessorPanelRow]
  addSqlExtractParam: [processor: ApiProcessorPanelRow]
  removeSqlExtractParam: [processor: ApiProcessorPanelRow, index: number]
  addExtractItem: [processor: ApiProcessorPanelRow]
  copyExtractItem: [processor: ApiProcessorPanelRow, index: number]
  removeExtractItem: [processor: ApiProcessorPanelRow, index: number]
  extractTypeChange: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  extractScopeChange: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  setMoreSettingsVisible: [processorId: string | undefined, index: number, visible: boolean]
  openFastExtraction: [processor: ApiProcessorPanelRow, item: ApiProcessorExtractItemRow]
  dirty: []
}>()

function activeIndex() {
  return props.activeProcessor ? props.rows.indexOf(props.activeProcessor) : -1
}
</script>

<template>
  <div class="api-processor-panel">
    <div class="api-processor-editor">
      <ApiProcessorSidebar
        :stage="stage"
        :rows="rows"
        :active-processor="activeProcessor"
        :type-options="typeOptions"
        :processor-default-name="processorDefaultName"
        @add="emit('addFromCommand', stage, $event)"
        @select="emit('select', $event)"
        @move="(index, direction) => emit('move', stage, index, direction)"
        @copy="emit('copy', stage, $event)"
        @remove="emit('remove', stage, $event)"
        @dirty="emit('dirty')"
      />
      <ApiProcessorDetail
        :active-processor="activeProcessor"
        :extract-variable-type-options="extractVariableTypeOptions"
        :extract-type-options="extractTypeOptions"
        :has-latest-response-body="hasLatestResponseBody"
        :fast-extraction-title="fastExtractionTitle"
        :more-settings-visible-key="moreSettingsVisibleKey"
        :normalize-sql-extract-params="normalizeSqlExtractParams"
        :normalize-processor-extract-items="normalizeProcessorExtractItems"
        :processor-extract-scope-options="processorExtractScopeOptions"
        :processor-extract-expression-placeholder="processorExtractExpressionPlaceholder"
        :show-processor-extract-specific-index="showProcessorExtractSpecificIndex"
        :show-processor-extract-regex-settings="showProcessorExtractRegexSettings"
        :show-processor-extract-xpath-settings="showProcessorExtractXpathSettings"
        @copy="emit('copy', stage, activeIndex())"
        @remove="emit('remove', stage, activeIndex())"
        @sync-script="emit('syncScript', $event)"
        @add-sql-extract-param="emit('addSqlExtractParam', $event)"
        @remove-sql-extract-param="(processor, index) => emit('removeSqlExtractParam', processor, index)"
        @add-extract-item="emit('addExtractItem', $event)"
        @copy-extract-item="(processor, index) => emit('copyExtractItem', processor, index)"
        @remove-extract-item="(processor, index) => emit('removeExtractItem', processor, index)"
        @extract-type-change="(processor, item) => emit('extractTypeChange', processor, item)"
        @extract-scope-change="(processor, item) => emit('extractScopeChange', processor, item)"
        @set-more-settings-visible="(processorId, index, visible) => emit('setMoreSettingsVisible', processorId, index, visible)"
        @open-fast-extraction="(processor, item) => emit('openFastExtraction', processor, item)"
        @dirty="emit('dirty')"
      />
    </div>
  </div>
</template>

<style src="./styles/api-processor-panel.css"></style>
