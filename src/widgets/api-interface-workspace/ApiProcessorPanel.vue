<script setup lang="ts">
import { ArrowDown, ArrowUp, MagicStick, MoreFilled } from '@element-plus/icons-vue'
import ApiCodeEditor from './ApiCodeEditor.vue'

interface ProcessorOption {
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

const props = defineProps<{
  stage: 'pre' | 'post'
  rows: ApiProcessorPanelRow[]
  activeProcessor: ApiProcessorPanelRow | null
  typeOptions: ProcessorOption[]
  extractVariableTypeOptions: ProcessorOption[]
  extractTypeOptions: ProcessorOption[]
  hasLatestResponseBody: boolean
  fastExtractionTitle: string
  moreSettingsVisibleKey: string | null
  processorDefaultName: (stage: 'pre' | 'post', type?: string) => string
  processorTypeLabel: (type?: string | null) => string
  normalizeSqlExtractParams: (items: ApiProcessorSqlExtractParamRow[] | undefined) => ApiProcessorSqlExtractParamRow[]
  normalizeProcessorExtractItems: (items: ApiProcessorExtractItemRow[] | undefined, processor: ApiProcessorPanelRow) => ApiProcessorExtractItemRow[]
  processorExtractScopeOptions: (item: ApiProcessorExtractItemRow) => ProcessorOption[]
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

function add(command: string | number | object) {
  emit('addFromCommand', props.stage, command)
}

function activeIndex() {
  return props.activeProcessor ? props.rows.indexOf(props.activeProcessor) : -1
}

function setMoreSettingsVisible(index: number, visible: boolean) {
  emit('setMoreSettingsVisible', props.activeProcessor?.id, index, visible)
}
</script>

<template>
  <div class="api-processor-panel">
    <div class="api-advanced-toolbar">
      <div>
        <strong>{{ stage === 'pre' ? '前置处理' : '后置处理' }}</strong>
        <span>{{ stage === 'pre' ? '请求发送前执行' : '响应返回后执行' }}</span>
      </div>
      <el-dropdown trigger="click" @command="add">
        <button type="button" class="api-sidebar-primary">添加处理器</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in typeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="api-processor-editor">
      <aside class="api-processor-sidebar">
        <div class="api-processor-toolbar">
          <el-dropdown trigger="click" @command="add">
            <button type="button" class="api-legacy-primary">添加</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in typeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div v-if="rows.length" class="api-processor-sidebar-list">
          <button
            v-for="(processor, index) in rows"
            :key="processor.id || index"
            type="button"
            :class="['api-processor-list-item', { 'is-active': activeProcessor?.id === processor.id }]"
            @click="emit('select', processor)"
          >
            <span class="api-processor-list-item__main">
              <el-switch v-model="processor.enabled" size="small" @click.stop @change="emit('dirty')" />
              <span class="api-processor-list-copy">
                <span class="api-processor-list-title">{{ processor.name || processorDefaultName(stage, processor.processorType) }}</span>
                <span class="api-processor-list-meta">{{ processorTypeLabel(processor.processorType) }}</span>
              </span>
            </span>
            <span class="api-processor-list-actions">
              <el-button text :icon="ArrowUp" :disabled="index === 0" @click.stop="emit('move', stage, index, -1)" />
              <el-button text :icon="ArrowDown" :disabled="index === rows.length - 1" @click.stop="emit('move', stage, index, 1)" />
            </span>
          </button>
        </div>
        <div v-else class="api-processor-empty">暂无处理器</div>
      </aside>

      <section class="api-processor-detail">
        <template v-if="activeProcessor">
          <div class="api-processor-detail-header">
            <div class="api-processor-detail-fields">
              <el-input v-model="activeProcessor.name" placeholder="处理器名称" @input="emit('dirty')" />
              <el-tag size="small" effect="plain">{{ processorTypeLabel(activeProcessor.processorType) }}</el-tag>
            </div>
            <div class="api-processor-detail-actions">
              <button type="button" @click="emit('copy', stage, activeIndex())">复制</button>
              <button type="button" class="api-row-remove" @click="emit('remove', stage, activeIndex())">删除</button>
            </div>
          </div>

          <template v-if="activeProcessor.processorType === 'SCRIPT'">
            <div class="api-processor-editor-actions">
              <span class="api-processor-language-tag">JavaScript</span>
              <button type="button" @click="activeProcessor.script = ''; emit('dirty')">清空</button>
              <button type="button" @click="activeProcessor.script = (activeProcessor.script || '').trim(); emit('dirty')">格式化</button>
            </div>
            <ApiCodeEditor v-model="activeProcessor.script" height="360px" language="javascript" placeholder="请输入 JavaScript 脚本" @change="emit('dirty')" />
            <div class="api-processor-hint">可使用 setVar / getVar / removeVar / log / fail / request / response。</div>
          </template>

          <template v-else-if="activeProcessor.processorType === 'SQL'">
            <div class="api-processor-form-grid">
              <label><span>数据库连接</span><el-select v-model="activeProcessor.dataSourceName" filterable clearable allow-create default-first-option placeholder="选择数据库连接" @change="emit('dirty')" /></label>
              <label><span>查询超时(ms)</span><el-input-number v-model="activeProcessor.queryTimeout" :min="1000" :step="1000" @change="emit('dirty')" /></label>
              <label><span>按列存储变量</span><el-input v-model="activeProcessor.variableNames" placeholder="id,email" @input="emit('dirty')" /></label>
              <label><span>完整结果变量</span><el-input v-model="activeProcessor.resultVariable" placeholder="resultJson" @input="emit('dirty')" /></label>
            </div>
            <ApiCodeEditor v-model="activeProcessor.sql" height="260px" language="sql" placeholder="请输入 SQL 语句" @change="emit('syncScript', activeProcessor)" />
            <div class="api-sql-extract-table">
              <div class="api-sql-extract-table__header"><span>变量名</span><span>列名</span><span></span></div>
              <div v-for="(param, sqlParamIndex) in normalizeSqlExtractParams(activeProcessor.extractParams)" :key="`${activeProcessor.id}-sql-${sqlParamIndex}`" class="api-sql-extract-table__row">
                <el-input v-model="param.key" placeholder="变量名" @input="emit('dirty')" />
                <el-input v-model="param.value" placeholder="列名" @input="emit('dirty')" />
                <button type="button" class="api-row-remove" @click="emit('removeSqlExtractParam', activeProcessor, sqlParamIndex)">删除</button>
              </div>
              <button type="button" class="api-sql-extract-table__add" @click="emit('addSqlExtractParam', activeProcessor)">+ 添加提取参数</button>
            </div>
          </template>

          <template v-else-if="activeProcessor.processorType === 'EXTRACT'">
            <div class="api-processor-extract-panel">
              <div class="api-processor-extract-toolbar"><span>提取参数</span><button type="button" @click="emit('addExtractItem', activeProcessor)">+ 添加提取项</button></div>
              <div class="api-processor-extract-scroll">
                <div class="api-processor-extract-grid">
                  <div class="api-processor-extract-header"><span>变量名</span><span>描述</span><span>变量类型</span><span>提取方式</span><span>提取范围</span><span>表达式</span><span>操作</span></div>
                  <div v-for="(item, extractIndex) in normalizeProcessorExtractItems(activeProcessor.extractors, activeProcessor)" :key="item.id || extractIndex" class="api-processor-extract-row">
                    <el-input v-model="item.variableName" placeholder="例如 token" @input="emit('syncScript', activeProcessor)" />
                    <el-input v-model="item.description" placeholder="可选" @input="emit('syncScript', activeProcessor)" />
                    <el-select v-model="item.variableType" @change="emit('syncScript', activeProcessor)"><el-option v-for="option in extractVariableTypeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                    <el-select v-model="item.extractType" @change="emit('extractTypeChange', activeProcessor, item)"><el-option v-for="option in extractTypeOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                    <el-select v-model="item.extractScope" :disabled="item.extractType !== 'REGEX'" @change="emit('extractScopeChange', activeProcessor, item)"><el-option v-for="option in processorExtractScopeOptions(item)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
                    <el-input v-model="item.expression" :placeholder="processorExtractExpressionPlaceholder(item)" @input="emit('syncScript', activeProcessor)">
                      <template #suffix>
                        <button type="button" :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]" :disabled="!hasLatestResponseBody" :title="fastExtractionTitle" @click.stop="emit('openFastExtraction', activeProcessor, item)">
                          <el-icon><MagicStick /></el-icon>
                        </button>
                      </template>
                    </el-input>
                    <span class="api-processor-extract-actions">
                      <el-popover placement="bottom-end" :width="340" trigger="click" :visible="moreSettingsVisibleKey === `${activeProcessor?.id || ''}-${extractIndex}`" @update:visible="setMoreSettingsVisible(extractIndex, $event)">
                        <template #reference><button type="button" class="api-processor-extract-more" aria-label="更多设置"><el-icon><MoreFilled /></el-icon></button></template>
                        <div class="api-processor-extract-more-panel">
                          <button type="button" class="api-processor-extract-copy" @click="emit('copyExtractItem', activeProcessor, extractIndex)">复制当前提取项</button>
                          <div class="api-processor-extract-more-divider"></div>
                          <div class="api-processor-extract-more-title">高级设置</div>
                          <div class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">结果匹配规则</div><el-radio-group v-model="item.resultMatchingRule" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="RANDOM">随机</el-radio><el-radio value="SPECIFIC">指定</el-radio><el-radio value="ALL">全部</el-radio></el-radio-group></div>
                          <div v-if="showProcessorExtractSpecificIndex(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">指定序号</div><el-input-number v-model="item.resultMatchingRuleNum" :min="1" :step="1" size="small" @change="emit('syncScript', activeProcessor)" /></div>
                          <div v-if="showProcessorExtractRegexSettings(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">正则匹配规则</div><el-radio-group v-model="item.expressionMatchingRule" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="EXPRESSION">整段匹配</el-radio><el-radio value="GROUP">分组 1</el-radio></el-radio-group></div>
                          <div v-if="showProcessorExtractXpathSettings(item)" class="api-processor-extract-more-group"><div class="api-processor-extract-more-label">内容格式</div><el-radio-group v-model="item.responseFormat" size="small" @change="emit('syncScript', activeProcessor)"><el-radio value="XML">XML</el-radio><el-radio value="HTML">HTML</el-radio></el-radio-group></div>
                        </div>
                      </el-popover>
                      <button type="button" class="api-row-remove api-processor-extract-delete" aria-label="删除提取项" @click="emit('removeExtractItem', activeProcessor, extractIndex)">删除</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="api-processor-form-row"><span class="api-processor-form-label">等待时长(ms)</span><el-input-number v-model="activeProcessor.delayMs" :min="1" :max="600000" :step="100" @change="emit('dirty')" /></div>
          </template>

          <el-input v-model="activeProcessor.description" placeholder="说明" @input="emit('dirty')" />
        </template>
        <div v-else class="api-processor-empty api-processor-empty--inline">请选择一个处理器进行编辑</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.api-processor-panel{display:grid;grid-template-columns:1fr;gap:12px;min-height:0;max-width:none;padding-bottom:2px}
.api-advanced-toolbar{display:none}
.api-processor-editor{display:grid;grid-template-columns:minmax(220px,260px) minmax(0,1fr);gap:12px;min-height:360px;color:var(--app-text-primary)}
.api-processor-sidebar,.api-processor-detail{min-height:0;overflow:hidden;border:1px solid var(--app-border);border-radius:var(--app-radius-lg);background:var(--app-bg-panel);box-shadow:var(--app-shadow-xs)}
.api-processor-sidebar{display:flex;flex-direction:column}
.api-processor-toolbar{display:flex;height:48px;align-items:center;justify-content:flex-start;padding:0 12px;border-bottom:1px solid var(--app-border-soft);background:var(--app-bg-panel)}
.api-legacy-primary{height:32px;padding:0 16px;border:1px solid var(--app-primary);border-radius:var(--app-radius-md);background:var(--app-primary);color:#fff;cursor:pointer;font-size:13px;font-weight:500}
.api-legacy-primary:hover{border-color:var(--app-primary-hover);background:var(--app-primary-hover)}
.api-processor-sidebar-list{display:flex;flex-direction:column;gap:6px;padding:8px;overflow-x:hidden}
.api-processor-list-item{display:flex;min-height:44px;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;border:1px solid transparent;border-radius:var(--app-radius-md);background:var(--app-bg-panel);color:var(--app-text-primary);cursor:pointer;text-align:left;transition:background-color .15s ease,border-color .15s ease}
.api-processor-list-item:hover{background:var(--app-bg-page)}
.api-processor-list-item.is-active{border-color:#bfdbfe;background:#eff6ff}
.api-processor-list-item__main{display:flex;min-width:0;align-items:center;gap:10px}
.api-processor-list-copy{min-width:0}
.api-processor-list-title,.api-processor-list-meta{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.api-processor-list-title{color:var(--app-text-primary);font-size:13px;font-weight:500;line-height:18px}
.api-processor-list-meta,.api-processor-form-label,.api-processor-hint,.api-processor-form-grid span{color:var(--app-text-muted);font-size:12px;line-height:16px}
.api-processor-list-actions,.api-processor-detail-actions,.api-processor-detail-fields,.api-processor-detail-header,.api-processor-form-row,.api-processor-editor-actions{display:flex;align-items:center;gap:10px}
.api-processor-list-actions{gap:4px}
.api-processor-list-actions :deep(.el-button){width:24px;height:24px;min-height:24px;padding:0;color:var(--app-text-muted)}
.api-processor-list-actions :deep(.el-button:hover){color:var(--app-primary);background:transparent}
.api-processor-list-actions :deep(.el-button.is-disabled){color:var(--app-text-subtle);background:transparent}
.api-processor-detail-actions button,.api-processor-editor-actions button{border:0;background:transparent;color:var(--app-primary);cursor:pointer;font-size:12px;font-weight:500;padding:0}
.api-processor-editor-actions button{height:32px;padding:0 16px;border:1px solid var(--app-border-strong);border-radius:var(--app-radius-md);background:var(--app-bg-panel);color:var(--app-text-primary)}
.api-processor-editor-actions button:hover{border-color:var(--app-primary);color:var(--app-primary);background:var(--app-bg-panel)}
.api-processor-detail{display:flex;flex-direction:column;gap:12px;overflow-x:hidden;overflow-y:visible;padding:12px}
.api-processor-detail-header{justify-content:space-between;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--app-border-soft)}
.api-processor-detail-fields{flex:1;min-width:280px}
.api-processor-detail-fields :deep(.el-input){flex:1}
.api-processor-detail-fields :deep(.el-input__wrapper),.api-processor-form-grid :deep(.el-input__wrapper),.api-processor-form-grid :deep(.el-select__wrapper),.api-processor-extract-row :deep(.el-input__wrapper),.api-processor-extract-row :deep(.el-select__wrapper),.api-sql-extract-table__row :deep(.el-input__wrapper){min-height:32px;border-radius:var(--app-radius-md);background:var(--app-bg-panel);box-shadow:inset 0 0 0 1px var(--app-border-strong)}
.api-processor-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.api-processor-form-grid label{display:flex;flex-direction:column;gap:6px}
.api-processor-form-grid :deep(.el-input-number){width:100%}
.api-processor-form-grid :deep(.el-input-number .el-input__wrapper){min-height:32px;box-shadow:inset 0 0 0 1px var(--app-border-strong)}
.api-processor-language-tag{display:inline-flex;height:24px;align-items:center;padding:0 8px;border:1px solid #bfdbfe;border-radius:var(--app-radius-sm);background:#eff6ff;color:var(--app-primary);font-size:12px;font-weight:600}
.api-processor-empty{display:flex;min-height:240px;align-items:center;justify-content:center;color:var(--app-text-subtle);font-size:13px}
.api-processor-empty--inline{min-height:160px;border:1px dashed var(--app-border-strong);border-radius:var(--app-radius-lg);background:var(--app-bg-page)}
.api-processor-extract-panel{display:grid;gap:8px;min-width:0}
.api-processor-extract-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--app-text-primary);font-size:var(--app-font-size-sm);font-weight:700}
.api-processor-extract-toolbar button,.api-processor-extract-row button{border:0;background:transparent;color:var(--app-primary);cursor:pointer;font-size:var(--app-font-size-xs);font-weight:500;white-space:nowrap}
.api-processor-extract-scroll{min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;scrollbar-width:thin;scrollbar-color:#d7dbe3 transparent}
.api-processor-extract-scroll::-webkit-scrollbar{height:6px}.api-processor-extract-scroll::-webkit-scrollbar-track{background:transparent}.api-processor-extract-scroll::-webkit-scrollbar-thumb{border-radius:999px;background-color:#d7dbe3}
.api-processor-extract-grid{width:max-content;min-width:100%;overflow:visible;border:1px solid var(--app-border);border-radius:var(--app-radius-md);background:var(--app-bg-panel)}
.api-processor-extract-header,.api-processor-extract-row{display:grid;grid-template-columns:150px 150px 130px 110px 96px 220px 56px;align-items:start;gap:8px;padding:8px 12px}
.api-processor-extract-header{min-height:40px;background:var(--app-bg-page);color:var(--app-text-muted);font-size:12px;font-weight:500}
.api-processor-extract-row{min-height:48px;border-top:1px solid var(--app-border-soft)}
.api-processor-extract-row:hover{background:var(--app-bg-page)}
.api-processor-extract-row .api-row-remove{color:var(--app-danger)}
.api-processor-extract-actions{display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:56px;min-height:32px;white-space:nowrap}
.api-processor-extract-more{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:var(--app-radius-sm)}
.api-processor-extract-more .el-icon{width:16px;height:16px;font-size:16px}
.api-processor-extract-delete{min-width:28px}
.api-processor-extract-more-panel{display:flex;flex-direction:column;gap:12px}
.api-processor-extract-copy{align-self:flex-start;border:0;background:transparent;color:var(--app-primary);cursor:pointer;font-size:13px;font-weight:600}
.api-processor-extract-more-divider{height:1px;background:var(--app-border-soft)}
.api-processor-extract-more-title{color:var(--app-text-primary);font-size:13px;font-weight:700}
.api-processor-extract-more-group{display:flex;flex-direction:column;gap:8px}
.api-processor-extract-more-label{color:var(--app-text-muted);font-size:12px;font-weight:600}
.api-sql-extract-table{display:grid;gap:0;overflow:hidden;border:1px solid var(--app-border-soft);border-radius:var(--app-radius-md);background:var(--app-bg-panel)}
.api-sql-extract-table__header,.api-sql-extract-table__row{display:grid;grid-template-columns:minmax(160px,1fr) minmax(160px,1fr) 72px;align-items:center;gap:8px}
.api-sql-extract-table__header{min-height:34px;padding:0 10px;border-bottom:1px solid var(--app-border-soft);background:var(--app-bg-muted);color:var(--app-text-muted);font-size:12px;font-weight:600}
.api-sql-extract-table__row{min-height:42px;padding:6px 10px;border-bottom:1px solid var(--app-border-soft)}
.api-sql-extract-table__row .api-row-remove,.api-sql-extract-table__add{border:0;background:transparent;color:var(--app-primary);cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap}
.api-sql-extract-table__row .api-row-remove,.api-row-remove{color:var(--app-danger)}
.api-sql-extract-table__add{justify-self:start;min-height:34px;padding:0 10px}
.api-fast-extraction-suffix-button{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:4px;background:transparent;color:#165dff;cursor:pointer}
.api-fast-extraction-suffix-button:hover:not(:disabled){background:#eff6ff}
.api-fast-extraction-suffix-button .el-icon{width:16px;height:16px;font-size:16px}
.api-fast-extraction-suffix-button.is-disabled,.api-fast-extraction-suffix-button:disabled{background:transparent;color:#c9cdd4;cursor:not-allowed}
.api-row-remove{border:0;background:transparent;cursor:pointer;font-size:12px;font-weight:500;padding:0}
.api-row-remove:hover{background:var(--app-danger-soft);color:var(--app-danger)}

/* Figma interface workspace visual pass */
.api-processor-panel {
  gap: 14px;
  color: #1d2129;
  font-size: 13px;
}

.api-processor-editor {
  grid-template-columns: minmax(220px, 250px) minmax(0, 1fr);
  gap: 14px;
  min-height: 360px;
}

.api-processor-sidebar,
.api-processor-detail,
.api-processor-extract-grid,
.api-sql-extract-table {
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: none;
}

.api-processor-toolbar {
  height: 40px;
  padding: 0 10.5px;
  border-bottom-color: #e5e6eb;
  background: #fafafa;
}

.api-legacy-primary {
  height: 28px;
  padding: 0 11.5px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 18px;
}

.api-processor-sidebar-list {
  gap: 0;
  padding: 7px;
}

.api-processor-list-item {
  min-height: 34.5px;
  margin: 0;
  padding: 5px 7px;
  border-radius: 7px;
}

.api-processor-list-item.is-active {
  border-color: rgba(255, 125, 0, 0.22);
  background: #fff7e8;
}

.api-processor-list-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.api-processor-list-meta,
.api-processor-form-label,
.api-processor-hint,
.api-processor-form-grid span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-processor-detail {
  gap: 14px;
  padding: 14px;
  overflow: auto;
}

.api-processor-detail-header {
  min-height: 40px;
  padding-bottom: 10px;
  border-bottom-color: #e5e6eb;
}

.api-processor-detail-actions button,
.api-processor-editor-actions button,
.api-processor-extract-toolbar button,
.api-processor-extract-row button,
.api-sql-extract-table__row .api-row-remove,
.api-sql-extract-table__add,
.api-row-remove {
  color: #ff7d00;
  font-size: 12px;
  font-weight: 500;
}

.api-processor-detail-fields :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-select__wrapper),
.api-processor-extract-row :deep(.el-input__wrapper),
.api-processor-extract-row :deep(.el-select__wrapper),
.api-sql-extract-table__row :deep(.el-input__wrapper) {
  min-height: 31.5px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-processor-extract-header,
.api-sql-extract-table__header {
  min-height: 31px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-processor-extract-row,
.api-sql-extract-table__row {
  min-height: 34.5px;
  border-color: #e5e6eb;
}
</style>
