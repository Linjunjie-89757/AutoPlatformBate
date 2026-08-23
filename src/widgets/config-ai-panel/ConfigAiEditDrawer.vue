<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { AiProviderConnectionItem, AiProviderType } from '@/entities/ai-provider'
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'

import {
  AI_ACCENT,
  buildSavePayload,
  capabilityVisuals,
  createFormState,
  getProviderVisual,
  type AiCapability,
  type AiConnectionFormState,
  type AiUsage,
  usageLabels,
} from './model'

const props = defineProps<{
  mode: 'create' | 'edit'
  workspaceCode: string
  providerType: AiProviderType
  provider?: AiProviderConnectionItem | null
  saving?: boolean
  testing?: boolean
}>()

const emit = defineEmits<{
  close: []
  backToPicker: []
  save: [payload: ReturnType<typeof buildSavePayload>]
  test: [payload: ReturnType<typeof buildSavePayload>]
}>()

const form = reactive<AiConnectionFormState>(createFormState(props.workspaceCode, props.providerType, props.provider))
const showApiKey = ref(false)

const visual = computed(() => getProviderVisual(form.providerType))
const capabilityKeys = computed(() => Object.keys(capabilityVisuals) as AiCapability[])
const usageKeys = computed(() => Object.keys(usageLabels) as AiUsage[])

watch(
  () => [props.providerType, props.provider?.id, props.mode] as const,
  () => {
    Object.assign(form, createFormState(props.workspaceCode, props.providerType, props.provider))
  },
)

function toggleCapability(_key: AiCapability) {
  ElMessage.info('后台暂不支持连接能力配置持久化')
}

function toggleUsage(_key: AiUsage) {
  ElMessage.info('后台暂不支持 AI 调用用途绑定')
}

function resetBaseUrl() {
  form.baseUrl = visual.value.baseUrl
}

function submit() {
  if (form.reviewModelName.trim() || form.maxRetry > 0) {
    ElMessage.warning('默认评审模型和最大重试次数暂无后台字段，本次不会保存这两项')
  }
  emit('save', buildSavePayload(props.workspaceCode, form, props.mode === 'create' || Boolean(form.apiKey.trim())))
}

function testConnection() {
  emit('test', buildSavePayload(props.workspaceCode, form, Boolean(form.apiKey.trim())))
}
</script>

<template>
  <Teleport to="body">
    <div class="config-ai-edit">
      <aside class="config-ai-edit__drawer">
        <header class="config-ai-edit__head">
          <div>
            <h3>{{ mode === 'edit' ? '编辑 AI 连接' : '配置 AI 连接' }}</h3>
            <button
              v-if="mode === 'create'"
              class="config-ai-edit__back"
              type="button"
              @click="emit('backToPicker')"
            >
              ← 重新选择服务商
            </button>
          </div>
          <button class="config-ai-edit__icon-btn" type="button" aria-label="关闭" @click="$emit('close')">
            <img :src="figmaConfigAiIcons.drawer.close" alt="">
          </button>
        </header>

        <div class="config-ai-edit__body">
          <section
            class="config-ai-edit__provider"
            :style="{ backgroundColor: visual.bg, borderColor: visual.bg }"
          >
            <span
              class="config-ai-edit__provider-avatar"
              :style="{ color: visual.color, backgroundColor: visual.logoBg || '#ffffff' }"
            >
              <img v-if="visual.logoSrc" :src="visual.logoSrc" alt="">
              <span v-else>{{ visual.initial }}</span>
            </span>
            <div>
              <strong :style="{ color: visual.color }">{{ visual.label }}</strong>
              <p>选择的服务商</p>
            </div>
          </section>

          <section class="config-ai-form-section">
            <label class="config-ai-field">
              <span>连接名称 *</span>
              <input v-model="form.connectionName" type="text" placeholder="GPT-4o 生成连接">
            </label>

            <label class="config-ai-field">
              <span>API Base URL</span>
              <div class="config-ai-field__inline">
                <input v-model="form.baseUrl" type="text" placeholder="https://api.openai.com/v1">
                <button type="button" @click="resetBaseUrl">恢复默认</button>
              </div>
            </label>

            <label class="config-ai-field">
              <span>API Key *</span>
              <div class="config-ai-field__password">
                <input
                  v-model="form.apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  :placeholder="mode === 'edit' ? '已配置，输入新 Key 以替换' : '请输入 API Key'"
                >
                <button type="button" aria-label="显示或隐藏密钥" @click="showApiKey = !showApiKey">
                  <img :src="figmaConfigAiIcons.drawer.eye" alt="">
                </button>
              </div>
              <small>Key 将加密存储，配置后以脱敏形式展示</small>
            </label>
          </section>

          <section class="config-ai-form-section">
            <h4>默认模型配置</h4>
            <div class="config-ai-form-grid">
              <label class="config-ai-field">
                <span>默认生成模型</span>
                <input v-model="form.modelName" type="text">
              </label>
              <label class="config-ai-field">
                <span>默认评审模型</span>
                <input v-model="form.reviewModelName" type="text">
              </label>
            </div>
          </section>

          <section class="config-ai-form-section">
            <h4>高级配置</h4>
            <div class="config-ai-form-grid">
              <label class="config-ai-field">
                <span>超时时间（秒）</span>
                <input v-model.number="form.requestTimeoutSeconds" type="number" min="1">
              </label>
              <label class="config-ai-field">
                <span>最大重试次数</span>
                <input v-model.number="form.maxRetry" type="number" min="0">
              </label>
            </div>
          </section>

          <section class="config-ai-form-section">
            <h4>支持能力</h4>
            <div class="config-ai-checks">
              <button
                v-for="key in capabilityKeys"
                :key="key"
                class="config-ai-check"
                :class="{ 'is-checked': form.capabilities.includes(key) }"
                :style="form.capabilities.includes(key)
                  ? { color: capabilityVisuals[key].color, backgroundColor: capabilityVisuals[key].bg, borderColor: capabilityVisuals[key].color }
                  : undefined"
                type="button"
                @click="toggleCapability(key)"
              >
                <span><img v-if="form.capabilities.includes(key)" :src="figmaConfigAiIcons.checkbox.checked" alt=""></span>
                {{ capabilityVisuals[key].label }}
              </button>
            </div>
          </section>

          <section class="config-ai-form-section">
            <h4>绑定用途</h4>
            <div class="config-ai-checks">
              <button
                v-for="key in usageKeys"
                :key="key"
                class="config-ai-check"
                :class="{ 'is-checked': form.usages.includes(key) }"
                type="button"
                @click="toggleUsage(key)"
              >
                <span><img v-if="form.usages.includes(key)" :src="figmaConfigAiIcons.checkbox.checked" alt=""></span>
                {{ usageLabels[key] }}
              </button>
            </div>
          </section>

          <section class="config-ai-edit__enable">
            <div>
              <strong>启用此连接</strong>
              <p>停用后该连接不会被平台调用</p>
            </div>
            <button
              class="config-ai-toggle"
              :class="{ 'is-on': form.status === 1 }"
              type="button"
              @click="form.status = form.status === 1 ? 0 : 1"
            >
              <span />
            </button>
          </section>
        </div>

        <footer class="config-ai-edit__foot">
          <button class="config-ai-edit__test" type="button" :disabled="testing" @click="testConnection">
            <img :src="figmaConfigAiIcons.drawer.test" alt="">
            {{ testing ? '测试中' : '测试连接' }}
          </button>
          <div>
            <button class="config-ai-edit__cancel" type="button" @click="$emit('close')">取消</button>
            <button class="config-ai-edit__save" type="button" :disabled="saving" @click="submit">
              <img :src="figmaConfigAiIcons.drawer.save" alt="">
              {{ mode === 'edit' ? '保存修改' : '保存连接' }}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.config-ai-edit {
  position: fixed;
  z-index: 2100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.3);
}

.config-ai-edit__drawer {
  display: flex;
  width: 560px;
  height: 100%;
  flex-direction: column;
  background: #ffffff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.config-ai-edit__head {
  display: flex;
  height: 50px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-edit__head h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.config-ai-edit__back {
  margin-top: 1.75px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7816ff;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-edit__icon-btn {
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

.config-ai-edit__icon-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-edit__body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 14px 17.5px 17.5px;
}

.config-ai-edit__provider {
  display: flex;
  align-items: center;
  gap: 10.5px;
  height: 63px;
  margin-bottom: 17.5px;
  padding: 11.5px;
  border: 1px solid;
  border-radius: 11px;
}

.config-ai-edit__provider-avatar {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;
}

.config-ai-edit__provider-avatar img {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.config-ai-edit__provider-avatar > span {
  color: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.config-ai-edit__provider strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-ai-edit__provider p {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.config-ai-form-section {
  padding: 0 0 17.5px;
  margin-bottom: 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-form-section h4 {
  margin: 0 0 10.5px;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.config-ai-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10.5px;
}

.config-ai-field {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
  margin-bottom: 10.5px;
}

.config-ai-field:last-child {
  margin-bottom: 0;
}

.config-ai-field span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.config-ai-field input {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.config-ai-field small {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.config-ai-field__inline {
  display: flex;
  gap: 7px;
}

.config-ai-field__inline input {
  width: 195.5px;
}

.config-ai-field__inline button {
  height: 28px;
  padding: 0 9.75px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 11px;
}

.config-ai-field__password {
  position: relative;
}

.config-ai-field__password input {
  padding-right: 38px;
}

.config-ai-field__password button {
  position: absolute;
  top: 7px;
  right: 8.75px;
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.config-ai-field__password img {
  width: 14px;
  height: 14px;
}

.config-ai-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding-top: 8.75px;
}

.config-ai-check {
  display: inline-flex;
  height: 30.5px;
  align-items: center;
  gap: 5.25px;
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.config-ai-check.is-checked {
  border-color: v-bind('AI_ACCENT');
  background: #f5e8ff;
  color: v-bind('AI_ACCENT');
}

.config-ai-check.is-checked span {
  border-color: #0075ff;
  background: #0075ff;
}

.config-ai-check span {
  display: inline-flex;
  width: 12.25px;
  height: 12.25px;
  align-items: center;
  justify-content: center;
  border: 1px solid #767676;
  border-radius: 2px;
  background: #ffffff;
}

.config-ai-check span img {
  width: 10px;
  height: 10px;
}

.config-ai-edit__enable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13.25px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
}

.config-ai-edit__enable strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-ai-edit__enable p {
  margin: 1.75px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);
}

.config-ai-toggle.is-on {
  background: #165dff;
}

.config-ai-toggle.is-on span {
  left: 14px;
}

.config-ai-edit__foot {
  display: flex;
  min-height: 57.5px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px;
  border-top: 1px solid #e5e6eb;
}

.config-ai-edit__foot > div {
  display: flex;
  gap: 7px;
  align-items: center;
}

.config-ai-edit__test {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7816ff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-ai-edit__test img {
  width: 14px;
  height: 14px;
}

.config-ai-edit__cancel,
.config-ai-edit__save {
  height: 28px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-ai-edit__cancel {
  padding: 0 11.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.config-ai-edit__save {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  background: #7816ff;
  color: #ffffff;
  transition: filter 150ms, transform 150ms;
}

.config-ai-edit__save:hover:not(:disabled) {
  filter: brightness(1.1);
}

.config-ai-edit__save:active:not(:disabled) {
  transform: scale(.98);
}

.config-ai-edit__save img {
  width: 13px;
  height: 13px;
}
</style>
