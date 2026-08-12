<script setup lang="ts">
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  type LucideIcon,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/entities/session'
import { AppFigmaSwitch } from '@/shared/ui'

type ProfileTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'appearance'
type ThemeMode = 'light' | 'dark' | 'system'
type DensityMode = 'compact' | 'normal' | 'relaxed'

interface ProfileTabItem {
  key: ProfileTab
  label: string
  description: string
  icon: LucideIcon
}

const route = useRoute()
const router = useRouter()
const { currentUser } = useSession()

const profileTabs: ProfileTabItem[] = [
  { key: 'profile', label: '个人资料', description: '头像、昵称、基本信息', icon: User },
  { key: 'security', label: '安全设置', description: '密码、登录设备', icon: Shield },
  { key: 'preferences', label: '操作偏好', description: '默认工作区、语言等', icon: SlidersHorizontal },
  { key: 'notifications', label: '通知偏好', description: '任务通知、声音', icon: Bell },
  { key: 'appearance', label: '主题外观', description: '亮色、暗色、跟随系统', icon: Palette },
]

const moduleOptions = [
  { value: 'overview', label: '工作台' },
  { value: 'cases-list', label: '用例管理' },
  { value: 'cases-ai-gen', label: 'AI 用例生成' },
  { value: 'bugs', label: '缺陷管理' },
  { value: 'api', label: '接口自动化' },
  { value: 'webui', label: 'Web UI 自动化' },
  { value: 'tasks', label: '任务管理' },
  { value: 'reports', label: '报表中心' },
]

const avatarColors = ['#165DFF', '#7816FF', '#00B42A', '#FF7D00', '#F53F3F', '#0FC6C2', '#1D2129']

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  TEST_MANAGER: '项目负责人',
  TESTER: '测试工程师',
  VIEWER: '只读访客',
}

function normalizeTab(value: unknown): ProfileTab {
  const tab = Array.isArray(value) ? value[0] : value
  return profileTabs.some(item => item.key === tab) ? tab as ProfileTab : 'profile'
}

const activeTab = ref<ProfileTab>(normalizeTab(route.query.tab))
const activeTabMeta = computed(() => profileTabs.find(item => item.key === activeTab.value) || profileTabs[0])
const userDisplayName = computed(() => currentUser.value?.displayName || currentUser.value?.username || '当前用户')
const userRoleText = computed(() => {
  const roleCode = currentUser.value?.roleCode || ''
  return roleLabels[roleCode] || roleCode || '已登录用户'
})
const userInitial = computed(() => userDisplayName.value.slice(0, 1).toUpperCase())

const realName = ref(userDisplayName.value)
const displayName = ref(userDisplayName.value)
const email = ref('')
const bio = ref('')
const avatarColor = ref('#165DFF')
const avatarImage = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const passwordStrength = computed(() => {
  const password = newPassword.value
  if (!password) return 0
  if (password.length < 6) return 1
  if (password.length < 10) return 2
  if (/[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) return 4
  return 3
})
const passwordStrengthLabel = computed(() => ['', '太弱', '较弱', '中等', '强'][passwordStrength.value])
const passwordStrengthColor = computed(() => ['', '#F53F3F', '#FF7D00', '#FF7D00', '#00B42A'][passwordStrength.value])
const passwordsMatch = computed(() => Boolean(confirmPassword.value) && newPassword.value === confirmPassword.value)
const canUpdatePassword = computed(() => Boolean(
  currentPassword.value
  && newPassword.value.length >= 8
  && passwordsMatch.value,
))

const defaultModule = ref('overview')
const language = ref('zh')
const pageSize = ref('20')
const rememberSidebar = ref(true)
const confirmBeforeDelete = ref(true)
const autoSaveDraft = ref(false)

const taskCompleteNotification = ref(true)
const taskFailedNotification = ref(true)
const aiCompleteNotification = ref(true)
const desktopNotification = ref(true)
const dailyEmailNotification = ref(false)
const notificationSound = ref(false)

const themeMode = ref<ThemeMode>('light')
const densityMode = ref<DensityMode>('normal')
const fontSize = ref('14')

const loginDevices = [
  { name: 'Chrome · Windows', ip: '192.168.1.12', time: '当前会话', current: true },
  { name: 'Safari · iPhone 15', ip: '192.168.1.88', time: '2小时前', current: false },
  { name: 'Chrome · macOS', ip: '10.0.0.23', time: '昨天 14:32', current: false },
]

const notificationItems = [
  { label: '任务执行完成', description: '自动化任务运行结束时通知', value: taskCompleteNotification },
  { label: '任务执行失败', description: '任务异常或失败时立即通知', value: taskFailedNotification },
  { label: 'AI 用例生成完成', description: 'AI 生成任务完成时通知', value: aiCompleteNotification },
  { label: '桌面推送通知', description: '在浏览器外时发送系统通知', value: desktopNotification },
  { label: '邮件摘要（每日）', description: '每天汇总发送当日任务报告', value: dailyEmailNotification },
  { label: '通知声音', description: '收到通知时播放提示音', value: notificationSound },
]

const themeOptions: Array<{ key: ThemeMode; label: string; description: string; icon: LucideIcon }> = [
  { key: 'light', label: '亮色', description: '明亮清爽的默认主题', icon: Sun },
  { key: 'dark', label: '暗色', description: '深色背景，减少眼部疲劳', icon: Moon },
  { key: 'system', label: '跟随系统', description: '自动匹配操作系统设置', icon: Monitor },
]

const densityOptions: Array<{ key: DensityMode; label: string; description: string }> = [
  { key: 'compact', label: '紧凑', description: '更多信息，适合大屏' },
  { key: 'normal', label: '标准', description: '默认间距，均衡体验' },
  { key: 'relaxed', label: '宽松', description: '更大间距，阅读舒适' },
]

watch(
  () => route.query.tab,
  value => {
    activeTab.value = normalizeTab(value)
  },
)

watch(userDisplayName, value => {
  if (!realName.value || realName.value === '当前用户') realName.value = value
  if (!displayName.value || displayName.value === '当前用户') displayName.value = value
})

async function selectTab(tab: ProfileTab) {
  activeTab.value = tab
  await router.replace({ query: { ...route.query, tab } })
}

function handleBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}

function chooseAvatarColor(color: string) {
  avatarColor.value = color
  avatarImage.value = ''
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function handleAvatarFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像文件不能超过 2MB')
    target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    avatarImage.value = typeof reader.result === 'string' ? reader.result : ''
  }
  reader.readAsDataURL(file)
}

function saveLocalSettings(message: string) {
  ElMessage.warning(`${message}，后端持久化接口尚未接入`)
}

function saveProfile() {
  ElMessage.warning('个人资料更新接口尚未接入，当前修改仅保留在本页面')
}

function updatePassword() {
  if (!canUpdatePassword.value) return
  ElMessage.warning('当前后端尚未提供个人密码修改接口')
}

function offlineDevice() {
  ElMessage.warning('登录设备下线接口尚未接入')
}
</script>

<template>
  <div class="profile-settings">
    <aside class="profile-settings__sidebar">
      <div class="profile-settings__sidebar-header">
        <button class="profile-settings__back" type="button" @click="handleBack">
          <ArrowLeft />
          <span>返回</span>
        </button>

        <div class="profile-settings__mini-profile">
          <span class="profile-settings__mini-avatar">{{ userInitial }}</span>
          <div class="profile-settings__mini-copy">
            <strong>{{ userDisplayName }}</strong>
            <span>{{ userRoleText }}</span>
          </div>
        </div>
      </div>

      <nav class="profile-settings__tabs" aria-label="个人设置导航">
        <button
          v-for="tab in profileTabs"
          :key="tab.key"
          class="profile-settings__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          type="button"
          @click="selectTab(tab.key)"
        >
          <component :is="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <section class="profile-settings__workspace">
      <div class="profile-settings__content">
        <header class="profile-settings__page-header">
          <div class="profile-settings__title-row">
            <component :is="activeTabMeta.icon" />
            <h1>{{ activeTabMeta.label }}</h1>
          </div>
          <p>{{ activeTabMeta.description }}</p>
        </header>

        <template v-if="activeTab === 'profile'">
          <section class="profile-card profile-card--avatar">
            <header class="profile-card__header"><h2>头像</h2></header>
            <div class="profile-card__body profile-avatar-editor">
              <div class="profile-avatar-editor__preview">
                <img v-if="avatarImage" :src="avatarImage" alt="个人头像">
                <span v-else :style="{ backgroundColor: avatarColor }">{{ userInitial }}</span>
                <button type="button" aria-label="上传头像" @click="openAvatarPicker"><Camera /></button>
                <input ref="avatarInput" type="file" accept="image/jpeg,image/png" @change="handleAvatarFile">
              </div>
              <div class="profile-avatar-editor__options">
                <strong>背景颜色</strong>
                <div class="profile-avatar-editor__colors">
                  <button
                    v-for="color in avatarColors"
                    :key="color"
                    type="button"
                    :class="{ 'is-active': avatarColor === color && !avatarImage }"
                    :style="{ '--avatar-color': color }"
                    :aria-label="`选择${color}头像背景`"
                    @click="chooseAvatarColor(color)"
                  />
                </div>
                <small>支持上传 JPG / PNG，最大 2MB</small>
              </div>
            </div>
          </section>

          <section class="profile-card profile-card--info">
            <header class="profile-card__header"><h2>基本信息</h2></header>
            <div class="profile-card__body">
              <div class="profile-field">
                <label>真实姓名</label>
                <input v-model="realName" type="text" placeholder="请输入姓名">
              </div>
              <div class="profile-field">
                <label>昵称 / 显示名<small>页面中展示的名称</small></label>
                <input v-model="displayName" type="text" placeholder="请输入显示名称">
              </div>
              <div class="profile-field">
                <label>邮箱<small>用于接收通知</small></label>
                <input v-model="email" type="email" placeholder="当前账号未配置邮箱" disabled>
              </div>
              <div class="profile-field">
                <label>角色</label>
                <input :value="userRoleText" type="text" disabled>
              </div>
              <div class="profile-field">
                <label>个人简介</label>
                <textarea v-model="bio" rows="3" placeholder="介绍一下自己..." />
              </div>
              <div class="profile-card__actions">
                <button class="profile-primary-button" type="button" @click="saveProfile"><Save />保存资料</button>
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'security'">
          <section class="profile-card profile-card--password">
            <header class="profile-card__header"><h2>修改密码</h2></header>
            <div class="profile-card__body">
              <div class="profile-field">
                <label>当前密码</label>
                <div class="profile-password">
                  <input v-model="currentPassword" :type="showCurrentPassword ? 'text' : 'password'" placeholder="请输入当前密码">
                  <button type="button" aria-label="显示或隐藏当前密码" @click="showCurrentPassword = !showCurrentPassword">
                    <EyeOff v-if="showCurrentPassword" /><Eye v-else />
                  </button>
                </div>
              </div>
              <div class="profile-field">
                <label>新密码<small>至少 8 位</small></label>
                <div class="profile-field__stack">
                  <div class="profile-password">
                    <input v-model="newPassword" :type="showNewPassword ? 'text' : 'password'" placeholder="请输入新密码">
                    <button type="button" aria-label="显示或隐藏新密码" @click="showNewPassword = !showNewPassword">
                      <EyeOff v-if="showNewPassword" /><Eye v-else />
                    </button>
                  </div>
                  <div v-if="newPassword" class="profile-password-strength">
                    <div><span v-for="index in 4" :key="index" :style="{ background: index <= passwordStrength ? passwordStrengthColor : '#E5E6EB' }" /></div>
                    <small :style="{ color: passwordStrengthColor }">{{ passwordStrengthLabel }}</small>
                  </div>
                </div>
              </div>
              <div class="profile-field">
                <label>确认新密码</label>
                <div class="profile-field__stack">
                  <div class="profile-password">
                    <input v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" placeholder="再次输入新密码">
                    <button type="button" aria-label="显示或隐藏确认密码" @click="showConfirmPassword = !showConfirmPassword">
                      <EyeOff v-if="showConfirmPassword" /><Eye v-else />
                    </button>
                  </div>
                  <div v-if="confirmPassword" class="profile-password-match" :class="{ 'is-valid': passwordsMatch }">
                    <CheckCircle v-if="passwordsMatch" /><AlertTriangle v-else />
                    <span>{{ passwordsMatch ? '密码一致' : '密码不一致' }}</span>
                  </div>
                </div>
              </div>
              <div class="profile-card__actions">
                <button class="profile-primary-button" type="button" :disabled="!canUpdatePassword" @click="updatePassword"><KeyRound />更新密码</button>
              </div>
            </div>
          </section>

          <section class="profile-card profile-card--devices">
            <header class="profile-card__header"><h2>登录设备</h2></header>
            <div class="profile-card__body profile-devices">
              <article v-for="device in loginDevices" :key="device.name" :class="{ 'is-current': device.current }">
                <Monitor />
                <div><strong>{{ device.name }}</strong><span>IP: {{ device.ip }} · {{ device.time }}</span></div>
                <span v-if="device.current" class="profile-device-current">当前</span>
                <button v-else type="button" @click="offlineDevice">下线</button>
              </article>
            </div>
          </section>
        </template>

        <section v-else-if="activeTab === 'preferences'" class="profile-card profile-card--preferences">
          <header class="profile-card__header"><h2>操作偏好</h2></header>
          <div class="profile-card__body">
            <div class="profile-field"><label>默认工作区<small>登录后首先进入的模块</small></label><select v-model="defaultModule"><option v-for="item in moduleOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select></div>
            <div class="profile-field"><label>界面语言</label><select v-model="language"><option value="zh">简体中文</option><option value="zh-tw">繁體中文</option><option value="en">English</option></select></div>
            <div class="profile-field"><label>列表分页数量</label><select v-model="pageSize"><option v-for="size in ['10', '20', '50', '100']" :key="size" :value="size">每页 {{ size }} 条</option></select></div>
            <div class="profile-field"><label>记住侧边栏状态</label><div class="profile-toggle-row"><AppFigmaSwitch v-model="rememberSidebar" label="记住侧边栏状态" class="profile-large-switch" /><span>刷新后保留折叠 / 展开状态</span></div></div>
            <div class="profile-field"><label>删除前二次确认</label><div class="profile-toggle-row"><AppFigmaSwitch v-model="confirmBeforeDelete" label="删除前二次确认" class="profile-large-switch" /><span>删除操作弹出确认提示</span></div></div>
            <div class="profile-field"><label>自动保存草稿</label><div class="profile-toggle-row"><AppFigmaSwitch v-model="autoSaveDraft" label="自动保存草稿" class="profile-large-switch" /><span>编辑内容定期自动保存</span></div></div>
            <div class="profile-card__actions"><button class="profile-primary-button" type="button" @click="saveLocalSettings('偏好设置已保存')"><Save />保存偏好</button></div>
          </div>
        </section>

        <section v-else-if="activeTab === 'notifications'" class="profile-card profile-card--notifications">
          <header class="profile-card__header"><h2>通知偏好</h2></header>
          <div class="profile-card__body">
            <div v-for="item in notificationItems" :key="item.label" class="profile-notification-row">
              <div><strong>{{ item.label }}</strong><span>{{ item.description }}</span></div>
              <AppFigmaSwitch v-model="item.value.value" :label="item.label" class="profile-large-switch" />
            </div>
            <div class="profile-card__actions profile-card__actions--notifications"><button class="profile-primary-button" type="button" @click="saveLocalSettings('通知设置已保存')"><Save />保存设置</button></div>
          </div>
        </section>

        <section v-else class="profile-card profile-card--appearance">
          <header class="profile-card__header"><h2>主题外观</h2></header>
          <div class="profile-card__body">
            <div class="profile-field">
              <label>主题模式</label>
              <div class="profile-choice-grid profile-choice-grid--theme">
                <button v-for="item in themeOptions" :key="item.key" type="button" :class="{ 'is-active': themeMode === item.key }" @click="themeMode = item.key">
                  <component :is="item.icon" /><strong>{{ item.label }}</strong><span>{{ item.description }}</span>
                </button>
              </div>
            </div>
            <div class="profile-field">
              <label>信息密度</label>
              <div class="profile-choice-grid profile-choice-grid--density">
                <button v-for="item in densityOptions" :key="item.key" type="button" :class="{ 'is-active': densityMode === item.key }" @click="densityMode = item.key"><strong>{{ item.label }}</strong><span>{{ item.description }}</span></button>
              </div>
            </div>
            <div class="profile-field">
              <label>字号<small>界面基础字体大小</small></label>
              <div class="profile-font-sizes"><button v-for="size in ['12', '13', '14', '15', '16']" :key="size" type="button" :class="{ 'is-active': fontSize === size }" @click="fontSize = size">{{ size }}px</button></div>
            </div>
            <div class="profile-card__actions"><button class="profile-primary-button" type="button" @click="saveLocalSettings('外观设置已应用')"><Save />应用外观</button></div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.profile-settings {
  display: flex;
  width: 100%;
  height: calc(100dvh - 42px);
  min-height: 620px;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
}

.profile-settings button,
.profile-settings input,
.profile-settings select,
.profile-settings textarea {
  font-family: inherit;
}

.profile-settings__sidebar {
  display: flex;
  width: 220px;
  flex: 0 0 220px;
  flex-direction: column;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.profile-settings__sidebar-header {
  height: 99px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #e5e6eb;
}

.profile-settings__back {
  display: flex;
  height: 18px;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
}

.profile-settings__back svg { width: 13px; height: 13px; stroke-width: 2; }
.profile-settings__back:hover { color: #4e5969; }

.profile-settings__mini-profile { display: flex; height: 40px; align-items: center; gap: 10px; }
.profile-settings__mini-avatar { display: grid; width: 40px; height: 40px; flex: 0 0 40px; place-items: center; border-radius: 50%; background: #165dff; color: #fff; font-size: 16px; font-weight: 700; line-height: 24px; }
.profile-settings__mini-copy { display: flex; min-width: 0; flex-direction: column; }
.profile-settings__mini-copy strong { overflow: hidden; color: #1d2129; font-size: 13px; font-weight: 600; line-height: 19.5px; text-overflow: ellipsis; white-space: nowrap; }
.profile-settings__mini-copy span { color: #86909c; font-size: 11px; line-height: 16.5px; }

.profile-settings__tabs { flex: 1; padding: 8px 0; }
.profile-settings__tab { display: flex; width: 100%; height: 40px; align-items: center; gap: 10px; padding: 0 16px 0 16px; border: 0; border-left: 3px solid transparent; background: transparent; color: #4e5969; cursor: pointer; font-size: 13px; font-weight: 400; line-height: 19.5px; text-align: left; transition: background-color 150ms ease, color 150ms ease; }
.profile-settings__tab svg { width: 15px; height: 15px; flex: 0 0 15px; color: #86909c; stroke-width: 2; }
.profile-settings__tab:hover { background: #f7f8fa; }
.profile-settings__tab.is-active { border-left-color: #165dff; background: rgba(22, 93, 255, .055); color: #165dff; font-weight: 600; }
.profile-settings__tab.is-active svg { color: #165dff; }

.profile-settings__workspace { min-width: 0; flex: 1; overflow-y: auto; padding: 28px; }
.profile-settings__content { width: min(680px, 100%); margin: 0 auto; }
.profile-settings__page-header { height: 51px; margin-bottom: 20px; }
.profile-settings__title-row { display: flex; height: 27px; align-items: center; gap: 8px; }
.profile-settings__title-row svg { width: 18px; height: 18px; color: #165dff; stroke-width: 2; }
.profile-settings__title-row h1 { margin: 0; color: #1d2129; font-size: 18px; font-weight: 700; line-height: 27px; }
.profile-settings__page-header p { margin: 4px 0 0 26px; color: #86909c; font-size: 13px; line-height: 19.5px; }

.profile-card { margin: 0 0 16px; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 12px; background: #fff; }
.profile-card__header { display: flex; height: 51px; align-items: center; padding: 0 24px; border-bottom: 1px solid #e5e6eb; }
.profile-card__header h2 { margin: 0; color: #1d2129; font-size: 14px; font-weight: 600; line-height: 21px; }
.profile-card__body { padding: 20px 24px; }
.profile-card--avatar { height: 170px; }
.profile-card--avatar .profile-card__body { height: 119px; }
.profile-card--info { height: 476px; }
.profile-card--password { min-height: 308.5px; }
.profile-card--devices { min-height: 304px; }
.profile-card--preferences { min-height: 448px; }
.profile-card--notifications { min-height: 544.5px; }
.profile-card--appearance { min-height: 391.5px; }

.profile-avatar-editor { display: flex; align-items: center; gap: 24px; }
.profile-card--avatar .profile-avatar-editor { transform: translateY(-1px); }
.profile-avatar-editor__preview { position: relative; width: 72px; height: 72px; flex: 0 0 72px; }
.profile-avatar-editor__preview > img,
.profile-avatar-editor__preview > span { display: grid; width: 72px; height: 72px; place-items: center; border-radius: 50%; object-fit: cover; color: #fff; font-size: 28px; font-weight: 700; line-height: 42px; }
.profile-avatar-editor__preview > button { position: absolute; right: -4px; bottom: -4px; display: grid; width: 26px; height: 26px; place-items: center; padding: 0; border: 2px solid #e5e6eb; border-radius: 50%; background: #fff; color: #4e5969; cursor: pointer; }
.profile-avatar-editor__preview > button svg { width: 12px; height: 12px; stroke-width: 2; }
.profile-avatar-editor__preview > input { display: none; }
.profile-avatar-editor__options > strong { display: block; margin-bottom: 10px; color: #4e5969; font-size: 13px; font-weight: 400; line-height: 19.5px; }
.profile-avatar-editor__colors { display: flex; gap: 8px; }
.profile-avatar-editor__colors button { width: 24px; height: 24px; flex: 0 0 24px; padding: 0; border: 3px solid transparent; border-radius: 50%; background: var(--avatar-color); cursor: pointer; }
.profile-avatar-editor__colors button.is-active { border-color: #fff; box-shadow: 0 0 0 2px var(--avatar-color); }
.profile-avatar-editor__options small { display: block; margin-top: 8px; color: #c9cdd4; font-size: 11px; line-height: 16.5px; }

.profile-field { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 20px; }
.profile-field > label { width: 120px; flex: 0 0 120px; padding-top: 8px; color: #4e5969; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.profile-field > label small { display: block; margin-top: 2px; color: #c9cdd4; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.profile-field > input,
.profile-field > select,
.profile-field > textarea,
.profile-field__stack,
.profile-password,
.profile-choice-grid,
.profile-font-sizes,
.profile-toggle-row { min-width: 0; flex: 1; }
.profile-field > input,
.profile-field > select,
.profile-field > textarea,
.profile-password input { width: 100%; border: 1.5px solid #e5e6eb; border-radius: 7px; outline: 0; background: #fff; color: #1d2129; font-size: 13px; line-height: 19.5px; transition: border-color 150ms ease; }
.profile-field > input,
.profile-field > select,
.profile-password input { height: 37.5px; padding: 8px 12px; }
.profile-field > select { appearance: auto; cursor: pointer; }
.profile-field > textarea { height: 76.5px; padding: 8px 12px; resize: vertical; }
.profile-field > input:focus,
.profile-field > select:focus,
.profile-field > textarea:focus,
.profile-password input:focus { border-color: #165dff; }
.profile-field > input:disabled { background: #f4f6fa; color: #86909c; cursor: not-allowed; }
.profile-field > input::placeholder,
.profile-password input::placeholder,
.profile-field > textarea::placeholder { color: #c9cdd4; }
.profile-card__actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.profile-primary-button { display: inline-flex; height: 35.5px; align-items: center; gap: 6px; padding: 0 20px; border: 0; border-radius: 7px; background: #165dff; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.profile-primary-button svg { width: 13px; height: 13px; stroke-width: 2; }
.profile-primary-button:hover { background: #0e4fe8; }
.profile-primary-button:disabled { background: #c9cdd4; cursor: not-allowed; }

.profile-password { position: relative; }
.profile-password input { padding-right: 38px; }
.profile-password > button { position: absolute; top: 50%; right: 10px; display: grid; width: 20px; height: 20px; place-items: center; padding: 0; border: 0; background: transparent; color: #86909c; cursor: pointer; transform: translateY(-50%); }
.profile-password > button svg { width: 15px; height: 15px; stroke-width: 2; }
.profile-password-strength { margin-top: 8px; }
.profile-password-strength > div { display: flex; gap: 4px; margin-bottom: 4px; }
.profile-password-strength > div span { height: 3px; flex: 1; border-radius: 2px; }
.profile-password-strength small { font-size: 11px; line-height: 16.5px; }
.profile-password-match { display: flex; align-items: center; gap: 4px; margin-top: 6px; color: #f53f3f; font-size: 11px; line-height: 16.5px; }
.profile-password-match.is-valid { color: #00b42a; }
.profile-password-match svg { width: 12px; height: 12px; stroke-width: 2; }

.profile-devices { display: flex; flex-direction: column; gap: 10px; }
.profile-devices article { display: flex; min-height: 61px; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid #e5e6eb; border-radius: 8px; background: #f4f6fa; }
.profile-devices article.is-current { border-color: rgba(22, 93, 255, .188); background: rgba(22, 93, 255, .024); }
.profile-devices article > svg { width: 18px; height: 18px; flex: 0 0 18px; color: #86909c; stroke-width: 2; }
.profile-devices article.is-current > svg { color: #165dff; }
.profile-devices article > div { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.profile-devices article strong { color: #1d2129; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.profile-devices article div span { margin-top: 2px; color: #86909c; font-size: 11px; line-height: 16.5px; }
.profile-device-current { padding: 2px 8px; border-radius: 4px; background: rgba(0, 180, 42, .082); color: #00b42a; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.profile-devices article > button { height: 25px; padding: 0 10px; border: 1px solid rgba(245, 63, 63, .251); border-radius: 5px; background: transparent; color: #f53f3f; cursor: pointer; font-size: 12px; line-height: 18px; }

.profile-card--info .profile-card__body,
.profile-card--password .profile-card__body,
.profile-card--devices .profile-card__body {
  padding-top: 19px;
}

.profile-card--info .profile-field,
.profile-card--password .profile-field {
  margin-bottom: 0;
}

.profile-card--info .profile-field:nth-child(1),
.profile-card--password .profile-field:nth-child(1) {
  height: 37.5px;
}

.profile-card--info .profile-field:nth-child(2),
.profile-card--info .profile-field:nth-child(3),
.profile-card--password .profile-field:nth-child(2) {
  height: 67px;
}

.profile-card--info .profile-field:nth-child(4),
.profile-card--password .profile-field:nth-child(3) {
  height: 57.5px;
}

.profile-card--info .profile-field:nth-child(5) {
  height: 101.5px;
}

.profile-card--info .profile-field:nth-child(n + 2) > label,
.profile-card--password .profile-field:nth-child(n + 2) > label {
  padding-top: 28px;
}

.profile-card--info .profile-field:nth-child(n + 2) > input,
.profile-card--info .profile-field:nth-child(5) > textarea,
.profile-card--password .profile-field:nth-child(n + 2) > .profile-field__stack {
  align-self: flex-start;
  margin-top: 20px;
}

.profile-card--info .profile-card__actions,
.profile-card--password .profile-card__actions {
  height: 55.5px;
  align-items: flex-start;
  margin-top: 0;
  padding-top: 20px;
}

.profile-card--password {
  height: 308.5px;
}

.profile-card--devices {
  height: 304px;
}

.profile-card--devices .profile-devices article {
  height: 65px;
  min-height: 65px;
  flex: 0 0 65px;
}

.profile-toggle-row { display: flex; height: 37.5px; align-items: center; gap: 10px; color: #4e5969; font-size: 13px; line-height: 19.5px; }
.profile-large-switch { --switch-width: 36px; --switch-height: 20px; --switch-thumb-size: 16px; --switch-thumb-left: 2px; --switch-thumb-top: 2px; --switch-thumb-shift: 16px; }

.profile-card--preferences {
  height: 448px;
}

.profile-card--preferences .profile-card__body {
  height: 397px;
  padding-top: 19px;
}

.profile-card--preferences .profile-field {
  margin-bottom: 0;
}

.profile-card--preferences .profile-field:nth-child(1) {
  height: 47px;
}

.profile-card--preferences .profile-field:nth-child(2),
.profile-card--preferences .profile-field:nth-child(3) {
  height: 56px;
}

.profile-card--preferences .profile-field:nth-child(n + 4) {
  height: 48px;
}

.profile-card--preferences .profile-field:nth-child(n + 2) > label {
  padding-top: 28px;
}

.profile-card--preferences .profile-field:nth-child(2) > select,
.profile-card--preferences .profile-field:nth-child(3) > select,
.profile-card--preferences .profile-field:nth-child(n + 4) > .profile-toggle-row {
  align-self: flex-start;
  margin-top: 20px;
}

.profile-card--preferences .profile-field > select {
  height: 36px;
}

.profile-card--preferences .profile-field:nth-child(n + 4) > .profile-toggle-row {
  height: 20px;
}

.profile-card--preferences .profile-card__actions {
  height: 55.5px;
  align-items: flex-start;
  margin-top: 0;
  padding-top: 20px;
}

.profile-notification-row { display: flex; height: 68px; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #e5e6eb; }
.profile-notification-row:nth-child(6) { height: 67px; }
.profile-notification-row > div { display: flex; flex-direction: column; }
.profile-notification-row strong { color: #1d2129; font-size: 13px; font-weight: 500; line-height: 19.5px; }
.profile-notification-row span { margin-top: 2px; color: #86909c; font-size: 11px; line-height: 16.5px; }
.profile-card--notifications {
  height: 544.5px;
}

.profile-card--notifications .profile-card__body {
  height: 493.5px;
  padding-top: 19px;
}

.profile-card__actions--notifications {
  height: 51.5px;
  align-items: flex-start;
  margin-top: 0;
  padding-top: 16px;
}

.profile-choice-grid { display: flex; gap: 10px; }
.profile-choice-grid > button { display: flex; flex: 1; flex-direction: column; border: 2px solid #e5e6eb; background: #fff; color: #1d2129; cursor: pointer; transition: border-color 150ms ease, background-color 150ms ease; }
.profile-choice-grid > button.is-active { border-color: #165dff; background: rgba(22, 93, 255, .024); }
.profile-choice-grid > button strong { font-size: 13px; font-weight: 500; line-height: 19.5px; }
.profile-choice-grid > button.is-active strong { color: #165dff; }
.profile-choice-grid > button span { margin-top: 2px; color: #86909c; font-size: 11px; line-height: 16.5px; }
.profile-choice-grid--theme > button { height: 97px; align-items: center; justify-content: center; padding: 14px 12px; border-radius: 9px; text-align: center; }
.profile-choice-grid--theme > button svg { width: 20px; height: 20px; margin-bottom: 6px; color: #86909c; stroke-width: 2; }
.profile-choice-grid--theme > button.is-active svg { color: #165dff; }
.profile-choice-grid--density { gap: 8px; }
.profile-choice-grid--density > button { height: 63px; justify-content: center; padding: 10px 12px; border-radius: 7px; text-align: left; }
.profile-font-sizes { display: flex; gap: 8px; }
.profile-font-sizes button { width: 60px; height: 33.5px; flex: 0 0 60px; padding: 0; border: 1.5px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font-size: 13px; line-height: 19.5px; }
.profile-font-sizes button.is-active { border-color: #165dff; background: rgba(22, 93, 255, .024); color: #165dff; }

.profile-card--appearance {
  height: 391.5px;
}

.profile-card--appearance .profile-card__body {
  height: 340.5px;
  padding-top: 19px;
}

.profile-card--appearance .profile-field {
  margin-bottom: 0;
}

.profile-card--appearance .profile-field:nth-child(1) {
  height: 97px;
}

.profile-card--appearance .profile-field:nth-child(2) {
  height: 83px;
}

.profile-card--appearance .profile-field:nth-child(3) {
  height: 67px;
}

.profile-card--appearance .profile-field:nth-child(2) > .profile-choice-grid,
.profile-card--appearance .profile-field:nth-child(3) > .profile-font-sizes {
  align-self: flex-start;
  margin-top: 20px;
}

.profile-card--appearance .profile-card__actions {
  height: 55.5px;
  align-items: flex-start;
  margin-top: 0;
  padding-top: 20px;
}

@media (max-width: 900px) {
  .profile-settings { min-width: 760px; }
  .profile-settings__workspace { padding-right: 20px; padding-left: 20px; }
}
</style>
