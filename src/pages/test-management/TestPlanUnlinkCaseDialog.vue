<script setup lang="ts">
import { Link2, X } from '@lucide/vue'
import { computed, ref } from 'vue'

const props = defineProps<{
  caseTitle: string
  requireReason?: boolean
  submitting?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [reason: string]
}>()

const reason = ref('')
const reasonError = ref(false)
const canSubmit = computed(() => !props.requireReason || Boolean(reason.value.trim()))

const close = () => {
  if (!props.submitting) emit('close')
}

const confirm = () => {
  reasonError.value = props.requireReason && !reason.value.trim()
  if (reasonError.value) return
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <div class="tp-unlink-dialog__layer" @click.self="close">
    <section class="tp-unlink-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-unlink-dialog-title">
      <header><strong id="tp-unlink-dialog-title">解除关联用例</strong><button type="button" aria-label="关闭" :disabled="submitting" @click="close"><X :size="16" /></button></header>
      <main>
        <p v-if="errorMessage" class="tp-unlink-dialog__error">{{ errorMessage }}</p>
        <div class="tp-unlink-dialog__summary">
          <span><Link2 :size="18" /></span>
          <div><p>即将解除用例 <b>「{{ caseTitle }}」</b> 与当前测试计划的关联，用例本身不会被删除。</p><small>解除后可重新从用例库添加。</small></div>
        </div>
        <label v-if="requireReason"><span>解除原因 <em>*</em></span><textarea v-model="reason" rows="3" :class="{ 'has-error': reasonError }" placeholder="请输入运行中计划移除用例的原因" @input="reasonError = false" /><small v-if="reasonError">请输入解除原因</small></label>
      </main>
      <footer><button class="is-ghost" type="button" :disabled="submitting" @click="close">取消</button><button class="is-warning" type="button" :disabled="submitting || !canSubmit" @click="confirm"><X :size="13" />{{ submitting ? '解除中…' : '确认解除' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.tp-unlink-dialog__layer { position: fixed; z-index: 3400; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(29 33 41 / 35%); font-family: inherit; }
.tp-unlink-dialog { width: 420px; overflow: hidden; border-radius: 16px; color: #1d2129; background: #fff; box-shadow: 0 8px 32px rgb(0 0 0 / 16%); }
.tp-unlink-dialog * { box-sizing: border-box; }
.tp-unlink-dialog > header { display: flex; height: 56px; align-items: center; padding: 0 20px; border-bottom: 1px solid #e5e6eb; }
.tp-unlink-dialog > header strong { flex: 1; font-size: 16px; font-weight: 600; line-height: 24px; }
.tp-unlink-dialog > header button { display: flex; padding: 4px; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; transition: color 120ms ease, background-color 120ms ease; }
.tp-unlink-dialog > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-unlink-dialog > main { padding: 20px; }
.tp-unlink-dialog__error { margin: 0 0 14px; padding: 9px 12px; border: 1px solid rgb(245 63 63 / 25%); border-radius: 8px; color: #f53f3f; background: rgb(245 63 63 / 5%); font-size: 12px; line-height: 18px; }
.tp-unlink-dialog__summary { display: flex; gap: 12px; }
.tp-unlink-dialog__summary > span { display: flex; width: 40px; height: 40px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 10px; color: #ff7d00; background: rgb(255 125 0 / 7%); }
.tp-unlink-dialog__summary div { flex: 1; padding-top: 4px; }
.tp-unlink-dialog__summary p { margin: 0; color: #1d2129; font-size: 13px; font-weight: 400; line-height: 20.8px; }
.tp-unlink-dialog__summary b { font-weight: 600; }
.tp-unlink-dialog__summary small { display: block; margin-top: 4px; color: #86909c; font-size: 12px; font-weight: 400; line-height: 18px; }
.tp-unlink-dialog label { display: block; margin-top: 16px; }
.tp-unlink-dialog label > span { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; }
.tp-unlink-dialog label em { color: #f53f3f; font-style: normal; }
.tp-unlink-dialog textarea { width: 100%; resize: none; padding: 8px 10px; border: 1px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; font-family: inherit; font-size: 13px; line-height: 20px; transition: border-color 150ms ease, box-shadow 150ms ease; }
.tp-unlink-dialog textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 8%); }
.tp-unlink-dialog textarea.has-error { border-color: #f53f3f; }
.tp-unlink-dialog label > small { display: block; margin-top: 4px; color: #f53f3f; font-size: 11px; }
.tp-unlink-dialog > footer { display: flex; height: 59px; align-items: center; justify-content: flex-end; gap: 10px; padding: 0 20px; border-top: 1px solid #e5e6eb; }
.tp-unlink-dialog > footer button { display: inline-flex; height: 34px; align-items: center; gap: 6px; padding: 0 18px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: color 120ms ease, background-color 120ms ease, opacity 120ms ease; }
.tp-unlink-dialog > footer .is-ghost { border: 1px solid #e5e6eb; color: #4e5969; background: #fff; font-weight: 500; }
.tp-unlink-dialog > footer .is-ghost:hover { background: #f7f8fa; }
.tp-unlink-dialog > footer .is-warning { border: 0; color: #fff; background: #ff7d00; font-weight: 600; }
.tp-unlink-dialog > footer .is-warning:hover { background: #e66f00; }
.tp-unlink-dialog > footer button:disabled { cursor: not-allowed; opacity: .55; }
</style>
