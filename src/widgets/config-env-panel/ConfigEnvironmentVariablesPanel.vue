<script setup lang="ts">
import { AlertTriangle, ArrowDown, ArrowUp, ExternalLink, Eye, Minus, Plus, Variable } from '@lucide/vue'

import type { ParamSetItem } from '@/entities/config'
import type { ConfigEnvLocalVariableForm } from '@/features/config-env-create-edit'
import { parseWebUiVariables } from '@/features/config-param-create-edit'

defineProps<{
  variableSets: ParamSetItem[]
  localVariables: ConfigEnvLocalVariableForm[]
  scopeLabel: (item: ParamSetItem) => string
  hasSensitive: (item: ParamSetItem) => boolean
  versionLabel: (item: ParamSetItem) => string
  isEnabled: (item: ParamSetItem) => boolean
}>()

const emit = defineEmits<{
  bind: []
  moveSet: [index: number, offset: -1 | 1]
  viewSets: []
  unbind: [item: ParamSetItem]
  addLocal: []
  toggleLocal: [index: number]
  editLocal: [index: number]
  deleteLocal: [index: number]
}>()

function variableNames(item: ParamSetItem) {
  return parseWebUiVariables(item.contentJson).filter(variable => variable.enabled !== false && variable.name).map(variable => variable.name)
}

function conflictNames(sets: ParamSetItem[]) {
  const owners = new Map<string, number[]>()
  sets.forEach((set, index) => variableNames(set).forEach(name => {
    const key = name.toUpperCase()
    owners.set(key, [...(owners.get(key) || []), index])
  }))
  return new Map([...owners].filter(([, indexes]) => indexes.length > 1))
}

function conflictNamesForItem(sets: ParamSetItem[], item: ParamSetItem) {
  const names = variableNames(item)
  const conflicts = conflictNames(sets)
  return names.filter(name => conflicts.has(name.toUpperCase()))
}

function conflictWinnerIndex(sets: ParamSetItem[], name: string) {
  const key = name.toUpperCase()
  return sets.findIndex(set => variableNames(set).some(itemName => itemName.toUpperCase() === key))
}
</script>

<template>
  <section class="figma-env__variables" data-node-id="332:2871">
    <section class="figma-env__variable-section">
      <header class="figma-env__variable-heading">
        <div><h3>已绑定变量集</h3><p>数字越小优先级越高；同名变量以排序靠前的变量集为准</p></div>
        <div>
          <button type="button" class="figma-env__text-link" @click="emit('viewSets')"><el-icon><ExternalLink /></el-icon>前往变量配置</button>
          <button type="button" @click="emit('bind')"><el-icon><Plus /></el-icon>绑定变量集</button>
        </div>
      </header>

      <div v-if="variableSets.length" class="figma-env__variable-set-list">
        <article v-for="(item, index) in variableSets" :key="item.id" :class="{ 'is-disabled': !isEnabled(item) }">
          <span class="figma-env__priority-index" aria-label="优先级">{{ index + 1 }}</span>
          <div class="figma-env__variable-set-copy">
            <div><strong>{{ item.paramName }}</strong><span v-if="index === 0 && variableSets.length > 1" class="is-priority">最高优先级</span><span>{{ scopeLabel(item) }}</span><span v-if="hasSensitive(item)" class="is-sensitive">含敏感变量</span></div>
            <p>{{ parseWebUiVariables(item.contentJson).length }} 个变量 <i>·</i> <code>{{ versionLabel(item) }}</code></p>
          </div>
          <span class="figma-env__variable-order-actions">
            <button type="button" title="上移" :disabled="index === 0" @click="emit('moveSet', index, -1)"><el-icon><ArrowUp /></el-icon></button>
            <button type="button" title="下移" :disabled="index === variableSets.length - 1" @click="emit('moveSet', index, 1)"><el-icon><ArrowDown /></el-icon></button>
          </span>
          <span class="figma-env__row-actions">
            <button type="button" title="查看变量集" @click="emit('viewSets')"><el-icon><Eye /></el-icon></button>
            <button type="button" title="解除绑定" @click="emit('unbind', item)"><el-icon><Minus /></el-icon></button>
          </span>
          <div v-if="conflictNamesForItem(variableSets, item).length" class="figma-env__variable-conflicts">
            <AlertTriangle :size="12" />
            <span>冲突变量：</span>
            <code v-for="name in conflictNamesForItem(variableSets, item)" :key="name" :class="{ 'is-overridden': conflictWinnerIndex(variableSets, name) !== index }">{{ name }}</code>
          </div>
        </article>
      </div>
      <div v-else class="figma-env__variable-empty">
        <el-icon><Variable /></el-icon><span>尚未绑定变量集，请前往「变量配置」创建后在此绑定</span>
      </div>
    </section>

    <div v-if="conflictNames(variableSets).size" class="figma-env__variable-conflict-summary">
      <AlertTriangle :size="13" />
      <strong>检测到 {{ conflictNames(variableSets).size }} 个同名变量冲突：</strong>
      <code v-for="name in Object.keys(Object.fromEntries(conflictNames(variableSets)))" :key="name">{{ name }}</code>
      <span>— 以排序靠前的变量集为准。可调整顺序。</span>
    </div>

    <div class="figma-env__variable-priority">
      <span>变量优先级（从高到低）：</span>
      <strong>环境局部覆盖</strong><span>→</span>
      <strong>排序靠前的变量集</strong><span>→</span>
      <strong>排序靠后的变量集</strong><span>→</span>
      <strong>工作区全局变量</strong>
    </div>

  </section>
</template>
