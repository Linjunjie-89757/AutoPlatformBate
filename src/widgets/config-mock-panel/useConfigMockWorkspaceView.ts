import { computed, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle2, CircleAlert, CircleX } from '@lucide/vue'

import type {
  ConfigReferenceSummary,
  MockApplicationItem,
  MockCallLogItem,
  MockEndpointItem,
  MockReleaseItem,
  MockScenarioItem,
} from '@/entities/config'

export type MockWorkspaceTab = 'interfaces' | 'releases' | 'references' | 'logs'

interface ConfigMockWorkspaceProps {
  applications: MockApplicationItem[]
  endpoints: MockEndpointItem[]
  scenarios: MockScenarioItem[]
  releases: MockReleaseItem[]
  logs: MockCallLogItem[]
  activeAppId: number | null
  loading?: boolean
  referenceSummary: ConfigReferenceSummary | null
}

interface ConfigMockWorkspaceViewOptions {
  props: Readonly<ConfigMockWorkspaceProps>
  emitLoadReferences: () => void
  emitSelectApp: (id: number) => void
}

interface MockLogResultTone {
  label: string
  tone: 'success' | 'warning' | 'danger'
  icon: Component
}

export function useConfigMockWorkspaceView(options: ConfigMockWorkspaceViewOptions) {
  const { props, emitLoadReferences, emitSelectApp } = options
  const router = useRouter()

  const activeTab = ref<MockWorkspaceTab>('interfaces')
  const appSearch = ref('')
  const endpointSearch = ref('')
  const endpointMethod = ref('ALL')
  const endpointStatus = ref('ALL')
  const endpointVersion = ref('ALL')
  const logSearch = ref('')
  const logMethod = ref('ALL')
  const logResult = ref('ALL')
  const expandedEndpointId = ref<number | null>(null)
  const shouldInitializeEndpointExpansion = ref(true)

  const activeApp = computed(() => props.applications.find(item => item.id === props.activeAppId) || null)
  const activeEndpoints = computed(() => props.endpoints.filter(item => item.appId === props.activeAppId))
  const activeScenarios = computed(() => props.scenarios.filter(item => item.appId === props.activeAppId))
  const activeLogs = computed(() => props.logs.filter(item => item.appId === props.activeAppId))
  const activeRelease = computed(() => props.releases.find(item => item.active) || null)
  const activeReferenceItems = computed(() => (props.referenceSummary?.items || []).filter(item => item.sourceType.includes('环境')))
  const unmatchedCount = computed(() => activeLogs.value.filter(item => !item.matched).length)

  const filteredApplications = computed(() => {
    const needle = appSearch.value.trim().toLowerCase()
    if (!needle) return props.applications
    return props.applications.filter(item =>
      item.appName.toLowerCase().includes(needle)
      || item.appCode.toLowerCase().includes(needle),
    )
  })

  const filteredEndpoints = computed(() => {
    const needle = endpointSearch.value.trim().toLowerCase()
    return activeEndpoints.value.filter(item => {
      const methodMatches = endpointMethod.value === 'ALL' || item.httpMethod === endpointMethod.value
      const statusMatches = endpointStatus.value === 'ALL'
        || (endpointStatus.value === 'ENABLED' ? item.status === 1 : item.status === 0)
      const versionMatches = endpointVersion.value === 'ALL'
        || (endpointVersion.value === 'PUBLISHED' ? Boolean(activeRelease.value) : !activeRelease.value)
      const keywordMatches = !needle
        || item.endpointName.toLowerCase().includes(needle)
        || item.pathPattern.toLowerCase().includes(needle)
      return methodMatches && statusMatches && versionMatches && keywordMatches
    })
  })

  const filteredLogs = computed(() => {
    const needle = logSearch.value.trim().toLowerCase()
    return activeLogs.value.filter(item => {
      const methodMatches = logMethod.value === 'ALL' || item.httpMethod === logMethod.value
      const resultMatches = logResult.value === 'ALL'
        || (logResult.value === 'MATCHED' ? item.matched : !item.matched)
      const keywordMatches = !needle
        || item.requestPath.toLowerCase().includes(needle)
        || (item.scenarioName || '').toLowerCase().includes(needle)
        || (item.endpointName || '').toLowerCase().includes(needle)
      return methodMatches && resultMatches && keywordMatches
    })
  })

  watch(() => props.activeAppId, () => {
    expandedEndpointId.value = null
    activeTab.value = 'interfaces'
  })

  watch(
    [() => props.loading, activeEndpoints],
    ([isLoading, endpoints]) => {
      if (isLoading || !shouldInitializeEndpointExpansion.value || !props.activeAppId) return
      expandedEndpointId.value = endpoints[0]?.id ?? null
      shouldInitializeEndpointExpansion.value = false
    },
    { immediate: true },
  )

  function changeTab(tab: MockWorkspaceTab) {
    activeTab.value = tab
    if (tab === 'references') emitLoadReferences()
  }

  function selectApplication(id: number) {
    activeTab.value = 'interfaces'
    expandedEndpointId.value = null
    emitSelectApp(id)
  }

  function scenariosFor(endpointId: number) {
    return activeScenarios.value.filter(item => item.endpointId === endpointId)
  }

  function endpointCount(appId: number) {
    return props.endpoints.filter(item => item.appId === appId).length
  }

  function appLogCount(appId: number) {
    return props.logs.filter(item => item.appId === appId).length
  }

  function appUnmatchedCount(appId: number) {
    return props.logs.filter(item => item.appId === appId && !item.matched).length
  }

  function appState(app: MockApplicationItem) {
    if (app.status === 0) return { label: '已停用', tone: 'disabled' }
    if (app.id === props.activeAppId && activeRelease.value) return { label: '已发布', tone: 'published' }
    if (app.id === props.activeAppId) return { label: '草稿', tone: 'draft' }
    return { label: '已启用', tone: 'enabled' }
  }

  function methodClass(method: string) {
    return `is-${method.toLowerCase()}`
  }

  function formatDate(value: string | null) {
    if (!value) return '—'
    return value.replace('T', ' ').slice(0, 19)
  }

  function formatRelativeTime(value: string | null) {
    if (!value) return '—'
    const timestamp = new Date(value).getTime()
    if (!Number.isFinite(timestamp)) return formatDate(value)
    const elapsed = Date.now() - timestamp
    if (elapsed < 0) return formatDate(value)
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (elapsed < minute) return '刚刚'
    if (elapsed < hour) return `${Math.floor(elapsed / minute)} 分钟前`
    if (elapsed < day) return `${Math.floor(elapsed / hour)} 小时前`
    if (elapsed < 7 * day) return `${Math.floor(elapsed / day)} 天前`
    return formatDate(value)
  }

  function releaseTitle(release: MockReleaseItem) {
    return release.releaseName || `Mock v${release.versionNo}`
  }

  function logResultTone(log: MockCallLogItem): MockLogResultTone {
    if (log.matched) return { label: '命中', tone: 'success', icon: CheckCircle2 }
    if ((log.responseStatus || 0) >= 500 || log.status.toLowerCase().includes('error')) {
      return { label: '异常', tone: 'danger', icon: CircleX }
    }
    return { label: '未匹配', tone: 'warning', icon: CircleAlert }
  }

  function statusCodeTone(status: number | null) {
    if (!status) return 'muted'
    if (status < 400) return 'success'
    if (status < 500) return 'warning'
    return 'danger'
  }

  function copyBaseUrl() {
    if (!activeApp.value) return
    void navigator.clipboard.writeText(`/api/mock/${activeApp.value.appCode}`)
  }

  function goToEnvironmentConfig() {
    void router.push({ name: 'config-center', query: { tab: 'env' } })
  }

  return {
    activeTab,
    appSearch,
    endpointSearch,
    endpointMethod,
    endpointStatus,
    endpointVersion,
    logSearch,
    logMethod,
    logResult,
    expandedEndpointId,
    activeApp,
    activeEndpoints,
    activeScenarios,
    activeLogs,
    activeRelease,
    activeReferenceItems,
    unmatchedCount,
    filteredApplications,
    filteredEndpoints,
    filteredLogs,
    changeTab,
    selectApplication,
    scenariosFor,
    endpointCount,
    appLogCount,
    appUnmatchedCount,
    appState,
    methodClass,
    formatDate,
    formatRelativeTime,
    releaseTitle,
    logResultTone,
    statusCodeTone,
    copyBaseUrl,
    goToEnvironmentConfig,
  }
}
