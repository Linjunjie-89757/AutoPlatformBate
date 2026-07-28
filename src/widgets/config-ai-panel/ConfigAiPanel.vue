<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'
import { confirmDelete } from '@/shared/ui'

import ConfigAiEditDrawer from './ConfigAiEditDrawer.vue'
import ConfigAiModelDrawer from './ConfigAiModelDrawer.vue'
import ConfigAiProviderPickerDrawer from './ConfigAiProviderPickerDrawer.vue'
import ConfigAiTestResultDialog from './ConfigAiTestResultDialog.vue'
import {
  capabilityVisuals,
  createStatusPayload,
  formatAiTime,
  getProviderType,
  getProviderVisual,
  providerPickerOrder,
  type AiCapability,
} from './model'

const props = withDefaults(defineProps<{
  workspaceCode?: string
}>(), {
  workspaceCode: 'ALL',
})

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
    if (statusFilter.value === 'error') return provider.status === 0 && provider.apiKeyConfigured === false
    if (statusFilter.value === 'disabled') return provider.status === 0 && provider.apiKeyConfigured
    return true
  })
})

const stats = computed(() => {
  const items = providers.value
  return [
    { label: '连接总数', value: items.length, color: '#1D2129', bg: '#F2F3F5' },
    { label: '正常连接', value: items.filter(item => item.status === 1).length, color: '#00B42A', bg: '#E8FFEA' },
    { label: '异常连接', value: items.filter(item => item.status === 0 && !item.apiKeyConfigured).length, color: '#F53F3F', bg: '#FFE8E8' },
    { label: '已停用', value: items.filter(item => item.status === 0 && item.apiKeyConfigured).length, color: '#86909C', bg: '#F2F3F5' },
  ]
})

const warningText = computed(() => {
  const missingKey = providers.value.filter(item => !item.apiKeyConfigured).length
  const errorCount = providers.value.filter(item => item.status === 0 && !item.apiKeyConfigured).length
  if (!missingKey && !errorCount) return ''
  return `${missingKey} 个连接未配置 API Key ${errorCount} 个连接状态异常`
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
      const models = await aiProviderApi.getProviderModels(props.workspaceCode, provider.id)
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
    const items = await aiProviderApi.getProviderConnections(props.workspaceCode)
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
      await aiProviderApi.updateProviderConnection(props.workspaceCode, editingProvider.value.id, payload)
      ElMessage.success('AI 连接已更新')
    } else {
      await aiProviderApi.createProviderConnection(props.workspaceCode, payload)
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
    const result = await aiProviderApi.testProviderConnection(props.workspaceCode, provider.id)
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
    const result = await aiProviderApi.previewProviderModels(props.workspaceCode, {
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
    await aiProviderApi.updateProviderStatus(props.workspaceCode, provider.id, createStatusPayload(provider, nextStatus))
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
      message: `确认删除 AI 连接「${provider.connectionName}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    await aiProviderApi.deleteProviderConnection(props.workspaceCode, provider.id)
    ElMessage.success('AI 连接已删除')
    await loadProviders()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

function openModels(provider: AiProviderConnectionItem) {
  modelProvider.value = provider
}

function getReviewModel(_provider: AiProviderConnectionItem) {
  return '—'
}

function getStatusMeta(provider: AiProviderConnectionItem) {
  if (provider.status === 1) return { label: '正常', color: '#4E5969', dot: '#00B42A' }
  if (!provider.apiKeyConfigured) return { label: '异常', color: '#F53F3F', dot: '#F53F3F' }
  return { label: '已停用', color: '#86909C', dot: '#C9CDD4' }
}

function getLastTestMeta(provider: AiProviderConnectionItem) {
  if (!provider.lastVerifiedAt) return { main: '从未测试', sub: '', failed: false }
  return { main: '✓ 成功', sub: formatAiTime(provider.lastVerifiedAt), failed: false }
}

async function handleModelProviderChanged(provider: AiProviderConnectionItem) {
  await loadProviders()
  modelProvider.value = providers.value.find(item => item.id === provider.id) || provider
}

watch(
  () => props.workspaceCode,
  () => {
    void loadProviders()
  },
)

onMounted(() => {
  void loadProviders()
})
</script>

<template>
  <section class="config-ai-panel">
    <header class="config-ai-panel__head">
      <div>
        <h2>AI 连接池</h2>
        <p>管理 AI 服务商连接、模型和调用用途绑定</p>
      </div>
      <div class="config-ai-panel__actions">
        <button class="config-ai-btn config-ai-btn--ghost" type="button" :disabled="loading" @click="loadProviders">
          <img :src="figmaConfigAiIcons.refresh" alt="">
          刷新
        </button>
        <button class="config-ai-btn config-ai-btn--primary" type="button" @click="openCreatePicker">
          <img :src="figmaConfigAiIcons.plus" alt="">
          新增连接
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="config-ai-panel__error">
      {{ errorMessage }}
      <button type="button" @click="loadProviders">重试</button>
    </div>

    <div class="config-ai-stats">
      <article v-for="item in stats" :key="item.label" class="config-ai-stat">
        <strong :style="{ color: item.color, backgroundColor: item.bg }">{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </div>

    <div class="config-ai-filters">
      <label class="config-ai-search">
        <img :src="figmaConfigAiIcons.search" alt="">
        <input v-model="searchKeyword" type="text" placeholder="搜索连接名称">
      </label>
      <select v-model="statusFilter">
        <option value="all">全部状态</option>
        <option value="normal">正常</option>
        <option value="error">异常</option>
        <option value="disabled">已停用</option>
      </select>
      <select v-model="providerFilter">
        <option value="all">全部服务商</option>
        <option v-for="item in providerPickerOrder" :key="item" :value="item">
          {{ getProviderVisual(item).label }}
        </option>
      </select>
    </div>

    <section class="config-ai-table-card">
      <div class="config-ai-table-wrap">
        <table class="config-ai-table">
          <thead>
            <tr>
              <th>连接 / 服务商</th>
              <th>默认模型</th>
              <th>API 地址</th>
              <th>Key</th>
              <th>支持能力</th>
              <th>绑定用途</th>
              <th>状态</th>
              <th>最近测试</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="provider in filteredProviders" :key="provider.id">
              <td>
                <div class="config-ai-conn">
                  <span
                    class="config-ai-conn__avatar"
                    :style="{
                      color: getProviderVisual(provider).color,
                      backgroundColor: getProviderVisual(provider).bg,
                    }"
                  >
                    <img v-if="getProviderVisual(provider).logoSrc" :src="getProviderVisual(provider).logoSrc" alt="">
                    <span v-else>{{ getProviderVisual(provider).initial }}</span>
                  </span>
                  <div>
                    <strong>{{ provider.connectionName }}</strong>
                    <span>{{ getProviderVisual(provider).label }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="config-ai-model-cell">
                  <strong>{{ provider.modelName || '-' }}</strong>
                  <span>{{ getReviewModel(provider) }}</span>
                </div>
              </td>
              <td>
                <span class="config-ai-api-url" :title="provider.baseUrl">{{ provider.baseUrl }}</span>
              </td>
              <td>
                <span class="config-ai-key" :class="{ 'is-missing': !provider.apiKeyConfigured }">
                  <img :src="provider.apiKeyConfigured ? figmaConfigAiIcons.key.configured : figmaConfigAiIcons.key.missing" alt="">
                  {{ provider.apiKeyConfigured ? '已配置' : '未配置' }}
                </span>
              </td>
              <td>
                <div class="config-ai-chips">
                  <span
                    v-for="capability in providerCapabilities[provider.id]"
                    :key="capability"
                    :style="{
                      color: capabilityVisuals[capability].color,
                      backgroundColor: capabilityVisuals[capability].bg,
                    }"
                  >
                    {{ capabilityVisuals[capability].label }}
                  </span>
                  <span v-if="!providerCapabilities[provider.id]?.length" class="config-ai-muted">未探测</span>
                </div>
              </td>
              <td>
                <span class="config-ai-muted">未绑定</span>
              </td>
              <td>
                <span class="config-ai-status" :style="{ color: getStatusMeta(provider).color }">
                  <i :style="{ backgroundColor: getStatusMeta(provider).dot }" />
                  {{ getStatusMeta(provider).label }}
                </span>
              </td>
              <td>
                <div class="config-ai-last-test" :class="{ 'is-failed': getLastTestMeta(provider).failed }">
                  <strong>{{ getLastTestMeta(provider).main }}</strong>
                  <span v-if="getLastTestMeta(provider).sub">{{ getLastTestMeta(provider).sub }}</span>
                </div>
              </td>
              <td>
                <div class="config-ai-row-actions">
                  <button type="button" title="测试连接" :disabled="testingId === provider.id" @click="testProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.test" alt="">
                  </button>
                  <button type="button" title="模型管理" @click="openModels(provider)">
                    <img :src="figmaConfigAiIcons.action.model" alt="">
                  </button>
                  <button type="button" title="编辑" @click="openEdit(provider)">
                    <img :src="figmaConfigAiIcons.action.edit" alt="">
                  </button>
                  <button type="button" title="启停" @click="toggleProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.power" alt="">
                  </button>
                  <button type="button" title="删除" @click="deleteProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.delete" alt="">
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredProviders.length">
              <td class="config-ai-table__empty" colspan="9">暂无 AI 连接</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="warningText" class="config-ai-warning">
        <img :src="figmaConfigAiIcons.warning" alt="">
        <span>{{ warningText }}</span>
      </div>
    </section>

    <section class="config-ai-usage-section" :class="{ 'is-open': usageBindOpen }">
      <button class="config-ai-usage-section__head" type="button" @click="usageBindOpen = !usageBindOpen">
        <span>
          <img :src="figmaConfigAiIcons.usage" alt="">
          <strong>AI 调用用途配置</strong>
          <em>5 个用途</em>
        </span>
        <img class="config-ai-usage-section__arrow" :src="figmaConfigAiIcons.chevronRight" alt="">
      </button>
      <div v-if="usageBindOpen" class="config-ai-usage-section__body">
        <p>为每种 AI 能力指定主模型和备用模型，当主模型不可用时自动切换到备用模型。</p>
        <table class="config-ai-usage-bind-table">
          <thead>
            <tr>
              <th>AI 能力</th>
              <th>主模型</th>
              <th>备用模型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usageBindingRows" :key="row.key">
              <td>
                <span class="config-ai-usage-bind-table__name">
                  <img :src="figmaConfigAiIcons.usage" alt="">
                  {{ row.label }}
                </span>
              </td>
              <td>
                <select :value="row.primary" disabled>
                  <option>{{ row.primary || '— 未指定 —' }}</option>
                </select>
              </td>
              <td>
                <select :value="row.backup" disabled>
                  <option>{{ row.backup || '— 未指定 —' }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="config-ai-usage-section__actions">
          <button type="button" @click="ElMessage.info('AI 调用用途绑定接口暂未接入')">
            <img :src="figmaConfigAiIcons.drawer.save" alt="">
            保存配置
          </button>
        </div>
      </div>
    </section>

    <ConfigAiProviderPickerDrawer
      v-if="pickerVisible"
      @close="pickerVisible = false"
      @select="selectProvider"
    />
    <ConfigAiEditDrawer
      v-if="editVisible"
      :mode="editMode"
      :workspace-code="workspaceCode"
      :provider-type="selectedProviderType"
      :provider="editingProvider"
      :saving="saving"
      :testing="testingId !== null"
      @close="editVisible = false"
      @back-to-picker="backToProviderPicker"
      @save="saveProvider"
      @test="testProviderDraft"
    />
    <ConfigAiModelDrawer
      v-if="modelProvider"
      :workspace-code="workspaceCode"
      :provider="modelProvider"
      @close="modelProvider = null"
      @changed="handleModelProviderChanged"
    />
    <ConfigAiTestResultDialog
      v-if="testResult"
      :result="testResult"
      :model-name="testResultModelName"
      :latency-text="testResultLatency"
      @close="testResult = null"
    />
  </section>
</template>

<style scoped>
.config-ai-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: 17.5px;
  background: #f4f6fa;
}

.config-ai-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-ai-panel__head h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.config-ai-panel__head p {
  margin: 1.75px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-panel__actions {
  display: flex;
  gap: 7px;
  align-items: center;
}

.config-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-ai-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-btn--ghost {
  height: 28px;
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.config-ai-btn--primary {
  height: 32px;
  padding: 0 14px;
  border: 0;
  background: #7816ff;
  color: #ffffff;
}

.config-ai-panel__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff1f0;
  color: #f53f3f;
  font-size: 12px;
}

.config-ai-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10.5px;
}

.config-ai-stat {
  display: flex;
  height: 61.5px;
  box-sizing: border-box;
  align-items: center;
  gap: 10.5px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.config-ai-stat strong {
  display: inline-flex;
  width: 31.5px;
  height: 31.5px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.config-ai-stat span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-filters {
  display: flex;
  align-items: center;
  gap: 7px;
}

.config-ai-search {
  position: relative;
  width: 200px;
  height: 28px;
}

.config-ai-search img {
  position: absolute;
  top: 8px;
  left: 10px;
  width: 12px;
  height: 12px;
}

.config-ai-search input,
.config-ai-filters select {
  box-sizing: border-box;
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #1d2129;
  font-size: 13px;
  outline: none;
}

.config-ai-search input {
  width: 100%;
  padding: 0 12px 0 31px;
}

.config-ai-filters select {
  width: 110px;
  padding: 0 10px;
}

.config-ai-filters select:last-child {
  width: 120px;
}

.config-ai-table-card {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.config-ai-table-wrap {
  overflow-x: auto;
}

.config-ai-table {
  width: 100%;
  min-width: 1416px;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-ai-table thead tr {
  height: 34.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.config-ai-table th {
  padding: 0 14px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.275px;
}

.config-ai-table tbody tr {
  height: 54px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-table tbody tr:last-child {
  border-bottom: 0;
}

.config-ai-table td {
  padding: 0 14px;
  vertical-align: middle;
}

.config-ai-table th:nth-child(1),
.config-ai-table td:nth-child(1) {
  width: 215px;
}

.config-ai-table th:nth-child(2),
.config-ai-table td:nth-child(2) {
  width: 210px;
}

.config-ai-table th:nth-child(3),
.config-ai-table td:nth-child(3) {
  width: 155px;
}

.config-ai-table th:nth-child(4),
.config-ai-table td:nth-child(4) {
  width: 110px;
}

.config-ai-table th:nth-child(5),
.config-ai-table td:nth-child(5) {
  width: 210px;
}

.config-ai-table th:nth-child(6),
.config-ai-table td:nth-child(6) {
  width: 95px;
}

.config-ai-table th:nth-child(7),
.config-ai-table td:nth-child(7) {
  width: 90px;
}

.config-ai-table th:nth-child(8),
.config-ai-table td:nth-child(8) {
  width: 130px;
}

.config-ai-table th:nth-child(9),
.config-ai-table td:nth-child(9) {
  width: 150px;
}

.config-ai-conn {
  display: flex;
  align-items: center;
  gap: 8.75px;
}

.config-ai-conn__avatar {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;
}

.config-ai-conn__avatar img {
  display: block;
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.config-ai-conn__avatar > span {
  color: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.config-ai-conn strong,
.config-ai-model-cell strong {
  display: block;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-ai-conn > div > span,
.config-ai-model-cell span {
  display: block;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.config-ai-api-url {
  display: block;
  overflow: hidden;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-ai-key {
  display: inline-flex;
  height: 20px;
  align-items: center;
  gap: 3.5px;
  padding: 0 7px;
  border-radius: 999px;
  background: #e8ffea;
  color: #00b42a;
  font-size: 11px;
  line-height: 16.5px;
}

.config-ai-key.is-missing {
  background: #fff3e8;
  color: #ff7d00;
}

.config-ai-key img {
  width: 10px;
  height: 10px;
}

.config-ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3.5px;
}

.config-ai-chips span {
  height: 17px;
  padding: 1px 6px;
  border-radius: 3.5px;
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.config-ai-usage-badge {
  display: inline-flex;
  height: 17.5px;
  align-items: center;
  padding: 0 7px;
  border-radius: 999px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 11px;
  line-height: 16.5px;
}

.config-ai-muted {
  color: #c9cdd4;
  font-size: 11px;
}

.config-ai-status {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-status i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
}

.config-ai-last-test strong {
  display: block;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.config-ai-last-test.is-failed strong {
  color: #f53f3f;
}

.config-ai-last-test span {
  display: block;
  color: #c9cdd4;
  font-size: 10px;
  line-height: 15px;
}

.config-ai-row-actions {
  display: flex;
  gap: 1.75px;
  align-items: center;
}

.config-ai-row-actions button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.config-ai-row-actions img {
  width: 13px;
  height: 13px;
}

.config-ai-warning {
  display: flex;
  align-items: center;
  gap: 8.75px;
  min-height: 40px;
  padding: 0 17.5px;
  border-top: 1px solid #e5e6eb;
  background: #fffbeb;
  color: #ff7d00;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-warning img {
  width: 13px;
  height: 13px;
}

.config-ai-usage-section {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.config-ai-usage-section__head {
  display: flex;
  width: 100%;
  height: 47.5px;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px;
  border: 0;
  background: #ffffff;
  cursor: pointer;
}

.config-ai-usage-section.is-open .config-ai-usage-section__head {
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-usage-section__head > span {
  display: flex;
  align-items: center;
  gap: 8.75px;
}

.config-ai-usage-section__head img {
  width: 15px;
  height: 15px;
}

.config-ai-usage-section__head strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.config-ai-usage-section__head em {
  padding: 1.75px 7px;
  border-radius: 999px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
}

.config-ai-usage-section__arrow {
  transition: transform 0.16s ease;
}

.config-ai-usage-section.is-open .config-ai-usage-section__arrow {
  transform: rotate(90deg);
}

.config-ai-usage-section__body {
  padding: 17.5px;
}

.config-ai-usage-section__body > p {
  margin: 0 0 14px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-usage-bind-table {
  width: 100%;
  border-collapse: collapse;
}

.config-ai-usage-bind-table th {
  height: 24px;
  padding: 0 14px 7px 0;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.275px;
}

.config-ai-usage-bind-table th:first-child,
.config-ai-usage-bind-table td:first-child {
  width: 180px;
}

.config-ai-usage-bind-table tr {
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-usage-bind-table tbody tr:last-child {
  border-bottom: 0;
}

.config-ai-usage-bind-table td {
  height: 50px;
  padding: 0 14px 0 0;
}

.config-ai-usage-bind-table__name {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-ai-usage-bind-table__name img {
  width: 12px;
  height: 12px;
}

.config-ai-usage-bind-table select {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
  opacity: 1;
}

.config-ai-usage-section__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.config-ai-usage-section__actions button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #7816ff;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-ai-usage-section__actions img {
  width: 13px;
  height: 13px;
}

@media (max-width: 1100px) {
  .config-ai-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
