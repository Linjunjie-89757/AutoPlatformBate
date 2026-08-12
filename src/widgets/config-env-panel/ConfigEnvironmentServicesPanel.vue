<script setup lang="ts">
import {
  Activity as Connection,
  AlertTriangle as Warning,
  CheckCircle as CircleCheck,
  Clock,
  Copy as CopyDocument,
  Edit2 as Edit,
  Globe,
  Plus,
  Server as Service,
  Trash2 as Delete,
} from '@lucide/vue'

import type { ConfigEnvServiceEndpointForm } from '@/features/config-env-create-edit'

import type { ServiceTestState } from './configEnvironmentPanel.types'

const props = defineProps<{
  services: ConfigEnvServiceEndpointForm[]
  defaultServiceKey: string
  defaultServiceCount: number
  serviceStatus: (service: ConfigEnvServiceEndpointForm) => ServiceTestState
  formatTimeout: (timeoutMs: number) => string
}>()

const emit = defineEmits<{
  batchTest: []
  add: []
  test: [service: ConfigEnvServiceEndpointForm]
  edit: [index: number]
  copy: [index: number]
  remove: [index: number]
}>()
</script>

<template>
  <section class="figma-env__services" data-node-id="311:4040">
    <div class="figma-env__service-toolbar">
      <span>共 {{ props.services.filter(item => item.baseUrl).length }} 个服务，其中 {{ defaultServiceCount }} 个默认入口</span>
      <i />
      <button type="button" @click="emit('batchTest')"><el-icon><Connection /></el-icon>批量连接测试</button>
      <button class="is-primary" type="button" @click="emit('add')"><el-icon><Plus /></el-icon>添加服务</button>
    </div>

    <div v-if="services.length" class="figma-env__service-list">
      <article v-for="(service, index) in services" :key="service.key" class="figma-env__service-card">
        <span class="figma-env__service-icon" :class="{ 'is-default': service.key === defaultServiceKey }">
          <el-icon v-if="service.key === defaultServiceKey"><Globe /></el-icon>
          <el-icon v-else><Service /></el-icon>
        </span>
        <div class="figma-env__service-copy">
          <div><strong>{{ service.name }}</strong><b v-if="service.key === defaultServiceKey">默认入口</b><b v-if="!service.enabled" class="is-disabled">已停用</b></div>
          <p><code>{{ service.baseUrl }}</code><i>·</i><span>超时 {{ formatTimeout(service.timeoutMs) }}</span></p>
        </div>
        <div class="figma-env__service-actions">
          <span class="figma-env__service-status" :class="`is-${serviceStatus(service)}`">
            <el-icon><CircleCheck v-if="serviceStatus(service) === 'success'" /><Warning v-else-if="serviceStatus(service) === 'failed'" /><Clock v-else /></el-icon>
            {{ serviceStatus(service) === 'testing' ? '测试中...' : serviceStatus(service) === 'success' ? '连通' : serviceStatus(service) === 'failed' ? '失败' : serviceStatus(service) === 'timeout' ? '超时' : '未检测' }}
          </span>
          <button type="button" @click="emit('test', service)"><el-icon><Connection /></el-icon>测试连接</button>
          <span class="figma-env__row-actions">
            <button type="button" title="编辑" @click="emit('edit', index)"><el-icon><Edit /></el-icon></button>
            <button type="button" title="复制" @click="emit('copy', index)"><el-icon><CopyDocument /></el-icon></button>
            <button type="button" title="删除" @click="emit('remove', index)"><el-icon><Delete /></el-icon></button>
          </span>
        </div>
      </article>
    </div>

    <div v-else class="figma-env__service-empty" data-node-id="311:6146">
      <el-icon><Service /></el-icon>
      <strong>暂无服务配置</strong>
      <p>添加业务服务地址，接口和 UI 测试将使用这些地址发起请求</p>
      <button class="figma-env__primary-button" type="button" @click="emit('add')"><el-icon><Plus /></el-icon>添加第一个服务</button>
    </div>
  </section>
</template>
