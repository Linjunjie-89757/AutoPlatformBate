<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { defectApi, type DefectClientFilter, type DefectStatistics } from '@/entities/defect'
import { hasWorkspacePermission, useSession } from '@/entities/session'
import {
  useWorkspaceContext,
  workspaceApi,
  type WorkspaceItem,
  type WorkspaceMemberItem,
} from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { DefectFilterPanel } from '@/widgets/defect-filter-panel'
import { DefectListPanel } from '@/widgets/defect-list-panel'
import { DefectSummaryPanel } from '@/widgets/defect-summary-panel'

const route = useRoute()
const router = useRouter()
const { currentUser } = useSession()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceMembers = ref<WorkspaceMemberItem[]>([])
const workspaceLoading = ref(false)
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')
const statistics = ref<DefectStatistics | null>(null)
const filter = ref<DefectClientFilter>({
  keyword: '',
  status: '',
  priority: '',
  severity: '',
  assigneeId: '',
  workspaceCode: '',
})
const listPanelRef = ref<InstanceType<typeof DefectListPanel> | null>(null)
const activeView = ref<'list' | 'stats'>('list')
const statusDonutProgress = ref(1)
const selectedDefectCount = ref(0)
const canCreateDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.create'))
const canEditDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.edit'))
const canDeleteDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.delete'))
const canReviewDefects = computed(() => hasWorkspacePermission(currentUser.value, workspaceCode.value, 'bugs.review'))

const STATUS_DONUT_CX = 200
const STATUS_DONUT_CY = 86
const STATUS_DONUT_INNER_RADIUS = 55
const STATUS_DONUT_OUTER_RADIUS = 85
const STATUS_DONUT_START_ANGLE = 0
const STATUS_DONUT_END_ANGLE = 360
const STATUS_DONUT_PADDING_ANGLE = 3
const STATUS_DONUT_ANIMATION_BEGIN = 400
const STATUS_DONUT_ANIMATION_DURATION = 1500

type StatusDistributionItem = {
  name: string
  value: number
  color: string
  className: string
}

const statusDistributionItems: StatusDistributionItem[] = [
  { name: '已关闭', value: 28, color: '#00B42A', className: 'is-closed' },
  { name: '处理中', value: 15, color: '#FF7D00', className: 'is-processing' },
  { name: '新建', value: 12, color: '#165DFF', className: 'is-new' },
  { name: '待验证', value: 9, color: '#FAAD14', className: 'is-verify' },
  { name: '已指派', value: 8, color: '#7816FF', className: 'is-assigned' },
  { name: '已驳回', value: 4, color: '#F53F3F', className: 'is-rejected' },
]

const moduleDistributionItems = [
  { name: '订单中心', count: 24 },
  { name: '用户中心', count: 18 },
  { name: '获客中心', count: 15 },
  { name: '风控中心', count: 11 },
  { name: '接口自动化', count: 8 },
  { name: '报告', count: 6 },
]

const trendDistributionItems = [
  { day: '6/5', newCount: 8, closedCount: 5 },
  { day: '6/10', newCount: 12, closedCount: 9 },
  { day: '6/15', newCount: 6, closedCount: 11 },
  { day: '6/20', newCount: 15, closedCount: 8 },
  { day: '6/25', newCount: 9, closedCount: 13 },
  { day: '6/30', newCount: 11, closedCount: 7 },
  { day: '7/5', newCount: 8, closedCount: 11 },
]

type ChartTooltip = {
  chart: 'status' | 'module' | 'trend'
  x: number
  y: number
  title?: string
  items: Array<{
    label: string
    value: string | number
    color: string
  }>
}

let statusDonutFrame = 0
let statusDonutTimer: number | undefined
const chartTooltip = ref<ChartTooltip | null>(null)
const trendHoverIndex = ref<number | null>(null)
const moduleHoverName = ref<string | null>(null)

const MODULE_BAR_LEFT = 119
const MODULE_BAR_WIDTH = 451
const MODULE_BAR_TOP = 1
const MODULE_BAR_STEP = 29
const MODULE_BAR_HEIGHT = 23
const TOOLTIP_OFFSET = 10
const TREND_PLOT_LEFT = 40
const TREND_PLOT_TOP = 5
const TREND_PLOT_WIDTH = 550
const TREND_PLOT_HEIGHT = 135
const TREND_PLOT_MAX_VALUE = 16

const highPriorityCount = computed(() => {
  const source = statistics.value as (DefectStatistics & {
    highPriority?: number
    highPriorityCount?: number
  }) | null
  return source?.highPriority ?? source?.highPriorityCount ?? 0
})

const statsCards = computed(() => [
  {
    label: '缺陷总数',
    value: statistics.value?.total ?? 76,
    note: '本月新增 23 条',
    tone: 'total',
    icon: figmaDefectIcons.stats.icon.total,
  },
  {
    label: '待处理',
    value: statistics.value
      ? (statistics.value.todo ?? 0) + (statistics.value.assigned ?? 0)
      : 28,
    note: '新建 + 已指派',
    tone: 'todo',
    icon: figmaDefectIcons.stats.icon.todo,
  },
  {
    label: '高优先级',
    value: statistics.value ? highPriorityCount.value : 15,
    note: 'P0 + P1 缺陷',
    tone: 'high',
    icon: figmaDefectIcons.stats.icon.high,
  },
  {
    label: '待验证',
    value: statistics.value?.pendingVerify ?? 9,
    note: '开发已修复',
    tone: 'verify',
    icon: figmaDefectIcons.stats.icon.verify,
  },
])

const workspaceOptions = computed(() => {
  const options = workspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some((item) => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

const assigneeOptions = computed(() => workspaceMembers.value.map((item) => ({
  label: item.displayName || item.username || `用户 ${item.userId}`,
  value: String(item.userId),
})))

const workspaceFilterOptions = computed(() => workspaces.value
  .filter((item) => item.workspaceCode !== 'ALL')
  .map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  })))

const showWorkspaceFilter = computed(() => workspaceCode.value === 'ALL')
const businessWorkspaces = computed(() => workspaces.value.filter((item) => (
  item.workspaceCode
  && item.workspaceCode !== 'ALL'
  && !item.allScope
)))

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  if (routeWorkspace && (routeWorkspace === 'ALL' || items.some(item => item.workspaceCode === routeWorkspace))) {
    return routeWorkspace
  }

  if (
    selectedWorkspaceCode.value
    && (selectedWorkspaceCode.value === 'ALL' || items.some(item => item.workspaceCode === selectedWorkspaceCode.value))
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceReady.value = false
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    workspaceSelectorCode.value = workspaceCode.value
    setSelectedWorkspaceCode(workspaceCode.value)
  } catch (error) {
    workspaceCode.value = 'ALL'
    workspaceSelectorCode.value = 'ALL'
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
    workspaceReady.value = true
  }
}

async function loadStatistics() {
  try {
    statistics.value = await defectApi.getDefectStatistics(workspaceCode.value)
  } catch {
    statistics.value = null
  }
}

async function loadWorkspaceMembers() {
  if (!workspaceCode.value) {
    workspaceMembers.value = []
    filter.value = {
      ...filter.value,
      assigneeId: '',
    }
    return
  }

  try {
    if (workspaceCode.value === 'ALL') {
      const memberGroups = await Promise.allSettled(
        businessWorkspaces.value.map((workspace) => workspaceApi.getWorkspaceMembers(workspace.workspaceCode)),
      )
      const memberMap = new Map<number, WorkspaceMemberItem>()
      memberGroups.forEach((group) => {
        if (group.status !== 'fulfilled') {
          return
        }
        group.value.forEach((member) => {
          if (!memberMap.has(member.userId)) {
            memberMap.set(member.userId, member)
          }
        })
      })
      workspaceMembers.value = Array.from(memberMap.values())
      return
    }

    workspaceMembers.value = await workspaceApi.getWorkspaceMembers(workspaceCode.value)
  } catch {
    workspaceMembers.value = []
  }
}

async function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
  workspaceSelectorCode.value = value
  setSelectedWorkspaceCode(value)
  filter.value = {
    ...filter.value,
    assigneeId: '',
  }
  if (route.query.workspace !== value) {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        workspace: value,
      },
      hash: route.hash,
    })
  }
  void loadWorkspaceMembers()
  void loadStatistics()
}

function handleCreateDefect() {
  if (!canCreateDefects.value) return
  listPanelRef.value?.openCreateDialog()
}

function handleDefectSelectionChange(count: number) {
  selectedDefectCount.value = count
}

function handleBatchAssignDefects() {
  if (!canEditDefects.value) return
  listPanelRef.value?.batchAssignSelectedDefects()
}

function handleBatchCloseDefects() {
  if (!canReviewDefects.value) return
  listPanelRef.value?.batchCloseSelectedDefects()
}

function handleBatchDeleteDefects() {
  if (!canDeleteDefects.value) return
  void listPanelRef.value?.deleteSelectedDefects()
}

function handleStatSelect(status: string) {
  filter.value = {
    ...filter.value,
    status,
  }
}

function resetFilters() {
  filter.value = {
    keyword: '',
    status: '',
    priority: '',
    severity: '',
    assigneeId: '',
    workspaceCode: '',
  }
}

function clampProgress(value: number) {
  return Math.min(Math.max(value, 0), 1)
}

function easeLikeRecharts(value: number) {
  const x1 = 0.25
  const y1 = 0.1
  const x2 = 0.25
  const y2 = 1
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  let t = clampProgress(value)

  for (let index = 0; index < 5; index += 1) {
    const x = ((ax * t + bx) * t + cx) * t - value
    const slope = (3 * ax * t + 2 * bx) * t + cx
    if (Math.abs(x) < 0.00001 || Math.abs(slope) < 0.00001) {
      break
    }
    t = clampProgress(t - x / slope)
  }

  return ((ay * t + by) * t + cy) * t
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radian = Math.PI / 180
  return {
    x: cx + Math.cos(-radian * angle) * radius,
    y: cy + Math.sin(-radian * angle) * radius,
  }
}

function formatSvgNumber(value: number) {
  return Number(value.toFixed(3))
}

function getStatusDonutSectorPath(startAngle: number, endAngle: number) {
  const sign = Math.sign(endAngle - startAngle)
  const angle = sign * Math.min(Math.abs(endAngle - startAngle), 359.999)
  if (!sign || Math.abs(angle) < 0.001) {
    return ''
  }

  const tempEndAngle = startAngle + angle
  const outerStart = polarToCartesian(STATUS_DONUT_CX, STATUS_DONUT_CY, STATUS_DONUT_OUTER_RADIUS, startAngle)
  const outerEnd = polarToCartesian(STATUS_DONUT_CX, STATUS_DONUT_CY, STATUS_DONUT_OUTER_RADIUS, tempEndAngle)
  const innerStart = polarToCartesian(STATUS_DONUT_CX, STATUS_DONUT_CY, STATUS_DONUT_INNER_RADIUS, startAngle)
  const innerEnd = polarToCartesian(STATUS_DONUT_CX, STATUS_DONUT_CY, STATUS_DONUT_INNER_RADIUS, tempEndAngle)
  const largeArc = Number(Math.abs(angle) > 180)
  const outerSweep = Number(startAngle > tempEndAngle)
  const innerSweep = Number(startAngle <= tempEndAngle)

  return [
    `M ${formatSvgNumber(outerStart.x)},${formatSvgNumber(outerStart.y)}`,
    `A ${STATUS_DONUT_OUTER_RADIUS},${STATUS_DONUT_OUTER_RADIUS},0,${largeArc},${outerSweep},${formatSvgNumber(outerEnd.x)},${formatSvgNumber(outerEnd.y)}`,
    `L ${formatSvgNumber(innerEnd.x)},${formatSvgNumber(innerEnd.y)}`,
    `A ${STATUS_DONUT_INNER_RADIUS},${STATUS_DONUT_INNER_RADIUS},0,${largeArc},${innerSweep},${formatSvgNumber(innerStart.x)},${formatSvgNumber(innerStart.y)} Z`,
  ].join(' ')
}

const statusDonutSectors = computed(() => {
  const total = statusDistributionItems.reduce((sum, item) => sum + item.value, 0)
  const nonZeroItemCount = statusDistributionItems.filter(item => item.value !== 0).length
  const deltaAngle = Math.sign(STATUS_DONUT_END_ANGLE - STATUS_DONUT_START_ANGLE)
    * Math.min(Math.abs(STATUS_DONUT_END_ANGLE - STATUS_DONUT_START_ANGLE), 360)
  const totalPaddingAngle = (Math.abs(deltaAngle) >= 360 ? nonZeroItemCount : nonZeroItemCount - 1)
    * STATUS_DONUT_PADDING_ANGLE
  const realTotalAngle = Math.abs(deltaAngle) - totalPaddingAngle
  let previousEndAngle = STATUS_DONUT_START_ANGLE
  const finalSectors = statusDistributionItems.map((item, index) => {
    const percent = total > 0 ? item.value / total : 0
    const startAngle = index
      ? previousEndAngle + Math.sign(deltaAngle) * STATUS_DONUT_PADDING_ANGLE * (item.value !== 0 ? 1 : 0)
      : STATUS_DONUT_START_ANGLE
    const endAngle = startAngle + Math.sign(deltaAngle) * percent * realTotalAngle
    const midAngle = (startAngle + endAngle) / 2
    const middleRadius = (STATUS_DONUT_INNER_RADIUS + STATUS_DONUT_OUTER_RADIUS) / 2
    const tooltipPosition = polarToCartesian(STATUS_DONUT_CX, STATUS_DONUT_CY, middleRadius, midAngle)
    previousEndAngle = endAngle

    return {
      ...item,
      startAngle,
      endAngle,
      tooltipPosition,
      paddingAngle: Math.sign(deltaAngle) * STATUS_DONUT_PADDING_ANGLE,
    }
  })

  let currentAngle = finalSectors[0]?.startAngle ?? STATUS_DONUT_START_ANGLE
  return finalSectors.map((sector, index) => {
    const paddingAngle = index > 0 ? sector.paddingAngle : 0
    const animatedDeltaAngle = (sector.endAngle - sector.startAngle) * statusDonutProgress.value
    const startAngle = currentAngle + paddingAngle
    const endAngle = currentAngle + animatedDeltaAngle + paddingAngle
    currentAngle = endAngle

    return {
      ...sector,
      path: getStatusDonutSectorPath(startAngle, endAngle),
    }
  })
})

const moduleDistributionHitboxes = computed(() => {
  const maxCount = Math.max(...moduleDistributionItems.map(item => item.count), 1)
  return moduleDistributionItems.map((item, index) => ({
    ...item,
    top: MODULE_BAR_TOP + index * MODULE_BAR_STEP,
    left: MODULE_BAR_LEFT,
    width: MODULE_BAR_WIDTH,
    valueWidth: (item.count / maxCount) * MODULE_BAR_WIDTH,
    height: MODULE_BAR_HEIGHT,
  }))
})

const moduleHoverTrack = computed(() => moduleDistributionHitboxes.value.find(item => item.name === moduleHoverName.value) ?? null)

function getTrendX(index: number) {
  return TREND_PLOT_LEFT + index * (TREND_PLOT_WIDTH / (trendDistributionItems.length - 1))
}

function getTrendY(value: number) {
  return TREND_PLOT_TOP + TREND_PLOT_HEIGHT - (value / TREND_PLOT_MAX_VALUE) * TREND_PLOT_HEIGHT
}

const trendHoverPoint = computed(() => {
  if (trendHoverIndex.value === null) {
    return null
  }

  const item = trendDistributionItems[trendHoverIndex.value]
  if (!item) {
    return null
  }

  return {
    x: getTrendX(trendHoverIndex.value),
    newY: getTrendY(item.newCount),
    closedY: getTrendY(item.closedCount),
  }
})

function getChartLocalPosition(event: MouseEvent, selector: string) {
  const target = event.currentTarget as Element | null
  const container = target?.closest(selector) as HTMLElement | null
  if (!container) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const rect = container.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function getRechartsTooltipTranslate(
  coordinate: { x: number; y: number },
  viewBox: { x: number; y: number; width: number; height: number },
  tooltipBox: { width: number; height: number },
) {
  const getAxisPosition = (
    key: 'x' | 'y',
    dimensionKey: 'width' | 'height',
  ) => {
    const positive = coordinate[key] + TOOLTIP_OFFSET
    const negative = coordinate[key] - tooltipBox[dimensionKey] - TOOLTIP_OFFSET
    const viewBoxBoundary = viewBox[key] + viewBox[dimensionKey]

    if (positive + tooltipBox[dimensionKey] > viewBoxBoundary) {
      return Math.max(negative, viewBox[key])
    }

    return Math.max(positive, viewBox[key])
  }

  return {
    x: getAxisPosition('x', 'width'),
    y: getAxisPosition('y', 'height'),
  }
}

function showStatusTooltip(item: StatusDistributionItem & { tooltipPosition?: { x: number; y: number } }) {
  const position = getRechartsTooltipTranslate(
    item.tooltipPosition ?? { x: STATUS_DONUT_CX, y: STATUS_DONUT_CY },
    { x: 0, y: 0, width: 400, height: 200 },
    { width: 92, height: 42 },
  )
  trendHoverIndex.value = null
  moduleHoverName.value = null
  chartTooltip.value = {
    chart: 'status',
    ...position,
    items: [{ label: item.name, value: item.value, color: '#1D2129' }],
  }
}

function showModuleTooltip(item: { name: string; count: number }, event: MouseEvent) {
  const localPosition = getChartLocalPosition(event, '.defects-page__chart-asset--module')
  const hitbox = moduleDistributionHitboxes.value.find(hitboxItem => hitboxItem.name === item.name)
  const position = getRechartsTooltipTranslate(
    {
      x: localPosition.x,
      y: (hitbox?.top ?? 0) + MODULE_BAR_HEIGHT / 2,
    },
    { x: 0, y: 0, width: 600, height: 200 },
    { width: 84, height: 58 },
  )
  trendHoverIndex.value = null
  moduleHoverName.value = item.name
  chartTooltip.value = {
    chart: 'module',
    ...position,
    title: item.name,
    items: [{ label: '缺陷数', value: item.count, color: '#F53F3F' }],
  }
}

function showTrendTooltip(event: MouseEvent) {
  const position = getChartLocalPosition(event, '.defects-page__trend-chart')
  const relativeX = Math.min(Math.max(position.x - TREND_PLOT_LEFT, 0), TREND_PLOT_WIDTH)
  const index = Math.min(
    Math.max(Math.round(relativeX / (TREND_PLOT_WIDTH / (trendDistributionItems.length - 1))), 0),
    trendDistributionItems.length - 1,
  )
  const item = trendDistributionItems[index]

  trendHoverIndex.value = index
  moduleHoverName.value = null
  const tooltipPosition = getRechartsTooltipTranslate(
    {
      x: getTrendX(index),
      y: Math.min(Math.max(position.y, TREND_PLOT_TOP), TREND_PLOT_TOP + TREND_PLOT_HEIGHT),
    },
    { x: 0, y: 0, width: 600, height: 200 },
    { width: 68, height: 78 },
  )
  chartTooltip.value = {
    chart: 'trend',
    x: tooltipPosition.x,
    y: tooltipPosition.y,
    title: item.day,
    items: [
      { label: '新增', value: item.newCount, color: '#F53F3F' },
      { label: '关闭', value: item.closedCount, color: '#00B42A' },
    ],
  }
}

function hideChartTooltip() {
  chartTooltip.value = null
  trendHoverIndex.value = null
  moduleHoverName.value = null
}

function stopStatusDonutAnimation() {
  if (typeof window === 'undefined') {
    return
  }

  if (statusDonutTimer !== undefined) {
    window.clearTimeout(statusDonutTimer)
    statusDonutTimer = undefined
  }

  if (statusDonutFrame) {
    window.cancelAnimationFrame(statusDonutFrame)
    statusDonutFrame = 0
  }
}

function startStatusDonutAnimation() {
  if (typeof window === 'undefined') {
    statusDonutProgress.value = 1
    return
  }

  stopStatusDonutAnimation()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    statusDonutProgress.value = 1
    return
  }

  statusDonutProgress.value = 0
  statusDonutTimer = window.setTimeout(() => {
    const startTime = window.performance.now()
    const step = (currentTime: number) => {
      const progress = clampProgress((currentTime - startTime) / STATUS_DONUT_ANIMATION_DURATION)
      statusDonutProgress.value = easeLikeRecharts(progress)

      if (progress < 1) {
        statusDonutFrame = window.requestAnimationFrame(step)
        return
      }

      statusDonutFrame = 0
      statusDonutProgress.value = 1
    }

    statusDonutFrame = window.requestAnimationFrame(step)
  }, STATUS_DONUT_ANIMATION_BEGIN)
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await Promise.all([loadWorkspaceMembers(), loadStatistics()])
  })()
})

onBeforeUnmount(() => {
  stopStatusDonutAnimation()
})

watch(
  selectedWorkspaceCode,
  (value) => {
    if (!workspaceReady.value || !value || value === workspaceCode.value) {
      return
    }
    if (value !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === value)) {
      return
    }
    void handleWorkspaceChange(value)
  },
)

watch(
  () => route.query.workspace,
  (value) => {
    const routeWorkspace = Array.isArray(value) ? value[0] : value
    if (!workspaceReady.value || !routeWorkspace || routeWorkspace === workspaceCode.value) {
      return
    }
    if (routeWorkspace !== 'ALL' && !workspaces.value.some(item => item.workspaceCode === routeWorkspace)) {
      return
    }
    void handleWorkspaceChange(routeWorkspace)
  },
)

watch(
  activeView,
  (value) => {
    if (value === 'stats') {
      startStatusDonutAnimation()
      return
    }

    stopStatusDonutAnimation()
    statusDonutProgress.value = 1
  },
)
</script>

<template>
  <AppPage
    title="缺陷管理"
    description=""
    fill
  >
    <template #actions>
      <div class="defects-workspace-select">
        <span class="defects-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="defects-workspace-select__control"
          :disabled="workspaceLoading"
          :loading="workspaceLoading"
          size="default"
          @change="handleWorkspaceChange"
        >
          <el-option
            v-for="item in workspaceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="workspaceErrorMessage" class="defects-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="defects-page">
      <nav class="defects-page__tabs" aria-label="缺陷管理视图">
        <button type="button" :class="{ 'is-active': activeView === 'list' }" @click="activeView = 'list'">
          缺陷列表
        </button>
        <button type="button" :class="{ 'is-active': activeView === 'stats' }" @click="activeView = 'stats'">
          统计视图
        </button>
      </nav>

      <template v-if="activeView === 'list'">
        <DefectSummaryPanel
          :statistics="statistics"
          :active-status="filter.status"
          :show-create-button="workspaceReady && canCreateDefects"
          @select="handleStatSelect"
          @create="handleCreateDefect"
        />

        <section class="defects-page__list-shell">
          <DefectFilterPanel
            v-model="filter"
            :workspace-code="workspaceCode"
            :workspace-options="workspaceFilterOptions"
            :assignee-options="assigneeOptions"
            :show-create-button="false"
            :show-workspace-filter="showWorkspaceFilter"
            :selected-count="selectedDefectCount"
            :can-edit="canEditDefects"
            :can-review="canReviewDefects"
            :can-delete="canDeleteDefects"
            embedded
            @reset="resetFilters"
            @create="handleCreateDefect"
            @batch-assign="handleBatchAssignDefects"
            @batch-close="handleBatchCloseDefects"
            @batch-delete="handleBatchDeleteDefects"
          />

          <DefectListPanel
            v-if="workspaceReady"
            ref="listPanelRef"
            :workspace-code="workspaceCode"
            :filter="filter"
            :assignee-options="assigneeOptions"
            :can-edit="canEditDefects"
            :can-review="canReviewDefects"
            :can-delete="canDeleteDefects"
            embedded
            @selection-change="handleDefectSelectionChange"
          />
        </section>
      </template>

      <section v-else class="defects-page__stats-view">
        <header class="defects-page__stats-head">
          <h2>缺陷统计</h2>
          <p>汇总当前项目的缺陷分布、严重程度和趋势，快速识别质量风险</p>
        </header>
        <div class="defects-page__stats-cards">
          <article
            v-for="card in statsCards"
            :key="card.label"
            :class="`is-${card.tone}`"
          >
            <i><img :src="card.icon" alt="" /></i>
            <div>
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
              <small>{{ card.note }}</small>
            </div>
          </article>
        </div>
        <div class="defects-page__stats-grid">
          <article class="defects-page__chart-card">
            <h3>状态分布</h3>
            <div class="defects-page__chart-asset defects-page__chart-asset--status">
              <svg
                class="defects-page__status-donut"
                viewBox="0 0 400 200"
                aria-hidden="true"
              >
                <path
                  v-for="sector in statusDonutSectors"
                  :key="sector.name"
                  class="defects-page__status-donut-sector"
                  :class="sector.className"
                  :d="sector.path"
                  :fill="sector.color"
                  @mouseenter="showStatusTooltip(sector)"
                  @mousemove="showStatusTooltip(sector)"
                  @mouseleave="hideChartTooltip"
                />
              </svg>
              <div
                v-if="chartTooltip?.chart === 'status'"
                class="defects-page__chart-tooltip"
                :style="{ left: `${chartTooltip.x}px`, top: `${chartTooltip.y}px` }"
              >
                <p
                  v-for="item in chartTooltip.items"
                  :key="item.label"
                  class="defects-page__chart-tooltip-item"
                  :style="{ color: item.color }"
                >
                  {{ item.label }} : {{ item.value }}
                </p>
              </div>
              <div class="defects-page__status-legend" aria-hidden="true">
                <span
                  v-for="item in statusDistributionItems"
                  :key="item.name"
                  :class="item.className"
                >
                  {{ item.name }}
                </span>
              </div>
            </div>
          </article>
          <article class="defects-page__chart-card">
            <h3>严重程度分布</h3>
            <div class="defects-page__chart-asset defects-page__chart-asset--severity">
              <img :src="figmaDefectIcons.stats.chart.severity" alt="" />
            </div>
          </article>
        </div>
        <article class="defects-page__chart-card defects-page__chart-card--wide">
          <h3>模块缺陷分布</h3>
          <div class="defects-page__chart-asset defects-page__chart-asset--module is-bar-chart">
            <span
              v-if="moduleHoverTrack"
              class="defects-page__module-hover-track"
              :style="{
                left: `${moduleHoverTrack.left}px`,
                top: `${moduleHoverTrack.top}px`,
                width: `${moduleHoverTrack.width}px`,
                height: `${moduleHoverTrack.height}px`,
              }"
            />
            <img :src="figmaDefectIcons.stats.chart.module" alt="" />
            <span
              v-for="item in moduleDistributionHitboxes"
              :key="item.name"
              class="defects-page__module-hitbox"
              :style="{
                left: `${item.left}px`,
                top: `${item.top}px`,
                width: `${item.width}px`,
                height: `${item.height}px`,
              }"
              @mouseenter="showModuleTooltip(item, $event)"
              @mousemove="showModuleTooltip(item, $event)"
              @mouseleave="hideChartTooltip"
            />
            <div
              v-if="chartTooltip?.chart === 'module'"
              class="defects-page__chart-tooltip"
              :style="{ left: `${chartTooltip.x}px`, top: `${chartTooltip.y}px` }"
            >
              <strong v-if="chartTooltip.title">{{ chartTooltip.title }}</strong>
              <p
                v-for="item in chartTooltip.items"
                :key="item.label"
                class="defects-page__chart-tooltip-item"
                :style="{ color: item.color }"
              >
                {{ item.label }} : {{ item.value }}
              </p>
            </div>
          </div>
        </article>
        <article class="defects-page__chart-card defects-page__chart-card--wide">
          <h3>新增 vs 关闭趋势</h3>
          <div class="defects-page__trend-chart">
            <span class="defects-page__trend-y is-y16">16</span>
            <span class="defects-page__trend-y is-y12">12</span>
            <span class="defects-page__trend-y is-y8">8</span>
            <span class="defects-page__trend-y is-y4">4</span>
            <span class="defects-page__trend-y is-y0">0</span>
            <span class="defects-page__trend-line is-line16" />
            <span class="defects-page__trend-line is-line12" />
            <span class="defects-page__trend-line is-line8" />
            <span class="defects-page__trend-line is-line4" />
            <span class="defects-page__trend-line is-line0" />
            <svg class="defects-page__trend-svg" viewBox="0 0 550 142" preserveAspectRatio="none">
              <path class="is-trend-fill is-new" d="M0 116 C55 84 92 100 137.5 62 C192.5 14 253 92 320 53 C392 12 452 58 550 34" fill="rgba(245,63,63,0.08)" />
              <path class="is-trend-stroke is-new" pathLength="1" d="M0 116 C55 84 92 100 137.5 62 C192.5 14 253 92 320 53 C392 12 452 58 550 34" fill="none" stroke="#f53f3f" stroke-width="2" />
              <path class="is-trend-fill is-closed" d="M0 128 C66 124 106 108 159 116 C229 127 260 73 330 88 C410 104 460 66 550 78" fill="rgba(0,180,42,0.08)" />
              <path class="is-trend-stroke is-closed" pathLength="1" d="M0 128 C66 124 106 108 159 116 C229 127 260 73 330 88 C410 104 460 66 550 78" fill="none" stroke="#00b42a" stroke-width="2" />
            </svg>
            <template v-if="trendHoverPoint">
              <span
                class="defects-page__trend-cursor"
                :style="{ left: `${trendHoverPoint.x}px` }"
              />
              <span
                class="defects-page__trend-hover-dot is-new"
                :style="{ left: `${trendHoverPoint.x}px`, top: `${trendHoverPoint.newY}px` }"
              />
              <span
                class="defects-page__trend-hover-dot is-closed"
                :style="{ left: `${trendHoverPoint.x}px`, top: `${trendHoverPoint.closedY}px` }"
              />
            </template>
            <span
              class="defects-page__trend-hover-layer"
              @mousemove="showTrendTooltip"
              @mouseenter="showTrendTooltip"
              @mouseleave="hideChartTooltip"
            />
            <div
              v-if="chartTooltip?.chart === 'trend'"
              class="defects-page__chart-tooltip defects-page__chart-tooltip--trend"
              :style="{ left: `${chartTooltip.x}px`, top: `${chartTooltip.y}px` }"
            >
              <strong v-if="chartTooltip.title">{{ chartTooltip.title }}</strong>
              <p
                v-for="item in chartTooltip.items"
                :key="item.label"
                class="defects-page__chart-tooltip-item"
                :style="{ color: item.color }"
              >
                {{ item.label }} : {{ item.value }}
              </p>
            </div>
            <div class="defects-page__trend-axis">
              <span>6/5</span>
              <span>6/10</span>
              <span>6/15</span>
              <span>6/20</span>
              <span>6/25</span>
              <span>6/30</span>
              <span>7/5</span>
            </div>
            <div class="defects-page__trend-legend">
              <span class="is-new">新增</span>
              <span class="is-closed">关闭</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  </AppPage>
</template>

<style scoped>
.defects-page {
  display: flex;
  min-width: 0;
  min-height: calc(100dvh - 86px);
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  background: #f4f6fa;
}

.defects-page__list-shell {
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.defects-page__tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: flex-start;
  padding-left: 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.defects-page__tabs button {
  width: 80px;
  height: 43px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.defects-page__tabs button.is-active {
  border-bottom-color: #f53f3f;
  color: #f53f3f;
}

.defects-page__stats-view {
  min-height: 0;
  overflow: auto;
  padding: 21px;
  background: #f4f6fa;
}

.defects-page__stats-head h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.defects-page__stats-head p {
  margin: 0;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defects-page__stats-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 17.5px;
}

.defects-page__stats-cards article {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: 10.5px;
  min-height: 94.25px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.defects-page__stats-cards article i {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-style: normal;
  line-height: 1;
}

.defects-page__stats-cards article i img {
  width: 20px;
  height: 20px;
}

.defects-page__stats-cards article.is-total i {
  background: #f2f3f5;
  color: #4e5969;
}

.defects-page__stats-cards article.is-todo i {
  background: #fff3e8;
  color: #ff7d00;
}

.defects-page__stats-cards article.is-high i {
  background: #ffe8e8;
  color: #f53f3f;
}

.defects-page__stats-cards article.is-verify i {
  background: #fff7e8;
  color: #c89b00;
}

.defects-page__stats-cards article > div {
  min-width: 0;
}

.defects-page__stats-cards strong {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 24px;
}

.defects-page__stats-cards article.is-total strong {
  color: #1d2129;
}

.defects-page__stats-cards article.is-todo strong {
  color: #ff7d00;
}

.defects-page__stats-cards article.is-high strong {
  color: #f53f3f;
}

.defects-page__stats-cards article.is-verify strong {
  color: #c89b00;
}

.defects-page__stats-cards span {
  display: block;
  padding-top: 3.5px;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defects-page__stats-cards small {
  display: block;
  padding-top: 1.75px;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.defects-page__stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17.5px;
  margin-top: 17.5px;
}

.defects-page__chart-card {
  box-sizing: border-box;
  height: 268.5px;
  padding: 18.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.defects-page__chart-card h3 {
  margin: 0;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.defects-page__chart-card--wide {
  height: 272px;
  margin-top: 17.5px;
}

.defects-page__chart-asset {
  position: relative;
  overflow: visible;
  margin-top: 10.5px;
}

.defects-page__chart-asset img {
  display: block;
  max-width: none;
}

.defects-page__chart-asset.is-bar-chart img {
  transform-origin: left center;
  animation: defect-chart-bar-enter 1500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.defects-page__chart-asset--status {
  width: 400px;
  height: 200px;
}

.defects-page__chart-asset--status img {
  width: 400px;
  height: 200px;
}

.defects-page__status-donut {
  display: block;
  width: 400px;
  height: 168px;
}

.defects-page__status-donut-sector {
  cursor: default;
  pointer-events: visiblePainted;
}

.defects-page__chart-tooltip {
  position: absolute;
  z-index: 8;
  min-width: 92px;
  padding: 10px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  pointer-events: none;
  white-space: nowrap;
}

.defects-page__chart-tooltip strong {
  display: block;
  margin: 0 0 2px;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.defects-page__chart-tooltip-item {
  margin: 0;
  padding: 4px 0;
}

.defects-page__chart-tooltip--trend {
  min-width: 68px;
  border-radius: 10px;
  font-size: 13px;
}

.defects-page__status-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 400px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defects-page__status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.defects-page__status-legend span::before {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 999px;
  content: '';
}

.defects-page__status-legend .is-closed {
  color: #00b42a;
}

.defects-page__status-legend .is-closed::before {
  background: #00b42a;
}

.defects-page__status-legend .is-processing {
  color: #ff7d00;
}

.defects-page__status-legend .is-processing::before {
  background: #ff7d00;
}

.defects-page__status-legend .is-new {
  color: #165dff;
}

.defects-page__status-legend .is-new::before {
  background: #165dff;
}

.defects-page__status-legend .is-verify {
  color: #faad14;
}

.defects-page__status-legend .is-verify::before {
  background: #faad14;
}

.defects-page__status-legend .is-assigned {
  color: #7816ff;
}

.defects-page__status-legend .is-assigned::before {
  background: #7816ff;
}

.defects-page__status-legend .is-rejected {
  color: #f53f3f;
}

.defects-page__status-legend .is-rejected::before {
  background: #f53f3f;
}

.defects-page__chart-asset--severity {
  width: min(865.25px, 100%);
  height: 170px;
  margin-top: 0;
}

.defects-page__chart-asset--severity img {
  width: 865.25px;
  height: 170px;
}

.defects-page__chart-asset--module {
  width: 600px;
  height: 200px;
  margin-top: 14px;
}

.defects-page__chart-asset--module img {
  position: relative;
  z-index: 2;
  width: 600px;
  height: 200px;
}

.defects-page__module-hover-track {
  position: absolute;
  z-index: 1;
  display: block;
  background: #cccccc;
  pointer-events: none;
}

.defects-page__module-hitbox {
  position: absolute;
  z-index: 5;
  display: block;
  cursor: default;
}

.defects-page__trend-chart {
  position: relative;
  width: 600px;
  height: 214px;
  margin-top: 14px;
  overflow: visible;
}

.defects-page__trend-y {
  position: absolute;
  width: 14px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  text-align: right;
}

.defects-page__trend-y.is-y16 {
  top: 1.26px;
  left: 18px;
}

.defects-page__trend-y.is-y12 {
  top: 31.01px;
  left: 18px;
}

.defects-page__trend-y.is-y8 {
  top: 64.76px;
  left: 24px;
}

.defects-page__trend-y.is-y4 {
  top: 98.51px;
  left: 24px;
}

.defects-page__trend-y.is-y0 {
  top: 132.26px;
  left: 24px;
}

.defects-page__trend-line {
  position: absolute;
  left: 40px;
  width: 550px;
  height: 1px;
  background: #e5e6eb;
}

.defects-page__trend-line.is-line16 {
  top: 5px;
}

.defects-page__trend-line.is-line12 {
  top: 38.75px;
}

.defects-page__trend-line.is-line8 {
  top: 72.5px;
}

.defects-page__trend-line.is-line4 {
  top: 106.25px;
}

.defects-page__trend-line.is-line0 {
  top: 140px;
}

.defects-page__trend-svg {
  position: absolute;
  top: 0;
  left: 40px;
  width: 550px;
  height: 142px;
  overflow: visible;
}

.defects-page__trend-svg .is-trend-fill {
  transform-origin: left bottom;
  animation: defect-chart-area-enter 1500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.defects-page__trend-svg .is-trend-stroke {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: defect-chart-line-enter 1500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.defects-page__trend-svg .is-closed {
  animation-delay: 120ms;
}

.defects-page__trend-hover-layer {
  position: absolute;
  z-index: 6;
  top: 0;
  left: 40px;
  width: 550px;
  height: 142px;
  cursor: default;
}

.defects-page__trend-cursor {
  position: absolute;
  z-index: 4;
  top: 5px;
  width: 1px;
  height: 135px;
  background: #c9cdd4;
  pointer-events: none;
}

.defects-page__trend-hover-dot {
  position: absolute;
  z-index: 5;
  width: 7px;
  height: 7px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(29, 33, 41, 0.04);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.defects-page__trend-hover-dot.is-new {
  background: #f53f3f;
}

.defects-page__trend-hover-dot.is-closed {
  background: #00b42a;
}

.defects-page__trend-axis {
  position: absolute;
  left: 30px;
  top: 144.52px;
  display: flex;
  width: 569.5px;
  justify-content: space-between;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
}

.defects-page__trend-legend {
  position: absolute;
  top: 182px;
  left: 260px;
  display: flex;
  gap: 10px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.defects-page__trend-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.defects-page__trend-legend span::before {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  content: '';
}

.defects-page__trend-legend .is-new {
  color: #f53f3f;
}

.defects-page__trend-legend .is-new::before {
  background: #f53f3f;
}

.defects-page__trend-legend .is-closed {
  color: #00b42a;
}

.defects-page__trend-legend .is-closed::before {
  background: #00b42a;
}

@keyframes defect-chart-bar-enter {
  0% {
    opacity: 0.65;
    clip-path: inset(0 100% 0 0);
  }

  100% {
    opacity: 1;
    clip-path: inset(0 0 0 0);
  }
}

@keyframes defect-chart-area-enter {
  0% {
    opacity: 0;
    transform: scaleX(0.2);
  }

  100% {
    opacity: 1;
    transform: scaleX(1);
  }
}

@keyframes defect-chart-line-enter {
  0% {
    opacity: 0;
    stroke-dashoffset: 1;
  }

  100% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .defects-page__chart-asset.is-bar-chart img,
  .defects-page__trend-svg .is-trend-fill,
  .defects-page__trend-svg .is-trend-stroke {
    animation: none;
  }
}

.defects-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.defects-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defects-workspace-select__control {
  width: 192px;
}

.defects-workspace-select__error {
  max-width: 180px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .defects-workspace-select {
    width: 100%;
    flex-wrap: wrap;
  }

  .defects-workspace-select__control {
    width: min(240px, 100%);
  }
}
</style>
