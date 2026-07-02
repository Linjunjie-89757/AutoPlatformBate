<script setup lang="ts">
import { computed } from 'vue'

import { getDefectPriorityTone } from '../lib/format'

const props = defineProps<{
  priority: string
}>()

const tone = computed(() => getDefectPriorityTone(props.priority))
</script>

<template>
  <span class="defect-badge" :class="`defect-badge--${tone}`">
    {{ priority || '-' }}
  </span>
</template>

<style scoped>
.defect-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.defect-badge--critical,
.defect-badge--p1 {
  border-color: #fecaca;
}

.defect-badge--critical {
  background: #fee2e2;
  color: #b91c1c;
}

.defect-badge--p1 {
  border-color: #fed7aa;
  background: #ffedd5;
  color: #c2410c;
}

.defect-badge--p2 {
  border-color: #c7d7fe;
  background: #eef4ff;
  color: #3557a3;
}

.defect-badge--low,
.defect-badge--neutral {
  border-color: #e5e7eb;
  background: #f3f4f6;
  color: #374151;
}
</style>
