<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import ApiScenarioStepResponsePanel from './ApiScenarioStepResponsePanel.vue'
import type { ApiScenarioSystemStepConfigPanelProps, ScenarioResponseTab } from './lib/apiScenarioStepConfigTypes'

defineProps<ApiScenarioSystemStepConfigPanelProps>()

const scenarioStepConfigActiveTab = defineModel<string>('configActiveTab', { required: true })
const scenarioStepSystemResponseTab = defineModel<ScenarioResponseTab>('systemResponseTab', { required: true })
</script>

<template>
          <div v-loading="scenarioStepSystemDetailLoading" class="scenario-step-system-shell">
            <template v-if="scenarioStepSystemDetail">
              <div class="scenario-step-config-request-row">
                <el-select model-value="HTTP" class="scenario-step-protocol-select" disabled>
                  <el-option label="HTTP" value="HTTP" />
                </el-select>
                <span :class="['scenario-step-method scenario-system-request-method', requestMethodClass(scenarioStepSystemConfig.method)]">{{ scenarioStepSystemConfig.method }}</span>
                <el-input :model-value="scenarioStepSystemConfig.path" class="scenario-step-url-input request-url-input" readonly />
                <el-button type="primary" :loading="scenarioStepSystemDebugLoading" :disabled="!scenarioStepSystemCanDebug" @click="debugScenarioStepSystemRequest">发送</el-button>
              </div>
              <div class="ms-like-top-tabs scenario-step-config-tabs">
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'headers' }]" @click="scenarioStepConfigActiveTab = 'headers'">请求头</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'body' }]" @click="scenarioStepConfigActiveTab = 'body'">请求体</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'params' }]" @click="scenarioStepConfigActiveTab = 'params'">
                  Params
                  <span v-if="scenarioStepSystemQueryEnabledCount" class="ms-like-tab-badge">{{ scenarioStepSystemQueryEnabledCount }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'auth' }]" @click="scenarioStepConfigActiveTab = 'auth'">Auth</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'pre' }]" @click="scenarioStepConfigActiveTab = 'pre'">前置处理</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'post' }]" @click="scenarioStepConfigActiveTab = 'post'">后置处理</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'tests' }]" @click="scenarioStepConfigActiveTab = 'tests'">
                  断言
                  <span v-if="scenarioStepSystemAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepSystemAssertionEnabledCount }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'settings' }]" @click="scenarioStepConfigActiveTab = 'settings'">设置</button>
              </div>
              <div class="scenario-step-config-body scenario-system-request-body app-soft-scrollbar">
                <el-table v-if="scenarioStepConfigActiveTab === 'headers'" :data="enabledScenarioRows(scenarioStepSystemConfig.headers)" size="small">
                  <el-table-column prop="key" label="参数名称" min-width="180" />
                  <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                  <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  <el-table-column label="启用" width="80">
                    <template #default="{ row }">{{ row.enabled === false ? '否' : '是' }}</template>
                  </el-table-column>
                </el-table>
                <el-table v-else-if="scenarioStepConfigActiveTab === 'params'" :data="enabledScenarioRows(scenarioStepSystemConfig.queryParams)" size="small">
                  <el-table-column prop="key" label="参数名称" min-width="180" />
                  <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                  <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  <el-table-column label="启用" width="80">
                    <template #default="{ row }">{{ row.enabled === false ? '否' : '是' }}</template>
                  </el-table-column>
                </el-table>
                <template v-else-if="scenarioStepConfigActiveTab === 'body'">
                  <div class="scenario-system-body-type">Body Type: {{ scenarioStepSystemConfig.body.type }}</div>
                  <ApiCodeEditor v-if="scenarioStepSystemBodyText" :model-value="scenarioStepSystemBodyText" :language="scenarioStepSystemBodyLanguage" :read-only="true" :show-format-button="false" height="360px" />
                  <el-table v-else-if="enabledScenarioRows(scenarioStepSystemConfig.body.formItems).length" :data="enabledScenarioRows(scenarioStepSystemConfig.body.formItems)" size="small">
                    <el-table-column prop="key" label="参数名称" min-width="180" />
                    <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                    <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  </el-table>
                  <div v-else class="scenario-step-empty-body">请求没有 Body</div>
                </template>
                <div v-else-if="scenarioStepConfigActiveTab === 'auth'" class="scenario-step-form-panel">
                  <div class="scenario-step-form-row"><span>认证方式</span><strong>{{ scenarioStepSystemConfig.authConfig.authType }}</strong></div>
                </div>
                <div v-else-if="scenarioStepConfigActiveTab === 'pre'" class="scenario-system-list">
                  <div v-for="(item, index) in scenarioStepSystemDetail.preProcessors" :key="String(scenarioUnknownValue(item, 'id') || index)" class="scenario-system-list-item">
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'name')) }}</span>
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'processorType')) }}</span>
                  </div>
                  <div v-if="!scenarioStepSystemDetail.preProcessors.length" class="scenario-mini-empty">未配置前置处理</div>
                </div>
                <div v-else-if="scenarioStepConfigActiveTab === 'post'" class="scenario-system-list">
                  <div v-for="(item, index) in scenarioStepSystemDetail.postProcessors" :key="String(scenarioUnknownValue(item, 'id') || index)" class="scenario-system-list-item">
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'name')) }}</span>
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'processorType')) }}</span>
                  </div>
                  <div v-if="!scenarioStepSystemDetail.postProcessors.length" class="scenario-mini-empty">未配置后置处理</div>
                </div>
                <template v-else-if="scenarioStepConfigActiveTab === 'tests'">
                  <el-table v-if="scenarioStepSystemDetail.assertions.length" :data="scenarioStepSystemDetail.assertions" size="small">
                    <el-table-column label="断言名称" min-width="160">
                      <template #default="{ row }">{{ scenarioUnknownText(scenarioUnknownValue(row, 'name') || assertionTypeLabel(String(scenarioUnknownValue(row, 'assertionType') || scenarioUnknownValue(row, 'type') || ''))) }}</template>
                    </el-table-column>
                    <el-table-column label="断言对象" min-width="120">
                      <template #default="{ row }">{{ assertionTypeLabel(String(scenarioUnknownValue(row, 'assertionType') || scenarioUnknownValue(row, 'type') || '')) }}</template>
                    </el-table-column>
                    <el-table-column label="期望值" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">{{ scenarioUnknownText(scenarioUnknownValue(row, 'expectedValue')) }}</template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="scenario-mini-empty">未配置断言</div>
                </template>
                <div v-else class="scenario-step-form-panel">
                  <div class="scenario-step-form-row"><span>超时时间</span><strong>{{ scenarioStepSystemConfig.timeoutMs || 10000 }} ms</strong></div>
                </div>
              </div>
              <ApiScenarioStepResponsePanel
                v-model:active-tab="scenarioStepSystemResponseTab"
                :show-empty-state="scenarioStepSystemShowResponseEmptyState"
                :assertion-presentation="scenarioStepSystemAssertionResultPresentation"
                :status-tone="scenarioStepSystemResponseStatusTone"
                :status-code="scenarioStepSystemResponseStatusCode"
                :duration="scenarioStepSystemResponseDuration"
                :response-size="scenarioStepSystemResponseSize"
                :debug-message="scenarioStepSystemDebugMessage"
                :body-text="scenarioStepSystemResponseBodyPretty"
                :body-language="scenarioStepSystemResponseBodyLanguage"
                :headers-text="scenarioStepSystemResponseHeaders"
                :console-text="scenarioStepSystemConsole"
                :actual-request-text="scenarioStepSystemActualRequest"
                :assertion-results="scenarioStepSystemAssertionResults"
                :assertion-type-label="assertionTypeLabel"
                :assertion-condition-label="assertionConditionLabel"
                :assertion-result-class="assertionResultClass"
                :assertion-result-label="assertionResultLabel"
              />
            </template>
          </div>
        </template>
