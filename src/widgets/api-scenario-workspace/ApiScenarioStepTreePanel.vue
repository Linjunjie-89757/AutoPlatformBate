<script setup lang="ts">
import {
  CaretRight,
  CopyDocument,
  Delete,
  Plus,
} from '@element-plus/icons-vue'
import { figmaConfigDbIcons } from '@/shared/assets/figma-icons'

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
                    :class="['scenario-step-node', scenarioStepTypeClass(item.step.stepType), { 'is-nested': item.level > 0, 'is-disabled': item.step.enabled === false }]"
                    :style="{ marginLeft: `${item.level * 32}px` }"
                  >
                    <div class="scenario-step-node-left">
                      <span class="scenario-step-drag-handle" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                      </span>
                      <button
                        type="button"
                        :class="['scenario-step-switch', { 'is-checked': item.step.enabled !== false }]"
                        role="switch"
                        :aria-checked="item.step.enabled !== false"
                        @click="item.step.enabled = item.step.enabled === false; markScenarioDirty()"
                      >
                        <span></span>
                      </button>
                      <span class="scenario-step-order">{{ Number(index) + 1 }}</span>
                      <span :class="['scenario-step-type-badge', scenarioStepTypeClass(item.step.stepType)]">
                        {{ scenarioStepTypeBadgeLabel(item.step) }}
                      </span>
                    </div>
                    <div class="scenario-step-node-main">
                      <div class="scenario-step-title-row">
                        <span
                          v-if="['API', 'API_CASE'].includes(String(item.step.stepType))"
                          :class="['scenario-step-method', requestMethodClass(selectedScenarioResourceMethod(item.step))]"
                        >
                          {{ selectedScenarioResourceMethod(item.step) || 'HTTP' }}
                        </span>
                        <span
                          v-else-if="item.step.stepType === 'CUSTOM_REQUEST'"
                          :class="['scenario-step-method', requestMethodClass(item.step.requestConfig?.method || 'GET')]"
                        >
                          {{ item.step.requestConfig?.method || 'GET' }}
                        </span>
                        <button
                          v-if="scenarioStepNameEditingId !== item.step.id"
                          type="button"
                          class="scenario-step-name-text scenario-step-name-button is-strong"
                          @click="openScenarioStepConfig(item.path)"
                        >
                          {{ scenarioStepDisplayName(item.step) }}
                        </button>
                      <el-input
                        v-else
                        v-model="scenarioStepNameDraft"
                        class="scenario-step-name-inline-input"
                        maxlength="255"
                        @blur="finishScenarioStepNameEdit(item.step)"
                        @keyup.enter="finishScenarioStepNameEdit(item.step)"
                      />
                        <button
                          v-if="scenarioStepNameEditingId !== item.step.id"
                        type="button"
                        class="scenario-step-name-edit-button"
                        title="编辑名称"
                        @click.stop="startScenarioStepNameEdit(item.step)"
                      >
                          <img class="scenario-figma-edit-icon" :src="figmaConfigDbIcons.action.edit" alt="" />
                        </button>
                      </div>
                    </div>
                    <div class="scenario-step-node-actions">
                      <button type="button" class="scenario-step-icon-action is-run" title="执行步骤">
                        <el-icon><CaretRight /></el-icon>
                      </button>
                      <button v-if="isScenarioControllerStep(item.step.stepType)" type="button" class="scenario-step-icon-action is-text" title="添加子步骤" @click="addScenarioStep(item.path, 'API_CASE')">
                        <el-icon><Plus /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="上移" @click="moveScenarioStep(item.path, -1)">
                        <span class="scenario-step-action-glyph" aria-hidden="true">↑</span>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="下移" @click="moveScenarioStep(item.path, 1)">
                        <span class="scenario-step-action-glyph" aria-hidden="true">↓</span>
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
                <el-dropdown v-if="scenarioFlatSteps.length" trigger="click" popper-class="scenario-add-step-menu" @command="handleScenarioAddStepAction">
                  <button type="button" class="scenario-step-add-row">
                    <el-icon><Plus /></el-icon>
                    添加测试步骤
                  </button>
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

</template>
