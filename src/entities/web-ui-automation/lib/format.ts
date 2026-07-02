import {
  getWebUiBrowserOption,
  getWebUiCaseStatusOption,
  getWebUiEnvironmentStatusOption,
  getWebUiLocatorOption,
  getWebUiRunStatusOption,
  getWebUiRunStepStatusOption,
  getWebUiScreenshotPolicyOption,
  getWebUiStepTypeOption,
} from '../model/options.ts'

import type { WebUiStepType } from '../model/types'

export function formatBrowserType(browserType?: string | null) {
  return getWebUiBrowserOption(browserType)?.label || browserType || '-'
}

export function formatCaseStatus(status?: string | null) {
  return getWebUiCaseStatusOption(status)?.label || status || '-'
}

export function formatStepType(stepType?: string | null) {
  return getWebUiStepTypeOption(stepType)?.label || stepType || '-'
}

export function formatLocatorType(locatorType?: string | null) {
  return getWebUiLocatorOption(locatorType)?.label || locatorType || '-'
}

export function formatScreenshotPolicy(policy?: string | null) {
  return getWebUiScreenshotPolicyOption(policy)?.label || policy || '-'
}

export function formatEnvironmentStatus(status?: number | null) {
  return getWebUiEnvironmentStatusOption(status)?.label || (status === null || status === undefined ? '-' : String(status))
}

export function formatRunStatus(status?: string | null) {
  return getWebUiRunStatusOption(status)?.label || status || '-'
}

export function formatExecutionLocation(value?: string | null) {
  if (value === 'LOCAL_RUNNER') {
    return '本地执行器'
  }
  if (value === 'SERVER') {
    return '服务端执行'
  }
  return value || '服务端执行'
}

export function formatRunStepStatus(status?: string | null) {
  return getWebUiRunStepStatusOption(status)?.label || status || '-'
}

export function requiresLocator(stepType?: WebUiStepType | string | null) {
  return [
    'CLICK',
    'FILL',
    'CLEAR',
    'HOVER',
    'DOUBLE_CLICK',
    'RIGHT_CLICK',
    'SELECT',
    'FILE_UPLOAD',
    'WAIT_FOR',
    'ASSERT_VISIBLE',
    'ASSERT_TEXT',
    'ASSERT_ATTRIBUTE',
    'ASSERT_COUNT',
  ].includes(String(stepType || ''))
}

export function requiresInput(stepType?: WebUiStepType | string | null) {
  return [
    'OPEN',
    'FILL',
    'PRESS_KEY',
    'SELECT',
    'FILE_UPLOAD',
    'ASSERT_TEXT',
    'ASSERT_URL',
    'ASSERT_TITLE',
    'ASSERT_ATTRIBUTE',
    'ASSERT_COUNT',
  ].includes(String(stepType || ''))
}

export function formatWebUiDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function formatDurationMs(value?: number | null) {
  if (value === null || value === undefined) {
    return '-'
  }
  if (value < 1000) {
    return `${value} ms`
  }
  return `${(value / 1000).toFixed(2)} s`
}
