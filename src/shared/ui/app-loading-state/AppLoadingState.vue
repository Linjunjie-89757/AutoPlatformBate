<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    title?: string
    description?: string
  }>(),
  {
    text: '加载中...',
    title: '',
    description: '',
  },
)
</script>

<template>
  <div class="app-loading-state" role="status" aria-live="polite">
    <el-skeleton animated :rows="4" />
    <div v-if="title" class="app-loading-state__title">{{ title }}</div>
    <div class="app-loading-state__text">{{ description || text }}</div>
  </div>
</template>

<style scoped>
.app-loading-state {
  padding: var(--app-space-6);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.app-loading-state__text {
  margin-top: var(--app-space-4);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-md);
  text-align: center;
}

.app-loading-state__title {
  margin-top: var(--app-space-4);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  text-align: center;
}

.app-loading-state__title + .app-loading-state__text {
  margin-top: var(--app-space-2);
  font-size: var(--app-font-size-sm);
}
</style>
