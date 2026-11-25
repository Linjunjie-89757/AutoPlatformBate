<script setup lang="ts">
import { AlertTriangle, ChevronRight, GripVertical, Layers, MoreHorizontal, Plus, Repeat, Save, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import type { ApiScenarioStep } from '@/entities/api-automation'
import { AppDialog, AppDrawer, AppSwitch } from '@/shared/ui'

const props = withDefaults(defineProps<{ initialStep: ApiScenarioStep; isNew: boolean; depth?: number }>(), { depth: 0 })
const emit = defineEmits<{
  close: []
  save: [step: ApiScenarioStep]
  requestAddChild: []
  childrenChange: [children: ApiScenarioStep[]]
}>()

const draft = ref(structuredClone(props.initialStep))
const error = ref('')
const confirmClose = ref(false)
const dirty = computed(() => props.isNew || JSON.stringify(draft.value) !== JSON.stringify(props.initialStep))
const loopType = computed(() => draft.value.loopType || 'FIXED')
const children = computed(() => draft.value.children || [])

watch(() => props.initialStep.children, value => {
  draft.value.children = structuredClone(value || [])
}, { deep: true })

function close() {
  if (dirty.value) confirmClose.value = true
  else emit('close')
}

function setLoopType(value: 'FIXED' | 'WHILE' | 'FOREACH') {
  draft.value.loopType = value
  if (value === 'FIXED' && !Number.isFinite(Number(draft.value.loopCount))) draft.value.loopCount = 1
}

function emitChildrenChange() {
  emit('childrenChange', JSON.parse(JSON.stringify(draft.value.children || [])))
}

function toggleChild(index: number, enabled: boolean) {
  const child = draft.value.children?.[index]
  if (!child) return
  child.enabled = enabled
  emitChildrenChange()
}

function syncChildren(value: ApiScenarioStep[]) {
  draft.value.children = structuredClone(value)
}

defineExpose({ syncChildren })

function childLabel(step: ApiScenarioStep) {
  const labels: Record<string, string> = {
    API: '引用接口',
    API_CASE: '引用接口用例',
    API_SCENARIO: '引用场景',
    CUSTOM_REQUEST: '自定义请求',
    SCRIPT: '脚本',
    CONSTANT_TIMER: '等待',
    LOOP_CONTROLLER: '循环',
    IF_CONTROLLER: '条件',
    ONCE_ONLY_CONTROLLER: '仅一次',
  }
  return labels[step.stepType || ''] || '步骤'
}

function childColor(step: ApiScenarioStep) {
  const colors: Record<string, { color: string; background: string }> = {
    API: { color: '#7816ff', background: '#f5e8ff' },
    API_CASE: { color: '#0891b2', background: '#e0f7fa' },
    API_SCENARIO: { color: '#00b42a', background: '#e8ffea' },
    CUSTOM_REQUEST: { color: '#165dff', background: '#e8f3ff' },
    SCRIPT: { color: '#f59e0b', background: '#fffbeb' },
    CONSTANT_TIMER: { color: '#64748b', background: '#f8fafc' },
    LOOP_CONTROLLER: { color: '#4e5ac8', background: '#eeeeff' },
    IF_CONTROLLER: { color: '#e91e8c', background: '#ffe8f5' },
    ONCE_ONLY_CONTROLLER: { color: '#6b7280', background: '#f2f3f5' },
  }
  return colors[step.stepType || ''] || colors.CUSTOM_REQUEST
}

function childSummary(step: ApiScenarioStep) {
  if (step.stepType === 'CUSTOM_REQUEST') return `${step.requestConfig?.method || 'POST'} ${step.requestConfig?.path || '未填写请求地址'}`
  if (step.stepType === 'SCRIPT') return `JavaScript · ${(step.script || '').split('\n').filter(Boolean).length} 行`
  if (step.stepType === 'CONSTANT_TIMER') return `${step.delayMs ?? 1000}ms`
  if (step.stepType === 'LOOP_CONTROLLER') return `${step.loopType === 'FIXED' ? `固定 ${step.loopCount ?? 1} 次` : step.loopType === 'WHILE' ? '条件循环' : '遍历列表'} · ${step.children?.length || 0} 个子步骤`
  if (step.stepType === 'IF_CONTROLLER') return `${step.conditionExpression || '未填写条件'} · ${step.children?.length || 0} 个子步骤`
  if (step.stepType === 'ONCE_ONLY_CONTROLLER') return `单次执行 · ${step.children?.length || 0} 个子步骤`
  if (step.stepType === 'API') return `引用接口 · ${step.requestConfig?.path || '跟随源配置'}`
  if (step.stepType === 'API_CASE') return '引用接口用例 · 跟随源配置'
  return '引用场景 · 跟随源配置'
}

function save() {
  const name = draft.value.stepName.trim()
  if (!name) {
    error.value = '请输入步骤名称。'
    return
  }
  const type = loopType.value
  if (type === 'FIXED' && (!Number.isFinite(Number(draft.value.loopCount)) || Number(draft.value.loopCount) < 0 || Number(draft.value.loopCount) > 50)) {
    error.value = '循环次数必须在 0–50 之间。'
    return
  }
  if ((type === 'WHILE' || type === 'FOREACH') && !draft.value.foreachExpression?.trim() && type === 'FOREACH') {
    error.value = '请输入遍历表达式。'
    return
  }
  if (type === 'WHILE' && !draft.value.conditionExpression?.trim()) {
    error.value = '请输入循环条件。'
    return
  }
  error.value = ''
  emit('save', {
    ...JSON.parse(JSON.stringify(draft.value)),
    stepName: name,
    loopType: type,
    loopCount: type === 'FIXED' ? Math.round(Number(draft.value.loopCount ?? 1)) : undefined,
    foreachExpression: type === 'FOREACH' ? draft.value.foreachExpression : undefined,
    conditionExpression: type === 'WHILE' ? draft.value.conditionExpression : undefined,
    children: JSON.parse(JSON.stringify(draft.value.children || [])),
  })
}
</script>

<template>
  <AppDrawer :model-value="true" size="720px" variant="standard" :with-header="true" :show-close="false" drawer-class="scenario-loop-step-drawer" modal-class="scenario-loop-step-overlay" :close-on-click-modal="false" @update:model-value="value => !value && close()">
    <template #header>
      <header class="loop-step__header">
        <span class="loop-step__icon"><Repeat :size="18" /></span>
        <div><h3>{{ props.isNew ? '新建循环' : '配置循环' }}</h3><p>循环执行子步骤</p></div>
        <button type="button" aria-label="关闭" @click="close"><X :size="17" /></button>
      </header>
    </template>

    <div class="loop-step__body">
      <section class="loop-step__card loop-step__name-card">
        <label>步骤名称 <em>*</em><input v-model="draft.stepName" /></label>
      </section>

      <section class="loop-step__card loop-step__mode-card">
        <label>循环方式 <em>*</em></label>
        <div class="loop-step__modes">
          <button type="button" :class="{ 'is-active': loopType === 'FIXED' }" @click="setLoopType('FIXED')">固定次数</button>
          <button type="button" :class="{ 'is-active': loopType === 'WHILE' }" @click="setLoopType('WHILE')">WHILE 条件</button>
          <button type="button" :class="{ 'is-active': loopType === 'FOREACH' }" @click="setLoopType('FOREACH')">遍历集合</button>
        </div>
        <label v-if="loopType === 'FIXED'" class="loop-step__field">循环次数 <em>*</em><input v-model.number="draft.loopCount" type="number" min="0" max="50" /><small>范围 0–50；0 表示跳过，当前索引可通过 loopIndex 获取。</small></label>
        <label v-else-if="loopType === 'WHILE'" class="loop-step__field">循环条件 <em>*</em><textarea v-model="draft.conditionExpression" rows="4" placeholder="{{status}} != &quot;DONE&quot;" /><small>每轮执行前判断条件，最多执行 50 次。</small></label>
        <label v-else class="loop-step__field">遍历表达式 <em>*</em><textarea v-model="draft.foreachExpression" rows="4" placeholder="A,B,C&#10;或每行填写一项" /><small>支持变量替换，按逗号或换行拆分，最多 50 项。</small><span class="loop-step__tokens"><b>当前项：item</b><b>索引：loopIndex（从 0 开始）</b></span></label>
        <p class="loop-step__failure-hint">子步骤失败后的处理方式跟随场景“失败后继续执行”设置。</p>
      </section>

      <section class="loop-step__card loop-step__children-card">
        <header class="loop-step__children-header"><div><strong>子步骤</strong><small>按照列表顺序执行 · {{ children.length }} 个步骤 · 当前层级 {{ props.depth + 1 }} / 3</small></div><button v-if="children.length" type="button" @click="emit('requestAddChild')"><Plus :size="13" />添加子步骤</button></header>
        <div v-if="children.length" class="loop-step__children-list">
          <article v-for="(child, index) in children" :key="child.id || index" class="loop-step__child-row" :class="{ 'is-disabled': child.enabled === false }">
            <GripVertical class="loop-step__drag" :size="14" />
            <AppSwitch :model-value="child.enabled !== false" label="启用子步骤" @update:model-value="toggleChild(index, $event)" />
            <span class="loop-step__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <b class="loop-step__badge" :style="{ color: childColor(child).color, background: childColor(child).background }">{{ childLabel(child) }}</b>
            <div class="loop-step__child-copy"><strong>{{ child.stepName || childLabel(child) }}</strong><small>{{ childSummary(child) }}</small></div>
            <button class="loop-step__child-action" type="button" title="配置"><ChevronRight :size="14" /></button>
            <button class="loop-step__child-action" type="button" title="更多"><MoreHorizontal :size="14" /></button>
          </article>
        </div>
        <div v-else class="loop-step__children-empty"><Layers :size="24" /><p>暂无子步骤，添加后将按顺序执行</p><button type="button" @click="emit('requestAddChild')"><Plus :size="13" />添加子步骤</button></div>
      </section>
      <p v-if="error" class="loop-step__error" role="alert">{{ error }}</p>
    </div>

    <template #footer><span class="loop-step__status">{{ dirty ? '存在未保存的修改' : '所有修改已保存' }}</span><button type="button" class="loop-step__cancel" @click="close">取消</button><button type="button" class="loop-step__save" @click="save"><Save :size="13" />保存并添加</button></template>
  </AppDrawer>

  <AppDialog v-model="confirmClose" title="放弃未保存的修改？" width="400px" variant="standard" dialog-class="scenario-loop-discard-dialog" modal-class="scenario-loop-discard-overlay" align-center :show-close="false">
    <div class="loop-step__discard"><span><AlertTriangle :size="17" /></span><div><h4>放弃未保存的修改？</h4><p>关闭后，本次填写的配置将不会保留。</p></div></div>
    <div class="loop-step__discard-actions"><button type="button" class="loop-step__cancel" @click="confirmClose = false">继续编辑</button><button type="button" class="loop-step__save is-danger" @click="emit('close')">放弃修改</button></div>
  </AppDialog>
</template>

<style scoped>
:global(.el-overlay.scenario-loop-step-overlay){background:rgb(29 33 41 / 38%)}
:global(.el-drawer.scenario-loop-step-drawer){font-family:Inter,"Noto Sans SC",sans-serif}
:global(.scenario-loop-step-drawer .el-drawer__header){min-height:72px;margin:0;padding:0;border-bottom:1px solid #e5e6eb}
:global(.scenario-loop-step-drawer .el-drawer__body){display:flex;min-height:0;padding:0;overflow:hidden}
:global(.scenario-loop-step-drawer .el-drawer__footer){padding:0}
:global(.scenario-loop-step-drawer .app-drawer__footer){box-sizing:border-box;height:61px;align-items:center;padding:14px 20px;border-top-color:#e5e6eb}
.loop-step__header{display:flex;width:100%;height:72px;box-sizing:border-box;align-items:center;gap:12px;padding:0 20px}
.loop-step__icon{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#eeeeff;color:#4e5ac8}
.loop-step__header h3{margin:0;color:#1d2129;font-size:15px;font-weight:600;line-height:22.5px}
.loop-step__header p{margin:1px 0 0;color:#86909c;font-size:11px;line-height:16.5px}
.loop-step__header button{display:grid;width:32px;height:32px;place-items:center;margin-left:auto;border:0;border-radius:8px;background:transparent;color:#86909c}
.loop-step__header button:hover{background:#f2f3f5}
.loop-step__body{flex:1;overflow:auto;padding:20px;background:#fafbfe}
.loop-step__card{padding:16px;border:1px solid #e5e6eb;border-radius:14px;background:#fff}
.loop-step__card+.loop-step__card{margin-top:16px}
.loop-step__card label{display:block;color:#4e5969;font-size:12px;font-weight:500;line-height:18px}
.loop-step__card em{color:#f53f3f;font-style:normal}
.loop-step__card input,.loop-step__card textarea{box-sizing:border-box;width:100%;margin-top:6px;border:1px solid #e5e6eb;border-radius:8px;background:#fff;color:#1d2129;font:400 12px/18px Inter,"Noto Sans SC",sans-serif;outline:none}
.loop-step__card input{height:34px;padding:0 10px}
.loop-step__card textarea{min-height:98px;padding:10px;resize:vertical}
.loop-step__card input:focus,.loop-step__card textarea:focus{border-color:#165dff}
.loop-step__modes{display:flex;gap:8px;margin-top:10px}
.loop-step__modes button{height:32px;padding:0 12px;border:1px solid #e5e6eb;border-radius:8px;background:#fff;color:#4e5969;font:400 11px/16.5px Inter,"Noto Sans SC",sans-serif}
.loop-step__modes button.is-active{border-color:#165dff;background:#e8f3ff;color:#165dff}
.loop-step__mode-card .loop-step__field input[type=number]{max-width:280px}
.loop-step__field{margin-top:18px}
.loop-step__field small{display:block;margin-top:8px;color:#c9cdd4;font-size:11px;line-height:16.5px}
.loop-step__tokens{display:flex;gap:8px;margin-top:8px}
.loop-step__tokens b{padding:4px 8px;border-radius:4px;background:#f4f6fa;color:#4e5969;font-size:11px;font-weight:400}
.loop-step__failure-hint{margin:18px 0 0;padding-top:14px;border-top:1px dashed #e5e6eb;color:#c9cdd4;font-size:11px;line-height:16.5px}
.loop-step__children-card{padding:0;overflow:hidden}
.loop-step__children-header{display:flex;min-height:64px;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #e5e6eb}
.loop-step__children-header strong{display:block;color:#1d2129;font-size:13px;font-weight:600;line-height:19.5px}
.loop-step__children-header small{display:block;margin-top:2px;color:#c9cdd4;font-size:11px;line-height:16.5px}
.loop-step__children-header button,.loop-step__children-empty button{display:inline-flex;height:28px;align-items:center;gap:5px;padding:0 12px;border:0;border-radius:8px;background:#165dff;color:#fff;font:500 11px/16.5px Inter,"Noto Sans SC",sans-serif}
.loop-step__children-list{max-height:360px;overflow-y:auto;padding:12px}
.loop-step__child-row{display:flex;min-height:56px;align-items:center;gap:8px;padding:0 10px;border:1px solid #e5e6eb;border-radius:10px;background:#fff}
.loop-step__child-row+.loop-step__child-row{margin-top:8px}
.loop-step__child-row.is-disabled{opacity:.6}
.loop-step__drag{flex:none;color:#c9cdd4}
.loop-step__index{width:20px;color:#c9cdd4;font-size:11px;text-align:center}
.loop-step__badge{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap}
.loop-step__child-copy{min-width:0;flex:1}
.loop-step__child-copy strong,.loop-step__child-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.loop-step__child-copy strong{color:#1d2129;font-size:12px;font-weight:500;line-height:18px}
.loop-step__child-copy small{margin-top:2px;color:#c9cdd4;font-size:10px;line-height:15px}
.loop-step__child-action{display:grid;width:24px;height:24px;flex:none;place-items:center;border:0;border-radius:5px;background:transparent;color:#86909c}
.loop-step__child-action:hover{background:#f2f3f5;color:#4e5969}
.loop-step__child-action.is-danger:hover{background:#fff0f0;color:#f53f3f}
.loop-step__children-empty{display:flex;min-height:194px;flex-direction:column;align-items:center;justify-content:center;color:#c9cdd4}
.loop-step__children-empty p{margin:10px 0 12px;font-size:12px;line-height:18px}
.loop-step__status{margin-right:auto;color:#c9cdd4;font-size:11px}
.loop-step__cancel,.loop-step__save{display:inline-flex;height:32px;align-items:center;justify-content:center;gap:6px;padding:0 14px;border-radius:8px;font:500 12px/18px Inter,"Noto Sans SC",sans-serif}
.loop-step__cancel{border:1px solid #e5e6eb;background:#fff;color:#4e5969}
.loop-step__save{border:0;background:#165dff;color:#fff}
.loop-step__save.is-danger{background:#f53f3f}
.loop-step__error{margin:16px 0 0;color:#f53f3f;font-size:12px}
:global(.el-overlay.scenario-loop-discard-overlay){background:rgb(29 33 41 / 48%)}
:global(.el-dialog.scenario-loop-discard-dialog){max-width:calc(100% - 32px);border-radius:16px;box-shadow:0 25px 50px -12px rgb(0 0 0 / 25%)}
:global(.el-dialog.scenario-loop-discard-dialog > .el-dialog__header){display:none}
:global(.el-dialog.scenario-loop-discard-dialog > .el-dialog__body){padding:20px}
.loop-step__discard{display:flex;align-items:flex-start;gap:12px}
.loop-step__discard>span{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#fff3e8;color:#ff7d00;font-size:16px}
.loop-step__discard h4{margin:0;color:#1d2129;font-size:14px;font-weight:600}
.loop-step__discard p{margin:4px 0 0;color:#86909c;font-size:12px;line-height:20px}
.loop-step__discard-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
</style>
