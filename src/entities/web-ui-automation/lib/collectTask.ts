import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectTaskResponse,
} from '../model/types'

export type WebUiCollectTaskStageKey =
  | 'UPLOAD_SNAPSHOT'
  | 'RULE_CLEAN'
  | 'AI_ANALYZE'
  | 'LOCAL_VALIDATE'
  | 'FAILED'
  | 'FINALIZE'

export type WebUiCollectTaskStageStatus = 'pending' | 'running' | 'done' | 'failed' | 'degraded'

export type WebUiCollectCandidateFilter =
  | 'ALL'
  | 'RECOMMENDED'
  | 'PASSED'
  | 'FAILED'
  | 'MULTIPLE'
  | 'UNVERIFIED'
  | 'LOW_CONFIDENCE'
  | 'BLOCKED'
  | 'AI_SUPPLEMENT'
  | 'AI_UNVERIFIED'

export interface WebUiCollectTaskStage {
  key: WebUiCollectTaskStageKey
  title: string
  status: WebUiCollectTaskStageStatus
  description: string
}

export interface WebUiCollectCandidateValidationSummary {
  total: number
  recommended: number
  passed: number
  failed: number
  multiple: number
  unverified: number
  abnormal: number
  lowConfidence: number
  aiEnhanced: number
  aiSupplement: number
  blocked: number
}

export interface WebUiCollectCandidateSaveSummary {
  selectedCount: number
  saveableCount: number
  createCount: number
  skippedCount: number
  duplicateCount: number
  blockedCount: number
  aiSupplementCount: number
  aiSupplementUnlockedCount: number
  aiSupplementUnverifiedCount: number
  failedCount: number
  multipleCount: number
  unverifiedCount: number
  lowConfidenceCount: number
  abnormalCount: number
}

export interface WebUiCollectCandidateDisplayMeta {
  label: string
  tagType: 'success' | 'danger' | 'info' | 'warning' | 'primary'
  description: string
}

export interface WebUiCollectSaveNavigationInput {
  workspaceCode: string
  pageId: number
  groupId?: number | null
  collectTaskId?: number | null
  savedCount: number
  skippedCount: number
}

export interface WebUiRecordedCaseCollectSaveNavigationInput {
  workspaceCode: string
  collectTaskId?: number | null
  savedCount: number
  skippedCount: number
}

export interface WebUiRecordedCaseAutoRematchMessageInput {
  matchedCount: number
  collectTaskId?: number | null
  savedCount?: number | null
  skippedCount?: number | null
  persisted: boolean
}

export const WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN = 'web-ui-case-recording'
export const WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY = 'autoRematchRecordedElements'

type CandidateReviewShape = Pick<
  WebUiElementCollectCandidate,
  'validationStatus' | 'matchCount' | 'validationMessage' | 'confidence' | 'saveBlockedReason'
>

type CandidateSaveShape = Pick<
  WebUiElementCollectCandidate,
  'groupName' | 'elementName' | 'locatorType' | 'locatorValue' | 'confidence' | 'validationStatus' | 'candidateSource' | 'saveBlockedReason'
>

type CandidateFilterShape = Pick<
  WebUiElementCollectCandidate,
  'recommendedToSave' | 'validationStatus' | 'confidence' | 'candidateSource' | 'saveBlockedReason'
>

type CandidateLocatorShape = Pick<WebUiElementCollectCandidate, 'locatorType' | 'locatorValue'>
  & Pick<WebUiElementCollectCandidate, 'framePath' | 'shadowPath'>

type CandidateSortShape = CandidateFilterShape & CandidateReviewShape & {
  id?: string | number
  recommendedToSave: boolean
}

type ExistingElementShape = Pick<
  WebUiElementCollectCandidate,
  'elementName' | 'locatorType' | 'locatorValue'
> & {
  groupName?: string | null
}

export function getCollectCandidateReviewLevel(candidate: CandidateReviewShape): 'success' | 'warning' | 'danger' | 'info' {
  if (candidate.saveBlockedReason || candidate.validationStatus === 'FAILED') {
    return 'danger'
  }
  if (
    candidate.validationStatus === 'MULTIPLE'
    || candidate.validationStatus === 'UNVERIFIED'
    || candidate.validationStatus === 'AI_UNVERIFIED'
    || candidate.validationStatus === 'SKIPPED'
    || !candidate.validationStatus
    || Number(candidate.confidence || 0) < 70
  ) {
    return 'warning'
  }
  if (candidate.validationStatus === 'PASSED') {
    return 'success'
  }
  return 'info'
}

export function getCollectCandidateReviewMessage(candidate: CandidateReviewShape): string {
  if (candidate.saveBlockedReason) {
    return candidate.saveBlockedReason
  }
  if (candidate.validationStatus === 'FAILED') {
    return candidate.validationMessage || '本地页面验证未找到元素，暂不建议保存'
  }
  if (candidate.validationStatus === 'MULTIPLE') {
    const countText = candidate.matchCount === null || candidate.matchCount === undefined ? '多个' : `${candidate.matchCount} 个`
    return `定位器匹配 ${countText}元素，建议改成唯一定位器`
  }
  if (
    candidate.validationStatus === 'UNVERIFIED'
    || candidate.validationStatus === 'AI_UNVERIFIED'
    || candidate.validationStatus === 'SKIPPED'
    || !candidate.validationStatus
  ) {
    return '尚未经过本地页面验证'
  }
  if (Number(candidate.confidence || 0) < 70) {
    return '稳定性评分偏低，建议确认定位器是否足够稳定'
  }
  if (candidate.validationStatus === 'PASSED') {
    const count = candidate.matchCount === null || candidate.matchCount === undefined ? 1 : candidate.matchCount
    return `本地页面验证通过，定位器匹配 ${count} 个元素`
  }
  return candidate.validationMessage || '确认候选元素名称、分组和定位器后保存'
}

export function getCollectCandidateValidationMeta(status?: string | null): WebUiCollectCandidateDisplayMeta {
  if (status === 'PASSED') {
    return {
      label: '验证通过',
      tagType: 'success',
      description: '本地浏览器已在当前页面确认定位器可命中。',
    }
  }
  if (status === 'FAILED') {
    return {
      label: '验证失败',
      tagType: 'danger',
      description: 'Runner 没有找到元素，保存前建议重新采集或修正定位器。',
    }
  }
  if (status === 'MULTIPLE') {
    return {
      label: '多匹配',
      tagType: 'warning',
      description: '定位器命中多个元素，建议改成唯一定位器。',
    }
  }
  if (status === 'AI_UNVERIFIED') {
    return {
      label: 'AI 建议未验证',
      tagType: 'warning',
      description: '这是 AI 补充的候选，还没有经过本地页面验证。',
    }
  }
  if (status === 'UNVERIFIED') {
    return {
      label: '未验证',
      tagType: 'warning',
      description: '候选尚未经过本地页面验证。',
    }
  }
  if (status === 'SKIPPED') {
    return {
      label: '跳过验证',
      tagType: 'info',
      description: '当前流程没有执行本地页面验证。',
    }
  }
  return {
    label: status || '未验证',
    tagType: 'info',
    description: '确认候选元素名称、分组和定位器后再保存。',
  }
}

export function getCollectCandidateSourceMeta(source?: string | null): WebUiCollectCandidateDisplayMeta {
  if (source === 'AI_SUPPLEMENT') {
    return {
      label: 'AI 补充',
      tagType: 'warning',
      description: '规则可能漏掉的元素，由 AI 提出，需本地页面验证通过后再保存。',
    }
  }
  if (source === 'STATIC_RULE') {
    return {
      label: '静态规则',
      tagType: 'info',
      description: '由后端静态规则从页面素材中提取。',
    }
  }
  if (source === 'RECORDED_STEP') {
    return {
      label: '录制步骤',
      tagType: 'primary',
      description: '由本地录制步骤生成，适合审核后入库并回填用例步骤。',
    }
  }
  if (source === 'RULE') {
    return {
      label: '规则候选',
      tagType: 'info',
      description: '由规则采集生成的基础候选。',
    }
  }
  return {
    label: source || '规则候选',
    tagType: 'info',
    description: '由采集流程生成的候选。',
  }
}

export function sortCollectCandidatesForReview<T extends CandidateSortShape>(candidates: T[]): T[] {
  const validationRank: Record<string, number> = {
    PASSED: 0,
    UNVERIFIED: 1,
    AI_UNVERIFIED: 2,
    SKIPPED: 3,
    MULTIPLE: 4,
    FAILED: 5,
  }
  const score = (candidate: T) => {
    if (candidate.saveBlockedReason) return 900
    if (Number(candidate.confidence || 0) < 60) return 700
    const sourcePenalty = candidate.candidateSource === 'AI_SUPPLEMENT' ? 20 : 0
    const recommendedPenalty = candidate.recommendedToSave ? 0 : 100
    const validationPenalty = validationRank[candidate.validationStatus || 'UNVERIFIED'] ?? 200
    return sourcePenalty + recommendedPenalty + validationPenalty
  }
  return [...candidates].sort((left, right) => {
    const scoreDiff = score(left) - score(right)
    if (scoreDiff !== 0) return scoreDiff
    const confidenceDiff = Number(right.confidence || 0) - Number(left.confidence || 0)
    if (confidenceDiff !== 0) return confidenceDiff
    return String(left.id ?? '').localeCompare(String(right.id ?? ''))
  })
}

export function buildCollectSaveResultNavigationQuery(input: WebUiCollectSaveNavigationInput): Record<string, string> {
  const query: Record<string, string> = {
    workspace: input.workspaceCode,
    pageId: String(input.pageId),
    saved: String(input.savedCount),
    skipped: String(input.skippedCount),
  }
  if (input.groupId) {
    query.groupId = String(input.groupId)
  }
  if (input.collectTaskId) {
    query.collectTaskId = String(input.collectTaskId)
  }
  return query
}

export function buildRecordedCaseCollectSaveNavigationQuery(input: WebUiRecordedCaseCollectSaveNavigationInput): Record<string, string> {
  const query: Record<string, string> = {
    workspace: input.workspaceCode,
    workspaceCode: input.workspaceCode,
    [WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY]: '1',
    saved: String(input.savedCount),
    skipped: String(input.skippedCount),
  }
  if (input.collectTaskId) {
    query.collectTaskId = String(input.collectTaskId)
  }
  return query
}

export function buildRecordedCaseAutoRematchMessage(input: WebUiRecordedCaseAutoRematchMessageInput) {
  const matchedCount = Math.max(Number(input.matchedCount || 0), 0)
  const savedCount = Math.max(Number(input.savedCount || 0), 0)
  const skippedCount = Math.max(Number(input.skippedCount || 0), 0)
  const collectTaskText = input.collectTaskId ? `，来源采集任务 #${input.collectTaskId}` : ''
  const saveText = savedCount || skippedCount
    ? `，候选入库新增 ${savedCount} 个${skippedCount ? `、跳过 ${skippedCount} 个` : ''}`
    : ''
  if (input.persisted) {
    return `已自动回填 ${matchedCount} 个元素库绑定并保存用例${saveText}${collectTaskText}`
  }
  return `已自动回填 ${matchedCount} 个元素库绑定${saveText}${collectTaskText}，保存用例后生效`
}

export function buildCollectCandidateValidationSummary(
  candidates: Pick<
    WebUiElementCollectCandidate,
    'recommendedToSave' | 'validationStatus' | 'confidence' | 'candidateSource' | 'saveBlockedReason'
  >[],
): WebUiCollectCandidateValidationSummary {
  const total = candidates.length
  const passed = candidates.filter(item => item.validationStatus === 'PASSED').length
  const failed = candidates.filter(item => item.validationStatus === 'FAILED').length
  const multiple = candidates.filter(item => item.validationStatus === 'MULTIPLE').length
  const unverified = candidates.filter(item => (
    item.validationStatus === 'UNVERIFIED'
    || item.validationStatus === 'AI_UNVERIFIED'
    || item.validationStatus === 'SKIPPED'
    || !item.validationStatus
  )).length

  return {
    total,
    recommended: candidates.filter(item => item.recommendedToSave && !item.saveBlockedReason).length,
    passed,
    failed,
    multiple,
    unverified,
    abnormal: failed + multiple,
    lowConfidence: candidates.filter(item => Number(item.confidence || 0) < 70).length,
    aiEnhanced: candidates.filter(item =>
      item.candidateSource !== 'AI_SUPPLEMENT'
      && Boolean('businessMeaning' in item && item.businessMeaning),
    ).length,
    aiSupplement: candidates.filter(item => item.candidateSource === 'AI_SUPPLEMENT').length,
    blocked: candidates.filter(item => Boolean(item.saveBlockedReason)).length,
  }
}

export function buildCollectCandidateSaveSummary(
  selectedCandidates: CandidateSaveShape[],
  existingElements: ExistingElementShape[] = [],
): WebUiCollectCandidateSaveSummary {
  const seenNameKeys = new Set<string>()
  const seenLocatorKeys = new Set<string>()
  for (const item of existingElements) {
    seenNameKeys.add(`${item.groupName || ''}::${item.elementName}`)
    seenLocatorKeys.add(`${item.locatorType}::${item.locatorValue}`)
  }

  let duplicateCount = 0
  let blockedCount = 0
  let failedCount = 0
  let multipleCount = 0
  let unverifiedCount = 0
  let lowConfidenceCount = 0
  let aiSupplementCount = 0
  let aiSupplementUnlockedCount = 0
  let aiSupplementUnverifiedCount = 0
  let saveableCount = 0

  for (const candidate of selectedCandidates) {
    const groupName = (candidate.groupName || '').trim()
    const elementName = (candidate.elementName || '').trim()
    const locatorValue = (candidate.locatorValue || '').trim()
    const nameKey = `${groupName}::${elementName}`
    const locatorKey = `${candidate.locatorType}::${locatorValue}`
    const isAiSupplement = candidate.candidateSource === 'AI_SUPPLEMENT'
    const blocked = Boolean(candidate.saveBlockedReason)
    const unverified = candidate.validationStatus === 'UNVERIFIED'
      || candidate.validationStatus === 'AI_UNVERIFIED'
      || candidate.validationStatus === 'SKIPPED'
      || !candidate.validationStatus

    if (isAiSupplement) {
      aiSupplementCount += 1
      if (candidate.validationStatus === 'PASSED' && !blocked) {
        aiSupplementUnlockedCount += 1
      }
      if (unverified) {
        aiSupplementUnverifiedCount += 1
      }
    }
    if (candidate.validationStatus === 'FAILED') failedCount += 1
    if (candidate.validationStatus === 'MULTIPLE') multipleCount += 1
    if (unverified) unverifiedCount += 1
    if (Number(candidate.confidence || 0) < 70) lowConfidenceCount += 1
    if (blocked) blockedCount += 1

    const duplicated = seenNameKeys.has(nameKey) || seenLocatorKeys.has(locatorKey)
    if (duplicated) {
      duplicateCount += 1
    } else {
      seenNameKeys.add(nameKey)
      seenLocatorKeys.add(locatorKey)
    }
    if (!blocked && !duplicated) {
      saveableCount += 1
    }
  }

  const selectedCount = selectedCandidates.length
  const createCount = saveableCount
  const skippedCount = Math.max(selectedCount - createCount, 0)
  return {
    selectedCount,
    saveableCount,
    createCount,
    skippedCount,
    duplicateCount,
    blockedCount,
    aiSupplementCount,
    aiSupplementUnlockedCount,
    aiSupplementUnverifiedCount,
    failedCount,
    multipleCount,
    unverifiedCount,
    lowConfidenceCount,
    abnormalCount: failedCount + multipleCount + lowConfidenceCount,
  }
}

export function isCollectCandidateUnverified(candidate: Pick<WebUiElementCollectCandidate, 'validationStatus'>): boolean {
  return candidate.validationStatus === 'UNVERIFIED'
    || candidate.validationStatus === 'AI_UNVERIFIED'
    || candidate.validationStatus === 'SKIPPED'
    || !candidate.validationStatus
}

export function isCollectCandidateSaveable(candidate: CandidateFilterShape): boolean {
  return candidate.recommendedToSave
    && (candidate.validationStatus === 'PASSED' || candidate.validationStatus === 'UNVERIFIED')
    && !candidate.saveBlockedReason
}

export function shouldShowCollectCandidateForFilter(
  candidate: CandidateFilterShape,
  filter: WebUiCollectCandidateFilter,
): boolean {
  if (filter === 'ALL') return true
  if (filter === 'RECOMMENDED') return isCollectCandidateSaveable(candidate)
  if (filter === 'PASSED') return candidate.validationStatus === 'PASSED'
  if (filter === 'FAILED') return candidate.validationStatus === 'FAILED'
  if (filter === 'MULTIPLE') return candidate.validationStatus === 'MULTIPLE'
  if (filter === 'UNVERIFIED') return isCollectCandidateUnverified(candidate)
  if (filter === 'LOW_CONFIDENCE') return Number(candidate.confidence || 0) < 70
  if (filter === 'BLOCKED') return Boolean(candidate.saveBlockedReason)
  if (filter === 'AI_SUPPLEMENT') return candidate.candidateSource === 'AI_SUPPLEMENT'
  if (filter === 'AI_UNVERIFIED') {
    return candidate.candidateSource === 'AI_SUPPLEMENT'
      && candidate.validationStatus === 'AI_UNVERIFIED'
  }
  return true
}

export function buildCollectCandidateValidationLocators(candidates: CandidateLocatorShape[]) {
  const seen = new Set<string>()
  return candidates.reduce<CandidateLocatorShape[]>((result, candidate) => {
    const locatorValue = candidate.locatorValue?.trim()
    if (!locatorValue) return result
    const framePath = normalizeLocatorContextPath(candidate.framePath)
    const shadowPath = normalizeLocatorContextPath(candidate.shadowPath)
    const key = `${candidate.locatorType}::${locatorValue}::${JSON.stringify(framePath)}::${JSON.stringify(shadowPath)}`
    if (seen.has(key)) return result
    seen.add(key)
    result.push({
      locatorType: candidate.locatorType,
      locatorValue,
      ...(framePath.length > 0 ? { framePath } : {}),
      ...(shadowPath.length > 0 ? { shadowPath } : {}),
    })
    return result
  }, [])
}

function normalizeLocatorContextPath(value: CandidateLocatorShape['framePath']) {
  return Array.isArray(value) ? value : []
}

export function formatCollectFilterReason(reason?: string | null) {
  if (reason === 'EMPTY_LOCATOR') return '空定位'
  if (reason === 'DUPLICATE_LOCATOR') return '重复定位'
  if (reason === 'LOW_STABILITY') return '低稳定性'
  if (reason === 'FINAL_CANDIDATE') return '最终候选'
  if (reason === 'AI_METADATA_ENHANCE') return 'AI 增强'
  return reason || '未知'
}

export function normalizeElementCollectCandidate(item: WebUiElementCollectCandidate): WebUiElementCollectCandidate {
  return {
    ...item,
    groupName: item.groupName || '页面元素',
    elementName: item.elementName || '未命名元素',
    locatorType: item.locatorType || 'CSS',
    locatorValue: item.locatorValue || '',
    confidence: Number(item.confidence || 0),
    reason: item.reason || '',
    tagName: item.tagName || null,
    elementType: item.elementType || null,
    text: item.text || null,
    placeholder: item.placeholder || null,
    ariaLabel: item.ariaLabel || null,
    labelText: item.labelText || null,
    nearbyHeading: item.nearbyHeading || null,
    businessMeaning: item.businessMeaning || null,
    candidateSource: item.candidateSource || 'RULE',
    recommendedToSave: item.recommendedToSave !== false,
    notRecommendedReason: item.notRecommendedReason || null,
    maintenanceSuggestion: item.maintenanceSuggestion || null,
    stabilityNote: item.stabilityNote || null,
    validationStatus: item.validationStatus || 'SKIPPED',
    matchCount: item.matchCount === null || item.matchCount === undefined ? null : Number(item.matchCount),
    validationMessage: item.validationMessage || null,
    screenshotBase64: item.screenshotBase64 || null,
    saveBlockedReason: item.saveBlockedReason || null,
  }
}

export function normalizeElementCollectTaskResponse(item: WebUiElementCollectTaskResponse): WebUiElementCollectTaskResponse {
  const filterSummary = item.filterSummary
    ? {
        originalCount: Number(item.filterSummary.originalCount || 0),
        emptyLocatorCount: Number(item.filterSummary.emptyLocatorCount || 0),
        duplicateCount: Number(item.filterSummary.duplicateCount || 0),
        lowStabilityCount: Number(item.filterSummary.lowStabilityCount || 0),
        finalCount: Number(item.filterSummary.finalCount || 0),
      }
    : null
  return {
    taskId: Number(item.taskId),
    status: item.status || 'COMPLETED',
    currentStage: item.currentStage || deriveCollectCurrentStage(item.status),
    progressPercent: Number(item.progressPercent ?? deriveCollectProgressPercent(item.status)),
    source: item.source || 'LOCAL_RUNNER_STATIC',
    runnerId: item.runnerId || null,
    sessionId: item.sessionId || null,
    actualUrl: item.actualUrl || null,
    pageTitle: item.pageTitle || null,
    aiModelConfigId: item.aiModelConfigId === null || item.aiModelConfigId === undefined ? null : Number(item.aiModelConfigId),
    aiModelName: item.aiModelName || null,
    rawCount: Number(item.rawCount || 0),
    finalCount: Number(item.finalCount || 0),
    globalScreenshotBase64: item.globalScreenshotBase64 || null,
    filterSummary,
    filterLogs: Array.isArray(item.filterLogs)
      ? item.filterLogs.map(log => ({
          stage: log.stage || 'STATIC_RULE',
          reason: log.reason || 'UNKNOWN',
          count: Number(log.count || 0),
          message: log.message || null,
        }))
      : [],
    candidates: Array.isArray(item.candidates) ? item.candidates.map(normalizeElementCollectCandidate) : [],
    message: item.message || null,
    createdAt: item.createdAt || null,
    completedAt: item.completedAt || null,
  }
}

export function buildCollectTaskStages(task: WebUiElementCollectTaskResponse | null): WebUiCollectTaskStage[] {
  const status = task?.status || 'PENDING'
  const failed = status === 'FAILED'
  const canceled = status === 'CANCELED'
  const degraded = status === 'DEGRADED'
  const currentStage = task?.currentStage || deriveCollectCurrentStage(status)
  const rawCount = Number(task?.rawCount || task?.filterSummary?.originalCount || 0)
  const finalCount = Number(task?.finalCount || task?.filterSummary?.finalCount || 0)
  const stageOrder: WebUiCollectTaskStageKey[] = ['UPLOAD_SNAPSHOT', 'RULE_CLEAN', 'AI_ANALYZE', 'LOCAL_VALIDATE', 'FINALIZE']
  const currentIndex = stageOrder.indexOf(currentStage as WebUiCollectTaskStageKey)
  const resolveStageStatus = (key: WebUiCollectTaskStageKey): WebUiCollectTaskStageStatus => {
    if (failed || canceled) return key === currentStage ? 'failed' : 'pending'
    if (degraded && key === 'LOCAL_VALIDATE') return 'degraded'
    if (status === 'COMPLETED') return 'done'
    if (degraded && key === 'FINALIZE') return 'done'
    const index = stageOrder.indexOf(key)
    if (currentIndex >= 0 && index >= 0) {
      if (index < currentIndex) return 'done'
      if (index === currentIndex) return 'running'
    }
    return 'pending'
  }
  return [
    {
      key: 'UPLOAD_SNAPSHOT',
      title: '上传快照',
      status: resolveStageStatus('UPLOAD_SNAPSHOT'),
      description: task?.actualUrl || '等待本地 Runner 读取页面素材',
    },
    {
      key: 'RULE_CLEAN',
      title: '规则清洗',
      status: resolveStageStatus('RULE_CLEAN'),
      description: buildRuleCleanStageDescription(task, status, rawCount, finalCount),
    },
    {
      key: 'AI_ANALYZE',
      title: 'AI 分析',
      status: resolveStageStatus('AI_ANALYZE'),
      description: collectAiStageDescription(task),
    },
    {
      key: 'LOCAL_VALIDATE',
      title: '本地验证',
      status: resolveStageStatus('LOCAL_VALIDATE'),
      description: degraded
        ? task?.message || '本地 Runner 不可用，已保留为未验证候选'
        : status === 'WAITING_LOCAL_VALIDATION'
          ? `等待本地页面验证 ${finalCount || task?.candidates.length || 0} 个定位器`
          : status === 'VALIDATING'
            ? `正在本地页面验证 ${finalCount || task?.candidates.length || 0} 个定位器`
            : status === 'COMPLETED'
              ? '本地页面验证完成'
              : '本地页面验证已接入',
    },
    {
      key: 'FINALIZE',
      title: '生成候选',
      status: resolveStageStatus('FINALIZE'),
      description: task?.finalCount === undefined ? '等待候选生成' : `最终候选 ${finalCount}`,
    },
  ]
}

function buildRuleCleanStageDescription(
  task: WebUiElementCollectTaskResponse | null,
  status: string,
  rawCount: number,
  finalCount: number,
) {
  if (!task) return '等待后端规则过滤、去重和评分'
  if (status === 'UPLOADED') {
    return rawCount ? `快照已上传，等待清洗 ${rawCount} 个原始候选` : '快照已上传，等待后端开始规则清洗'
  }
  if (status === 'RULE_CLEANING' || status === 'PROCESSING') {
    return rawCount ? `正在清洗 ${rawCount} 个原始候选` : '正在执行规则过滤、去重和评分'
  }
  if (task.filterSummary && finalCount > 0) {
    return `原始 ${task.filterSummary.originalCount}，保留 ${finalCount}`
  }
  if (rawCount > 0 && finalCount === 0 && status !== 'AI_ANALYZING' && status !== 'WAITING_LOCAL_VALIDATION' && status !== 'VALIDATING' && status !== 'COMPLETED') {
    return `已收到 ${rawCount} 个原始候选，等待生成最终候选`
  }
  return task.filterSummary
    ? `原始 ${task.filterSummary.originalCount}，等待最终候选生成`
    : '等待后端规则过滤、去重和评分'
}

function collectAiStageDescription(task: WebUiElementCollectTaskResponse | null) {
  if (!task) return '等待 AI 命名、分组和说明增强'
  const prefix = task.aiModelName ? `${task.aiModelName}：` : ''
  if (task.message && task.aiModelName) return `${prefix}${task.message}`
  if (task.message && /AI|ai/.test(task.message)) return task.message
  if (task.aiModelName) return `${prefix}已接入 AI 命名、分组和说明增强`
  return '未选择 AI 模型，已保留规则候选'
}

export function isCollectTaskTerminalStatus(status?: string | null) {
  return status === 'COMPLETED'
    || status === 'FAILED'
    || status === 'DEGRADED'
    || status === 'CANCELED'
}

function deriveCollectCurrentStage(status?: string | null) {
  if (status === 'FAILED') return 'FAILED'
  if (status === 'CANCELED') return 'LOCAL_VALIDATE'
  if (status === 'DEGRADED') return 'LOCAL_VALIDATE'
  if (status === 'WAITING_LOCAL_VALIDATION' || status === 'VALIDATING') return 'LOCAL_VALIDATE'
  if (status === 'AI_ANALYZING') return 'AI_ANALYZE'
  if (status === 'RULE_CLEANING' || status === 'PROCESSING') return 'RULE_CLEAN'
  if (status === 'UPLOADED' || status === 'PENDING') return 'UPLOAD_SNAPSHOT'
  return 'FINALIZE'
}

function deriveCollectProgressPercent(status?: string | null) {
  if (status === 'FAILED') return 100
  if (status === 'CANCELED') return 100
  if (status === 'DEGRADED') return 80
  if (status === 'WAITING_LOCAL_VALIDATION' || status === 'VALIDATING') return 75
  if (status === 'AI_ANALYZING') return 55
  if (status === 'RULE_CLEANING' || status === 'PROCESSING') return 40
  if (status === 'UPLOADED' || status === 'PENDING') return 10
  return 100
}
