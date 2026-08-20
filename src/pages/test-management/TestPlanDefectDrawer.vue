<script setup lang="ts">
import { Bold, ChevronDown, Image, Italic, Link, List, ListOrdered, Minus, Paperclip, Strikethrough, Table2, Underline, Upload, X } from '@lucide/vue'
import { reactive, ref, watch } from 'vue'

export interface TestPlanDefectCaseOption {
  id: string
  no: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  precondition?: string | null
  steps?: string | null
  expectedResult?: string | null
  notes?: string | null
}

export interface TestPlanDefectOwnerOption {
  id: number
  name: string
}

export interface TestPlanDefectSubmitPayload {
  caseId: string
  title: string
  description: string
  tags: string[]
  files: File[]
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  assigneeId: number
}

const props = defineProps<{
  cases: TestPlanDefectCaseOption[]
  owners: TestPlanDefectOwnerOption[]
  initialCaseId?: string | null
  resetToken?: number
  submitting?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: TestPlanDefectSubmitPayload, continueCreate: boolean]
  unsupported: [feature: string]
}>()

const titleError = ref(false)
const descriptionError = ref(false)
const assigneeError = ref(false)
const caseError = ref(false)
const attachmentInput = ref<HTMLInputElement | null>(null)
const attachments = ref<File[]>([])
const form = reactive({
  caseId: '',
  title: '',
  description: '',
  priority: 'P1' as TestPlanDefectSubmitPayload['priority'],
  severity: 'HIGH' as TestPlanDefectSubmitPayload['severity'],
  assigneeId: '',
  tags: '',
})

const actualResultFromNote = (note?: string | null) => {
  if (!note) return '（请填写实际观察到的现象）'
  const matched = note.match(/实际结果：\s*\n?([\s\S]*?)(?:\n\n执行备注：|$)/)
  return matched?.[1]?.trim() || note.trim()
}

const buildDescription = (caseItem?: TestPlanDefectCaseOption) => caseItem
  ? `用例标题：${caseItem.title}\n\n前置条件：\n${caseItem.precondition || '（请填写）'}\n\n测试步骤：\n${caseItem.steps || '（请填写）'}\n\n预期结果：\n${caseItem.expectedResult || '（请填写）'}\n\n实际结果：\n${actualResultFromNote(caseItem.notes)}`
  : ''

const reset = () => {
  const initial = props.cases.find(item => item.id === props.initialCaseId)
  form.caseId = initial?.id || ''
  form.title = initial ? `【${initial.no}】${initial.title}` : ''
  form.description = buildDescription(initial)
  form.priority = initial?.priority === 'P0' ? 'P0' : 'P1'
  form.severity = form.priority === 'P0' ? 'CRITICAL' : 'HIGH'
  form.assigneeId = ''
  form.tags = ''
  attachments.value = []
  titleError.value = false
  descriptionError.value = false
  assigneeError.value = false
  caseError.value = false
}

watch(() => [props.initialCaseId, props.cases.length], reset, { immediate: true })
watch(() => props.resetToken, () => {
  form.title = ''
  form.description = ''
  titleError.value = false
  descriptionError.value = false
})

const close = () => {
  if (!props.submitting) emit('close')
}

const selectCase = () => {
  caseError.value = false
  const selected = props.cases.find(item => item.id === form.caseId)
  if (!selected) return
  form.title = `【${selected.no}】${selected.title}`
  form.description = buildDescription(selected)
  form.priority = selected.priority === 'P0' ? 'P0' : 'P1'
  form.severity = form.priority === 'P0' ? 'CRITICAL' : 'HIGH'
}

const submit = (continueCreate: boolean) => {
  caseError.value = !form.caseId
  titleError.value = !form.title.trim()
  descriptionError.value = !form.description.trim()
  assigneeError.value = !form.assigneeId
  if (caseError.value || titleError.value || descriptionError.value || assigneeError.value) return
  emit('submit', {
    caseId: form.caseId,
    title: form.title.trim(),
    description: form.description.trim(),
    tags: form.tags.split(/[,，\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 10),
    files: attachments.value,
    priority: form.priority,
    severity: form.severity,
    assigneeId: Number(form.assigneeId),
  }, continueCreate)
}
</script>

<template>
  <div class="tp-defect-drawer__layer">
    <button class="tp-defect-drawer__backdrop" type="button" aria-label="关闭创建缺陷" :disabled="submitting" @click="close" />
    <section class="tp-defect-drawer" role="dialog" aria-modal="true" aria-labelledby="tp-defect-drawer-title">
      <header><strong id="tp-defect-drawer-title">创建缺陷</strong><button type="button" aria-label="关闭" :disabled="submitting" @click="close"><X :size="18" /></button></header>
      <div class="tp-defect-drawer__body">
        <main>
          <p v-if="errorMessage" class="tp-defect-drawer__error">{{ errorMessage }}</p>
          <label class="tp-defect-drawer__field">
            <span>关联用例 <em>*</em></span>
            <select v-model="form.caseId" :class="{ 'has-error': caseError }" @change="selectCase">
              <option value="">请选择失败或阻塞用例</option>
              <option v-for="item in cases" :key="item.id" :value="item.id">{{ item.no }} {{ item.title }}</option>
            </select>
            <small v-if="caseError"><i>请选择关联用例</i></small>
          </label>
          <label class="tp-defect-drawer__field">
            <span>缺陷标题 <em>*</em></span>
            <input v-model="form.title" maxlength="120" type="text" :class="{ 'has-error': titleError }" placeholder="简要描述缺陷现象" @input="titleError = false">
            <small><i v-if="titleError">请输入缺陷标题</i><b>{{ form.title.length }} / 120</b></small>
          </label>

          <label class="tp-defect-drawer__field is-description">
            <span>缺陷描述 <em>*</em></span>
            <div class="tp-defect-drawer__editor" :class="{ 'has-error': descriptionError }">
              <div class="tp-defect-drawer__toolbar">
                <button type="button">正文<ChevronDown :size="10" /></button><button type="button">默认<ChevronDown :size="10" /></button><i />
                <button type="button" aria-label="加粗"><Bold :size="12" /></button><button type="button" aria-label="斜体"><Italic :size="12" /></button><button type="button" aria-label="下划线"><Underline :size="12" /></button><button type="button" aria-label="删除线"><Strikethrough :size="12" /></button><i />
                <button type="button" aria-label="无序列表"><List :size="13" /></button><button type="button" aria-label="有序列表"><ListOrdered :size="13" /></button><button type="button" aria-label="插入表格"><Table2 :size="13" /></button><button type="button" aria-label="插入链接"><Link :size="13" /></button><button type="button" aria-label="插入图片"><Image :size="13" /></button><button type="button" aria-label="插入附件"><Paperclip :size="13" /></button><button type="button" aria-label="插入分隔线"><Minus :size="13" /></button>
              </div>
              <textarea v-model="form.description" @input="descriptionError = false" />
            </div>
          </label>

          <div class="tp-defect-drawer__attachment">
            <span>附件 / 截图</span>
            <input ref="attachmentInput" type="file" multiple hidden @change="attachments = Array.from(($event.target as HTMLInputElement).files || [])" />
            <button type="button" :disabled="submitting" @click="attachmentInput?.click()"><Upload :size="22" /><strong>{{ attachments.length ? `已选择 ${attachments.length} 个文件` : '点击上传，或将文件拖拽至此处' }}</strong><small>支持图片 / 文档，截图可直接粘贴 (Ctrl+V)，单文件不超过 10 MB</small></button>
          </div>
        </main>

        <aside>
          <div class="tp-defect-drawer__field"><span>优先级 <em>*</em></span><div class="tp-defect-drawer__priorities"><button v-for="item in ['P0','P1','P2','P3']" :key="item" type="button" :class="[`is-${item.toLowerCase()}`, { 'is-selected': form.priority === item }]" @click="form.priority = item as TestPlanDefectSubmitPayload['priority']">{{ item }}</button></div></div>
          <label class="tp-defect-drawer__field"><span>严重级别 <em>*</em></span><select v-model="form.severity"><option value="CRITICAL">致命</option><option value="HIGH">严重</option><option value="MEDIUM">一般</option><option value="LOW">轻微</option></select></label>
          <label class="tp-defect-drawer__field"><span>处理人 <em>*</em></span><select v-model="form.assigneeId" :class="{ 'has-error': assigneeError }" @change="assigneeError = false"><option value="">请选择处理人</option><option v-for="owner in owners" :key="owner.id" :value="String(owner.id)">{{ owner.name }}</option></select></label>
          <label class="tp-defect-drawer__field"><span>标签</span><input v-model="form.tags" type="text" placeholder="多个标签用空格或逗号分隔"></label>
        </aside>
      </div>
      <footer><button class="is-ghost" type="button" :disabled="submitting" @click="close">取消</button><button class="is-secondary" type="button" :disabled="submitting" @click="submit(true)">保存并继续创建</button><button class="is-primary" type="button" :disabled="submitting" @click="submit(false)">{{ submitting ? '创建中…' : '创建' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.tp-defect-drawer__layer { position: fixed; z-index: 3300; inset: 0; display: flex; font-family: inherit; }
.tp-defect-drawer__backdrop { flex: 1; border: 0; background: rgb(29 33 41 / 35%); cursor: default; }
.tp-defect-drawer { display: flex; width: 860px; max-width: calc(100vw - 40px); height: 100%; flex-direction: column; color: #1d2129; background: #fff; box-shadow: -4px 0 12px rgb(0 0 0 / 12%); }
.tp-defect-drawer * { box-sizing: border-box; }
.tp-defect-drawer > header { display: flex; height: 56px; flex: 0 0 auto; align-items: center; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.tp-defect-drawer > header strong { flex: 1; font-size: 16px; font-weight: 600; line-height: 24px; }
.tp-defect-drawer > header button { display: flex; padding: 4px; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; transition: color 120ms ease, background-color 120ms ease; }
.tp-defect-drawer > header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-defect-drawer__body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.tp-defect-drawer__body > main { display: flex; flex: 1; min-width: 0; overflow-y: auto; flex-direction: column; gap: 20px; padding: 24px; border-right: 1px solid #e5e6eb; }
.tp-defect-drawer__body > aside { display: flex; width: 232px; flex: 0 0 auto; overflow-y: auto; flex-direction: column; gap: 20px; padding: 24px 20px; }
.tp-defect-drawer__error { margin: 0; padding: 9px 12px; border: 1px solid rgb(245 63 63 / 25%); border-radius: 8px; color: #f53f3f; background: rgb(245 63 63 / 5%); font-size: 12px; }
.tp-defect-drawer__field { display: block; }
.tp-defect-drawer__field > span,
.tp-defect-drawer__attachment > span { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; line-height: 18px; }
.tp-defect-drawer__field em { color: #f53f3f; font-style: normal; }
.tp-defect-drawer__field > input,
.tp-defect-drawer__field > select { width: 100%; height: 34px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; background: #fff; font-family: inherit; font-size: 13px; font-weight: 400; transition: border-color 150ms ease, box-shadow 150ms ease; }
.tp-defect-drawer__field > input:focus,
.tp-defect-drawer__field > select:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgb(14 165 233 / 8%); }
.tp-defect-drawer__field > .has-error { border-color: #f53f3f; }
.tp-defect-drawer__field > small { display: flex; min-height: 19.5px; justify-content: space-between; padding-top: 3px; font-size: 11px; line-height: 16.5px; }
.tp-defect-drawer__field > small i { color: #f53f3f; font-style: normal; }
.tp-defect-drawer__field > small b { margin-left: auto; color: #c9cdd4; font-weight: 400; }
.tp-defect-drawer__field.is-description { display: flex; min-height: 220px; flex: 1; flex-direction: column; }
.tp-defect-drawer__editor { display: flex; min-height: 406.5px; flex: 1; overflow: hidden; flex-direction: column; border: 1px solid #e5e6eb; border-radius: 8px; }
.tp-defect-drawer__editor.has-error { border-color: #f53f3f; }
.tp-defect-drawer__toolbar { display: flex; min-height: 35px; align-items: center; gap: 2px; padding: 5px 10px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.tp-defect-drawer__toolbar button { display: inline-flex; min-width: 24px; height: 24px; align-items: center; justify-content: center; gap: 3px; padding: 0 6px; border: 0; border-radius: 4px; color: #4e5969; background: transparent; font-family: inherit; font-size: 11px; cursor: pointer; }
.tp-defect-drawer__toolbar button:nth-child(-n+2) { border: 1px solid #e5e6eb; background: #fff; }
.tp-defect-drawer__toolbar button:hover { background: #f2f3f5; }
.tp-defect-drawer__toolbar > i { width: 1px; height: 14px; margin: 0 4px; background: #e5e6eb; }
.tp-defect-drawer__editor textarea { flex: 1; min-height: 369.5px; resize: none; padding: 12px 14px; border: 0; outline: 0; color: #1d2129; background: #fff; font-family: inherit; font-size: 13px; font-weight: 400; line-height: 23.4px; white-space: pre-wrap; }
.tp-defect-drawer__attachment > button { display: flex; width: 100%; min-height: 131px; align-items: center; justify-content: center; flex-direction: column; padding: 28px 12px; border: 2px dashed #e5e6eb; border-radius: 8px; color: #c9cdd4; background: #fafafa; cursor: pointer; transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease; }
.tp-defect-drawer__attachment > button:hover { border-color: #0ea5e9; color: #0ea5e9; background: rgb(14 165 233 / 2%); }
.tp-defect-drawer__attachment strong { margin-top: 8px; color: #4e5969; font-size: 13px; font-weight: 400; line-height: 19.5px; }
.tp-defect-drawer__attachment small { margin-top: 4px; color: #c9cdd4; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.tp-defect-drawer__priorities { display: flex; gap: 6px; }
.tp-defect-drawer__priorities button { height: 30px; flex: 1; padding: 0; border: 1px solid #e5e6eb; border-radius: 6px; color: #86909c; background: #fff; font-family: inherit; font-size: 12px; cursor: pointer; }
.tp-defect-drawer__priorities button.is-selected { font-weight: 700; }
.tp-defect-drawer__priorities .is-p0.is-selected { border-color: #f53f3f; color: #f53f3f; background: rgb(245 63 63 / 7%); }
.tp-defect-drawer__priorities .is-p1.is-selected { border-color: #ff7d00; color: #ff7d00; background: rgb(255 125 0 / 7%); }
.tp-defect-drawer__priorities .is-p2.is-selected { border-color: #0ea5e9; color: #0ea5e9; background: rgb(14 165 233 / 7%); }
.tp-defect-drawer__priorities .is-p3.is-selected { border-color: #86909c; color: #86909c; background: rgb(134 144 156 / 7%); }
.tp-defect-drawer__field.is-disabled input { color: #c9cdd4; background: #fafafa; cursor: not-allowed; }
.tp-defect-drawer > footer { display: flex; height: 56px; flex: 0 0 auto; align-items: center; justify-content: flex-end; gap: 10px; padding: 0 24px; border-top: 1px solid #e5e6eb; }
.tp-defect-drawer > footer button { height: 34px; padding: 0 18px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: color 120ms ease, background-color 120ms ease, opacity 120ms ease; }
.tp-defect-drawer > footer .is-ghost { height: 28px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; background: #fff; font-weight: 500; }
.tp-defect-drawer > footer .is-secondary { border: 1px solid #e5e6eb; color: #4e5969; background: #fff; font-weight: 500; }
.tp-defect-drawer > footer .is-primary { border: 0; color: #fff; background: #0ea5e9; font-weight: 600; }
.tp-defect-drawer > footer .is-primary:hover { background: #0288c7; }
.tp-defect-drawer > footer button:disabled { cursor: not-allowed; opacity: .6; }
@media (max-width: 760px) { .tp-defect-drawer { max-width: 100vw; } .tp-defect-drawer__body > aside { width: 210px; } }
</style>
