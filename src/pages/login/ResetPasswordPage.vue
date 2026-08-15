<script setup lang="ts">
import { computed, ref } from 'vue'
import { EyeOff, Loader2 } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import eyeIcon from '@/assets/auth/eye.svg'
import keyRoundIcon from '@/assets/auth/key-round.svg'
import ruleCheckIcon from '@/assets/auth/rule-check.svg'
import successCircleIcon from '@/assets/auth/success-circle.svg'
import {
  getPasswordResetErrorMessage,
  passwordResetApi,
} from '@/features/auth-password-reset'

import AuthRecoveryShell from './components/AuthRecoveryShell.vue'

const route = useRoute()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const passwordVisible = ref(false)
const confirmVisible = ref(false)
const submitting = ref(false)
const requestError = ref('')
const completed = ref(false)

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value.trim() : ''
})
const hasMinimumLength = computed(() => password.value.length >= 8)
const hasLettersAndNumbers = computed(() => /[A-Za-z]/.test(password.value) && /\d/.test(password.value))
const passwordsMatch = computed(() => password.value.length > 0 && password.value === confirmPassword.value)
const allRulesPassed = computed(
  () => hasMinimumLength.value && hasLettersAndNumbers.value && passwordsMatch.value && Boolean(token.value),
)

function clearError() {
  requestError.value = ''
}

async function submitReset() {
  if (!allRulesPassed.value || submitting.value) return
  requestError.value = ''
  submitting.value = true
  try {
    await passwordResetApi.confirm(token.value, password.value)
    completed.value = true
  } catch (error) {
    requestError.value = getPasswordResetErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

function goToForgotPassword() {
  void router.push('/forgot-password')
}

function goToLogin() {
  void router.push('/login')
}
</script>

<template>
  <AuthRecoveryShell v-if="!completed" back-label="返回" @back="goToForgotPassword">
    <div class="password-recovery-card-wrap password-recovery-card-wrap--reset">
      <form class="password-recovery-card password-recovery-reset" @submit.prevent="submitReset">
        <span class="password-recovery-feature-icon is-key">
          <img :src="keyRoundIcon" alt="">
        </span>
        <div class="password-recovery-heading">
          <h1>设置新密码</h1>
        </div>
        <div class="password-recovery-description password-recovery-description--reset">
          <p>请为你的账号设置一个新密码。</p>
        </div>

        <label class="password-recovery-label password-recovery-label--password" for="new-password">新密码</label>
        <div class="password-recovery-password-wrap">
          <div class="password-recovery-password">
            <input
              id="new-password"
              v-model="password"
              class="password-recovery-input"
              :type="passwordVisible ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请输入新密码"
              @input="clearError"
            >
            <button
              type="button"
              :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
              @click="passwordVisible = !passwordVisible"
            >
              <EyeOff v-if="passwordVisible" />
              <img v-else :src="eyeIcon" alt="">
            </button>
          </div>
        </div>

        <label class="password-recovery-label password-recovery-label--confirm" for="confirm-password">确认密码</label>
        <div class="password-recovery-password-wrap">
          <div class="password-recovery-password">
            <input
              id="confirm-password"
              v-model="confirmPassword"
              class="password-recovery-input"
              :type="confirmVisible ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="再次输入新密码"
              @input="clearError"
            >
            <button
              type="button"
              :aria-label="confirmVisible ? '隐藏确认密码' : '显示确认密码'"
              @click="confirmVisible = !confirmVisible"
            >
              <EyeOff v-if="confirmVisible" />
              <img v-else :src="eyeIcon" alt="">
            </button>
          </div>
        </div>

        <div class="password-recovery-rules-wrap">
          <div class="password-recovery-rules">
            <p :class="{ 'is-passed': hasMinimumLength }">
              <span><img v-if="hasMinimumLength" :src="ruleCheckIcon" alt=""></span>
              至少 8 个字符
            </p>
            <p :class="{ 'is-passed': hasLettersAndNumbers }">
              <span><img v-if="hasLettersAndNumbers" :src="ruleCheckIcon" alt=""></span>
              包含字母和数字
            </p>
            <p :class="{ 'is-passed': passwordsMatch }">
              <span><img v-if="passwordsMatch" :src="ruleCheckIcon" alt=""></span>
              两次密码输入一致
            </p>
          </div>
        </div>

        <div v-if="requestError" class="password-recovery-alert password-recovery-alert--reset" role="alert">
          {{ requestError }}
        </div>
        <button class="password-recovery-primary" type="submit" :disabled="!allRulesPassed || submitting">
          <Loader2 v-if="submitting" class="password-recovery-spinner" />
          <span>{{ submitting ? '重置中...' : '确认重置密码' }}</span>
        </button>
      </form>
    </div>
  </AuthRecoveryShell>

  <AuthRecoveryShell v-else>
    <div class="password-recovery-card-wrap password-recovery-card-wrap--success">
      <section class="password-recovery-card password-recovery-success" aria-labelledby="reset-success-title">
        <span class="password-recovery-success-icon">
          <img :src="successCircleIcon" alt="">
        </span>
        <div class="password-recovery-heading password-recovery-heading--center">
          <h1 id="reset-success-title">密码已重置</h1>
        </div>
        <div class="password-recovery-description password-recovery-description--success">
          <p>你的密码已成功更新，请使用新密码登录。</p>
        </div>
        <button class="password-recovery-primary" type="button" @click="goToLogin">去登录</button>
      </section>
    </div>
  </AuthRecoveryShell>
</template>
