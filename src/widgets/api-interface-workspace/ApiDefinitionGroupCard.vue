<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="api-definition-group">
    <div class="api-definition-group__head">
      <div>
        <strong>{{ title }}</strong>
        <span v-if="description">{{ description }}</span>
      </div>
      <div v-if="$slots.actions" class="api-definition-head-actions">
        <slot name="actions"></slot>
      </div>
    </div>
    <slot></slot>
  </div>
</template>

<style scoped>
.api-definition-group {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: none;
}

.api-definition-group__head {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.api-definition-group__head > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.api-definition-group__head strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-group__head span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-definition-head-actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>
