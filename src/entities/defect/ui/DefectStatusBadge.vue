<script setup lang="ts">
import { computed } from 'vue'

import { getDefectStatusMeta } from '../lib/format'

const props = defineProps<{
  status: string
}>()

const meta = computed(() => getDefectStatusMeta(props.status))
</script>

<template>
  <span class="defect-status-pill" :class="`defect-status-pill--${meta.tone}`">
    {{ meta.label }}
  </span>
</template>

<style scoped>
.defect-status-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 2px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.defect-status-pill--new {
  border-color: #bfdbfe;
  background: #dbeafe;
  color: #1d4ed8;
}

.defect-status-pill--assigned {
  border-color: #fed7aa;
  background: #ffedd5;
  color: #c2410c;
}

.defect-status-pill--processing {
  border-color: #bae6fd;
  background: #e0f2fe;
  color: #0369a1;
}

.defect-status-pill--verify {
  border-color: #ddd6fe;
  background: #ede9fe;
  color: #6d28d9;
}

.defect-status-pill--closed {
  border-color: #d1d5db;
  background: #e5e7eb;
  color: #374151;
}

.defect-status-pill--hold {
  border-color: #e5e7eb;
  background: #f3f4f6;
  color: #4b5563;
}

.defect-status-pill--neutral {
  border-color: #e5e7eb;
  background: #f3f4f6;
  color: #374151;
}
</style>
