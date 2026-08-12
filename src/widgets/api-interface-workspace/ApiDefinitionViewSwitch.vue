<script setup lang="ts">
import type { DefinitionSchemaViewMode } from './apiInterfaceTypes'

defineProps<{
  label: string
}>()

const model = defineModel<DefinitionSchemaViewMode>({ required: true })
</script>

<template>
  <div class="api-definition-view-switch" :aria-label="label">
    <button type="button" :class="{ 'is-active': model === 'schema' }" @click="model = 'schema'">Schema</button>
    <span></span>
    <button type="button" :class="{ 'is-active': model === 'json' }" @click="model = 'json'">JSON</button>
  </div>
</template>

<style scoped>
.api-definition-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-definition-view-switch button {
  min-height: 24px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-definition-view-switch button:hover,
.api-definition-view-switch button.is-active {
  color: #ff7d00;
}

.api-definition-view-switch span {
  width: 1px;
  height: 13px;
  background: var(--app-border);
}
</style>
