<script setup lang="ts">
import { AlertTriangle as Warning, Code2, Minus, Plus, RefreshCw } from '@lucide/vue'

import type { MockApplicationItem, MockReleaseItem } from '@/entities/config'
import { AppFigmaSwitch } from '@/shared/ui'

defineProps<{
  productionEnvironment: boolean
  mockBound: boolean
  application: MockApplicationItem | null
  release: MockReleaseItem | null
  versionOptionCount: number
  mockEnabled: boolean
  mockBaseUrl: string
  endpointCount: number | null
  scenarioCount: number | null
  unmatched24hCount: number | null
}>()

const emit = defineEmits<{
  switchVersion: []
  unbind: []
  toggleEnabled: []
  viewMock: []
  bind: []
}>()
</script>

<template>
  <section class="figma-env__mock-panel" data-node-id="334:7687">
    <div v-if="productionEnvironment" class="figma-env__mock-production-warning">
      <el-icon><Warning /></el-icon>
      <div><strong>生产环境禁止启用 Mock</strong><span>生产阶段的环境中不允许绑定 Mock 版本，以防止生产请求被拦截或返回模拟数据。</span></div>
    </div>

    <template v-if="mockBound && application && release">
      <div class="figma-env__mock-toolbar">
        <h3>当前绑定</h3>
        <span />
        <button type="button" :disabled="versionOptionCount < 2" @click="emit('switchVersion')"><el-icon><RefreshCw /></el-icon>切换版本</button>
        <button type="button" @click="emit('unbind')"><el-icon><Minus /></el-icon>解除绑定</button>
      </div>

      <article class="figma-env__mock-card">
        <header>
          <div>
            <AppFigmaSwitch :model-value="mockEnabled" :label="mockEnabled ? '停用 Mock' : '启用 Mock'" @update:model-value="emit('toggleEnabled')" />
            <strong>{{ mockEnabled ? 'Mock 已启用，接口请求将被拦截' : 'Mock 已停用，接口请求将直接到达真实服务' }}</strong>
          </div>
          <button type="button" @click="emit('viewMock')">前往 Mock 服务查看详情 →</button>
        </header>
        <div class="figma-env__mock-grid">
          <div><span>Mock 应用</span><strong>{{ application.appName }}</strong></div>
          <div><span>应用编码</span><code>{{ application.appCode }}</code></div>
          <div><span>当前版本</span><code class="is-version">v{{ release.versionNo }}</code></div>
          <div><span>Mock 基础地址</span><code class="is-link">{{ mockBaseUrl }}</code></div>
          <div><span>接口 / 场景</span><strong>{{ endpointCount ?? '—' }} 接口 · {{ scenarioCount ?? '—' }} 场景</strong></div>
          <div><span>访问凭据</span><strong class="is-credential">未启用</strong></div>
          <div><span>未匹配策略</span><strong>严格失败</strong></div>
          <div class="is-empty" />
        </div>
        <footer v-if="unmatched24hCount">
          <el-icon><Warning /></el-icon>
          <span>过去 24 小时内有 {{ unmatched24hCount }} 次请求未匹配到任何场景，可在 Mock 服务调用日志中查看详情</span>
          <button type="button" @click="emit('viewMock')">查看日志 →</button>
        </footer>
      </article>
    </template>

    <div v-else-if="!productionEnvironment" class="figma-env__mock-empty">
      <el-icon><Code2 /></el-icon>
      <strong>尚未绑定 Mock</strong>
      <p>绑定后，测试执行中的接口请求将由 Mock 服务拦截并返回模拟响应</p>
      <button class="figma-env__primary-button" type="button" @click="emit('bind')"><el-icon><Plus /></el-icon>绑定 Mock 应用</button>
    </div>
  </section>
</template>
