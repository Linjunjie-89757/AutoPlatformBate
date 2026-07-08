<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  hoverable?: boolean
}>()
</script>

<template>
  <section class="app-card" :class="{ 'app-card--hoverable': hoverable }">
    <header v-if="title || description || $slots.actions" class="app-card__header">
      <div>
        <h3 v-if="title" class="app-card__title">{{ title }}</h3>
        <p v-if="description" class="app-card__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="app-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="app-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.app-card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.app-card--hoverable {
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.app-card--hoverable:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card-hover);
}

.app-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-4) var(--app-space-5);
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-subtle);
}

.app-card__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
  font-weight: 600;
  line-height: var(--app-line-height-lg);
}

.app-card__description {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-md);
}

.app-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.app-card__body {
  padding: var(--app-space-5);
}
</style>
