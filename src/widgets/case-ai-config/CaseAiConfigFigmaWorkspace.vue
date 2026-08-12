<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import aiConfigCheck from '@/shared/assets/figma-icons/case-center/ai-config-check.svg'
import aiConfigChevron from '@/shared/assets/figma-icons/case-center/ai-config-chevron.svg'
import aiConfigConnectionCheck from '@/shared/assets/figma-icons/case-center/ai-config-connection-check.svg'
import aiConfigExternalLink from '@/shared/assets/figma-icons/case-center/ai-config-external-link.svg'
import aiConfigModel from '@/shared/assets/figma-icons/case-center/ai-config-model.svg'
import aiConfigParameter from '@/shared/assets/figma-icons/case-center/ai-config-parameter.svg'
import aiConfigPrompt from '@/shared/assets/figma-icons/case-center/ai-config-prompt.svg'
import aiConfigSave from '@/shared/assets/figma-icons/case-center/ai-config-save.svg'
import aiConfigStatusCheck from '@/shared/assets/figma-icons/case-center/ai-config-status-check.svg'

type RoleType = 'CASE_GENERATOR' | 'CASE_REVIEWER'
type PromptTab = 'generator' | 'reviewer'
type CaseTypeKey = 'functional' | 'boundary' | 'exception' | 'security' | 'performance'

interface ModelOption {
  key: string
  providerId: number
  providerName: string
  providerType: string | null
  modelName: string
  displayName: string
}

interface Props {
  loading: boolean
  saving: boolean
  workspaceReady: boolean
  configComplete: boolean
  modelOptions: ModelOption[]
  generatorModelKey: string
  reviewerModelKey: string
  generatorPrompt: string
  reviewerPrompt: string
  defaultGeneratorPrompt: string
  defaultReviewerPrompt: string
  maxCases: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'manage-connections': []
  'save': []
  'select-model': [payload: { role: RoleType, key: string }]
  'update-prompt': [payload: { role: RoleType, value: string }]
  'update:max-cases': [value: number]
}>()

const promptTab = ref<PromptTab>('generator')
const useDefaultPrompt = reactive<Record<PromptTab, boolean>>({
  generator: true,
  reviewer: true,
})
const caseTypes = reactive<Record<CaseTypeKey, boolean>>({
  functional: true,
  boundary: true,
  exception: true,
  security: true,
  performance: false,
})
const language = ref<'zh' | 'en'>('zh')

const promptVariables: Record<PromptTab, string[]> = {
  generator: ['{requirement_title}', '{requirement_desc}', '{expected_count}', '{language}', '{save_path}'],
  reviewer: ['{case_title}', '{case_steps}', '{case_expected}', '{case_type}', '{case_priority}'],
}

const caseTypeOptions: Array<{ key: CaseTypeKey, label: string, description: string }> = [
  { key: 'functional', label: '功能测试', description: '核心业务流程验证' },
  { key: 'boundary', label: '边界测试', description: '边界值与极限场景' },
  { key: 'exception', label: '异常测试', description: '错误处理与容错' },
  { key: 'security', label: '安全测试', description: '权限与安全校验' },
  { key: 'performance', label: '性能测试', description: '响应时间与并发' },
]

const generatorOption = computed(() => props.modelOptions.find(item => item.key === props.generatorModelKey) ?? null)
const reviewerOption = computed(() => props.modelOptions.find(item => item.key === props.reviewerModelKey) ?? null)
const currentPrompt = computed(() => promptTab.value === 'generator' ? props.generatorPrompt : props.reviewerPrompt)
const currentVariables = computed(() => promptVariables[promptTab.value])
watch(
  () => props.generatorPrompt,
  (value) => {
    if (value && value !== props.defaultGeneratorPrompt) {
      useDefaultPrompt.generator = false
    }
  },
  { immediate: true },
)

watch(
  () => props.reviewerPrompt,
  (value) => {
    if (value && value !== props.defaultReviewerPrompt) {
      useDefaultPrompt.reviewer = false
    }
  },
  { immediate: true },
)

function providerLabel(option: ModelOption | null) {
  if (!option) return ''
  const providerType = option.providerType?.toLowerCase() ?? ''
  if (providerType === 'openai') return 'OpenAI'
  if (providerType === 'anthropic') return 'Anthropic'
  if (providerType === 'deepseek') return 'DeepSeek'
  if (providerType === 'qwen') return 'Qwen'
  if (providerType === 'google') return 'Google'
  return option.providerName
}

function supportsImage(option: ModelOption | null) {
  const type = option?.providerType?.toLowerCase() ?? ''
  return type === 'openai' || type === 'google' || option?.modelName.toLowerCase().includes('vision')
}

function modelSummary(option: ModelOption | null, fallback: string) {
  return option?.providerName || option?.modelName || fallback
}

function handleModelChange(role: RoleType, event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  emit('select-model', { role, key: target.value })
}

function toggleDefaultPrompt(tab: PromptTab) {
  const nextValue = !useDefaultPrompt[tab]
  useDefaultPrompt[tab] = nextValue
  if (nextValue) {
    emit('update-prompt', {
      role: tab === 'generator' ? 'CASE_GENERATOR' : 'CASE_REVIEWER',
      value: tab === 'generator' ? props.defaultGeneratorPrompt : props.defaultReviewerPrompt,
    })
  }
}

function handlePromptInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  useDefaultPrompt[promptTab.value] = false
  emit('update-prompt', {
    role: promptTab.value === 'generator' ? 'CASE_GENERATOR' : 'CASE_REVIEWER',
    value: target.value,
  })
}

function appendVariable(variable: string) {
  if (useDefaultPrompt[promptTab.value]) return
  const separator = currentPrompt.value && !currentPrompt.value.endsWith('\n') ? '\n' : ''
  emit('update-prompt', {
    role: promptTab.value === 'generator' ? 'CASE_GENERATOR' : 'CASE_REVIEWER',
    value: `${currentPrompt.value}${separator}${variable}`,
  })
}

function updateMaxCases(value: number) {
  emit('update:max-cases', Math.min(200, Math.max(5, value)))
}
</script>

<template>
  <section class="figma-ai-config">
    <header class="figma-ai-config__status-bar">
      <div class="figma-ai-config__status-copy" :class="{ 'is-warning': !configComplete }">
        <img v-if="configComplete" class="figma-ai-config__status-icon" :src="aiConfigStatusCheck" alt="">
        <span v-else class="figma-ai-config__warning-dot" aria-hidden="true" />
        <span class="figma-ai-config__status-title">
          {{ configComplete ? '当前配置完整，可正常生成用例' : '配置不完整，请选择可用的生成和评审模型' }}
        </span>
        <span v-if="configComplete" class="figma-ai-config__status-summary">
          生成：<strong>{{ modelSummary(generatorOption, '生成模型') }}</strong>
          · 评审：<strong>{{ modelSummary(reviewerOption, '评审模型') }}</strong>
        </span>
      </div>

      <div class="figma-ai-config__status-actions">
        <button type="button" class="figma-ai-config__pool-button" @click="emit('manage-connections')">
          <img :src="aiConfigExternalLink" alt="">
          管理 AI 连接池
        </button>
        <button
          type="button"
          class="figma-ai-config__save-button figma-ai-config__save-button--top"
          :disabled="saving || !workspaceReady || !configComplete"
          @click="emit('save')"
        >
          <img :src="aiConfigSave" alt="">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </header>

    <main class="figma-ai-config__body">
      <div v-if="loading" class="figma-ai-config__loading" aria-label="正在加载 AI 配置">
        <span />
        <span />
        <span />
      </div>

      <div v-else-if="!workspaceReady" class="figma-ai-config__empty">
        当前未选择工作区，请先选择工作区后再配置 AI 模型。
      </div>

      <div v-else class="figma-ai-config__content">
        <section class="figma-ai-config__card figma-ai-config__model-card">
          <header class="figma-ai-config__card-header">
            <img class="figma-ai-config__card-icon" :src="aiConfigModel" alt="">
            <h2>模型选择</h2>
            <p>从 AI 连接池中选择用于生成和评审的模型</p>
          </header>

          <div class="figma-ai-config__model-grid">
            <article class="figma-ai-config__model-column">
              <div class="figma-ai-config__model-label">
                <span class="figma-ai-config__model-dot is-generator" />
                <strong>生成模型</strong>
                <small>负责根据需求生成用例</small>
              </div>
              <div class="figma-ai-config__select-wrap">
                <select :value="generatorModelKey" @change="handleModelChange('CASE_GENERATOR', $event)">
                  <option value="" disabled>请选择生成模型</option>
                  <option v-for="option in modelOptions" :key="option.key" :value="option.key">
                    {{ option.providerName }} — {{ option.modelName }}
                  </option>
                </select>
                <img class="figma-ai-config__select-chevron" :src="aiConfigChevron" alt="">
              </div>
              <div v-if="generatorOption" class="figma-ai-config__connection-state">
                <img :src="aiConfigConnectionCheck" alt="">
                <div>
                  <strong>连接正常</strong>
                  <p>
                    {{ providerLabel(generatorOption) }} · {{ generatorOption.modelName }}<template v-if="supportsImage(generatorOption)"> · 支持图片识别</template>
                  </p>
                </div>
              </div>
              <div v-else class="figma-ai-config__connection-state is-error">
                <span class="figma-ai-config__warning-dot" />
                <div><strong>连接不可用</strong><p>请从 AI 连接池中选择可用模型</p></div>
              </div>
            </article>

            <article class="figma-ai-config__model-column figma-ai-config__model-column--reviewer">
              <div class="figma-ai-config__model-label">
                <span class="figma-ai-config__model-dot is-reviewer" />
                <strong>评审模型</strong>
                <small>负责对生成用例进行质量评审</small>
              </div>
              <div class="figma-ai-config__select-wrap">
                <select :value="reviewerModelKey" @change="handleModelChange('CASE_REVIEWER', $event)">
                  <option value="" disabled>请选择评审模型</option>
                  <option v-for="option in modelOptions" :key="option.key" :value="option.key">
                    {{ option.providerName }} — {{ option.modelName }}
                  </option>
                </select>
                <img class="figma-ai-config__select-chevron" :src="aiConfigChevron" alt="">
              </div>
              <div v-if="reviewerOption" class="figma-ai-config__connection-state">
                <img :src="aiConfigConnectionCheck" alt="">
                <div>
                  <strong>连接正常</strong>
                  <p>
                    {{ providerLabel(reviewerOption) }} · {{ reviewerOption.modelName }}<template v-if="supportsImage(reviewerOption)"> · 支持图片识别</template>
                  </p>
                </div>
              </div>
              <div v-else class="figma-ai-config__connection-state is-error">
                <span class="figma-ai-config__warning-dot" />
                <div><strong>连接不可用</strong><p>请从 AI 连接池中选择可用模型</p></div>
              </div>
            </article>
          </div>
        </section>

        <section class="figma-ai-config__card figma-ai-config__prompt-card">
          <header class="figma-ai-config__card-header">
            <img class="figma-ai-config__card-icon" :src="aiConfigPrompt" alt="">
            <h2>提示词配置</h2>
            <p>自定义 AI 的系统提示词以控制生成风格和质量</p>
          </header>

          <div class="figma-ai-config__prompt-tabs" role="tablist">
            <button
              type="button"
              :class="{ 'is-active': promptTab === 'generator' }"
              role="tab"
              :aria-selected="promptTab === 'generator'"
              @click="promptTab = 'generator'"
            >
              生成提示词 <small>负责生成阶段</small>
            </button>
            <button
              type="button"
              :class="{ 'is-active': promptTab === 'reviewer' }"
              role="tab"
              :aria-selected="promptTab === 'reviewer'"
              @click="promptTab = 'reviewer'"
            >
              评审提示词 <small>负责评审阶段</small>
            </button>
          </div>

          <div class="figma-ai-config__prompt-body">
            <div class="figma-ai-config__prompt-controls">
              <button
                type="button"
                class="figma-ai-config__default-toggle"
                role="checkbox"
                :aria-checked="useDefaultPrompt[promptTab]"
                @click="toggleDefaultPrompt(promptTab)"
              >
                <span :class="{ 'is-checked': useDefaultPrompt[promptTab] }">
                  <img v-if="useDefaultPrompt[promptTab]" :src="aiConfigCheck" alt="">
                </span>
                使用默认提示词
              </button>
            </div>

            <textarea
              :value="currentPrompt"
              :readonly="useDefaultPrompt[promptTab]"
              :class="{ 'is-default': useDefaultPrompt[promptTab] }"
              @input="handlePromptInput"
            />

            <div class="figma-ai-config__variables">
              <strong>可用变量</strong>
              <div>
                <button
                  v-for="variable in currentVariables"
                  :key="variable"
                  type="button"
                  :class="{ 'is-reviewer': promptTab === 'reviewer' }"
                  :disabled="useDefaultPrompt[promptTab]"
                  @click="appendVariable(variable)"
                >
                  {{ variable }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="figma-ai-config__card figma-ai-config__parameter-card">
          <header class="figma-ai-config__card-header">
            <img class="figma-ai-config__card-icon" :src="aiConfigParameter" alt="">
            <h2>生成参数</h2>
            <p>控制用例生成的数量、类型和语言</p>
          </header>

          <div class="figma-ai-config__parameter-body">
            <div class="figma-ai-config__parameter-row is-count">
              <div class="figma-ai-config__parameter-label">预期生成数量</div>
              <div class="figma-ai-config__count-control">
                <input
                  :value="maxCases"
                  type="range"
                  min="5"
                  max="200"
                  @input="updateMaxCases(Number(($event.target as HTMLInputElement).value))"
                >
                <div class="figma-ai-config__stepper">
                  <button type="button" aria-label="减少生成数量" @click="updateMaxCases(maxCases - 1)">−</button>
                  <strong>{{ maxCases }}</strong>
                  <button type="button" aria-label="增加生成数量" @click="updateMaxCases(maxCases + 1)">+</button>
                </div>
                <span>条（5 - 200）</span>
              </div>
            </div>

            <div class="figma-ai-config__parameter-row is-types">
              <div class="figma-ai-config__parameter-label">覆盖用例类型</div>
              <div class="figma-ai-config__type-list">
                <button
                  v-for="item in caseTypeOptions"
                  :key="item.key"
                  type="button"
                  :class="{ 'is-selected': caseTypes[item.key] }"
                  @click="caseTypes[item.key] = !caseTypes[item.key]"
                >
                  <span class="figma-ai-config__check-box">
                    <img v-if="caseTypes[item.key]" :src="aiConfigCheck" alt="">
                  </span>
                  <span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
                </button>
              </div>
            </div>

            <div class="figma-ai-config__parameter-row is-language">
              <div class="figma-ai-config__parameter-label">用例语言</div>
              <div class="figma-ai-config__language-list">
                <button type="button" :class="{ 'is-selected': language === 'zh' }" @click="language = 'zh'">
                  <span class="figma-ai-config__radio"><i v-if="language === 'zh'" /></span>
                  <span><strong>中文</strong><small>适合国内项目</small></span>
                </button>
                <button type="button" :class="{ 'is-selected': language === 'en' }" @click="language = 'en'">
                  <span class="figma-ai-config__radio"><i v-if="language === 'en'" /></span>
                  <span><strong>English</strong><small>适合国际化项目</small></span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer class="figma-ai-config__footer">
          <button
            type="button"
            class="figma-ai-config__save-button figma-ai-config__save-button--bottom"
            :disabled="saving || !configComplete"
            @click="emit('save')"
          >
            <img :src="aiConfigSave" alt="">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
        </footer>
      </div>
    </main>
  </section>
</template>

<style scoped>
.figma-ai-config {
  --ai-primary: #165dff;
  --ai-success: #00b42a;
  --ai-purple: #7816ff;
  --ai-text-1: #1d2129;
  --ai-text-2: #4e5969;
  --ai-text-3: #86909c;
  --ai-text-4: #c9cdd4;
  --ai-border: #e5e6eb;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ai-text-1);
  background: #f4f6fa;
}

.figma-ai-config button,
.figma-ai-config select,
.figma-ai-config textarea,
.figma-ai-config input {
  font-family: inherit;
}

.figma-ai-config button {
  margin: 0;
}

.figma-ai-config__status-bar {
  display: flex;
  flex: 0 0 59px;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  min-height: 59px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-config__status-copy {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: 8px;
  height: 20px;
}

.figma-ai-config__status-icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--ai-success);
  stroke-width: 2;
}

.figma-ai-config__warning-dot {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff7d00;
}

.figma-ai-config__status-title {
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  color: var(--ai-text-1);
  white-space: nowrap;
}

.figma-ai-config__status-copy.is-warning .figma-ai-config__status-title {
  color: #ff7d00;
}

.figma-ai-config__status-summary {
  min-width: 0;
  margin-left: 4px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: var(--ai-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-config__status-summary strong {
  font-weight: 700;
  color: var(--ai-text-2);
}

.figma-ai-config__status-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 16px;
}

.figma-ai-config__pool-button,
.figma-ai-config__save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-wrap: nowrap;
  white-space: nowrap;
  border-radius: 6px;
  cursor: pointer;
}

.figma-ai-config__pool-button {
  gap: 5px;
  height: 30px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ai-text-2);
  background: transparent;
  border: 1px solid var(--ai-border);
}

.figma-ai-config__pool-button img {
  width: 12px;
  height: 12px;
}

.figma-ai-config__save-button {
  gap: 5px;
  color: #fff;
  background: var(--ai-primary);
  border: 1px solid var(--ai-primary);
}

.figma-ai-config__save-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.figma-ai-config__save-button--top {
  width: 108px;
  height: 34px;
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.figma-ai-config__save-button--top img {
  width: 13px;
  height: 13px;
}

.figma-ai-config__body {
  flex: 1;
  min-height: 0;
  padding: 24px;
  overflow-x: hidden;
  overflow-y: auto;
}

.figma-ai-config__content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(900px, 100%);
  margin: 0 auto;
}

.figma-ai-config__card {
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
}

.figma-ai-config__card-header {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 50px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-config__card-icon {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
  margin-right: 8px;
  color: var(--ai-primary);
}

.figma-ai-config__card-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  color: var(--ai-text-1);
}

.figma-ai-config__card-header p {
  margin: 0 0 0 12px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: var(--ai-text-3);
}

.figma-ai-config__model-card {
  height: 225.5px;
}

.figma-ai-config__model-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 173.5px;
}

.figma-ai-config__model-column {
  box-sizing: border-box;
  min-width: 0;
  padding: 20px 24px;
  border-right: 1px solid var(--ai-border);
}

.figma-ai-config__model-column--reviewer {
  border-right: 0;
}

.figma-ai-config__model-label {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: 6px;
  height: 28px;
  margin-bottom: 0;
  padding-bottom: 10px;
}

.figma-ai-config__model-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.figma-ai-config__model-dot.is-generator { background: var(--ai-success); }
.figma-ai-config__model-dot.is-reviewer { background: var(--ai-purple); }

.figma-ai-config__model-label strong {
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--ai-text-2);
  letter-spacing: .5px;
}

.figma-ai-config__model-label small {
  margin-left: 2px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: var(--ai-text-4);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-config__select-wrap {
  position: relative;
  width: 100%;
}

.figma-ai-config__select-wrap select {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 9px 32px 9px 16px;
  appearance: none;
  font-size: 13px;
  font-weight: 400;
  line-height: normal;
  color: var(--ai-text-1);
  cursor: pointer;
  outline: none;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 7px;
}

.figma-ai-config__select-wrap select:focus {
  border-color: var(--ai-primary);
}

.figma-ai-config__select-chevron {
  position: absolute;
  top: 15px;
  right: 6px;
  width: 10px;
  height: 6px;
  pointer-events: none;
}

.figma-ai-config__connection-state {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 58px;
  margin-top: 10px;
  padding: 10px 12px;
  gap: 8px;
  background: rgba(0, 180, 42, .03);
  border: 1px solid rgba(0, 180, 42, .19);
  border-radius: 7px;
}

.figma-ai-config__connection-state > img {
  flex: 0 0 13px;
  width: 13px;
  height: 13px;
  color: var(--ai-success);
}

.figma-ai-config__connection-state strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ai-success);
}

.figma-ai-config__connection-state p {
  margin: 1px 0 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: var(--ai-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-ai-config__connection-state.is-error {
  background: #fff5f5;
  border-color: rgba(245, 63, 63, .2);
}

.figma-ai-config__connection-state.is-error strong { color: #f53f3f; }

.figma-ai-config__prompt-card {
  height: 468px;
}

.figma-ai-config__prompt-tabs {
  display: flex;
  box-sizing: border-box;
  height: 46.5px;
  background: #fafafa;
  border-bottom: 1px solid var(--ai-border);
}

.figma-ai-config__prompt-tabs button {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 45.5px;
  padding: 12px 22px;
  gap: 6px;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  color: var(--ai-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
}

.figma-ai-config__prompt-tabs button small {
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: var(--ai-text-4);
}

.figma-ai-config__prompt-tabs button.is-active {
  font-weight: 600;
  color: var(--ai-primary);
  border-bottom-color: var(--ai-primary);
}

.figma-ai-config__prompt-tabs button.is-active small {
  font-weight: 600;
  color: var(--ai-primary);
}

.figma-ai-config__prompt-body {
  box-sizing: border-box;
  min-height: 370.5px;
  padding: 18px 22px;
}

.figma-ai-config__prompt-controls {
  display: flex;
  align-items: center;
  height: 20px;
  margin-bottom: 14px;
  gap: 10px;
}

.figma-ai-config__default-toggle {
  display: flex;
  align-items: center;
  height: 20px;
  margin: 0;
  padding: 0;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  color: var(--ai-text-2);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.figma-ai-config__default-toggle > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2px solid var(--ai-border);
  border-radius: 4px;
}

.figma-ai-config__default-toggle > span.is-checked {
  background: var(--ai-primary);
  border-color: var(--ai-primary);
}

.figma-ai-config__default-toggle img {
  width: 10px;
  height: 10px;
  color: #fff;
  stroke-width: 3;
}

.figma-ai-config__prompt-body textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 220px;
  min-height: 220px;
  padding: 12px 14px;
  resize: none;
  overflow: auto;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  font-weight: 400;
  line-height: 21.6px;
  color: var(--ai-text-1);
  outline: none;
  background: #fafbff;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
}

.figma-ai-config__prompt-body textarea.is-default {
  opacity: .7;
}

.figma-ai-config__prompt-body textarea:focus {
  border-color: var(--ai-primary);
}

.figma-ai-config__variables {
  box-sizing: border-box;
  min-height: 65.5px;
  margin-top: 15px;
  padding: 10px 14px;
  background: #f7f8fa;
  border-radius: 6px;
}

.figma-ai-config__variables > strong {
  display: block;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  color: var(--ai-text-3);
  letter-spacing: .5px;
  text-transform: uppercase;
}

.figma-ai-config__variables > div {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  padding-top: 6px;
}

.figma-ai-config__variables button {
  height: 22.5px;
  padding: 2px 8px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: var(--ai-primary);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 4px;
}

.figma-ai-config__variables button.is-reviewer { color: var(--ai-purple); }
.figma-ai-config__variables button:disabled { cursor: default; }

.figma-ai-config__parameter-card {
  height: 338px;
}

.figma-ai-config__parameter-body {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 287px;
  padding: 20px 22px;
  gap: 20px;
}

.figma-ai-config__parameter-row {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.figma-ai-config__parameter-row.is-types { align-items: flex-start; }

.figma-ai-config__parameter-label {
  flex: 0 0 120px;
  width: 120px;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  color: var(--ai-text-2);
}

.figma-ai-config__parameter-row.is-types .figma-ai-config__parameter-label { padding-top: 2px; }

.figma-ai-config__count-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.figma-ai-config__count-control > input {
  width: 180px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

.figma-ai-config__stepper {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 98px;
  height: 34px;
  overflow: hidden;
  border: 1px solid var(--ai-border);
  border-radius: 6px;
}

.figma-ai-config__stepper button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 32px;
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--ai-text-2);
  cursor: pointer;
  background: #f7f8fa;
  border: 0;
}

.figma-ai-config__stepper strong {
  width: 40px;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  color: var(--ai-text-1);
  text-align: center;
}

.figma-ai-config__count-control > span {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: var(--ai-text-3);
  white-space: nowrap;
}

.figma-ai-config__type-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 714px;
}

.figma-ai-config__type-list > button,
.figma-ai-config__language-list > button {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 8px 14px;
  gap: 8px;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
}

.figma-ai-config__type-list > button.is-selected,
.figma-ai-config__language-list > button.is-selected {
  background: rgba(22, 93, 255, .02);
  border-color: var(--ai-primary);
}

.figma-ai-config__check-box,
.figma-ai-config__radio {
  display: inline-flex;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2px solid var(--ai-border);
}

.figma-ai-config__check-box { border-radius: 4px; }
.is-selected > .figma-ai-config__check-box { background: var(--ai-primary); border-color: var(--ai-primary); }
.figma-ai-config__check-box img { width: 10px; height: 10px; }

.figma-ai-config__type-list > button > span:last-child,
.figma-ai-config__language-list > button > span:last-child {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.figma-ai-config__type-list strong,
.figma-ai-config__language-list strong {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  color: var(--ai-text-1);
  white-space: nowrap;
}

.figma-ai-config__type-list .is-selected strong,
.figma-ai-config__language-list .is-selected strong { color: var(--ai-primary); }

.figma-ai-config__type-list small,
.figma-ai-config__language-list small {
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  color: var(--ai-text-4);
  white-space: nowrap;
}

.figma-ai-config__language-list {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.figma-ai-config__language-list > button { padding: 8px 16px; }

.figma-ai-config__radio { border-radius: 50%; }
.figma-ai-config__language-list .is-selected > .figma-ai-config__radio { border-color: var(--ai-primary); }
.figma-ai-config__radio i { width: 7px; height: 7px; background: var(--ai-primary); border-radius: 50%; }

.figma-ai-config__footer {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}

.figma-ai-config__save-button--bottom {
  min-width: 126px;
  height: 41px;
  padding: 9px 24px;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
  border-radius: 7px;
}

.figma-ai-config__save-button--bottom img { width: 14px; height: 14px; }

.figma-ai-config__loading,
.figma-ai-config__empty {
  width: min(900px, 100%);
  margin: 0 auto;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
}

.figma-ai-config__loading {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.figma-ai-config__loading span {
  height: 160px;
  background: linear-gradient(90deg, #f7f8fa, #eef0f4, #f7f8fa);
  border-radius: 8px;
  animation: figma-ai-config-pulse 1.4s ease-in-out infinite;
}

.figma-ai-config__empty {
  box-sizing: border-box;
  padding: 48px 24px;
  font-size: 13px;
  color: var(--ai-text-3);
  text-align: center;
}

@keyframes figma-ai-config-pulse {
  50% { opacity: .55; }
}

@media (max-width: 980px) {
  .figma-ai-config__body { padding: 16px; }
  .figma-ai-config__model-grid { grid-template-columns: 1fr; }
  .figma-ai-config__model-column { border-right: 0; border-bottom: 1px solid var(--ai-border); }
  .figma-ai-config__model-column--reviewer { border-bottom: 0; }
  .figma-ai-config__status-summary { display: none; }
}
</style>
