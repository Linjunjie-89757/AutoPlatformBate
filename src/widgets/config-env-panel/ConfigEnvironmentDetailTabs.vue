<script setup lang="ts">
import type { EnvironmentDetailTab } from './configEnvironmentPanel.types'

defineProps<{
  activeTab: EnvironmentDetailTab
  labels: Record<EnvironmentDetailTab, string>
}>()

const emit = defineEmits<{ select: [tab: EnvironmentDetailTab] }>()

const tabs: EnvironmentDetailTab[] = ['services', 'variables', 'mock', 'effective', 'references']
</script>

<template>
  <nav class="figma-env__tabs">
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      :class="{ 'is-active': activeTab === tab }"
      @click="emit('select', tab)"
    >
      {{ labels[tab] }}
    </button>
  </nav>
</template>
