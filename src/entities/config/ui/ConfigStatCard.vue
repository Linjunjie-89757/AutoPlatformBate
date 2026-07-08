<script setup lang="ts">
import type { ConfigStat } from '../model/types'

defineProps<{
  stat: ConfigStat
}>()
</script>

<template>
  <article class="config-stat-card" :class="`config-stat-card--${stat.tone ?? 'default'}`">
    <span>{{ stat.label }}</span>
    <strong>{{ stat.value }}</strong>
  </article>
</template>

<style scoped>
.config-stat-card {
  display: flex;
  min-height: 72px;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.config-stat-card span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.config-stat-card strong {
  color: var(--app-text-primary);
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
}

.config-stat-card--primary {
  border-color: var(--app-primary-subtle);
  background: color-mix(in srgb, var(--app-primary-soft) 68%, #fff);
}

.config-stat-card--success {
  border-color: #b7ead5;
  background: color-mix(in srgb, var(--app-success-soft) 72%, #fff);
}

.config-stat-card--warning {
  border-color: #f2d8a7;
  background: color-mix(in srgb, var(--app-warning-soft) 72%, #fff);
}

.config-stat-card--danger {
  border-color: #f5c2bc;
  background: color-mix(in srgb, var(--app-danger-soft) 72%, #fff);
}

.config-stat-card--purple {
  border-color: #d8ddff;
  background: color-mix(in srgb, var(--app-purple-soft) 72%, #fff);
}
</style>
