<script setup lang="ts">
import { X } from '@lucide/vue'

import type { TestPlanCaseItem } from '@/entities/test-management'

const props = defineProps<{ caseItem: TestPlanCaseItem }>()
defineEmits<{ close: [] }>()

const statusConfig: Record<string, { label: string; color: string; background: string; dot: string }> = {
  PENDING: { label: '未执行', color: '#86909c', background: '#f2f3f5', dot: '#c9cdd4' },
  PASSED: { label: '通过', color: '#00b42a', background: 'rgb(0 180 42 / 8%)', dot: '#00b42a' },
  FAILED: { label: '失败', color: '#f53f3f', background: 'rgb(245 63 63 / 7%)', dot: '#f53f3f' },
  BLOCKED: { label: '阻塞', color: '#ff7d00', background: 'rgb(255 125 0 / 8%)', dot: '#ff7d00' },
  SKIPPED: { label: '跳过', color: '#86909c', background: '#f2f3f5', dot: '#c9cdd4' },
}

const status = () => statusConfig[String(props.caseItem.executionStatus).toUpperCase()] || statusConfig.PENDING
const lines = (value?: string | null) => (value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)
const steps = () => lines(props.caseItem.steps)
</script>

<template>
  <div class="tp-case-drawer__layer">
    <aside class="tp-case-drawer" role="dialog" aria-modal="true" aria-labelledby="tp-case-drawer-title">
      <header>
        <div class="tp-case-drawer__heading">
          <div class="tp-case-drawer__meta-line">
            <code>{{ caseItem.caseNo }}</code>
            <span :style="{ color: status().color, backgroundColor: status().background }"><i :style="{ backgroundColor: status().dot }" />{{ status().label }}</span>
            <b :class="`is-${caseItem.priority.toLowerCase()}`">{{ caseItem.priority }}</b>
            <small>{{ caseItem.module || '未分类' }}</small>
          </div>
          <strong id="tp-case-drawer-title">{{ caseItem.title }}</strong>
        </div>
        <button type="button" aria-label="关闭" @click="$emit('close')"><X :size="15" /></button>
      </header>

      <div v-if="caseItem.executionStatus !== 'PENDING'" class="tp-case-drawer__execution-strip">
        <span>执行人：<b>{{ caseItem.assigneeName || '未分配' }}</b></span>
        <span>执行时间：<b class="is-mono">{{ caseItem.executedAt?.slice(0, 16).replace('T', ' ') || '—' }}</b></span>
        <span v-if="caseItem.executionNote">备注：<b>{{ caseItem.executionNote }}</b></span>
      </div>

      <div class="tp-case-drawer__body">
        <section>
          <h3>前置条件</h3>
          <p class="tp-case-drawer__precondition">{{ caseItem.precondition || '—' }}</p>
        </section>

        <section>
          <h3>测试步骤</h3>
          <div class="tp-case-drawer__steps">
            <div class="tp-case-drawer__step-head"><span>#</span><span>操作步骤</span><span>预期结果</span></div>
            <div v-for="(item, index) in steps()" :key="`${index}-${item}`" class="tp-case-drawer__step-row">
              <span>{{ index + 1 }}</span>
              <p>{{ item }}</p>
              <p>{{ index === steps().length - 1 ? caseItem.expectedResult || '—' : '—' }}</p>
            </div>
            <div v-if="!steps().length" class="tp-case-drawer__step-empty">—</div>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.tp-case-drawer__layer { position: fixed; z-index: 3250; inset: 0; display: flex; justify-content: flex-end; pointer-events: none; font-family: inherit; }
.tp-case-drawer { display: flex; width: 480px; max-width: calc(100vw - 32px); height: 100%; min-height: 0; flex-direction: column; pointer-events: auto; color: #1d2129; background: #fff; box-shadow: -4px 0 24px rgb(0 0 0 / 12%); }
.tp-case-drawer * { box-sizing: border-box; }
.tp-case-drawer > header { display: flex; min-height: 82px; flex: 0 0 auto; align-items: flex-start; gap: 10px; padding: 16px 20px; border-bottom: 1px solid #e5e6eb; }
.tp-case-drawer__heading { flex: 1; min-width: 0; }
.tp-case-drawer__meta-line { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.tp-case-drawer__meta-line code { flex: 0 0 auto; color: #86909c; font-family: Cousine, ui-monospace, monospace; font-size: 11px; }
.tp-case-drawer__meta-line span { display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.tp-case-drawer__meta-line span i { width: 5px; height: 5px; border-radius: 50%; }
.tp-case-drawer__meta-line b { flex: 0 0 auto; padding: 1px 6px; border-radius: 4px; color: #0ea5e9; background: rgb(14 165 233 / 8%); font-size: 11px; font-weight: 700; }
.tp-case-drawer__meta-line b.is-p0 { color: #f53f3f; background: rgb(245 63 63 / 8%); }
.tp-case-drawer__meta-line b.is-p1 { color: #ff7d00; background: rgb(255 125 0 / 8%); }
.tp-case-drawer__meta-line small { flex: 0 0 auto; color: #86909c; font-size: 11px; }
.tp-case-drawer__heading > strong { display: block; overflow: hidden; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 21px; text-overflow: ellipsis; white-space: nowrap; }
.tp-case-drawer > header button { display: flex; width: 28px; height: 28px; flex: 0 0 auto; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; }
.tp-case-drawer > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-case-drawer__execution-strip { display: flex; min-height: 42px; flex: 0 0 auto; align-items: center; gap: 20px; padding: 10px 20px; border-bottom: 1px solid #e5e6eb; background: #fafafa; flex-wrap: wrap; }
.tp-case-drawer__execution-strip span { color: #86909c; font-size: 12px; }
.tp-case-drawer__execution-strip b { color: #4e5969; font-weight: 500; }
.tp-case-drawer__execution-strip b.is-mono { font-family: Cousine, ui-monospace, monospace; }
.tp-case-drawer__body { display: flex; min-height: 0; flex: 1; overflow-y: auto; padding: 20px; flex-direction: column; gap: 20px; }
.tp-case-drawer section h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; color: #4e5969; font-size: 12px; font-weight: 600; }
.tp-case-drawer section h3::before { width: 3px; height: 12px; flex: 0 0 auto; border-radius: 2px; background: #0ea5e9; content: ''; }
.tp-case-drawer__precondition { margin: 0; padding: 10px 14px; border-radius: 8px; color: #4e5969; background: #f4f6fa; font-size: 13px; line-height: 22.1px; white-space: pre-wrap; }
.tp-case-drawer__steps { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; }
.tp-case-drawer__step-head,.tp-case-drawer__step-row { display: grid; grid-template-columns: 32px 1fr 1fr; }
.tp-case-drawer__step-head { border-bottom: 1px solid #e5e6eb; background: #f7f8fa; }
.tp-case-drawer__step-head span { padding: 8px 12px; color: #86909c; font-size: 11px; font-weight: 600; }
.tp-case-drawer__step-head span + span,.tp-case-drawer__step-row > * + * { border-left: 1px solid #e5e6eb; }
.tp-case-drawer__step-row { border-bottom: 1px solid #e5e6eb; background: #fff; }
.tp-case-drawer__step-row:nth-child(odd) { background: #fafbfe; }
.tp-case-drawer__step-row:last-child { border-bottom: 0; }
.tp-case-drawer__step-row > span { padding: 10px 12px; color: #86909c; font-size: 12px; font-weight: 600; }
.tp-case-drawer__step-row p { margin: 0; padding: 10px 12px; color: #1d2129; font-size: 13px; line-height: 20.8px; white-space: pre-wrap; }
.tp-case-drawer__step-row p:last-child { color: #4e5969; }
.tp-case-drawer__step-empty { padding: 24px; color: #c9cdd4; font-size: 13px; text-align: center; }
@media (max-width: 600px) { .tp-case-drawer { max-width: 100vw; } }
</style>
