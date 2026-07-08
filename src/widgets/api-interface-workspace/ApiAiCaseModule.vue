<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import ApiAiGenerationDrawer from './ApiAiGenerationDrawer.vue'
import ApiAiGenerationWorkspace from './ApiAiGenerationWorkspace.vue'
import type { AiCaseGenerationTabState, ApiAiCaseResultFilter, ApiAiGeneratedCaseResult } from './apiInterfaceTypes'
import type { ApiAiCaseBatchPayload, ApiAiCaseGenerationSubmitPayload } from './apiAiCaseModuleTypes'
import {
  aiCaseGenerationOptions,
  groupAiCaseGenerationOptions,
} from './lib/apiWorkspaceOptions'

const props = defineProps<{
  workspaceCode: string
  state: AiCaseGenerationTabState | null
  canOpenDrawer: boolean
  generationStatus: 'idle' | 'running' | 'done' | 'failed'
  savingId: string
  requestMethodClass: (method?: string) => string
  caseTypeLabel: (result: ApiAiGeneratedCaseResult | null) => string
  caseGroupLabel: (result: ApiAiGeneratedCaseResult | null) => string
}>()

const emit = defineEmits<{
  submit: [payload: ApiAiCaseGenerationSubmitPayload]
  stopGeneration: []
  runSelected: [result: ApiAiGeneratedCaseResult]
  acceptSelected: [payload: ApiAiCaseBatchPayload]
  discardSelected: [payload: ApiAiCaseBatchPayload]
  openDetail: [result: ApiAiGeneratedCaseResult]
  runCase: [result: ApiAiGeneratedCaseResult]
  saveCase: [result: ApiAiGeneratedCaseResult]
  discardCase: [result: ApiAiGeneratedCaseResult]
}>()

const drawerVisible = ref(false)
const providers = ref<AiProviderConnectionItem[]>([])
const providersLoading = ref(false)
const providerId = ref<number | null>(null)
const caseCount = ref('AUTO')
const noDuplicate = ref(true)
const prompt = ref('')
const selectedOptionKeys = ref<string[]>([
  'required-only',
  'valid-semantics',
  'sample-combination',
  'other-positive',
  'empty-value',
  'missing-required',
  'format-error',
  'type-error',
  'semantic-invalid',
  'other-negative',
  'max-min',
  'over-boundary',
  'null-empty',
  'string-length',
  'auth-control',
])
const resultFilter = ref<ApiAiCaseResultFilter>('pending')
const keyword = ref('')
const group = ref('')
const type = ref('')
const selectedResultIds = ref<string[]>([])

const groups = computed(() => groupAiCaseGenerationOptions(aiCaseGenerationOptions))
const selectedCount = computed(() => selectedOptionKeys.value.length)
const availableProviders = computed(() =>
  providers.value.filter(item => item.status !== 0 && Boolean(item.modelName)),
)
const selectedProvider = computed(() =>
  availableProviders.value.find(item => item.id === providerId.value) || null,
)
const canGenerate = computed(() =>
  props.canOpenDrawer
  && Boolean(selectedProvider.value)
  && selectedOptionKeys.value.length > 0
  && props.generationStatus !== 'running',
)
const results = computed(() => props.state?.results || [])
const pendingResults = computed(() =>
  results.value.filter(item => item.status !== 'accepted' && item.status !== 'discarded'),
)
const acceptedResults = computed(() =>
  results.value.filter(item => item.status === 'accepted'),
)
const discardedResults = computed(() =>
  results.value.filter(item => item.status === 'discarded'),
)
const emptyText = computed(() => {
  if (props.state?.generating) {
    return 'AI 正在生成用例大纲，生成后的用例会逐条显示'
  }
  if (props.state?.message && props.generationStatus === 'failed') {
    return props.state.message
  }
  if (results.value.length > 0) {
    return '当前筛选条件下没有可展示的用例'
  }
  return '本次没有生成可展示的用例，请检查模型是否按要求返回结构化内容'
})
const filteredResults = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  return results.value.filter((item) => {
    if (resultFilter.value === 'pending' && (item.status === 'accepted' || item.status === 'discarded')) return false
    if (resultFilter.value !== 'all' && resultFilter.value !== 'pending' && item.status !== resultFilter.value) return false
    if (group.value && (item.draft.groupKey || item.draft.group || '') !== group.value) return false
    if (type.value && (item.draft.typeKey || item.draft.type || '') !== type.value) return false
    if (!normalizedKeyword) return true
    return [
      item.draft.name,
      item.draft.description,
      item.draft.expected,
      item.draft.group,
      item.draft.type,
      item.message,
    ].some(value => String(value || '').toLowerCase().includes(normalizedKeyword))
  })
})
const groupOptions = computed(() => {
  const options = new Map<string, string>()
  results.value.forEach((item) => {
    const value = item.draft.groupKey || item.draft.group || ''
    if (value) options.set(value, item.draft.group || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const typeOptions = computed(() => {
  const options = new Map<string, string>()
  results.value.forEach((item) => {
    const value = item.draft.typeKey || item.draft.type || ''
    if (value) options.set(value, item.draft.type || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const selectedPendingResults = computed(() =>
  pendingResults.value.filter(item => item.status !== 'generating' && item.status !== 'failed' && selectedResultIds.value.includes(item.id)),
)
const selectionAllChecked = computed(() =>
  filteredResults.value.some(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
  && filteredResults.value
    .filter(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
    .every(item => selectedResultIds.value.includes(item.id)),
)
const selectionIndeterminate = computed(() => {
  const pending = filteredResults.value.filter(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
  if (!pending.length) return false
  const selected = pending.filter(item => selectedResultIds.value.includes(item.id)).length
  return selected > 0 && selected < pending.length
})

watch(
  () => props.state,
  () => {
    resultFilter.value = 'pending'
    keyword.value = ''
    group.value = ''
    type.value = ''
    selectedResultIds.value = []
  },
)

async function loadProviders() {
  providersLoading.value = true
  try {
    providers.value = await aiProviderApi.getProviderConnections(props.workspaceCode)
    if (!selectedProvider.value && availableProviders.value.length) {
      providerId.value = availableProviders.value[0].id
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    providersLoading.value = false
  }
}

function openDrawer() {
  if (!props.canOpenDrawer) {
    ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
    return
  }
  drawerVisible.value = true
  if (!providers.value.length) {
    void loadProviders()
  }
}

function isGroupAllSelected(groupKey: string) {
  const targetGroup = groups.value.find(item => item.key === groupKey)
  if (!targetGroup) return false
  return targetGroup.options.every(option => selectedOptionKeys.value.includes(option.key))
}

function toggleGroup(groupKey: string, checked: boolean) {
  const targetGroup = groups.value.find(item => item.key === groupKey)
  if (!targetGroup) return
  const keys = targetGroup.options.map(option => option.key)
  if (checked) {
    selectedOptionKeys.value = Array.from(new Set([...selectedOptionKeys.value, ...keys]))
    return
  }
  selectedOptionKeys.value = selectedOptionKeys.value.filter(key => !keys.includes(key))
}

function selectedOptions() {
  const selected = aiCaseGenerationOptions.filter(item => selectedOptionKeys.value.includes(item.key))
  return selected.length ? selected : aiCaseGenerationOptions.slice(0, 1)
}

function submit() {
  if (!selectedProvider.value) {
    ElMessage.warning('请选择可用的 AI 模型')
    return
  }
  emit('submit', {
    provider: selectedProvider.value,
    caseCount: caseCount.value,
    noDuplicate: noDuplicate.value,
    prompt: prompt.value,
    selectedOptions: selectedOptions(),
  })
  drawerVisible.value = false
}

function generateOrStop() {
  if (props.state?.generating) {
    emit('stopGeneration')
    return
  }
  openDrawer()
}

function runSelected() {
  const target = selectedPendingResults.value[0]
  if (!target) {
    ElMessage.info('请先选择用例')
    return
  }
  emit('runSelected', target)
}

function acceptSelected() {
  emit('acceptSelected', {
    selected: [...selectedPendingResults.value],
    pending: pendingResults.value.filter(item => item.status === 'pending'),
  })
}

function discardSelected() {
  emit('discardSelected', {
    selected: [...selectedPendingResults.value],
    pending: pendingResults.value.filter(item => item.status === 'pending'),
  })
}

function toggleSelection(id: string, checked: string | number | boolean) {
  const selected = Boolean(checked)
  if (selected) {
    if (!selectedResultIds.value.includes(id)) {
      selectedResultIds.value = [...selectedResultIds.value, id]
    }
    return
  }
  selectedResultIds.value = selectedResultIds.value.filter(item => item !== id)
}

function toggleAll(checked: string | number | boolean) {
  const selectableIds = filteredResults.value
    .filter(item => item.status === 'pending')
    .map(item => item.id)
  if (!Boolean(checked)) {
    selectedResultIds.value = selectedResultIds.value.filter(id => !selectableIds.includes(id))
    return
  }
  selectedResultIds.value = Array.from(new Set([...selectedResultIds.value, ...selectableIds]))
}

defineExpose({
  openDrawer,
})
</script>

<template>
  <ApiAiGenerationWorkspace
    v-if="state"
    v-model:result-filter="resultFilter"
    v-model:keyword="keyword"
    v-model:group="group"
    v-model:type="type"
    :state="state"
    :pending-count="pendingResults.length"
    :accepted-count="acceptedResults.length"
    :discarded-count="discardedResults.length"
    :group-options="groupOptions"
    :type-options="typeOptions"
    :selected-pending-count="selectedPendingResults.length"
    :saving-id="savingId"
    :pending-action-count="pendingResults.length"
    :filtered-results="filteredResults"
    :empty-text="emptyText"
    :selection-all-checked="selectionAllChecked"
    :selection-indeterminate="selectionIndeterminate"
    :selected-result-ids="selectedResultIds"
    :request-method-class="requestMethodClass"
    :case-type-label="caseTypeLabel"
    :case-group-label="caseGroupLabel"
    @generate-or-stop="generateOrStop"
    @run-selected="runSelected"
    @accept-selected="acceptSelected"
    @discard-selected="discardSelected"
    @toggle-all="toggleAll"
    @toggle-selection="toggleSelection"
    @open-detail="emit('openDetail', $event)"
    @run-case="emit('runCase', $event)"
    @save-case="emit('saveCase', $event)"
    @discard-case="emit('discardCase', $event)"
  />

  <ApiAiGenerationDrawer
    v-model="drawerVisible"
    v-model:selected-option-keys="selectedOptionKeys"
    v-model:case-count="caseCount"
    v-model:provider-id="providerId"
    v-model:no-duplicate="noDuplicate"
    v-model:prompt="prompt"
    :groups="groups"
    :selected-count="selectedCount"
    :providers="availableProviders"
    :providers-loading="providersLoading"
    :can-generate="canGenerate"
    :generation-status="generationStatus"
    :is-group-all-selected="isGroupAllSelected"
    @toggle-group="toggleGroup"
    @submit="submit"
  />
</template>
