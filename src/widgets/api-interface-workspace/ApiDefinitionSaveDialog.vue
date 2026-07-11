<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { Folder as LucideFolder, FolderOpen as LucideFolderOpen, FolderPlus as LucideFolderPlus } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import type { DirectoryNode } from './lib/apiDirectoryTree'
import {
  type ApiDefinitionSaveDraft,
  buildApiDefinitionSaveDraft,
  validateApiDefinitionSaveDraft,
} from './lib/apiDefinitionSaveDialog'

const props = defineProps<{
  modelValue: boolean
  currentName?: string | null
  requestPath?: string | null
  currentDirectoryName?: string | null
  selectedDirectoryName?: string | null
  directoryTree: DirectoryNode[]
  submitting?: boolean
  moduleCreating?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [draft: ApiDefinitionSaveDraft]
  createModule: [payload: { name: string; parentId: number | null }]
}>()

const form = reactive<ApiDefinitionSaveDraft>({
  name: '',
  directoryName: '',
})
const moduleSelectOpen = ref(false)
const createModuleVisible = ref(false)
const createModuleForm = reactive({
  name: '',
  parentId: null as number | null,
})

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const selectableDirectoryTree = computed(() => {
  const walk = (nodes: DirectoryNode[]): DirectoryNode[] => {
    return nodes.flatMap((node) => {
      const children = walk(node.children || [])
      if (node.type === 'root') {
        return children
      }
      if (node.type !== 'workspace' && node.type !== 'module') {
        return []
      }
      return [{
        ...node,
        children,
      }]
    })
  }

  return walk(props.directoryTree || [])
})

const moduleOptions = computed(() => {
  const options: Array<{ label: string; value: number | null; fullPath: string }> = [
    { label: '根模块', value: null, fullPath: '' },
  ]
  const walk = (nodes: DirectoryNode[]) => {
    nodes.forEach((node) => {
      if (node.type === 'module') {
        options.push({
          label: node.fullPath || node.label,
          value: node.moduleId,
          fullPath: node.fullPath || node.label,
        })
      }
      walk(node.children || [])
    })
  }
  walk(props.directoryTree || [])
  return options
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const draft = buildApiDefinitionSaveDraft({
      currentName: props.currentName,
      requestPath: props.requestPath,
      currentDirectoryName: props.currentDirectoryName,
      selectedDirectoryName: props.selectedDirectoryName,
    })
    form.name = draft.name
    form.directoryName = draft.directoryName
    moduleSelectOpen.value = false
    createModuleVisible.value = false
  },
)

watch(
  () => props.currentDirectoryName,
  (value) => {
    if (!props.modelValue) return
    if (!value) return
    form.directoryName = value.trim()
    createModuleVisible.value = false
    moduleSelectOpen.value = false
  },
)

function closeDialog() {
  if (props.submitting) return
  visible.value = false
}

function selectDirectory(node: DirectoryNode) {
  if (node.type !== 'module') return
  form.directoryName = (node.fullPath || '').trim()
  moduleSelectOpen.value = false
}

function confirmSave() {
  const draft = {
    name: form.name.trim(),
    directoryName: form.directoryName.trim(),
  }
  const validation = validateApiDefinitionSaveDraft(draft)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    return
  }
  emit('confirm', draft)
}

function openCreateModuleDialog() {
  createModuleForm.name = ''
  const matched = moduleOptions.value.find(item => item.fullPath === form.directoryName)
  createModuleForm.parentId = matched?.value ?? null
  createModuleVisible.value = true
}

function confirmCreateModule() {
  const name = createModuleForm.name.trim()
  if (!name) {
    ElMessage.warning('请输入模块名称')
    return
  }
  emit('createModule', {
    name,
    parentId: createModuleForm.parentId,
  })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="保存接口"
    width="520px"
    class="api-definition-save-dialog"
    append-to-body
    :close-on-click-modal="!props.submitting"
    :close-on-press-escape="!props.submitting"
    @close="closeDialog"
  >
    <div class="api-definition-save-dialog__form">
      <label class="api-definition-save-dialog__label">请求名称 <span>*</span></label>
      <el-input
        v-model="form.name"
        placeholder="请输入接口名称"
        :disabled="props.submitting"
        maxlength="120"
        show-word-limit
      />

      <label class="api-definition-save-dialog__label">保存模块 <span>*</span></label>
      <div class="api-definition-save-dialog__module-select">
        <button
          type="button"
          class="api-definition-save-dialog__module-trigger"
          :class="{ 'is-open': moduleSelectOpen }"
          :disabled="props.submitting"
          @click="moduleSelectOpen = !moduleSelectOpen"
        >
          <span>{{ form.directoryName || '请选择保存模块' }}</span>
          <el-icon>
            <ArrowDown />
          </el-icon>
        </button>
        <div v-if="moduleSelectOpen" class="api-definition-save-dialog__module-dropdown">
          <div class="api-definition-save-dialog__tree">
            <el-tree
              :data="selectableDirectoryTree"
              node-key="key"
              default-expand-all
              :expand-on-click-node="false"
              empty-text="暂无可选模块"
              @node-click="selectDirectory"
            >
              <template #default="{ data }">
                <div
                  :class="[
                    'api-definition-save-dialog__node',
                    { 'is-selected': data.type === 'module' && data.fullPath === form.directoryName },
                    { 'is-workspace': data.type === 'workspace' },
                  ]"
                >
                  <span class="api-definition-save-dialog__folder">
                    <LucideFolderOpen v-if="data.children?.length" class="api-definition-save-dialog__icon" />
                    <LucideFolder v-else class="api-definition-save-dialog__icon" />
                  </span>
                  <span class="api-definition-save-dialog__node-name" :title="data.fullPath || data.label">
                    {{ data.label }}
                  </span>
                </div>
              </template>
            </el-tree>
          </div>
          <button type="button" class="api-definition-save-dialog__create-module" @click="openCreateModuleDialog">
            <LucideFolderPlus class="api-definition-save-dialog__create-icon" />
            <span>新建模块</span>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="api-definition-save-dialog__plain" :disabled="props.submitting" @click="closeDialog">
        取消
      </button>
      <button type="button" class="api-definition-save-dialog__primary" :disabled="props.submitting" @click="confirmSave">
        {{ props.submitting ? '保存中' : '保存' }}
      </button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="createModuleVisible"
    title="新建模块"
    width="420px"
    class="api-definition-save-dialog api-definition-save-dialog--module"
    append-to-body
    :close-on-click-modal="!props.moduleCreating"
    :close-on-press-escape="!props.moduleCreating"
  >
    <div class="api-definition-save-dialog__create-form">
      <label class="api-definition-save-dialog__label">模块名称 <span>*</span></label>
      <el-input
        v-model="createModuleForm.name"
        placeholder="请输入模块名称"
        :disabled="props.moduleCreating"
        maxlength="80"
        show-word-limit
      />
      <label class="api-definition-save-dialog__label">父级模块</label>
      <el-select
        v-model="createModuleForm.parentId"
        class="api-definition-save-dialog__parent-select"
        filterable
        :disabled="props.moduleCreating"
        placeholder="根模块"
      >
        <el-option
          v-for="item in moduleOptions"
          :key="item.value ?? 'root'"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </div>
    <template #footer>
      <button type="button" class="api-definition-save-dialog__plain" :disabled="props.moduleCreating" @click="createModuleVisible = false">
        取消
      </button>
      <button type="button" class="api-definition-save-dialog__primary" :disabled="props.moduleCreating" @click="confirmCreateModule">
        {{ props.moduleCreating ? '创建中' : '创建' }}
      </button>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.el-dialog.api-definition-save-dialog) {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
}

:global(.el-dialog.api-definition-save-dialog .el-dialog__header) {
  height: 48px;
  margin: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--app-border-soft);
  display: flex;
  align-items: center;
}

:global(.el-dialog.api-definition-save-dialog .el-dialog__title) {
  color: var(--app-text-primary);
  font-family: var(--app-font-family);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

:global(.el-dialog.api-definition-save-dialog .el-dialog__headerbtn) {
  top: 8px;
  right: 10px;
  width: 32px;
  height: 32px;
}

:global(.el-dialog.api-definition-save-dialog .el-dialog__body) {
  padding: 16px 18px 14px;
}

:global(.el-dialog.api-definition-save-dialog .el-dialog__footer) {
  padding: 12px 18px;
  border-top: 1px solid var(--app-border-soft);
  background: #fafbfc;
}

:global(.el-dialog.api-definition-save-dialog .el-input__wrapper),
:global(.el-dialog.api-definition-save-dialog .el-select__wrapper) {
  min-height: 32px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px var(--app-border);
}

:global(.el-dialog.api-definition-save-dialog .el-input__wrapper:hover),
:global(.el-dialog.api-definition-save-dialog .el-select__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #c9cdd4;
}

:global(.el-dialog.api-definition-save-dialog .el-input.is-focus .el-input__wrapper),
:global(.el-dialog.api-definition-save-dialog .el-select__wrapper.is-focused) {
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-definition-save-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-definition-save-dialog__label {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-definition-save-dialog__label span {
  color: var(--app-danger);
}

.api-definition-save-dialog__module-select {
  position: relative;
}

.api-definition-save-dialog__module-trigger {
  display: inline-flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  padding: 0 10px;
  color: var(--app-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--app-font-size-sm);
}

.api-definition-save-dialog__module-trigger span {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-save-dialog__module-trigger:hover,
.api-definition-save-dialog__module-trigger.is-open {
  border-color: var(--app-primary);
}

.api-definition-save-dialog__module-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.api-definition-save-dialog__module-dropdown {
  margin-top: 4px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: 0 12px 32px rgb(15 23 42 / 0.12);
}

.api-definition-save-dialog__tree {
  max-height: 260px;
  overflow: auto;
  padding: 6px;
}

.api-definition-save-dialog__tree :deep(.el-tree) {
  background: transparent;
}

.api-definition-save-dialog__tree :deep(.el-tree-node__content) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
}

.api-definition-save-dialog__tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.api-definition-save-dialog__node {
  display: inline-flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.api-definition-save-dialog__node.is-selected {
  color: var(--app-primary);
  font-weight: 600;
}

.api-definition-save-dialog__node.is-workspace {
  font-weight: 600;
}

.api-definition-save-dialog__folder {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--app-text-muted);
}

.api-definition-save-dialog__icon {
  width: 16px;
  height: 16px;
}

.api-definition-save-dialog__node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-save-dialog__create-module {
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  padding: 0 12px;
  color: var(--app-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-definition-save-dialog__create-module:hover {
  background: var(--app-primary-soft);
}

.api-definition-save-dialog__create-icon {
  width: 16px;
  height: 16px;
}

.api-definition-save-dialog__create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-definition-save-dialog__parent-select {
  width: 100%;
}

.api-definition-save-dialog__plain,
.api-definition-save-dialog__primary {
  min-width: 72px;
  height: 32px;
  border-radius: var(--app-radius-md);
  padding: 0 14px;
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-definition-save-dialog__plain {
  border: 1px solid var(--app-border);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
}

.api-definition-save-dialog__plain:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.api-definition-save-dialog__primary {
  border: 1px solid var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}

.api-definition-save-dialog__plain:disabled,
.api-definition-save-dialog__primary:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
</style>
