<script setup lang="ts">
import { computed, ref } from 'vue'

import type { WebUiElementCollectFilterDetail } from '@/entities/web-ui-automation'
import { formatCollectFilterReason } from '@/entities/web-ui-automation/lib/collectTask'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  details: WebUiElementCollectFilterDetail[]
  loading: boolean
}>()

const emit = defineEmits<{
  restore: [detail: WebUiElementCollectFilterDetail]
}>()

const activeReason = ref('ALL')
const restoredIds = ref(new Set<string>())

const recoverableCount = computed(() => props.details.filter(item => item.recoverable).length)
const filteredDetails = computed(() => {
  if (activeReason.value === 'ALL') return props.details
  if (activeReason.value === 'RECOVERABLE') return props.details.filter(item => item.recoverable)
  return props.details.filter(item => item.reason === activeReason.value)
})
const reasonOptions = computed(() => {
  const countMap = new Map<string, number>()
  for (const detail of props.details) {
    countMap.set(detail.reason, (countMap.get(detail.reason) || 0) + 1)
  }
  return Array.from(countMap.entries()).map(([reason, count]) => ({
    reason,
    count,
    label: formatCollectFilterReason(reason),
  }))
})
const stageGroups = computed(() => {
  const groupMap = new Map<string, WebUiElementCollectFilterDetail[]>()
  for (const detail of filteredDetails.value) {
    const key = detail.stage || 'UNKNOWN'
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key)?.push(detail)
  }
  return Array.from(groupMap.entries()).map(([stage, items]) => ({ stage, items }))
})

function restoreDetail(detail: WebUiElementCollectFilterDetail) {
  emit('restore', detail)
  restoredIds.value = new Set([...restoredIds.value, detail.id])
}

function isRestored(detail: WebUiElementCollectFilterDetail) {
  return restoredIds.value.has(detail.id)
}

function formatStage(stage?: string | null) {
  if (stage === 'STATIC_RULE') return '规则清洗'
  if (stage === 'AI_ANALYZE') return 'AI 分析'
  if (stage === 'LOCAL_VALIDATE') return '本地验证'
  if (stage === 'FINALIZE') return '最终候选'
  return stage || '未知阶段'
}

function formatLocator(detail: WebUiElementCollectFilterDetail) {
  const type = detail.candidate.locatorType || '-'
  const value = detail.candidate.locatorValue || '-'
  return `${type}: ${value}`
}
</script>

<template>
  <section class="web-ui-collect-filter-details">
    <div class="web-ui-collect-filter-details__header">
      <div>
        <strong>过滤明细</strong>
        <p>保留规则、AI 和验证阶段被过滤的候选，必要时可恢复到待验证列表。</p>
      </div>
      <div class="web-ui-collect-filter-details__summary">
        <el-tag type="info" effect="light">共 {{ details.length }}</el-tag>
        <el-tag :type="recoverableCount ? 'warning' : 'info'" effect="light">
          可恢复 {{ recoverableCount }}
        </el-tag>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="3" animated />
    <template v-else-if="details.length">
      <div class="web-ui-collect-filter-details__filters">
        <AppButton size="small" :type="activeReason === 'ALL' ? 'primary' : 'default'" @click="activeReason = 'ALL'">
          全部
        </AppButton>
        <AppButton
          size="small"
          :type="activeReason === 'RECOVERABLE' ? 'primary' : 'default'"
          @click="activeReason = 'RECOVERABLE'"
        >
          可恢复
        </AppButton>
        <AppButton
          v-for="item in reasonOptions"
          :key="item.reason"
          size="small"
          :type="activeReason === item.reason ? 'primary' : 'default'"
          @click="activeReason = item.reason"
        >
          {{ item.label }} {{ item.count }}
        </AppButton>
      </div>

      <div class="web-ui-collect-filter-details__list">
        <section
          v-for="group in stageGroups"
          :key="group.stage"
          class="web-ui-collect-filter-details__stage"
        >
          <div class="web-ui-collect-filter-details__stage-title">
            <strong>{{ formatStage(group.stage) }}</strong>
            <span>{{ group.items.length }} 条</span>
          </div>
          <div
            v-for="detail in group.items"
            :key="detail.id"
            class="web-ui-collect-filter-details__item"
          >
            <div class="web-ui-collect-filter-details__item-main">
              <div class="web-ui-collect-filter-details__item-title">
                <el-tag :type="detail.recoverable ? 'warning' : 'info'" effect="light">
                  {{ formatCollectFilterReason(detail.reason) }}
                </el-tag>
                <strong>{{ detail.candidate.elementName || detail.candidate.locatorValue || '未命名候选' }}</strong>
                <el-tag v-if="isRestored(detail)" type="success" effect="light">已恢复</el-tag>
              </div>
              <div class="web-ui-collect-filter-details__meta">
                <span>{{ formatLocator(detail) }}</span>
                <span>稳定性 {{ detail.candidate.confidence || 0 }}%</span>
                <span>来源 {{ detail.candidate.candidateSource || 'RULE' }}</span>
              </div>
              <small>{{ detail.message || '暂无说明' }}</small>
            </div>
            <AppButton
              size="small"
              :disabled="!detail.recoverable || isRestored(detail)"
              @click="restoreDetail(detail)"
            >
              {{ isRestored(detail) ? '已恢复' : '恢复待验证' }}
            </AppButton>
          </div>
        </section>
      </div>
    </template>
    <div v-else class="web-ui-collect-filter-details__empty">
      当前任务暂无过滤明细
    </div>
  </section>
</template>

<style scoped>
.web-ui-collect-filter-details {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.web-ui-collect-filter-details__header,
.web-ui-collect-filter-details__summary,
.web-ui-collect-filter-details__filters,
.web-ui-collect-filter-details__item,
.web-ui-collect-filter-details__item-title,
.web-ui-collect-filter-details__meta {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-collect-filter-details__header {
  justify-content: space-between;
}

.web-ui-collect-filter-details__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-filter-details__list {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-filter-details__stage {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-collect-filter-details__stage-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-filter-details__item {
  justify-content: space-between;
  padding: var(--app-space-2);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
}

.web-ui-collect-filter-details__item-main {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-collect-filter-details__meta {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-collect-filter-details__item-main small,
.web-ui-collect-filter-details__empty {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}
</style>
