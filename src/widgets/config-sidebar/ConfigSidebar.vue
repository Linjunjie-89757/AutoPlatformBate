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
  gap: 2px;
  width: 226px;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-soft);
}

.config-sidebar__item {
  position: relative;
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: var(--app-space-2);
  padding: 10px var(--app-space-3);
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease, color 160ms ease;
}

.config-sidebar__item:hover {
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
}

.config-sidebar__item.is-active {
  background: var(--app-bg-panel);
  color: var(--app-primary-active);
  box-shadow: inset 0 0 0 1px var(--app-border-soft);
}

.config-sidebar__item.is-active::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 6px;
  width: 3px;
  border-radius: 3px;
  background: var(--app-primary);
  content: "";
}

.config-sidebar__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: 16px;
}

.config-sidebar__item.is-active .config-sidebar__icon {
  color: var(--app-primary);
}

.config-sidebar strong {
  display: block;
  font-size: var(--app-font-size-md);
  font-weight: 500;
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
