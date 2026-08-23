<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Sparkles } from '@lucide/vue'

import {
  aiProviderApi,
  type AiProviderConnectionItem,
  type AiProviderModelItem,
} from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'
import { confirmDelete } from '@/shared/ui'

import { createStatusPayload, getModelType, modelTypeVisuals } from './model'

const props = defineProps<{
  workspaceCode: string
  provider: AiProviderConnectionItem
}>()

const emit = defineEmits<{
  close: []
  changed: [provider: AiProviderConnectionItem]
}>()

const loading = ref(false)
const syncing = ref(false)
const probingModelName = ref('')
const changingDefaultModelName = ref('')
const changingSelectableModelName = ref('')
const errorMessage = ref('')
const models = ref<AiProviderModelItem[]>([])

const title = computed(() => `模型管理 — ${props.provider.connectionName}`)

async function loadModels() {
  loading.value = true
  errorMessage.value = ''
  try {
    models.value = await aiProviderApi.getProviderModels(props.workspaceCode, props.provider.id)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function syncModels() {
  syncing.value = true
  try {
    const result = await aiProviderApi.syncProviderModels(props.workspaceCode, props.provider.id)
    models.value = result.models
    if (result.message) {
      ElMessage.info(result.message)
    } else {
      ElMessage.success(`已同步 ${result.models.length} 个模型`)
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    syncing.value = false
  }
}

async function probeModel(model: AiProviderModelItem) {
  probingModelName.value = model.modelName
  try {
    const result = await aiProviderApi.probeProviderModel(props.workspaceCode, props.provider.id, {
      modelName: model.modelName,
    })
    const index = models.value.findIndex(item => item.modelName === result.modelName)
    if (index >= 0) models.value[index] = result
    ElMessage.success(`模型 ${model.modelName} 探测完成`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    probingModelName.value = ''
  }
}

async function setDefaultModel(model: AiProviderModelItem) {
  if (model.modelName === props.provider.modelName) return
  changingDefaultModelName.value = model.modelName
  try {
    const provider = await aiProviderApi.updateProviderConnection(
      props.workspaceCode,
      props.provider.id,
      {
        ...createStatusPayload(props.provider, props.provider.status),
        modelName: model.modelName,
      },
    )
    ElMessage.success(`默认模型已切换为 ${model.modelName}`)
    emit('changed', provider)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    changingDefaultModelName.value = ''
  }
}

async function toggleModel(model: AiProviderModelItem) {
  changingSelectableModelName.value = model.modelName
  try {
    const updated = await aiProviderApi.updateProviderModelStatus(
      props.workspaceCode,
      props.provider.id,
      model.id,
      !model.selectable,
    )
    const index = models.value.findIndex(item => item.id === model.id)
    if (index >= 0) models.value[index] = updated
    ElMessage.success(updated.selectable ? `模型 ${model.modelName} 已启用` : `模型 ${model.modelName} 已停用`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    changingSelectableModelName.value = ''
  }
}

async function deleteModel(model: AiProviderModelItem) {
  try {
    await confirmDelete({
      title: '删除 AI 模型',
      message: `确认删除模型「${model.displayName || model.modelName}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
      zIndex: 2300,
    })
    await aiProviderApi.deleteProviderModel(props.workspaceCode, props.provider.id, model.id)
    models.value = models.value.filter(item => item.id !== model.id)
    ElMessage.success(`模型 ${model.modelName} 已删除`)
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getRequestErrorMessage(error))
  }
}

function maxContextText(model: AiProviderModelItem) {
  const raw = model.rawMetadataJson || ''
  const matched = raw.match(/"?(?:max_context|maxContext|context_length|contextLength)"?\s*:\s*(\d+)/i)
  if (!matched) return '—'
  const value = Number(matched[1])
  return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
}

function supportText(model: AiProviderModelItem, key: 'image' | 'json') {
  if (!model.detectedCapabilities || typeof model.detectedCapabilities !== 'object') return false
  const capabilities = model.detectedCapabilities as Record<string, unknown>
  const value = capabilities[key === 'image' ? 'imageInput' : 'structuredOutput']
  if (value === true) return true
  return Boolean(value && typeof value === 'object' && (value as { supported?: unknown }).supported === true)
}

watch(
  () => props.provider.id,
  () => {
    void loadModels()
  },
)

onMounted(() => {
  void loadModels()
})
</script>

<template>
  <Teleport to="body">
    <div class="config-ai-model" @click.self="$emit('close')">
      <aside class="config-ai-model__drawer">
        <header class="config-ai-model__head">
          <div>
            <h3>{{ title }}</h3>
            <p>管理该连接下的可用模型列表</p>
          </div>
          <div class="config-ai-model__head-actions">
            <button class="config-ai-model__add" type="button" :disabled="syncing" @click="syncModels">
              <img :src="figmaConfigAiIcons.plus" alt="">
              {{ syncing ? '同步中' : '添加模型' }}
            </button>
            <button class="config-ai-model__icon-btn" type="button" aria-label="关闭" @click="$emit('close')">
              <img :src="figmaConfigAiIcons.drawer.close" alt="">
            </button>
          </div>
        </header>

        <div class="config-ai-model__body">
          <div v-if="errorMessage" class="config-ai-model__state">
            <p>{{ errorMessage }}</p>
            <button type="button" @click="loadModels">重试</button>
          </div>
          <div v-else-if="loading" class="config-ai-model__state">模型加载中...</div>
          <div v-else-if="models.length" class="config-ai-model-table">
            <table>
              <thead>
                <tr>
                  <th>模型名称</th>
                  <th>模型 ID</th>
                  <th>类型</th>
                  <th>最大上下文</th>
                  <th>图片</th>
                  <th>JSON</th>
                  <th>默认</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="model in models" :key="model.id">
                  <td>
                    <span class="config-ai-model-table__name">{{ model.displayName || model.modelName }}</span>
                    <span v-if="model.modelName === provider.modelName" class="config-ai-model-table__default-badge">默认</span>
                  </td>
                  <td class="is-mono">{{ model.modelName }}</td>
                  <td>
                    <span
                      class="config-ai-model-table__chip"
                      :style="{
                        color: modelTypeVisuals[getModelType(model)].color,
                        backgroundColor: `${modelTypeVisuals[getModelType(model)].color}18`,
                      }"
                    >
                      {{ modelTypeVisuals[getModelType(model)].label }}
                    </span>
                  </td>
                  <td>{{ maxContextText(model) }}</td>
                  <td class="is-center">
                    <img v-if="supportText(model, 'image')" :src="figmaConfigAiIcons.model.supportCheck" alt="">
                    <span v-else>—</span>
                  </td>
                  <td class="is-center">
                    <img v-if="supportText(model, 'json')" :src="figmaConfigAiIcons.model.supportCheck" alt="">
                    <span v-else>—</span>
                  </td>
                  <td>
                    <button
                      class="config-ai-toggle"
                      :class="{ 'is-on': model.modelName === provider.modelName }"
                      type="button"
                      :disabled="changingDefaultModelName === model.modelName || !model.selectable"
                      @click="setDefaultModel(model)"
                    >
                      <span />
                    </button>
                  </td>
                  <td>
                    <span class="config-ai-model-table__status">
                      <i :class="{ 'is-off': !model.selectable }" />
                      {{ model.selectable ? '启用' : '停用' }}
                    </span>
                  </td>
                  <td>
                    <div class="config-ai-model-table__actions">
                      <button
                        type="button"
                        title="测试"
                        :disabled="probingModelName === model.modelName"
                        @click="probeModel(model)"
                      >
                        <img :src="figmaConfigAiIcons.action.test" alt="">
                      </button>
                      <button
                        type="button"
                        :title="model.selectable ? '停用' : '启用'"
                        :disabled="changingSelectableModelName === model.modelName"
                        @click="toggleModel(model)"
                      >
                        <img :src="figmaConfigAiIcons.action.power" alt="">
                      </button>
                      <button type="button" title="删除" @click="deleteModel(model)">
                        <img :src="figmaConfigAiIcons.action.delete" alt="">
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="config-ai-model-empty">
            <Sparkles :size="28" aria-hidden="true" />
            <p>暂无模型</p>
            <span>点击「获取模型列表」自动拉取，或手动添加</span>
            <button class="config-ai-model-empty__refresh" type="button" :disabled="syncing" @click="syncModels">
              <img :src="figmaConfigAiIcons.refresh" alt="">
              获取模型列表
            </button>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.config-ai-model {
  position: fixed;
  z-index: 2100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.3);
}

.config-ai-model__drawer {
  display: flex;
  width: 720px;
  height: 100%;
  flex-direction: column;
  background: #ffffff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.config-ai-model__head {
  display: flex;
  box-sizing: border-box;
  min-height: 71.75px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 21px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-model__head h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.config-ai-model__head p {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-model__head-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.config-ai-model__add {
  display: inline-flex;
  box-sizing: border-box;
  width: 85.25px;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: #7816ff;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: filter 150ms, transform 150ms;
}

.config-ai-model__add:hover:not(:disabled) {
  filter: brightness(1.1);
}

.config-ai-model__add:active:not(:disabled) {
  transform: scale(.98);
}

.config-ai-model__add img {
  width: 13px;
  height: 13px;
}

.config-ai-model__icon-btn {
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
  transition: background-color 120ms ease, color 120ms ease;
}

.config-ai-model__icon-btn:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.config-ai-model__icon-btn:hover:not(:disabled) img {
  filter: brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1551%) hue-rotate(180deg) brightness(95%) contrast(91%);
}

.config-ai-model__icon-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-model__body {
  padding: 17.5px;
}

.config-ai-model__state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  color: #86909c;
  font-size: 13px;
}

.config-ai-model__state button {
  margin-left: 8px;
}

.config-ai-model-table {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
}

.config-ai-model-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-ai-model-table thead tr {
  height: 34.5px;
  background: #fafafa;
}

.config-ai-model-table th {
  padding: 0 10.5px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.275px;
}

.config-ai-model-table tbody tr {
  height: 48px;
  border-top: 1px solid #e5e6eb;
}

.config-ai-model-table td {
  padding: 0 10.5px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
  vertical-align: middle;
}

.config-ai-model-table th:nth-child(1),
.config-ai-model-table td:nth-child(1) {
  width: 110.375px;
}

.config-ai-model-table tbody tr:hover {
  background: #fafbff;
}

.config-ai-model-table th:nth-child(2),
.config-ai-model-table td:nth-child(2) {
  width: 98.796875px;
}

.config-ai-model-table th:nth-child(3),
.config-ai-model-table td:nth-child(3) {
  width: 77.046875px;
}

.config-ai-model-table th:nth-child(4),
.config-ai-model-table td:nth-child(4) {
  width: 81.671875px;
}

.config-ai-model-table th:nth-child(5),
.config-ai-model-table td:nth-child(5) {
  width: 45.96875px;
}

.config-ai-model-table th:nth-child(6),
.config-ai-model-table td:nth-child(6) {
  width: 55.34375px;
}

.config-ai-model-table th:nth-child(7),
.config-ai-model-table td:nth-child(7) {
  width: 51.71875px;
}

.config-ai-model-table th:nth-child(8),
.config-ai-model-table td:nth-child(8) {
  width: 58.578125px;
}

.config-ai-model-table th:nth-child(9),
.config-ai-model-table td:nth-child(9) {
  width: 103.5px;
}

.config-ai-model-table__name {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.config-ai-model-table__default-badge {
  margin-left: 7px;
  padding: 1.75px 5.25px;
  border-radius: 999px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 9px;
  font-weight: 700;
}

.config-ai-model-table .is-mono {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
}

.config-ai-model-table .is-center {
  color: #00b42a;
  text-align: center;
}

.config-ai-model-table .is-center img {
  width: 13px;
  height: 13px;
}

.config-ai-model-table__chip {
  display: inline-flex;
  height: 17px;
  align-items: center;
  padding: 0 6px;
  border-radius: 3.5px;
  font-size: 10px;
  font-weight: 500;
}

.config-ai-toggle {
  position: relative;
  width: 28px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
}

.config-ai-toggle span {
  position: absolute;
  top: 1.75px;
  left: 2px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #ffffff;
}

.config-ai-toggle.is-on {
  background: #165dff;
}

.config-ai-toggle.is-on span {
  left: 14px;
}

.config-ai-model-table__status {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
}

.config-ai-model-table__status i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
  background: #00b42a;
}

.config-ai-model-table__status i.is-off {
  background: #c9cdd4;
}

.config-ai-model-table__actions {
  display: flex;
  gap: 1.75px;
}

.config-ai-model-table__actions button {
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
  transition: background-color 120ms ease, filter 120ms ease;
}

.config-ai-model-table__actions button:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.config-ai-model-table__actions button:hover:not(:disabled) img {
  filter: brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1551%) hue-rotate(180deg) brightness(95%) contrast(91%);
}

.config-ai-model-table__actions button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.config-ai-model-table__actions img {
  width: 13px;
  height: 13px;
}

.config-ai-model-empty {
  display: flex;
  min-height: 192px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
}

.config-ai-model-empty p {
  margin: 12px 0 0;
  color: #4e5969;
  font-size: 14px;
  line-height: 21px;
}

.config-ai-model-empty span {
  margin-top: 4px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-model-empty__refresh {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
}

.config-ai-model-empty__refresh img {
  width: 12px;
  height: 12px;
}
</style>
