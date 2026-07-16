<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, FolderOpened } from '@element-plus/icons-vue'

import {
  casePriorityOptions,
  type CaseDetail,
  type CaseDirectoryNode,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

import {
  buildSaveCasePayload,
  createCaseFormFromDetail,
  createCaseFormFromSummary,
  createDefaultCaseForm,
  type CaseDialogMode,
  type CaseForm,
  validateCaseForm,
} from './model'

type PathPickerNode = {
  key: string
  id: number | null
  name: string
  fullPath: string
  selectable: boolean
  children: PathPickerNode[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: CaseDialogMode
    caseItem?: CaseSummaryItem | null
    caseDetail?: CaseDetail | null
    directories?: CaseDirectoryWorkspace[]
    saving?: boolean
    loadingDetail?: boolean
    defaultWorkspaceCode?: string
    defaultDirectoryId?: number | null
    showNavigator?: boolean
    canGoPrev?: boolean
    canGoNext?: boolean
    currentIndex?: number
    totalCount?: number
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    directories: () => [],
    defaultWorkspaceCode: 'ALL',
    defaultDirectoryId: null,
    showNavigator: false,
    canGoPrev: false,
    canGoNext: false,
    currentIndex: 0,
    totalCount: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveCasePayload>]
  prev: []
  next: []
}>()

const form = reactive<CaseForm>(createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId))
const formError = reactive({
  message: '',
})
const modulePickerVisible = ref(false)
const modulePickerKeyword = ref('')
const modulePickerSelection = ref<number | null>(null)

const drawerTitle = computed(() => {
  if (props.mode === 'copy') {
    return '复制用例'
  }
  return props.mode === 'create' ? '新增用例' : '编辑用例'
})

const submitText = computed(() => {
  if (props.mode === 'copy') {
    return '复制'
  }
  return props.mode === 'create' ? '创建' : '保存'
})

const workspace = computed(() => props.directories.find(item => item.workspaceCode === form.workspaceCode) ?? null)

const workspaceName = computed(() => {
  return workspace.value?.workspaceName || props.caseDetail?.workspaceName || props.caseItem?.workspaceName || form.workspaceCode || '-'
})

const modulePath = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return '-'
  }
  if (form.directoryId === null) {
    return workspaceName.value
  }
  const path = resolveDirectoryPath(form.directoryId)
  return path || workspaceName.value
})

const modulePickerTree = computed<PathPickerNode[]>(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL' || !workspace.value) {
    return []
  }

  return [{
    key: `workspace:${form.workspaceCode}`,
    id: null,
    name: workspaceName.value,
    fullPath: workspaceName.value,
    selectable: false,
    children: mapDirectoryNodes(workspace.value.children),
  }]
})

const filteredModulePickerTree = computed(() => {
  const keyword = modulePickerKeyword.value.trim().toLowerCase()
  return filterPathPickerNodes(modulePickerTree.value, keyword)
})

const modulePickerSelectedPath = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return ''
  }
  if (modulePickerSelection.value === null) {
    return workspaceName.value
  }
  return resolveDirectoryPath(modulePickerSelection.value)
})

function mapDirectoryNodes(nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] {
  return nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : `${workspaceName.value} / ${node.name}`
    return {
      key: `directory:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: mapDirectoryNodes(node.children ?? [], fullPath),
    }
  })
}

function filterPathPickerNodes(nodes: PathPickerNode[], keyword: string): PathPickerNode[] {
  if (!keyword) {
    return nodes
  }

  return nodes.flatMap((node) => {
    const children = filterPathPickerNodes(node.children ?? [], keyword)
    const matched = node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    return matched || children.length
      ? [{ ...node, children }]
      : []
  })
}

function resolveDirectoryPath(directoryId: number | null) {
  if (directoryId === null) {
    return workspaceName.value
  }

  function visit(nodes: CaseDirectoryNode[], prefix: string): string {
    for (const node of nodes) {
      const path = prefix ? `${prefix} / ${node.name}` : `${workspaceName.value} / ${node.name}`
      if (node.id === directoryId) {
        return path
      }
      const childPath = visit(node.children ?? [], path)
      if (childPath) {
        return childPath
      }
    }
    return ''
  }

  return visit(workspace.value?.children ?? [], '')
}

function resetForm() {
  const nextForm =
    props.mode !== 'create' && props.caseDetail
      ? createCaseFormFromDetail(props.caseDetail, props.mode)
      : props.mode !== 'create' && props.caseItem
        ? createCaseFormFromSummary(props.caseItem, props.defaultWorkspaceCode, props.mode)
        : createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId)

  Object.assign(form, nextForm)
  formError.message = ''
}

function openModulePicker() {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return
  }
  modulePickerKeyword.value = ''
  modulePickerSelection.value = form.directoryId ?? null
  modulePickerVisible.value = true
}

function handleModulePickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  modulePickerSelection.value = node.id
}

function confirmModulePickerSelection() {
  form.directoryId = modulePickerSelection.value
  modulePickerVisible.value = false
}

function submit() {
  const error = validateCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveCasePayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      modulePickerSelection.value = form.directoryId ?? null
      modulePickerKeyword.value = ''
    } else {
      modulePickerVisible.value = false
    }
  },
)

watch(
  () => [props.caseItem, props.caseDetail, props.defaultWorkspaceCode, props.defaultDirectoryId],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)

watch(
  () => [form.workspaceCode, props.directories],
  () => {
    if (
      form.directoryId
      && !resolveDirectoryPath(form.directoryId)
    ) {
      form.directoryId = null
    }
  },
  { deep: true },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="640px"
    drawer-class="case-editor-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-editor-drawer__body">
      <el-form label-position="top" class="case-editor-drawer__form">
        <el-form-item label="用例标题" class="case-editor-drawer__form-item">
          <el-input v-model="form.title" placeholder="请输入用例名称" />
        </el-form-item>

        <el-form-item label="优先级" class="case-editor-drawer__form-item case-editor-drawer__form-item--priority">
          <el-select
            v-model="form.priority"
            class="case-editor-drawer__priority"
            popper-class="case-editor-drawer__select-popper"
          >
            <el-option
              v-for="item in casePriorityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="用例路径" class="case-editor-drawer__form-item">
          <el-input
            :model-value="modulePath"
            readonly
            class="case-editor-drawer__path-input"
            :title="modulePath"
          >
            <template #suffix>
              <button
                type="button"
                class="case-editor-drawer__path-button"
                aria-label="修改用例路径"
                :disabled="!form.workspaceCode || form.workspaceCode === 'ALL'"
                @click.stop="openModulePicker"
              >
                <el-icon><FolderOpened /></el-icon>
              </button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="前置条件" class="case-editor-drawer__form-item case-editor-drawer__form-item--precondition">
          <el-input v-model="form.precondition" type="textarea" :rows="4" resize="none" />
        </el-form-item>

        <el-form-item label="测试步骤" class="case-editor-drawer__form-item case-editor-drawer__form-item--steps">
          <el-input v-model="form.steps" type="textarea" :rows="7" resize="none" />
        </el-form-item>

        <el-form-item label="预期结果" class="case-editor-drawer__form-item case-editor-drawer__form-item--expected">
          <el-input v-model="form.expectedResult" type="textarea" :rows="4" resize="none" />
        </el-form-item>

        <p v-if="formError.message" class="case-editor-drawer__error">{{ formError.message }}</p>
      </el-form>
    </div>

    <template #footer>
      <div class="case-editor-drawer__footer">
        <div v-if="showNavigator" class="case-editor-drawer__nav">
          <AppButton :icon="ArrowLeft" :disabled="!canGoPrev || loadingDetail || saving" @click="emit('prev')">
            上一条
          </AppButton>
          <span class="case-editor-drawer__nav-counter">{{ currentIndex }}/{{ totalCount }}</span>
          <AppButton :disabled="!canGoNext || loadingDetail || saving" @click="emit('next')">
            下一条
            <el-icon class="case-editor-drawer__next-icon"><ArrowRight /></el-icon>
          </AppButton>
        </div>

        <div class="case-editor-drawer__submit">
          <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
          <AppButton type="primary" :loading="saving" :disabled="loadingDetail" @click="submit">
            {{ submitText }}
          </AppButton>
        </div>
      </div>
    </template>
  </AppDrawer>

  <AppDialog
    v-model="modulePickerVisible"
    title="选择用例路径"
    width="640px"
    dialog-class="case-module-picker-dialog"
    modal-class="case-module-picker-dialog-modal"
  >
    <div class="case-module-picker">
      <div class="case-module-picker__current">
        <span>当前用例路径</span>
        <strong>{{ modulePath }}</strong>
      </div>

      <el-input
        v-model="modulePickerKeyword"
        clearable
        placeholder="搜索目录名称"
      />

      <div class="case-module-picker__tree-panel">
        <div v-if="!filteredModulePickerTree.length" class="case-module-picker__empty">
          未找到匹配的目录
        </div>
        <el-tree
          v-else
          :data="filteredModulePickerTree"
          node-key="key"
          highlight-current
          :expand-on-click-node="false"
          :default-expanded-keys="form.workspaceCode ? [`workspace:${form.workspaceCode}`] : []"
          :current-node-key="modulePickerSelection != null ? `directory:${modulePickerSelection}` : undefined"
          class="case-module-picker__tree"
          @node-click="handleModulePickerNodeSelect"
        >
          <template #default="{ data }">
            <div
              class="case-module-picker__node"
              :class="{ 'is-workspace': !data.selectable }"
            >
              <span>{{ data.name }}</span>
            </div>
          </template>
        </el-tree>
      </div>

      <div class="case-module-picker__selected">
        <span>已选路径</span>
        <strong>{{ modulePickerSelectedPath || '请在上方目录树中选择用例路径' }}</strong>
      </div>
    </div>

    <template #footer>
      <AppButton @click="modulePickerVisible = false">取消</AppButton>
      <AppButton type="primary" :icon="FolderOpened" @click="confirmModulePickerSelection">
        确认
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
:global(.case-editor-drawer) {
  --case-editor-drawer-border: #e5e6eb;
  --case-editor-drawer-text-primary: #1d2129;
  --case-editor-drawer-text-secondary: #4e5969;
  --case-editor-drawer-text-muted: #86909c;
  --case-editor-drawer-bg-muted: #f7f8fa;
}

:global(.case-editor-drawer.el-drawer) {
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.12);
}

:global(.case-editor-drawer .el-drawer__header) {
  box-sizing: border-box;
  flex: 0 0 52px;
  margin-bottom: 0;
  height: 52px;
  min-height: 52px;
  max-height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--case-editor-drawer-border);
  color: var(--case-editor-drawer-text-primary);
}

:global(.case-editor-drawer .el-drawer__title) {
  color: var(--case-editor-drawer-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.case-editor-drawer .el-drawer__close-btn) {
  width: 26px;
  height: 26px;
  padding: 4px;
  color: #86909c;
}

:global(.case-editor-drawer .el-drawer__close-btn .el-icon) {
  width: 18px;
  height: 18px;
}

:global(.case-editor-drawer .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
}

:global(.case-editor-drawer .el-drawer__footer) {
  padding: 0;
}

.case-editor-drawer__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

.case-editor-drawer__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.case-editor-drawer__form-item {
  margin-bottom: 0;
}

:global(.case-editor-drawer .el-form-item__label) {
  height: 25px;
  padding: 0 0 5px;
  color: var(--case-editor-drawer-text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-editor-drawer .el-input__wrapper),
:global(.case-editor-drawer .el-select__wrapper),
:global(.case-editor-drawer .el-textarea__inner) {
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--case-editor-drawer-border) inset;
}

:global(.case-editor-drawer .el-input__wrapper),
:global(.case-editor-drawer .el-select__wrapper) {
  min-height: 34px;
  padding: 1px 13px;
}

:global(.case-editor-drawer .el-input__inner),
:global(.case-editor-drawer .el-select__placeholder),
:global(.case-editor-drawer .el-select__selected-item) {
  color: var(--case-editor-drawer-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

:global(.case-editor-drawer .el-textarea__inner) {
  padding: 9px 13px;
  color: var(--case-editor-drawer-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-editor-drawer__form-item--precondition :deep(.el-textarea__inner) {
  min-height: 100px;
}

.case-editor-drawer__form-item--steps :deep(.el-textarea__inner) {
  min-height: 166px;
}

.case-editor-drawer__form-item--expected :deep(.el-textarea__inner) {
  min-height: 100px;
}

.case-editor-drawer__form-item--priority {
  width: 294px;
}

.case-editor-drawer__path-input :deep(.el-input__wrapper) {
  padding-right: 6px;
}

.case-editor-drawer__path-button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--case-editor-drawer-text-muted);
  cursor: pointer;
}

.case-editor-drawer__path-button:hover:not(:disabled) {
  background: var(--case-editor-drawer-bg-muted);
  color: #165dff;
}

.case-editor-drawer__path-button:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.case-editor-drawer__priority {
  width: 100%;
}

.case-editor-drawer__path-input :deep(.el-input__inner) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-editor-drawer__error {
  margin: 0;
  color: var(--app-danger);
  font-size: 13px;
  line-height: 19.5px;
}

.case-editor-drawer__footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.case-editor-drawer__nav,
.case-editor-drawer__submit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.case-editor-drawer__submit {
  margin-left: auto;
}

.case-editor-drawer__nav-counter {
  display: inline-flex;
  min-width: 36px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: var(--case-editor-drawer-text-muted);
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.case-editor-drawer__next-icon {
  margin-left: 1px;
}

:global(.case-editor-drawer .app-drawer__footer) {
  min-height: 58px;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--case-editor-drawer-border);
  background: var(--case-editor-drawer-bg-muted);
}

:global(.case-editor-drawer .app-button.el-button) {
  min-height: 32px;
  padding: 6px 13px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-editor-drawer .app-button.el-button--primary) {
  border-color: #165dff;
  background: #165dff;
}

:global(.el-dialog.case-module-picker-dialog) {
  --case-module-picker-border: #e5e6eb;
  --case-module-picker-text-primary: #1d2129;
  --case-module-picker-text-secondary: #4e5969;
  --case-module-picker-text-muted: #86909c;
  --case-module-picker-bg-muted: #f7f8fa;
  padding: 0;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 12px 36px rgba(29, 33, 41, 0.16);
}

:global(.el-dialog.case-module-picker-dialog > .el-dialog__header) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 52px;
  min-height: 52px;
  max-height: 52px;
  margin: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--case-module-picker-border);
}

:global(.case-module-picker-dialog .el-dialog__title) {
  color: var(--case-module-picker-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.case-module-picker-dialog .el-dialog__headerbtn) {
  top: 13px;
  right: 16px;
  width: 26px;
  height: 26px;
  color: var(--case-module-picker-text-muted);
}

:global(.case-module-picker-dialog .el-dialog__body) {
  padding: 16px 20px;
}

:global(.case-module-picker-dialog .el-dialog__footer) {
  padding: 12px 20px;
  border-top: 1px solid var(--case-module-picker-border);
  background: var(--case-module-picker-bg-muted);
}

:global(.case-module-picker-dialog .el-button) {
  min-height: 32px;
  padding: 6px 13px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-module-picker-dialog .el-button--primary) {
  border-color: #165dff;
  background: #165dff;
}

.case-module-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-module-picker__current,
.case-module-picker__selected {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
}

.case-module-picker__current span,
.case-module-picker__selected span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.case-module-picker__current strong,
.case-module-picker__selected strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-module-picker :deep(.el-input__wrapper) {
  min-height: 34px;
  padding: 1px 13px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.case-module-picker :deep(.el-input__inner) {
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.case-module-picker__tree-panel {
  min-height: 300px;
  max-height: 340px;
  overflow: auto;
  padding: 8px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fff;
}

.case-module-picker__empty {
  padding: 54px 0;
  color: #86909c;
  font-size: 13px;
  text-align: center;
}

.case-module-picker__tree {
  --el-tree-node-hover-bg-color: #f7f8fa;
  color: #4e5969;
}

.case-module-picker__tree :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 4px;
  color: #4e5969;
  font-size: 13px;
}

.case-module-picker__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
}

.case-module-picker__node {
  display: flex;
  align-items: center;
  min-width: 0;
  color: inherit;
  font-size: 13px;
  line-height: 19.5px;
}

.case-module-picker__node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-module-picker__node.is-workspace {
  color: #1d2129;
  font-weight: 600;
}

@media (max-width: 760px) {
  .case-editor-drawer__body {
    padding: var(--app-space-4);
  }

  .case-editor-drawer__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .case-editor-drawer__nav,
  .case-editor-drawer__submit {
    justify-content: space-between;
  }

  .case-editor-drawer__submit {
    margin-left: 0;
  }
}
</style>
