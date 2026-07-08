<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import type { ScenarioProcessor } from './lib/scenarioProcessorEditorTypes'

const props = defineProps<{
  processor: ScenarioProcessor
}>()

const emit = defineEmits<{
  change: []
}>()

function clearScript() {
  props.processor.script = ''
  emit('change')
}

function formatScript() {
  props.processor.script = (props.processor.script || '').trim()
  emit('change')
}
</script>

<template>
  <div class="scenario-code-toolbar">
    <el-tag size="small">JavaScript</el-tag>
    <button type="button" @click="clearScript">清空</button>
    <button type="button" @click="formatScript">格式化</button>
  </div>
  <ApiCodeEditor
    v-model="processor.script"
    language="javascript"
    height="360px"
    :show-format-button="false"
    placeholder="// JavaScript"
    @change="emit('change')"
  />
  <div class="scenario-advanced-hint">按旧项目脚本处理器承载，脚本区域自然撑开高级区。</div>
</template>
