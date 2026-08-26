<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { workspaceApi, type WorkspaceAssignableMemberItem } from '@/entities/workspace'

const props = withDefaults(
  defineProps<{
    modelValue: string
    workspaceCode?: string
    disabled?: boolean
    clearable?: boolean
    placeholder?: string
    fallbackLabel?: string | null
  }>(),
  {
    workspaceCode: '',
    placeholder: '请选择处理人',
    fallbackLabel: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const members = ref<WorkspaceAssignableMemberItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
let requestSeq = 0

const normalizedWorkspaceCode = computed(() => props.workspaceCode || '')
const hasWorkspace = computed(() => Boolean(normalizedWorkspaceCode.value))
const selectedMember = computed(() => members.value.find(member => String(member.userId) === props.modelValue) ?? null)
const selectedLabel = computed(() => selectedMember.value ? getMemberLabel(selectedMember.value) : props.fallbackLabel || '')
const selectDisabled = computed(() => props.disabled || !hasWorkspace.value)
const selectPlaceholder = computed(() => {
  if (!hasWorkspace.value) {
    return '请先选择工作空间'
  }
  return props.placeholder
})

function getMemberLabel(member: WorkspaceAssignableMemberItem) {
  return member.displayName || member.username || `用户 ${member.userId}`
}

function dedupeMembers(items: WorkspaceAssignableMemberItem[]) {
  const memberMap = new Map<number, WorkspaceAssignableMemberItem>()
  items.forEach((member) => {
    if (!memberMap.has(member.userId)) {
      memberMap.set(member.userId, member)
    }
  })
  return Array.from(memberMap.values())
}

async function loadAllWorkspaceMembers() {
  const workspaces = await workspaceApi.getSwitchableWorkspaces()
  const businessWorkspaces = workspaces.filter((workspace) => (
    workspace.workspaceCode
    && workspace.workspaceCode !== 'ALL'
    && !workspace.allScope
  ))
  const memberGroups = await Promise.allSettled(
    businessWorkspaces.map((workspace) => workspaceApi.getWorkspaceAssignableMembers(workspace.workspaceCode)),
  )
  return dedupeMembers(memberGroups.flatMap((group) => (group.status === 'fulfilled' ? group.value : [])))
}

async function loadMembers(workspaceCode: string) {
  const currentSeq = ++requestSeq
  if (!workspaceCode) {
    members.value = []
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const nextMembers = workspaceCode === 'ALL'
      ? await loadAllWorkspaceMembers()
      : await workspaceApi.getWorkspaceAssignableMembers(workspaceCode)
    if (currentSeq === requestSeq) {
      members.value = nextMembers
    }
  } catch (error) {
    if (currentSeq === requestSeq) {
      members.value = []
      errorMessage.value = '处理人加载失败'
    }
  } finally {
    if (currentSeq === requestSeq) {
      loading.value = false
    }
  }
}

watch(
  normalizedWorkspaceCode,
  (workspaceCode) => {
    void loadMembers(workspaceCode)
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-user-select">
    <el-select
      :model-value="modelValue"
      class="app-user-select__control"
      :disabled="selectDisabled"
      :loading="loading"
      :clearable="clearable"
      filterable
      :placeholder="selectPlaceholder"
      @update:model-value="emit('update:modelValue', String($event || ''))"
    >
      <template v-if="selectedLabel" #label>
        <div class="app-user-select__selected">
          <span class="app-user-select__name">{{ selectedLabel }}</span>
        </div>
      </template>
      <el-option
        v-for="member in members"
        :key="member.userId"
        :label="getMemberLabel(member)"
        :value="String(member.userId)"
      >
        <div class="app-user-select__option">
          <span class="app-user-select__name">{{ getMemberLabel(member) }}</span>
        </div>
      </el-option>
    </el-select>
    <small v-if="errorMessage" class="app-user-select__error">{{ errorMessage }}</small>
  </div>
</template>

<style scoped>
.app-user-select {
  display: grid;
  min-width: 0;
  gap: var(--app-space-1);
}

.app-user-select__control {
  width: 100%;
}

.app-user-select__selected,
.app-user-select__option {
  display: flex;
  min-width: 0;
  align-items: center;
}

.app-user-select__selected {
  width: 100%;
}

.app-user-select__name {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-user-select__error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}
</style>
