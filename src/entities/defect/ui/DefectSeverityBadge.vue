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
  padding: 1.75px 7px;
  border: 0;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
  white-space: nowrap;
  color: #ffffff;
}

.defect-badge--critical {
  background: #f53f3f;
}

.defect-badge--high {
  background: #ff7d00;
}

.defect-badge--medium {
  background: #ff9a00;
}

.defect-badge--low {
  background: #86909c;
}

.defect-badge--neutral {
  background: #86909c;
}
</style>
