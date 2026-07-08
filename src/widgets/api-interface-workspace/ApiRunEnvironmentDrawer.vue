<script setup lang="ts">
import { computed } from 'vue'
import type { ApiAutomationEnvironmentItem } from '@/entities/api-automation'
import type { MockApplicationItem, MockBusinessScenarioItem, ParamSetItem } from '@/entities/config'

interface RunEnvironmentServiceItem {
  key: string
  name: string
  baseUrl: string
  isDefault?: boolean
}

interface RunEnvironmentHeaderItem {
  key: string
  value: string
  enabled: boolean
}

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  errorMessage: string
  environment: ApiAutomationEnvironmentItem | null
  workspaceLabel: string
  statusLabel: string
  services: RunEnvironmentServiceItem[]
  defaultParamSet: ParamSetItem | null
  defaultParamSetValueText: string
  defaultParamSetDescriptionText: string
  mockApplication: MockApplicationItem | null
  mockBusinessScenarios: MockBusinessScenarioItem[]
  selectedMockBusinessScenarioId: number | null
  selectedMockBusinessScenarioDescription: string
  headers: RunEnvironmentHeaderItem[]
  timeoutLabel: string
  sslLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:selectedMockBusinessScenarioId': [value: number | null]
  config: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const mockScenarioId = computed({
  get: () => props.selectedMockBusinessScenarioId,
  set: (value: number | null) => emit('update:selectedMockBusinessScenarioId', value),
})

function maskHeaderValue(key: string, value: string) {
  if (!value) {
    return '-'
  }
  return /authorization|token|secret|password|cookie/i.test(key) ? '••••••••' : value
}
</script>

<template>
  <el-drawer
    v-model="visible"
    append-to-body
    size="520px"
    class="api-run-environment-drawer"
    title="运行环境详情"
  >
    <div class="api-run-environment-detail" v-loading="loading">
      <el-alert
        v-if="errorMessage"
        type="error"
        :closable="false"
        :title="errorMessage"
      />
      <template v-if="environment">
        <div class="api-run-environment-summary">
          <div>
            <strong>{{ environment.name }}</strong>
            <span>{{ workspaceLabel }} · {{ statusLabel }}</span>
          </div>
          <small>{{ environment.baseUrl || '未配置 Base URL' }}</small>
        </div>

        <section class="api-run-environment-section">
          <div class="api-run-environment-section__title">
            <span>服务地址</span>
            <em>{{ services.length }} 个</em>
          </div>
          <div v-if="services.length" class="api-run-environment-service-list">
            <div
              v-for="service in services"
              :key="service.key"
              class="api-run-environment-service"
            >
              <div>
                <strong>{{ service.name }}</strong>
                <span>{{ service.key }}</span>
              </div>
              <div class="api-run-environment-service__meta">
                <small>{{ service.baseUrl }}</small>
                <em v-if="service.isDefault">默认</em>
              </div>
            </div>
          </div>
          <div v-else class="api-run-environment-empty">未配置服务地址</div>
        </section>

        <section class="api-run-environment-section">
          <div class="api-run-environment-section__title">
            <span>运行绑定</span>
          </div>
          <div class="api-run-environment-binding-grid">
            <div>
              <span>默认变量集</span>
              <strong>{{ defaultParamSet?.paramName || '未绑定' }}</strong>
              <small v-if="defaultParamSet">
                {{ defaultParamSetValueText }} · {{ defaultParamSetDescriptionText }}
              </small>
              <small v-else>运行时只使用环境变量和接口配置</small>
            </div>
            <div>
              <span>Mock 应用</span>
              <strong>{{ mockApplication?.appName || '未绑定' }}</strong>
              <small v-if="mockApplication">
                {{ mockApplication.appCode }} · {{ mockApplication.description || '未填写描述' }}
              </small>
              <small v-else>请求将按真实目标地址发送</small>
            </div>
            <div v-if="mockApplication">
              <span>本次 Mock 场景</span>
              <el-select
                v-model="mockScenarioId"
                clearable
                filterable
                placeholder="按 Mock 默认规则匹配"
                size="small"
              >
                <el-option
                  v-for="scenario in mockBusinessScenarios"
                  :key="scenario.id"
                  :label="scenario.scenarioName"
                  :value="scenario.id"
                />
              </el-select>
              <small>
                {{ selectedMockBusinessScenarioDescription || '选择后本次运行只按该业务场景命中 Mock；不选择则使用 Mock 默认匹配。' }}
              </small>
            </div>
          </div>
        </section>

        <section class="api-run-environment-section">
          <div class="api-run-environment-section__title">
            <span>请求策略</span>
          </div>
          <div class="api-run-environment-policy-list">
            <span>超时 {{ timeoutLabel }}</span>
            <span>{{ sslLabel }}</span>
            <span>Header {{ headers.length ? `${headers.length} 个` : '未配置' }}</span>
          </div>
          <div v-if="headers.length" class="api-run-environment-header-list">
            <div v-for="header in headers" :key="header.key">
              <span>{{ header.key }}</span>
              <strong>{{ maskHeaderValue(header.key, header.value) }}</strong>
            </div>
          </div>
        </section>
      </template>
    </div>
    <template #footer>
      <div class="api-run-environment-drawer-footer">
        <el-button @click="visible = false">关闭</el-button>
        <el-button type="primary" @click="emit('config')">去配置中心编辑</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
:global(.api-run-environment-drawer) {
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

.api-run-environment-detail {
  display: grid;
  gap: 12px;
  min-height: 0;
}

.api-run-environment-summary {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
}

.api-run-environment-summary div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-run-environment-summary strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-environment-summary span,
.api-run-environment-summary small {
  color: #475569;
  font-size: 12px;
}

.api-run-environment-summary small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-environment-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-run-environment-section__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.api-run-environment-section__title em {
  color: var(--app-text-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.api-run-environment-service span,
.api-run-environment-service small,
.api-run-environment-binding-grid span,
.api-run-environment-binding-grid small,
.api-run-environment-empty,
.api-run-environment-header-list span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-run-environment-service strong,
.api-run-environment-binding-grid strong,
.api-run-environment-header-list strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.api-run-environment-service-list {
  display: grid;
  gap: 8px;
}

.api-run-environment-service {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-service div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-run-environment-service em {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 999px;
  background: #dbeafe;
  color: var(--app-primary);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.api-run-environment-service__meta {
  margin-top: 3px;
}

.api-run-environment-binding-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.api-run-environment-binding-grid > div {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-binding-grid :deep(.el-select__wrapper) {
  min-height: 30px;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.api-run-environment-policy-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-run-environment-policy-list span {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: #f8fafc;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.api-run-environment-header-list {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}

.api-run-environment-header-list div {
  display: grid;
  grid-template-columns: minmax(90px, 0.45fr) minmax(0, 1fr);
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
