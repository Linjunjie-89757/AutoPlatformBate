import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectGroupStrategy,
  WebUiElementCollectScope,
  WebUiElementCollectLocatorCandidate,
  WebUiLocatorType,
} from '@/entities/web-ui-automation'

export type WebUiElementCollectMode = 'ONLINE' | 'OFFLINE'

export interface WebUiElementCollectLaunchForm {
  providerConnectionId: number | null
  environmentId: number | null
  pageUrl: string
  moduleId: number | null
  pageId: number | null
  pageName: string
  groupStrategy: WebUiElementCollectGroupStrategy
  groupId: number | null
  groupName: string
  scope: WebUiElementCollectScope
}

export interface WebUiElementCollectCandidateView extends WebUiElementCollectCandidate {
  id: string
  selected: boolean
  sourceIndex: number
  markedInvalid: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  locatorCandidates: WebUiElementCollectLocatorCandidate[]
  confidence: number
  reason: string
  candidateSource: string
  validationStatus: string
  saveBlockedReason: string | null
}

export function mapCollectCandidatesToViews(
  candidates: WebUiElementCollectCandidate[],
  options: {
    groupStrategy?: WebUiElementCollectGroupStrategy
    customGroupName?: string
    idPrefix?: string
  } = {},
): WebUiElementCollectCandidateView[] {
  const idPrefix = options.idPrefix || ''
  return candidates.map((item, index) => ({
    ...item,
    id: `${idPrefix}${item.locatorType}-${index}-${item.locatorValue}`,
    sourceIndex: index,
    markedInvalid: false,
    selected: item.recommendedToSave
      && (item.validationStatus === 'PASSED' || item.validationStatus === 'UNVERIFIED')
      && !item.saveBlockedReason,
    groupName: options.groupStrategy === 'CUSTOM' ? (options.customGroupName || item.groupName) : item.groupName,
    elementName: item.elementName,
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    locatorCandidates: normalizeLocatorCandidates(item),
    confidence: Number(item.confidence || 0),
    reason: item.reason || '',
    candidateSource: item.candidateSource || 'RULE',
    validationStatus: item.validationStatus || 'UNVERIFIED',
    saveBlockedReason: item.saveBlockedReason || null,
  }))
}

function normalizeLocatorCandidates(item: WebUiElementCollectCandidate): WebUiElementCollectLocatorCandidate[] {
  const result: WebUiElementCollectLocatorCandidate[] = []
  const seen = new Set<string>()
  const push = (candidate?: Partial<WebUiElementCollectLocatorCandidate> | null) => {
    const locatorType = candidate?.locatorType || item.locatorType
    const locatorValue = candidate?.locatorValue || ''
    const trimmedValue = locatorValue.trim()
    if (!trimmedValue) {
      return
    }
    const key = `${locatorType}::${trimmedValue}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push({
      locatorType,
      locatorValue: trimmedValue,
      framePath: candidate?.framePath || item.framePath || null,
      shadowPath: candidate?.shadowPath || item.shadowPath || null,
      confidence: candidate?.confidence ?? item.confidence,
      reason: candidate?.reason || '主定位器',
    })
  }
  push({
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    framePath: item.framePath,
    shadowPath: item.shadowPath,
    confidence: item.confidence,
    reason: '主定位器',
  })
  for (const candidate of item.locatorCandidates || []) {
    push(candidate)
  }
  return result
}
