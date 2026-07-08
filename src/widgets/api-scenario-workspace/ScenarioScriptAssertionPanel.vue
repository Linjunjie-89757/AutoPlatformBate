<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import type { ScenarioAssertion } from './lib/scenarioAssertionEditorTypes'

const props = defineProps<{
  assertion: ScenarioAssertion
}>()

const emit = defineEmits<{
  change: []
}>()

function clearScript() {
  props.assertion.script = ''
  emit('change')
}

function formatScript() {
  props.assertion.script = (props.assertion.script || '').trim()
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
    v-model="assertion.script"
    language="javascript"
    height="360px"
    :show-format-button="false"
    placeholder="// JavaScript"
    @change="emit('change')"
  />
  <div class="scenario-advanced-hint">脚本中可以读取响应、变量和断言上下文，执行结果按旧项目断言脚本承载。</div>
</template>
