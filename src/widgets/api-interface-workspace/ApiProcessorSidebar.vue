<script setup lang="ts">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import processorAddIcon from '@/assets/figma-processor/processor-add.svg'
import processorChevronIcon from '@/assets/figma-processor/processor-chevron.svg'
import processorEmptyLeftIcon from '@/assets/figma-processor/processor-empty-right.svg'

import { AppSwitch } from '@/shared/ui'

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
  dirty: []
}>()

function processorTone(type?: string | null) {
  if (type === 'SQL') return { label: 'SQL', color: '#165DFF', bg: '#E8EEFF' }
  if (type === 'TIME_WAITING') return { label: '等待', color: '#FF7D00', bg: '#FFF2E5' }
  if (type === 'EXTRACT') return { label: '提取', color: '#00B42A', bg: '#E6F9EC' }
  return { label: '脚本', color: '#7816FF', bg: '#F0E8FF' }
}

function toggleProcessor(processor: ApiProcessorPanelRow) {
  processor.enabled = !processor.enabled
  emit('dirty')
}

</script>

<template>
  <aside class="api-processor-sidebar">
    <div class="api-processor-toolbar">
      <el-dropdown trigger="click" popper-class="api-processor-add-popper" @command="emit('add', $event)">
        <button type="button" class="api-legacy-primary">
          <img class="api-button-plus" :src="processorAddIcon" alt="" aria-hidden="true" />
          <span>添加处理器</span>
          <img class="api-button-chevron" :src="processorChevronIcon" alt="" aria-hidden="true" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in typeOptions" :key="item.value" :command="item.value">
              {{ item.label }}处理器
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <span class="api-processor-count">{{ rows.length }} 项</span>
    </div>

    <div v-if="rows.length" class="api-processor-sidebar-list">
      <div
        v-for="(processor, index) in rows"
        :key="processor.id || index"
        :class="['api-processor-list-item', { 'is-active': activeProcessor?.id === processor.id }]"
        role="button"
        tabindex="0"
        @click="emit('select', processor)"
        @keydown.enter="emit('select', processor)"
        @keydown.space.prevent="emit('select', processor)"
      >
        <span class="api-processor-list-item__main">
          <AppSwitch
            :model-value="processor.enabled !== false"
            :label="processor.enabled === false ? '启用处理器' : '停用处理器'"
            @click.stop
            @update:model-value="toggleProcessor(processor)"
          />
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
        </span>
      </div>
    </div>
    <div v-else class="api-processor-empty">
      <img class="api-processor-empty-icon" :src="processorEmptyLeftIcon" alt="" aria-hidden="true" />
      <span>暂无处理器</span>
      <small>点击「添加」开始配置</small>
    </div>
  </aside>
</template>
