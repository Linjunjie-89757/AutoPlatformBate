<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  type CaseDetail,
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
} from '@/entities/case'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    caseId?: number | null
    workspaceCode?: string
    canEdit?: boolean
  }>(),
  {
    caseId: null,
    workspaceCode: 'ALL',
    canEdit: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [item: CaseDetail]
}>()

const detail = ref<CaseDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const activeTab = ref<'detail' | 'history' | 'defects'>('detail')
let detailRequestSeq = 0

function closeDrawer() {
  emit('update:modelValue', false)
}

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

const detailSteps = computed(() => {
  const value = detail.value?.steps
  if (!value) {
    return []
  }

  return String(value)
    .split(/\r?\n|；|;/)
    .map(item => item.trim())
    .filter(Boolean)
})

function getReviewStatusVisual(status: string) {
  if (status === 'PASSED') return { label: '已确认', tone: 'success' }
  if (status === 'REJECTED') return { label: '不通过', tone: 'danger' }
  return { label: '待确认', tone: 'warning' }
}

function getExecutionStatusVisual(status: string) {
  if (status === 'PASSED') return { label: '通过', tone: 'success' }
  if (status === 'FAILED') return { label: '失败', tone: 'danger' }
  if (status === 'BLOCKED') return { label: '阻塞', tone: 'warning' }
  return { label: '未执行', tone: 'default' }
}

function getSourceLabel(sourceType: string) {
  if (sourceType === 'AI_GENERATED' || sourceType === 'AI') return 'AI 生成'
  if (sourceType === 'IMPORTED') return '导入'
  return '人工创建'
}

function emitEdit() {
  if (props.canEdit && detail.value) {
    emit('edit', detail.value)
  }
}

async function loadDetail() {
  if (!props.caseId) {
    return
  }

  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    const nextDetail = await caseApi.getCaseDetail(props.caseId, props.workspaceCode)
    if (requestSeq === detailRequestSeq) {
      detail.value = nextDetail
    }
  } catch (error) {
    if (requestSeq === detailRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === detailRequestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => [props.modelValue, props.caseId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      activeTab.value = 'detail'
      void loadDetail()
    }
  },
  { immediate: true },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    size="680px"
    :with-header="false"
    drawer-class="case-detail-figma-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-detail-drawer">
      <AppLoadingState v-if="loading && !detail" text="正在加载用例详情..." />

      <AppEmptyState v-else-if="errorMessage && !detail" title="用例详情加载失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="loadDetail">重试</AppButton>
        </template>
      </AppEmptyState>

      <template v-else-if="detail">
        <div v-if="errorMessage" class="case-detail-drawer__inline-error">
          {{ errorMessage }}
          <AppButton size="small" @click="loadDetail">重试</AppButton>
        </div>

        <header class="case-detail-drawer__hero">
          <div class="case-detail-drawer__hero-main">
            <div class="case-detail-drawer__status-row">
              <span class="case-detail-drawer__code">{{ detail.caseNo }}</span>
              <span
                class="case-detail-drawer__review"
                :class="`is-${getReviewStatusVisual(detail.reviewStatus).tone}`"
              >
                {{ getReviewStatusVisual(detail.reviewStatus).label }}
              </span>
              <span
                class="case-detail-drawer__execution"
                :class="`is-${getExecutionStatusVisual(detail.executionStatus).tone}`"
              >
                <span class="case-detail-drawer__execution-dot" />
                {{ getExecutionStatusVisual(detail.executionStatus).label }}
              </span>
            </div>
            <h3>{{ detail.title }}</h3>
          </div>
          <div class="case-detail-drawer__hero-actions">
            <button v-if="canEdit" type="button" class="case-detail-drawer__outline-button" @click="emitEdit">
              <img :src="figmaCaseIcons.action.edit" alt="" />
              编辑
            </button>
            <button type="button" class="case-detail-drawer__close" aria-label="关闭" @click="closeDrawer">×</button>
          </div>
        </header>

        <nav class="case-detail-drawer__tabs" aria-label="用例详情导航">
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'detail' }"
            @click="activeTab = 'detail'"
          >
            用例详情
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'history' }"
            @click="activeTab = 'history'"
          >
            执行记录
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeTab === 'defects' }"
            @click="activeTab = 'defects'"
          >
            关联缺陷（0）
          </button>
        </nav>

        <div class="case-detail-drawer__body">
          <template v-if="activeTab === 'detail'">
            <section class="case-detail-drawer__info">
              <dl class="case-detail-drawer__meta">
                <div>
                  <dt>所属目录</dt>
                  <dd>{{ getCaseDirectoryText(detail) }}</dd>
                </div>
                <div>
                  <dt>用例类型</dt>
                  <dd>{{ displayText(detail.caseType) }}</dd>
                </div>
                <div>
                  <dt>优先级</dt>
                  <dd>
                    <span class="case-detail-drawer__priority" :class="`is-${String(detail.priority || 'p2').toLowerCase()}`">
                      {{ detail.priority || 'P2' }}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd class="is-muted">{{ getSourceLabel(detail.sourceType) }}</dd>
                </div>
                <div>
                  <dt>创建人</dt>
                  <dd>{{ displayText(detail.createdByName || detail.ownerName) }}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{{ formatCaseDateTime(detail.updatedAt) }}</dd>
                </div>
              </dl>
            </section>

            <section class="case-detail-drawer__section">
              <h4>前置条件</h4>
              <p class="case-detail-drawer__text case-detail-drawer__text--soft">{{ displayText(detail.precondition) }}</p>
            </section>

            <section class="case-detail-drawer__section">
              <h4>测试步骤</h4>
              <div class="case-detail-drawer__steps">
                <div
                  v-for="(step, index) in detailSteps"
                  :key="`${index}-${step}`"
                  class="case-detail-drawer__step"
                >
                  <span>{{ index + 1 }}</span>
                  <p>{{ step }}</p>
                </div>
                <div v-if="!detailSteps.length" class="case-detail-drawer__step">
                  <span>1</span>
                  <p>-</p>
                </div>
              </div>
            </section>

            <section class="case-detail-drawer__section">
              <h4>预期结果</h4>
              <p class="case-detail-drawer__text case-detail-drawer__text--success">{{ displayText(detail.expectedResult) }}</p>
            </section>
          </template>

          <section v-else-if="activeTab === 'history'" class="case-detail-drawer__tab-panel">
            <dl class="case-detail-drawer__meta">
              <div>
                <dt>执行时间</dt>
                <dd>{{ formatCaseDateTime(detail.executedAt) }}</dd>
              </div>
              <div>
                <dt>执行备注</dt>
                <dd>{{ displayText(detail.executionComment || detail.executionNote) }}</dd>
              </div>
            </dl>
          </section>

          <section v-else class="case-detail-drawer__tab-panel">
            <AppEmptyState title="暂无关联缺陷" description="当前用例列表接口暂未返回关联缺陷明细。" />
          </section>
        </div>
      </template>
    </div>
  </AppDrawer>
</template>

<style scoped>
:global(.case-detail-figma-drawer.el-drawer) {
  background: #ffffff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

:global(.case-detail-figma-drawer .el-drawer__body) {
  padding: 0;
}

.case-detail-drawer {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #ffffff;
}

.case-detail-drawer__hero {
  display: flex;
  min-height: 74px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 21px 15px;
  border-bottom: 1px solid #e5e6eb;
}

.case-detail-drawer__hero-main {
  min-width: 0;
  flex: 1 1 auto;
}

.case-detail-drawer__status-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.case-detail-drawer__hero h3 {
  max-width: 420px;
  margin: 3.5px 0 0;
  overflow: hidden;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 20.625px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-detail-drawer__code {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  line-height: 16.5px;
}

.case-detail-drawer__review {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 1.75px 7px;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.case-detail-drawer__review.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.case-detail-drawer__review.is-warning {
  background: #fff7e8;
  color: #ff7d00;
}

.case-detail-drawer__review.is-danger {
  background: #ffece8;
  color: #f53f3f;
}

.case-detail-drawer__execution {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.case-detail-drawer__execution-dot {
  width: 5.25px;
  height: 5.25px;
  border-radius: 50%;
  background: #c9cdd4;
}

.case-detail-drawer__execution.is-success {
  color: #00b42a;
}

.case-detail-drawer__execution.is-success .case-detail-drawer__execution-dot {
  background: #00b42a;
}

.case-detail-drawer__execution.is-danger {
  color: #f53f3f;
}

.case-detail-drawer__execution.is-danger .case-detail-drawer__execution-dot {
  background: #f53f3f;
}

.case-detail-drawer__execution.is-warning {
  color: #ff7d00;
}

.case-detail-drawer__execution.is-warning .case-detail-drawer__execution-dot {
  background: #ff7d00;
}

.case-detail-drawer__hero-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.case-detail-drawer__outline-button,
.case-detail-drawer__primary-button,
.case-detail-drawer__close {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  font-family: inherit;
  cursor: pointer;
}

.case-detail-drawer__outline-button {
  height: 28px;
  gap: 5.25px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.case-detail-drawer__primary-button {
  height: 32px;
  gap: 5.25px;
  padding: 0 14px;
  border-radius: 7px;
  background: #165dff;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.case-detail-drawer__outline-button img,
.case-detail-drawer__primary-button img {
  width: 13px;
  height: 13px;
}

.case-detail-drawer__close {
  width: 24.5px;
  height: 24.5px;
  border-radius: 7px;
  background: transparent;
  color: #c9cdd4;
  font-size: 18px;
  font-weight: 500;
  line-height: 27px;
}

.case-detail-drawer__tabs {
  display: flex;
  align-items: flex-start;
  height: 36px;
  padding: 0 21px 1px;
  border-bottom: 1px solid #e5e6eb;
}

.case-detail-drawer__tabs button {
  appearance: none;
  height: 35px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  cursor: pointer;
}

.case-detail-drawer__tabs button.is-active {
  border-bottom-color: #165dff;
  color: #165dff;
}

.case-detail-drawer__body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 17.5px 21px;
}

.case-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
  padding-top: 17.5px;
}

.case-detail-drawer__section h4 {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-detail-drawer__info {
  height: 158px;
  border-bottom: 1px solid #e5e6eb;
}

.case-detail-drawer__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 21px;
  row-gap: 10.5px;
  margin: 0;
}

.case-detail-drawer__meta div {
  min-width: 0;
}

.case-detail-drawer__meta dt {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.case-detail-drawer__meta dd {
  margin: 3.5px 0 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  overflow-wrap: anywhere;
}

.case-detail-drawer__meta dd.is-muted {
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.case-detail-drawer__priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 25.75px;
  height: 17.5px;
  padding: 0 7px;
  border-radius: 3.5px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.case-detail-drawer__priority.is-p0 {
  background: #f53f3f;
}

.case-detail-drawer__priority.is-p1 {
  background: #ff7d00;
}

.case-detail-drawer__priority.is-p2 {
  background: #ffb400;
}

.case-detail-drawer__priority.is-p3 {
  background: #86909c;
}

.case-detail-drawer__text {
  margin: 0;
  width: 100%;
  padding: 8.75px 10.5px;
  border-radius: 7px;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.case-detail-drawer__text--soft {
  background: #f7f8fa;
}

.case-detail-drawer__text--success {
  padding: 11.5px 15px;
  border: 1px solid #b7eb8f;
  background: #f6ffed;
}

.case-detail-drawer__steps {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
}

.case-detail-drawer__step {
  display: flex;
  gap: 10.5px;
  align-items: flex-start;
  min-height: 41.5px;
  padding: 10.5px 14px 11.5px;
  border-bottom: 1px solid #e5e6eb;
}

.case-detail-drawer__step:last-child {
  border-bottom: 0;
}

.case-detail-drawer__step span {
  display: inline-flex;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.case-detail-drawer__step p {
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.case-detail-drawer__tab-panel {
  padding-top: 4px;
}

.case-detail-drawer__inline-error {
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

@media (max-width: 720px) {
  .case-detail-drawer__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .case-detail-drawer__hero-actions {
    justify-content: flex-start;
  }

  .case-detail-drawer__meta {
    grid-template-columns: 1fr;
  }
}
</style>
