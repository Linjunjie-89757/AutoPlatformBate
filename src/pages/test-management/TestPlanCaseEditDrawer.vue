<script setup lang="ts">
import { Save, X } from '@lucide/vue'
import { reactive, watch } from 'vue'

import type { TestPlanCaseItem } from '@/entities/test-management'

const props = defineProps<{ caseItem: TestPlanCaseItem; submitting?: boolean }>()
const emit = defineEmits<{ close: []; submit: [payload: { title: string; module: string; priority: string; precondition: string; steps: string; expectedResult: string }] }>()

const form = reactive({ title: '', module: '', priority: 'P2', precondition: '', steps: '', expectedResult: '' })
const titleError = reactive({ value: false })

const reset = () => {
  form.title = props.caseItem.title
  form.module = props.caseItem.module || ''
  form.priority = props.caseItem.priority || 'P2'
  form.precondition = props.caseItem.precondition || ''
  form.steps = props.caseItem.steps || ''
  form.expectedResult = props.caseItem.expectedResult || ''
  titleError.value = false
}
watch(() => props.caseItem.id, reset, { immediate: true })

const submit = () => {
  titleError.value = !form.title.trim()
  if (titleError.value) return
  emit('submit', { ...form, title: form.title.trim() })
}
</script>

<template>
  <div class="tp-case-edit__layer">
    <button class="tp-case-edit__backdrop" type="button" aria-label="关闭编辑用例" :disabled="submitting" @click="$emit('close')" />
    <section class="tp-case-edit" role="dialog" aria-modal="true" aria-labelledby="tp-case-edit-title">
      <header><div><strong id="tp-case-edit-title">编辑用例</strong><small>{{ caseItem.caseNo }} · 执行快照</small></div><button v-if="!submitting" type="button" aria-label="关闭" @click="$emit('close')"><X :size="15" /></button></header>
      <div class="tp-case-edit__body">
        <label><span>用例标题 <em>*</em></span><input v-model="form.title" :class="{ 'is-error': titleError.value }" type="text" maxlength="120" @input="titleError.value = false"><small v-if="titleError.value">请输入用例标题</small></label>
        <div class="tp-case-edit__split">
          <label><span>所属模块</span><input v-model="form.module" type="text" maxlength="80" /></label>
          <label><span>优先级</span><div class="tp-case-edit__priorities"><button v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority" type="button" :class="[`is-${priority.toLowerCase()}`, { 'is-selected': form.priority === priority }]" :disabled="submitting" @click="form.priority = priority">{{ priority }}</button></div></label>
        </div>
        <label><span>前置条件</span><textarea v-model="form.precondition" rows="3" /></label>
        <label><span>测试步骤</span><textarea v-model="form.steps" rows="7" /></label>
        <label><span>预期结果</span><textarea v-model="form.expectedResult" rows="4" /></label>
      </div>
      <footer><button class="is-ghost" type="button" :disabled="submitting" @click="$emit('close')">取消</button><button class="is-primary" type="button" :disabled="submitting" @click="submit"><Save :size="13" />{{ submitting ? '保存中…' : '保存修改' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.tp-case-edit__layer { position: fixed; z-index: 3260; inset: 0; display: flex; justify-content: flex-end; font-family: inherit; }
.tp-case-edit__backdrop { flex: 1; border: 0; background: rgb(29 33 41 / 35%); cursor: default; }
.tp-case-edit { display: flex; width: 560px; max-width: calc(100vw - 32px); height: 100%; flex-direction: column; color: #1d2129; background: #fff; box-shadow: -4px 0 24px rgb(0 0 0 / 12%); }
.tp-case-edit * { box-sizing: border-box; }
.tp-case-edit > header { display: flex; height: 56px; flex: 0 0 auto; align-items: center; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.tp-case-edit > header > div { flex: 1; min-width: 0; }.tp-case-edit > header strong { display: block; font-size: 15px; font-weight: 700; }.tp-case-edit > header small { display: block; margin-top: 1px; color: #86909c; font-size: 11px; }
.tp-case-edit > header button { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; }.tp-case-edit > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-case-edit__body { display: flex; flex: 1; overflow-y: auto; padding: 24px; flex-direction: column; gap: 16px; }.tp-case-edit label { display: block; }.tp-case-edit label > span { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; }.tp-case-edit em { color: #f53f3f; font-style: normal; }.tp-case-edit input,.tp-case-edit textarea { width: 100%; padding: 8px 10px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; background: #fff; font: 400 13px/20px inherit; resize: vertical; }.tp-case-edit input { height: 34px; }.tp-case-edit input:focus,.tp-case-edit textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 8%); }.tp-case-edit input.is-error { border-color: #f53f3f; }.tp-case-edit label > small { display: block; margin-top: 4px; color: #f53f3f; font-size: 11px; }
.tp-case-edit__split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.tp-case-edit__priorities { display: flex; gap: 6px; }
.tp-case-edit__priorities button { flex: 1; height: 32px; padding: 0; border: 1.5px solid #e5e6eb; border-radius: 6px; color: #4e5969; background: #fff; font: 400 12px inherit; cursor: pointer; transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease; }
.tp-case-edit__priorities button:hover { border-color: #c9cdd4; background: #f7f8fa; }
.tp-case-edit__priorities button.is-selected { font-weight: 700; }
.tp-case-edit__priorities button.is-p0.is-selected { border-color: #f53f3f; color: #f53f3f; background: rgb(245 63 63 / 8%); }
.tp-case-edit__priorities button.is-p1.is-selected { border-color: #ff7d00; color: #ff7d00; background: rgb(255 125 0 / 8%); }
.tp-case-edit__priorities button.is-p2.is-selected { border-color: #0ea5e9; color: #0ea5e9; background: rgb(14 165 233 / 8%); }
.tp-case-edit__priorities button.is-p3.is-selected { border-color: #86909c; color: #86909c; background: rgb(134 144 156 / 8%); }
.tp-case-edit__priorities button:disabled { cursor: not-allowed; opacity: .6; }
.tp-case-edit > footer { display: flex; height: 59px; flex: 0 0 auto; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 24px; border-top: 1px solid #e5e6eb; }.tp-case-edit footer button { display: inline-flex; height: 34px; align-items: center; justify-content: center; gap: 6px; padding: 0 18px; border-radius: 8px; font: 500 13px inherit; cursor: pointer; }.tp-case-edit footer .is-ghost { height: 28px; padding: 0 10.5px; border: 1px solid #e5e6eb; color: #4e5969; background: #fff; }.tp-case-edit footer .is-primary { border: 0; color: #fff; background: #0ea5e9; font-weight: 600; }.tp-case-edit footer button:disabled { cursor: not-allowed; opacity: .6; }
@media (max-width: 760px) { .tp-case-edit { max-width: 100vw; } }
</style>
