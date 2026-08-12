<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="api-definition-section">
    <div class="api-definition-section__title">
      <div><strong>{{ title }}</strong></div>
      <slot name="actions"></slot>
    </div>
    <slot></slot>
  </section>
</template>

<style scoped>
.api-definition-section {
  display: grid;
  gap: 10px;
}

.api-definition-section__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.api-definition-section__title > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}
</style>
