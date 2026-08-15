<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle, Search, X } from '@lucide/vue'

import type { WorkspaceMemberCandidateItem } from '@/entities/workspace'

export interface AddWorkspaceMemberRoleOption {
  id: number
  roleCode: string
  name: string
  description: string
}

export interface AddWorkspaceMembersPayload {
  userIds: number[]
  memberType: 'ADMIN' | 'MEMBER'
  roleIds: number[]
  roleName: string
}

export interface AddWorkspaceMembersResult {
  count: number
  memberType: 'ADMIN' | 'MEMBER'
  roleName: string
}

const props = defineProps<{
  candidates: WorkspaceMemberCandidateItem[]
  roles: AddWorkspaceMemberRoleOption[]
  loading: boolean
  error: string
  submitting: boolean
  completed: AddWorkspaceMembersResult | null
}>()

const emit = defineEmits<{
  close: []
  retry: []
  confirm: [payload: AddWorkspaceMembersPayload]
}>()

const search = ref('')
const selectedUserIds = ref<Set<number>>(new Set())
const memberType = ref<'ADMIN' | 'MEMBER'>('MEMBER')
const roleId = ref<number | null>(null)

const filteredCandidates = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return props.candidates
  return props.candidates.filter(candidate => [
    candidate.displayName,
    candidate.username,
    candidate.email,
  ].some(value => String(value || '').toLowerCase().includes(keyword)))
})

const selectedCandidates = computed(() => props.candidates.filter(candidate => selectedUserIds.value.has(candidate.userId)))
const allVisibleSelected = computed(() => filteredCandidates.value.length > 0
  && filteredCandidates.value.every(candidate => selectedUserIds.value.has(candidate.userId)))
const partiallySelected = computed(() => !allVisibleSelected.value
  && filteredCandidates.value.some(candidate => selectedUserIds.value.has(candidate.userId)))
const selectedRole = computed(() => props.roles.find(role => role.id === roleId.value) || null)
const confirmDisabled = computed(() => props.submitting
  || selectedUserIds.value.size === 0
  || roleId.value == null)

function defaultRoleId(type: 'ADMIN' | 'MEMBER') {
  const roleCode = type === 'ADMIN' ? 'SYSTEM_TEST_LEAD' : 'SYSTEM_TEST_ENGINEER'
  return props.roles.find(role => role.roleCode === roleCode)?.id ?? props.roles[0]?.id ?? null
}

watch(() => props.roles, () => {
  if (roleId.value == null || !props.roles.some(role => role.id === roleId.value)) {
    roleId.value = defaultRoleId(memberType.value)
  }
}, { immediate: true })

function toggleCandidate(userId: number) {
  const next = new Set(selectedUserIds.value)
  if (next.has(userId)) next.delete(userId)
  else next.add(userId)
  selectedUserIds.value = next
}

function toggleAllVisible() {
  const next = new Set(selectedUserIds.value)
  if (allVisibleSelected.value) {
    filteredCandidates.value.forEach(candidate => next.delete(candidate.userId))
  } else {
    filteredCandidates.value.forEach(candidate => next.add(candidate.userId))
  }
  selectedUserIds.value = next
}

function setMemberType(type: 'ADMIN' | 'MEMBER') {
  memberType.value = type
  roleId.value = defaultRoleId(type)
}

function confirm() {
  if (confirmDisabled.value || !selectedRole.value) return
  emit('confirm', {
    userIds: [...selectedUserIds.value],
    memberType: memberType.value,
    roleIds: [selectedRole.value.id],
    roleName: selectedRole.value.name,
  })
}
</script>

<template>
  <div class="add-members-dialog__backdrop" @click="emit('close')" />
  <section class="add-members-dialog" role="dialog" aria-modal="true" aria-labelledby="add-members-title">
    <div v-if="completed" class="add-members-dialog__success">
      <span class="add-members-dialog__success-icon"><CheckCircle /></span>
      <h3 id="add-members-title">添加成功</h3>
      <p>已将 <strong>{{ completed.count }}</strong> 名成员添加到工作区</p>
      <small>身份：{{ completed.memberType === 'ADMIN' ? '工作区管理员' : '普通成员' }} · 角色：{{ completed.roleName }}</small>
      <button type="button" @click="emit('close')">完成</button>
    </div>

    <div v-else class="add-members-dialog__panel">
      <header>
        <span>
          <strong id="add-members-title">添加工作区成员</strong>
          <small>从平台账号中选择成员加入此工作区</small>
        </span>
        <button type="button" aria-label="关闭" title="关闭" @click="emit('close')"><X /></button>
      </header>

      <div class="add-members-dialog__search">
        <label>
          <Search />
          <input v-model="search" type="search" placeholder="搜索姓名、邮箱或部门…">
        </label>
      </div>

      <div class="add-members-dialog__list" :aria-busy="loading">
        <div v-if="loading" class="add-members-dialog__loading" aria-label="正在加载平台账号">
          <div class="add-members-dialog__loading-select-all">
            <i />
            <span />
          </div>
          <div v-for="index in 5" :key="index" class="add-members-dialog__loading-row">
            <i class="is-checkbox" />
            <i class="is-avatar" />
            <span>
              <i class="is-name" />
              <i class="is-email" />
            </span>
          </div>
        </div>
        <div v-else-if="error" class="add-members-dialog__state is-error">
          <span>{{ error }}</span>
          <button type="button" @click="emit('retry')">重新加载</button>
        </div>
        <template v-else-if="filteredCandidates.length">
          <button class="add-members-dialog__select-all" type="button" @click="toggleAllVisible">
            <span
              class="add-members-dialog__checkbox"
              :class="{ 'is-checked': allVisibleSelected, 'is-mixed': partiallySelected }"
              aria-hidden="true"
            >
              <svg v-if="allVisibleSelected" width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <i v-else-if="partiallySelected" />
            </span>
            <strong>全选（{{ filteredCandidates.length }} 人）</strong>
            <small v-if="selectedUserIds.size">已选 {{ selectedUserIds.size }} 人</small>
          </button>

          <button
            v-for="candidate in filteredCandidates"
            :key="candidate.userId"
            class="add-members-dialog__candidate"
            :class="{ 'is-selected': selectedUserIds.has(candidate.userId) }"
            type="button"
            @click="toggleCandidate(candidate.userId)"
          >
            <span
              class="add-members-dialog__checkbox"
              :class="{ 'is-checked': selectedUserIds.has(candidate.userId) }"
              aria-hidden="true"
            >
              <svg v-if="selectedUserIds.has(candidate.userId)" width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <i class="add-members-dialog__avatar">{{ (candidate.displayName || candidate.username).slice(0, 1) }}</i>
            <span class="add-members-dialog__candidate-copy">
              <strong>{{ candidate.displayName || candidate.username }}</strong>
              <small>{{ candidate.email }}</small>
            </span>
          </button>
        </template>
        <div v-else class="add-members-dialog__state">
          {{ search ? '未找到匹配的平台账号' : '所有平台成员均已在此工作区中' }}
        </div>
      </div>

      <div class="add-members-dialog__assignment">
        <div v-if="selectedUserIds.size === 0" class="add-members-dialog__hint">请从上方列表中勾选要添加的成员</div>
        <div v-else class="add-members-dialog__permissions">
          <div class="add-members-dialog__selected-summary">
            <span class="add-members-dialog__avatars">
              <i
                v-for="candidate in selectedCandidates.slice(0, 5)"
                :key="candidate.userId"
              >{{ (candidate.displayName || candidate.username).slice(0, 1) }}</i>
              <i v-if="selectedCandidates.length > 5" class="is-more">+{{ selectedCandidates.length - 5 }}</i>
            </span>
            <span>已选 <strong>{{ selectedUserIds.size }}</strong> 人 — 统一设置以下权限</span>
          </div>

          <div class="add-members-dialog__permission-grid">
            <div>
              <label>工作区身份 <em>*</em></label>
              <div class="add-members-dialog__identity-options">
                <button
                  v-for="option in [
                    { value: 'MEMBER' as const, label: '普通成员', hint: '访问工作区功能' },
                    { value: 'ADMIN' as const, label: '工作区管理员', hint: '管理成员和设置' },
                  ]"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-active': memberType === option.value }"
                  @click="setMemberType(option.value)"
                >
                  <span><i />{{ option.label }}</span>
                  <small>{{ option.hint }}</small>
                </button>
              </div>
            </div>
            <div>
              <label>工作区角色 <em>*</em></label>
              <select v-model="roleId">
                <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
              </select>
              <small class="add-members-dialog__role-desc">{{ selectedRole?.description }}</small>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button class="is-primary" type="button" :disabled="confirmDisabled" @click="confirm">
          {{ submitting ? '添加中...' : `确认添加${selectedUserIds.size ? ` (${selectedUserIds.size} 人)` : ''}` }}
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.add-members-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.35);
}

.add-members-dialog {
  position: fixed;
  inset: 0;
  z-index: 61;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.add-members-dialog__panel {
  display: flex;
  width: 600px;
  max-width: calc(100vw - 32px);
  max-height: 88vh;
  overflow: hidden;
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}

.add-members-dialog__panel header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e6eb;
}

.add-members-dialog__panel header > span {
  display: grid;
  gap: 2px;
}

.add-members-dialog__panel header strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.add-members-dialog__panel header small {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.add-members-dialog__panel header button {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.add-members-dialog__panel header button:hover {
  background: #f2f3f5;
  color: #86909c;
}

.add-members-dialog__panel header svg {
  width: 14px;
  height: 14px;
}

.add-members-dialog__search {
  flex: 0 0 auto;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.add-members-dialog__search label {
  position: relative;
  display: block;
}

.add-members-dialog__search svg {
  position: absolute;
  top: 11.5px;
  left: 10px;
  width: 13px;
  height: 13px;
  color: #c9cdd4;
  pointer-events: none;
}

.add-members-dialog__search input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 32px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  outline: none;
  color: #1d2129;
  font: inherit;
  font-size: 13px;
  transition: border-color 150ms ease;
}

.add-members-dialog__search input:focus {
  border-color: #334155;
}

.add-members-dialog__search input::placeholder {
  color: #c9cdd4;
}

.add-members-dialog__list {
  height: 300px;
  flex: 0 0 300px;
  max-height: 300px;
  overflow-y: auto;
}

.add-members-dialog__loading {
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.add-members-dialog__loading-select-all,
.add-members-dialog__loading-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 20px;
  padding-left: 20px;
  border-bottom: 1px solid #e5e6eb;
}

.add-members-dialog__loading-select-all {
  height: 37px;
  background: #fafbfe;
}

.add-members-dialog__loading-row {
  height: 57px;
}

.add-members-dialog__loading i,
.add-members-dialog__loading span {
  display: block;
}

.add-members-dialog__loading-select-all i,
.add-members-dialog__loading-row > i,
.add-members-dialog__loading-row span > i {
  background: #f2f3f5;
  animation: add-members-skeleton-pulse 1.4s ease-in-out infinite;
}

.add-members-dialog__loading-select-all i,
.add-members-dialog__loading-row > i.is-checkbox {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 4px;
}

.add-members-dialog__loading-select-all span {
  width: 72px;
  height: 12px;
  border-radius: 4px;
  background: #f2f3f5;
  animation: add-members-skeleton-pulse 1.4s ease-in-out infinite;
}

.add-members-dialog__loading-row > i.is-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
}

.add-members-dialog__loading-row > span {
  display: grid;
  flex: 1;
  gap: 5px;
}

.add-members-dialog__loading-row span > i {
  border-radius: 4px;
}

.add-members-dialog__loading-row span > i.is-name {
  width: 72px;
  height: 12px;
}

.add-members-dialog__loading-row span > i.is-email {
  width: 148px;
  height: 10px;
}

@keyframes add-members-skeleton-pulse {
  0%,
  100% {
    opacity: 0.58;
  }

  50% {
    opacity: 1;
  }
}

.add-members-dialog__select-all,
.add-members-dialog__candidate {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  text-align: left;
  cursor: pointer;
}

.add-members-dialog__select-all {
  min-height: 37px;
  padding: 10px 20px;
  background: #fafbfe;
  line-height: 16px;
}

.add-members-dialog__select-all strong {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
}

.add-members-dialog__select-all small {
  color: #334155;
  font-size: 12px;
}

.add-members-dialog__checkbox {
  display: grid;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  place-items: center;
  border: 2px solid #c9cdd4;
  border-radius: 4px;
  background: transparent;
}

.add-members-dialog__checkbox.is-checked,
.add-members-dialog__checkbox.is-mixed {
  border-color: #334155;
}

.add-members-dialog__checkbox.is-checked {
  background: #334155;
}

.add-members-dialog__checkbox > i {
  width: 8px;
  height: 2px;
  border-radius: 1px;
  background: #334155;
}

.add-members-dialog__candidate {
  min-height: 57px;
  padding: 12px 20px;
  background: #fff;
  transition: background-color 150ms ease;
}

.add-members-dialog__candidate:hover {
  background: #f8f9fb;
}

.add-members-dialog__candidate.is-selected,
.add-members-dialog__candidate.is-selected:hover {
  background: rgba(51, 65, 85, 0.027);
}

.add-members-dialog__avatar {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border-radius: 50%;
  background: #165dff;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.add-members-dialog__candidate-copy {
  display: grid;
  min-width: 0;
  flex: 1;
}

.add-members-dialog__candidate-copy strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-members-dialog__candidate-copy small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-members-dialog__state {
  display: grid;
  min-height: 132px;
  padding: 28px 20px;
  place-items: center;
  color: #86909c;
  font-size: 13px;
  text-align: center;
}

.add-members-dialog__state.is-error {
  gap: 10px;
  align-content: center;
  color: #f53f3f;
}

.add-members-dialog__state button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
}

.add-members-dialog__assignment {
  flex: 0 0 auto;
  border-top: 1px solid #e5e6eb;
}

.add-members-dialog__hint {
  padding: 12px 20px;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.add-members-dialog__permissions {
  padding: 16px 20px;
}

.add-members-dialog__selected-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: #4e5969;
  font-size: 12px;
}

.add-members-dialog__selected-summary > span:last-child strong {
  color: #334155;
}

.add-members-dialog__avatars {
  display: flex;
}

.add-members-dialog__avatars i {
  display: grid;
  width: 24px;
  height: 24px;
  margin-left: -4px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #165dff;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}

.add-members-dialog__avatars i:first-child {
  margin-left: 0;
}

.add-members-dialog__avatars i.is-more {
  background: #86909c;
  font-size: 9px;
}

.add-members-dialog__permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.add-members-dialog__permission-grid label {
  display: block;
  margin-bottom: 8px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
}

.add-members-dialog__permission-grid label em {
  color: #f53f3f;
  font-style: normal;
}

.add-members-dialog__identity-options {
  display: flex;
  gap: 8px;
}

.add-members-dialog__identity-options button {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1.5px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.add-members-dialog__identity-options button.is-active {
  border-color: #334155;
  background: rgba(51, 65, 85, 0.035);
}

.add-members-dialog__identity-options button > span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
}

.add-members-dialog__identity-options button.is-active > span {
  color: #334155;
}

.add-members-dialog__identity-options button > span i {
  display: grid;
  width: 11px;
  height: 11px;
  place-items: center;
  border: 2px solid #c9cdd4;
  border-radius: 50%;
}

.add-members-dialog__identity-options button.is-active > span i {
  border-color: #334155;
}

.add-members-dialog__identity-options button.is-active > span i::after {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #334155;
  content: '';
}

.add-members-dialog__identity-options button small {
  display: block;
  padding-left: 17px;
  color: #c9cdd4;
  font-size: 10px;
  line-height: 14px;
}

.add-members-dialog__permission-grid select {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font: inherit;
  font-size: 13px;
}

.add-members-dialog__role-desc {
  display: block;
  margin-top: 6px;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
}

.add-members-dialog__panel footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #e5e6eb;
}

.add-members-dialog__panel footer button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
}

.add-members-dialog__panel footer button.is-primary {
  border-color: #334155;
  background: #334155;
  color: #fff;
}

.add-members-dialog__panel footer button.is-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-members-dialog__success {
  width: 380px;
  max-width: calc(100vw - 32px);
  padding: 40px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
  text-align: center;
}

.add-members-dialog__success-icon {
  display: grid;
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  place-items: center;
  border-radius: 50%;
  background: #e8ffea;
  color: #00b42a;
}

.add-members-dialog__success-icon svg {
  width: 26px;
  height: 26px;
}

.add-members-dialog__success h3 {
  margin: 0 0 8px;
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
}

.add-members-dialog__success p {
  margin: 0 0 4px;
  color: #86909c;
  font-size: 13px;
}

.add-members-dialog__success p strong {
  color: #1d2129;
}

.add-members-dialog__success small {
  display: block;
  margin-bottom: 32px;
  color: #c9cdd4;
  font-size: 12px;
}

.add-members-dialog__success button {
  height: 36px;
  padding: 0 32px;
  border: 0;
  border-radius: 12px;
  background: #334155;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .add-members-dialog__permission-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 720px) {
  .add-members-dialog__list {
    height: 220px;
    flex-basis: 220px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .add-members-dialog__loading-select-all i,
  .add-members-dialog__loading-select-all span,
  .add-members-dialog__loading-row > i,
  .add-members-dialog__loading-row span > i {
    animation: none;
  }
}
</style>
