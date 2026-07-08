<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import ScenarioAssertionEditor from './ScenarioAssertionEditor.vue'
import ScenarioProcessorEditor from './ScenarioProcessorEditor.vue'
import ApiScenarioBodyFormGrid from './ApiScenarioBodyFormGrid.vue'
import ApiScenarioKeyValueGrid from './ApiScenarioKeyValueGrid.vue'
import ApiScenarioStepResponsePanel from './ApiScenarioStepResponsePanel.vue'
import type { ApiScenarioCustomStepConfigPanelProps, ScenarioResponseTab } from './lib/apiScenarioStepConfigTypes'

defineProps<ApiScenarioCustomStepConfigPanelProps>()

const scenarioStepConfigActiveTab = defineModel<string>('configActiveTab', { required: true })
const scenarioStepCustomResponseTab = defineModel<ScenarioResponseTab>('customResponseTab', { required: true })
const scenarioStepHeaderSelectionModel = defineModel<boolean>('headerSelection', { required: true })
const scenarioStepQuerySelectionModel = defineModel<boolean>('querySelection', { required: true })
const scenarioStepBodyFormSelectionModel = defineModel<boolean>('bodyFormSelection', { required: true })
const scenarioStepRawText = defineModel<string>('rawText', { required: true })
const activeScenarioStepPreProcessors = defineModel<unknown[]>('preProcessors', { required: true })
const activeScenarioStepPostProcessors = defineModel<unknown[]>('postProcessors', { required: true })
const activeScenarioStepAssertions = defineModel<unknown[]>('assertions', { required: true })
const scenarioStepCustomActivePreProcessorId = defineModel<string | null>('activePreProcessorId', { required: true })
const scenarioStepCustomActivePostProcessorId = defineModel<string | null>('activePostProcessorId', { required: true })
const scenarioStepCustomActiveAssertionId = defineModel<string | null>('customActiveAssertionId', { required: true })
</script>

<template>
          <div class="scenario-step-config-request-row">
            <el-select model-value="HTTP" class="scenario-step-protocol-select" disabled>
              <el-option label="HTTP" value="HTTP" />
            </el-select>
            <el-select
              v-model="activeScenarioStepRequestConfig.method"
              :class="['scenario-step-method-select', 'scenario-step-request-method-select', requestMethodClass(activeScenarioStepRequestConfig.method)]"
              popper-class="request-method-popper"
              @change="markScenarioDirty"
            >
              <el-option v-for="method in requestMethodOptions" :key="method" :label="method" :value="method">
                <span :class="['scenario-step-method-option', requestMethodClass(method)]">{{ method }}</span>
              </el-option>
            </el-select>
            <el-input v-model="activeScenarioStepRequestConfig.path" class="scenario-step-url-input" placeholder="请输入包含 http/https 的完整 URL 或接口路径" @input="markScenarioDirty" />
            <el-button type="primary" :loading="scenarioStepCustomDebugLoading" :disabled="!scenarioStepCustomCanDebug" @click="debugScenarioStepCustomRequest">发送</el-button>
          </div>
          <div class="ms-like-top-tabs scenario-step-config-tabs">
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'headers' }]" @click="scenarioStepConfigActiveTab = 'headers'">请求头</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'body' }]" @click="scenarioStepConfigActiveTab = 'body'">请求体</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'params' }]" @click="scenarioStepConfigActiveTab = 'params'">
              Params
              <span v-if="scenarioStepCustomQueryEnabledCount" class="ms-like-tab-badge">{{ scenarioStepCustomQueryEnabledCount }}</span>
            </button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'auth' }]" @click="scenarioStepConfigActiveTab = 'auth'">Auth</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'pre' }]" @click="scenarioStepConfigActiveTab = 'pre'">前置处理</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'post' }]" @click="scenarioStepConfigActiveTab = 'post'">后置处理</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'tests' }]" @click="scenarioStepConfigActiveTab = 'tests'">
              断言
              <span v-if="scenarioStepCustomAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepCustomAssertionEnabledCount }}</span>
            </button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'settings' }]" @click="scenarioStepConfigActiveTab = 'settings'">设置</button>
          </div>
          <div class="scenario-step-config-body scenario-custom-request-body app-soft-scrollbar">
            <ApiScenarioKeyValueGrid
              v-if="scenarioStepConfigActiveTab === 'headers'"
              v-model:selection="scenarioStepHeaderSelectionModel"
              variant="header"
              :rows="activeScenarioStepRequestConfig.headers"
              :selection-state="scenarioTableSelectionState(activeScenarioStepRequestConfig.headers)"
              :defaults="scenarioHeaderParamDefaults()"
              :mark-scenario-dirty="markScenarioDirty"
              :handle-scenario-key-value-row-input="handleScenarioKeyValueRowInput"
              :remove-scenario-key-value-row="removeScenarioKeyValueRow"
              :add-scenario-key-value-row="addScenarioKeyValueRow"
            />
            <ApiScenarioKeyValueGrid
              v-else-if="scenarioStepConfigActiveTab === 'params'"
              v-model:selection="scenarioStepQuerySelectionModel"
              variant="query"
              :rows="activeScenarioStepRequestConfig.queryParams"
              :selection-state="scenarioTableSelectionState(activeScenarioStepRequestConfig.queryParams)"
              :defaults="scenarioQueryParamDefaults()"
              :param-type-options="scenarioQueryParamTypeOptions"
              :mark-scenario-dirty="markScenarioDirty"
              :handle-scenario-key-value-row-input="handleScenarioKeyValueRowInput"
              :remove-scenario-key-value-row="removeScenarioKeyValueRow"
              :add-scenario-key-value-row="addScenarioKeyValueRow"
            />
            <div v-else-if="scenarioStepConfigActiveTab === 'body'" class="scenario-step-body-section">
              <div class="ms-like-body-type-row">
                <button
                  v-for="mode in scenarioStepBodyModes"
                  :key="mode.value"
                  :class="['ms-like-body-chip', { active: activeScenarioStepRequestConfig.body.type === mode.value }]"
                  type="button"
                  @click="setScenarioStepBodyMode(mode.value)"
                >
                  {{ mode.label }}
                </button>
              </div>
              <div class="ms-like-body-mode-shell">
                <ApiCodeEditor
                  v-if="isScenarioRawBody(activeScenarioStepRequestConfig.body.type)"
                  v-model="scenarioStepRawText"
                  :language="scenarioStepBodyLanguage"
                  height="300px"
                  placeholder="请输入请求体"
                  @change="markScenarioDirty"
                />
                <div v-else-if="activeScenarioStepRequestConfig.body.type === 'BINARY'" class="request-section ms-like-form-panel">
                  <div class="ms-like-form-row">
                    <div class="ms-like-form-label">File</div>
                    <el-input v-model="activeScenarioStepRequestConfig.body.fileName" class="ms-like-form-control" placeholder="文件名" @input="markScenarioDirty" />
                  </div>
                </div>
                <ApiScenarioBodyFormGrid
                  v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(activeScenarioStepRequestConfig.body.type)"
                  v-model:selection="scenarioStepBodyFormSelectionModel"
                  :rows="activeScenarioStepRequestConfig.body.formItems"
                  :selection-state="scenarioTableSelectionState(activeScenarioStepRequestConfig.body.formItems)"
                  :defaults="scenarioBodyFormParamDefaults()"
                  :param-type-options="scenarioBodyParamTypeOptions()"
                  :mark-scenario-dirty="markScenarioDirty"
                  :handle-scenario-key-value-row-input="handleScenarioKeyValueRowInput"
                  :remove-scenario-key-value-row="removeScenarioKeyValueRow"
                  :add-scenario-key-value-row="addScenarioKeyValueRow"
                  :pick-scenario-body-form-row-file="pickScenarioBodyFormRowFile"
                  :clear-scenario-body-form-row-file="clearScenarioBodyFormRowFile"
                  :format-scenario-body-form-file-size="formatScenarioBodyFormFileSize"
                />
                <div v-else class="ms-like-empty-body">请求没有 Body</div>
              </div>
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'pre'" class="scenario-step-advanced-pane">
              <ScenarioProcessorEditor
                v-model="activeScenarioStepPreProcessors"
                v-model:active-id="scenarioStepCustomActivePreProcessorId"
                stage="pre"
                :db-connections="dbConnections"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'post'" class="scenario-step-advanced-pane">
              <ScenarioProcessorEditor
                v-model="activeScenarioStepPostProcessors"
                v-model:active-id="scenarioStepCustomActivePostProcessorId"
                stage="post"
                :db-connections="dbConnections"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'tests'" class="scenario-step-advanced-pane">
              <ScenarioAssertionEditor
                v-model="activeScenarioStepAssertions"
                v-model:active-id="scenarioStepCustomActiveAssertionId"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'auth'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>认证方式</span>
                <el-radio-group v-model="activeScenarioStepRequestConfig.authConfig.authType" @change="markScenarioDirty">
                  <el-radio-button value="NONE">None</el-radio-button>
                  <el-radio-button value="BASIC">Basic</el-radio-button>
                  <el-radio-button value="DIGEST">Digest</el-radio-button>
                </el-radio-group>
              </div>
              <template v-if="activeScenarioStepRequestConfig.authConfig.authType === 'BASIC'">
                <div class="scenario-step-form-row"><span>Username</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.basicAuth!.userName" @input="markScenarioDirty" /></div>
                <div class="scenario-step-form-row"><span>Password</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.basicAuth!.password" show-password @input="markScenarioDirty" /></div>
              </template>
              <template v-else-if="activeScenarioStepRequestConfig.authConfig.authType === 'DIGEST'">
                <div class="scenario-step-form-row"><span>Username</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.digestAuth!.userName" @input="markScenarioDirty" /></div>
                <div class="scenario-step-form-row"><span>Password</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.digestAuth!.password" show-password @input="markScenarioDirty" /></div>
              </template>
            </div>
            <div v-else class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>超时时间</span>
                <el-input-number v-model="activeScenarioStepRequestConfig.timeoutMs" :min="1000" :step="1000" @change="markScenarioDirty" />
              </div>
              <div class="scenario-step-settings-hint">调试上下文 {{ environmentName() }} / {{ variableSetName() }}</div>
            </div>
          </div>
          <ApiScenarioStepResponsePanel
            v-model:active-tab="scenarioStepCustomResponseTab"
            shell-class="scenario-custom-response-shell"
            :show-empty-state="scenarioStepCustomShowResponseEmptyState"
            :assertion-presentation="scenarioStepCustomAssertionResultPresentation"
            :status-tone="scenarioStepCustomResponseStatusTone"
            :status-code="scenarioStepCustomResponseStatusCode"
            :duration="scenarioStepCustomResponseDuration"
            :response-size="scenarioStepCustomResponseSize"
            :debug-message="scenarioStepCustomDebugMessage"
            :body-text="scenarioStepCustomResponseBodyPretty"
            :body-language="scenarioStepCustomResponseBodyLanguage"
            :headers-text="scenarioStepCustomResponseHeaders"
            :console-text="scenarioStepCustomConsole"
            :actual-request-text="scenarioStepCustomActualRequest"
            :assertion-results="scenarioStepCustomAssertionResults"
            :assertion-type-label="assertionTypeLabel"
            :assertion-condition-label="assertionConditionLabel"
            :assertion-result-class="assertionResultClass"
            :assertion-result-label="assertionResultLabel"
            :show-assertion-type-column="true"
          />
        </template>
