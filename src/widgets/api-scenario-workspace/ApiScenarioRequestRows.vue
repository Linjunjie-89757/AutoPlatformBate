<script setup lang="ts">
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Upload } from '@lucide/vue'
import { ref } from 'vue'

import type { ApiKeyValueInput } from '@/entities/api-automation'
import { createEmptyKeyValue, readScenarioFileAsBase64 } from './lib/apiScenarioStepRequestUtils'

const props = defineProps<{ label: string; allowFiles?: boolean }>()
const rows = defineModel<ApiKeyValueInput[]>({ required: true })
const uploading = defineModel<boolean>('uploading', { default: false })
const error = ref('')

function move(index: number, offset: number) {
  const next = [...rows.value]
  const [row] = next.splice(index, 1)
  next.splice(index + offset, 0, row)
  rows.value = next
}

async function selectFile(row: ApiKeyValueInput, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || uploading.value) return
  error.value = ''
  uploading.value = true
  try {
    const fileBase64 = await readScenarioFileAsBase64(file)
    Object.assign(row, { fileBase64, fileName: file.name, fileSize: file.size, contentType: file.type })
  } catch {
    error.value = '读取文件失败，请重试。'
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function setRowType(row: ApiKeyValueInput, event: Event) {
  const paramType = (event.target as HTMLSelectElement).value
  Object.assign(row, { paramType, value: '', fileBase64: null, fileName: null, fileSize: null, contentType: null })
}
</script>

<template>
  <div class="scenario-request-rows" :class="{ 'is-multipart': allowFiles }">
    <div class="scenario-request-rows__grid scenario-request-rows__head">
      <span /><span>名称</span><span v-if="allowFiles">类型</span><span>{{ allowFiles ? '值 / 文件' : '值' }}</span><span>描述</span><span />
    </div>
    <div v-for="(row, index) in rows" :key="index" class="scenario-request-rows__grid scenario-request-rows__row">
      <input type="checkbox" :aria-label="`启用第 ${index + 1} 行`" :checked="row.enabled !== false" @change="row.enabled = ($event.target as HTMLInputElement).checked" />
      <input v-model="row.key" :aria-label="`${label}名称`" :placeholder="allowFiles ? '字段名' : `${label} 名称`" />
      <select
        v-if="allowFiles" :value="row.paramType === 'file' ? 'file' : 'string'" aria-label="参数类型"
        :disabled="uploading" @change="setRowType(row, $event)"
      ><option value="string">文本</option><option value="file">文件</option></select>
      <label v-if="allowFiles && row.paramType === 'file'" class="scenario-request-rows__file" :class="{ 'has-file': row.fileName }">
        <Upload :size="11" aria-hidden="true" />
        <span :title="row.fileName || undefined">{{ row.fileName || '选择文件' }}</span>
        <input type="file" aria-label="选择文件" :disabled="uploading" @change="selectFile(row, $event)" />
      </label>
      <input v-else v-model="row.value" class="scenario-request-rows__value" aria-label="值" placeholder="支持 {{变量名}}" />
      <input v-model="row.description" aria-label="描述" placeholder="选填" />
      <div class="scenario-request-rows__actions">
        <button type="button" title="上移" aria-label="上移" :disabled="uploading || index === 0" @click="move(index, -1)"><ArrowUp :size="13" /></button>
        <button type="button" title="下移" aria-label="下移" :disabled="uploading || index === rows.length - 1" @click="move(index, 1)"><ArrowDown :size="13" /></button>
        <button type="button" title="复制" aria-label="复制" :disabled="uploading" @click="rows.splice(index + 1, 0, { ...row })"><Copy :size="13" /></button>
        <button type="button" title="删除" aria-label="删除" class="is-danger" :disabled="uploading" @click="rows.splice(index, 1)"><Trash2 :size="13" /></button>
      </div>
    </div>
    <div v-if="!rows.length" class="scenario-request-rows__empty">{{ allowFiles ? '暂无 form-data 字段' : `暂无${label}` }}</div>
    <p v-if="error" class="scenario-request-rows__error" role="alert">{{ error }}</p>
    <button type="button" class="scenario-request-rows__add" @click="rows.push(createEmptyKeyValue())"><Plus :size="allowFiles ? 11 : 12" />添加{{ props.label }}</button>
  </div>
</template>

<style scoped>
.scenario-request-rows__grid { display: grid; grid-template-columns: 30px minmax(0, 1fr) minmax(0, 1.06fr) minmax(0, 1fr) 108px; align-items: center; gap: 8px; }
.is-multipart .scenario-request-rows__grid { grid-template-columns: 28px minmax(0, 1fr) 92px minmax(0, 1fr) minmax(0, 1fr) 108px; }
.scenario-request-rows__head { padding: 0 8px 8px; color: #c9cdd4; font-size: 11px; line-height: 16.5px; }
.is-multipart .scenario-request-rows__head { font-size: 10px; line-height: 15px; }
.is-multipart .scenario-request-rows__row, .is-multipart .scenario-request-rows__add { font-size: 11px; }
.scenario-request-rows__row + .scenario-request-rows__row { margin-top: 8px; }
.scenario-request-rows__row input[type="checkbox"] { display: grid; width: 100%; height: 13px; place-items: center; margin: 0; appearance: none; border: 1px solid #86909c; border-radius: 2px; background: #fff; cursor: pointer; }
.scenario-request-rows__row input[type="checkbox"]:checked { border-color: #165dff; background: #165dff; }
.scenario-request-rows__row input[type="checkbox"]:checked::after { width: 7px; height: 4px; transform: translateY(-1px) rotate(-45deg); border-bottom: 1px solid #fff; border-left: 1px solid #fff; content: ""; }
.scenario-request-rows__row input:not([type="checkbox"], [type="file"]), .scenario-request-rows__row select, .scenario-request-rows__file { box-sizing: border-box; width: 100%; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; color: #1d2129; font: inherit; }
.scenario-request-rows__row input:focus, .scenario-request-rows__row select:focus { border-color: #165dff; outline: none; }
.scenario-request-rows__row .scenario-request-rows__value { font-family: ui-monospace, Consolas, monospace; }
.scenario-request-rows__actions { display: flex; }
.scenario-request-rows__actions button { display: grid; width: 24px; height: 24px; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #86909c; }
.scenario-request-rows__actions button:disabled { opacity: .65; }
.scenario-request-rows__actions button:not(:disabled):hover { background: #f2f3f5; }
.scenario-request-rows__actions .is-danger { color: #f53f3f; }
.scenario-request-rows__add { display: inline-flex; height: 32px; align-items: center; gap: 6px; margin-top: 12px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; color: #165dff; font: inherit; }
.scenario-request-rows__add:hover { background: #f2f7ff; }
.scenario-request-rows__empty { padding: 32px 0; color: #c9cdd4; text-align: center; }
.scenario-request-rows__file { position: relative; display: flex; align-items: center; gap: 4px; color: #165dff; font-size: 10px; }
.scenario-request-rows__file.has-file { color: #4e5969; }
.scenario-request-rows__file:focus-within { border-color: #165dff; }
.scenario-request-rows__file svg { flex: none; }
.scenario-request-rows__file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scenario-request-rows__file input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
.scenario-request-rows__error { color: #f53f3f; }
@media (max-width: 540px) {
  .scenario-request-rows { overflow-x: auto; }
  .scenario-request-rows__grid { min-width: 440px; }
  .is-multipart .scenario-request-rows__grid { min-width: 530px; }
}
</style>
