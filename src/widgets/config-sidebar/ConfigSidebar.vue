<script setup lang="ts">
import { Bell, Coin, Connection, Cpu, Key } from '@element-plus/icons-vue'

import { configCenterTabs, type ConfigCenterTab } from '@/entities/config'

defineProps<{
  activeTab: ConfigCenterTab
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: ConfigCenterTab]
}>()

const icons = {
  env: Connection,
  param: Key,
  mock: Connection,
  runner: Cpu,
  notification: Bell,
  proxy: Connection,
  dbConnection: Coin,
}
</script>

<template>
  <aside class="config-sidebar">
    <button
      v-for="item in configCenterTabs"
      :key="item.id"
      type="button"
      class="config-sidebar__item"
      :class="{ 'is-active': activeTab === item.id }"
      @click="emit('update:activeTab', item.id)"
    >
      <el-icon class="config-sidebar__icon">
        <component :is="icons[item.id]" />
      </el-icon>
      <span>
        <strong>{{ item.label }}</strong>
        <small>{{ item.description }}</small>
      </span>
    </button>
  </aside>
</template>

<style scoped>
.config-sidebar {
  display: flex;
  align-self: stretch;
  flex-direction: column;
  gap: var(--app-space-2);
  width: 220px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-sidebar__item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease, color 160ms ease;
}

.config-sidebar__item:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.config-sidebar__item.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-sidebar__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 17px;
}

.config-sidebar strong {
  display: block;
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.config-sidebar small {
  display: block;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.config-sidebar__item.is-active small {
  color: var(--app-primary-hover);
}

@media (max-width: 900px) {
  .config-sidebar {
    width: 100%;
  }
}
</style>
