<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <section class="app-section">
    <header v-if="title || description || $slots.actions" class="app-section__header">
      <div>
        <h2 v-if="title" class="app-section__title">{{ title }}</h2>
        <p v-if="description" class="app-section__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="app-section__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </section>
</template>

<style scoped>
.app-section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.app-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.app-section__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
  font-weight: 600;
  line-height: var(--app-line-height-lg);
}

.app-section__description {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-md);
}

.app-section__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}
</style>
