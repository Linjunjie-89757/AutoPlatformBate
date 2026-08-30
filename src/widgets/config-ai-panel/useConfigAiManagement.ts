import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  aiProviderApi,
  type AiProviderConnectionItem,
  type AiProviderModelItem,
  type AiProviderTestResult,
  type AiProviderType,
  type SaveAiProviderConnectionPayload,
} from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'
import {
  createStatusPayload,
  formatAiTime,
  getProviderType,
  type AiCapability,
} from './model'

export function useConfigAiManagement(workspaceCode: Readonly<Ref<string>>) {
  const providers = ref<AiProviderConnectionItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const testingId = ref<number | null>(null)
  const errorMessage = ref('')
  const searchKeyword = ref('')
  const statusFilter = ref('all')
  const providerFilter = ref('all')
  const usageBindOpen = ref(false)
  const pickerVisible = ref(false)
  const editVisible = ref(false)
  const editMode = ref<'create' | 'edit'>('create')
  const selectedProviderType = ref<AiProviderType>('openai')
  const editingProvider = ref<AiProviderConnectionItem | null>(null)
  const modelProvider = ref<AiProviderConnectionItem | null>(null)
  const providerCapabilities = ref<Record<number, AiCapability[]>>({})
  const testResult = ref<AiProviderTestResult | null>(null)
  const testResultModelName = ref('')
  const testResultLatency = ref('-')

  const filteredProviders = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    return providers.value.filter((provider) => {
      if (keyword && !provider.connectionName.toLowerCase().includes(keyword)) return false
      if (providerFilter.value !== 'all' && getProviderType(provider) !== providerFilter.value) return false
      if (statusFilter.value === 'normal') return provider.status === 1
      if (statusFilter.value === 'error') return provider.status === 1 && (!provider.apiKeyConfigured || provider.lastTestStatus === 'FAILED')
      if (statusFilter.value === 'disabled') return provider.status === 0
      return true
    })
  })

  const stats = computed(() => {
    const items = providers.value
    const hasFailedTest = (item: AiProviderConnectionItem) => item.lastTestStatus === 'FAILED'
    return [
      { label: '连接总数', value: items.length, color: '#1D2129', bg: '#F2F3F5' },
      { label: '正常连接', value: items.filter(item => item.status === 1 && item.apiKeyConfigured && !hasFailedTest(item)).length, color: '#00B42A', bg: '#E8FFEA' },
      { label: '异常连接', value: items.filter(item => item.status === 1 && (!item.apiKeyConfigured || hasFailedTest(item))).length, color: '#F53F3F', bg: '#FFE8E8' },
      { label: '已停用', value: items.filter(item => item.status === 0).length, color: '#86909C', bg: '#F2F3F5' },
    ]
  })

  const warningText = computed(() => {
    const missingKey = providers.value.filter(item => !item.apiKeyConfigured).length
    const errorCount = providers.value.filter(item => item.status === 1 && (!item.apiKeyConfigured || item.lastTestStatus === 'FAILED')).length
    if (!missingKey && !errorCount) return ''
    return `${missingKey} 个连接未配置 API Key，${errorCount} 个连接状态异常`
  })

  const usageBindingRows = [
    { key: 'case-gen', label: '用例生成', primary: '', backup: '' },
    { key: 'case-review', label: '用例评审', primary: '', backup: '' },
    { key: 'fail-analysis', label: '失败分析', primary: '', backup: '' },
    { key: 'element-id', label: '元素识别', primary: '', backup: '' },
    { key: 'assert-suggest', label: '断言建议', primary: '', backup: '' },
  ]

  function isSupportedCapability(value: unknown) {
    if (value === true) return true
    if (!value || typeof value !== 'object') return false
    return (value as { supported?: unknown }).supported === true
  }

  function collectProviderCapabilities(models: AiProviderModelItem[]) {
    const result = new Set<AiCapability>()
    models.forEach((model) => {
      if (!model.detectedCapabilities || typeof model.detectedCapabilities !== 'object') return
      const capabilities = model.detectedCapabilities as Record<string, unknown>
      if (isSupportedCapability(capabilities.textChat)) result.add('text')
      if (isSupportedCapability(capabilities.imageInput)) result.add('vision')
      if (isSupportedCapability(capabilities.longContext)) result.add('long-ctx')
      if (isSupportedCapability(capabilities.structuredOutput)) result.add('json')
    })
    return Array.from(result)
  }

  async function loadProviderCapabilities(items: AiProviderConnectionItem[]) {
    const entries = await Promise.all(items.map(async (provider) => {
      try {
        const models = await aiProviderApi.getProviderModels(workspaceCode.value, provider.id)
        return [provider.id, collectProviderCapabilities(models)] as const
      } catch {
        return [provider.id, []] as const
      }
    }))
    providerCapabilities.value = Object.fromEntries(entries)
  }

  async function loadProviders() {
    loading.value = true
    errorMessage.value = ''
    try {
      const items = await aiProviderApi.getProviderConnections(workspaceCode.value)
      providers.value = items
      await loadProviderCapabilities(items)
    } catch (error) {
      errorMessage.value = getRequestErrorMessage(error)
    } finally {
      loading.value = false
    }
  }

  function openCreatePicker() {
    editingProvider.value = null
    editMode.value = 'create'
    pickerVisible.value = true
  }

  function selectProvider(providerType: AiProviderType) {
    selectedProviderType.value = providerType
    pickerVisible.value = false
    editVisible.value = true
  }

  function backToProviderPicker() {
    editVisible.value = false
    pickerVisible.value = true
  }

  function openEdit(provider: AiProviderConnectionItem) {
    editingProvider.value = provider
    selectedProviderType.value = getProviderType(provider)
    editMode.value = 'edit'
    editVisible.value = true
  }

  async function saveProvider(payload: SaveAiProviderConnectionPayload) {
    saving.value = true
    try {
      if (editMode.value === 'edit' && editingProvider.value) {
        await aiProviderApi.updateProviderConnection(workspaceCode.value, editingProvider.value.id, payload)
        ElMessage.success('AI 连接已更新')
      } else {
        await aiProviderApi.createProviderConnection(workspaceCode.value, payload)
        ElMessage.success('AI 连接已创建')
      }
      editVisible.value = false
      await loadProviders()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  async function testProvider(provider: AiProviderConnectionItem | null = editingProvider.value) {
    if (!provider) return
    testingId.value = provider.id
    const startedAt = performance.now()
    try {
      const result = await aiProviderApi.testProviderConnection(workspaceCode.value, provider.id)
      testResult.value = result
      testResultModelName.value = provider.modelName || '-'
      testResultLatency.value = `${Math.max(1, Math.round(performance.now() - startedAt))} ms`
      await loadProviders()
    } catch (error) {
      testResult.value = {
        success: false,
        connectionId: provider.id,
        connectionName: provider.connectionName,
        protocolType: provider.protocolType,
        message: getRequestErrorMessage(error),
        verifiedAt: new Date().toISOString(),
      }
      testResultModelName.value = provider.modelName || '-'
      testResultLatency.value = `${Math.max(1, Math.round(performance.now() - startedAt))} ms`
      await loadProviders()
    } finally {
      testingId.value = null
    }
  }

  async function testProviderDraft(payload: SaveAiProviderConnectionPayload) {
    if (editingProvider.value && !payload.apiKey) {
      const changed = payload.baseUrl !== editingProvider.value.baseUrl
        || payload.protocolType !== editingProvider.value.protocolType
        || payload.modelName !== editingProvider.value.modelName
      if (changed) {
        ElMessage.warning('未填写新 API Key，当前只能测试已保存配置，未保存修改不会参与本次测试')
      }
      await testProvider(editingProvider.value)
      return
    }
    if (!payload.apiKey) {
      ElMessage.warning('请先填写 API Key，再测试当前配置')
      return
    }

    testingId.value = editingProvider.value?.id ?? 0
    const startedAt = performance.now()
    try {
      const result = await aiProviderApi.previewProviderModels(workspaceCode.value, {
        protocolType: payload.protocolType,
        baseUrl: payload.baseUrl,
        requestTimeoutSeconds: payload.requestTimeoutSeconds,
        apiKey: payload.apiKey,
      })
      testResult.value = {
        success: true,
        connectionId: editingProvider.value?.id ?? 0,
        connectionName: payload.connectionName || '未保存连接',
        protocolType: payload.protocolType,
        message: result.message || `已从服务商获取 ${result.models.length} 个模型，当前配置可访问`,
        verifiedAt: result.fetchedAt || new Date().toISOString(),
      }
      testResultModelName.value = payload.modelName || result.models[0]?.modelName || '-'
      testResultLatency.value = `${Math.max(1, Math.round(performance.now() - startedAt))} ms`
    } catch (error) {
      testResult.value = {
        success: false,
        connectionId: editingProvider.value?.id ?? 0,
        connectionName: payload.connectionName || '未保存连接',
        protocolType: payload.protocolType,
        message: getRequestErrorMessage(error),
        verifiedAt: new Date().toISOString(),
      }
      testResultModelName.value = payload.modelName || '-'
      testResultLatency.value = `${Math.max(1, Math.round(performance.now() - startedAt))} ms`
    } finally {
      testingId.value = null
    }
  }

  async function toggleProvider(provider: AiProviderConnectionItem) {
    try {
      const nextStatus = provider.status === 1 ? 0 : 1
      await aiProviderApi.updateProviderStatus(workspaceCode.value, provider.id, createStatusPayload(provider, nextStatus))
      ElMessage.success(nextStatus === 1 ? 'AI 连接已启用' : 'AI 连接已停用')
      await loadProviders()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }

  async function deleteProvider(provider: AiProviderConnectionItem) {
    try {
      await confirmDelete({
        title: '删除 AI 连接',
        message: `确认删除「${provider.connectionName}」？删除后依赖该连接的 AI 能力将无法正常运行。`,
        confirmText: '确认删除',
        density: 'compact',
      })
      await aiProviderApi.deleteProviderConnection(workspaceCode.value, provider.id)
      ElMessage.success('AI 连接已删除')
      await loadProviders()
    } catch (error) {
      if (error !== 'cancel') ElMessage.error(getRequestErrorMessage(error))
    }
  }

  function openModels(provider: AiProviderConnectionItem) {
    modelProvider.value = provider
  }

  function getReviewModel(_provider: AiProviderConnectionItem) {
    return '—'
  }

  function getStatusMeta(provider: AiProviderConnectionItem) {
    if (provider.status === 0) return { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
    if (!provider.apiKeyConfigured || provider.lastTestStatus === 'FAILED') {
      return { label: '异常', color: '#F53F3F', dot: '#F53F3F' }
    }
    return { label: '正常', color: '#4E5969', dot: '#00B42A' }
  }

  function getLastTestMeta(provider: AiProviderConnectionItem) {
    if (provider.lastTestStatus === 'FAILED') {
      return { main: '✗ 失败', sub: formatAiTime(provider.lastTestAt), failed: true }
    }
    if (!provider.lastTestAt && !provider.lastVerifiedAt) return { main: '从未测试', sub: '', failed: false }
    return { main: '✓ 成功', sub: formatAiTime(provider.lastTestAt || provider.lastVerifiedAt), failed: false }
  }

  async function handleModelProviderChanged(provider: AiProviderConnectionItem) {
    await loadProviders()
    modelProvider.value = providers.value.find(item => item.id === provider.id) || provider
  }

  watch(workspaceCode, () => {
    void loadProviders()
  })

  onMounted(() => {
    void loadProviders()
  })

  return {
    providers,
    loading,
    saving,
    testingId,
    errorMessage,
    searchKeyword,
    statusFilter,
    providerFilter,
    usageBindOpen,
    pickerVisible,
    editVisible,
    editMode,
    selectedProviderType,
    editingProvider,
    modelProvider,
    providerCapabilities,
    testResult,
    testResultModelName,
    testResultLatency,
    filteredProviders,
    stats,
    warningText,
    usageBindingRows,
    loadProviders,
    openCreatePicker,
    selectProvider,
    backToProviderPicker,
    openEdit,
    saveProvider,
    testProvider,
    testProviderDraft,
    toggleProvider,
    deleteProvider,
    openModels,
    getReviewModel,
    getStatusMeta,
    getLastTestMeta,
    handleModelProviderChanged,
  }
}
