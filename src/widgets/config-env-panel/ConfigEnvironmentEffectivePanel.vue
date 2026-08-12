<script setup lang="ts">
import { AlertTriangle as Warning, CheckCircle as CircleCheck, ChevronDown, Search, Variable } from '@lucide/vue'

import type { EffectiveVariableRow, EffectiveVariableSourceType } from './configEnvironmentPanel.types'

defineProps<{
  variables: EffectiveVariableRow[]
  filteredVariables: EffectiveVariableRow[]
  sourceFilter: 'all' | EffectiveVariableSourceType
  keyword: string
}>()

const emit = defineEmits<{
  'update:sourceFilter': [value: 'all' | EffectiveVariableSourceType]
  'update:keyword': [value: string]
}>()
</script>

<template>
  <section class="figma-env__effective-panel" data-node-id="336:9791">
    <div class="figma-env__effective-toolbar" data-node-id="336:9793">
      <p>下表展示当前环境执行时各变量的最终生效值及来源。敏感变量已脱敏，同名变量按优先级覆盖。</p>
      <span />
      <label class="figma-env__effective-filter" data-node-id="336:9798">
        <select :value="sourceFilter" aria-label="筛选变量来源" @change="emit('update:sourceFilter', ($event.target as HTMLSelectElement).value as 'all' | EffectiveVariableSourceType)">
          <option value="all">全部变量</option>
          <option value="local">环境局部覆盖</option>
          <option value="variable-set">变量集变量</option>
          <option value="workspace">工作区变量</option>
        </select>
        <el-icon><ChevronDown /></el-icon>
      </label>
      <label class="figma-env__effective-search" data-node-id="336:9805">
        <el-icon><Search /></el-icon>
        <input :value="keyword" type="text" placeholder="搜索变量名" aria-label="搜索变量名" @input="emit('update:keyword', ($event.target as HTMLInputElement).value)">
      </label>
    </div>

    <div v-if="!variables.length" class="figma-env__effective-empty">
      <el-icon><Variable /></el-icon>
      <p>尚未配置任何变量，请先绑定变量集或添加局部变量</p>
    </div>

    <div v-else class="figma-env__effective-table-shell" data-node-id="336:9812">
      <div class="figma-env__effective-table-scroll app-soft-scrollbar">
        <table class="figma-env__effective-table" data-node-id="336:9813">
          <colgroup><col><col><col><col><col><col></colgroup>
          <thead><tr data-node-id="336:9815"><th>变量名</th><th>最终值</th><th>来源</th><th>是否覆盖</th><th>说明</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="item in filteredVariables" :key="item.name">
              <td><code class="figma-env__effective-name">{{ item.name }}</code></td>
              <td><code class="figma-env__effective-value" :class="{ 'is-sensitive': item.sensitive }">{{ item.value || '—' }}</code></td>
              <td><span class="figma-env__effective-source" :class="`is-${item.sourceType}`">{{ item.source }}</span></td>
              <td><span v-if="item.overriddenSource" class="figma-env__effective-override">覆盖自 {{ item.overriddenSource }}</span><span v-else class="figma-env__effective-dash">—</span></td>
              <td><span class="figma-env__effective-description">{{ item.description }}</span></td>
              <td><el-icon v-if="item.ok" class="figma-env__effective-status is-ok" title="解析正常"><CircleCheck /></el-icon><el-icon v-else class="figma-env__effective-status is-error" title="存在无法解析的变量"><Warning /></el-icon></td>
            </tr>
            <tr v-if="!filteredVariables.length" class="figma-env__effective-no-result"><td colspan="6">没有符合当前筛选条件的变量</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
