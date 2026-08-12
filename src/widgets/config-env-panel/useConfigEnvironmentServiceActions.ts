import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import type { ConfigEnvForm, ConfigEnvServiceEndpointForm } from '@/features/config-env-create-edit'
import { confirmDelete } from '@/shared/ui/app-delete-confirm/confirmDelete'

import { createServiceEditor } from './configEnvironmentPanel.view'
import type { ServiceTestState } from './configEnvironmentPanel.types'

type SaveCurrentForm = (successMessage?: string, options?: { reload?: boolean }) => Promise<boolean>

export function useConfigEnvironmentServiceActions(form: ConfigEnvForm, saveCurrentForm: SaveCurrentForm) {
  const serviceDialogVisible = ref(false)
  const serviceEditingIndex = ref<number | null>(null)
  const serviceTests = ref<Record<string, ServiceTestState>>({})
  const serviceEditor = reactive(createServiceEditor())

  function resetServiceTests() {
    serviceTests.value = {}
  }

  function openAddService() {
    serviceEditingIndex.value = null
    Object.assign(serviceEditor, createServiceEditor())
    serviceEditor.key = `service-${Date.now()}`
    serviceDialogVisible.value = true
  }

  function openEditService(index: number) {
    const service = form.services[index]
    if (!service) return
    serviceEditingIndex.value = index
    Object.assign(serviceEditor, createServiceEditor(service, service.key === form.defaultServiceKey))
    serviceDialogVisible.value = true
  }

  function closeServiceDialog() {
    serviceDialogVisible.value = false
    serviceEditingIndex.value = null
  }

  async function submitService() {
    if (!serviceEditor.name.trim()) {
      ElMessage.warning('请输入服务名称')
      return
    }
    if (!/^https?:\/\//i.test(serviceEditor.baseUrl.trim())) {
      ElMessage.warning('Base URL 必须以 http:// 或 https:// 开头')
      return
    }
    const next: ConfigEnvServiceEndpointForm = {
      key: serviceEditor.key || `service-${Date.now()}`,
      name: serviceEditor.name.trim(),
      baseUrl: serviceEditor.baseUrl.trim(),
      timeoutMs: Math.min(120000, Math.max(1000, Number(serviceEditor.timeoutMs) || 30000)),
      enabled: serviceEditor.enabled,
    }
    if (serviceEditingIndex.value == null) form.services.push(next)
    else form.services.splice(serviceEditingIndex.value, 1, next)
    if (serviceEditor.isDefault || form.services.length === 1) {
      form.defaultServiceKey = next.key
      form.baseUrl = next.baseUrl
    }
    const saved = await saveCurrentForm(serviceEditingIndex.value == null ? '服务已添加' : '服务已更新')
    if (saved) closeServiceDialog()
  }

  async function copyService(index: number) {
    const source = form.services[index]
    if (!source) return
    form.services.splice(index + 1, 0, {
      ...source,
      key: `service-${Date.now()}`,
      name: `副本 - ${source.name}`,
    })
    await saveCurrentForm('服务已复制')
  }

  async function removeService(index: number) {
    const service = form.services[index]
    if (!service) return
    try {
      await confirmDelete({
        title: '删除服务',
        message: `确认删除服务「${service.name}」吗？`,
        confirmText: '确认删除',
      })
    } catch {
      return
    }
    form.services.splice(index, 1)
    if (service.key === form.defaultServiceKey) {
      form.defaultServiceKey = form.services[0]?.key || 'default'
      form.baseUrl = form.services[0]?.baseUrl || ''
    }
    await saveCurrentForm('服务已删除')
  }

  function testConnection(service?: ConfigEnvServiceEndpointForm) {
    const key = service?.key || serviceEditor.key || 'draft'
    serviceTests.value = { ...serviceTests.value, [key]: 'testing' }
    window.setTimeout(() => {
      serviceTests.value = { ...serviceTests.value, [key]: 'untested' }
      ElMessage.warning('服务连接测试接口暂未接入，未伪造测试结果')
    }, 450)
  }

  function batchTestConnections() {
    ElMessage.warning('批量连接测试接口暂未接入，未伪造测试结果')
  }

  function serviceStatus(service: ConfigEnvServiceEndpointForm) {
    return serviceTests.value[service.key] || 'untested'
  }

  function formatTimeout(timeoutMs: number) {
    return `${Math.round(timeoutMs / 1000)}s`
  }

  return {
    serviceDialogVisible,
    serviceEditingIndex,
    serviceEditor,
    resetServiceTests,
    openAddService,
    openEditService,
    closeServiceDialog,
    submitService,
    copyService,
    removeService,
    testConnection,
    batchTestConnections,
    serviceStatus,
    formatTimeout,
  }
}
