<script setup lang="ts">
defineProps<{
  value: string
}>()
</script>

<template>
  <div class="api-definition-example-panel is-full">
    <pre>{{ value }}</pre>
  </div>
</template>

<style scoped>
.api-definition-example-panel {
  min-width: 0;
  overflow: hidden;
  background: #fff;
}

.api-definition-example-panel pre {
  min-height: 220px;
  max-height: 420px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  background: #ffffff;
  color: #1f2937;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}
</style>
