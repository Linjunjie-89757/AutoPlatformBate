<script setup lang="ts">
import { EditPen } from '@element-plus/icons-vue'

import ApiScenarioControllerStepConfigPanel from './ApiScenarioControllerStepConfigPanel.vue'
import ApiScenarioCustomStepConfigPanel from './ApiScenarioCustomStepConfigPanel.vue'
import ApiScenarioScriptStepConfigPanel from './ApiScenarioScriptStepConfigPanel.vue'
import ApiScenarioSystemStepConfigPanel from './ApiScenarioSystemStepConfigPanel.vue'
import type { ApiScenarioStepConfigDrawerProps, ScenarioResponseTab } from './lib/apiScenarioStepConfigTypes'

const props = defineProps<ApiScenarioStepConfigDrawerProps>()

const scenarioStepConfigVisible = defineModel<boolean>({ required: true })
const scenarioStepConfigActiveTab = defineModel<string>('configActiveTab', { required: true })
const scenarioStepScriptActiveTab = defineModel<string>('scriptActiveTab', { required: true })
const scenarioStepSystemResponseTab = defineModel<ScenarioResponseTab>('systemResponseTab', { required: true })
const scenarioStepCustomResponseTab = defineModel<ScenarioResponseTab>('customResponseTab', { required: true })
const scenarioStepHeaderSelectionModel = defineModel<boolean>('headerSelection', { required: true })
const scenarioStepQuerySelectionModel = defineModel<boolean>('querySelection', { required: true })
const scenarioStepBodyFormSelectionModel = defineModel<boolean>('bodyFormSelection', { required: true })
const scenarioStepRawText = defineModel<string>('rawText', { required: true })
const scenarioStepNameDraft = defineModel<string>('stepNameDraft', { required: true })
const activeScenarioStepPreProcessors = defineModel<unknown[]>('preProcessors', { required: true })
const activeScenarioStepPostProcessors = defineModel<unknown[]>('postProcessors', { required: true })
const activeScenarioStepAssertions = defineModel<unknown[]>('assertions', { required: true })
const scenarioStepCustomActivePreProcessorId = defineModel<string | null>('activePreProcessorId', { required: true })
const scenarioStepCustomActivePostProcessorId = defineModel<string | null>('activePostProcessorId', { required: true })
const scenarioStepCustomActiveAssertionId = defineModel<string | null>('customActiveAssertionId', { required: true })
const scenarioStepScriptActiveAssertionId = defineModel<string | null>('scriptActiveAssertionId', { required: true })

function optionName(items: unknown, id: unknown, fallback: string) {
  if (!Array.isArray(items)) return fallback
  const matched = items.find((item: { id?: unknown; name?: string }) => item.id === id)
  return matched?.name || fallback
}

function environmentName() {
  return optionName(props.environments, props.activeScenarioDetail?.defaultEnvironmentId, '未选择环境')
}

function variableSetName() {
  return optionName(props.variableSets, props.activeScenarioDetail?.variableSetId, '未选择变量集')
}
</script>

<template>
<el-drawer
      v-model="scenarioStepConfigVisible"
      size="960px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-step-config-drawer"
      @closed="closeScenarioStepConfig"
    >
      <template #header>
        <div v-if="activeScenarioStep" class="scenario-drawer-title-row">
          <span class="scenario-drawer-step-order">{{ scenarioStepConfigOrder || '-' }}</span>
          <span :class="['scenario-step-type-badge', scenarioStepTypeClass(activeScenarioStep.stepType)]">
            {{ scenarioStepTypeBadgeLabel(activeScenarioStep) }}
          </span>
          <el-input
            v-if="scenarioStepNameEditingId && scenarioStepNameEditingId === activeScenarioStep.id"
            v-model="scenarioStepNameDraft"
            class="scenario-drawer-title-input scenario-step-name-inline-input"
            maxlength="255"
            placeholder="请输入步骤名称"
            @blur="finishScenarioStepNameEdit(activeScenarioStep)"
            @keyup.enter="finishScenarioStepNameEdit(activeScenarioStep)"
          />
          <span v-else class="scenario-drawer-step-title">{{ scenarioStepConfigTitle }}</span>
          <button
            v-if="!scenarioStepNameEditingId || scenarioStepNameEditingId !== activeScenarioStep.id"
            type="button"
            class="scenario-custom-title-edit scenario-step-name-edit-button"
            title="编辑名称"
            @click="startScenarioStepNameEdit(activeScenarioStep)"
          >
            <el-icon><EditPen /></el-icon>
          </button>
        </div>
      </template>

      <div v-if="activeScenarioStep" class="scenario-step-config-shell">
        <ApiScenarioSystemStepConfigPanel
          v-if="(activeScenarioStep.stepType === 'API' || activeScenarioStep.stepType === 'API_CASE') && !isScenarioStepCopyRequest(activeScenarioStep)"
          v-model:config-active-tab="scenarioStepConfigActiveTab"
          v-model:system-response-tab="scenarioStepSystemResponseTab"
          :scenario-step-system-detail-loading="scenarioStepSystemDetailLoading"
          :scenario-step-system-detail="scenarioStepSystemDetail"
          :scenario-step-system-config="scenarioStepSystemConfig"
          :request-method-class="requestMethodClass"
          :debug-scenario-step-system-request="debugScenarioStepSystemRequest"
          :scenario-step-system-debug-loading="scenarioStepSystemDebugLoading"
          :scenario-step-system-can-debug="scenarioStepSystemCanDebug"
          :scenario-step-system-query-enabled-count="scenarioStepSystemQueryEnabledCount"
          :enabled-scenario-rows="enabledScenarioRows"
          :scenario-step-system-body-text="scenarioStepSystemBodyText"
          :scenario-step-system-body-language="scenarioStepSystemBodyLanguage"
          :scenario-step-system-assertion-enabled-count="scenarioStepSystemAssertionEnabledCount"
          :scenario-unknown-text="scenarioUnknownText"
          :scenario-unknown-value="scenarioUnknownValue"
          :assertion-type-label="assertionTypeLabel"
          :scenario-step-system-show-response-empty-state="scenarioStepSystemShowResponseEmptyState"
          :scenario-step-system-assertion-result-presentation="scenarioStepSystemAssertionResultPresentation"
          :scenario-step-system-response-status-tone="scenarioStepSystemResponseStatusTone"
          :scenario-step-system-response-status-code="scenarioStepSystemResponseStatusCode"
          :scenario-step-system-response-duration="scenarioStepSystemResponseDuration"
          :scenario-step-system-response-size="scenarioStepSystemResponseSize"
          :scenario-step-system-debug-message="scenarioStepSystemDebugMessage"
          :scenario-step-system-response-body-pretty="scenarioStepSystemResponseBodyPretty"
          :scenario-step-system-response-body-language="scenarioStepSystemResponseBodyLanguage"
          :scenario-step-system-response-headers="scenarioStepSystemResponseHeaders"
          :scenario-step-system-console="scenarioStepSystemConsole"
          :scenario-step-system-actual-request="scenarioStepSystemActualRequest"
          :scenario-step-system-assertion-results="scenarioStepSystemAssertionResults"
          :assertion-condition-label="assertionConditionLabel"
          :assertion-result-class="assertionResultClass"
          :assertion-result-label="assertionResultLabel"
        />

        <template v-else-if="activeScenarioStep.stepType === 'API_SCENARIO'">
          <div class="scenario-step-config-body is-resource app-soft-scrollbar">
            <div class="scenario-step-resource-card">
              <div class="scenario-step-resource-title">{{ scenarioStepTypeTitle(activeScenarioStep.stepType) }}</div>
              <div class="scenario-step-resource-subtitle">按旧项目步骤配置入口选择引用资源，后续执行时使用该资源 ID。</div>
              <label class="scenario-step-field">
                <span>步骤名称</span>
                <el-input v-model="activeScenarioStep.stepName" placeholder="请输入步骤名称" @input="markScenarioDirty" />
              </label>
              <label class="scenario-step-field">
                <span>选择场景</span>
                <el-select v-model="activeScenarioStep.resourceId" filterable clearable placeholder="请选择场景" @change="markScenarioDirty">
                  <el-option v-for="item in scenarioReferenceOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </label>
            </div>
          </div>
        </template>

        <ApiScenarioCustomStepConfigPanel
          v-else-if="isScenarioStepEditableRequest(activeScenarioStep)"
          v-model:config-active-tab="scenarioStepConfigActiveTab"
          v-model:custom-response-tab="scenarioStepCustomResponseTab"
          v-model:header-selection="scenarioStepHeaderSelectionModel"
          v-model:query-selection="scenarioStepQuerySelectionModel"
          v-model:body-form-selection="scenarioStepBodyFormSelectionModel"
          v-model:raw-text="scenarioStepRawText"
          v-model:pre-processors="activeScenarioStepPreProcessors"
          v-model:post-processors="activeScenarioStepPostProcessors"
          v-model:assertions="activeScenarioStepAssertions"
          v-model:active-pre-processor-id="scenarioStepCustomActivePreProcessorId"
          v-model:active-post-processor-id="scenarioStepCustomActivePostProcessorId"
          v-model:custom-active-assertion-id="scenarioStepCustomActiveAssertionId"
          :active-scenario-step-request-config="activeScenarioStepRequestConfig"
          :request-method-options="requestMethodOptions"
          :request-method-class="requestMethodClass"
          :mark-scenario-dirty="markScenarioDirty"
          :scenario-step-custom-debug-loading="scenarioStepCustomDebugLoading"
          :scenario-step-custom-can-debug="scenarioStepCustomCanDebug"
          :debug-scenario-step-custom-request="debugScenarioStepCustomRequest"
          :scenario-step-custom-query-enabled-count="scenarioStepCustomQueryEnabledCount"
          :scenario-step-custom-assertion-enabled-count="scenarioStepCustomAssertionEnabledCount"
          :scenario-table-selection-state="scenarioTableSelectionState"
          :handle-scenario-key-value-row-input="handleScenarioKeyValueRowInput"
          :scenario-header-param-defaults="scenarioHeaderParamDefaults"
          :remove-scenario-key-value-row="removeScenarioKeyValueRow"
          :add-scenario-key-value-row="addScenarioKeyValueRow"
          :scenario-query-param-defaults="scenarioQueryParamDefaults"
          :scenario-query-param-type-options="scenarioQueryParamTypeOptions"
          :scenario-step-body-modes="scenarioStepBodyModes"
          :set-scenario-step-body-mode="setScenarioStepBodyMode"
          :is-scenario-raw-body="isScenarioRawBody"
          :scenario-step-body-language="scenarioStepBodyLanguage"
          :scenario-body-form-param-defaults="scenarioBodyFormParamDefaults"
          :scenario-body-param-type-options="scenarioBodyParamTypeOptions"
          :pick-scenario-body-form-row-file="pickScenarioBodyFormRowFile"
          :clear-scenario-body-form-row-file="clearScenarioBodyFormRowFile"
          :format-scenario-body-form-file-size="formatScenarioBodyFormFileSize"
          :db-connections="dbConnections"
          :scenario-step-custom-latest-response-body="scenarioStepCustomLatestResponseBody"
          :scenario-step-custom-show-response-empty-state="scenarioStepCustomShowResponseEmptyState"
          :scenario-step-custom-assertion-result-presentation="scenarioStepCustomAssertionResultPresentation"
          :scenario-step-custom-response-status-tone="scenarioStepCustomResponseStatusTone"
          :scenario-step-custom-response-status-code="scenarioStepCustomResponseStatusCode"
          :scenario-step-custom-response-duration="scenarioStepCustomResponseDuration"
          :scenario-step-custom-response-size="scenarioStepCustomResponseSize"
          :scenario-step-custom-debug-message="scenarioStepCustomDebugMessage"
          :scenario-step-custom-response-body-pretty="scenarioStepCustomResponseBodyPretty"
          :scenario-step-custom-response-body-language="scenarioStepCustomResponseBodyLanguage"
          :scenario-step-custom-response-headers="scenarioStepCustomResponseHeaders"
          :scenario-step-custom-console="scenarioStepCustomConsole"
          :scenario-step-custom-actual-request="scenarioStepCustomActualRequest"
          :scenario-step-custom-assertion-results="scenarioStepCustomAssertionResults"
          :assertion-type-label="assertionTypeLabel"
          :assertion-condition-label="assertionConditionLabel"
          :assertion-result-class="assertionResultClass"
          :assertion-result-label="assertionResultLabel"
          :environment-name="environmentName"
          :variable-set-name="variableSetName"
        />

        <ApiScenarioScriptStepConfigPanel
          v-else-if="activeScenarioStep.stepType === 'SCRIPT'"
          v-model:script-active-tab="scenarioStepScriptActiveTab"
          v-model:assertions="activeScenarioStepAssertions"
          v-model:script-active-assertion-id="scenarioStepScriptActiveAssertionId"
          :active-scenario-step="activeScenarioStep"
          :scenario-step-script-assertion-enabled-count="scenarioStepScriptAssertionEnabledCount"
          :format-scenario-step-script-content="formatScenarioStepScriptContent"
          :scenario-step-script-latest-response-body="scenarioStepScriptLatestResponseBody"
          :mark-scenario-dirty="markScenarioDirty"
        />

        <ApiScenarioControllerStepConfigPanel
          v-else
          :active-scenario-step="activeScenarioStep"
          :mark-scenario-dirty="markScenarioDirty"
        />
      </div>

      <template v-if="showScenarioStepConfigFooter" #footer>
        <div class="scenario-step-config-footer">
          <el-button @click="cancelScenarioStepConfig">取消</el-button>
          <el-button
            v-if="activeScenarioStep?.stepType === 'CUSTOM_REQUEST' && scenarioStepConfigMode === 'create'"
            :disabled="!activeScenarioStepRequestConfig.path?.trim()"
            @click="saveScenarioStepConfig(true)"
          >
            保存并继续
          </el-button>
          <el-button
            v-if="activeScenarioStep?.stepType === 'SCRIPT' && scenarioStepConfigMode === 'create'"
            :disabled="!activeScenarioStep.stepName?.trim()"
            @click="saveScenarioStepConfig(true)"
          >
            保存并继续添加
          </el-button>
          <el-button
            type="primary"
            :disabled="isScenarioStepEditableRequest(activeScenarioStep) && !activeScenarioStepRequestConfig.path?.trim()"
            @click="saveScenarioStepConfig(false)"
          >
            {{ activeScenarioStep?.stepType === 'CUSTOM_REQUEST' && scenarioStepConfigMode === 'create' ? '添加' : '保存' }}
          </el-button>
        </div>
      </template>
    </el-drawer>

</template>
