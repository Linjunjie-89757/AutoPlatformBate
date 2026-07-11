<script setup lang="ts">
import { computed } from 'vue'

import type { DefectStatistics } from '@/entities/defect'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'

type DefectSummaryCard = {
  label: string
  value: number
  status: string
  tone: 'total' | 'todo' | 'high' | 'verify'
}

const props = defineProps<{
  statistics: DefectStatistics | null
  activeStatus?: string
  showCreateButton?: boolean
}>()

const emit = defineEmits<{
  select: [status: string]
  create: []
}>()

const stats = computed<DefectSummaryCard[]>(() => {
  const source = props.statistics ?? {
    total: 0,
    todo: 0,
    assigned: 0,
    inProgress: 0,
    pendingVerify: 0,
    closed: 0,
    rejected: 0,
  }
  const extraSource = source as DefectStatistics & {
    highPriority?: number
    highPriorityCount?: number
  }
  const highPriorityCount = extraSource.highPriority ?? extraSource.highPriorityCount ?? 0

  return [
    { label: '缺陷总数', value: source.total, status: '', tone: 'total' },
    { label: '待处理', value: source.todo + source.assigned, status: 'TODO', tone: 'todo' },
    { label: '高优先级', value: highPriorityCount, status: '', tone: 'high' },
    { label: '待验证', value: source.pendingVerify, status: 'PENDING_VERIFY', tone: 'verify' },
  ]
})

function isActive(status: string) {
  if (!status) {
    return !props.activeStatus
  }

  return props.activeStatus === status
}

function handleSelect(status: string) {
  emit('select', status)
}
</script>

<template>
  <div class="defect-summary-panel">
    <div class="defect-summary-panel__stats">
      <button
        v-for="stat in stats"
        :key="stat.label"
        type="button"
        class="defect-summary-panel__card"
        :class="[
          `defect-summary-panel__card--${stat.tone}`,
          { 'defect-summary-panel__card--active': isActive(stat.status) },
        ]"
        @click="handleSelect(stat.status)"
      >
        <strong>{{ stat.value }}</strong>
        <span>{{ stat.label }}</span>
      </button>
    </div>
    <button
      v-if="showCreateButton"
      type="button"
      class="defect-summary-panel__create"
      @click="emit('create')"
    >
      <img class="defect-summary-panel__create-icon" :src="figmaDefectIcons.add" alt="" />
      <span>新增缺陷</span>
    </button>
  </div>
</template>

<style scoped>
.defect-summary-panel {
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  padding: 0 21px 1px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defect-summary-panel__stats {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
}

.defect-summary-panel__card {
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 17.5px 0 0;
  border: 0;
  border-right: 1px solid #e5e6eb;
  border-radius: 0;
  margin-right: 17.5px;
  background: transparent;
  cursor: pointer;
  font-family: var(--app-font-family);
  transition: opacity 160ms ease;
}

.defect-summary-panel__card:hover {
  opacity: 0.82;
}

.defect-summary-panel__card:last-child {
  border-right: 0;
  margin-right: 0;
  padding-right: 0;
}

.defect-summary-panel__card strong {
  color: #1d2129;
  font-size: 24px;
  font-weight: 700;
  line-height: 36px;
}

.defect-summary-panel__card span {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-summary-panel__card--todo strong {
  color: #ff7d00;
}

.defect-summary-panel__card--high strong {
  color: #f53f3f;
}

.defect-summary-panel__card--verify strong {
  color: #c89b00;
}

.defect-summary-panel__card--active span {
  color: #4e5969;
}

.defect-summary-panel__create {
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #f53f3f;
  color: #ffffff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-summary-panel__create-icon {
  width: 13px;
  height: 13px;
  display: block;
}

@media (max-width: 720px) {
  .defect-summary-panel {
    overflow-x: auto;
  }
}
</style>
