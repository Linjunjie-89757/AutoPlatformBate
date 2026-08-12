<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Check,
  ChevronLeft,
  CircleCheck,
  Eye,
  Monitor,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import { useSession } from '@/entities/session'
import {
  webUiAutomationApi,
  type WebUiElementCollectCandidate,
  type WebUiElementItem,
  type WebUiElementPageItem,
  type WebUiEnvironmentItem,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { confirmDelete } from '@/shared/ui'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import WebUiModuleTabs from './WebUiModuleTabs.vue'

const props = withDefaults(defineProps<{
  workspaceCode?: string
  workspaceReady?: boolean
  environments?: WebUiEnvironmentItem[]
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
}>(), {
  workspaceCode: 'ALL',
  workspaceReady: false,
  environments: () => [],
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canExecute: true,
})

type PageId = 'root' | number
type CaptureStatus = 'list' | 'config' | 'scanning' | 'result'
type AdoptStatus = 'pending' | 'adopted' | 'ignored'

type ElementRow = {
  id: number
  name: string
  description: string
  page: string
  pageId: number | null
  group: string
  locatorType: string
  locatorValue: string
  refCount: number
  verified: 'pass' | 'fail' | null
}

type Candidate = {
  id: string
  name: string
  type: string
  purpose: string
  locatorType: string
  locatorValue: string
  confidence: number
  page: string
  status: AdoptStatus
  source: WebUiElementCollectCandidate
}

const pages = ref<Array<{ id: PageId; label: string; source: WebUiElementPageItem | null }>>([
  { id: 'root', label: '全部元素', source: null },
])

const rows = ref<ElementRow[]>([])
const aiProviders = ref<AiProviderConnectionItem[]>([])

const state = ref<CaptureStatus>('list')
const selectedPage = ref<PageId>('root')
const pageKeyword = ref('')
const keyword = ref('')
const locatorFilter = ref('')
const verifyFilter = ref('')
const captureUrl = ref('')
const captureScope = ref('全页可操作元素')
const includeIframe = ref(false)
const waitForIdle = ref(2000)
const maxElements = ref(50)
const scanStep = ref(0)
const candidates = ref<Candidate[]>([])
const candidateStatus = ref<'all' | AdoptStatus>('all')
const candidateType = ref('')
const candidateConfidence = ref('')
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const rootTotal = ref(0)
const loading = ref(false)
const savingCandidates = ref(false)
const validatingId = ref<number | null>(null)
const { currentUser } = useSession()

let tableFrameObserver: ResizeObserver | null = null
let captureTimer: ReturnType<typeof window.setInterval> | null = null
let keywordTimer: ReturnType<typeof window.setTimeout> | null = null
let listRequestVersion = 0

const pageCounts = computed(() => pages.value.reduce<Record<string, number>>((result, page) => {
  result[String(page.id)] = page.id === 'root' ? rootTotal.value : Number(page.source?.elementCount || 0)
  return result
}, { root: rootTotal.value }))

const visiblePages = computed(() => pages.value.filter(page => page.label.includes(pageKeyword.value.trim())))
const enabledEnvironments = computed(() => props.environments.filter(item => item.status !== 0))
const selectedAiProvider = computed(() => aiProviders.value.find(item => item.status !== 0 && Boolean(item.modelName)) || null)

const tableColumns: AppTableColumnDefinition[] = [
  { key: 'name', label: '元素名称', defaultVisible: true, required: true },
  { key: 'page', label: '所属页面', defaultVisible: true },
  { key: 'group', label: '分组', defaultVisible: true },
  { key: 'locatorType', label: '定位方式', defaultVisible: true },
  { key: 'locatorValue', label: '定位值', defaultVisible: true },
  { key: 'refCount', label: '引用次数', defaultVisible: true },
  { key: 'verified', label: '最近验证', defaultVisible: true },
]

const columnSettings = useTableColumnSettings({
  columns: tableColumns,
  storageKey: computed(() => `app-figma-table:web-ui-elements:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  immediate: true,
})

const columnWeights: Record<string, number> = {
  name: 18,
  page: 10,
  group: 9,
  locatorType: 8,
  locatorValue: 22,
  refCount: 8,
  verified: 9,
}
const operationActionCount = computed(() => 1 + [props.canExecute, props.canEdit, props.canDelete].filter(Boolean).length)
const operationWidth = computed(() => Math.max(96, getAppFigmaActionColumnWidth(operationActionCount.value)))
const baselineTableWidth = computed(() => Math.max(1100, tableFrameWidth.value ? tableFrameWidth.value - 2 : 1100))
const tableNeedsScroll = computed(() => Boolean(tableFrameWidth.value && baselineTableWidth.value > tableFrameWidth.value))
const tableColumnWidths = computed<Record<string, number>>(() => {
  const entries = Object.entries(columnWeights)
  const totalWeight = entries.reduce((total, [, weight]) => total + weight, 0)
  const targetWidth = baselineTableWidth.value - operationWidth.value
  let allocatedWidth = 0

  return entries.reduce<Record<string, number>>((widths, [key, weight], index) => {
    const width = index === entries.length - 1
      ? targetWidth - allocatedWidth
      : Math.round(targetWidth * weight / totalWeight)
    widths[key] = width
    allocatedWidth += width
    return widths
  }, {})
})

function getColumnWidth(column: AppTableColumnDefinition) {
  return tableColumnWidths.value[column.key] || column.width || column.minWidth || 120
}

function openColumnSettings() {
  columnSettings.open()
}

function mapElementRow(item: WebUiElementItem): ElementRow {
  return {
    id: item.id,
    name: item.elementName,
    description: item.description || '暂无描述',
    page: item.pageName || '未归属页面',
    pageId: item.pageId,
    group: item.groupName || '未分组',
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    refCount: Number(item.usageCount || 0),
    verified: item.lastValidateResult === 'PASSED'
      ? 'pass'
      : item.lastValidateResult === 'FAILED'
        ? 'fail'
        : null,
  }
}

async function loadPages() {
  const response = await webUiAutomationApi.getElementPages(props.workspaceCode)
  rootTotal.value = response.items.reduce((sum, item) => sum + Number(item.elementCount || 0), 0)
  pages.value = [
    { id: 'root', label: '全部元素', source: null },
    ...response.items.map(item => ({ id: item.id, label: item.pageName, source: item })),
  ]
  if (selectedPage.value !== 'root' && !response.items.some(item => item.id === selectedPage.value)) {
    selectedPage.value = 'root'
  }
}

async function loadAiProviders() {
  aiProviders.value = await aiProviderApi.getProviderConnections(props.workspaceCode)
}

async function loadElements() {
  if (!props.workspaceReady) return

  const requestVersion = ++listRequestVersion
  loading.value = true
  try {
    const response = await webUiAutomationApi.getElements(props.workspaceCode, {
      keyword: keyword.value.trim() || undefined,
      pageId: selectedPage.value === 'root' ? undefined : selectedPage.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    if (requestVersion !== listRequestVersion) return
    rows.value = response.items.map(mapElementRow)
    total.value = response.total
    if (selectedPage.value === 'root') rootTotal.value = response.total
  } catch (error) {
    if (requestVersion !== listRequestVersion) return
    rows.value = []
    total.value = 0
    if (selectedPage.value === 'root') rootTotal.value = 0
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false
  }
}

async function reloadWorkspaceData() {
  if (!props.workspaceReady) {
    pages.value = [{ id: 'root', label: '全部元素', source: null }]
    rows.value = []
    total.value = 0
    rootTotal.value = 0
    aiProviders.value = []
    return
  }

  pageNo.value = 1
  selectedPage.value = 'root'
  const [pagesResult, providersResult] = await Promise.allSettled([loadPages(), loadAiProviders()])
  if (pagesResult.status === 'rejected') ElMessage.error(getRequestErrorMessage(pagesResult.reason))
  if (providersResult.status === 'rejected') aiProviders.value = []
  await loadElements()
}

function setPage(value: number) {
  pageNo.value = value
  void loadElements()
}

function setPageSize(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadElements()
}

function resetPageAndLoad() {
  pageNo.value = 1
  void loadElements()
}

watch(() => [props.workspaceCode, props.workspaceReady] as const, () => {
  void reloadWorkspaceData()
}, { immediate: true })

watch(selectedPage, resetPageAndLoad)

watch(keyword, () => {
  if (keywordTimer) window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(resetPageAndLoad, 300)
})

watch(verifyFilter, (value) => {
  if (!value) return
  ElMessage.info('验证状态尚未进入元素列表服务端筛选契约，已保留 Figma 入口但不执行当前页伪筛选')
  window.setTimeout(() => {
    verifyFilter.value = ''
  }, 0)
})

watch(locatorFilter, (value) => {
  if (!value) return
  ElMessage.info('定位方式尚未进入元素列表服务端查询契约，已保留 Figma 入口但不执行当前页伪筛选')
  window.setTimeout(() => {
    locatorFilter.value = ''
  }, 0)
})

watch(tableFrameRef, (element) => {
  tableFrameObserver?.disconnect()
  tableFrameObserver = null
  if (!element) return

  const syncWidth = () => {
    tableFrameWidth.value = element.clientWidth
  }
  syncWidth()
  tableFrameObserver = new ResizeObserver(syncWidth)
  tableFrameObserver.observe(element)
})

onBeforeUnmount(() => {
  tableFrameObserver?.disconnect()
  if (captureTimer) window.clearInterval(captureTimer)
  if (keywordTimer) window.clearTimeout(keywordTimer)
  listRequestVersion += 1
})

const candidateTypes = computed(() => [...new Set(candidates.value.map(item => item.type))])
const filteredCandidates = computed(() => candidates.value.filter((candidate) => {
  if (candidateStatus.value !== 'all' && candidate.status !== candidateStatus.value) return false
  if (candidateType.value && candidate.type !== candidateType.value) return false
  if (candidateConfidence.value === 'high' && candidate.confidence < 90) return false
  if (candidateConfidence.value === 'medium' && (candidate.confidence < 80 || candidate.confidence >= 90)) return false
  if (candidateConfidence.value === 'low' && candidate.confidence >= 80) return false
  return true
}))
const candidatePages = computed(() => [...new Set(filteredCandidates.value.map(item => item.page))])
const adoptedCount = computed(() => candidates.value.filter(item => item.status === 'adopted').length)
const pendingCount = computed(() => candidates.value.filter(item => item.status === 'pending').length)
const ignoredCount = computed(() => candidates.value.filter(item => item.status === 'ignored').length)
const highCount = computed(() => candidates.value.filter(item => item.confidence >= 90).length)
const mediumCount = computed(() => candidates.value.filter(item => item.confidence >= 80 && item.confidence < 90).length)
const lowCount = computed(() => candidates.value.filter(item => item.confidence < 80).length)

const scanSteps = ['连接目标页面', '解析 DOM 树', 'AI 识别元素', '生成定位策略', '完成']

function getSelectedPage() {
  return pages.value.find(page => page.id === selectedPage.value)?.source || null
}

function resolveCaptureUrl(page: WebUiElementPageItem) {
  const pagePath = page.pagePath?.trim() || ''
  if (/^https?:\/\//i.test(pagePath)) return pagePath

  const baseUrl = enabledEnvironments.value[0]?.baseUrl?.trim() || ''
  if (!baseUrl) return pagePath
  try {
    return new URL(pagePath || '/', baseUrl).toString()
  } catch {
    return pagePath || baseUrl
  }
}

function openCapture() {
  if (!props.canCreate) return
  const page = getSelectedPage()
  if (!page) {
    ElMessage.warning('请先在左侧选择候选元素要归属的页面')
    return
  }
  captureUrl.value = resolveCaptureUrl(page)
  state.value = 'config'
  scanStep.value = 0
  candidates.value = []
}

function backToLibrary() {
  if (captureTimer) window.clearInterval(captureTimer)
  captureTimer = null
  state.value = 'list'
}

function mapCandidate(item: WebUiElementCollectCandidate, index: number, pageName: string): Candidate {
  return {
    id: `${item.locatorType}-${index}-${item.locatorValue}`,
    name: item.elementName,
    type: item.elementType || item.tagName || 'element',
    purpose: item.businessMeaning || item.reason || item.maintenanceSuggestion || 'AI 识别候选元素',
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    confidence: Math.max(0, Math.min(100, Number(item.confidence || 0))),
    page: pageName,
    status: 'pending',
    source: item,
  }
}

async function startCapture() {
  if (!props.canCreate) return
  const page = getSelectedPage()
  if (!page) {
    ElMessage.warning('请返回元素库并选择候选元素要归属的页面')
    return
  }
  if (!captureUrl.value.trim()) {
    ElMessage.warning('请输入目标页面地址')
    return
  }
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('当前工作区没有已启用且已配置模型的 AI 连接')
    return
  }

  if (captureTimer) window.clearInterval(captureTimer)
  candidates.value = []
  scanStep.value = 0
  state.value = 'scanning'
  captureTimer = window.setInterval(() => {
    scanStep.value = Math.min(scanStep.value + 1, scanSteps.length - 2)
  }, 700)

  try {
    const environment = enabledEnvironments.value[0]
    const scopeMap = {
      '全页可操作元素': 'ALL',
      '仅表单元素': 'FORM',
      '按钮与链接': 'BUTTON',
    } as const
    const result = await webUiAutomationApi.collectElements(page.workspaceCode || props.workspaceCode, {
      pageUrl: captureUrl.value.trim(),
      environmentId: environment?.id ?? null,
      moduleId: page.moduleId,
      pageId: page.id,
      pageName: page.pageName,
      groupStrategy: 'AI',
      scope: scopeMap[captureScope.value as keyof typeof scopeMap] || 'ALL',
      browserType: environment?.browserType || 'CHROMIUM',
      headless: environment?.headless ?? true,
      timeoutMs: environment?.defaultTimeoutMs || 10000,
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
    })
    const limit = Math.max(1, Math.min(120, Number(maxElements.value || 50)))
    candidates.value = result.candidates.slice(0, limit).map((item, index) => mapCandidate(item, index, page.pageName))
    scanStep.value = scanSteps.length - 1
    state.value = 'result'
    if (!candidates.value.length) {
      ElMessage.warning(result.message || '未识别到候选元素')
    } else if (result.aiEnhanced) {
      ElMessage.success(result.message || `已生成 ${candidates.value.length} 个候选元素`)
    } else {
      ElMessage.warning(result.fallbackReason || result.message || '本次采集未完成 AI 增强')
    }
  } catch (error) {
    state.value = 'config'
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (captureTimer) window.clearInterval(captureTimer)
    captureTimer = null
  }
}

function setCandidateStatus(id: string, status: AdoptStatus) {
  if (!props.canCreate) return
  const candidate = candidates.value.find(item => item.id === id)
  if (!candidate) return
  if (status === 'adopted' && candidate.source.saveBlockedReason) {
    ElMessage.warning(candidate.source.saveBlockedReason)
    return
  }
  candidate.status = status
}

function adoptAll() {
  if (!props.canCreate) return
  candidates.value.forEach((candidate) => {
    if (candidate.status === 'pending' && !candidate.source.saveBlockedReason) candidate.status = 'adopted'
  })
}

function showPendingDesign(action: string) {
  ElMessage.info(`${action}已有后台能力，但当前 Figma 页面缺少对应弹窗或抽屉设计，已记录到遗留问题`)
}

async function validateRow(row: ElementRow) {
  if (!props.canExecute) return
  if (validatingId.value !== null) return
  const environment = enabledEnvironments.value[0]
  if (!environment?.baseUrl) {
    ElMessage.warning('请先配置并启用 Web UI 测试环境')
    return
  }

  validatingId.value = row.id
  try {
    const result = await webUiAutomationApi.validateElement(props.workspaceCode, row.id, {
      baseUrl: environment.baseUrl,
      browserType: environment.browserType,
      headless: environment.headless,
      timeoutMs: environment.defaultTimeoutMs,
    })
    ElMessage[result.matched ? 'success' : 'warning'](
      result.matched ? `验证通过，匹配 ${result.matchCount} 个元素` : result.errorMessage || '未匹配到元素',
    )
    await Promise.all([loadElements(), loadPages()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    validatingId.value = null
  }
}

async function deleteRow(row: ElementRow) {
  if (!props.canDelete) return
  try {
    await confirmDelete({
      title: '删除元素',
      message: `确认删除元素「${row.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    await webUiAutomationApi.deleteElement(props.workspaceCode, row.id)
    ElMessage.success('元素已删除')
    if (rows.value.length === 1 && pageNo.value > 1) pageNo.value -= 1
    await Promise.all([loadElements(), loadPages()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadAllElementsForPage(pageId: number) {
  const first = await webUiAutomationApi.getElements(props.workspaceCode, { pageId, pageNo: 1, pageSize: 200 })
  const result = [...first.items]
  const actualPageSize = Math.max(1, Number(first.pageSize || 200))
  const pageCount = Math.ceil(first.total / actualPageSize)
  for (let current = 2; current <= pageCount; current += 1) {
    const next = await webUiAutomationApi.getElements(props.workspaceCode, { pageId, pageNo: current, pageSize: actualPageSize })
    result.push(...next.items)
  }
  return result
}

function isDuplicateCandidate(existing: WebUiElementItem[], pageId: number, groupName: string, candidate: Candidate) {
  return existing.some(item => item.pageId === pageId && (
    (item.locatorType === candidate.source.locatorType && item.locatorValue === candidate.source.locatorValue)
    || ((item.groupName || '') === groupName && item.elementName === candidate.source.elementName)
  ))
}

function buildCandidateDescription(candidate: Candidate) {
  return [
    candidate.source.businessMeaning,
    candidate.source.reason,
    candidate.source.maintenanceSuggestion,
    candidate.source.stabilityNote,
  ].filter(Boolean).join('；') || 'AI 采集入库'
}

async function confirmCandidates() {
  if (!props.canCreate) return
  if (savingCandidates.value) return
  const page = getSelectedPage()
  const adopted = candidates.value.filter(item => item.status === 'adopted' && !item.source.saveBlockedReason)
  if (!page || !adopted.length) {
    ElMessage.warning(page ? '请至少采纳一个可入库候选元素' : '未找到候选元素所属页面')
    return
  }

  savingCandidates.value = true
  try {
    const [groupPage, existing] = await Promise.all([
      webUiAutomationApi.getElementGroups(page.workspaceCode, page.id),
      loadAllElementsForPage(page.id),
    ])
    const groupMap = new Map(groupPage.items.map(item => [item.groupName, item]))
    let savedCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const candidate of adopted) {
      const groupName = candidate.source.groupName.trim() || 'AI 采集'
      if (isDuplicateCandidate(existing, page.id, groupName, candidate)) {
        skippedCount += 1
        continue
      }
      try {
        let group = groupMap.get(groupName)
        if (!group) {
          group = await webUiAutomationApi.createElementGroup(page.workspaceCode, {
            workspaceCode: page.workspaceCode,
            pageId: page.id,
            groupName,
            description: 'AI 采集创建',
            sortOrder: groupMap.size + 1,
            status: 'ENABLED',
          })
          groupMap.set(groupName, group)
        }
        const created = await webUiAutomationApi.createElement(page.workspaceCode, {
          workspaceCode: page.workspaceCode,
          pageId: page.id,
          groupId: group.id,
          pageName: page.pageName,
          groupName: group.groupName,
          elementName: candidate.source.elementName.trim(),
          locatorType: candidate.source.locatorType,
          locatorValue: candidate.source.locatorValue.trim(),
          framePath: candidate.source.framePath || [],
          shadowPath: candidate.source.shadowPath || [],
          description: buildCandidateDescription(candidate),
          status: 'ENABLED',
          collectSource: candidate.source.candidateSource || 'AI_COLLECT',
          collectConfidence: candidate.source.confidence,
          collectValidationStatus: candidate.source.validationStatus,
          collectMatchCount: candidate.source.matchCount,
          collectValidationMessage: candidate.source.validationMessage,
          collectScreenshotBase64: candidate.source.screenshotBase64,
        })
        existing.push(created)
        savedCount += 1
      } catch {
        failedCount += 1
      }
    }

    if (failedCount) {
      ElMessage.warning(`已入库 ${savedCount} 个，跳过重复 ${skippedCount} 个，失败 ${failedCount} 个`)
    } else if (skippedCount) {
      ElMessage.warning(`已入库 ${savedCount} 个，跳过重复 ${skippedCount} 个`)
    } else {
      ElMessage.success(`已入库 ${savedCount} 个元素`)
    }
    backToLibrary()
    await Promise.all([loadElements(), loadPages()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingCandidates.value = false
  }
}

function confidenceClass(confidence: number) {
  if (confidence >= 90) return 'is-high'
  if (confidence >= 80) return 'is-medium'
  return 'is-low'
}

</script>

<template>
  <section class="figma-elements">
    <WebUiModuleTabs v-if="state === 'list'" active="elements" />

    <div v-if="state === 'list'" class="figma-elements__list">
      <aside class="figma-elements__tree">
        <button v-if="canCreate" class="figma-elements__collect-entry" type="button" @click="openCapture"><Sparkles />AI 采集元素</button>
        <label class="figma-elements__tree-search"><Search /><input v-model="pageKeyword" placeholder="搜索页面" /></label>
        <nav>
          <button
            v-for="page in visiblePages"
            :key="page.id"
            type="button"
            :class="{ 'is-active': selectedPage === page.id }"
            @click="selectedPage = page.id"
          >
            <Monitor />
            <span>{{ page.label }}</span>
            <small>{{ pageCounts[page.id] }}</small>
          </button>
        </nav>
      </aside>

      <main class="figma-elements__table-panel">
        <div class="figma-elements__toolbar">
          <label class="figma-elements__search"><Search /><input v-model="keyword" placeholder="搜索元素名称或定位值" /></label>
          <select v-model="locatorFilter"><option value="">全部定位方式</option><option>id</option><option>css</option><option>xpath</option><option>text</option><option>role</option></select>
          <select v-model="verifyFilter"><option value="">全部验证状态</option><option value="pass">验证通过</option><option value="fail">验证失败</option><option value="unverified">未验证</option></select>
          <span class="figma-elements__fill" />
          <button v-if="canCreate" class="figma-elements__ghost" type="button" @click="showPendingDesign('手动添加元素')"><Plus />手动添加</button>
          <button v-if="canCreate" class="figma-elements__primary" type="button" @click="openCapture"><Sparkles />AI 采集</button>
        </div>
        <div ref="tableFrameRef" class="figma-elements__table-frame">
          <AppFigmaTable
            class="figma-elements__data-table"
            :data="rows"
            :loading="loading"
            :page-no="pageNo"
            :page-size="pageSize"
            :total="total"
            show-page-size
            show-jumper
            :header-height="36"
            :row-height="53"
            :footer-height="42"
            row-key="id"
            empty-text="暂无匹配的元素"
            @page-change="setPage"
            @page-size-change="setPageSize"
          >
            <el-table-column
              v-for="column in columnSettings.visibleColumns.value"
              :key="column.key"
              :label="column.label"
              :width="getColumnWidth(column)"
              :align="column.key === 'refCount' ? 'center' : 'left'"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="column.key === 'name'" class="figma-elements__name-cell">
                  <strong>{{ row.name }}</strong>
                  <small>{{ row.description }}</small>
                </span>
                <code v-else-if="column.key === 'locatorType'" class="figma-elements__locator-type">{{ row.locatorType }}</code>
                <span v-else-if="column.key === 'locatorValue'" class="figma-elements__locator-value">{{ row.locatorValue }}</span>
                <span v-else-if="column.key === 'refCount'" class="figma-elements__reference" :class="{ 'is-hot': row.refCount > 10 }">{{ row.refCount }}</span>
                <template v-else-if="column.key === 'verified'">
                  <span v-if="row.verified === 'pass'" class="figma-elements__verify is-pass">验证通过</span>
                  <span v-else-if="row.verified === 'fail'" class="figma-elements__verify is-fail">验证失败</span>
                  <span v-else class="figma-elements__unverified">未验证</span>
                </template>
                <span v-else>{{ row[column.key] }}</span>
              </template>
            </el-table-column>

            <AppFigmaActionColumn
              :action-count="operationActionCount"
              :width="operationWidth"
              :icon-size="16"
              :action-gap="12"
              :scroll-shadow="tableNeedsScroll"
            >
              <template #settings>
                <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="openColumnSettings" />
              </template>
              <template #default="{ row }">
                <button v-if="canExecute" type="button" title="验证" aria-label="验证" @click.stop="validateRow(row)"><CircleCheck /></button>
                <button type="button" title="查看" aria-label="查看" @click.stop="showPendingDesign('查看元素详情')"><Eye /></button>
                <button v-if="canEdit" type="button" title="编辑" aria-label="编辑" @click.stop="showPendingDesign('编辑元素')"><Pencil /></button>
                <button v-if="canDelete" type="button" data-danger="true" title="删除" aria-label="删除" @click.stop="deleteRow(row)"><Trash2 /></button>
              </template>
            </AppFigmaActionColumn>
          </AppFigmaTable>
        </div>
      </main>
    </div>

    <template v-else>
      <header class="figma-elements__capture-head">
        <button type="button" @click="backToLibrary"><ChevronLeft />返回元素库</button><i />
        <span><Sparkles /></span><h1>AI 元素采集</h1>
        <em v-if="state === 'result'">采集完成 · {{ candidates.length }} 个候选元素</em>
        <div class="figma-elements__fill" />
        <button v-if="state === 'result' && adoptedCount" class="figma-elements__confirm" type="button" @click="confirmCandidates"><Check />确认入库 ({{ adoptedCount }})</button>
      </header>
      <div class="figma-elements__capture">
        <aside class="figma-elements__capture-side">
          <section class="figma-elements__capture-url"><label>目标页面地址</label><input v-model="captureUrl" /><p>确保测试环境 / Runner 可访问该地址</p></section>
          <section class="figma-elements__capture-scope"><label>采集范围</label><label v-for="scope in ['全页可操作元素', '仅表单元素', '按钮与链接']" :key="scope" class="figma-elements__scope-option" :class="{ 'is-active': captureScope === scope }"><input v-model="captureScope" type="radio" :value="scope" /><span>{{ scope }}</span></label></section>
          <section class="figma-elements__advanced"><label>高级选项</label><div><span>包含 iframe 内元素</span><button class="figma-elements__iframe-toggle" :class="{ 'is-active': includeIframe }" type="button" :aria-pressed="includeIframe" @click="includeIframe = !includeIframe"><i /></button></div><div><span>等待动态渲染 (ms)</span><input v-model.number="waitForIdle" type="number" /></div><div><span>最大采集元素数</span><input v-model.number="maxElements" type="number" /></div></section>
          <button class="figma-elements__start" :disabled="state === 'scanning'" type="button" @click="startCapture"><Sparkles />{{ state === 'scanning' ? 'AI 采集中...' : '开始 AI 采集' }}</button>
          <section v-if="state !== 'config'" class="figma-elements__progress"><header><b>采集进度</b><small>{{ state === 'result' ? '已完成' : scanSteps[scanStep] }}</small></header><div v-for="(step, index) in scanSteps" :key="step" :class="{ 'is-done': state === 'result' || index < scanStep, 'is-current': state === 'scanning' && index === scanStep }"><span>{{ state === 'result' || index < scanStep ? '✓' : index + 1 }}</span>{{ step }}</div></section>
          <section v-if="state === 'result'" class="figma-elements__capture-stats"><div class="is-high"><strong>{{ highCount }}</strong><span>高置信度</span></div><div class="is-medium"><strong>{{ mediumCount }}</strong><span>中置信度</span></div><div class="is-low"><strong>{{ lowCount }}</strong><span>低置信度</span></div></section>
        </aside>
        <main v-if="state === 'config'" class="figma-elements__capture-empty"><span><Sparkles /></span><h2>配置目标地址后开始采集</h2><p>AI 将自动识别页面所有可操作元素，人工确认后一键入库</p></main>
        <main v-else-if="state === 'scanning'" class="figma-elements__capture-empty is-scanning"><span><Sparkles /></span><h2>AI 正在分析页面结构...</h2><p>{{ scanSteps[scanStep] }}</p></main>
        <main v-else class="figma-elements__result">
          <div class="figma-elements__result-filter"><div><button :class="{ 'is-active': candidateStatus === 'all' }" type="button" @click="candidateStatus = 'all'">全部 {{ candidates.length }}</button><button :class="{ 'is-active': candidateStatus === 'pending' }" type="button" @click="candidateStatus = 'pending'">待确认 {{ pendingCount }}</button><button :class="{ 'is-active': candidateStatus === 'adopted' }" type="button" @click="candidateStatus = 'adopted'">已采纳 {{ adoptedCount }}</button><button :class="{ 'is-active': candidateStatus === 'ignored' }" type="button" @click="candidateStatus = 'ignored'">已忽略 {{ ignoredCount }}</button></div><select v-model="candidateType"><option value="">全部类型</option><option v-for="item in candidateTypes" :key="item">{{ item }}</option></select><select v-model="candidateConfidence"><option value="">全部置信度</option><option value="high">高 (≥90%)</option><option value="medium">中 (80-89%)</option><option value="low">低 (&lt;80%)</option></select><span class="figma-elements__fill" /><p>共 <b>{{ filteredCandidates.length }}</b> 项</p><button type="button" @click="adoptAll">全部采纳</button></div>
          <div class="figma-elements__candidate-scroll"><section v-for="page in candidatePages" :key="page"><header><Monitor /><b>{{ page }}</b><em>{{ filteredCandidates.filter(item => item.page === page).length }} 个元素</em></header><article v-for="candidate in filteredCandidates.filter(item => item.page === page)" :key="candidate.id" :class="{ 'is-adopted': candidate.status === 'adopted', 'is-ignored': candidate.status === 'ignored' }"><div class="figma-elements__confidence-wrap"><div class="figma-elements__confidence" :class="confidenceClass(candidate.confidence)"><b>{{ candidate.confidence }}%</b></div><small>置信度</small></div><div><h3>{{ candidate.name }} <em>{{ candidate.type }}</em><i v-if="candidate.status === 'adopted'">已采纳</i></h3><p>{{ candidate.purpose }}</p><code>{{ candidate.locatorType }}</code><span>{{ candidate.locatorValue }}</span></div><aside v-if="candidate.status === 'pending'"><button class="is-adopt" type="button" @click="setCandidateStatus(candidate.id, 'adopted')">采纳</button><button type="button" @click="showPendingDesign('编辑 AI 候选元素')">编辑</button><button class="is-text" type="button" @click="setCandidateStatus(candidate.id, 'ignored')">忽略</button></aside><aside v-else-if="candidate.status === 'adopted'"><strong><CircleCheck />已采纳</strong><button class="is-text" type="button" @click="setCandidateStatus(candidate.id, 'pending')">撤销</button></aside><aside v-else><button class="is-text" type="button" @click="setCandidateStatus(candidate.id, 'pending')">恢复</button></aside></article></section></div>
        </main>
      </div>
    </template>

    <AppTableColumnSettingsDrawer
      :model-value="columnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="columnSettings.drawerColumns.value"
      :dragging-key="columnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) columnSettings.cancel() }"
      @toggle-column="columnSettings.toggleColumn"
      @drag-start="columnSettings.dragStart"
      @drag-end="columnSettings.dragEnd"
      @drop-column="columnSettings.dropColumn"
      @reset="columnSettings.resetDraft"
    />
  </section>
</template>

<style scoped>
.figma-elements { display:flex; flex:1; min-width:0; min-height:0; flex-direction:column; overflow:hidden; background:#f7f8fc; color:#1d2129; font-family:Inter,"Noto Sans SC",sans-serif; }
.figma-elements button { font:inherit; cursor:pointer; }
.figma-elements__list { display:flex; min-width:0; min-height:0; flex:1; overflow:hidden; }
.figma-elements__tree { display:flex; width:290px; flex:0 0 290px; flex-direction:column; border-right:1px solid #e5e6eb; background:#fff; }
.figma-elements__collect-entry { display:flex; align-items:center; gap:6px; align-self:flex-start; height:36px; margin:14px 12px 10px; padding:0 12px; border:0; border-radius:7px; background:#14c9c1; color:#fff; font-size:13px; font-weight:600; }
.figma-elements__collect-entry svg { width:14px; height:14px; }
.figma-elements__tree-search, .figma-elements__search { display:flex; align-items:center; gap:8px; height:36px; box-sizing:border-box; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#86909c; }
.figma-elements__tree-search { margin:0 12px 10px; padding:0 10px; }
.figma-elements__tree-search svg, .figma-elements__search svg { width:14px; flex:0 0 auto; }
.figma-elements__tree-search input, .figma-elements__search input { width:100%; min-width:0; border:0; outline:0; color:#4e5969; font-size:12px; }
.figma-elements__tree nav { display:grid; gap:2px; padding:2px 8px; }
.figma-elements__tree nav button { display:flex; height:36px; align-items:center; gap:8px; padding:0 10px; border:0; border-radius:7px; background:transparent; color:#4e5969; font-size:12px; text-align:left; }
.figma-elements__tree nav button svg { width:13px; color:#c9cdd4; }
.figma-elements__tree nav button span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.figma-elements__tree nav button small { margin-left:auto; color:#c9cdd4; font-size:11px; }
.figma-elements__tree nav button.is-active { background:#e8fffb; color:#14c9c1; font-weight:600; }
.figma-elements__tree nav button.is-active svg { color:#14c9c1; }
.figma-elements__table-panel { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.figma-elements__toolbar { display:flex; flex:0 0 66px; align-items:center; gap:10px; padding:0 24px; border-bottom:1px solid #e5e6eb; background:#fafafa; }
.figma-elements__search { width:290px; padding:0 11px; }
.figma-elements__toolbar select, .figma-elements__result-filter select { height:36px; min-width:120px; padding:0 30px 0 11px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#86909c; font-size:12px; outline:0; }
.figma-elements__fill { flex:1; }
.figma-elements__ghost, .figma-elements__primary { display:inline-flex; height:36px; align-items:center; gap:6px; padding:0 13px; border-radius:7px; font-size:13px; font-weight:600; }
.figma-elements__ghost { border:1px solid #e5e6eb; background:#fff; color:#4e5969; }.figma-elements__primary { border:1px solid #14c9c1; background:#14c9c1; color:#fff; }.figma-elements__ghost svg, .figma-elements__primary svg { width:14px; }
.figma-elements__table-frame { min-width:0; margin:14px 18px; }
.figma-elements__data-table { --app-figma-table-border:1px solid #e5e6eb; --app-figma-table-radius:11px; --app-figma-table-background:#fff; --app-figma-table-shadow:0 2px 5px rgb(29 33 41 / 4%); --app-figma-table-header-background:#fafafa; --app-figma-table-header-color:#86909c; --app-figma-table-header-font-size:11px; --app-figma-table-header-font-weight:600; --app-figma-table-header-letter-spacing:0; --app-figma-table-header-line-height:16.5px; --app-figma-table-text-color:#86909c; --app-figma-table-font-size:13px; --app-figma-table-line-height:19.5px; --app-figma-table-cell-padding:14px; --app-figma-table-row-hover-background:#fafcff; font-family:Inter,"Noto Sans SC",sans-serif; }
.figma-elements__data-table :deep(.el-table__fixed-right-patch) { background:#fafafa; }
.figma-elements__name-cell { display:block; min-width:0; overflow:hidden; }
.figma-elements__name-cell strong { display:block; overflow:hidden; color:#1d2129; font-size:13px; font-weight:600; line-height:19.5px; text-overflow:ellipsis; white-space:nowrap; }
.figma-elements__name-cell small { display:block; overflow:hidden; margin-top:1px; color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; text-overflow:ellipsis; white-space:nowrap; }
.figma-elements__locator-type, .figma-elements__candidate-scroll code { padding:3px 6px; border-radius:4px; background:#eef0fa; color:#4e5ac8; font-family:"JetBrains Mono",monospace; font-size:10px; font-weight:600; }
.figma-elements__locator-value { display:block; overflow:hidden; color:#86909c; font-family:"JetBrains Mono",monospace; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.figma-elements__reference { display:block; text-align:center; }
.figma-elements__reference.is-hot { color:#0fc6c2; font-size:13px; font-weight:600; }
.figma-elements__verify { display:inline-flex; align-items:center; gap:5px; font-size:12px; }.figma-elements__verify::before { width:6px; height:6px; border-radius:50%; background:currentColor; content:""; }.figma-elements__verify.is-pass { color:#00b42a; }.figma-elements__verify.is-fail { color:#f53f3f; }.figma-elements__unverified { color:#c9cdd4; }
.figma-elements__data-table :deep(.app-figma-action-column__actions button) { color:#c9cdd4; }
.figma-elements__capture-head { display:flex; flex:0 0 48px; align-items:center; gap:12px; padding:0 20px; border-bottom:1px solid #e5e6eb; background:#fff; }.figma-elements__capture-head > button:first-child { display:flex; align-items:center; gap:5px; padding:0; border:0; background:transparent; color:#4e5969; font-size:13px; font-weight:600; }.figma-elements__capture-head i { width:1px; height:16px; background:#e5e6eb; }.figma-elements__capture-head > span { display:grid; width:28px; height:28px; place-items:center; border-radius:6px; background:#e8fffb; color:#14c9c1; }.figma-elements__capture-head > span svg { width:14px; }.figma-elements__capture-head h1 { margin:0; font-size:15px; font-weight:600; }.figma-elements__capture-head em { padding:4px 10px; border-radius:999px; background:#e8fffb; color:#14c9c1; font-size:11px; font-style:normal; font-weight:600; }.figma-elements__confirm { display:flex; height:32px; align-items:center; gap:5px; padding:0 15px; border:0; border-radius:8px; background:linear-gradient(135deg,#14c9c1,#2166f3); color:#fff; font-size:12px; font-weight:600; }.figma-elements__confirm svg { width:13px; }
.figma-elements__capture { display:flex; min-width:0; min-height:0; flex:1; overflow:hidden; }.figma-elements__capture-side { width:320px; flex:0 0 320px; padding:16px; border-right:1px solid #e5e6eb; background:#fff; overflow:auto; }.figma-elements__capture-side section { display:grid; gap:8px; margin-bottom:18px; }.figma-elements__capture-side label { color:#4e5969; font-size:12px; font-weight:600; }.figma-elements__capture-side section > input { box-sizing:border-box; width:100%; height:34px; padding:0 10px; border:1px solid #e5e6eb; border-radius:7px; color:#4e5969; font-family:"JetBrains Mono",monospace; font-size:12px; }.figma-elements__capture-side p { margin:0; color:#86909c; font-size:11px; }.figma-elements__capture-side section > button { display:flex; height:34px; align-items:center; gap:10px; padding:0 12px; border:0; border-radius:7px; background:transparent; color:#4e5969; font-size:12px; text-align:left; }.figma-elements__capture-side section > button span { width:11px; height:11px; box-sizing:border-box; border:1px solid #86909c; border-radius:50%; }.figma-elements__capture-side section > button.is-active { background:#e8fffb; color:#14c9c1; }.figma-elements__capture-side section > button.is-active span { border:3px solid #14c9c1; }.figma-elements__advanced { padding-top:16px; border-top:1px solid #e5e6eb; }.figma-elements__advanced div { display:flex; min-height:40px; align-items:center; justify-content:space-between; border-bottom:1px solid #f2f3f5; color:#4e5969; font-size:12px; }.figma-elements__advanced input[type="number"] { width:74px; height:25px; box-sizing:border-box; border:1px solid #e5e6eb; border-radius:4px; text-align:right; }.figma-elements__advanced input[type="checkbox"] { accent-color:#14c9c1; }.figma-elements__start { display:flex; width:100%; height:40px; align-items:center; justify-content:center; gap:8px; border:0; border-radius:9px; background:linear-gradient(135deg,#14c9c1,#2166f3); color:#fff; font-size:13px; font-weight:600; }.figma-elements__start:disabled { background:#c9cdd4; }.figma-elements__start svg { width:15px; }.figma-elements__progress { padding:14px; border:1px solid #e5e6eb; border-radius:10px; background:#fafbfe; }.figma-elements__progress header { display:flex; justify-content:space-between; color:#4e5969; font-size:12px; }.figma-elements__progress header small { color:#86909c; }.figma-elements__progress > div { display:flex; align-items:center; gap:10px; margin-top:10px; color:#c9cdd4; font-size:12px; }.figma-elements__progress > div span { display:grid; width:20px; height:20px; place-items:center; border-radius:50%; background:#f2f3f5; font-size:10px; }.figma-elements__progress > div.is-done, .figma-elements__progress > div.is-current { color:#1d2129; }.figma-elements__progress > div.is-done span { background:#14c9c1; color:#fff; }.figma-elements__progress > div.is-current span { background:#fff3e8; color:#ff7d00; }.figma-elements__capture-stats { grid-template-columns:repeat(3,1fr); gap:8px; }.figma-elements__capture-stats div { display:grid; gap:3px; padding:10px 3px; border-radius:8px; text-align:center; }.figma-elements__capture-stats strong { font-size:19px; }.figma-elements__capture-stats span { font-size:10px; }.figma-elements__capture-stats .is-high { background:#e8ffea; color:#00b42a; }.figma-elements__capture-stats .is-medium { background:#fff3e8; color:#ff7d00; }.figma-elements__capture-stats .is-low { background:#fff1f0; color:#f53f3f; }
.figma-elements__capture-empty { display:flex; min-width:0; flex:1; align-items:center; justify-content:center; flex-direction:column; background:#f7f8fc; }.figma-elements__capture-empty > span { display:grid; width:64px; height:64px; place-items:center; border-radius:12px; background:#f0fffe; color:#c9cdd4; }.figma-elements__capture-empty > span svg { width:32px; }.figma-elements__capture-empty h2 { margin:14px 0 6px; color:#4e5969; font-size:15px; }.figma-elements__capture-empty p { margin:0; color:#86909c; font-size:13px; }.figma-elements__capture-empty.is-scanning > span { width:80px; height:80px; border-radius:18px; background:linear-gradient(135deg,#14c9c1,#2166f3); color:#fff; animation:figma-pulse 1.4s ease-in-out infinite; }.figma-elements__capture-empty.is-scanning > span svg { width:36px; }
.figma-elements__result { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; }.figma-elements__result-filter { display:flex; flex:0 0 58px; align-items:center; gap:10px; padding:0 20px; border-bottom:1px solid #e5e6eb; background:#fff; }.figma-elements__result-filter > div { display:flex; overflow:hidden; border:1px solid #e5e6eb; border-radius:7px; }.figma-elements__result-filter > div button { height:30px; padding:0 10px; border:0; border-right:1px solid #e5e6eb; background:#fff; color:#4e5969; font-size:12px; }.figma-elements__result-filter > div button:last-child { border-right:0; }.figma-elements__result-filter > div button.is-active { background:#e8fffb; color:#14c9c1; }.figma-elements__result-filter p { color:#86909c; font-size:12px; }.figma-elements__result-filter p b { color:#1d2129; }.figma-elements__result-filter > button { height:30px; padding:0 14px; border:0; border-radius:7px; background:#e8fffb; color:#14c9c1; font-size:12px; font-weight:600; }.figma-elements__candidate-scroll { min-height:0; flex:1; padding:20px 24px; overflow:auto; }.figma-elements__candidate-scroll > section { max-width:1160px; margin:0 auto 24px; }.figma-elements__candidate-scroll > section > header { display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#1d2129; font-size:13px; }.figma-elements__candidate-scroll > section > header svg { width:14px; color:#14c9c1; }.figma-elements__candidate-scroll > section > header em { padding:2px 8px; border-radius:999px; background:#e8fffb; color:#14c9c1; font-size:10px; font-style:normal; }.figma-elements__candidate-scroll article { display:flex; align-items:flex-start; gap:16px; margin-bottom:10px; padding:16px 18px; border:1px solid #e5e6eb; border-radius:12px; background:#fff; }.figma-elements__candidate-scroll article.is-adopted { border-color:#14c9c1; }.figma-elements__candidate-scroll article.is-ignored { opacity:.45; }.figma-elements__confidence { display:grid; width:48px; height:48px; flex:0 0 48px; align-content:center; place-items:center; border:3px solid currentColor; border-radius:50%; color:#f53f3f; }.figma-elements__confidence.is-high { color:#00b42a; }.figma-elements__confidence.is-medium { color:#ff7d00; }.figma-elements__confidence b { font-size:12px; }.figma-elements__confidence small { margin-top:2px; color:#86909c; font-size:9px; }.figma-elements__candidate-scroll article > div:nth-child(2) { min-width:0; flex:1; }.figma-elements__candidate-scroll h3 { display:flex; align-items:center; gap:8px; margin:0; font-size:14px; }.figma-elements__candidate-scroll h3 em, .figma-elements__candidate-scroll h3 i { padding:2px 6px; border-radius:4px; background:#f2f3f5; color:#4e5969; font-size:10px; font-style:normal; font-weight:500; }.figma-elements__candidate-scroll h3 i { background:#e8fffb; color:#14c9c1; }.figma-elements__candidate-scroll article p { margin:7px 0 10px; color:#86909c; font-size:12px; }.figma-elements__candidate-scroll article code { margin-right:8px; }.figma-elements__candidate-scroll article > div:nth-child(2) > span { color:#4e5969; font-family:"JetBrains Mono",monospace; font-size:12px; }.figma-elements__candidate-scroll article > aside { display:flex; width:62px; flex:0 0 62px; align-items:flex-end; flex-direction:column; gap:6px; }.figma-elements__candidate-scroll article > aside button { height:27px; padding:0 10px; border:1px solid #e5e6eb; border-radius:6px; background:#fff; color:#4e5969; font-size:11px; }.figma-elements__candidate-scroll article > aside .is-adopt { border-color:#14c9c1; background:#14c9c1; color:#fff; }.figma-elements__candidate-scroll article > aside .is-text { height:20px; padding:0; border:0; background:transparent; color:#86909c; }.figma-elements__candidate-scroll article > aside strong { display:flex; align-items:center; gap:4px; color:#14c9c1; font-size:12px; }.figma-elements__candidate-scroll article > aside strong svg { width:13px; }
@keyframes figma-pulse { 50% { transform:scale(.94); opacity:.82; } }
.figma-elements__candidate-scroll > section { max-width:none; margin:0 0 24px; }
.figma-elements__result-filter > div button { min-width:68px; font-weight:500; }
.figma-elements__candidate-scroll article { min-height:122px; box-sizing:border-box; }
.figma-elements__candidate-scroll h3 { font-weight:600; }
.figma-elements__capture-head > span,
.figma-elements__capture-head em,
.figma-elements__capture-side section > button.is-active,
.figma-elements__result-filter > div button.is-active,
.figma-elements__result-filter > button,
.figma-elements__candidate-scroll > section > header svg,
.figma-elements__candidate-scroll > section > header em,
.figma-elements__candidate-scroll h3 i,
.figma-elements__candidate-scroll article > aside strong { color:#0fc6c2; }
.figma-elements__capture-side section > button.is-active span { border-color:#0fc6c2; }
.figma-elements__progress > div.is-done span { background:#0fc6c2; }
.figma-elements__confirm,
.figma-elements__start { background:linear-gradient(135deg,#0fc6c2,#165dff); }
.figma-elements__capture-side { width:300px; flex-basis:300px; }
.figma-elements__capture-head h1 { color:#1d2129; line-height:20px; }
.figma-elements__iframe-toggle { position:relative; width:32px; height:16px; padding:0; border:0; border-radius:999px; background:#c9cdd4; transition:background-color .2s ease; }
.figma-elements__iframe-toggle i { position:absolute; top:2px; left:2px; display:block; width:12px; height:12px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgb(29 33 41 / 16%); transition:left .2s ease; }
.figma-elements__iframe-toggle.is-active { background:#165dff; }
.figma-elements__iframe-toggle.is-active i { left:18px; }
.figma-elements__candidate-scroll article { min-height:0; padding:16px 20px; border-radius:16px; }
.figma-elements__confidence-wrap { display:flex; flex:0 0 48px; flex-direction:column; align-items:center; padding-top:2px; }
.figma-elements__confidence { flex:0 0 48px; align-content:normal; place-items:center; }
.figma-elements__confidence small { display:none; }
.figma-elements__confidence-wrap > small { margin-top:4px; color:#c9cdd4; font-size:9px; line-height:12px; }
.figma-elements__candidate-scroll h3 { min-height:20px; align-items:center; color:#1d2129; font-size:14px; font-weight:600; line-height:20px; }
.figma-elements__candidate-scroll article p { margin:6px 0 10px; color:#86909c; font-size:12px; line-height:18px; }
.figma-elements__capture-side section > input,
.figma-elements__candidate-scroll code,
.figma-elements__candidate-scroll article > div:nth-child(2) > span { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }
.figma-elements__candidate-scroll code { font-weight:700; }
.figma-elements__candidate-scroll article > div:nth-child(2) > span { color:#4e5969; font-size:12px; line-height:18px; }
.figma-elements__candidate-scroll article.is-adopted { border-color:#0fc6c2; }
.figma-elements__candidate-scroll article > aside .is-adopt { border-color:#0fc6c2; background:#0fc6c2; }
.figma-elements__capture-side { padding:12px 16px; }
.figma-elements__capture-side section { display:block; margin:0; }
.figma-elements__capture-side label { display:block; line-height:18px; }
.figma-elements__capture-url { display:grid !important; gap:4px; margin-bottom:18px !important; }
.figma-elements__capture-side .figma-elements__capture-url > input { height:32px; }
.figma-elements__capture-url > p { line-height:16px; }
.figma-elements__capture-scope { display:grid !important; gap:4px; margin-bottom:12px !important; }
.figma-elements__capture-scope > label { margin-bottom:0; }
.figma-elements__capture-side .figma-elements__capture-scope > button { height:32px; padding:0 12px; }
.figma-elements__advanced { display:block; margin-bottom:14px !important; padding-top:16px; }
.figma-elements__advanced > label { margin-bottom:8px; }
.figma-elements__advanced div { min-height:38px; }
.figma-elements__start { height:34px; border-radius:8px; }
.figma-elements__progress { display:block !important; margin-top:14px !important; }
.figma-elements__capture-stats { display:grid !important; margin-top:14px !important; }

/* Design nodes 1:6727, 153:8924 and 153:9156 share this Web UI shell. */
.figma-elements { font-family:Inter,"Noto Sans SC",sans-serif; }
.figma-elements__tree { width:220px; flex-basis:220px; }
.figma-elements__collect-entry { height:28px; margin:10px 10px 7px; padding:0 10px; border-radius:7px; background:#0fc6c2; font-size:12px; font-weight:500; line-height:18px; }
.figma-elements__collect-entry svg { width:13px; height:13px; }
.figma-elements__tree-search { height:26px; margin:0 10px 7px; padding:0 9px; border-radius:7px; }
.figma-elements__tree-search input { font-size:11px; line-height:16.5px; }
.figma-elements__tree nav { gap:2px; padding:2px 6px; }
.figma-elements__tree nav button { height:32px; gap:7px; padding:0 8px; border-radius:7px; font-size:12px; font-weight:400; line-height:18px; }
.figma-elements__tree nav button.is-active { background:#e8fffb; color:#0fc6c2; font-weight:500; }
.figma-elements__tree nav button.is-active svg { color:#0fc6c2; }
.figma-elements__toolbar { flex-basis:48px; gap:7px; padding:0 18px; }
.figma-elements__search { width:220px; height:28px; padding:0 10px; }
.figma-elements__search input { font-size:13px; line-height:19.5px; }
.figma-elements__toolbar select { height:28px; min-width:120px; padding:0 24px 0 10px; font-size:12px; }
.figma-elements__ghost, .figma-elements__primary { height:28px; gap:5px; padding:0 11px; border-radius:7px; font-size:13px; font-weight:500; line-height:19.5px; }
.figma-elements__primary { border-color:#0fc6c2; background:#0fc6c2; }
.figma-elements__capture-head { flex-basis:44px; gap:12px; padding:0 18px; }
.figma-elements__capture-head > button:first-child { font-size:13px; font-weight:500; line-height:19.5px; }
.figma-elements__capture-head h1 { font-size:15px; font-weight:600; line-height:22.5px; }
.figma-elements__capture-side label { font-size:12px; font-weight:600; line-height:18px; }
.figma-elements__capture-side p { font-size:11px; font-weight:400; line-height:16.5px; }
.figma-elements__capture-side section > input,
.figma-elements__candidate-scroll code,
.figma-elements__candidate-scroll article > div:nth-child(2) > span { font-family:"JetBrains Mono",monospace; }
.figma-elements__scope-option { display:flex !important; height:32px; align-items:center; gap:10px; padding:0 12px; border-radius:8px; color:#4e5969; font-size:12px !important; font-weight:500 !important; line-height:18px !important; cursor:pointer; }
.figma-elements__scope-option.is-active { background:#e8fffb; color:#0fc6c2; }
.figma-elements__scope-option input { width:12px; height:12px; margin:0; accent-color:#0fc6c2; flex:0 0 auto; }
.figma-elements__scope-option span { line-height:18px; }
@media (max-width:1100px) { .figma-elements__table-frame { margin:14px; }.figma-elements__toolbar { padding:0 14px; }.figma-elements__toolbar select:last-of-type { display:none; }.figma-elements__tree { width:250px; flex-basis:250px; }.figma-elements__capture-side { width:260px; flex-basis:260px; }.figma-elements__result-filter { padding:0 12px; }.figma-elements__result-filter select { display:none; } }
</style>
