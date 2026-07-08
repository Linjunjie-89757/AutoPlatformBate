<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import type { ApiScenarioStepResponsePanelProps, ScenarioResponseTab } from './lib/apiScenarioStepConfigTypes'

withDefaults(defineProps<ApiScenarioStepResponsePanelProps>(), {
  shellClass: '',
  showAssertionTypeColumn: false,
})

const activeResponseTab = defineModel<ScenarioResponseTab>('activeTab', { required: true })
</script>

<template>
  <div :class="['ms-like-response-shell', 'scenario-step-response-shell', shellClass]">
    <div class="api-response-header">
      <strong>响应内容</strong>
      <div class="api-response-header__right">
        <div v-if="!showEmptyState" class="api-response-metrics">
          <span v-if="assertionPresentation.visible" :class="['api-response-result-pill', `is-${assertionPresentation.tone}`]">
            {{ assertionPresentation.label }}
          </span>
          <span :class="['api-response-pill', `is-${statusTone}`]">状态 {{ statusCode ?? '-' }}</span>
          <span>耗时 {{ duration ?? '-' }}<template v-if="duration !== null"> ms</template></span>
          <span>大小 {{ responseSize }}</span>
        </div>
      </div>
    </div>

    <div v-if="debugMessage" class="response-error-banner">
      {{ debugMessage }}
    </div>

    <div v-if="showEmptyState" class="ms-like-response-empty">
      <div class="ms-like-response-empty-card">
        <div class="ms-like-response-empty-visual">
          <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
        </div>
        <div class="ms-like-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
      </div>
    </div>

    <template v-else>
      <div class="api-response-tabs">
        <button :class="{ 'is-active': activeResponseTab === 'body' }" @click="activeResponseTab = 'body'">Body</button>
        <button :class="{ 'is-active': activeResponseTab === 'header' }" @click="activeResponseTab = 'header'">Header</button>
        <button :class="{ 'is-active': activeResponseTab === 'console' }" @click="activeResponseTab = 'console'">控制台</button>
        <button :class="{ 'is-active': activeResponseTab === 'actualRequest' }" @click="activeResponseTab = 'actualRequest'">实际请求</button>
        <button :class="{ 'is-active': activeResponseTab === 'assertions' }" @click="activeResponseTab = 'assertions'">断言</button>
      </div>
      <div class="ms-like-response-body">
        <ApiCodeEditor v-if="activeResponseTab === 'body'" :model-value="bodyText || '-'" :language="bodyLanguage" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
        <ApiCodeEditor v-else-if="activeResponseTab === 'header'" :model-value="headersText" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
        <ApiCodeEditor v-else-if="activeResponseTab === 'console'" :model-value="consoleText" language="text" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
        <ApiCodeEditor v-else-if="activeResponseTab === 'actualRequest'" :model-value="actualRequestText" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
        <div v-else class="assertion-result-panel">
          <div v-if="!assertionResults.length" class="assertion-result-empty">当前请求未配置断言</div>
          <el-table v-else :data="assertionResults" size="small" class="assertion-result-table">
            <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column v-if="showAssertionTypeColumn" label="断言对象" width="96">
              <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column label="条件" width="92">
              <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
            </el-table-column>
            <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
            </el-table-column>
            <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.actualValue || '-' }}</template>
            </el-table-column>
            <el-table-column label="结果" width="78">
              <template #default="{ row }"><span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span></template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>
