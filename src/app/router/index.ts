import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/app/layouts/AppLayout.vue'
import { loadCurrentUser, sessionState } from '@/entities/session'
import ApiAutomationPage from '@/pages/automation-api/ApiAutomationPage.vue'
import WebAutomationPage from '@/pages/automation-web/WebAutomationPage.vue'
import WebUiSharedReportPage from '@/pages/automation-web/WebUiSharedReportPage.vue'
import CaseAiConfigPage from '@/pages/cases/CaseAiConfigPage.vue'
import CaseAiGeneratePage from '@/pages/cases/CaseAiGeneratePage.vue'
import CaseAiRecordsPage from '@/pages/cases/CaseAiRecordsPage.vue'
import CaseCenterPage from '@/pages/cases/CaseCenterPage.vue'
import CasesPage from '@/pages/cases/CasesPage.vue'
import ConfigCenterPage from '@/pages/config-center/ConfigCenterPage.vue'
import DefectDetailPage from '@/pages/defects/DefectDetailPage.vue'
import DefectsPage from '@/pages/defects/DefectsPage.vue'
import LoginPage from '@/pages/login/LoginPage.vue'
import PlaceholderPage from '@/pages/placeholder/PlaceholderPage.vue'
import SystemSettingsPage from '@/pages/system-settings/SystemSettingsPage.vue'

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
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: PlaceholderPage,
        meta: {
          title: '工作台',
          description: '保持旧项目克制的占位页风格，后续按模块迁移实际内容。',
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: SystemSettingsPage,
        meta: {
          title: '系统设置',
          description: '管理 AI 连接、工作空间、成员与用户账号。',
        },
      },
      {
        path: 'config-center',
        name: 'config-center',
        component: ConfigCenterPage,
        meta: {
          title: '配置中心',
          description: '后续保持公共配置边界，迁移环境、参数、数据库连接配置。',
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
            },
          },
          {
            path: 'manage/execute/:id',
            name: 'case-execution',
            component: () => import('@/pages/cases/CaseExecutionPage.vue'),
            meta: {
              title: '用例执行',
              description: '按旧项目执行工作台方向接入用例执行。',
            },
          },
          {
            path: 'ai-generate',
            name: 'cases-ai-generate',
            component: CaseAiGeneratePage,
            meta: {
              title: '用例中心',
              description: 'AI 用例生成页面将按旧项目方向后续补齐。',
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
          title: '新增缺陷',
          description: '按页面式编辑体验创建缺陷基础信息。',
        },
      },
      {
        path: 'bugs/:id/edit',
        name: 'bug-edit',
        component: () => import('@/pages/defects/DefectEditPage.vue'),
        meta: {
          title: '编辑缺陷',
          description: '按页面式编辑节奏调整缺陷基础信息。',
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
        name: 'automation-api-reports',
        component: ApiAutomationPage,
        meta: {
          title: '接口自动化报告',
          description: '查看接口用例、场景和执行套件的运行报告。',
        },
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
          title: 'Web UI 用例工作台',
          description: '编辑 Web UI 用例步骤、运行调试，并预留本地 Runner 录制入口。',
        },
      },
      {
        path: 'automation/web/elements',
        name: 'automation-web-elements',
        component: WebAutomationPage,
        meta: {
          title: 'Web UI 元素库',
          description: '维护页面对象、元素定位器、验证结果和用例引用关系。',
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

router.beforeEach(async (to) => {
  const isPublicRoute = to.meta.public === true

  if (!sessionState.sessionChecked.value) {
    await loadCurrentUser()
  }

  if (to.name === 'login' && sessionState.isAuthenticated.value) {
    return { path: '/config-center', replace: true }
  }

  if (!isPublicRoute && !sessionState.isAuthenticated.value) {
    return {
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
      replace: true,
    }
  }

  return true
})
