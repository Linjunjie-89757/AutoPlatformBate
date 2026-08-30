<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, FolderOpened } from '@element-plus/icons-vue'
import { Plus, X } from '@lucide/vue'

import {
  casePriorityOptions,
  type CaseDetail,
  type CaseDirectoryNode,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveCasePayload,
  createCaseFormFromDetail,
  createCaseFormFromSummary,
  createDefaultCaseForm,
  type CaseDialogMode,
  type CaseForm,
  validateCaseForm,
  caseTypeOptions,
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
const submitted = ref(false)
const modulePickerVisible = ref(false)
const modulePickerKeyword = ref('')
const modulePickerSelection = ref<number | null>(null)
const stepLines = computed(() => {
  const lines = form.steps.split('\n')
  return lines.length ? lines : ['']
})

const fieldErrors = computed(() => ({
  title: submitted.value && !form.title.trim() ? '用例标题不能为空' : '',
  priority: submitted.value && !form.priority ? '请选择优先级' : '',
  steps: submitted.value && !stepLines.value.some(step => step.trim()) ? '至少填写一条测试步骤' : '',
  expected: submitted.value && !form.expectedResult.trim() ? '预期结果不能为空' : '',
}))
const hasFieldErrors = computed(() => Object.values(fieldErrors.value).some(Boolean))

const priorityStyles: Record<string, { background: string; color: string }> = {
  P0: { background: '#F53F3F', color: '#fff' },
  P1: { background: '#FF7D00', color: '#fff' },
  P2: { background: '#FAAD14', color: '#fff' },
  P3: { background: '#165DFF', color: '#fff' },
}

const drawerTitle = computed(() => {
  if (props.mode === 'copy') {
    return '复制用例'
  }
  return props.mode === 'create' ? '新增用例' : '编辑用例'
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
  if (props.mode === 'create') {
    form.priority = ''
  }
  submitted.value = false
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
  submitted.value = true
  const error = validateCaseForm(form)
  if (error) {
    return
  }

  emit('submit', buildSaveCasePayload(form))
}

function updateStep(index: number, value: string) {
  const lines = [...stepLines.value]
  lines[index] = value
  form.steps = lines.join('\n')
}

function addStep() {
  form.steps = [...stepLines.value, ''].join('\n')
}

function removeStep(index: number) {
  const lines = stepLines.value.filter((_, currentIndex) => currentIndex !== index)
  form.steps = lines.length ? lines.join('\n') : ''
}

function handleDrawerKeydown(event: KeyboardEvent) {
  if (!props.modelValue || modulePickerVisible.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('update:modelValue', false)
  }
}

onMounted(() => document.addEventListener('keydown', handleDrawerKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleDrawerKeydown))

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
  <Teleport to="body">
    <div v-if="modelValue" class="case-editor-drawer" role="dialog" aria-modal="true" :aria-label="drawerTitle">
      <div class="case-editor-drawer__mask" @click="emit('update:modelValue', false)" />
      <aside class="case-editor-drawer__panel">
        <header class="case-editor-drawer__header">
          <strong>{{ drawerTitle }}</strong>
          <span class="case-editor-drawer__context">当前项目：{{ workspaceName }} · 测试平台</span>
          <button type="button" class="case-editor-drawer__close" aria-label="关闭" @click="emit('update:modelValue', false)"><X :size="14" /></button>
        </header>

        <main class="case-editor-drawer__body">
          <section class="case-editor-drawer__section">
            <h3>基本信息</h3>
            <label class="case-editor-drawer__field is-title">
              <span><em>*</em>用例标题</span>
              <div class="case-editor-drawer__input-wrap">
                <input v-model="form.title" maxlength="200" placeholder="简洁描述测试点，如：用户正常登录后跳转首页" :class="{ 'is-error': fieldErrors.title }" />
                <small>{{ form.title.length }}/200</small>
              </div>
              <small v-if="fieldErrors.title" class="case-editor-drawer__field-error">{{ fieldErrors.title }}</small>
            </label>
            <div class="case-editor-drawer__grid-row">
              <label class="case-editor-drawer__field">
                <span>所属目录</span>
                <div class="case-editor-drawer__input-wrap">
                  <input :value="modulePath" readonly :title="modulePath" />
                  <button type="button" class="case-editor-drawer__path-button" aria-label="修改用例路径" :disabled="!form.workspaceCode || form.workspaceCode === 'ALL'" @click.stop="openModulePicker"><el-icon><FolderOpened /></el-icon></button>
                </div>
              </label>
              <label class="case-editor-drawer__field">
                <span>用例类型</span>
                <select v-model="form.caseType">
                  <option v-for="item in caseTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </label>
            </div>
            <div class="case-editor-drawer__grid-row">
              <div class="case-editor-drawer__field">
                <span><em>*</em>优先级</span>
                <div class="case-editor-drawer__priority-options">
                  <button v-for="item in casePriorityOptions" :key="item.value" type="button" :class="{ 'is-active': form.priority === item.value }" :style="form.priority === item.value ? { borderColor: priorityStyles[item.value].background, background: priorityStyles[item.value].background, color: priorityStyles[item.value].color } : undefined" @click="form.priority = item.value">{{ item.label }}</button>
                </div>
                <small v-if="fieldErrors.priority" class="case-editor-drawer__field-error">{{ fieldErrors.priority }}</small>
              </div>
              <div class="case-editor-drawer__field">
                <span>来源</span>
                <select v-model="form.sourceType"><option value="MANUAL">手工创建</option><option value="IMPORTED">导入</option><option value="AI_GENERATED">AI 生成</option></select>
              </div>
            </div>
          </section>

          <section class="case-editor-drawer__section">
            <h3>测试内容</h3>
            <label class="case-editor-drawer__field"><span>前置条件</span><textarea v-model="form.precondition" rows="2" placeholder="执行用例前需满足的环境或数据条件，如：已登录管理员账号" /></label>
            <div class="case-editor-drawer__field"><span><em>*</em>测试步骤</span><div class="case-editor-drawer__steps">
              <div v-for="(step, index) in stepLines" :key="index" class="case-editor-drawer__step-row">
                <b>{{ index + 1 }}</b><input :value="step" :class="{ 'is-error': fieldErrors.steps && !step.trim() }" :placeholder="`步骤 ${index + 1}：描述操作动作`" @input="updateStep(index, ($event.target as HTMLInputElement).value)" /><button v-if="stepLines.length > 1" type="button" aria-label="删除步骤" @click="removeStep(index)"><X :size="12" /></button>
              </div>
            </div><small v-if="fieldErrors.steps" class="case-editor-drawer__field-error">{{ fieldErrors.steps }}</small><button type="button" class="case-editor-drawer__add-step" @click="addStep"><Plus :size="13" /> 添加步骤</button></div>
            <label class="case-editor-drawer__field"><span><em>*</em>预期结果</span><textarea v-model="form.expectedResult" rows="3" :class="{ 'is-error': fieldErrors.expected }" placeholder="描述执行以上步骤后系统应有的正确响应或状态" /><small v-if="fieldErrors.expected" class="case-editor-drawer__field-error">{{ fieldErrors.expected }}</small></label>
          </section>
        </main>

        <footer class="case-editor-drawer__footer">
          <div v-if="showNavigator" class="case-editor-drawer__nav"><AppButton :icon="ArrowLeft" :disabled="!canGoPrev || loadingDetail || saving" @click="emit('prev')">上一条</AppButton><span>{{ currentIndex }}/{{ totalCount }}</span><AppButton :disabled="!canGoNext || loadingDetail || saving" @click="emit('next')">下一条</AppButton></div>
          <span v-else-if="hasFieldErrors" class="case-editor-drawer__footer-error">请检查标红字段后再保存</span>
          <div class="case-editor-drawer__submit"><button type="button" class="case-editor-drawer__button is-ghost" :disabled="saving" @click="emit('update:modelValue', false)">取消</button><button type="button" class="case-editor-drawer__button is-primary" :disabled="saving || loadingDetail" @click="submit">{{ saving ? '保存中...' : '保存用例' }}</button></div>
        </footer>
      </aside>
    </div>
  </Teleport>

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

/* Figma Make new-case drawer geometry and controls. */
.case-editor-drawer {
  position: fixed;
  z-index: 2050;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  font-family: var(--app-font-family);
}

.case-editor-drawer,
.case-editor-drawer * { box-sizing: border-box; }

.case-editor-drawer__mask {
  position: absolute;
  inset: 0;
  background: rgba(29, 33, 41, 0.45);
}

.case-editor-drawer__panel {
  position: relative;
  display: flex;
  width: 680px;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #f4f6fa;
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.14);
}

.case-editor-drawer__header {
  display: flex;
  height: 52px;
  flex: 0 0 52px;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.case-editor-drawer__header strong { color: #1d2129; font-size: 15px; font-weight: 700; line-height: 22px; }
.case-editor-drawer__context { margin-left: auto; color: #c9cdd4; font-size: 11px; line-height: 16.5px; }
.case-editor-drawer__close { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #86909c; cursor: pointer; font-size: 18px; line-height: 1; }
.case-editor-drawer__close:hover { background: #f4f6fa; }

.case-editor-drawer__body { min-height: 0; flex: 1; overflow-y: auto; padding: 16px 20px; }
.case-editor-drawer__section { margin-bottom: 12px; padding: 16px 20px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; }
.case-editor-drawer__section h3 { margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #e5e6eb; color: #1d2129; font-size: 13px; font-weight: 700; line-height: 19.5px; }
.case-editor-drawer__field { display: block; margin-bottom: 14px; color: #4e5969; font-size: 12px; }
.case-editor-drawer__field:last-child { margin-bottom: 0; }
.case-editor-drawer__field > span { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 600; line-height: 18px; }
.case-editor-drawer__field em { margin-left: 2px; color: #f53f3f; font-style: normal; }
.case-editor-drawer__field-error { display: block; margin-top: 4px; color: #f53f3f; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.case-editor-drawer__grid-row { display: flex; gap: 12px; }
.case-editor-drawer__grid-row > .case-editor-drawer__field { flex: 1; }
.case-editor-drawer__input-wrap { position: relative; display: flex; align-items: center; }
.case-editor-drawer__input-wrap input,
.case-editor-drawer__field > select,
.case-editor-drawer__step-row input,
.case-editor-drawer__field textarea { width: 100%; min-height: 34px; padding: 7px 12px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: 0; background: #fff; color: #1d2129; font-size: 13px; line-height: 19.5px; }
.case-editor-drawer__input-wrap input { height: 34px; padding-right: 48px; }
.case-editor-drawer__input-wrap small { position: absolute; right: 10px; color: #c9cdd4; font-size: 11px; }
.case-editor-drawer__input-wrap input:focus,
.case-editor-drawer__field > select:focus,
.case-editor-drawer__step-row input:focus,
.case-editor-drawer__field textarea:focus { border-color: #165dff; box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.08); }
.case-editor-drawer__input-wrap input.is-error,
.case-editor-drawer__step-row input.is-error,
.case-editor-drawer__field textarea.is-error { border-color: #f53f3f; background: #fff8f8; }
.case-editor-drawer__path-button { position: absolute; right: 6px; display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #86909c; cursor: pointer; }
.case-editor-drawer__path-button:hover:not(:disabled) { background: #f7f8fa; color: #165dff; }
.case-editor-drawer__path-button:disabled { color: #c9cdd4; cursor: not-allowed; }
.case-editor-drawer__priority-options { display: flex; gap: 6px; }
.case-editor-drawer__priority-options button { height: 34px; flex: 1; border: 1.5px solid #e5e6eb; border-radius: 8px; background: #fff; color: #86909c; cursor: pointer; font-size: 13px; font-weight: 600; }
.case-editor-drawer__priority-options button.is-active { color: #fff; }
.case-editor-drawer__field textarea { min-height: 72px; resize: vertical; }
.case-editor-drawer__steps { display: flex; flex-direction: column; gap: 6px; }
.case-editor-drawer__step-row { display: flex; align-items: center; gap: 8px; }
.case-editor-drawer__step-row b { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; flex: 0 0 22px; border-radius: 50%; background: #165dff; color: #fff; font-size: 11px; }
.case-editor-drawer__step-row input { min-height: 34px; flex: 1; }
.case-editor-drawer__step-row button { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #c9cdd4; cursor: pointer; font-size: 15px; }
.case-editor-drawer__step-row button:hover { border-color: #f53f3f; color: #f53f3f; }
.case-editor-drawer__add-step { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 4px 0; border: 0; background: transparent; color: #165dff; cursor: pointer; font-size: 12px; }
.case-editor-drawer__error { margin: 0; color: #f53f3f; font-size: 12px; line-height: 18px; }
.case-editor-drawer__footer { display: flex; min-height: 58px; flex: 0 0 58px; align-items: center; gap: 8px; padding: 12px 24px; border-top: 1px solid #e5e6eb; background: #fff; }
.case-editor-drawer__nav { display: inline-flex; align-items: center; gap: 8px; }
.case-editor-drawer__nav > span { color: #86909c; font-size: 12px; }
.case-editor-drawer__footer-error { color: #f53f3f; font-size: 12px; font-weight: 400; line-height: 18px; }
.case-editor-drawer__submit { display: inline-flex; gap: 8px; margin-left: auto; }
.case-editor-drawer__button { height: 32px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; cursor: pointer; font-size: 13px; font-weight: 500; }
.case-editor-drawer__button.is-primary { padding: 0 14px; border-color: #165dff; background: #165dff; color: #fff; }
.case-editor-drawer__button:disabled { cursor: not-allowed; opacity: .55; }

@media (max-width: 720px) {
  .case-editor-drawer__panel { width: 100%; }
  .case-editor-drawer__context { display: none; }
  .case-editor-drawer__grid-row { flex-direction: column; gap: 0; }
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
