<script setup lang="ts">
import { CaretRight, Check, Menu, Setting } from '@element-plus/icons-vue'

defineProps([
  "activeScenarioDetail",
  "scenarioRunEnvironmentOptions",
  "markScenarioDirty",
  "scenarioSaving",
  "scenarioRunning",
  "runScenario",
  "saveScenario",
  "activeScenarioLocalRunnerTask",
  "apiRunnerTaskStatusTone",
  "formatApiRunnerTaskStatus",
  "refreshScenarioLocalRunnerTask",
  "isApiRunnerTaskTerminal",
  "openScenarioLocalRunnerReport",
  "scenarioModuleOptions",
  "scenarioRunDatasetsLoading",
  "handleScenarioRunDatasetChange",
  "loadScenarioRunDatasets",
  "enabledScenarioRunDatasets",
  "scenarioRunnerNodesLoading",
  "scenarioRunnerNodes",
  "isRunnerSelectable",
  "runnerTaskType",
  "runnerOptionLabel",
  "runnerStatusText",
  "runnerHeartbeatText",
  "runnerActiveTaskText",
  "variableSets",
  "readTagInput",
  "updateScenarioTagInput"
])

const activeScenarioDetailTab = defineModel<string>('activeTab', { required: true })
const scenarioRunDatasetId = defineModel<number | null>('datasetId', { required: true })
const scenarioRunLoopCount = defineModel<number>('loopCount', { required: true })
const scenarioRunThreadCount = defineModel<number>('threadCount', { required: true })
const selectedScenarioRunnerId = defineModel<string | null>('runnerId', { required: true })
</script>

<template>
<aside class="scenario-property-panel">
              <div class="scenario-property-card">
                <div class="scenario-property-header">
                  <div class="scenario-property-env-row">
                    <el-select
                      v-model="activeScenarioDetail.defaultEnvironmentId"
                      class="scenario-property-env-select"
                      placeholder="请选择运行环境"
                      clearable
                      @change="markScenarioDirty"
                    >
                      <el-option
                        v-for="environment in scenarioRunEnvironmentOptions"
                        :key="environment.id"
                        :label="environment.name"
                        :value="environment.id"
                      />
                    </el-select>
                    <el-button class="scenario-property-config-button" @click="activeScenarioDetailTab = 'settings'">
                      <el-icon><Setting /></el-icon>
                    </el-button>
                  </div>
                  <div class="scenario-property-run-actions">
                    <el-button type="primary" class="scenario-property-run-button" :disabled="!activeScenarioDetail.id || scenarioSaving" :loading="scenarioRunning" @click="runScenario">
                      <el-icon><CaretRight /></el-icon>
                      运行
                    </el-button>
                    <el-button class="scenario-property-save-button" :loading="scenarioSaving" @click="saveScenario">
                      <el-icon><Check /></el-icon>
                      保存
                    </el-button>
                  </div>
                </div>
                <section v-if="activeScenarioLocalRunnerTask" class="scenario-local-runner-task">
                  <div class="scenario-local-runner-task__main">
                    <el-tag :type="apiRunnerTaskStatusTone(activeScenarioLocalRunnerTask.status)" effect="light">
                      {{ formatApiRunnerTaskStatus(activeScenarioLocalRunnerTask.status) }}
                    </el-tag>
                    <span>{{ activeScenarioLocalRunnerTask.runId }}</span>
                    <small>{{ activeScenarioLocalRunnerTask.statusMessage || activeScenarioLocalRunnerTask.errorMessage || '本地执行任务已创建，等待 Runner 回传结果' }}</small>
                  </div>
                  <el-progress
                    class="scenario-local-runner-task__progress"
                    :percentage="activeScenarioLocalRunnerTask.progress.percent"
                    :status="activeScenarioLocalRunnerTask.status === 'FAILED' ? 'exception' : activeScenarioLocalRunnerTask.status === 'SUCCESS' ? 'success' : undefined"
                  />
                  <div class="scenario-local-runner-task__actions">
                    <span>阶段：{{ activeScenarioLocalRunnerTask.currentStage || '-' }}</span>
                    <span>步骤：{{ activeScenarioLocalRunnerTask.progress.current }}/{{ activeScenarioLocalRunnerTask.progress.total }}</span>
                    <el-button size="small" @click="() => refreshScenarioLocalRunnerTask(false)">刷新</el-button>
                    <el-button
                      v-if="isApiRunnerTaskTerminal(activeScenarioLocalRunnerTask.status)"
                      size="small"
                      type="primary"
                      @click="openScenarioLocalRunnerReport"
                    >
                      查看正式报告
                    </el-button>
                  </div>
                </section>
                <el-scrollbar class="scenario-property-scrollbar">
                  <div class="scenario-property-body">
                    <label class="scenario-property-field">
                      <span><b>*</b> 所属模块</span>
                      <el-select v-model="activeScenarioDetail.moduleId" placeholder="请选择所属模块" @change="markScenarioDirty">
                        <el-option v-for="item in scenarioModuleOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>测试数据</span>
                      <div class="scenario-property-inline-control">
                        <el-select
                          v-model="scenarioRunDatasetId"
                          class="scenario-property-data-select"
                          :loading="scenarioRunDatasetsLoading"
                          clearable
                          placeholder="不使用测试数据"
                          @change="handleScenarioRunDatasetChange"
                          @visible-change="(visible: boolean) => visible && loadScenarioRunDatasets()"
                        >
                          <el-option
                            v-for="dataset in enabledScenarioRunDatasets"
                            :key="dataset.id"
                            :label="dataset.datasetName"
                            :value="dataset.id"
                          />
                        </el-select>
                        <el-button class="scenario-property-inline-button" @click="activeScenarioDetailTab = 'testData'">
                          <Menu />
                        </el-button>
                      </div>
                    </label>
                    <div class="scenario-property-field-grid">
                      <label class="scenario-property-field">
                        <span>循环次数</span>
                        <el-input-number
                          v-model="scenarioRunLoopCount"
                          :min="1"
                          :max="999"
                          :controls="false"
                        />
                      </label>
                      <label class="scenario-property-field">
                        <span>线程数</span>
                        <el-input-number
                          v-model="scenarioRunThreadCount"
                          :min="1"
                          :max="99"
                          :controls="false"
                        />
                      </label>
                    </div>
                    <label class="scenario-property-field">
                      <span>运行于</span>
                      <el-select v-model="activeScenarioDetail.runOn" placeholder="请选择运行位置" @change="markScenarioDirty">
                        <el-option label="服务端执行" value="SERVER" />
                        <el-option label="本地执行器" value="LOCAL" />
                      </el-select>
                    </label>
                    <label v-if="activeScenarioDetail.runOn === 'LOCAL'" class="scenario-property-field">
                      <span>本地执行器</span>
                      <el-select
                        v-model="selectedScenarioRunnerId"
                        clearable
                        filterable
                        :loading="scenarioRunnerNodesLoading"
                        placeholder="选择可用本地 Runner"
                      >
                        <el-option
                          v-for="runner in scenarioRunnerNodes"
                          :key="runner.runnerId"
                          :disabled="!isRunnerSelectable(runner, runnerTaskType)"
                          :label="runnerOptionLabel(runner, runnerTaskType)"
                          :value="runner.runnerId"
                        >
                          <div class="local-runner-option">
                            <div class="local-runner-option__main">
                              <span>{{ runner.runnerName || runner.runnerId }}</span>
                              <el-tag size="small" :type="isRunnerSelectable(runner, runnerTaskType) ? 'success' : 'info'" effect="light">
                                {{ runnerStatusText(runner) }}
                              </el-tag>
                            </div>
                            <div class="local-runner-option__meta">
                              <span>{{ runner.runnerId }}</span>
                              <span>心跳 {{ runnerHeartbeatText(runner) }}</span>
                              <span>{{ runnerActiveTaskText(runner) }}</span>
                              <span>{{ runner.capabilities?.join(' / ') || '未上报能力' }}</span>
                            </div>
                          </div>
                        </el-option>
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>变量集</span>
                      <el-select v-model="activeScenarioDetail.variableSetId" clearable placeholder="请选择变量集" @change="markScenarioDirty">
                        <el-option v-for="item in variableSets || []" :key="item.id" :label="item.name" :value="item.id" />
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>标签</span>
                      <el-input :model-value="readTagInput(activeScenarioDetail.tags)" placeholder="添加标签，回车结束" @update:model-value="(value: string | number) => updateScenarioTagInput(String(value))" />
                    </label>
                  </div>
                </el-scrollbar>
              </div>
            </aside>
</template>
