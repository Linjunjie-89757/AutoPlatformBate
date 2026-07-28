<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  buildCaseDirectoryOptions,
  buildCaseTreeNodes,
  caseApi,
  collectCaseDirectoryDescendantIds,
  collectCaseTreeDescendantNodeIds,
  collectCaseTreeExpandableNodeIds,
  findCaseTreeNode,
  findCaseTreeParentNode,
  type CaseClientFilter,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
  type CaseTreeNode,
  getCaseWorkspaceNodeId,
} from '@/entities/case'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import { confirmDelete } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import CaseDirectoryTree from '@/widgets/case-directory-tree/CaseDirectoryTree.vue'
import CaseFilterPanel from '@/widgets/case-filter-panel/CaseFilterPanel.vue'
import CaseListPanel from '@/widgets/case-list-panel/CaseListPanel.vue'
import CaseImportDialog from '@/features/case-import/CaseImportDialog.vue'

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')
const workspaceSelectorCode = ref('ALL')
const selectedNodeId = ref('root')
const selectedDirectoryId = ref<number | null>(null)
const expandedTreeKeys = ref<string[]>(['root'])
const treeRenderKey = ref(0)
const directories = ref<CaseDirectoryWorkspace[]>([])
const directoriesLoading = ref(false)
const directoriesErrorMessage = ref('')
const currentPageCases = ref<CaseSummaryItem[]>([])
const caseListRef = ref<InstanceType<typeof CaseListPanel> | null>(null)
const openedCaseDetailQueryKey = ref('')
const importDialogVisible = ref(false)
const moduleDialogVisible = ref(false)
const moduleDialogMode = ref<'create' | 'rename'>('create')
const moduleSaving = ref(false)
const activeDirectoryNode = ref<{
  nodeId: string
  workspaceCode: string
  directoryId: number | null
  label: string
  type?: 'root' | 'workspace' | 'module'
} | null>(null)
const moduleForm = reactive({
  name: '',
})
const moveDialogVisible = ref(false)
const moveTargetDirectoryId = ref<number | null>(null)
const filter = ref<CaseClientFilter>({
  keyword: '',
  priority: '',
  reviewStatus: '',
  executionStatus: '',
  executorName: '',
  createdByName: '',
  workspaceCode: '',
})

const CASE_DIRECTORY_MEMORY_KEY = 'case-management-directory-memory-v1'
let directoryLoadSequence = 0

const workspaceOptions = computed(() => {
  const options = workspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some((item) => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

const businessWorkspaceOptions = computed(() => workspaceOptions.value.filter(item => item.value !== 'ALL'))

const currentPageUserNames = computed(() => {
  const names = new Set<string>()
  currentPageCases.value.forEach((item) => {
    if (item.executorName) {
      names.add(item.executorName)
    }
    if (item.createdByName) {
      names.add(item.createdByName)
    }
  })
  return [...names]
})

const executorOptions = computed(() => currentPageUserNames.value)
const creatorOptions = computed(() => currentPageUserNames.value)
const moduleDialogTitle = computed(() => (moduleDialogMode.value === 'create' ? '新建子模块' : '重命名子模块'))
const currentWorkspaceName = computed(() => {
  const workspace = workspaces.value.find(item => item.workspaceCode === workspaceCode.value)
  return workspace?.workspaceName || workspaceCode.value
})
const currentDirectoryName = computed(() => {
  if (selectedDirectoryId.value === null) {
    return '空间根目录'
  }
  const node = findTreeNode(selectedNodeId.value)
  return node?.label || '空间根目录'
})
const moduleSubmitDisabled = computed(() => !moduleForm.name.trim() || moduleSaving.value)
const moveTargetOptions = computed(() => {
  const node = activeDirectoryNode.value
  if (!node || node.directoryId === null) {
    return []
  }

  const workspace = directories.value.find(item => item.workspaceCode === node.workspaceCode)
  const disabledIds = collectCaseDirectoryDescendantIds(node.directoryId, workspace?.children ?? [])
  disabledIds.add(node.directoryId)

  return [
    { value: null, label: '空间根目录' },
    ...buildCaseDirectoryOptions(workspace?.children ?? [], '', disabledIds),
  ]
})

function resolveMemoryKey(targetWorkspaceCode = workspaceCode.value) {
  return `${CASE_DIRECTORY_MEMORY_KEY}:${targetWorkspaceCode || 'ALL'}`
}

function readDirectoryMemory(targetWorkspaceCode = workspaceCode.value) {
  try {
    const raw = localStorage.getItem(resolveMemoryKey(targetWorkspaceCode))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as {
      workspaceCode?: string
      selectedNodeId?: string
      selectedDirectoryId?: number | null
      expandedTreeKeys?: string[]
    }
    return parsed
  } catch {
    localStorage.removeItem(resolveMemoryKey(targetWorkspaceCode))
    return null
  }
}

function persistDirectoryMemory(targetWorkspaceCode = workspaceCode.value) {
  localStorage.setItem(resolveMemoryKey(targetWorkspaceCode), JSON.stringify({
    workspaceCode: workspaceCode.value,
    selectedNodeId: selectedNodeId.value,
    selectedDirectoryId: selectedDirectoryId.value,
    expandedTreeKeys: expandedTreeKeys.value,
  }))
  localStorage.setItem(`${CASE_DIRECTORY_MEMORY_KEY}:last-workspace`, targetWorkspaceCode || 'ALL')
}

function restoreDirectoryMemory(targetWorkspaceCode = workspaceCode.value) {
  const memory = readDirectoryMemory(targetWorkspaceCode)
  if (!memory) {
    return false
  }

  selectedNodeId.value = memory.selectedNodeId || (targetWorkspaceCode === 'ALL' ? 'root' : getCaseWorkspaceNodeId(targetWorkspaceCode))
  selectedDirectoryId.value = memory.selectedDirectoryId ?? null
  expandedTreeKeys.value = Array.isArray(memory.expandedTreeKeys) && memory.expandedTreeKeys.length
    ? memory.expandedTreeKeys
    : ['root']
  return true
}

function getTreeNodes() {
  return buildCaseTreeNodes(directories.value, workspaceCode.value)
}

function findTreeNode(nodeId: string) {
  return findCaseTreeNode(getTreeNodes(), nodeId)
}

function findParentNode(nodeId: string) {
  return findCaseTreeParentNode(getTreeNodes(), nodeId)
}

function collectExpandableNodeIds(nodes: CaseTreeNode[]) {
  return collectCaseTreeExpandableNodeIds(nodes)
}

function buildWorkspaceDirectoryFallback(targetWorkspaceCode: string): CaseDirectoryWorkspace[] {
  if (targetWorkspaceCode === 'ALL') {
    return workspaces.value
      .filter(item => item.workspaceCode !== 'ALL' && !item.allScope)
      .map(item => ({
        workspaceCode: item.workspaceCode,
        workspaceName: item.workspaceName || item.workspaceCode,
        children: [],
      }))
  }

  const workspace = workspaces.value.find(item => item.workspaceCode === targetWorkspaceCode)
  return workspace
    ? [{
        workspaceCode: workspace.workspaceCode,
        workspaceName: workspace.workspaceName || workspace.workspaceCode,
        children: [],
      }]
    : []
}

function resetDirectorySelectionForWorkspace(targetWorkspaceCode: string) {
  selectedNodeId.value = targetWorkspaceCode === 'ALL' ? 'root' : getCaseWorkspaceNodeId(targetWorkspaceCode)
  selectedDirectoryId.value = null
  expandedTreeKeys.value = ['root', ...(targetWorkspaceCode === 'ALL' ? [] : [getCaseWorkspaceNodeId(targetWorkspaceCode)])]
  treeRenderKey.value += 1
}

function sanitizeExpandedTreeKeys(keys: string[]) {
  const available = new Set(collectExpandableNodeIds(getTreeNodes()))
  const nextKeys = keys.filter(key => available.has(key))
  if (available.has('root') && !nextKeys.includes('root')) {
    nextKeys.unshift('root')
  }
  return nextKeys.length ? nextKeys : ['root']
}

function ensureSelectedNodeExpanded() {
  const keys = new Set(expandedTreeKeys.value)
  let cursor = findParentNode(selectedNodeId.value)
  while (cursor) {
    if (cursor.children.length) {
      keys.add(cursor.id)
    }
    cursor = findParentNode(cursor.id)
  }
  expandedTreeKeys.value = sanitizeExpandedTreeKeys([...keys])
}

function ensureSelectedNodeValid() {
  const selected = findTreeNode(selectedNodeId.value)
  if (selected) {
    selectedDirectoryId.value = selected.type === 'module' ? selected.directoryId : null
    ensureSelectedNodeExpanded()
    return
  }

  const workspaceNode = findTreeNode(getCaseWorkspaceNodeId(workspaceCode.value))
  const fallback = workspaceNode ?? findTreeNode('root')
  selectedNodeId.value = fallback?.id ?? 'root'
  selectedDirectoryId.value = fallback?.type === 'module' ? fallback.directoryId : null
  ensureSelectedNodeExpanded()
}


function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  if (routeWorkspace && (routeWorkspace === 'ALL' || items.some(item => item.workspaceCode === routeWorkspace))) {
    return routeWorkspace
  }

  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some(item => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceReady.value = false
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    workspaceSelectorCode.value = workspaceCode.value
    setSelectedWorkspaceCode(workspaceCode.value)
    restoreDirectoryMemory(workspaceCode.value)
  } catch (error) {
    workspaceCode.value = 'ALL'
    workspaceSelectorCode.value = 'ALL'
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
    workspaceReady.value = true
  }
}

async function loadDirectories() {
  const requestId = ++directoryLoadSequence
  directoriesLoading.value = true
  directoriesErrorMessage.value = ''
  const requestWorkspaceCode = workspaceCode.value
  try {
    const items = await caseApi.getCaseDirectories(requestWorkspaceCode)
    if (requestId !== directoryLoadSequence || requestWorkspaceCode !== workspaceCode.value) {
      return
    }
    directories.value = Array.isArray(items) ? items : []
    ensureSelectedNodeValid()
    expandedTreeKeys.value = sanitizeExpandedTreeKeys(expandedTreeKeys.value)
    treeRenderKey.value += 1
    persistDirectoryMemory()
  } catch (error) {
    if (requestId === directoryLoadSequence) {
      directoriesErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === directoryLoadSequence) {
      directoriesLoading.value = false
    }
  }
}

function handleDirectorySelect(payload: { nodeId: string; workspaceCode: string; directoryId: number | null }) {
  const workspaceChanged = payload.workspaceCode !== workspaceCode.value
  selectedNodeId.value = payload.nodeId
  workspaceCode.value = payload.workspaceCode
  workspaceSelectorCode.value = payload.workspaceCode
  selectedDirectoryId.value = payload.directoryId
  ensureSelectedNodeExpanded()
  persistDirectoryMemory()
  if (workspaceChanged) {
    void loadDirectories()
  }
}

async function handleWorkspaceChange(value: string) {
  persistDirectoryMemory()
  workspaceCode.value = value
  workspaceSelectorCode.value = value
  setSelectedWorkspaceCode(value)
  localStorage.setItem(`${CASE_DIRECTORY_MEMORY_KEY}:last-workspace`, value)
  if (!restoreDirectoryMemory(value)) {
    resetDirectorySelectionForWorkspace(value)
  }
  directories.value = buildWorkspaceDirectoryFallback(value)
  ensureSelectedNodeValid()
  expandedTreeKeys.value = sanitizeExpandedTreeKeys(expandedTreeKeys.value)
  treeRenderKey.value += 1
  if (route.query.workspace !== value) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        workspace: value,
      },
      hash: route.hash,
    })
  }
  void loadDirectories()
}

function openCreateCase() {
  caseListRef.value?.openCreateDialog()
}

function handleImportCases() {
  if (workspaceCode.value === 'ALL') {
    ElMessage.warning('请先选择具体工作空间再导入用例')
    return
  }
  importDialogVisible.value = true
}

function handleCasesImported() {
  caseListRef.value?.reload()
}

function openCreateModule(payload: { nodeId: string; workspaceCode: string; directoryId: number | null; label: string; type: 'root' | 'workspace' | 'module' }) {
  activeDirectoryNode.value = payload
  selectedNodeId.value = payload.nodeId
  moduleDialogMode.value = 'create'
  moduleForm.name = ''
  moduleDialogVisible.value = true
}

function openRenameModule(payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }) {
  activeDirectoryNode.value = {
    ...payload,
    type: 'module',
  }
  selectedNodeId.value = payload.nodeId
  moduleDialogMode.value = 'rename'
  moduleForm.name = payload.label
  moduleDialogVisible.value = true
}

function openMoveModule(payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }) {
  activeDirectoryNode.value = {
    ...payload,
    type: 'module',
  }
  selectedNodeId.value = payload.nodeId
  moveTargetDirectoryId.value = null
  moveDialogVisible.value = true
}

function handleTreeNodeExpand(nodeId: string) {
  if (!expandedTreeKeys.value.includes(nodeId)) {
    expandedTreeKeys.value = sanitizeExpandedTreeKeys([...expandedTreeKeys.value, nodeId])
    persistDirectoryMemory()
  }
}

function handleTreeNodeCollapse(nodeId: string) {
  const node = findTreeNode(nodeId)
  const blockedKeys = new Set([
    nodeId,
    ...(node ? collectCaseTreeDescendantNodeIds(node) : []),
  ])
  expandedTreeKeys.value = sanitizeExpandedTreeKeys(expandedTreeKeys.value.filter(item => !blockedKeys.has(item)))
  persistDirectoryMemory()
}

function expandAllTreeNodes() {
  expandedTreeKeys.value = collectExpandableNodeIds(getTreeNodes())
  treeRenderKey.value += 1
  persistDirectoryMemory()
}

function collapseAllTreeNodes() {
  expandedTreeKeys.value = ['root']
  treeRenderKey.value += 1
  persistDirectoryMemory()
}

async function refreshCasesAfterDirectoryChange() {
  await loadDirectories()
  caseListRef.value?.reload()
}

async function submitModule() {
  const node = activeDirectoryNode.value
  if (!node || moduleSubmitDisabled.value) {
    return
  }

  moduleSaving.value = true
  try {
    if (moduleDialogMode.value === 'rename') {
      if (node.directoryId === null) {
        return
      }
      await caseApi.renameCaseDirectory(node.directoryId, node.workspaceCode, {
        name: moduleForm.name.trim(),
      })
      ElMessage.success('目录已重命名')
    } else {
      await caseApi.createCaseDirectory(node.workspaceCode, {
        workspaceCode: workspaceCode.value === 'ALL' ? node.workspaceCode : undefined,
        parentId: node.type === 'workspace' ? null : node.directoryId,
        name: moduleForm.name.trim(),
      })
      ElMessage.success('子模块已创建')
    }
    moduleDialogVisible.value = false
    if (moduleDialogMode.value === 'create') {
      expandedTreeKeys.value = sanitizeExpandedTreeKeys([...expandedTreeKeys.value, node.nodeId])
    }
    await refreshCasesAfterDirectoryChange()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    moduleSaving.value = false
  }
}

async function submitMoveModule() {
  const node = activeDirectoryNode.value
  if (!node || node.directoryId === null || moduleSaving.value) {
    return
  }

  moduleSaving.value = true
  try {
    await caseApi.moveCaseDirectory(node.directoryId, node.workspaceCode, {
      targetParentId: moveTargetDirectoryId.value,
    })
    ElMessage.success('目录已移动')
    moveDialogVisible.value = false
    selectedNodeId.value = node.nodeId
    selectedDirectoryId.value = node.directoryId
    ensureSelectedNodeExpanded()
    persistDirectoryMemory()
    await refreshCasesAfterDirectoryChange()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    moduleSaving.value = false
  }
}

async function deleteModule(payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }) {
  try {
    await confirmDelete({
      title: '删除模块',
      message: `确认删除模块“${payload.label}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    await caseApi.deleteCaseDirectory(payload.directoryId, payload.workspaceCode)
    if (selectedNodeId.value === payload.nodeId) {
      selectedNodeId.value = `workspace:${payload.workspaceCode}`
      selectedDirectoryId.value = null
    }
    ElMessage.success('子模块已删除')
    await refreshCasesAfterDirectoryChange()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await loadDirectories()
  })()
})

watch(
  selectedWorkspaceCode,
  (value) => {
    if (!workspaceReady.value || !value || value === workspaceCode.value) {
      return
    }
    if (value !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === value)) {
      return
    }
    void handleWorkspaceChange(value)
  },
)

watch(
  () => route.query.workspace,
  (value) => {
    const routeWorkspace = Array.isArray(value) ? value[0] : value
    if (!workspaceReady.value || !routeWorkspace || routeWorkspace === workspaceCode.value) {
      return
    }
    if (routeWorkspace !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === routeWorkspace)) {
      return
    }
    void handleWorkspaceChange(routeWorkspace)
  },
)

watch(
  [() => route.query.caseId, () => route.query.workspace, caseListRef, workspaceCode],
  ([rawCaseId, rawWorkspace, panel, activeWorkspace]) => {
    const caseIdValue = Array.isArray(rawCaseId) ? rawCaseId[0] : rawCaseId
    const routeWorkspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace
    const caseId = Number(caseIdValue)
    if (!panel || !workspaceReady.value || !Number.isFinite(caseId) || caseId <= 0) {
      return
    }
    if (routeWorkspace && routeWorkspace !== activeWorkspace) {
      return
    }

    const queryKey = `${activeWorkspace}:${caseId}`
    if (openedCaseDetailQueryKey.value === queryKey) {
      return
    }
    openedCaseDetailQueryKey.value = queryKey
    panel.openDetailById(caseId)
  },
  { flush: 'post' },
)
</script>

<template>
  <AppPage
    title="用例中心"
    description=""
    fill
  >
    <template #actions>
      <div class="cases-workspace-select">
        <span class="cases-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="cases-workspace-select__control"
          :disabled="workspaceLoading"
          :loading="workspaceLoading"
          size="default"
          @change="handleWorkspaceChange"
        >
          <el-option
            v-for="item in workspaceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="workspaceErrorMessage" class="cases-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="cases-page">
      <CaseDirectoryTree
        :directories="directories"
        :loading="directoriesLoading"
        :selected-node-id="selectedNodeId"
        :current-workspace-code="workspaceCode"
        :expanded-node-ids="expandedTreeKeys"
        :render-key="treeRenderKey"
        @select="handleDirectorySelect"
        @create-child="openCreateModule"
        @rename="openRenameModule"
        @move="openMoveModule"
        @delete="deleteModule"
        @node-expand="handleTreeNodeExpand"
        @node-collapse="handleTreeNodeCollapse"
        @expand-all="expandAllTreeNodes"
        @collapse-all="collapseAllTreeNodes"
      />

      <main class="cases-page__content">
        <AppEmptyState
          v-if="directoriesErrorMessage && !directories.length"
          title="用例目录加载失败"
          :description="directoriesErrorMessage"
        >
          <template #actions>
            <AppButton :icon="RefreshRight" @click="loadDirectories">重试</AppButton>
          </template>
        </AppEmptyState>

        <div v-else class="cases-page__stack">
          <div v-if="directoriesErrorMessage" class="cases-page__inline-error">
            {{ directoriesErrorMessage }}
            <AppButton size="small" :icon="RefreshRight" @click="loadDirectories">重试</AppButton>
          </div>

          <section class="cases-page__workbench">
            <header class="cases-page__toolbar">
              <CaseFilterPanel
                v-model="filter"
                :executor-options="executorOptions"
                :creator-options="creatorOptions"
                :workspace-options="businessWorkspaceOptions"
                :show-workspace-filter="workspaceCode === 'ALL'"
              />
              <div class="cases-page__toolbar-actions">
                <button type="button" class="cases-page__import-button" @click="handleImportCases">
                  <img :src="figmaCaseIcons.import" alt="" />
                  导入
                </button>
                <button type="button" class="cases-page__create-button" @click="openCreateCase">
                  <img :src="figmaCaseIcons.add" alt="" />
                  新增用例
                </button>
              </div>
            </header>

            <CaseListPanel
              ref="caseListRef"
              :workspace-code="workspaceCode"
              :directory-id="selectedDirectoryId"
              :selected-node-id="selectedNodeId"
              :filter="filter"
              :directories="directories"
              :show-toolbar="false"
              @loaded="currentPageCases = $event"
              @reload-directories="loadDirectories"
            />
          </section>
        </div>
      </main>
    </div>

    <el-dialog
      v-model="moduleDialogVisible"
      :title="moduleDialogTitle"
      width="420px"
      append-to-body
    >
      <div class="case-module-dialog">
        <div class="case-module-dialog__meta">
          所属位置：{{ activeDirectoryNode?.label || '-' }}
        </div>
        <label class="case-module-dialog__field">
          <span>模块名称</span>
          <el-input
            v-model="moduleForm.name"
            maxlength="30"
            show-word-limit
            placeholder="请输入模块名称"
            @keydown.enter.prevent="submitModule"
          />
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="moduleSaving" @click="moduleDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="moduleSaving" :disabled="moduleSubmitDisabled" @click="submitModule">
          {{ moduleDialogMode === 'create' ? '创建' : '保存' }}
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="moveDialogVisible"
      title="移动模块"
      width="420px"
      append-to-body
    >
      <div class="case-module-dialog">
        <div class="case-module-dialog__meta">
          当前模块：{{ activeDirectoryNode?.label || '-' }}
        </div>
        <label class="case-module-dialog__field">
          <span>移动到</span>
          <el-select
            v-model="moveTargetDirectoryId"
            class="case-module-dialog__select"
            clearable
            placeholder="请选择目标位置"
          >
            <el-option
              v-for="item in moveTargetOptions"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="moduleSaving" @click="moveDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="moduleSaving" @click="submitMoveModule">保存</AppButton>
      </template>
    </el-dialog>

    <CaseImportDialog
      v-model="importDialogVisible"
      :workspace-code="workspaceCode"
      :workspace-name="currentWorkspaceName"
      :directory-id="selectedDirectoryId"
      :directory-name="currentDirectoryName"
      @imported="handleCasesImported"
    />
  </AppPage>
</template>

<style scoped>
.cases-page {
  display: flex;
  min-height: calc(100dvh - 86px);
  align-items: stretch;
  gap: 0;
  min-width: 0;
  overflow: hidden;
}

.cases-page__content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 17.5px;
  background: var(--app-bg-page);
}

.cases-page__stack {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: 0;
}

.cases-page__workbench {
  min-width: 0;
}

.cases-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 32px;
  margin-bottom: 14px;
}

.cases-page__toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.cases-page__import-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.cases-page__create-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #165dff;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.cases-page__import-button img,
.cases-page__create-button img {
  display: block;
  width: 13px;
  height: 13px;
}

.cases-page__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.cases-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.cases-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.cases-workspace-select__control {
  width: 192px;
}

.cases-workspace-select__error {
  max-width: 180px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-module-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-module-dialog__meta {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-module-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-module-dialog__field span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-module-dialog__select {
  width: 100%;
}

@media (max-width: 900px) {
  .cases-page {
    flex-direction: column;
  }

  .cases-page__content {
    width: 100%;
  }
}

@media (max-width: 1200px) {
  .cases-workspace-select__control {
    width: 168px;
  }
}

@media (max-width: 720px) {
  .cases-workspace-select {
    flex-wrap: wrap;
  }

  .cases-workspace-select__control {
    width: min(240px, 100%);
  }
}

</style>
