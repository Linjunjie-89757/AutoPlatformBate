<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  width?: string | number
  modalClass?: string
  dialogClass?: string
  alignCenter?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :modal-class="modalClass"
    :class="dialogClass"
    :align-center="alignCenter"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </el-dialog>
</template>
