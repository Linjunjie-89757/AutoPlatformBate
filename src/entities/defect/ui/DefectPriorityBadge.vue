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
  min-height: 17.5px;
  padding: 0.75px 7px;
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

.defect-badge--p1 {
  background: #ff7d00;
}

.defect-badge--p2 {
  background: #ff9a00;
}

.defect-badge--low,
.defect-badge--neutral {
  background: #165dff;
}
</style>
