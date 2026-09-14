<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, X, XCircle } from '@lucide/vue'

import {
  caseApi,
  type CaseDetail,
  type CaseSummaryItem,
  type ReviewCasePayload,
  formatCaseDateTime,
} from '@/entities/case'
import { getRequestErrorMessage } from '@/shared/api/error'
import { AppSwitch } from '@/shared/ui'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    caseItem?: CaseSummaryItem | null
    caseItems?: CaseSummaryItem[]
    workspaceCode?: string
    saving?: boolean
  }>(),
  {
    caseItem: null,
    caseItems: () => [],
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  navigate: [item: CaseSummaryItem]
  submit: [payload: ReviewCasePayload, continueReview: boolean]
}>()

const detail = ref<CaseDetail | null>(null)
const loading = ref(false)
const detailError = ref('')
const rejectNote = ref('')
const formError = ref('')
const autoNext = ref(true)
let detailRequestSeq = 0

const currentStatus = computed(() => detail.value?.reviewStatus || props.caseItem?.reviewStatus || 'PENDING')
const currentReviewComment = computed(() => detail.value?.reviewComment || props.caseItem?.reviewComment || '')
const currentReviewer = computed(() => detail.value?.reviewedByName || props.caseItem?.reviewedByName || '')
const currentReviewedAt = computed(() => formatCaseDateTime(detail.value?.reviewedAt || props.caseItem?.reviewedAt))
const canAct = computed(() => currentStatus.value === 'PENDING' || currentStatus.value === 'REVIEWING')
const isRejected = computed(() => currentStatus.value === 'REJECTED')
const isPassed = computed(() => currentStatus.value === 'PASSED')
const navigationItems = computed(() => {
  const reviewableItems = props.caseItems.filter(item => item.reviewStatus !== 'PASSED')
  if (reviewableItems.length) return reviewableItems
  return props.caseItem ? [props.caseItem] : []
})
const currentIndex = computed(() => navigationItems.value.findIndex(item => item.id === props.caseItem?.id))

const reviewStatusVisual = computed(() => {
  if (currentStatus.value === 'PASSED') {
    return { label: '已通过', className: 'is-passed' }
  }
  if (currentStatus.value === 'REJECTED') {
    return { label: '已驳回', className: 'is-rejected' }
  }
  return { label: '待评审', className: 'is-pending' }
})

const reviewSteps = computed(() => {
  if (!detail.value) return []

  const steps = plainCaseText(detail.value.steps)
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)

  return steps.length ? steps.map(removeStepMarker) : ['—']
})

const hasReviewRecord = computed(() => isPassed.value || isRejected.value)

function removeStepMarker(step: string) {
  return step.replace(/^\s*\d+[.、)]\s*/, '').trim() || '—'
}

function plainCaseText(content: string | null | undefined) {
  if (!content) return ''
  return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function closeDrawer() {
  if (!props.saving) emit('update:modelValue', false)
}

function handleDrawerVisibleChange(value: boolean) {
  if (!value && props.saving) return
  emit('update:modelValue', value)
}

function navigateCase(offset: number) {
  if (props.saving) return

  const nextItem = navigationItems.value[currentIndex.value + offset]
  if (!nextItem) return

  resetState()
  emit('navigate', nextItem)
}

function submitPassed() {
  if (props.saving) return
  formError.value = ''
  emit('submit', { reviewStatus: 'PASSED', reviewComment: rejectNote.value.trim() }, autoNext.value)
}

function submitReReview() {
  if (props.saving) return
  resetState()
  emit('submit', { reviewStatus: 'PENDING', reviewComment: '' }, false)
}

function submitRejected() {
  if (props.saving) return

  const comment = rejectNote.value.trim()
  if (!comment) {
    formError.value = '请填写驳回原因'
    return
  }

  formError.value = ''
  emit('submit', { reviewStatus: 'REJECTED', reviewComment: comment }, autoNext.value)
}

function resetState() {
  rejectNote.value = ''
  formError.value = ''
  autoNext.value = true
}

async function loadDetail() {
  if (!props.caseItem) return

  const requestSeq = ++detailRequestSeq
  loading.value = true
  detailError.value = ''
  detail.value = null
  try {
    const nextDetail = await caseApi.getCaseDetail(props.caseItem.id, props.workspaceCode)
    if (requestSeq === detailRequestSeq) detail.value = nextDetail
  } catch (error) {
    if (requestSeq === detailRequestSeq) detailError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === detailRequestSeq) loading.value = false
  }
}

watch(
  () => [props.modelValue, props.caseItem?.id, props.caseItem, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      resetState()
      void loadDetail()
    } else {
      detailRequestSeq += 1
      detail.value = null
    }
  },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    size="600px"
    :with-header="false"
    drawer-class="case-review-drawer-host"
    @update:model-value="handleDrawerVisibleChange"
  >
    <div class="case-review-drawer">
      <header class="case-review-drawer__header">
        <div>
          <p>
            <code>{{ detail?.caseNo || caseItem?.caseNo || '-' }}</code>
            <span class="case-review-drawer__badge" :class="reviewStatusVisual.className">
              {{ reviewStatusVisual.label }}
            </span>
            <span
              class="case-review-drawer__badge is-priority"
              :class="`is-${String(detail?.priority || caseItem?.priority || 'P2').toLowerCase()}`"
            >
              {{ detail?.priority || caseItem?.priority || 'P2' }}
            </span>
            <small>{{ detail?.caseType || caseItem?.caseType || '功能' }}</small>
          </p>
          <h2>{{ detail?.title || caseItem?.title || '-' }}</h2>
          <div class="case-review-drawer__meta">
            <span>{{ detail?.directoryName || caseItem?.directoryName || '空间根目录' }}</span>
            <span>·</span>
            <span>创建人：{{ detail?.createdByName || caseItem?.createdByName || '-' }}</span>
            <span>·</span>
            <span>{{ formatCaseDateTime(detail?.updatedAt || caseItem?.updatedAt) }}</span>
          </div>
        </div>
        <button type="button" aria-label="关闭" :disabled="saving" @click="closeDrawer">
          <X :size="15" />
        </button>
      </header>

      <div class="case-review-drawer__content">
        <div v-if="loading" class="case-review-drawer__empty-card">正在加载用例详情...</div>
        <div v-else-if="detailError" class="case-review-drawer__empty-card is-error" role="alert">
          <strong>{{ detailError }}</strong>
          <button class="case-review-drawer__button is-ghost is-small" type="button" @click="loadDetail">重新加载</button>
        </div>

        <template v-else-if="detail">
          <section>
            <h3><i />前置条件</h3>
            <p>{{ plainCaseText(detail.precondition) || '—' }}</p>
          </section>

          <section>
            <h3><i />测试步骤</h3>
            <div class="case-review-drawer__steps">
              <div v-for="(step, index) in reviewSteps" :key="`${index}-${step}`">
                <b>{{ index + 1 }}</b>
                <span>{{ step }}</span>
              </div>
            </div>
          </section>

          <section class="is-expected">
            <h3><i />预期结果</h3>
            <p>{{ plainCaseText(detail.expectedResult) || '—' }}</p>
          </section>

          <section v-if="hasReviewRecord" class="case-review-drawer__review-history">
            <h3>评审记录</h3>
            <div class="case-review-drawer__review-entry">
              <div class="case-review-drawer__review-icon" :class="reviewStatusVisual.className">
                <CheckCircle2 v-if="isPassed" :size="13" />
                <XCircle v-else :size="13" />
              </div>
              <div class="case-review-drawer__review-body">
                <div class="case-review-drawer__review-meta">
                  <strong>{{ currentReviewer || '—' }}</strong>
                  <span class="case-review-drawer__review-status" :class="reviewStatusVisual.className">
                    {{ isPassed ? '评审通过' : '评审驳回' }}
                  </span>
                  <small>{{ currentReviewedAt }}</small>
                </div>
                <p v-if="currentReviewComment">{{ currentReviewComment }}</p>
              </div>
            </div>
          </section>
        </template>
      </div>

      <footer v-if="detail && !loading && !detailError">
        <div v-if="canAct" class="case-review-drawer__opinion">
          <h3>审核意见 <span v-if="formError">（驳回必填）</span></h3>
          <textarea
            v-model="rejectNote"
            rows="3"
            maxlength="300"
            placeholder="填写审核意见，驳回时必填…"
            :class="{ 'is-error': formError }"
            @input="formError = ''"
          />
          <p v-if="formError" class="case-review-drawer__form-error" role="alert">{{ formError }}</p>
        </div>
        <div class="case-review-drawer__footer-row">
          <template v-if="!isPassed">
            <div class="case-review-drawer__navigation">
              <button type="button" :disabled="saving || currentIndex <= 0" @click="navigateCase(-1)">
                <ChevronLeft :size="13" />上一条
              </button>
              <span>{{ currentIndex >= 0 ? currentIndex + 1 : 1 }} / {{ navigationItems.length || 1 }}</span>
              <button
                type="button"
                :disabled="saving || currentIndex < 0 || currentIndex >= navigationItems.length - 1"
                @click="navigateCase(1)"
              >
                下一条<ChevronRight :size="13" />
              </button>
            </div>
            <div class="case-review-drawer__auto-next">
              <AppSwitch v-model="autoNext" label="自动跳转" tone="success" />
              <span>自动跳转</span>
            </div>
          </template>

          <div class="case-review-drawer__footer-spacer" />
          <div class="case-review-drawer__actions" :class="reviewStatusVisual.className">
            <template v-if="isRejected">
              <p><XCircle :size="15" />已驳回</p>
              <button class="case-review-drawer__button is-ghost" type="button" :disabled="saving" @click="submitPassed">
                <CheckCircle2 :size="12" />{{ saving ? '提交中...' : '撤销并通过' }}
              </button>
            </template>
            <template v-else-if="isPassed">
              <p><CheckCircle2 :size="15" />已通过</p>
              <button class="case-review-drawer__button is-ghost" type="button" :disabled="saving" @click="submitReReview">
                <RotateCcw :size="12" />{{ saving ? '提交中...' : '发起重新评审' }}
              </button>
            </template>
            <template v-else>
              <button class="case-review-drawer__button is-reject" type="button" :disabled="saving" @click="submitRejected">驳回</button>
              <button class="case-review-drawer__button is-success" type="button" :disabled="saving" @click="submitPassed">
                {{ saving ? '提交中...' : '通过' }}
              </button>
            </template>
          </div>
        </div>
      </footer>
    </div>
  </AppDrawer>
</template>

<style scoped>
/* Keep the migrated review surface pixel-compatible with the former requirement drawer. */
:global(.case-review-drawer-host.el-drawer) {
  --case-review-border: #e5e6eb;
  --case-review-danger: #f53f3f;
  --case-review-muted: #86909c;
  --case-review-placeholder: #c9cdd4;
  --case-review-primary: #165dff;
  --case-review-secondary: #4e5969;
  --case-review-success: #00b42a;
  --case-review-text: #1d2129;
  background: #fff;
  box-shadow: -4px 0 28px rgba(0, 0, 0, 0.13);
}

:global(.case-review-drawer-host .el-drawer__body) {
  display: flex;
  padding: 0;
  overflow: hidden;
}

.case-review-drawer {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}

.case-review-drawer__header {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--case-review-border);
  background: #fff;
}

.case-review-drawer__header > div {
  min-width: 0;
  flex: 1;
}

.case-review-drawer__header p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 5px;
}

.case-review-drawer__header h2 {
  margin: 0;
  color: var(--case-review-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
}

.case-review-drawer__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  overflow: hidden;
  color: var(--case-review-muted);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.case-review-drawer__meta span {
  flex: 0 0 auto;
}

.case-review-drawer__meta span:first-child,
.case-review-drawer__meta span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-review-drawer__header code {
  color: var(--case-review-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
}

.case-review-drawer__header small {
  min-width: 0;
  overflow: hidden;
  color: var(--case-review-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-review-drawer__header > button {
  display: flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--case-review-muted);
  background: transparent;
  cursor: pointer;
  font-size: inherit;
  line-height: normal;
  transition: color 120ms ease, background-color 120ms ease;
}

.case-review-drawer__header > button:hover:not(:disabled),
.case-review-drawer__header > button:focus-visible {
  color: var(--case-review-text);
  background: #f4f6fa;
}

.case-review-drawer__header > button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.case-review-drawer__badge {
  display: inline-flex;
  min-height: 18px;
  align-items: center;
  padding: 0 7px;
  border-radius: 4px;
  color: var(--case-review-muted);
  background: #f2f3f5;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.case-review-drawer__badge.is-passed {
  color: var(--case-review-success);
  background: #e8ffea;
}

.case-review-drawer__badge.is-rejected {
  color: var(--case-review-danger);
  background: #ffecec;
}

.case-review-drawer__badge.is-priority {
  font-weight: 700;
}

.case-review-drawer__badge.is-p0 {
  color: #ffffff;
  background: var(--case-review-danger);
}

.case-review-drawer__badge.is-p1 {
  color: #ffffff;
  background: #ff7d00;
}

.case-review-drawer__badge.is-p2 {
  color: #ffffff;
  background: #ffb400;
}

.case-review-drawer__badge.is-p3 {
  color: #ffffff;
  background: var(--case-review-primary);
}

.case-review-drawer__content {
  min-height: 0;
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.case-review-drawer__content > section {
  margin-bottom: 20px;
}

.case-review-drawer__content > section > h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: var(--case-review-secondary);
  font-size: 12px;
  font-weight: 600;
}

.case-review-drawer__content > section > h3 i {
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--case-review-primary);
}

.case-review-drawer__content > section > p {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  color: var(--case-review-secondary);
  background: #f7f8fa;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.case-review-drawer__content > section.is-expected > h3 i {
  background: var(--case-review-success);
}

.case-review-drawer__content > section.is-expected > p {
  border: 1px solid #b7eb8f;
  color: var(--case-review-text);
  background: #f6ffed;
}

.case-review-drawer__steps {
  display: block;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--case-review-border);
  border-radius: 10px;
}

.case-review-drawer__steps > div {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 40px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--case-review-border);
}

.case-review-drawer__steps > div:last-child {
  border-bottom: 0;
}

.case-review-drawer__steps > div:nth-child(odd) {
  background: #fafbfe;
}

.case-review-drawer__steps b {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--case-review-primary);
  background: rgba(22, 93, 255, 0.08);
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
}

.case-review-drawer__steps span {
  min-width: 0;
  flex: 1;
  padding: 0;
  color: var(--case-review-text);
  font-size: 13px;
  line-height: 1.6;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.case-review-drawer__form-error {
  margin: 6px 0 0;
  color: var(--case-review-danger);
  font-size: 11px;
}

.case-review-drawer__empty-card {
  display: flex;
  min-height: 145px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  border: 1.5px dashed var(--case-review-border);
  border-radius: 12px;
  color: var(--case-review-placeholder);
  background: #fff;
  font-size: 13px;
}

.case-review-drawer__empty-card strong {
  max-width: 100%;
  color: var(--case-review-muted);
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.case-review-drawer > footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--case-review-border);
  background: #fff;
}

.case-review-drawer__navigation {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--case-review-border);
}

.case-review-drawer__opinion {
  padding: 14px 20px;
  border-bottom: 1px solid var(--case-review-border);
  background: #f7f8fa;
}

.case-review-drawer__opinion h3 {
  margin: 0 0 7px;
  color: var(--case-review-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-review-drawer__opinion h3 span {
  color: var(--case-review-danger);
  font-weight: 400;
}

.case-review-drawer__opinion textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 60px;
  padding: 8px 10px;
  border: 1px solid var(--case-review-border);
  border-radius: 7px;
  outline: none;
  color: var(--case-review-text);
  background: #fff;
  resize: none;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.case-review-drawer__opinion textarea:focus {
  border-color: rgba(22, 93, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.08);
}

.case-review-drawer__opinion textarea.is-error {
  border-color: var(--case-review-danger);
}

.case-review-drawer__footer-row {
  display: flex;
  min-height: 57px;
  align-items: center;
  padding: 0 20px;
}

.case-review-drawer__footer-row .case-review-drawer__navigation {
  padding: 0;
  border-bottom: 0;
}

.case-review-drawer__footer-row > .case-review-drawer__actions {
  min-height: 0;
  padding: 0;
}

.case-review-drawer__auto-next {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  color: var(--case-review-success);
  font-size: 12px;
  white-space: nowrap;
}

.case-review-drawer__footer-spacer {
  flex: 1;
}

.case-review-drawer__review-history {
  margin-bottom: 0 !important;
}

.case-review-drawer__review-entry {
  display: flex;
  gap: 12px;
}

.case-review-drawer__review-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.case-review-drawer__review-icon.is-passed {
  color: var(--case-review-success);
  background: rgba(0, 180, 42, 0.08);
}

.case-review-drawer__review-icon.is-rejected {
  color: var(--case-review-danger);
  background: rgba(245, 63, 63, 0.08);
}

.case-review-drawer__review-body {
  min-width: 0;
  flex: 1;
}

.case-review-drawer__review-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.case-review-drawer__review-meta strong {
  color: var(--case-review-text);
  font-size: 12px;
  font-weight: 600;
}

.case-review-drawer__review-meta small {
  color: var(--case-review-placeholder);
  font-size: 11px;
}

.case-review-drawer__review-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.case-review-drawer__review-status.is-passed {
  color: var(--case-review-success);
  background: rgba(0, 180, 42, 0.08);
}

.case-review-drawer__review-status.is-rejected {
  color: var(--case-review-danger);
  background: rgba(245, 63, 63, 0.08);
}

.case-review-drawer__review-body p {
  margin: 0;
  color: var(--case-review-secondary);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.case-review-drawer__navigation button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border: 1px solid var(--case-review-border);
  border-radius: 8px;
  color: var(--case-review-secondary);
  background: #fff;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.case-review-drawer__navigation button:hover:not(:disabled) {
  color: var(--case-review-text);
  background: #f4f6fa;
}

.case-review-drawer__navigation button:disabled {
  color: var(--case-review-placeholder);
  cursor: not-allowed;
  opacity: 0.4;
}

.case-review-drawer__navigation span {
  flex: 1;
  color: var(--case-review-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  text-align: center;
}

.case-review-drawer__actions {
  display: flex;
  min-height: 57px;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
}

.case-review-drawer__actions p {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--case-review-muted);
  font-size: 12px;
}

.case-review-drawer__actions.is-passed p {
  color: var(--case-review-success);
  font-size: 13px;
  font-weight: 600;
}

.case-review-drawer__actions.is-rejected p {
  color: var(--case-review-danger);
  font-size: 13px;
  font-weight: 600;
}

.case-review-drawer__button {
  display: inline-flex;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #fff;
  background: var(--case-review-primary);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease, opacity 150ms ease;
}

.case-review-drawer__button.is-small {
  height: 28px;
  padding: 0 10px;
}

.case-review-drawer__button.is-ghost {
  border-color: var(--case-review-border);
  color: var(--case-review-secondary);
  background: #fff;
}

.case-review-drawer__button.is-ghost:hover:not(:disabled) {
  color: var(--case-review-text);
  background: #f4f6fa;
}

.case-review-drawer__button.is-danger {
  background: var(--case-review-danger);
}

.case-review-drawer__button.is-success {
  background: var(--case-review-success);
}

.case-review-drawer__button.is-reject {
  border-color: var(--case-review-danger);
  color: var(--case-review-danger);
  background: rgba(245, 63, 63, 0.03);
}

.case-review-drawer__button.is-reject:hover:not(:disabled) {
  background: #fff0f0;
}

.case-review-drawer__button.is-success:hover:not(:disabled) {
  background: #009a23;
}

.case-review-drawer__button.is-danger:hover:not(:disabled) {
  background: #cb2634;
}

.case-review-drawer__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 600px) {
  :global(.case-review-drawer-host.el-drawer) {
    width: 100% !important;
  }
}
</style>
