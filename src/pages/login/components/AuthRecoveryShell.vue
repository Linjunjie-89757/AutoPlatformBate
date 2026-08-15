<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

import authBrandIcon from '@/assets/auth/auth-brand.svg'

defineProps<{
  backLabel?: string
}>()

defineEmits<{
  back: []
}>()
</script>

<template>
  <main class="password-recovery-page">
    <section class="password-recovery-shell" aria-label="账号密码恢复">
      <header class="password-recovery-brand">
        <span class="password-recovery-brand__mark">
          <img :src="authBrandIcon" alt="">
        </span>
        <strong>AutoTest</strong>
      </header>

      <button
        v-if="backLabel"
        class="password-recovery-back"
        type="button"
        @click="$emit('back')"
      >
        <ArrowLeft aria-hidden="true" />
        <span>{{ backLabel }}</span>
      </button>

      <slot />
    </section>
  </main>
</template>

<style src="../password-recovery.css"></style>
