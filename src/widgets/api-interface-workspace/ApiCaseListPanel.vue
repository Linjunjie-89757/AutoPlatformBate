<script setup lang="ts">
import { MoreFilled, Setting } from '@element-plus/icons-vue'

import type { ApiDefinitionCaseItem } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'

defineProps<{
  definitionId: number | null
  cases: ApiDefinitionCaseItem[]
  pagedCases: ApiDefinitionCaseItem[]
  totalPages: number
  currentPage: number
  pageSize: number
  pageSizes: number[]
  runningId: number | null
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
  caseProtocolLabel: () => string
  casePriorityLabel: (row: ApiDefinitionCaseItem) => string
  caseStatusLabel: (row: ApiDefinitionCaseItem) => string
  formatCaseTags: (tags?: string[] | null) => string
}>()

const emit = defineEmits<{
  create: []
  aiGenerate: []
  edit: [row: ApiDefinitionCaseItem]
  run: [row: ApiDefinitionCaseItem]
  detail: [row: ApiDefinitionCaseItem]
  duplicate: [row: ApiDefinitionCaseItem]
  delete: [row: ApiDefinitionCaseItem]
  'update:currentPage': [value: number]
  'update:pageSize': [value: number]
}>()
</script>

<template>
  <div class="ms-like-request-body case-list-request-body">
    <div class="request-section case-list-panel">
      <div class="editor-actions left">
        <el-button
          v-if="canCreate !== false"
          type="primary"
          :title="definitionId ? '新建用例' : '请先保存接口，再创建用例'"
          :disabled="!definitionId"
          @click="emit('create')"
        >
          新建用例
        </el-button>
        <button
          v-if="canCreate !== false"
          type="button"
          class="case-ai-generate-button"
          :disabled="!definitionId"
          :title="definitionId ? 'AI 生成接口用例' : '请先保存接口，再使用 AI 生成用例'"
          @click="emit('aiGenerate')"
        >
          <img class="case-ai-generate-button__icon" :src="figmaApiInterfaceIcons.aiGenerate" alt="" />
          <span>AI 生成</span>
        </button>
      </div>

      <div v-if="!cases.length" class="empty-hint">当前接口下还没有用例</div>
      <div v-else class="case-list-table-wrap">
        <el-table :data="pagedCases" size="small" class="case-list-table">
          <el-table-column prop="id" label="ID" width="92" />
          <el-table-column prop="name" label="用例名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="协议" width="90">
            <template #default>
              {{ caseProtocolLabel() }}
            </template>
          </el-table-column>
          <el-table-column label="用例等级" width="100">
            <template #default="{ row }">
              {{ casePriorityLabel(row) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              {{ caseStatusLabel(row) }}
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路径" min-width="240" show-overflow-tooltip />
          <el-table-column label="标签" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatCaseTags(row.tags) }}
            </template>
          </el-table-column>
          <el-table-column label="创建人" width="110">
            <template #default>-</template>
          </el-table-column>
          <el-table-column width="148" fixed="right" align="center" header-align="center">
            <template #header>
              <div class="case-list-operation-header">
                <span>操作</span>
                <el-button text class="table-settings-trigger case-list-settings-trigger" title="表格设置">
                  <el-icon><Setting /></el-icon>
                </el-button>
              </div>
            </template>
            <template #default="{ row }">
              <div class="case-list-actions">
                <el-button v-if="canEdit !== false" text type="primary" size="small" class="case-list-action-button" @click="emit('edit', row)">编辑</el-button>
                <el-button v-if="canExecute !== false" text size="small" type="primary" :loading="runningId === row.id" @click="emit('run', row)">执行</el-button>
                <el-dropdown trigger="click" placement="bottom-end">
                  <el-button text type="primary" size="small" class="case-list-more-button">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu class="case-list-more-menu">
                      <el-dropdown-item class="case-list-menu-item" @click="emit('detail', row)">查看详情</el-dropdown-item>
                      <el-dropdown-item v-if="canCreate !== false" class="case-list-menu-item" @click="emit('duplicate', row)">复制</el-dropdown-item>
                      <el-dropdown-item v-if="canDelete !== false" class="case-list-menu-item is-danger" @click="emit('delete', row)">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="case-list-pagination">
          <div class="case-list-pagination-summary">共 {{ cases.length }} 条 / {{ totalPages }} 页</div>
          <el-pagination
            :current-page="currentPage"
            :page-size="pageSize"
            :page-sizes="pageSizes"
            size="small"
            layout="sizes, prev, pager, next"
            :total="cases.length"
            @update:current-page="emit('update:currentPage', $event)"
            @update:page-size="emit('update:pageSize', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-list-request-body {
  display: flex;
  min-height: 0;
  padding: 0;
}

.case-list-panel {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.case-list-panel .editor-actions.left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.case-ai-generate-button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  height: 31.5px;
  padding: 0 11.5px;
  border: 1px solid rgba(120, 22, 255, 0.19);
  border-radius: 7px;
  background: #f5e8ff;
  color: #7816ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.case-ai-generate-button:hover:not(:disabled) {
  border-color: rgba(120, 22, 255, 0.3);
  background: #f5e8ff;
  color: #7816ff;
}

.case-ai-generate-button:disabled {
  border-color: rgba(120, 22, 255, 0.12);
  background: rgba(245, 232, 255, 0.55);
  color: rgba(120, 22, 255, 0.45);
  cursor: not-allowed;
}

.case-ai-generate-button__icon {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.case-list-panel .empty-hint {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #9ca3af;
  font-size: 13px;
}

.case-list-table-wrap {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.case-list-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-list-table :deep(.el-table__row td) {
  height: 42px;
  color: #374151;
  font-size: 13px;
}

.case-list-operation-header,
.case-list-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.case-list-settings-trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  color: #6b7280;
}

.case-list-action-button,
.case-list-more-button {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 500;
}

.case-list-more-button {
  width: 26px;
  padding: 0;
}

.case-list-menu-item {
  height: 32px;
  font-size: 13px;
}

.case-list-menu-item.is-danger {
  color: #dc2626;
}

.case-list-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.case-list-pagination-summary {
  color: #6b7280;
  font-size: 12px;
}

/* Figma interface workspace visual pass */
.case-list-request-body {
  color: #1d2129;
  font-size: 13px;
}

.case-list-panel .editor-actions.left {
  min-height: 31.5px;
  margin-bottom: 14px;
}

.case-list-panel .editor-actions.left :deep(.el-button),
.case-ai-generate-button {
  height: 28px;
  min-height: 28px;
  padding: 0 11.5px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-ai-generate-button {
  border-color: rgba(120, 22, 255, 0.19);
  background: #f5e8ff;
  color: #7816ff;
}

.case-list-table-wrap {
  border-color: #e5e6eb;
  border-radius: 7px;
  box-shadow: none;
}

.case-list-table :deep(.el-table__header th) {
  height: 31px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-list-table :deep(.el-table__row td) {
  height: 34.5px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
}

.case-list-action-button,
.case-list-more-button {
  height: 28px;
  color: #165dff;
  font-size: 12px;
}

.case-list-pagination {
  min-height: 40px;
  padding: 0 10.5px;
  border-top-color: #e5e6eb;
}
</style>
