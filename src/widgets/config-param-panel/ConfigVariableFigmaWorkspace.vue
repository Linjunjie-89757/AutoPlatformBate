<script setup lang="ts">
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Globe2,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Variable,
  X,
  XCircle,
  Zap,
} from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import { type ParamSetItem } from '@/entities/config'
import {
  createConfigParamFormFromItem,
  type WebUiVariableItem,
} from '@/features/config-param-create-edit'
import { AppFigmaSwitch } from '@/shared/ui'

import ConfigVariableBuiltinPanel from './ConfigVariableBuiltinPanel.vue'
import { useConfigVariableActions } from './useConfigVariableActions'
import { useConfigVariableImport, type ConflictAction } from './useConfigVariableImport'
import { useConfigVariableSetActions } from './useConfigVariableSetActions'
import { useConfigVariableWorkspaceState } from './useConfigVariableWorkspaceState'

const props = defineProps<{
  workspaceCode: string
}>()

type VariableType = NonNullable<WebUiVariableItem['valueType']>
interface VariableTypeOption {
  value: VariableType
  label: string
}

const sidebarKeyword = ref('')
const variableKeyword = ref('')
const typeFilter = ref('ALL')
const statusFilter = ref('ALL')
const setsExpanded = ref(true)

const variableTypeOptions: VariableTypeOption[] = [
  { value: 'TEXT', label: '文本' },
  { value: 'NUMBER', label: '整数' },
  { value: 'BOOLEAN', label: '布尔' },
  { value: 'SECRET', label: '密钥' },
  { value: 'JSON', label: 'JSON' },
]

const variableSetTypeOptions = [
  { value: 'API_VARIABLE_SET', label: '接口自动化' },
  { value: 'WEB_UI_VARIABLE_SET', label: 'Web UI' },
  { value: 'APP_UI_VARIABLE_SET', label: 'APP 自动化' },
  { value: 'BUSINESS', label: '业务公共' },
  { value: 'PAYMENT_CHANNEL', label: '支付渠道' },
]

let resetVariableRevealState = () => {}
const {
  activeForm,
  activeParam,
  activeVariables,
  activeView,
  cloneVariable,
  errorMessage,
  globalParam,
  isBuiltinView,
  isGlobalView,
  loadParams,
  loading,
  persistActive,
  referenceLoading,
  referenceSummary,
  resetWorkspace,
  saving,
  selectGlobalView,
  selectView,
  variableSets,
} = useConfigVariableWorkspaceState({
  afterHydrate: () => resetVariableRevealState(),
  workspaceCode: computed(() => props.workspaceCode),
})

const filteredVariableSets = computed(() => {
  const keyword = sidebarKeyword.value.trim().toLowerCase()
  if (!keyword) return variableSets.value
  return variableSets.value.filter(item => {
    const form = createConfigParamFormFromItem(item)
    return `${item.paramName} ${form.description}`.toLowerCase().includes(keyword)
  })
})

const sensitiveCount = computed(() => activeVariables.value.filter(item => item.sensitive || item.valueType === 'SECRET').length)
const filteredVariables = computed(() => {
  const keyword = variableKeyword.value.trim().toLowerCase()
  return activeVariables.value
    .map((variable, index) => ({ variable, index }))
    .filter(({ variable }) => {
      const matchesKeyword = !keyword || `${variable.name} ${variable.value} ${variable.description}`.toLowerCase().includes(keyword)
      const type = effectiveVariableType(variable)
      const matchesType = typeFilter.value === 'ALL' || type === typeFilter.value
      const matchesStatus = statusFilter.value === 'ALL'
        || (statusFilter.value === 'ENABLED' && variable.enabled !== false)
        || (statusFilter.value === 'DISABLED' && variable.enabled === false)
      return matchesKeyword && matchesType && matchesStatus
    })
})

function effectiveVariableType(variable: WebUiVariableItem): VariableType {
  if (variable.sensitive || variable.valueType === 'SECRET') return 'SECRET'
  return variable.valueType || 'TEXT'
}

function variableTypeLabel(variable: WebUiVariableItem) {
  const type = effectiveVariableType(variable)
  return variableTypeOptions.find(item => item.value === type)?.label || '文本'
}

function variableSetTypeLabel(item: ParamSetItem) {
  return variableSetTypeOptions.find(option => option.value === item.paramType)?.label || '其他'
}

function variableSetForm(item: ParamSetItem) {
  return createConfigParamFormFromItem(item)
}

function variableSetSensitiveCount(item: ParamSetItem) {
  return variableSetForm(item).variables.filter(variable => variable.sensitive || variable.valueType === 'SECRET').length
}

const {
  copyVariable,
  displayedVariableValue,
  editingVariableIndex,
  openAddVariable,
  openEditVariable,
  removeVariable,
  resetRevealedVariables,
  revealedVariables,
  selectVariableType,
  submitVariable,
  toggleReveal,
  toggleVariable,
  variableDialogVisible,
  variableDraft,
  variableError,
} = useConfigVariableActions({
  activeVariables,
  cloneVariable,
  effectiveVariableType,
  persistActive,
})
resetVariableRevealState = () => {
  variableKeyword.value = ''
  typeFilter.value = 'ALL'
  statusFilter.value = 'ALL'
  resetRevealedVariables()
}

const {
  commitImport,
  conflictRows,
  goToConflictStep,
  handleFileChange,
  importConflicts,
  importError,
  importFileName,
  importResult,
  importRows,
  importStep,
  importTitle,
  importVisible,
  openImport,
  setFileInput,
  triggerFileInput,
} = useConfigVariableImport({
  activeVariables,
  cloneVariable,
  isSupportedVariableType: value => variableTypeOptions.some(option => option.value === value),
  persistActive,
  replaceVariables: variables => { activeForm.variables = variables },
})

const {
  confirmDeleteVariableSet,
  deleteSetVisible,
  deletingSet,
  openCreateVariableSet,
  openEditVariableSet,
  submitVariableSet,
  variableSetDialogMode,
  variableSetDialogVisible,
  variableSetDraft,
  variableSetError,
} = useConfigVariableSetActions({
  activeParam,
  cloneVariable,
  loadParams,
  saving,
  selectGlobalView,
  workspaceCode: computed(() => props.workspaceCode),
})

function exportVariables() {
  const data = {
    variableSet: activeParam.value.paramName,
    exportedAt: new Date().toISOString(),
    variables: activeVariables.value,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${activeParam.value.paramName || 'variables'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

onMounted(() => void loadParams())

watch(() => props.workspaceCode, () => {
  void resetWorkspace()
})
</script>

<template>
  <section class="figma-variable">
    <aside class="figma-variable__sidebar">
      <label class="figma-variable__sidebar-search">
        <Search :size="12" />
        <input v-model="sidebarKeyword" type="search" placeholder="搜索">
      </label>

      <nav class="figma-variable__nav" aria-label="变量配置导航">
        <button
          type="button"
          class="figma-variable__nav-global"
          :class="{ 'is-active': isGlobalView }"
          @click="selectView('global')"
        >
          <Globe2 :size="14" />
          <span>全局变量</span>
          <small>{{ globalParam.id < 0 ? 0 : variableSetForm(globalParam).variables.length }}</small>
        </button>

        <section class="figma-variable__sets">
          <header>
            <button type="button" @click="setsExpanded = !setsExpanded">
              <component :is="setsExpanded ? ChevronDown : ChevronRight" :size="11" />
              <span>变量集</span>
              <small>{{ variableSets.length }}</small>
            </button>
            <button type="button" aria-label="新建变量集" @click="openCreateVariableSet">
              <Plus :size="11" />
            </button>
          </header>

          <div v-show="setsExpanded" class="figma-variable__set-list">
            <button
              v-for="item in filteredVariableSets"
              :key="item.id"
              type="button"
              class="figma-variable__set-item"
              :class="{ 'is-active': activeView === item.id }"
              @click="selectView(item.id)"
            >
              <span class="figma-variable__set-icon"><Layers :size="9" /></span>
              <span class="figma-variable__set-copy">
                <strong>{{ item.paramName }}</strong>
                <small>
                  <span>—</span>
                  <em v-if="variableSetSensitiveCount(item)">· {{ variableSetSensitiveCount(item) }} 敏感</em>
                  <em v-else-if="item.status === 0" class="is-disabled">· 停用</em>
                </small>
              </span>
            </button>
            <p v-if="!filteredVariableSets.length" class="figma-variable__set-empty">暂无匹配变量集</p>
          </div>
        </section>

        <div class="figma-variable__builtin-link">
          <button type="button" :class="{ 'is-active': isBuiltinView }" @click="selectView('builtin')">
            <Zap :size="14" />
            <span>内置 &amp; 动态函数</span>
          </button>
        </div>
      </nav>
    </aside>

    <main class="figma-variable__main">
      <div v-if="errorMessage" class="figma-variable__error">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadParams()">重试</button>
      </div>

      <div v-if="loading" class="figma-variable__loading">
        <LoaderCircle :size="24" />
        <span>正在加载变量配置...</span>
      </div>

      <template v-else-if="!isBuiltinView">
        <header v-if="isGlobalView" class="figma-variable__global-head">
          <div class="figma-variable__title-block">
            <h2>全局变量</h2>
            <p>工作区级别共享变量，所有测试环境和场景均可引用，优先级最低</p>
          </div>
          <div class="figma-variable__head-actions">
            <button type="button" class="figma-variable__button" @click="exportVariables"><Download :size="13" />导出</button>
            <button type="button" class="figma-variable__button" @click="openImport"><Upload :size="13" />导入</button>
            <button type="button" class="figma-variable__button is-primary" @click="openAddVariable"><Plus :size="13" />添加变量</button>
          </div>
          <div class="figma-variable__filters">
            <label><Search :size="12" /><input v-model="variableKeyword" type="search" placeholder="搜索变量名或描述"></label>
            <select v-model="typeFilter">
              <option value="ALL">全部类型</option>
              <option v-for="item in variableTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <select v-model="statusFilter">
              <option value="ALL">全部状态</option>
              <option value="ENABLED">已启用</option>
              <option value="DISABLED">已停用</option>
            </select>
            <p>共 {{ activeVariables.length }} 个变量，其中 {{ sensitiveCount }} 个敏感</p>
          </div>
        </header>

        <header v-else class="figma-variable__set-head">
          <div class="figma-variable__set-heading">
            <span class="figma-variable__set-heading-icon"><Layers :size="20" /></span>
            <div>
              <div class="figma-variable__set-title-row">
                <h2>{{ activeParam.paramName }}</h2>
                <span>{{ variableSetTypeLabel(activeParam) }}</span>
                <span v-if="activeParam.status === 0" class="is-disabled">已停用</span>
              </div>
              <p>
                <span>{{ activeForm.description || '暂无变量集说明' }}</span>
                <i>·</i><span>{{ activeVariables.length }} 个变量</span>
                <template v-if="sensitiveCount"><i>·</i><span class="is-danger">{{ sensitiveCount }} 个敏感</span></template>
                <i>·</i><span>{{ referenceLoading ? '正在加载引用' : `引用 ${referenceSummary?.totalCount || 0} 个环境` }}</span>
                <i>·</i><span>最近更新：—</span>
              </p>
            </div>
          </div>
          <div class="figma-variable__head-actions">
            <button type="button" class="figma-variable__button" @click="exportVariables"><Download :size="13" />导出</button>
            <button type="button" class="figma-variable__button" @click="openEditVariableSet"><Pencil :size="13" />编辑</button>
            <button type="button" class="figma-variable__icon-button is-danger" aria-label="删除变量集" @click="deleteSetVisible = true"><Trash2 :size="13" /></button>
            <button type="button" class="figma-variable__button is-primary" @click="openAddVariable"><Plus :size="13" />添加变量</button>
          </div>
          <div class="figma-variable__filters">
            <label><Search :size="12" /><input v-model="variableKeyword" type="search" placeholder="搜索变量名"></label>
            <select v-model="typeFilter">
              <option value="ALL">全部类型</option>
              <option v-for="item in variableTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <select v-model="statusFilter">
              <option value="ALL">全部状态</option>
              <option value="ENABLED">已启用</option>
              <option value="DISABLED">已停用</option>
            </select>
          </div>
        </header>

        <div class="figma-variable__table-wrap" :class="{ 'is-empty': !filteredVariables.length }">
          <table v-if="filteredVariables.length" class="figma-variable__table">
            <colgroup>
              <col class="is-name"><col class="is-value"><col class="is-type"><col class="is-description"><col class="is-status"><col v-if="isGlobalView" class="is-updated"><col class="is-actions">
            </colgroup>
            <thead>
              <tr>
                <th>变量名</th><th>值</th><th>类型</th><th>说明</th><th>状态</th><th v-if="isGlobalView">更新</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredVariables" :key="`${row.variable.name}-${row.index}`">
                <td>
                  <span class="figma-variable__name" :class="{ 'is-secret': effectiveVariableType(row.variable) === 'SECRET' }">
                    <LockKeyhole v-if="effectiveVariableType(row.variable) === 'SECRET'" :size="11" />
                    {{ row.variable.name }}
                  </span>
                </td>
                <td>
                  <span class="figma-variable__value">
                    {{ displayedVariableValue(row.variable) }}
                    <button v-if="effectiveVariableType(row.variable) === 'SECRET'" type="button" @click="toggleReveal(row.variable)">
                      <component :is="revealedVariables.has(row.variable.name) ? EyeOff : Eye" :size="11" />
                    </button>
                  </span>
                </td>
                <td><span class="figma-variable__type" :class="`is-${effectiveVariableType(row.variable).toLowerCase()}`">{{ variableTypeLabel(row.variable) }}</span></td>
                <td><span class="figma-variable__description">{{ row.variable.description || '—' }}</span></td>
                <td>
                  <AppFigmaSwitch :model-value="row.variable.enabled !== false" size="regular" :disabled="saving" :label="row.variable.enabled === false ? '启用变量' : '停用变量'" @update:model-value="toggleVariable(row.index)" />
                </td>
                <td v-if="isGlobalView"><span class="figma-variable__updated">—<small>暂无记录</small></span></td>
                <td>
                  <div class="figma-variable__row-actions">
                    <button type="button" aria-label="编辑变量" @click="openEditVariable(row.index)"><Pencil :size="13" /></button>
                    <button v-if="!isGlobalView" type="button" aria-label="复制变量" @click="copyVariable(row.index)"><Copy :size="13" /></button>
                    <button type="button" aria-label="删除变量" @click="removeVariable(row.index)"><Trash2 :size="13" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="figma-variable__empty">
            <Variable :size="36" />
            <p>{{ activeVariables.length ? '未找到匹配的变量' : (isGlobalView ? '暂无变量，点击「添加变量」创建第一个变量' : '此变量集暂无变量') }}</p>
          </div>

          <footer v-if="filteredVariables.length" class="figma-variable__pagination">
            <span>共 {{ filteredVariables.length }} 条</span>
            <button type="button">1</button>
          </footer>
        </div>
      </template>

      <ConfigVariableBuiltinPanel v-else />
    </main>

    <Teleport to="body">
      <div v-if="variableDialogVisible" class="figma-variable-modal" @mousedown.self="variableDialogVisible = false">
        <section class="figma-variable-modal__card is-variable" role="dialog" aria-modal="true">
          <header><h3>{{ editingVariableIndex >= 0 ? '编辑变量' : '添加变量' }}</h3><button type="button" @click="variableDialogVisible = false"><X :size="16" /></button></header>
          <div class="figma-variable-modal__body">
            <label class="figma-variable-modal__field"><span>变量名 <em>*</em></span><input v-model="variableDraft.name" placeholder="例：API_BASE_URL（仅大写字母、数字、下划线）"></label>
            <div class="figma-variable-modal__variable-options">
              <div class="figma-variable-modal__option-column">
                <span>类型</span>
                <div class="figma-variable-modal__type-options">
                  <button v-for="item in variableTypeOptions" :key="item.value" type="button" :class="{ 'is-active': effectiveVariableType(variableDraft) === item.value }" @click="selectVariableType(item.value)">{{ item.label }}</button>
                </div>
              </div>
              <div class="figma-variable-modal__option-column is-sensitive">
                <span>敏感变量</span>
                <div><AppFigmaSwitch v-model="variableDraft.sensitive" size="regular" label="敏感变量" /><small>{{ variableDraft.sensitive ? '值将在界面上隐藏显示' : '值明文可见' }}</small></div>
              </div>
            </div>
            <label class="figma-variable-modal__field"><span>值 <em>*</em></span><textarea v-if="effectiveVariableType(variableDraft) === 'JSON'" v-model="variableDraft.value" rows="5" placeholder="请输入 JSON"></textarea><input v-else v-model="variableDraft.value" :type="variableDraft.sensitive ? 'password' : 'text'" placeholder="变量值"></label>
            <label class="figma-variable-modal__field"><span>说明</span><input v-model="variableDraft.description" placeholder="描述该变量的用途、注意事项"></label>
            <div class="figma-variable-modal__enabled"><span>是否启用</span><AppFigmaSwitch :model-value="variableDraft.enabled !== false" size="regular" label="是否启用" @update:model-value="variableDraft.enabled = $event" /><small>{{ variableDraft.enabled === false ? '已停用' : '已启用' }}</small></div>
            <div v-if="variableDraft.sensitive" class="figma-variable-modal__warning"><AlertTriangle :size="13" /><span>敏感变量保存后，值将不再以明文展示。如需修改请重新输入。</span></div>
            <p v-if="variableError" class="figma-variable-modal__error">{{ variableError }}</p>
          </div>
          <footer><button type="button" @click="variableDialogVisible = false">取消</button><button type="button" class="is-primary" :disabled="saving" @click="submitVariable">{{ saving ? '保存中...' : '保存变量' }}</button></footer>
        </section>
      </div>

      <div v-if="variableSetDialogVisible" class="figma-variable-modal" @mousedown.self="variableSetDialogVisible = false">
        <section class="figma-variable-modal__card is-set" role="dialog" aria-modal="true">
          <header><h3>{{ variableSetDialogMode === 'create' ? '创建变量集' : '编辑变量集' }}</h3><button type="button" @click="variableSetDialogVisible = false"><X :size="16" /></button></header>
          <div class="figma-variable-modal__body">
            <label class="figma-variable-modal__field"><span>变量集名称 <em>*</em></span><input v-model="variableSetDraft.paramName" placeholder="请输入变量集名称"></label>
            <div class="figma-variable-modal__field"><span>适用范围</span><div class="figma-variable-modal__scope-options"><button v-for="item in variableSetTypeOptions" :key="item.value" type="button" :class="{ 'is-active': variableSetDraft.paramType === item.value }" @click="variableSetDraft.paramType = item.value">{{ item.label }}</button></div></div>
            <label class="figma-variable-modal__field"><span>描述</span><textarea v-model="variableSetDraft.description" rows="4" placeholder="说明变量集的用途和包含内容"></textarea></label>
            <div class="figma-variable-modal__enabled"><span>是否启用</span><AppFigmaSwitch :model-value="variableSetDraft.status === 1" size="regular" label="是否启用" @update:model-value="variableSetDraft.status = $event ? 1 : 0" /><small>{{ variableSetDraft.status === 1 ? '已启用' : '已停用' }}</small></div>
            <p v-if="variableSetError" class="figma-variable-modal__error">{{ variableSetError }}</p>
          </div>
          <footer><button type="button" @click="variableSetDialogVisible = false">取消</button><button type="button" class="is-primary" :disabled="saving" @click="submitVariableSet">{{ saving ? '保存中...' : (variableSetDialogMode === 'create' ? '创建变量集' : '保存更改') }}</button></footer>
        </section>
      </div>

      <div v-if="deleteSetVisible" class="figma-variable-modal" @mousedown.self="deleteSetVisible = false">
        <section class="figma-variable-modal__card is-delete" role="alertdialog" aria-modal="true">
          <header><h3>删除变量集</h3><button type="button" @click="deleteSetVisible = false"><X :size="16" /></button></header>
          <div class="figma-variable-modal__body">
            <div class="figma-variable-modal__danger-box">
              <AlertTriangle :size="18" />
              <div><strong>确认删除变量集「{{ activeParam.paramName }}」？</strong><p v-if="(referenceSummary?.totalCount || 0) > 0">该变量集已绑定到 {{ referenceSummary?.totalCount || 0 }} 个环境，删除后这些环境将无法使用此变量集。</p><span>此操作不可恢复。</span></div>
            </div>
          </div>
          <footer><button type="button" @click="deleteSetVisible = false">取消</button><button type="button" class="is-danger" :disabled="deletingSet" @click="confirmDeleteVariableSet">{{ deletingSet ? '删除中...' : '确认删除' }}</button></footer>
        </section>
      </div>

      <div v-if="importVisible" class="figma-variable-modal" @mousedown.self="importVisible = false">
        <section class="figma-variable-modal__card is-import" role="dialog" aria-modal="true">
          <header><h3>{{ importTitle }}</h3><button type="button" @click="importVisible = false"><X :size="16" /></button></header>
          <div class="figma-variable-import__steps">
            <template v-for="step in 5" :key="step">
              <div class="figma-variable-import__step" :class="{ 'is-active': importStep === step, 'is-done': importStep > step }">
                <span><Check v-if="importStep > step" :size="12" /><template v-else>{{ step }}</template></span>
                <small>{{ ['选择文件', '格式校验', '导入预览', '冲突处理', '导入完成'][step - 1] }}</small>
              </div>
              <i v-if="step < 5" :class="{ 'is-done': importStep > step }" />
            </template>
          </div>

          <div v-if="importStep === 1" class="figma-variable-import__choose">
            <button type="button" class="figma-variable-import__drop" @click="triggerFileInput">
              <FileUp :size="32" />
              <strong>拖放 JSON/YAML/CSV 文件到此处，或点击选择文件</strong>
              <span>支持 .json、.yaml、.yml、.csv 格式，最大 2MB</span>
            </button>
            <button type="button" class="figma-variable__button" @click="triggerFileInput"><Upload :size="13" />{{ importFileName || '选择文件' }}</button>
            <input :ref="setFileInput" type="file" accept=".json,.yaml,.yml,.csv" hidden @change="handleFileChange">
            <p v-if="importError" class="figma-variable-modal__error">{{ importError }}</p>
          </div>

          <div v-else-if="importStep === 2" class="figma-variable-import__validating"><span class="figma-variable-import__spinner" aria-hidden="true" /><p>正在校验文件格式...</p></div>

          <div v-else-if="importStep === 3" class="figma-variable-import__preview">
            <div class="figma-variable-import__notice"><CheckCircle2 :size="16" /><span>检测到 {{ importRows.length }} 个变量，其中 {{ conflictRows.length }} 个变量名与现有变量重复</span></div>
            <div class="figma-variable-import__table">
              <div class="is-head"><span>变量名</span><span>类型</span><span>操作</span></div>
              <div v-for="row in importRows" :key="row.name"><strong>{{ row.name }}</strong><span>{{ variableTypeLabel(row) }}</span><em :class="{ 'is-conflict': conflictRows.some(item => item.name === row.name) }">{{ conflictRows.some(item => item.name === row.name) ? '冲突' : '新增' }}</em></div>
            </div>
            <div class="figma-variable-import__actions"><button type="button" class="is-primary" :disabled="saving" @click="goToConflictStep">{{ conflictRows.length ? '下一步：处理冲突' : '确认导入' }}</button></div>
          </div>

          <div v-else-if="importStep === 4" class="figma-variable-import__conflicts">
            <p>以下变量与现有变量同名，请选择处理方式：</p>
            <article v-for="row in conflictRows" :key="row.name">
              <header><strong>{{ row.name }}</strong><span>冲突</span></header>
              <div><button v-for="option in [{ value: 'skip', label: '跳过（保留现有）' }, { value: 'overwrite', label: '覆盖（使用导入值）' }, { value: 'rename', label: '重命名（追加 _IMPORT 后缀）' }]" :key="option.value" type="button" :class="{ 'is-active': importConflicts[row.name] === option.value }" @click="importConflicts[row.name] = option.value as ConflictAction">{{ option.label }}</button></div>
            </article>
            <div class="figma-variable-import__actions"><button type="button" @click="importStep = 3">上一步</button><button type="button" class="is-primary" :disabled="saving" @click="commitImport">{{ saving ? '导入中...' : '确认导入' }}</button></div>
          </div>

          <div v-else class="figma-variable-import__complete">
            <div class="figma-variable-import__complete-head"><CheckCircle2 :size="40" /><strong>导入完成</strong></div>
            <div class="figma-variable-import__complete-results">
              <p class="is-success"><CheckCircle2 :size="14" />成功新增 {{ importResult.added }} 个变量</p>
              <p v-if="importResult.overwritten" class="is-overwritten"><CheckCircle2 :size="14" />覆盖更新 {{ importResult.overwritten }} 个变量</p>
              <p><XCircle :size="14" />跳过 {{ importResult.skipped }} 个变量</p>
            </div>
            <div class="figma-variable-import__actions"><button type="button" class="is-primary" @click="importVisible = false">完成</button></div>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.figma-variable {
  --variable-primary: #165dff;
  --variable-success: #00b42a;
  --variable-warning: #ff7d00;
  --variable-danger: #f53f3f;
  --variable-purple: #7816ff;
  --variable-cyan: #0fc6c2;
  display: flex;
  overflow: hidden;
  height: calc(100dvh - 128px);
  min-width: 0;
  min-height: 438px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #f4f6fa;
  color: #1d2129;
}

button, input, select, textarea { font: inherit; }
button { cursor: pointer; }

.figma-variable__sidebar {
  display: flex;
  overflow: hidden;
  width: 240px;
  flex: 0 0 240px;
  flex-direction: column;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.figma-variable__sidebar-search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 14px 10.5px 7px;
  color: #86909c;
}

.figma-variable__sidebar-search svg { position: absolute; left: 8.75px; pointer-events: none; }
.figma-variable__sidebar-search input {
  width: 100%; height: 28px; padding: 0 10px 0 28px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; color: #1d2129; font-size: 13px;
}
.figma-variable__sidebar-search input:focus { border-color: var(--variable-primary); box-shadow: 0 0 0 2px rgba(22, 93, 255, .08); }

.figma-variable__nav { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 3.5px 7px; }
.figma-variable__nav button { border: 0; background: transparent; color: #4e5969; }
.figma-variable__nav-global {
  display: flex; width: 100%; height: 34px; align-items: center; gap: 7px; padding: 0 10.5px; border-radius: 7px !important; font-size: 13px; font-weight: 500; text-align: left;
}
.figma-variable__nav-global span { flex: 1; }
.figma-variable__nav-global small { color: #c9cdd4; font-size: 11px; }
.figma-variable__nav-global.is-active { background: rgba(22, 93, 255, .06); color: var(--variable-primary); }

.figma-variable__sets { display: flex; min-height: 0; flex: 1; flex-direction: column; padding-top: 3.5px; }
.figma-variable__sets > header { display: flex; height: 28px; align-items: center; padding: 0 7px; }
.figma-variable__sets > header button:first-child { display: flex; flex: 1; align-items: center; gap: 3.5px; padding: 0; color: #c9cdd4; }
.figma-variable__sets > header button:first-child span { font-size: 11px; font-weight: 600; letter-spacing: .275px; text-transform: uppercase; }
.figma-variable__sets > header button:first-child small { font-size: 11px; font-weight: 500; }
.figma-variable__sets > header button:last-child { display: grid; width: 17.5px; height: 17.5px; place-items: center; border-radius: 3.5px; }
.figma-variable__sets > header button:last-child:hover { background: #f2f3f5; color: var(--variable-primary); }
.figma-variable__set-list { display: grid; overflow-y: auto; min-height: 0; align-content: start; gap: 1.75px; padding-top: 3.5px; scrollbar-color: #c9cdd4 transparent; scrollbar-width: thin; }
.figma-variable__set-item { display: flex; width: 100%; min-height: 52px; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px !important; text-align: left; }
.figma-variable__set-item:hover { background: #f4f6fa; }
.figma-variable__set-item.is-active { background: rgba(22, 93, 255, .06); }
.figma-variable__set-icon { display: grid; width: 16px; height: 16px; flex: 0 0 auto; place-items: center; border-radius: 4px; background: #e5e6eb; color: #86909c; }
.figma-variable__set-item.is-active .figma-variable__set-icon { background: var(--variable-primary); color: #fff; }
.figma-variable__set-copy { display: grid; min-width: 0; gap: 1px; }
.figma-variable__set-copy strong { overflow: hidden; color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.figma-variable__set-item.is-active .figma-variable__set-copy strong { color: var(--variable-primary); }
.figma-variable__set-copy small { color: #c9cdd4; font-size: 10px; font-style: normal; line-height: 15px; }
.figma-variable__set-copy em { color: var(--variable-danger); font-style: normal; }
.figma-variable__set-copy em.is-disabled { color: #c9cdd4; }
.figma-variable__set-empty { margin: 10px; color: #c9cdd4; font-size: 11px; text-align: center; }
.figma-variable__builtin-link { flex: 0 0 auto; margin-top: 7px; padding-top: 7px; border-top: 1px solid #e5e6eb; }
.figma-variable__builtin-link button { display: flex; width: 100%; height: 34px; align-items: center; gap: 7px; padding: 0 10.5px; border-radius: 7px; font-size: 13px; font-weight: 500; }
.figma-variable__builtin-link button:hover { background: #f4f6fa; }
.figma-variable__builtin-link button.is-active { background: rgba(120, 22, 255, .06); color: var(--variable-purple); }

.figma-variable__main { overflow: auto; min-width: 0; flex: 1; }
.figma-variable__error { display: flex; align-items: center; justify-content: space-between; margin: 12px 17.5px; padding: 8px 10px; border: 1px solid #ffb4b4; border-radius: 7px; background: #ffe8e8; color: #c92a2a; font-size: 12px; }
.figma-variable__error button { border: 0; background: transparent; color: inherit; font-weight: 600; }
.figma-variable__loading { display: flex; min-height: 300px; align-items: center; justify-content: center; gap: 8px; color: #86909c; font-size: 13px; }
.figma-variable__loading svg { animation: figma-variable-spin 1s linear infinite; }

.figma-variable__global-head, .figma-variable__set-head { display: grid; grid-template-columns: 1fr auto; gap: 10.5px; padding: 17.5px 17.5px 10.5px; border-bottom: 1px solid transparent; background: transparent; }
.figma-variable__set-head { border-bottom-color: #e5e6eb; background: #fff; }
.figma-variable__title-block h2, .figma-variable__set-title-row h2 { margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.figma-variable__title-block p { margin: 1.75px 0 0; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-variable__head-actions { display: flex; align-items: flex-start; gap: 8px; }
.figma-variable__button { display: inline-flex; height: 32px; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; font-size: 13px; font-weight: 500; transition: border-color 150ms, color 150ms, filter 150ms, transform 150ms; }
.figma-variable__button:not(.is-primary):hover:not(:disabled) { border-color: #b8c9ef; color: var(--variable-primary); }
.figma-variable__button.is-primary { height: 32px; padding: 0 14px; border-color: var(--variable-primary); background: var(--variable-primary); color: #fff; }
.figma-variable__button.is-primary:hover:not(:disabled) { color: #fff; filter: brightness(1.1); }
.figma-variable__button.is-primary:active:not(:disabled) { transform: scale(.98); }
.figma-variable__icon-button { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 6px; background: transparent; color: #86909c; }
.figma-variable__icon-button:hover { background: #f2f3f5; }
.figma-variable__icon-button.is-danger:hover { background: #ffe8e8; color: var(--variable-danger); }

.figma-variable__filters { display: flex; grid-column: 1 / -1; align-items: center; gap: 7px; padding-top: 10.5px; }
.figma-variable__filters label { position: relative; display: flex; align-items: center; color: #86909c; }
.figma-variable__filters label svg { position: absolute; left: 8.75px; pointer-events: none; }
.figma-variable__filters input { width: 220px; height: 28px; padding: 0 10.5px 0 28px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; color: #1d2129; font-size: 13px; }
.figma-variable__filters select { width: 110px; height: 28px; padding: 0 26px 0 12px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; background: #fff; color: #1d2129; font-size: 13px; }
.figma-variable__filters select:nth-of-type(2) { width: 100px; }
.figma-variable__filters p { margin: 0 0 0 auto; color: #86909c; font-size: 12px; }

.figma-variable__set-heading { display: flex; min-width: 0; align-items: flex-start; gap: 14px; }
.figma-variable__set-heading-icon { display: grid; width: 35px; height: 35px; flex: 0 0 auto; place-items: center; border-radius: 11px; background: rgba(22, 93, 255, .07); color: var(--variable-primary); }
.figma-variable__set-title-row { display: flex; align-items: center; gap: 8.75px; }
.figma-variable__set-title-row h2 { font-size: 16px; font-weight: 700; line-height: 24px; }
.figma-variable__set-title-row > span { padding: 1.75px 7px; border-radius: 999px; background: #f2f3f5; color: #86909c; font-size: 11px; line-height: 16.5px; }
.figma-variable__set-title-row > span.is-disabled { background: #ffe8e8; color: var(--variable-danger); }
.figma-variable__set-heading p { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 3.5px 0 0; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-variable__set-heading p i { color: #c9cdd4; font-style: normal; }
.figma-variable__set-heading p .is-danger { color: var(--variable-danger); }

.figma-variable__table-wrap { margin: 0 17.5px 17.5px; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
.figma-variable__table-wrap.is-empty { border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.figma-variable__set-head + .figma-variable__table-wrap { margin-top: 17.5px; }
.figma-variable__table { width: 100%; min-width: 980px; border-collapse: collapse; table-layout: fixed; }
.figma-variable__table col.is-name { width: 24%; }
.figma-variable__table col.is-value { width: 22%; }
.figma-variable__table col.is-type { width: 8%; }
.figma-variable__table col.is-description { width: 22%; }
.figma-variable__table col.is-status { width: 6%; }
.figma-variable__table col.is-updated { width: 12%; }
.figma-variable__table col.is-actions { width: 72px; }
.figma-variable__table th { height: 34.5px; padding: 0 14px; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; letter-spacing: .275px; text-align: left; text-transform: uppercase; }
.figma-variable__table th:last-child { text-align: right; }
.figma-variable__table td { height: 46.5px; padding: 0 14px; border-top: 1px solid #e5e6eb; color: #4e5969; font-size: 12px; }
.figma-variable__name { display: inline-flex; align-items: center; gap: 7px; color: #1d2129; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; font-weight: 600; }
.figma-variable__name.is-secret { color: #1d2129; }
.figma-variable__name.is-secret svg { color: var(--variable-danger); }
.figma-variable__value { display: flex; min-width: 0; align-items: center; gap: 5.25px; overflow: hidden; font-family: 'JetBrains Mono', Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
.figma-variable__value button { display: grid; width: 17.5px; height: 17.5px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 3.5px; background: transparent; color: #c9cdd4; }
.figma-variable__type { display: inline-flex; padding: .5px 5.25px; border-radius: 3.5px; font-size: 11px; font-weight: 600; line-height: 16.5px; }
.figma-variable__type.is-text { background: #e8f3ff; color: var(--variable-primary); }
.figma-variable__type.is-number { background: #e8fffe; color: var(--variable-cyan); }
.figma-variable__type.is-boolean { background: #f5e8ff; color: var(--variable-purple); }
.figma-variable__type.is-secret { background: #ffe8e8; color: var(--variable-danger); }
.figma-variable__type.is-json { background: #fff3e8; color: var(--variable-warning); }
.figma-variable__description { display: block; overflow: hidden; color: #86909c; text-overflow: ellipsis; white-space: nowrap; }
.figma-variable__updated { display: grid; color: #86909c; font-size: 11px; line-height: 16.5px; }
.figma-variable__updated small { color: #c9cdd4; font-size: 10px; line-height: 15px; }
.figma-variable__row-actions { display: flex; justify-content: flex-end; }
.figma-variable__row-actions button { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 6px; background: transparent; color: #c9cdd4; }
.figma-variable__row-actions button:hover { background: #f2f3f5; color: var(--variable-primary); }
.figma-variable__row-actions button:last-child:hover { color: var(--variable-danger); }
.figma-variable__pagination { display: flex; height: 43px; align-items: center; justify-content: space-between; padding: 0 14px; border-top: 1px solid #e5e6eb; color: #86909c; font-size: 12px; }
.figma-variable__pagination button { width: 24.5px; height: 24.5px; border: 1px solid var(--variable-primary); border-radius: 5px; background: var(--variable-primary); color: #fff; font-size: 12px; }
.figma-variable__empty { display: flex; min-height: 250px; align-items: center; justify-content: center; flex-direction: column; gap: 10.5px; color: #c9cdd4; }
.figma-variable__empty p { margin: 0; color: #86909c; font-size: 13px; }

@keyframes figma-variable-spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .figma-variable__sidebar { width: 220px; flex-basis: 220px; }
  .figma-variable__set-heading p span:first-child { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .figma-variable__filters p { display: none; }
}
</style>

<style>
.figma-variable-modal { --variable-primary: #165dff; position: fixed; z-index: 3200; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0, 0, 0, .35); color: #1d2129; }
.figma-variable-modal__card { display: flex; overflow: hidden; width: 520px; max-width: calc(100vw - 48px); max-height: min(85vh, calc(100vh - 48px)); flex-direction: column; border-radius: 16px; background: #fff; box-shadow: 0 24px 80px rgba(0, 0, 0, .2); }
.figma-variable-modal__card.is-set { width: 480px; }
.figma-variable-modal__card.is-delete { width: 420px; }
.figma-variable-modal__card.is-import { width: 580px; }
.figma-variable-modal__card > header { display: flex; min-height: 54.5px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid #e5e6eb; }
.figma-variable-modal__card > header h3 { margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.figma-variable-modal__card > header button { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #c9cdd4; }
.figma-variable-modal__body { display: grid; overflow: auto; gap: 16px; padding: 20px 24px; }
.figma-variable-modal__field { display: grid; gap: 6px; color: #4e5969; font-size: 12px; }
.figma-variable-modal__field > span, .figma-variable-modal__option-column > span { color: #4e5969; font-size: 12px; font-weight: 500; }
.figma-variable-modal__field em { color: #f53f3f; font-style: normal; }
.figma-variable-modal__field input, .figma-variable-modal__field textarea { width: 100%; min-height: 32px; padding: 6px 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; color: #1d2129; font-size: 13px; resize: vertical; }
.figma-variable-modal__field input:focus, .figma-variable-modal__field textarea:focus { border-color: #165dff; box-shadow: 0 0 0 2px rgba(22, 93, 255, .08); }
.figma-variable-modal__variable-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.figma-variable-modal__option-column { display: grid; align-content: start; gap: 6px; }
.figma-variable-modal__option-column.is-sensitive { gap: 8px; }
.figma-variable-modal__option-column.is-sensitive > div { display: flex; align-items: center; gap: 8px; }
.figma-variable-modal__option-column small, .figma-variable-modal__enabled small { color: #86909c; font-size: 12px; }
.figma-variable-modal__type-options, .figma-variable-modal__scope-options { display: flex; flex-wrap: wrap; gap: 7px; }
.figma-variable-modal__type-options button { min-height: 26px; padding: 4px 10px; border: 1.5px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; font-size: 11px; font-weight: 600; }
.figma-variable-modal__scope-options button { min-height: 28px; padding: 6px 12px; border: 1.5px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; font-size: 12px; font-weight: 500; }
.figma-variable-modal__type-options button.is-active, .figma-variable-modal__scope-options button.is-active { border-color: #165dff; background: rgba(22, 93, 255, .03); color: #165dff; }
.figma-variable-modal__enabled { display: flex; align-items: center; gap: 7px; color: #4e5969; font-size: 12px; }
.figma-variable-modal__warning { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid #ffd595; border-radius: 7px; background: #fff3e8; color: #ff7d00; font-size: 12px; line-height: 18px; }
.figma-variable-modal__warning svg { flex: 0 0 auto; margin-top: 1px; }
.figma-variable-modal__error { margin: 0; color: #f53f3f; font-size: 11px; line-height: 16.5px; }
.figma-variable-modal__card > footer { display: flex; min-height: 64px; flex: 0 0 auto; align-items: center; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid #e5e6eb; background: #fafafa; }
.figma-variable-modal__card > footer button, .figma-variable-import__actions button { height: 32px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; font-size: 13px; font-weight: 500; transition: border-color 150ms, color 150ms, filter 150ms, transform 150ms; }
.figma-variable-modal__card > footer button.is-primary, .figma-variable-import__actions button.is-primary { height: 32px; padding: 0 14px; border-color: #165dff; background: #165dff; color: #fff; }
.figma-variable-modal__card > footer button.is-danger { height: 32px; padding: 0 14px; border-color: #f53f3f; background: #f53f3f; color: #fff; }
.figma-variable-modal__card > footer button:not(.is-primary):not(.is-danger):hover:not(:disabled), .figma-variable-import__actions button:not(.is-primary):hover:not(:disabled) { border-color: #b8c9ef; color: #165dff; }
.figma-variable-modal__card > footer button.is-primary:hover:not(:disabled), .figma-variable-modal__card > footer button.is-danger:hover:not(:disabled), .figma-variable-import__actions button.is-primary:hover:not(:disabled) { color: #fff; filter: brightness(1.1); }
.figma-variable-modal__card > footer button.is-primary:active:not(:disabled), .figma-variable-modal__card > footer button.is-danger:active:not(:disabled), .figma-variable-import__actions button.is-primary:active:not(:disabled) { transform: scale(.98); }
.figma-variable-modal__card button:disabled { cursor: not-allowed; opacity: .55; }
.figma-variable-modal__danger-box { display: flex; gap: 12px; padding: 16px; border: 1px solid rgba(245, 63, 63, .25); border-radius: 12px; background: #ffe8e8; color: #f53f3f; }
.figma-variable-modal__danger-box > svg { flex: 0 0 auto; margin-top: 2px; }
.figma-variable-modal__danger-box strong { color: #1d2129; font-size: 13px; font-weight: 500; }
.figma-variable-modal__danger-box p { margin: 4px 0 0; color: #f53f3f; font-size: 12px; line-height: 18px; }
.figma-variable-modal__danger-box span { display: block; margin-top: 4px; color: #4e5969; font-size: 12px; line-height: 18px; }

.figma-variable-import__steps { display: flex; min-height: 67px; flex: 0 0 auto; align-items: flex-start; padding: 12px 24px 0; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.figma-variable-import__step { display: flex; width: 48px; flex: 0 0 48px; align-items: center; flex-direction: column; gap: 4px; }
.figma-variable-import__step > span { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 50%; background: #e5e6eb; color: #86909c; font-size: 11px; font-weight: 700; }
.figma-variable-import__step small { color: #c9cdd4; font-size: 10px; line-height: 15px; white-space: nowrap; }
.figma-variable-import__step.is-active > span { background: #165dff; color: #fff; }
.figma-variable-import__step.is-active small { color: #165dff; }
.figma-variable-import__step.is-done > span { background: #00b42a; color: #fff; }
.figma-variable-import__steps > i { height: 1px; flex: 1; margin: 12px 4px 0; background: #e5e6eb; }
.figma-variable-import__steps > i.is-done { background: #00b42a; }
.figma-variable-import__choose { display: flex; min-height: 260px; align-items: center; flex-direction: column; gap: 16px; padding: 24px; }
.figma-variable-import__drop { display: flex; width: 100%; min-height: 160px; align-items: center; justify-content: center; flex-direction: column; gap: 16px; border: 2px dashed #e5e6eb; border-radius: 12px; background: #fafafa; color: #c9cdd4; }
.figma-variable-import__drop:hover { border-color: #9db9fa; background: #f7faff; }
.figma-variable-import__drop strong { color: #4e5969; font-size: 13px; font-weight: 500; }
.figma-variable-import__drop span { color: #c9cdd4; font-size: 12px; }
.figma-variable-import__validating { display: flex; min-height: 260px; align-items: center; justify-content: center; flex-direction: column; gap: 14px; color: #165dff; }
.figma-variable-import__validating p { margin: 0; color: #4e5969; font-size: 13px; }
.figma-variable-import__spinner { box-sizing: border-box; width: 40px; height: 40px; border: 4px solid rgba(22, 93, 255, .19); border-top-color: #165dff; border-radius: 50%; animation: figma-variable-spin 1s linear infinite; }
.figma-variable-import__preview, .figma-variable-import__conflicts, .figma-variable-import__complete { display: grid; overflow: auto; gap: 16px; padding: 24px; }
.figma-variable-import__notice { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid rgba(22,93,255,.19); border-radius: 8px; background: #e8f3ff; color: #165dff; font-size: 13px; }
.figma-variable-import__table { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 12px; }
.figma-variable-import__table > div { display: grid; grid-template-columns: 1fr 108px 108px; min-height: 40px; align-items: center; padding: 0 16px; border-top: 1px solid #e5e6eb; font-size: 11px; }
.figma-variable-import__table > div.is-head { min-height: 31px; border-top: 0; background: #fafafa; color: #86909c; font-weight: 600; letter-spacing: .275px; text-transform: uppercase; }
.figma-variable-import__table strong { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
.figma-variable-import__table em { justify-self: start; padding: .5px 7px; border-radius: 3.5px; background: #e8ffea; color: #00b42a; font-style: normal; font-weight: 600; }
.figma-variable-import__table em.is-conflict { background: #fff3e8; color: #ff7d00; }
.figma-variable-import__actions { display: flex; justify-content: flex-end; gap: 7px; }
.figma-variable-import__conflicts > p { margin: 0; color: #4e5969; font-size: 13px; }
.figma-variable-import__conflicts article { display: grid; gap: 12px; padding: 16px; border: 1px solid #e5e6eb; border-radius: 12px; background: #fafafa; }
.figma-variable-import__conflicts article header { display: flex; align-items: center; gap: 8px; }
.figma-variable-import__conflicts article header strong { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; }
.figma-variable-import__conflicts article header span { padding: 2px 8px; border-radius: 4px; background: #fff3e8; color: #ff7d00; font-size: 11px; font-weight: 600; }
.figma-variable-import__conflicts article > div { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.figma-variable-import__conflicts article button { min-height: 52px; padding: 8px 12px; border: 1.5px solid #e5e6eb; border-radius: 8px; background: #fff; color: #4e5969; font-size: 12px; font-weight: 500; }
.figma-variable-import__conflicts article button.is-active { border-color: #165dff; background: rgba(22,93,255,.03); color: #165dff; }
.figma-variable-import__complete { align-items: center; justify-items: stretch; min-height: 260px; color: #00b42a; }
.figma-variable-import__complete-head { display: flex; align-items: center; flex-direction: column; gap: 8px; padding: 16px 0; }
.figma-variable-import__complete-head strong { color: #1d2129; font-size: 15px; font-weight: 600; }
.figma-variable-import__complete-results { display: grid; gap: 8px; }
.figma-variable-import__complete-results > p { display: flex; width: 100%; align-items: center; gap: 12px; margin: 0; padding: 10px 12px; border: 1px solid #e5e6eb; border-radius: 7px; background: #f4f6fa; color: #4e5969; font-size: 13px; }
.figma-variable-import__complete-results > p.is-success { border-color: rgba(0, 180, 42, .25); background: #e8ffea; color: #00b42a; }
.figma-variable-import__complete-results > p.is-overwritten { border-color: rgba(22, 93, 255, .25); background: #e8f3ff; color: #165dff; }
.figma-variable-import__complete .figma-variable-import__actions { width: 100%; }
@keyframes figma-variable-spin { to { transform: rotate(360deg); } }
</style>
