<script setup lang="ts">
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import ScenarioAssertionEditor from './ScenarioAssertionEditor.vue'
import type { ApiScenarioScriptStepConfigPanelProps } from './lib/apiScenarioStepConfigTypes'

defineProps<ApiScenarioScriptStepConfigPanelProps>()

const scenarioStepScriptActiveTab = defineModel<string>('scriptActiveTab', { required: true })
const activeScenarioStepAssertions = defineModel<unknown[]>('assertions', { required: true })
const scenarioStepScriptActiveAssertionId = defineModel<string | null>('scriptActiveAssertionId', { required: true })
</script>

<template>
          <div class="ms-like-top-tabs scenario-step-config-tabs">
            <button :class="['ms-like-top-tab', { active: scenarioStepScriptActiveTab === 'script' }]" @click="scenarioStepScriptActiveTab = 'script'">脚本</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepScriptActiveTab === 'assertions' }]" @click="scenarioStepScriptActiveTab = 'assertions'">
              断言
              <span v-if="scenarioStepScriptAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepScriptAssertionEnabledCount }}</span>
            </button>
          </div>
          <div v-if="scenarioStepScriptActiveTab === 'script'" class="scenario-step-config-body is-script scenario-script-editor-pane app-soft-scrollbar">
            <label class="scenario-step-field">
              <span>名称</span>
              <el-input v-model="activeScenarioStep.stepName" maxlength="255" placeholder="请输入脚本操作名称" @input="markScenarioDirty" />
            </label>
            <div class="scenario-script-mode-tabs">
              <button type="button" class="scenario-script-mode-tab active">手动录入</button>
              <el-tooltip content="公共脚本功能开发中" placement="top">
                <span class="scenario-script-mode-tab-tooltip">
                  <button type="button" class="scenario-script-mode-tab is-disabled" disabled>引用公共脚本</button>
                </span>
              </el-tooltip>
            </div>
            <div class="scenario-script-editor-header">
              <span>脚本案例</span>
              <div class="scenario-script-editor-actions">
                <el-button size="small" @click="formatScenarioStepScriptContent">格式化</el-button>
                <el-button size="small" @click="activeScenarioStep.script = ''; markScenarioDirty()">清空</el-button>
              </div>
            </div>
            <div class="scenario-script-code-shell">
              <ApiCodeEditor v-model="activeScenarioStep.script" language="javascript" height="100%" :show-format-button="false" placeholder="// JavaScript" @change="markScenarioDirty" />
            </div>
          </div>
          <div v-else class="scenario-step-config-body scenario-script-assertion-pane app-soft-scrollbar">
            <ScenarioAssertionEditor
              v-model="activeScenarioStepAssertions"
              v-model:active-id="scenarioStepScriptActiveAssertionId"
              :allowed-types="['VARIABLE', 'SCRIPT']"
              :latest-response-body="scenarioStepScriptLatestResponseBody"
              @change="markScenarioDirty"
            />
          </div>
        </template>
