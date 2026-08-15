<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { Loader2, RotateCcw } from '@lucide/vue'
import { useRouter } from 'vue-router'

import mailIcon from '@/assets/auth/mail.svg'
import rotateCcwIcon from '@/assets/auth/rotate-ccw.svg'
import successCircleIcon from '@/assets/auth/success-circle.svg'
import {
  getPasswordResetErrorMessage,
  passwordResetApi,
} from '@/features/auth-password-reset'

import AuthRecoveryShell from './components/AuthRecoveryShell.vue'

const router = useRouter()
const view = ref<'form' | 'sent'>('form')
const email = ref('')
const submittedEmail = ref('')
const fieldError = ref('')
const requestError = ref('')
const sending = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | undefined

const maskedEmail = computed(() => {
  const [local = '', domain = ''] = submittedEmail.value.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible || '*'}***@${domain}`
})

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = undefined
  }
}

function startCountdown(seconds: number) {
  clearCountdown()
  countdown.value = Math.max(0, Math.round(seconds))
  countdownTimer = setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1)
    if (countdown.value === 0) {
      clearCountdown()
    }
  }, 1000)
}

function validateEmail() {
  const normalized = email.value.trim()
  if (!normalized) {
    fieldError.value = '请输入邮箱地址'
    return ''
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fieldError.value = '请输入有效的邮箱地址'
    return ''
  }
  fieldError.value = ''
  return normalized
}

async function submitEmail() {
  if (sending.value) return
  const normalized = validateEmail()
  if (!normalized) return

  requestError.value = ''
  sending.value = true
  try {
    const result = await passwordResetApi.request(normalized)
    submittedEmail.value = normalized
    view.value = 'sent'
    startCountdown(result.resendCooldownSeconds)
  } catch (error) {
    requestError.value = getPasswordResetErrorMessage(error)
  } finally {
    sending.value = false
  }
}

async function resendEmail() {
  if (sending.value || countdown.value > 0) return
  requestError.value = ''
  sending.value = true
  try {
    const result = await passwordResetApi.request(submittedEmail.value)
    startCountdown(result.resendCooldownSeconds)
  } catch (error) {
    requestError.value = getPasswordResetErrorMessage(error)
  } finally {
    sending.value = false
  }
}

function handleEmailInput() {
  fieldError.value = ''
  requestError.value = ''
}

function goToLogin() {
  void router.push('/login')
}

onUnmounted(clearCountdown)
</script>

<template>
  <AuthRecoveryShell
    v-if="view === 'form'"
    back-label="返回登录"
    @back="goToLogin"
  >
    <div class="password-recovery-card-wrap password-recovery-card-wrap--forgot">
      <form class="password-recovery-card password-recovery-forgot" @submit.prevent="submitEmail">
        <span class="password-recovery-feature-icon is-mail">
          <img :src="mailIcon" alt="">
        </span>

        <div class="password-recovery-heading">
          <h1>找回密码</h1>
        </div>
        <div class="password-recovery-description password-recovery-description--forgot">
          <p>输入你注册时使用的邮箱，我们将向该邮箱发送密码重置链接。</p>
        </div>
        <label class="password-recovery-label password-recovery-label--email" for="recovery-email">
          <span>注册邮箱</span>
          <b>*</b>
        </label>

        <div class="password-recovery-forgot__actions" :class="{ 'has-message': fieldError || requestError }">
          <input
            id="recovery-email"
            v-model="email"
            class="password-recovery-input"
            :class="{ 'is-invalid': fieldError }"
            type="email"
            autocomplete="email"
            placeholder="请输入邮箱地址"
            @input="handleEmailInput"
          >
          <p v-if="fieldError" class="password-recovery-field-error">{{ fieldError }}</p>
          <div v-if="requestError" class="password-recovery-alert" role="alert">{{ requestError }}</div>
          <button class="password-recovery-primary" type="submit" :disabled="sending">
            <Loader2 v-if="sending" class="password-recovery-spinner" />
            <span>{{ sending ? '发送中...' : '发送重置邮件' }}</span>
          </button>
        </div>
      </form>
    </div>

    <p class="password-recovery-forgot__footer">
      <span>想起密码了？</span>
      <button type="button" @click="goToLogin">返回登录</button>
    </p>
  </AuthRecoveryShell>

  <AuthRecoveryShell v-else>
    <div class="password-recovery-card-wrap password-recovery-card-wrap--sent">
      <section class="password-recovery-card password-recovery-sent" aria-labelledby="mail-sent-title">
        <span class="password-recovery-success-icon">
          <img :src="successCircleIcon" alt="">
        </span>
        <div class="password-recovery-heading password-recovery-heading--center">
          <h1 id="mail-sent-title">邮件已发送</h1>
        </div>
        <div class="password-recovery-description password-recovery-description--sent">
          <p>重置链接已发送至</p>
        </div>
        <div class="password-recovery-sent__email-wrap">
          <strong>{{ maskedEmail }}</strong>
        </div>
        <div class="password-recovery-sent__copy">
          <p>链接有效期 <b>30 分钟</b>，请尽快操作。</p>
          <p>没收到邮件？请检查垃圾邮件或重新发送。</p>
        </div>
        <div v-if="requestError" class="password-recovery-alert password-recovery-alert--sent" role="alert">
          {{ requestError }}
        </div>
        <div class="password-recovery-sent__resend-wrap">
          <button
            class="password-recovery-resend"
            type="button"
            :disabled="countdown > 0 || sending"
            @click="resendEmail"
          >
            <Loader2 v-if="sending" class="password-recovery-spinner is-muted" />
            <img v-else-if="countdown > 0" :src="rotateCcwIcon" alt="">
            <RotateCcw v-else />
            <span v-if="sending">发送中...</span>
            <span v-else-if="countdown > 0">{{ countdown }} 秒后可重新发送</span>
            <span v-else>重新发送</span>
          </button>
        </div>
        <div class="password-recovery-sent__actions">
          <button class="password-recovery-primary is-compact" type="button" @click="goToLogin">
            返回登录
          </button>
          <p>请通过邮件中的链接设置新密码</p>
        </div>
      </section>
    </div>
  </AuthRecoveryShell>
</template>
