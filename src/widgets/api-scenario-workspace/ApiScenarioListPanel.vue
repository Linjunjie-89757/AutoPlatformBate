<script setup lang="ts">
import { Search, Setting } from '@element-plus/icons-vue'

import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

const props = defineProps([
  'scenarioFilterKeyword',
  'scenarioViewMode',
  'scenarioTableGridTemplateColumns',
  'scenarioTableGridMinWidth',
  'scenarioTableVisibleColumns',
  'filteredScenarios',
  'hoveredScenarioRowId',
  'formatScenarioTableColumnValue',
  'scenarioRunResultTone',
  'scenarioRunResultLabel',
  'setHoveredScenarioRow',
  'selectScenario',
  'runScenarioFromList',
  'copyScenario',
  'removeScenarioFromList',
  'scenarioStatusLabel',
  'scenarioPriorityLabel',
  'environments',
  'scenarioListTotal',
  'scenarioListPageNo',
  'scenarioListPageSize',
  'changeScenarioListPage',
  'changeScenarioListPageSize',
])

const emit = defineEmits([
  'update:scenarioFilterKeyword',
  'update:scenarioViewMode',
  'openTableSettings',
])

function updateScenarioFilterKeyword(value: string | number | boolean | null | undefined) {
  emit('update:scenarioFilterKeyword', String(value ?? ''))
}

function updateScenarioViewMode(value: string | number | boolean | null | undefined) {
  emit('update:scenarioViewMode', String(value ?? 'ALL'))
}

function scenarioEnvironmentName(defaultEnvironmentId: string | number | null | undefined) {
  return props.environments?.find(
    (item: { id?: string | number | null; name?: string | null }) => item.id === defaultEnvironmentId,
  )?.name || '-'
}
</script>

<template>
          <div class="ms-scenario-list-shell">
            <div class="ms-scenario-list-toolbar">
              <div class="ms-scenario-search">
                <el-input :model-value="scenarioFilterKeyword" placeholder="通过 ID/名称/标签搜索" clearable @update:model-value="updateScenarioFilterKeyword">
                  <template #suffix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </div>
              <el-select :model-value="scenarioViewMode" class="ms-scenario-view-select" @update:model-value="updateScenarioViewMode">
                <el-option label="全部数据" value="ALL" />
              </el-select>
              <el-button class="ms-scenario-tool-button">筛选</el-button>
            </div>
            <div class="ms-scenario-grid-shell">
              <div class="ms-scenario-grid-data">
                <div class="ms-scenario-grid-scroll">
                  <div
                    class="ms-scenario-grid ms-scenario-grid--header"
                    :style="{ gridTemplateColumns: scenarioTableGridTemplateColumns, minWidth: scenarioTableGridMinWidth }"
                  >
                    <div
                      v-for="column in scenarioTableVisibleColumns"
                      :key="`scenario-header-${column.key}`"
                      :class="['ms-scenario-grid-cell', `is-${column.key}`]"
                    >
                      {{ column.label }}
                    </div>
                  </div>

                  <template v-if="filteredScenarios.length">
                    <div
                      v-for="row in filteredScenarios"
                      :key="row.id"
                      :class="['ms-scenario-grid', 'ms-scenario-grid--row', { 'is-active': hoveredScenarioRowId === row.id }]"
                      :style="{ gridTemplateColumns: scenarioTableGridTemplateColumns, minWidth: scenarioTableGridMinWidth }"
                      @mouseenter="setHoveredScenarioRow(row.id)"
                      @mouseleave="setHoveredScenarioRow(null)"
                    >
                      <div
                        v-for="column in scenarioTableVisibleColumns"
                        :key="`${row.id}-${column.key}`"
                        :class="['ms-scenario-grid-cell', `is-${column.key}`]"
                      >
                        <button
                          v-if="column.key === 'id'"
                          type="button"
                          class="scenario-link"
                          @click="selectScenario(row.id)"
                        >
                          {{ formatScenarioTableColumnValue(row, column.key) }}
                        </button>
                        <button
                          v-else-if="column.key === 'name'"
                          type="button"
                          class="ms-scenario-name-link"
                          @click="selectScenario(row.id)"
                        >
                          {{ row.name }}
                        </button>
                        <span v-else-if="column.key === 'priority'" class="ms-scenario-priority"><i></i>{{ scenarioPriorityLabel(row.priority) }}</span>
                        <span v-else-if="column.key === 'status'" class="ms-scenario-status">{{ scenarioStatusLabel(row.status) }}</span>
                        <span v-else-if="column.key === 'lastRunResult'" :class="['ms-scenario-result', `is-${scenarioRunResultTone(row.lastRunResult)}`]">
                          {{ scenarioRunResultLabel(row.lastRunResult) }}
                        </span>
                        <span v-else class="ms-scenario-grid-text">{{ formatScenarioTableColumnValue(row, column.key) }}</span>
                      </div>
                    </div>
                  </template>

                  <div v-else class="ms-scenario-grid-empty">
                    暂无场景数据
                  </div>
                </div>
              </div>

              <div class="ms-scenario-grid-actions">
                <div class="ms-scenario-grid-actions-header">
                  <span>操作</span>
                  <AppTableSettingsTrigger @click="emit('openTableSettings')" />
                </div>
                <template v-if="filteredScenarios.length">
                  <div
                    v-for="row in filteredScenarios"
                    :key="`scenario-action-${row.id}`"
                    :class="['ms-scenario-grid-actions-row', { 'is-active': hoveredScenarioRowId === row.id }]"
                    @mouseenter="setHoveredScenarioRow(row.id)"
                    @mouseleave="setHoveredScenarioRow(null)"
                  >
                    <div class="ms-scenario-grid-action-buttons">
                      <button type="button" class="ms-scenario-action" @click="selectScenario(row.id)">编辑</button>
                      <button type="button" class="ms-scenario-action" @click="runScenarioFromList(row.id)">执行</button>
                      <el-dropdown trigger="click">
                        <button type="button" class="ms-scenario-action">...</button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item @click="copyScenario(row)">复制</el-dropdown-item>
                            <el-dropdown-item @click="removeScenarioFromList(row)">删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                </template>
                <div v-else class="ms-scenario-grid-actions-empty">-</div>
              </div>
            </div>
            <el-table v-if="false" :data="filteredScenarios" size="small" class="scenario-table ms-scenario-table">
              <el-table-column type="selection" width="44" />
              <el-table-column width="34">
                <template #default>≡</template>
              </el-table-column>
              <el-table-column label="ID" width="120" sortable>
                <template #default="{ row }">
                  <button type="button" class="scenario-link" @click="selectScenario(row.id)">{{ 100000 + row.id }}</button>
                </template>
              </el-table-column>
              <el-table-column label="场景名称" min-width="180" sortable show-overflow-tooltip>
                <template #default="{ row }">
                  <button type="button" class="ms-scenario-name-link" @click="selectScenario(row.id)">{{ row.name }}</button>
                </template>
              </el-table-column>
              <el-table-column label="场景等级" width="120" sortable>
                <template #default="{ row }">
                  <span class="ms-scenario-priority"><i></i>{{ scenarioPriorityLabel(row.priority) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #header>
                  <span>状态 <span class="ms-scenario-filter-icon">⌄</span></span>
                </template>
                <template #default="{ row }">
                  <span class="ms-scenario-status">{{ scenarioStatusLabel(row.status) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="执行结果" width="140">
                <template #header>
                  <span>执行结果 <span class="ms-scenario-filter-icon">⌄</span></span>
                </template>
                <template #default="{ row }">
                  {{ row.lastRunResult || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="标签" min-width="140">
                <template #default="{ row }">{{ row.tags?.length ? row.tags.join(', ') : '-' }}</template>
              </el-table-column>
              <el-table-column label="场景环境" min-width="140">
                <template #default="{ row }">
                  {{ scenarioEnvironmentName(row.defaultEnvironmentId) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="210" fixed="right">
                <template #header>
                  <span>操作 <el-icon><Setting /></el-icon></span>
                </template>
                <template #default="{ row }">
                  <button type="button" class="ms-scenario-action" @click="selectScenario(row.id)">编辑</button>
                  <button type="button" class="ms-scenario-action" @click="runScenarioFromList(row.id)">执行</button>
                  <button type="button" class="ms-scenario-action" @click="copyScenario(row)">复制</button>
                  <el-dropdown trigger="click">
                    <button type="button" class="ms-scenario-action">...</button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="removeScenarioFromList(row)">删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </el-table-column>
            </el-table>
            <div class="ms-scenario-pagination">
              <span>共 {{ scenarioListTotal }} 条</span>
              <el-pagination
                background
                layout="prev, pager, next, sizes"
                :total="scenarioListTotal"
                :current-page="scenarioListPageNo"
                :page-size="scenarioListPageSize"
                :page-sizes="[10, 20, 50, 100]"
                @current-change="(page: number) => void changeScenarioListPage(page)"
                @size-change="(size: number) => void changeScenarioListPageSize(size)"
              />
            </div>
          </div>
        </template>
