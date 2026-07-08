<script setup lang="ts">
type ScenarioDetailTab = 'steps' | 'testData' | 'reports' | 'settings' | 'cicd'

const activeTab = defineModel<ScenarioDetailTab>({ required: true })
</script>

<template>
  <div class="scenario-edit-toolbar">
    <div class="scenario-detail-tabs">
      <button :class="{ active: activeTab === 'steps' }" @click="activeTab = 'steps'">步骤</button>
      <button :class="{ active: activeTab === 'testData' }" @click="activeTab = 'testData'">测试数据</button>
      <button :class="{ active: activeTab === 'reports' }" @click="activeTab = 'reports'">测试报告</button>
      <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
      <button :class="{ active: activeTab === 'cicd' }" @click="activeTab = 'cicd'">CI/CD</button>
    </div>
  </div>
</template>
