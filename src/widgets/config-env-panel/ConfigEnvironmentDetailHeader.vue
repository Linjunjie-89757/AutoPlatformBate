<script setup lang="ts">
import {
  Copy as CopyDocument,
  Globe,
  Power as SwitchButton,
  CheckCircle,
} from '@lucide/vue'

import type { EnvironmentStageMeta } from './configEnvironmentPanel.types'

defineProps<{
  environmentName: string
  environmentIdentifier: string
  description: string
  stage: EnvironmentStageMeta
  enabled: boolean
  isProduction: boolean
  dirty: boolean
  operating: boolean
  saving: boolean
  saveDisabled: boolean
}>()

const emit = defineEmits<{
  copy: []
  switchStatus: []
  save: []
}>()
</script>

<template>
  <header class="figma-env__detail-head">
    <div class="figma-env__detail-summary">
      <span class="figma-env__detail-icon" :style="{ color: stage.color, background: stage.background }"><el-icon><Globe /></el-icon></span>
      <div class="figma-env__detail-copy">
        <div class="figma-env__detail-title-row">
          <h2>{{ environmentName }}</h2>
          <span class="figma-env__stage-badge" :style="{ color: stage.color, background: stage.background }">{{ stage.label }}</span>
          <span v-if="isProduction" class="figma-env__status-badge is-production">生产</span>
          <span v-if="!enabled" class="figma-env__status-badge is-disabled">已停用</span>
          <span v-if="dirty" class="figma-env__status-badge is-dirty">未保存</span>
        </div>
        <div class="figma-env__detail-description">
          <code>{{ environmentIdentifier || '—' }}</code>
          <i>·</i><span>{{ description || '暂未填写环境说明' }}</span>
        </div>
      </div>
    </div>

    <div class="figma-env__detail-actions">
      <button type="button" @click="emit('copy')"><el-icon><CopyDocument /></el-icon>复制</button>
      <button type="button" :disabled="operating" @click="emit('switchStatus')"><el-icon><SwitchButton /></el-icon>{{ enabled ? '停用' : '启用' }}</button>
      <button class="is-primary" type="button" :disabled="saving || saveDisabled" @click="emit('save')"><el-icon><CheckCircle /></el-icon>保存配置</button>
    </div>
  </header>
</template>
