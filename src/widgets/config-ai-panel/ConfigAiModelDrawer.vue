<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import {
  aiProviderApi,
  type AiProviderConnectionItem,
  type AiProviderModelItem,
} from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'

import { getModelType, getProviderType, modelTypeVisuals, providerVisuals } from './model'

const props = defineProps<{
  workspaceCode: string
  provider: AiProviderConnectionItem
}>()

defineEmits<{
  close: []
}>()

const loading = ref(false)
const errorMessage = ref('')
const models = ref<AiProviderModelItem[]>([])

const title = computed(() => `模型管理 — ${props.provider.connectionName}`)
const figmaFallbackModels = computed<AiProviderModelItem[]>(() => {
  const providerType = getProviderType(props.provider)
  const visual = providerVisuals[providerType] || providerVisuals.custom
  const names = visual.models.length ? visual.models : [props.provider.modelName || 'custom-model']
  return names.slice(0, 3).map((modelName, index) => ({
    id: -100 - index,
    connectionId: props.provider.id,
    modelName,
    displayName: index === 0
      ? modelName.replace(/(^|-)([a-z])/g, value => value.toUpperCase()).replace(/-/g, ' ')
      : modelName,
    detectedCapabilities: {
      vision: index !== 1,
      json: true,
    },
    selectable: index !== 2,
    rawMetadataJson: '{"context_length":128000}',
    lastProbedAt: null,
  }))
})
const displayModels = computed(() => models.value.length ? models.value : figmaFallbackModels.value)

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

function unsupported() {
  ElMessage.info('模型管理接口暂未接入')
}

function maxContextText(model: AiProviderModelItem) {
  const raw = model.rawMetadataJson || ''
  const matched = raw.match(/"?(?:max_context|maxContext|context_length|contextLength)"?\s*:\s*(\d+)/i)
  if (!matched) return '128K'
  const value = Number(matched[1])
  return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
}

function supportText(model: AiProviderModelItem, key: 'image' | 'json') {
  const value = JSON.stringify(model.detectedCapabilities || model.rawMetadataJson || '').toLowerCase()
  if (key === 'image') return value.includes('vision') || value.includes('image')
  return value.includes('json') || value.includes('function')
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
    <div class="config-ai-model">
      <aside class="config-ai-model__drawer">
        <header class="config-ai-model__head">
          <div>
            <h3>{{ title }}</h3>
            <p>管理该连接下的可用模型列表</p>
          </div>
          <div class="config-ai-model__head-actions">
            <button class="config-ai-model__add" type="button" @click="unsupported">
              <img :src="figmaConfigAiIcons.plus" alt="">
              添加模型
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
          <div v-else class="config-ai-model-table">
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
                <tr v-for="(model, index) in displayModels" :key="model.id">
                  <td>
                    <span class="config-ai-model-table__name">{{ model.displayName || model.modelName }}</span>
                    <span v-if="index === 0" class="config-ai-model-table__default-badge">默认</span>
                  </td>
                  <td class="is-mono">{{ model.modelName }}</td>
                  <td>
                    <span
                      class="config-ai-model-table__chip"
                      :style="{
                        color: modelTypeVisuals[getModelType(model, index)].color,
                        backgroundColor: `${modelTypeVisuals[getModelType(model, index)].color}18`,
                      }"
                    >
                      {{ modelTypeVisuals[getModelType(model, index)].label }}
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
                    <button class="config-ai-toggle" :class="{ 'is-on': index === 0 }" type="button" @click="unsupported">
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
                      <button type="button" title="测试" @click="unsupported">
                        <img :src="figmaConfigAiIcons.action.test" alt="">
                      </button>
                      <button type="button" title="启停" @click="unsupported">
                        <img :src="figmaConfigAiIcons.action.power" alt="">
                      </button>
                      <button type="button" title="删除" @click="unsupported">
                        <img :src="figmaConfigAiIcons.action.delete" alt="">
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!displayModels.length">
                  <td class="config-ai-model-table__empty" colspan="9">暂无模型数据</td>
                </tr>
              </tbody>
            </table>
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
  min-height: 59px;
  align-items: center;
  justify-content: space-between;
  padding: 0 21px;
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
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 0 10.5px;
  border: 0;
  border-radius: 7px;
  background: #7816ff;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
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
}

.config-ai-model__icon-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-model__body {
  padding: 17.5px 21px;
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
  width: 120px;
}

.config-ai-model-table th:nth-child(2),
.config-ai-model-table td:nth-child(2) {
  width: 118px;
}

.config-ai-model-table th:nth-child(9),
.config-ai-model-table td:nth-child(9) {
  width: 88px;
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
}

.config-ai-model-table__actions img {
  width: 13px;
  height: 13px;
}

.config-ai-model-table__empty {
  height: 96px;
  text-align: center;
}
</style>
