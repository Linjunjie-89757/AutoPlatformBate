<script setup lang="ts">
import {
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiScenarioItem,
} from '@/entities/api-automation'

import { requestMethodClass } from './lib/apiScenarioStepRequestUtils'

type ScenarioImportTab = 'api' | 'case' | 'scenario'
type ScenarioImportMode = 'copy' | 'ref'
type ScenarioImportTreeNodeType = 'root' | 'workspace' | 'module'

interface ScenarioImportTreeNode {
  key: string
  type: ScenarioImportTreeNodeType
  label: string
  workspaceCode: string | null
  modulePath: string | null
  moduleId: number | null
  count: number
  children: ScenarioImportTreeNode[]
}

const props = defineProps<{
  modelValue: boolean
  activeTab: ScenarioImportTab
  keyword: string
  selectedTreeKey: string
  workspaceCode: string
  workspaceName: string
  loading: boolean
  importLoading: boolean
  tree: ScenarioImportTreeNode[]
  definitions: ApiDefinitionItem[]
  cases: ApiDefinitionCaseItem[]
  scenarios: ApiScenarioItem[]
  selectedTotal: number
  selectedDefinitionCount: number
  selectedCaseCount: number
  selectedScenarioCount: number
  scenarioStatusLabel: (status?: string | null) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:activeTab': [value: ScenarioImportTab]
  'update:keyword': [value: string]
  'update:selectedTreeKey': [value: string]
  closed: []
  tabChange: []
  definitionSelectionChange: [rows: ApiDefinitionItem[]]
  caseSelectionChange: [rows: ApiDefinitionCaseItem[]]
  scenarioSelectionChange: [rows: ApiScenarioItem[]]
  import: [mode: ScenarioImportMode]
}>()

function handleTreeCurrentChange(data: ScenarioImportTreeNode) {
  emit('update:selectedTreeKey', data.key)
}

function handleTabChange() {
  emit('tabChange')
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="导入系统请求"
    size="1200px"
    destroy-on-close
    append-to-body
    class="api-soft-drawer scenario-import-drawer"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div class="scenario-import-shell" v-loading="loading">
      <el-tabs
        :model-value="activeTab"
        class="scenario-import-tabs"
        @update:model-value="emit('update:activeTab', $event as ScenarioImportTab)"
        @tab-change="handleTabChange"
      >
        <el-tab-pane label="接口" name="api" />
        <el-tab-pane label="用例" name="case" />
        <el-tab-pane label="场景" name="scenario" />
      </el-tabs>
      <div class="scenario-import-content">
        <aside class="scenario-import-tree-pane">
          <div class="scenario-import-tree-controls">
            <el-select :model-value="workspaceCode" disabled placeholder="空间">
              <el-option :label="workspaceName" :value="workspaceCode" />
            </el-select>
            <el-select v-if="activeTab !== 'scenario'" model-value="HTTP" class="scenario-import-protocol" disabled>
              <el-option label="HTTP" value="HTTP" />
            </el-select>
          </div>
          <el-input
            :model-value="keyword"
            placeholder="输入模块、路径或名称搜索"
            clearable
            @update:model-value="emit('update:keyword', $event)"
          />
          <el-tree
            :data="tree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :current-node-key="selectedTreeKey"
            class="scenario-import-tree app-soft-scrollbar"
            default-expand-all
            @current-change="handleTreeCurrentChange"
          >
            <template #default="{ data }">
              <div class="scenario-import-tree-node">
                <span class="scenario-import-tree-label">{{ data.label }}</span>
                <span class="scenario-import-tree-count">{{ data.count }}</span>
              </div>
            </template>
          </el-tree>
        </aside>
        <section class="scenario-import-table-pane">
          <div class="scenario-import-table-toolbar">
            <div class="scenario-import-table-title">
              {{ activeTab === 'api' ? '全部接口' : activeTab === 'case' ? '全部用例' : '全部场景' }}
              <span>({{ activeTab === 'api' ? definitions.length : activeTab === 'case' ? cases.length : scenarios.length }})</span>
            </div>
          </div>
          <el-table
            v-if="activeTab === 'api'"
            :data="definitions"
            row-key="id"
            height="560"
            size="small"
            @selection-change="emit('definitionSelectionChange', $event)"
          >
            <el-table-column type="selection" width="44" />
            <el-table-column label="ID" width="110">
              <template #default="{ row }">{{ 100000 + row.id }}</template>
            </el-table-column>
            <el-table-column prop="name" label="接口名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="请求类型" width="110">
              <template #default="{ row }">
                <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="110">
              <template #default>进行中</template>
            </el-table-column>
          </el-table>
          <el-table
            v-else-if="activeTab === 'case'"
            :data="cases"
            row-key="id"
            height="560"
            size="small"
            @selection-change="emit('caseSelectionChange', $event)"
          >
            <el-table-column type="selection" width="44" />
            <el-table-column label="ID" width="110">
              <template #default="{ row }">{{ 100000 + row.id }}</template>
            </el-table-column>
            <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="请求类型" width="110">
              <template #default="{ row }">
                <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="110">
              <template #default>进行中</template>
            </el-table-column>
          </el-table>
          <el-table
            v-else
            :data="scenarios"
            row-key="id"
            height="560"
            size="small"
            @selection-change="emit('scenarioSelectionChange', $event)"
          >
            <el-table-column type="selection" width="44" />
            <el-table-column label="ID" width="110">
              <template #default="{ row }">{{ 100000 + row.id }}</template>
            </el-table-column>
            <el-table-column prop="name" label="场景名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="moduleName" label="所属模块" min-width="140" show-overflow-tooltip />
            <el-table-column prop="stepCount" label="步骤数" width="100" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">{{ props.scenarioStatusLabel(row.status) }}</template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </div>
    <template #footer>
      <div class="scenario-import-footer">
        <div class="scenario-import-summary">
          <span>共选择 <strong>{{ selectedTotal }}</strong></span>
          <span>接口 <strong>{{ selectedDefinitionCount }}</strong></span>
          <span>用例 <strong>{{ selectedCaseCount }}</strong></span>
          <span>场景 <strong>{{ selectedScenarioCount }}</strong></span>
        </div>
        <div class="scenario-import-actions">
          <el-button :disabled="importLoading" @click="emit('update:modelValue', false)">取消</el-button>
          <el-button :loading="importLoading" :disabled="!selectedTotal" @click="emit('import', 'ref')">引用</el-button>
          <el-button type="primary" :loading="importLoading" :disabled="!selectedTotal" @click="emit('import', 'copy')">复制</el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>
