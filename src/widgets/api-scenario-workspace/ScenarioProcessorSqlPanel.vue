<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import type {
  DbConnectionLike,
  ScenarioProcessor,
} from './lib/scenarioProcessorEditorTypes'

const props = defineProps<{
  processor: ScenarioProcessor
  dbConnections: DbConnectionLike[]
}>()

const emit = defineEmits<{
  change: []
}>()

function sqlExtractParams() {
  return props.processor.extractParams || (props.processor.extractParams = [])
}

function syncDataSourceName() {
  const selected = props.dbConnections.find(item => item.id === props.processor.dataSourceId)
  props.processor.dataSourceName = selected?.connectionName || selected?.name || ''
  emit('change')
}

function syncSqlScript() {
  props.processor.script = props.processor.sql || ''
  emit('change')
}

function addSqlExtractParam() {
  sqlExtractParams().push({ key: '', value: '', enabled: true })
  emit('change')
}

function removeSqlExtractParam(index: number) {
  sqlExtractParams().splice(index, 1)
  emit('change')
}
</script>

<template>
  <div class="scenario-processor-sql-grid">
    <label class="scenario-advanced-field">
      <span>数据库连接</span>
      <el-select v-model="processor.dataSourceId" filterable clearable placeholder="请选择数据库连接" @change="syncDataSourceName">
        <el-option v-for="item in dbConnections" :key="item.id" :label="item.connectionName || item.name || `连接 ${item.id}`" :value="item.id" />
      </el-select>
    </label>
    <label class="scenario-advanced-field">
      <span>查询超时(ms)</span>
      <el-input-number v-model="processor.queryTimeout" :min="1000" :step="1000" @change="emit('change')" />
    </label>
    <label class="scenario-advanced-field">
      <span>按列存储变量</span>
      <el-input v-model="processor.variableNames" placeholder="id,name,status" @input="emit('change')" />
    </label>
    <label class="scenario-advanced-field">
      <span>完整结果变量</span>
      <el-input v-model="processor.resultVariable" placeholder="sqlRows" @input="emit('change')" />
    </label>
  </div>
  <ApiCodeEditor
    v-model="processor.sql"
    language="sql"
    height="260px"
    :show-format-button="false"
    placeholder="请输入 SQL 语句"
    @change="syncSqlScript"
  />
  <div class="scenario-advanced-table scenario-sql-extract-table">
    <div class="scenario-advanced-table-head">
      <span>变量名</span>
      <span>列名</span>
      <span></span>
    </div>
    <div v-for="(item, index) in sqlExtractParams()" :key="`${processor.id}-sql-${index}`" class="scenario-advanced-table-row">
      <el-input v-model="item.key" placeholder="变量名" @input="emit('change')" />
      <el-input v-model="item.value" placeholder="列名" @input="emit('change')" />
      <button type="button" class="scenario-row-remove" @click="removeSqlExtractParam(index)">删除</button>
    </div>
    <button type="button" class="scenario-advanced-add-row" @click="addSqlExtractParam">+ 添加提取参数</button>
  </div>
</template>
