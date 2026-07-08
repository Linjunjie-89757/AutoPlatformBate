<script setup lang="ts">
import type { ApiScenarioControllerStepConfigPanelProps } from './lib/apiScenarioStepConfigTypes'

defineProps<ApiScenarioControllerStepConfigPanelProps>()
</script>

<template>
          <div class="scenario-step-config-body is-controller app-soft-scrollbar">
            <label class="scenario-step-field">
              <span>步骤名称</span>
              <el-input v-model="activeScenarioStep.stepName" placeholder="请输入步骤名称" @input="markScenarioDirty" />
            </label>
            <div v-if="activeScenarioStep.stepType === 'LOOP_CONTROLLER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>循环类型</span>
                <el-select v-model="activeScenarioStep.loopType" @change="markScenarioDirty">
                  <el-option label="固定次数" value="FIXED" />
                  <el-option label="While 条件" value="WHILE" />
                  <el-option label="Foreach" value="FOREACH" />
                </el-select>
              </div>
              <div v-if="activeScenarioStep.loopType === 'FIXED'" class="scenario-step-form-row">
                <span>循环次数</span>
                <el-input-number v-model="activeScenarioStep.loopCount" :min="0" :max="50" @change="markScenarioDirty" />
              </div>
              <div v-else class="scenario-step-form-row">
                <span>{{ activeScenarioStep.loopType === 'FOREACH' ? '遍历表达式' : '条件表达式' }}</span>
                <el-input v-model="activeScenarioStep.conditionExpression" placeholder="{{flag}} == true" @input="markScenarioDirty" />
              </div>
              <div class="scenario-step-form-row">
                <span>间隔(ms)</span>
                <el-input-number v-model="activeScenarioStep.delayMs" :min="0" :max="60000" @change="markScenarioDirty" />
              </div>
            </div>
            <div v-else-if="activeScenarioStep.stepType === 'IF_CONTROLLER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>条件类型</span>
                <el-select v-model="activeScenarioStep.conditionType" @change="markScenarioDirty">
                  <el-option label="表达式" value="EXPRESSION" />
                  <el-option label="脚本" value="SCRIPT" />
                </el-select>
              </div>
              <div class="scenario-step-form-row">
                <span>条件表达式</span>
                <el-input v-model="activeScenarioStep.conditionExpression" placeholder="{{flag}} == true" @input="markScenarioDirty" />
              </div>
            </div>
            <div v-else-if="activeScenarioStep.stepType === 'CONSTANT_TIMER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>等待时长(ms)</span>
                <el-input-number v-model="activeScenarioStep.delayMs" :min="1" :max="60000" @change="markScenarioDirty" />
              </div>
            </div>
            <div v-else class="scenario-step-form-panel">
              <div class="scenario-step-settings-hint">仅一次控制器将只执行子步骤一次。</div>
            </div>
          </div>
        </template>
