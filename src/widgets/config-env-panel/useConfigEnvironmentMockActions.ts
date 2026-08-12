import { computed, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import { configApi, type MockApplicationItem, type MockReleaseItem } from '@/entities/config'
import type { ConfigEnvForm } from '@/features/config-env-create-edit'

type SaveCurrentForm = (successMessage?: string, options?: { reload?: boolean }) => Promise<boolean>

export function useConfigEnvironmentMockActions(
  workspaceCode: () => string,
  form: ConfigEnvForm,
  mockApplications: Ref<MockApplicationItem[]>,
  mockReleases: Ref<MockReleaseItem[]>,
  saveCurrentForm: SaveCurrentForm,
) {
  const mockBindDialogVisible = ref(false)
  const mockBindApplicationId = ref<number | null>(null)
  const mockBindReleaseId = ref<number | null>(null)
  const mockBindReleases = ref<MockReleaseItem[]>([])
  const mockVersionDialogVisible = ref(false)
  const mockVersionSelection = ref<number | null>(null)
  const mockUnbindDialogVisible = ref(false)

  const productionEnvironment = computed(() => form.envType === 'PROD')
  const mockBound = computed(() => form.mockApplicationId != null && form.mockReleaseId != null)
  const mockVersionOptions = computed(() => [...mockReleases.value].sort((left, right) => right.versionNo - left.versionNo))
  const selectedMockVersionOption = computed(() => mockVersionOptions.value.find(item => item.id === mockVersionSelection.value) || null)

  async function loadBindReleases(applicationId: number | null, showError: boolean) {
    mockBindReleaseId.value = null
    mockBindReleases.value = []
    if (!applicationId) return
    try {
      mockBindReleases.value = await configApi.getMockReleases(workspaceCode(), applicationId)
      const activeRelease = mockBindReleases.value.find(item => item.active) || mockBindReleases.value[0]
      mockBindReleaseId.value = activeRelease?.id || null
    } catch {
      mockBindReleases.value = []
      if (showError) ElMessage.error('Mock 发布版本加载失败')
    }
  }

  async function openMockBindDialog() {
    if (productionEnvironment.value) {
      ElMessage.warning('生产环境禁止绑定 Mock')
      return
    }
    mockBindApplicationId.value = form.mockApplicationId || mockApplications.value[0]?.id || null
    await loadBindReleases(mockBindApplicationId.value, false)
    mockBindDialogVisible.value = true
  }

  async function changeMockBindApplication(applicationId: number | null) {
    await loadBindReleases(applicationId, true)
  }

  async function confirmMockBinding() {
    if (!mockBindApplicationId.value || !mockBindReleaseId.value) {
      ElMessage.warning('请选择 Mock 应用和发布版本')
      return
    }
    const previous = { enabled: form.mockEnabled, applicationId: form.mockApplicationId, releaseId: form.mockReleaseId }
    form.mockApplicationId = mockBindApplicationId.value
    form.mockReleaseId = mockBindReleaseId.value
    form.mockEnabled = true
    const saved = await saveCurrentForm('Mock 应用已绑定')
    if (saved) mockBindDialogVisible.value = false
    else {
      form.mockEnabled = previous.enabled
      form.mockApplicationId = previous.applicationId
      form.mockReleaseId = previous.releaseId
    }
  }

  async function toggleMockEnabled() {
    if (!mockBound.value) {
      await openMockBindDialog()
      return
    }
    if (!form.mockEnabled && productionEnvironment.value) {
      ElMessage.warning('生产环境禁止启用 Mock')
      return
    }
    const previous = form.mockEnabled
    form.mockEnabled = !previous
    if (!await saveCurrentForm(form.mockEnabled ? 'Mock 已启用' : 'Mock 已停用', { reload: false })) {
      form.mockEnabled = previous
    }
  }

  function openMockVersionDialog() {
    const next = mockVersionOptions.value.find(item => item.id !== form.mockReleaseId)
    if (!next) {
      ElMessage.warning('暂无其他可切换的发布版本')
      return
    }
    mockVersionSelection.value = next.id
    mockVersionDialogVisible.value = true
  }

  async function confirmMockVersionSwitch() {
    if (!mockVersionSelection.value || mockVersionSelection.value === form.mockReleaseId) return
    const previous = form.mockReleaseId
    form.mockReleaseId = mockVersionSelection.value
    const version = selectedMockVersionOption.value?.versionNo
    const saved = await saveCurrentForm(version == null ? 'Mock 版本已切换' : `Mock 版本已切换至 v${version}`)
    if (saved) mockVersionDialogVisible.value = false
    else form.mockReleaseId = previous
  }

  async function confirmMockUnbind() {
    const previous = { enabled: form.mockEnabled, applicationId: form.mockApplicationId, releaseId: form.mockReleaseId }
    form.mockEnabled = false
    form.mockApplicationId = null
    form.mockReleaseId = null
    const saved = await saveCurrentForm('Mock 绑定已解除')
    if (saved) mockUnbindDialogVisible.value = false
    else {
      form.mockEnabled = previous.enabled
      form.mockApplicationId = previous.applicationId
      form.mockReleaseId = previous.releaseId
    }
  }

  return {
    mockBindDialogVisible,
    mockBindApplicationId,
    mockBindReleaseId,
    mockBindReleases,
    mockVersionDialogVisible,
    mockVersionSelection,
    mockUnbindDialogVisible,
    productionEnvironment,
    mockBound,
    mockVersionOptions,
    selectedMockVersionOption,
    openMockBindDialog,
    changeMockBindApplication,
    confirmMockBinding,
    toggleMockEnabled,
    openMockVersionDialog,
    confirmMockVersionSwitch,
    confirmMockUnbind,
  }
}
