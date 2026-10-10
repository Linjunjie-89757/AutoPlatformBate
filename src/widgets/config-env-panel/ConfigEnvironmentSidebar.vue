<script setup lang="ts">
import { Plus, Search, Trash2 } from '@lucide/vue'

import type { EnvConfigItem } from '@/entities/config'

import { environmentCardIdentifier } from './configEnvironmentPanel.view'
import type { EnvironmentCardSummary } from './configEnvironmentPanel.types'

defineProps<{
  environments: EnvConfigItem[]
  environmentCount: number
  selectedEnvironmentId: number | null
  keyword: string
  loading: boolean
  errorMessage: string
  cardSummary: (environment: EnvConfigItem) => EnvironmentCardSummary
}>()

const emit = defineEmits<{
  create: []
  select: [environment: EnvConfigItem]
  remove: [environment: EnvConfigItem]
  retry: []
  'update:keyword': [value: string]
}>()
</script>

<template>
  <aside class="figma-env__sidebar" data-node-id="311:3774">
    <header class="figma-env__sidebar-head">
      <div class="figma-env__sidebar-title-row">
        <strong>环境列表</strong>
        <button class="figma-env__primary-button is-small" type="button" @click="emit('create')">
          <el-icon><Plus /></el-icon><span>新建</span>
        </button>
      </div>
      <label class="figma-env__search">
        <el-icon><Search /></el-icon>
        <input :value="keyword" type="text" placeholder="搜索名称或标识符" @input="emit('update:keyword', ($event.target as HTMLInputElement).value)">
      </label>
    </header>

    <div class="figma-env__sidebar-list app-soft-scrollbar">
      <template v-if="loading && !environments.length">
        <div v-for="index in 5" :key="index" class="figma-env__env-card is-skeleton" />
      </template>
      <div v-else-if="errorMessage && !environments.length" class="figma-env__sidebar-state is-error">
        <strong>环境加载失败</strong>
        <span>{{ errorMessage }}</span>
        <button type="button" @click="emit('retry')">重新加载</button>
      </div>
      <div
        v-for="environment in environments"
        v-else
        :key="environment.id"
        class="figma-env__env-card"
        :class="{ 'is-active': selectedEnvironmentId === environment.id }"
        :style="{
          '--stage-color': cardSummary(environment).stage.color,
          '--stage-background': cardSummary(environment).stage.background,
        }"
        role="button"
        tabindex="0"
        @click="emit('select', environment)"
        @keydown.enter="emit('select', environment)"
      >
        <span class="figma-env__env-card-main">
          <span class="figma-env__env-card-copy">
            <span class="figma-env__env-name-row">
              <strong>{{ environment.envName }}</strong>
              <b :style="{ color: cardSummary(environment).stage.color, background: cardSummary(environment).stage.background }">{{ cardSummary(environment).stage.label }}</b>
              <em v-if="cardSummary(environment).stage.label === '生产'">生产</em>
            </span>
            <code>{{ environmentCardIdentifier(environment) }}</code>
          </span>
        </span>
        <span class="figma-env__env-card-foot">
          <span class="figma-env__env-status-list">
            <span :class="{ 'is-configured': cardSummary(environment).apiConfigured }"><i />API</span>
            <span :class="{ 'is-configured': cardSummary(environment).webUiConfigured }"><i />Web UI</span>
          </span>
          <span class="figma-env__env-card-actions">
            <small v-if="environment.status === 0">已停用</small>
            <button type="button" aria-label="删除环境" @click.stop="emit('remove', environment)"><el-icon><Trash2 /></el-icon></button>
          </span>
        </span>
      </div>
      <div v-if="!loading && !errorMessage && !environments.length && environmentCount === 0" class="figma-env__sidebar-state">
        <strong>暂无环境</strong><span>新建环境后即可配置 API、Web UI 等连接参数。</span>
        <button type="button" @click="emit('create')"><el-icon><Plus /></el-icon>新建环境</button>
      </div>
      <div v-else-if="!loading && !errorMessage && !environments.length && environmentCount > 0" class="figma-env__sidebar-empty">未找到匹配环境</div>
    </div>
    <footer class="figma-env__sidebar-foot">共 {{ environmentCount }} 个环境</footer>
  </aside>
</template>
