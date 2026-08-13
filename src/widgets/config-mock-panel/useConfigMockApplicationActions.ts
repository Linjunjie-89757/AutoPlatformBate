import { ElMessage } from 'element-plus'
import { reactive, ref, type ComputedRef, type Ref } from 'vue'

import {
  configApi,
  type ConfigStatus,
  type CreateMockApplicationPayload,
  type CreateMockEndpointPayload,
  type MockApplicationItem,
  type MockEndpointItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmAction, confirmDelete } from '@/shared/ui'

type DialogMode = 'create' | 'edit'

interface UseConfigMockApplicationActionsOptions {
  activeAppId: Ref<number | null>
  activeEndpointId: Ref<number | null>
  loadAll: () => Promise<void>
  saving: Ref<boolean>
  workspaceCode: ComputedRef<string>
}

export function useConfigMockApplicationActions(options: UseConfigMockApplicationActionsOptions) {
  const appDialogVisible = ref(false)
  const endpointDialogVisible = ref(false)
  const appDialogMode = ref<DialogMode>('create')
  const endpointDialogMode = ref<DialogMode>('create')
  const editingAppId = ref<number | null>(null)
  const editingEndpointId = ref<number | null>(null)
  const appForm = reactive<CreateMockApplicationPayload>({ appName: '', appCode: '', description: '', status: 1 })
  const endpointForm = reactive<CreateMockEndpointPayload>({
    appId: 0,
    endpointName: '',
    httpMethod: 'POST',
    pathPattern: '/pay/notify',
    description: '',
    status: 1,
  })

  function openCreateAppDialog() {
    appDialogMode.value = 'create'
    editingAppId.value = null
    Object.assign(appForm, { appName: '', appCode: '', description: '', status: 1 })
    appDialogVisible.value = true
  }

  function openEditAppDialog(app: MockApplicationItem) {
    appDialogMode.value = 'edit'
    editingAppId.value = app.id
    Object.assign(appForm, {
      appName: app.appName,
      appCode: app.appCode,
      description: app.description || '',
      status: app.status,
    })
    appDialogVisible.value = true
  }

  function openCreateEndpointDialog() {
    if (!options.activeAppId.value) {
      ElMessage.warning('请先创建或选择 Mock 应用')
      return
    }
    endpointDialogMode.value = 'create'
    editingEndpointId.value = null
    Object.assign(endpointForm, {
      appId: options.activeAppId.value,
      endpointName: '',
      httpMethod: 'POST',
      pathPattern: '/pay/notify',
      description: '',
      status: 1,
    })
    endpointDialogVisible.value = true
  }

  function openEditEndpointDialog(endpoint: MockEndpointItem) {
    endpointDialogMode.value = 'edit'
    editingEndpointId.value = endpoint.id
    Object.assign(endpointForm, {
      appId: endpoint.appId,
      endpointName: endpoint.endpointName,
      httpMethod: endpoint.httpMethod,
      pathPattern: endpoint.pathPattern,
      description: endpoint.description || '',
      status: endpoint.status,
    })
    endpointDialogVisible.value = true
  }

  function openCopyEndpointDialog(endpoint: MockEndpointItem) {
    endpointDialogMode.value = 'create'
    editingEndpointId.value = null
    Object.assign(endpointForm, {
      appId: endpoint.appId,
      endpointName: `${endpoint.endpointName} 副本`,
      httpMethod: endpoint.httpMethod,
      pathPattern: endpoint.pathPattern,
      description: endpoint.description || '',
      status: endpoint.status,
    })
    endpointDialogVisible.value = true
  }

  async function submitApplication() {
    if (!appForm.appName.trim() || !appForm.appCode.trim()) {
      ElMessage.warning('请输入应用名称和应用编码')
      return
    }
    options.saving.value = true
    try {
      const saved = appDialogMode.value === 'edit' && editingAppId.value
        ? await configApi.updateMockApplication(options.workspaceCode.value, editingAppId.value, appForm)
        : await configApi.createMockApplication(options.workspaceCode.value, appForm)
      ElMessage.success(appDialogMode.value === 'edit' ? 'Mock 应用已更新' : 'Mock 应用已创建')
      options.activeAppId.value = saved.id
      appDialogVisible.value = false
      await options.loadAll()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      options.saving.value = false
    }
  }

  async function submitEndpoint() {
    if (!endpointForm.endpointName.trim() || !endpointForm.pathPattern.trim()) {
      ElMessage.warning('请输入接口名称和匹配路径')
      return
    }
    options.saving.value = true
    try {
      const saved = endpointDialogMode.value === 'edit' && editingEndpointId.value
        ? await configApi.updateMockEndpoint(options.workspaceCode.value, editingEndpointId.value, endpointForm)
        : await configApi.createMockEndpoint(options.workspaceCode.value, endpointForm)
      ElMessage.success(endpointDialogMode.value === 'edit' ? 'Mock 接口已更新' : 'Mock 接口已创建')
      options.activeEndpointId.value = saved.id
      endpointDialogVisible.value = false
      await options.loadAll()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      options.saving.value = false
    }
  }

  async function toggleApplication(row: MockApplicationItem) {
    const nextStatus: ConfigStatus = row.status === 1 ? 0 : 1
    try {
      await confirmAction({
        title: nextStatus === 1 ? '启用 Mock 应用' : '停用 Mock 应用',
        message: nextStatus === 1
          ? `确认启用 Mock 应用「${row.appName}」？`
          : `确认停用 Mock 应用「${row.appName}」？停用后该应用将不再响应 Mock 请求。`,
        confirmText: nextStatus === 1 ? '确认启用' : '确认停用',
        tone: nextStatus === 1 ? 'success' : 'warning',
      })
      options.saving.value = true
      await configApi.updateMockApplication(options.workspaceCode.value, row.id, {
        appName: row.appName,
        appCode: row.appCode,
        description: row.description,
        status: nextStatus,
      })
      ElMessage.success(nextStatus === 1 ? 'Mock 应用已启用' : 'Mock 应用已停用')
      await options.loadAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    } finally {
      options.saving.value = false
    }
  }

  async function removeEndpoint(row: MockEndpointItem) {
    try {
      await confirmDelete({
        title: '删除确认',
        message: `删除 Mock 接口「${row.endpointName}」会同时删除下属场景和调用日志。确认删除？`,
        confirmText: '确认删除',
      })
      await configApi.deleteMockEndpoint(options.workspaceCode.value, row.id)
      if (options.activeEndpointId.value === row.id) options.activeEndpointId.value = null
      ElMessage.success('已删除')
      await options.loadAll()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
    }
  }

  return {
    appDialogMode,
    appDialogVisible,
    appForm,
    endpointDialogMode,
    endpointDialogVisible,
    endpointForm,
    openCopyEndpointDialog,
    openCreateAppDialog,
    openCreateEndpointDialog,
    openEditAppDialog,
    openEditEndpointDialog,
    removeEndpoint,
    submitApplication,
    submitEndpoint,
    toggleApplication,
  }
}
