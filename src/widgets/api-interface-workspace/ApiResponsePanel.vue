<script setup lang="ts">
import type { ApiAssertionResult } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'
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
        <div class="api-response-tabs">
          <button :class="{ 'is-active': activeTab === 'body' }" @click="emit('update:activeTab', 'body')">响应体</button>
          <button :class="{ 'is-active': activeTab === 'header' }" @click="emit('update:activeTab', 'header')">Headers</button>
          <button :class="{ 'is-active': activeTab === 'cookies' }" @click="emit('update:activeTab', 'cookies')">Cookies</button>
          <button :class="{ 'is-active': activeTab === 'assertions' }" @click="emit('update:activeTab', 'assertions')">断言结果</button>
        </div>
      </div>
    </div>
    <div class="api-response-content">
      <div v-if="showEmpty" class="api-response-empty">
        <img class="api-response-empty__icon" :src="figmaApiInterfaceIcons.responseEmpty" alt="" />
        <p>点击「发送」获取响应内容</p>
      </div>
      <template v-else>
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
        <div v-else-if="activeTab === 'cookies'" class="api-response-empty is-inline">
          <p>当前响应暂无 Cookies</p>
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
  box-sizing: border-box;
  min-height: 280px;
  flex: 1 1 280px;
  flex-direction: column;
  height: auto;
  border-top: 2px solid #e5e6eb;
  background: #ffffff;
  overflow: hidden;
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
  content: none;
}

.api-response-header {
  display: flex;
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.api-response-header strong {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.api-response-header__right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
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
  min-height: 238px;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.api-response-empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px;
  color: #c9cdd4;
}

.api-response-empty.is-inline {
  min-height: 0;
}

.api-response-empty__icon {
  display: block;
  width: 28px;
  height: 28px;
}

.api-response-empty p {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-align: center;
}

.api-response-empty b {
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs {
  display: flex;
  height: 28px;
  min-height: 28px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.api-response-tabs button {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  padding: 0 10.5px 2px;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs button:not(.is-active):hover {
  background: transparent;
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
