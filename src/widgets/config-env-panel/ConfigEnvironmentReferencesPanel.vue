<script setup lang="ts">
import { Activity as Connection, AlertTriangle as Warning, Layers, Monitor, RefreshCw, Timer, Zap } from '@lucide/vue'

import type { ReferenceKind, ReferenceViewItem } from './configEnvironmentPanel.types'

defineProps<{
  runningCount: number
  loading: boolean
  rows: ReferenceViewItem[]
  stats: Array<{ kind: ReferenceKind; count: number }>
  sampled: boolean
}>()

const emit = defineEmits<{ view: [item: ReferenceViewItem] }>()

const typeMeta = {
  'api-scenario': { label: '接口场景', icon: Zap },
  'api-suite': { label: '接口套件', icon: Layers },
  'web-ui': { label: 'Web UI', icon: Monitor },
  scheduled: { label: '定时任务', icon: Timer },
} as const
</script>

<template>
  <section class="figma-env__references" data-node-id="337:10369">
    <div v-if="runningCount" class="figma-env__reference-warning" data-node-id="337:10371">
      <el-icon><Warning /></el-icon>
      <span>当前有任务正在使用此环境运行，停用或删除操作将被阻止。</span>
    </div>

    <div v-if="loading" class="figma-env__reference-empty is-loading">
      <el-icon class="is-spinning"><RefreshCw /></el-icon>
      <strong>正在加载引用数据</strong>
    </div>

    <template v-else-if="rows.length">
      <div class="figma-env__reference-stats" data-node-id="337:10379">
        <article v-for="stat in stats" :key="stat.kind" class="figma-env__reference-stat" :class="`is-${stat.kind}`" :title="sampled ? '当前接口只返回部分引用明细，卡片数量为当前已返回记录数' : ''">
          <el-icon><component :is="typeMeta[stat.kind].icon" /></el-icon>
          <div><strong>{{ stat.count }}</strong><span>{{ typeMeta[stat.kind].label }}</span></div>
        </article>
      </div>

      <div class="figma-env__reference-table-shell" data-node-id="337:10430">
        <div class="figma-env__reference-table-scroll app-soft-scrollbar">
          <table class="figma-env__reference-table" data-node-id="337:10431">
            <colgroup><col><col><col><col><col></colgroup>
            <thead><tr data-node-id="337:10433"><th>类型</th><th>资源名称</th><th>最近执行</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in rows" :key="item.key">
                <td>
                  <span class="figma-env__reference-type" :class="`is-${item.kind}`" :title="item.sourceType">
                    <el-icon><component :is="typeMeta[item.kind].icon" /></el-icon>{{ item.typeLabel }}
                  </span>
                </td>
                <td><strong class="figma-env__reference-name">{{ item.name }}</strong></td>
                <td><code class="figma-env__reference-time" :title="item.sourceType.includes('历史') ? '执行时间' : '当前接口仅提供资源更新时间'">{{ item.lastRun }}</code></td>
                <td class="figma-env__reference-status-cell">
                  <span v-if="item.status === 'running'" class="figma-env__reference-status is-running"><el-icon><Connection /></el-icon>运行中</span>
                  <span v-else-if="item.status === 'idle'" class="figma-env__reference-status is-idle">空闲</span>
                  <span v-else class="figma-env__reference-status is-unknown">—</span>
                </td>
                <td class="figma-env__reference-action-cell"><button type="button" :aria-label="`查看 ${item.name}`" @click="emit('view', item)">查看</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else class="figma-env__reference-empty">
      <el-icon><Connection /></el-icon>
      <strong>暂无引用</strong>
      <span>此环境尚未被任何接口场景、套件或定时任务引用</span>
    </div>
  </section>
</template>
