<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle2, ChevronRight, CircleX, Search, X } from '@lucide/vue'
import type { FastExtractionConfig, FastExtractionMode } from './fastExtraction'
import {
  buildJsonPathSegment,
  testFastExtraction,
} from './fastExtraction'

interface JsonTreeNode {
  id: string
  label: string | number
  path: string
  depth: number
  value: unknown
  isContainer: boolean
  preview?: string
  children?: JsonTreeNode[]
}

const props = withDefaults(defineProps<{
  visible: boolean
  response?: string | null
  mode: FastExtractionMode
  config?: FastExtractionConfig
  source?: 'assertion' | 'extractor'
}>(), {
  response: '',
  config: () => ({}),
  source: 'assertion',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  apply: [config: FastExtractionConfig, matchResult: string[]]
}>()

const drawerVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})
const expressionForm = ref<FastExtractionConfig>(createForm())
const matchResult = ref<string[]>([])
const matched = ref(false)
const jsonParseError = ref('')
function createForm(): FastExtractionConfig {
  return {
    extractType: props.mode,
    expression: props.config?.expression || '',
    expressionMatchingRule: props.config?.expressionMatchingRule || 'EXPRESSION',
    responseFormat: props.config?.responseFormat || (props.mode === 'X_PATH' ? 'XML' : 'JSON'),
  }
}

const sourceLabel = computed(() => props.source === 'extractor' ? '提取变量' : '响应体断言')
const sourceClass = computed(() => props.source === 'extractor' ? 'is-extractor' : 'is-assertion')
const responseContentType = computed(() => {
  if (expressionForm.value.extractType === 'JSON_PATH') return 'application/json'
  if (expressionForm.value.extractType === 'X_PATH') return 'application/xml'
  return 'text/plain'
})
const expressionPlaceholder = computed(() => {
  if (expressionForm.value.extractType === 'JSON_PATH') return '$.data.token'
  if (expressionForm.value.extractType === 'X_PATH') return '/response/data/token'
  return '"token":"([^\"]+)"'
})

function selectMode(mode: FastExtractionMode) {
  expressionForm.value = {
    ...expressionForm.value,
    extractType: mode,
    expression: '',
  }
  matchResult.value = []
  matched.value = false
}

function stringifyPreview(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

function buildJsonTree(value: unknown, label: string | number = '', path = '$', depth = 0): JsonTreeNode {
  if (Array.isArray(value)) {
    return {
      id: `json-${path}`,
      label,
      path,
      depth,
      value,
      isContainer: true,
      preview: `Array [${value.length}]`,
      children: value.map((item, index) => buildJsonTree(item, index, buildJsonPathSegment(path, index), depth + 1)),
    }
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return {
      id: `json-${path}`,
      label,
      path,
      depth,
      value,
      isContainer: true,
      preview: 'Object',
      children: entries.map(([key, item]) => buildJsonTree(item, key, buildJsonPathSegment(path, key), depth + 1)),
    }
  }
  return { id: `json-${path}`, label, path, depth, value, isContainer: false, preview: stringifyPreview(value) }
}

const jsonTreeData = computed(() => {
  if (expressionForm.value.extractType !== 'JSON_PATH') return []
  jsonParseError.value = ''
  try {
    return [buildJsonTree(JSON.parse(props.response || '{}'))]
  } catch (error) {
    jsonParseError.value = (error as Error).message
    return []
  }
})

const jsonOpenPaths = ref(new Set<string>())

function collectDefaultOpenPaths(node: JsonTreeNode, paths: Set<string>) {
  if (!node.isContainer) return
  if (node.depth < 2) paths.add(node.path)
  node.children?.forEach(child => collectDefaultOpenPaths(child, paths))
}

watch(jsonTreeData, tree => {
  const paths = new Set<string>()
  tree.forEach(node => collectDefaultOpenPaths(node, paths))
  jsonOpenPaths.value = paths
}, { immediate: true })

function flattenJsonTree(nodes: JsonTreeNode[], openPaths: Set<string>): JsonTreeNode[] {
  return nodes.flatMap(node => [node, ...(node.isContainer && openPaths.has(node.path) ? flattenJsonTree(node.children || [], openPaths) : [])])
}

const visibleJsonNodes = computed(() => flattenJsonTree(jsonTreeData.value, jsonOpenPaths.value))

function handleNodePick(data: JsonTreeNode) {
  expressionForm.value.expression = data.path
}

function toggleJsonNode(node: JsonTreeNode) {
  if (!node.isContainer) {
    handleNodePick(node)
    return
  }
  const paths = new Set(jsonOpenPaths.value)
  if (paths.has(node.path)) paths.delete(node.path)
  else paths.add(node.path)
  jsonOpenPaths.value = paths
}

function formatJsonValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

function jsonValueClass(value: unknown): string {
  if (value === null) return 'is-null'
  if (typeof value === 'string') return 'is-string'
  if (typeof value === 'number') return 'is-number'
  if (typeof value === 'boolean') return 'is-boolean'
  return 'is-value'
}

function testExpression() {
  try {
    matchResult.value = testFastExtraction(props.response || '', expressionForm.value)
  } catch {
    matchResult.value = []
  }
  matched.value = true
}

function confirmApply() {
  if (!expressionForm.value.expression?.trim()) return
  if (!matched.value) testExpression()
  emit('apply', { ...expressionForm.value, extractType: expressionForm.value.extractType || props.mode }, [...matchResult.value])
  drawerVisible.value = false
}

watch(
  () => [props.visible, props.mode, props.config] as const,
  ([visible]) => {
    if (!visible) return
    expressionForm.value = createForm()
    matchResult.value = []
    matched.value = false
  },
  { deep: true },
)
</script>

<template>
  <el-drawer v-model="drawerVisible" :with-header="false" size="720px" class="api-fast-extraction-drawer-shell" append-to-body destroy-on-close>
    <div class="fast-extraction-drawer">
      <header class="fast-extraction-header">
        <h2>快速提取</h2>
        <span :class="['fast-extraction-source', sourceClass]">{{ sourceLabel }}</span>
        <span class="fast-extraction-header-spacer" />
        <button type="button" class="fast-extraction-close" aria-label="关闭" @click="drawerVisible = false"><X :size="16" /></button>
      </header>
      <nav class="fast-extraction-tabs" aria-label="提取方式">
        <button v-for="item in [{ value: 'JSON_PATH', label: 'JSONPath' }, { value: 'X_PATH', label: 'XPath' }, { value: 'REGEX', label: 'Regex' }]" :key="item.value" type="button" :class="{ 'is-active': expressionForm.extractType === item.value }" @click="selectMode(item.value as FastExtractionMode)">{{ item.label }}</button>
      </nav>
      <div class="fast-extraction-body">
        <section class="fast-extraction-section fast-extraction-response-section">
          <h3>响应内容</h3>
          <div class="fast-extraction-response">
            <div class="fast-extraction-response-meta"><span class="fast-extraction-status-dot" /><span>200 OK · 128ms</span><span class="fast-extraction-content-type">{{ responseContentType }}</span></div>
            <div class="fast-extraction-response-content">
              <div v-if="expressionForm.extractType === 'JSON_PATH'" class="fast-extraction-tree-shell">
                <div v-if="jsonParseError" class="fast-extraction-empty">当前响应内容不是合法 JSON：{{ jsonParseError }}</div>
                <div v-else class="fast-extraction-tree">
                  <div
                    v-for="node in visibleJsonNodes"
                    :key="node.id"
                    class="fast-extraction-tree-node"
                    :style="{ paddingLeft: `${node.depth > 0 ? node.depth * 16 : 0}px` }"
                    @click="toggleJsonNode(node)"
                  >
                    <span class="fast-extraction-tree-chevron">
                      <ChevronRight v-if="node.isContainer" :size="11" :class="{ 'is-open': jsonOpenPaths.has(node.path) }" />
                    </span>
                    <span class="fast-extraction-tree-label">
                      <template v-if="node.label !== ''"><span class="fast-extraction-tree-key">{{ node.label }}</span><span class="fast-extraction-tree-punctuation">: </span></template>
                      <span v-if="node.isContainer" class="fast-extraction-tree-preview">{{ node.preview }}</span>
                      <span v-else :class="['fast-extraction-tree-value', jsonValueClass(node.value)]">{{ formatJsonValue(node.value) }}</span>
                    </span>
                    <button v-if="!node.isContainer" type="button" class="fast-extraction-tree-pick" @click.stop="handleNodePick(node)">选取</button>
                  </div>
                </div>
              </div>
              <pre v-else class="fast-extraction-code">{{ props.response || '' }}</pre>
            </div>
          </div>
          <p class="fast-extraction-help">{{ expressionForm.extractType === 'JSON_PATH' ? '点击字段值自动生成 JSONPath，点击对象 / 数组节点展开' : expressionForm.extractType === 'X_PATH' ? '手动输入 XPath 表达式，或参考上方节点结构' : '在下方输入正则表达式，支持分组捕获' }}</p>
        </section>
        <section class="fast-extraction-section fast-extraction-config-section">
          <h3>表达式配置</h3>
          <div class="fast-extraction-input-row"><el-input v-model="expressionForm.expression" :placeholder="expressionPlaceholder" maxlength="255" /><el-button type="primary" :disabled="!expressionForm.expression?.trim()" @click="testExpression">测试</el-button></div>
          <div v-if="expressionForm.extractType === 'REGEX'" class="fast-extraction-option-row"><span>匹配内容</span><label><input v-model="expressionForm.expressionMatchingRule" type="radio" value="EXPRESSION" />完整匹配</label><label><input v-model="expressionForm.expressionMatchingRule" type="radio" value="GROUP" />分组 1</label></div>
          <div v-if="expressionForm.extractType === 'X_PATH'" class="fast-extraction-option-row"><span>文档格式</span><label><input v-model="expressionForm.responseFormat" type="radio" value="XML" />XML</label><label><input v-model="expressionForm.responseFormat" type="radio" value="HTML" />HTML</label></div>
        </section>
        <section class="fast-extraction-section fast-extraction-match-section">
          <h3>匹配结果</h3>
          <div v-if="!matched" class="fast-extraction-result-empty"><Search :size="22" /><span>点击「测试」查看匹配结果</span></div>
          <div v-else-if="matchResult.length" class="fast-extraction-result-list"><div v-for="(result, index) in matchResult" :key="`${index}-${result}`" class="fast-extraction-result-item"><CheckCircle2 :size="14" /><span>{{ result }}</span><small>#{{ index + 1 }}</small></div></div>
          <div v-else class="fast-extraction-result-empty"><CircleX :size="22" /><span>未匹配到结果，请检查表达式</span></div>
        </section>
      </div>
    </div>
    <template #footer>
      <div class="fast-extraction-footer"><el-button @click="drawerVisible = false">取消</el-button><el-button type="primary" :disabled="!expressionForm.expression?.trim()" @click="confirmApply">确认回填</el-button></div>
    </template>
  </el-drawer>
</template>

<style scoped>
:global(.api-fast-extraction-drawer-shell) { font-family: Inter, "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Arial, sans-serif; }
:global(.api-fast-extraction-drawer-shell .el-drawer__body) { padding: 0; overflow: hidden; }
:global(.api-fast-extraction-drawer-shell .el-drawer__footer) { box-sizing: border-box; height: 57px; padding: 12px 20px; border-top: 1px solid #e5e6eb; }
:global(.api-fast-extraction-drawer-shell .el-button),
:global(.api-fast-extraction-drawer-shell .el-input__inner) { font-family: inherit; }
:global(.api-fast-extraction-drawer-shell .el-button) { box-sizing: border-box; min-height: 0; line-height: 1; }
.fast-extraction-drawer { display: flex; height: 100%; min-height: 0; flex-direction: column; background: #fff; color: #1d2129; }
.fast-extraction-header { display: flex; height: 57px; box-sizing: border-box; flex: 0 0 57px; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid #e5e6eb; }
.fast-extraction-header h2 { margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.fast-extraction-source { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; line-height: 16.5px; }
.fast-extraction-source.is-assertion { color: #7816ff; background: #f0e8ff; }
.fast-extraction-source.is-extractor { color: #00b42a; background: #e6f9ec; }
.fast-extraction-header-spacer { flex: 1; }
.fast-extraction-close { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #86909c; cursor: pointer; }
.fast-extraction-close:hover { background: #f2f3f5; }
.fast-extraction-tabs { display: flex; height: 41.5px; box-sizing: border-box; flex: 0 0 41.5px; align-items: flex-start; padding: 0 20px; border-bottom: 1px solid #e5e6eb; }
.fast-extraction-tabs button { height: 41.5px; padding: 10px 16px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #4e5969; cursor: pointer; font-size: 13px; font-weight: 400; line-height: 19.5px; }
.fast-extraction-tabs button.is-active { border-bottom-color: #165dff; color: #165dff; font-weight: 600; }
.fast-extraction-body { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 20px; overflow-y: auto; padding: 20px; }
.fast-extraction-section { display: flex; flex: 0 0 auto; flex-direction: column; width: 100%; }
.fast-extraction-section h3 { margin: 0; color: #4e5969; font-size: 12px; font-weight: 600; line-height: 18px; }
.fast-extraction-response-section { min-height: 340.5px; }
.fast-extraction-response { margin-top: 8px; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 8px; }
.fast-extraction-response-meta { display: flex; height: 30px; box-sizing: border-box; align-items: center; gap: 6px; padding: 6px 12px; border-bottom: 1px solid #e5e6eb; background: #f8f9fc; color: #86909c; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.fast-extraction-status-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 3.5px; background: #00b42a; }
.fast-extraction-content-type { margin-left: auto; color: #c9cdd4; font-weight: 400; }
.fast-extraction-response-content { box-sizing: border-box; min-height: 240px; max-height: 260px; height: auto; overflow: auto; padding: 10px 12px; background: #fff; }
.fast-extraction-tree-shell { min-height: 100%; overflow: auto; }
.fast-extraction-tree { padding: 0; }
.fast-extraction-tree-node { display: flex; min-height: 24px; box-sizing: border-box; align-items: center; gap: 4px; padding-top: 2px; padding-right: 4px; padding-bottom: 2px; border-radius: 4px; cursor: pointer; user-select: none; }
.fast-extraction-tree-node:hover { background: #f4f6fa; }
.fast-extraction-tree-chevron { display: inline-flex; width: 14px; height: 18px; flex: 0 0 14px; align-items: center; justify-content: center; color: #86909c; }
.fast-extraction-tree-chevron svg { transition: transform .12s; }
.fast-extraction-tree-chevron svg.is-open { transform: rotate(90deg); }
.fast-extraction-tree-label { display: inline-flex; min-width: 0; align-items: baseline; color: #1d2129; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; line-height: 18px; }
.fast-extraction-tree-key { color: #1d2129; font-weight: 500; }
.fast-extraction-tree-punctuation { color: #86909c; }
.fast-extraction-tree-preview { color: #86909c; }
.fast-extraction-tree-value { word-break: break-word; }
.fast-extraction-tree-value.is-string { color: #00b42a; }
.fast-extraction-tree-value.is-number { color: #165dff; }
.fast-extraction-tree-value.is-boolean { color: #ff7d00; }
.fast-extraction-tree-value.is-null { color: #86909c; }
.fast-extraction-tree-pick { margin-left: auto; padding: 1px 7px; border: 0; border-radius: 4px; background: #e8f3ff; color: #165dff; cursor: pointer; font-size: 10px; font-weight: 500; opacity: 0; white-space: nowrap; }
.fast-extraction-tree-node:hover .fast-extraction-tree-pick { opacity: 1; }
.fast-extraction-code { margin: 0; color: #1d2129; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; line-height: 20.4px; white-space: pre-wrap; word-break: break-word; }
.fast-extraction-help { margin: 6px 0 0; color: #86909c; font-size: 11px; line-height: 16.5px; }
.fast-extraction-config-section { min-height: 88px; }
.fast-extraction-input-row { display: flex; align-items: center; gap: 8px; padding-top: 8px; }
.fast-extraction-input-row .el-input { flex: 1; }
.fast-extraction-input-row :deep(.el-input__wrapper) { height: 34px; min-height: 34px; padding: 0 12px; border-radius: 8px; box-shadow: inset 0 0 0 1px #e5e6eb; }
.fast-extraction-input-row :deep(.el-input__inner) { color: #1d2129; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; }
.fast-extraction-input-row :deep(.el-button) { height: 34px; padding: 0 20px; border: 0; border-radius: 8px; font-size: 13px; font-weight: 500; }
.fast-extraction-option-row { display: flex; height: 28px; align-items: center; gap: 12px; padding-top: 10px; color: #86909c; font-size: 12px; line-height: 18px; }
.fast-extraction-option-row label { display: inline-flex; align-items: center; gap: 4px; color: #1d2129; cursor: pointer; font-weight: 500; }
.fast-extraction-option-row input { width: 13px; height: 13px; margin: 0; accent-color: #165dff; }
.fast-extraction-match-section { min-height: 141px; }
.fast-extraction-result-empty { display: flex; min-height: 123px; box-sizing: border-box; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 32px 0; color: #c9cdd4; font-size: 12px; line-height: 18px; }
.fast-extraction-result-empty svg { color: #c9cdd4; opacity: .45; }
.fast-extraction-result-list { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; }
.fast-extraction-result-item { display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; border: 1px solid rgba(0, 180, 42, .25); border-radius: 8px; background: #f0fff4; color: #1d2129; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; line-height: 19px; word-break: break-all; }
.fast-extraction-result-item svg { flex: 0 0 auto; margin-top: 2px; color: #00b42a; }
.fast-extraction-result-item small { margin-left: auto; color: #c9cdd4; font-family: inherit; font-size: 11px; }
.fast-extraction-footer { display: flex; width: 100%; align-items: center; justify-content: flex-end; gap: 8px; }
.fast-extraction-footer :deep(.el-button) { height: 32px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; }
</style>
