<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import type { ApiDefinitionDetail } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'
import './styles/api-request-auth-panel.css'

const props = defineProps<{
  detail: ApiDefinitionDetail
  markDirty: () => void
}>()

const showBearerToken = ref(false)
const showBasicPassword = ref(false)
const showApiKey = ref(false)
const showDigestPassword = ref(false)

function ensureAuthDefaults(detail: ApiDefinitionDetail) {
  const auth = detail.requestConfig.authConfig
  auth.basicAuth ||= { userName: '', password: '' }
  auth.digestAuth ||= { userName: '', password: '' }
  auth.bearerToken ??= ''
  auth.apiKeyName ??= 'X-API-Key'
  auth.apiKeyValue ??= ''
  auth.apiKeyLocation ??= 'header'
}

function apiKeyPreview(detail: ApiDefinitionDetail) {
  const auth = detail.requestConfig.authConfig
  const name = auth.apiKeyName || 'X-API-Key'
  return auth.apiKeyLocation === 'query' ? `?${name}=<value>` : `${name}: <value>`
}

watch(() => props.detail, ensureAuthDefaults, { immediate: true })
</script>

<template>
  <div class="api-auth-panel">
    <div class="api-auth-segmented" role="radiogroup" aria-label="认证方式">
      <button
        v-for="option in [
          { value: 'NONE', label: 'No Auth' },
          { value: 'BEARER', label: 'Bearer Token' },
          { value: 'BASIC', label: 'Basic Auth' },
          { value: 'API_KEY', label: 'API Key' },
          { value: 'DIGEST', label: 'Digest Auth' },
        ]"
        :key="option.value"
        type="button"
        :class="['api-auth-segment-button', { 'is-selected': detail.requestConfig.authConfig.authType === option.value }]"
        :aria-checked="detail.requestConfig.authConfig.authType === option.value"
        role="radio"
        @click="detail.requestConfig.authConfig.authType = option.value; ensureAuthDefaults(detail); markDirty()"
      >{{ option.label }}</button>
    </div>

    <div v-if="detail.requestConfig.authConfig.authType === 'NONE'" class="api-auth-empty">
      <img class="api-auth-empty__icon" :src="figmaApiInterfaceIcons.authNone" alt="" />
      <strong>不启用认证助手</strong>
      <span>不通过 Auth 自动添加认证信息。<br />你仍可在 Headers 或 Params 中手动配置，<br />已填写的 Header 不会因此被移除。</span>
    </div>

    <div v-else-if="detail.requestConfig.authConfig.authType === 'BEARER'" class="api-auth-form api-auth-form--bearer">
      <div class="api-auth-notice">
        <img class="api-auth-notice__icon" :src="figmaApiInterfaceIcons.authInfo" alt="" />
        <span class="api-auth-notice__text">只需填写 Token 值，无需加 <code>Bearer </code> 前缀，发送时自动拼接为 <code>Authorization: Bearer &lt;token&gt;</code>。</span>
      </div>
      <label class="api-auth-field-label required">Token</label>
      <el-input
        v-model="detail.requestConfig.authConfig.bearerToken"
        class="api-auth-form-control api-auth-password-control"
        :type="showBearerToken ? 'text' : 'password'"
        placeholder="输入 Token 或使用 {{变量名}}"
        @input="markDirty"
      ><template #suffix><button type="button" class="api-auth-eye-button" @click.stop="showBearerToken = !showBearerToken"><EyeOff v-if="showBearerToken" class="api-auth-eye-icon" aria-hidden="true" /><Eye v-else class="api-auth-eye-icon" aria-hidden="true" /></button></template></el-input>
      <p class="api-auth-help">支持直接输入明文 Token，或使用 <code v-text="'{{变量名}}'"></code> 引用环境变量、变量集或场景前序步骤的提取值。<br /><span>编辑时未找到的变量将显示原始占位符，执行时自动解析，不代表配置有误。</span></p>
    </div>

    <div v-else-if="detail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-form api-auth-form--basic">
      <div class="api-auth-notice">
        <img class="api-auth-notice__icon" :src="figmaApiInterfaceIcons.authInfo" alt="" />
        <span class="api-auth-notice__text">Basic Auth 将用户名和密码 Base64 编码后作为 <code>Authorization: Basic &lt;base64&gt;</code> 发送。Base64 可被还原，请勿在不安全信道使用。</span>
      </div>
      <div class="api-auth-grid api-auth-grid--two">
        <div><label class="api-auth-field-label required">用户名</label><el-input v-model="detail.requestConfig.authConfig.basicAuth!.userName" class="api-auth-form-control" placeholder="username 或 {{变量}}" @input="markDirty"><template #prefix><img class="api-auth-input-icon" :src="figmaApiInterfaceIcons.authUser" alt="" /></template></el-input></div>
        <div><label class="api-auth-field-label required">密码</label><el-input v-model="detail.requestConfig.authConfig.basicAuth!.password" class="api-auth-form-control" :type="showBasicPassword ? 'text' : 'password'" placeholder="password 或 {{变量}}" @input="markDirty"><template #prefix><img class="api-auth-input-icon" :src="figmaApiInterfaceIcons.authKey" alt="" /></template><template #suffix><button type="button" class="api-auth-eye-button" @click.stop="showBasicPassword = !showBasicPassword"><EyeOff v-if="showBasicPassword" class="api-auth-eye-icon" aria-hidden="true" /><Eye v-else class="api-auth-eye-icon" aria-hidden="true" /></button></template></el-input></div>
      </div>
      <div class="api-auth-preview">
        <div class="api-auth-preview__label">发送预览（脱敏）</div>
        <code>Authorization: Basic ******</code>
      </div>
    </div>

    <div v-else-if="detail.requestConfig.authConfig.authType === 'API_KEY'" class="api-auth-form api-auth-form--api-key">
      <div class="api-auth-grid api-auth-grid--two api-auth-grid--equal">
        <div><label class="api-auth-field-label required">Header / 参数名</label><el-input v-model="detail.requestConfig.authConfig.apiKeyName" class="api-auth-form-control" placeholder="X-API-Key" @input="markDirty" /></div>
        <div>
          <label class="api-auth-field-label required">注入位置</label>
          <div class="api-auth-location" role="radiogroup" aria-label="API Key 注入位置">
            <button
              v-for="option in [{ value: 'header', label: 'Header' }, { value: 'query', label: 'Query Param' }]"
              :key="option.value"
              type="button"
              :class="['api-auth-location-button', { 'is-selected': detail.requestConfig.authConfig.apiKeyLocation === option.value }]"
              :aria-checked="detail.requestConfig.authConfig.apiKeyLocation === option.value"
              role="radio"
              @click="detail.requestConfig.authConfig.apiKeyLocation = option.value; markDirty()"
            >{{ option.label }}</button>
          </div>
        </div>
      </div>
      <label class="api-auth-field-label required">API Key 值</label>
      <el-input v-model="detail.requestConfig.authConfig.apiKeyValue" class="api-auth-form-control" :type="showApiKey ? 'text' : 'password'" placeholder="输入 Key 或使用 {{变量名}}" @input="markDirty"><template #suffix><button type="button" class="api-auth-eye-button" @click.stop="showApiKey = !showApiKey"><EyeOff v-if="showApiKey" class="api-auth-eye-icon" aria-hidden="true" /><Eye v-else class="api-auth-eye-icon" aria-hidden="true" /></button></template></el-input>
      <p class="api-auth-help api-auth-help--api-key">将以 <code>{{ apiKeyPreview(detail) }}</code> 的方式注入请求。</p>
      <div class="api-auth-api-notices">
        <div v-if="detail.requestConfig.authConfig.apiKeyLocation === 'query'" class="api-auth-notice api-auth-notice--warning">
          <img class="api-auth-notice__icon" :src="figmaApiInterfaceIcons.authWarning" alt="" />
          <span class="api-auth-notice__text">Query 方式会将密钥暴露在 URL、访问日志和请求报告中，存在泄露风险。优先使用 Header，除非被测接口明确要求 Query 传参。</span>
        </div>
        <div class="api-auth-notice">
          <img class="api-auth-notice__icon" :src="figmaApiInterfaceIcons.authInfo" alt="" />
          <span class="api-auth-notice__text">若 Headers 或 Params 中已存在同名字段 <code>{{ detail.requestConfig.authConfig.apiKeyName || 'X-API-Key' }}</code>，发送时将以此处配置为准，不会同时发送两份。</span>
        </div>
      </div>
    </div>

    <div v-else-if="detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-form api-auth-form--digest">
      <div class="api-auth-notice">
        <img class="api-auth-notice__icon" :src="figmaApiInterfaceIcons.authInfo" alt="" />
        <span class="api-auth-notice__text">Digest Auth 通过质询-响应机制发送凭据，密码不会以明文传输。发送时客户端自动处理 nonce 握手。</span>
      </div>
      <div class="api-auth-grid api-auth-grid--two">
        <div><label class="api-auth-field-label required">用户名</label><el-input v-model="detail.requestConfig.authConfig.digestAuth!.userName" class="api-auth-form-control" placeholder="{{digest_username}}" @input="markDirty"><template #prefix><img class="api-auth-input-icon" :src="figmaApiInterfaceIcons.authUser" alt="" /></template></el-input></div>
        <div><label class="api-auth-field-label required">密码</label><el-input v-model="detail.requestConfig.authConfig.digestAuth!.password" class="api-auth-form-control" :type="showDigestPassword ? 'text' : 'password'" placeholder="password 或 {{变量}}" @input="markDirty"><template #prefix><img class="api-auth-input-icon" :src="figmaApiInterfaceIcons.authKey" alt="" /></template><template #suffix><button type="button" class="api-auth-eye-button" @click.stop="showDigestPassword = !showDigestPassword"><EyeOff v-if="showDigestPassword" class="api-auth-eye-icon" aria-hidden="true" /><Eye v-else class="api-auth-eye-icon" aria-hidden="true" /></button></template></el-input></div>
      </div>
      <p class="api-auth-help api-auth-help--digest">支持使用 <code v-text="'{{变量名}}'"></code> 引用环境变量或提取值。Runner 执行时自动完成质询握手，无需手动处理 nonce。</p>
    </div>
  </div>
</template>
