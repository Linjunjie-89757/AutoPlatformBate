<script setup lang="ts">
import { useRouter } from 'vue-router'

type WebUiModuleTabKey = 'cases' | 'elements' | 'suites' | 'records' | 'environments'

defineProps<{
  active: WebUiModuleTabKey
}>()

const router = useRouter()

const tabs: Array<{ key: WebUiModuleTabKey; label: string; path: string }> = [
  { key: 'cases', label: '用例管理', path: '/automation/web/cases' },
  { key: 'elements', label: '元素库', path: '/automation/web/elements' },
  { key: 'suites', label: '执行套件', path: '/automation/web/suites' },
  { key: 'records', label: '执行记录', path: '/automation/web/runs' },
  { key: 'environments', label: '环境配置', path: '/automation/web/environments' },
]

function navigate(path: string) {
  void router.push(path)
}
</script>

<template>
  <nav class="web-ui-module-tabs" role="tablist" aria-label="Web UI 自动化">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="web-ui-module-tabs__item"
      :class="{ 'is-active': active === tab.key }"
      type="button"
      role="tab"
      :aria-selected="active === tab.key"
      @click="navigate(tab.path)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.web-ui-module-tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.web-ui-module-tabs__item {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font: 500 13px/19.5px Inter, "Noto Sans SC", sans-serif;
}

.web-ui-module-tabs__item.is-active {
  border-bottom-color: #0fc6c2;
  color: #0fc6c2;
}
</style>
