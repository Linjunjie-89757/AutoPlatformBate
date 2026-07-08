<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  Activity,
  AlertCircle,
  Bot,
  Bug,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Globe2,
  Loader2,
  Timer,
  type LucideIcon,
} from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'

import { useLogin } from '@/features/auth-login'

const router = useRouter()
const route = useRoute()
const { loading, errorMessage, login } = useLogin()

const form = reactive({
  username: '',
  password: '',
})

const rememberAccount = ref(false)
const passwordVisible = ref(false)
const usernameError = ref('')
const passwordError = ref('')

const featureItems: Array<{
  icon: LucideIcon
  label: string
  description: string
  color: string
}> = [
  { icon: Bot, label: 'AI 用例生成', description: '需求驱动，自动生成', color: '#8b5cf6' },
  { icon: Globe2, label: '接口自动化', description: '场景化测试套件执行', color: '#165dff' },
  { icon: Activity, label: 'Web UI 自动化', description: '录制 + AI 优化断言', color: '#10b981' },
  { icon: Bug, label: '缺陷追踪', description: '发现到修复全流程', color: '#ef4444' },
  { icon: Timer, label: '任务调度', description: '定时执行和历史查看', color: '#f59e0b' },
  { icon: FileText, label: '智能报告', description: '多维度数据可视化', color: '#06b6d4' },
]

const executionLogs = [
  { tone: 'dim', text: '# 2026-07-07 14:30:01 触发: 定时调度' },
  { tone: 'ok', text: '✓ POST /api/v1/orders 200 142ms' },
  { tone: 'ok', text: '✓ GET /api/v1/orders/list 200 89ms' },
  { tone: 'ok', text: '✓ PUT /api/v1/orders/status 200 204ms' },
  { tone: 'fail', text: '✗ DELETE /api/v1/orders/52 500 3021ms' },
  { tone: 'warn', text: '△ 超时 > 3s，已推送企业微信告警通知' },
  { tone: 'ai', text: '◆ AI 分析: 建议增加重试断言，生成 3 个边界用例' },
  { tone: 'sum', text: '▸ 通过 47/48 失败 1 耗时 4m 22s' },
]

const stats = [
  { label: '今日执行', value: '236 次', tone: 'default' },
  { label: '整体通过率', value: '93.6%', tone: 'success' },
  { label: '在线 Runner', value: '6 个', tone: 'info' },
]

function resolveRedirect() {
  const redirect = route.query.redirect
  if (
    typeof redirect === 'string'
    && redirect.startsWith('/')
    && !redirect.startsWith('/login')
    && !redirect.startsWith('/workspaces/select')
  ) {
    return redirect
  }

  return '/config-center'
}

async function handleSubmit() {
  if (loading.value) {
    return
  }

  usernameError.value = form.username.trim() ? '' : '请输入账号'
  passwordError.value = form.password ? '' : '请输入密码'

  if (usernameError.value || passwordError.value) {
    return
  }

  try {
    await login({
      username: form.username.trim(),
      password: form.password,
    })
    await router.replace({
      path: '/workspaces/select',
      query: {
        redirect: resolveRedirect(),
      },
    })
  } catch {
    // useLogin exposes a stable, normalized error message for the page.
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-page__showcase" aria-label="平台能力展示">
      <div class="login-page__brand login-page__brand--dark">
        <span class="login-page__brand-mark">
          <FlaskConical class="login-page__brand-icon" />
        </span>
        <span class="login-page__brand-name">AutoTest</span>
        <span class="login-page__version">v2.4.1</span>
      </div>

      <div class="login-page__hero">
        <h1 class="login-page__hero-title">
          工程效率，<br>
          从测试开始
        </h1>
        <p class="login-page__hero-copy">
          AI 驱动的企业级自动化测试平台，<br>
          让质量保障不再成为交付的瓶颈
        </p>
      </div>

      <div class="login-page__features">
        <article
          v-for="item in featureItems"
          :key="item.label"
          class="login-page__feature"
          :style="{ '--feature-color': item.color }"
        >
          <span class="login-page__feature-icon">
            <component :is="item.icon" />
          </span>
          <span class="login-page__feature-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
        </article>
      </div>

      <section class="login-page__terminal" aria-label="执行日志示例">
        <header class="login-page__terminal-header">
          <span class="login-page__terminal-dot login-page__terminal-dot--red" />
          <span class="login-page__terminal-dot login-page__terminal-dot--yellow" />
          <span class="login-page__terminal-dot login-page__terminal-dot--green" />
          <span class="login-page__terminal-title">execution.log</span>
          <span class="login-page__terminal-live">● LIVE</span>
        </header>
        <div class="login-page__terminal-body">
          <p
            v-for="(line, index) in executionLogs"
            :key="index"
            class="login-page__log-line"
            :class="`is-${line.tone}`"
          >
            {{ line.text }}
          </p>
        </div>
      </section>

      <dl class="login-page__stats">
        <div
          v-for="item in stats"
          :key="item.label"
          class="login-page__stat"
          :class="`is-${item.tone}`"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="login-page__form-panel" aria-label="登录表单">
      <form class="login-page__form-card" @submit.prevent="handleSubmit">
        <div class="login-page__brand login-page__brand--light">
          <span class="login-page__brand-mark">
            <FlaskConical class="login-page__brand-icon" />
          </span>
          <span class="login-page__brand-name">AutoTest</span>
        </div>

        <div class="login-page__form-heading">
          <h2>欢迎回来</h2>
          <p>请使用企业账号登录以继续使用平台</p>
        </div>

        <div v-if="errorMessage" class="login-page__error" role="alert">
          <AlertCircle class="login-page__error-icon" />
          <span>{{ errorMessage }}</span>
        </div>

        <label class="login-page__field">
          <span class="login-page__field-label">账号</span>
          <input
            v-model="form.username"
            class="login-page__input"
            :class="{ 'is-invalid': usernameError }"
            autocomplete="username"
            placeholder="请输入邮箱或用户名"
            type="text"
            @input="usernameError = ''"
          >
          <span v-if="usernameError" class="login-page__field-error">{{ usernameError }}</span>
        </label>

        <label class="login-page__field">
          <span class="login-page__field-label">密码</span>
          <span class="login-page__password-wrap">
            <input
              v-model="form.password"
              class="login-page__input login-page__input--password"
              :class="{ 'is-invalid': passwordError }"
              autocomplete="current-password"
              placeholder="请输入密码"
              :type="passwordVisible ? 'text' : 'password'"
              @input="passwordError = ''"
              @keyup.enter="handleSubmit"
            >
            <button
              class="login-page__password-toggle"
              type="button"
              :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
              @click="passwordVisible = !passwordVisible"
            >
              <EyeOff v-if="passwordVisible" />
              <Eye v-else />
            </button>
          </span>
          <span v-if="passwordError" class="login-page__field-error">{{ passwordError }}</span>
        </label>

        <div class="login-page__form-options">
          <label class="login-page__remember">
            <input v-model="rememberAccount" type="checkbox">
            <span class="login-page__checkbox" aria-hidden="true" />
            <span>记住账号</span>
          </label>
          <button class="login-page__link-button" type="button">忘记密码</button>
        </div>

        <button
          class="login-page__submit"
          type="submit"
          :disabled="loading"
        >
          <Loader2 v-if="loading" class="login-page__submit-spinner" />
          <span>{{ loading ? '登录中...' : '登录' }}</span>
        </button>

        <p class="login-page__demo-hint">输入密码 “wrong” 可演示错误状态</p>
        <p class="login-page__hint">如需账号，请联系管理员邀请 · AutoTest v2.4.1</p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: 100dvh;
  overflow: hidden;
  background: #fff;
  font-family: var(--app-font-family);
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

.login-page__showcase {
  display: flex;
  width: 58%;
  min-width: 640px;
  flex-direction: column;
  padding: 44px 52px;
  background: #0d1117;
}

.login-page__brand {
  display: flex;
  align-items: center;
  gap: 8.75px;
}

.login-page__brand--dark {
  height: 73.5px;
  align-items: flex-start;
}

.login-page__brand--light {
  height: 24.5px;
  margin-bottom: 35px;
}

.login-page__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 12px;
  background: linear-gradient(135deg, #165dff, #4f8eff);
  color: #fff;
}

.login-page__brand--dark .login-page__brand-mark {
  width: 31.5px;
  height: 31.5px;
  border-radius: 11px;
}

.login-page__brand-icon {
  width: 18px;
  height: 18px;
}

.login-page__brand--light .login-page__brand-mark {
  width: 24.5px;
  height: 24.5px;
  border-radius: 7px;
}

.login-page__brand--light .login-page__brand-icon {
  width: 13px;
  height: 13px;
}

.login-page__brand-name {
  margin-top: 2.25px;
  color: #e6edf3;
  font-size: 18px;
  font-weight: 700;
  line-height: 27px;
}

.login-page__brand--light .login-page__brand-name {
  margin-top: 2.25px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.login-page__version {
  margin-top: 5.5px;
  margin-left: 0;
  padding: 2.75px 8px;
  border: 1px solid #30363d;
  border-radius: 3.5px;
  background: #21262d;
  color: #7d8590;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  line-height: 15px;
}

.login-page__hero {
  height: 159.5px;
}

.login-page__hero-title {
  margin: 0;
  color: #e6edf3;
  font-size: 27px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 33.75px;
}

.login-page__hero-copy {
  max-width: 360px;
  margin: 10.5px 0 0;
  color: #7d8590;
  font-size: 14px;
  line-height: 22.75px;
}

.login-page__features {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8.25px 8.75px;
  height: 214.5px;
  margin-bottom: 0;
}

.login-page__feature {
  display: flex;
  align-items: center;
  gap: 10.5px;
  height: 58px;
  min-width: 0;
  padding: 11.5px;
  border: 1px solid #21262d;
  border-radius: 11px;
  background: #161b22;
}

.login-page__feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 auto;
  border-radius: 7px;
  background: color-mix(in srgb, var(--feature-color) 13%, transparent);
  color: var(--feature-color);
}

.login-page__feature-icon svg {
  width: 14px;
  height: 14px;
}

.login-page__feature-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.login-page__feature-copy strong {
  overflow: hidden;
  color: #e6edf3;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-page__feature-copy small {
  overflow: hidden;
  color: #7d8590;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-page__terminal {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #21262d;
  border-radius: 11px;
  background: #010409;
}

.login-page__terminal-header {
  display: flex;
  align-items: center;
  gap: 5.25px;
  height: 39px;
  padding: 8.75px 14px 9.75px;
  border-bottom: 1px solid #21262d;
  background: #161b22;
}

.login-page__terminal-dot {
  width: 8.75px;
  height: 8.75px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.login-page__terminal-dot--red {
  background: #f85149;
}

.login-page__terminal-dot--yellow {
  background: #e3b341;
}

.login-page__terminal-dot--green {
  background: #3fb950;
}

.login-page__terminal-title {
  margin-left: 10.5px;
  color: #7d8590;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 16.5px;
}

.login-page__terminal-live {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid #2ea043;
  border-radius: 4px;
  background: #1b2a1b;
  color: #3fb950;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  line-height: 15px;
}

.login-page__terminal-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3.5px;
  overflow: hidden;
  padding: 14px;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 16.5px;
}

.login-page__log-line {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-page__log-line.is-dim {
  color: #7d8590;
}

.login-page__log-line.is-ok {
  color: #3fb950;
}

.login-page__log-line.is-fail {
  color: #f85149;
}

.login-page__log-line.is-warn {
  color: #e3b341;
}

.login-page__log-line.is-ai {
  color: #a78bfa;
}

.login-page__log-line.is-sum {
  color: #79c0ff;
}

.login-page__stats {
  display: flex;
  gap: 28px;
  height: 60.25px;
  margin: 0;
  padding: 0;
  padding-top: 17.5px;
}

.login-page__stat {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

.login-page__stat dt {
  color: #7d8590;
  font-size: 10px;
  line-height: 16px;
}

.login-page__stat dd {
  margin: 0;
  color: #e6edf3;
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
}

.login-page__stat.is-success dd {
  color: #3fb950;
}

.login-page__stat.is-info dd {
  color: #79c0ff;
}

.login-page__form-panel {
  display: flex;
  width: 42%;
  min-width: 440px;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.login-page__form-card {
  width: 100%;
  max-width: 360px;
  min-height: 442.25px;
  padding: 0 40px;
}

.login-page__form-heading {
  margin-bottom: 25.5px;
}

.login-page__form-heading h2 {
  margin: 0 0 5.25px;
  color: #1d2129;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 36px;
}

.login-page__form-heading p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  line-height: 19.5px;
}

.login-page__error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
  padding: 12px 14px;
  border: 1px solid #ffccc7;
  border-radius: 12px;
  background: #fff0f0;
  color: #f53f3f;
  font-size: 13px;
  line-height: 20px;
}

.login-page__error-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin-top: 2px;
}

.login-page__field {
  display: block;
  margin-bottom: 14px;
}

.login-page__field + .login-page__field {
  margin-bottom: 0;
}

.login-page__field-label {
  display: block;
  margin-bottom: 5.25px;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.login-page__input {
  width: 100%;
  height: 35px;
  padding: 0 13.25px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 14px;
  line-height: 20px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.login-page__input::placeholder {
  color: #c9cdd4;
}

.login-page__input:focus {
  border-color: #165dff;
  box-shadow: 0 0 0 3px rgba(22, 93, 255, 0.1);
}

.login-page__input.is-invalid {
  border-color: #f53f3f;
}

.login-page__input.is-invalid:focus {
  border-color: #f53f3f;
  box-shadow: 0 0 0 3px rgba(245, 63, 63, 0.1);
}

.login-page__field-error {
  display: block;
  margin-top: 6px;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.login-page__password-wrap {
  position: relative;
  display: block;
}

.login-page__input--password {
  padding-right: 36px;
}

.login-page__password-toggle {
  position: absolute;
  top: 50%;
  right: 10.5px;
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  transform: translateY(-50%);
  transition: color 0.16s ease;
}

.login-page__password-toggle:hover {
  color: #86909c;
}

.login-page__password-toggle svg {
  width: 16px;
  height: 16px;
}

.login-page__form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 21.5px;
}

.login-page__remember {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
  user-select: none;
}

.login-page__remember input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.login-page__checkbox {
  position: relative;
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 2px solid #c9cdd4;
  border-radius: 3.5px;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.login-page__remember input:checked + .login-page__checkbox {
  border-color: #165dff;
  background: #165dff;
}

.login-page__remember input:checked + .login-page__checkbox::after {
  width: 7px;
  height: 4px;
  border-bottom: 1.5px solid #fff;
  border-left: 1.5px solid #fff;
  content: '';
  transform: translateY(-1px) rotate(-45deg);
}

.login-page__link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
}

.login-page__submit {
  display: inline-flex;
  width: 100%;
  height: 35px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 11px;
  background: #165dff;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
  transition: filter 0.16s ease, background-color 0.16s ease;
}

.login-page__submit:hover:not(:disabled) {
  filter: brightness(1.08);
}

.login-page__submit:disabled {
  background: #94bfff;
  cursor: not-allowed;
}

.login-page__submit-spinner {
  width: 15px;
  height: 15px;
  animation: login-spin 0.8s linear infinite;
}

.login-page__hint {
  margin: 24.5px 0 0;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
  text-align: center;
}

.login-page__demo-hint {
  margin: 14px 0 0;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
  text-align: center;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .login-page__showcase {
    width: 54%;
    min-width: 540px;
    padding: 36px 36px;
  }

  .login-page__form-panel {
    width: 46%;
    min-width: 400px;
  }
}

@media (max-width: 860px) {
  .login-page {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 24px;
    background: #0d1117;
  }

  .login-page__showcase {
    display: none;
  }

  .login-page__form-panel {
    width: min(100%, 440px);
    min-width: 0;
    border: 1px solid #21262d;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  }

  .login-page__form-card {
    max-width: none;
    min-height: 0;
    padding: 36px 32px;
  }
}
</style>
