<script setup lang="ts">
import { CircleCheck, Eye, Pencil, Trash2 } from '@lucide/vue'

import { type WebUiElementItem } from '@/entities/web-ui-automation'

defineProps<{
  loading: boolean
  elements: WebUiElementItem[]
  validatingId: number | null
  deletingId: number | null
}>()

const emit = defineEmits<{
  'selection-change': [items: WebUiElementItem[]]
  detail: [item: WebUiElementItem]
  validate: [item: WebUiElementItem]
  edit: [item: WebUiElementItem]
  delete: [item: WebUiElementItem]
  references: [item: WebUiElementItem]
}>()

function verificationMeta(item: WebUiElementItem) {
  if (item.lastValidateResult === 'PASSED') return { label: '验证通过', tone: 'success' }
  if (item.lastValidateResult) return { label: '验证失败', tone: 'danger' }
  return { label: '未验证', tone: 'muted' }
}
</script>

<template>
  <div class="web-ui-element-table-frame">
    <el-table
      v-loading="loading"
      class="web-ui-element-table"
      :data="elements"
      row-key="id"
      empty-text="暂无 Web UI 元素"
      @row-click="emit('detail', $event)"
      @selection-change="emit('selection-change', $event)"
    >
      <el-table-column label="元素名称" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="web-ui-element-name">
            <strong>{{ row.elementName }}</strong>
            <small>{{ row.description || '-' }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="pageName" label="所属页面" min-width="140" show-overflow-tooltip />
      <el-table-column label="分组" min-width="126" show-overflow-tooltip>
        <template #default="{ row }">{{ row.groupName || '-' }}</template>
      </el-table-column>
      <el-table-column label="定位方式" width="116">
        <template #default="{ row }"><code class="web-ui-element-locator-type">{{ String(row.locatorType).toLowerCase() }}</code></template>
      </el-table-column>
      <el-table-column prop="locatorValue" label="定位值" min-width="230" show-overflow-tooltip>
        <template #default="{ row }"><span class="web-ui-element-locator-value">{{ row.locatorValue }}</span></template>
      </el-table-column>
      <el-table-column label="引用次数" width="108" align="center">
        <template #default="{ row }"><button type="button" class="web-ui-element-reference" @click.stop="emit('references', row)">{{ row.usageCount || 0 }}</button></template>
      </el-table-column>
      <el-table-column label="最近验证" min-width="142">
        <template #default="{ row }">
          <span class="web-ui-element-verification" :class="`is-${verificationMeta(row).tone}`"><i />{{ verificationMeta(row).label }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="132" align="right">
        <template #default="{ row }">
          <div class="web-ui-element-actions" @click.stop>
            <button type="button" title="验证元素" :disabled="validatingId === row.id" @click="emit('validate', row)"><CircleCheck /></button>
            <button type="button" title="查看引用" @click="emit('references', row)"><Eye /></button>
            <button type="button" title="编辑" @click="emit('edit', row)"><Pencil /></button>
            <button type="button" class="is-danger" title="删除" :disabled="deletingId === row.id" @click="emit('delete', row)"><Trash2 /></button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.web-ui-element-table-frame { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 12px; background: #ffffff; box-shadow: 0 1px 4px rgba(0, 0, 0, .04); }
.web-ui-element-table { --el-table-border-color: transparent; --el-table-header-bg-color: #fafafa; --el-table-row-hover-bg-color: #fafbff; width: 100%; }
.web-ui-element-table :deep(.el-table__header-wrapper th) { height: 39px; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; line-height: 16.5px; }
.web-ui-element-table :deep(.el-table__row) { height: 46px; cursor: pointer; }
.web-ui-element-table :deep(.el-table__cell) { padding: 7px 0; color: #1d2129; font-size: 13px; line-height: 19.5px; }
.web-ui-element-table :deep(.el-table__body tr:hover > td.el-table__cell) { background: #fafbff; }
.web-ui-element-name { min-width: 0; }
.web-ui-element-name strong, .web-ui-element-name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-element-name strong { color: #1d2129; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.web-ui-element-name small { margin-top: 2px; color: #86909c; font-size: 11px; line-height: 16px; }
.web-ui-element-locator-type { padding: 2px 6px; border-radius: 4px; background: #eef0fa; color: #4e5ac8; font-family: var(--app-font-family-mono); font-size: 10px; }
.web-ui-element-locator-value { color: #86909c; font-family: var(--app-font-family-mono); font-size: 12px; }
.web-ui-element-reference { border: 0; background: transparent; color: #4e5969; cursor: pointer; font-size: 13px; }
.web-ui-element-reference:not(:disabled):hover { color: #0fc6c2; font-weight: 600; }
.web-ui-element-verification { display: inline-flex; align-items: center; gap: 6px; color: #c9cdd4; font-size: 12px; }
.web-ui-element-verification i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.web-ui-element-verification.is-success { color: #00b42a; }
.web-ui-element-verification.is-danger { color: #f53f3f; }
.web-ui-element-actions { display: inline-flex; align-items: center; justify-content: flex-end; }
.web-ui-element-actions button { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #c9cdd4; cursor: pointer; }
.web-ui-element-actions button svg { width: 13px; height: 13px; }
.web-ui-element-actions button:hover:not(:disabled) { background: #f2f3f5; color: #1d2129; }
.web-ui-element-actions button.is-danger:hover:not(:disabled) { background: #fff0f0; color: #f53f3f; }
.web-ui-element-actions button:disabled { cursor: not-allowed; opacity: .45; }
</style>
