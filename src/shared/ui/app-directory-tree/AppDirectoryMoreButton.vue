<script setup lang="ts">
import { MoreHorizontal } from '@lucide/vue'

withDefaults(defineProps<{
  label?: string
}>(), {
  label: '更多操作',
})
</script>

<template>
  <button
    type="button"
    class="app-directory-more-button"
    :aria-label="label"
    :title="label"
  >
    <MoreHorizontal class="app-directory-more-button__icon" :size="12" aria-hidden="true" />
  </button>
</template>

<style scoped>
.app-directory-more-button {
  display: inline-flex;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  appearance: none;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  line-height: 0;
}

.app-directory-more-button:hover,
.app-directory-more-button:focus-visible {
  background: var(--app-border);
  color: var(--app-text-primary);
}

.app-directory-more-button__icon {
  display: block;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
}
</style>
