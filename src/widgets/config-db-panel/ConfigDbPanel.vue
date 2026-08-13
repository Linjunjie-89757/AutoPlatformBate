<script setup lang="ts">
import { toRef } from 'vue'
import { Plus, RefreshRight, Search } from '@element-plus/icons-vue'

import type { DbConnectionItem } from '@/entities/config'
import { ConfigDbDialog } from '@/features/config-db-create-edit'
import { figmaConfigDbIcons, type FigmaConfigDbCylinderIcon } from '@/shared/assets/figma-icons'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

import { useConfigDbManagement } from './useConfigDbManagement'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const {
  dbConnections,
  dbConnectionTotal,
  loading,
  saving,
  errorMessage,
  dialogVisible,
  dialogMode,
  editingDbConnection,
  testingDbConnectionId,
  dbConnectionTestResults,
  deletingDbConnectionId,
  filterKeyword,
  filteredDbConnections,
  emptyDescription,
  loadDbConnections,
  openCreateDialog,
  openEditDialog,
  submitDbConnection,
  testConnection,
  openDeleteDialog,
} = useConfigDbManagement(toRef(props, 'workspaceCode'))

function normalizeDbType(type: string) {
  return type.trim().toUpperCase()
}

function getDbTypeLabel(type: string) {
  const normalized = normalizeDbType(type)
  const labels: Record<string, string> = {
    MYSQL: 'MySQL',
    POSTGRESQL: 'PostgreSQL',
    POSTGRES: 'PostgreSQL',
    ORACLE: 'Oracle',
    CLICKHOUSE: 'ClickHouse',
    REDIS: 'Redis',
    MONGODB: 'MongoDB',
  }
  return labels[normalized] || type || '-'
}

function getDbTypeTone(type: string) {
  const normalized = normalizeDbType(type)
  const fallback = { color: '#4E5969', bg: '#F2F3F5' }
  const tones: Record<string, { color: string; bg: string }> = {
    MYSQL: { color: '#0E42D2', bg: '#E8F3FF' },
    POSTGRESQL: { color: '#551DB0', bg: '#F0EEFF' },
    POSTGRES: { color: '#551DB0', bg: '#F0EEFF' },
    ORACLE: { color: '#B85C00', bg: '#FFF3E8' },
    CLICKHOUSE: { color: '#876800', bg: '#FFFBE8' },
    REDIS: { color: '#B85C00', bg: '#FFF3E8' },
    MONGODB: { color: '#0E42D2', bg: '#E8F3FF' },
  }
  return tones[normalized] || fallback
}

function getDbTypeIconKey(type: string): FigmaConfigDbCylinderIcon {
  const normalized = normalizeDbType(type)
  if (normalized === 'POSTGRESQL' || normalized === 'POSTGRES') {
    return 'purple'
  }
  if (normalized === 'ORACLE' || normalized === 'REDIS') {
    return 'orange'
  }
  if (normalized === 'CLICKHOUSE') {
    return 'yellow'
  }
  return 'blue'
}

function getDbStatusMeta(dbConnection: DbConnectionItem) {
  if (dbConnection.status === 1) {
    return { label: '已启用', color: '#4E5969', dot: '#00B42A' }
  }
  return { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
}

function getDbLastTestMeta(dbConnection: DbConnectionItem) {
  if (testingDbConnectionId.value === dbConnection.id) {
    return { label: '测试中', color: '#4E5969', dot: '#165DFF' }
  }
  if (dbConnectionTestResults.value[dbConnection.id] === 'success') {
    return { label: '连接成功', color: '#4E5969', dot: '#00B42A' }
  }
  if (dbConnectionTestResults.value[dbConnection.id] === 'failure') {
    return { label: '连接失败', color: '#F53F3F', dot: '#F53F3F' }
  }
  return { label: '未测试', color: '#86909C', dot: '#C9CDD4' }
}

</script>

<template>
  <section class="config-panel">
    <header class="config-panel__header">
      <div>
        <h2>数据库配置</h2>
        <p>管理测试用例使用的数据库连接</p>
      </div>
    </header>

    <div v-if="!errorMessage" class="config-db-toolbar">
      <el-input
        v-model="filterKeyword"
        class="config-db-search"
        clearable
        placeholder="搜索连接名称"
        :prefix-icon="Search"
      />
      <button type="button" class="config-db-primary-button" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增连接
      </button>
    </div>

    <div v-else-if="dbConnections.length" class="config-inline-error">
      {{ errorMessage }}
      <button type="button" class="config-db-secondary-button" @click="loadDbConnections">
        <el-icon><RefreshRight /></el-icon>
        重试
      </button>
    </div>

    <AppLoadingState v-if="loading && !dbConnections.length" text="正在加载数据库连接..." />

    <AppEmptyState
      v-else-if="errorMessage && !dbConnections.length"
      title="数据库连接加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <button type="button" class="config-db-secondary-button" @click="loadDbConnections">
          <el-icon><RefreshRight /></el-icon>
          重试
        </button>
      </template>
    </AppEmptyState>

    <div v-else-if="filteredDbConnections.length" class="config-db-table-card">
      <table>
        <colgroup>
          <col class="config-db-table-card__name-col" />
          <col class="config-db-table-card__type-col" />
          <col class="config-db-table-card__jdbc-col" />
          <col class="config-db-table-card__user-col" />
          <col class="config-db-table-card__status-col" />
          <col class="config-db-table-card__test-col" />
          <col class="config-db-table-card__action-col" />
        </colgroup>
        <thead>
          <tr>
            <th>连接名称</th>
            <th>类型</th>
            <th>JDBC 地址</th>
            <th>用户名</th>
            <th>状态</th>
            <th>最近测试</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="db in filteredDbConnections" :key="db.id">
            <td>
              <div class="config-db-name-cell">
                <span
                  class="config-db-icon-square"
                  :style="{ color: getDbTypeTone(db.dbType).color, backgroundColor: getDbTypeTone(db.dbType).bg }"
                >
                  <img :src="figmaConfigDbIcons.cylinder[getDbTypeIconKey(db.dbType)]" alt="">
                </span>
                <span class="config-db-name-text" :title="db.connectionName">{{ db.connectionName }}</span>
              </div>
            </td>
            <td>
              <span
                class="config-db-type-pill"
                :style="{ color: getDbTypeTone(db.dbType).color, backgroundColor: getDbTypeTone(db.dbType).bg }"
              >
                {{ getDbTypeLabel(db.dbType) }}
              </span>
            </td>
            <td>
              <code class="config-db-jdbc" :title="db.jdbcUrl">{{ db.jdbcUrl }}</code>
            </td>
            <td>
              <span class="config-db-muted">{{ db.username || '-' }}</span>
            </td>
            <td>
              <span class="config-db-status" :style="{ color: getDbStatusMeta(db).color }">
                <span :style="{ backgroundColor: getDbStatusMeta(db).dot }" />
                {{ getDbStatusMeta(db).label }}
              </span>
            </td>
            <td>
              <span class="config-db-status" :style="{ color: getDbLastTestMeta(db).color }">
                <span :style="{ backgroundColor: getDbLastTestMeta(db).dot }" />
                {{ getDbLastTestMeta(db).label }}
              </span>
            </td>
            <td>
              <div class="config-db-row-actions">
                <button
                  type="button"
                  class="config-db-icon-button"
                  aria-label="测试连接"
                  :disabled="testingDbConnectionId === db.id"
                  @click="testConnection(db)"
                >
                  <img :src="figmaConfigDbIcons.action.test" alt="">
                </button>
                <button
                  type="button"
                  class="config-db-icon-button"
                  aria-label="编辑连接"
                  @click="openEditDialog(db)"
                >
                  <img :src="figmaConfigDbIcons.action.edit" alt="">
                </button>
                <button
                  type="button"
                  class="config-db-icon-button is-danger"
                  aria-label="删除连接"
                  :disabled="deletingDbConnectionId === db.id"
                  @click="openDeleteDialog(db)"
                >
                  <img :src="figmaConfigDbIcons.action.delete" alt="">
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <footer class="config-db-pagination">
        <span>共 {{ dbConnectionTotal }} 条</span>
        <button type="button">1</button>
      </footer>
    </div>

    <AppEmptyState
      v-else
      title="暂无数据库连接"
      :description="emptyDescription"
    >
      <template #actions>
        <button type="button" class="config-db-primary-button" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新增连接
        </button>
      </template>
    </AppEmptyState>

    <ConfigDbDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :db-connection="editingDbConnection"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitDbConnection"
    />

  </section>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-panel__header {
  margin-bottom: 0;
}

.config-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 500;
  line-height: 27px;
}

.config-panel__header p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 23.5px;
}

.config-db-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.config-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

.config-db-search {
  width: 200px;
}

.config-db-search :deep(.el-input__wrapper) {
  height: 32px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.config-db-search :deep(.el-input__inner) {
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.config-db-primary-button,
.config-db-secondary-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease;
}

.config-db-primary-button {
  padding: 0 12px;
  background: var(--app-primary);
  color: #ffffff;
}

.config-db-primary-button:hover {
  background: var(--app-primary-hover);
}

.config-db-secondary-button {
  padding: 0 10px;
  border-color: var(--app-border);
  background: #ffffff;
  color: var(--app-text-secondary);
}

.config-db-secondary-button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.config-db-primary-button .el-icon,
.config-db-secondary-button .el-icon {
  width: 13px;
  height: 13px;
  font-size: 13px;
}

.config-db-table-card {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--app-shadow-card);
}

.config-db-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-db-table-card th {
  height: 34.5px;
  padding: 0 14px;
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  text-align: left;
  white-space: nowrap;
}

.config-db-table-card th:last-child {
  text-align: left;
}

.config-db-table-card td {
  height: 46px;
  padding: 0 14px;
  border-top: 1px solid var(--app-border);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  vertical-align: middle;
}

.config-db-table-card tbody tr:first-child td {
  border-top-color: var(--app-border);
}

.config-db-table-card tbody tr:hover {
  background: #fafbff;
}

.config-db-table-card__name-col {
  width: 22%;
}

.config-db-table-card__type-col {
  width: 11%;
}

.config-db-table-card__jdbc-col {
  width: 28%;
}

.config-db-table-card__user-col {
  width: 10%;
}

.config-db-table-card__status-col,
.config-db-table-card__test-col {
  width: 9%;
}

.config-db-table-card__action-col {
  width: 11%;
}

.config-db-name-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.config-db-icon-square {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.config-db-icon-square img {
  display: block;
  width: 14px;
  height: 14px;
}

.config-db-name-text {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-db-type-pill {
  display: inline-flex;
  height: 17.5px;
  align-items: center;
  padding: 0 7px;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  white-space: nowrap;
}

.config-db-jdbc {
  display: block;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: var(--app-font-family-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-db-muted {
  overflow: hidden;
  display: block;
  color: var(--app-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-db-status {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.config-db-status span {
  width: 5.25px;
  height: 5.25px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.config-db-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1.75px;
}

.config-db-icon-button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.config-db-icon-button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-secondary);
}

.config-db-icon-button.is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.config-db-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.config-db-icon-button img {
  display: block;
  width: 13px;
  height: 13px;
}

.config-db-secondary-button,
.config-db-danger-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.config-db-secondary-button {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
}

.config-db-danger-button {
  border: 1px solid #f53f3f;
  background: #f53f3f;
  color: #fff;
}

.config-db-danger-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.config-db-pagination {
  display: flex;
  height: 43px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-top: 1px solid var(--app-border);
}

.config-db-pagination span {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.config-db-pagination button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-primary);
  border-radius: 5px;
  background: var(--app-primary);
  color: #ffffff;
  cursor: default;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

@media (max-width: 720px) {
  .config-db-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .config-db-search,
  .config-db-primary-button {
    width: 100%;
  }

  .config-db-table-card {
    overflow-x: auto;
  }

  .config-db-table-card table {
    min-width: 960px;
  }
}
</style>
