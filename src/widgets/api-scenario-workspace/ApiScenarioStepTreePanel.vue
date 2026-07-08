<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  CaretRight,
  CopyDocument,
  Delete,
  EditPen,
  Plus,
} from '@element-plus/icons-vue'

defineProps([
  "activeScenarioDetail",
  "scenarioAddStepGroups",
  "scenarioFlatSteps",
  "handleScenarioAddStepAction",
  "markScenarioDirty",
  "scenarioStepTypeClass",
  "scenarioStepTypeBadgeLabel",
  "requestMethodClass",
  "selectedScenarioResourceMethod",
  "openScenarioStepConfig",
  "scenarioStepDisplayName",
  "startScenarioStepNameEdit",
  "finishScenarioStepNameEdit",
  "isScenarioControllerStep",
  "addScenarioStep",
  "moveScenarioStep",
  "copyScenarioStep",
  "confirmRemoveScenarioStep"
])

const scenarioStepNameEditingId = defineModel<string | number | null>('editingId', { required: true })
const scenarioStepNameDraft = defineModel<string>('nameDraft', { required: true })
</script>

<template>
<div class="scenario-step-toolbar">
                  <span>共 {{ activeScenarioDetail.steps.length }} 个步骤</span>
                  <el-dropdown trigger="click" popper-class="scenario-add-step-menu" @command="handleScenarioAddStepAction">
                    <el-button type="primary">
                      <el-icon><Plus /></el-icon>
                      添加步骤
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <template v-for="group in scenarioAddStepGroups" :key="group.title">
                          <div class="scenario-add-step-group-title">{{ group.title }}</div>
                          <el-dropdown-item
                            v-for="item in group.items"
                            :key="item.command"
                            :command="item.command"
                          >
                            <span class="scenario-add-step-item">
                              <span>{{ item.label }}</span>
                            </span>
                          </el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
                <div v-if="scenarioFlatSteps.length" class="scenario-step-tree app-soft-scrollbar">
                  <div
                    v-for="(item, index) in scenarioFlatSteps"
                    :key="item.step.id || item.path.join('-')"
                    :class="['scenario-step-node', { 'is-nested': item.level > 0, 'is-disabled': item.step.enabled === false }]"
                    :style="{ marginLeft: `${item.level * 32}px` }"
                  >
                    <div class="scenario-step-node-left">
                      <el-checkbox />
                      <span class="scenario-step-order">{{ Number(index) + 1 }}</span>
                      <el-switch v-model="item.step.enabled" size="small" @change="markScenarioDirty" />
                      <button type="button" class="scenario-step-run-button" title="执行步骤">
                        <el-icon><CaretRight /></el-icon>
                      </button>
                      <span :class="['scenario-step-type-badge', scenarioStepTypeClass(item.step.stepType)]">
                        {{ scenarioStepTypeBadgeLabel(item.step) }}
                      </span>
                    </div>
                    <div class="scenario-step-node-main">
                      <template v-if="item.step.stepType === 'API'">
                        <span :class="['scenario-step-method', requestMethodClass(selectedScenarioResourceMethod(item.step))]">
                          {{ selectedScenarioResourceMethod(item.step) || 'HTTP' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'API_CASE'">
                        <span :class="['scenario-step-method', requestMethodClass(selectedScenarioResourceMethod(item.step))]">
                          {{ selectedScenarioResourceMethod(item.step) || 'HTTP' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'CUSTOM_REQUEST'">
                        <span :class="['scenario-step-method', requestMethodClass(item.step.requestConfig?.method || 'GET')]">
                          {{ item.step.requestConfig?.method || 'GET' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'LOOP_CONTROLLER'">
                        <el-select v-model="item.step.loopType" class="scenario-step-method-select" @change="markScenarioDirty">
                          <el-option label="固定次数" value="FIXED" />
                          <el-option label="While 条件" value="WHILE" />
                          <el-option label="Foreach" value="FOREACH" />
                        </el-select>
                        <el-input-number v-if="item.step.loopType === 'FIXED'" v-model="item.step.loopCount" :min="0" :max="50" size="small" @change="markScenarioDirty" />
                        <el-input v-else-if="item.step.loopType === 'FOREACH'" v-model="item.step.foreachExpression" class="scenario-step-path-input" placeholder="a,b,c 或 {{items}}" @input="markScenarioDirty" />
                        <el-input v-else v-model="item.step.conditionExpression" class="scenario-step-path-input" placeholder="{{flag}} == true" @input="markScenarioDirty" />
                        <span class="scenario-step-inline-label">间隔(ms):</span>
                        <el-input-number v-model="item.step.delayMs" :min="0" :max="60000" size="small" @change="markScenarioDirty" />
                      </template>
                      <template v-else-if="item.step.stepType === 'IF_CONTROLLER'">
                        <el-input v-model="item.step.conditionExpression" class="scenario-step-condition-input" placeholder="变量名称${var}" @input="markScenarioDirty" />
                        <el-select v-model="item.step.conditionType" class="scenario-step-operator-select" @change="markScenarioDirty">
                          <el-option label="等于" value="EXPRESSION" />
                          <el-option label="脚本" value="SCRIPT" />
                        </el-select>
                        <el-input class="scenario-step-condition-input" placeholder="变量值" />
                      </template>
                      <template v-else-if="item.step.stepType === 'CONSTANT_TIMER'">
                        <span class="scenario-step-inline-label">等待(ms):</span>
                        <el-input-number v-model="item.step.delayMs" :min="1" :max="60000" size="small" @change="markScenarioDirty" />
                      </template>
                      <button
                        v-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId !== item.step.id"
                        type="button"
                        class="scenario-step-name-text scenario-step-name-button is-strong"
                        @click="openScenarioStepConfig(item.path)"
                      >
                        {{ scenarioStepDisplayName(item.step) }}
                      </button>
                      <el-input
                        v-else-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId === item.step.id"
                        v-model="scenarioStepNameDraft"
                        class="scenario-step-name-inline-input"
                        maxlength="255"
                        @blur="finishScenarioStepNameEdit(item.step)"
                        @keyup.enter="finishScenarioStepNameEdit(item.step)"
                      />
                      <button
                        v-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId !== item.step.id"
                        type="button"
                        class="scenario-step-name-edit-button"
                        title="编辑名称"
                        @click.stop="startScenarioStepNameEdit(item.step)"
                      >
                        <el-icon><EditPen /></el-icon>
                      </button>
                      <span
                        v-if="item.step.stepType !== 'CONSTANT_TIMER' && !['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType))"
                        class="scenario-step-name-text"
                      >
                        {{ scenarioStepDisplayName(item.step) }}
                      </span>
                    </div>
                    <div class="scenario-step-node-actions">
                      <button v-if="isScenarioControllerStep(item.step.stepType)" type="button" class="scenario-step-icon-action is-text" title="添加子步骤" @click="addScenarioStep(item.path, 'API_CASE')">
                        <el-icon><Plus /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="上移" @click="moveScenarioStep(item.path, -1)">
                        <el-icon><ArrowUp /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="下移" @click="moveScenarioStep(item.path, 1)">
                        <el-icon><ArrowDown /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="复制" @click="copyScenarioStep(item.path)">
                        <el-icon><CopyDocument /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action is-danger" title="删除" @click="confirmRemoveScenarioStep(item.path)">
                        <el-icon><Delete /></el-icon>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="scenario-step-empty" aria-label="暂无步骤"></div>

</template>
