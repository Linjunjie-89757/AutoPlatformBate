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
  min-height: 20px;
  padding: 1.75px 7px;
  border: 0;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  white-space: nowrap;
}

.defect-status-pill--new {
  background: #e8f3ff;
  color: #165dff;
}

.defect-status-pill--assigned {
  background: #f3e8ff;
  color: #7816ff;
}

.defect-status-pill--processing {
  background: #fff3e8;
  color: #ff7d00;
}

.defect-status-pill--verify {
  background: #fff7e8;
  color: #c89b00;
}

.defect-status-pill--closed {
  background: #e8ffea;
  color: #00b42a;
}

.defect-status-pill--hold {
  background: #ffe8e8;
  color: #f53f3f;
}

.defect-status-pill--neutral {
  background: #f2f3f5;
  color: #86909c;
}
</style>
