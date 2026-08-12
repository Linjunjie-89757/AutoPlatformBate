<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronRight, Edit2 as Edit, Eye, Minus, Plus, Trash2 as Delete, Variable, Zap } from '@lucide/vue'

import type { ParamSetItem } from '@/entities/config'
import type { ConfigEnvLocalVariableForm } from '@/features/config-env-create-edit'
import { parseWebUiVariables } from '@/features/config-param-create-edit'
import { AppFigmaSwitch } from '@/shared/ui'

defineProps<{
  variableSets: ParamSetItem[]
  localVariables: ConfigEnvLocalVariableForm[]
  scopeLabel: (item: ParamSetItem) => string
  hasSensitive: (item: ParamSetItem) => boolean
  versionLabel: (item: ParamSetItem) => string
  isEnabled: (item: ParamSetItem) => boolean
}>()

const emit = defineEmits<{
  adjustPriority: []
  bind: []
  toggleSet: [item: ParamSetItem]
  moveSet: [index: number, offset: -1 | 1]
  viewSets: []
  unbind: [item: ParamSetItem]
  addLocal: []
  toggleLocal: [index: number]
  editLocal: [index: number]
  deleteLocal: [index: number]
}>()
</script>

<template>
  <section class="figma-env__variables" data-node-id="332:2871">
    <div class="figma-env__variable-priority">
      <el-icon><Zap /></el-icon>
      <span>变量优先级：</span>
      <strong>环境局部覆盖</strong><el-icon><ChevronRight /></el-icon>
      <strong>环境绑定变量集</strong><el-icon><ChevronRight /></el-icon>
      <strong>工作区全局变量</strong>
      <small>（优先级从高到低）</small>
    </div>

    <section class="figma-env__variable-section">
      <header class="figma-env__variable-heading">
        <div><h3>绑定变量集</h3><p>从变量配置页面选择已有变量集，多个变量集按优先级顺序生效</p></div>
        <div>
          <button v-if="variableSets.length > 1" type="button" @click="emit('adjustPriority')"><el-icon><ArrowUp /></el-icon>调整优先级</button>
          <button type="button" @click="emit('bind')"><el-icon><Plus /></el-icon>绑定变量集</button>
        </div>
      </header>

      <div v-if="variableSets.length" class="figma-env__variable-set-list">
        <article v-for="(item, index) in variableSets" :key="item.id" :class="{ 'is-disabled': !isEnabled(item) }">
          <button class="figma-env__priority-index" type="button" title="调整优先级" @click="emit('adjustPriority')">{{ index + 1 }}</button>
          <div class="figma-env__variable-set-copy">
            <div><strong>{{ item.paramName }}</strong><span>{{ scopeLabel(item) }}</span><span v-if="hasSensitive(item)" class="is-sensitive">含敏感变量</span></div>
            <p>{{ parseWebUiVariables(item.contentJson).length }} 个变量 <i>·</i> <code>{{ versionLabel(item) }}</code></p>
          </div>
          <AppFigmaSwitch :model-value="isEnabled(item)" :label="isEnabled(item) ? '停用变量集' : '启用变量集'" :title="isEnabled(item) ? '停用变量集' : '启用变量集'" @update:model-value="emit('toggleSet', item)" />
          <span class="figma-env__variable-order-actions">
            <button type="button" title="上移" :disabled="index === 0" @click="emit('moveSet', index, -1)"><el-icon><ArrowUp /></el-icon></button>
            <button type="button" title="下移" :disabled="index === variableSets.length - 1" @click="emit('moveSet', index, 1)"><el-icon><ArrowDown /></el-icon></button>
          </span>
          <span class="figma-env__row-actions">
            <button type="button" title="查看变量集" @click="emit('viewSets')"><el-icon><Eye /></el-icon></button>
            <button type="button" title="解除绑定" @click="emit('unbind', item)"><el-icon><Minus /></el-icon></button>
          </span>
        </article>
      </div>
      <div v-else class="figma-env__variable-empty">
        <el-icon><Variable /></el-icon><span>尚未绑定变量集，请前往「变量配置」创建后在此绑定</span>
      </div>
    </section>

    <section class="figma-env__variable-section">
      <header class="figma-env__variable-heading">
        <div><h3>环境局部变量</h3><p>用于覆盖少量环境差异，此处定义的变量优先级最高</p></div>
        <button type="button" @click="emit('addLocal')"><el-icon><Plus /></el-icon>添加变量</button>
      </header>

      <div v-if="localVariables.length" class="figma-env__local-variable-table">
        <table>
          <colgroup><col class="is-name"><col class="is-value"><col class="is-type"><col><col class="is-status"><col class="is-actions"></colgroup>
          <thead><tr><th>变量名</th><th>值</th><th>类型</th><th>说明</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="(variable, index) in localVariables" :key="`${variable.name}-${index}`" :class="{ 'is-disabled': variable.enabled === false }">
              <td><code>{{ variable.name }}</code></td>
              <td><code :class="{ 'is-masked': variable.sensitive }">{{ variable.sensitive ? '••••••••' : variable.value }}</code></td>
              <td><span>{{ variable.valueType || (variable.sensitive ? 'secret' : 'string') }}</span></td>
              <td>{{ variable.description || '—' }}</td>
              <td><AppFigmaSwitch :model-value="variable.enabled !== false" :label="variable.enabled === false ? '启用变量' : '停用变量'" :title="variable.enabled === false ? '启用变量' : '停用变量'" @update:model-value="emit('toggleLocal', index)" /></td>
              <td><span class="figma-env__row-actions"><button type="button" title="编辑" @click="emit('editLocal', index)"><el-icon><Edit /></el-icon></button><button type="button" title="删除" @click="emit('deleteLocal', index)"><el-icon><Delete /></el-icon></button></span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="figma-env__variable-empty is-local"><span>暂无局部变量，当需要覆盖特定环境差异时添加</span></div>
    </section>
  </section>
</template>
