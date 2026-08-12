<script setup lang="ts">
import {
  AlertTriangle as Warning,
  Copy as CopyDocument,
  Edit2 as Edit,
  Globe,
  Layers,
  Power as SwitchButton,
  Trash2 as Delete,
} from '@lucide/vue'

import type { EnvironmentStageMeta } from './configEnvironmentPanel.types'

defineProps<{
  environmentName: string
  description: string
  stage: EnvironmentStageMeta
  applicationLabel: string
  configComplete: boolean
  configIssueCount: number
  serviceCount: number
  variableSetCount: number
  referenceCount: number
  enabled: boolean
  operating: boolean
}>()

const emit = defineEmits<{
  copy: []
  edit: []
  switchStatus: []
  remove: []
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
          <span class="figma-env__apply-badge">
            <el-icon><Layers :size="10" /></el-icon>
            {{ applicationLabel }}
          </span>
        </div>
        <div class="figma-env__detail-description">
          <span>{{ description || '暂未填写环境说明' }}</span>
          <i>·</i><span>更新人：—</span><i>·</i><span>—</span>
          <template v-if="!configComplete"><i>·</i><span class="is-warning"><el-icon><Warning /></el-icon>{{ configIssueCount }} 项配置待完善</span></template>
        </div>
      </div>
    </div>

    <div class="figma-env__detail-actions">
      <div v-for="metric in [{ value: serviceCount, label: '服务' }, { value: variableSetCount, label: '变量集' }, { value: referenceCount, label: '引用任务' }]" :key="metric.label" class="figma-env__metric">
        <strong>{{ metric.value }}</strong><span>{{ metric.label }}</span>
      </div>
      <i class="figma-env__action-divider" />
      <button type="button" @click="emit('copy')"><el-icon><CopyDocument /></el-icon>复制</button>
      <button type="button" @click="emit('edit')"><el-icon><Edit /></el-icon>编辑</button>
      <button type="button" :disabled="operating" @click="emit('switchStatus')"><el-icon><SwitchButton /></el-icon>{{ enabled ? '停用' : '启用' }}</button>
      <button class="figma-env__icon-button" type="button" title="删除环境" :disabled="operating" @click="emit('remove')"><el-icon><Delete /></el-icon></button>
    </div>
  </header>
</template>
