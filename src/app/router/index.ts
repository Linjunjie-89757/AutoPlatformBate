import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import {
  canManageWorkspace,
  clearCurrentUser,
  firstManageableWorkspaceCode,
  hasWorkspacePermission,
  loadCurrentUser,
  sessionState,
} from '@/entities/session'

const AppLayout = () => import('@/app/layouts/AppLayout.vue')
const ApiAutomationPage = () => import('@/pages/automation-api/ApiAutomationPage.vue')
const AutomationTasksPage = () => import('@/pages/automation-tasks/AutomationTasksPage.vue')
const WebAutomationPage = () => import('@/pages/automation-web/WebAutomationPage.vue')
const WebUiSharedReportPage = () => import('@/pages/automation-web/WebUiSharedReportPage.vue')
const CaseAiConfigPage = () => import('@/pages/cases/CaseAiConfigPage.vue')
const CaseAiGeneratePage = () => import('@/pages/cases/CaseAiGeneratePage.vue')
const CaseAiRecordsPage = () => import('@/pages/cases/CaseAiRecordsPage.vue')
const CaseCenterPage = () => import('@/pages/cases/CaseCenterPage.vue')
const CasesPage = () => import('@/pages/cases/CasesPage.vue')
const ConfigCenterPage = () => import('@/pages/config-center/ConfigCenterPage.vue')
const DashboardPage = () => import('@/pages/dashboard/DashboardPage.vue')
const DefectDetailPage = () => import('@/pages/defects/DefectDetailPage.vue')
const DefectsPage = () => import('@/pages/defects/DefectsPage.vue')
const LoginPage = () => import('@/pages/login/LoginPage.vue')
const PlaceholderPage = () => import('@/pages/placeholder/PlaceholderPage.vue')
const ProfileSettingsPage = () => import('@/pages/profile/ProfileSettingsPage.vue')
const ReportCenterPage = () => import('@/pages/reports/ReportCenterPage.vue')
const ReportSharePage = () => import('@/pages/reports/ReportSharePage.vue')
const SystemSettingsPage = () => import('@/pages/system-settings/SystemSettingsPage.vue')
const WorkspaceSelectPage = () => import('@/pages/workspace-select/WorkspaceSelectPage.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: {
      title: '登录',
      bare: true,
      public: true,
    },
  },
  {
    path: '/share/report',
    name: 'report-shared-report',
    component: ReportSharePage,
    meta: {
      title: '报告分享',
      bare: true,
      public: true,
    },
  },
  {
    path: '/share/web-ui/report',
    name: 'web-ui-shared-report',
    component: WebUiSharedReportPage,
    meta: {
      title: 'Web UI 公开报告',
      bare: true,
      public: true,
    },
  },
  {
    path: '/workspaces/select',
    name: 'workspace-select',
    component: WorkspaceSelectPage,
    meta: {
      title: '选择工作区',
      bare: true,
    },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: DashboardPage,
        meta: {
          title: '工作台',
          description: '按 Figma 工作台总览视觉展示执行动态、关注事项、系统健康和 AI 洞察。',
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: SystemSettingsPage,
        meta: {
          title: '系统设置',
          description: '管理 AI 连接、工作空间、成员与用户账号。',
          requiresWorkspaceAdmin: true,
        },
      },
      {
        path: 'profile',
        name: 'profile-settings',
        component: ProfileSettingsPage,
        meta: {
          title: '个人设置',
          description: '维护个人资料、安全设置、操作偏好、通知偏好和主题外观。',
        },
      },
      {
        path: 'config-center',
        name: 'config-center',
        component: ConfigCenterPage,
        meta: {
          title: '配置中心',
          description: '后续保持公共配置边界，迁移环境、参数、数据库连接配置。',
          permissionCode: 'config.view',
        },
      },
      {
        path: 'cases',
        component: CaseCenterPage,
        meta: {
          title: '用例中心',
          description: '后续按目录树、筛选区、表格、抽屉等区域拆分。',
        },
        children: [
          {
            path: '',
            redirect: to => ({ path: '/cases/manage', query: to.query, hash: to.hash }),
          },
          {
            path: 'manage',
            name: 'cases-manage',
            component: CasesPage,
            meta: {
              title: '用例中心',
              description: '按旧项目方向重建用例管理页。',
              permissionCode: 'cases.view',
            },
          },
          {
            path: 'manage/execute/:id',
            name: 'case-execution',
            component: () => import('@/pages/cases/CaseExecutionWorkstationPage.vue'),
            meta: {
              title: '用例执行',
              description: '按 Figma 执行工作台接入用例执行。',
              permissionCode: 'cases.execute',
            },
          },
          {
            path: 'ai-generate',
            name: 'cases-ai-generate',
            component: CaseAiGeneratePage,
            meta: {
              title: '用例中心',
              description: 'AI 用例生成页面将按旧项目方向后续补齐。',
              permissionCode: 'cases.create',
            },
          },
          {
            path: 'ai-records',
            name: 'cases-ai-records',
            component: CaseAiRecordsPage,
            meta: {
              title: '用例中心',
              description: 'AI 生成记录页面将按旧项目方向后续补齐。',
            },
          },
          {
            path: 'ai-records/:taskId',
            name: 'cases-ai-record-detail',
            component: () => import('@/pages/cases/CaseAiRecordDetailPage.vue'),
            meta: {
              title: '用例中心',
              description: 'AI 生成记录详情页将按旧项目方向后续补齐。',
            },
          },
          {
            path: 'ai-config',
            name: 'cases-ai-config',
            component: CaseAiConfigPage,
            meta: {
              title: '用例中心',
              description: 'AI 配置页面将按旧项目方向后续补齐。',
            },
          },
        ],
      },
      {
        path: 'cases/:id/execute',
        redirect: to => ({
          path: `/cases/manage/execute/${to.params.id}`,
          query: to.query,
          hash: to.hash,
        }),
      },
      {
        path: 'bugs',
        name: 'bugs',
        component: DefectsPage,
        meta: {
          title: '缺陷管理',
          description: '按工作空间查看缺陷统计和真实列表，后续继续补齐详情与流转。',
        },
      },
      {
        path: 'bugs/create',
        name: 'bug-create',
        component: () => import('@/pages/defects/DefectEditPage.vue'),
        meta: {
          title: '缺陷管理',
          description: '按页面式编辑体验创建缺陷基础信息。',
          permissionCode: 'bugs.create',
        },
      },
      {
        path: 'bugs/:id/edit',
        name: 'bug-edit',
        component: () => import('@/pages/defects/DefectEditPage.vue'),
        meta: {
          title: '缺陷管理',
          description: '按页面式编辑节奏调整缺陷基础信息。',
          permissionCode: 'bugs.edit',
        },
      },
      {
        path: 'bugs/:id',
        name: 'bug-detail',
        component: DefectDetailPage,
        meta: {
          title: '缺陷详情',
          description: '通过分享链接直接查看缺陷详情。',
        },
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: AutomationTasksPage,
        meta: {
          title: '任务中心',
          description: '按 Figma 任务中心视觉展示自动化任务列表、执行状态和 AI 分析。',
        },
      },
      {
        path: 'reports',
        name: 'reports',
        component: ReportCenterPage,
        meta: {
          title: '报告中心',
          description: '按 Figma 报告中心视觉展示执行报告、步骤结果和步骤详情抽屉。',
        },
      },
      {
        path: 'automation/api',
        redirect: to => ({ path: '/automation/api/interfaces', query: to.query, hash: to.hash }),
      },
      {
        path: 'automation/api/interfaces',
        name: 'automation-api-interfaces',
        component: ApiAutomationPage,
        meta: {
          title: '接口管理',
          description: '管理接口定义、接口用例、导入和调试运行。',
        },
      },
      {
        path: 'automation/api/scenarios',
        name: 'automation-api-scenarios',
        component: ApiAutomationPage,
        meta: {
          title: '接口场景',
          description: '编排接口用例、测试数据和场景运行结果。',
        },
      },
      {
        path: 'automation/api/execution-suites',
        name: 'automation-api-execution-suites',
        component: ApiAutomationPage,
        meta: {
          title: '执行套件',
          description: '编排接口用例和场景，维护定时任务、CI/CD 和运行结果。',
        },
      },
      {
        path: 'automation/api/reports',
        redirect: to => ({ path: '/reports', query: to.query, hash: to.hash }),
      },
      {
        path: 'automation/api/settings',
        name: 'automation-api-settings',
        component: ApiAutomationPage,
        meta: {
          title: '接口自动化设置',
          description: '维护接口自动化运行、通知和全局策略设置。',
        },
      },
      {
        path: 'automation/web',
        redirect: to => ({ path: '/automation/web/cases', query: to.query, hash: to.hash }),
      },
      {
        path: 'automation/web/cases',
        name: 'automation-web-cases',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 用例管理',
          description: '管理 Web UI 自动化用例、步骤和调试运行。',
        },
      },
      {
        path: 'automation/web/cases/:caseId',
        name: 'automation-web-case-detail',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 自动化',
          description: '管理 Web UI 自动化用例、步骤和调试运行。',
        },
      },
      {
        path: 'automation/web/elements',
        name: 'automation-web-elements',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 自动化',
          description: '维护页面对象、元素定位器、验证结果和用例引用关系。',
        },
      },
      {
        path: 'automation/web/suites',
        name: 'automation-web-suites',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 自动化',
          description: '按 Figma 维护 Web UI 执行套件、用例编排和运行配置。',
        },
      },
      {
        path: 'automation/web/elements/collect-tasks/:taskId',
        name: 'automation-web-element-collect-task',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI AI 采集工作台',
          description: '查看 AI 采集任务进度、候选元素、过滤明细、真机验证和入库操作。',
        },
      },
      {
        path: 'automation/web/templates',
        name: 'automation-web-templates',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 模板库',
          description: '沉淀和维护常用 Web UI 用例模板。',
        },
      },
      {
        path: 'automation/web/runs',
        name: 'automation-web-runs',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 执行记录',
          description: '查看单次运行报告、失败步骤和截图证据。',
        },
      },
      {
        path: 'automation/web/batches',
        name: 'automation-web-batches',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 批次报告',
          description: '查看批量运行、CI 触发和批次结果。',
        },
      },
      {
        path: 'automation/web/environments',
        name: 'automation-web-environments',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 环境配置',
          description: '管理 Web UI 运行环境和默认变量集。',
        },
      },
      {
        path: 'automation/web/variables',
        name: 'automation-web-variables',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 变量集设置',
          description: '维护 Web UI 用例运行、调试和采集使用的变量集。',
        },
      },
      {
        path: 'automation/web/variables/:id',
        name: 'automation-web-variable-detail',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 变量集详情',
          description: '查看和维护变量集基础信息、变量列表和 JSON 导入导出。',
        },
      },
      {
        path: 'automation/app',
        name: 'automation-app',
        component: PlaceholderPage,
        meta: {
          title: 'APP 自动化',
          description: '旧项目当前为占位模块，后续确认真实业务边界后再接入。',
        },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

window.addEventListener('autotest:unauthorized', () => {
  const currentRoute = router.currentRoute.value
  if (currentRoute.name === 'login') return
  clearCurrentUser()
  void router.replace({
    path: '/login',
    query: currentRoute.fullPath === '/' ? undefined : { redirect: currentRoute.fullPath },
  })
})

router.beforeEach(async (to) => {
  const isPublicRoute = to.meta.public === true
  const shouldCheckSession = !isPublicRoute || to.name === 'login'

  if (shouldCheckSession && !sessionState.sessionChecked.value) {
    await loadCurrentUser()
  }

  if (to.name === 'login' && sessionState.isAuthenticated.value) {
    const redirect = Array.isArray(to.query.redirect) ? to.query.redirect[0] : to.query.redirect
    return {
      path: '/workspaces/select',
      query: typeof redirect === 'string' && redirect.startsWith('/') ? { redirect } : undefined,
      replace: true,
    }
  }

  if (!isPublicRoute && !sessionState.isAuthenticated.value) {
    return {
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
      replace: true,
    }
  }

  if (to.meta.requiresWorkspaceAdmin === true) {
    const requestedWorkspace = Array.isArray(to.query.workspace) ? to.query.workspace[0] : to.query.workspace
    if (!canManageWorkspace(sessionState.currentUser.value, requestedWorkspace)) {
      const manageableWorkspace = firstManageableWorkspaceCode(sessionState.currentUser.value)
      if (manageableWorkspace) {
        return {
          path: to.path,
          query: { ...to.query, workspace: manageableWorkspace },
          hash: to.hash,
          replace: true,
        }
      }
      const readableWorkspace = sessionState.currentUser.value?.workspaceCodes?.[0]
      return {
        path: '/',
        query: readableWorkspace ? { workspace: readableWorkspace } : undefined,
        replace: true,
      }
    }
  }

  const permissionCode = typeof to.meta.permissionCode === 'string'
    ? to.meta.permissionCode
    : requiredPermissionForPath(to.path)
  if (permissionCode) {
    const requestedWorkspace = Array.isArray(to.query.workspace) ? to.query.workspace[0] : to.query.workspace
    const workspaceCode = requestedWorkspace || sessionState.currentUser.value?.workspaceCodes?.[0]
    if (!hasWorkspacePermission(sessionState.currentUser.value, workspaceCode, permissionCode)) {
      return {
        path: '/',
        query: workspaceCode ? { workspace: workspaceCode } : undefined,
        replace: true,
      }
    }
  }

  return true
})

function requiredPermissionForPath(path: string) {
  if (path.startsWith('/config-center')) return 'config.view'
  if (path.startsWith('/cases')) return 'cases.view'
  if (path.startsWith('/bugs')) return 'bugs.view'
  if (path.startsWith('/automation/api')) return 'api.view'
  if (path.startsWith('/automation/web')) return 'webui.view'
  if (path.startsWith('/tasks')) return 'tasks.view'
  if (path.startsWith('/reports')) return 'reports.view'
  return ''
}
