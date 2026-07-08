<script setup lang="ts">
import type { ApiAssertionResult } from '@/entities/api-automation'
import ApiCodeEditor from './ApiCodeEditor.vue'
import type { ResponseTab } from './apiInterfaceTypes'

defineProps<{
  minHeight: number
  showEmpty: boolean
  activeTab: ResponseTab
  assertionPresentation: { visible: boolean; label: string; tone: string }
  status: number | null
  statusTone: string
  duration: number | null
  size: string
  body: string
  bodyLanguage: 'json' | 'xml' | 'text'
  headers: string
  consoleText: string
  actualRequest: string
  assertionRows: ApiAssertionResult[]
  assertionTypeLabel: (type?: string | null) => string
  assertionConditionLabel: (condition?: string | null) => string
  assertionResultClass: (success?: boolean | null) => string
  assertionResultLabel: (success?: boolean | null) => string
}>()

const emit = defineEmits<{
  resizeStart: [event: PointerEvent]
  'update:activeTab': [value: ResponseTab]
}>()
</script>

<template>
  <div class="api-response-shell" :style="{ minHeight: `${minHeight}px` }">
    <div class="api-response-resizer" title="拖拽调整响应区高度" @pointerdown="emit('resizeStart', $event)"></div>
    <div class="api-response-header">
      <strong>响应内容</strong>
      <div class="api-response-header__right">
        <div v-if="!showEmpty" class="api-response-metrics">
          <span
            v-if="assertionPresentation.visible"
            :class="['api-response-result-pill', `is-${assertionPresentation.tone}`]"
          >
            {{ assertionPresentation.label }}
          </span>
          <span :class="['api-response-pill', `is-${statusTone}`]">状态 {{ status ?? '-' }}</span>
          <span>耗时 {{ duration ?? '-' }}<template v-if="duration !== null"> ms</template></span>
          <span>大小 {{ size }}</span>
        </div>
      </div>
    </div>
    <div class="api-response-content">
      <div v-if="showEmpty" class="api-response-empty">
        <div class="api-response-empty__window"><span></span><span></span><span></span></div>
        <p>点击 <b>发送</b> 获取响应内容</p>
      </div>
      <template v-else>
        <div class="api-response-tabs">
          <button :class="{ 'is-active': activeTab === 'body' }" @click="emit('update:activeTab', 'body')">Body</button>
          <button :class="{ 'is-active': activeTab === 'header' }" @click="emit('update:activeTab', 'header')">Header</button>
          <button :class="{ 'is-active': activeTab === 'console' }" @click="emit('update:activeTab', 'console')">控制台</button>
          <button :class="{ 'is-active': activeTab === 'actualRequest' }" @click="emit('update:activeTab', 'actualRequest')">实际请求</button>
          <button :class="{ 'is-active': activeTab === 'assertions' }" @click="emit('update:activeTab', 'assertions')">断言</button>
        </div>
        <div v-if="activeTab === 'body'" class="api-response-code">
          <ApiCodeEditor
            :model-value="body"
            :language="bodyLanguage"
            read-only
            :show-format-button="false"
            fit-content
            :max-fit-content-height="1000"
            height="100%"
          />
        </div>
        <div v-else-if="activeTab === 'header'" class="api-response-code">
          <ApiCodeEditor
            :model-value="headers"
            language="json"
            read-only
            :show-format-button="false"
            fit-content
            :max-fit-content-height="1000"
            height="100%"
          />
        </div>
        <div v-else-if="activeTab === 'console'" class="api-response-code is-text">
          <ApiCodeEditor
            :model-value="consoleText"
            language="api-console"
            read-only
            :show-format-button="false"
            fit-content
            :max-fit-content-height="1000"
            height="100%"
          />
        </div>
        <div v-else-if="activeTab === 'actualRequest'" class="api-response-code">
          <ApiCodeEditor
            :model-value="actualRequest"
            language="json"
            read-only
            :show-format-button="false"
            fit-content
            :max-fit-content-height="1000"
            height="100%"
          />
        </div>
        <el-table v-else-if="assertionRows.length" :data="assertionRows" size="small">
          <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
          </el-table-column>
          <el-table-column label="断言对象" width="96">
            <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
          </el-table-column>
          <el-table-column label="条件" width="100">
            <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
          </el-table-column>
          <el-table-column label="期望值:" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.expectedValue ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="实际值:" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.actualValue ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <span :class="['api-assertion-result-pill', assertionResultClass(row.success)]">
                {{ assertionResultLabel(row.success) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
          </el-table-column>
        </el-table>
        <div v-else class="api-empty-body">当前请求未配置断言</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.api-response-shell {
  position: relative;
  display: flex;
  min-height: 360px;
  flex: 0 0 auto;
  flex-direction: column;
  border-top: 1px solid #dfe6f0;
  background: #f7f9fc;
  overflow: visible;
}

.api-response-resizer {
  position: absolute;
  z-index: 5;
  top: -3px;
  right: 0;
  left: 0;
  height: 6px;
  flex: none;
  background: transparent;
  cursor: row-resize;
}

.api-response-resizer::after {
  position: absolute;
  top: 2px;
  left: 50%;
  width: 42px;
  height: 2px;
  border-radius: 999px;
  background: #c9d3e2;
  content: "";
  transform: translateX(-50%);
}

.api-response-header {
  display: flex;
  height: 38px;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid #e4eaf2;
  background: #fff;
}

.api-response-header strong {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.api-response-header__right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-response-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 16px;
}

.api-response-result-pill {
  display: inline-flex;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.api-response-result-pill.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-response-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-response-pill {
  display: inline-flex;
  height: 20px;
  align-items: center;
  padding: 0 7px;
  border: 1px solid #e4eaf2;
  border-radius: 999px;
  background: var(--app-bg-soft);
  color: var(--app-text-muted);
}

.api-response-pill.is-success {
  color: var(--app-success);
}

.api-response-pill.is-danger {
  color: var(--app-danger);
}

.api-response-pill.is-warning {
  color: var(--app-warning);
}

.api-response-content {
  display: flex;
  min-height: 300px;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #f7f9fc;
}

.api-response-empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px 0 10px;
  color: var(--app-text-muted);
}

.api-response-empty__window {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #e1e7f0;
  border-radius: 8px;
  background: #fff;
}

.api-response-empty__window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-text-subtle);
  opacity: 0.6;
}

.api-response-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.api-response-empty b {
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs {
  display: flex;
  height: 36px;
  min-height: 36px;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  padding: 0 12px;
  border-bottom: 1px solid #e4eaf2;
  background: #fff;
}

.api-response-tabs button {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 36px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  padding: 0 10px;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs button:not(.is-active):hover {
  background: #f3f6fb;
  color: var(--app-text-secondary);
}

.api-response-tabs button.is-active::after {
  content: none;
}

.api-response-code {
  display: flex;
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  overflow: visible;
  margin: 10px 12px 12px;
}

.api-response-code :deep(.api-code-editor) {
  width: 100%;
  min-height: 0;
}
</style>
