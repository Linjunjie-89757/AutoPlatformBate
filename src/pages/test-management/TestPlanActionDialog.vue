<script setup lang="ts">
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Play,
  RefreshCw,
  Trash2,
  X,
} from '@lucide/vue'
import { computed, ref, watch, type Component } from 'vue'

export type TestPlanActionType = 'start' | 'complete' | 'block' | 'resume' | 'cancel' | 'delete'

export interface TestPlanQualityCheck {
  label: string
  target: string
  current: string
  passed: boolean
}

const props = defineProps<{
  action: TestPlanActionType
  planName: string
  qualityChecks?: TestPlanQualityCheck[]
  submitting?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { reason?: string; force?: boolean }]
}>()

const reason = ref('')
const forceReason = ref('')
const reasonError = ref(false)
const showForce = ref(false)

const configs: Record<TestPlanActionType, {
  title: string
  description: string
  confirmLabel: string
  color: string
  icon: Component
  reasonLabel?: string
}> = {
  start: {
    title: '开始测试',
    description: '计划将从「未开始」切换为「进行中」，执行人员可开始提交执行结果。',
    confirmLabel: '开始测试',
    color: '#0ea5e9',
    icon: Play,
  },
  complete: {
    title: '完成计划',
    description: '完成后计划进入「已完成」状态，不可继续执行用例。请确认所有关键指标已满足。',
    confirmLabel: '确认完成',
    color: '#00b42a',
    icon: CheckCircle2,
  },
  block: {
    title: '标记阻塞',
    description: '计划将切换为「已阻塞」，请填写阻塞原因以便团队跟进处理。',
    confirmLabel: '确认阻塞',
    color: '#ff7d00',
    icon: AlertTriangle,
    reasonLabel: '阻塞原因',
  },
  resume: {
    title: '恢复计划',
    description: '计划将从「已阻塞」恢复为「进行中」，执行人员可继续提交结果。',
    confirmLabel: '恢复计划',
    color: '#0ea5e9',
    icon: RefreshCw,
  },
  cancel: {
    title: '取消计划',
    description: '取消后计划进入「已取消」状态，相关数据将保留但不可编辑。',
    confirmLabel: '确认取消',
    color: '#f53f3f',
    icon: Ban,
    reasonLabel: '取消原因',
  },
  delete: {
    title: '删除草稿',
    description: '此操作不可撤回。草稿将被永久删除，关联的用例配置也会同步清除。',
    confirmLabel: '确认删除',
    color: '#f53f3f',
    icon: Trash2,
  },
}

const config = computed(() => configs[props.action])
const checks = computed(() => props.qualityChecks || [])
const passedCount = computed(() => checks.value.filter(item => item.passed).length)
const qualityPassed = computed(() => checks.value.length > 0 && passedCount.value === checks.value.length)
const confirmDisabled = computed(() => Boolean(props.submitting) || (showForce.value && !forceReason.value.trim()))

watch(() => props.action, () => {
  reason.value = ''
  forceReason.value = ''
  reasonError.value = false
  showForce.value = false
}, { immediate: true })

const close = () => {
  if (!props.submitting) emit('close')
}

const confirm = () => {
  if (config.value.reasonLabel && !reason.value.trim()) {
    reasonError.value = true
    return
  }
  if (props.action === 'complete' && !qualityPassed.value && !showForce.value) {
    showForce.value = true
    return
  }
  if (showForce.value && !forceReason.value.trim()) return
  emit('confirm', {
    reason: showForce.value ? forceReason.value.trim() : reason.value.trim() || undefined,
    force: showForce.value || undefined,
  })
}
</script>

<template>
  <div class="tp-action-dialog__layer">
    <section
      class="tp-action-dialog"
      :class="{ 'is-complete': action === 'complete' }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`tp-action-title-${action}`"
    >
      <header>
        <div>
          <strong :id="`tp-action-title-${action}`">{{ config.title }}</strong>
          <small>{{ planName }}</small>
        </div>
        <button v-if="!submitting" type="button" aria-label="关闭" @click="close"><X :size="15" /></button>
      </header>

      <div class="tp-action-dialog__body">
        <div v-if="errorMessage" class="tp-action-dialog__error"><AlertTriangle :size="13" />{{ errorMessage }}</div>
        <div class="tp-action-dialog__summary">
          <span><component :is="config.icon" :size="18" /></span>
          <p>{{ config.description }}</p>
        </div>

        <div v-if="action === 'complete'" class="tp-action-dialog__quality">
          <header><strong>质量检查</strong><span :class="{ 'is-passed': qualityPassed }">{{ passedCount }}/{{ checks.length }} 项达标</span></header>
          <div v-for="item in checks" :key="item.label" :class="{ 'is-passed': item.passed }">
            <CheckCircle2 v-if="item.passed" :size="13" />
            <X v-else :size="13" />
            <strong>{{ item.label }}</strong>
            <small>目标 {{ item.target }}</small>
            <b>{{ item.current }}</b>
          </div>
        </div>

        <div v-if="action === 'complete' && showForce" class="tp-action-dialog__force">
          <p><AlertTriangle :size="13" />存在 {{ checks.length - passedCount }} 项未达标，强制完成需填写原因。</p>
          <label>强制完成原因 <em>*</em></label>
          <textarea v-model="forceReason" rows="3" placeholder="请填写强制完成的业务原因…" />
        </div>

        <div v-if="config.reasonLabel" class="tp-action-dialog__reason">
          <label>{{ config.reasonLabel }} <em>*</em></label>
          <textarea
            v-model="reason"
            rows="3"
            :class="{ 'has-error': reasonError }"
            :placeholder="`请填写${config.reasonLabel}…`"
            @input="reasonError = false"
          />
          <small v-if="reasonError">此项为必填</small>
        </div>
      </div>

      <footer>
        <button class="is-ghost" type="button" :disabled="submitting" @click="close">{{ errorMessage ? '关闭' : '取消' }}</button>
        <button v-if="errorMessage" class="is-retry" type="button" :disabled="submitting" @click="confirm">重试</button>
        <button
          v-if="!errorMessage"
          class="is-primary"
          type="button"
          :disabled="confirmDisabled"
          :style="{ backgroundColor: config.color }"
          @click="confirm"
        >
          <RefreshCw v-if="submitting" class="is-spinning" :size="13" />
          <component :is="config.icon" v-else :size="13" />
          {{ submitting ? '处理中…' : config.confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.tp-action-dialog__layer { position: fixed; z-index: 3200; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(29 33 41 / 45%); }
.tp-action-dialog { width: 440px; max-width: calc(100vw - 32px); overflow: hidden; border-radius: 16px; color: #1d2129; background: #fff; box-shadow: 0 20px 60px rgb(0 0 0 / 18%); font-family: inherit; }
.tp-action-dialog.is-complete { width: 520px; }
.tp-action-dialog * { box-sizing: border-box; }
.tp-action-dialog > header { display: flex; height: 56px; align-items: center; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.tp-action-dialog > header > div { flex: 1; min-width: 0; }
.tp-action-dialog > header strong { display: block; font-size: 15px; font-weight: 700; line-height: 22.5px; }
.tp-action-dialog > header small { display: block; overflow: hidden; margin-top: 1px; color: #86909c; font-size: 11px; font-weight: 400; line-height: 16.5px; text-overflow: ellipsis; white-space: nowrap; }
.tp-action-dialog > header button { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; transition: color 120ms ease, background-color 120ms ease; }
.tp-action-dialog > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-action-dialog__body { padding: 24px; }
.tp-action-dialog__error { display: flex; align-items: center; gap: 7px; margin-bottom: 14px; padding: 9px 12px; border: 1px solid rgb(245 63 63 / 25%); border-radius: 8px; color: #f53f3f; background: rgb(245 63 63 / 5%); font-size: 12px; }
.tp-action-dialog__summary { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
.tp-action-dialog__summary > span { display: flex; width: 40px; height: 40px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 10px; color: #0ea5e9; background: rgb(14 165 233 / 7%); }
.tp-action-dialog__summary p { flex: 1; margin: 4px 0 0; color: #1d2129; font-size: 13px; font-weight: 400; line-height: 22.1px; }
.tp-action-dialog__quality { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 10px; }
.tp-action-dialog__quality > header { display: flex; height: 38px; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.tp-action-dialog__quality > header strong { color: #4e5969; font-size: 12px; font-weight: 600; }
.tp-action-dialog__quality > header span { color: #ff7d00; font-size: 12px; font-weight: 600; }
.tp-action-dialog__quality > header span.is-passed { color: #00b42a; }
.tp-action-dialog__quality > div { display: flex; min-height: 37px; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #e5e6eb; color: #f53f3f; background: rgb(245 63 63 / 2%); }
.tp-action-dialog__quality > div:last-child { border-bottom: 0; }
.tp-action-dialog__quality > div.is-passed { color: #00b42a; background: rgb(0 180 42 / 2%); }
.tp-action-dialog__quality > div strong { flex: 1; color: #1d2129; font-size: 12px; font-weight: 400; }
.tp-action-dialog__quality > div small { margin-right: 8px; color: #86909c; font-size: 11px; }
.tp-action-dialog__quality > div b { font-size: 12px; font-weight: 600; }
.tp-action-dialog__force { margin-top: 16px; }
.tp-action-dialog__force p { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 10px 14px; border: 1px solid rgb(255 125 0 / 19%); border-radius: 8px; color: #ff7d00; background: rgb(255 125 0 / 6%); font-size: 12px; }
.tp-action-dialog__reason { margin-top: 0; }
.tp-action-dialog label { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; }
.tp-action-dialog label em { color: #f53f3f; font-style: normal; }
.tp-action-dialog textarea { width: 100%; height: 76.5px; resize: none; padding: 8px 10px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; background: #fff; font-family: inherit; font-size: 13px; font-weight: 400; line-height: 19.5px; transition: border-color 150ms ease, box-shadow 150ms ease; }
.tp-action-dialog textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 8%); }
.tp-action-dialog textarea.has-error { border-color: #f53f3f; }
.tp-action-dialog__reason > small { display: block; margin-top: 4px; color: #f53f3f; font-size: 11px; }
.tp-action-dialog > footer { display: flex; min-height: 59px; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 24px; border-top: 1px solid #e5e6eb; }
.tp-action-dialog > footer button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease, opacity 120ms ease; }
.tp-action-dialog > footer button.is-ghost { height: 28px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; background: #fff; font-weight: 500; }
.tp-action-dialog > footer button.is-ghost:hover { color: #1d2129; background: #f4f6fa; }
.tp-action-dialog > footer button.is-retry { height: 34px; padding: 0 18px; border: 1px solid #f53f3f; border-radius: 8px; color: #f53f3f; background: #fff; font-weight: 500; }
.tp-action-dialog > footer button.is-primary { height: 34px; padding: 0 18px; border: 0; color: #fff; font-weight: 600; }
.tp-action-dialog > footer button:disabled { cursor: not-allowed; opacity: .6; }
.is-spinning { animation: tp-action-spin 800ms linear infinite; }
@keyframes tp-action-spin { to { transform: rotate(360deg); } }
</style>
