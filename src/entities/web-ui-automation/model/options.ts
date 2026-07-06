import type {
  WebUiBrowserType,
  WebUiCaseStatus,
  WebUiEnvironmentStatus,
  WebUiLocatorType,
  WebUiRunStatus,
  WebUiRunStepStatus,
  WebUiScreenshotPolicy,
  WebUiStepType,
} from './types'

type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'

export const WEB_UI_BROWSER_OPTIONS: Array<{
  label: string
  value: WebUiBrowserType
}> = [
  { label: 'Chromium', value: 'CHROMIUM' },
  { label: 'Firefox', value: 'FIREFOX' },
  { label: 'WebKit', value: 'WEBKIT' },
]

export const WEB_UI_CASE_STATUS_OPTIONS: Array<{
  label: string
  value: WebUiCaseStatus
  tone: BadgeTone
}> = [
  { label: '启用', value: 'ENABLED', tone: 'success' },
  { label: '停用', value: 'DISABLED', tone: 'default' },
]

export const WEB_UI_STEP_TYPE_OPTIONS: Array<{
  label: string
  value: WebUiStepType
  tone: BadgeTone
  description: string
}> = [
  { label: '打开页面', value: 'OPEN', tone: 'primary', description: '填写相对路径或完整 URL' },
  { label: '点击', value: 'CLICK', tone: 'primary', description: '定位一个可点击元素并执行点击' },
  { label: '输入', value: 'FILL', tone: 'success', description: '定位输入框并填写文本' },
  { label: '清空', value: 'CLEAR', tone: 'default', description: '清空输入框或可编辑元素' },
  { label: '悬停', value: 'HOVER', tone: 'primary', description: '鼠标悬停到菜单或元素上' },
  { label: '拖拽', value: 'DRAG_TO', tone: 'primary', description: '将源元素拖拽到目标定位器' },
  { label: '坐标拖拽', value: 'DRAG_COORDINATES', tone: 'primary', description: '在画布或容器内按坐标拖拽' },
  { label: '双击', value: 'DOUBLE_CLICK', tone: 'primary', description: '对定位元素执行双击' },
  { label: '右键', value: 'RIGHT_CLICK', tone: 'primary', description: '对定位元素执行右键点击' },
  { label: '按键', value: 'PRESS_KEY', tone: 'primary', description: '按键或组合键，例如 Enter、Control+A' },
  { label: '下拉选择', value: 'SELECT', tone: 'success', description: '选择 select 下拉框的值或标签' },
  { label: '上传文件', value: 'FILE_UPLOAD', tone: 'warning', description: '向文件输入框上传本地文件' },
  { label: '文件选择器', value: 'FILE_PICKER', tone: 'warning', description: '点击按钮打开文件选择器并选择本地文件' },
  { label: '等待', value: 'WAIT_FOR', tone: 'warning', description: '等待定位元素出现' },
  { label: '可见断言', value: 'ASSERT_VISIBLE', tone: 'success', description: '断言定位元素可见' },
  { label: '文本断言', value: 'ASSERT_TEXT', tone: 'success', description: '断言定位元素包含目标文本' },
  { label: 'URL 断言', value: 'ASSERT_URL', tone: 'success', description: '断言当前 URL 包含目标文本' },
  { label: '标题断言', value: 'ASSERT_TITLE', tone: 'success', description: '断言页面标题包含目标文本' },
  { label: '属性断言', value: 'ASSERT_ATTRIBUTE', tone: 'success', description: '断言元素属性包含期望值，格式：属性=值' },
  { label: '数量断言', value: 'ASSERT_COUNT', tone: 'success', description: '断言定位元素数量，例如 =1、>0、<3' },
  { label: '截图', value: 'SCREENSHOT', tone: 'default', description: '保存当前页面截图证据' },
]

export const WEB_UI_LOCATOR_OPTIONS: Array<{
  label: string
  value: WebUiLocatorType
  description: string
}> = [
  { label: 'Test ID', value: 'TEST_ID', description: '按 data-testid、data-test、data-qa 或 id 定位' },
  { label: 'CSS', value: 'CSS', description: '例如 #submit 或 .login-form input' },
  { label: 'Text', value: 'TEXT', description: '按页面可见文本定位' },
  { label: 'Role', value: 'ROLE', description: '按按钮、链接等可访问角色定位' },
  { label: 'Label', value: 'LABEL', description: '按表单标签定位' },
  { label: 'Placeholder', value: 'PLACEHOLDER', description: '按 input placeholder 定位' },
  { label: 'XPath', value: 'XPATH', description: '用于复杂 DOM，优先少用' },
]

export const WEB_UI_SCREENSHOT_POLICY_OPTIONS: Array<{
  label: string
  value: WebUiScreenshotPolicy
  description: string
}> = [
  { label: '不截图', value: 'NONE', description: '步骤不额外保存截图' },
  { label: '失败截图', value: 'ON_FAILURE', description: '仅失败时保留证据' },
  { label: '每步截图', value: 'ALWAYS', description: '每次执行都保存截图' },
]

export const WEB_UI_ENVIRONMENT_STATUS_OPTIONS: Array<{
  label: string
  value: WebUiEnvironmentStatus
  tone: BadgeTone
}> = [
  { label: '启用', value: 1, tone: 'success' },
  { label: '停用', value: 0, tone: 'default' },
]

export function getWebUiBrowserOption(browserType?: string | null) {
  return WEB_UI_BROWSER_OPTIONS.find((item) => item.value === browserType)
}

export function getWebUiCaseStatusOption(status?: string | null) {
  return WEB_UI_CASE_STATUS_OPTIONS.find((item) => item.value === status)
}

export function getWebUiStepTypeOption(stepType?: string | null) {
  return WEB_UI_STEP_TYPE_OPTIONS.find((item) => item.value === stepType)
}

export function getWebUiLocatorOption(locatorType?: string | null) {
  return WEB_UI_LOCATOR_OPTIONS.find((item) => item.value === locatorType)
}

export function getWebUiScreenshotPolicyOption(policy?: string | null) {
  return WEB_UI_SCREENSHOT_POLICY_OPTIONS.find((item) => item.value === policy)
}

export function getWebUiEnvironmentStatusOption(status?: number | null) {
  return WEB_UI_ENVIRONMENT_STATUS_OPTIONS.find((item) => item.value === status)
}

export const WEB_UI_RUN_STATUS_OPTIONS: Array<{
  label: string
  value: WebUiRunStatus
  tone: BadgeTone
}> = [
  { label: '执行中', value: 'RUNNING', tone: 'warning' },
  { label: '成功', value: 'SUCCESS', tone: 'success' },
  { label: '失败', value: 'FAILED', tone: 'danger' },
  { label: '已取消', value: 'CANCELED', tone: 'default' },
]

export const WEB_UI_RUN_STEP_STATUS_OPTIONS: Array<{
  label: string
  value: WebUiRunStepStatus
  tone: BadgeTone
}> = [
  { label: '等待中', value: 'PENDING', tone: 'default' },
  { label: '执行中', value: 'RUNNING', tone: 'warning' },
  { label: '通过', value: 'PASSED', tone: 'success' },
  { label: '失败', value: 'FAILED', tone: 'danger' },
  { label: '已跳过', value: 'SKIPPED', tone: 'default' },
]

export function getWebUiRunStatusOption(status?: string | null) {
  return WEB_UI_RUN_STATUS_OPTIONS.find((item) => item.value === status)
}

export function getWebUiRunStepStatusOption(status?: string | null) {
  return WEB_UI_RUN_STEP_STATUS_OPTIONS.find((item) => item.value === status)
}
