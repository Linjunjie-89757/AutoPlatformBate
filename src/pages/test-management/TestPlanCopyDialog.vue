<script setup lang="ts">
import { Copy, RefreshCw, X } from '@lucide/vue'
import { reactive, ref, watch } from 'vue'

export interface TestPlanCopyOptions {
  copyRequirements: boolean
  copyRequirementCases: boolean
  copyManualCases: boolean
  copyQualityStandards: boolean
}

const props = defineProps<{
  planName: string
  versionId?: string | null
  versions: Array<{ id: string; name: string; status: string }>
  submitting?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { name: string; targetVersionId: string | null; options: TestPlanCopyOptions }]
}>()

const name = ref('')
const targetVersionId = ref('')
const nameError = ref(false)
const options = reactive<TestPlanCopyOptions>({
  copyRequirements: true,
  copyRequirementCases: false,
  copyManualCases: true,
  copyQualityStandards: false,
})

watch(() => props.planName, (value) => {
  name.value = `副本 — ${value}`
  targetVersionId.value = props.versionId || ''
  nameError.value = false
  Object.assign(options, {
    copyRequirements: true,
    copyRequirementCases: false,
    copyManualCases: true,
    copyQualityStandards: false,
  })
}, { immediate: true })

const close = () => {
  if (!props.submitting) emit('close')
}

const submit = () => {
  if (!name.value.trim()) {
    nameError.value = true
    return
  }
  emit('confirm', {
    name: name.value.trim(),
    targetVersionId: targetVersionId.value || null,
    options: { ...options },
  })
}

const optionItems: Array<{ key: keyof TestPlanCopyOptions; label: string; description: string }> = [
  { key: 'copyRequirements', label: '复制需求范围', description: '将原计划关联的需求一并复制到副本' },
  { key: 'copyRequirementCases', label: '复制需求带入的用例', description: '需求自动关联的用例将同步复制' },
  { key: 'copyManualCases', label: '复制手动添加的用例', description: '手动补充的用例将同步复制' },
  { key: 'copyQualityStandards', label: '复制质量标准', description: '将原计划的质量门槛配置复制到副本' },
]
</script>

<template>
  <div class="tp-copy-dialog__layer">
    <section class="tp-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-copy-dialog-title">
      <header>
        <div><strong id="tp-copy-dialog-title">复制测试计划</strong><small>{{ planName }}</small></div>
        <button v-if="!submitting" type="button" aria-label="关闭" @click="close"><X :size="15" /></button>
      </header>

      <div class="tp-copy-dialog__body">
        <p v-if="errorMessage" class="tp-copy-dialog__error">{{ errorMessage }}</p>
        <label>
          <span>副本名称 <em>*</em></span>
          <input v-model="name" type="text" :class="{ 'has-error': nameError }" placeholder="请输入副本名称" @input="nameError = false">
          <small v-if="nameError">名称为必填项</small>
        </label>
        <label>
          <span>目标版本</span>
          <select v-model="targetVersionId">
            <option value="">不关联版本</option>
            <option v-for="version in versions.filter(item => item.status !== 'archived')" :key="version.id" :value="version.id">{{ version.name }}</option>
          </select>
        </label>
        <div class="tp-copy-dialog__options">
          <strong>复制内容</strong>
          <label v-for="item in optionItems" :key="item.key" :class="{ 'is-selected': options[item.key] }">
            <input v-model="options[item.key]" type="checkbox">
            <span><b>{{ item.label }}</b><small>{{ item.description }}</small></span>
          </label>
        </div>
      </div>

      <footer>
        <button class="is-ghost" type="button" :disabled="submitting" @click="close">{{ errorMessage ? '关闭' : '取消' }}</button>
        <button v-if="errorMessage" class="is-retry" type="button" :disabled="submitting" @click="submit">重试</button>
        <button v-if="!errorMessage" class="is-primary" type="button" :disabled="submitting" @click="submit">
          <RefreshCw v-if="submitting" class="is-spinning" :size="13" /><Copy v-else :size="13" />
          {{ submitting ? '复制中…' : '确认复制' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.tp-copy-dialog__layer { position: fixed; z-index: 3200; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(29 33 41 / 45%); }
.tp-copy-dialog { width: 520px; max-width: calc(100vw - 32px); overflow: hidden; border-radius: 16px; color: #1d2129; background: #fff; box-shadow: 0 20px 60px rgb(0 0 0 / 18%); font-family: inherit; }
.tp-copy-dialog * { box-sizing: border-box; }
.tp-copy-dialog > header { display: flex; height: 56px; align-items: center; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.tp-copy-dialog > header > div { flex: 1; min-width: 0; }
.tp-copy-dialog > header strong { display: block; font-size: 15px; font-weight: 700; line-height: 22.5px; }
.tp-copy-dialog > header small { display: block; overflow: hidden; margin-top: 1px; color: #86909c; font-size: 11px; line-height: 16.5px; text-overflow: ellipsis; white-space: nowrap; }
.tp-copy-dialog > header button { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; transition: color 120ms ease, background-color 120ms ease; }
.tp-copy-dialog > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-copy-dialog__body { display: flex; flex-direction: column; gap: 14px; padding: 24px; }
.tp-copy-dialog__error { margin: 0; padding: 9px 12px; border: 1px solid rgb(245 63 63 / 25%); border-radius: 8px; color: #f53f3f; background: rgb(245 63 63 / 5%); font-size: 12px; }
.tp-copy-dialog__body > label > span,
.tp-copy-dialog__options > strong { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; }
.tp-copy-dialog em { color: #f53f3f; font-style: normal; }
.tp-copy-dialog input[type='text'],
.tp-copy-dialog select { width: 100%; height: 34px; padding: 0 10px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; background: #fff; font-family: inherit; font-size: 13px; font-weight: 400; transition: border-color 150ms ease, box-shadow 150ms ease; }
.tp-copy-dialog input[type='text']:focus,
.tp-copy-dialog select:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 8%); }
.tp-copy-dialog input[type='text'].has-error { border-color: #f53f3f; }
.tp-copy-dialog__body > label > small { display: block; margin-top: 3px; color: #f53f3f; font-size: 11px; }
.tp-copy-dialog__options > strong { margin-bottom: 8px; }
.tp-copy-dialog__options { display: flex; flex-direction: column; }
.tp-copy-dialog__options > label { display: flex; min-height: 59px; align-items: flex-start; gap: 10px; margin-bottom: 8px; padding: 10px 12px; border: 1.5px solid #e5e6eb; border-radius: 8px; background: #fff; cursor: pointer; transition: border-color 150ms ease, background-color 150ms ease; }
.tp-copy-dialog__options > label:last-child { margin-bottom: 0; }
.tp-copy-dialog__options > label.is-selected { border-color: #0ea5e9; background: rgb(14 165 233 / 2%); }
.tp-copy-dialog__options input { width: 13px; height: 13px; margin: 2px 0 0; accent-color: #0ea5e9; }
.tp-copy-dialog__options label > span { flex: 1; }
.tp-copy-dialog__options b { display: block; color: #1d2129; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.tp-copy-dialog__options small { display: block; margin-top: 2px; color: #86909c; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.tp-copy-dialog > footer { display: flex; height: 59px; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 24px; border-top: 1px solid #e5e6eb; }
.tp-copy-dialog > footer button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; font-size: 13px; cursor: pointer; transition: color 120ms ease, background-color 120ms ease, opacity 120ms ease; }
.tp-copy-dialog > footer .is-ghost { height: 28px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; background: #fff; font-weight: 500; }
.tp-copy-dialog > footer .is-ghost:hover { color: #1d2129; background: #f4f6fa; }
.tp-copy-dialog > footer .is-retry { height: 34px; padding: 0 18px; border: 1px solid #f53f3f; border-radius: 8px; color: #f53f3f; background: #fff; font-weight: 500; }
.tp-copy-dialog > footer .is-primary { height: 34px; padding: 0 18px; border: 0; border-radius: 8px; color: #fff; background: #0ea5e9; font-weight: 600; }
.tp-copy-dialog > footer button:disabled { cursor: not-allowed; opacity: .65; }
.is-spinning { animation: tp-copy-spin 800ms linear infinite; }
@keyframes tp-copy-spin { to { transform: rotate(360deg); } }
</style>
