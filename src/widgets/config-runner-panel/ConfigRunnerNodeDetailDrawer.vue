<script setup lang="ts">
import { AlertTriangle, ChevronRight, Globe2, Power, RefreshCw } from '@lucide/vue'

import type { RunnerActiveTaskSummary, RunnerNodeSummary } from '@/entities/local-runner'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'
import {
  capabilityPills,
  currentTaskOf,
  formatOptionalCount,
  formatResourcePercent,
  formatRunnerName,
  getBrowserPills,
  getCapabilityMeta,
  getCurrentTaskTitle,
  getResourceColor,
  getRunnerAddress,
  getRunnerCapabilityDisplayLabel,
  getRunnerCpu,
  getRunnerDisk,
  getRunnerEnv,
  getRunnerExceptionLogs,
  getRunnerInfoRows,
  getRunnerMemory,
  getRunnerStatusKey,
  getRunnerStatusMeta,
  getRunnerTaskDurationText,
  getRunnerTaskOperatorText,
  getRunnerTaskStartText,
  getRunnerTaskStatusMeta,
  getRunnerTodayFailed,
  getRunnerTodayPassed,
  getRunnerTodayRuns,
  getTaskTypeLabel,
  hasHighResourceUsage,
  hasRunnerTodayFailures,
  resourceBarWidth,
  runnerDetailTabs,
  runnerTaskRows,
} from './configRunnerPanel.helpers'

defineProps<{
  runner: RunnerNodeSummary | null
}>()

const visible = defineModel<boolean>({ required: true })
const activeTab = defineModel<'info' | 'tasks' | 'logs'>('activeTab', { required: true })

const emit = defineEmits<{
  unsupported: [action: string]
  openFirstTask: [runner: RunnerNodeSummary]
  openTaskDetail: [task: RunnerActiveTaskSummary]
}>()
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-runner-node-drawer"
    direction="rtl"
    size="700px"
    :with-header="false"
    destroy-on-close
  >
    <div v-if="runner" class="config-runner-node-drawer__shell">
      <header class="config-runner-node-drawer__header">
        <div>
          <div class="config-runner-node-drawer__title">
            <span :style="{ color: getRunnerStatusMeta(runner).color, backgroundColor: getRunnerStatusMeta(runner).bg }">
              <component :is="getRunnerStatusMeta(runner).icon" :size="16" :stroke-width="1.8" />
            </span>
            <h3>{{ formatRunnerName(runner) }}</h3>
            <b :style="{ color: getRunnerStatusMeta(runner).color, backgroundColor: getRunnerStatusMeta(runner).bg }">
              {{ getRunnerStatusMeta(runner).label }}
            </b>
            <em v-if="hasHighResourceUsage(runner)">
              <AlertTriangle :size="9" :stroke-width="1.8" />
              资源告警
            </em>
          </div>
          <p>{{ getRunnerAddress(runner) }} · v{{ runner.runnerVersion || '-' }} · {{ getRunnerEnv(runner) }}</p>
        </div>
        <div class="config-runner-node-drawer__actions">
          <button type="button" class="config-runner-secondary-button is-small" @click="emit('unsupported', '重启 Runner 节点')">
            <RefreshCw :size="12" :stroke-width="1.8" />
            重启
          </button>
          <button type="button" class="config-runner-primary-button is-small is-warning" @click="emit('unsupported', '启用/禁用 Runner 节点')">
            <Power :size="12" :stroke-width="1.8" />
            {{ getRunnerStatusKey(runner) === 'disabled' ? '启用' : '禁用' }}
          </button>
          <button type="button" class="config-runner-node-drawer__close" aria-label="关闭" @click="visible = false">
            <img :src="figmaConfigRunnerIcons.drawer.close" alt="">
          </button>
        </div>
      </header>

      <div class="config-runner-node-drawer__tabs">
        <button
          v-for="tab in runnerDetailTabs"
          :key="tab.key"
          type="button"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'info'" class="config-runner-node-drawer__body">
        <article v-if="currentTaskOf(runner)" class="config-runner-current-task">
          <span />
          <div>
            <small>正在执行</small>
            <strong>{{ getCurrentTaskTitle(runner) }}</strong>
          </div>
          <button type="button" @click="emit('openFirstTask', runner)">
            查看任务
            <ChevronRight :size="12" :stroke-width="1.8" />
          </button>
        </article>

        <section class="config-runner-node-section is-resource">
          <h4>资源占用</h4>
          <div class="config-runner-resource-bars">
            <div>
              <p><span>CPU</span><em :style="{ color: getResourceColor(getRunnerCpu(runner)) }">{{ formatResourcePercent(getRunnerCpu(runner)) }}</em></p>
              <i><b :style="{ width: resourceBarWidth(getRunnerCpu(runner)), backgroundColor: getResourceColor(getRunnerCpu(runner)) }" /></i>
            </div>
            <div>
              <p><span>内存</span><em :style="{ color: getResourceColor(getRunnerMemory(runner), 75, 90) }">{{ formatResourcePercent(getRunnerMemory(runner)) }}</em></p>
              <i><b :style="{ width: resourceBarWidth(getRunnerMemory(runner)), backgroundColor: getResourceColor(getRunnerMemory(runner), 75, 90) }" /></i>
            </div>
            <div>
              <p><span>磁盘</span><em :style="{ color: getResourceColor(getRunnerDisk(runner)) }">{{ formatResourcePercent(getRunnerDisk(runner)) }}</em></p>
              <i><b :style="{ width: resourceBarWidth(getRunnerDisk(runner)), backgroundColor: getResourceColor(getRunnerDisk(runner)) }" /></i>
            </div>
          </div>
        </section>

        <div class="config-runner-node-stats">
          <article>
            <strong>{{ formatOptionalCount(getRunnerTodayRuns(runner)) }}</strong>
            <span>今日执行</span>
          </article>
          <article class="is-success">
            <strong>{{ formatOptionalCount(getRunnerTodayPassed(runner)) }}</strong>
            <span>通过</span>
          </article>
          <article :class="{ 'is-danger': hasRunnerTodayFailures(runner) }">
            <strong>{{ formatOptionalCount(getRunnerTodayFailed(runner)) }}</strong>
            <span>失败</span>
          </article>
        </div>

        <section class="config-runner-node-capability-section">
          <h4>执行能力</h4>
          <div class="config-runner-node-capabilities">
            <span
              v-for="capability in capabilityPills(runner)"
              :key="capability"
              :style="{ color: getCapabilityMeta(capability).color, backgroundColor: getCapabilityMeta(capability).bg }"
            >
              <img :src="getCapabilityMeta(capability).figmaIcon" alt="">
              {{ getRunnerCapabilityDisplayLabel(capability) }}
            </span>
            <span
              v-for="browser in getBrowserPills(runner)"
              :key="browser.key"
              :style="{ color: browser.color, backgroundColor: '#F2F3F5' }"
            >
              <Globe2 :size="11" :stroke-width="1.8" />
              {{ browser.label }}
            </span>
            <span v-if="!capabilityPills(runner).length && !getBrowserPills(runner).length">未上报能力</span>
          </div>
        </section>

        <section class="config-runner-node-info">
          <div
            v-for="(row, index) in getRunnerInfoRows(runner)"
            :key="row.label"
            :class="{ 'is-striped': index % 2 === 0 }"
          >
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </section>
      </div>

      <div v-else-if="activeTab === 'tasks'" class="config-runner-node-drawer__body">
        <section class="config-runner-node-task-panel">
          <p>当前活动任务（最多展示 10 条）</p>
          <div v-if="runnerTaskRows(runner).length" class="config-runner-node-task-table">
            <table>
              <thead>
                <tr>
                  <th>任务 ID</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>开始时间</th>
                  <th>耗时</th>
                  <th>执行人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in runnerTaskRows(runner)" :key="task.runId">
                  <td><code>{{ task.runId }}</code></td>
                  <td>{{ getTaskTypeLabel(task.taskType) }}</td>
                  <td>
                    <span
                      class="config-runner-node-task-status"
                      :style="{ color: getRunnerTaskStatusMeta(task.status).color, backgroundColor: getRunnerTaskStatusMeta(task.status).bg }"
                    >
                      {{ getRunnerTaskStatusMeta(task.status).label }}
                    </span>
                  </td>
                  <td><time>{{ getRunnerTaskStartText(task) }}</time></td>
                  <td><time>{{ getRunnerTaskDurationText(task) }}</time></td>
                  <td>{{ getRunnerTaskOperatorText(task) }}</td>
                  <td>
                    <div class="config-runner-node-task-actions">
                      <button type="button" title="查看报告" aria-label="查看报告" @click="emit('openTaskDetail', task)">
                        <img :src="figmaConfigRunnerIcons.action.report" alt="">
                      </button>
                      <button type="button" title="查看日志" aria-label="查看日志" @click="emit('openTaskDetail', task)">
                        <img :src="figmaConfigRunnerIcons.action.log" alt="">
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="config-runner-node-empty">
            <span>当前没有活动任务</span>
          </div>
        </section>
      </div>

      <div v-else class="config-runner-node-drawer__body">
        <section class="config-runner-node-log-panel">
          <p>根据节点心跳和资源上报生成的健康告警</p>
          <div v-if="getRunnerExceptionLogs(runner).length" class="config-runner-node-log-list">
            <article
              v-for="(log, index) in getRunnerExceptionLogs(runner)"
              :key="`${log.time}-${index}`"
              :class="`is-${log.level}`"
            >
              <AlertTriangle :size="14" :stroke-width="1.8" />
              <div>
                <time>{{ log.time }}</time>
                <span>{{ log.message }}</span>
              </div>
            </article>
          </div>
          <div v-else class="config-runner-node-empty">
            <span>暂无节点健康告警</span>
          </div>
        </section>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped src="./config-runner-node-detail-drawer.css"></style>
