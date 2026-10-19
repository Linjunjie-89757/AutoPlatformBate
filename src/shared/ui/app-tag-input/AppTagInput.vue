<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    disabled?: boolean
    placeholder?: string
  }>(),
  {
    disabled: false,
    placeholder: '输入内容后回车可直接添加标签',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const selectRef = ref()

const tagPalettes = [
  { border: '#bfdbfe', background: '#eff6ff', color: '#1d4ed8' },
  { border: '#bbf7d0', background: '#f0fdf4', color: '#15803d' },
  { border: '#fed7aa', background: '#fff7ed', color: '#c2410c' },
  { border: '#fecaca', background: '#fef2f2', color: '#b91c1c' },
  { border: '#ddd6fe', background: '#f5f3ff', color: '#6d28d9' },
  { border: '#a5f3fc', background: '#ecfeff', color: '#0e7490' },
  { border: '#fbcfe8', background: '#fdf2f8', color: '#be185d' },
  { border: '#cbd5e1', background: '#f8fafc', color: '#475569' },
]

function normalizeTags(value: string[]) {
  return Array.from(new Set(value.map(item => item.trim()).filter(Boolean)))
}

function updateValue(value: string[]) {
  emit('update:modelValue', normalizeTags(value))
}

function getTagColorIndex(tag: string) {
  let hash = 0

  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) % tagPalettes.length
  }

  return hash
}

async function applyTagColors() {
  await nextTick()

  const selectElement = selectRef.value?.$el as HTMLElement | undefined
  const tagElements = selectElement?.querySelectorAll<HTMLElement>('.el-select__selected-item .el-tag')

  tagElements?.forEach((tagElement, index) => {
    const palette = tagPalettes[getTagColorIndex(props.modelValue[index] ?? tagElement.textContent ?? '')]

    tagElement.style.setProperty('--app-tag-color-border', palette.border)
    tagElement.style.setProperty('--app-tag-color-background', palette.background)
    tagElement.style.setProperty('--app-tag-color-text', palette.color)
  })
}

watch(() => props.modelValue, applyTagColors, { deep: true, immediate: true })
</script>

<template>
  <el-select :suffix-icon="AppSelectChevron"
    ref="selectRef"
    :model-value="props.modelValue"
    class="app-tag-input"
    multiple
    filterable
    allow-create
    default-first-option
    :reserve-keyword="false"
    :teleported="false"
    popper-class="app-tag-input__popper"
    :disabled="props.disabled"
    :placeholder="props.placeholder"
    @update:model-value="updateValue"
  />
</template>

<style scoped>
.app-tag-input {
  width: 100%;
}

.app-tag-input :deep(.el-select__wrapper) {
  min-height: 36px;
  align-items: center;
  padding: 5px 10px;
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}

.app-tag-input :deep(.el-select__selection) {
  display: flex;
  min-height: 24px;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.app-tag-input :deep(.el-select__selected-item) {
  margin: 0;
}

.app-tag-input :deep(.el-tag) {
  height: 24px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--app-tag-color-border, #bfdbfe);
  border-radius: var(--app-radius-sm);
  background: var(--app-tag-color-background, #eff6ff);
  color: var(--app-tag-color-text, #1d4ed8);
  box-shadow: none;
}

.app-tag-input :deep(.el-tag__content) {
  font-size: var(--app-font-size-xs);
  line-height: 22px;
}

.app-tag-input :deep(.el-tag__close) {
  margin-left: 4px;
  color: currentColor;
  opacity: 0.68;
}

.app-tag-input :deep(.el-tag__close:hover) {
  opacity: 1;
}

.app-tag-input :deep(.el-select__input-wrapper) {
  margin: 0;
}

.app-tag-input :deep(.el-select__input) {
  min-width: 96px;
  margin: 0;
  font-size: var(--app-font-size-xs);
  line-height: 24px;
}

.app-tag-input :deep(.el-select__placeholder) {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: 24px;
}

.app-tag-input :deep(.el-select__caret),
.app-tag-input :deep(.el-select__suffix) {
  display: none;
}
</style>

<style>
.app-tag-input__popper {
  display: none !important;
}
</style>
