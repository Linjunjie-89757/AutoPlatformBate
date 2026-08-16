<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { EyeOff, Loader2 } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import eyeIcon from '@/assets/auth/eye.svg'
import keyRoundIcon from '@/assets/auth/key-round.svg'
import ruleCheckIcon from '@/assets/auth/rule-check.svg'
import successCircleIcon from '@/assets/auth/success-circle.svg'
import {
  accountActivationApi,
  getAccountActivationErrorMessage,
  type AccountActivationInfo,
} from '@/features/auth-account-activation'

import AuthRecoveryShell from './components/AuthRecoveryShell.vue'

const route = useRoute()
const router = useRouter()
const info = ref<AccountActivationInfo | null>(null)
const loading = ref(true)
const password = ref('')
const confirmPassword = ref('')
const passwordVisible = ref(false)
const confirmVisible = ref(false)
const submitting = ref(false)
const requestError = ref('')
const completed = ref(false)

const token = computed(() => typeof route.query.token === 'string' ? route.query.token.trim() : '')
const hasMinimumLength = computed(() => password.value.length >= 8)
const hasLettersAndNumbers = computed(() => /[A-Za-z]/.test(password.value) && /\d/.test(password.value))
const passwordsMatch = computed(() => password.value.length > 0 && password.value === confirmPassword.value)
const allRulesPassed = computed(() => (
  hasMinimumLength.value && hasLettersAndNumbers.value && passwordsMatch.value && Boolean(info.value)
))

onMounted(async () => {
  if (!token.value) {
    requestError.value = '激活链接缺少令牌，请联系管理员重新发送邀请'
    loading.value = false
    return
  }
  try {
    info.value = await accountActivationApi.validate(token.value)
  } catch (error) {
    requestError.value = getAccountActivationErrorMessage(error)
  } finally {
    loading.value = false
  }
})

function clearError() {
  if (info.value) requestError.value = ''
}

async function submitActivation() {
  if (!allRulesPassed.value || submitting.value) return
  submitting.value = true
  requestError.value = ''
  try {
    await accountActivationApi.confirm(token.value, password.value)
    completed.value = true
  } catch (error) {
    requestError.value = getAccountActivationErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

function goToLogin() {
  void router.push('/login')
}
</script>

<template>
  <AuthRecoveryShell v-if="!completed" back-label="返回登录" @back="goToLogin">
    <div class="password-recovery-card-wrap password-recovery-card-wrap--reset">
      <form class="password-recovery-card password-recovery-reset" @submit.prevent="submitActivation">
        <span class="password-recovery-feature-icon is-key"><img :src="keyRoundIcon" alt=""></span>
        <div class="password-recovery-heading"><h1>激活平台账号</h1></div>
        <div class="password-recovery-description password-recovery-description--reset">
          <p v-if="info">{{ info.displayName }}，请设置登录密码完成账号激活。</p>
          <p v-else-if="loading">正在验证邀请链接...</p>
          <p v-else>邀请链接无法使用。</p>
        </div>

        <template v-if="info">
          <label class="password-recovery-label password-recovery-label--password" for="activation-password">登录密码</label>
          <div class="password-recovery-password-wrap">
            <div class="password-recovery-password">
              <input id="activation-password" v-model="password" class="password-recovery-input" :type="passwordVisible ? 'text' : 'password'" autocomplete="new-password" placeholder="请输入登录密码" @input="clearError">
              <button type="button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible">
                <EyeOff v-if="passwordVisible" /><img v-else :src="eyeIcon" alt="">
              </button>
            </div>
          </div>

          <label class="password-recovery-label password-recovery-label--confirm" for="activation-confirm-password">确认密码</label>
          <div class="password-recovery-password-wrap">
            <div class="password-recovery-password">
              <input id="activation-confirm-password" v-model="confirmPassword" class="password-recovery-input" :type="confirmVisible ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入登录密码" @input="clearError">
              <button type="button" :aria-label="confirmVisible ? '隐藏确认密码' : '显示确认密码'" @click="confirmVisible = !confirmVisible">
                <EyeOff v-if="confirmVisible" /><img v-else :src="eyeIcon" alt="">
              </button>
            </div>
          </div>

          <div class="password-recovery-rules-wrap">
            <div class="password-recovery-rules">
              <p :class="{ 'is-passed': hasMinimumLength }"><span><img v-if="hasMinimumLength" :src="ruleCheckIcon" alt=""></span>至少 8 个字符</p>
              <p :class="{ 'is-passed': hasLettersAndNumbers }"><span><img v-if="hasLettersAndNumbers" :src="ruleCheckIcon" alt=""></span>包含字母和数字</p>
              <p :class="{ 'is-passed': passwordsMatch }"><span><img v-if="passwordsMatch" :src="ruleCheckIcon" alt=""></span>两次密码输入一致</p>
            </div>
          </div>
        </template>

        <div v-if="requestError" class="password-recovery-alert password-recovery-alert--reset" role="alert">{{ requestError }}</div>
        <button v-if="info" class="password-recovery-primary" type="submit" :disabled="!allRulesPassed || submitting">
          <Loader2 v-if="submitting" class="password-recovery-spinner" />
          <span>{{ submitting ? '激活中...' : '激活账号' }}</span>
        </button>
        <button v-else-if="!loading" class="password-recovery-primary" type="button" @click="goToLogin">返回登录</button>
      </form>
    </div>
  </AuthRecoveryShell>

  <AuthRecoveryShell v-else>
    <div class="password-recovery-card-wrap password-recovery-card-wrap--success">
      <section class="password-recovery-card password-recovery-success" aria-labelledby="activation-success-title">
        <span class="password-recovery-success-icon"><img :src="successCircleIcon" alt=""></span>
        <div class="password-recovery-heading password-recovery-heading--center"><h1 id="activation-success-title">账号已激活</h1></div>
        <div class="password-recovery-description password-recovery-description--success"><p>你的平台账号已激活，请使用邮箱和新密码登录。</p></div>
        <button class="password-recovery-primary" type="button" @click="goToLogin">去登录</button>
      </section>
    </div>
  </AuthRecoveryShell>
</template>
