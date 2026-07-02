<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Fold,
  MoreFilled,
  Plus,
  Search,
} from '@element-plus/icons-vue'
import {
  Check as LucideCheck,
  FileJson as LucideFileJson,
  FileText as LucideFileText,
  Link as LucideLink,
  Upload as LucideUpload,
  X as LucideX,
} from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  apiAutomationApi,
  type ApiAiCaseGenerationEvent,
  type ApiAiCaseGenerationOptionPayload,
  type ApiAiGeneratedCaseDraft,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationReportAnalysis,
  type ApiAutomationReportDetail,
  type ApiAutomationReportItem,
  type ApiAutomationReportStatistics,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiKeyValueInput,
  type ApiRequestBodyInput,
  type ApiRequestConfigInput,
  type ApiRunHistoryDetail,
  type ApiRunHistoryItem,
  type ApiRunResult,
  type ApiRunStepResult,
  type ApiRuntimeContextSnapshot,
  type ApiSchemaFieldInput,
  type SaveApiDefinitionCasePayload,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import {
  buildLocalRunnerContextRows,
} from '@/entities/api-automation/lib/reportEvidence'
import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  configApi,
  getEnvServiceDetails,
  getParamDescriptionText,
  getParamValueText,
  type EnvConfigItem,
  type MockApplicationItem,
  type MockBusinessScenarioItem,
  type ParamSetItem,
} from '@/entities/config'
import type { WorkspaceItem } from '@/entities/workspace'
import ApiCaseCreateEditDialog from '@/features/api-case-create-edit/ApiCaseCreateEditDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import { ApiExecutionWorkspace } from '@/widgets/api-execution-workspace'
import { ApiScenarioWorkspace } from '@/widgets/api-scenario-workspace'
import ApiRunStepDetailViewer from '@/widgets/api-scenario-workspace/ApiRunStepDetailViewer.vue'
import ApiAiGenerationDrawer from './ApiAiGenerationDrawer.vue'
import ApiAiGenerationWorkspace from './ApiAiGenerationWorkspace.vue'
import ApiAssertionPanel from './ApiAssertionPanel.vue'
import ApiCodeEditor from './ApiCodeEditor.vue'
import ApiCaseDetailDrawer from './ApiCaseDetailDrawer.vue'
import ApiCaseListPanel from './ApiCaseListPanel.vue'
import ApiDefinitionPanel from './ApiDefinitionPanel.vue'
import ApiDefinitionSaveDialog from './ApiDefinitionSaveDialog.vue'
import ApiDirectoryTree from './ApiDirectoryTree.vue'
import ApiExtractorPanel from './ApiExtractorPanel.vue'
import ApiFastExtractionDrawer from './ApiFastExtractionDrawer.vue'
import ApiKeyValueTable from './ApiKeyValueTable.vue'
import ApiProcessorPanel from './ApiProcessorPanel.vue'
import ApiRequestBodyPanel from './ApiRequestBodyPanel.vue'
import ApiRequestContentTabs from './ApiRequestContentTabs.vue'
import ApiRequestToolbar from './ApiRequestToolbar.vue'
import ApiResponsePanel from './ApiResponsePanel.vue'
import type { AiCaseGenerationTabState, ApiAiCaseResultFilter, ApiAiGeneratedCaseResult, ApiBodyLanguage, ApiRequestContentTabItem, BodyJsonViewMode, BodyType, DefinitionSchemaViewMode, RawBodyType, RequestContentTab, ResponseTab } from './apiInterfaceTypes'
import type { FastExtractionConfig, FastExtractionMode, FastExtractionResponseFormat } from './fastExtraction'
import {
  buildApiDirectoryTree,
  canLoadDefinitionsForDirectoryNode,
  collectCollapsedDirectoryKeys,
  collectExpandableDirectoryKeys,
  definitionModuleLoadKey,
  findDirectoryNodeByKey,
  type DirectoryNode,
} from './lib/apiDirectoryTree'
import type { ApiDefinitionSaveDraft } from './lib/apiDefinitionSaveDialog'

type BatchAddTarget = 'query' | 'header' | 'cookie' | 'body-form' | 'assertion' | 'extractor'
type ApiCaseDialogMode = 'create' | 'edit'
type ApiCaseDrawerTab = 'detail' | 'history' | 'changes'
type ApiCaseDetailRequestTab = 'headers' | 'body' | 'params' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'
type ApiCaseHistoryView = 'list' | 'detail'
type ApiCaseHistoryResponseTab = Exclude<ResponseTab, 'actualRequest'>
type ApiAiCaseGenerationStatus = 'idle' | 'running' | 'done' | 'failed'
type ApiImportMode = 'swagger' | 'postman' | 'har'
type ApiImportInputMode = 'url' | 'file'
type ApiSoftPromptInputType = 'text' | 'textarea'
type ApiReportArchiveFilter = 'active' | 'archived' | 'all'
type ApiReportTreeNodeType = 'root' | 'item' | 'scenario' | 'request' | 'step'
type ApiTopTab = 'definitions' | 'scenarios' | 'execution' | 'reports' | 'settings'
type FastExtractionTarget =
  | { kind: 'assertionBody', assertion: ApiAssertionConfig, item: ApiAssertionItemConfig }
  | { kind: 'processorExtract', processor: ApiProcessorConfig, item: ApiProcessorExtractItem }

interface DefinitionSchemaGroup {
  key: 'path' | 'query' | 'header' | 'body'
  title: string
  description: string
  fields: ApiSchemaFieldInput[]
  emptyText: string
}

interface ApiReportTreeNode {
  key: string
  type: ApiReportTreeNodeType
  title: string
  subtitle: string
  result: string | null
  success: boolean | null
  durationMs: number | null
  statusCode: number | null
  failureSummary: string | null
  step: ApiRunStepResult | null
  children: ApiReportTreeNode[]
}

interface DefinitionResponseSchemaGroup {
  code: string
  fields: ApiSchemaFieldInput[]
}

interface ImportModuleOption {
  label: string
  value: string
  workspaceCode: string
}

const CASE_RUN_HISTORY_LIMIT = 10
const CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT = 40
const CASE_RUN_HISTORY_TABLE_ROW_HEIGHT = 54
const DIRECTORY_SEARCH_DEBOUNCE_MS = 260
const DIRECTORY_SEARCH_RESULT_LIMIT = 150
const DIRECTORY_MODULE_REQUEST_PAGE_SIZE = 200
const DIRECTORY_MODULE_LOADING_MIN_MS = 320
const rawBodyTypes: RawBodyType[] = ['RAW_JSON', 'RAW_XML', 'RAW_TEXT']
const aiCaseGenerationFinishedIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAxNCAxNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMu b3JnLzIwMDAvc3ZnIj4KICA8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfMTA2NV8yMTk5MDQpIj4KICAgIDxwYXRoCiAgICAgIGQ9Ik01LjI0MTIxIDMuMDYxNTJDNS40MjgyOCAyLjE0NjI4IDYuNzM1NzggMi4xNDYyOCA2LjkyMjg1IDMuMDYxNTJDNy4zMzYxIDUuMDgyODEgOC45MTYxNyA2LjY2MzAzIDEwLjkzNzUgNy4wNzYxN0MxMS44NTI3IDcuMjYzMjcgMTEuODUyNyA4LjU3MDc1IDEwLjkzNzUgOC43NTc4MUM4LjkxNjI0IDkuMTcxMDMgNy4zMzYwNiAxMC43NTAyIDYuOTIyODUgMTIuNzcxNUM2LjczNTY4IDEzLjY4NjUgNS40MjgzOCAxMy42ODY1IDUuMjQxMjEgMTIuNzcxNUM0LjgyNzk4IDEwLjc1MDQgMy4yNDg2MiA5LjE3MTEgMS4yMjc1NCA4Ljc1NzgxQzAuMzEyMzA1IDguNTcwNzUgMC4zMTIzMzQgNy4yNjMyNyAxLjIyNzU0IDcuMDc2MTdDMy4yNDg2OSA2LjY2Mjk1IDQuODI3OTQgNS4wODI2NSA1LjI0MTIxIDMuMDYxNTJaTTEwLjY2MTEgMS4yMzkyNkMxMC43MzAxIDAuOTAyMDYxIDExLjIxMjMgMC45MDIwNjEgMTEuMjgxMiAxLjIzOTI2QzExLjQzMzYgMS45ODM3MSAxMi4wMTUzIDIuNTY1NDcgMTIuNzU5OCAyLjcxNzc3QzEzLjA5NyAyLjc4NjY5IDEzLjA5NyAzLjI2ODk3IDEyLjc1OTggMy4zMzc4OUMxMi4wMTUzIDMuNDkwMjQgMTEuNDMzNSA0LjA3MTg0IDExLjI4MTIgNC44MTY0MUMxMS4yMTIzIDUuMTUzNiAxMC43MzAxIDUuMTUzNiAxMC42NjExIDQuODE2NDFDMTAuNTA4OSA0LjA3MTggOS45MjcyMSAzLjQ5MDE2IDkuMTgyNjIgMy4zMzc4OUM4Ljg0NTU0IDMuMjY4OTEgOC44NDU1NCAyLjc4Njc1IDkuMTgyNjIgMi43MTc3N0M5LjkyNzE1IDIuNTY1NTQgMTAuNTA4OCAxLjk4Mzc1IDEwLjY2MTEgMS4yMzkyNloiCiAgICAgIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8xMDY1XzIxOTkwNCkiIC8+CiAgPC9nPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzEwNjVfMjE5OTA0IiB4MT0iMC41NDEwMTYiIHkxPSIzLjUzMTQ2IiB4Mj0iMTMuMTEwNSIgeTI9IjMuNzAxNzUiCiAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iI0U5NTZFOSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjcyIiBzdG9wLWNvbG9yPSIjRkY1ODVFIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNGRkEzMDAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGNsaXBQYXRoIGlkPSJjbGlwMF8xMDY1XzIxOTkwNCI+CiAgICAgIDxyZWN0IHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgZmlsbD0id2hpdGUiIC8+CiAgICA8L2NsaXBQYXRoPgogIDwvZGVmcz4KPC9zdmc+Cg=='.replace(/\s/g, '')

interface ApiAssertionConfig {
  id?: string
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  expressionType?: string
  expression?: string
  condition?: string
  operator?: string
  expectedValue?: string
  script?: string | null
  description?: string | null
  assertionBodyType?: ApiAssertionExpressionType
  scriptLanguage?: string | null
  assertions?: ApiAssertionItemConfig[]
  jsonPathAssertion?: ApiAssertionGroupConfig
  xpathAssertion?: ApiAssertionGroupConfig
  regexAssertion?: ApiAssertionGroupConfig
  variableAssertionItems?: ApiAssertionItemConfig[]
}

type ApiAssertionExpressionType = 'JSON_PATH' | 'X_PATH' | 'REGEX' | 'HEADER' | 'VARIABLE' | 'SCRIPT'

interface ApiAssertionItemConfig {
  enabled?: boolean
  header?: string | null
  variableName?: string | null
  expression?: string | null
  condition?: string | null
  operator?: string | null
  expectedValue?: string | null
  description?: string | null
}

interface ApiAssertionGroupConfig {
  assertions: ApiAssertionItemConfig[]
  responseFormat?: string | null
}

interface ApiExtractorConfig {
  id?: string
  name?: string
  enabled?: boolean
  source?: string
  sourceType?: string
  extractType?: string
  expressionType?: string
  expression?: string
  variableName?: string
  defaultValue?: string | null
  required?: boolean
  failOnMissing?: boolean
  description?: string | null
}

interface ApiProcessorConfig {
  id?: string
  processorType?: string
  name?: string
  enabled?: boolean
  script?: string | null
  sql?: string | null
  dataSourceId?: string | number | null
  dataSourceName?: string | null
  queryTimeout?: number | null
  variableNames?: string | null
  resultVariable?: string | null
  extractParams?: ApiProcessorSqlExtractParam[]
  delayMs?: number | null
  expression?: string | null
  variableName?: string | null
  sourceType?: string | null
  extractType?: string | null
  description?: string | null
  extractors?: ApiProcessorExtractItem[]
}

interface ApiProcessorSqlExtractParam {
  key?: string | null
  value?: string | null
  enabled?: boolean
}

interface ApiProcessorExtractItem {
  id?: string
  enabled?: boolean
  name?: string | null
  variableName?: string | null
  description?: string | null
  variableType?: string | null
  sourceType?: string | null
  extractScope?: string | null
  extractType?: string | null
  expression?: string | null
  expressionMatchingRule?: string | null
  resultMatchingRule?: string | null
  resultMatchingRuleNum?: number | null
  responseFormat?: string | null
}

interface ApiSoftPromptOptions {
  title: string
  message?: string
  value?: string
  placeholder?: string
  inputType?: ApiSoftPromptInputType
  requiredMessage?: string
  confirmText?: string
  cancelText?: string
}

interface EditorTab {
  key: string
  resourceType?: 'definition' | 'ai-case-generation'
  definitionId: number | null
  title: string
  method: string
  dirty: boolean
  activeTab: RequestContentTab
  responseTab: ResponseTab
  detail: ApiDefinitionDetail
  runResult: ApiRunResult | null
  runError: string
  loading: boolean
  aiGeneration?: AiCaseGenerationTabState
}

const props = defineProps<{
  activeSection?: ApiTopTab
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
}>()

const router = useRouter()
const route = useRoute()

const emit = defineEmits<{
  loaded: [payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] }]
}>()

const activeTopTab = computed<ApiTopTab>(() => props.activeSection || 'definitions')
const loading = ref(false)
const moduleLoading = ref(false)
const definitionLoading = ref(false)
const moduleErrorMessage = ref('')
const definitionErrorMessage = ref('')
const modules = ref<ApiDefinitionModuleItem[]>([])
const definitions = ref<ApiDefinitionItem[]>([])
const directorySearchDefinitions = ref<ApiDefinitionItem[]>([])
const directorySearchTotal = ref(0)
const directorySearchLoading = ref(false)
const loadedDefinitionModuleKeys = ref<Set<string>>(new Set())
const loadingDefinitionModuleKeys = ref<Set<string>>(new Set())
const activeLoadingDirectoryKeys = ref<Set<string>>(new Set())
const cases = ref<ApiDefinitionCaseItem[]>([])
const environments = ref<ApiAutomationEnvironmentItem[]>([])
const variableSets = ref<ApiAutomationVariableSetItem[]>([])
const runOptionsLoading = ref(false)
const runOptionsErrorMessage = ref('')
const selectedEnvironmentId = ref<number | null>(null)
const selectedVariableSetId = ref<number | null>(null)
const selectedMockBusinessScenarioId = ref<number | null>(null)
const runEnvironmentDrawerVisible = ref(false)
const runEnvironmentDetailLoading = ref(false)
const runEnvironmentDetailErrorMessage = ref('')
const runEnvironmentConfig = ref<EnvConfigItem | null>(null)
const runEnvironmentParamSets = ref<ParamSetItem[]>([])
const runEnvironmentMockApplications = ref<MockApplicationItem[]>([])
const runEnvironmentMockBusinessScenarios = ref<MockBusinessScenarioItem[]>([])
const directoryKeyword = ref('')
const debouncedDirectoryKeyword = ref('')
const selectedDirectoryKey = ref('definition-root')
const expandedKeys = ref<string[]>(['definition-root'])
const directoryExpandedRestored = ref(false)
const restoringDirectoryExpanded = ref(false)
const directoryTreeVersion = ref(0)
const tabs = ref<EditorTab[]>([])
const activeEditorKey = ref('')
const bodyJsonViewMode = ref<BodyJsonViewMode>('json')
const definitionBodyViewMode = ref<DefinitionSchemaViewMode>('schema')
const definitionResponseViewMode = ref<DefinitionSchemaViewMode>('schema')
const activeDefinitionResponseCode = ref('200')
const editorTabNavRef = ref<HTMLElement | null>(null)
const directoryTreeRef = ref<{
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
  }
} | null>(null)
const editorTabOverflow = ref({
  overflow: false,
  arrivedLeft: true,
  arrivedRight: true,
})
const urlInputRef = ref<{ focus: () => void } | null>(null)
const saving = ref(false)
const definitionSaveDialogVisible = ref(false)
const pendingCreateEditorKey = ref('')
const definitionSaveModuleCreating = ref(false)
const sending = ref(false)
const batchAddVisible = ref(false)
const batchAddTarget = ref<BatchAddTarget>('query')
const batchAddText = ref('')
const activeProcessorId = ref('')
const activeAssertionId = ref('')
const importDialogVisible = ref(false)
const importMode = ref<ApiImportMode>('swagger')
const importInputMode = ref<ApiImportInputMode>('url')
const importUrl = ref('')
const importFileName = ref('')
const importFile = ref<File | null>(null)
const importGroupByTags = ref(true)
const importDirectoryName = ref('')
const importSubmitting = ref(false)
const softPromptVisible = ref(false)
const softPromptTitle = ref('')
const softPromptMessage = ref('')
const softPromptValue = ref('')
const softPromptPlaceholder = ref('')
const softPromptInputType = ref<ApiSoftPromptInputType>('text')
const softPromptRequiredMessage = ref('请输入内容')
const softPromptConfirmText = ref('确定')
const softPromptCancelText = ref('取消')
const softPromptError = ref('')
const caseDialogVisible = ref(false)
const caseDialogMode = ref<ApiCaseDialogMode>('create')
const caseDialogSaving = ref(false)
const caseDialogDebugRunning = ref(false)
const caseDialogDebugResult = ref<ApiRunResult | null>(null)
const caseDialogDebugError = ref('')
const aiGeneratedCaseDraftDetail = ref<ApiDefinitionCaseDetail | null>(null)
const aiGeneratedCaseDialogSource = ref<ApiAiGeneratedCaseResult | null>(null)
const caseDetailLoading = ref(false)
const caseDetailErrorMessage = ref('')
const editingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const editingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const caseRunningId = ref<number | null>(null)
const caseDetailDrawerVisible = ref(false)
const caseDetailDrawerTab = ref<ApiCaseDrawerTab>('detail')
const caseDetailRequestTab = ref<ApiCaseDetailRequestTab>('headers')
const caseDetailResponseTab = ref<ResponseTab>('body')
const caseHistoryView = ref<ApiCaseHistoryView>('list')
const caseHistoryRequestTab = ref<'header' | 'body'>('header')
const caseHistoryResponseTab = ref<ApiCaseHistoryResponseTab>('body')
const caseListCurrentPage = ref(1)
const caseListPageSize = ref(10)
const viewingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const viewingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const viewingCaseDetailLoading = ref(false)
const viewingCaseDetailErrorMessage = ref('')
const caseRunHistories = ref<ApiRunHistoryItem[]>([])
const caseRunHistoryLoading = ref(false)
const caseRunHistoryErrorMessage = ref('')
const selectedCaseRunHistoryId = ref<number | null>(null)
const selectedCaseRunHistoryDetail = ref<ApiRunHistoryDetail | null>(null)
const caseRunHistoryDetailLoading = ref(false)
const caseRunHistoryDetailErrorMessage = ref('')
const reportLoading = ref(false)
const reportItems = ref<ApiAutomationReportItem[]>([])
const reportTotal = ref(0)
const reportPageNo = ref(1)
const reportPageSize = ref(10)
const reportKeyword = ref('')
const reportObjectType = ref('')
const reportResult = ref('')
const reportArchiveFilter = ref<ApiReportArchiveFilter>('active')
const reportCreatedRange = ref<[string, string] | null>(null)
const reportAnalysis = ref<ApiAutomationReportAnalysis | null>(null)
const reportAnalysisLoading = ref(false)
const reportStatistics = ref<ApiAutomationReportStatistics | null>(null)
const reportStatisticsLoading = ref(false)
const reportDetailLoading = ref(false)
const reportDetailErrorMessage = ref('')
const selectedReportDetail = ref<ApiAutomationReportDetail | null>(null)
const expandedReportTreeKeys = ref<string[]>([])
const reportStepDetailDrawerVisible = ref(false)
const reportStepDetail = ref<ApiRunStepResult | null>(null)
const reportExporting = ref(false)
const reportActionLoadingKey = ref('')
const maxDebugFileBytes = 5 * 1024 * 1024
const aiCaseDrawerVisible = ref(false)
const aiCaseProviders = ref<AiProviderConnectionItem[]>([])
const aiCaseProvidersLoading = ref(false)
const aiCaseProviderErrorMessage = ref('')
const aiCaseSelectedProviderId = ref<number | null>(null)
const aiCaseCount = ref('AUTO')
const aiCaseNoDuplicate = ref(true)
const aiCasePrompt = ref('')
const aiCaseSelectedOptionKeys = ref<string[]>([
  'required-only',
  'valid-semantics',
  'sample-combination',
  'other-positive',
  'empty-value',
  'missing-required',
  'format-error',
  'type-error',
  'semantic-invalid',
  'other-negative',
  'max-min',
  'over-boundary',
  'null-empty',
  'string-length',
  'auth-control',
])
const aiCaseGenerationStatus = ref<ApiAiCaseGenerationStatus>('idle')
const aiCaseGenerationMessage = ref('')
const aiCaseGenerationLogs = ref<string[]>([])
const aiCaseGeneratedResults = ref<ApiAiGeneratedCaseResult[]>([])
const aiCaseSavingId = ref('')
const aiCaseResultFilter = ref<ApiAiCaseResultFilter>('pending')
const aiCaseResultKeyword = ref('')
const aiCaseResultGroup = ref('')
const aiCaseResultType = ref('')
const aiCaseSelectedResultIds = ref<string[]>([])
const fastExtractionVisible = ref(false)
const fastExtractionTarget = ref<FastExtractionTarget | null>(null)
const processorExtractMoreSettingsVisibleKey = ref<string | null>(null)
const responsePanelHeight = ref(360)
const responsePanelMinHeight = 300
const responsePanelMaxHeight = 520
const responsePanelHeightStorageKey = 'api-interface-response-panel-height'
let responseResizeStartY = 0
let responseResizeStartHeight = 0
let softPromptResolve: ((value: string | null) => void) | null = null
let directorySearchTimer: number | undefined
let directorySearchRequestSeq = 0

const bodyModes: Array<{ label: string; value: BodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

const aiCaseGenerationOptions: ApiAiCaseGenerationOptionPayload[] = [
  { id: 'required-only', key: 'required-only', group: 'positive', groupLabel: '正向', label: '仅传必要字段' },
  { id: 'valid-semantics', key: 'valid-semantics', group: 'positive', groupLabel: '正向', label: '语义合法' },
  { id: 'sample-combination', key: 'sample-combination', group: 'positive', groupLabel: '正向', label: '覆盖枚举组合' },
  { id: 'other-positive', key: 'other-positive', group: 'positive', groupLabel: '正向', label: '其他正向' },
  { id: 'empty-value', key: 'empty-value', group: 'negative', groupLabel: '负向', label: '无效值' },
  { id: 'missing-required', key: 'missing-required', group: 'negative', groupLabel: '负向', label: '缺失必填字段' },
  { id: 'format-error', key: 'format-error', group: 'negative', groupLabel: '负向', label: '格式错误' },
  { id: 'type-error', key: 'type-error', group: 'negative', groupLabel: '负向', label: '类型错误' },
  { id: 'semantic-invalid', key: 'semantic-invalid', group: 'negative', groupLabel: '负向', label: '语义非法' },
  { id: 'other-negative', key: 'other-negative', group: 'negative', groupLabel: '负向', label: '其他负向' },
  { id: 'max-min', key: 'max-min', group: 'boundary', groupLabel: '边界值', label: '极大值/极小值' },
  { id: 'over-boundary', key: 'over-boundary', group: 'boundary', groupLabel: '边界值', label: '超出最大、最小边界值' },
  { id: 'null-empty', key: 'null-empty', group: 'boundary', groupLabel: '边界值', label: 'Null/零值/空值' },
  { id: 'string-length', key: 'string-length', group: 'boundary', groupLabel: '边界值', label: '字符串过长、过短' },
  { id: 'auth-control', key: 'auth-control', group: 'security', groupLabel: '安全性', label: '鉴权控制' },
  { id: 'sql-injection', key: 'sql-injection', group: 'security', groupLabel: '安全性', label: 'SQL注入' },
  { id: 'fuzzy-input', key: 'fuzzy-input', group: 'security', groupLabel: '安全性', label: '模糊输入' },
  { id: 'xss-injection', key: 'xss-injection', group: 'security', groupLabel: '安全性', label: 'XSS注入' },
  { id: 'command-injection', key: 'command-injection', group: 'security', groupLabel: '安全性', label: '命令行注入' },
  { id: 'json-injection', key: 'json-injection', group: 'security', groupLabel: '安全性', label: 'JSON注入' },
  { id: 'nosql-injection', key: 'nosql-injection', group: 'security', groupLabel: '安全性', label: 'NoSQL注入' },
]

const importCapabilityItems: Array<{
  mode: ApiImportMode
  name: string
  description: string
  status: string
  accept: string
  icon: Component
  tone: 'green' | 'orange' | 'purple' | 'blue'
}> = [
  {
    mode: 'swagger',
    name: 'Swagger / OpenAPI',
    description: '支持 Swagger 2.0 / OpenAPI 3.x',
    status: '已支持批量导入',
    accept: '.json,.yaml,.yml',
    icon: LucideLink,
    tone: 'green',
  },
  {
    mode: 'postman',
    name: 'Postman Collection',
    description: '支持 Postman v2.0 / v2.1 格式',
    status: '已支持批量导入',
    accept: '.json',
    icon: LucideFileJson,
    tone: 'orange',
  },
  {
    mode: 'har',
    name: 'HAR 文件',
    description: '浏览器导出的 HTTP 存档文件',
    status: '已支持批量导入',
    accept: '.har',
    icon: LucideFileText,
    tone: 'purple',
  },
]

const selectedImportCapability = computed(() => (
  importCapabilityItems.find(item => item.mode === importMode.value) || importCapabilityItems[0]
))

const aiCaseGenerateGroups = computed(() => {
  const groupMap = new Map<string, { key: string; label: string; options: ApiAiCaseGenerationOptionPayload[] }>()
  aiCaseGenerationOptions.forEach((option) => {
    const key = option.group || option.groupLabel || 'default'
    const existed = groupMap.get(key)
    if (existed) {
      existed.options.push(option)
      return
    }
    groupMap.set(key, {
      key,
      label: option.groupLabel || option.group || '默认场景',
      options: [option],
    })
  })
  return Array.from(groupMap.values())
})

const aiCaseGenerateSelectedCount = computed(() => aiCaseSelectedOptionKeys.value.length)

function isAiCaseGroupAllSelected(groupKey: string) {
  const group = aiCaseGenerateGroups.value.find(item => item.key === groupKey)
  if (!group) return false
  return group.options.every(option => aiCaseSelectedOptionKeys.value.includes(option.key))
}

function toggleAiCaseGroup(groupKey: string, checked: boolean) {
  const group = aiCaseGenerateGroups.value.find(item => item.key === groupKey)
  if (!group) return
  const keys = group.options.map(option => option.key)
  if (checked) {
    aiCaseSelectedOptionKeys.value = Array.from(new Set([...aiCaseSelectedOptionKeys.value, ...keys]))
    return
  }
  aiCaseSelectedOptionKeys.value = aiCaseSelectedOptionKeys.value.filter(key => !keys.includes(key))
}

function openApiSoftPrompt(options: ApiSoftPromptOptions) {
  if (softPromptResolve) {
    softPromptResolve(null)
  }
  softPromptTitle.value = options.title
  softPromptMessage.value = options.message || ''
  softPromptValue.value = options.value || ''
  softPromptPlaceholder.value = options.placeholder || ''
  softPromptInputType.value = options.inputType || 'text'
  softPromptRequiredMessage.value = options.requiredMessage || '请输入内容'
  softPromptConfirmText.value = options.confirmText || '确定'
  softPromptCancelText.value = options.cancelText || '取消'
  softPromptError.value = ''
  softPromptVisible.value = true

  return new Promise<string | null>((resolve) => {
    softPromptResolve = resolve
    void nextTick(() => {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.api-soft-dialog input, .api-soft-dialog textarea')
      input?.focus()
      input?.select()
    })
  })
}

function confirmApiSoftPrompt() {
  const value = softPromptValue.value.trim()
  if (!value) {
    softPromptError.value = softPromptRequiredMessage.value
    return
  }
  softPromptResolve?.(value)
  softPromptResolve = null
  softPromptVisible.value = false
}

function cancelApiSoftPrompt() {
  softPromptResolve?.(null)
  softPromptResolve = null
  softPromptVisible.value = false
}

function confirmApiAction(
  message: string,
  title: string,
  options: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
) {
  return ElMessageBox.confirm(message, title, {
    type: options.danger ? 'error' : 'warning',
    confirmButtonText: options.confirmText || '确定',
    cancelButtonText: options.cancelText || '取消',
    customClass: `api-soft-message-box${options.danger ? ' is-danger' : ''}`,
    confirmButtonClass: options.danger ? 'api-soft-message-box__danger' : 'api-soft-message-box__primary',
    cancelButtonClass: 'api-soft-message-box__cancel',
  }).then(
    () => true,
    () => false,
  )
}

const paramTypeOptions = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file']
const assertionTypeOptions = [
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应时间', value: 'RESPONSE_TIME' },
  { label: '变量', value: 'VARIABLE' },
  { label: '脚本', value: 'SCRIPT' },
]
const assertionConditionOptions = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '开头是', value: 'START_WITH' },
  { label: '结尾是', value: 'END_WITH' },
  { label: '正则匹配', value: 'REGEX' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '长度等于', value: 'LENGTH_EQUALS' },
  { label: '长度不等于', value: 'LENGTH_NOT_EQUALS' },
  { label: '长度大于', value: 'LENGTH_GT' },
  { label: '长度大于等于', value: 'LENGTH_GT_OR_EQUALS' },
  { label: '长度小于', value: 'LENGTH_LT' },
  { label: '长度小于等于', value: 'LENGTH_LT_OR_EQUALS' },
  { label: '不校验', value: 'UNCHECKED' },
]

const extractorSourceOptions = [
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: 'Cookie', value: 'COOKIE' },
]

const extractorExpressionTypeOptions = [
  { label: 'JSONPath', value: 'JSON_PATH' },
  { label: 'XPath', value: 'X_PATH' },
  { label: 'Regex', value: 'REGEX' },
  { label: 'Header name', value: 'HEADER' },
]

const processorExtractTypeOptions = extractorExpressionTypeOptions.filter(item => item.value !== 'HEADER')

function assertionConditionLabel(value?: string | null) {
  return assertionConditionOptions.find(item => item.value === value)?.label || value || '-'
}

function assertionResultLabel(success?: boolean | null) {
  return success ? '通过' : '不通过'
}

function assertionResultClass(success?: boolean | null) {
  return success ? 'is-passed' : 'is-failed'
}

function extractionResultValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function extractionResultText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function extractionResultNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickPreferredRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) {
    return null
  }
  return steps.find(item => !item.success) ?? steps[steps.length - 1]
}

function appendProcessorConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const stage = extractionResultText(extractionResultValue(row, 'stage') ?? extractionResultValue(row, 'processorStage'))
    const success = extractionResultValue(row, 'success')
    const duration = extractionResultNumber(extractionResultValue(row, 'durationMs'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage') ?? extractionResultValue(row, 'result'))
    lines.push(`[处理器 ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? '失败' : '通过'}${duration !== null ? ` / ${duration} ms` : ''}`)
    if (message !== '-') {
      lines.push(`  ${message}`)
    }
    const outputVariables = extractionResultValue(row, 'outputVariables')
    if (outputVariables && typeof outputVariables === 'object' && Object.keys(outputVariables).length) {
      lines.push(`  输出变量: ${JSON.stringify(outputVariables)}`)
    }
    const logs = extractionResultValue(row, 'logs')
    if (Array.isArray(logs)) {
      logs.forEach(log => lines.push(`  ${String(log)}`))
    }
  })
}

function appendAssertionConsoleLines(lines: string[], rows: ApiRunStepResult['assertionResults']) {
  rows.forEach((item, index) => {
    lines.push(`[断言 ${index + 1}] ${(item.name || item.type)} / ${item.success ? '通过' : '失败'}`)
    if (item.message) {
      lines.push(`  ${item.message}`)
    }
    if (item.expectedValue !== undefined || item.actualValue !== undefined) {
      lines.push(`  期望值: ${item.expectedValue ?? ''}`)
      lines.push(`  实际值: ${item.actualValue ?? ''}`)
    }
  })
}

function appendExtractionConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'variableName') ?? `提取项 ${index + 1}`)
    const success = extractionResultValue(row, 'success')
    const value = extractionResultText(extractionResultValue(row, 'value') ?? extractionResultValue(row, 'actualValue'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage'))
    lines.push(`[提取 ${index + 1}] ${name} / ${success === false ? '失败' : '通过'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
}

function buildRunConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) {
    lines.push(`[错误] ${debugError}`)
  }
  appendProcessorConsoleLines(lines, processorResults)
  appendAssertionConsoleLines(lines, assertionResults)
  appendExtractionConsoleLines(lines, extractionResults)
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function requestBodyPreview(config: ApiRequestConfigInput) {
  const body = config.body
  if (body.type === 'NONE') return null
  if (isRawBodyType(body.type)) return getModeBodyText(body) || null
  if (body.type === 'BINARY') {
    return body.fileName
      ? {
          fileName: body.fileName,
          fileSize: body.fileSize ?? null,
          contentType: body.contentType ?? null,
        }
      : null
  }
  const rows = enabledRows(body.formItems)
  if (!rows.length) return null
  return Object.fromEntries(rows.map(row => [row.key, row.fileName || row.value || '']))
}

function actualRequestPreviewFromConfig(config: ApiRequestConfigInput, method?: string | null, path?: string | null) {
  return {
    method: config.method || method || 'GET',
    url: config.path || path || '',
    headers: Object.fromEntries(enabledRows(config.headers).map(row => [row.key, row.value])),
    body: requestBodyPreview(config),
  }
}

function actualRequestPreviewFallback() {
  const detail = activeEditor.value?.detail
  if (!detail) {
    return null
  }
  return actualRequestPreviewFromConfig(detail.requestConfig, detail.method, detail.path)
}

function actualRequestPreview(request: ApiRunStepResult['request']) {
  if (!request) {
    return actualRequestPreviewFallback()
  }
  return {
    method: request.method || 'GET',
    url: request.url || '',
    headers: request.headers ?? {},
    body: request.body ?? null,
  }
}

function runStepDebugError(step: ApiRunStepResult | null, runError?: string | null, failureSummary?: string | null) {
  const explicitError = step?.errorMessage || runError || failureSummary || ''
  if (explicitError) return explicitError
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return '请求执行失败'
}

function assertionRunResultPresentation(rows: ApiRunStepResult['assertionResults'], errorMessage?: string | null) {
  if (!rows.length) {
    if (errorMessage) {
      return { visible: true, label: '执行失败', tone: 'failed' }
    }
    return { visible: false, label: '', tone: 'empty' }
  }
  if (rows.some(item => !item.success)) {
    return { visible: true, label: '断言失败', tone: 'failed' }
  }
  if (errorMessage) {
    return { visible: true, label: '执行失败', tone: 'failed' }
  }
  return { visible: true, label: '断言通过', tone: 'success' }
}

const processorTypeOptions = [
  { label: '脚本', value: 'SCRIPT' },
  { label: 'SQL', value: 'SQL' },
  { label: '等待', value: 'TIME_WAITING' },
  { label: '提取', value: 'EXTRACT' },
]

function processorTypeOptionsFor(stage: 'pre' | 'post') {
  return stage === 'pre'
    ? processorTypeOptions.filter(item => item.value !== 'EXTRACT')
    : processorTypeOptions
}

const processorExtractVariableTypeOptions = [
  { label: '临时变量', value: 'TEMPORARY' },
  { label: '环境变量', value: 'ENVIRONMENT' },
]

const processorRegexExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
  { label: '响应头', value: 'RESPONSE_HEADERS' },
  { label: '请求头', value: 'REQUEST_HEADERS' },
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应消息', value: 'RESPONSE_MESSAGE' },
  { label: 'URL', value: 'URL' },
]

const processorBodyExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
]

const contentTabs = computed<ApiRequestContentTabItem[]>(() => [
  { label: '请求头', value: 'headers' },
  { label: '请求体', value: 'body' },
  { label: 'Params', value: 'params', count: enabledRows(activeEditor.value?.detail.requestConfig.queryParams).length },
  { label: 'Auth', value: 'auth' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '断言', value: 'tests', count: activeEditor.value?.detail.assertions.length || undefined },
  { label: '设置', value: 'settings' },
  { label: '用例', value: 'cases', count: activeDefinitionCases.value.length || undefined },
  { label: '定义', value: 'definition', count: activeSchemaFields.value.length || undefined },
])

const activeEditor = computed(() => tabs.value.find(item => item.key === activeEditorKey.value) || null)
const activeDetail = computed(() => activeEditor.value?.detail || null)
const activeAiCaseGenerationState = computed(() => (
  activeEditor.value?.resourceType === 'ai-case-generation' ? activeEditor.value.aiGeneration || null : null
))
const isAiCaseGenerationTabActive = computed(() => Boolean(activeAiCaseGenerationState.value))
const activeBodyRawText = computed({
  get: () => activeDetail.value ? getModeBodyText(activeDetail.value.requestConfig.body) : '',
  set: (value: string) => {
    if (!activeDetail.value) return
    setModeBodyText(activeDetail.value.requestConfig.body, value)
    markDirty()
  },
})
const activeBodyLanguage = computed<ApiBodyLanguage>(() => bodyLanguage(activeDetail.value?.requestConfig.body.type))
const activeSchemaFields = computed(() => activeDetail.value?.requestConfig.schemaFields || [])
const bodySchemaFields = computed(() => schemaFieldsByLocation('body'))
const querySchemaFields = computed(() => schemaFieldsByLocation('query'))
const headerSchemaFields = computed(() => schemaFieldsByLocation('header'))
const pathSchemaFields = computed(() => schemaFieldsByLocation('path'))
const responseSchemaFields = computed(() => schemaFieldsByLocation('response'))
const definitionRequestSchemaGroups = computed<DefinitionSchemaGroup[]>(() => {
  const groups: DefinitionSchemaGroup[] = [
    {
      key: 'path',
      title: 'Path 参数',
      description: '路径中的变量参数',
      fields: pathSchemaFields.value,
      emptyText: '暂无 Path 参数',
    },
    {
      key: 'query',
      title: 'Query 参数',
      description: 'URL 查询参数',
      fields: querySchemaFields.value,
      emptyText: '暂无 Query 参数',
    },
    {
      key: 'header',
      title: 'Header 参数',
      description: '请求头参数',
      fields: headerSchemaFields.value,
      emptyText: '暂无 Header 参数',
    },
  ]
  return groups.filter(group => group.fields.length)
})
const definitionRequestExampleJson = computed(() => {
  if (bodySchemaFields.value.length) return buildSchemaExampleText(bodySchemaFields.value)
  const text = activeDetail.value ? getModeBodyText(activeDetail.value.requestConfig.body).trim() : ''
  return text ? toPrettyJson(text) : '-'
})
const responseSchemaGroups = computed<DefinitionResponseSchemaGroup[]>(() => {
  const grouped = new Map<string, ApiSchemaFieldInput[]>()
  responseSchemaFields.value.forEach((field) => {
    const code = normalizeDefinitionResponseCode(field.responseCode)
    grouped.set(code, [...(grouped.get(code) || []), field])
  })
  return Array.from(grouped.entries())
    .map(([code, fields]) => ({ code, fields }))
    .sort((left, right) => compareDefinitionResponseCode(left.code, right.code))
})
const activeResponseSchemaGroup = computed(() => {
  if (!responseSchemaGroups.value.length) return null
  return responseSchemaGroups.value.find(group => group.code === activeDefinitionResponseCode.value) || responseSchemaGroups.value[0]
})
const activeResponseSchemaFields = computed(() => activeResponseSchemaGroup.value?.fields || [])
const definitionResponseExampleJson = computed(() =>
  activeResponseSchemaFields.value.length ? buildSchemaExampleText(activeResponseSchemaFields.value) : '-',
)
const activeDefinitionCases = computed(() => {
  const id = activeEditor.value?.definitionId
  return id ? cases.value.filter(item => item.definitionId === id) : []
})
const caseListTotalPages = computed(() => Math.max(1, Math.ceil(activeDefinitionCases.value.length / caseListPageSize.value)))
const pagedDefinitionCases = computed(() => {
  const start = (caseListCurrentPage.value - 1) * caseListPageSize.value
  return activeDefinitionCases.value.slice(start, start + caseListPageSize.value)
})
const caseRunHistoryTableHeight = computed(() => (
  CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT
  + Math.max(caseRunHistories.value.length, 1) * CASE_RUN_HISTORY_TABLE_ROW_HEIGHT
))

watch(
  () => [activeEditor.value?.definitionId, activeDefinitionCases.value.length, caseListPageSize.value] as const,
  () => {
    if (caseListCurrentPage.value > caseListTotalPages.value) {
      caseListCurrentPage.value = caseListTotalPages.value
    }
    if (caseListCurrentPage.value < 1) {
      caseListCurrentPage.value = 1
    }
  },
)

watch(
  responseSchemaGroups,
  (groups) => {
    if (!groups.length) {
      activeDefinitionResponseCode.value = '200'
      return
    }
    if (!groups.some(group => group.code === activeDefinitionResponseCode.value)) {
      activeDefinitionResponseCode.value = groups[0].code
    }
  },
  { immediate: true },
)

function caseProtocolLabel() {
  const path = activeEditor.value?.detail.requestConfig.path || ''
  return /^https:\/\//i.test(path) ? 'HTTPS' : 'HTTP'
}

function casePriorityLabel(row?: ApiDefinitionCaseItem) {
  return (row as any)?.casePriority || (row as any)?.priority || '-'
}

function caseStatusLabel(row?: ApiDefinitionCaseItem) {
  return (row as any)?.caseStatus || (row as any)?.status || '-'
}

function formatCaseTags(tags?: string[] | null) {
  return Array.isArray(tags) && tags.length ? tags.join(', ') : '-'
}
const aiCaseAvailableProviders = computed(() =>
  aiCaseProviders.value.filter(item => item.status !== 0 && Boolean(item.modelName)),
)
const aiCaseSelectedProvider = computed(() =>
  aiCaseAvailableProviders.value.find(item => item.id === aiCaseSelectedProviderId.value) || null,
)
const aiCaseCanGenerate = computed(() =>
  Boolean(activeEditor.value?.definitionId || activeAiCaseGenerationState.value?.definitionId)
  && Boolean(aiCaseSelectedProvider.value)
  && aiCaseSelectedOptionKeys.value.length > 0
  && aiCaseGenerationStatus.value !== 'running',
)
const aiCasePendingResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status !== 'accepted' && item.status !== 'discarded'),
)
const aiCaseAcceptedResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status === 'accepted'),
)
const aiCaseDiscardedResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status === 'discarded'),
)
const aiCaseGenerationEmptyStateText = computed(() => {
  if (activeAiCaseGenerationState.value?.generating) {
    return 'AI 正在生成用例大纲，生成后的用例会逐条显示'
  }
  if (activeAiCaseGenerationState.value?.message && aiCaseGenerationStatus.value === 'failed') {
    return activeAiCaseGenerationState.value.message
  }
  if (aiCaseGeneratedResults.value.length > 0) {
    return '当前筛选条件下没有可展示的用例'
  }
  return '本次没有生成可展示的用例，请检查模型是否按要求返回结构化内容'
})
const aiCaseFilteredResults = computed(() => {
  const keyword = aiCaseResultKeyword.value.trim().toLowerCase()
  return aiCaseGeneratedResults.value.filter((item) => {
    if (aiCaseResultFilter.value === 'pending' && (item.status === 'accepted' || item.status === 'discarded')) return false
    if (aiCaseResultFilter.value !== 'all' && aiCaseResultFilter.value !== 'pending' && item.status !== aiCaseResultFilter.value) return false
    if (aiCaseResultGroup.value && (item.draft.groupKey || item.draft.group || '') !== aiCaseResultGroup.value) return false
    if (aiCaseResultType.value && (item.draft.typeKey || item.draft.type || '') !== aiCaseResultType.value) return false
    if (!keyword) return true
    return [
      item.draft.name,
      item.draft.description,
      item.draft.expected,
      item.draft.group,
      item.draft.type,
      item.message,
    ].some(value => String(value || '').toLowerCase().includes(keyword))
  })
})
const aiCaseResultGroupOptions = computed(() => {
  const options = new Map<string, string>()
  aiCaseGeneratedResults.value.forEach((item) => {
    const value = item.draft.groupKey || item.draft.group || ''
    if (value) options.set(value, item.draft.group || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const aiCaseResultTypeOptions = computed(() => {
  const options = new Map<string, string>()
  aiCaseGeneratedResults.value.forEach((item) => {
    const value = item.draft.typeKey || item.draft.type || ''
    if (value) options.set(value, item.draft.type || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const selectedPendingAiCaseResults = computed(() =>
  aiCasePendingResults.value.filter(item => item.status !== 'generating' && item.status !== 'failed' && aiCaseSelectedResultIds.value.includes(item.id)),
)
const aiCaseSelectionAllChecked = computed(() =>
  aiCaseFilteredResults.value.some(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
  && aiCaseFilteredResults.value
    .filter(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
    .every(item => aiCaseSelectedResultIds.value.includes(item.id)),
)
const aiCaseSelectionIndeterminate = computed(() => {
  const pending = aiCaseFilteredResults.value.filter(item => item.status !== 'generating' && item.status !== 'failed' && item.status === 'pending')
  if (!pending.length) return false
  const selectedCount = pending.filter(item => aiCaseSelectedResultIds.value.includes(item.id)).length
  return selectedCount > 0 && selectedCount < pending.length
})

const currentDefinitionWorkspaceLabel = computed(() => {
  const editor = activeEditor.value
  const targetWorkspaceCode = editor?.detail.workspaceCode || props.workspaceCode
  if (!targetWorkspaceCode) {
    return props.workspaceCode === 'ALL' ? '未选择空间' : '当前空间'
  }

  if (targetWorkspaceCode === 'ALL') return '未选择空间'

  const workspace = (props.workspaces || []).find(item =>
    item.workspaceCode === targetWorkspaceCode || item.code === targetWorkspaceCode,
  )
  const workspaceName = workspace?.workspaceName || workspace?.name
  if (workspaceName) return workspaceName

  const detailWorkspaceName = editor?.detail.workspaceName?.trim()
  if (detailWorkspaceName && detailWorkspaceName !== targetWorkspaceCode && detailWorkspaceName !== 'ALL') {
    return detailWorkspaceName
  }

  return targetWorkspaceCode
})

const filteredDefinitions = computed(() => {
  const keyword = debouncedDirectoryKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return definitions.value
  }

  return directorySearchDefinitions.value
})

const directorySearchMatchedCount = computed(() => {
  if (debouncedDirectoryKeyword.value.trim()) {
    return directorySearchTotal.value
  }
  return directoryTree.value[0]?.count ?? definitions.value.length
})

const directorySearchLimited = computed(() =>
  Boolean(debouncedDirectoryKeyword.value.trim())
    && directorySearchMatchedCount.value > DIRECTORY_SEARCH_RESULT_LIMIT,
)

function refreshDirectoryTree() {
  directoryTreeVersion.value += 1
}

function waitForMs(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function markDirectoryNodeLoading(key: string, loadingState: boolean) {
  const next = new Set(activeLoadingDirectoryKeys.value)
  if (loadingState) {
    next.add(key)
  } else {
    next.delete(key)
  }
  activeLoadingDirectoryKeys.value = next
  refreshDirectoryTree()
}

function markDefinitionModuleLoading(key: string, loadingState: boolean) {
  const next = new Set(loadingDefinitionModuleKeys.value)
  if (loadingState) {
    next.add(key)
  } else {
    next.delete(key)
  }
  loadingDefinitionModuleKeys.value = next
}

function markDefinitionModuleLoaded(key: string) {
  loadedDefinitionModuleKeys.value = new Set([...loadedDefinitionModuleKeys.value, key])
}

function directoryExpandedStorageKey() {
  return `api-interface-directory-expanded:${props.workspaceCode || 'ALL'}`
}

function readStoredExpandedKeys() {
  try {
    const raw = window.localStorage.getItem(directoryExpandedStorageKey())
    const value = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function persistExpandedKeys() {
  if (!directoryExpandedRestored.value) return
  try {
    window.localStorage.setItem(directoryExpandedStorageKey(), JSON.stringify(expandedKeys.value))
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }
}

function mergeDefinitions(items: ApiDefinitionItem[]) {
  if (!items.length) return
  const merged = new Map(definitions.value.map(item => [item.id, item]))
  items.forEach(item => merged.set(item.id, item))
  definitions.value = Array.from(merged.values())
}

async function searchDirectoryDefinitions(keyword: string) {
  const trimmedKeyword = keyword.trim()
  const requestSeq = ++directorySearchRequestSeq
  if (!trimmedKeyword) {
    directorySearchDefinitions.value = []
    directorySearchTotal.value = 0
    directorySearchLoading.value = false
    return
  }

  directorySearchLoading.value = true
  try {
    const page = await apiAutomationApi.getDefinitions(props.workspaceCode, {
      keyword: trimmedKeyword,
      pageNo: 1,
      pageSize: DIRECTORY_SEARCH_RESULT_LIMIT,
    })
    if (requestSeq !== directorySearchRequestSeq) return
    directorySearchDefinitions.value = page.items
    directorySearchTotal.value = page.total
  } catch (error) {
    if (requestSeq !== directorySearchRequestSeq) return
    directorySearchDefinitions.value = []
    directorySearchTotal.value = 0
    ElMessage.warning(getRequestErrorMessage(error))
  } finally {
    if (requestSeq === directorySearchRequestSeq) {
      directorySearchLoading.value = false
    }
  }
}

function isDirectDefinitionInPath(item: ApiDefinitionItem, fullPath: string | null) {
  return (item.directoryName || '').trim() === (fullPath || '').trim()
}

const directoryTree = computed<DirectoryNode[]>(() => {
  return buildApiDirectoryTree({
    workspaceCode: props.workspaceCode,
    workspaces: props.workspaces || [],
    modules: modules.value,
    definitions: filteredDefinitions.value,
    loadedModuleKeys: loadedDefinitionModuleKeys.value,
    loadingModuleKeys: loadingDefinitionModuleKeys.value,
  })
})

const visibleDirectoryTree = computed<DirectoryNode[]>(() => directoryTree.value[0]?.children ?? [])
const directoryTreeRenderKey = computed(() => `${props.workspaceCode}:${directoryTreeVersion.value}`)
const importModuleOptions = computed<ImportModuleOption[]>(() => {
  const workspaceCodes = props.workspaceCode === 'ALL'
    ? Array.from(new Set([
        ...(props.workspaces || [])
          .map(item => item.workspaceCode || item.code || '')
          .filter((code): code is string => Boolean(code) && code !== 'ALL'),
        ...modules.value
          .map(item => item.workspaceCode || '')
          .filter((code): code is string => Boolean(code)),
      ]))
    : [props.workspaceCode]
  const workspaceLabel = (workspaceCode: string) => {
    const workspace = (props.workspaces || []).find(item => (item.workspaceCode || item.code) === workspaceCode)
    return workspace?.workspaceName || workspace?.name || workspaceCode
  }
  const options: ImportModuleOption[] = workspaceCodes.map(code => ({
    label: props.workspaceCode === 'ALL' ? `${workspaceLabel(code)} / 根目录` : '根目录',
    value: '',
    workspaceCode: code,
  }))
  modules.value.forEach((item) => {
    const fullPath = (item.fullPath || item.name || '').trim()
    if (!fullPath) return
    options.push({
      label: props.workspaceCode === 'ALL' ? `${workspaceLabel(item.workspaceCode)} / ${fullPath}` : fullPath,
      value: fullPath,
      workspaceCode: item.workspaceCode,
    })
  })
  return options
})

function collapseDirectoryTree() {
  expandedKeys.value = collectCollapsedDirectoryKeys(directoryTree.value)
}

function reportArchivedQueryValue() {
  if (reportArchiveFilter.value === 'all') return null
  return reportArchiveFilter.value === 'archived'
}

function currentReportQuery() {
  return {
    keyword: reportKeyword.value,
    objectType: reportObjectType.value,
    result: reportResult.value,
    createdFrom: reportCreatedRange.value?.[0],
    createdTo: reportCreatedRange.value?.[1],
    archived: reportArchivedQueryValue(),
  }
}

async function loadReports() {
  if (!props.workspaceReady) return
  reportLoading.value = true
  try {
    const page = await apiAutomationApi.getReports(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
      pageNo: reportPageNo.value,
      pageSize: reportPageSize.value,
    })
    reportItems.value = page.items
    reportTotal.value = page.total
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportLoading.value = false
  }
}

async function loadReportAnalysis() {
  if (!props.workspaceReady) return
  reportAnalysisLoading.value = true
  try {
    reportAnalysis.value = await apiAutomationApi.getReportAnalysis(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
    })
  } catch (error) {
    reportAnalysis.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportAnalysisLoading.value = false
  }
}

async function loadReportStatistics() {
  if (!props.workspaceReady) return
  reportStatisticsLoading.value = true
  try {
    reportStatistics.value = await apiAutomationApi.getReportStatistics(props.workspaceCode || 'ALL', {
      ...currentReportQuery(),
    })
  } catch (error) {
    reportStatistics.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportStatisticsLoading.value = false
  }
}

async function refreshReportWorkspace() {
  await Promise.all([loadReports(), loadReportAnalysis(), loadReportStatistics()])
}

function searchReports() {
  reportPageNo.value = 1
  void refreshReportWorkspace()
}

function resetReportFilters() {
  reportKeyword.value = ''
  reportObjectType.value = ''
  reportResult.value = ''
  reportArchiveFilter.value = 'active'
  reportCreatedRange.value = null
  reportPageNo.value = 1
  void refreshReportWorkspace()
}

async function openReportDetail(item: ApiAutomationReportItem) {
  if (!item.reportKey) return
  reportDetailLoading.value = true
  reportDetailErrorMessage.value = ''
  selectedReportDetail.value = null
  try {
    const detail = await apiAutomationApi.getReportDetail(item.workspaceCode || props.workspaceCode || 'ALL', item.reportKey)
    selectedReportDetail.value = detail
    syncReportTreeExpansion(detail)
  } catch (error) {
    reportDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    reportDetailLoading.value = false
  }
}

function backToReportList() {
  selectedReportDetail.value = null
  expandedReportTreeKeys.value = []
  reportDetailErrorMessage.value = ''
  reportDetailLoading.value = false
}

function reportTreeStepKey(step: ApiRunStepResult, index: number) {
  return `step:${step.id ?? step.stepKey ?? step.stepOrder}:${index}`
}

function reportItemKey(item: ApiAutomationReportDetail['itemSnapshots'][number], index: number) {
  return `item:${item.sortOrder ?? index}:${item.itemType}:${item.itemId ?? index}`
}

function buildReportStepNode(step: ApiRunStepResult, index: number): ApiReportTreeNode {
  return {
    key: reportTreeStepKey(step, index),
    type: step.stepKind === 'SCENARIO_GROUP' ? 'scenario' : step.request ? 'request' : 'step',
    title: step.stepName || `步骤 ${step.stepOrder}`,
    subtitle: step.request?.url || `#${step.stepOrder}`,
    result: step.success ? 'SUCCESS' : 'FAILED',
    success: step.success,
    durationMs: step.durationMs,
    statusCode: step.response?.statusCode ?? null,
    failureSummary: step.errorMessage || null,
    step,
    children: [],
  }
}

function buildReportTree(detail: ApiAutomationReportDetail): ApiReportTreeNode[] {
  const steps = detail.stepResults || []
  if (!detail.itemSnapshots.length) {
    return [{
      key: `root:${detail.reportKey}`,
      type: detail.objectType === 'SCENARIO' ? 'scenario' : detail.objectType === 'API_CASE' ? 'request' : 'root',
      title: detail.objectName || detail.reportName || '执行报告',
      subtitle: reportObjectTypeLabel(detail.objectType),
      result: detail.result,
      success: detail.result ? !['FAILED', 'ERROR'].includes(String(detail.result).toUpperCase()) : null,
      durationMs: detail.durationMs,
      statusCode: detail.statusCode,
      failureSummary: detail.failureSummary,
      step: null,
      children: steps.map(buildReportStepNode),
    }]
  }

  const keyedSteps = new Map<string, ApiRunStepResult[]>()
  steps.forEach((step) => {
    if (step.suiteItemId == null && step.suiteItemOrder == null) return
    const key = `${step.suiteItemOrder ?? ''}-${step.suiteItemId ?? ''}`
    const rows = keyedSteps.get(key) || []
    rows.push(step)
    keyedSteps.set(key, rows)
  })

  let stepCursor = 0
  return detail.itemSnapshots.map((item, index) => {
    const stepCount = Math.max(0, Number(item.stepCount || 0))
    const itemStepKey = `${item.sortOrder ?? ''}-${item.itemId ?? ''}`
    let itemSteps = keyedSteps.get(itemStepKey) || []
    if (!itemSteps.length) {
      itemSteps = steps.slice(stepCursor, stepCursor + stepCount)
      stepCursor += stepCount
    }
    return {
      key: reportItemKey(item, index),
      type: item.itemType === 'SCENARIO' ? 'scenario' : 'request',
      title: item.itemName || `${reportObjectTypeLabel(item.itemType)} ${item.sortOrder ?? index + 1}`,
      subtitle: reportObjectTypeLabel(item.itemType),
      result: item.result,
      success: item.result ? !['FAILED', 'ERROR'].includes(String(item.result).toUpperCase()) : null,
      durationMs: item.durationMs,
      statusCode: null,
      failureSummary: item.failureSummary,
      step: null,
      children: itemSteps.map(buildReportStepNode),
    }
  })
}

function reportTreeContainsFailure(node: ApiReportTreeNode): boolean {
  return node.success === false || Boolean(node.failureSummary) || node.children.some(reportTreeContainsFailure)
}

function reportTreeNodeTypeLabel(node: ApiReportTreeNode) {
  if (node.type === 'scenario') return '场景'
  if (node.type === 'request') return '接口'
  if (node.type === 'step') return '步骤'
  return node.subtitle || '节点'
}

function syncReportTreeExpansion(detail: ApiAutomationReportDetail) {
  const keys = new Set<string>()
  const visit = (node: ApiReportTreeNode) => {
    if (node.children.length && reportTreeContainsFailure(node)) {
      keys.add(node.key)
    }
    node.children.forEach(visit)
  }
  buildReportTree(detail).forEach(visit)
  if (!keys.size) {
    const first = buildReportTree(detail)[0]
    if (first?.children.length) keys.add(first.key)
  }
  expandedReportTreeKeys.value = [...keys]
}

function toggleReportTreeNode(node: ApiReportTreeNode) {
  if (!node.children.length) {
    if (node.step) openReportStepDetail(node.step)
    return
  }
  const nextKeys = new Set(expandedReportTreeKeys.value)
  if (nextKeys.has(node.key)) {
    nextKeys.delete(node.key)
  } else {
    nextKeys.add(node.key)
  }
  expandedReportTreeKeys.value = [...nextKeys]
}

function openReportStepDetail(step: ApiRunStepResult) {
  reportStepDetail.value = step
  reportStepDetailDrawerVisible.value = true
}

const selectedReportContextSnapshot = computed<ApiRuntimeContextSnapshot | null>(() => {
  return parseRuntimeContextSnapshot(selectedReportDetail.value?.contextSnapshotJson)
})

const selectedReportLocalRunnerRows = computed(() => {
  return buildLocalRunnerContextRows(selectedReportContextSnapshot.value)
})

const selectedReportContextVariables = computed(() => {
  const variables = selectedReportContextSnapshot.value?.variables || {}
  return Object.entries(variables).map(([key, value]) => ({ key, value }))
})

const selectedReportContextVariableSetLabel = computed(() => {
  const variableSet = selectedReportContextSnapshot.value?.variableSet
  const name = variableSet?.name || selectedReportDetail.value?.variableSetName || ''
  if (!name) return '未使用变量集'
  return variableSet?.versionNo ? `${name} · v${variableSet.versionNo}` : name
})

const selectedReportContextVariableSetDetails = computed(() => {
  const variableSets = selectedReportContextSnapshot.value?.variableSets || []
  return variableSets
    .map(item => item.name ? (item.versionNo ? `${item.name} · v${item.versionNo}` : item.name) : '')
    .filter(Boolean)
})
const selectedReportTree = computed(() => selectedReportDetail.value ? buildReportTree(selectedReportDetail.value) : [])

function parseRuntimeContextSnapshot(value?: string | null): ApiRuntimeContextSnapshot | null {
  if (!value) return null
  try {
    return JSON.parse(value) as ApiRuntimeContextSnapshot
  } catch {
    return null
  }
}

async function exportReports() {
  if (reportExporting.value) return
  reportExporting.value = true
  try {
    const blob = await apiAutomationApi.exportReports(props.workspaceCode || 'ALL', currentReportQuery())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-automation-reports-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('报告已导出')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportExporting.value = false
  }
}

async function rerunReport(item: ApiAutomationReportItem) {
  if (!item.reportKey || reportActionLoadingKey.value) return
  reportActionLoadingKey.value = `rerun:${item.reportKey}`
  try {
    await apiAutomationApi.rerunReport(item.workspaceCode || props.workspaceCode || 'ALL', item.reportKey, {
      workspaceCode: item.workspaceCode || props.workspaceCode || 'ALL',
      environmentId: item.environmentId,
      variableSetId: item.variableSetId,
      branchName: item.branchName,
      triggerSource: 'REPORT_RERUN',
    })
    ElMessage.success('复跑完成，已生成新的报告')
    reportPageNo.value = 1
    await refreshReportWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportActionLoadingKey.value = ''
  }
}

async function archiveReport(item: ApiAutomationReportItem) {
  if (!item.reportKey || item.archived || reportActionLoadingKey.value) return
  try {
    await ElMessageBox.confirm(`确定归档报告「${item.objectName}」吗？归档后默认列表和统计将不再展示。`, '归档报告', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  reportActionLoadingKey.value = `archive:${item.reportKey}`
  try {
    const archived = await apiAutomationApi.archiveReport(item.workspaceCode || props.workspaceCode || 'ALL', item.reportKey)
    if (selectedReportDetail.value?.reportKey === item.reportKey) {
      selectedReportDetail.value = archived
    }
    ElMessage.success('报告已归档')
    await refreshReportWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reportActionLoadingKey.value = ''
  }
}

function handleReportPageChange(pageNo: number) {
  reportPageNo.value = pageNo
  void loadReports()
}

function handleReportPageSizeChange(pageSize: number) {
  reportPageSize.value = pageSize
  reportPageNo.value = 1
  void loadReports()
}

watch(
  directoryKeyword,
  (keyword) => {
    window.clearTimeout(directorySearchTimer)
    directorySearchTimer = window.setTimeout(() => {
      debouncedDirectoryKeyword.value = keyword
    }, DIRECTORY_SEARCH_DEBOUNCE_MS)
  },
)

watch(
  () => [debouncedDirectoryKeyword.value, directoryTree.value],
  () => {
    if (debouncedDirectoryKeyword.value.trim()) {
      expandedKeys.value = Array.from(new Set(collectExpandableDirectoryKeys(directoryTree.value)))
    }
  },
)

watch(
  debouncedDirectoryKeyword,
  (keyword) => {
    void searchDirectoryDefinitions(keyword)
  },
)

watch(
  directoryTree,
  (tree) => {
    const available = new Set(collectExpandableDirectoryKeys(tree))
    expandedKeys.value = expandedKeys.value.filter(key => available.has(key))
    persistExpandedKeys()
  },
  { immediate: true },
)

watch(
  expandedKeys,
  () => {
    persistExpandedKeys()
  },
  { deep: true },
)

watch(selectedEnvironmentId, () => {
  selectedMockBusinessScenarioId.value = null
  runEnvironmentConfig.value = null
  runEnvironmentMockBusinessScenarios.value = []
})

const currentStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(activeEditor.value?.runResult?.stepResults ?? []))
const caseDetailPreviewStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const selectedCaseHistoryStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const selectedEnvironment = computed(() => environments.value.find(item => item.id === selectedEnvironmentId.value) || null)
const selectedEnvironmentDefaultVariableSet = computed(() => {
  const defaultId = selectedEnvironment.value?.defaultVariableSetId
  return defaultId ? variableSets.value.find(item => item.id === defaultId) || null : null
})
const runEnvironmentConfigJson = computed(() => parseRunEnvironmentConfig(runEnvironmentConfig.value?.configJson || ''))
const runEnvironmentServices = computed(() =>
  runEnvironmentConfig.value
    ? getEnvServiceDetails(runEnvironmentConfig.value)
    : selectedEnvironment.value?.baseUrl
      ? [{ key: 'default', name: '默认服务', baseUrl: selectedEnvironment.value.baseUrl, isDefault: true }]
      : [],
)
const runEnvironmentDefaultVariableSetId = computed(() => {
  const value = runEnvironmentConfigJson.value.defaultVariableSetId
  return typeof value === 'number' ? value : selectedEnvironment.value?.defaultVariableSetId ?? null
})
const runEnvironmentDefaultParamSet = computed(() => {
  const id = runEnvironmentDefaultVariableSetId.value
  return id ? runEnvironmentParamSets.value.find(item => item.id === id) || null : null
})
const runEnvironmentMockApplication = computed(() => {
  const id = runEnvironmentConfigJson.value.mockApplicationId
  return typeof id === 'number' ? runEnvironmentMockApplications.value.find(item => item.id === id) || null : null
})
const selectedMockBusinessScenario = computed(() =>
  runEnvironmentMockBusinessScenarios.value.find(item => item.id === selectedMockBusinessScenarioId.value) || null,
)
const runEnvironmentHeaders = computed(() => normalizeRunEnvironmentHeaders(runEnvironmentConfigJson.value.headers))
const currentEnvironmentName = computed(() => selectedEnvironment.value?.name || '未选择环境')
const currentVariableSetName = computed(() => selectedEnvironmentDefaultVariableSet.value?.name || '跟随环境')
const responseStatus = computed(() => currentStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => currentStep.value?.durationMs ?? null)
const responseBody = computed(() => currentStep.value?.response?.body ?? '')
const responseBodyPretty = computed(() => {
  if (!responseBody.value) {
    return ''
  }
  return toPrettyJson(responseBody.value)
})
const responseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(currentStep.value?.response?.contentType, responseBody.value),
)
const responseHeaders = computed(() => JSON.stringify(currentStep.value?.response?.headers ?? {}, null, 2))
const actualRequest = computed(() => JSON.stringify(actualRequestPreview(currentStep.value?.request ?? null), null, 2))
const responseDebugError = computed(() =>
  runStepDebugError(currentStep.value, activeEditor.value?.runError, activeEditor.value?.runResult?.failureSummary),
)
const responseConsole = computed(() => buildRunConsolePreview(
  responseDebugError.value,
  currentStep.value?.processorResults ?? [],
  currentStep.value?.assertionResults ?? [],
  currentStep.value?.extractionResults ?? [],
))
const assertionRows = computed(() => currentStep.value?.assertionResults ?? [])
const responseAssertionPresentation = computed(() =>
  assertionRunResultPresentation(assertionRows.value, responseDebugError.value),
)
const caseDetailBodyRawText = computed(() => viewingCaseDetail.value ? getModeBodyText(viewingCaseDetail.value.requestConfig.body) : '')
const caseDetailBodyLanguage = computed<ApiBodyLanguage>(() => bodyLanguage(viewingCaseDetail.value?.requestConfig.body.type))
const caseDetailResponseStatus = computed(() => caseDetailPreviewStep.value?.response?.statusCode ?? null)
const caseDetailResponseDuration = computed(() => caseDetailPreviewStep.value?.durationMs ?? null)
const caseDetailResponseBody = computed(() => toPrettyJson(caseDetailPreviewStep.value?.response?.body || caseDetailPreviewStep.value?.errorMessage || ''))
const caseDetailResponseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(caseDetailPreviewStep.value?.response?.contentType, String(caseDetailPreviewStep.value?.response?.body || '')),
)
const caseDetailResponseHeaders = computed(() => JSON.stringify(caseDetailPreviewStep.value?.response?.headers ?? {}, null, 2))
const caseDetailResponseDebugError = computed(() => runStepDebugError(caseDetailPreviewStep.value))
const caseDetailResponseConsole = computed(() => buildRunConsolePreview(
  caseDetailResponseDebugError.value,
  caseDetailPreviewStep.value?.processorResults ?? [],
  caseDetailPreviewStep.value?.assertionResults ?? [],
  caseDetailPreviewStep.value?.extractionResults ?? [],
))
const caseDetailAssertionRows = computed(() => caseDetailPreviewStep.value?.assertionResults ?? [])
const caseDetailAssertionPresentation = computed(() =>
  assertionRunResultPresentation(caseDetailAssertionRows.value, caseDetailResponseDebugError.value),
)
const caseDetailResponseSize = computed(() => formatResponseSize(caseDetailPreviewStep.value?.response?.body ? new Blob([caseDetailPreviewStep.value.response.body]).size : 0))
const caseDetailActualRequest = computed(() => {
  if (caseDetailPreviewStep.value?.request) {
    return JSON.stringify(actualRequestPreview(caseDetailPreviewStep.value.request), null, 2)
  }
  if (!viewingCaseDetail.value) {
    return '-'
  }
  return JSON.stringify(actualRequestPreviewFromConfig(viewingCaseDetail.value.requestConfig, viewingCaseDetail.value.method, viewingCaseDetail.value.path), null, 2)
})
const caseHistoryRequestHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.request?.headers ?? {}, null, 2))
const caseHistoryRequestBody = computed(() => {
  const request = selectedCaseHistoryStep.value?.request
  if (!request) return '-'
  return toPrettyJson({
    queryParams: request.queryParams ?? [],
    cookies: request.cookies ?? [],
    bodyType: request.bodyType ?? null,
    bodyContentType: request.bodyContentType ?? null,
    bodyFormItems: request.bodyFormItems ?? [],
    bodyFileName: request.bodyFileName ?? null,
    bodyFileContentType: request.bodyFileContentType ?? null,
    body: request.body ?? null,
  })
})
const caseHistoryRequestBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.request?.bodyFileContentType, String(selectedCaseHistoryStep.value?.request?.body || '')),
)
const caseHistoryResponseBody = computed(() => toPrettyJson(selectedCaseHistoryStep.value?.response?.body || selectedCaseHistoryStep.value?.errorMessage || ''))
const caseHistoryResponseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.response?.contentType, String(selectedCaseHistoryStep.value?.response?.body || '')),
)
const caseHistoryResponseHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.response?.headers ?? {}, null, 2))
const caseHistoryDebugError = computed(() => runStepDebugError(selectedCaseHistoryStep.value, null, selectedCaseRunHistoryDetail.value?.failureSummary))
const caseHistoryConsole = computed(() => buildRunConsolePreview(
  caseHistoryDebugError.value,
  selectedCaseHistoryStep.value?.processorResults ?? [],
  selectedCaseHistoryStep.value?.assertionResults ?? [],
  selectedCaseHistoryStep.value?.extractionResults ?? [],
))
const caseHistoryAssertionRows = computed(() => selectedCaseHistoryStep.value?.assertionResults ?? [])
const caseRunHistoryMeta = computed(() => {
  const detail = selectedCaseRunHistoryDetail.value
  return {
    environmentName: detail?.environmentName || '默认',
    variableSetName: detail?.variableSetName || '未选择',
    operator: detail?.operator || '-',
  }
})
const responseSize = computed(() => {
  const text = responseBody.value || ''
  if (!text) {
    return '0 B'
  }
  const bytes = new Blob([text]).size
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
})
const showResponseEmpty = computed(() => !currentStep.value && !activeEditor.value?.runError)
const shouldShowResponsePanel = computed(() => {
  const tab = activeEditor.value?.activeTab
  return tab !== 'cases' && tab !== 'definition'
})
const latestResponseBody = computed(() => String(currentStep.value?.response?.body || ''))
const hasLatestResponseBody = computed(() => Boolean(latestResponseBody.value.trim()))
const fastExtractionTitle = computed(() => (hasLatestResponseBody.value ? '从最近响应快速提取' : '请先发送请求，再使用快速提取'))
const fastExtractionMode = computed<FastExtractionMode>(() => {
  const target = fastExtractionTarget.value
  if (!target) return 'JSON_PATH'
  if (target.kind === 'assertionBody') return normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType)
  return normalizeFastExtractionMode(target.item.extractType)
})
const fastExtractionConfig = computed<FastExtractionConfig>(() => {
  const target = fastExtractionTarget.value
  if (!target) return { extractType: 'JSON_PATH', expression: '$' }
  if (target.kind === 'assertionBody') {
    return {
      extractType: normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType),
      expression: target.item.expression || target.assertion.expression || '',
      responseFormat: normalizeFastExtractionResponseFormat(activeAssertionBodyGroup(target.assertion).responseFormat),
    }
  }
  return {
    extractType: normalizeFastExtractionMode(target.item.extractType),
    expression: target.item.expression || '',
    responseFormat: 'JSON',
  }
})
const batchAddTitle = computed(() => {
  if (batchAddTarget.value === 'assertion') return '批量添加断言'
  if (batchAddTarget.value === 'extractor') return '批量添加提取器'
  if (batchAddTarget.value === 'cookie') return '批量添加 Cookie'
  if (batchAddTarget.value === 'header') return '批量添加请求头'
  if (batchAddTarget.value === 'body-form') return '批量添加表单项'
  return '批量添加 Query 参数'
})
const batchAddHint = computed(() => {
  if (batchAddTarget.value === 'extractor') return '每行一条，左侧为变量名，右侧为表达式，例如 token=$.data.token。'
  if (batchAddTarget.value === 'assertion') return '每行一条，左侧为断言名称，右侧为期望值，例如 status=200。'
  return '每行一条，支持 key=value、key: value 或 tab 分隔。'
})
const batchAddPlaceholder = computed(() => {
  if (batchAddTarget.value === 'extractor') return 'token=$.data.token\ntraceId=$.headers.traceId'
  if (batchAddTarget.value === 'assertion') return '状态码=200\n响应包含=success'
  return 'token=abc\nContent-Type: application/json'
})
const batchAddExamples = computed(() => {
  if (batchAddTarget.value === 'extractor') {
    return ['token=$.data.token', 'traceId: X-Trace-Id', 'userId\t$.data.user.id']
  }
  if (batchAddTarget.value === 'assertion') {
    return ['状态码=200', '响应包含: success', 'traceId\t不为空']
  }
  return ['token=abc', 'Content-Type: application/json', 'page\t1']
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function emptyKeyValue(extra: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: 'string',
    required: false,
    encode: true,
    minLength: null,
    maxLength: null,
    fileName: null,
    fileSize: null,
    contentType: null,
    fileBase64: null,
    ...extra,
  }
}

function emptyRequestConfig(method = 'GET'): ApiRequestConfigInput {
  return {
    method,
    path: '',
    timeoutMs: 10000,
    queryParams: [emptyKeyValue()],
    headers: [emptyKeyValue()],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: '',
      jsonText: '',
      xmlText: '',
      plainText: '',
      formItems: [emptyKeyValue()],
      contentType: null,
      fileName: null,
      fileSize: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: { userName: '', password: '' },
      digestAuth: { userName: '', password: '' },
    },
    schemaFields: [],
  }
}

function createDraftDetail(): ApiDefinitionDetail {
  return {
    id: 0,
    workspaceCode: props.workspaceCode,
    workspaceName: props.workspaceCode,
    name: '新建请求',
    method: 'GET',
    path: '',
    directoryName: null,
    description: '',
    tags: [],
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    requestConfig: emptyRequestConfig(),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
    createdAt: null,
  }
}

function editorTitle(detail: ApiDefinitionDetail) {
  return detail.name?.trim() || detail.requestConfig.path?.trim() || '新建请求'
}

function enabledRows(rows?: ApiKeyValueInput[]) {
  return (rows || []).filter(row => row.enabled !== false && row.key.trim())
}

function setRowsEnabled(rows: ApiKeyValueInput[], checked: unknown) {
  rows.forEach(row => {
    row.enabled = Boolean(checked)
  })
  markDirty()
}

function markDirty() {
  if (activeEditor.value) {
    activeEditor.value.dirty = true
    activeEditor.value.method = activeEditor.value.detail.requestConfig.method
    activeEditor.value.title = editorTitle(activeEditor.value.detail)
  }
}

function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

function bodyLanguage(type?: string | null): ApiBodyLanguage {
  if (type === 'RAW_JSON') return 'json'
  if (type === 'RAW_XML') return 'xml'
  return 'text'
}

function getModeBodyText(body: ApiRequestBodyInput) {
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

function schemaFieldsByLocation(location: string) {
  return activeSchemaFields.value.filter(field => String(field.location || '').toLowerCase() === location)
}

function normalizeDefinitionResponseCode(code?: string | null) {
  const normalized = String(code || '').trim()
  return normalized || '200'
}

function compareDefinitionResponseCode(left: string, right: string) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }
  if (Number.isFinite(leftNumber)) return -1
  if (Number.isFinite(rightNumber)) return 1
  return left.localeCompare(right)
}

function schemaFieldName(field: ApiSchemaFieldInput) {
  return field.fieldPath || field.name || '-'
}

function schemaFieldDepth(field: ApiSchemaFieldInput) {
  const path = field.fieldPath || field.name || ''
  return Math.max(0, path.replace(/\[\]/g, '').split('.').length - 1)
}

function schemaFieldType(field: ApiSchemaFieldInput) {
  const rawType = String(field.type || '').trim()
  const inferredType = rawType || inferSchemaFieldType(field)
  return [inferredType, field.format ? `(${field.format})` : ''].filter(Boolean).join(' ') || '-'
}

function inferSchemaFieldType(field: ApiSchemaFieldInput) {
  if (field.fieldPath?.includes('[]')) return 'array'
  const value = field.example ?? field.defaultValue
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (Array.isArray(value)) return 'array'
  if (value && typeof value === 'object') return 'object'
  if (Array.isArray(field.enumValues) && field.enumValues.length) return 'string'
  return ''
}

function schemaFieldTypeClass(field: ApiSchemaFieldInput) {
  const type = schemaFieldType(field).toLowerCase()
  if (type.includes('array')) return 'is-array'
  if (type.includes('object')) return 'is-object'
  if (type.includes('integer') || type.includes('number')) return 'is-number'
  if (type.includes('boolean')) return 'is-boolean'
  return 'is-string'
}

function schemaFieldEnum(field: ApiSchemaFieldInput) {
  return Array.isArray(field.enumValues) && field.enumValues.length ? field.enumValues.join(' / ') : '-'
}

function schemaFieldLimit(field: ApiSchemaFieldInput) {
  const limits = [
    field.minLength != null || field.maxLength != null ? `长度 ${field.minLength ?? '-'} ~ ${field.maxLength ?? '-'}` : '',
    field.minimum != null || field.maximum != null ? `范围 ${field.minimum ?? '-'} ~ ${field.maximum ?? '-'}` : '',
  ].filter(Boolean)
  return limits.join('；') || '-'
}

function schemaFieldDisplayName(field: ApiSchemaFieldInput) {
  const path = field.fieldPath || field.name || ''
  if (!path) return '-'
  const normalized = path.replace(/\[\]/g, '[]')
  return normalized.split('.').filter(Boolean).pop() || normalized
}

function schemaFieldDescription(field: ApiSchemaFieldInput) {
  return field.description?.trim() || '-'
}

function schemaFieldExampleText(field: ApiSchemaFieldInput) {
  const value = field.example ?? field.defaultValue
  const text = schemaEditableValue(value)
  return text || '-'
}

function schemaFieldRuleText(field: ApiSchemaFieldInput) {
  const enumText = schemaFieldEnum(field)
  const limitText = schemaFieldLimit(field)
  return [enumText !== '-' ? `枚举：${enumText}` : '', limitText !== '-' ? limitText : ''].filter(Boolean).join('；') || '-'
}

function schemaEditableValue(value: unknown) {
  if (value == null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function updateSchemaFieldValue(field: ApiSchemaFieldInput, key: 'description' | 'example' | 'defaultValue', value: string) {
  if (key === 'description') {
    field.description = value
  } else {
    field[key] = value
  }
  markDirty()
}

function updateSchemaRequired(field: ApiSchemaFieldInput, value: unknown) {
  field.required = Boolean(value)
  markDirty()
}

function schemaFieldHasChildren(field: ApiSchemaFieldInput, fields: ApiSchemaFieldInput[]) {
  const path = field.fieldPath || field.name || ''
  if (!path) return false
  return fields.some(item => {
    const itemPath = item.fieldPath || item.name || ''
    return itemPath.startsWith(`${path}.`) || itemPath.startsWith(`${path}[].`)
  })
}

function schemaGeneratedValue(field: ApiSchemaFieldInput, fields: ApiSchemaFieldInput[]) {
  const type = schemaFieldType(field).toLowerCase()
  if (schemaFieldHasChildren(field, fields)) {
    return type.includes('array') || (field.fieldPath || '').endsWith('[]') ? [] : {}
  }
  const source = field.example ?? field.defaultValue ?? (Array.isArray(field.enumValues) && field.enumValues.length ? field.enumValues[0] : null)
  if (source != null && source !== '') {
    if (type.includes('integer') || type.includes('number')) {
      const numberValue = Number(source)
      return Number.isNaN(numberValue) ? 0 : numberValue
    }
    if (type.includes('boolean')) {
      return typeof source === 'boolean' ? source : String(source).toLowerCase() === 'true'
    }
    return source
  }
  if (type.includes('integer') || type.includes('number')) return 0
  if (type.includes('boolean')) return false
  if (type.includes('array')) return []
  if (type.includes('object')) return {}
  return ''
}

function setSchemaPathValue(root: Record<string, unknown>, fieldPath: string, value: unknown) {
  if (!fieldPath) return
  const parts = fieldPath.split('.').filter(Boolean)
  let cursor: Record<string, unknown> = root
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1
    const isArray = part.endsWith('[]')
    const key = isArray ? part.slice(0, -2) : part
    if (!key) return
    if (isLast) {
      if (isArray) {
        cursor[key] = Array.isArray(value) ? value : [value]
      } else {
        cursor[key] = value
      }
      return
    }
    if (isArray) {
      if (!Array.isArray(cursor[key])) cursor[key] = [{}]
      const list = cursor[key] as unknown[]
      if (!list[0] || typeof list[0] !== 'object' || Array.isArray(list[0])) list[0] = {}
      cursor = list[0] as Record<string, unknown>
      return
    }
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  })
}

function buildSchemaExampleText(fields: ApiSchemaFieldInput[]) {
  if (!fields.length) return '-'
  const root: Record<string, unknown> = {}
  fields
    .slice()
    .sort((left, right) => schemaFieldDepth(left) - schemaFieldDepth(right))
    .forEach(field => setSchemaPathValue(root, field.fieldPath || field.name || '', schemaGeneratedValue(field, fields)))
  return toPrettyJson(root)
}

async function generateJsonFromBodySchema() {
  if (!activeDetail.value) return
  const fields = bodySchemaFields.value
  if (!fields.length) {
    ElMessage.info('当前请求体暂无 Schema 字段')
    return
  }
  const currentText = getModeBodyText(activeDetail.value.requestConfig.body).trim()
  if (currentText) {
    const confirmed = await confirmApiAction('当前请求体已有内容，是否用 Schema 示例 JSON 覆盖？', '生成示例 JSON')
    if (!confirmed) return
  }
  const root: Record<string, unknown> = {}
  fields
    .slice()
    .sort((left, right) => schemaFieldDepth(left) - schemaFieldDepth(right))
    .forEach(field => setSchemaPathValue(root, field.fieldPath || field.name || '', schemaGeneratedValue(field, fields)))
  setBodyMode('RAW_JSON')
  setModeBodyText(activeDetail.value.requestConfig.body, toPrettyJson(root), 'RAW_JSON')
  bodyJsonViewMode.value = 'json'
  markDirty()
  ElMessage.success('已根据 Schema 生成示例 JSON')
}

function schemaTypeFromJsonValue(value: unknown) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'string'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'object') return 'object'
  return 'string'
}

function schemaNameFromPath(path: string) {
  const last = path.split('.').filter(Boolean).pop() || path
  return last.replace(/\[\]$/, '')
}

function collectSchemaFieldsFromJson(value: unknown, parentPath = ''): ApiSchemaFieldInput[] {
  if (Array.isArray(value)) {
    const arrayPath = parentPath.endsWith('[]') ? parentPath : `${parentPath}[]`
    const first = value[0]
    if (first && typeof first === 'object') {
      return collectSchemaFieldsFromJson(first, arrayPath)
    }
    return [{
      location: 'body',
      fieldPath: arrayPath,
      name: schemaNameFromPath(arrayPath),
      type: first == null ? 'array' : schemaTypeFromJsonValue(first),
      format: null,
      required: false,
      description: '',
      example: first ?? '',
      defaultValue: null,
      enumValues: [],
      minLength: null,
      maxLength: null,
      minimum: null,
      maximum: null,
    }]
  }
  if (value && typeof value === 'object') {
    const fields: ApiSchemaFieldInput[] = []
    Object.entries(value as Record<string, unknown>).forEach(([key, childValue]) => {
      const fieldPath = parentPath ? `${parentPath}.${key}` : key
      const type = schemaTypeFromJsonValue(childValue)
      fields.push({
        location: 'body',
        fieldPath,
        name: key,
        type,
        format: null,
        required: false,
        description: '',
        example: type === 'object' || type === 'array' ? null : childValue,
        defaultValue: null,
        enumValues: [],
        minLength: null,
        maxLength: null,
        minimum: null,
        maximum: null,
      })
      if ((childValue && typeof childValue === 'object') || Array.isArray(childValue)) {
        fields.push(...collectSchemaFieldsFromJson(childValue, fieldPath))
      }
    })
    return fields
  }
  return []
}

function replaceBodySchemaFields(fields: ApiSchemaFieldInput[]) {
  if (!activeDetail.value) return
  const current = activeDetail.value.requestConfig.schemaFields || []
  activeDetail.value.requestConfig.schemaFields = [
    ...current.filter(field => String(field.location || '').toLowerCase() !== 'body'),
    ...fields,
  ]
  markDirty()
}

async function generateBodySchemaFromJson() {
  if (!activeDetail.value) return
  const currentText = getModeBodyText(activeDetail.value.requestConfig.body).trim()
  if (!currentText) {
    ElMessage.info('当前 JSON 请求体为空')
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(currentText)
  } catch {
    ElMessage.warning('当前请求体不是合法 JSON，无法生成 Schema')
    return
  }
  const fields = collectSchemaFieldsFromJson(parsed)
  if (!fields.length) {
    ElMessage.info('当前 JSON 未解析出可用字段')
    return
  }
  if (bodySchemaFields.value.length) {
    const confirmed = await confirmApiAction('当前请求体已有 Schema，是否用当前 JSON 重新生成？', '生成 Schema')
    if (!confirmed) return
  }
  replaceBodySchemaFields(fields)
  bodyJsonViewMode.value = 'schema'
  ElMessage.success('已根据 JSON 生成请求体 Schema')
}

function setModeBodyText(body: ApiRequestBodyInput, value: string, type = body.type) {
  if (type === 'RAW_JSON') {
    body.jsonText = value
  } else if (type === 'RAW_XML') {
    body.xmlText = value
  } else if (type === 'RAW_TEXT') {
    body.plainText = value
  }
  body.rawText = value
}

function hydrateBodyModeText(body: ApiRequestBodyInput) {
  const rawText = body.rawText ?? ''
  body.jsonText = body.type === 'RAW_JSON' ? rawText : (body.jsonText ?? '')
  body.xmlText = body.type === 'RAW_XML' ? rawText : (body.xmlText ?? '')
  body.plainText = body.type === 'RAW_TEXT' ? rawText : (body.plainText ?? '')
}

function syncRequestBodyRawText(requestConfig: ApiRequestConfigInput) {
  if (isRawBodyType(requestConfig.body.type)) {
    setModeBodyText(requestConfig.body, getModeBodyText(requestConfig.body), requestConfig.body.type)
  }
}

function payloadRequestConfig(detail: ApiDefinitionDetail): ApiRequestConfigInput {
  syncRequestBodyRawText(detail.requestConfig)
  const requestConfig = clone({
    ...detail.requestConfig,
    method: detail.requestConfig.method || 'GET',
    path: detail.requestConfig.path || '',
    timeoutMs: Number(detail.requestConfig.timeoutMs || 10000),
  })
  delete requestConfig.body.jsonText
  delete requestConfig.body.xmlText
  delete requestConfig.body.plainText
  return requestConfig
}

function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

function statusTone(status: number | null) {
  if (status == null) return 'empty'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400) return 'danger'
  return 'warning'
}

function formatFileSize(size?: number | null) {
  if (!size) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(value?: number | null) {
  if (value == null) return '-'
  return `${value} ms`
}

function formatResponseSize(value?: number | null) {
  return formatFileSize(value)
}

function inferResponseBodyLanguage(contentType?: string | null, bodyText = ''): 'json' | 'xml' | 'text' {
  const normalizedContentType = String(contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (normalizedContentType.includes('json')) return 'json'
  if (normalizedContentType.includes('xml') || normalizedContentType.includes('html')) return 'xml'
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      return 'text'
    }
  }
  if (text.startsWith('<') && text.endsWith('>')) return 'xml'
  return 'text'
}

function runResultLabel(result?: string | null) {
  if (!result) return '-'
  const normalized = String(result).toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return '通过'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return '失败'
  if (['RUNNING', 'PENDING'].includes(normalized)) return '执行中'
  if (normalized === 'NO_ASSERTION') return '无断言'
  return result
}

function runResultClass(result?: string | null) {
  const normalized = String(result || '').toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return 'is-passed'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return 'is-failed'
  return 'is-neutral'
}

function reportObjectTypeLabel(value?: string | null) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'API_CASE') return '接口用例'
  if (normalized === 'SUITE') return '执行套件'
  if (normalized === 'SCENARIO') return '场景'
  return value || '-'
}

function reportPassedText(item: Pick<ApiAutomationReportItem, 'successCount' | 'totalCount' | 'statusCode'>) {
  if (item.totalCount != null) {
    return `${item.successCount ?? 0}/${item.totalCount}`
  }
  return item.statusCode == null ? '-' : `HTTP ${item.statusCode}`
}

function reportFailureRateText(value?: number | null) {
  if (value == null) return '0%'
  const normalized = value > 1 ? value : value * 100
  return `${normalized.toFixed(normalized >= 10 || normalized === 0 ? 0 : 1)}%`
}

function reportAnalysisSummaryRows(analysis: ApiAutomationReportAnalysis | null) {
  return [
    { label: '运行总数', value: String(analysis?.totalCount ?? 0), tone: 'neutral' },
    { label: '失败数', value: String(analysis?.failedCount ?? 0), tone: (analysis?.failedCount ?? 0) > 0 ? 'danger' : 'neutral' },
    { label: '失败率', value: reportFailureRateText(analysis?.failureRate), tone: (analysis?.failureRate ?? 0) > 0 ? 'danger' : 'neutral' },
    { label: '平均耗时', value: formatDuration(analysis?.averageDurationMs), tone: 'neutral' },
  ]
}

function reportTrendBarWidth(totalCount?: number | null) {
  const maxCount = Math.max(1, ...(reportStatistics.value?.trendPoints.map(point => point.totalCount) ?? [1]))
  return `${Math.max(4, Math.round(((totalCount ?? 0) / maxCount) * 100))}%`
}

function reportFailureRateWidth(value?: number | null) {
  const normalized = value == null ? 0 : value > 1 ? value : value * 100
  return `${Math.max(0, Math.min(100, normalized))}%`
}

function reportDistributionWidth(count?: number | null, source: 'result' | 'objectType' = 'result') {
  const items = source === 'result'
    ? reportStatistics.value?.resultDistribution
    : reportStatistics.value?.objectTypeDistribution
  const maxCount = Math.max(1, ...(items?.map(item => item.count) ?? [1]))
  return `${Math.max(4, Math.round(((count ?? 0) / maxCount) * 100))}%`
}

function reportDetailSummaryRows(detail: ApiAutomationReportDetail) {
  return [
    ['对象类型', reportObjectTypeLabel(detail.objectType)],
    ['执行对象', detail.objectName || '-'],
    ['\u6240\u5c5e\u7a7a\u95f4', detail.workspaceName || detail.workspaceCode || '-'],
    ['执行结果', runResultLabel(detail.result)],
    ['\u901a\u8fc7\u6570', reportPassedText(detail)],
    ['\u5931\u8d25\u6570', String(detail.failedCount ?? 0)],
    ['\u8df3\u8fc7\u6570', String(detail.skippedCount ?? 0)],
    ['状态码', detail.statusCode == null ? '-' : String(detail.statusCode)],
    ['耗时', formatDuration(detail.durationMs)],
    ['响应大小', formatResponseSize(detail.responseSize)],
    ['执行环境', detail.environmentName || '默认'],
    ['\u53d8\u91cf\u96c6', detail.variableSetName || '\u672a\u9009\u62e9'],
    ['运行模式', detail.runMode || '-'],
    ['\u8fd0\u884c\u4e8e', detail.runOn || '-'],
    ['触发来源', detail.triggerSource || '-'],
    ['执行中', detail.operatorName || '系统'],
    ['执行时间', formatDateTime(detail.createdAt)],
  ].filter(([, value]) => value !== '-' || detail.objectType === 'SUITE')
}

function hasBodyContent(body: ApiDefinitionDetail['requestConfig']['body']) {
  if (body.type === 'NONE') return false
  if (['FORM_DATA', 'FORM_URLENCODED'].includes(body.type)) return body.formItems.some(row => row.key || row.value || row.fileName)
  if (body.type === 'BINARY') return Boolean(body.fileName)
  return Boolean(body.rawText || body.jsonText || body.xmlText || body.plainText)
}

function pickCaseDetailDefaultRequestTab(detail: ApiDefinitionCaseDetail): ApiCaseDetailRequestTab {
  if (detail.requestConfig.queryParams.some(row => row.key || row.value)) return 'params'
  if (hasBodyContent(detail.requestConfig.body)) return 'body'
  if (detail.requestConfig.headers.some(row => row.key || row.value)) return 'headers'
  if (detail.requestConfig.authConfig.authType !== 'NONE') return 'auth'
  return 'params'
}

function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function readDebugFile(file: File) {
  if (file.size > maxDebugFileBytes) {
    ElMessage.warning(`文件过大，请选择 ${formatFileSize(maxDebugFileBytes)} 以内的文件`)
    return null
  }
  return {
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
    base64: await readFileBase64(file),
  }
}

async function handleFormFileChange(row: ApiKeyValueInput, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const payload = await readDebugFile(file)
    if (!payload) return
    row.fileName = payload.fileName
    row.fileSize = payload.fileSize
    row.contentType = payload.contentType
    row.fileBase64 = payload.base64
    row.value = payload.fileName
    markDirty()
  } catch {
    ElMessage.error('文件读取失败')
  }
}

function clearFormFile(row: ApiKeyValueInput) {
  row.fileName = null
  row.fileSize = null
  row.contentType = null
  row.fileBase64 = null
  row.value = ''
  markDirty()
}

async function handleBinaryFileChange(event: Event) {
  if (!activeEditor.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const payload = await readDebugFile(file)
    if (!payload) return
    const body = activeEditor.value.detail.requestConfig.body
    body.fileName = payload.fileName
    body.fileSize = payload.fileSize
    body.contentType = payload.contentType
    body.binaryBase64 = payload.base64
    markDirty()
  } catch {
    ElMessage.error('文件读取失败')
  }
}

function clearBinaryFile() {
  if (!activeEditor.value) return
  const body = activeEditor.value.detail.requestConfig.body
  body.fileName = null
  body.fileSize = null
  body.contentType = null
  body.binaryBase64 = null
  markDirty()
}

function assertionRowsFor(detail: ApiDefinitionDetail): ApiAssertionConfig[] {
  const rows = detail.assertions as ApiAssertionConfig[]
  rows.forEach(normalizeAssertion)
  return rows
}

function normalizeAssertion(assertion: ApiAssertionConfig) {
  const type = normalizeAssertionType(assertion.assertionType || assertion.type)
  assertion.id = assertion.id || `assertion-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  assertion.enabled = assertion.enabled !== false
  assertion.assertionType = type
  assertion.type = type
  assertion.name = assertion.name || defaultAssertionName(type)
  assertion.condition = normalizeAssertionCondition(assertion.condition || assertion.operator)
  assertion.operator = assertion.operator || assertion.condition
  assertion.expressionType = assertion.expressionType || defaultAssertionExpressionType(type)
  assertion.expression = assertion.expression || ''
  assertion.expectedValue = assertion.expectedValue || ''
  if (type === 'RESPONSE_CODE') {
    assertion.expectedValue = assertion.expectedValue || '200'
  }
  if (type === 'RESPONSE_HEADER') {
    assertion.expressionType = 'HEADER'
    assertion.assertions = normalizeAssertionItems(assertion.assertions, {
      header: assertion.subject || assertion.expression || '',
      condition: assertion.condition,
      expectedValue: assertion.expectedValue,
    })
  }
  if (type === 'RESPONSE_BODY') {
    assertion.assertionBodyType = normalizeAssertionExpressionType(assertion.assertionBodyType || assertion.expressionType)
    assertion.expressionType = assertion.assertionBodyType
    assertion.jsonPathAssertion = normalizeAssertionGroup(assertion.jsonPathAssertion, assertion, 'JSON_PATH')
    assertion.xpathAssertion = normalizeAssertionGroup(assertion.xpathAssertion, assertion, 'X_PATH')
    assertion.regexAssertion = normalizeAssertionGroup(assertion.regexAssertion, assertion, 'REGEX')
  }
  if (type === 'RESPONSE_TIME') {
    assertion.condition = normalizeAssertionCondition(assertion.condition || 'LT_OR_EQUALS')
    assertion.expectedValue = assertion.expectedValue || '1000'
  }
  if (type === 'VARIABLE') {
    assertion.expressionType = 'VARIABLE'
    assertion.variableAssertionItems = normalizeAssertionItems(assertion.variableAssertionItems, {
      variableName: assertion.subject || assertion.expression || '',
      condition: assertion.condition,
      expectedValue: assertion.expectedValue,
    })
  }
  if (type === 'SCRIPT') {
    assertion.expressionType = 'SCRIPT'
    assertion.scriptLanguage = assertion.scriptLanguage || 'JavaScript'
    assertion.script = assertion.script ?? ''
  }
}

function normalizeAssertionType(type?: string | null) {
  const value = (type || 'RESPONSE_CODE').toUpperCase()
  if (value === 'STATUS_CODE') return 'RESPONSE_CODE'
  if (value === 'HEADER_EQUALS' || value === 'HEADER_CONTAINS') return 'RESPONSE_HEADER'
  if (value === 'BODY_JSONPATH_EQUALS' || value === 'BODY_JSONPATH_CONTAINS') return 'RESPONSE_BODY'
  if (value === 'RESPONSE_TIME_LE') return 'RESPONSE_TIME'
  return assertionTypeOptions.some(item => item.value === value) ? value : 'RESPONSE_CODE'
}

function normalizeAssertionCondition(condition?: string | null) {
  const value = (condition || 'EQUALS').toUpperCase()
  if (value === 'HEADER_CONTAINS' || value === 'BODY_JSONPATH_CONTAINS') return 'CONTAINS'
  if (value === 'RESPONSE_TIME_LE') return 'LT_OR_EQUALS'
  return assertionConditionOptions.some(item => item.value === value) ? value : 'EQUALS'
}

function normalizeAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
  const value = (type || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  if (value === 'X_PATH' || value === 'REGEX') return value
  return 'JSON_PATH'
}

function defaultAssertionName(type?: string | null) {
  return assertionTypeLabel(type) || '断言'
}

function assertionTypeLabel(type?: string | null) {
  return assertionTypeOptions.find(item => item.value === normalizeAssertionType(type))?.label || '断言'
}

function defaultAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
  const normalizedType = normalizeAssertionType(type)
  if (normalizedType === 'RESPONSE_HEADER') return 'HEADER'
  if (normalizedType === 'VARIABLE') return 'VARIABLE'
  if (normalizedType === 'SCRIPT') return 'SCRIPT'
  return 'JSON_PATH'
}

function defaultAssertionExpression(type?: ApiAssertionExpressionType | string | null) {
  if (type === 'X_PATH') return '/root'
  if (type === 'REGEX') return '.+'
  return '$.data'
}

function normalizeAssertionItem(item: ApiAssertionItemConfig): ApiAssertionItemConfig {
  Object.assign(item, {
    enabled: item.enabled !== false,
    condition: normalizeAssertionCondition(item.condition || item.operator),
    operator: normalizeAssertionCondition(item.condition || item.operator),
    expectedValue: item.expectedValue ?? '',
  })
  return item
}

function normalizeAssertionItems(items: ApiAssertionItemConfig[] | undefined, fallback: ApiAssertionItemConfig): ApiAssertionItemConfig[] {
  const source = items?.length ? items : [fallback]
  source.forEach(normalizeAssertionItem)
  return source
}

function normalizeAssertionGroup(group: ApiAssertionGroupConfig | undefined, assertion: ApiAssertionConfig, type: ApiAssertionExpressionType): ApiAssertionGroupConfig {
  const fallbackExpression = type === 'JSON_PATH'
    ? assertion.expression || defaultAssertionExpression(type)
    : defaultAssertionExpression(type)
  const next = group || { assertions: [] }
  next.responseFormat = next.responseFormat || 'XML'
  next.assertions = normalizeAssertionItems(next.assertions, {
    expression: fallbackExpression,
    condition: assertion.condition,
    expectedValue: type === 'JSON_PATH' ? assertion.expectedValue : '',
  })
  return next
}

function activeAssertionRows() {
  return activeEditor.value ? assertionRowsFor(activeEditor.value.detail) : []
}

const activeAssertion = computed(() => {
  const rows = activeAssertionRows()
  if (!rows.length) return null
  return rows.find(item => item.id === activeAssertionId.value) || rows[0]
})

function extractorRowsFor(detail: ApiDefinitionDetail): ApiExtractorConfig[] {
  const rows = detail.extractors as ApiExtractorConfig[]
  rows.forEach(normalizeExtractor)
  return rows
}

function normalizeExtractor(extractor: ApiExtractorConfig) {
  extractor.enabled = extractor.enabled !== false
  extractor.source = extractor.source || extractor.sourceType || 'RESPONSE_BODY'
  extractor.sourceType = extractor.sourceType || extractor.source
  extractor.extractType = extractor.extractType || extractor.expressionType || 'JSON_PATH'
  extractor.expressionType = extractor.expressionType || extractor.extractType
  extractor.name = extractor.name || extractor.variableName || '响应提取'
  extractor.variableName = extractor.variableName || extractor.name
  extractor.expression = extractor.expression || '$.data'
}

function processorRowsFor(detail: ApiDefinitionDetail, stage: 'pre' | 'post'): ApiProcessorConfig[] {
  const rows = (stage === 'pre' ? detail.preProcessors : detail.postProcessors) as ApiProcessorConfig[]
  rows.forEach(row => normalizeProcessorDefaults(row, stage))
  return rows
}

function activeProcessorRows() {
  if (!activeEditor.value) return []
  const stage = activeEditor.value.activeTab === 'pre' ? 'pre' : 'post'
  return processorRowsFor(activeEditor.value.detail, stage)
}

function activeProcessorStage(): 'pre' | 'post' {
  return activeEditor.value?.activeTab === 'pre' ? 'pre' : 'post'
}

const activeProcessor = computed(() => {
  const rows = activeProcessorRows()
  if (!rows.length) return null
  return rows.find(item => item.id === activeProcessorId.value) || rows[0]
})

function normalizeProcessorDefaults(processor: ApiProcessorConfig, stage: 'pre' | 'post') {
  const type = processor.processorType || 'SCRIPT'
  processor.id = processor.id || `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  processor.enabled = processor.enabled !== false
  processor.name = processor.name || processorDefaultName(stage, type)
  if (type === 'TIME_WAITING') {
    processor.delayMs = processor.delayMs || 1000
  }
  if (type === 'SCRIPT') {
    processor.script = processor.script ?? ''
  }
  if (type === 'SQL') {
    processor.sql = processor.sql ?? processor.script ?? ''
    processor.script = processor.sql
    processor.dataSourceId = processor.dataSourceId ?? null
    processor.dataSourceName = processor.dataSourceName ?? ''
    processor.queryTimeout = processor.queryTimeout || 30000
    processor.variableNames = processor.variableNames ?? ''
    processor.resultVariable = processor.resultVariable ?? ''
    processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
  }
  if (type === 'EXTRACT') {
    processor.sourceType = processor.sourceType || 'RESPONSE_BODY'
    processor.extractType = processor.extractType || 'JSON_PATH'
    processor.expression = processor.expression ?? processor.script ?? ''
    processor.variableName = processor.variableName ?? ''
    processor.script = processor.expression
    processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
  }
}

function createAssertion(type = 'RESPONSE_CODE', name?: string, expectedValue?: string): ApiAssertionConfig {
  const normalizedType = normalizeAssertionType(type)
  const assertion: ApiAssertionConfig = {
    id: `assertion-${normalizedType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assertionType: normalizedType,
    type: normalizedType,
    name: name || defaultAssertionName(normalizedType),
    enabled: true,
    subject: '',
    expressionType: defaultAssertionExpressionType(normalizedType),
    expression: '',
    condition: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
    operator: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
    expectedValue: expectedValue || (normalizedType === 'RESPONSE_CODE' ? '200' : normalizedType === 'RESPONSE_TIME' ? '1000' : ''),
    script: null,
  }
  normalizeAssertion(assertion)
  return assertion
}

function addAssertion(type = 'RESPONSE_CODE') {
  if (!activeEditor.value) return
  const assertion = createAssertion(type)
  assertionRowsFor(activeEditor.value.detail).push(assertion)
  activeAssertionId.value = assertion.id || ''
  markDirty()
}

function addAssertionFromCommand(command: string | number | object) {
  addAssertion(String(command))
}

function removeAssertion(index: number) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const removed = rows.splice(index, 1)
  if (removed.some(item => item.id === activeAssertionId.value)) {
    activeAssertionId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
  }
  markDirty()
}

function selectAssertion(assertion: ApiAssertionConfig) {
  activeAssertionId.value = assertion.id || ''
}

function copyAssertion(index: number) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const source = rows[index]
  if (!source) return
  const copied = {
    ...clone(source),
    id: `assertion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name || '断言'} 副本`,
  }
  rows.splice(index + 1, 0, copied)
  activeAssertionId.value = copied.id || ''
  markDirty()
}

function moveAssertion(index: number, direction: -1 | 1) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(targetIndex, 0, row)
  markDirty()
}

function activeAssertionBodyGroup(assertion: ApiAssertionConfig): ApiAssertionGroupConfig {
  normalizeAssertion(assertion)
  if (assertion.assertionBodyType === 'X_PATH') return assertion.xpathAssertion!
  if (assertion.assertionBodyType === 'REGEX') return assertion.regexAssertion!
  return assertion.jsonPathAssertion!
}

function addAssertionItem(items: ApiAssertionItemConfig[], fallback: ApiAssertionItemConfig = {}) {
  items.push(normalizeAssertionItem({
    enabled: true,
    condition: 'EQUALS',
    expectedValue: '',
    ...fallback,
  }))
  markDirty()
}

function copyAssertionItem(items: ApiAssertionItemConfig[], index: number) {
  const source = items[index]
  if (!source) return
  items.splice(index + 1, 0, clone(source))
  markDirty()
}

function removeAssertionItem(items: ApiAssertionItemConfig[], index: number, fallback: ApiAssertionItemConfig) {
  items.splice(index, 1)
  if (!items.length) {
    items.push(normalizeAssertionItem(fallback))
  }
  markDirty()
}

function updateAssertionResponseTime(assertion: ApiAssertionConfig | null, value: number | undefined) {
  if (!assertion) return
  assertion.expectedValue = String(value || 1000)
  assertion.condition = 'LT_OR_EQUALS'
  assertion.operator = 'LT_OR_EQUALS'
  markDirty()
}

function testAssertionExpression(assertion: ApiAssertionConfig, item?: ApiAssertionItemConfig) {
  if (!currentStep.value) {
    ElMessage.info('请先发送请求，再测试表达式')
    return
  }
  if (assertion.assertionType === 'RESPONSE_CODE') {
    ElMessage.success(`当前响应码：${currentStep.value.response?.statusCode ?? '-'}`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_HEADER') {
    const key = item?.header || assertion.expression || assertion.subject || ''
    const value = key ? (currentStep.value.response?.headers as Record<string, unknown> | undefined)?.[key] : undefined
    ElMessage.info(value == null ? '未在最近响应头中找到该字段' : `匹配值：${String(value)}`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_TIME') {
    ElMessage.info(`最近耗时：${currentStep.value.durationMs ?? '-'} ms`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_BODY' && (assertion.assertionBodyType || assertion.expressionType) === 'JSON_PATH') {
    try {
      const body = JSON.parse(String(currentStep.value.response?.body || '{}')) as Record<string, unknown>
      const expression = item?.expression || assertion.expression || ''
      const key = expression.replace(/^\$\./, '')
      const value = key ? key.split('.').reduce<unknown>((acc, part) => {
        if (!acc || typeof acc !== 'object') return undefined
        return (acc as Record<string, unknown>)[part]
      }, body) : body
      ElMessage.info(value == null ? '未在最近响应体中匹配到值' : `匹配值：${String(value)}`)
    } catch {
      ElMessage.warning('最近响应体不是可解析的 JSON')
    }
    return
  }
  ElMessage.info('当前表达式类型需要后端执行时验证')
}

function normalizeFastExtractionMode(type?: string | null): FastExtractionMode {
  if (type === 'X_PATH' || type === 'REGEX') return type
  return 'JSON_PATH'
}

function normalizeFastExtractionResponseFormat(format?: string | null): FastExtractionResponseFormat {
  if (format === 'XML' || format === 'HTML') return format
  return 'JSON'
}

function openAssertionFastExtraction(assertion: ApiAssertionConfig, item: ApiAssertionItemConfig) {
  if (!hasLatestResponseBody.value) return
  fastExtractionTarget.value = { kind: 'assertionBody', assertion, item }
  fastExtractionVisible.value = true
}

function openProcessorFastExtraction(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  if (!hasLatestResponseBody.value) return
  fastExtractionTarget.value = { kind: 'processorExtract', processor, item }
  fastExtractionVisible.value = true
}

function applyFastExtraction(config: FastExtractionConfig, matchResult: string[]) {
  const target = fastExtractionTarget.value
  if (!target) return
  const expression = config.expression || ''
  if (target.kind === 'assertionBody') {
    target.assertion.assertionType = 'RESPONSE_BODY'
    target.assertion.type = 'RESPONSE_BODY'
    target.assertion.assertionBodyType = config.extractType || 'JSON_PATH'
    target.assertion.expressionType = target.assertion.assertionBodyType
    const group = activeAssertionBodyGroup(target.assertion)
    if (config.responseFormat) group.responseFormat = config.responseFormat
    target.item.expression = expression
    target.assertion.expression = expression
    if (matchResult[0] !== undefined) {
      target.item.expectedValue = matchResult[0]
      target.assertion.expectedValue = matchResult[0]
    }
  } else {
    target.item.extractType = config.extractType || 'JSON_PATH'
    target.item.expression = expression
    syncProcessorScript(target.processor)
  }
  markDirty()
  ElMessage.success('已回填快速提取表达式')
}

function firstJsonAssertionCandidate() {
  const bodyText = String(currentStep.value?.response?.body || '')
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const firstKey = ['code', 'success', 'message', 'data'].find(key => key in body)
    if (!firstKey) return null
    return { expression: `$.${firstKey}`, value: String(body[firstKey] ?? '') }
  } catch {
    return null
  }
}

function addAssertionFromLatestResponse(type: 'code' | 'header' | 'body') {
  if (!activeEditor.value) return
  if (!currentStep.value) {
    ElMessage.info('请先发送请求，再从最近响应生成断言')
    return
  }
  const rows = assertionRowsFor(activeEditor.value.detail)
  if (type === 'code') {
    const assertion = createAssertion('RESPONSE_CODE', '响应码等于当前值', String(currentStep.value.response?.statusCode ?? 200))
    rows.push(assertion)
    activeAssertionId.value = assertion.id || ''
    markDirty()
    ElMessage.success('已生成响应码断言')
    return
  }
  if (type === 'header') {
    const headers = currentStep.value.response?.headers as Record<string, unknown> | undefined
    const key = Object.keys(headers || {})[0]
    if (!key) {
      ElMessage.info('最近响应没有可提取的响应头')
      return
    }
    const assertion = createAssertion('RESPONSE_HEADER', `响应头 ${key}`, String(headers?.[key] ?? ''))
    assertion.expression = key
    assertion.subject = key
    assertion.assertions = [{ header: key, condition: 'EQUALS', expectedValue: String(headers?.[key] ?? '') }]
    normalizeAssertion(assertion)
    rows.push(assertion)
    activeAssertionId.value = assertion.id || ''
    markDirty()
    ElMessage.success('已生成响应头断言')
    return
  }
  const candidate = firstJsonAssertionCandidate()
  if (!candidate) {
    ElMessage.info('最近响应体不是可快速提取的 JSON 字段')
    return
  }
  const assertion = createAssertion('RESPONSE_BODY', '响应体 JSONPath 断言', candidate.value)
  assertion.expressionType = 'JSON_PATH'
  assertion.assertionBodyType = 'JSON_PATH'
  assertion.expression = candidate.expression
  assertion.jsonPathAssertion = {
    assertions: [{
      expression: candidate.expression,
      condition: 'EQUALS',
      expectedValue: candidate.value,
    }],
  }
  normalizeAssertion(assertion)
  rows.push(assertion)
  activeAssertionId.value = assertion.id || ''
  markDirty()
  ElMessage.success('已生成响应体 JSONPath 断言')
}

function addAssertionFromLatestResponseCommand(command: string | number | object) {
  const value = String(command)
  if (value === 'code' || value === 'header' || value === 'body') {
    addAssertionFromLatestResponse(value)
  }
}

function clampResponsePanelHeight(value: number) {
  return Math.min(responsePanelMaxHeight, Math.max(responsePanelMinHeight, Math.round(value)))
}

function persistResponsePanelHeight() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(responsePanelHeightStorageKey, String(responsePanelHeight.value))
}

function handleResponseResizeMove(event: PointerEvent) {
  const nextHeight = responseResizeStartHeight - (event.clientY - responseResizeStartY)
  responsePanelHeight.value = clampResponsePanelHeight(nextHeight)
}

function stopResponseResize() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', handleResponseResizeMove)
  window.removeEventListener('pointerup', stopResponseResize)
  persistResponsePanelHeight()
}

function startResponseResize(event: PointerEvent) {
  if (typeof window === 'undefined') return
  responseResizeStartY = event.clientY
  responseResizeStartHeight = responsePanelHeight.value
  window.addEventListener('pointermove', handleResponseResizeMove)
  window.addEventListener('pointerup', stopResponseResize, { once: true })
}

function restoreResponsePanelHeight() {
  if (typeof window === 'undefined') return
  const savedHeight = Number(window.localStorage.getItem(responsePanelHeightStorageKey))
  if (Number.isFinite(savedHeight) && savedHeight >= responsePanelMinHeight) {
    responsePanelHeight.value = clampResponsePanelHeight(savedHeight)
  }
}

function createExtractor(name = '响应提取', expression = '$.data', variableName?: string): ApiExtractorConfig {
  const normalizedName = name.trim() || '响应提取'
  return {
    id: `extractor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    enabled: true,
    source: 'RESPONSE_BODY',
    sourceType: 'RESPONSE_BODY',
    extractType: 'JSON_PATH',
    expressionType: 'JSON_PATH',
    expression: expression.trim() || '$.data',
    variableName: variableName?.trim() || normalizedName,
    defaultValue: '',
    required: false,
    failOnMissing: false,
    description: '',
  }
}

function addExtractor() {
  if (!activeEditor.value) return
  extractorRowsFor(activeEditor.value.detail).push(createExtractor())
  markDirty()
}

function removeExtractor(index: number) {
  if (!activeEditor.value) return
  extractorRowsFor(activeEditor.value.detail).splice(index, 1)
  markDirty()
}

function createProcessor(stage: 'pre' | 'post', type = 'SCRIPT'): ApiProcessorConfig {
  const processor: ApiProcessorConfig = {
    id: `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    processorType: type,
    name: processorDefaultName(stage, type),
    enabled: true,
    script: type === 'TIME_WAITING' ? null : '',
    sql: type === 'SQL' ? '' : null,
    dataSourceId: type === 'SQL' ? null : null,
    dataSourceName: type === 'SQL' ? '' : null,
    queryTimeout: type === 'SQL' ? 30000 : null,
    variableNames: type === 'SQL' ? '' : null,
    resultVariable: type === 'SQL' ? '' : null,
    extractParams: type === 'SQL' ? [] : [],
    delayMs: type === 'TIME_WAITING' ? 1000 : null,
    sourceType: type === 'EXTRACT' ? 'RESPONSE_BODY' : null,
    extractType: type === 'EXTRACT' ? 'JSON_PATH' : null,
    expression: type === 'EXTRACT' ? '' : null,
    variableName: type === 'EXTRACT' ? '' : null,
    extractors: type === 'EXTRACT' ? [createProcessorExtractItem()] : [],
  }
  return processor
}

function createProcessorExtractItem(patch: Partial<ApiProcessorExtractItem> = {}): ApiProcessorExtractItem {
  return {
    id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    name: '',
    variableName: '',
    description: '',
    variableType: 'TEMPORARY',
    sourceType: 'RESPONSE_BODY',
    extractScope: 'BODY',
    extractType: 'JSON_PATH',
    expression: '',
    expressionMatchingRule: 'EXPRESSION',
    resultMatchingRule: 'RANDOM',
    resultMatchingRuleNum: 1,
    responseFormat: 'JSON',
    ...patch,
  }
}

function processorExtractScopeFromSource(source?: string | null) {
  if (source === 'RESPONSE_HEADER') return 'RESPONSE_HEADERS'
  if (source === 'REQUEST_HEADER') return 'REQUEST_HEADERS'
  if (source === 'STATUS_CODE') return 'RESPONSE_CODE'
  if (source === 'URL') return 'URL'
  return 'BODY'
}

function processorSourceFromExtractScope(scope?: string | null) {
  if (scope === 'RESPONSE_HEADERS') return 'RESPONSE_HEADER'
  if (scope === 'REQUEST_HEADERS') return 'REQUEST_HEADER'
  if (scope === 'RESPONSE_CODE') return 'STATUS_CODE'
  if (scope === 'URL') return 'URL'
  return 'RESPONSE_BODY'
}

function processorExtractScopeOptions(item: ApiProcessorExtractItem) {
  return item.extractType === 'REGEX' ? processorRegexExtractScopeOptions : processorBodyExtractScopeOptions
}

function showProcessorExtractRegexSettings(item: ApiProcessorExtractItem) {
  return item.extractType === 'REGEX'
}

function showProcessorExtractXPathSettings(item: ApiProcessorExtractItem) {
  return item.extractType === 'X_PATH'
}

function showProcessorExtractSpecificIndex(item: ApiProcessorExtractItem) {
  return (item.resultMatchingRule || 'RANDOM') === 'SPECIFIC'
}

function normalizeProcessorExtractByType(item: ApiProcessorExtractItem) {
  const scopeOptions = processorExtractScopeOptions(item)
  if (!scopeOptions.some(option => option.value === item.extractScope)) {
    item.extractScope = 'BODY'
  }
  item.sourceType = processorSourceFromExtractScope(item.extractScope)
  if (item.extractType !== 'REGEX') {
    item.expressionMatchingRule = 'EXPRESSION'
  }
  if (item.extractType === 'JSON_PATH') {
    item.responseFormat = 'JSON'
  } else if (item.extractType === 'X_PATH') {
    item.responseFormat = item.responseFormat === 'HTML' ? 'HTML' : 'XML'
  } else {
    item.responseFormat = item.responseFormat || 'JSON'
  }
}

function processorExtractExpressionPlaceholder(item: ApiProcessorExtractItem) {
  if (item.extractType === 'X_PATH') return '例如 /response/data/token'
  if (item.extractType === 'REGEX') return '例如 \"token\":\"([^\"]+)\"'
  return '例如 $.data.token'
}

function handleProcessorExtractTypeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  normalizeProcessorExtractByType(item)
  syncProcessorScript(processor)
}

function handleProcessorExtractScopeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  item.sourceType = processorSourceFromExtractScope(item.extractScope)
  syncProcessorScript(processor)
}

function setProcessorExtractMoreSettingsVisible(processorId: string | undefined, index: number, visible: boolean) {
  processorExtractMoreSettingsVisibleKey.value = visible && processorId ? `${processorId}-${index}` : null
}

function normalizeProcessorExtractItem(item: ApiProcessorExtractItem): ApiProcessorExtractItem {
  item.id = item.id || `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  item.enabled = item.enabled !== false
  item.name = item.name ?? ''
  item.variableName = item.variableName ?? ''
  item.description = item.description ?? ''
  item.variableType = item.variableType || 'TEMPORARY'
  item.sourceType = item.sourceType || 'RESPONSE_BODY'
  item.extractScope = item.extractScope || processorExtractScopeFromSource(item.sourceType)
  item.extractType = item.extractType || 'JSON_PATH'
  item.expression = item.expression ?? ''
  item.expressionMatchingRule = item.expressionMatchingRule || 'EXPRESSION'
  item.resultMatchingRule = item.resultMatchingRule || 'RANDOM'
  item.resultMatchingRuleNum = item.resultMatchingRuleNum || 1
  item.responseFormat = item.responseFormat || (item.extractType === 'X_PATH' ? 'XML' : 'JSON')
  normalizeProcessorExtractByType(item)
  return item
}

function normalizeProcessorExtractItems(items: ApiProcessorExtractItem[] | undefined, processor: ApiProcessorConfig) {
  const source = items?.length
    ? items
    : [createProcessorExtractItem({
        name: processor.name || '提取项',
        variableName: processor.variableName || '',
        sourceType: processor.sourceType || 'RESPONSE_BODY',
        extractType: processor.extractType || 'JSON_PATH',
        expression: processor.expression || '',
        description: processor.description || '',
      })]
  source.forEach(normalizeProcessorExtractItem)
  return source
}

function normalizeSqlExtractParams(items: ApiProcessorSqlExtractParam[] | undefined) {
  const rows = Array.isArray(items) ? items : []
  rows.forEach(row => {
    row.key = row.key ?? ''
    row.value = row.value ?? ''
    row.enabled = row.enabled !== false
  })
  return rows
}

function addSqlExtractParam(processor: ApiProcessorConfig) {
  processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
  processor.extractParams.push({ key: '', value: '', enabled: true })
  syncProcessorScript(processor)
}

function removeSqlExtractParam(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeSqlExtractParams(processor.extractParams)
  rows.splice(index, 1)
  processor.extractParams = rows
  syncProcessorScript(processor)
}

function processorDefaultName(stage: 'pre' | 'post', type?: string) {
  if (type === 'SCRIPT') return stage === 'pre' ? '前置脚本' : '后置脚本'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return stage === 'pre' ? '前置处理器' : '后置处理器'
}

function processorTypeLabel(type?: string | null) {
  if (type === 'SCRIPT') return '脚本处理器'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return type || '处理器'
}

function addProcessor(stage: 'pre' | 'post', type = 'SCRIPT') {
  if (!activeEditor.value) return
  const processor = createProcessor(stage, type)
  processorRowsFor(activeEditor.value.detail, stage).push(processor)
  activeProcessorId.value = processor.id || ''
  markDirty()
}

function addProcessorFromCommand(stage: 'pre' | 'post', command: string | number | object) {
  const type = String(command)
  if (stage === 'pre' && type === 'EXTRACT') {
    return
  }
  addProcessor(stage, type)
}

function removeProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const removed = rows.splice(index, 1)
  if (removed.some(item => item.id === activeProcessorId.value)) {
    activeProcessorId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
  }
  markDirty()
}

function copyProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const source = rows[index]
  if (!source) return
  const copied = {
    ...clone(source),
    id: `${stage}-${String(source.processorType || 'SCRIPT').toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name || processorDefaultName(stage, source.processorType)} 副本`,
  }
  rows.splice(index + 1, 0, copied)
  activeProcessorId.value = copied.id || ''
  markDirty()
}

function moveProcessor(stage: 'pre' | 'post', index: number, direction: -1 | 1) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(targetIndex, 0, row)
  activeProcessorId.value = row.id || ''
  markDirty()
}

function selectProcessor(processor: ApiProcessorConfig) {
  activeProcessorId.value = processor.id || ''
}

function syncProcessorScript(processor: ApiProcessorConfig) {
  if (processor.processorType === 'SQL') {
    processor.script = processor.sql ?? ''
  } else if (processor.processorType === 'EXTRACT') {
    const firstExtractor = processor.extractors?.[0]
    processor.expression = firstExtractor?.expression ?? processor.expression ?? ''
    processor.variableName = firstExtractor?.variableName ?? processor.variableName ?? ''
    processor.sourceType = firstExtractor?.sourceType ?? processor.sourceType ?? 'RESPONSE_BODY'
    processor.extractType = firstExtractor?.extractType ?? processor.extractType ?? 'JSON_PATH'
    processor.script = processor.expression ?? ''
  }
  markDirty()
}

function addProcessorExtractItem(processor: ApiProcessorConfig) {
  processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
  processor.extractors.push(createProcessorExtractItem())
  syncProcessorScript(processor)
}

function copyProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeProcessorExtractItems(processor.extractors, processor)
  const source = rows[index]
  if (!source) return
  rows.splice(index + 1, 0, { ...clone(source), id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
  processor.extractors = rows
  syncProcessorScript(processor)
}

function removeProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeProcessorExtractItems(processor.extractors, processor)
  rows.splice(index, 1)
  if (!rows.length) rows.push(createProcessorExtractItem())
  processor.extractors = rows
  syncProcessorScript(processor)
}

function buildPayload(detail: ApiDefinitionDetail): SaveApiDefinitionPayload {
  return {
    workspaceCode: props.workspaceCode === 'ALL' ? detail.workspaceCode : props.workspaceCode,
    name: detail.name?.trim() || detail.requestConfig.path?.trim() || '未命名接口',
    directoryName: detail.directoryName || null,
    description: detail.description || null,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    requestConfig: payloadRequestConfig(detail),
    assertions: clone(detail.assertions || []),
    extractors: clone(detail.extractors || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  }
}

function runOptionStorageKey(kind: 'environment' | 'variableSet') {
  return `api-interface:${props.workspaceCode}:${kind}`
}

function restoreRunOptions() {
  const environmentId = Number(localStorage.getItem(runOptionStorageKey('environment')) || '')
  selectedEnvironmentId.value = environmentId && environments.value.some(item => item.id === environmentId) ? environmentId : null
  selectedVariableSetId.value = null
  selectedMockBusinessScenarioId.value = null
  localStorage.removeItem(runOptionStorageKey('variableSet'))
}

function persistRunOptions() {
  if (selectedEnvironmentId.value) {
    localStorage.setItem(runOptionStorageKey('environment'), String(selectedEnvironmentId.value))
  } else {
    localStorage.removeItem(runOptionStorageKey('environment'))
  }
}

function currentRunPayload() {
  return {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    environmentId: selectedEnvironmentId.value || null,
    variableSetId: null,
    mockBusinessScenarioId: selectedMockBusinessScenarioId.value || null,
  }
}

function isAbsoluteRequestPath(path: string) {
  return /^https?:\/\//i.test(path.trim())
}

function startsWithVariable(path: string) {
  return /^(\{\{\s*[\w.-]+\s*}}|\$\{\s*[\w.-]+\s*})/.test(path.trim())
}

function selectedEnvironmentHasBaseUrl() {
  const environment = environments.value.find(item => item.id === selectedEnvironmentId.value)
  return Boolean(environment?.baseUrl?.trim())
}

function formatApiEnvironmentWorkspace(environment: ApiAutomationEnvironmentItem) {
  return environment.workspaceName || environment.workspaceCode || '全部空间'
}

function parseRunEnvironmentConfig(configJson: string) {
  if (!configJson?.trim()) {
    return {} as Record<string, unknown>
  }
  try {
    const parsed = JSON.parse(configJson)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function normalizeRunEnvironmentHeaders(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ key: string; value: string; enabled: boolean }>
  }
  return value
    .filter((item): item is { key?: unknown; value?: unknown; enabled?: unknown } => typeof item === 'object' && item !== null)
    .map(item => ({
      key: typeof item.key === 'string' ? item.key : '',
      value: typeof item.value === 'string' ? item.value : '',
      enabled: item.enabled !== false,
    }))
    .filter(item => item.key)
}

function maskRunEnvironmentValue(key: string, value: string) {
  if (!value) {
    return '-'
  }
  return /authorization|token|secret|password|cookie/i.test(key) ? '••••••••' : value
}

function formatRunEnvironmentStatus(status: number | null | undefined) {
  return status === 0 ? '停用' : '启用'
}

function formatRunEnvironmentTimeout() {
  const value = runEnvironmentConfigJson.value.timeoutMs ?? runEnvironmentConfigJson.value.defaultTimeoutMs
  return typeof value === 'number' ? `${value} ms` : '未配置'
}

function formatRunEnvironmentSsl() {
  const ignoreSsl = runEnvironmentConfigJson.value.ignoreSsl === true || runEnvironmentConfigJson.value.ignoreHttpsErrors === true
  return ignoreSsl ? '忽略 SSL 证书校验' : '校验证书'
}

async function openRunEnvironmentDrawer() {
  if (!selectedEnvironment.value) {
    ElMessage.info('请先选择运行环境')
    return
  }
  runEnvironmentDrawerVisible.value = true
  await loadRunEnvironmentDetail()
}

async function loadRunEnvironmentDetail() {
  const environment = selectedEnvironment.value
  if (!environment) {
    return
  }
  runEnvironmentDetailLoading.value = true
  runEnvironmentDetailErrorMessage.value = ''
  runEnvironmentConfig.value = null
  runEnvironmentMockBusinessScenarios.value = []
  try {
    const workspaceCode = environment.workspaceCode || props.workspaceCode
    const [envPage, paramPage, mockPage] = await Promise.all([
      configApi.getSettingsEnvs(workspaceCode, { keyword: environment.name }),
      configApi.getSettingsParams(workspaceCode),
      configApi.getMockApplications(workspaceCode),
    ])
    runEnvironmentConfig.value = envPage.items.find(item => item.id === environment.id) || null
    runEnvironmentParamSets.value = paramPage.items
    runEnvironmentMockApplications.value = mockPage.items
    const mockApplicationId = runEnvironmentConfigJson.value.mockApplicationId
    if (typeof mockApplicationId === 'number') {
      const businessScenarioPage = await configApi.getMockBusinessScenarios(workspaceCode, {
        appId: mockApplicationId,
        status: 1,
      })
      runEnvironmentMockBusinessScenarios.value = businessScenarioPage.items
      if (
        selectedMockBusinessScenarioId.value
        && !businessScenarioPage.items.some(item => item.id === selectedMockBusinessScenarioId.value)
      ) {
        selectedMockBusinessScenarioId.value = null
      }
    } else {
      selectedMockBusinessScenarioId.value = null
    }
  } catch (error) {
    runEnvironmentDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    runEnvironmentDetailLoading.value = false
  }
}

function goConfigCenterEnv() {
  void router.push('/config-center')
}

function guardRunEnvironmentForPath(path: string) {
  const normalizedPath = path.trim()
  if (!normalizedPath || isAbsoluteRequestPath(normalizedPath) || startsWithVariable(normalizedPath)) {
    return true
  }
  if (selectedEnvironmentHasBaseUrl()) {
    return true
  }
  ElMessage.warning('相对路径请求需要先选择带 Base URL 的运行环境，或直接填写完整 URL')
  return false
}

function isAllWorkspaceSelected() {
  return props.workspaceCode === 'ALL'
}

function hasConcreteEditorWorkspace(editor: EditorTab) {
  return Boolean(editor.detail.workspaceCode && editor.detail.workspaceCode !== 'ALL')
}

function guardAllWorkspaceAction(editor: EditorTab, actionText: string) {
  if (!isAllWorkspaceSelected()) return true
  if (editor.definitionId && hasConcreteEditorWorkspace(editor)) return true
  ElMessage.warning(`请先切换到具体工作空间后${actionText}`)
  return false
}

function targetDefinitionIdFromRoute() {
  const raw = route.query.definitionId || route.query.interfaceId || route.query.apiDefinitionId
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function findModuleByDirectoryName(workspaceCode: string, directoryName: string | null | undefined) {
  const targetPath = (directoryName || '').trim()
  if (!targetPath) return null
  const sameWorkspaceModules = modules.value.filter(item => item.workspaceCode === workspaceCode)
  return sameWorkspaceModules.find(item => (item.fullPath || item.name || '').trim() === targetPath) || null
}

function moduleNodeFromModule(module: ApiDefinitionModuleItem) {
  const fullPath = (module.fullPath || module.name || '').trim()
  return {
    key: `module:${module.workspaceCode}:${module.id}`,
    type: 'module',
    label: module.name,
    count: module.definitionCount || 0,
    directCount: module.definitionCount || 0,
    moduleId: module.id,
    workspaceCode: module.workspaceCode,
    definitionId: null,
    fullPath,
    children: [],
  } satisfies DirectoryNode
}

async function openRouteTargetDefinition() {
  if (activeTopTab.value !== 'definitions') return
  const definitionId = targetDefinitionIdFromRoute()
  if (!definitionId) return
  if (tabs.value.some(tab => tab.definitionId === definitionId)) return
  try {
    const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, definitionId)
    const summary: ApiDefinitionItem = {
      id: detail.id || definitionId,
      workspaceCode: detail.workspaceCode || props.workspaceCode,
      workspaceName: detail.workspaceName || '',
      name: detail.name,
      method: detail.method || detail.requestConfig.method,
      path: detail.path || detail.requestConfig.path,
      directoryName: detail.directoryName || '',
      description: detail.description || '',
      tags: detail.tags || [],
      lastRunResult: null,
      lastRunAt: null,
      updatedAt: detail.updatedAt,
    }
    const module = findModuleByDirectoryName(summary.workspaceCode, summary.directoryName)
    if (module) {
      const workspaceKey = `workspace:${module.workspaceCode}`
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, workspaceKey, `module:${module.workspaceCode}:${module.id}`]))
      await keepDirectoryNodeExpanded({
        key: workspaceKey,
        type: 'workspace',
        label: summary.workspaceName || module.workspaceName || module.workspaceCode,
        count: 0,
        directCount: 0,
        moduleId: null,
        workspaceCode: module.workspaceCode,
        definitionId: null,
        fullPath: null,
        children: [],
      })
      await loadDefinitionsForDirectoryNode(moduleNodeFromModule(module))
    } else {
      mergeDefinitions([summary])
    }
    await openDefinition(summary)
    await nextTick()
    directoryTreeRef.value?.setCurrentKey?.(`request:${definitionId}`)
    document.querySelector(`[data-key="request:${definitionId}"]`)?.scrollIntoView({ block: 'nearest' })
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error))
  }
}

async function loadWorkspaceData(options?: { openDefaultTab?: boolean }) {
  if (!props.workspaceReady) {
    return
  }
  const openDefaultTab = options?.openDefaultTab ?? true

  loading.value = true
  moduleLoading.value = true
  definitionLoading.value = true
  runOptionsLoading.value = true
  moduleErrorMessage.value = ''
  definitionErrorMessage.value = ''
  runOptionsErrorMessage.value = ''

  try {
    const [moduleItems, definitionPage, environmentPage, variableSetPage] = await Promise.all([
      apiAutomationApi.getDefinitionModules(props.workspaceCode),
      apiAutomationApi.getDefinitions(props.workspaceCode, { pageNo: 1, pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE }),
      apiAutomationApi.getEnvironments(props.workspaceCode),
      apiAutomationApi.getVariableSets(props.workspaceCode),
    ])
    modules.value = moduleItems
    definitions.value = definitionPage.items.filter(item => !(item.directoryName || '').trim())
    directorySearchDefinitions.value = []
    directorySearchTotal.value = 0
    directorySearchLoading.value = false
    directorySearchRequestSeq += 1
    loadedDefinitionModuleKeys.value = new Set()
    loadingDefinitionModuleKeys.value = new Set()
    activeLoadingDirectoryKeys.value = new Set()
    environments.value = environmentPage.items
    variableSets.value = variableSetPage.items
    await nextTick()
    directoryExpandedRestored.value = false
    const availableKeys = new Set(collectExpandableDirectoryKeys(directoryTree.value))
    const restoredKeys = readStoredExpandedKeys().filter(key => availableKeys.has(key))
    expandedKeys.value = directoryKeyword.value.trim()
      ? collectExpandableDirectoryKeys(directoryTree.value)
      : restoredKeys
    directoryExpandedRestored.value = true
    restoringDirectoryExpanded.value = restoredKeys.length > 0 && !directoryKeyword.value.trim()
    if (restoringDirectoryExpanded.value) {
      window.setTimeout(() => {
        restoringDirectoryExpanded.value = false
      }, 0)
    }
    restoreRunOptions()
    emit('loaded', { definitions: definitions.value, modules: modules.value, cases: cases.value })
    await openRouteTargetDefinition()
    if (openDefaultTab && !tabs.value.length) {
      openNewRequestTab()
    }
  } catch (error) {
    const message = getRequestErrorMessage(error)
    moduleErrorMessage.value = message
    definitionErrorMessage.value = message
    runOptionsErrorMessage.value = message
  } finally {
    loading.value = false
    moduleLoading.value = false
    definitionLoading.value = false
    runOptionsLoading.value = false
  }
}

async function loadCasesForDefinition(definitionId: number, workspaceCode = props.workspaceCode) {
  try {
    const page = await apiAutomationApi.getCases(workspaceCode, { definitionId, pageNo: 1, pageSize: 100 })
    const others = cases.value.filter(item => item.definitionId !== definitionId)
    cases.value = [...others, ...page.items]
    emit('loaded', { definitions: definitions.value, modules: modules.value, cases: cases.value })
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error))
  }
}

function openNewRequestTab(source?: ApiDefinitionDetail) {
  const detail = source ? clone(source) : createDraftDetail()
  hydrateBodyModeText(detail.requestConfig.body)
  const key = source?.id ? `definition:${source.id}:${Date.now()}` : `draft:${Date.now()}`
  const tab: EditorTab = {
    key,
    resourceType: 'definition',
    definitionId: source?.id || null,
    title: editorTitle(detail),
    method: detail.requestConfig.method || detail.method || 'GET',
    dirty: Boolean(source),
    activeTab: 'body',
    responseTab: 'body',
    detail,
    runResult: null,
    runError: '',
    loading: false,
  }
  tabs.value.push(tab)
  activeEditorKey.value = key
  void nextTick(() => {
    urlInputRef.value?.focus()
    scrollActiveEditorTabIntoView()
  })
}

function openAiCaseGenerationResultTab(editor: EditorTab, sourceState?: AiCaseGenerationTabState | null) {
  const definitionId = sourceState?.definitionId || editor.definitionId
  if (!definitionId) return null
  const state = reactive<AiCaseGenerationTabState>({
    definitionId,
    workspaceCode: sourceState?.workspaceCode || editor.detail.workspaceCode || props.workspaceCode,
    definitionName: sourceState?.definitionName || editor.detail.name || editor.title || '未命名接口',
    method: sourceState?.method || editor.detail.requestConfig.method || editor.method || 'GET',
    path: sourceState?.path || editor.detail.requestConfig.path || editor.detail.path || '',
    description: sourceState?.description ?? editor.detail.description ?? null,
    requestConfig: clone(sourceState?.requestConfig || editor.detail.requestConfig),
    assertions: clone(sourceState?.assertions || editor.detail.assertions || []),
    preProcessors: clone(sourceState?.preProcessors || editor.detail.preProcessors || []),
    postProcessors: clone(sourceState?.postProcessors || editor.detail.postProcessors || []),
    results: [],
    generating: true,
    message: '',
    logs: [],
    abortController: null,
  })
  const detail = createDraftDetail()
  detail.id = definitionId
  detail.name = 'AI 生成单接口用例'
  detail.method = state.method
  detail.path = state.path
  detail.requestConfig.method = state.method
  detail.requestConfig.path = state.path
  detail.workspaceCode = state.workspaceCode
  const tab: EditorTab = {
    key: `ai-case-generation:${definitionId}:${Date.now()}`,
    resourceType: 'ai-case-generation',
    definitionId,
    title: `AI 用例 - ${state.definitionName}`,
    method: 'AI',
    dirty: false,
    activeTab: 'cases',
    responseTab: 'body',
    detail,
    runResult: null,
    runError: '',
    loading: false,
    aiGeneration: state,
  }
  tabs.value.push(tab)
  aiCaseGeneratedResults.value = state.results
  aiCaseGenerationLogs.value = state.logs
  aiCaseGenerationMessage.value = state.message
  aiCaseResultFilter.value = 'pending'
  aiCaseResultKeyword.value = ''
  aiCaseResultGroup.value = ''
  aiCaseResultType.value = ''
  aiCaseSelectedResultIds.value = []
  activeEditorKey.value = tab.key
  aiCaseDrawerVisible.value = false
  void nextTick(scrollActiveEditorTabIntoView)
  return state
}

async function openDefinition(item: ApiDefinitionItem, syncDirectory = true) {
  const existed = tabs.value.find(tab => tab.definitionId === item.id)
  if (existed) {
    activeEditorKey.value = existed.key
    void nextTick(scrollActiveEditorTabIntoView)
    if (syncDirectory) {
      selectedDirectoryKey.value = `request:${item.id}`
    }
    return
  }

  const draft = createDraftDetail()
  draft.id = item.id
  draft.name = item.name
  draft.method = item.method
  draft.path = item.path
  draft.directoryName = item.directoryName
  draft.workspaceCode = item.workspaceCode
  draft.workspaceName = item.workspaceName
  draft.description = item.description || ''
  draft.tags = item.tags || []
  draft.requestConfig.method = item.method
  draft.requestConfig.path = item.path

  const tab: EditorTab = {
    key: `definition:${item.id}`,
    resourceType: 'definition',
    definitionId: item.id,
    title: item.name,
    method: item.method,
    dirty: false,
    activeTab: 'body',
    responseTab: 'body',
    detail: draft,
    runResult: null,
    runError: '',
    loading: true,
  }

  tabs.value.push(tab)
  activeEditorKey.value = tab.key
  void nextTick(scrollActiveEditorTabIntoView)
  if (syncDirectory) {
    selectedDirectoryKey.value = `request:${item.id}`
  }

  try {
    const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, item.id)
    hydrateBodyModeText(detail.requestConfig.body)
    const tabIndex = tabs.value.findIndex(editor => editor.key === tab.key)
    if (tabIndex >= 0) {
      tabs.value[tabIndex] = {
        ...tabs.value[tabIndex],
        detail: clone(detail),
        title: editorTitle(detail),
        method: detail.requestConfig.method || detail.method,
        loading: false,
      }
    }
    void loadCasesForDefinition(item.id)
  } catch (error) {
    const tabIndex = tabs.value.findIndex(editor => editor.key === tab.key)
    if (tabIndex >= 0) {
      tabs.value[tabIndex] = {
        ...tabs.value[tabIndex],
        loading: false,
        runError: getRequestErrorMessage(error),
      }
    }
  }
}

async function closeEditorTab(key: string, force = false) {
  const index = tabs.value.findIndex(item => item.key === key)
  if (index < 0) return
  if (!force && tabs.value[index].dirty) {
    const confirmed = await confirmApiAction('当前请求有未保存修改，关闭后会丢失，确认关闭吗？', '关闭标签')
    if (!confirmed) return
  }
  tabs.value[index].aiGeneration?.abortController?.abort()
  tabs.value.splice(index, 1)
  if (activeEditorKey.value === key) {
    activeEditorKey.value = tabs.value[Math.max(index - 1, 0)]?.key || ''
  }
  void nextTick(updateEditorTabOverflow)
}

async function closeOtherTabs() {
  if (!activeEditor.value) return
  const removingDirtyTabs = tabs.value.some(item => item.key !== activeEditor.value?.key && item.dirty)
  if (removingDirtyTabs) {
    const confirmed = await confirmApiAction('其他标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭其他标签')
    if (!confirmed) return
  }
  tabs.value = [activeEditor.value]
  void nextTick(updateEditorTabOverflow)
}

async function closeDraftTabs() {
  const draftTabs = tabs.value.filter(item => !item.definitionId)
  if (!draftTabs.length) {
    ElMessage.info('当前没有草稿标签')
    return
  }
  if (draftTabs.some(item => item.dirty)) {
    const confirmed = await confirmApiAction('草稿标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭全部草稿')
    if (!confirmed) return
  }
  const activeWillClose = activeEditor.value ? draftTabs.some(item => item.key === activeEditor.value?.key) : false
  tabs.value = tabs.value.filter(item => item.definitionId)
  if (activeWillClose) {
    activeEditorKey.value = tabs.value[0]?.key || ''
  }
  void nextTick(updateEditorTabOverflow)
}

async function handleEditorTabMenu(command: string | number | object) {
  try {
    const action = String(command)
    if (action === 'closeCurrent' && activeEditor.value) {
      await closeEditorTab(activeEditor.value.key)
    } else if (action === 'closeOthers') {
      await closeOtherTabs()
    } else if (action === 'closeDrafts') {
      await closeDraftTabs()
    }
  } catch {
    // User cancelled a tab-management confirmation.
  }
}

function updateEditorTabOverflow() {
  const nav = editorTabNavRef.value
  if (!nav) return
  const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth)
  editorTabOverflow.value = {
    overflow: nav.scrollWidth > nav.clientWidth + 1,
    arrivedLeft: nav.scrollLeft <= 1,
    arrivedRight: nav.scrollLeft >= maxScrollLeft - 1,
  }
}

function scrollEditorTabStrip(direction: 'left' | 'right') {
  const nav = editorTabNavRef.value
  if (!nav) return
  nav.scrollBy({
    left: direction === 'left' ? -220 : 220,
    behavior: 'smooth',
  })
  window.setTimeout(updateEditorTabOverflow, 180)
}

function scrollActiveEditorTabIntoView() {
  const nav = editorTabNavRef.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('.api-editor-tab.is-active')
  active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  updateEditorTabOverflow()
}

function setDirectoryNodeExpanded(node: DirectoryNode, expanded: boolean) {
  if (expanded) {
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
    void syncDirectoryTreeExpandedState()
    if (canLoadDefinitionsForDirectoryNode(node) && !restoringDirectoryExpanded.value) {
      void loadDefinitionsForDirectoryNode(node)
    }
    return
  }
  expandedKeys.value = expandedKeys.value.filter(key => key !== node.key)
  void syncDirectoryTreeExpandedState()
}

async function syncDirectoryTreeExpandedState() {
  await nextTick()
  const store = directoryTreeRef.value?.store
  const allNodes = store?.value?._getAllNodes?.() || store?._getAllNodes?.() || []
  const expanded = new Set(expandedKeys.value)
  allNodes.forEach((treeNode) => {
    if (treeNode.data?.type === 'module' || treeNode.data?.type === 'workspace' || treeNode.data?.type === 'root') {
      treeNode.expanded = expanded.has(String(treeNode.key))
    }
  })
}

async function keepDirectoryNodeExpanded(node: DirectoryNode, options: { force?: boolean } = {}) {
  const shouldStayExpanded = options.force || expandedKeys.value.includes(node.key)
  if (!shouldStayExpanded) return
  if (options.force) {
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
  }
  await syncDirectoryTreeExpandedState()
  const treeNode = directoryTreeRef.value?.getNode(node.key)
  if (!treeNode) return
  treeNode.expanded = true
  treeNode.expand?.()
}

async function loadDefinitionsForDirectoryNode(node: DirectoryNode) {
  if (!canLoadDefinitionsForDirectoryNode(node)) return
  const moduleFullPath = node.fullPath ?? null
  const key = definitionModuleLoadKey(node.workspaceCode, node.moduleId, moduleFullPath)
  if (loadedDefinitionModuleKeys.value.has(key)) {
    await keepDirectoryNodeExpanded(node)
    return
  }
  if (loadingDefinitionModuleKeys.value.has(key)) {
    await keepDirectoryNodeExpanded(node)
    return
  }
  node.loading = true
  markDefinitionModuleLoading(key, true)
  markDirectoryNodeLoading(node.key, true)
  await keepDirectoryNodeExpanded(node)
  await nextTick()
  await waitForMs(DIRECTORY_MODULE_LOADING_MIN_MS)
  try {
    const page = await apiAutomationApi.getDefinitions(node.workspaceCode, {
      moduleId: node.moduleId,
      pageNo: 1,
      pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE,
    })
    const directDefinitions = page.items.filter(item => isDirectDefinitionInPath(item, moduleFullPath))
    mergeDefinitions(directDefinitions)
    markDefinitionModuleLoaded(key)
    await keepDirectoryNodeExpanded(node)
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error))
  } finally {
    node.loading = false
    markDefinitionModuleLoading(key, false)
    markDirectoryNodeLoading(node.key, false)
    void syncDirectoryTreeExpandedState()
  }
}

function handleDirectorySelect(node: DirectoryNode) {
  if (node.type === 'placeholder') return
  selectedDirectoryKey.value = node.key
  directoryTreeRef.value?.setCurrentKey?.(node.key)
  if (node.type === 'module') {
    setDirectoryNodeExpanded(node, !expandedKeys.value.includes(node.key))
    return
  }
  if (node.type === 'workspace' || node.type === 'root' || node.type === 'unassigned') {
    const shouldOpen = !expandedKeys.value.includes(node.key)
    if (shouldOpen) {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
      void keepDirectoryNodeExpanded(node, { force: true })
    }
  }
  if (node.type === 'request' && node.definition) {
    void openDefinition(node.definition)
  }
}

function setBodyMode(mode: BodyType) {
  if (!activeDetail.value) return
  activeDetail.value.requestConfig.body.type = mode
  if (mode === 'RAW_JSON') activeDetail.value.requestConfig.body.contentType = 'application/json'
  if (mode === 'RAW_XML') activeDetail.value.requestConfig.body.contentType = 'application/xml'
  if (mode === 'RAW_TEXT') activeDetail.value.requestConfig.body.contentType = 'text/plain'
  syncRequestBodyRawText(activeDetail.value.requestConfig)
  markDirty()
}

function addRow(rows: ApiKeyValueInput[]) {
  rows.push(emptyKeyValue())
  markDirty()
}

function removeRow(rows: ApiKeyValueInput[], index: number) {
  rows.splice(index, 1)
  if (!rows.length) rows.push(emptyKeyValue())
  markDirty()
}

function openBatchAdd(target: BatchAddTarget) {
  batchAddTarget.value = target
  batchAddText.value = ''
  batchAddVisible.value = true
}

function parseBatchRows(text: string) {
  const rowMap = new Map<string, { key: string; value: string; description: string }>()

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line || /^[=:]/.test(line) || rawLine.startsWith('\t')) {
      return
    }

    const separatorIndex = rawLine.includes('\t')
      ? rawLine.indexOf('\t')
      : rawLine.includes(':')
        ? rawLine.indexOf(':')
        : rawLine.indexOf('=')
    const parts = separatorIndex >= 0
      ? [rawLine.slice(0, separatorIndex), rawLine.slice(separatorIndex + 1)]
      : [rawLine, '']
    const row = {
      key: (parts[0] || '').trim(),
      value: (parts[1] || '').trim(),
      description: '',
    }
    if (!row.key) {
      return
    }
    rowMap.delete(row.key)
    rowMap.set(row.key, row)
  })

  return Array.from(rowMap.values())
}

function applyBatchAdd() {
  if (!activeEditor.value) return
  const rows = parseBatchRows(batchAddText.value)
  if (!rows.length) {
    ElMessage.warning('请输入要批量添加的内容')
    return
  }

  if (batchAddTarget.value === 'assertion') {
    const assertions = assertionRowsFor(activeEditor.value.detail)
    assertions.push(...rows.map(row => createAssertion(row.key, row.value)))
  } else if (batchAddTarget.value === 'extractor') {
    const extractors = extractorRowsFor(activeEditor.value.detail)
    extractors.push(...rows.map(row => createExtractor(row.key, row.value, row.key)))
  } else {
    const targetRows = batchAddTarget.value === 'query'
      ? activeEditor.value.detail.requestConfig.queryParams
      : batchAddTarget.value === 'header'
        ? activeEditor.value.detail.requestConfig.headers
        : batchAddTarget.value === 'cookie'
          ? activeEditor.value.detail.requestConfig.cookies
          : activeEditor.value.detail.requestConfig.body.formItems

    targetRows.push(...rows.map(row => emptyKeyValue(row)))
  }

  batchAddVisible.value = false
  markDirty()
}

async function createModule(parentId: number | null = null) {
  const value = await openApiSoftPrompt({
    title: '新建模块',
    message: '请输入模块名称',
    requiredMessage: '模块名称不能为空',
  })
  if (!value) return
  await apiAutomationApi.createDefinitionModule(props.workspaceCode, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    parentId,
    name: value,
  })
  await loadWorkspaceData()
  ElMessage.success('模块已创建')
}

async function createModuleFromSaveDialog(payload: { name: string; parentId: number | null }) {
  if (definitionSaveModuleCreating.value) return
  definitionSaveModuleCreating.value = true
  try {
    const module = await apiAutomationApi.createDefinitionModule(props.workspaceCode, {
      workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
      parentId: payload.parentId,
      name: payload.name,
    })
    await loadWorkspaceData()
    const editor = activeEditor.value
    if (editor && !editor.definitionId) {
      editor.detail.directoryName = module.fullPath || module.name
    }
    ElMessage.success('模块已创建')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    definitionSaveModuleCreating.value = false
  }
}

async function renameModule(node: DirectoryNode) {
  if (!node.moduleId) return
  const value = await openApiSoftPrompt({
    title: '重命名模块',
    message: '请输入新的模块名称',
    value: node.label.split('/').pop() || node.label,
    requiredMessage: '模块名称不能为空',
  })
  if (!value) return
  await apiAutomationApi.updateDefinitionModule(props.workspaceCode, node.moduleId, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    name: value,
  })
  await loadWorkspaceData()
  ElMessage.success('模块已重命名')
}

async function deleteModule(node: DirectoryNode) {
  if (!node.moduleId) return
  if (node.count > 0 || node.children.some(child => child.type === 'module')) {
    ElMessage.warning('请先移除模块下的请求或子模块')
    return
  }
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该模块吗？', '删除模块', { danger: true })
  if (!confirmed) return
  await apiAutomationApi.deleteDefinitionModule(props.workspaceCode, node.moduleId)
  await loadWorkspaceData()
  ElMessage.success('模块已删除')
}

async function renameRequest(node: DirectoryNode) {
  if (!node.definitionId || !node.definition) return
  const value = await openApiSoftPrompt({
    title: '重命名请求',
    message: '请输入新的请求名称',
    value: node.definition.name,
    requiredMessage: '请求名称不能为空',
  })
  if (!value) return
  const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, node.definitionId)
  const saved = await apiAutomationApi.updateDefinition(props.workspaceCode, node.definitionId, {
    ...buildPayload({ ...detail, name: value }),
    name: value,
  })
  const opened = tabs.value.find(tab => tab.definitionId === node.definitionId)
  if (opened) {
    opened.detail = clone(saved)
    opened.title = editorTitle(saved)
    opened.method = saved.requestConfig.method || saved.method
    opened.dirty = false
  }
  await loadWorkspaceData()
  ElMessage.success('请求已重命名')
}

async function deleteRequest(node: DirectoryNode) {
  if (!node.definitionId) return
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该请求吗？', '删除请求', { danger: true })
  if (!confirmed) return
  await apiAutomationApi.deleteDefinition(props.workspaceCode, node.definitionId)
  const opened = tabs.value.find(tab => tab.definitionId === node.definitionId)
  if (opened) {
    closeEditorTab(opened.key, true)
  }
  await loadWorkspaceData()
  ElMessage.success('请求已删除')
}

async function saveActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  const detail = editor.detail
  if (!guardAllWorkspaceAction(editor, '保存接口')) return
  if (!detail.requestConfig.path.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }

  if (!editor.definitionId) {
    pendingCreateEditorKey.value = editor.key
    definitionSaveDialogVisible.value = true
    return
  }

  await persistActiveEditor()
}

async function persistActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  const detail = editor.detail
  saving.value = true
  try {
    const payload = buildPayload(detail)
    const saved = editor.definitionId
      ? await apiAutomationApi.updateDefinition(props.workspaceCode, editor.definitionId, payload)
      : await apiAutomationApi.createDefinition(props.workspaceCode, payload)

    editor.definitionId = saved.id
    editor.key = `definition:${saved.id}`
    editor.detail = clone(saved)
    editor.title = editorTitle(saved)
    editor.method = saved.requestConfig.method || saved.method
    editor.dirty = false
    activeEditorKey.value = editor.key
    selectedDirectoryKey.value = `request:${saved.id}`
    await loadWorkspaceData()
    ElMessage.success('接口已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function confirmCreateDefinition(draft: ApiDefinitionSaveDraft) {
  const editor = tabs.value.find(item => item.key === pendingCreateEditorKey.value)
  if (!editor) {
    definitionSaveDialogVisible.value = false
    pendingCreateEditorKey.value = ''
    return
  }
  activeEditorKey.value = editor.key
  editor.detail.name = draft.name
  editor.detail.directoryName = draft.directoryName
  await persistActiveEditor()
  definitionSaveDialogVisible.value = false
  pendingCreateEditorKey.value = ''
}

async function sendActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  const detail = editor.detail
  if (!guardAllWorkspaceAction(editor, '发送请求')) return
  if (!detail.requestConfig.path.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }
  if (!guardRunEnvironmentForPath(detail.requestConfig.path)) {
    return
  }

  sending.value = true
  editor.runError = ''
  editor.runResult = null
  try {
    editor.runResult = editor.definitionId && !editor.dirty
      ? await apiAutomationApi.debugRunDefinition(props.workspaceCode, editor.definitionId, currentRunPayload())
      : await apiAutomationApi.debugRunDefinitionDraft(props.workspaceCode, {
        ...buildPayload(detail),
        ...currentRunPayload(),
      })
    editor.responseTab = 'body'
    ElMessage.success('请求已发送')
  } catch (error) {
    editor.runError = getRequestErrorMessage(error)
    editor.responseTab = 'console'
    ElMessage.error(editor.runError)
  } finally {
    sending.value = false
  }
}

async function deleteActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  if (!editor.definitionId) {
    closeEditorTab(editor.key)
    return
  }

  const confirmed = await confirmApiAction('删除后不可恢复，确认删除当前接口吗？', '删除接口', { danger: true })
  if (!confirmed) return
  try {
    await apiAutomationApi.deleteDefinition(props.workspaceCode, editor.definitionId)
    void closeEditorTab(editor.key, true)
    await loadWorkspaceData()
    ElMessage.success('接口已删除')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function duplicateActiveEditor() {
  if (!activeEditor.value) return
  const detail = clone(activeEditor.value.detail)
  detail.id = 0
  detail.name = `${detail.name || '接口'} - 副本`
  detail.createdAt = null
  detail.updatedAt = null
  openNewRequestTab(detail)
}

async function saveAsCase() {
  if (!activeEditor.value) return
  if (!guardAllWorkspaceAction(activeEditor.value, '保存为用例')) return
  if (!activeEditor.value.definitionId) {
    try {
      const confirmed = await confirmApiAction('当前请求还未保存为接口，请先保存接口，再保存为用例。是否现在保存接口？', '保存为用例', {
        confirmText: '先保存接口',
      })
      if (!confirmed) return
    } catch {
      return
    }
    await saveActiveEditor()
    if (!activeEditor.value?.definitionId) return
  }
  openCreateCaseDialog()
}

async function promptImportCurl() {
  if (!activeEditor.value) {
    openNewRequestTab()
  }
  const value = await openApiSoftPrompt({
    title: 'Curl 导入',
    message: '粘贴 curl 命令，支持 method、URL、Headers、Body 的最小解析',
    inputType: 'textarea',
    placeholder: `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"demo"}'`,
    requiredMessage: '请输入 curl 命令',
    confirmText: '导入',
  })
  if (!value) return
  try {
    applyCurlToActiveEditor(value)
    ElMessage.success('Curl 已填充到当前请求')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Curl 解析失败')
  }
}

function openImportDialog() {
  importMode.value = 'swagger'
  importInputMode.value = 'url'
  importUrl.value = ''
  importFileName.value = ''
  importFile.value = null
  importGroupByTags.value = true
  importDirectoryName.value = currentImportDirectoryName()
  importDialogVisible.value = true
}

function currentImportDirectoryName() {
  if (selectedDirectoryKey.value.startsWith('module:')) {
    const node = findDirectoryNodeByKey(directoryTree.value, selectedDirectoryKey.value)
    return (node?.fullPath || '').trim()
  }
  if (selectedDirectoryKey.value.startsWith('request:')) {
    const id = Number(selectedDirectoryKey.value.split(':')[1] || '')
    const definition = definitions.value.find(item => item.id === id)
    return (definition?.directoryName || '').trim()
  }
  return ''
}

function closeImportDialog() {
  if (importSubmitting.value) return
  importDialogVisible.value = false
}

function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  importFile.value = file
  importFileName.value = file?.name || ''
}

async function submitImportDialog() {
  if (importSubmitting.value) return
  if (importInputMode.value === 'url' && !importUrl.value.trim()) {
    ElMessage.warning('请输入导入地址')
    return
  }
  if (importInputMode.value === 'file' && !importFile.value) {
    ElMessage.warning('请选择导入文件')
    return
  }

  importSubmitting.value = true
  try {
    const result = importInputMode.value === 'file'
      ? await apiAutomationApi.importDefinitionFile(
          props.workspaceCode,
          importMode.value,
          importFile.value!,
          importDirectoryName.value || null,
          importMode.value === 'swagger' ? true : null,
        )
      : await apiAutomationApi.importDefinitions(props.workspaceCode, {
          workspaceCode: props.workspaceCode,
          mode: importMode.value,
          inputType: 'url',
          url: importUrl.value.trim(),
          directoryName: importDirectoryName.value || null,
          groupByTags: importMode.value === 'swagger' ? true : null,
        })
    await loadWorkspaceData({ openDefaultTab: false })
    const firstImported = result.items[0]
    if (firstImported) {
      const definition = definitions.value.find(item => item.id === firstImported.id)
      if (definition) {
        await openDefinition(definition)
      }
    }
    importDialogVisible.value = false
    const failedText = result.failedCount ? `，失败 ${result.failedCount} 个` : ''
    const updatedCount = Math.max(result.items.length - result.createdCount, 0)
    const updatedText = updatedCount ? `，更新 ${updatedCount} 个` : ''
    ElMessage.success(`已新增 ${result.createdCount} 个接口${updatedText}${failedText}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    importSubmitting.value = false
  }
}

function tokenizeCurl(input: string) {
  return input
    .replace(/\\\r?\n/g, ' ')
    .match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g)
    ?.map(token => token.replace(/^['"]|['"]$/g, '')) ?? []
}

function applyCurlToActiveEditor(input: string) {
  if (!activeEditor.value) return
  const tokens = tokenizeCurl(input.trim())
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('请输入以 curl 开头的命令')
  }

  const detail = activeEditor.value.detail
  let method = ''
  let url = ''
  let body = ''
  const headers: ApiKeyValueInput[] = []

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1] || ''
    if (token === '-X' || token === '--request') {
      method = next.toUpperCase()
      index += 1
    } else if (token === '-H' || token === '--header') {
      const [key, ...rest] = next.split(':')
      if (key?.trim()) {
        headers.push(emptyKeyValue({ key: key.trim(), value: rest.join(':').trim() }))
      }
      index += 1
    } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
      body = next
      index += 1
    } else if (!token.startsWith('-') && !url) {
      url = token
    }
  }

  if (!url) {
    throw new Error('Curl 中没有识别到 URL')
  }

  detail.requestConfig.path = url
  detail.requestConfig.method = method || (body ? 'POST' : 'GET')
  detail.method = detail.requestConfig.method
  if (headers.length) {
    detail.requestConfig.headers = headers
  }
  if (body) {
    detail.requestConfig.body.type = body.trim().startsWith('<') ? 'RAW_XML' : 'RAW_JSON'
    setModeBodyText(detail.requestConfig.body, body, detail.requestConfig.body.type)
    detail.requestConfig.body.contentType = body.trim().startsWith('<') ? 'application/xml' : 'application/json'
  }
  markDirty()
}

function currentDefinitionSummary(): ApiDefinitionItem | null {
  if (aiGeneratedCaseDraftDetail.value) {
    const detail = aiGeneratedCaseDraftDetail.value
    return {
      id: detail.definitionId,
      workspaceCode: detail.workspaceCode,
      workspaceName: detail.workspaceName,
      name: detail.definitionName || activeAiCaseGenerationState.value?.definitionName || '',
      method: detail.method,
      path: detail.path,
      directoryName: null,
      description: null,
      tags: [],
      lastRunResult: null,
      lastRunAt: null,
      updatedAt: null,
    }
  }
  if (!activeEditor.value?.definitionId) return null
  const detail = activeEditor.value.detail
  return {
    id: activeEditor.value.definitionId,
    workspaceCode: detail.workspaceCode,
    workspaceName: detail.workspaceName,
    name: detail.name,
    method: detail.requestConfig.method || detail.method,
    path: detail.requestConfig.path || detail.path,
    directoryName: detail.directoryName,
    description: detail.description,
    tags: detail.tags || [],
    lastRunResult: detail.lastRunResult,
    lastRunAt: detail.lastRunAt,
    updatedAt: detail.updatedAt,
  }
}

function currentCaseDraftDetail(): ApiDefinitionCaseDetail | null {
  if (aiGeneratedCaseDraftDetail.value) {
    return aiGeneratedCaseDraftDetail.value
  }
  if (!activeEditor.value?.definitionId) return null
  const detail = activeEditor.value.detail
  return {
    id: 0,
    workspaceCode: detail.workspaceCode || props.workspaceCode,
    workspaceName: detail.workspaceName,
    definitionId: activeEditor.value.definitionId,
    definitionName: detail.name || editorTitle(detail),
    name: `${detail.name || editorTitle(detail)} 用例`,
    method: detail.requestConfig.method || detail.method || 'GET',
    path: detail.requestConfig.path || detail.path || '',
    description: detail.description || null,
    tags: detail.tags || [],
    lastRunResult: detail.lastRunResult,
    lastRunAt: detail.lastRunAt,
    updatedAt: detail.updatedAt,
    createdAt: null,
    requestConfig: payloadRequestConfig(detail),
    assertions: clone(detail.assertions || []),
    extractors: clone(detail.extractors || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  }
}

function aiCaseLog(message: string) {
  aiCaseGenerationLogs.value.push(`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${message}`)
}

async function loadAiCaseProviders() {
  aiCaseProvidersLoading.value = true
  aiCaseProviderErrorMessage.value = ''
  try {
    aiCaseProviders.value = await aiProviderApi.getProviderConnections(props.workspaceCode)
    if (!aiCaseSelectedProvider.value && aiCaseAvailableProviders.value.length) {
      aiCaseSelectedProviderId.value = aiCaseAvailableProviders.value[0].id
    }
  } catch (error) {
    aiCaseProviderErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    aiCaseProvidersLoading.value = false
  }
}

function openAiCaseDrawer() {
  if (!activeEditor.value?.definitionId && !activeAiCaseGenerationState.value?.definitionId) {
    ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
    return
  }
  aiCaseDrawerVisible.value = true
  aiCaseProviderErrorMessage.value = ''
  aiCaseGenerationMessage.value = ''
  if (!aiCaseProviders.value.length) {
    void loadAiCaseProviders()
  }
}

function selectedAiCaseOptions() {
  const selected = aiCaseGenerationOptions.filter(item => aiCaseSelectedOptionKeys.value.includes(item.key))
  return selected.length ? selected : aiCaseGenerationOptions.slice(0, 1)
}

function aiCaseGenerationOptionGroupLabel(groupKey?: string | null) {
  return aiCaseGenerateGroups.value.find(item => item.key === groupKey)?.label || groupKey || '其他'
}

function buildAiCaseGenerationRequestOptions(): ApiAiCaseGenerationOptionPayload[] {
  const selected = selectedAiCaseOptions()
  const targetCount = resolveAiCaseGenerationTargetCount(selected.length)
  return Array.from({ length: targetCount }, (_, index) => {
    const option = selected[index % selected.length]
    return {
      id: `ai-case-${Date.now()}-${index}`,
      key: option.key,
      group: option.group,
      label: option.label,
      groupLabel: option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group),
    }
  })
}

function resolveAiCaseGenerationTargetCount(selectedCount: number) {
  if (aiCaseCount.value === 'AUTO') {
    return Math.min(Math.max(selectedCount, 1), 12)
  }
  return Math.max(1, Math.min(80, Number(aiCaseCount.value) || selectedCount || 1))
}

function createAiGeneratedCasePlaceholder(option: ApiAiCaseGenerationOptionPayload, index: number): ApiAiGeneratedCaseResult {
  return {
    id: option.id || `ai-case-${Date.now()}-${index}`,
    status: 'generating',
    draft: {
      name: option.label,
      description: 'AI 正在生成接口用例',
      tags: [option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group), option.label],
      group: option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group),
      groupKey: option.group || null,
      type: option.label,
      typeKey: option.key || null,
      expected: '生成完成后展示预期结果',
      requestConfig: clone(activeAiCaseGenerationState.value?.requestConfig || activeEditor.value?.detail.requestConfig || emptyRequestConfig()),
      assertions: [],
      preProcessors: [],
      postProcessors: [],
    },
    message: null,
    runResult: null,
    runMessage: null,
  }
}

function syncAiGenerationStateToPanel(state: AiCaseGenerationTabState) {
  const activeState = activeAiCaseGenerationState.value
  if (activeState !== state && toRaw(activeState) !== toRaw(state)) return
  aiCaseGeneratedResults.value = state.results
  aiCaseGenerationLogs.value = state.logs
  aiCaseGenerationMessage.value = state.message
}

function createAiGeneratedCasePlaceholderFromEvent(event: ApiAiCaseGenerationEvent, index: number) {
  const fallbackOption = aiCaseGenerationOptions.find(item => item.label === event.type || item.key === event.itemId)
  return createAiGeneratedCasePlaceholder({
    id: event.itemId || `stream-${index}`,
    key: fallbackOption?.key || event.itemId || `stream-${index}`,
    group: fallbackOption?.group || 'positive',
    label: event.type || fallbackOption?.label || `用例 ${index + 1}`,
    groupLabel: fallbackOption?.groupLabel || aiCaseGenerationOptionGroupLabel(fallbackOption?.group || 'positive'),
  }, index)
}

function findFirstAiGeneratedCasePlaceholder(results: ApiAiGeneratedCaseResult[], itemId?: string | null) {
  if (itemId) {
    return results.find(item => item.id === itemId)
  }
  return results.find(item => item.status === 'generating')
}

function findOrCreateAiGeneratedCaseResult(event: ApiAiCaseGenerationEvent, state?: AiCaseGenerationTabState | null) {
  const results = state?.results || aiCaseGeneratedResults.value
  const existing = findFirstAiGeneratedCasePlaceholder(results, event.itemId)
  if (existing) {
    return existing
  }
  const result = createAiGeneratedCasePlaceholderFromEvent(event, results.length)
  if (event.itemId) {
    result.id = event.itemId
  }
  results.push(result)
  if (state) {
    state.results = [...results]
    syncAiGenerationStateToPanel(state)
  }
  return result
}

function normalizeAiGeneratedCaseName(name: string | null | undefined, type: string | null | undefined, expected?: string | null) {
  const cleanName = (name || type || 'AI 生成用例')
    .replace(/^【[^】]+】\s*/, '')
    .replace(/^\[[^\]]+]\s*/, '')
    .replace(/^(正向|反向|负向|边界|安全性|安全)\s*[-–—:：]\s*/, '')
    .trim()
  const cleanType = (type || '').trim()
  if (!cleanType || cleanName.startsWith(`${cleanType} – `) || cleanName.startsWith(`${cleanType} - `)) {
    return cleanName
  }
  const cleanExpected = (expected || '').trim()
  return cleanExpected
    ? `${cleanType} – ${cleanName} – ${cleanExpected}`
    : `${cleanType} – ${cleanName}`
}

function prettyJsonText(value: unknown) {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return value
  }
}

function normalizeAiGeneratedRequestConfig(config: ApiRequestConfigInput) {
  const nextConfig = clone(config || emptyRequestConfig())
  const body = nextConfig.body
  if (body?.type === 'RAW_JSON') {
    const formatted = prettyJsonText(body.jsonText || body.rawText || '')
    body.jsonText = String(formatted || '')
    body.rawText = String(formatted || '')
  }
  return nextConfig
}

function hasMeaningfulAssertionItem(item: ApiAssertionItemConfig | null | undefined) {
  if (!item || item.enabled === false) return false
  return Boolean(
    item.header
    || item.variableName
    || item.expression
    || item.expectedValue
    || item.description,
  )
}

function hasMeaningfulAiAssertion(assertion: ApiAssertionConfig | null | undefined) {
  if (!assertion || assertion.enabled === false) return false
  const type = assertion.assertionType || assertion.type
  if (type === 'RESPONSE_CODE') return Boolean(assertion.expectedValue)
  if (type === 'RESPONSE_TIME') return Boolean(assertion.expectedValue)
  if (type === 'SCRIPT') return Boolean(assertion.script || assertion.expectedValue || assertion.subject)
  if (type === 'RESPONSE_HEADER') return (assertion.assertions || []).some(hasMeaningfulAssertionItem)
  if (type === 'VARIABLE') return (assertion.variableAssertionItems || []).some(hasMeaningfulAssertionItem)
  if (type === 'RESPONSE_BODY') {
    return Boolean(assertion.expression || assertion.expectedValue)
      || (assertion.jsonPathAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
      || (assertion.xpathAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
      || (assertion.regexAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
  }
  return Boolean(
    assertion.name
    || assertion.expectedValue
    || assertion.expression
    || assertion.script
    || (assertion.assertions || []).some(hasMeaningfulAssertionItem)
  )
}

function hasMeaningfulAiProcessor(processor: any) {
  if (!processor || processor.enabled === false) return false
  return Boolean(
    processor.name
    || processor.script
    || processor.sql
    || processor.expression
    || processor.variableName
    || processor.delayMs
    || processor.processorType
    || processor.type,
  )
}

function normalizeAiGeneratedDraft(draft: ApiAiGeneratedCaseDraft) {
  const nextDraft = clone(draft)
  nextDraft.requestConfig = normalizeAiGeneratedRequestConfig(nextDraft.requestConfig || emptyRequestConfig())
  nextDraft.assertions = (clone(nextDraft.assertions || []) as ApiAssertionConfig[]).filter(hasMeaningfulAiAssertion)
  nextDraft.preProcessors = (clone(nextDraft.preProcessors || []) as any[]).filter(hasMeaningfulAiProcessor)
  nextDraft.postProcessors = (clone(nextDraft.postProcessors || []) as any[]).filter(hasMeaningfulAiProcessor)
  return nextDraft
}

function applyAiGeneratedOutlineToResult(target: ApiAiGeneratedCaseResult, outline: NonNullable<ApiAiCaseGenerationEvent['outline']>, event: ApiAiCaseGenerationEvent) {
  const draft = target.draft
  draft.name = normalizeAiGeneratedCaseName(outline.name || draft.name, outline.type || draft.type || event.type, outline.expected || draft.expected)
  draft.description = outline.description || draft.description
  draft.tags = Array.isArray(outline.tags) ? [...outline.tags] : draft.tags
  draft.group = outline.group || event.group || draft.group
  draft.groupKey = outline.groupKey || draft.groupKey
  draft.type = outline.type || event.type || draft.type
  draft.typeKey = outline.typeKey || draft.typeKey
  draft.expected = outline.expected || draft.expected
  target.status = 'generating'
  target.message = null
}

function applyAiGeneratedDraftToResult(target: ApiAiGeneratedCaseResult, draft: ApiAiGeneratedCaseDraft) {
  const nextDraft = normalizeAiGeneratedDraft(draft)
  nextDraft.name = normalizeAiGeneratedCaseName(nextDraft.name || target.draft.name, nextDraft.type || target.draft.type, nextDraft.expected || target.draft.expected)
  nextDraft.description = nextDraft.description || target.draft.description
  nextDraft.tags = Array.isArray(nextDraft.tags) ? [...nextDraft.tags] : target.draft.tags
  nextDraft.group = nextDraft.group || target.draft.group
  nextDraft.groupKey = nextDraft.groupKey || target.draft.groupKey
  nextDraft.type = nextDraft.type || target.draft.type
  nextDraft.typeKey = nextDraft.typeKey || target.draft.typeKey
  nextDraft.expected = nextDraft.expected || target.draft.expected
  nextDraft.requestConfig = normalizeAiGeneratedRequestConfig(nextDraft.requestConfig || target.draft.requestConfig || emptyRequestConfig())
  target.draft = nextDraft
  target.status = 'pending'
  target.message = null
  target.runResult = null
  target.runMessage = null
}

function handleAiCaseGenerationEvent(event: ApiAiCaseGenerationEvent, state?: AiCaseGenerationTabState | null) {
  const log = (message: string) => {
    if (state) {
      state.logs.push(message)
      syncAiGenerationStateToPanel(state)
    } else {
      aiCaseLog(message)
    }
  }
  if (event.event === 'started') {
    log(`开始生成，预计 ${event.total || selectedAiCaseOptions().length} 条`)
  } else if (event.event === 'item_outline') {
    log(`生成大纲：${event.outline?.name || event.type || event.itemId || '-'}`)
    if (event.outline) {
      const target = findOrCreateAiGeneratedCaseResult(event, state)
      applyAiGeneratedOutlineToResult(target, event.outline, event)
      if (state) {
        state.results = [...state.results]
        syncAiGenerationStateToPanel(state)
      }
    }
  } else if (event.event === 'item_completed') {
    log(`生成完成：${event.item?.name || event.type || event.itemId || '-'}`)
    if (event.item) {
      const target = findOrCreateAiGeneratedCaseResult(event, state)
      applyAiGeneratedDraftToResult(target, event.item)
      if (state) {
        state.results = [...state.results]
        syncAiGenerationStateToPanel(state)
      }
    }
  } else if (event.event === 'item_failed') {
    log(`单条失败：${event.message || event.type || event.itemId || '-'}`)
    const target = findOrCreateAiGeneratedCaseResult(event, state)
    if (event.outline) {
      applyAiGeneratedOutlineToResult(target, event.outline, event)
    }
    target.status = 'failed'
    target.message = event.message || '生成失败'
    target.runResult = '失败'
    target.runMessage = event.message || '生成失败'
    if (state) {
      state.results = [...state.results]
      syncAiGenerationStateToPanel(state)
    }
  } else if (event.event === 'completed') {
    aiCaseGenerationStatus.value = 'done'
    aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例完成'
    if (state) {
      state.generating = false
      state.message = aiCaseGenerationMessage.value
    }
    log(aiCaseGenerationMessage.value)
  } else if (event.event === 'failed') {
    aiCaseGenerationStatus.value = 'failed'
    aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例失败'
    if (state) {
      markRemainingAiGeneratedCasesFailed(state, aiCaseGenerationMessage.value)
      state.generating = false
      state.message = aiCaseGenerationMessage.value
    }
    log(aiCaseGenerationMessage.value)
  } else {
    log(event.message || event.event)
  }
}

async function submitAiCaseGeneration() {
  const sourceState = activeAiCaseGenerationState.value
  if (!activeEditor.value?.definitionId && !sourceState?.definitionId) {
    ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
    return
  }
  if (!aiCaseSelectedProvider.value) {
    ElMessage.warning('暂无可用 AI 模型，请先到 AI 连接池配置')
    return
  }
  if (!aiCaseSelectedOptionKeys.value.length) {
    ElMessage.warning('请至少选择一种生成场景')
    return
  }

  const editor = activeEditor.value
  if (!editor) return
  const definitionId = sourceState?.definitionId || editor.definitionId
  if (!definitionId) return
  const detail = editor.detail
  const sourceRequestConfig = clone(sourceState?.requestConfig || detail.requestConfig)
  const targetWorkspaceCode = sourceState?.workspaceCode || editor.detail.workspaceCode || props.workspaceCode
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, 'AI 生成接口用例')) return
  aiCaseGenerationStatus.value = 'running'
  aiCaseGenerationMessage.value = ''
  aiCaseGenerationLogs.value = []
  const requestOptions = buildAiCaseGenerationRequestOptions()
  aiCaseGeneratedResults.value = []
  const generationState = openAiCaseGenerationResultTab(editor, sourceState)
  if (!generationState) return
  syncAiGenerationStateToPanel(generationState)
  const abortController = new AbortController()
  generationState.abortController = abortController

  try {
    await apiAutomationApi.streamAiCaseGeneration(targetWorkspaceCode, {
      workspaceCode: targetWorkspaceCode,
      definitionId,
      definitionName: sourceState?.definitionName || detail.name,
      name: sourceState?.definitionName || detail.name,
      method: sourceState?.method || sourceRequestConfig.method || detail.method,
      path: sourceState?.path || sourceRequestConfig.path || detail.path,
      description: sourceState?.description ?? detail.description,
      providerConnectionId: aiCaseSelectedProvider.value.id,
      modelName: aiCaseSelectedProvider.value.modelName || '',
      caseCount: aiCaseCount.value,
      noDuplicate: aiCaseNoDuplicate.value,
      prompt: aiCasePrompt.value || null,
      options: requestOptions,
      requestConfig: sourceRequestConfig,
      assertions: clone(sourceState?.assertions || detail.assertions || []),
      preProcessors: clone(sourceState?.preProcessors || detail.preProcessors || []),
      postProcessors: clone(sourceState?.postProcessors || detail.postProcessors || []),
      existingCases: activeDefinitionCases.value.map(item => ({
        id: item.id,
        name: item.name,
        tags: item.tags || [],
      })),
    }, event => handleAiCaseGenerationEvent(event, generationState), { signal: abortController.signal })

    if (aiCaseGenerationStatus.value === 'running') {
      aiCaseGenerationStatus.value = 'done'
      aiCaseGenerationMessage.value = 'AI 生成接口用例完成'
      generationState.generating = false
      generationState.message = aiCaseGenerationMessage.value
      syncAiGenerationStateToPanel(generationState)
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      aiCaseGenerationStatus.value = 'failed'
      aiCaseGenerationMessage.value = '已停止生成'
      generationState.generating = false
      generationState.abortController = null
      generationState.message = aiCaseGenerationMessage.value
      markRemainingAiGeneratedCasesFailed(generationState, aiCaseGenerationMessage.value)
      return
    }
    aiCaseGenerationStatus.value = 'failed'
    aiCaseGenerationMessage.value = getRequestErrorMessage(error)
    generationState.generating = false
    generationState.message = aiCaseGenerationMessage.value
    generationState.logs.push(aiCaseGenerationMessage.value)
    markRemainingAiGeneratedCasesFailed(generationState, aiCaseGenerationMessage.value)
    syncAiGenerationStateToPanel(generationState)
  } finally {
    generationState.generating = false
    generationState.abortController = null
    syncAiGenerationStateToPanel(generationState)
  }
}

async function saveAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  const generationState = activeAiCaseGenerationState.value
  const definitionId = generationState?.definitionId || activeEditor.value?.definitionId
  if (!definitionId) return
  const targetWorkspaceCode = generationState?.workspaceCode || resolveCaseItemWorkspaceCode()
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '保存 AI 生成用例')) return
  aiCaseSavingId.value = result.id
  try {
    const draft = result.draft
    await apiAutomationApi.createCase(targetWorkspaceCode, {
      workspaceCode: targetWorkspaceCode,
      definitionId,
      name: draft.name?.trim() || 'AI 生成接口用例',
      description: draft.description || draft.expected || null,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      requestConfig: clone(draft.requestConfig || generationState?.requestConfig || activeEditor.value?.detail.requestConfig || emptyRequestConfig()),
      assertions: clone(draft.assertions || generationState?.assertions || activeEditor.value?.detail.assertions || []),
      preProcessors: clone(draft.preProcessors || generationState?.preProcessors || activeEditor.value?.detail.preProcessors || []),
      postProcessors: clone(draft.postProcessors || generationState?.postProcessors || activeEditor.value?.detail.postProcessors || []),
    })
    result.status = 'accepted'
    aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => id !== result.id)
    await loadCasesForDefinition(definitionId, targetWorkspaceCode)
    ElMessage.success('AI 生成用例已采纳并保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiCaseSavingId.value = ''
  }
}

function discardAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  result.status = 'discarded'
  aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => id !== result.id)
}

function markRemainingAiGeneratedCasesFailed(state: AiCaseGenerationTabState, message: string) {
  state.results.forEach((item) => {
    if (item.status === 'generating') {
      item.status = 'failed'
      item.message = item.message || message
    }
  })
  state.results = [...state.results]
  syncAiGenerationStateToPanel(state)
}

function stopAiCaseGeneration() {
  const state = activeAiCaseGenerationState.value
  if (!state) return
  state.abortController?.abort()
  state.generating = false
  state.abortController = null
  state.message = '已停止生成'
  markRemainingAiGeneratedCasesFailed(state, '已停止生成')
}

function toggleAiGeneratedCaseSelection(id: string, checked: string | number | boolean) {
  const selected = Boolean(checked)
  if (selected) {
    if (!aiCaseSelectedResultIds.value.includes(id)) {
      aiCaseSelectedResultIds.value = [...aiCaseSelectedResultIds.value, id]
    }
    return
  }
  aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(item => item !== id)
}

function toggleAllAiGeneratedCaseSelection(checked: string | number | boolean) {
  const selectableIds = aiCaseFilteredResults.value
    .filter(item => item.status === 'pending')
    .map(item => item.id)
  if (!Boolean(checked)) {
    aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => !selectableIds.includes(id))
    return
  }
  aiCaseSelectedResultIds.value = Array.from(new Set([...aiCaseSelectedResultIds.value, ...selectableIds]))
}

async function runAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  if (!ensureAiGeneratedCaseReady(result)) return
  const generationState = activeAiCaseGenerationState.value
  const targetWorkspaceCode = generationState?.workspaceCode || resolveCaseItemWorkspaceCode()
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '运行 AI 生成用例')) return
  const requestConfig = clone(result.draft.requestConfig || generationState?.requestConfig || emptyRequestConfig())
  if (!guardRunEnvironmentForPath(requestConfig.path || '')) return
  result.runResult = '运行中'
  result.runMessage = ''
  try {
    const runResult = await apiAutomationApi.debugRunDefinitionDraft(targetWorkspaceCode, {
      ...currentRunPayload(),
      workspaceCode: targetWorkspaceCode,
      name: result.draft.name || 'AI 生成接口用例',
      description: result.draft.description || result.draft.expected || null,
      tags: result.draft.tags || [],
      directoryName: null,
      requestConfig,
      assertions: clone(result.draft.assertions || generationState?.assertions || []),
      extractors: [],
      preProcessors: clone(result.draft.preProcessors || generationState?.preProcessors || []),
      postProcessors: clone(result.draft.postProcessors || generationState?.postProcessors || []),
    })
    result.runResult = runResult.result === 'PASSED' ? '通过' : '失败'
    result.runMessage = runResult.failureSummary || ''
    ElMessage.success('AI 生成用例已运行')
  } catch (error) {
    result.runResult = '失败'
    result.runMessage = getRequestErrorMessage(error)
    ElMessage.error(result.runMessage)
  }
}

async function runSelectedAiGeneratedCases() {
  const target = selectedPendingAiCaseResults.value[0]
  if (!target) {
    ElMessage.info('请先选择用例')
    return
  }
  await runAiGeneratedCase(target)
}

function openAiGeneratedCaseDetail(result: ApiAiGeneratedCaseResult) {
  if (!ensureAiGeneratedCaseReady(result)) return
  openAiGeneratedCaseInCaseDialog(result)
}

function aiGeneratedCaseGroupLabel(result: ApiAiGeneratedCaseResult | null) {
  return result?.draft.group || result?.draft.groupKey || '未分组'
}

function aiGeneratedCaseTypeLabel(result: ApiAiGeneratedCaseResult | null) {
  return result?.draft.type || result?.draft.typeKey || '接口用例'
}

function latestCaseRunHistories(items: ApiRunHistoryItem[]) {
  return [...items]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, CASE_RUN_HISTORY_LIMIT)
}

function ensureAiGeneratedCaseReady(result: ApiAiGeneratedCaseResult) {
  if (result.status === 'generating') {
    ElMessage.info('生成中，请稍后')
    return false
  }
  if (result.status === 'failed') {
    ElMessage.warning(result.message || '该用例生成失败')
    return false
  }
  return true
}

function buildCaseDraftFromAiGeneratedCase(result: ApiAiGeneratedCaseResult): ApiDefinitionCaseDetail {
  const state = activeAiCaseGenerationState.value
  const definition = activeEditor.value?.detail
  const requestConfig = clone(result.draft.requestConfig || state?.requestConfig || definition?.requestConfig || emptyRequestConfig())
  return {
    id: 0,
    workspaceCode: state?.workspaceCode || definition?.workspaceCode || props.workspaceCode,
    workspaceName: definition?.workspaceName || '',
    definitionId: state?.definitionId || activeEditor.value?.definitionId || 0,
    definitionName: state?.definitionName || definition?.name || '',
    name: normalizeAiGeneratedCaseName(result.draft.name, result.draft.type, result.draft.expected),
    method: requestConfig.method || state?.method || definition?.requestConfig.method || 'GET',
    path: requestConfig.path || state?.path || definition?.requestConfig.path || '',
    description: result.draft.description || result.draft.expected || null,
    tags: [...(result.draft.tags || [])],
    lastRunResult: result.runResult || null,
    lastRunAt: null,
    updatedAt: null,
    createdAt: null,
    requestConfig,
    assertions: clone(result.draft.assertions || []),
    extractors: [],
    preProcessors: clone(result.draft.preProcessors || []),
    postProcessors: clone(result.draft.postProcessors || []),
  }
}

function openAiGeneratedCaseInCaseDialog(result: ApiAiGeneratedCaseResult) {
  aiGeneratedCaseDialogSource.value = result
  aiGeneratedCaseDraftDetail.value = buildCaseDraftFromAiGeneratedCase(result)
  resetCaseDialogDebugState()
  caseDialogMode.value = 'create'
  editingCaseItem.value = null
  editingCaseDetail.value = null
  caseDetailErrorMessage.value = ''
  caseDialogVisible.value = true
}

function syncAiGeneratedCaseFromPayload(result: ApiAiGeneratedCaseResult, payload: SaveApiDefinitionCasePayload) {
  result.draft.name = normalizeAiGeneratedCaseName(payload.name, result.draft.type, result.draft.expected)
  result.draft.description = payload.description || ''
  result.draft.tags = [...(payload.tags || [])]
  result.draft.requestConfig = clone(payload.requestConfig)
  result.draft.assertions = clone(payload.assertions || [])
  result.draft.preProcessors = clone(payload.preProcessors || [])
  result.draft.postProcessors = clone(payload.postProcessors || [])
}

async function batchAcceptAiGeneratedCases() {
  let pending = selectedPendingAiCaseResults.value
  const pendingResults = aiCasePendingResults.value.filter(item => item.status === 'pending')
  if (!pending.length && pendingResults.length) {
    try {
      const confirmed = await confirmApiAction('当前未勾选生成结果，是否采纳全部待处理结果？', '批量采纳', {
        confirmText: '采纳全部',
      })
      if (!confirmed) return
    } catch {
      return
    }
    pending = pendingResults
  }
  if (!pending.length) {
    ElMessage.info('暂无待采纳的生成结果')
    return
  }
  for (const item of pending) {
    if (item.status === 'pending') {
      await saveAiGeneratedCase(item)
    }
  }
}

async function batchDiscardAiGeneratedCases() {
  let pending = selectedPendingAiCaseResults.value
  const pendingResults = aiCasePendingResults.value.filter(item => item.status === 'pending')
  if (!pending.length && pendingResults.length) {
    try {
      const confirmed = await confirmApiAction('当前未勾选生成结果，是否弃用全部待处理结果？', '批量弃用', {
        confirmText: '弃用全部',
        danger: true,
      })
      if (!confirmed) return
    } catch {
      return
    }
    pending = pendingResults
  }
  if (!pending.length) {
    ElMessage.info('暂无待弃用的生成结果')
    return
  }
  pending.forEach(item => {
    item.status = 'discarded'
  })
  aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => !pending.some(item => item.id === id))
}

function openCreateCaseDialog() {
  if (!activeEditor.value?.definitionId) {
    ElMessage.warning('请先保存接口，再新建用例')
    return
  }
  aiGeneratedCaseDialogSource.value = null
  aiGeneratedCaseDraftDetail.value = null
  resetCaseDialogDebugState()
  caseDialogMode.value = 'create'
  editingCaseItem.value = null
  editingCaseDetail.value = null
  caseDetailErrorMessage.value = ''
  caseDialogVisible.value = true
}

async function openEditCaseDialog(item: ApiDefinitionCaseItem) {
  aiGeneratedCaseDialogSource.value = null
  aiGeneratedCaseDraftDetail.value = null
  resetCaseDialogDebugState()
  caseDialogMode.value = 'edit'
  editingCaseItem.value = item
  editingCaseDetail.value = null
  caseDetailErrorMessage.value = ''
  caseDialogVisible.value = true
  caseDetailLoading.value = true
  try {
    editingCaseDetail.value = await apiAutomationApi.getCaseDetail(resolveCaseItemWorkspaceCode(item), item.id)
  } catch (error) {
    caseDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseDetailLoading.value = false
  }
}

function resetCaseDialogDebugState() {
  caseDialogDebugRunning.value = false
  caseDialogDebugResult.value = null
  caseDialogDebugError.value = ''
}

function resolveCaseItemWorkspaceCode(item?: ApiDefinitionCaseItem | null) {
  return (
    item?.workspaceCode
    || editingCaseDetail.value?.workspaceCode
    || viewingCaseDetail.value?.workspaceCode
    || viewingCaseItem.value?.workspaceCode
    || activeEditor.value?.detail.workspaceCode
    || props.workspaceCode
    || 'ALL'
  )
}

function requireConcreteCaseWorkspace(workspaceCode: string, actionText: string) {
  if (workspaceCode && workspaceCode !== 'ALL') return true
  ElMessage.warning(`请先切换到具体工作空间后${actionText}`)
  return false
}

async function openCaseDetailDrawer(item: ApiDefinitionCaseItem) {
  viewingCaseItem.value = item
  viewingCaseDetail.value = null
  viewingCaseDetailErrorMessage.value = ''
  caseRunHistories.value = []
  caseRunHistoryErrorMessage.value = ''
  selectedCaseRunHistoryId.value = null
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseDetailDrawerTab.value = 'detail'
  caseDetailRequestTab.value = 'headers'
  caseDetailResponseTab.value = 'body'
  caseHistoryView.value = 'list'
  caseHistoryRequestTab.value = 'header'
  caseHistoryResponseTab.value = 'body'
  caseDetailDrawerVisible.value = true
  const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
  await Promise.all([
    loadViewingCaseDetail(item.id, targetWorkspaceCode),
    loadCaseRunHistories(item.id, targetWorkspaceCode),
  ])
}

async function loadViewingCaseDetail(caseId: number, workspaceCode = resolveCaseItemWorkspaceCode()) {
  viewingCaseDetailLoading.value = true
  viewingCaseDetailErrorMessage.value = ''
  try {
    const detail = await apiAutomationApi.getCaseDetail(workspaceCode, caseId)
    viewingCaseDetail.value = detail
    caseDetailRequestTab.value = pickCaseDetailDefaultRequestTab(detail)
  } catch (error) {
    viewingCaseDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    viewingCaseDetailLoading.value = false
  }
}

async function loadCaseRunHistories(caseId: number, workspaceCode = resolveCaseItemWorkspaceCode()) {
  caseRunHistoryLoading.value = true
  caseRunHistoryErrorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCaseRunHistory(workspaceCode, caseId, {
      pageNo: 1,
      pageSize: CASE_RUN_HISTORY_LIMIT,
    })
    const recentHistories = latestCaseRunHistories(page.items)
    caseRunHistories.value = recentHistories
    caseHistoryView.value = 'list'
    selectedCaseRunHistoryId.value = null
    selectedCaseRunHistoryDetail.value = null
    caseRunHistoryDetailErrorMessage.value = ''
  } catch (error) {
    caseRunHistoryErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryLoading.value = false
  }
}

async function openCaseRunHistoryDetail(item: ApiRunHistoryItem) {
  selectedCaseRunHistoryId.value = item.id
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseRunHistoryDetailLoading.value = true
  try {
    selectedCaseRunHistoryDetail.value = await apiAutomationApi.getCaseRunHistoryDetail(resolveCaseItemWorkspaceCode(), item.id)
  } catch (error) {
    caseRunHistoryDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryDetailLoading.value = false
  }
}

async function openCaseRunHistorySecondaryDetail(item: ApiRunHistoryItem) {
  caseHistoryView.value = 'detail'
  await openCaseRunHistoryDetail(item)
}

function backToCaseRunHistoryList() {
  caseHistoryView.value = 'list'
}

function resolveCaseDialogWorkspaceCode(payload: SaveApiDefinitionCasePayload) {
  return (
    payload.workspaceCode
    || editingCaseDetail.value?.workspaceCode
    || editingCaseItem.value?.workspaceCode
    || activeEditor.value?.detail.workspaceCode
    || props.workspaceCode
    || 'ALL'
  )
}

async function submitCaseDialog(payload: SaveApiDefinitionCasePayload) {
  if (!activeEditor.value?.definitionId && !aiGeneratedCaseDraftDetail.value?.definitionId) return
  const targetWorkspaceCode = resolveCaseDialogWorkspaceCode(payload)
  if (targetWorkspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再保存用例')
    return
  }
  const requestPayload = {
    ...payload,
    workspaceCode: targetWorkspaceCode,
  }
  caseDialogSaving.value = true
  try {
    if (caseDialogMode.value === 'edit' && editingCaseItem.value) {
      await apiAutomationApi.updateCase(targetWorkspaceCode, editingCaseItem.value.id, requestPayload)
      ElMessage.success('用例已保存')
    } else {
      await apiAutomationApi.createCase(targetWorkspaceCode, requestPayload)
      ElMessage.success('用例已创建')
    }
    if (aiGeneratedCaseDialogSource.value) {
      syncAiGeneratedCaseFromPayload(aiGeneratedCaseDialogSource.value, payload)
      aiGeneratedCaseDialogSource.value.status = 'accepted'
      aiGeneratedCaseDialogSource.value = null
      aiGeneratedCaseDraftDetail.value = null
    }
    caseDialogVisible.value = false
    const definitionId = activeEditor.value?.definitionId || payload.definitionId || editingCaseDetail.value?.definitionId
    if (definitionId) {
      await loadCasesForDefinition(definitionId, targetWorkspaceCode)
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    caseDialogSaving.value = false
  }
}

async function debugCaseDialog(payload: SaveApiDefinitionCasePayload) {
  if (!activeEditor.value && !aiGeneratedCaseDraftDetail.value) return
  const targetWorkspaceCode = resolveCaseDialogWorkspaceCode(payload)
  if (targetWorkspaceCode === 'ALL') {
    caseDialogDebugError.value = '请先切换到具体工作空间后再发送用例请求'
    ElMessage.warning(caseDialogDebugError.value)
    return
  }
  if (!guardRunEnvironmentForPath(payload.requestConfig.path)) {
    return
  }
  caseDialogDebugRunning.value = true
  caseDialogDebugResult.value = null
  caseDialogDebugError.value = ''
  try {
    caseDialogDebugResult.value = await apiAutomationApi.debugRunDefinitionDraft(targetWorkspaceCode, {
      ...currentRunPayload(),
      workspaceCode: targetWorkspaceCode,
      name: payload.name,
      directoryName: null,
      description: payload.description,
      tags: payload.tags,
      requestConfig: clone(payload.requestConfig),
      assertions: clone(payload.assertions || []),
      extractors: [],
      preProcessors: clone(payload.preProcessors || []),
      postProcessors: clone(payload.postProcessors || []),
    })
    if (aiGeneratedCaseDialogSource.value) {
      syncAiGeneratedCaseFromPayload(aiGeneratedCaseDialogSource.value, payload)
      aiGeneratedCaseDialogSource.value.runResult = caseDialogDebugResult.value.result === 'PASSED' || caseDialogDebugResult.value.result === 'SUCCESS' ? '通过' : '失败'
      aiGeneratedCaseDialogSource.value.runMessage = caseDialogDebugResult.value.failureSummary || ''
    }
    ElMessage.success('用例请求已发送')
  } catch (error) {
    caseDialogDebugError.value = getRequestErrorMessage(error)
    ElMessage.error(caseDialogDebugError.value)
  } finally {
    caseDialogDebugRunning.value = false
  }
}

async function duplicateCase(item: ApiDefinitionCaseItem) {
  const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '复制用例')) return
  const detail = await apiAutomationApi.getCaseDetail(targetWorkspaceCode, item.id)
  await apiAutomationApi.createCase(targetWorkspaceCode, {
    workspaceCode: targetWorkspaceCode,
    definitionId: detail.definitionId,
    name: `${detail.name} - 副本`,
    description: detail.description,
    tags: detail.tags || [],
    requestConfig: clone(detail.requestConfig),
    assertions: clone(detail.assertions || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  })
  await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
  ElMessage.success('用例已复制')
}

async function deleteCase(item: ApiDefinitionCaseItem) {
  const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '删除用例')) return
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该用例吗？', '删除用例', {
    confirmText: '确认',
    danger: true,
  })
  if (!confirmed) return
  await apiAutomationApi.deleteCase(targetWorkspaceCode, item.id)
  await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
  ElMessage.success('用例已删除')
}

async function runCase(item: ApiDefinitionCaseItem) {
  const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
  if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '执行用例')) return
  caseRunningId.value = item.id
  try {
    await apiAutomationApi.runCase(targetWorkspaceCode, item.id, {
      ...currentRunPayload(),
      workspaceCode: targetWorkspaceCode,
    })
    await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
    if (caseDetailDrawerVisible.value && viewingCaseItem.value?.id === item.id) {
      await loadCaseRunHistories(item.id, targetWorkspaceCode)
    }
    ElMessage.success('用例执行完成')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    caseRunningId.value = null
  }
}

watch(
  () => [props.workspaceCode, props.workspaceReady],
  () => {
    tabs.value = []
    activeEditorKey.value = ''
    selectedDirectoryKey.value = 'definition-root'
    cases.value = []
    reportItems.value = []
    reportTotal.value = 0
    selectedReportDetail.value = null
    void loadWorkspaceData()
    if (activeTopTab.value === 'reports') {
      void refreshReportWorkspace()
    }
  },
)

watch(activeTopTab, tab => {
  if (tab === 'reports') {
    void refreshReportWorkspace()
  }
})

watch(tabs, () => {
  void nextTick(updateEditorTabOverflow)
}, { deep: true })

watch(activeEditorKey, () => {
  if (activeAiCaseGenerationState.value) {
    syncAiGenerationStateToPanel(activeAiCaseGenerationState.value)
  }
  void nextTick(updateEditorTabOverflow)
})

onMounted(() => {
  restoreResponsePanelHeight()
  void loadWorkspaceData()
  window.addEventListener('resize', updateEditorTabOverflow)
  void nextTick(updateEditorTabOverflow)
})

onBeforeUnmount(() => {
  stopResponseResize()
  window.clearTimeout(directorySearchTimer)
  window.removeEventListener('resize', updateEditorTabOverflow)
})
</script>

<template>
  <section class="api-interface-workspace">
    <div v-if="activeTopTab === 'definitions'" class="api-interface-shell">
      <aside class="api-interface-sidebar">
        <div class="api-interface-sidebar__actions">
          <button type="button" class="api-sidebar-primary" @click="openNewRequestTab()">
            <el-icon><Plus /></el-icon>
            新建请求
          </button>
          <button type="button" class="api-sidebar-secondary" @click="openImportDialog">
            <LucideUpload class="api-sidebar-button-icon" />
            导入
          </button>
        </div>

        <div class="api-sidebar-search">
          <el-input v-model="directoryKeyword" clearable placeholder="搜索模块或请求" :prefix-icon="Search" />
        </div>

        <div class="api-directory-title">
          <div>
            <span>请求目录</span>
            <b>{{ directorySearchMatchedCount }}</b>
            <small v-if="directorySearchLoading">搜索中</small>
          </div>
          <button type="button" title="收起全部子模块" @click="collapseDirectoryTree">
            <el-icon><Fold /></el-icon>
          </button>
        </div>
        <div v-if="directorySearchLimited" class="api-directory-search-tip">
          仅展示前 {{ DIRECTORY_SEARCH_RESULT_LIMIT }} 条结果，请输入更精确关键词
        </div>

        <div v-loading="moduleLoading || definitionLoading" class="api-directory-body app-soft-scrollbar">
          <div v-if="moduleErrorMessage || definitionErrorMessage" class="api-directory-error">
            {{ moduleErrorMessage || definitionErrorMessage }}
          </div>
          <ApiDirectoryTree
            ref="directoryTreeRef"
            v-else
            :data="visibleDirectoryTree"
            :expanded-keys="expandedKeys"
            :selected-key="selectedDirectoryKey"
            :render-key="directoryTreeRenderKey"
            :loading="directorySearchLoading"
            @node-click="handleDirectorySelect"
            @node-expand="(node: DirectoryNode) => setDirectoryNodeExpanded(node, true)"
            @node-collapse="(node: DirectoryNode) => setDirectoryNodeExpanded(node, false)"
            @create-module="createModule"
            @rename-module="renameModule"
            @delete-module="deleteModule"
            @rename-request="renameRequest"
            @delete-request="deleteRequest"
          />
        </div>
      </aside>

      <section class="api-interface-main">
        <div class="api-editor-tabs">
          <button
            v-if="editorTabOverflow.overflow"
            type="button"
            class="api-editor-tab-scroll"
            :disabled="editorTabOverflow.arrivedLeft"
            aria-label="向左滚动标签"
            @click="scrollEditorTabStrip('left')"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <div ref="editorTabNavRef" class="api-editor-tabs__nav" @scroll="updateEditorTabOverflow">
            <button
              v-for="item in tabs"
              :key="item.key"
              :class="['api-editor-tab', { 'is-active': item.key === activeEditorKey }]"
              type="button"
              :title="item.title"
              @click="activeEditorKey = item.key"
            >
              <span
                v-if="item.resourceType === 'ai-case-generation' && item.aiGeneration?.generating"
                :class="['ai-generation-tab-spinner', { spinning: item.aiGeneration?.generating }]"
                aria-hidden="true"
              ></span>
              <img
                v-else-if="item.resourceType === 'ai-case-generation'"
                :src="aiCaseGenerationFinishedIcon"
                alt="ai"
                class="ai-generation-tab-finished-icon"
              >
              <span v-else :class="['api-method', requestMethodClass(item.method)]">{{ item.method }}</span>
              <span class="api-editor-tab__label">{{ item.title }}</span>
              <span v-if="item.dirty" class="api-editor-tab__dot"></span>
              <span v-if="tabs.length > 1" class="api-editor-tab__close" @click.stop="closeEditorTab(item.key)">
                <el-icon><Close /></el-icon>
              </span>
            </button>
          </div>
          <button
            v-if="editorTabOverflow.overflow"
            type="button"
            class="api-editor-tab-scroll"
            :disabled="editorTabOverflow.arrivedRight"
            aria-label="向右滚动标签"
            @click="scrollEditorTabStrip('right')"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button type="button" class="api-editor-tab-add" @click="openNewRequestTab()">
            <el-icon><Plus /></el-icon>
          </button>
          <el-dropdown v-if="tabs.length" trigger="click" @command="handleEditorTabMenu">
            <button type="button" class="api-editor-tab-more">
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="closeCurrent" :disabled="!activeEditor">关闭当前标签</el-dropdown-item>
                <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
                <el-dropdown-item command="closeDrafts">关闭全部草稿</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div v-if="!activeEditor" class="api-editor-empty">
          <span>请选择左侧请求，或新建一个请求</span>
          <button type="button" @click="openNewRequestTab()">新建请求</button>
        </div>

        <template v-else-if="isAiCaseGenerationTabActive">
          <ApiAiGenerationWorkspace
            v-if="activeAiCaseGenerationState"
            v-model:result-filter="aiCaseResultFilter"
            v-model:keyword="aiCaseResultKeyword"
            v-model:group="aiCaseResultGroup"
            v-model:type="aiCaseResultType"
            :state="activeAiCaseGenerationState"
            :pending-count="aiCasePendingResults.length"
            :accepted-count="aiCaseAcceptedResults.length"
            :discarded-count="aiCaseDiscardedResults.length"
            :group-options="aiCaseResultGroupOptions"
            :type-options="aiCaseResultTypeOptions"
            :selected-pending-count="selectedPendingAiCaseResults.length"
            :saving-id="aiCaseSavingId"
            :pending-action-count="aiCasePendingResults.length"
            :filtered-results="aiCaseFilteredResults"
            :empty-text="aiCaseGenerationEmptyStateText"
            :selection-all-checked="aiCaseSelectionAllChecked"
            :selection-indeterminate="aiCaseSelectionIndeterminate"
            :selected-result-ids="aiCaseSelectedResultIds"
            :request-method-class="requestMethodClass"
            :case-type-label="aiGeneratedCaseTypeLabel"
            :case-group-label="aiGeneratedCaseGroupLabel"
            @generate-or-stop="activeAiCaseGenerationState.generating ? stopAiCaseGeneration() : openAiCaseDrawer()"
            @run-selected="runSelectedAiGeneratedCases"
            @accept-selected="batchAcceptAiGeneratedCases"
            @discard-selected="batchDiscardAiGeneratedCases"
            @toggle-all="toggleAllAiGeneratedCaseSelection"
            @toggle-selection="toggleAiGeneratedCaseSelection"
            @open-detail="openAiGeneratedCaseDetail"
            @run-case="runAiGeneratedCase"
            @save-case="saveAiGeneratedCase"
            @discard-case="discardAiGeneratedCase"
          />
        </template>

        <template v-else>
          <ApiRequestToolbar
            :method="activeEditor.detail.requestConfig.method"
            :path="activeEditor.detail.requestConfig.path"
            :definition-id="activeEditor.definitionId"
            :environment-id="selectedEnvironmentId"
            :environments="environments"
            :environment-selected="Boolean(selectedEnvironment)"
            :run-options-loading="runOptionsLoading"
            :sending="sending"
            :saving="saving"
            @update:method="activeEditor.detail.requestConfig.method = $event"
            @update:path="activeEditor.detail.requestConfig.path = $event"
            @update:environment-id="selectedEnvironmentId = $event"
            @dirty="markDirty"
            @import-curl="promptImportCurl"
            @open-environment="openRunEnvironmentDrawer"
            @persist-run-options="persistRunOptions"
            @send="sendActiveEditor"
            @save="saveActiveEditor"
            @save-as-case="saveAsCase"
            @duplicate="duplicateActiveEditor"
            @delete="deleteActiveEditor"
          />

          <ApiRequestContentTabs
            :tabs="contentTabs"
            :active-tab="activeEditor.activeTab"
            @update:active-tab="activeEditor.activeTab = $event"
          />

          <div class="api-editor-scroll">
            <div v-if="activeEditor.loading" class="api-editor-loading">
              <div class="api-editor-loading__title">正在加载接口详情</div>
              <div class="api-editor-loading__line is-long"></div>
              <div class="api-editor-loading__line"></div>
              <div class="api-editor-loading__block"></div>
            </div>
            <template v-else>
            <div :class="['api-request-body', `is-${activeEditor.activeTab}`]">
              <template v-if="activeEditor.activeTab === 'params'">
                <ApiKeyValueTable
                  title="Query 参数"
                  variant="query"
                  batch-target="query"
                  :rows="activeEditor.detail.requestConfig.queryParams"
                  :param-type-options="paramTypeOptions"
                  @dirty="markDirty"
                  @add-row="addRow(activeEditor.detail.requestConfig.queryParams)"
                  @remove-row="removeRow(activeEditor.detail.requestConfig.queryParams, $event)"
                  @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.queryParams, $event)"
                  @open-batch-add="openBatchAdd"
                />
              </template>

              <template v-else-if="activeEditor.activeTab === 'headers'">
                <ApiKeyValueTable
                  title="参数名称"
                  variant="header"
                  batch-target="header"
                  :rows="activeEditor.detail.requestConfig.headers"
                  @dirty="markDirty"
                  @add-row="addRow(activeEditor.detail.requestConfig.headers)"
                  @remove-row="removeRow(activeEditor.detail.requestConfig.headers, $event)"
                  @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.headers, $event)"
                  @open-batch-add="openBatchAdd"
                />
              </template>

              <template v-else-if="activeEditor.activeTab === 'cookies'">
                <div class="api-param-table is-cookie">
                  <div class="api-param-toolbar">
                    <span>Cookie</span>
                    <button type="button" @click="openBatchAdd('cookie')">批量添加</button>
                  </div>
                  <div class="api-param-header">
                    <span></span><span>Cookie 名称</span><span>Cookie 值</span><span>必填</span><span>描述</span><span></span>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.cookies" :key="`cookie-${index}`" class="api-param-row">
                    <el-checkbox v-model="row.enabled" @change="markDirty" />
                    <el-input v-model="row.key" placeholder="Cookie 名称" @input="markDirty" />
                    <el-input v-model="row.value" placeholder="Cookie 值 / {{variable}}" @input="markDirty" />
                    <el-checkbox v-model="row.required" @change="markDirty" />
                    <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                    <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.cookies, index)">删除</button>
                  </div>
                  <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.cookies)">+ 添加一行</button>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'body'">
                <ApiRequestBodyPanel
                  v-model:raw-text="activeBodyRawText"
                  v-model:body-json-view-mode="bodyJsonViewMode"
                  :body="activeEditor.detail.requestConfig.body"
                  :body-modes="bodyModes"
                  :raw-language="activeBodyLanguage"
                  :body-schema-fields="bodySchemaFields"
                  :param-type-options="paramTypeOptions"
                  :schema-field-depth="schemaFieldDepth"
                  :schema-field-name="schemaFieldName"
                  :schema-field-type-class="schemaFieldTypeClass"
                  :schema-field-type="schemaFieldType"
                  :schema-editable-value="schemaEditableValue"
                  :schema-field-enum="schemaFieldEnum"
                  :schema-field-limit="schemaFieldLimit"
                  :format-file-size="formatFileSize"
                  @dirty="markDirty"
                  @set-body-mode="setBodyMode"
                  @generate-body-schema-from-json="generateBodySchemaFromJson"
                  @generate-json-from-body-schema="generateJsonFromBodySchema"
                  @update-schema-required="updateSchemaRequired"
                  @update-schema-field-value="updateSchemaFieldValue"
                  @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.body.formItems, $event)"
                  @open-batch-add="openBatchAdd"
                  @handle-form-file-change="handleFormFileChange"
                  @clear-form-file="clearFormFile"
                  @remove-row="removeRow(activeEditor.detail.requestConfig.body.formItems, $event)"
                  @add-row="addRow(activeEditor.detail.requestConfig.body.formItems)"
                  @handle-binary-file-change="handleBinaryFileChange"
                  @clear-binary-file="clearBinaryFile"
                />
              </template>

              <template v-else-if="activeEditor.activeTab === 'auth'">
                <div class="api-auth-panel">
                  <span class="api-form-label">认证方式</span>
                  <el-radio-group v-model="activeEditor.detail.requestConfig.authConfig.authType" @change="markDirty">
                    <el-radio-button value="NONE">No Auth</el-radio-button>
                    <el-radio-button value="BASIC">Basic Auth</el-radio-button>
                    <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
                  </el-radio-group>
                  <div v-if="activeEditor.detail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
                    <label>Username</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
                  </div>
                  <div v-else-if="activeEditor.detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                    <label>Username</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
                  </div>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'settings'">
                <div class="api-settings-panel">
                  <label>接口名称</label>
                  <el-input v-model="activeEditor.detail.name" placeholder="接口名称" @input="markDirty" />
                  <label>模块 / 目录</label>
                  <el-input v-model="activeEditor.detail.directoryName" placeholder="模块 / 目录" @input="markDirty" />
                  <label>标签</label>
                  <el-input :model-value="activeEditor.detail.tags.join(', ')" placeholder="标签，逗号分隔" @update:model-value="(value: string | number) => { activeEditor!.detail.tags = String(value).split(',').map(item => item.trim()).filter(Boolean); markDirty() }" />
                  <label>超时时间</label>
                  <div class="api-settings-control-cell">
                    <el-input-number
                      v-model="activeEditor.detail.requestConfig.timeoutMs"
                      :min="1000"
                      :step="1000"
                      class="api-settings-timeout-number"
                      @change="markDirty"
                    />
                  </div>
                  <label>描述</label>
                  <el-input v-model="activeEditor.detail.description" type="textarea" :rows="4" placeholder="接口描述、调用约束或备注" @input="markDirty" />
                  <div class="api-settings-footer">
                    <span>写入空间 {{ currentDefinitionWorkspaceLabel }}</span>
                    <span>调试上下文 {{ currentEnvironmentName }} / {{ currentVariableSetName }}</span>
                    <span>最后运行 {{ activeEditor.runResult ? '已运行' : '未运行' }}</span>
                  </div>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'cases'">
                <ApiCaseListPanel
                  v-model:current-page="caseListCurrentPage"
                  v-model:page-size="caseListPageSize"
                  :definition-id="activeEditor.definitionId"
                  :cases="activeDefinitionCases"
                  :paged-cases="pagedDefinitionCases"
                  :total-pages="caseListTotalPages"
                  :page-sizes="[10, 20, 30, 40, 50]"
                  :running-id="caseRunningId"
                  :case-protocol-label="caseProtocolLabel"
                  :case-priority-label="casePriorityLabel"
                  :case-status-label="caseStatusLabel"
                  :format-case-tags="formatCaseTags"
                  @create="openCreateCaseDialog"
                  @ai-generate="openAiCaseDrawer"
                  @edit="openEditCaseDialog"
                  @run="runCase"
                  @detail="openCaseDetailDrawer"
                  @duplicate="duplicateCase"
                  @delete="deleteCase"
                />
              </template>

              <template v-else-if="activeEditor.activeTab === 'definition'">
                <ApiDefinitionPanel
                  v-model:definition-body-view-mode="definitionBodyViewMode"
                  v-model:definition-response-view-mode="definitionResponseViewMode"
                  :detail="activeEditor.detail"
                  :request-schema-groups="definitionRequestSchemaGroups"
                  :body-schema-fields="bodySchemaFields"
                  :response-schema-fields="responseSchemaFields"
                  :response-schema-groups="responseSchemaGroups"
                  :active-response-schema-group="activeResponseSchemaGroup"
                  :active-response-schema-fields="activeResponseSchemaFields"
                  :definition-request-example-json="definitionRequestExampleJson"
                  :definition-response-example-json="definitionResponseExampleJson"
                  :request-method-class="requestMethodClass"
                  :schema-field-depth="schemaFieldDepth"
                  :schema-field-name="schemaFieldName"
                  :schema-field-display-name="schemaFieldDisplayName"
                  :schema-field-type-class="schemaFieldTypeClass"
                  :schema-field-type="schemaFieldType"
                  :schema-field-description="schemaFieldDescription"
                  :schema-field-example-text="schemaFieldExampleText"
                  :schema-field-rule-text="schemaFieldRuleText"
                  @update:active-definition-response-code="activeDefinitionResponseCode = $event"
                />
              </template>

              <template v-else>
                <ApiExtractorPanel
                  v-if="activeEditor.activeTab === 'extractors'"
                  :rows="extractorRowsFor(activeEditor.detail)"
                  :source-options="extractorSourceOptions"
                  :expression-type-options="extractorExpressionTypeOptions"
                  @batch-add="openBatchAdd('extractor')"
                  @add="addExtractor"
                  @remove="removeExtractor"
                  @dirty="markDirty"
                />

                <ApiAssertionPanel
                  v-else-if="activeEditor.activeTab === 'tests'"
                  :rows="assertionRowsFor(activeEditor.detail)"
                  :active-assertion="activeAssertion"
                  :assertion-type-options="assertionTypeOptions"
                  :assertion-condition-options="assertionConditionOptions"
                  :has-latest-response-body="hasLatestResponseBody"
                  :fast-extraction-title="fastExtractionTitle"
                  :assertion-type-label="assertionTypeLabel"
                  :active-assertion-body-group="activeAssertionBodyGroup"
                  :default-assertion-expression="defaultAssertionExpression"
                  @batch-add="openBatchAdd('assertion')"
                  @add-from-latest-response="addAssertionFromLatestResponseCommand"
                  @add-from-command="addAssertionFromCommand"
                  @select="selectAssertion"
                  @move="moveAssertion"
                  @copy="copyAssertion"
                  @remove="removeAssertion"
                  @add-item="addAssertionItem"
                  @copy-item="copyAssertionItem"
                  @remove-item="removeAssertionItem"
                  @update-response-time="updateAssertionResponseTime"
                  @test-expression="testAssertionExpression"
                  @open-fast-extraction="openAssertionFastExtraction"
                  @dirty="markDirty"
                />

                <ApiProcessorPanel
                  v-else
                  :stage="activeProcessorStage()"
                  :rows="activeProcessorRows()"
                  :active-processor="activeProcessor"
                  :type-options="processorTypeOptionsFor(activeProcessorStage())"
                  :extract-variable-type-options="processorExtractVariableTypeOptions"
                  :extract-type-options="processorExtractTypeOptions"
                  :has-latest-response-body="hasLatestResponseBody"
                  :fast-extraction-title="fastExtractionTitle"
                  :more-settings-visible-key="processorExtractMoreSettingsVisibleKey"
                  :processor-default-name="processorDefaultName"
                  :processor-type-label="processorTypeLabel"
                  :normalize-sql-extract-params="normalizeSqlExtractParams"
                  :normalize-processor-extract-items="normalizeProcessorExtractItems"
                  :processor-extract-scope-options="processorExtractScopeOptions"
                  :processor-extract-expression-placeholder="processorExtractExpressionPlaceholder"
                  :show-processor-extract-specific-index="showProcessorExtractSpecificIndex"
                  :show-processor-extract-regex-settings="showProcessorExtractRegexSettings"
                  :show-processor-extract-xpath-settings="showProcessorExtractXPathSettings"
                  @add-from-command="addProcessorFromCommand"
                  @select="selectProcessor"
                  @move="moveProcessor"
                  @copy="copyProcessor"
                  @remove="removeProcessor"
                  @sync-script="syncProcessorScript"
                  @add-sql-extract-param="addSqlExtractParam"
                  @remove-sql-extract-param="removeSqlExtractParam"
                  @add-extract-item="addProcessorExtractItem"
                  @copy-extract-item="copyProcessorExtractItem"
                  @remove-extract-item="removeProcessorExtractItem"
                  @extract-type-change="handleProcessorExtractTypeChange"
                  @extract-scope-change="handleProcessorExtractScopeChange"
                  @set-more-settings-visible="setProcessorExtractMoreSettingsVisible"
                  @open-fast-extraction="openProcessorFastExtraction"
                  @dirty="markDirty"
                />
              </template>
            </div>

            <ApiResponsePanel
              v-if="shouldShowResponsePanel"
              :min-height="responsePanelHeight"
              :show-empty="showResponseEmpty"
              :active-tab="activeEditor.responseTab"
              :assertion-presentation="responseAssertionPresentation"
              :status="responseStatus"
              :status-tone="statusTone(responseStatus)"
              :duration="responseDuration"
              :size="responseSize"
              :body="responseBodyPretty"
              :body-language="responseBodyLanguage"
              :headers="responseHeaders"
              :console-text="responseConsole"
              :actual-request="actualRequest"
              :assertion-rows="assertionRows"
              :assertion-type-label="assertionTypeLabel"
              :assertion-condition-label="assertionConditionLabel"
              :assertion-result-class="assertionResultClass"
              :assertion-result-label="assertionResultLabel"
              @resize-start="startResponseResize"
              @update:active-tab="activeEditor.responseTab = $event"
            />
            </template>
          </div>
        </template>
      </section>
    </div>

    <ApiScenarioWorkspace
      v-else-if="activeTopTab === 'scenarios'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :workspaces="props.workspaces"
      :environments="environments"
      :variable-sets="variableSets"
    />

    <ApiExecutionWorkspace
      v-else-if="activeTopTab === 'execution'"
      :workspace-code="props.workspaceCode"
      :workspace-ready="props.workspaceReady"
      :workspaces="props.workspaces"
      :environments="environments"
      :variable-sets="variableSets"
    />

    <div v-else-if="activeTopTab === 'reports'" class="api-report-workspace" v-loading="reportLoading && !selectedReportDetail && !reportDetailLoading">
      <div v-if="selectedReportDetail || reportDetailLoading || reportDetailErrorMessage" class="api-report-detail-page" v-loading="reportDetailLoading">
        <div class="api-report-detail-page__header">
          <button type="button" class="api-report-detail-page__back" @click="backToReportList">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回报告列表</span>
          </button>
          <div class="api-report-detail-page__title">
            <span :class="['api-report-result', runResultClass(selectedReportDetail?.result)]">
              {{ runResultLabel(selectedReportDetail?.result) }}
            </span>
            <div>
              <strong>{{ selectedReportDetail?.objectName || '报告详情' }}</strong>
              <small>{{ reportObjectTypeLabel(selectedReportDetail?.objectType || '') }} · {{ formatDateTime(selectedReportDetail?.createdAt) }}</small>
            </div>
          </div>
          <div v-if="selectedReportDetail" class="api-report-detail-page__actions">
            <el-button
              :loading="reportActionLoadingKey === `rerun:${selectedReportDetail.reportKey}`"
              @click="rerunReport(selectedReportDetail)"
            >
              复跑
            </el-button>
            <el-button
              v-if="!selectedReportDetail.archived"
              type="warning"
              plain
              :loading="reportActionLoadingKey === `archive:${selectedReportDetail.reportKey}`"
              @click="archiveReport(selectedReportDetail)"
            >
              归档
            </el-button>
          </div>
        </div>

        <div v-if="reportDetailErrorMessage" class="api-report-empty">{{ reportDetailErrorMessage }}</div>
        <div v-else-if="selectedReportDetail" class="api-report-detail-page__body app-soft-scrollbar">
          <section class="api-report-detail-section is-overview">
            <div class="api-report-detail-section__head">
              <h3>执行概览</h3>
              <span>{{ selectedReportDetail.operatorName || '系统' }}</span>
            </div>
            <div class="api-report-summary-grid">
              <div v-for="[label, value] in reportDetailSummaryRows(selectedReportDetail)" :key="label">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </div>
            </div>
            <p v-if="selectedReportDetail.failureSummary" class="api-report-failure">
              {{ selectedReportDetail.failureSummary }}
            </p>
          </section>

          <section v-if="selectedReportContextSnapshot" class="api-report-detail-section">
            <div class="api-report-detail-section__head">
              <h3>运行上下文快照</h3>
              <span>用于复现本次执行</span>
            </div>
            <div class="api-report-context-grid">
              <div>
                <span>环境</span>
                <strong>{{ selectedReportDetail.environmentName || selectedReportContextSnapshot.environment?.id || '未选择环境' }}</strong>
                <small>{{ selectedReportContextSnapshot.environment?.baseUrl || '-' }}</small>
              </div>
              <div>
                <span>变量集</span>
                <strong>{{ selectedReportContextVariableSetLabel }}</strong>
                <small>
                  <template v-if="selectedReportContextVariableSetDetails.length">
                    {{ selectedReportContextVariableSetDetails.join(' / ') }}
                  </template>
                  <template v-else>ID {{ selectedReportContextSnapshot.variableSet?.id ?? selectedReportDetail.variableSetId ?? '-' }}</template>
                </small>
              </div>
              <div>
                <span>Mock</span>
                <strong>{{ selectedReportContextSnapshot.mock?.appName || '未启用 Mock' }}</strong>
                <small>
                  <template v-if="selectedReportContextSnapshot.mock?.businessScenarioName">
                    {{ selectedReportContextSnapshot.mock.businessScenarioName }}
                  </template>
                  <template v-else>{{ selectedReportContextSnapshot.mock?.appCode || selectedReportContextSnapshot.mock?.baseUrl || '-' }}</template>
                </small>
              </div>
              <div>
                <span>变量数量</span>
                <strong>{{ selectedReportContextVariables.length }}</strong>
                <small>保存本次运行实际变量</small>
              </div>
            </div>
            <div v-if="selectedReportLocalRunnerRows.length" class="api-report-runner-context">
              <div v-for="row in selectedReportLocalRunnerRows" :key="row.label">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
            </div>
            <details v-if="selectedReportContextVariables.length" class="api-report-context-variables">
              <summary>查看变量快照</summary>
              <div>
                <span v-for="item in selectedReportContextVariables" :key="item.key">
                  <b>{{ item.key }}</b>
                  <em>{{ item.value || '-' }}</em>
                </span>
              </div>
            </details>
          </section>

          <section class="api-report-detail-section">
            <div class="api-report-detail-section__head">
              <h3>执行链路</h3>
              <span>{{ selectedReportDetail.stepResults.length }} 步</span>
            </div>
            <div v-if="!selectedReportTree.length" class="api-report-empty">暂无执行链路</div>
            <div v-else class="api-report-execution-tree">
              <template v-for="node in selectedReportTree" :key="node.key">
                <button
                  type="button"
                  :class="[
                    'api-report-tree-row',
                    `is-${node.type}`,
                    { expanded: expandedReportTreeKeys.includes(node.key), 'is-leaf': !node.children.length },
                  ]"
                  @click="toggleReportTreeNode(node)"
                >
                  <span class="api-report-tree-toggle">
                    <el-icon v-if="node.children.length"><ArrowRight /></el-icon>
                  </span>
                  <span :class="['api-report-result', runResultClass(node.result)]">{{ node.success === null ? runResultLabel(node.result) : node.success ? '通过' : '失败' }}</span>
                  <span class="api-report-tree-main">
                    <strong>{{ node.title }}</strong>
                    <em>{{ reportTreeNodeTypeLabel(node) }}</em>
                  </span>
                  <span>{{ node.statusCode ? `HTTP ${node.statusCode}` : '-' }}</span>
                  <span>{{ formatDuration(node.durationMs) }}</span>
                  <span class="api-report-tree-error">{{ node.failureSummary || '-' }}</span>
                </button>

                <div v-if="expandedReportTreeKeys.includes(node.key)" class="api-report-tree-children">
                  <button
                    v-for="child in node.children"
                    :key="child.key"
                    type="button"
                    :class="[
                      'api-report-tree-row',
                      'is-child',
                      `is-${child.type}`,
                      { expanded: expandedReportTreeKeys.includes(child.key), 'is-leaf': !child.children.length },
                    ]"
                    @click="toggleReportTreeNode(child)"
                  >
                    <span class="api-report-tree-toggle">
                      <el-icon v-if="child.children.length"><ArrowRight /></el-icon>
                    </span>
                    <span :class="['api-report-result', child.success === false ? 'is-failed' : 'is-passed']">{{ child.success === false ? '失败' : '通过' }}</span>
                    <span class="api-report-tree-main">
                      <strong>{{ child.title }}</strong>
                      <em>{{ reportTreeNodeTypeLabel(child) }}</em>
                    </span>
                    <span>{{ child.statusCode ? `HTTP ${child.statusCode}` : '-' }}</span>
                    <span>{{ formatDuration(child.durationMs) }}</span>
                    <span class="api-report-tree-error">{{ child.failureSummary || '-' }}</span>
                  </button>
                </div>
              </template>
            </div>
          </section>

          <section v-if="selectedReportDetail.dataIterations.length" class="api-report-detail-section">
            <div class="api-report-detail-section__head">
              <h3>测试数据行结果</h3>
              <span>{{ selectedReportDetail.dataIterations.length }} 行</span>
            </div>
            <div class="api-report-item-list">
              <div
                v-for="row in selectedReportDetail.dataIterations"
                :key="`${row.loopIndex || 1}-${row.rowIndex}`"
                class="api-report-item-row"
              >
                <span :class="['api-report-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
                <small>第 {{ row.loopIndex || 1 }} 轮 / 第 {{ row.rowIndex }} 行</small>
                <strong>{{ row.caseDesc || '未命名数据行' }}</strong>
                <span>{{ row.stepCount ?? 0 }} 步</span>
                <span>{{ formatDuration(row.durationMs) }}</span>
                <p v-if="row.failureSummary">{{ row.failureSummary }}</p>
              </div>
            </div>
          </section>

        </div>
      </div>

      <template v-else>
      <div class="api-report-toolbar">
        <el-input
          v-model="reportKeyword"
          class="api-report-search"
          clearable
          placeholder="搜索报告、对象或执行人"
          @keyup.enter="searchReports"
          @clear="searchReports"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="reportObjectType" class="api-report-filter" placeholder="全部类型" clearable @change="searchReports">
          <el-option label="接口用例" value="API_CASE" />
          <el-option label="场景" value="SCENARIO" />
          <el-option label="执行套件" value="SUITE" />
        </el-select>
        <el-select v-model="reportResult" class="api-report-filter" placeholder="全部结果" clearable @change="searchReports">
          <el-option label="通过" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
          <el-option label="无断言" value="NO_ASSERTION" />
        </el-select>
        <el-select v-model="reportArchiveFilter" class="api-report-filter is-archive" @change="searchReports">
          <el-option label="活跃报告" value="active" />
          <el-option label="归档报告" value="archived" />
          <el-option label="全部报告" value="all" />
        </el-select>
        <el-button :loading="reportExporting" @click="exportReports">导出</el-button>
        <el-date-picker
          v-model="reportCreatedRange"
          class="api-report-date-range"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          format="YYYY-MM-DD HH:mm"
          clearable
          @change="searchReports"
        />
        <el-button type="primary" @click="searchReports">查询</el-button>
        <el-button @click="resetReportFilters">清空</el-button>
        <el-button @click="refreshReportWorkspace">刷新</el-button>
      </div>

      <div class="api-report-analysis" v-loading="reportAnalysisLoading">
        <div class="api-report-analysis__summary">
          <div
            v-for="item in reportAnalysisSummaryRows(reportAnalysis)"
            :key="item.label"
            :class="['api-report-analysis-card', `is-${item.tone}`]"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="api-report-analysis__panel">
          <div class="api-report-analysis__title">
            <strong>失败原因</strong>
            <span>Top {{ reportAnalysis?.failureReasons.length || 0 }}</span>
          </div>
          <el-scrollbar v-if="reportAnalysis?.failureReasons.length" class="api-report-rank-list" max-height="96px">
            <button
              v-for="item in reportAnalysis.failureReasons"
              :key="item.key"
              type="button"
              class="api-report-rank-row"
              @click="reportKeyword = item.label; searchReports()"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </button>
          </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无失败原因</div>
        </div>
        <div class="api-report-analysis__panel">
          <div class="api-report-analysis__title">
            <strong>高频失败对象</strong>
            <span>Top {{ reportAnalysis?.topFailedObjects.length || 0 }}</span>
          </div>
          <el-scrollbar v-if="reportAnalysis?.topFailedObjects.length" class="api-report-rank-list" max-height="96px">
            <button
              v-for="item in reportAnalysis.topFailedObjects"
              :key="item.key"
              type="button"
              class="api-report-rank-row"
              @click="reportKeyword = item.label; searchReports()"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
              <small>{{ formatDuration(item.durationMs) }}</small>
            </button>
          </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无失败对象</div>
        </div>
        <div class="api-report-analysis__panel">
          <div class="api-report-analysis__title">
            <strong>最近失败</strong>
            <span>{{ reportAnalysis?.recentFailures.length || 0 }} 条</span>
          </div>
          <el-scrollbar v-if="reportAnalysis?.recentFailures.length" class="api-report-recent-list" max-height="96px">
            <button
              v-for="item in reportAnalysis.recentFailures"
              :key="item.reportKey"
              type="button"
              class="api-report-recent-row"
              @click="openReportDetail(item)"
              >
                <span :class="['api-report-result', runResultClass(item.result)]">{{ runResultLabel(item.result) }}</span>
                <div>
                  <strong>{{ item.objectName }}</strong>
                </div>
              </button>
          </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无失败记录</div>
        </div>
      </div>

      <div class="api-report-statistics" v-loading="reportStatisticsLoading">
        <section class="api-report-stat-panel is-trend">
          <div class="api-report-analysis__title">
            <strong>运行趋势</strong>
            <span>{{ reportStatistics?.trendPoints.length || 0 }} 天</span>
          </div>
            <el-scrollbar v-if="reportStatistics?.trendPoints.length" class="api-report-trend-list" max-height="132px">
              <div v-for="point in reportStatistics.trendPoints" :key="point.date" class="api-report-trend-row">
                <span class="api-report-trend-date">{{ point.date }}</span>
                <div class="api-report-trend-bar">
                <i :style="{ width: reportTrendBarWidth(point.totalCount) }"></i>
                <em :style="{ width: reportFailureRateWidth(point.failureRate) }"></em>
              </div>
                <strong>{{ point.totalCount }}</strong>
                <small>失败 {{ point.failedCount }} · {{ reportFailureRateText(point.failureRate) }}</small>
              </div>
            </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无趋势数据</div>
        </section>

        <section class="api-report-stat-panel">
          <div class="api-report-analysis__title">
            <strong>结果分布</strong>
            <span>{{ reportStatistics?.resultDistribution.length || 0 }} 项</span>
          </div>
            <el-scrollbar v-if="reportStatistics?.resultDistribution.length" class="api-report-distribution-list" max-height="132px">
              <div v-for="item in reportStatistics.resultDistribution" :key="item.key" class="api-report-distribution-row">
                <span>{{ item.label }}</span>
                <div><i :style="{ width: reportDistributionWidth(item.count, 'result') }"></i></div>
                <strong>{{ item.count }}</strong>
              </div>
            </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无结果分布</div>
        </section>

        <section class="api-report-stat-panel">
          <div class="api-report-analysis__title">
            <strong>对象类型</strong>
            <span>{{ reportStatistics?.objectTypeDistribution.length || 0 }} 项</span>
          </div>
            <el-scrollbar v-if="reportStatistics?.objectTypeDistribution.length" class="api-report-distribution-list" max-height="132px">
              <div v-for="item in reportStatistics.objectTypeDistribution" :key="item.key" class="api-report-distribution-row">
                <span>{{ item.label }}</span>
                <div><i :style="{ width: reportDistributionWidth(item.count, 'objectType') }"></i></div>
                <strong>{{ item.count }}</strong>
              </div>
            </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无对象类型</div>
        </section>

        <section class="api-report-stat-panel">
          <div class="api-report-analysis__title">
            <strong>慢运行</strong>
            <span>Top {{ reportStatistics?.slowestRuns.length || 0 }}</span>
          </div>
            <el-scrollbar v-if="reportStatistics?.slowestRuns.length" class="api-report-slowest-list" max-height="132px">
              <button
                v-for="item in reportStatistics.slowestRuns"
                :key="item.reportKey"
              type="button"
              class="api-report-slowest-row"
              @click="openReportDetail(item)"
            >
              <span>{{ reportObjectTypeLabel(item.objectType) }}</span>
                <strong>{{ item.objectName }}</strong>
                <small>{{ formatDuration(item.durationMs) }}</small>
              </button>
            </el-scrollbar>
          <div v-else class="api-report-analysis-empty">暂无慢运行数据</div>
        </section>
      </div>

      <div class="api-report-table-shell">
        <el-table
          :data="reportItems"
          height="100%"
          class="api-report-table"
          empty-text="暂无报告"
          @row-click="openReportDetail"
        >
          <el-table-column label="结果" width="96">
            <template #default="{ row }">
              <span :class="['api-report-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">{{ reportObjectTypeLabel(row.objectType) }}</template>
          </el-table-column>
          <el-table-column label="执行对象" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <strong class="api-report-object">{{ row.objectName }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="通过" width="100">
            <template #default="{ row }">{{ reportPassedText(row) }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="110">
            <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
          </el-table-column>
          <el-table-column label="环境" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row.environmentName || '默认' }}</template>
          </el-table-column>
          <el-table-column label="变量集" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ row.variableSetName || '未选择' }}</template>
          </el-table-column>
          <el-table-column label="执行人" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.operatorName || '系统' }}</template>
          </el-table-column>
          <el-table-column label="执行时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openReportDetail(row)">详情</el-button>
              <el-button
                link
                type="primary"
                :loading="reportActionLoadingKey === `rerun:${row.reportKey}`"
                @click.stop="rerunReport(row)"
              >
                复跑
              </el-button>
              <el-button
                v-if="!row.archived"
                link
                type="warning"
                :loading="reportActionLoadingKey === `archive:${row.reportKey}`"
                @click.stop="archiveReport(row)"
              >
                归档
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="api-report-pagination">
        <el-pagination
          v-model:current-page="reportPageNo"
          v-model:page-size="reportPageSize"
          :total="reportTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="handleReportPageChange"
          @size-change="handleReportPageSizeChange"
        />
      </div>
      </template>
    </div>

    <div v-else-if="activeTopTab === 'settings'" class="api-automation-settings-workspace">
      <section class="api-automation-settings-card">
        <div>
          <strong>接口自动化设置</strong>
          <p>这里后续承载请求超时、重试、代理、SSL、通知和本地调试等全局配置。</p>
        </div>
        <el-tag type="info" effect="plain">规划中</el-tag>
      </section>
      <section class="api-automation-settings-grid">
        <div class="api-automation-settings-item">
          <strong>请求超时与重试</strong>
          <span>全局请求超时时间、失败重试次数、重试间隔。</span>
        </div>
        <div class="api-automation-settings-item">
          <strong>网络代理与 SSL</strong>
          <span>全局代理、证书校验策略和测试环境访问配置。</span>
        </div>
        <div class="api-automation-settings-item">
          <strong>通知设置</strong>
          <span>套件运行完成、失败告警、报告推送等通知规则。</span>
        </div>
        <div class="api-automation-settings-item">
          <strong>本地调试</strong>
          <span>维护本地 Runner 状态、任务心跳和调试范围；服务端执行使用后端默认配置。</span>
        </div>
      </section>
    </div>

    <el-dialog
      v-model="softPromptVisible"
      width="420px"
      append-to-body
      :show-close="false"
      align-center
      class="api-soft-dialog-shell"
      @closed="cancelApiSoftPrompt"
    >
      <div class="api-soft-dialog">
        <div class="api-soft-dialog__header">
          <strong>{{ softPromptTitle }}</strong>
          <button type="button" class="api-soft-dialog__close" @click="cancelApiSoftPrompt">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="api-soft-dialog__body">
          <p v-if="softPromptMessage">{{ softPromptMessage }}</p>
          <el-input
            v-if="softPromptInputType === 'textarea'"
            v-model="softPromptValue"
            type="textarea"
            :rows="8"
            resize="none"
            :placeholder="softPromptPlaceholder"
            @keydown.ctrl.enter.prevent="confirmApiSoftPrompt"
          />
          <el-input
            v-else
            v-model="softPromptValue"
            :placeholder="softPromptPlaceholder"
            @keyup.enter="confirmApiSoftPrompt"
          />
          <div v-if="softPromptError" class="api-soft-dialog__error">{{ softPromptError }}</div>
        </div>
        <div class="api-soft-dialog__footer">
          <button type="button" class="api-soft-dialog__cancel" @click="cancelApiSoftPrompt">{{ softPromptCancelText }}</button>
          <button type="button" class="api-soft-dialog__submit" @click="confirmApiSoftPrompt">{{ softPromptConfirmText }}</button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      width="520px"
      append-to-body
      destroy-on-close
      :show-close="false"
      class="api-import-dialog-shell"
    >
      <div class="api-import-dialog">
        <div class="api-import-header">
          <div class="api-import-title">
            <LucideUpload class="api-import-title-icon" />
            <span>导入接口</span>
          </div>
          <button type="button" class="api-import-close" @click="closeImportDialog">
            <LucideX />
          </button>
        </div>

        <div class="api-import-body">
          <section class="api-import-section">
            <div class="api-import-section-title">选择导入格式</div>
            <div class="api-import-format-list">
              <button
                v-for="item in importCapabilityItems"
                :key="item.mode"
                type="button"
                :class="['api-import-format', `is-${item.tone}`, { 'is-active': importMode === item.mode }]"
                @click="importMode = item.mode"
              >
                <span class="api-import-format-icon">
                  <component :is="item.icon" />
                </span>
                <span class="api-import-format-copy">
                  <span>{{ item.name }}</span>
                  <small>{{ item.description }}</small>
                </span>
                <span class="api-import-check">
                  <LucideCheck v-if="importMode === item.mode" />
                </span>
              </button>
            </div>
          </section>

          <section class="api-import-section">
            <div class="api-import-section-title">导入方式</div>
            <div class="api-import-mode-switch">
              <button
                type="button"
                :class="{ 'is-active': importInputMode === 'url' }"
                @click="importInputMode = 'url'"
              >
                URL 导入
              </button>
              <button
                type="button"
                :class="{ 'is-active': importInputMode === 'file' }"
                @click="importInputMode = 'file'"
              >
                文件上传
              </button>
            </div>
            <el-input
              v-if="importInputMode === 'url'"
              v-model="importUrl"
              class="api-import-url"
              :placeholder="importMode === 'swagger' ? 'https://api.example.com/v3/api-docs' : '输入文件远程地址'"
            />
            <label v-else class="api-import-upload">
              <LucideUpload class="api-import-upload-icon" />
              <span>{{ importFileName || '点击或拖拽文件到此处' }}</span>
              <small>支持 {{ selectedImportCapability.accept }}</small>
              <input
                type="file"
                :accept="selectedImportCapability.accept"
                @change="handleImportFileChange"
              >
            </label>
            <div class="api-import-field">
              <span>所属模块</span>
              <el-select
                v-model="importDirectoryName"
                clearable
                filterable
                placeholder="根目录"
              >
                <el-option
                  v-for="item in importModuleOptions"
                  :key="`${item.workspaceCode}:${item.value || 'root'}`"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </section>
        </div>

        <div class="api-import-footer">
          <button type="button" class="api-import-cancel" :disabled="importSubmitting" @click="closeImportDialog">取消</button>
          <button type="button" class="api-import-submit" :disabled="importSubmitting" @click="submitImportDialog">
            {{ importSubmitting ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </el-dialog>

    <ApiDefinitionSaveDialog
      v-model="definitionSaveDialogVisible"
      :current-name="activeEditor?.detail.name"
      :request-path="activeEditor?.detail.requestConfig.path"
      :current-directory-name="activeEditor?.detail.directoryName"
      :selected-directory-name="currentImportDirectoryName()"
      :directory-tree="directoryTree"
      :submitting="saving"
      :module-creating="definitionSaveModuleCreating"
      @confirm="confirmCreateDefinition"
      @create-module="createModuleFromSaveDialog"
    />

    <el-dialog
      v-model="batchAddVisible"
      width="560px"
      append-to-body
      :show-close="false"
      class="api-batch-dialog-shell"
    >
      <div class="api-batch-dialog">
        <div class="api-batch-dialog__header">
          <strong>{{ batchAddTitle }}</strong>
          <button type="button" class="api-soft-dialog__close" @click="batchAddVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="api-batch-dialog__body">
          <p>{{ batchAddHint }}</p>
          <div class="api-batch-dialog__examples">
            <span>格式示例</span>
            <code v-for="item in batchAddExamples" :key="item">{{ item }}</code>
          </div>
          <div class="api-batch-dialog__notes">
            <span>空行会自动忽略</span>
            <span>重复 key 以后输入的值为准</span>
            <span>无 key 的行不会写入</span>
          </div>
          <el-input
            v-model="batchAddText"
            type="textarea"
            :rows="10"
            resize="none"
            :placeholder="batchAddPlaceholder"
          />
        </div>
        <div class="api-batch-dialog__footer">
          <button type="button" class="api-soft-dialog__cancel" @click="batchAddVisible = false">取消</button>
          <button type="button" class="api-soft-dialog__submit" @click="applyBatchAdd">确认添加</button>
        </div>
      </div>
    </el-dialog>

    <ApiCaseDetailDrawer
      v-model="caseDetailDrawerVisible"
      :title="viewingCaseItem?.name || '用例详情'"
      :subtitle="viewingCaseItem?.definitionName || activeEditor?.detail.name || '-'"
      :method="viewingCaseItem?.method || '-'"
      :path="viewingCaseItem?.path || '未设置路径'"
      @request-close="caseDetailDrawerVisible = false"
    >
      <div class="api-case-drawer-tabs">
        <div class="ms-like-top-tabs case-drawer-view-tabs">
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'detail' }]" @click="caseDetailDrawerTab = 'detail'">详情</button>
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'history' }]" @click="caseDetailDrawerTab = 'history'">执行历史</button>
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'changes' }]" @click="caseDetailDrawerTab = 'changes'">变更历史</button>
        </div>
      </div>

      <div v-if="caseDetailDrawerTab === 'detail'" class="api-case-detail-panel" v-loading="viewingCaseDetailLoading">
            <div v-if="viewingCaseDetailErrorMessage" class="api-empty-body">{{ viewingCaseDetailErrorMessage }}</div>
            <template v-else-if="viewingCaseDetail">
              <div class="ms-like-top-tabs case-drawer-top-tabs">
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'headers' }]" @click="caseDetailRequestTab = 'headers'">请求头</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'body' }]" @click="caseDetailRequestTab = 'body'">请求体</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'params' }]" @click="caseDetailRequestTab = 'params'">
                  Params
                  <span v-if="enabledRows(viewingCaseDetail.requestConfig.queryParams).length" class="ms-like-tab-badge">{{ enabledRows(viewingCaseDetail.requestConfig.queryParams).length }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'auth' }]" @click="caseDetailRequestTab = 'auth'">Auth</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'pre' }]" @click="caseDetailRequestTab = 'pre'">前置处理</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'post' }]" @click="caseDetailRequestTab = 'post'">后置处理</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'tests' }]" @click="caseDetailRequestTab = 'tests'">
                  断言
                  <span v-if="viewingCaseDetail.assertions.length" class="ms-like-tab-badge">{{ viewingCaseDetail.assertions.length }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'settings' }]" @click="caseDetailRequestTab = 'settings'">设置</button>
              </div>

              <div class="api-request-body api-case-readonly-body">
                <template v-if="caseDetailRequestTab === 'headers'">
                  <div class="api-param-table is-header is-readonly">
                    <div class="api-param-header">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"></span>
                      <span class="api-header-title">参数名称</span>
                      <span>参数值</span>
                      <span>描述</span>
                    </div>
                    <div v-for="(row, index) in viewingCaseDetail.requestConfig.headers" :key="`case-header-${index}`" class="api-param-row">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                      <el-input :model-value="row.key" disabled placeholder="参数名称" />
                      <el-input :model-value="row.value" disabled placeholder="参数值" />
                      <el-input :model-value="row.description" disabled placeholder="描述" />
                    </div>
                    <div v-if="!viewingCaseDetail.requestConfig.headers.length" class="api-empty-body">暂无请求头</div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'params'">
                  <div class="api-param-table is-query is-readonly">
                    <div class="api-param-header">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"></span>
                      <span class="api-header-title">Query 参数</span>
                      <span class="api-type-header">类型</span>
                      <span>参数值</span>
                      <span class="api-length-header">长度范围</span>
                      <span>编码</span>
                      <span>描述</span>
                    </div>
                    <div v-for="(row, index) in viewingCaseDetail.requestConfig.queryParams" :key="`case-query-${index}`" class="api-param-row">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                      <el-input :model-value="row.key" disabled placeholder="参数名称" />
                      <div class="api-type-field">
                        <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                        <el-select :model-value="row.paramType" disabled>
                          <el-option v-for="type in paramTypeOptions.filter(item => item !== 'file')" :key="type" :label="type" :value="type" />
                        </el-select>
                      </div>
                      <el-input :model-value="row.value" disabled placeholder="参数值" />
                      <div class="api-length-range">
                        <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                        <span>-</span>
                        <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                      </div>
                      <el-switch :model-value="row.encode" size="small" disabled />
                      <el-input :model-value="row.description" disabled placeholder="描述" />
                    </div>
                    <div v-if="!viewingCaseDetail.requestConfig.queryParams.length" class="api-empty-body">暂无 Query 参数</div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'body'">
                  <div class="api-body-section">
                    <div class="api-body-modes">
                      <button
                        v-for="mode in bodyModes"
                        :key="mode.value"
                        :class="['api-body-chip', { 'is-active': viewingCaseDetail.requestConfig.body.type === mode.value }]"
                        type="button"
                        disabled
                      >
                        {{ mode.label }}
                      </button>
                    </div>
                    <div :class="['api-body-editor', { 'is-empty': viewingCaseDetail.requestConfig.body.type === 'NONE', 'is-code': isRawBodyType(viewingCaseDetail.requestConfig.body.type) }]">
                      <div v-if="viewingCaseDetail.requestConfig.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
                      <ApiCodeEditor
                        v-else-if="isRawBodyType(viewingCaseDetail.requestConfig.body.type)"
                        :model-value="caseDetailBodyRawText"
                        :language="caseDetailBodyLanguage"
                        read-only
                        :show-format-button="false"
                        height="300px"
                      />
                      <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(viewingCaseDetail.requestConfig.body.type)" class="api-param-table is-body-form is-readonly">
                        <div class="api-param-header">
                          <span class="api-drag-cell"></span>
                          <span class="api-checkbox-cell"></span>
                          <span class="api-header-title">参数名称</span>
                          <span class="api-type-header">类型</span>
                          <span>参数值</span>
                          <span class="api-length-header">长度范围</span>
                          <span>描述</span>
                        </div>
                        <div v-for="(row, index) in viewingCaseDetail.requestConfig.body.formItems" :key="`case-body-${index}`" class="api-param-row">
                          <span class="api-drag-cell"></span>
                          <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                          <el-input :model-value="row.key" disabled placeholder="参数名称" />
                          <div class="api-type-field">
                            <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                            <el-select :model-value="row.paramType" disabled>
                              <el-option v-for="type in paramTypeOptions" :key="type" :label="type" :value="type" />
                            </el-select>
                          </div>
                          <el-input :model-value="row.fileName || row.value" disabled placeholder="参数值" />
                          <div class="api-length-range">
                            <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                            <span>-</span>
                            <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                          </div>
                          <el-input :model-value="row.description" disabled placeholder="描述" />
                        </div>
                        <div v-if="!viewingCaseDetail.requestConfig.body.formItems.length" class="api-empty-body">暂无表单参数</div>
                      </div>
                      <div v-else class="api-binary-panel is-readonly">
                        <div class="api-binary-row">
                          <div class="api-binary-label">File</div>
                          <div class="api-binary-actions">
                            <button type="button" class="api-binary-pick" disabled>{{ viewingCaseDetail.requestConfig.body.fileName ? '重新选择' : '选择文件' }}</button>
                            <button type="button" class="api-binary-clear" disabled>清空</button>
                          </div>
                        </div>
                        <div class="api-binary-row">
                          <div class="api-binary-label">已选文件</div>
                          <div class="api-binary-selected">
                            <template v-if="viewingCaseDetail.requestConfig.body.fileName">
                              <span class="api-binary-file-name">{{ viewingCaseDetail.requestConfig.body.fileName }}</span>
                              <span v-if="viewingCaseDetail.requestConfig.body.fileSize" class="api-binary-file-size">{{ formatFileSize(viewingCaseDetail.requestConfig.body.fileSize) }}</span>
                            </template>
                            <template v-else>尚未选择二进制文件</template>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'auth'">
                  <div class="api-auth-panel">
                    <span class="api-form-label">认证方式</span>
                    <el-radio-group :model-value="viewingCaseDetail.requestConfig.authConfig.authType" disabled>
                      <el-radio-button value="NONE">No Auth</el-radio-button>
                      <el-radio-button value="BASIC">Basic Auth</el-radio-button>
                      <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
                    </el-radio-group>
                    <div v-if="viewingCaseDetail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
                      <label>Username</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.userName" class="api-auth-form-control" disabled />
                      <label>Password</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
                    </div>
                    <div v-else-if="viewingCaseDetail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                      <label>Username</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.userName" class="api-auth-form-control" disabled />
                      <label>Password</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
                    </div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'settings'">
                  <div class="api-settings-panel is-readonly">
                    <label>用例名称</label>
                    <el-input :model-value="viewingCaseDetail.name" disabled />
                    <label>所属接口</label>
                    <el-input :model-value="viewingCaseDetail.definitionName" disabled />
                    <label>标签</label>
                    <el-input :model-value="formatCaseTags(viewingCaseDetail.tags)" disabled />
                    <label>超时时间</label>
                    <div class="api-settings-control-cell">
                      <el-input-number :model-value="viewingCaseDetail.requestConfig.timeoutMs" class="api-settings-timeout-number" disabled />
                    </div>
                    <label>描述</label>
                    <el-input :model-value="viewingCaseDetail.description || ''" type="textarea" :rows="4" disabled />
                    <div class="api-settings-footer">
                      <span>写入空间 {{ viewingCaseDetail.workspaceName || viewingCaseDetail.workspaceCode || '未选择' }}</span>
                      <span>最近结果 {{ runResultLabel(viewingCaseDetail.lastRunResult) }}</span>
                      <span>最后运行 {{ formatDateTime(viewingCaseDetail.lastRunAt) }}</span>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="request-section api-case-code-section">
                    <ApiCodeEditor
                      :model-value="caseDetailRequestTab === 'pre' ? toPrettyJson(viewingCaseDetail.preProcessors) : caseDetailRequestTab === 'post' ? toPrettyJson(viewingCaseDetail.postProcessors) : toPrettyJson(viewingCaseDetail.assertions)"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                </template>
              </div>

              <div class="ms-like-response-shell case-drawer-response-shell">
                <div class="ms-like-response-header">
                  <div class="ms-like-response-title">响应内容</div>
                  <div v-if="caseDetailPreviewStep" class="ms-like-response-metrics">
                    <span v-if="caseDetailAssertionPresentation.visible" :class="['ms-like-result-pill', `is-${caseDetailAssertionPresentation.tone}`]">{{ caseDetailAssertionPresentation.label }}</span>
                    <span :class="['ms-like-response-metric', `is-${statusTone(caseDetailResponseStatus)}`]">状态 {{ caseDetailResponseStatus ?? '-' }}</span>
                    <span class="ms-like-response-metric">耗时 {{ caseDetailResponseDuration ?? '-' }}<template v-if="caseDetailResponseDuration !== null"> ms</template></span>
                    <span>大小 {{ caseDetailResponseSize }}</span>
                  </div>
                </div>
                <div v-if="!caseDetailPreviewStep" class="ms-like-response-empty">
                  <div class="ms-like-response-empty-card">
                    <div class="ms-like-response-empty-visual">
                      <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
                    </div>
                    <div class="ms-like-response-empty-text">点击 <span>执行</span> 获取响应内容</div>
                  </div>
                </div>
                <template v-else>
                  <div class="ms-like-response-tabs">
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'body' }]" @click="caseDetailResponseTab = 'body'">Body</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'header' }]" @click="caseDetailResponseTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'console' }]" @click="caseDetailResponseTab = 'console'">控制台</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'actualRequest' }]" @click="caseDetailResponseTab = 'actualRequest'">实际请求</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'assertions' }]" @click="caseDetailResponseTab = 'assertions'">断言</button>
                  </div>
                  <div class="ms-like-response-body">
                    <ApiCodeEditor
                      v-if="caseDetailResponseTab === 'body'"
                      :model-value="caseDetailResponseBody"
                      :language="caseDetailResponseBodyLanguage"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'header'"
                      :model-value="caseDetailResponseHeaders"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'console'"
                      :model-value="caseDetailResponseConsole"
                      language="api-console"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'actualRequest'"
                      :model-value="caseDetailActualRequest"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <el-table v-else-if="caseDetailAssertionRows.length" :data="caseDetailAssertionRows" size="small" class="assertion-result-table">
                      <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                      </el-table-column>
                      <el-table-column label="断言对象" width="96">
                        <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                      </el-table-column>
                      <el-table-column label="条件" width="92">
                        <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                      </el-table-column>
                      <el-table-column label="期望值:" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="实际值:" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="结果" width="78">
                        <template #default="{ row }">
                          <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                      </el-table-column>
                    </el-table>
                    <div v-else class="api-empty-body">当前请求未配置断言</div>
                  </div>
                </template>
              </div>
            </template>
            <div v-else class="api-empty-body">暂无用例详情</div>
          </div>

          <div v-else-if="caseDetailDrawerTab === 'history'" class="case-drawer-history-panel">
            <div v-if="caseRunHistoryErrorMessage" class="api-empty-body">{{ caseRunHistoryErrorMessage }}</div>
            <template v-else-if="caseHistoryView === 'list'">
              <div class="case-drawer-history-toolbar">
                <span class="case-drawer-history-limit-note">仅展示最近 10 次执行历史</span>
              </div>
              <div class="case-drawer-history-table-section" :style="{ height: `${caseRunHistoryTableHeight}px` }">
              <el-table
                v-loading="caseRunHistoryLoading"
                :data="caseRunHistories"
                size="small"
                class="case-drawer-history-table"
                :height="caseRunHistoryTableHeight"
                row-key="id"
                highlight-current-row
                @row-click="openCaseRunHistorySecondaryDetail"
              >
              <el-table-column label="执行时间" min-width="162" show-overflow-tooltip>
                <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="结果" width="78">
                <template #default="{ row }">
                  <span :class="['case-drawer-history-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态码" width="78" align="center">
                <template #default="{ row }">{{ row.statusCode ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="耗时" width="92">
                <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
              </el-table-column>
              <el-table-column label="大小" width="92">
                <template #default="{ row }">{{ formatResponseSize(row.responseSize) }}</template>
              </el-table-column>
              <el-table-column label="环境" min-width="108" show-overflow-tooltip>
                <template #default="{ row }">{{ row.environmentName || '默认' }}</template>
              </el-table-column>
              <el-table-column label="变量集" min-width="108" show-overflow-tooltip>
                <template #default="{ row }">{{ row.variableSetName || '未选择' }}</template>
              </el-table-column>
              <el-table-column label="执行人" min-width="96" show-overflow-tooltip>
                <template #default="{ row }">{{ row.operator || '-' }}</template>
              </el-table-column>
              <template #empty>
                <div class="case-drawer-history-table-empty">暂无执行历史</div>
              </template>
              </el-table>
              </div>
            </template>

            <div v-else class="ms-like-response-shell case-drawer-history-detail-shell" v-loading="caseRunHistoryDetailLoading">
              <div class="case-drawer-history-detail-nav">
                <button type="button" class="case-drawer-history-back" @click="backToCaseRunHistoryList">← 执行历史</button>
                <span v-if="selectedCaseRunHistoryDetail" class="case-drawer-history-detail-time">{{ formatDateTime(selectedCaseRunHistoryDetail.createdAt) }}</span>
              </div>
              <div class="ms-like-response-header">
                <div class="ms-like-response-title">历史详情</div>
                <div v-if="selectedCaseRunHistoryDetail" class="ms-like-response-metrics">
                  <span :class="['ms-like-result-pill', runResultClass(selectedCaseRunHistoryDetail.result)]">{{ runResultLabel(selectedCaseRunHistoryDetail.result) }}</span>
                  <span class="ms-like-response-metric">状态 {{ selectedCaseRunHistoryDetail.statusCode ?? '-' }}</span>
                  <span class="ms-like-response-metric">耗时 {{ formatDuration(selectedCaseRunHistoryDetail.durationMs) }}</span>
                  <span>大小 {{ formatResponseSize(selectedCaseRunHistoryDetail.responseSize) }}</span>
                </div>
              </div>
              <div v-if="caseRunHistoryDetailErrorMessage" class="api-empty-body">{{ caseRunHistoryDetailErrorMessage }}</div>
              <div v-else-if="!selectedCaseRunHistoryDetail" class="api-empty-body">选择一条执行记录查看详情</div>
              <div v-else-if="!selectedCaseRunHistoryDetail.stepResults.length" class="api-empty-body">该历史暂无步骤详情</div>
                <div v-else class="case-drawer-history-section">
                <div class="case-drawer-history-meta">
                  <span>执行环境 {{ caseRunHistoryMeta.environmentName }}</span>
                  <span>变量集 {{ selectedCaseRunHistoryDetail.variableSetName || '未选择' }}</span>
                  <span>执行人 {{ selectedCaseRunHistoryDetail.operator || '-' }}</span>
                </div>

                <div class="case-drawer-history-step">
                  <div class="case-drawer-history-section-title">实际请求</div>
                  <div class="case-drawer-history-request-summary">
                    <span :class="['case-drawer-method-tag', `request-method-${String(selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || 'GET').toLowerCase()}`]">{{ selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || '-' }}</span>
                    <span>{{ selectedCaseHistoryStep?.request?.url || viewingCaseItem?.path || '-' }}</span>
                  </div>
                  <div class="ms-like-response-tabs case-drawer-history-request-tabs">
                    <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'header' }]" @click="caseHistoryRequestTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'body' }]" @click="caseHistoryRequestTab = 'body'">Body</button>
                  </div>
                  <div class="ms-like-response-body case-drawer-history-request-body">
                    <ApiCodeEditor
                      v-if="caseHistoryRequestTab === 'header'"
                      :model-value="caseHistoryRequestHeaders"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else
                      :model-value="caseHistoryRequestBody"
                      :language="caseHistoryRequestBodyLanguage"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                </div>

                <div class="case-drawer-history-step">
                  <div class="case-drawer-history-section-title">响应结果</div>
                  <div class="ms-like-response-tabs">
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'body' }]" @click="caseHistoryResponseTab = 'body'">Body</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'header' }]" @click="caseHistoryResponseTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'console' }]" @click="caseHistoryResponseTab = 'console'">控制台</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'assertions' }]" @click="caseHistoryResponseTab = 'assertions'">断言</button>
                  </div>
                  <div class="ms-like-response-body">
                  <ApiCodeEditor
                    v-if="caseHistoryResponseTab === 'body'"
                    :model-value="caseHistoryResponseBody"
                    :language="caseHistoryResponseBodyLanguage"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <ApiCodeEditor
                    v-else-if="caseHistoryResponseTab === 'header'"
                    :model-value="caseHistoryResponseHeaders"
                    language="json"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <ApiCodeEditor
                    v-else-if="caseHistoryResponseTab === 'console'"
                    :model-value="caseHistoryConsole"
                    language="api-console"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <el-table v-else-if="caseHistoryAssertionRows.length" :data="caseHistoryAssertionRows" size="small" class="assertion-result-table">
                    <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="断言对象" width="96">
                      <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="条件" width="92">
                      <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                    </el-table-column>
                    <el-table-column label="期望值:" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                    </el-table-column>
                    <el-table-column label="实际值:" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                    </el-table-column>
                    <el-table-column label="结果" width="78">
                      <template #default="{ row }">
                        <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="api-empty-body">当前请求未配置断言</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="case-drawer-history-panel">
            <div class="api-empty-body">当前后端暂未提供接口用例变更历史接口，本轮不伪造变更记录。</div>
          </div>
    </ApiCaseDetailDrawer>

    <ApiAiGenerationDrawer
      v-model="aiCaseDrawerVisible"
      v-model:selected-option-keys="aiCaseSelectedOptionKeys"
      v-model:case-count="aiCaseCount"
      v-model:provider-id="aiCaseSelectedProviderId"
      v-model:no-duplicate="aiCaseNoDuplicate"
      v-model:prompt="aiCasePrompt"
      :groups="aiCaseGenerateGroups"
      :selected-count="aiCaseGenerateSelectedCount"
      :providers="aiCaseAvailableProviders"
      :providers-loading="aiCaseProvidersLoading"
      :can-generate="aiCaseCanGenerate"
      :generation-status="aiCaseGenerationStatus"
      :is-group-all-selected="isAiCaseGroupAllSelected"
      @toggle-group="toggleAiCaseGroup"
      @submit="submitAiCaseGeneration"
    />

    <ApiCaseCreateEditDialog
      v-model="caseDialogVisible"
      :mode="caseDialogMode"
      :definition="currentDefinitionSummary()"
      :case-item="editingCaseItem"
      :case-detail="editingCaseDetail"
      :case-draft-detail="caseDialogMode === 'create' ? currentCaseDraftDetail() : null"
      :saving="caseDialogSaving"
      :debug-running="caseDialogDebugRunning"
      :debug-result="caseDialogDebugResult"
      :debug-error="caseDialogDebugError"
      :loading-detail="caseDetailLoading"
      :detail-error-message="caseDetailErrorMessage"
      :default-workspace-code="props.workspaceCode"
      :workspace-display-name="currentDefinitionWorkspaceLabel"
      :environment-name="currentEnvironmentName"
      :variable-set-name="currentVariableSetName"
      @submit="submitCaseDialog"
      @debug="debugCaseDialog"
      @retry-detail="editingCaseItem && openEditCaseDialog(editingCaseItem)"
    />
    <ApiFastExtractionDrawer
      v-model:visible="fastExtractionVisible"
      :response="latestResponseBody"
      :mode="fastExtractionMode"
      :config="fastExtractionConfig"
      @apply="applyFastExtraction"
    />
    <el-drawer
      v-model="reportStepDetailDrawerVisible"
      :title="reportStepDetail?.stepName || '接口明细'"
      size="960px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer api-report-step-detail-drawer"
    >
      <div v-if="reportStepDetail" class="api-report-step-detail-drawer__body">
        <ApiRunStepDetailViewer :step="reportStepDetail" />
      </div>
    </el-drawer>
    <el-drawer
      v-model="runEnvironmentDrawerVisible"
      append-to-body
      size="520px"
      class="api-run-environment-drawer"
      title="运行环境详情"
    >
      <div class="api-run-environment-detail" v-loading="runEnvironmentDetailLoading">
        <el-alert
          v-if="runEnvironmentDetailErrorMessage"
          type="error"
          :closable="false"
          :title="runEnvironmentDetailErrorMessage"
        />
        <template v-if="selectedEnvironment">
          <div class="api-run-environment-summary">
            <div>
              <strong>{{ selectedEnvironment.name }}</strong>
              <span>{{ formatApiEnvironmentWorkspace(selectedEnvironment) }} · {{ formatRunEnvironmentStatus(selectedEnvironment.status) }}</span>
            </div>
            <small>{{ selectedEnvironment.baseUrl || '未配置 Base URL' }}</small>
          </div>

          <section class="api-run-environment-section">
            <div class="api-run-environment-section__title">
              <span>服务地址</span>
              <em>{{ runEnvironmentServices.length }} 个</em>
            </div>
            <div v-if="runEnvironmentServices.length" class="api-run-environment-service-list">
              <div
                v-for="service in runEnvironmentServices"
                :key="service.key"
                class="api-run-environment-service"
              >
                <div>
                  <strong>{{ service.name }}</strong>
                  <span>{{ service.key }}</span>
                </div>
                <div class="api-run-environment-service__meta">
                  <small>{{ service.baseUrl }}</small>
                  <em v-if="service.isDefault">默认</em>
                </div>
              </div>
            </div>
            <div v-else class="api-run-environment-empty">未配置服务地址</div>
          </section>

          <section class="api-run-environment-section">
            <div class="api-run-environment-section__title">
              <span>运行绑定</span>
            </div>
            <div class="api-run-environment-binding-grid">
              <div>
                <span>默认变量集</span>
                <strong>{{ runEnvironmentDefaultParamSet?.paramName || '未绑定' }}</strong>
                <small v-if="runEnvironmentDefaultParamSet">
                  {{ getParamValueText(runEnvironmentDefaultParamSet) }} · {{ getParamDescriptionText(runEnvironmentDefaultParamSet) }}
                </small>
                <small v-else>运行时只使用环境变量和接口配置</small>
              </div>
              <div>
                <span>Mock 服务</span>
                <strong>{{ runEnvironmentMockApplication?.appName || '未绑定' }}</strong>
                <small v-if="runEnvironmentMockApplication">
                  {{ runEnvironmentMockApplication.appCode }} · {{ runEnvironmentMockApplication.description || '未填写描述' }}
                </small>
                <small v-else>请求将按真实目标地址发送</small>
              </div>
              <div v-if="runEnvironmentMockApplication">
                <span>本次 Mock 场景</span>
                <el-select
                  v-model="selectedMockBusinessScenarioId"
                  clearable
                  filterable
                  placeholder="按 Mock 默认规则匹配"
                  size="small"
                >
                  <el-option
                    v-for="scenario in runEnvironmentMockBusinessScenarios"
                    :key="scenario.id"
                    :label="scenario.scenarioName"
                    :value="scenario.id"
                  />
                </el-select>
                <small>
                  {{ selectedMockBusinessScenario?.description || '选择后本次运行只按该业务场景命中 Mock；不选择则使用 Mock 默认匹配。' }}
                </small>
              </div>
            </div>
          </section>

          <section class="api-run-environment-section">
            <div class="api-run-environment-section__title">
              <span>请求策略</span>
            </div>
            <div class="api-run-environment-policy-list">
              <span>超时 {{ formatRunEnvironmentTimeout() }}</span>
              <span>{{ formatRunEnvironmentSsl() }}</span>
              <span>Header {{ runEnvironmentHeaders.length ? `${runEnvironmentHeaders.length} 个` : '未配置' }}</span>
            </div>
            <div v-if="runEnvironmentHeaders.length" class="api-run-environment-header-list">
              <div v-for="header in runEnvironmentHeaders" :key="header.key">
                <span>{{ header.key }}</span>
                <strong>{{ maskRunEnvironmentValue(header.key, header.value) }}</strong>
              </div>
            </div>
          </section>
        </template>
      </div>
      <template #footer>
        <div class="api-run-environment-drawer-footer">
          <el-button @click="runEnvironmentDrawerVisible = false">关闭</el-button>
          <el-button type="primary" @click="goConfigCenterEnv">去配置中心编辑</el-button>
        </div>
      </template>
    </el-drawer>

  </section>
</template>

<style scoped>
.api-interface-workspace {
  --api-workspace-font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;

  display: flex;
  min-width: 0;
  height: calc(100dvh - 112px);
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: none;
  transform: translate(8px, -8px);
  width: calc(100% - 8px);
  font-family: var(--api-workspace-font-family);
}

.api-interface-workspace button,
.api-interface-workspace input,
.api-interface-workspace textarea,
.api-interface-workspace select {
  font-family: inherit;
}

.api-interface-workspace :deep(.el-button),
.api-interface-workspace :deep(.el-input__inner),
.api-interface-workspace :deep(.el-textarea__inner),
.api-interface-workspace :deep(.el-select),
.api-interface-workspace :deep(.el-select__placeholder),
.api-interface-workspace :deep(.el-select__selected-item),
.api-interface-workspace :deep(.el-dropdown-menu),
.api-interface-workspace :deep(.el-table) {
  font-family: inherit;
}

:global(.api-method-popper),
:global(.api-save-dropdown-menu),
:global(.api-soft-message-box),
:global(.el-dialog.api-import-dialog-shell),
:global(.el-dialog.api-soft-dialog-shell),
:global(.el-dialog.api-batch-dialog-shell),
:global(.api-case-detail-drawer),
:global(.api-ai-case-drawer),
:global(.el-dialog.api-ai-case-detail-dialog) {
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

:global(.api-method-popper .el-select-dropdown__item),
:global(.api-save-dropdown-menu .el-dropdown-menu__item),
:global(.api-soft-message-box .el-message-box__title),
:global(.api-soft-message-box .el-message-box__content),
:global(.api-soft-message-box .el-button),
:global(.el-dialog.api-import-dialog-shell .el-button),
:global(.el-dialog.api-import-dialog-shell .el-input__inner),
:global(.el-dialog.api-import-dialog-shell .el-upload),
:global(.el-dialog.api-soft-dialog-shell .el-button),
:global(.el-dialog.api-soft-dialog-shell .el-input__inner),
:global(.el-dialog.api-batch-dialog-shell .el-button),
:global(.api-case-detail-drawer .el-button),
:global(.api-case-detail-drawer .el-input__inner),
:global(.api-ai-case-drawer .el-button),
:global(.api-ai-case-drawer .el-input__inner),
:global(.api-ai-case-drawer .el-textarea__inner),
:global(.api-ai-case-drawer .el-select),
:global(.el-dialog.api-ai-case-detail-dialog .el-button) {
  font-family: inherit;
}

:global(.el-dialog.api-soft-dialog-shell .el-textarea__inner),
:global(.el-dialog.api-batch-dialog-shell .el-textarea__inner),
:global(.el-dialog.api-batch-dialog-shell code),
:global(.api-ai-case-drawer .api-ai-case-log),
:global(.el-dialog.api-ai-case-detail-dialog pre) {
  font-family: Consolas, Monaco, monospace;
}

.api-interface-shell {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 272px minmax(0, 1fr);
}

.api-automation-settings-workspace {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  flex: 1;
  padding: 16px;
  background: #f8fafc;
}

.api-automation-settings-card,
.api-automation-settings-item {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-automation-settings-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.api-automation-settings-card strong,
.api-automation-settings-item strong {
  color: var(--app-text-primary);
  font-size: 15px;
}

.api-automation-settings-card p {
  margin: 6px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
}

.api-automation-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.api-automation-settings-item {
  display: grid;
  gap: 6px;
  min-height: 96px;
  padding: 14px;
}

.api-automation-settings-item span {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.api-report-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #f8fafc;
}

.api-report-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-report-search {
  width: 280px;
}

.api-report-filter {
  width: 136px;
}

.api-report-date-range {
  width: 330px;
}

.api-report-analysis {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr 1.1fr 1.2fr;
  gap: 10px;
  padding: 12px 16px 0;
}

.api-report-analysis__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.api-report-analysis-card,
.api-report-analysis__panel {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-analysis-card {
  display: flex;
  min-height: 54px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
}

.api-report-analysis-card span,
.api-report-analysis__title span,
.api-report-analysis-empty,
.api-report-rank-row small,
.api-report-recent-row small {
  color: #6b7280;
  font-size: 12px;
}

.api-report-analysis-card strong {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.api-report-analysis-card.is-danger strong {
  color: #b91c1c;
}

.api-report-analysis__panel {
  min-width: 0;
  overflow: hidden;
}

.api-report-analysis__title {
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid #f3f4f6;
}

.api-report-analysis__title strong {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.api-report-rank-list,
.api-report-recent-list {
  min-height: 0;
}

.api-report-rank-list :deep(.el-scrollbar__view),
.api-report-recent-list :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
}

.api-report-rank-row,
.api-report-recent-row {
  display: grid;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid #f8fafc;
  background: transparent;
  color: #111827;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-rank-row {
  grid-template-columns: minmax(0, 1fr) 36px 64px;
  padding: 0 10px;
}

.api-report-rank-row:not(:has(small)) {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.api-report-rank-row:hover,
.api-report-recent-row:hover {
  background: #f8fafc;
}

.api-report-rank-row span,
.api-report-recent-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-rank-row span {
  color: #374151;
  font-size: 12px;
}

.api-report-rank-row strong {
  justify-self: end;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
}

.api-report-rank-row small {
  justify-self: end;
}

.api-report-recent-row {
  grid-template-columns: 58px minmax(0, 1fr);
  padding: 6px 10px;
}

.api-report-recent-row > div {
  display: block;
  min-width: 0;
}

.api-report-recent-row strong {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.api-report-analysis-empty {
  display: flex;
  height: 96px;
  align-items: center;
  justify-content: center;
}

.api-report-statistics {
  display: grid;
  grid-template-columns: 1.5fr 0.9fr 0.9fr 1.1fr;
  gap: 10px;
  padding: 10px 16px 0;
}

.api-report-stat-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-trend-list,
.api-report-distribution-list,
.api-report-slowest-list {
  min-height: 0;
}

.api-report-trend-list :deep(.el-scrollbar__view),
.api-report-distribution-list :deep(.el-scrollbar__view),
.api-report-slowest-list :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
}

.api-report-trend-row {
  display: grid;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 78px minmax(0, 1fr) 36px 92px;
  padding: 0 10px;
  border-bottom: 1px solid #f8fafc;
}

.api-report-trend-date,
.api-report-trend-row small,
.api-report-distribution-row span,
.api-report-slowest-row span,
.api-report-slowest-row small {
  color: #6b7280;
  font-size: 12px;
}

.api-report-trend-bar,
.api-report-distribution-row div {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}

.api-report-trend-bar i,
.api-report-trend-bar em,
.api-report-distribution-row i {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: inherit;
}

.api-report-trend-bar i {
  background: #bfdbfe;
}

.api-report-trend-bar em {
  min-width: 0;
  background: #fca5a5;
}

.api-report-trend-row strong,
.api-report-distribution-row strong {
  justify-self: end;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.api-report-distribution-row {
  display: grid;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 64px minmax(0, 1fr) 36px;
  padding: 0 10px;
  border-bottom: 1px solid #f8fafc;
}

.api-report-distribution-row i {
  background: #93c5fd;
}

.api-report-slowest-row {
  display: grid;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 58px minmax(0, 1fr) 64px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid #f8fafc;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-slowest-row:hover {
  background: #f8fafc;
}

.api-report-slowest-row strong {
  overflow: hidden;
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-slowest-row small {
  justify-self: end;
}

.api-report-table-shell {
  min-height: 0;
  flex: 1;
  padding: 14px 16px 0;
}

.api-report-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.api-report-table :deep(.el-table__row) {
  cursor: pointer;
}

.api-report-object {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.api-report-result {
  display: inline-flex;
  min-width: 52px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  white-space: nowrap;
}

.api-report-result.is-passed,
.api-report-result.is-success {
  background: #dcfce7;
  color: #15803d;
}

.api-report-result.is-failed,
.api-report-result.is-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.api-report-result.is-neutral {
  background: #f3f4f6;
  color: #4b5563;
}

.api-report-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--app-border);
  background: #fff;
}

.api-report-detail-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f8fafc;
}

.api-report-detail-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-report-detail-page__back {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
  font-size: 13px;
}

.api-report-detail-page__back:hover {
  background: #dbeafe;
}

.api-report-detail-page__title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 12px;
}

.api-report-detail-page__title > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.api-report-detail-page__title strong {
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-detail-page__title small {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.api-report-detail-page__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-report-detail-page__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: 16px 18px 24px;
}

.api-report-detail-section {
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-report-detail-section.is-overview {
  border-color: #dbeafe;
}

.api-report-detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.api-report-detail-section__head h3 {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.api-report-detail-section__head span {
  color: #6b7280;
  font-size: 12px;
}

.api-report-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.api-report-summary-grid div {
  display: flex;
  min-width: 0;
  min-height: 58px;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfdff;
}

.api-report-summary-grid span {
  color: #6b7280;
  font-size: 12px;
}

.api-report-summary-grid strong {
  overflow: hidden;
  color: #111827;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.api-report-context-grid div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.api-report-context-grid span,
.api-report-context-grid small {
  display: block;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-grid strong {
  display: block;
  overflow: hidden;
  margin: 5px 0 3px;
  color: #111827;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-runner-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.api-report-runner-context div {
  min-width: 0;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #eff6ff;
  padding: 8px 10px;
}

.api-report-runner-context span,
.api-report-runner-context strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-runner-context span {
  color: #1d4ed8;
  font-size: 12px;
}

.api-report-runner-context strong {
  margin-top: 4px;
  color: #111827;
  font-size: 13px;
}

.api-report-context-variables {
  margin-top: 12px;
  color: #374151;
  font-size: 12px;
}

.api-report-context-variables summary {
  cursor: pointer;
  user-select: none;
}

.api-report-context-variables div {
  display: grid;
  max-height: 220px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
  overflow: auto;
}

.api-report-context-variables span {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f3f4f6;
}

.api-report-context-variables b,
.api-report-context-variables em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-context-variables em {
  margin-top: 3px;
  color: #6b7280;
  font-style: normal;
}

.api-report-failure {
  margin: 12px 0 0;
  border-radius: 8px;
  background: #fef2f2;
  padding: 10px 12px;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.6;
}

.api-report-item-list,
.api-report-step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-report-item-row,
.api-report-step-row {
  display: grid;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfdff;
  padding: 10px 12px;
}

.api-report-item-row {
  grid-template-columns: 64px 72px minmax(0, 1fr) 58px 84px;
}

.api-report-item-row strong,
.api-report-step-row strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-item-row small,
.api-report-step-row small,
.api-report-item-row span:not(.api-report-result) {
  color: #6b7280;
  font-size: 12px;
}

.api-report-item-row p,
.api-report-step-row p {
  grid-column: 1 / -1;
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
}

.api-report-step-row {
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: flex-start;
}

.api-report-step-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.api-report-execution-tree {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-report-tree-row {
  display: grid;
  align-items: center;
  width: 100%;
  min-height: 44px;
  grid-template-columns: 28px 64px minmax(220px, 1fr) 90px 90px minmax(180px, 0.8fr);
  gap: 10px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  padding: 0 12px;
  color: #374151;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.api-report-tree-row:hover {
  background: #f8fafc;
}

.api-report-tree-row.is-child {
  padding-left: 34px;
  background: #fbfdff;
}

.api-report-tree-row.is-leaf .api-report-tree-main strong {
  color: #2563eb;
}

.api-report-tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #64748b;
  transition: transform 0.16s ease;
}

.api-report-tree-row.expanded .api-report-tree-toggle {
  transform: rotate(90deg);
}

.api-report-tree-main {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.api-report-tree-main strong,
.api-report-tree-row > span:not(.api-report-result):not(.api-report-tree-toggle):not(.api-report-tree-main) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-tree-main strong {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.api-report-tree-main em {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 20px;
  border-radius: 4px;
  background: #f3f4f6;
  padding: 0 6px;
  color: #6b7280;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
}

.api-report-tree-row > span:not(.api-report-result):not(.api-report-tree-toggle):not(.api-report-tree-main) {
  color: #6b7280;
  font-size: 12px;
}

.api-report-tree-error {
  color: #b91c1c !important;
}

.api-report-step-detail-drawer__body {
  display: flex;
  height: calc(100vh - 52px);
  min-height: 0;
  flex-direction: column;
  padding: 16px 18px 20px;
  box-sizing: border-box;
}

.api-report-empty.is-compact {
  min-height: 88px;
}

.api-report-step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.api-report-step-meta span {
  display: inline-flex;
  height: 20px;
  align-items: center;
  border-radius: 999px;
  background: #eef2ff;
  padding: 0 8px;
  color: #4338ca;
  font-size: 12px;
}

.api-report-step-evidence {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.api-report-step-evidence__row {
  display: grid;
  min-width: 0;
  grid-template-columns: 84px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  padding: 7px 9px;
}

.api-report-step-evidence__row span,
.api-report-step-evidence__row strong,
.api-report-step-evidence__row em,
.api-report-step-evidence__row small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-report-step-evidence__row span {
  color: #4f46e5;
  font-size: 12px;
}

.api-report-step-evidence__row strong {
  color: #111827;
  font-size: 12px;
}

.api-report-step-evidence__row em {
  color: #047857;
  font-size: 12px;
  font-style: normal;
  text-align: right;
}

.api-report-step-evidence__row small {
  grid-column: 2 / 4;
  color: #6b7280;
  font-size: 12px;
}

.api-report-step-evidence__row.is-danger {
  border-color: #fecaca;
  background: #fef2f2;
}

.api-report-step-evidence__row.is-danger em {
  color: #b91c1c;
}

.api-report-empty {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 13px;
}

.api-interface-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  background: #fff;
}

.api-interface-sidebar__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 16px 16px 0;
  background: #fff;
}

.api-sidebar-primary,
.api-sidebar-secondary,
.api-send-button,
.api-curl-button {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.api-sidebar-primary,
.api-send-button {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}

.api-sidebar-secondary,
.api-curl-button {
  border-color: var(--app-border-strong);
  color: var(--app-text-secondary);
}

.api-sidebar-secondary:hover,
.api-curl-button:hover {
  background: #f9fafb;
  border-color: var(--app-border-strong);
  color: var(--app-text-primary);
}

.api-sidebar-primary:hover,
.api-send-button:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-sidebar-primary:disabled,
.api-sidebar-secondary:disabled,
.api-send-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.api-sidebar-secondary:disabled:hover {
  border-color: var(--app-border-strong);
  background: #fff;
  color: var(--app-text-primary);
}

.api-sidebar-primary :deep(.el-icon),
.api-sidebar-secondary :deep(.el-icon),
.api-send-button :deep(.el-icon),
.api-curl-button :deep(.el-icon) {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-send-button__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  stroke-width: 2.25;
}

.api-sidebar-button-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.api-sidebar-search {
  position: relative;
  padding: 12px 16px 0;
  background: #fff;
}

.api-sidebar-search :deep(.el-input__wrapper) {
  height: 38px;
  min-height: 38px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-sidebar-search :deep(.el-input__prefix) {
  color: var(--app-text-subtle);
}

.api-directory-title {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 12px 0;
  padding: 0 4px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.api-directory-title div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-directory-title b {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 500;
}

.api-directory-title small {
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 500;
}

.api-directory-title button,
.api-editor-tab-scroll,
.api-editor-tab-add,
.api-editor-tab-more {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.api-directory-title button:hover,
.api-editor-tab-scroll:hover:not(:disabled),
.api-editor-tab-add:hover,
.api-editor-tab-more:hover {
  background: var(--app-bg-page);
  color: var(--app-primary);
}

.api-directory-search-tip {
  margin: 8px 16px 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  line-height: 18px;
}

.api-editor-tab-scroll,
.api-editor-tab-add,
.api-editor-tab-more {
  width: 36px;
  height: 40px;
  border-radius: 0;
  color: #909399;
}

.api-editor-tab-scroll {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: var(--app-radius-sm);
}

.api-editor-tab-scroll:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.api-directory-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 8px 8px 12px;
  background: #fff;
}

.api-directory-error {
  margin: 12px 8px;
  padding: 10px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 14px;
}

.api-interface-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.api-editor-tabs {
  display: flex;
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  align-items: center;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  overflow: hidden;
}

.api-editor-tabs__nav {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 0 1 auto;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.api-editor-tabs__nav::-webkit-scrollbar {
  display: none;
}

.api-editor-tab {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  flex: 0 0 auto;
  max-width: 220px;
  height: 40px;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-right: 1px solid var(--app-border);
  border-bottom: 3px solid transparent;
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
}

.api-editor-tab:hover,
.api-editor-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
}

.api-editor-tab.is-active {
  border-bottom-color: var(--app-primary);
}

.api-editor-tab__label {
  display: inline-flex;
  height: 20px;
  align-items: center;
  min-width: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-tab-spinner {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border: 2px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 9999px;
}

.ai-generation-tab-spinner.spinning {
  animation: ai-generation-spin 0.8s linear infinite;
}

.ai-generation-tab-finished-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

@keyframes ai-generation-spin {
  to {
    transform: rotate(360deg);
  }
}

.api-editor-tab__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-primary);
}

.api-method {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.method-get { color: #15803d; }
.method-post { color: #ea580c; }
.method-put { color: #2563eb; }
.method-patch { color: #7c3aed; }
.method-delete { color: #dc2626; }
.method-head,
.method-options { color: #64748b; }

.api-editor-tab__close {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--app-text-subtle);
  opacity: 0;
  flex: 0 0 auto;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.api-editor-tab.is-active .api-editor-tab__close {
  background: transparent;
  color: #667085;
  opacity: 0.42;
}

.api-editor-tab:hover .api-editor-tab__close {
  background: rgba(15, 23, 42, 0.08);
  color: #344054;
  opacity: 1;
}

.api-editor-tab__close :deep(.el-icon) {
  font-size: 14px;
  font-weight: 700;
}

.api-editor-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--app-text-muted);
}

.api-editor-empty button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
}

:global(.api-run-env-popper .el-select-dropdown__item) {
  font-size: 12px;
}

:global(.api-run-environment-drawer) {
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

.api-run-environment-detail {
  display: grid;
  gap: 12px;
  min-height: 0;
}

.api-run-environment-summary {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
}

.api-run-environment-summary div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-run-environment-summary strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-environment-summary span,
.api-run-environment-summary small {
  color: #475569;
  font-size: 12px;
}

.api-run-environment-summary small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-environment-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-run-environment-section__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.api-run-environment-section__title em {
  color: var(--app-text-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.api-run-environment-service span,
.api-run-environment-service small,
.api-run-environment-binding-grid span,
.api-run-environment-binding-grid small,
.api-run-environment-empty,
.api-run-environment-header-list span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-run-environment-service strong,
.api-run-environment-binding-grid strong,
.api-run-environment-header-list strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.api-run-environment-service-list {
  display: grid;
  gap: 8px;
}

.api-run-environment-service {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-service div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-run-environment-service em {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 999px;
  background: #dbeafe;
  color: var(--app-primary);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.api-run-environment-service__meta {
  margin-top: 3px;
}

.api-run-environment-binding-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.api-run-environment-binding-grid > div {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-binding-grid :deep(.el-select__wrapper) {
  min-height: 30px;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.api-run-environment-policy-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-run-environment-policy-list span {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: #f8fafc;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.api-run-environment-header-list {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}

.api-run-environment-header-list div {
  display: grid;
  grid-template-columns: minmax(90px, 0.45fr) minmax(0, 1fr);
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.api-run-environment-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.api-editor-scroll {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
}

.api-editor-loading {
  display: grid;
  gap: 12px;
  padding: 20px 16px;
}

.api-editor-loading__title {
  color: var(--app-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.api-editor-loading__line,
.api-editor-loading__block {
  border-radius: 4px;
  background: linear-gradient(90deg, #f2f3f5 0%, #e5e7eb 50%, #f2f3f5 100%);
  background-size: 200% 100%;
  animation: api-loading-shimmer 1.2s ease-in-out infinite;
}

.api-editor-loading__line {
  width: 52%;
  height: 16px;
}

.api-editor-loading__line.is-long {
  width: 76%;
}

.api-editor-loading__block {
  height: 260px;
}

@keyframes api-loading-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

.api-response-tabs {
  display: flex;
  height: 46px;
  min-height: 46px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-response-tabs button {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 45px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  padding: 0 12px;
  white-space: nowrap;
}

.api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs button:not(.is-active):hover {
  color: var(--app-text-secondary);
}

.api-response-tabs button.is-active::after {
  content: none;
}

.api-response-tabs {
  height: 41px;
  min-height: 41px;
}

.api-response-tabs button {
  height: 41px;
}

.api-request-body {
  min-height: 0;
  flex: 0 0 auto;
  overflow: visible;
  padding: 8px 16px 16px;
  border-bottom: 0;
  background: #fff;
}

.api-request-body.is-params,
.api-request-body.is-headers {
  min-height: 320px;
  flex-basis: 320px;
}

.api-request-body.is-pre,
.api-request-body.is-post,
.api-request-body.is-tests {
  min-height: 360px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-settings {
  min-height: 320px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-cases {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
  padding: 14px 16px;
}

.api-request-body.is-definition {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
  padding: 14px 16px 18px;
}

.api-param-table {
  min-height: 296px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-param-toolbar {
  display: flex;
  min-width: 0;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.api-param-toolbar button,
.api-advanced-actions button,
.api-case-actions button {
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.api-param-toolbar button:hover,
.api-advanced-actions button:hover,
.api-case-actions button:hover,
.api-row-remove:hover,
.api-add-row:hover {
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px 80px minmax(220px, 1fr) 90px;
  align-items: center;
  gap: 0;
  padding: 5px 10px 5px 0;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px repeat(3, minmax(0, 1fr)) 80px;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.api-param-header {
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  padding: 0 10px 0 0;
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.api-param-row {
  min-height: 44px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fbfdff;
}

.api-body-code-wrap {
  display: grid;
  min-height: 0;
  gap: 8px;
}

.api-body-view-switch {
  display: inline-flex;
  width: max-content;
  align-items: center;
  padding: 1px;
  border: 1px solid var(--app-border);
  border-radius: 5px;
  background: #f9fafb;
}

.api-body-view-switch__item {
  height: 20px;
  padding: 0 7px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
}

.api-body-view-switch__item:hover {
  color: var(--app-primary);
}

.api-body-view-switch__item.active {
  background: #fff;
  color: var(--app-primary);
  box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
}

.api-body-editor-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.api-body-editor-action :deep(.el-icon) {
  font-size: 14px;
}

.api-body-editor-action:hover:not(:disabled) {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}

.api-body-editor-action:disabled {
  color: var(--app-text-placeholder);
  cursor: not-allowed;
}

.api-schema-panel {
  min-height: 300px;
}

.api-schema-table {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-schema-header,
.api-schema-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.35fr) 130px 72px minmax(180px, 1.2fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr);
  align-items: center;
  column-gap: 12px;
  min-width: 1180px;
  padding: 0 12px;
}

.api-schema-header {
  height: 38px;
  border-bottom: 1px solid var(--app-border);
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-schema-row {
  min-height: 42px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-schema-row:last-child {
  border-bottom: 0;
}

.api-schema-field {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-muted {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-code {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-type {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.api-schema-type.is-string {
  background: #ecfdf3;
  color: #15803d;
}

.api-schema-type.is-number {
  background: #eff6ff;
  color: #2563eb;
}

.api-schema-type.is-boolean {
  background: #fef3c7;
  color: #b45309;
}

.api-schema-type.is-object,
.api-schema-type.is-array {
  background: #f5f3ff;
  color: #7c3aed;
}

.api-schema-row :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--app-border-soft) inset;
}

.api-schema-row :deep(.el-input__inner) {
  height: 28px;
  font-size: 12px;
}

.api-definition-doc {
  display: grid;
  gap: 14px;
}

.api-definition-summary {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-definition-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-definition-title-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-summary p {
  margin: 7px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
}

.api-definition-path {
  max-width: 48%;
  overflow: hidden;
  color: #374151;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-section {
  display: grid;
  gap: 10px;
}

.api-definition-section__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-definition-section__title > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.api-definition-section__title span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-schema-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.api-schema-actions.is-inline {
  margin-bottom: 0;
  flex: 0 0 auto;
}

.api-schema-action {
  min-height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.api-schema-action:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}

.api-definition-main {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.api-definition-group-list {
  display: grid;
  gap: 12px;
}

.api-definition-group {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-definition-group__head {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #fbfcfe;
}

.api-definition-group__head > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.api-definition-group__head strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-group__head span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-definition-head-actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.api-definition-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-definition-view-switch button {
  min-height: 24px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.api-definition-view-switch button:hover,
.api-definition-view-switch button.is-active {
  color: var(--app-primary);
}

.api-definition-view-switch span {
  width: 1px;
  height: 13px;
  background: var(--app-border);
}

.api-definition-empty {
  padding: 18px 12px;
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.api-definition-empty.is-panel {
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-definition-status-tabs {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: #fff;
}

.api-definition-status-tabs button {
  min-width: 44px;
  padding: 4px 10px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.api-definition-status-tabs button.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-doc-schema-table {
  overflow: auto;
}

.api-doc-schema-head,
.api-doc-schema-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.1fr) 116px 64px minmax(170px, 1fr) minmax(150px, 0.9fr);
  align-items: center;
  column-gap: 12px;
  min-width: 840px;
  padding: 0 12px;
}

.api-doc-schema-head {
  height: 34px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-doc-schema-row {
  min-height: 42px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-doc-schema-row:last-child {
  border-bottom: 0;
}

.api-doc-field-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-doc-field-name {
  display: inline-flex;
  max-width: 100%;
  min-height: 22px;
  align-items: center;
  overflow: hidden;
  padding: 0 7px;
  border-radius: 4px;
  background: #eef6ff;
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-doc-field-cell small {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-placeholder);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-doc-required {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-doc-required.is-required {
  color: #d97706;
  font-weight: 600;
}

.api-doc-muted {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-example-panel {
  min-width: 0;
  overflow: hidden;
  background: #fff;
}

.api-definition-example-panel.is-full {
  border-top: 0;
}

.api-definition-example-panel__head {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #fbfcfe;
}

.api-definition-example-panel__head strong {
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-definition-example-panel__head span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-definition-example-panel pre {
  min-height: 220px;
  max-height: 420px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  background: #ffffff;
  color: #1f2937;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

@media (max-width: 900px) {
  .api-definition-summary {
    display: grid;
  }

  .api-definition-path {
    max-width: 100%;
    text-align: left;
  }
}

.api-drag-cell,
.api-checkbox-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.api-drag-handle {
  display: grid;
  width: 14px;
  height: 19px;
  align-content: center;
  justify-content: center;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  gap: 2px;
}

.api-drag-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: #c0c4cc;
}

.api-param-row:hover .api-drag-dot {
  background: #9ca3af;
}

.api-header-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.api-type-header {
  padding-left: 30px;
}

.api-length-header {
  padding-left: 22px;
}

.api-type-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px 72px minmax(180px, 1fr) 72px;
  }

  .api-param-table.is-header .api-param-header,
  .api-param-table.is-header .api-param-row {
    grid-template-columns: 24px 28px repeat(3, minmax(0, 1fr)) 64px;
  }

  .api-param-table.is-body-form .api-param-header,
  .api-param-table.is-body-form .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px minmax(180px, 1fr) 72px;
  }
}

.api-required-button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.api-required-button.active {
  background: #fff1f3;
  color: #f04438;
}

.api-link-button {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-param-row:last-of-type {
  border-bottom: 0;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.api-param-row :deep(.el-input) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #d0d5dd;
}

.api-param-row :deep(.el-input.is-focus .el-input__wrapper),
.api-param-row :deep(.el-select.is-focus .el-select__wrapper),
.api-param-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6;
}

.api-param-row :deep(.el-input__inner),
.api-param-row :deep(.el-select__placeholder),
.api-param-row :deep(.el-select__selected-item) {
  font-size: 12px;
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-length-range :deep(.el-input-number) {
  width: 100%;
}

.api-length-range :deep(.el-input-number__increase),
.api-length-range :deep(.el-input-number__decrease) {
  display: none;
}

.api-length-range :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.api-row-remove,
.api-add-row {
  min-height: 17px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.api-row-remove {
  justify-self: center;
  width: auto;
  min-width: 0;
}

.api-add-row {
  height: 37px;
  padding: 9px 10px 11px;
}

.api-row-remove,
.api-case-actions .is-danger {
  color: #ef4444;
}

.api-row-remove:hover,
.api-case-actions .is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-body-section {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}

.api-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-muted);
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.api-body-chip.is-active {
  border-color: #3b82f6;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-body-editor {
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-body-editor.is-code {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-body-editor:not(.is-code) {
  min-height: 300px;
}

.api-body-editor.is-empty {
  border: 0;
  border-radius: var(--app-radius-sm);
}

.api-body-editor :deep(.el-textarea),
.api-body-editor :deep(.el-textarea__inner),
.api-json-panel :deep(.el-textarea),
.api-json-panel :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 300px;
  border: 0;
  box-shadow: none;
  font-family: Consolas, Monaco, monospace;
}

.api-body-editor.is-empty,
.api-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-empty-body {
  width: 100%;
  min-height: 300px;
  border: 0;
  border-radius: var(--app-radius-sm);
  font-size: 13px;
}

.api-binary-panel,
.api-auth-panel,
.api-settings-panel,
.api-json-panel,
.api-cases-panel,
.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  display: grid;
  gap: 12px;
  max-width: none;
}

.api-cases-panel,
.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  min-height: 0;
}

.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  padding-bottom: 2px;
}

.api-processor-panel {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}

.api-processor-panel .api-advanced-toolbar,
.api-processor-panel .api-processor-list {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.api-processor-panel .api-advanced-toolbar {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0;
}

.api-processor-panel .api-advanced-toolbar > div:first-child {
  display: none;
}

.api-processor-panel .api-advanced-toolbar .el-dropdown {
  display: flex;
  width: 100%;
  height: 48px;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-processor-panel .api-advanced-toolbar .api-sidebar-primary {
  width: auto;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--app-radius-md);
  font-size: 0;
}

.api-processor-panel .api-advanced-toolbar .api-sidebar-primary::after {
  content: "添加";
  font-size: 13px;
  font-weight: 500;
}

.api-processor-panel .api-advanced-toolbar::after {
  content: "暂无处理器";
  position: absolute;
  inset: 48px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-processor-panel .api-processor-list {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.api-processor-panel .api-processor-list > .api-empty-body {
  min-height: 100%;
  background: transparent;
  color: transparent;
}

.api-processor-panel .api-processor-list > .api-empty-body::after {
  content: "请选择一个处理器进行编辑";
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-assertion-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}

.api-assertion-panel .api-advanced-toolbar,
.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.api-assertion-panel .api-advanced-toolbar {
  position: relative;
  display: block;
  padding: 0;
}

.api-assertion-panel .api-advanced-toolbar > div:first-child {
  display: none;
}

.api-assertion-panel .api-advanced-toolbar::before {
  content: "";
  position: absolute;
  top: 48px;
  right: 0;
  left: 0;
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-panel .api-advanced-toolbar::after {
  content: "暂无断言";
  position: absolute;
  inset: 48px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-assertion-panel .api-advanced-actions {
  display: block;
}

.api-assertion-panel .api-advanced-actions > .el-dropdown:not(:last-child) {
  display: none;
}

.api-assertion-panel .api-advanced-actions > .el-dropdown:last-child {
  position: absolute;
  top: 6px;
  left: 12px;
}

.api-assertion-panel .api-advanced-actions > button:first-child {
  position: absolute;
  bottom: 4px;
  left: 6px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 500;
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--app-radius-md);
  font-size: 13px;
  font-weight: 500;
}

.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  background: #fff;
  color: transparent;
}

.api-assertion-panel > .api-empty-body::after {
  content: "请选择一个断言进行编辑";
  display: flex;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-auth-grid,
.api-settings-panel {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.api-settings-panel {
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-settings-panel > label {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-settings-panel > .el-input,
.api-settings-panel > .el-input-number,
.api-settings-panel > .el-textarea {
  min-height: 0;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel > .el-input-number {
  width: 100%;
}

.api-settings-panel > .api-settings-control-cell {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel :deep(.el-input-number) {
  width: 100%;
}

.api-settings-timeout-number {
  width: 100%;
  line-height: 32px;
}

.api-settings-timeout-number :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-settings-timeout-number :deep(.el-input__inner) {
  text-align: center;
}

.api-settings-timeout-number :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-settings-timeout-number :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-settings-panel > label:nth-of-type(5) {
  align-items: flex-start;
  padding-top: 18px;
}

.api-settings-panel > .el-textarea {
  min-height: 104px;
}

.api-settings-footer {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.api-auth-grid label,
.api-settings-panel label,
.api-form-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-auth-form-control {
  width: min(100%, 450px);
}

.api-auth-form-control :deep(.el-input__wrapper) {
  min-height: 34px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-auth-form-control :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-auth-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-binary-hint {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-binary-panel {
  display: block;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-binary-row {
  display: grid;
  min-height: 0;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-binary-row:last-child {
  min-height: 0;
  border-bottom: 0;
}

.api-binary-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-binary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.api-binary-pick,
.api-binary-clear {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border: 1px solid var(--app-border-strong);
  border-radius: 4px;
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-binary-pick input {
  display: none;
}

.api-binary-pick:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-binary-clear:disabled {
  border-color: var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-binary-selected {
  display: flex;
  min-height: 0;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-binary-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file-size {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-file-picker,
.api-binary-file {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-file-picker > span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-file-picker small {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-file-picker__button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-file-picker__button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-file-picker__button input {
  display: none;
}

.api-binary-file {
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-binary-file > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.api-binary-file strong,
.api-binary-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-cases-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.api-cases-panel {
  position: relative;
  display: block;
  min-height: 362px;
}

.api-cases-toolbar {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.api-cases-toolbar > span,
.api-cases-ai-entry > span {
  display: none;
}

.api-cases-ai-entry,
.api-cases-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-cases-ai-entry {
  position: absolute;
  top: 2px;
  left: 94px;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
}

.api-cases-panel > .api-empty-body {
  min-height: 58px;
  margin-top: 14px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: #fff;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-case-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-case-actions button.is-danger {
  color: var(--app-danger);
}

.api-case-drawer-header {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.api-case-drawer-header strong {
  color: var(--app-text-primary);
  font-size: 16px;
}

.api-case-drawer-header span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-body {
  display: grid;
  gap: 12px;
  padding: 14px 18px 18px;
}

.api-case-drawer-tabs {
  display: block;
  min-width: 0;
}

.api-case-detail-panel {
  display: grid;
  gap: 12px;
}

.api-case-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.api-case-summary-grid > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-case-summary-grid span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-summary-grid strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-result-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.api-run-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-run-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-run-result-pill.is-neutral {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.api-case-detail-section {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.api-case-detail-section > strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-case-config-blocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.api-case-config-block {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-case-config-block > div:first-child {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.api-case-config-block > div:first-child strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-case-config-block > div:first-child span,
.api-case-config-empty,
.api-case-kv-list {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-kv-list {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.api-case-kv-list span {
  overflow: hidden;
  color: var(--app-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-config-block pre {
  max-height: 160px;
  overflow: auto;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-detail-section pre,
.api-case-history-snapshots pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-history-panel {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  gap: 12px;
  min-height: 460px;
}

.api-case-history-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.api-case-history-item {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
}

.api-case-history-item:hover,
.api-case-history-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.api-case-history-item strong,
.api-case-history-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-history-item small {
  color: var(--app-text-muted);
}

.api-case-history-detail {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.api-case-failure-box {
  padding: 10px 12px;
  border: 1px solid var(--app-danger-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.case-drawer-history-detail-button {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 500;
}

:global(.api-case-drawer-modal) {
  background: rgba(15, 23, 42, 0.28);
}

.case-drawer-history-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 420px;
}

.ms-like-top-tabs,
.ms-like-response-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.ms-like-top-tabs::-webkit-scrollbar,
.ms-like-response-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-top-tab {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

.ms-like-top-tab:hover {
  color: #111827;
}

.ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.ms-like-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.ms-like-response-shell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.ms-like-response-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0;
}

.ms-like-response-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.ms-like-response-metrics {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.ms-like-response-metric,
.ms-like-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.ms-like-result-pill.is-success,
.ms-like-result-pill.is-passed,
.ms-like-response-metric.is-success {
  background: #f0fdf4;
  color: #16a34a;
}

.ms-like-result-pill.is-failed,
.ms-like-response-metric.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.ms-like-response-metric.is-warning {
  background: #fff7ed;
  color: #ea580c;
}

.ms-like-response-body {
  min-width: 0;
  padding: 10px 0 12px;
}

.ms-like-response-empty {
  padding: 18px 0 20px;
}

.ms-like-response-empty-card {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 116px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.ms-like-response-empty-window {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 58px;
  height: 36px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
}

.ms-like-response-empty-text {
  color: #6b7280;
  font-size: 13px;
}

.ms-like-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}

.api-case-readonly-body {
  padding: 0;
}

.api-case-readonly-body .api-param-table {
  margin: 0;
}

.api-case-readonly-body .api-param-table.is-readonly .api-param-row {
  cursor: default;
}

.api-case-readonly-body .api-param-table.is-readonly :deep(.el-input__wrapper),
.api-case-readonly-body .api-param-table.is-readonly :deep(.el-select__wrapper) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.api-case-readonly-body .api-body-chip:disabled {
  cursor: default;
  opacity: 1;
}

.api-case-readonly-body .api-body-chip.is-active:disabled {
  color: #2563eb;
  border-color: #93c5fd;
  background: #eff6ff;
}

.api-case-code-section {
  min-height: 260px;
}

.case-drawer-history-toolbar,
.case-drawer-history-detail-nav {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.case-drawer-history-limit-note,
.case-drawer-history-detail-time {
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-back {
  display: inline-flex;
  height: 30px;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.case-drawer-history-back:hover,
.case-drawer-history-back:focus-visible {
  background: #eff6ff;
  color: #1d4ed8;
}

.case-drawer-history-table-section {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  contain: layout paint;
}

.case-drawer-history-table {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.case-drawer-history-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-table :deep(.el-table__row td) {
  height: 42px;
  font-size: 13px;
}

.case-drawer-history-result {
  display: inline-flex;
  min-width: 44px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-result.is-passed {
  background: #f0fdf4;
  color: #16a34a;
}

.case-drawer-history-result.is-failed {
  background: #fef2f2;
  color: #dc2626;
}

.case-drawer-history-result.is-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.case-drawer-history-detail-shell,
.case-drawer-response-shell {
  min-height: 260px;
}

.case-drawer-history-detail-shell {
  position: relative;
  z-index: 0;
  margin-top: 2px;
  background: #fff;
}

.case-drawer-history-section,
.case-drawer-history-step {
  display: grid;
  gap: 10px;
}

.case-drawer-history-meta,
.case-drawer-history-request-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-request-summary {
  color: #374151;
  font-size: 13px;
}

.case-drawer-history-request-summary > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.response-error-inline {
  padding: 8px 10px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-section-title {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.case-drawer-history-table-empty {
  padding: 28px 0;
  color: #9ca3af;
  font-size: 13px;
}

:global(.api-ai-case-drawer .el-drawer__header) {
  margin: 0;
  padding: 0;
  border-bottom: 1px solid #f3f4f6;
}

:global(.api-ai-case-drawer .el-drawer__body) {
  padding: 0;
  background: #ffffff;
}

:global(.api-ai-case-drawer .el-drawer__footer) {
  padding: 0;
  border-top: 1px solid #f3f4f6;
}

.definition-import-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.definition-import-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.definition-import-close svg {
  width: 16px;
  height: 16px;
}

.ai-case-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 16px 20px;
}

.ai-case-drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.ai-case-drawer-title svg {
  width: 18px;
  height: 18px;
  color: #2563eb;
}

.ai-case-drawer-subtitle {
  margin-top: 5px;
  max-width: 420px;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-case-drawer-body {
  display: block;
  min-height: 0;
  overflow: auto;
}

.ai-case-section {
  display: grid;
  gap: 12px;
  padding: 18px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.ai-case-section-title,
.ai-case-option-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-case-section-title {
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.ai-case-section-title small {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
}

.ai-case-option-groups {
  display: grid;
  gap: 20px;
}

.ai-case-option-group {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
}

.ai-case-option-group:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.ai-case-option-group-title strong {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}

.ai-case-select-all-link,
.ai-case-refresh-models {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.ai-case-option-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, max-content));
  gap: 12px 18px;
  justify-content: start;
}

.ai-case-option-list :deep(.el-checkbox) {
  height: 18px;
  min-width: 0;
  margin-right: 0;
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  white-space: nowrap;
}

.ai-case-section :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.ai-case-section :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: #2563eb;
  background: #2563eb;
}

.ai-case-section :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #374151;
}

.api-ai-case-drawer :deep(.el-switch.is-checked .el-switch__core) {
  border-color: #2563eb;
  background-color: #2563eb;
}

.ai-case-form-section {
  gap: 16px;
  border-top: 1px solid #e5e7eb;
}

.ai-case-form-field {
  display: grid;
  gap: 6px;
}

.ai-case-form-field > span {
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.ai-case-form-control {
  width: 100%;
}

.ai-case-form-control :deep(.el-select__wrapper),
.ai-case-form-control :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #dbe2ea;
}

.ai-case-form-control :deep(.el-select__wrapper) {
  min-height: 36px;
  font-size: 13px;
}

.ai-case-form-control :deep(.el-textarea__inner) {
  min-height: 98px !important;
  padding: 12px;
  color: #374151;
  font-size: 13px;
  line-height: 1.5;
}

.ai-case-form-control :deep(.el-select__wrapper.is-focused),
.ai-case-form-control :deep(.el-textarea__inner:focus) {
  box-shadow: inset 0 0 0 1px #2563eb, 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.ai-case-form-switch {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: flex-start;
  gap: 10px;
}

.ai-case-form-switch :deep(.el-switch) {
  height: 20px;
}

.ai-case-form-switch > span {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.ai-case-form-switch strong {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ai-case-form-switch small {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.55;
}

.ai-case-generate-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.ai-case-generate-submit:hover {
  background: #1d4ed8;
}

.ai-case-generate-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-case-generate-submit svg {
  width: 16px;
  height: 16px;
}

.api-ai-case-message {
  padding: 8px 10px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.api-ai-case-log {
  max-height: 180px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.api-ai-result-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-ai-result-filters,
.api-ai-result-search,
.api-ai-result-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.api-ai-result-search {
  flex: 1 1 260px;
  justify-content: flex-end;
}

.api-ai-result-search .el-input {
  width: 220px;
}

.api-ai-result-search .el-select {
  width: 128px;
}

.api-ai-result-filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  cursor: pointer;
}

.api-ai-result-filters button:hover,
.api-ai-result-filters button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 700;
}

.api-ai-result-status,
.api-ai-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-ai-result-status.is-accepted,
.api-ai-status-pill.is-done {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-ai-result-status.is-failed,
.api-ai-status-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-ai-status-pill.is-running {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-ai-result-status.is-discarded {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.api-ai-result-table-wrap {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
}

.api-ai-result-table :deep(.el-table__header-wrapper th) {
  height: 38px;
  background: #f8fafc;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-ai-result-table :deep(.el-table__cell) {
  padding: 8px 0;
}

.api-ai-result-name {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.api-ai-result-name strong,
.api-ai-result-cell-text,
.api-ai-result-request span:last-child {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-ai-result-name strong {
  font-size: 13px;
  font-weight: 600;
}

.api-ai-result-name span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-ai-result-request {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-ai-result-table-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.api-ai-result-table-actions :deep(.el-button) {
  padding: 0 3px;
  font-size: 12px;
}

.api-ai-case-detail-dialog :deep(.el-drawer__header) {
  min-height: 58px;
  margin-bottom: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--app-border);
}

.api-ai-case-detail-dialog :deep(.el-drawer__body) {
  padding: 16px;
  background: var(--app-bg-muted);
}

.api-ai-case-detail-dialog :deep(.el-drawer__footer) {
  padding: 12px 16px;
  border-top: 1px solid var(--app-border);
}

.api-ai-case-detail-header,
.api-ai-case-detail-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-ai-case-detail-header {
  min-width: 0;
}

.api-ai-case-detail-header strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-ai-case-detail-footer {
  justify-content: flex-end;
}

.api-ai-case-detail {
  display: grid;
  min-width: 0;
}

.api-ai-case-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.api-ai-case-detail-grid > article {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
}

.api-ai-case-preview-block--full {
  grid-column: 1 / -1;
}

.api-ai-case-detail-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.api-ai-case-detail-text {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.api-ai-case-detail-text.is-rich {
  min-height: 76px;
  padding: 12px 14px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: var(--app-bg-muted);
  white-space: pre-wrap;
}

.ai-generation-workspace {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 14px 16px 0;
  background: #ffffff;
}

.ai-generation-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0 12px;
}

.ai-generation-page-header h3 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.ai-generation-title-line {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.ai-generation-title-source {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid #e5e7eb;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
}

.ai-generation-source-name,
.ai-generation-source-path {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-source-name {
  max-width: 160px;
  color: #475569;
}

.ai-generation-source-path {
  max-width: 360px;
  color: #344054;
}

.ai-generation-header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 86px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
}

.ai-generation-header-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-generation-header-action.is-stop {
  border-color: #d1d5db;
  color: #374151;
}

.ai-generation-header-action svg {
  width: 13px;
  height: 13px;
  color: #64748b;
}

.ai-generation-detail-workspace {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
}

.ai-generation-detail-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  border-bottom: 1px solid #f1f5f9;
}

.ai-generation-detail-status-tabs {
  display: inline-flex;
  overflow: hidden;
  min-width: 360px;
  padding: 2px;
  border-radius: 8px;
  background: #f5f7fb;
}

.ai-generation-detail-status-tabs button {
  min-width: 112px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.ai-generation-detail-status-tabs button.active {
  background: #ffffff;
  color: #334155;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.ai-generation-detail-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border-bottom: 1px solid #edf2f7;
}

.ai-generation-detail-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 160px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
}

.ai-generation-detail-search .el-icon,
.ai-generation-detail-search svg {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

.ai-generation-detail-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #334155;
  font-size: 12px;
}

.ai-generation-detail-search input::placeholder {
  color: #cbd5e1;
}

.ai-generation-detail-filter {
  width: 112px;
}

.ai-generation-detail-filter.is-wide {
  width: 168px;
}

.ai-generation-detail-filter :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.ai-generation-detail-filter :deep(.el-select__placeholder),
.ai-generation-detail-filter :deep(.el-select__selected-item) {
  color: #64748b;
  font-size: 12px;
}

.ai-generation-detail-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.ai-generation-detail-actions button,
.ai-generation-row-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.ai-generation-detail-actions button:disabled,
.ai-generation-row-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ai-generation-detail-actions svg,
.ai-generation-row-actions svg {
  width: 13px;
  height: 13px;
}

.ai-generation-run-selected,
.ai-generation-row-run {
  border: 0;
  background: #334155;
  color: #ffffff;
}

.ai-generation-accept-selected,
.ai-generation-row-accept {
  border: 0;
  background: #5b7cff;
  color: #ffffff;
}

.ai-generation-discard-selected,
.ai-generation-row-discard {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #475569;
}

.ai-generation-detail-table {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  scrollbar-color: rgba(148, 163, 184, 0.64) transparent;
  scrollbar-width: thin;
}

.ai-generation-detail-table::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ai-generation-detail-table::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.64);
  background-clip: padding-box;
}

.ai-generation-detail-table::-webkit-scrollbar-track {
  background: transparent;
}

.ai-generation-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  color: #64748b;
  font-size: 13px;
}

.ai-generation-empty-state svg {
  width: 16px;
  height: 16px;
  color: #3b82f6;
}

.ai-generation-detail-head,
.ai-generation-detail-row {
  display: grid;
  grid-template-columns: 32px minmax(320px, 1fr) 170px 92px 110px 190px;
  align-items: center;
  column-gap: 12px;
}

.ai-generation-detail-head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 34px;
  border-bottom: 1px solid #eef2f7;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.ai-generation-detail-head span {
  text-align: left;
}

.ai-generation-detail-row {
  min-height: 42px;
  border-bottom: 1px solid #edf2f7;
  color: #334155;
  cursor: pointer;
  font-size: 13px;
}

.ai-generation-detail-row:hover {
  background: #f4f7fb;
}

.ai-generation-row-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  justify-self: center;
}

.ai-generation-row-index {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1;
}

.ai-generation-row-loading {
  width: 16px;
  height: 16px;
  color: #3b82f6;
}

.ai-generation-row-checkbox {
  display: none;
}

.ai-generation-detail-row:hover .ai-generation-row-index {
  display: none;
}

.ai-generation-detail-row:hover .ai-generation-row-checkbox {
  display: inline-flex;
}

.ai-generation-detail-name {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.ai-generation-detail-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-detail-group-cell {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.ai-generation-case-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  overflow: hidden;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-generation-detail-group-type {
  color: #334155;
  font-size: 12px;
}

.ai-generation-detail-group-type.is-negative {
  color: #475569;
}

.ai-generation-run-result {
  color: #94a3b8;
}

.ai-generation-run-result.is-success {
  color: #16a34a;
}

.ai-generation-run-result.is-failed {
  color: #dc2626;
}

.ai-generation-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.ai-generation-detail-row:hover .ai-generation-row-actions {
  opacity: 1;
  pointer-events: auto;
}

.ai-generation-row-actions button {
  flex: 0 0 auto;
  white-space: nowrap;
}

.api-ai-case-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.api-ai-case-detail-tags span {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: 22px;
}

.api-ai-case-detail-grid pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-history-snapshots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.api-case-history-snapshots > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.api-case-history-snapshots span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-advanced-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-advanced-toolbar > div:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-advanced-toolbar strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-advanced-toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-advanced-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-table,
.api-extractor-table,
.api-processor-list {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #fff;
}

.api-assertion-header,
.api-assertion-row {
  display: grid;
  min-width: 920px;
  grid-template-columns: 64px 1.1fr 140px 130px 1fr 1fr 64px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.api-assertion-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-row {
  min-height: 40px;
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow-x: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-batch-link {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-batch-link:hover {
  border-color: var(--app-primary);
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-assertion-empty {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
  font-weight: 400;
}

.api-assertion-list > .api-assertion-empty {
  margin: 8px;
}

.api-assertion-empty--inline {
  min-height: 100%;
}

.api-assertion-list-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: calc(100% - 16px);
  margin: 0 8px 6px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-assertion-list-item:hover {
  background: var(--app-bg-page);
}

.api-assertion-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-assertion-list-item__main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-assertion-list-copy {
  min-width: 0;
}

.api-assertion-list-title,
.api-assertion-list-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-assertion-list-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.api-assertion-list-meta {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.api-assertion-list-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.api-assertion-ghost-action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-assertion-ghost-action:hover:not(:disabled) {
  color: var(--app-text-primary);
}

.api-assertion-ghost-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-assertion-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: visible;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-detail-header,
.api-assertion-detail-fields,
.api-assertion-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-detail-header {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-assertion-detail-fields {
  flex: 1;
  min-width: 280px;
}

.api-assertion-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-assertion-detail-fields :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-detail-actions button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.api-assertion-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
}

.api-assertion-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
}

.api-assertion-form-grid :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-select__wrapper),
.api-assertion-form-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-assertion-form-label {
  min-width: 72px;
}

.api-assertion-form-row :deep(.el-input-number) {
  width: 150px;
}

.api-assertion-type-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-assertion-subtitle,
.api-assertion-mode-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-assertion-subtitle {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-assertion-subtitle button,
.api-assertion-item-row button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-item-list {
  display: grid;
  gap: 0;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-assertion-item-row {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--app-border-soft);
  border-radius: 0;
  background: var(--app-bg-panel);
}

.api-assertion-item-row:hover {
  background: var(--app-bg-page);
}

.api-assertion-item-row:last-child {
  border-bottom: 0;
}

.api-assertion-item-row.is-header {
  min-width: 720px;
  grid-template-columns: auto minmax(160px, 1fr) 170px minmax(160px, 1fr) auto auto;
}

.api-assertion-item-row.is-body {
  min-width: 820px;
  grid-template-columns: auto minmax(200px, 1.3fr) 170px minmax(160px, 1fr) auto auto auto;
}

.api-fast-extraction-suffix-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #165dff;
  cursor: pointer;
}

.api-fast-extraction-suffix-button:hover:not(:disabled) {
  background: #eff6ff;
}

.api-fast-extraction-suffix-button .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-fast-extraction-suffix-button.is-disabled,
.api-fast-extraction-suffix-button:disabled {
  background: transparent;
  color: #c9cdd4;
  cursor: not-allowed;
}

.api-assertion-item-row.is-variable {
  min-width: 640px;
  grid-template-columns: 48px minmax(140px, 1fr) 132px minmax(120px, 1fr) repeat(2, auto);
}

.api-assertion-item-row .api-row-remove {
  color: var(--app-danger);
}

.api-assertion-add-row {
  align-self: flex-start;
  width: fit-content;
  margin: 6px 10px 8px 196px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.api-assertion-format-select {
  width: 120px;
}

.api-assertion-hint {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-extractor-header,
.api-extractor-row {
  display: grid;
  min-width: 1280px;
  grid-template-columns: 56px 150px 130px 130px minmax(180px, 1.2fr) 140px 120px 72px 88px minmax(140px, 1fr) 64px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.api-extractor-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-extractor-row {
  min-height: 40px;
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-assertion-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-assertion-panel {
  grid-template-columns: 1fr;
}

.api-assertion-panel:has(.api-assertion-editor) > .api-advanced-toolbar {
  display: none;
}

.api-assertion-toolbar {
  display: flex;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
}

.api-assertion-toolbar + .api-assertion-list-item {
  margin-top: 8px;
}

.api-processor-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.api-processor-panel > .api-advanced-toolbar {
  display: none;
}

.api-processor-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  color: var(--app-text-primary);
}

.api-processor-sidebar,
.api-processor-detail {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-processor-sidebar {
  display: flex;
  flex-direction: column;
}

.api-processor-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: flex-start;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
}

.api-legacy-primary {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.api-legacy-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-processor-sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  overflow-x: hidden;
}

.api-processor-list-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-processor-list-item:hover {
  background: var(--app-bg-page);
}

.api-processor-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-processor-list-item__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-processor-list-copy {
  min-width: 0;
}

.api-processor-list-title,
.api-processor-list-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-processor-list-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.api-processor-list-meta,
.api-processor-form-label,
.api-processor-hint,
.api-processor-form-grid span {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.api-processor-list-actions,
.api-processor-detail-actions,
.api-processor-detail-fields,
.api-processor-detail-header,
.api-processor-form-row,
.api-processor-editor-actions,
.api-assertion-editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-processor-list-actions {
  gap: 4px;
}

.api-processor-list-actions :deep(.el-button) {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  color: var(--app-text-muted);
}

.api-processor-list-actions :deep(.el-button:hover) {
  color: var(--app-primary);
  background: transparent;
}

.api-processor-list-actions :deep(.el-button.is-disabled) {
  color: var(--app-text-subtle);
  background: transparent;
}

.api-processor-detail-actions button,
.api-processor-editor-actions button,
.api-assertion-editor-actions button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.api-processor-editor-actions button,
.api-assertion-editor-actions button {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
}

.api-processor-editor-actions button:hover,
.api-assertion-editor-actions button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
  background: var(--app-bg-panel);
}

.api-processor-list-actions button:disabled {
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-processor-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: hidden;
  overflow-y: visible;
  padding: 12px;
}

.api-processor-detail-header {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-processor-detail-fields {
  flex: 1;
  min-width: 280px;
}

.api-processor-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-processor-detail-fields :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-select__wrapper),
.api-processor-extract-row :deep(.el-input__wrapper),
.api-processor-extract-row :deep(.el-select__wrapper),
.api-sql-extract-table__row :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-processor-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.api-processor-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.api-processor-form-grid :deep(.el-input-number) {
  width: 100%;
}

.api-processor-form-grid :deep(.el-input-number .el-input__wrapper) {
  min-height: 32px;
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-processor-language-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: #eff6ff;
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 600;
}

.api-processor-empty {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-processor-empty--inline {
  min-height: 160px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-page);
}

.api-processor-card {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
  border-top: 1px solid var(--app-border-soft);
}

.api-processor-card:first-child {
  border-top: 0;
}

.api-processor-card__head {
  display: grid;
  grid-template-columns: 56px minmax(160px, 1fr) 160px auto;
  gap: 8px;
  align-items: center;
}

.api-processor-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-processor-config-grid {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
}

.api-processor-config-grid label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-processor-extract-panel {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.api-processor-extract-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-processor-extract-toolbar button,
.api-processor-extract-row button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-processor-extract-scroll {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: #d7dbe3 transparent;
}

.api-processor-extract-scroll::-webkit-scrollbar {
  height: 6px;
}

.api-processor-extract-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.api-processor-extract-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: #d7dbe3;
}

.api-processor-extract-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #d7dbe3;
}

.api-processor-extract-grid {
  width: max-content;
  min-width: 100%;
  overflow: visible;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-processor-extract-header,
.api-processor-extract-row {
  display: grid;
  grid-template-columns: 150px 150px 130px 110px 96px 220px 56px;
  align-items: start;
  gap: 8px;
  padding: 8px 12px;
}

.api-processor-extract-header {
  min-height: 40px;
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-processor-extract-row {
  min-height: 48px;
  border-top: 1px solid var(--app-border-soft);
}

.api-processor-extract-row:hover {
  background: var(--app-bg-page);
}

.api-processor-extract-row .api-row-remove {
  color: var(--app-danger);
}

.api-processor-extract-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 56px;
  min-height: 32px;
  white-space: nowrap;
}

.api-processor-extract-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--app-radius-sm);
}

.api-processor-extract-more .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-processor-extract-delete {
  min-width: 28px;
}

.api-processor-extract-more-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-processor-extract-copy {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.api-processor-extract-more-divider {
  height: 1px;
  background: var(--app-border-soft);
}

.api-processor-extract-more-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.api-processor-extract-more-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-processor-extract-more-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-sql-extract-table {
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-sql-extract-table__header,
.api-sql-extract-table__row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) 72px;
  align-items: center;
  gap: 8px;
}

.api-sql-extract-table__header {
  min-height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-sql-extract-table__row {
  min-height: 42px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-sql-extract-table__row .api-row-remove,
.api-sql-extract-table__add {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.api-sql-extract-table__row .api-row-remove {
  color: var(--app-danger);
}

.api-sql-extract-table__add {
  justify-self: start;
  min-height: 34px;
  padding: 0 10px;
}

.api-wait-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary {
  min-height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
  color: #fff;
}

.api-json-panel p {
  margin: 0;
  color: var(--app-text-muted);
  font-weight: 700;
}

.api-response-shell {
  position: relative;
  display: flex;
  min-height: 360px;
  flex: 0 0 auto;
  flex-direction: column;
  border-top: 1px solid var(--app-border);
  background: #fff;
  overflow: visible;
}

.api-response-resizer {
  position: absolute;
  z-index: 5;
  top: -3px;
  right: 0;
  left: 0;
  height: 6px;
  flex: none;
  background: transparent;
  cursor: row-resize;
}

.api-response-resizer::after {
  position: absolute;
  top: 2px;
  left: 50%;
  width: 42px;
  height: 2px;
  border-radius: 999px;
  background: var(--app-border-strong);
  content: "";
  transform: translateX(-50%);
}

.api-response-header {
  display: flex;
  height: 41px;
  min-height: 41px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-response-header strong {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-response-header__right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-response-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 16px;
}

.api-response-result-pill {
  display: inline-flex;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.api-response-result-pill.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-response-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-response-case-button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.api-response-case-button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-response-pill {
  padding: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-subtle);
}

.api-response-pill.is-success {
  color: var(--app-success);
}

.api-response-pill.is-danger {
  color: var(--app-danger);
}

.api-response-pill.is-warning {
  color: var(--app-warning);
}

.api-response-content {
  display: flex;
  min-height: 300px;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.api-response-empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 0 4px;
  color: var(--app-text-muted);
}

.api-response-empty__window {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-response-empty__window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-text-subtle);
  opacity: 0.6;
}

.api-response-empty p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.api-response-empty b {
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-pre {
  min-height: 260px;
  max-height: none;
  overflow: auto;
  margin: 0;
  padding: 12px 16px;
  background: #fff;
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.api-response-code {
  display: flex;
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  overflow: visible;
  margin: 12px;
}

.api-response-code :deep(.api-code-editor) {
  width: 100%;
  min-height: 0;
}

.api-import-dialog {
  display: grid;
  gap: 0;
}

.api-import-dialog-shell :deep(.el-dialog) {
  overflow: hidden;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

.api-import-dialog-shell :deep(.el-dialog__header),
.api-import-dialog-shell :deep(.el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-import-dialog-shell) {
  overflow: hidden;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 16px;
  line-height: 24px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header),
:global(.el-dialog.api-import-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header) {
  display: block;
  height: 64px;
}

.api-import-dialog {
  overflow: hidden;
  background: #fff;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-import-header,
.api-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.api-import-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.api-import-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-import-title-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.api-import-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  line-height: normal;
}

.api-import-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-import-close svg {
  width: 16px;
  height: 16px;
}

.api-import-body {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.api-import-section {
  display: grid;
  gap: 12px;
}

.api-import-section-title {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  height: 21px;
  line-height: 21px;
}

.api-import-format-list {
  display: grid;
  gap: 8px;
}

.api-import-format {
  display: grid;
  width: 100%;
  height: 64px;
  grid-template-columns: 36px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 13.3333px;
  line-height: normal;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-format:nth-child(3) {
  height: 68px;
}

.api-import-format:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.api-import-format.is-active.is-green {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.api-import-format.is-active.is-orange {
  border-color: #fed7aa;
  background: #fff7ed;
}

.api-import-format.is-active.is-purple {
  border-color: #e9d5ff;
  background: #faf5ff;
}

.api-import-format-icon,
.api-import-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.api-import-format-icon {
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  color: #9ca3af;
}

.api-import-format.is-active.is-green .api-import-format-icon {
  background: #dcfce7;
  color: #16a34a;
}

.api-import-format.is-active.is-orange .api-import-format-icon {
  background: #ffedd5;
  color: #ea580c;
}

.api-import-format.is-active.is-purple .api-import-format-icon {
  background: #f3e8ff;
  color: #9333ea;
}

.api-import-format-icon svg {
  width: 18px;
  height: 18px;
}

.api-import-format-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  line-height: normal;
}

.api-import-format-copy > span {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.api-import-format-copy small {
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-import-check {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  color: #2563eb;
}

.api-import-check svg {
  width: 12px;
  height: 12px;
}

.api-import-mode-switch {
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: #f3f4f6;
}

.api-import-mode-switch button {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.api-import-mode-switch button.is-active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.api-import-url :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-import-url :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-import-upload {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-upload:hover {
  border-color: #60a5fa;
  background: #eff6ff;
}

.api-import-upload input {
  display: none;
}

.api-import-upload-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
}

.api-import-upload small {
  color: #9ca3af;
  font-size: 12px;
}

.api-import-field {
  display: grid;
  gap: 6px;
}

.api-import-field > span {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.api-import-field small {
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
}

.api-import-field :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-import-field :deep(.el-select__wrapper.is-focused) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-import-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.api-import-option > span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.api-import-option strong {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.api-import-option small {
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
}

.api-import-footer {
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
}

.api-import-cancel,
.api-import-submit {
  height: 36px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.api-import-cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #374151;
}

.api-import-cancel:hover {
  background: #f3f4f6;
}

.api-import-submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-import-submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.api-soft-dialog-shell :deep(.el-dialog) {
  border: 1px solid var(--app-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

.api-soft-dialog-shell :deep(.el-dialog__header),
.api-soft-dialog-shell :deep(.el-dialog__body) {
  padding: 0;
}

:global(.el-dialog.api-soft-dialog-shell) {
  overflow: hidden;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header),
:global(.el-dialog.api-soft-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header) {
  display: none;
}

.api-soft-dialog {
  background: #fff;
}

.api-soft-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 65px;
  padding: 20px 28px 20px 24px;
}

.api-soft-dialog__header strong {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-soft-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.api-soft-dialog__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-soft-dialog__body {
  min-height: 111px;
  padding: 20px 24px;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body p {
  margin: 0 0 12px;
  color: #4b5563;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body :deep(.el-input__wrapper),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  min-height: 38px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.api-soft-dialog__body :deep(.el-input__inner),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  color: #374151;
}

.api-soft-dialog__body :deep(.el-input__wrapper.is-focus),
.api-soft-dialog__body :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #2563eb inset;
}

.api-soft-dialog__body :deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.api-soft-dialog__error {
  margin-top: 8px;
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-soft-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  min-height: 71px;
  padding: 16px 24px;
  background: #fff;
}

.api-soft-dialog__cancel,
.api-soft-dialog__submit {
  min-width: 58px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-soft-dialog__cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

.api-soft-dialog__cancel:hover {
  background: #f3f4f6;
}

.api-soft-dialog__submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-soft-dialog__submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

:global(.api-soft-message-box.el-message-box) {
  width: 420px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.api-soft-message-box .el-message-box__header) {
  display: flex;
  align-items: center;
  min-height: 65px;
  padding: 20px 28px 20px 24px;
}

:global(.api-soft-message-box .el-message-box__title) {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

:global(.api-soft-message-box .el-message-box__headerbtn) {
  top: 16px;
  right: 22px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

:global(.api-soft-message-box .el-message-box__content) {
  min-height: 72px;
  padding: 20px 24px;
  color: #4b5563;
  font-size: 14px;
  line-height: 21px;
}

:global(.api-soft-message-box .el-message-box__status) {
  top: 20px;
}

:global(.api-soft-message-box .el-message-box__message) {
  padding-left: 28px;
  line-height: 21px;
}

:global(.api-soft-message-box .el-message-box__btns) {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  min-height: 71px;
  padding: 16px 24px;
  background: #fff;
}

:global(.api-soft-message-box .el-button) {
  min-width: 58px;
  height: 38px;
  margin-left: 0;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

:global(.api-soft-message-box__cancel.el-button) {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

:global(.api-soft-message-box__cancel.el-button:hover) {
  border-color: #d1d5db;
  background: #f3f4f6;
  color: #111827;
}

:global(.api-soft-message-box__primary.el-button--primary) {
  border-color: #2563eb;
  background: #2563eb;
}

:global(.api-soft-message-box__primary.el-button--primary:hover) {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

:global(.api-soft-message-box__danger.el-button--primary) {
  border-color: #ef4444;
  background: #ef4444;
}

:global(.api-soft-message-box__danger.el-button--primary:hover) {
  border-color: #dc2626;
  background: #dc2626;
}

.api-batch-dialog-shell :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.api-batch-dialog-shell :deep(.el-dialog__header),
.api-batch-dialog-shell :deep(.el-dialog__body) {
  padding: 0;
}

.api-batch-dialog {
  background: #fff;
}

.api-batch-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-batch-dialog__header strong {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.api-batch-dialog__body {
  padding: 16px 20px 18px;
}

.api-batch-dialog__body p {
  margin: 0 0 12px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-batch-dialog__examples {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-batch-dialog__examples span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-batch-dialog__examples code {
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.api-batch-dialog__notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.api-batch-dialog__notes span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-batch-dialog__body :deep(.el-textarea__inner) {
  min-height: 220px;
  border-radius: var(--app-radius-md);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.api-batch-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
}

.api-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.api-dialog-footer :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--app-radius-sm);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-dialog-footer :deep(.el-button--primary) {
  border-color: var(--app-primary);
  background: var(--app-primary);
}

@media (max-width: 1480px) {
  .api-interface-shell {
    grid-template-columns: 272px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .api-interface-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }
}
</style>
