<script setup lang="ts">
import { computed } from 'vue'

import { getDefectSeverityMeta } from '../lib/format'

const props = defineProps<{
  severity: string
}>()

const meta = computed(() => getDefectSeverityMeta(props.severity))
</script>

<template>
  <span class="defect-badge" :class="`defect-badge--${meta.tone}`">
    {{ meta.label }}
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

.defect-badge--critical {
  border-color: #fecaca;
  background: #fee2e2;
  color: #b91c1c;
}

.defect-badge--high {
  border-color: #fed7aa;
  background: #ffedd5;
  color: #c2410c;
}

.defect-badge--medium {
  border-color: #fde68a;
  background: #fef3c7;
  color: #92400e;
}

.defect-badge--low {
  border-color: #bfdbfe;
  background: #dbeafe;
  color: #1d4ed8;
}

.defect-badge--neutral {
  border-color: #e5e7eb;
  background: #f3f4f6;
  color: #374151;
}
</style>
