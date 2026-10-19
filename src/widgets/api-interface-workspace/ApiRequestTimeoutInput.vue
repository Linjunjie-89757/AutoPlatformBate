<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { ref, watch } from 'vue'

const props = defineProps<{ label: string; modelValue: number; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const raw = ref(String(props.modelValue))
const focused = ref(false)

watch(() => props.modelValue, value => {
  if (!focused.value) raw.value = String(value)
})

function commit() {
  focused.value = false
  if (props.disabled) {
    raw.value = String(props.modelValue)
    return
  }
  const value = Number.parseInt(raw.value, 10)
  const next = Number.isFinite(value) ? Math.max(1000, Math.min(2147483647, value)) : props.modelValue
  raw.value = String(next)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function step(delta: number) {
  if (props.disabled) return
  const next = Math.max(1000, Math.min(2147483647, props.modelValue + delta))
  raw.value = String(next)
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <div class="api-settings-timeout" :class="{ 'is-disabled': disabled }">
    <span>{{ label }}</span>
    <span class="api-settings-stepper">
      <button type="button" :disabled="disabled" :aria-label="`减少${label}`" @click="step(-1000)">
        <svg width="8" height="2" viewBox="0 0 8 2" fill="currentColor" aria-hidden="true"><rect width="8" height="2" rx="1" /></svg>
      </button>
      <i aria-hidden="true" />
      <input
        v-model="raw"
        type="text"
        inputmode="numeric"
        :aria-label="label"
        :disabled="disabled"
        @focus="focused = true; raw = String(modelValue)"
        @blur="commit"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
      <i aria-hidden="true" />
      <button type="button" :disabled="disabled" :aria-label="`增加${label}`" @click="step(1000)"><Plus :size="9" aria-hidden="true" /></button>
    </span>
  </div>
</template>
