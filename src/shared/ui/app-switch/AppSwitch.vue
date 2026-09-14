<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  label: string
  size?: 'compact' | 'regular'
  tone?: 'primary' | 'success' | 'danger'
  activeColor?: string
  disabled?: boolean
  loading?: boolean
}>(), {
  size: 'compact',
  tone: 'primary',
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'change', value: boolean): void
}>()

const elementSize = computed(() => props.size === 'compact' ? 'small' : undefined)
const switchWidth = computed(() => props.size === 'compact' ? 28 : 36)
const switchStyle = computed(() => props.activeColor
  ? { '--el-switch-on-color': props.activeColor }
  : undefined)
</script>

<template>
  <el-switch
    class="app-switch"
    :class="[`app-switch--${tone}`, `app-switch--${size}`]"
    :style="switchStyle"
    :model-value="modelValue"
    :size="elementSize"
    :width="switchWidth"
    :disabled="disabled"
    :loading="loading"
    :aria-label="label"
    @update:model-value="emit('update:modelValue', Boolean($event))"
    @change="emit('change', Boolean($event))"
  />
</template>

<style scoped>
.app-switch {
  --el-switch-off-color: #c9cdd4;
  flex: 0 0 auto;
}

.app-switch.app-switch--compact {
  height: 16px;
  line-height: 16px;
}

.app-switch.app-switch--regular {
  height: 20px;
  line-height: 20px;
}

.app-switch--compact :deep(.el-switch__core) {
  min-width: 28px;
}

.app-switch--regular :deep(.el-switch__core) {
  min-width: 36px;
}

.app-switch--primary {
  --el-switch-on-color: var(--app-primary, #165dff);
}

.app-switch--success {
  --el-switch-on-color: var(--app-success, #00b42a);
}

.app-switch--danger {
  --el-switch-on-color: var(--app-danger, #f53f3f);
}
</style>
