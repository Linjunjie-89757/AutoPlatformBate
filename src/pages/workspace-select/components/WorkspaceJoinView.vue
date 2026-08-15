<script setup lang="ts">
import { Loader2, Search, Send } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { WorkspaceJoinCandidateItem } from '@/entities/workspace'

import WorkspaceFlowBackButton from './WorkspaceFlowBackButton.vue'
import WorkspaceFlowBrand from './WorkspaceFlowBrand.vue'

const props = withDefaults(defineProps<{
  candidates?: WorkspaceJoinCandidateItem[]
  loading?: boolean
  submitting?: boolean
  invitationError?: string
}>(), {
  candidates: () => [],
  loading: false,
  submitting: false,
  invitationError: '',
})

const emit = defineEmits<{
  back: []
  apply: [workspace: WorkspaceJoinCandidateItem]
  joinInvitation: [invitationCode: string]
  clearInvitationError: []
}>()

const tab = ref<'search' | 'code'>('search')
const query = ref('')
const selectedCode = ref('')
const invitationCode = ref('')
const invitationCodeError = ref('')

const visibleInvitationError = computed(() => invitationCodeError.value || props.invitationError)

const filteredCandidates = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase()
  if (!normalizedQuery) {
    return props.candidates
  }

  return props.candidates.filter(item => (
    item.workspaceName.toLocaleLowerCase().includes(normalizedQuery)
    || (item.description || '').toLocaleLowerCase().includes(normalizedQuery)
  ))
})

const selectedWorkspace = computed(() => (
  props.candidates.find(item => item.workspaceCode === selectedCode.value) || null
))

function getWorkspaceInitial(item: WorkspaceJoinCandidateItem) {
  return (item.workspaceName || item.workspaceCode || 'A').trim().slice(0, 1).toUpperCase()
}

function selectTab(nextTab: 'search' | 'code') {
  tab.value = nextTab
  invitationCodeError.value = ''
}

function handleInvitationCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  invitationCode.value = target.value.toUpperCase()
  invitationCodeError.value = ''
  emit('clearInvitationError')
}

function handleApplySelected() {
  if (!selectedWorkspace.value) {
    return
  }
  emit('apply', selectedWorkspace.value)
}

function handleApplyInvitationCode() {
  if (!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(invitationCode.value.trim())) {
    invitationCodeError.value = '邀请码格式不正确，请检查后重试'
    return
  }
  emit('joinInvitation', invitationCode.value.trim())
}
</script>

<template>
  <main class="workspace-flow-page">
    <section class="workspace-flow workspace-flow--join" aria-label="申请加入工作区">
      <WorkspaceFlowBrand />
      <WorkspaceFlowBackButton @back="emit('back')" />

      <div class="workspace-flow__join-card" :class="{ 'is-code': tab === 'code' }">
        <header>
          <h1>申请加入工作区</h1>
          <p>搜索平台上的工作区，或使用管理员提供的邀请码直接加入。</p>

          <div class="workspace-flow__tabs" role="tablist" aria-label="加入方式">
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'search'"
              :class="{ 'is-active': tab === 'search' }"
              @click="selectTab('search')"
            >
              搜索工作区
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'code'"
              :class="{ 'is-active': tab === 'code' }"
              @click="selectTab('code')"
            >
              邀请码加入
            </button>
          </div>
        </header>

        <div v-if="tab === 'search'" class="workspace-flow__join-body" role="tabpanel">
          <label class="workspace-flow__search">
            <Search aria-hidden="true" />
            <input v-model="query" type="search" placeholder="搜索工作区名称或描述…">
          </label>

          <div class="workspace-flow__candidate-list" :aria-busy="loading">
            <div v-if="loading" class="workspace-flow__join-empty">
              <Loader2 class="is-spinning" aria-hidden="true" />
              <span>正在加载可加入工作区</span>
            </div>
            <button
              v-for="(item, index) in filteredCandidates"
              v-else
              :key="item.workspaceCode"
              class="workspace-flow__candidate"
              :class="{ 'is-selected': selectedCode === item.workspaceCode }"
              type="button"
              :aria-pressed="selectedCode === item.workspaceCode"
              @click="selectedCode = selectedCode === item.workspaceCode ? '' : item.workspaceCode"
            >
              <span class="workspace-flow__avatar" :class="`workspace-flow__avatar--${index % 5}`">
                {{ getWorkspaceInitial(item) }}
              </span>
              <span class="workspace-flow__candidate-copy">
                <strong>{{ item.workspaceName }}</strong>
                <span>{{ item.description?.trim() || '暂无工作区描述' }}</span>
                <small>{{ item.memberCount }} 名成员 · 负责人：{{ item.ownerName }}</small>
              </span>
              <span class="workspace-flow__radio" aria-hidden="true"><i /></span>
            </button>

            <div v-if="!loading && filteredCandidates.length === 0" class="workspace-flow__join-empty">
              <span>未找到匹配的工作区</span>
            </div>
          </div>

          <button
            v-if="selectedWorkspace"
            class="workspace-flow__primary-button workspace-flow__apply-button"
            type="button"
            :disabled="props.submitting"
            @click="handleApplySelected"
          >
            <Loader2 v-if="props.submitting" class="is-spinning" aria-hidden="true" />
            <Send v-else aria-hidden="true" />
            <span>{{ props.submitting ? '提交申请中...' : `申请加入 ${selectedWorkspace.workspaceName}` }}</span>
          </button>
        </div>

        <div v-else class="workspace-flow__join-body workspace-flow__join-body--code" role="tabpanel">
          <div class="workspace-flow__invite-box">
            <label for="workspace-invitation-code">输入邀请码</label>
            <input
              id="workspace-invitation-code"
              :value="invitationCode"
              :class="{ 'is-error': visibleInvitationError }"
              :aria-invalid="Boolean(visibleInvitationError)"
              maxlength="12"
              placeholder="例如：XMAN-8F2K"
              @input="handleInvitationCodeInput"
            >
            <p v-if="visibleInvitationError">{{ visibleInvitationError }}</p>
          </div>
          <p class="workspace-flow__invite-help">
            邀请码由工作区管理员在「系统设置 → 用户管理」中生成，有效期 7 天。<br>
            请联系管理员获取最新邀请码。
          </p>
          <button
            class="workspace-flow__primary-button workspace-flow__apply-button"
            type="button"
            :disabled="props.submitting || !invitationCode.trim()"
            @click="handleApplyInvitationCode"
          >
            <Loader2 v-if="props.submitting" class="is-spinning" aria-hidden="true" />
            <span>{{ props.submitting ? '验证中...' : '使用邀请码加入' }}</span>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
