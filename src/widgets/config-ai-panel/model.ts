import type {
  AiProviderConnectionItem,
  AiProviderModelItem,
  AiProviderStatus,
  AiProviderType,
  SaveAiProviderConnectionPayload,
  UpdateAiProviderStatusPayload,
} from '@/entities/ai-provider'
import anthropicLogo from '@/entities/ai-provider/assets/anthropic.svg'
import azureLogo from '@/entities/ai-provider/assets/azure.svg'
import customLogo from '@/entities/ai-provider/assets/custom.svg'
import deepseekLogo from '@/entities/ai-provider/assets/deepseek.svg'
import googleLogo from '@/entities/ai-provider/assets/google.svg'
import kimiLogo from '@/entities/ai-provider/assets/kimi.svg'
import minimaxLogo from '@/entities/ai-provider/assets/minimax.svg'
import ollamaLogo from '@/entities/ai-provider/assets/ollama.svg'
import openaiLogo from '@/entities/ai-provider/assets/openai.svg'
import qwenLogo from '@/entities/ai-provider/assets/qwen.svg'
import xiaomiLogo from '@/entities/ai-provider/assets/xiaomi.svg'
import zhipuLogo from '@/entities/ai-provider/assets/zhipu.svg'

export type AiCapability = 'text' | 'vision' | 'long-ctx' | 'json'
export type AiUsage = 'case-gen' | 'case-review' | 'fail-analysis' | 'element-id' | 'assert-suggest'
export type AiModelType = 'generate' | 'review' | 'vision' | 'embedding'

export interface ProviderVisualConfig {
  label: string
  color: string
  bg: string
  initial: string
  logoSrc: string
  baseUrl: string
  models: string[]
  description: string
}

export interface AiConnectionFormState {
  providerType: AiProviderType
  connectionName: string
  baseUrl: string
  apiKey: string
  modelName: string
  reviewModelName: string
  requestTimeoutSeconds: number
  maxRetry: number
  status: AiProviderStatus
  capabilities: AiCapability[]
  usages: AiUsage[]
}

export const AI_ACCENT = '#7816FF'

export const providerVisuals: Record<AiProviderType, ProviderVisualConfig> = {
  openai: {
    label: 'OpenAI',
    color: '#10A37F',
    bg: '#E8FFF9',
    initial: 'O',
    logoSrc: openaiLogo,
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    description: 'GPT-4o、GPT-4 Turbo 等模型',
  },
  anthropic: {
    label: 'Anthropic',
    color: '#CF5600',
    bg: '#FFF3E8',
    initial: 'A',
    logoSrc: anthropicLogo,
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    description: 'Claude 3.5 Sonnet、Claude 3 Opus',
  },
  google: {
    label: 'Google',
    color: '#4285F4',
    bg: '#E8F3FF',
    initial: 'G',
    logoSrc: googleLogo,
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    description: 'Gemini 1.5 Pro、Gemini Flash',
  },
  deepseek: {
    label: 'DeepSeek',
    color: '#1E40AF',
    bg: '#EFF6FF',
    initial: 'D',
    logoSrc: deepseekLogo,
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek-V3、DeepSeek-R1',
  },
  qwen: {
    label: '通义千问',
    color: '#FF6A00',
    bg: '#FFF5EB',
    initial: '千',
    logoSrc: qwenLogo,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    description: 'Qwen-Max、Qwen-Plus、Qwen-Turbo',
  },
  azure: {
    label: 'Azure',
    color: '#0078D4',
    bg: '#E8F4FF',
    initial: 'Az',
    logoSrc: azureLogo,
    baseUrl: 'https://{resource}.openai.azure.com',
    models: ['gpt-4o', 'gpt-4-turbo'],
    description: '微软 Azure 托管的 OpenAI 模型',
  },
  minimax: {
    label: 'MiniMax',
    color: '#E91E8C',
    bg: '#FFE8F5',
    initial: 'M',
    logoSrc: minimaxLogo,
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5-chat'],
    description: 'MiniMax-Text、abab 系列',
  },
  zhipu: {
    label: '智谱 AI',
    color: '#5C6BC0',
    bg: '#ECEFF8',
    initial: '智',
    logoSrc: zhipuLogo,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash'],
    description: 'GLM-4、GLM-4-Flash 系列',
  },
  kimi: {
    label: 'Kimi',
    color: '#1C1C1C',
    bg: '#F5F5F5',
    initial: 'K',
    logoSrc: kimiLogo,
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    description: 'Moonshot AI，擅长长文本理解',
  },
  ollama: {
    label: 'Ollama',
    color: '#555555',
    bg: '#F2F3F5',
    initial: 'Ol',
    logoSrc: ollamaLogo,
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'mistral', 'qwen2'],
    description: '本地部署的开源大模型',
  },
  custom: {
    label: '自定义',
    color: '#6B7280',
    bg: '#F2F3F5',
    initial: '*',
    logoSrc: customLogo,
    baseUrl: '',
    models: ['custom-model'],
    description: '支持 OpenAI API 规范的其它供应商',
  },
  xiaomi: {
    label: '小米 / MiMo',
    color: '#FF6900',
    bg: '#FFF3E8',
    initial: 'Mi',
    logoSrc: xiaomiLogo,
    baseUrl: 'https://api.mimo.xiaomi.com/v1',
    models: ['mimo-7b', 'mimo-7b-rl'],
    description: 'MiMo 推理模型',
  },
}

export const providerPickerOrder: AiProviderType[] = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'qwen',
  'azure',
  'minimax',
  'zhipu',
  'kimi',
  'ollama',
  'custom',
]

export const capabilityVisuals: Record<AiCapability, { label: string; color: string; bg: string }> = {
  text: { label: '文本', color: '#165DFF', bg: '#E8F3FF' },
  vision: { label: '视觉', color: AI_ACCENT, bg: '#F5E8FF' },
  'long-ctx': { label: '长上下文', color: '#00B42A', bg: '#E8FFEA' },
  json: { label: 'JSON', color: '#FF7D00', bg: '#FFF3E8' },
}

export const usageLabels: Record<AiUsage, string> = {
  'case-gen': '用例生成',
  'case-review': '用例评审',
  'fail-analysis': '失败分析',
  'element-id': '元素识别',
  'assert-suggest': '断言建议',
}

export const modelTypeVisuals: Record<AiModelType, { label: string; color: string }> = {
  generate: { label: '生成模型', color: '#165DFF' },
  review: { label: '评审模型', color: AI_ACCENT },
  vision: { label: '视觉模型', color: '#00B42A' },
  embedding: { label: '向量模型', color: '#FF7D00' },
}

export function getProviderType(provider: AiProviderConnectionItem | null | undefined): AiProviderType {
  return provider?.providerType || inferProviderType(provider?.baseUrl, provider?.connectionName)
}

export function inferProviderType(baseUrl = '', connectionName = ''): AiProviderType {
  const value = `${baseUrl} ${connectionName}`.toLowerCase()
  if (value.includes('anthropic') || value.includes('claude')) return 'anthropic'
  if (value.includes('google') || value.includes('gemini')) return 'google'
  if (value.includes('deepseek')) return 'deepseek'
  if (value.includes('dashscope') || value.includes('qwen') || value.includes('通义')) return 'qwen'
  if (value.includes('azure')) return 'azure'
  if (value.includes('minimax')) return 'minimax'
  if (value.includes('zhipu') || value.includes('glm') || value.includes('智谱')) return 'zhipu'
  if (value.includes('moonshot') || value.includes('kimi')) return 'kimi'
  if (value.includes('ollama') || value.includes('localhost:11434')) return 'ollama'
  if (value.includes('xiaomi') || value.includes('mimo')) return 'xiaomi'
  if (value.includes('openai') || value.includes('gpt-')) return 'openai'
  return 'custom'
}

export function getProviderVisual(provider: AiProviderConnectionItem | AiProviderType | null | undefined) {
  const type = typeof provider === 'string' ? provider : getProviderType(provider)
  return providerVisuals[type] || providerVisuals.custom
}

export function getFallbackCapabilities(provider: AiProviderConnectionItem | null | undefined): AiCapability[] {
  const type = getProviderType(provider)
  if (type === 'openai') return ['text', 'vision', 'long-ctx', 'json']
  if (type === 'anthropic') return ['text', 'long-ctx', 'json']
  if (type === 'qwen') return ['text', 'vision']
  if (type === 'deepseek') return ['text', 'json']
  return ['text']
}

export function getFallbackUsages(provider: AiProviderConnectionItem | null | undefined): AiUsage[] {
  const type = getProviderType(provider)
  if (type === 'openai') return ['case-gen', 'case-review', 'assert-suggest']
  if (type === 'anthropic') return ['fail-analysis']
  if (type === 'deepseek') return ['case-gen']
  return []
}

export function createFormState(
  _workspaceCode: string,
  providerType: AiProviderType,
  provider?: AiProviderConnectionItem | null,
): AiConnectionFormState {
  const visual = providerVisuals[providerType]
  const modelName = provider?.modelName || visual.models[0] || ''
  const reviewModelName = providerType === 'openai'
    ? 'gpt-4o-mini'
    : modelName

  return {
    providerType,
    connectionName: provider?.connectionName || '',
    baseUrl: provider?.baseUrl || visual.baseUrl,
    apiKey: '',
    modelName,
    reviewModelName,
    requestTimeoutSeconds: provider?.requestTimeoutSeconds || 30,
    maxRetry: 3,
    status: provider?.status ?? 1,
    capabilities: getFallbackCapabilities(provider || { providerType } as AiProviderConnectionItem),
    usages: getFallbackUsages(provider || { providerType } as AiProviderConnectionItem),
  }
}

export function buildSavePayload(
  workspaceCode: string,
  form: AiConnectionFormState,
  includeApiKey: boolean,
): SaveAiProviderConnectionPayload {
  const payload: SaveAiProviderConnectionPayload = {
    workspaceCode: workspaceCode || 'ALL',
    providerType: form.providerType,
    connectionName: form.connectionName.trim(),
    protocolType: form.providerType === 'azure' ? 'AZURE_OPENAI' : 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: form.baseUrl.trim(),
    requestTimeoutSeconds: form.requestTimeoutSeconds,
    modelName: form.modelName.trim(),
    status: form.status,
  }

  if (includeApiKey) {
    payload.apiKey = form.apiKey.trim() || null
  }

  return payload
}

export function createStatusPayload(
  provider: AiProviderConnectionItem,
  status: AiProviderStatus,
): UpdateAiProviderStatusPayload {
  return {
    workspaceCode: provider.workspaceCode || 'ALL',
    providerType: getProviderType(provider),
    connectionName: provider.connectionName,
    protocolType: provider.protocolType || 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: provider.baseUrl,
    requestTimeoutSeconds: provider.requestTimeoutSeconds,
    modelName: provider.modelName,
    status,
  }
}

export function formatAiTime(value: string | null | undefined) {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 16)
}

export function getModelType(model: AiProviderModelItem, index: number): AiModelType {
  const name = `${model.modelName} ${model.displayName || ''}`.toLowerCase()
  if (name.includes('embedding')) return 'embedding'
  if (name.includes('vision') || name.includes('vl')) return 'vision'
  if (index === 1) return 'review'
  return 'generate'
}
