<script setup lang="ts">
import { AlertTriangle, Clock3, Code2, Save, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import type { ApiScenarioStep } from '@/entities/api-automation'
import { AppDialog, AppDrawer } from '@/shared/ui'

const props = defineProps<{ initialStep: ApiScenarioStep; isNew: boolean }>()
const emit = defineEmits<{ close: []; save: [step: ApiScenarioStep] }>()
const draft = ref(structuredClone(props.initialStep))
const confirmClose = ref(false)
const error = ref('')
const optionalAssertion = ref<'VARIABLE' | 'SCRIPT'>('VARIABLE')
const assertionVariable = ref('')
const assertionCondition = ref('EQUALS')
const assertionExpected = ref('')
const assertionScript = ref('')
const isScript = computed(() => draft.value.stepType === 'SCRIPT')
const title = computed(() => (props.isNew ? '新建' : '配置') + (isScript.value ? '脚本' : '等待'))
const subtitle = computed(() => isScript.value ? '执行 JavaScript 脚本' : '等待指定时间（ms）')
const dirty = computed(() => props.isNew || JSON.stringify(draft.value) !== JSON.stringify(props.initialStep))
function close() { if (dirty.value) confirmClose.value = true; else emit('close') }
function save() {
  const name = draft.value.stepName.trim()
  if (!name) { error.value = '请输入步骤名称。'; return }
  if (isScript.value && !draft.value.script?.trim()) { error.value = '请输入 JavaScript 脚本。'; return }
  if (!isScript.value && (!Number.isFinite(Number(draft.value.delayMs)) || Number(draft.value.delayMs) < 1 || Number(draft.value.delayMs) > 60000)) { error.value = '等待时长必须在 1–60000ms 之间。'; return }
  error.value = ''
  const next = { ...JSON.parse(JSON.stringify(draft.value)), stepName: name, delayMs: isScript.value ? undefined : Math.round(Number(draft.value.delayMs)) }
  if (isScript.value && (assertionVariable.value.trim() || assertionExpected.value.trim() || assertionScript.value.trim())) {
    next.assertions = optionalAssertion.value === 'VARIABLE'
      ? [{ id: 'assertion-' + Date.now(), name: '变量断言', assertionType: 'VARIABLE', variableAssertionItems: [{ variableName: assertionVariable.value, condition: assertionCondition.value, expectedValue: assertionExpected.value, enabled: true }], enabled: true }]
      : [{ id: 'assertion-' + Date.now(), name: '脚本断言', assertionType: 'SCRIPT', script: assertionScript.value, enabled: true }]
  }
  emit('save', next)
}
function clampDelay(event: Event) { const value = Number((event.target as HTMLInputElement).value); draft.value.delayMs = Number.isFinite(value) ? Math.min(60000, Math.max(1, Math.round(value))) : 1000 }
</script>

<template>
  <AppDrawer :model-value="true" size="720px" variant="standard" :with-header="true" :show-close="false" drawer-class="scenario-simple-step-drawer" modal-class="scenario-simple-step-overlay" :close-on-click-modal="false" @update:model-value="value => !value && close()">
    <template #header><header class="simple-step__header"><span class="simple-step__icon" :class="{ 'is-wait': !isScript }"><Code2 v-if="isScript" :size="18" /><Clock3 v-else :size="18" /></span><div><h3>{{ title }}</h3><p>{{ subtitle }}</p></div><button type="button" aria-label="关闭" @click="close"><X :size="17" /></button></header></template>
    <div class="simple-step__body">
      <section class="simple-step__card"><label>步骤名称 <em>*</em><input v-model="draft.stepName" /></label></section>
      <section v-if="isScript" class="simple-step__card simple-step__script-card"><div class="simple-step__label-row"><label>JavaScript 脚本 <em>*</em></label><span>运行超时固定为 10 秒</span></div><textarea v-model="draft.script" aria-label="JavaScript 脚本" placeholder="// 独立脚本步骤没有上一步响应上下文&#10;variables.set(&quot;status&quot;, &quot;READY&quot;);" spellcheck="false"></textarea><div class="simple-step__api-hints"><code>variables.get</code><code>variables.set</code><code>log</code><code>fail</code></div></section>
      <section v-if="isScript" class="simple-step__card simple-step__assert-card"><label>可选断言</label><div class="simple-step__assert-types"><button type="button" :class="{ 'is-active': optionalAssertion === 'VARIABLE' }" @click="optionalAssertion = 'VARIABLE'">变量断言</button><button type="button" :class="{ 'is-active': optionalAssertion === 'SCRIPT' }" @click="optionalAssertion = 'SCRIPT'">脚本断言</button></div><div v-if="optionalAssertion === 'VARIABLE'" class="simple-step__assert-fields"><input v-model="assertionVariable" placeholder="变量名" aria-label="变量名"><select v-model="assertionCondition" aria-label="比较条件"><option value="EQUALS">等于</option><option value="NOT_EQUALS">不等于</option><option value="CONTAINS">包含</option></select><input v-model="assertionExpected" placeholder="期望值" aria-label="期望值"></div><textarea v-else v-model="assertionScript" class="simple-step__assert-script" placeholder="使用 fail(...) 表示断言失败。" aria-label="断言脚本"></textarea></section>
      <section v-else class="simple-step__card simple-step__wait-card"><label>等待时长 <em>*</em><div class="simple-step__delay"><input :value="draft.delayMs ?? 1000" type="number" min="1" max="60000" aria-label="等待时长" @input="clampDelay"><span>ms</span></div><small>允许范围 1–60000ms，默认 1000ms。</small></label></section>
      <p v-if="error" class="simple-step__error" role="alert">{{ error }}</p>
    </div>
    <template #footer><span class="simple-step__status">{{ dirty ? '存在未保存的修改' : '所有修改已保存' }}</span><button type="button" class="simple-step__cancel" @click="close">取消</button><button type="button" class="simple-step__save" @click="save"><Save :size="13" />保存并添加</button></template>
  </AppDrawer>
  <AppDialog v-model="confirmClose" title="放弃未保存的修改？" width="400px" variant="standard" dialog-class="simple-step-discard-dialog" modal-class="simple-step-discard-overlay" align-center :show-close="false">
    <div class="simple-step__discard">
      <span><AlertTriangle :size="17" /></span>
      <div><h4>放弃未保存的修改？</h4><p>关闭后，本次填写的配置将不会保留。</p></div>
    </div>
    <div class="simple-step__discard-actions">
      <button type="button" class="simple-step__cancel" @click="confirmClose = false">继续编辑</button>
      <button type="button" class="simple-step__save is-danger" @click="emit('close')">放弃修改</button>
    </div>
  </AppDialog>
</template>

<style scoped>
:global(.el-overlay.scenario-simple-step-overlay){background:rgb(29 33 41 / 38%)}
:global(.el-drawer.scenario-simple-step-drawer){font-family:Inter,"Noto Sans SC",sans-serif}
:global(.scenario-simple-step-drawer .el-drawer__header){min-height:72px;margin:0;padding:0;border-bottom:1px solid #e5e6eb}
:global(.scenario-simple-step-drawer .el-drawer__body){display:flex;min-height:0;padding:0;overflow:hidden}
:global(.scenario-simple-step-drawer .el-drawer__footer){padding:0}
:global(.scenario-simple-step-drawer .app-drawer__footer){box-sizing:border-box;height:61px;align-items:center;padding:14px 20px;border-top-color:#e5e6eb}
.simple-step__header{display:flex;width:100%;height:72px;box-sizing:border-box;align-items:center;gap:12px;padding:0 20px}
.simple-step__icon{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#fff7e8;color:#ff7d00}
.simple-step__icon.is-wait{background:#f4f6fa;color:#64748b}
.simple-step__header h3{margin:0;color:#1d2129;font-size:15px;font-weight:600;line-height:22.5px}
.simple-step__header p{margin:1px 0 0;color:#86909c;font-size:11px;line-height:16.5px}
.simple-step__header button{display:grid;width:32px;height:32px;place-items:center;margin-left:auto;border:0;border-radius:8px;background:transparent;color:#86909c}
.simple-step__header button:hover{background:#f2f3f5}
.simple-step__body{flex:1;overflow:auto;padding:20px;background:#fafbfe}
.simple-step__card{padding:16px;border:1px solid #e5e6eb;border-radius:14px;background:#fff}
.simple-step__card+.simple-step__card{margin-top:16px}
.simple-step__card label,.simple-step__label-row label{display:block;color:#4e5969;font-size:12px;font-weight:500;line-height:18px}
.simple-step__card em{color:#f53f3f;font-style:normal}
.simple-step__card input,.simple-step__card textarea{box-sizing:border-box;width:100%;margin-top:6px;border:1px solid #e5e6eb;border-radius:8px;background:#fff;color:#1d2129;font:400 12px/18px Inter,"Noto Sans SC",sans-serif;outline:none}
.simple-step__card input{height:34px;padding:0 10px}
.simple-step__card input:focus,.simple-step__card textarea:focus{border-color:#165dff}
.simple-step__label-row{display:flex;align-items:center;justify-content:space-between}
.simple-step__label-row span{color:#c9cdd4;font-size:11px}
.simple-step__script-card textarea{display:block;height:309px;min-height:205px;padding:12px;resize:vertical;background:#101827;color:#dde7f4;font:400 11px/17.6px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
.simple-step__script-card textarea::placeholder{color:#86909c}
.simple-step__api-hints{display:flex;gap:8px;margin-top:12px}
.simple-step__api-hints code{padding:4px 8px;border-radius:4px;background:#f4f6fa;color:#86909c;font:400 10px/15px ui-monospace,monospace}
.simple-step__assert-card{margin-top:16px}
.simple-step__assert-types{display:flex;gap:8px;margin-top:10px}
.simple-step__assert-types button{height:32px;padding:0 12px;border:1px solid #e5e6eb;border-radius:8px;background:#fff;color:#4e5969;font:400 11px/16.5px Inter,"Noto Sans SC",sans-serif}
.simple-step__assert-types button.is-active{border-color:#165dff;background:#e8f3ff;color:#165dff}
.simple-step__assert-fields{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px}
.simple-step__assert-fields input,.simple-step__assert-fields select{box-sizing:border-box;width:100%;height:34px;margin:0;padding:0 10px;border:1px solid #e5e6eb;border-radius:8px;background:#fff;color:#1d2129;font:400 12px/18px Inter,"Noto Sans SC",sans-serif}
.simple-step__assert-script{height:118px!important;min-height:118px!important;margin-top:12px!important;border:1px solid #e5e6eb!important;background:#fff!important;color:#4e5969!important;font:400 11px/17.6px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;resize:vertical}
.simple-step__wait-card{min-height:90px}
.simple-step__delay{display:flex;width:360px;max-width:100%;gap:8px;align-items:center;margin:8px auto 0}
.simple-step__delay input{flex:1}
.simple-step__delay span{display:grid;width:48px;height:34px;place-items:center;margin-top:6px;border:1px solid #e5e6eb;border-radius:8px;color:#86909c;font-size:12px}
.simple-step__wait-card small{display:block;margin-top:8px;color:#c9cdd4;font-size:11px;line-height:16.5px}
.simple-step__error{margin:16px 0 0;color:#f53f3f;font-size:12px}
.simple-step__status{margin-right:auto;color:#c9cdd4;font-size:11px}
.simple-step__cancel,.simple-step__save{display:inline-flex;height:32px;align-items:center;justify-content:center;gap:6px;padding:0 14px;border-radius:10px;font:500 12px/18px Inter,"Noto Sans SC",sans-serif}
.simple-step__cancel{border:1px solid #e5e6eb;background:#fff;color:#4e5969}
.simple-step__save{border:0;background:#165dff;color:#fff}
.simple-step__save.is-danger{background:#f53f3f}
:global(.el-overlay.simple-step-discard-overlay){background:rgb(29 33 41 / 48%)}
:global(.el-dialog.simple-step-discard-dialog){max-width:calc(100% - 32px);border-radius:16px;box-shadow:0 25px 50px -12px rgb(0 0 0 / 25%)}
:global(.el-dialog.simple-step-discard-dialog > .el-dialog__header){display:none}
:global(.el-dialog.simple-step-discard-dialog > .el-dialog__body){padding:20px}
.simple-step__discard{display:flex;align-items:flex-start;gap:12px}
.simple-step__discard span{display:grid;width:36px;height:36px;flex:none;place-items:center;border-radius:50%;background:#fff3e8;color:#ff7d00}
.simple-step__discard h4{margin:0;color:#1d2129;font-size:14px;font-weight:600}
.simple-step__discard p{margin:4px 0 0;color:#86909c;font-size:12px;line-height:20px}
.simple-step__discard-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:20px}
.simple-step__discard-actions .simple-step__cancel{height:28px;padding:0 12px;border-radius:8px;font-size:12px}
.simple-step__discard-actions .simple-step__save.is-danger{height:32px;padding:0 14px;border-radius:8px;font-size:13px}
</style>
