<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

withDefaults(defineProps<{
  label?: string
}>(), {
  label: '返回工作区选择',
})

defineEmits<{
  back: []
}>()
</script>

<template>
  <button class="workspace-flow__back" type="button" @click="$emit('back')">
    <ArrowLeft aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>
