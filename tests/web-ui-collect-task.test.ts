import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCollectTaskStages,
  buildCollectCandidateValidationSummary,
  buildCollectCandidateSaveSummary,
  buildCollectCandidateValidationLocators,
  shouldShowCollectCandidateForFilter,
  formatCollectFilterReason,
  getCollectCandidateReviewLevel,
  getCollectCandidateReviewMessage,
  isCollectTaskTerminalStatus,
  normalizeElementCollectTaskResponse,
} from '../src/entities/web-ui-automation/lib/collectTask.ts'

test('normalizes web ui collect task detail with filter logs', () => {
  const task = normalizeElementCollectTaskResponse({
    taskId: 12,
    status: 'COMPLETED',
    currentStage: 'FINALIZE',
    progressPercent: 100,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: 'Orders',
    aiModelConfigId: 9,
    aiModelName: 'web-ui-ai-model',
    rawCount: 4,
    finalCount: 1,
    filterSummary: {
      originalCount: 4,
      emptyLocatorCount: 1,
      duplicateCount: 1,
      lowStabilityCount: 1,
      finalCount: 1,
    },
    filterLogs: [
      {
        stage: 'STATIC_RULE',
        reason: 'DUPLICATE_LOCATOR',
        count: 1,
        message: '重复定位器候选已合并',
      },
    ],
    candidates: [],
    message: 'done',
    createdAt: '2026-06-22T23:00:00',
    completedAt: '2026-06-22T23:00:01',
  })

  assert.equal(task.taskId, 12)
  assert.equal(task.currentStage, 'FINALIZE')
  assert.equal(task.progressPercent, 100)
  assert.equal(task.aiModelConfigId, 9)
  assert.equal(task.aiModelName, 'web-ui-ai-model')
  assert.equal(task.filterSummary?.duplicateCount, 1)
  assert.deepEqual(task.filterLogs, [
    {
      stage: 'STATIC_RULE',
      reason: 'DUPLICATE_LOCATOR',
      count: 1,
      message: '重复定位器候选已合并',
    },
  ])
})

test('builds ai metadata stage description from collect task message and model', () => {
  const task = normalizeElementCollectTaskResponse({
    taskId: 17,
    status: 'WAITING_LOCAL_VALIDATION',
    currentStage: 'LOCAL_VALIDATE',
    progressPercent: 75,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: 'Orders',
    aiModelConfigId: 9,
    aiModelName: 'web-ui-ai-model',
    rawCount: 2,
    finalCount: 2,
    filterSummary: null,
    filterLogs: [],
    candidates: [
      {
        groupName: '筛选区',
        elementName: '订单搜索按钮',
        locatorType: 'CSS',
        locatorValue: '#search',
        confidence: 96,
        reason: '按钮位于订单筛选区域',
        tagName: 'button',
        elementType: 'BUTTON',
        text: '查询',
        placeholder: null,
        ariaLabel: null,
        labelText: null,
        nearbyHeading: null,
        businessMeaning: '触发订单列表查询',
        recommendedToSave: true,
        notRecommendedReason: null,
        maintenanceSuggestion: '建议保留 id 或补充 data-testid',
        stabilityNote: 'id 定位稳定',
        validationStatus: 'UNVERIFIED',
        matchCount: null,
        validationMessage: null,
        screenshotBase64: null,
        candidateSource: 'STATIC_RULE',
        saveBlockedReason: null,
      },
    ],
    message: 'AI 已完成候选元素命名、分组和说明增强',
    createdAt: null,
    completedAt: null,
  })

  const stages = buildCollectTaskStages(task)
  const aiStage = stages.find(stage => stage.key === 'AI_ANALYZE')

  assert.equal(aiStage?.status, 'done')
  assert.equal(aiStage?.description, 'web-ui-ai-model：AI 已完成候选元素命名、分组和说明增强')
})

test('summarizes ai metadata enhanced candidates separately from ai supplement', () => {
  const summary = buildCollectCandidateValidationSummary([
    {
      groupName: '筛选区',
      elementName: '订单搜索按钮',
      locatorType: 'CSS',
      locatorValue: '#search',
      confidence: 96,
      reason: '',
      tagName: 'button',
      elementType: 'BUTTON',
      text: '查询',
      placeholder: null,
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: '触发订单列表查询',
      recommendedToSave: true,
      notRecommendedReason: null,
      maintenanceSuggestion: '建议保留 id 或补充 data-testid',
      stabilityNote: 'id 定位稳定',
      validationStatus: 'UNVERIFIED',
      matchCount: null,
      validationMessage: null,
      screenshotBase64: null,
      candidateSource: 'STATIC_RULE',
      saveBlockedReason: null,
    },
  ])

  assert.equal(summary.aiEnhanced, 1)
  assert.equal(summary.aiSupplement, 0)
})

test('summarizes ai supplement candidates across validation states', () => {
  const summary = buildCollectCandidateValidationSummary([
    {
      groupName: '操作区',
      elementName: '导出按钮',
      locatorType: 'CSS',
      locatorValue: '#export',
      confidence: 88,
      reason: 'AI 补充可能漏采的导出操作',
      tagName: null,
      elementType: null,
      text: null,
      placeholder: null,
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: '导出订单列表',
      recommendedToSave: true,
      notRecommendedReason: 'AI 补充候选需通过本地 Runner 验证后才能保存',
      maintenanceSuggestion: '建议补充 data-testid 后再保存',
      stabilityNote: 'AI 补充候选，需 Runner 真机验证',
      validationStatus: 'AI_UNVERIFIED',
      matchCount: null,
      validationMessage: 'AI 补充候选尚未经过本地 Runner 真机验证',
      screenshotBase64: null,
      candidateSource: 'AI_SUPPLEMENT',
      saveBlockedReason: 'AI 补充候选需通过本地 Runner 验证后才能保存',
    },
    {
      groupName: '操作区',
      elementName: '刷新按钮',
      locatorType: 'CSS',
      locatorValue: '#refresh',
      confidence: 91,
      reason: 'Runner 已验证 AI 补充候选',
      tagName: null,
      elementType: null,
      text: null,
      placeholder: null,
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: '刷新订单列表',
      recommendedToSave: true,
      notRecommendedReason: null,
      maintenanceSuggestion: null,
      stabilityNote: null,
      validationStatus: 'PASSED',
      matchCount: 1,
      validationMessage: '真机验证通过',
      screenshotBase64: 'ok-png',
      candidateSource: 'AI_SUPPLEMENT',
      saveBlockedReason: null,
    },
  ])

  assert.equal(summary.aiSupplement, 2)
  assert.equal(summary.blocked, 1)
  assert.equal(summary.unverified, 1)
  assert.equal(summary.passed, 1)
  assert.equal(summary.recommended, 1)
})

test('builds save summary for selected ai collect candidates', () => {
  const summary = buildCollectCandidateSaveSummary(
    [
      {
        groupName: '操作区',
        elementName: '导出按钮',
        locatorType: 'CSS',
        locatorValue: '#export',
        confidence: 88,
        validationStatus: 'AI_UNVERIFIED',
        candidateSource: 'AI_SUPPLEMENT',
        saveBlockedReason: 'AI 补充候选需通过本地 Runner 验证后才能保存',
      },
      {
        groupName: '操作区',
        elementName: '刷新按钮',
        locatorType: 'CSS',
        locatorValue: '#refresh',
        confidence: 92,
        validationStatus: 'PASSED',
        candidateSource: 'AI_SUPPLEMENT',
        saveBlockedReason: null,
      },
      {
        groupName: '筛选区',
        elementName: '查询按钮',
        locatorType: 'CSS',
        locatorValue: '#search',
        confidence: 96,
        validationStatus: 'PASSED',
        candidateSource: 'STATIC_RULE',
        saveBlockedReason: null,
      },
      {
        groupName: '筛选区',
        elementName: '查询按钮',
        locatorType: 'CSS',
        locatorValue: '#search',
        confidence: 96,
        validationStatus: 'PASSED',
        candidateSource: 'STATIC_RULE',
        saveBlockedReason: null,
      },
      {
        groupName: '列表区',
        elementName: '删除按钮',
        locatorType: 'TEXT',
        locatorValue: '删除',
        confidence: 82,
        validationStatus: 'MULTIPLE',
        candidateSource: 'STATIC_RULE',
        saveBlockedReason: '真机验证未通过，暂不建议保存',
      },
    ],
    [
      {
        groupName: '筛选区',
        elementName: '已有查询按钮',
        locatorType: 'CSS',
        locatorValue: '#search',
      },
    ],
  )

  assert.deepEqual(summary, {
    selectedCount: 5,
    saveableCount: 1,
    createCount: 1,
    skippedCount: 4,
    duplicateCount: 2,
    blockedCount: 2,
    aiSupplementCount: 2,
    aiSupplementUnlockedCount: 1,
    aiSupplementUnverifiedCount: 1,
    failedCount: 0,
    multipleCount: 1,
    unverifiedCount: 1,
    lowConfidenceCount: 0,
    abnormalCount: 1,
  })
})

test('formats ai collect filter reasons for task logs', () => {
  assert.equal(formatCollectFilterReason('AI_METADATA_ENHANCE'), 'AI 增强')
  assert.equal(formatCollectFilterReason('EMPTY_LOCATOR'), '空定位')
  assert.equal(formatCollectFilterReason('UNKNOWN_CUSTOM_REASON'), 'UNKNOWN_CUSTOM_REASON')
  assert.equal(formatCollectFilterReason(null), '未知')
})

test('builds front-end stage model for completed static collect task', () => {
  const stages = buildCollectTaskStages({
    taskId: 12,
    status: 'COMPLETED',
    currentStage: 'FINALIZE',
    progressPercent: 100,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: 'Orders',
    rawCount: 4,
    finalCount: 1,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: null,
    createdAt: '2026-06-22T23:00:00',
    completedAt: '2026-06-22T23:00:01',
  })

  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'done'],
    ['RULE_CLEAN', 'done'],
    ['AI_ANALYZE', 'done'],
    ['LOCAL_VALIDATE', 'done'],
    ['FINALIZE', 'done'],
  ])
})

test('builds degraded stage model when local validation is skipped', () => {
  const stages = buildCollectTaskStages({
    taskId: 13,
    status: 'DEGRADED',
    currentStage: 'LOCAL_VALIDATE',
    progressPercent: 80,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: null,
    pageTitle: null,
    rawCount: 4,
    finalCount: 1,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: '本地 Runner 离线，已降级输出静态候选',
    createdAt: null,
    completedAt: null,
  })

  const localValidate = stages.find(stage => stage.key === 'LOCAL_VALIDATE')
  const finalize = stages.find(stage => stage.key === 'FINALIZE')
  assert.equal(localValidate?.status, 'degraded')
  assert.equal(localValidate?.description, '本地 Runner 离线，已降级输出静态候选')
  assert.equal(finalize?.status, 'done')
})

test('builds running stage model from backend current stage', () => {
  const stages = buildCollectTaskStages({
    taskId: 14,
    status: 'PROCESSING',
    currentStage: 'AI_ANALYZE',
    progressPercent: 60,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: null,
    pageTitle: null,
    rawCount: 4,
    finalCount: 0,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: null,
    createdAt: null,
    completedAt: null,
  })

  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'done'],
    ['RULE_CLEAN', 'done'],
    ['AI_ANALYZE', 'running'],
    ['LOCAL_VALIDATE', 'pending'],
    ['FINALIZE', 'pending'],
  ])
})

test('builds waiting-local-validation stage model from backend status fallback', () => {
  const task = normalizeElementCollectTaskResponse({
    taskId: 15,
    status: 'WAITING_LOCAL_VALIDATION',
    currentStage: '',
    progressPercent: undefined as unknown as number,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: null,
    rawCount: 4,
    finalCount: 2,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: null,
    createdAt: null,
    completedAt: null,
  })

  const stages = buildCollectTaskStages(task)
  assert.equal(task.currentStage, 'LOCAL_VALIDATE')
  assert.equal(task.progressPercent, 75)
  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'done'],
    ['RULE_CLEAN', 'done'],
    ['AI_ANALYZE', 'done'],
    ['LOCAL_VALIDATE', 'running'],
    ['FINALIZE', 'pending'],
  ])
})

test('builds canceled stage model as terminal local validation state', () => {
  const task = normalizeElementCollectTaskResponse({
    taskId: 16,
    status: 'CANCELED',
    currentStage: '',
    progressPercent: undefined as unknown as number,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: null,
    rawCount: 4,
    finalCount: 2,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: '用户取消采集任务',
    createdAt: null,
    completedAt: null,
  })

  const stages = buildCollectTaskStages(task)
  assert.equal(task.currentStage, 'LOCAL_VALIDATE')
  assert.equal(task.progressPercent, 100)
  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'pending'],
    ['RULE_CLEAN', 'pending'],
    ['AI_ANALYZE', 'pending'],
    ['LOCAL_VALIDATE', 'failed'],
    ['FINALIZE', 'pending'],
  ])
})

test('identifies collect task terminal statuses for polling', () => {
  assert.equal(isCollectTaskTerminalStatus('COMPLETED'), true)
  assert.equal(isCollectTaskTerminalStatus('FAILED'), true)
  assert.equal(isCollectTaskTerminalStatus('DEGRADED'), true)
  assert.equal(isCollectTaskTerminalStatus('CANCELED'), true)
  assert.equal(isCollectTaskTerminalStatus('WAITING_LOCAL_VALIDATION'), false)
  assert.equal(isCollectTaskTerminalStatus('PROCESSING'), false)
  assert.equal(isCollectTaskTerminalStatus('PENDING'), false)
})

test('summarizes collect candidate validation statuses for review filters', () => {
  const summary = buildCollectCandidateValidationSummary([
    {
      groupName: '表单',
      elementName: '搜索',
      locatorType: 'CSS',
      locatorValue: '#search',
      confidence: 90,
      reason: '',
      tagName: 'button',
      elementType: 'BUTTON',
      text: '搜索',
      placeholder: null,
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: null,
      recommendedToSave: true,
      notRecommendedReason: null,
      maintenanceSuggestion: null,
      stabilityNote: null,
      validationStatus: 'PASSED',
      matchCount: 1,
      validationMessage: null,
      screenshotBase64: null,
      candidateSource: 'STATIC_RULE',
      saveBlockedReason: null,
    },
    {
      groupName: '表单',
      elementName: '重复按钮',
      locatorType: 'TEXT',
      locatorValue: '提交',
      confidence: 82,
      reason: '',
      tagName: 'button',
      elementType: 'BUTTON',
      text: '提交',
      placeholder: null,
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: null,
      recommendedToSave: true,
      notRecommendedReason: null,
      maintenanceSuggestion: null,
      stabilityNote: null,
      validationStatus: 'MULTIPLE',
      matchCount: 2,
      validationMessage: null,
      screenshotBase64: null,
      candidateSource: 'STATIC_RULE',
      saveBlockedReason: '真机验证未通过，暂不建议保存',
    },
    {
      groupName: '表单',
      elementName: '用户名',
      locatorType: 'CSS',
      locatorValue: '#username',
      confidence: 65,
      reason: '',
      tagName: 'input',
      elementType: 'INPUT',
      text: null,
      placeholder: '用户名',
      ariaLabel: null,
      labelText: null,
      nearbyHeading: null,
      businessMeaning: null,
      recommendedToSave: true,
      notRecommendedReason: null,
      maintenanceSuggestion: null,
      stabilityNote: null,
      validationStatus: 'UNVERIFIED',
      matchCount: null,
      validationMessage: null,
      screenshotBase64: null,
      candidateSource: 'AI_SUPPLEMENT',
      saveBlockedReason: null,
    },
  ])

  assert.deepEqual(summary, {
    total: 3,
    recommended: 2,
    passed: 1,
    failed: 0,
    multiple: 1,
    unverified: 1,
    abnormal: 1,
    lowConfidence: 1,
    aiEnhanced: 0,
    aiSupplement: 1,
    blocked: 1,
  })
})

test('filters collect candidates for ai review tabs', () => {
  const passedRuleCandidate = {
    recommendedToSave: true,
    validationStatus: 'PASSED',
    confidence: 92,
    candidateSource: 'STATIC_RULE',
    saveBlockedReason: null,
  }
  const blockedAiCandidate = {
    recommendedToSave: true,
    validationStatus: 'AI_UNVERIFIED',
    confidence: 84,
    candidateSource: 'AI_SUPPLEMENT',
    saveBlockedReason: 'AI 补充候选需通过本地 Runner 验证后才能保存',
  }
  const lowConfidenceCandidate = {
    recommendedToSave: true,
    validationStatus: 'UNVERIFIED',
    confidence: 58,
    candidateSource: 'STATIC_RULE',
    saveBlockedReason: null,
  }

  assert.equal(shouldShowCollectCandidateForFilter(passedRuleCandidate, 'RECOMMENDED'), true)
  assert.equal(shouldShowCollectCandidateForFilter(blockedAiCandidate, 'RECOMMENDED'), false)
  assert.equal(shouldShowCollectCandidateForFilter(blockedAiCandidate, 'BLOCKED'), true)
  assert.equal(shouldShowCollectCandidateForFilter(blockedAiCandidate, 'AI_SUPPLEMENT'), true)
  assert.equal(shouldShowCollectCandidateForFilter(blockedAiCandidate, 'AI_UNVERIFIED'), true)
  assert.equal(shouldShowCollectCandidateForFilter(lowConfidenceCandidate, 'LOW_CONFIDENCE'), true)
  assert.equal(shouldShowCollectCandidateForFilter(lowConfidenceCandidate, 'BLOCKED'), false)
})

test('builds unique locator list for collect candidate revalidation', () => {
  const locators = buildCollectCandidateValidationLocators([
    {
      locatorType: 'CSS',
      locatorValue: ' #submit ',
    },
    {
      locatorType: 'CSS',
      locatorValue: '#submit',
      shadowPath: ['submit-shell'],
    },
    {
      locatorType: 'TEXT',
      locatorValue: '提交',
    },
    {
      locatorType: 'CSS',
      locatorValue: '',
    },
  ])

  assert.deepEqual(locators, [
    { locatorType: 'CSS', locatorValue: '#submit' },
    { locatorType: 'CSS', locatorValue: '#submit', shadowPath: ['submit-shell'] },
    { locatorType: 'TEXT', locatorValue: '提交' },
  ])
})

test('classifies collect candidate review level and message', () => {
  assert.equal(getCollectCandidateReviewLevel({ validationStatus: 'PASSED', confidence: 88 }), 'success')
  assert.equal(getCollectCandidateReviewMessage({ validationStatus: 'PASSED', matchCount: 1, confidence: 88 }), '本地页面验证通过，定位器匹配 1 个元素')

  assert.equal(getCollectCandidateReviewLevel({ validationStatus: 'FAILED', confidence: 88 }), 'danger')
  assert.equal(getCollectCandidateReviewMessage({ validationStatus: 'FAILED', validationMessage: '未找到元素', confidence: 88 }), '未找到元素')

  assert.equal(getCollectCandidateReviewLevel({ validationStatus: 'MULTIPLE', matchCount: 3, confidence: 88 }), 'warning')
  assert.equal(getCollectCandidateReviewMessage({ validationStatus: 'MULTIPLE', matchCount: 3, confidence: 88 }), '定位器匹配 3 个元素，建议改成唯一定位器')

  assert.equal(getCollectCandidateReviewLevel({ validationStatus: 'UNVERIFIED', confidence: 88 }), 'warning')
  assert.equal(getCollectCandidateReviewMessage({ validationStatus: 'UNVERIFIED', confidence: 88 }), '尚未经过本地页面验证')

  assert.equal(getCollectCandidateReviewLevel({ validationStatus: 'PASSED', confidence: 55 }), 'warning')
  assert.equal(getCollectCandidateReviewMessage({ validationStatus: 'PASSED', confidence: 55 }), '稳定性评分偏低，建议确认定位器是否足够稳定')
})
