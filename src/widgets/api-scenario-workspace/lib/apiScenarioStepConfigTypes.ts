import type {
  ApiAutomationEnvironmentItem,
  ApiAutomationVariableSetItem,
  ApiDefinitionCaseDetail,
  ApiDefinitionDetail,
  ApiKeyValueInput,
  ApiRequestConfigInput,
  ApiRunStepResult,
  ApiScenarioDetail,
  ApiScenarioStep,
} from '@/entities/api-automation'
import type { DbConnectionItem } from '@/entities/config'
import type { ScenarioBodyType } from './apiScenarioStepRequestUtils'

export interface ScenarioStepTabOption {
  label: string
  value: ScenarioBodyType
}

export interface ScenarioReferenceOption {
  label: string
  value: number | string
}

export interface ScenarioSelectionState {
  checked: boolean
  indeterminate: boolean
}

export interface ScenarioAssertionPresentation {
  visible: boolean
  tone: string
  label: string
}

export type ScenarioCodeLanguage = 'api-console' | 'javascript' | 'json' | 'sql' | 'text' | 'xml'
export type ScenarioResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
export type ScenarioStepSystemDetail = ApiDefinitionDetail | ApiDefinitionCaseDetail | null
export type ScenarioDirtyHandler = () => void
export type ScenarioVoidHandler = () => void | Promise<void>
export type ScenarioLabelFormatter = (value?: string | null) => string
export type ScenarioUnknownValueGetter = (row: unknown, key: string) => unknown
export type ScenarioUnknownTextFormatter = (value: unknown) => string
export type ScenarioRowsFilter = (rows?: ApiKeyValueInput[] | null) => ApiKeyValueInput[]
export type ScenarioMethodClassFormatter = (method?: string | null) => string
export type ScenarioStepPredicate = (step?: ApiScenarioStep | null) => boolean
export type ScenarioStepTitleFormatter = (type?: ApiScenarioStep['stepType'] | null) => string
export type ScenarioTableSelectionGetter = (rows: ApiKeyValueInput[]) => ScenarioSelectionState
export type ScenarioKeyValueDefaults = () => Partial<ApiKeyValueInput>
export type ScenarioKeyValueInputHandler = (rows: ApiKeyValueInput[], defaults?: Partial<ApiKeyValueInput>) => void
export type ScenarioKeyValueRowHandler = (rows: ApiKeyValueInput[], index: number) => void
export type ScenarioKeyValueRowAddHandler = (rows: ApiKeyValueInput[], defaults?: Partial<ApiKeyValueInput>) => void
export type ScenarioBodyModeSetter = (mode: ScenarioBodyType) => void
export type ScenarioRawBodyPredicate = (type?: string | null) => boolean
export type ScenarioBodyParamTypeOptionsGetter = () => readonly string[] | string[]
export type ScenarioBodyFormFilePicker = (row: ApiKeyValueInput, rows: ApiKeyValueInput[]) => void | Promise<void>
export type ScenarioBodyFormFileFormatter = (row: ApiKeyValueInput) => string

export interface ApiScenarioStepConfigDrawerProps {
  activeScenarioStep: ApiScenarioStep | null
  scenarioStepConfigOrder: string | number | null
  scenarioStepTypeClass: (type?: ApiScenarioStep['stepType'] | null) => string
  scenarioStepTypeBadgeLabel: (step: ApiScenarioStep) => string
  scenarioStepConfigTitle: string
  scenarioStepNameEditingId: string | null
  closeScenarioStepConfig: ScenarioVoidHandler
  startScenarioStepNameEdit: (step: ApiScenarioStep) => void
  finishScenarioStepNameEdit: (step: ApiScenarioStep) => void
  isScenarioStepCopyRequest: ScenarioStepPredicate
  scenarioStepSystemDetailLoading: boolean
  scenarioStepSystemDetail: ScenarioStepSystemDetail
  scenarioStepSystemConfig: ApiRequestConfigInput
  requestMethodClass: ScenarioMethodClassFormatter
  debugScenarioStepSystemRequest: ScenarioVoidHandler
  scenarioStepSystemDebugLoading: boolean
  scenarioStepSystemCanDebug: boolean
  scenarioStepSystemQueryEnabledCount: number
  enabledScenarioRows: ScenarioRowsFilter
  scenarioStepSystemBodyText: string
  scenarioStepSystemBodyLanguage: ScenarioCodeLanguage
  scenarioStepSystemAssertionEnabledCount: number
  scenarioUnknownText: ScenarioUnknownTextFormatter
  scenarioUnknownValue: ScenarioUnknownValueGetter
  assertionTypeLabel: ScenarioLabelFormatter
  scenarioStepSystemShowResponseEmptyState: boolean
  scenarioStepSystemAssertionResultPresentation: ScenarioAssertionPresentation
  scenarioStepSystemResponseStatusTone: string
  scenarioStepSystemResponseStatusCode: number | null
  scenarioStepSystemResponseDuration: number | null
  scenarioStepSystemResponseSize: string
  scenarioStepSystemDebugMessage: string
  scenarioStepSystemResponseBodyPretty: string
  scenarioStepSystemResponseBodyLanguage: ScenarioCodeLanguage
  scenarioStepSystemResponseHeaders: string
  scenarioStepSystemConsole: string
  scenarioStepSystemActualRequest: string
  scenarioStepSystemAssertionResults: ApiRunStepResult['assertionResults']
  assertionConditionLabel: ScenarioLabelFormatter
  assertionResultClass: (success?: boolean | null) => string
  assertionResultLabel: (success?: boolean | null) => string
  scenarioStepTypeTitle: ScenarioStepTitleFormatter
  markScenarioDirty: ScenarioDirtyHandler
  scenarioReferenceOptions: ScenarioReferenceOption[]
  isScenarioStepEditableRequest: ScenarioStepPredicate
  activeScenarioStepRequestConfig: ApiRequestConfigInput
  requestMethodOptions: string[]
  scenarioStepCustomDebugLoading: boolean
  scenarioStepCustomCanDebug: boolean
  debugScenarioStepCustomRequest: ScenarioVoidHandler
  scenarioStepCustomQueryEnabledCount: number
  scenarioStepCustomAssertionEnabledCount: number
  scenarioTableSelectionState: ScenarioTableSelectionGetter
  handleScenarioKeyValueRowInput: ScenarioKeyValueInputHandler
  scenarioHeaderParamDefaults: ScenarioKeyValueDefaults
  removeScenarioKeyValueRow: ScenarioKeyValueRowHandler
  addScenarioKeyValueRow: ScenarioKeyValueRowAddHandler
  scenarioQueryParamDefaults: ScenarioKeyValueDefaults
  scenarioQueryParamTypeOptions: readonly string[] | string[]
  scenarioStepBodyModes: ScenarioStepTabOption[]
  setScenarioStepBodyMode: ScenarioBodyModeSetter
  isScenarioRawBody: ScenarioRawBodyPredicate
  scenarioStepBodyLanguage: ScenarioCodeLanguage
  scenarioBodyFormParamDefaults: ScenarioKeyValueDefaults
  scenarioBodyParamTypeOptions: ScenarioBodyParamTypeOptionsGetter
  pickScenarioBodyFormRowFile: ScenarioBodyFormFilePicker
  formatScenarioBodyFormFileSize: ScenarioBodyFormFileFormatter
  clearScenarioBodyFormRowFile: (row: ApiKeyValueInput) => void
  scenarioStepCustomLatestResponseBody: string
  scenarioStepCustomShowResponseEmptyState: boolean
  scenarioStepCustomAssertionResultPresentation: ScenarioAssertionPresentation
  scenarioStepCustomResponseStatusTone: string
  scenarioStepCustomResponseStatusCode: number | null
  scenarioStepCustomResponseDuration: number | null
  scenarioStepCustomResponseSize: string
  scenarioStepCustomDebugMessage: string
  scenarioStepCustomResponseBodyPretty: string
  scenarioStepCustomResponseBodyLanguage: ScenarioCodeLanguage
  scenarioStepCustomResponseHeaders: string
  scenarioStepCustomConsole: string
  scenarioStepCustomActualRequest: string
  scenarioStepCustomAssertionResults: ApiRunStepResult['assertionResults']
  scenarioStepScriptAssertionEnabledCount: number
  formatScenarioStepScriptContent: ScenarioVoidHandler
  scenarioStepScriptLatestResponseBody: string
  dbConnections: DbConnectionItem[]
  environments?: ApiAutomationEnvironmentItem[]
  variableSets?: ApiAutomationVariableSetItem[]
  activeScenarioDetail: ApiScenarioDetail
  showScenarioStepConfigFooter: boolean
  cancelScenarioStepConfig: ScenarioVoidHandler
  scenarioStepConfigMode: 'create' | 'edit' | string
  saveScenarioStepConfig: (continueAdding?: boolean) => void | Promise<void>
}

export type ApiScenarioSystemStepConfigPanelProps = Pick<
  ApiScenarioStepConfigDrawerProps,
  | 'scenarioStepSystemDetailLoading'
  | 'scenarioStepSystemDetail'
  | 'scenarioStepSystemConfig'
  | 'requestMethodClass'
  | 'debugScenarioStepSystemRequest'
  | 'scenarioStepSystemDebugLoading'
  | 'scenarioStepSystemCanDebug'
  | 'scenarioStepSystemQueryEnabledCount'
  | 'enabledScenarioRows'
  | 'scenarioStepSystemBodyText'
  | 'scenarioStepSystemBodyLanguage'
  | 'scenarioStepSystemAssertionEnabledCount'
  | 'scenarioUnknownText'
  | 'scenarioUnknownValue'
  | 'assertionTypeLabel'
  | 'scenarioStepSystemShowResponseEmptyState'
  | 'scenarioStepSystemAssertionResultPresentation'
  | 'scenarioStepSystemResponseStatusTone'
  | 'scenarioStepSystemResponseStatusCode'
  | 'scenarioStepSystemResponseDuration'
  | 'scenarioStepSystemResponseSize'
  | 'scenarioStepSystemDebugMessage'
  | 'scenarioStepSystemResponseBodyPretty'
  | 'scenarioStepSystemResponseBodyLanguage'
  | 'scenarioStepSystemResponseHeaders'
  | 'scenarioStepSystemConsole'
  | 'scenarioStepSystemActualRequest'
  | 'scenarioStepSystemAssertionResults'
  | 'assertionConditionLabel'
  | 'assertionResultClass'
  | 'assertionResultLabel'
>

export type ApiScenarioCustomStepConfigPanelProps = Pick<
  ApiScenarioStepConfigDrawerProps,
  | 'activeScenarioStepRequestConfig'
  | 'requestMethodOptions'
  | 'requestMethodClass'
  | 'markScenarioDirty'
  | 'scenarioStepCustomDebugLoading'
  | 'scenarioStepCustomCanDebug'
  | 'debugScenarioStepCustomRequest'
  | 'scenarioStepCustomQueryEnabledCount'
  | 'scenarioStepCustomAssertionEnabledCount'
  | 'scenarioTableSelectionState'
  | 'handleScenarioKeyValueRowInput'
  | 'scenarioHeaderParamDefaults'
  | 'removeScenarioKeyValueRow'
  | 'addScenarioKeyValueRow'
  | 'scenarioQueryParamDefaults'
  | 'scenarioQueryParamTypeOptions'
  | 'scenarioStepBodyModes'
  | 'setScenarioStepBodyMode'
  | 'isScenarioRawBody'
  | 'scenarioStepBodyLanguage'
  | 'scenarioBodyFormParamDefaults'
  | 'scenarioBodyParamTypeOptions'
  | 'pickScenarioBodyFormRowFile'
  | 'clearScenarioBodyFormRowFile'
  | 'formatScenarioBodyFormFileSize'
  | 'dbConnections'
  | 'scenarioStepCustomLatestResponseBody'
  | 'scenarioStepCustomShowResponseEmptyState'
  | 'scenarioStepCustomAssertionResultPresentation'
  | 'scenarioStepCustomResponseStatusTone'
  | 'scenarioStepCustomResponseStatusCode'
  | 'scenarioStepCustomResponseDuration'
  | 'scenarioStepCustomResponseSize'
  | 'scenarioStepCustomDebugMessage'
  | 'scenarioStepCustomResponseBodyPretty'
  | 'scenarioStepCustomResponseBodyLanguage'
  | 'scenarioStepCustomResponseHeaders'
  | 'scenarioStepCustomConsole'
  | 'scenarioStepCustomActualRequest'
  | 'scenarioStepCustomAssertionResults'
  | 'assertionTypeLabel'
  | 'assertionConditionLabel'
  | 'assertionResultClass'
  | 'assertionResultLabel'
> & {
  environmentName: () => string
  variableSetName: () => string
}

export type ApiScenarioScriptStepConfigPanelProps = Pick<
  ApiScenarioStepConfigDrawerProps,
  | 'scenarioStepScriptAssertionEnabledCount'
  | 'formatScenarioStepScriptContent'
  | 'scenarioStepScriptLatestResponseBody'
  | 'markScenarioDirty'
> & {
  activeScenarioStep: ApiScenarioStep
}

export interface ApiScenarioControllerStepConfigPanelProps {
  activeScenarioStep: ApiScenarioStep
  markScenarioDirty: ScenarioDirtyHandler
}

export interface ApiScenarioStepResponsePanelProps {
  shellClass?: string
  showEmptyState: boolean
  assertionPresentation: ScenarioAssertionPresentation
  statusTone: string
  statusCode: number | null
  duration: number | null
  responseSize: string
  debugMessage: string
  bodyText: string
  bodyLanguage: ScenarioCodeLanguage
  headersText: string
  consoleText: string
  actualRequestText: string
  assertionResults: ApiRunStepResult['assertionResults']
  assertionTypeLabel: ScenarioLabelFormatter
  assertionConditionLabel: ScenarioLabelFormatter
  assertionResultClass: (success?: boolean | null) => string
  assertionResultLabel: (success?: boolean | null) => string
  showAssertionTypeColumn?: boolean
}

export interface ApiScenarioKeyValueGridProps {
  variant: 'header' | 'query'
  rows: ApiKeyValueInput[]
  selectionState: ScenarioSelectionState
  defaults: Partial<ApiKeyValueInput>
  paramTypeOptions?: readonly string[] | string[]
  markScenarioDirty: ScenarioDirtyHandler
  handleScenarioKeyValueRowInput: ScenarioKeyValueInputHandler
  removeScenarioKeyValueRow: ScenarioKeyValueRowHandler
  addScenarioKeyValueRow: ScenarioKeyValueRowAddHandler
}

export interface ApiScenarioBodyFormGridProps {
  rows: ApiKeyValueInput[]
  selectionState: ScenarioSelectionState
  defaults: Partial<ApiKeyValueInput>
  paramTypeOptions: readonly string[] | string[]
  markScenarioDirty: ScenarioDirtyHandler
  handleScenarioKeyValueRowInput: ScenarioKeyValueInputHandler
  removeScenarioKeyValueRow: ScenarioKeyValueRowHandler
  addScenarioKeyValueRow: ScenarioKeyValueRowAddHandler
  pickScenarioBodyFormRowFile: ScenarioBodyFormFilePicker
  clearScenarioBodyFormRowFile: (row: ApiKeyValueInput) => void
  formatScenarioBodyFormFileSize: ScenarioBodyFormFileFormatter
}
