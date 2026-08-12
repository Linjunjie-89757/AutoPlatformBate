<script setup lang="ts">
import { AlertTriangle, Power } from '@lucide/vue'

import type { RunnerNodeSummary } from '@/entities/local-runner'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'
import {
  capabilityPills,
  currentTaskOf,
  formatHeartbeat,
  formatResourcePercent,
  formatRunnerName,
  getBrowserBadges,
  getCapabilityMeta,
  getCurrentTaskRunId,
  getCurrentTaskTitle,
  getResourceColor,
  getRunnerCpu,
  getRunnerHost,
  getRunnerMemory,
  getRunnerSecondaryText,
  getRunnerStatusMeta,
  hiddenCapabilityCount,
  resourceBarWidth,
  visibleCapabilityPills,
} from './configRunnerPanel.helpers'

defineProps<{
  runners: RunnerNodeSummary[]
  warningText: string
}>()

const emit = defineEmits<{
  openDetail: [runner: RunnerNodeSummary]
  openFirstTask: [runner: RunnerNodeSummary]
  edit: [runner: RunnerNodeSummary]
  toggle: [runner: RunnerNodeSummary]
  delete: [runner: RunnerNodeSummary]
}>()
</script>

<template>
  <div class="config-runner-table-card">
    <table>
      <colgroup>
        <col class="config-runner-table-card__name-col">
        <col class="config-runner-table-card__address-col">
        <col class="config-runner-table-card__status-col">
        <col class="config-runner-table-card__task-col">
        <col class="config-runner-table-card__capability-col">
        <col class="config-runner-table-card__browser-col">
        <col class="config-runner-table-card__version-col">
        <col class="config-runner-table-card__heartbeat-col">
        <col class="config-runner-table-card__resource-col">
        <col class="config-runner-table-card__action-col">
      </colgroup>
      <thead>
        <tr>
          <th>节点</th>
          <th>地址</th>
          <th>状态</th>
          <th>当前任务</th>
          <th>执行能力</th>
          <th>浏览器</th>
          <th>版本</th>
          <th>心跳</th>
          <th>CPU/内存</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in runners"
          :key="item.runnerId"
          :class="{ 'is-offline': item.offline }"
          @click="emit('openDetail', item)"
        >
          <td>
            <div class="config-runner-node-cell">
              <span
                class="config-runner-node-icon"
                :style="{ color: getRunnerStatusMeta(item).color, backgroundColor: getRunnerStatusMeta(item).bg }"
              >
                <component :is="getRunnerStatusMeta(item).icon" :size="13" :stroke-width="1.8" />
              </span>
              <div>
                <strong>{{ formatRunnerName(item) }}</strong>
                <span>{{ getRunnerSecondaryText(item) }}</span>
              </div>
            </div>
          </td>
          <td><code class="config-runner-code">{{ getRunnerHost(item) }}</code></td>
          <td>
            <span
              class="config-runner-status-pill"
              :style="{ color: getRunnerStatusMeta(item).color, backgroundColor: getRunnerStatusMeta(item).bg }"
            >
              <span :style="{ backgroundColor: getRunnerStatusMeta(item).dot }" />
              {{ getRunnerStatusMeta(item).label }}
            </span>
          </td>
          <td>
            <button
              v-if="currentTaskOf(item)"
              type="button"
              class="config-runner-task-link"
              @click.stop="emit('openFirstTask', item)"
            >
              {{ getCurrentTaskTitle(item) }}
              <small>{{ getCurrentTaskRunId(item) }}</small>
            </button>
            <span v-else class="config-runner-muted">空闲</span>
          </td>
          <td>
            <div class="config-runner-capability-list">
              <span
                v-for="capability in visibleCapabilityPills(item)"
                :key="capability"
                class="config-runner-capability-pill"
                :style="{ color: getCapabilityMeta(capability).color, backgroundColor: getCapabilityMeta(capability).bg }"
              >
                {{ getCapabilityMeta(capability).label }}
              </span>
              <span v-if="hiddenCapabilityCount(item)" class="config-runner-extra-pill">+{{ hiddenCapabilityCount(item) }}</span>
              <span v-if="!capabilityPills(item).length" class="config-runner-muted">未上报</span>
            </div>
          </td>
          <td>
            <div class="config-runner-browser-list">
              <span v-for="browser in getBrowserBadges(item)" :key="browser">{{ browser }}</span>
              <span v-if="!getBrowserBadges(item).length" class="config-runner-muted">-</span>
            </div>
          </td>
          <td><code class="config-runner-code">v{{ item.runnerVersion || '-' }}</code></td>
          <td>
            <span class="config-runner-muted" :class="{ 'is-danger': item.offline }">
              {{ formatHeartbeat(item.secondsSinceHeartbeat) }}
            </span>
          </td>
          <td>
            <div v-if="!item.offline" class="config-runner-resource-mini">
              <span>
                <i><b :style="{ width: resourceBarWidth(getRunnerCpu(item)), backgroundColor: getResourceColor(getRunnerCpu(item)) }" /></i>
                <em :style="{ color: getResourceColor(getRunnerCpu(item)) }">{{ formatResourcePercent(getRunnerCpu(item)) }}</em>
              </span>
              <span>
                <i><b :style="{ width: resourceBarWidth(getRunnerMemory(item)), backgroundColor: getResourceColor(getRunnerMemory(item), 75, 90) }" /></i>
                <em :style="{ color: getResourceColor(getRunnerMemory(item), 75, 90) }">{{ formatResourcePercent(getRunnerMemory(item)) }}</em>
              </span>
            </div>
            <span v-else class="config-runner-muted">-</span>
          </td>
          <td>
            <div class="config-runner-row-actions">
              <button type="button" aria-label="查看详情" title="查看详情" @click.stop="emit('openDetail', item)">
                <img :src="figmaConfigRunnerIcons.action.detail" alt="">
              </button>
              <button type="button" aria-label="编辑节点" title="编辑节点" @click.stop="emit('edit', item)">
                <img :src="figmaConfigRunnerIcons.action.edit" alt="">
              </button>
              <button type="button" aria-label="启用或禁用节点" title="启用或禁用节点" @click.stop="emit('toggle', item)">
                <Power :size="13" :stroke-width="1.8" />
              </button>
              <button type="button" class="is-danger" aria-label="删除节点" title="删除节点" @click.stop="emit('delete', item)">
                <img :src="figmaConfigRunnerIcons.action.trash" alt="">
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="warningText" class="config-runner-warning-strip">
      <AlertTriangle :size="13" :stroke-width="1.8" />
      <span>{{ warningText }}</span>
    </div>
  </div>
</template>

<style scoped src="./config-runner-node-table.css"></style>
