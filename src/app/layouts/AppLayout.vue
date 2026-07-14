<script setup lang="ts">
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Search,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/entities/session'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { useLogout } from '@/features/auth-logout'
import autotestFigmaMarkUrl from '@/assets/brand/autotest-figma-mark.svg'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaGlobalNavIcons } from '@/shared/assets/figma-icons'

const router = useRouter()
const route = useRoute()
const { currentUser } = useSession()
const { loading: logoutLoading, errorMessage: logoutErrorMessage, logout } = useLogout()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const switchableWorkspaces = ref<WorkspaceItem[]>([])

const headerTitle = computed(() => {
  return typeof route.meta.title === 'string' && route.meta.title ? route.meta.title : '前端 2.0 重建'
})

const configCenterCrumbTitle = computed(() => {
  const tab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  const labels: Record<string, string> = {
    dbConnection: '数据库配置',
    env: '环境配置',
    param: '参数配置',
    notification: '通知配置',
    runner: 'Runner 配置',
    ai: 'AI 连接配置',
  }
  return typeof tab === 'string' && labels[tab] ? labels[tab] : '配置总览'
})

const caseCenterCrumbTitle = computed(() => {
  const routeName = String(route.name || '')
  const labels: Record<string, string> = {
    'cases-manage': '用例管理',
    'case-execution': '用例执行',
    'cases-ai-generate': 'AI 用例生成',
    'cases-ai-records': 'AI 生成记录',
    'cases-ai-record-detail': 'AI 生成记录',
    'cases-ai-config': 'AI 配置',
  }
  return labels[routeName] || '用例管理'
})

const headerCrumbs = computed(() => {
  if (route.name === 'config-center') {
    return ['配置中心', configCenterCrumbTitle.value]
  }

  if (route.path.startsWith('/cases')) {
    return ['用例中心', caseCenterCrumbTitle.value]
  }

  if (route.path.startsWith('/automation/api')) {
    return ['接口自动化']
  }

  return [headerTitle.value]
})

const userDisplayName = computed(() => {
  const user = currentUser.value
  return user?.displayName || user?.username || '当前用户'
})

const userRoleText = computed(() => currentUser.value?.roleCode || '已登录')

const navigationTargetQuery = computed(() => ({
  workspace: selectedWorkspaceCode.value,
}))

const sidebarWidth = computed(() => '56px')
const isApiWorkbenchRoute = computed(() => route.path.startsWith('/automation/api'))
const activeSecondaryNavigation = computed(() => {
  if (!route.path.startsWith('/automation/api')) return []
  const activeItem = navigationItems.find(item => item.children?.length && isNavigationItemActive(item))
  if (!activeItem?.children) return []
  if (activeItem.path === '/automation/api') {
    return activeItem.children.filter(item => item.path !== '/automation/api/settings')
  }
  return []
})

interface NavigationItem {
  path: string
  label: string
  icon: string
  color: string
  lightBg: string
  separated?: boolean
  children?: Array<{
    path: string
    label: string
  }>
}

const navigationItems: NavigationItem[] = [
  { path: '/', label: '工作台', icon: figmaGlobalNavIcons.dashboard, color: '#165DFF', lightBg: '#E8F3FF' },
  { path: '/config-center', label: '配置中心', icon: figmaGlobalNavIcons.config, color: '#4E5AC8', lightBg: '#EEF0FA' },
  {
    path: '/cases',
    label: '用例中心',
    icon: figmaGlobalNavIcons.case,
    color: '#00B42A',
    lightBg: '#E8FFEA',
    children: [
      { path: '/cases/manage', label: '用例管理' },
      { path: '/cases/ai-generate', label: 'AI 用例生成' },
      { path: '/cases/ai-records', label: 'AI 生成记录' },
      { path: '/cases/ai-config', label: 'AI 配置' },
    ],
  },
  { path: '/bugs', label: '缺陷管理', icon: figmaGlobalNavIcons.bug, color: '#F53F3F', lightBg: '#FFE8E8' },
  {
    path: '/automation/api',
    label: '接口自动化',
    icon: figmaGlobalNavIcons.api,
    color: '#FF7D00',
    lightBg: '#FFF3E8',
    children: [
      { path: '/automation/api/interfaces', label: '接口管理' },
      { path: '/automation/api/scenarios', label: '接口场景' },
      { path: '/automation/api/execution-suites', label: '执行套件' },
      { path: '/automation/api/reports', label: '报告' },
      { path: '/automation/api/settings', label: '设置' },
    ],
  },
  {
    path: '/automation/web',
    label: 'Web UI 自动化',
    icon: figmaGlobalNavIcons.web,
    color: '#0FC6C2',
    lightBg: '#E8FFFB',
    children: [
      { path: '/automation/web/cases', label: '用例管理' },
      { path: '/automation/web/elements', label: '元素库' },
      { path: '/automation/web/templates', label: '模板库' },
      { path: '/automation/web/runs', label: '执行记录' },
      { path: '/automation/web/batches', label: '批次报告' },
      { path: '/automation/web/environments', label: '环境配置' },
      { path: '/automation/web/variables', label: '变量集设置' },
    ],
  },
  { path: '/automation/app', label: 'APP 自动化', icon: figmaGlobalNavIcons.app, color: '#7816FF', lightBg: '#F5E8FF' },
  { path: '/tasks', label: '任务中心', icon: figmaGlobalNavIcons.task, color: '#F59E0B', lightBg: '#FFF7E8' },
  { path: '/reports', label: '报告中心', icon: figmaGlobalNavIcons.report, color: '#7816FF', lightBg: '#F5E8FF', separated: true },
  { path: '/settings', label: '系统设置', icon: figmaGlobalNavIcons.setting, color: '#4E5969', lightBg: '#F2F3F5' },
]

function matchesNavigationPath(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function hasNavigationChildren(item: NavigationItem) {
  return Boolean(item.children?.length)
}

function isNavigationItemActive(item: NavigationItem) {
  if (item.children?.length) {
    return item.children.some(child => matchesNavigationPath(child.path)) || matchesNavigationPath(item.path)
  }
  return matchesNavigationPath(item.path)
}

function resolveInitialWorkspaceCode(items: WorkspaceItem[]) {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  if (routeWorkspace && (routeWorkspace === 'ALL' || items.some(item => item.workspaceCode === routeWorkspace))) {
    return routeWorkspace
  }

  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some(item => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadSwitchableWorkspaces() {
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    switchableWorkspaces.value = items
    setSelectedWorkspaceCode(resolveInitialWorkspaceCode(items))
  } catch (error) {
    console.warn('[AppLayout] Failed to load switchable workspaces:', getRequestErrorMessage(error))
    switchableWorkspaces.value = []
  }
}

async function handleLogout() {
  if (logoutLoading.value) {
    return
  }

  try {
    await logout()
    await router.replace('/login')
  } catch {
    ElMessage.error(logoutErrorMessage.value || '退出登录失败，请稍后重试')
  }
}

watch(
  () => route.query.workspace,
  (value) => {
    const routeWorkspace = Array.isArray(value) ? value[0] : value
    if (routeWorkspace && routeWorkspace !== selectedWorkspaceCode.value) {
      setSelectedWorkspaceCode(routeWorkspace)
    }
  },
)

onMounted(() => {
  void loadSwitchableWorkspaces()
})
</script>

<template>
  <div
    class="app-layout"
    :class="{ 'is-api-workbench': isApiWorkbenchRoute, 'has-secondary-nav': activeSecondaryNavigation.length }"
    :style="{ '--app-current-sidebar-width': sidebarWidth }"
  >
    <aside
      class="app-layout__sidebar"
    >
      <RouterLink
        class="app-layout__brand"
        title="工作台"
        :to="{ path: '/', query: navigationTargetQuery }"
      >
        <span class="app-layout__brand-mark">
          <img :src="autotestFigmaMarkUrl" alt="">
        </span>
      </RouterLink>

      <nav class="app-layout__nav" aria-label="主导航">
        <div
          v-for="item in navigationItems"
          :key="item.path"
          class="app-layout__nav-group"
          :class="{
            'is-active': isNavigationItemActive(item),
            'is-separated': item.separated,
          }"
          :style="{ '--nav-color': item.color, '--nav-bg': item.lightBg }"
        >
          <button
            v-if="hasNavigationChildren(item)"
            type="button"
            class="app-layout__nav-item app-layout__nav-button"
            :class="{
              'is-active': isNavigationItemActive(item),
              'has-children': true,
            }"
            :title="item.label"
            @click="router.push({ path: item.path, query: navigationTargetQuery })"
          >
            <span class="app-layout__nav-icon-shell">
              <img class="app-layout__nav-icon" :src="item.icon" alt="">
            </span>
          </button>
          <RouterLink
            v-else
            class="app-layout__nav-item"
            :class="{ 'is-active': isNavigationItemActive(item) }"
            :title="item.label"
            :to="{ path: item.path, query: navigationTargetQuery }"
          >
            <span class="app-layout__nav-icon-shell">
              <img class="app-layout__nav-icon" :src="item.icon" alt="">
            </span>
          </RouterLink>
        </div>
      </nav>

      <div class="app-layout__sidebar-footer">
        <span class="app-layout__sidebar-avatar">{{ userDisplayName.slice(0, 1).toUpperCase() }}</span>
      </div>
    </aside>

    <section class="app-layout__body">
      <header class="app-layout__header">
        <div class="app-layout__header-copy">
          <template
            v-for="(crumb, index) in headerCrumbs"
            :key="`${crumb}-${index}`"
          >
            <ChevronRight
              v-if="index > 0"
              class="app-layout__header-crumb-separator"
            />
            <div
              class="app-layout__header-title"
              :class="{ 'is-current': index === headerCrumbs.length - 1 }"
            >
              {{ crumb }}
            </div>
          </template>
        </div>

        <div class="app-layout__header-actions">
          <button class="app-layout__quick-search" type="button">
            <Search class="app-layout__quick-search-icon" />
            <span>快速查找</span>
            <kbd>⌘K</kbd>
          </button>
          <span class="app-layout__header-divider app-layout__header-divider--right" />

          <el-dropdown trigger="click" @command="handleLogout">
            <button
              class="app-layout__user"
              type="button"
              :aria-busy="logoutLoading"
              :disabled="logoutLoading"
            >
              <span class="app-layout__user-avatar">{{ userDisplayName.slice(0, 1).toUpperCase() }}</span>
              <span class="app-layout__user-name">{{ userDisplayName }}</span>
              <ChevronDown class="app-layout__user-arrow" />
            </button>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ userRoleText }}</el-dropdown-item>
                <el-dropdown-item divided command="logout" :disabled="logoutLoading">
                  <LogOut class="app-layout__dropdown-icon" />
                  {{ logoutLoading ? '正在退出' : '退出登录' }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <nav v-if="activeSecondaryNavigation.length" class="app-layout__secondary-nav" aria-label="模块导航">
        <RouterLink
          v-for="item in activeSecondaryNavigation"
          :key="item.path"
          class="app-layout__secondary-link"
          :class="{ 'is-active': matchesNavigationPath(item.path) }"
          :to="{ path: item.path, query: navigationTargetQuery }"
        >
          {{ item.label }}
        </RouterLink>
        <span class="app-layout__secondary-spacer" />
        <button type="button" class="app-layout__secondary-placeholder" aria-hidden="true" tabindex="-1"></button>
      </nav>

      <main class="app-layout__main">
        <RouterView />
      </main>
    </section>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100dvh;
  background: var(--app-bg-page);
  color: var(--app-text-primary);
}

.app-layout__sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--app-current-sidebar-width, var(--app-sidebar-width));
  border-right: 1px solid var(--app-border);
  background: #ffffff;
  color: var(--app-text-secondary);
  overflow: hidden;
  z-index: 30;
}

.app-layout__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 49px;
  padding: 10.5px 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.app-layout__brand:hover {
  background: var(--app-bg-muted);
}

.app-layout__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--app-primary), #4f8eff);
}

.app-layout__brand-mark img {
  display: block;
  width: 17px;
  height: 17px;
}

.app-layout__nav {
  display: flex;
  flex-direction: column;
  gap: 3.5px;
  padding: 0 10px;
}

.app-layout__nav-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  --nav-color: var(--app-primary);
  --nav-bg: var(--app-primary-soft);
}

.app-layout__nav-group.is-separated {
  margin-top: 4.5px;
  padding-top: 4.5px;
  border-top: 1px solid var(--app-border);
}

.app-layout__nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--nav-color);
  cursor: pointer;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.app-layout__nav-button {
  font: inherit;
}

.app-layout__nav-item:hover {
  background: var(--nav-bg);
  color: var(--nav-color);
}

.app-layout__nav-item.is-active {
  background: var(--nav-color);
  color: #ffffff;
}

.app-layout__nav-item.is-active .app-layout__nav-icon {
  filter: brightness(0) invert(1);
}

.app-layout__nav-item[title="配置中心"]:not(.is-active) .app-layout__nav-icon {
  filter: brightness(0) saturate(100%) invert(37%) sepia(19%) saturate(1795%) hue-rotate(199deg) brightness(88%) contrast(89%);
}

.app-layout__nav-item[title="系统设置"]:not(.is-active) .app-layout__nav-icon {
  filter: brightness(0) saturate(100%) invert(34%) sepia(9%) saturate(732%) hue-rotate(178deg) brightness(91%) contrast(86%);
}

.app-layout__nav-item[title="报告中心"]:not(.is-active) .app-layout__nav-icon {
  filter: brightness(0) saturate(100%) invert(16%) sepia(94%) saturate(4739%) hue-rotate(265deg) brightness(98%) contrast(105%);
}

.app-layout__nav-item[title="任务中心"]:not(.is-active) .app-layout__nav-icon {
  filter: brightness(0) saturate(100%) invert(72%) sepia(60%) saturate(2463%) hue-rotate(354deg) brightness(101%) contrast(92%);
}

.app-layout__nav-icon-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  flex: 0 0 35px;
  border-radius: inherit;
  background: transparent;
  color: currentColor;
}

.app-layout__nav-icon {
  display: block;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: currentColor;
  opacity: 0.94;
}

.app-layout__sidebar-footer {
  position: absolute;
  bottom: 10.5px;
  left: 13.5px;
}

.app-layout__sidebar-avatar {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 999px;
  background: var(--app-primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.app-layout__body {
  flex: 1;
  min-width: 0;
  margin-left: var(--app-current-sidebar-width, var(--app-sidebar-width));
}

.app-layout__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 42px;
  padding: 0 17.5px;
  border-bottom: 1px solid var(--app-border);
  background: #ffffff;
  backdrop-filter: none;
}

.app-layout__header-copy {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.app-layout__header-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.app-layout__header-crumb-separator {
  flex: 0 0 auto;
  width: 13px;
  height: 13px;
  color: var(--app-text-muted);
  stroke-width: 1.8;
}

.app-layout__header-title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-secondary);
}

.app-layout__header-title.is-current {
  color: var(--app-text-primary);
  font-weight: 500;
}

.app-layout__quick-search {
  display: inline-flex;
  align-items: center;
  width: 121.5px;
  height: 24.5px;
  padding: 0 10.5px;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #ffffff;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;
}

.app-layout__quick-search:hover {
  border-color: var(--app-border-strong);
  color: var(--app-text-secondary);
  background: var(--app-bg-subtle);
}

.app-layout__quick-search-icon {
  width: 12px;
  height: 12px;
  margin-right: 7px;
  stroke-width: 2;
}

.app-layout__quick-search kbd {
  display: inline-grid;
  min-width: 21px;
  height: 19px;
  margin-left: 7px;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 3.5px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.app-layout__header-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 17.5px;
  background: var(--app-border);
}

.app-layout__user {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  max-width: 112px;
  height: 24.5px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.app-layout__user:disabled {
  cursor: wait;
  opacity: 0.72;
}

.app-layout__user:hover {
  background: transparent;
}

.app-layout__user-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 24.5px;
  height: 24.5px;
  place-items: center;
  border-radius: 50%;
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.app-layout__user-name {
  max-width: 52px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user-arrow {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  color: var(--app-text-muted);
  stroke-width: 2;
}

.app-layout__dropdown-icon {
  width: 15px;
  height: 15px;
  margin-right: 6px;
  stroke-width: 2;
}

.app-layout__main {
  min-height: calc(100dvh - 42px);
  padding: 0;
  background: var(--app-bg-page);
}

.app-layout.has-secondary-nav .app-layout__main {
  min-height: calc(100dvh - 86px);
}

.app-layout__secondary-nav {
  display: flex;
  height: 44px;
  min-height: 44px;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid var(--app-border);
  background: #ffffff;
}

.app-layout__secondary-link {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 43px;
  align-items: center;
  justify-content: center;
  padding: 0 17.5px 2px;
  border-bottom: 2px solid transparent;
  color: var(--app-text-muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
}

.app-layout__secondary-link.is-active {
  border-bottom-color: #ff7d00;
  color: var(--app-text-primary);
}

.app-layout__secondary-spacer {
  flex: 1 1 auto;
  min-width: 0;
}

.app-layout__secondary-placeholder {
  width: 81.5px;
  height: 24.5px;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #ffffff;
  pointer-events: none;
}

@media (max-width: 900px) {
  .app-layout {
    min-width: 760px;
  }
}

@media (max-width: 560px) {
  .app-layout__quick-search {
    display: none;
  }
}
</style>
