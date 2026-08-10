<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  label: string
  size?: 'compact' | 'regular'
  disabled?: boolean
}>(), {
  size: 'compact',
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    class="app-figma-switch"
    :class="[`is-${size}`, { 'is-on': modelValue }]"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="toggle"
  >
    <span aria-hidden="true" />
  </button>
</template>

<style scoped>
.app-figma-switch {
  --switch-width: 28px;
  --switch-height: 14px;
  --switch-thumb-size: 10.5px;
  --switch-thumb-left: 2px;
  --switch-thumb-top: 1.75px;
  --switch-thumb-shift: 12px;
  position: relative;
  display: inline-flex;
  width: var(--switch-width);
  min-width: var(--switch-width);
  height: var(--switch-height);
  flex: 0 0 var(--switch-width);
  margin: 0;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 999px;
  appearance: none;
  background: #c9cdd4 !important;
  vertical-align: middle;
  cursor: pointer;
}

.app-figma-switch.is-regular {
  --switch-width: 32px;
  --switch-height: 16px;
  --switch-thumb-size: 12px;
  --switch-thumb-left: 2px;
  --switch-thumb-top: 2px;
  --switch-thumb-shift: 16px;
}

.app-figma-switch.is-on {
  background: var(--app-primary, #165dff) !important;
}

.app-figma-switch > span {
  position: absolute;
  top: var(--switch-thumb-top);
  left: var(--switch-thumb-left);
  width: var(--switch-thumb-size);
  height: var(--switch-thumb-size);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px rgba(0, 0, 0, .1);
  transform: translateX(0);
  transition: transform 150ms ease;
}

.app-figma-switch.is-on > span {
  transform: translateX(var(--switch-thumb-shift));
}

.app-figma-switch:focus-visible {
  outline: 2px solid rgba(22, 93, 255, .35);
  outline-offset: 2px;
}

.app-figma-switch:disabled {
  cursor: not-allowed;
}
</style>
