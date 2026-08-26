<script setup lang="ts">
import {
  Bug,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FileCheck2,
  Link2,
  Plus,
  Search,
  Star,
} from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import type { TestPlanCaseItem, TestPlanDefectItem, TestPlanExecutionAttachmentItem, TestPlanExecutionHistoryItem } from '@/entities/test-management'
import { AttachmentFileWall, confirmDelete, type AttachmentFileWallItem } from '@/shared/ui'
import TestPlanCaseEditDrawer from './TestPlanCaseEditDrawer.vue'
import TestPlanLinkDefectDialog from './TestPlanLinkDefectDialog.vue'
import DefectDetailDrawer from '@/widgets/defect-detail-drawer/DefectDetailDrawer.vue'

type ExecutionStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'
type ExecutionTab = 'detail' | 'defects' | 'history'

const props = defineProps<{
  planName: string
  planStatus: string
  workspaceCode?: string
  cases: TestPlanCaseItem[]
  defects: TestPlanDefectItem[]
  caseDefects?: TestPlanDefectItem[]
  owners?: Array<{ id: number; name: string }>
  initialCaseId?: string | null
  submitting?: boolean
  history?: TestPlanExecutionHistoryItem[]
  evidence?: TestPlanExecutionAttachmentItem[]
  evidenceImageUrls?: Record<number, string>
  uploadingEvidence?: boolean
  downloadingEvidenceId?: number | null
  canExecute?: boolean
  canEditSnapshot?: boolean
  canCreateDefect?: boolean
  canLinkDefect?: boolean
  canManageEvidence?: boolean
}>()

const emit = defineEmits<{
  back: []
  createDefect: [caseId: string]
  record: [payload: { caseId: string; status: ExecutionStatus; note: string }, done: (success: boolean) => void]
  editCase: [payload: { caseId: string; title: string; module: string; priority: string; precondition: string; steps: string; expectedResult: string }]
  linkDefect: [payload: { caseId: string; defectId: number }]
  unlinkDefect: [payload: { caseId: string; defectId: number }]
  uploadEvidence: [payload: { caseId: string; files: File[] }]
  downloadEvidence: [payload: { caseId: string; attachmentId: number; fileName: string }]
  deleteEvidence: [payload: { caseId: string; attachmentId: number }]
  selectCase: [caseId: string]
  unsupported: [feature: string]
}>()

const activeId = ref('')
const tab = ref<ExecutionTab>('detail')
const listFilter = ref<'all' | ExecutionStatus>('all')
const listSearch = ref('')
const autoNext = ref(false)
const caseEditOpen = ref(false)
const linkDefectOpen = ref(false)
const defectDetailOpen = ref(false)
const defectDetailId = ref<number | null>(null)
const drafts = reactive(new Map<string, { actual: string; remark: string }>())

const statusConfig: Record<ExecutionStatus, { label: string; color: string; background: string; dot: string }> = {
  PENDING: { label: '未执行', color: '#86909c', background: '#f2f3f5', dot: '#c9cdd4' },
  PASSED: { label: '通过', color: '#00b42a', background: 'rgb(0 180 42 / 8%)', dot: '#00b42a' },
  FAILED: { label: '失败', color: '#f53f3f', background: 'rgb(245 63 63 / 7%)', dot: '#f53f3f' },
  BLOCKED: { label: '阻塞', color: '#ff7d00', background: 'rgb(255 125 0 / 8%)', dot: '#ff7d00' },
  SKIPPED: { label: '跳过', color: '#86909c', background: '#f2f3f5', dot: '#c9cdd4' },
}

const normalizeStatus = (value: string) => value.toUpperCase() as ExecutionStatus
const parseExecutionNote = (note?: string | null) => {
  if (!note) return { actual: '', remark: '' }
  const actual = note.match(/实际结果：\s*\n?([\s\S]*?)(?:\n\n执行备注：|$)/)?.[1]?.trim() || ''
  const remark = note.match(/执行备注：\s*\n?([\s\S]*)$/)?.[1]?.trim() || (actual ? '' : note.trim())
  return { actual, remark }
}
const activeCase = computed(() => props.cases.find(item => String(item.id) === activeId.value) || props.cases[0] || null)
const activeIndex = computed(() => props.cases.findIndex(item => String(item.id) === activeId.value))
const activeStatus = computed(() => activeCase.value ? statusConfig[normalizeStatus(activeCase.value.executionStatus)] : statusConfig.PENDING)
const canExecute = computed(() => props.canExecute !== false && ['RUNNING', 'running'].includes(props.planStatus))
const canEditSnapshot = computed(() => props.canEditSnapshot !== false && ['DRAFT', 'PENDING', 'draft', 'pending'].includes(props.planStatus))
const canCreateDefect = computed(() => props.canCreateDefect !== false)
const canLinkDefect = computed(() => props.canLinkDefect !== false)
const canManageEvidence = computed(() => props.canManageEvidence !== false)
const evidenceWallItems = computed<AttachmentFileWallItem[]>(() => (props.evidence || []).map(file => ({
  id: file.id,
  fileName: file.fileName,
  fileSize: file.fileSize,
  contentType: file.contentType,
  imageUrl: props.evidenceImageUrls?.[file.id],
  createdAt: file.createdAt,
})))
const openDefectDetail = (defectId: number) => {
  defectDetailId.value = defectId
  defectDetailOpen.value = true
}

const emitEvidenceFiles = (files: File[]) => {
  if (!files.length || !canManageEvidence.value || props.uploadingEvidence) return
  emit('uploadEvidence', { caseId: activeId.value, files })
}

const handleEvidenceDownload = (item: AttachmentFileWallItem) => {
  const file = props.evidence?.find(entry => entry.id === Number(item.id))
  if (file) emit('downloadEvidence', { caseId: activeId.value, attachmentId: file.id, fileName: file.fileName })
}

const handleEvidenceRemove = async (item: AttachmentFileWallItem) => {
  const file = props.evidence?.find(entry => entry.id === Number(item.id))
  if (!file || !canManageEvidence.value || props.uploadingEvidence) return
  try {
    await confirmDelete({
      title: '删除执行证据',
      message: `确认删除执行证据“${file.fileName}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }
  emit('deleteEvidence', { caseId: activeId.value, attachmentId: file.id })
}
const activeDraft = computed(() => {
  if (!activeCase.value) return { actual: '', remark: '' }
  const key = String(activeCase.value.id)
  if (!drafts.has(key)) drafts.set(key, parseExecutionNote(activeCase.value.executionNote))
  return drafts.get(key)!
})

const filteredCases = computed(() => {
  const keyword = listSearch.value.trim().toLowerCase()
  return props.cases.filter(item => {
    const status = normalizeStatus(item.executionStatus)
    const statusMatched = listFilter.value === 'all' || status === listFilter.value
    const keywordMatched = !keyword || `${item.caseNo}${item.title}`.toLowerCase().includes(keyword)
    return statusMatched && keywordMatched
  })
})

const counts = computed(() => ({
  passed: props.cases.filter(item => normalizeStatus(item.executionStatus) === 'PASSED').length,
  failed: props.cases.filter(item => normalizeStatus(item.executionStatus) === 'FAILED').length,
  blocked: props.cases.filter(item => normalizeStatus(item.executionStatus) === 'BLOCKED').length,
}))

const activeDefects = computed(() => props.caseDefects || [])

const steps = computed(() => (activeCase.value?.steps || '')
  .split(/\r?\n/)
  .map(item => item.trim())
  .filter(Boolean))

const tabs = computed(() => [
  { key: 'detail' as const, label: '详情' },
  { key: 'defects' as const, label: `关联缺陷 (${activeDefects.value.length})` },
  { key: 'history' as const, label: '执行历史' },
])

const filterItems: Array<{ key: 'all' | ExecutionStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'PENDING', label: '未执行' },
  { key: 'PASSED', label: '通过' },
  { key: 'FAILED', label: '失败' },
  { key: 'BLOCKED', label: '阻塞' },
]

watch(() => [props.initialCaseId, props.cases.length], () => {
  if (props.initialCaseId && props.cases.some(item => String(item.id) === props.initialCaseId)) activeId.value = props.initialCaseId
  else if (!activeId.value || !props.cases.some(item => String(item.id) === activeId.value)) {
    const firstPending = props.cases.find(item => normalizeStatus(item.executionStatus) === 'PENDING')
    activeId.value = String(firstPending?.id || props.cases[0]?.id || '')
  }
}, { immediate: true })

const selectCase = (id: string) => {
  activeId.value = id
  tab.value = 'detail'
  emit('selectCase', id)
}

const move = (delta: number) => {
  const next = props.cases[activeIndex.value + delta]
  if (next) selectCase(String(next.id))
}

const filterCount = (status: 'all' | ExecutionStatus) => status === 'all'
  ? props.cases.length
  : props.cases.filter(item => normalizeStatus(item.executionStatus) === status).length

const mark = (status: ExecutionStatus) => {
  const item = activeCase.value
  if (!item || props.submitting || !canExecute.value) return
  const noteParts = []
  if (activeDraft.value.actual.trim()) noteParts.push(`实际结果：\n${activeDraft.value.actual.trim()}`)
  if (activeDraft.value.remark.trim()) noteParts.push(`执行备注：\n${activeDraft.value.remark.trim()}`)
  emit('record', { caseId: String(item.id), status, note: noteParts.join('\n\n') }, (success) => {
    if (!success) return
    activeDraft.value.actual = ''
    activeDraft.value.remark = ''
    if (autoNext.value && activeIndex.value < props.cases.length - 1) window.setTimeout(() => move(1), 500)
  })
}

const severityLabel: Record<string, string> = { CRITICAL: '致命', HIGH: '严重', MEDIUM: '一般', LOW: '轻微' }
const defectStatusLabel: Record<string, string> = {
  TODO: '待指派', OPEN: '待处理', ASSIGNED: '已指派', IN_PROGRESS: '处理中', FIXING: '处理中',
  PENDING_VERIFY: '待验证', FIXED: '已修复', CLOSED: '已关闭', REJECTED: '已拒绝',
}
const defectAssignee = (item: TestPlanDefectItem) => item.assigneeName
  || props.owners?.find(owner => owner.id === item.assigneeId)?.name
  || (item.assigneeId ? '未知成员' : '未分配')
</script>

<template>
  <section class="tp-execution">
    <header class="tp-execution__header">
      <button type="button" @click="emit('back')"><ChevronLeft :size="13" />测试计划</button><i />
      <template v-if="activeCase">
        <span class="tp-execution__status" :style="{ color: activeStatus.color, backgroundColor: activeStatus.background }"><i :style="{ backgroundColor: activeStatus.dot }" />{{ activeStatus.label }}</span>
        <code>{{ activeCase.caseNo }}</code><strong>{{ activeCase.title }}</strong>
        <button v-if="canEditSnapshot" class="tp-execution__edit" type="button" @click="caseEditOpen = true"><Edit2 :size="12" />编辑用例</button>
      </template>
      <strong v-else>{{ planName }}</strong>
    </header>

    <div v-if="!activeCase" class="tp-execution__empty">当前计划暂无可执行用例</div>
    <div v-else class="tp-execution__body">
      <aside class="tp-execution__queue">
        <div class="tp-execution__search"><Search :size="12" /><input v-model="listSearch" type="search" placeholder="搜索编号或标题…"></div>
        <div class="tp-execution__filters"><button v-for="item in filterItems" :key="item.key" type="button" :class="{ 'is-active': listFilter === item.key }" @click="listFilter = item.key">{{ item.label }} <template v-if="filterCount(item.key)">{{ filterCount(item.key) }}</template></button></div>
        <div class="tp-execution__case-list">
          <button v-for="item in filteredCases" :key="item.id" type="button" :class="{ 'is-active': String(item.id) === activeId }" @click="selectCase(String(item.id))">
            <span><code>{{ item.caseNo }}</code><i :style="{ color: statusConfig[normalizeStatus(item.executionStatus)].color, backgroundColor: statusConfig[normalizeStatus(item.executionStatus)].background }"><b :style="{ backgroundColor: statusConfig[normalizeStatus(item.executionStatus)].dot }" />{{ statusConfig[normalizeStatus(item.executionStatus)].label }}</i></span>
            <strong>{{ item.title }}</strong>
          </button>
          <p v-if="!filteredCases.length">无匹配用例</p>
        </div>
        <footer><span><b class="is-passed">{{ counts.passed }}</b> 通过&nbsp;&nbsp;<b class="is-failed">{{ counts.failed }}</b> 失败&nbsp;&nbsp;<b class="is-blocked">{{ counts.blocked }}</b> 阻塞</span><code><strong>{{ activeIndex + 1 }}</strong>/{{ cases.length }}</code></footer>
      </aside>

      <main class="tp-execution__main">
        <nav><button v-for="item in tabs" :key="item.key" type="button" :class="{ 'is-active': tab === item.key }" @click="tab = item.key">{{ item.label }}</button></nav>
        <div class="tp-execution__content">
          <div v-if="tab === 'detail'" class="tp-execution__detail">
            <div class="tp-execution__grid">
              <article><h3>前置条件</h3><p>{{ activeCase.precondition || '—' }}</p></article>
              <article><h3>测试步骤</h3><ol><li v-for="(step, index) in steps" :key="`${index}-${step}`"><b>{{ index + 1 }}</b><span>{{ step }}</span></li></ol><p v-if="!steps.length">—</p></article>
              <article><h3>预期结果</h3><p>{{ activeCase.expectedResult || '—' }}</p></article>
              <article class="is-editable"><h3>实际结果</h3><textarea v-model="activeDraft.actual" :disabled="!canExecute" placeholder="请填写本次执行的实际结果…" /></article>
            </div>
            <article class="tp-execution__wide-card"><h3>执行备注</h3><textarea v-model="activeDraft.remark" :disabled="!canExecute" rows="3" placeholder="补充执行说明（选填）…" /></article>
            <article class="tp-execution__wide-card is-evidence"><h3>执行证据</h3><AttachmentFileWall :items="evidenceWallItems" :disabled="!canManageEvidence" :uploading="uploadingEvidence" :downloading-id="downloadingEvidenceId" :show-remove="canManageEvidence" empty-title="点击上传，或将文件拖拽至此处" empty-description="支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB" @add-files="emitEvidenceFiles" @download="handleEvidenceDownload" @remove="handleEvidenceRemove" /></article>
          </div>

          <div v-else-if="tab === 'defects'" class="tp-execution__defects">
            <div class="tp-execution__defect-actions"><button v-if="canLinkDefect" type="button" @click="linkDefectOpen = true"><Link2 :size="12" />关联已有缺陷</button><button v-if="canCreateDefect" class="is-primary" type="button" @click="emit('createDefect', activeId)"><Plus :size="12" />新建缺陷</button></div>
            <div v-if="activeDefects.length" class="tp-execution__defect-table"><table><thead><tr><th>缺陷编号</th><th>缺陷标题</th><th>优先级</th><th>严重级别</th><th>状态</th><th>负责人</th><th>更新时间</th><th>操作</th></tr></thead><tbody><tr v-for="defect in activeDefects" :key="defect.id"><td><code>{{ defect.bugNo }}</code></td><td>{{ defect.title }}</td><td><b :class="`is-${defect.priority.toLowerCase()}`">{{ defect.priority }}</b></td><td>{{ severityLabel[defect.severity] || defect.severity }}</td><td><span>{{ defectStatusLabel[defect.status] || defect.status }}</span></td><td>{{ defectAssignee(defect) }}</td><td><code>{{ defect.updatedAt?.slice(0, 16).replace('T', ' ') || '—' }}</code></td><td><button type="button" @click="openDefectDetail(defect.id)">查看</button><button v-if="canLinkDefect" class="is-danger" type="button" @click="emit('unlinkDefect', { caseId: activeId, defectId: defect.id })">取消关联</button></td></tr></tbody></table></div>
            <div v-else class="tp-execution__tab-empty"><Bug :size="36" /><span>暂无关联缺陷</span></div>
          </div>

          <div v-else class="tp-execution__history">
            <div v-if="!history?.length" class="tp-execution__tab-empty"><FileCheck2 :size="36" /><span>该用例尚未执行，暂无历史记录</span></div>
            <article v-for="item in history" :key="item.id"><header><span :style="{ color: statusConfig[normalizeStatus(item.executionStatus)].color }"><i :style="{ backgroundColor: statusConfig[normalizeStatus(item.executionStatus)].dot }" />{{ statusConfig[normalizeStatus(item.executionStatus)].label }}</span><code>{{ item.executedAt?.slice(0, 16).replace('T', ' ') || '—' }}</code><b>执行人：{{ item.executorName || '—' }}</b></header><div><small>执行结果</small><p>{{ item.executionNote || '已完成执行' }}</p></div></article>
          </div>
        </div>

        <footer class="tp-execution__actions">
          <button type="button" :disabled="activeIndex <= 0" @click="move(-1)"><ChevronLeft :size="13" />上一条</button><code><strong>{{ activeIndex + 1 }}</strong>/{{ cases.length }}</code><button type="button" :disabled="activeIndex >= cases.length - 1" @click="move(1)">下一条<ChevronRight :size="13" /></button><i />
          <label><button type="button" role="switch" :aria-checked="autoNext" :class="{ 'is-on': autoNext }" @click="autoNext = !autoNext"><span /></button>自动下一条</label><span />
          <button v-if="canCreateDefect" class="is-defect" type="button" @click="emit('createDefect', activeId)"><Star :size="13" />添加缺陷</button><i v-if="canCreateDefect" />
          <button class="is-blocked" type="button" :disabled="submitting || !canExecute" @click="mark('BLOCKED')">标记阻塞</button><button class="is-failed" type="button" :disabled="submitting || !canExecute" @click="mark('FAILED')">标记失败</button><button class="is-passed" type="button" :disabled="submitting || !canExecute" @click="mark('PASSED')"><Check :size="14" />{{ submitting ? '保存中…' : '标记通过' }}</button>
        </footer>
      </main>
    </div>

    <TestPlanCaseEditDrawer
      v-if="caseEditOpen && activeCase"
      :case-item="activeCase"
      :submitting="submitting"
      @close="caseEditOpen = false"
      @submit="emit('editCase', { caseId: String(activeCase.id), ...$event })"
    />
    <TestPlanLinkDefectDialog
      v-if="linkDefectOpen && canLinkDefect"
      :defects="defects"
      :linked-ids="activeDefects.map(item => item.id)"
      :submitting="submitting"
      @close="linkDefectOpen = false"
      @confirm="linkDefectOpen = false; $event.forEach(defectId => emit('linkDefect', { caseId: activeId, defectId }))"
    />
    <DefectDetailDrawer
      v-if="defectDetailId"
      v-model="defectDetailOpen"
      :defect-id="defectDetailId"
      :workspace-code="props.workspaceCode || 'ALL'"
    />
  </section>
</template>

<style scoped>
.tp-execution { display: flex; width: 100%; height: calc(100dvh - 42px); min-height: 620px; overflow: hidden; flex-direction: column; color: #1d2129; background: #f4f6fa; font-family: inherit; }
.tp-execution * { box-sizing: border-box; }
.tp-execution button,.tp-execution input,.tp-execution textarea { font-family: inherit; }
.tp-execution__header { display: flex; height: 52px; flex: 0 0 auto; align-items: center; gap: 10px; padding: 0 20px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.tp-execution__header > button:first-child { display: flex; align-items: center; gap: 4px; padding: 0; border: 0; color: #86909c; background: transparent; font-size: 12px; cursor: pointer; transition: color 120ms ease; }
.tp-execution__header > button:first-child:hover { color: #0ea5e9; }
.tp-execution__header > i { width: 1px; height: 16px; background: #e5e6eb; }
.tp-execution__status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
.tp-execution__status i { width: 5px; height: 5px; border-radius: 50%; }
.tp-execution__header > code { color: #c9cdd4; font-family: Cousine, ui-monospace, monospace; font-size: 11px; }
.tp-execution__header > strong { flex: 1; overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.tp-execution__edit { display: flex; height: 28px; align-items: center; gap: 5px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; background: #fff; font-size: 13px; cursor: pointer; transition: color 120ms ease, background-color 120ms ease; }
.tp-execution__edit:hover { color: #0ea5e9; background: #f4f6fa; }
.tp-execution__empty { display: flex; flex: 1; align-items: center; justify-content: center; color: #c9cdd4; font-size: 13px; }
.tp-execution__body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.tp-execution__queue { display: flex; width: 260px; flex: 0 0 auto; overflow: hidden; flex-direction: column; border-right: 1px solid #e5e6eb; background: #fff; }
.tp-execution__search { position: relative; height: 49px; flex: 0 0 auto; padding: 10px 12px; border-bottom: 1px solid #e5e6eb; }
.tp-execution__search svg { position: absolute; top: 18px; left: 20px; color: #c9cdd4; pointer-events: none; }
.tp-execution__search input { width: 100%; height: 28px; padding: 0 8px 0 26px; border: 1px solid #e5e6eb; border-radius: 6px; outline: 0; color: #1d2129; font-size: 12px; }
.tp-execution__search input:focus { border-color: #0ea5e9; }
.tp-execution__filters { display: flex; min-height: 42px; flex: 0 0 auto; align-items: center; gap: 4px; padding: 8px 12px; overflow-x: auto; border-bottom: 1px solid #e5e6eb; scrollbar-width: none; }
.tp-execution__filters button { height: 22px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 10px; color: #86909c; background: transparent; font-size: 11px; white-space: nowrap; cursor: pointer; }
.tp-execution__filters button.is-active { border-color: #0ea5e9; color: #0ea5e9; background: rgb(14 165 233 / 7%); font-weight: 600; }
.tp-execution__case-list { flex: 1; min-height: 0; overflow-y: auto; }
.tp-execution__case-list > button { display: block; width: 100%; min-height: 60.8px; padding: 10px 14px 10px 11px; border: 0; border-bottom: 1px solid #e5e6eb; border-left: 3px solid transparent; color: #1d2129; background: #fff; text-align: left; cursor: pointer; transition: background-color 120ms ease; }
.tp-execution__case-list > button:hover { background: #f4f6fa; }
.tp-execution__case-list > button.is-active { border-left-color: #0ea5e9; background: rgb(14 165 233 / 2%); }
.tp-execution__case-list button > span { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.tp-execution__case-list code { color: #86909c; font-family: Cousine, ui-monospace, monospace; font-size: 11px; font-weight: 500; }
.tp-execution__case-list button.is-active code,.tp-execution__case-list button.is-active > strong { color: #0ea5e9; }
.tp-execution__case-list span > i { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 10px; font-size: 11px; font-style: normal; font-weight: 500; }
.tp-execution__case-list span > i b { width: 5px; height: 5px; border-radius: 50%; }
.tp-execution__case-list button > strong { display: -webkit-box; overflow: hidden; color: #1d2129; font-size: 12px; font-weight: 400; line-height: 16.8px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.tp-execution__case-list > p { margin: 0; padding: 32px 12px; color: #c9cdd4; font-size: 12px; text-align: center; }
.tp-execution__queue > footer { display: flex; height: 34px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 8px 14px; border-top: 1px solid #e5e6eb; background: #fafafa; color: #86909c; font-size: 11px; }
.tp-execution__queue > footer b { font-weight: 600; }.tp-execution__queue > footer .is-passed { color: #00b42a; }.tp-execution__queue > footer .is-failed { color: #f53f3f; }.tp-execution__queue > footer .is-blocked { color: #ff7d00; }
.tp-execution__queue > footer code { color: #86909c; font-family: Cousine, ui-monospace, monospace; }.tp-execution__queue > footer code strong { color: #1d2129; }
.tp-execution__main { display: flex; flex: 1; min-width: 0; overflow: hidden; flex-direction: column; }
.tp-execution__main > nav { display: flex; height: 44px; flex: 0 0 auto; padding: 0 20px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.tp-execution__main > nav button { height: 44px; padding: 0 16px; border: 0; border-bottom: 2px solid transparent; color: #86909c; background: transparent; font-size: 13px; cursor: pointer; transition: color 120ms ease; }
.tp-execution__main > nav button:hover { color: #0ea5e9; }.tp-execution__main > nav button.is-active { border-bottom-color: #0ea5e9; color: #0ea5e9; font-weight: 600; }
.tp-execution__content { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }
.tp-execution__detail { display: flex; flex-direction: column; gap: 16px; }
.tp-execution__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tp-execution__grid > article,.tp-execution__wide-card { min-height: 203.5px; padding: 14px 16px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; }
.tp-execution article h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; color: #1d2129; font-size: 13px; font-weight: 600; line-height: 19.5px; }
.tp-execution article h3::before { width: 3px; height: 14px; border-radius: 2px; background: #0ea5e9; content: ''; }
.tp-execution article p { margin: 0; color: #4e5969; font-size: 13px; line-height: 22.1px; white-space: pre-wrap; }
.tp-execution__grid ol { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tp-execution__grid li { display: flex; align-items: flex-start; gap: 8px; }.tp-execution__grid li b { display: flex; width: 18px; height: 18px; flex: 0 0 auto; align-items: center; justify-content: center; margin-top: 1px; border-radius: 50%; color: #0ea5e9; background: rgb(14 165 233 / 8%); font-size: 10px; }.tp-execution__grid li span { color: #1d2129; font-size: 12px; line-height: 19.2px; }
.tp-execution__grid article.is-editable { display: flex; flex-direction: column; }.tp-execution textarea { width: 100%; resize: none; padding: 8px 10px; border: 1px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; font-size: 13px; line-height: 20.8px; }.tp-execution textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 9%); }.tp-execution__grid textarea { min-height: 140px; flex: 1; }
.tp-execution__wide-card { min-height: 149.4px; }.tp-execution__wide-card textarea { height: 82px; }.tp-execution__wide-card.is-evidence { min-height: 191px; }
.tp-execution__defect-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }.tp-execution__defect-actions button { display: flex; height: 28px; align-items: center; gap: 5px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; background: #fff; font-size: 13px; cursor: pointer; }.tp-execution__defect-actions button.is-primary { height: 34px; padding: 0 18px; border: 0; border-radius: 8px; color: #fff; background: #0ea5e9; font-weight: 600; }
.tp-execution__defect-table { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; }.tp-execution__defect-table table { width: 100%; border-collapse: collapse; }.tp-execution__defect-table tr { height: 43px; border-bottom: 1px solid #e5e6eb; }.tp-execution__defect-table tr:last-child { border-bottom: 0; }.tp-execution__defect-table th,.tp-execution__defect-table td { padding: 10px 12px; color: #4e5969; font-size: 12px; text-align: left; white-space: nowrap; }.tp-execution__defect-table th { color: #86909c; background: #fafafa; font-weight: 500; }.tp-execution__defect-table td:nth-child(2) { max-width: 320px; overflow: hidden; color: #1d2129; font-size: 13px; text-overflow: ellipsis; }.tp-execution__defect-table code { color: #0ea5e9; font-family: Cousine, ui-monospace, monospace; font-size: 11px; }.tp-execution__defect-table td > b { padding: 2px 6px; border-radius: 4px; color: #0ea5e9; background: rgb(14 165 233 / 8%); font-size: 11px; }.tp-execution__defect-table td > b.is-p0 { color: #f53f3f; background: rgb(245 63 63 / 8%); }.tp-execution__defect-table td > b.is-p1 { color: #ff7d00; background: rgb(255 125 0 / 8%); }.tp-execution__defect-table td button { padding: 2px 4px; border: 0; color: #0ea5e9; background: transparent; font-size: 12px; cursor: pointer; }.tp-execution__defect-table td button.is-danger { margin-left: 6px; color: #f53f3f; }
.tp-execution__tab-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 64px 0; color: #c9cdd4; }.tp-execution__tab-empty span { color: #86909c; font-size: 13px; }
.tp-execution__history article { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; }.tp-execution__history article > header { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }.tp-execution__history header span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; }.tp-execution__history header span i { width: 6px; height: 6px; border-radius: 50%; }.tp-execution__history header code { color: #86909c; font-family: Cousine, ui-monospace, monospace; font-size: 12px; }.tp-execution__history header b { color: #4e5969; font-size: 12px; font-weight: 400; }.tp-execution__history article > div { padding: 12px 16px; }.tp-execution__history small { color: #c9cdd4; font-size: 11px; font-weight: 600; }.tp-execution__history p { margin-top: 4px; color: #1d2129; }
.tp-execution__actions { display: flex; height: 56px; flex: 0 0 auto; align-items: center; gap: 10px; padding: 0 20px; border-top: 1px solid #e5e6eb; background: #fff; }.tp-execution__actions > button { display: flex; height: 32px; align-items: center; gap: 4px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 8px; color: #4e5969; background: #fff; font-size: 13px; cursor: pointer; }.tp-execution__actions > button:disabled { color: #c9cdd4; cursor: not-allowed; opacity: .7; }.tp-execution__actions > code { min-width: 40px; color: #86909c; font-family: Cousine, ui-monospace, monospace; font-size: 13px; text-align: center; }.tp-execution__actions > code strong { color: #1d2129; }.tp-execution__actions > i { width: 1px; height: 20px; background: #e5e6eb; }.tp-execution__actions > span { flex: 1; }.tp-execution__actions label { display: flex; align-items: center; gap: 6px; color: #86909c; font-size: 12px; }.tp-execution__actions label button { position: relative; width: 32px; height: 18px; padding: 0; border: 0; border-radius: 9px; background: #c9cdd4; cursor: pointer; transition: background-color 200ms ease; }.tp-execution__actions label button.is-on { background: #0ea5e9; }.tp-execution__actions label button span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 20%); transition: left 200ms ease; }.tp-execution__actions label button.is-on span { left: 16px; }.tp-execution__actions > button.is-defect:hover { border-color: #f53f3f; color: #f53f3f; }.tp-execution__actions > button.is-blocked { border-color: #ffd595; color: #ff7d00; background: #fff3e8; font-weight: 500; }.tp-execution__actions > button.is-failed { border-color: #fbbbbb; color: #f53f3f; background: #ffe8e8; font-weight: 500; }.tp-execution__actions > button.is-passed { padding: 0 18px; border: 0; color: #fff; background: #00b42a; font-weight: 600; }
 .tp-execution__actions > button.is-defect { min-width: 102px; }
 .tp-execution__actions > button.is-blocked { min-width: 82px; padding: 0 14px; }
 .tp-execution__actions > button.is-failed { min-width: 82px; padding: 0 14px; }
@media (max-width: 1180px) { .tp-execution__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tp-execution__actions { overflow-x: auto; } .tp-execution__actions > span { min-width: 12px; } }
</style>
