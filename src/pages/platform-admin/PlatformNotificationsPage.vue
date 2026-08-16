<script setup lang="ts">
import {
  Bell,
  Building2,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  Eye,
  LayoutDashboard,
  Loader2,
  Lock,
  ScrollText,
  Send,
  Server,
  ShieldAlert,
  Users,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { platformAdminApi } from '@/entities/platform-admin'
import { getRequestErrorMessage } from '@/shared/api/error'
import notificationToggleOff from '@/shared/assets/figma-icons/platform-admin/notification-toggle-off.svg'
import notificationToggleOn from '@/shared/assets/figma-icons/platform-admin/notification-toggle-on.svg'

interface NavigationItem {
  key: 'overview' | 'workspaces' | 'accounts' | 'requests' | 'audit' | 'notify'
  label: string
  icon: Component
  active?: boolean
  badge?: boolean
}

interface NotificationRule {
  id: string
  label: string
  description: string
  enabled: boolean
}

const rulePresentation: Record<string, Pick<NotificationRule, 'label' | 'description'>> = {
  invite: { label: '邀请成员', description: '管理员通过平台邀请新账号时发送确认邮件给被邀请人' },
  welcome: { label: '账号激活', description: '新账号首次设置密码后，发送欢迎邮件及平台使用指引' },
  reset: { label: '密码重置', description: '用户发起忘记密码请求时，发送重置链接邮件' },
  approve: { label: '申请审批通知', description: '工作区加入申请被审批通过或拒绝时，通知申请人结果' },
  disable: { label: '账号禁用告警', description: '账号被管理员手动禁用时，发送告警邮件给该账号' },
  'login-fail': { label: '连续登录失败', description: '同一账号 5 次密码错误后，发送安全告警给账号及超级管理员' },
  'task-done': { label: '自动化任务完成', description: '执行任务完成时（不论成功失败），通知任务创建人' },
  daily: { label: '每日质量报告', description: '每天早 9 点，向所有工作区管理员发送前一日测试质量摘要' },
}

const router = useRouter()
const pendingApprovalTotal = ref(0)
const showPassword = ref(false)
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const saved = ref(false)
const testSucceeded = ref(false)
const passwordConfigured = ref(false)
let savedStatusTimer: number | undefined
const smtp = reactive({
  host: '',
  port: '465',
  username: '',
  password: '',
  encryption: 'SSL/TLS',
  senderName: 'AutoTest 平台通知',
})
const rules = reactive<NotificationRule[]>([])

const navigationItems = computed<NavigationItem[]>(() => [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard },
  { key: 'workspaces', label: '工作区管理', icon: Building2 },
  { key: 'accounts', label: '账号管理', icon: Users },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText },
  { key: 'notify', label: '消息与通知', icon: Bell, active: true },
])

const enabledCount = computed(() => rules.filter(rule => rule.enabled).length)

function handleNavigation(item: NavigationItem) {
  const pathMap: Record<NavigationItem['key'], string> = {
    overview: '/platform-admin',
    workspaces: '/platform-admin/workspaces',
    accounts: '/platform-admin/accounts',
    requests: '/platform-admin/approvals',
    audit: '/platform-admin/audit-logs',
    notify: '/platform-admin/notifications',
  }
  if (!item.active) void router.push(pathMap[item.key])
}

function enableAllRules() {
  rules.forEach(rule => { rule.enabled = true })
}

function mailPayload() {
  return {
    host: smtp.host.trim(),
    port: Number(smtp.port),
    username: smtp.username.trim(),
    password: smtp.password || undefined,
    encryption: smtp.encryption,
    senderName: smtp.senderName.trim(),
  }
}

async function sendTestEmail() {
  if (testing.value) return
  testSucceeded.value = false
  testing.value = true
  try {
    await platformAdminApi.sendTestMail(mailPayload())
    testSucceeded.value = true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    testing.value = false
  }
}

async function saveConfiguration() {
  if (saving.value) return
  saved.value = false
  saving.value = true
  try {
    const updatedSettings = await platformAdminApi.saveNotificationSettings({
      ...mailPayload(),
      rules: rules.map(rule => ({ code: rule.id, enabled: rule.enabled })),
    })
    passwordConfigured.value = updatedSettings.passwordConfigured
    smtp.password = ''
    window.clearTimeout(savedStatusTimer)
    savedStatusTimer = window.setTimeout(() => { saved.value = false }, 2500)
    saved.value = true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function loadConfiguration() {
  loading.value = true
  try {
    const settings = await platformAdminApi.getNotificationSettings()
    smtp.host = settings.host || ''
    smtp.port = String(settings.port || 465)
    smtp.username = settings.username || ''
    smtp.password = ''
    smtp.encryption = settings.encryption || 'SSL/TLS'
    smtp.senderName = settings.senderName || 'AutoTest 平台通知'
    passwordConfigured.value = settings.passwordConfigured
    rules.splice(0, rules.length, ...settings.rules.map(rule => {
      const presentation = rulePresentation[rule.code]
      return {
        id: rule.code,
        label: presentation?.label || rule.label,
        description: presentation?.description || rule.description,
        enabled: rule.enabled,
      }
    }))
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  void loadConfiguration()
  try {
    pendingApprovalTotal.value = (await platformAdminApi.getOverview()).pendingApprovalTotal || 0
  } catch {
    pendingApprovalTotal.value = 0
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(savedStatusTimer)
})
</script>

<template>
  <div class="platform-notify-page">
    <aside class="platform-notify-page__sidebar" aria-label="平台管理导航">
      <div class="platform-notify-page__identity-wrap">
        <div class="platform-notify-page__identity">
          <ShieldAlert class="platform-notify-page__identity-icon" />
          <div class="platform-notify-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-notify-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-notify-page__nav-icon" />
        <span class="platform-notify-page__nav-label">{{ item.label }}</span>
        <span v-if="item.badge && pendingApprovalTotal > 0" class="platform-notify-page__nav-badge">
          {{ pendingApprovalTotal }}
        </span>
      </button>
    </aside>

    <main class="platform-notify-page__main">
      <header class="platform-notify-page__page-header">
        <div>
          <h1>消息与通知</h1>
          <p>配置邮件服务和系统通知的触发规则</p>
        </div>
        <div class="platform-notify-page__header-actions">
          <span v-if="saved" class="platform-notify-page__saved-status">
            <CheckCircle aria-hidden="true" />
            已保存
          </span>
          <button type="button" class="platform-notify-page__save-button" :disabled="saving || loading" @click="saveConfiguration">
            <CheckCircle aria-hidden="true" />
            <span>{{ saving ? '保存中...' : '保存配置' }}</span>
          </button>
        </div>
      </header>

      <div class="platform-notify-page__grid">
        <section
          class="platform-notify-page__card platform-notify-page__smtp-card"
          :class="{ 'has-test-success': testSucceeded }"
        >
          <header class="platform-notify-page__card-header">
            <span class="platform-notify-page__card-icon is-smtp"><Server /></span>
            <span class="platform-notify-page__card-title">
              <strong>SMTP 邮件服务</strong>
              <small>配置发件服务器连接参数</small>
            </span>
          </header>

          <div class="platform-notify-page__smtp-body">
            <div class="platform-notify-page__host-row">
              <label class="platform-notify-page__field">
                <span>SMTP 服务器</span>
                <input v-model="smtp.host" type="text" placeholder="smtp.example.com" />
              </label>
              <label class="platform-notify-page__field is-port">
                <span>端口</span>
                <span class="platform-notify-page__select-wrap">
                  <select v-model="smtp.port" aria-label="SMTP 端口">
                    <option value="25">25</option>
                    <option value="465">465</option>
                    <option value="587">587</option>
                    <option value="994">994</option>
                  </select>
                  <ChevronDown />
                </span>
              </label>
            </div>

            <label class="platform-notify-page__field">
              <span>发件人账号</span>
              <input v-model="smtp.username" type="text" placeholder="noreply@example.com" />
            </label>

            <label class="platform-notify-page__field">
              <span>授权密码 / SMTP 密钥</span>
              <span class="platform-notify-page__password-wrap">
                <input
                  v-model="smtp.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :placeholder="passwordConfigured ? '留空表示使用已保存密钥' : '请输入 SMTP 授权密码'"
                />
                <button
                  type="button"
                  :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="showPassword" />
                  <Lock v-else />
                </button>
              </span>
            </label>

            <div class="platform-notify-page__two-columns">
              <label class="platform-notify-page__field">
                <span>加密方式</span>
                <span class="platform-notify-page__select-wrap">
                  <select v-model="smtp.encryption" aria-label="SMTP 加密方式">
                    <option value="SSL/TLS">SSL/TLS</option>
                    <option value="STARTTLS">STARTTLS</option>
                    <option value="无加密">无加密</option>
                  </select>
                  <ChevronDown />
                </span>
              </label>
              <label class="platform-notify-page__field">
                <span>发件人显示名</span>
                <input v-model="smtp.senderName" type="text" placeholder="AutoTest 平台" />
              </label>
            </div>

            <div class="platform-notify-page__test-row">
              <span>向当前登录账号发送测试邮件</span>
              <button
                type="button"
                :class="{ 'is-testing': testing }"
                :disabled="testing || loading"
                @click="sendTestEmail"
              >
                <Loader2 v-if="testing" :size="13" class="is-spinning" />
                <Send v-else :size="13" />
                <span>{{ testing ? '发送中…' : '发送测试邮件' }}</span>
              </button>
            </div>
            <div v-if="testSucceeded" class="platform-notify-page__test-success">
              <CheckCircle aria-hidden="true" />
              <span>测试邮件已发送，请检查收件箱</span>
            </div>
          </div>
        </section>

        <section class="platform-notify-page__card platform-notify-page__rules-card">
          <header class="platform-notify-page__card-header is-rules">
            <span class="platform-notify-page__card-icon is-rules"><Bell /></span>
            <span class="platform-notify-page__card-title">
              <strong>通知触发规则</strong>
              <small>已开启 {{ enabledCount }} / {{ rules.length }} 项</small>
            </span>
            <button type="button" class="platform-notify-page__enable-all" @click="enableAllRules">
              全部开启
            </button>
          </header>

          <div class="platform-notify-page__rules">
            <div v-for="rule in rules" :key="rule.id" class="platform-notify-page__rule">
              <div class="platform-notify-page__rule-copy">
                <div>
                  <strong :class="{ 'is-disabled': !rule.enabled }">{{ rule.label }}</strong>
                  <small>邮件</small>
                </div>
                <p>{{ rule.description }}</p>
              </div>
              <button
                type="button"
                class="platform-notify-page__toggle"
                :class="{ 'is-on': rule.enabled }"
                role="switch"
                :aria-checked="rule.enabled"
                :aria-label="`${rule.label}${rule.enabled ? '已开启' : '已关闭'}`"
                @click="rule.enabled = !rule.enabled"
              >
                <img
                  :src="rule.enabled ? notificationToggleOn : notificationToggleOff"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.platform-notify-page,
.platform-notify-page * {
  box-sizing: border-box;
}

.platform-notify-page {
  display: flex;
  min-height: calc(100dvh - 42px);
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
}

.platform-notify-page button,
.platform-notify-page input,
.platform-notify-page select {
  font-family: inherit;
}

.platform-notify-page__sidebar {
  display: flex;
  width: 200px;
  min-height: calc(100dvh - 42px);
  flex: 0 0 200px;
  flex-direction: column;
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.platform-notify-page__identity-wrap {
  width: 100%;
  height: 80px;
  padding: 0 16px 8px;
}

.platform-notify-page__identity-wrap::after {
  display: block;
  width: calc(100% + 32px);
  height: 1px;
  margin: 16px 0 0 -16px;
  background: #e5e6eb;
  content: '';
}

.platform-notify-page__identity {
  display: flex;
  width: 100%;
  height: 55px;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(219, 39, 119, 0.19);
  border-radius: 10px;
  background: #fdf2f8;
}

.platform-notify-page__identity-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #db2777;
  stroke-width: 2;
}

.platform-notify-page__identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-notify-page__identity-copy strong {
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.platform-notify-page__identity-copy span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}

button.platform-notify-page__nav-item {
  display: flex;
  width: calc(100% - 16px);
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  gap: 10px;
  margin: 0 8px;
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

button.platform-notify-page__nav-item:hover:not(.is-active) {
  background: #f4f6fa;
}

button.platform-notify-page__nav-item.is-active {
  background: #fdf2f8;
  color: #db2777;
}

.platform-notify-page__nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #86909c;
  stroke-width: 2;
}

.platform-notify-page__nav-item.is-active .platform-notify-page__nav-icon {
  color: #db2777;
}

.platform-notify-page__nav-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-notify-page__nav-item.is-active .platform-notify-page__nav-label {
  font-weight: 600;
}

.platform-notify-page__nav-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 9px;
  background: #ff7d00;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.platform-notify-page__main {
  min-width: 0;
  flex: 1;
  padding: 28px;
  overflow-y: auto;
}

.platform-notify-page__page-header {
  display: flex;
  height: 48px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.platform-notify-page__page-header h1 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.platform-notify-page__page-header p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.platform-notify-page__header-actions {
  display: flex;
  height: 34px;
  align-items: center;
  gap: 10px;
}

.platform-notify-page__saved-status {
  display: inline-flex;
  height: 20px;
  align-items: center;
  gap: 5px;
  color: #00b42a;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-notify-page__saved-status svg {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.platform-notify-page__save-button {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #db2777;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: none;
}

button.platform-notify-page__save-button:hover {
  filter: brightness(1.08);
}

.platform-notify-page__save-button svg {
  width: 13px;
  height: 13px;
  stroke-width: 2;
}

.platform-notify-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: start;
}

.platform-notify-page__card {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.platform-notify-page__smtp-card {
  height: 445.5px;
}

.platform-notify-page__smtp-card.has-test-success {
  height: 471.5px;
}

.platform-notify-page__rules-card {
  height: 615.5px;
}

.platform-notify-page__card-header {
  display: flex;
  height: 71px;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-notify-page__card-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.platform-notify-page__card-icon svg {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

.platform-notify-page__card-icon.is-smtp {
  background: #fdf2f8;
  color: #db2777;
}

.platform-notify-page__card-icon.is-rules {
  background: #e8f3ff;
  color: #165dff;
}

.platform-notify-page__card-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.platform-notify-page__card-title strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.platform-notify-page__card-title small {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.platform-notify-page__smtp-body {
  display: flex;
  height: 373.5px;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.platform-notify-page__host-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px;
  gap: 10px;
}

.platform-notify-page__two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.platform-notify-page__field {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 6px;
}

.platform-notify-page__field > span:first-child {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.platform-notify-page__field input,
.platform-notify-page__field select {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  transition: none;
}

.platform-notify-page__field input:focus {
  border-color: #db2777;
  box-shadow: 0 0 0 2px rgba(219, 39, 119, 0.125);
}

.platform-notify-page__field input::placeholder {
  color: #c9cdd4;
}

.platform-notify-page__select-wrap,
.platform-notify-page__password-wrap {
  position: relative;
  display: block;
}

.platform-notify-page__select-wrap select {
  padding-right: 30px;
  appearance: none;
}

.platform-notify-page__select-wrap > svg {
  position: absolute;
  top: 11px;
  right: 10px;
  width: 14px;
  height: 14px;
  color: #1d2129;
  pointer-events: none;
  stroke-width: 2;
}

.platform-notify-page__password-wrap input {
  padding-right: 36px;
}

.platform-notify-page__password-wrap button {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.platform-notify-page__password-wrap button svg {
  width: 14px;
  height: 14px;
  stroke-width: 2;
}

.platform-notify-page__test-row {
  display: flex;
  height: 36px;
  min-height: 36px;
  flex: 0 0 36px;
  align-items: flex-end;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px dashed #e5e6eb;
}

.platform-notify-page__test-row > span {
  padding-bottom: 7px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-notify-page__test-row button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
  transition: none;
}

.platform-notify-page__test-row button svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  stroke-width: 2;
}

.platform-notify-page__test-row button:disabled {
  cursor: not-allowed;
}

.platform-notify-page__test-row button.is-testing {
  width: 99px;
}

.platform-notify-page__test-row button .is-spinning {
  animation: platform-notify-spin 1s linear infinite;
}

.platform-notify-page__test-success {
  display: flex;
  height: 26px;
  flex: 0 0 26px;
  align-items: center;
  gap: 5px;
  padding-top: 8px;
  color: #00b42a;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-notify-page__test-success svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  stroke-width: 2;
}

@keyframes platform-notify-spin {
  to { transform: rotate(360deg); }
}

.platform-notify-page__enable-all {
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-notify-page__rule {
  display: flex;
  height: 69px;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-notify-page__rule:last-child {
  height: 68px;
  border-bottom: 0;
}

.platform-notify-page__rule-copy {
  min-width: 0;
  flex: 1;
}

.platform-notify-page__rule-copy > div {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.platform-notify-page__rule-copy strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.platform-notify-page__rule-copy strong.is-disabled {
  color: #86909c;
}

.platform-notify-page__rule-copy small {
  padding: 1px 6px;
  border-radius: 10px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.platform-notify-page__rule-copy p {
  overflow: hidden;
  margin: 0;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-notify-page__toggle {
  display: inline-flex;
  width: 26px;
  height: 27px;
  flex: 0 0 26px;
  margin-top: 0;
  padding: 1px 0 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.platform-notify-page__toggle.is-on {
  color: #db2777;
}

.platform-notify-page__toggle img {
  display: block;
  width: 26px;
  height: 26px;
}

@media (max-width: 1100px) {
  .platform-notify-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
