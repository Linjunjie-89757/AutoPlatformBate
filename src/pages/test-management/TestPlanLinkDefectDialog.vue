<script setup lang="ts">
import { Link2, Search, X } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { TestPlanDefectItem } from '@/entities/test-management'

const props = defineProps<{ defects: TestPlanDefectItem[]; linkedIds: number[]; submitting?: boolean }>()
const emit = defineEmits<{ close: []; confirm: [ids: number[]] }>()
const keyword = ref('')
const selected = ref(new Set<number>())
const filtered = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return props.defects.filter(item => !props.linkedIds.includes(item.id)
    && (!value || `${item.bugNo}${item.title}`.toLowerCase().includes(value)))
})
const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(item => selected.value.has(item.id)))
const toggleAll = () => {
  const next = new Set(selected.value)
  if (allSelected.value) filtered.value.forEach(item => next.delete(item.id))
  else filtered.value.forEach(item => next.add(item.id))
  selected.value = next
}
const toggle = (id: number) => {
  const next = new Set(selected.value)
    next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
</script>

<template>
  <div class="tp-link-defect__layer" @click.self="$emit('close')">
      <section class="tp-link-defect" role="dialog" aria-modal="true" aria-labelledby="tp-link-defect-title">
      <header><strong id="tp-link-defect-title">关联缺陷</strong><div class="tp-link-defect__header-search"><Search :size="13" /><input v-model="keyword" type="search" placeholder="通过缺陷编号 / 缺陷名称搜索"></div><button v-if="!submitting" type="button" aria-label="关闭" @click="$emit('close')"><X :size="15" /></button></header>
      <div class="tp-link-defect__body">
        <div class="tp-link-defect__table"><table><thead><tr><th class="is-check"><input type="checkbox" :checked="allSelected" aria-label="全选缺陷" @change="toggleAll"></th><th>缺陷编号</th><th>缺陷名称</th><th>状态</th><th>优先级</th><th>严重程度</th><th>处理人</th><th>创建人</th><th>创建时间</th></tr></thead><tbody><tr v-for="item in filtered" :key="item.id" :class="{ 'is-selected': selected.has(item.id) }" @click="toggle(item.id)"><td class="is-check"><input type="checkbox" :checked="selected.has(item.id)" :aria-label="`选择 ${item.bugNo}`" @click.stop @change="toggle(item.id)"></td><td><code>{{ item.bugNo }}</code></td><td class="is-title">{{ item.title }}</td><td>{{ item.status }}</td><td><b :class="`is-${item.priority.toLowerCase()}`">{{ item.priority }}</b></td><td>{{ item.severity }}</td><td>{{ item.assigneeName || '未分配' }}</td><td>—</td><td><code>{{ item.createdAt?.slice(0, 16).replace('T', ' ') || '—' }}</code></td></tr><tr v-if="!filtered.length"><td colspan="9" class="is-empty">{{ keyword ? '无匹配缺陷' : '暂无可关联的缺陷' }}</td></tr></tbody></table></div>
      </div>
      <footer><span v-if="selected.size">已选 <b>{{ selected.size }}</b> 条</span><button class="is-ghost" type="button" :disabled="submitting" @click="$emit('close')">取消</button><button class="is-primary" type="button" :disabled="!selected.size || submitting" @click="$emit('confirm', [...selected])"><Link2 :size="13" />{{ submitting ? '关联中…' : '确认关联' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.tp-link-defect__layer { position: fixed; z-index: 3270; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(29 33 41 / 45%); font-family: inherit; }
.tp-link-defect { display: flex; width: 920px; max-width: calc(100vw - 32px); max-height: 80vh; overflow: hidden; flex-direction: column; border-radius: 12px; color: #1d2129; background: #fff; box-shadow: 0 8px 40px rgb(0 0 0 / 16%); }
.tp-link-defect * { box-sizing: border-box; }
.tp-link-defect > header { display: flex; height: 56px; flex: 0 0 auto; align-items: center; gap: 12px; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.tp-link-defect > header > strong { flex: 0 0 auto; font-size: 16px; font-weight: 600; }
.tp-link-defect__header-search { position: relative; width: 240px; margin-left: auto; }
.tp-link-defect__header-search svg { position: absolute; top: 9px; left: 8px; color: #86909c; pointer-events: none; }
.tp-link-defect__header-search input { width: 100%; height: 32px; padding: 0 10px 0 28px; border: 1.5px solid #e5e6eb; border-radius: 8px; outline: 0; color: #1d2129; font: 400 12px inherit; }
.tp-link-defect__header-search input:focus { border-color: #0ea5e9; }
.tp-link-defect header button { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: #86909c; background: transparent; cursor: pointer; }
.tp-link-defect header button:hover { color: #1d2129; background: #f2f3f5; }
.tp-link-defect__body { display: flex; min-height: 0; flex: 1; overflow: hidden; padding: 0; flex-direction: column; }
.tp-link-defect__table { overflow: auto; border: 0; border-radius: 0; }
.tp-link-defect table { width: 100%; border-collapse: collapse; }
.tp-link-defect th,.tp-link-defect td { height: 42px; padding: 0 12px; border-bottom: 1px solid #e5e6eb; color: #4e5969; font-size: 12px; text-align: left; white-space: nowrap; }
.tp-link-defect th { color: #86909c; background: #fafafa; font-size: 11px; font-weight: 500; }
.tp-link-defect th.is-check,.tp-link-defect td.is-check { width: 44px; padding: 0; text-align: center; }
.tp-link-defect td.is-title { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.tp-link-defect tbody tr { cursor: pointer; transition: background-color 120ms ease; }
.tp-link-defect tbody tr:hover,.tp-link-defect tbody tr.is-selected { background: rgb(14 165 233 / 2.5%); }
.tp-link-defect td input,.tp-link-defect th input { width: 14px; height: 14px; margin: 0; accent-color: #0ea5e9; cursor: pointer; }
.tp-link-defect td b { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.tp-link-defect td b.is-p0 { color: #f53f3f; background: #ffecec; }.tp-link-defect td b.is-p1 { color: #ff7d00; background: #fff3e8; }.tp-link-defect td b.is-p2 { color: #0ea5e9; background: #e0f5fe; }.tp-link-defect td b.is-p3 { color: #86909c; background: #f2f3f5; }
.tp-link-defect td code { color: #0ea5e9; font-family: Cousine, ui-monospace, monospace; font-size: 11px; }
.tp-link-defect td.is-empty { padding: 52px 0; color: #86909c; text-align: center; }
.tp-link-defect > footer { display: flex; min-height: 56px; flex: 0 0 auto; align-items: center; gap: 10px; padding: 0 24px; border-top: 1px solid #e5e6eb; }
.tp-link-defect footer span { flex: 1; color: #86909c; font-size: 13px; }.tp-link-defect footer span b { color: #1d2129; }.tp-link-defect footer button { display: inline-flex; height: 34px; align-items: center; justify-content: center; gap: 6px; padding: 0 18px; border-radius: 8px; font: 500 13px inherit; cursor: pointer; }.tp-link-defect footer .is-ghost { height: 28px; padding: 0 10.5px; border: 1px solid #e5e6eb; color: #4e5969; background: #fff; }.tp-link-defect footer .is-primary { border: 0; color: #fff; background: #0ea5e9; font-weight: 600; }.tp-link-defect footer button:disabled { cursor: not-allowed; opacity: .6; }
</style>
