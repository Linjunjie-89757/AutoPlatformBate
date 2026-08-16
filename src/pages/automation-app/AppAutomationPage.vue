<script setup lang="ts">
import { Smartphone } from '@lucide/vue'
</script>

<template>
  <section class="app-automation-placeholder">
    <div class="app-automation-placeholder__content">
      <div class="app-automation-placeholder__icon" aria-hidden="true">
        <Smartphone />
      </div>
      <h1>APP 自动化</h1>
      <p>该模块正在开发中，敬请期待</p>
    </div>
  </section>
</template>

<style scoped>
.app-automation-placeholder {
  display: flex;
  min-height: calc(100dvh - 42px);
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
}

.app-automation-placeholder__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.app-automation-placeholder__icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f2f3f5;
  color: #c9cdd4;
}

.app-automation-placeholder__icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.app-automation-placeholder h1 {
  margin: 12px 0 0;
  color: #4e5969;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.app-automation-placeholder p {
  margin: 2px 0 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}
</style>
