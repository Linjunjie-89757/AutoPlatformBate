<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const caseCenterTabs = [
  { label: '用例管理', routeName: 'cases-manage' },
  { label: 'AI 用例生成', routeName: 'cases-ai-generate' },
  { label: 'AI 生成记录', routeName: 'cases-ai-records' },
  { label: 'AI 配置', routeName: 'cases-ai-config' },
] as const

const activeTabName = computed(() => {
  const routeName = String(route.name || '')
  if (routeName === 'case-execution') return 'cases-manage'
  if (routeName === 'cases-ai-record-detail') return 'cases-ai-records'
  return routeName
})
</script>

<template>
  <section class="case-center-page">
    <nav class="case-center-page__tabs" aria-label="用例中心模块导航">
      <RouterLink
        v-for="item in caseCenterTabs"
        :key="item.routeName"
        :to="{ name: item.routeName, query: route.query }"
        class="case-center-page__tab"
        :class="{ 'is-active': activeTabName === item.routeName }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="case-center-page__content">
      <RouterView />
    </div>
  </section>
</template>

<style scoped>
.case-center-page {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.case-center-page__tabs {
  display: flex;
  height: 44px;
  min-height: 44px;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.case-center-page__tab {
  display: inline-flex;
  height: 43px;
  align-items: center;
  padding: 0 14px;
  border-bottom: 2px solid transparent;
  color: var(--app-text-muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  transition: border-color 150ms ease, color 150ms ease;
}

.case-center-page__tab:hover {
  color: var(--app-text-secondary);
}

.case-center-page__tab.is-active {
  border-bottom-color: var(--app-success);
  color: var(--app-success);
}

.case-center-page__content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.case-center-page__content > :deep(*) {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
