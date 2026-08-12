<script setup lang="ts">
import type { ApiDefinitionDetail } from '@/entities/api-automation'
import './styles/api-request-settings-panel.css'

const props = defineProps<{
  detail: ApiDefinitionDetail
  workspaceLabel: string
  environmentName: string
  variableSetName: string
  hasRunResult: boolean
  markDirty: () => void
}>()

function updateTags(value: string | number) {
  props.detail.tags = String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  props.markDirty()
}
</script>

<template>
  <div class="api-settings-panel">
    <div class="api-config-panel-head">
      <strong>请求设置</strong>
      <span>维护接口元信息、超时和调试上下文。</span>
    </div>
    <label>接口名称</label>
    <el-input v-model="detail.name" placeholder="接口名称" @input="markDirty" />
    <label>模块 / 目录</label>
    <el-input v-model="detail.directoryName" placeholder="模块 / 目录" @input="markDirty" />
    <label>标签</label>
    <el-input :model-value="detail.tags.join(', ')" placeholder="标签，逗号分隔" @update:model-value="updateTags" />
    <label>超时时间</label>
    <div class="api-settings-control-cell">
      <el-input-number
        v-model="detail.requestConfig.timeoutMs"
        :min="1000"
        :step="1000"
        class="api-settings-timeout-number"
        @change="markDirty"
      />
    </div>
    <label>描述</label>
    <el-input v-model="detail.description" type="textarea" :rows="4" placeholder="接口描述、调用约束或备注" @input="markDirty" />
    <div class="api-settings-footer">
      <span>写入空间 {{ workspaceLabel }}</span>
      <span>调试上下文 {{ environmentName }} / {{ variableSetName }}</span>
      <span>最后运行 {{ hasRunResult ? '已运行' : '未运行' }}</span>
    </div>
  </div>
</template>
