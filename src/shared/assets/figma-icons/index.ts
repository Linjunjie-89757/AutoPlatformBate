import dbActionDelete from './config-center/db/action-delete.svg'
import dbActionEdit from './config-center/db/action-edit.svg'
import dbActionTest from './config-center/db/action-test.svg'
import dbCylinderBlue from './config-center/db/db-cylinder-blue.svg'
import dbCylinderOrange from './config-center/db/db-cylinder-orange.svg'
import dbCylinderPurple from './config-center/db/db-cylinder-purple.svg'
import dbCylinderYellow from './config-center/db/db-cylinder-yellow.svg'
import aiActionDelete from './config-center/ai/action-delete.svg'
import aiActionEdit from './config-center/ai/action-edit.svg'
import aiActionModel from './config-center/ai/action-model.svg'
import aiActionPower from './config-center/ai/action-power.svg'
import aiActionTest from './config-center/ai/action-test.svg'
import aiCheckboxChecked from './config-center/ai/checkbox-checked.svg'
import aiChevronRight from './config-center/ai/chevron-right.svg'
import aiDrawerClose from './config-center/ai/drawer-close.svg'
import aiDrawerSave from './config-center/ai/drawer-save.svg'
import aiDrawerTest from './config-center/ai/drawer-test.svg'
import aiEye from './config-center/ai/eye.svg'
import aiKeyConfigured from './config-center/ai/key-configured.svg'
import aiKeyMissing from './config-center/ai/key-missing.svg'
import aiModelSupportCheck from './config-center/ai/model-support-check.svg'
import aiPlus from './config-center/ai/plus.svg'
import aiRefresh from './config-center/ai/refresh.svg'
import aiSearch from './config-center/ai/search.svg'
import aiTestSuccess from './config-center/ai/test-success.svg'
import aiUsage from './config-center/ai/usage.svg'
import aiWarning from './config-center/ai/warning.svg'
import notificationActionDelete from './config-center/notification/action-delete.svg'
import notificationActionCopy from './config-center/notification/action-copy.svg'
import notificationActionEdit from './config-center/notification/action-edit.svg'
import notificationActionEye from './config-center/notification/action-eye.svg'
import notificationActionPower from './config-center/notification/action-power.svg'
import notificationActionRetry from './config-center/notification/action-retry.svg'
import notificationActionSend from './config-center/notification/action-send.svg'
import notificationChannelEmail from './config-center/notification/channel-email.svg'
import notificationChannelWebhook from './config-center/notification/channel-webhook.svg'
import notificationChannelWecom from './config-center/notification/channel-wecom.svg'
import notificationDrawerClose from './config-center/notification/drawer-close.svg'
import notificationDrawerHint from './config-center/notification/drawer-hint.svg'
import notificationDrawerSave from './config-center/notification/drawer-save.svg'
import notificationModalDeleteWarning from './config-center/notification/modal-delete-warning.svg'
import notificationPlus from './config-center/notification/plus.svg'
import notificationTabChannel from './config-center/notification/tab-channel.svg'
import notificationTabHistory from './config-center/notification/tab-history.svg'
import notificationTabRule from './config-center/notification/tab-rule.svg'
import runnerActionDetail from './config-center/runner/runner-17.svg'
import runnerActionEdit from './config-center/runner/runner-18.svg'
import runnerActionLog from './config-center/runner/runner-16.svg'
import runnerActionPlus from './config-center/runner/runner-19.svg'
import runnerActionReport from './config-center/runner/runner-15.svg'
import runnerActionTrash from './config-center/runner/runner-20.svg'
import runnerCapabilityApi from './config-center/runner/runner-26.svg'
import runnerCapabilityRecording from './config-center/runner/runner-28.svg'
import runnerCapabilityScreenshot from './config-center/runner/runner-29.svg'
import runnerCapabilityUpload from './config-center/runner/runner-30.svg'
import runnerCapabilityWebui from './config-center/runner/runner-27.svg'
import runnerCheckboxChecked from './config-center/runner/runner-25.svg'
import runnerDrawerClose from './config-center/runner/runner-24.svg'
import runnerDrawerSave from './config-center/runner/runner-31.svg'
import runnerNavApi from './config-center/runner/runner-05.svg'
import runnerNavApp from './config-center/runner/runner-07.svg'
import runnerNavBug from './config-center/runner/runner-04.svg'
import runnerNavCase from './config-center/runner/runner-03.svg'
import runnerNavConfig from './config-center/runner/runner-02.svg'
import runnerNavDashboard from './config-center/runner/runner-01.svg'
import runnerNavSetting from './config-center/runner/runner-10.svg'
import runnerNavWeb from './config-center/runner/runner-06.svg'
import overviewAi from './config-center/overview/overview-ai.svg'
import overviewDatabase from './config-center/overview/overview-database.svg'
import overviewEnvironment from './config-center/overview/overview-environment.svg'
import overviewNotification from './config-center/overview/overview-notification.svg'
import overviewParameter from './config-center/overview/overview-parameter.svg'
import overviewRunner from './config-center/overview/overview-runner.svg'

export const figmaConfigDbIcons = {
  cylinder: {
    blue: dbCylinderBlue,
    purple: dbCylinderPurple,
    orange: dbCylinderOrange,
    yellow: dbCylinderYellow,
  },
  action: {
    test: dbActionTest,
    edit: dbActionEdit,
    delete: dbActionDelete,
  },
} as const

export type FigmaConfigDbCylinderIcon = keyof typeof figmaConfigDbIcons.cylinder

export const figmaConfigAiIcons = {
  action: {
    test: aiActionTest,
    model: aiActionModel,
    edit: aiActionEdit,
    power: aiActionPower,
    delete: aiActionDelete,
  },
  drawer: {
    close: aiDrawerClose,
    test: aiDrawerTest,
    save: aiDrawerSave,
    eye: aiEye,
  },
  checkbox: {
    checked: aiCheckboxChecked,
  },
  key: {
    configured: aiKeyConfigured,
    missing: aiKeyMissing,
  },
  model: {
    supportCheck: aiModelSupportCheck,
  },
  refresh: aiRefresh,
  plus: aiPlus,
  search: aiSearch,
  warning: aiWarning,
  usage: aiUsage,
  chevronRight: aiChevronRight,
  testSuccess: aiTestSuccess,
}

export const figmaConfigNotificationIcons = {
  tab: {
    channel: notificationTabChannel,
    rule: notificationTabRule,
    history: notificationTabHistory,
  },
  channel: {
    wecom: notificationChannelWecom,
    email: notificationChannelEmail,
    webhook: notificationChannelWebhook,
  },
  action: {
    send: notificationActionSend,
    edit: notificationActionEdit,
    copy: notificationActionCopy,
    eye: notificationActionEye,
    power: notificationActionPower,
    retry: notificationActionRetry,
    delete: notificationActionDelete,
  },
  drawer: {
    close: notificationDrawerClose,
    hint: notificationDrawerHint,
    save: notificationDrawerSave,
  },
  modal: {
    deleteWarning: notificationModalDeleteWarning,
  },
  plus: notificationPlus,
} as const

export type FigmaConfigNotificationChannelIcon = keyof typeof figmaConfigNotificationIcons.channel

export const figmaConfigRunnerIcons = {
  action: {
    detail: runnerActionDetail,
    edit: runnerActionEdit,
    log: runnerActionLog,
    plus: runnerActionPlus,
    report: runnerActionReport,
    trash: runnerActionTrash,
  },
  capability: {
    api: runnerCapabilityApi,
    webui: runnerCapabilityWebui,
    recording: runnerCapabilityRecording,
    screenshot: runnerCapabilityScreenshot,
    upload: runnerCapabilityUpload,
  },
  checkbox: {
    checked: runnerCheckboxChecked,
  },
  drawer: {
    close: runnerDrawerClose,
    save: runnerDrawerSave,
  },
} as const

export const figmaGlobalNavIcons = {
  dashboard: runnerNavDashboard,
  config: runnerNavConfig,
  case: runnerNavCase,
  bug: runnerNavBug,
  api: runnerNavApi,
  web: runnerNavWeb,
  app: runnerNavApp,
  setting: runnerNavSetting,
} as const

export const figmaConfigOverviewIcons = {
  database: overviewDatabase,
  environment: overviewEnvironment,
  runner: overviewRunner,
  ai: overviewAi,
  notification: overviewNotification,
  parameter: overviewParameter,
} as const
