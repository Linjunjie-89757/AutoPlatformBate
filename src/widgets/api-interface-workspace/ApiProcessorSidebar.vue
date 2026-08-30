<script setup lang="ts">
import { ArrowDown, ArrowUp, CopyDocument, Delete } from '@element-plus/icons-vue'
import { ChevronDown, Plus } from '@lucide/vue'

import type { ApiProcessorOption, ApiProcessorPanelRow } from './apiProcessorTypes'

const props = defineProps<{
  stage: 'pre' | 'post'
  rows: ApiProcessorPanelRow[]
  activeProcessor: ApiProcessorPanelRow | null
  typeOptions: ApiProcessorOption[]
  processorDefaultName: (stage: 'pre' | 'post', type?: string) => string
}>()

const emit = defineEmits<{
  add: [command: string | number | object]
  select: [processor: ApiProcessorPanelRow]
  move: [index: number, direction: -1 | 1]
  copy: [index: number]
  remove: [index: number]
  dirty: []
}>()

function processorTone(type?: string | null) {
  if (type === 'SQL') return { label: 'SQL', color: '#0E42D2', bg: '#E8F3FF' }
  if (type === 'TIME_WAITING') return { label: '等待', color: '#876800', bg: '#FFFBE8' }
  if (type === 'EXTRACT') return { label: '提取', color: '#00B42A', bg: '#E8FFEA' }
  return { label: '脚本', color: '#7816FF', bg: '#F5E8FF' }
}

function toggleProcessor(processor: ApiProcessorPanelRow) {
  processor.enabled = !processor.enabled
  emit('dirty')
}
</script>

<template>
  <aside class="api-processor-sidebar">
    <div class="api-processor-toolbar">
      <el-dropdown trigger="click" @command="emit('add', $event)">
        <button type="button" class="api-legacy-primary">
          <Plus class="api-button-plus" :size="12" aria-hidden="true" />
          添加处理器
          <ChevronDown class="api-button-chevron" :size="10" aria-hidden="true" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in typeOptions" :key="item.value" :command="item.value">
              {{ item.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <span class="api-processor-count">{{ rows.length }} 项</span>
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
          <span
            :class="['api-figma-switch', { 'is-on': processor.enabled !== false }]"
            role="switch"
            :aria-checked="processor.enabled !== false"
            @click.stop="toggleProcessor(processor)"
          >
            <span></span>
          </span>
          <span class="api-processor-list-copy">
            <span class="api-processor-list-row">
              <span
                class="api-processor-type-badge"
                :style="{
                  color: processorTone(processor.processorType).color,
                  backgroundColor: processorTone(processor.processorType).bg,
                }"
              >
                {{ processorTone(processor.processorType).label }}
              </span>
              <span class="api-processor-list-title">
                {{ processor.name || processorDefaultName(stage, processor.processorType) }}
              </span>
            </span>
          </span>
        </span>
        <span class="api-processor-list-actions">
          <button type="button" class="api-processor-list-action" :disabled="index === 0" aria-label="上移" title="上移" @click.stop="emit('move', index, -1)">
            <el-icon><ArrowUp /></el-icon>
          </button>
          <button type="button" class="api-processor-list-action" :disabled="index === rows.length - 1" aria-label="下移" title="下移" @click.stop="emit('move', index, 1)">
            <el-icon><ArrowDown /></el-icon>
          </button>
          <button type="button" class="api-processor-list-action" aria-label="复制" title="复制" @click.stop="emit('copy', index)">
            <el-icon><CopyDocument /></el-icon>
          </button>
          <button type="button" class="api-processor-list-action is-danger" aria-label="删除" title="删除" @click.stop="emit('remove', index)">
            <el-icon><Delete /></el-icon>
          </button>
        </span>
      </button>
    </div>
    <div v-else class="api-processor-empty">暂无处理器</div>
  </aside>
</template>
