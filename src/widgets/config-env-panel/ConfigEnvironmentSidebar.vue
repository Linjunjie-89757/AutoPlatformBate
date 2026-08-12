<script setup lang="ts">
import { AlertTriangle as Warning, CheckCircle as CircleCheck, Plus, Search } from '@lucide/vue'

import type { EnvConfigItem } from '@/entities/config'

import type { EnvironmentCardSummary } from './configEnvironmentPanel.types'

defineProps<{
  environments: EnvConfigItem[]
  selectedEnvironmentId: number | null
  keyword: string
  loading: boolean
  cardSummary: (environment: EnvConfigItem) => EnvironmentCardSummary
}>()

const emit = defineEmits<{
  create: []
  select: [environment: EnvConfigItem]
  'update:keyword': [value: string]
}>()
</script>

<template>
  <aside class="figma-env__sidebar" data-node-id="311:3774">
    <header class="figma-env__sidebar-head">
      <div class="figma-env__sidebar-title-row">
        <strong>测试环境</strong>
        <button class="figma-env__primary-button is-small" type="button" @click="emit('create')">
          <el-icon><Plus /></el-icon><span>新建</span>
        </button>
      </div>
      <label class="figma-env__search">
        <el-icon><Search /></el-icon>
        <input :value="keyword" type="text" placeholder="搜索环境名称" @input="emit('update:keyword', ($event.target as HTMLInputElement).value)">
      </label>
    </header>

    <div class="figma-env__sidebar-list app-soft-scrollbar">
      <template v-if="loading && !environments.length">
        <div v-for="index in 5" :key="index" class="figma-env__env-card is-skeleton" />
      </template>
      <button
        v-for="environment in environments"
        v-else
        :key="environment.id"
        class="figma-env__env-card"
        :class="{ 'is-active': selectedEnvironmentId === environment.id }"
        :style="{
          '--stage-color': cardSummary(environment).stage.color,
          '--stage-background': cardSummary(environment).stage.background,
        }"
        type="button"
        @click="emit('select', environment)"
      >
        <span class="figma-env__env-card-main">
          <i class="figma-env__stage-line" />
          <span class="figma-env__env-card-copy">
            <span class="figma-env__env-name-row">
              <strong>{{ environment.envName }}</strong>
              <em v-if="environment.status === 0">停用</em>
            </span>
            <span class="figma-env__env-meta-row">
              <b>{{ cardSummary(environment).stage.label }}</b>
              <small>{{ cardSummary(environment).services }} 服务 · {{ cardSummary(environment).variableSets }} 变量集</small>
            </span>
          </span>
        </span>
        <span class="figma-env__env-card-foot">
          <span :class="{ 'is-warning': cardSummary(environment).issues > 0 }">
            <el-icon><Warning v-if="cardSummary(environment).issues > 0" /><CircleCheck v-else /></el-icon>
            {{ cardSummary(environment).issues > 0 ? `${cardSummary(environment).issues} 项待完善` : '配置完整' }}
          </span>
          <small v-if="cardSummary(environment).mockEnabled">Mock 已接入</small>
        </span>
      </button>
      <div v-if="!loading && !environments.length" class="figma-env__sidebar-empty">暂无环境</div>
    </div>
  </aside>
</template>
