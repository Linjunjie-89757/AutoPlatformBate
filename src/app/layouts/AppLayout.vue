<script setup lang="ts">
import {
  Bell,
  Bug,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Code2,
  LayoutDashboard,
  Layers,
  LogOut,
  Monitor,
  Settings,
  SlidersHorizontal,
  TabletSmartphone,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/entities/session'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { useLogout } from '@/features/auth-logout'
import { getRequestErrorMessage } from '@/shared/api/error'

const router = useRouter()
const route = useRoute()
const { currentUser } = useSession()
const { loading: logoutLoading, errorMessage: logoutErrorMessage, logout } = useLogout()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const switchableWorkspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceErrorMessage = ref('')
const isMenuCollapsed = ref(localStorage.getItem('app-menu-collapsed') === '1')
const NAV_GROUP_STORAGE_KEY = 'app:navigation-groups-expanded-v1'

const headerTitle = computed(() => {
  return typeof route.meta.title === 'string' && route.meta.title ? route.meta.title : '前端 2.0 重建'
})

const userDisplayName = computed(() => {
  const user = currentUser.value
  return user?.displayName || user?.username || '当前用户'
})

const userRoleText = computed(() => currentUser.value?.roleCode || '已登录')

const workspaceOptions = computed(() => {
  const options = switchableWorkspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some(item => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

const selectedWorkspaceName = computed(() => {
  return workspaceOptions.value.find(item => item.value === selectedWorkspaceCode.value)?.label || '全部空间'
})

const navigationTargetQuery = computed(() => ({
  workspace: selectedWorkspaceCode.value,
}))

const sidebarWidth = computed(() => (isMenuCollapsed.value ? '56px' : 'var(--app-sidebar-width)'))
const isApiWorkbenchRoute = computed(() => route.path.startsWith('/automation/api'))

interface NavigationItem {
  path: string
  label: string
  icon: Component
  color: string
  lightBg: string
  children?: Array<{
    path: string
    label: string
  }>
}

type NavigationGroupExpandedState = Record<string, boolean>

const navigationItems: NavigationItem[] = [
  { path: '/', label: '工作台', icon: LayoutDashboard, color: '#165DFF', lightBg: '#E8F3FF' },
  { path: '/config-center', label: '配置中心', icon: SlidersHorizontal, color: '#4E5AC8', lightBg: '#EEF0FA' },
  {
    path: '/cases',
    label: '用例中心',
    icon: ClipboardList,
    color: '#00B42A',
    lightBg: '#E8FFEA',
    children: [
      { path: '/cases/manage', label: '用例管理' },
      { path: '/cases/ai-generate', label: 'AI 用例生成' },
      { path: '/cases/ai-records', label: 'AI 生成记录' },
      { path: '/cases/ai-config', label: 'AI 配置' },
    ],
  },
  { path: '/bugs', label: '缺陷管理', icon: Bug, color: '#F53F3F', lightBg: '#FFE8E8' },
  {
    path: '/automation/api',
    label: '接口自动化',
    icon: Code2,
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
    icon: Monitor,
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
  { path: '/automation/app', label: 'APP 自动化', icon: TabletSmartphone, color: '#7816FF', lightBg: '#F5E8FF' },
  { path: '/settings', label: '系统设置', icon: Settings, color: '#4E5969', lightBg: '#F2F3F5' },
]

function readNavigationGroupExpandedState(): NavigationGroupExpandedState {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.localStorage.getItem(NAV_GROUP_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as NavigationGroupExpandedState
  } catch {
    return {}
  }
}

const navigationGroupExpandedState = ref<NavigationGroupExpandedState>(readNavigationGroupExpandedState())

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

function toggleMenuCollapse() {
  isMenuCollapsed.value = !isMenuCollapsed.value
  localStorage.setItem('app-menu-collapsed', isMenuCollapsed.value ? '1' : '0')
}

function isNavigationChildActive(path: string) {
  return matchesNavigationPath(path)
}

function persistNavigationGroupExpandedState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(NAV_GROUP_STORAGE_KEY, JSON.stringify(navigationGroupExpandedState.value))
}

function isNavigationGroupExpanded(item: NavigationItem) {
  if (!hasNavigationChildren(item)) {
    return false
  }

  const stored = navigationGroupExpandedState.value[item.path]
  if (typeof stored === 'boolean') {
    return stored
  }

  return isNavigationItemActive(item)
}

function toggleNavigationGroup(item: NavigationItem) {
  if (!hasNavigationChildren(item)) {
    return
  }

  navigationGroupExpandedState.value = {
    ...navigationGroupExpandedState.value,
    [item.path]: !isNavigationGroupExpanded(item),
  }
  persistNavigationGroupExpandedState()
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
  workspaceLoading.value = true
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    switchableWorkspaces.value = items
    setSelectedWorkspaceCode(resolveInitialWorkspaceCode(items))
  } catch (error) {
    workspaceErrorMessage.value = getRequestErrorMessage(error)
    switchableWorkspaces.value = []
  } finally {
    workspaceLoading.value = false
  }
}

async function handleWorkspaceChange(value: string) {
  if (!value) {
    return
  }

  setSelectedWorkspaceCode(value)
  if (route.path.startsWith('/bugs') || route.path.startsWith('/automation/web') || route.path.startsWith('/automation/api')) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        workspace: value,
      },
      hash: route.hash,
    })
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
    :class="{ 'is-api-workbench': isApiWorkbenchRoute }"
    :style="{ '--app-current-sidebar-width': sidebarWidth }"
  >
    <aside
      class="app-layout__sidebar"
      :class="{ 'is-collapsed': isMenuCollapsed }"
    >
      <button
        type="button"
        class="app-layout__brand"
        :class="{ 'is-collapsed': isMenuCollapsed }"
        :title="isMenuCollapsed ? '展开菜单' : '收起菜单'"
        @click="toggleMenuCollapse"
      >
        <span class="app-layout__brand-mark">A</span>
        <span class="app-layout__brand-copy">自动化测试平台</span>
        <ChevronLeft class="app-layout__brand-collapse-icon" :class="{ 'is-collapsed': isMenuCollapsed }" />
      </button>

      <nav class="app-layout__nav" aria-label="主导航">
        <div
          v-for="item in navigationItems"
          :key="item.path"
          class="app-layout__nav-group"
          :class="{
            'is-active': isNavigationItemActive(item),
            'is-expanded': isNavigationGroupExpanded(item),
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
            :aria-expanded="isNavigationGroupExpanded(item)"
            @click="toggleNavigationGroup(item)"
          >
            <span class="app-layout__nav-icon-shell">
              <component :is="item.icon" class="app-layout__nav-icon" />
            </span>
            <span class="app-layout__nav-label">{{ item.label }}</span>
          </button>
          <RouterLink
            v-else
            class="app-layout__nav-item"
            :class="{ 'is-active': isNavigationItemActive(item) }"
            :to="{ path: item.path, query: navigationTargetQuery }"
          >
            <span class="app-layout__nav-icon-shell">
              <component :is="item.icon" class="app-layout__nav-icon" />
            </span>
            <span class="app-layout__nav-label">{{ item.label }}</span>
          </RouterLink>

          <div v-if="item.children?.length && isNavigationGroupExpanded(item)" class="app-layout__nav-children">
            <RouterLink
              v-for="child in item.children"
              :key="child.path"
              class="app-layout__nav-child"
              :class="{ 'is-active': isNavigationChildActive(child.path) }"
              :to="{ path: child.path, query: navigationTargetQuery }"
            >
              <span>{{ child.label }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>
    </aside>

    <section class="app-layout__body">
      <header class="app-layout__header">
        <div class="app-layout__header-copy">
          <div class="app-layout__header-title">{{ headerTitle }}</div>
          <span class="app-layout__header-divider" />
          <el-dropdown
            trigger="click"
            popper-class="workspace-dropdown-menu"
            :disabled="workspaceOptions.length === 0 || workspaceLoading"
            @command="handleWorkspaceChange"
          >
            <button class="app-layout__workspace-button" type="button" :aria-busy="workspaceLoading">
              <Layers class="app-layout__workspace-icon" />
              <span class="app-layout__workspace-name">{{ selectedWorkspaceName }}</span>
              <ChevronDown class="app-layout__workspace-caret" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in workspaceOptions"
                  :key="item.value"
                  :command="item.value"
                >
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="app-layout__header-actions">
          <button class="app-layout__header-icon-button" type="button" title="通知">
            <Bell class="app-layout__header-bell-icon" />
            <span class="app-layout__header-icon-dot" />
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
  transition: width 0.2s ease-in-out;
}

.app-layout__brand {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  width: 100%;
  height: 48px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  transition: background-color 150ms ease;
}

.app-layout__brand:hover {
  background: var(--app-bg-muted);
}

.app-layout__brand.is-collapsed {
  justify-content: center;
  gap: 0;
  padding: 0 8px;
}

.app-layout__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: 13px;
  font-weight: 700;
}

.app-layout__brand-copy {
  overflow: hidden;
  min-width: 0;
  flex: 1 1 auto;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 150ms ease;
}

.app-layout__brand.is-collapsed .app-layout__brand-copy {
  width: 0;
  flex: 0 0 0;
  margin: 0;
  opacity: 0;
}

.app-layout__brand-collapse-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: var(--app-text-subtle);
  opacity: 0;
  stroke-width: 2;
  transition: opacity 150ms ease, transform 0.2s ease;
}

.app-layout__brand:hover .app-layout__brand-collapse-icon {
  opacity: 1;
}

.app-layout__brand-collapse-icon.is-collapsed {
  display: none;
}

.app-layout__nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.app-layout__nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  --nav-color: var(--app-primary);
  --nav-bg: var(--app-primary-soft);
}

.app-layout__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.app-layout__sidebar.is-collapsed .app-layout__nav-item {
  justify-content: center;
  gap: 0;
  padding: 0;
  width: 40px;
  min-height: 40px;
  border-radius: 12px;
}

.app-layout__nav-button {
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.app-layout__nav-item.has-children {
  font-weight: 500;
}

.app-layout__nav-item:hover {
  background: var(--app-bg-muted);
  color: var(--nav-color);
}

.app-layout__nav-item.is-active {
  background: var(--nav-bg);
  color: var(--nav-color);
  font-weight: 600;
}

.app-layout__sidebar.is-collapsed .app-layout__nav-item.is-active {
  background: var(--nav-color);
  color: #ffffff;
}

.app-layout__nav-icon-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 10px;
  background: var(--nav-bg);
  color: var(--nav-color);
  transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.app-layout__nav-icon {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  color: currentColor;
  stroke-width: 1.8;
}

.app-layout__nav-item:hover .app-layout__nav-icon-shell {
  transform: translateY(-1px);
}

.app-layout__sidebar.is-collapsed .app-layout__nav-icon-shell {
  width: 40px;
  height: 40px;
  flex-basis: 40px;
  border-radius: 12px;
  background: transparent;
}

.app-layout__sidebar.is-collapsed .app-layout__nav-item.is-active .app-layout__nav-icon-shell {
  color: #ffffff;
}

.app-layout__nav-label {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 150ms ease;
}

.app-layout__sidebar.is-collapsed .app-layout__nav-label {
  width: 0;
  opacity: 0;
}

.app-layout__nav-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 28px;
}

.app-layout__sidebar.is-collapsed .app-layout__nav-children {
  display: none;
}

.app-layout__nav-child {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: var(--app-line-height-sm);
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.app-layout__nav-child:hover {
  background: var(--nav-bg);
  color: var(--nav-color);
}

.app-layout__nav-child.is-active {
  background: var(--nav-bg);
  color: var(--nav-color);
  font-weight: 600;
}

.app-layout__body {
  flex: 1;
  min-width: 0;
  margin-left: var(--app-current-sidebar-width, var(--app-sidebar-width));
  transition: margin-left 0.2s ease-in-out;
}

.app-layout__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  background: #ffffff;
  backdrop-filter: none;
}

.app-layout__header-copy {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
}

.app-layout__header-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
}

.app-layout__header-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 20px;
  background: var(--app-border);
}

.app-layout__header-divider--right {
  height: 16px;
}

.app-layout__header-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.app-layout__header-icon-button:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.app-layout__header-bell-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.app-layout__header-icon-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #ef4444;
}

.app-layout__workspace-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.app-layout__workspace-button:hover {
  background: var(--app-bg-panel);
  border-color: var(--app-primary);
}

.app-layout__workspace-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.app-layout__workspace-button:focus-visible {
  outline: 0;
  border-color: var(--app-primary);
  box-shadow: 0 0 0 1px var(--app-primary) inset;
}

.app-layout__workspace-icon {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--app-primary);
}

.app-layout__workspace-name {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__workspace-caret {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--app-text-muted);
}

.app-layout__header-title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
  max-width: 260px;
  min-height: 32px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.app-layout__user:disabled {
  cursor: wait;
  opacity: 0.72;
}

.app-layout__user:hover {
  background: var(--app-bg-muted);
}

.app-layout__user-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: var(--app-primary);
  color: var(--app-text-inverse);
  font-size: 11px;
  font-weight: 700;
}

.app-layout__user-name {
  max-width: 150px;
  overflow: hidden;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__user-arrow {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
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
  min-height: calc(100dvh - 48px);
  padding: 12px;
  background: var(--app-bg-page);
}

.app-layout.is-api-workbench .app-layout__main {
  padding: 0;
}

@media (max-width: 900px) {
  .app-layout {
    flex-direction: column;
  }

  .app-layout__sidebar {
    position: static;
    width: 100%;
  }

  .app-layout__nav {
    gap: var(--app-space-2);
    padding: var(--app-space-3);
  }

  .app-layout__nav-item,
  .app-layout__nav-child {
    min-width: 0;
  }

  .app-layout__nav-children {
    padding-left: 30px;
  }

  .app-layout__body {
    margin-left: 0;
  }

  .app-layout__header {
    padding: 0 var(--app-space-4);
  }

  .app-layout__main {
    padding: var(--app-space-4);
  }
}

@media (max-width: 560px) {
  .app-layout__header {
    align-items: flex-start;
    height: auto;
    min-height: 64px;
    padding-block: var(--app-space-3);
  }

  .app-layout__header-copy {
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: var(--app-space-2);
  }

  .app-layout__header-title {
    max-width: 100%;
  }

  .app-layout__user {
    max-width: 156px;
  }

  .app-layout__header-actions {
    gap: var(--app-space-2);
  }

  .app-layout__header-divider {
    display: none;
  }

  .app-layout__workspace-button {
    max-width: 132px;
  }

  .app-layout__user-name {
    max-width: 72px;
  }
}
</style>
