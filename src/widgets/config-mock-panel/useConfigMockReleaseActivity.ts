import { ElMessage } from 'element-plus'
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import {
  configApi,
  type ConfigReferenceSummary,
  type MockApplicationItem,
  type MockCallLogItem,
  type MockReleaseItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmAction } from '@/shared/ui'

import { formatMockLogHeaders, formatMockLogJson } from './mockLogFormatting'

interface UseConfigMockReleaseActivityOptions {
  activeApp: ComputedRef<MockApplicationItem | null>
  activeAppId: Ref<number | null>
  workspaceCode: ComputedRef<string>
}

export function useConfigMockReleaseActivity(options: UseConfigMockReleaseActivityOptions) {
  const releases = ref<MockReleaseItem[]>([])
  const logs = ref<MockCallLogItem[]>([])
  const activeLog = ref<MockCallLogItem | null>(null)
  const releaseLoading = ref(false)
  const referenceDrawerVisible = ref(false)
  const referenceLoading = ref(false)
  const referenceSummary = ref<ConfigReferenceSummary | null>(null)
  const logDrawerVisible = ref(false)
  const publishDialogVisible = ref(false)
  const releaseName = ref('')

  const activeRelease = computed(() => releases.value.find(item => item.active) || null)
  const nextReleaseVersion = computed(() => Math.max(0, ...releases.value.map(item => item.versionNo)) + 1)
  const environmentReferenceCount = computed(
    () => referenceSummary.value?.items.filter(item => item.sourceType.includes('环境')).length || 0,
  )

  async function loadReleases() {
    if (!options.activeAppId.value) {
      releases.value = []
      return
    }
    releaseLoading.value = true
    try {
      releases.value = await configApi.getMockReleases(options.workspaceCode.value, options.activeAppId.value)
    } catch {
      releases.value = []
    } finally {
      releaseLoading.value = false
    }
  }

  async function loadLogs() {
    const page = await configApi.getMockCallLogs(options.workspaceCode.value)
    logs.value = page.items || []
  }

  async function loadApplicationReferences(row = options.activeApp.value) {
    if (!row) {
      referenceSummary.value = null
      return
    }
    referenceLoading.value = true
    referenceSummary.value = null
    try {
      referenceSummary.value = await configApi.getMockApplicationReferences(options.workspaceCode.value, row.id)
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      referenceLoading.value = false
    }
  }

  async function publishCurrentRelease() {
    if (!options.activeApp.value) return
    await loadApplicationReferences(options.activeApp.value)
    releaseName.value = ''
    publishDialogVisible.value = true
  }

  async function confirmPublishRelease() {
    if (!options.activeApp.value) return
    releaseLoading.value = true
    try {
      await configApi.publishMockRelease(options.workspaceCode.value, options.activeApp.value.id, {
        releaseName: releaseName.value.trim() || null,
      })
      ElMessage.success('当前 Mock 配置已发布为不可变版本，可在环境配置中选择使用')
      publishDialogVisible.value = false
      await loadReleases()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    } finally {
      releaseLoading.value = false
    }
  }

  async function activateRelease(release: MockReleaseItem) {
    if (!options.activeApp.value || release.active) return
    try {
      await confirmAction({
        title: '切换 Mock 运行版本',
        message: `确认将运行版本切换为 v${release.versionNo}「${release.releaseName}」？后续调用会使用该版本快照。`,
        confirmText: '确认切换',
        tone: 'warning',
      })
      releaseLoading.value = true
      await configApi.activateMockRelease(options.workspaceCode.value, options.activeApp.value.id, release.id)
      ElMessage.success(`已切换到 Mock v${release.versionNo}`)
      await loadReleases()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    } finally {
      releaseLoading.value = false
    }
  }

  function openLog(row: MockCallLogItem) {
    activeLog.value = row
    logDrawerVisible.value = true
  }

  return {
    activateRelease,
    activeLog,
    activeRelease,
    confirmPublishRelease,
    environmentReferenceCount,
    loadApplicationReferences,
    loadLogs,
    loadReleases,
    logDrawerVisible,
    logs,
    nextReleaseVersion,
    openLog,
    formatMockLogHeaders,
    formatMockLogJson,
    publishCurrentRelease,
    publishDialogVisible,
    referenceDrawerVisible,
    referenceLoading,
    referenceSummary,
    releaseLoading,
    releaseName,
    releases,
  }
}
