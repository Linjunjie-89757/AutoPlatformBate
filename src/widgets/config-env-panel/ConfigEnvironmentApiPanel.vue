<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronDown, ChevronRight, Eye, EyeOff, Hash, Key, Minus, Plus, Shield, User } from '@lucide/vue'

import type { ConfigEnvApiConfigForm, ConfigEnvAuthType, ConfigEnvHeaderForm } from '@/features/config-env-create-edit'

const props = defineProps<{ modelValue: ConfigEnvApiConfigForm; baseUrlError?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: ConfigEnvApiConfigForm] }>()

const authOptions: Array<{ value: ConfigEnvAuthType; label: string }> = [
  { value: 'none', label: '不认证' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' },
  { value: 'digest', label: 'Digest Auth' },
]

const expanded = () => props.modelValue.headers.length > 0
const headerExpanded = ref(expanded())
const visibleValues = ref(new Set<string>())

watch(() => props.modelValue.headers.length, length => {
  headerExpanded.value = length > 0
  if (length === 0) visibleValues.value = new Set()
})

function patch(value: Partial<ConfigEnvApiConfigForm>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

function updateHeader(id: string, value: Partial<ConfigEnvHeaderForm>) {
  patch({ headers: props.modelValue.headers.map(row => row.id === id ? { ...row, ...value } : row) })
}

function addHeader() {
  headerExpanded.value = true
  patch({ headers: [...props.modelValue.headers, { id: `header-${Date.now()}`, enabled: true, key: '', value: '', sensitive: false }] })
}

function removeHeader(id: string) {
  patch({ headers: props.modelValue.headers.filter(row => row.id !== id) })
}

function toggleValue(id: string) {
  const next = new Set(visibleValues.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  visibleValues.value = next
}
</script>

<template>
  <section class="figma-env__api-panel">
    <div class="figma-env__config-card">
      <header><div><h3>连接参数</h3></div></header>
      <div class="figma-env__api-grid">
        <label class="figma-env__field figma-env__field--wide" :class="{ 'has-error': baseUrlError }"><span>Base URL <b>*</b><small>所有接口请求的基础地址前缀</small></span><input :value="modelValue.baseUrl" class="is-mono" :aria-invalid="Boolean(baseUrlError)" placeholder="https://api.example.com" @input="patch({ baseUrl: ($event.target as HTMLInputElement).value })"><small v-if="baseUrlError" class="figma-env__field-error">{{ baseUrlError }}</small></label>
        <label class="figma-env__field"><span>默认请求超时 (ms)<small>接口未单独配置超时时使用此值</small></span><input :value="modelValue.timeout" type="number" min="1000" max="120000" @input="patch({ timeout: Number(($event.target as HTMLInputElement).value) || 30000 })"></label>
      </div>
    </div>

    <div class="figma-env__config-card">
      <header><div><h3>公共请求头 &amp; 认证</h3></div></header>
      <div class="figma-env__api-section">
        <button class="figma-env__collapse-trigger" type="button" @click="headerExpanded = !headerExpanded">
          <component :is="headerExpanded ? ChevronDown : ChevronRight" :size="14" />
          <strong>公共请求头</strong>
          <span v-if="modelValue.headers.length" class="figma-env__count-badge">{{ modelValue.headers.length }} 条</span>
          <em v-else>未配置</em>
          <small v-if="!headerExpanded">每次请求自动携带</small>
        </button>
        <div v-if="headerExpanded" class="figma-env__headers-body">
          <div v-if="!modelValue.headers.length" class="figma-env__headers-empty"><button type="button" @click="addHeader"><Plus :size="14" />添加公共请求头</button></div>
          <div v-else class="figma-env__headers-table">
            <div class="figma-env__headers-row is-head"><span>启用</span><span>请求头名称</span><span>值</span><span>脱敏</span><span /></div>
            <div v-for="row in modelValue.headers" :key="row.id" class="figma-env__headers-row">
              <span><button type="button" class="figma-env__mini-switch" :class="{ 'is-on': row.enabled }" :aria-label="row.enabled ? '停用请求头' : '启用请求头'" @click="updateHeader(row.id, { enabled: !row.enabled })"><i /></button></span>
              <input :value="row.key" placeholder="Header-Name" @input="updateHeader(row.id, { key: ($event.target as HTMLInputElement).value })">
              <span class="figma-env__header-value"><input :value="row.value" :type="row.sensitive && !visibleValues.has(row.id) ? 'password' : 'text'" placeholder="值或 &#123;&#123;变量&#125;&#125;" @input="updateHeader(row.id, { value: ($event.target as HTMLInputElement).value })"><button v-if="row.sensitive" type="button" :aria-label="visibleValues.has(row.id) ? '隐藏值' : '显示值'" @click="toggleValue(row.id)"><component :is="visibleValues.has(row.id) ? EyeOff : Eye" :size="13" /></button></span>
              <span><button type="button" class="figma-env__mini-switch" :class="{ 'is-on': row.sensitive }" aria-label="切换脱敏" @click="updateHeader(row.id, { sensitive: !row.sensitive })"><i /></button></span>
              <span><button type="button" class="figma-env__icon-action is-danger" aria-label="删除请求头" @click="removeHeader(row.id)"><Minus :size="14" /></button></span>
            </div>
            <button type="button" class="figma-env__add-row" @click="addHeader"><Plus :size="13" />添加请求头</button>
          </div>
        </div>
      </div>

      <div class="figma-env__api-section figma-env__auth-section">
        <h4>认证方式</h4>
        <div class="figma-env__auth-options">
          <button v-for="option in authOptions" :key="option.value" type="button" :class="{ 'is-selected': modelValue.authType === option.value }" @click="patch({ authType: option.value })">
            <component :is="option.value === 'basic' ? User : option.value === 'apikey' ? Hash : option.value === 'bearer' ? Key : Shield" :size="13" />{{ option.label }}
          </button>
        </div>
        <label v-if="modelValue.authType === 'bearer'" class="figma-env__field"><span>Token <small>支持 &#123;&#123;变量&#125;&#125; 引用</small></span><input :value="modelValue.authBearer" class="is-mono" placeholder="Bearer token 或 &#123;&#123;API_TOKEN&#125;&#125;" @input="patch({ authBearer: ($event.target as HTMLInputElement).value })"></label>
        <div v-else-if="modelValue.authType === 'basic'" class="figma-env__api-grid"><label class="figma-env__field"><span>用户名</span><input :value="modelValue.authBasicUser" placeholder="Username" @input="patch({ authBasicUser: ($event.target as HTMLInputElement).value })"></label><label class="figma-env__field"><span>密码</span><input :value="modelValue.authBasicPass" type="password" @input="patch({ authBasicPass: ($event.target as HTMLInputElement).value })"></label></div>
        <div v-else-if="modelValue.authType === 'apikey'" class="figma-env__api-grid"><label class="figma-env__field"><span>Header/参数名</span><input :value="modelValue.authApiKeyName" class="is-mono" placeholder="X-API-Key" @input="patch({ authApiKeyName: ($event.target as HTMLInputElement).value })"></label><label class="figma-env__field"><span>Key 值 <small>支持 &#123;&#123;变量&#125;&#125;</small></span><input :value="modelValue.authApiKeyValue" type="password" @input="patch({ authApiKeyValue: ($event.target as HTMLInputElement).value })"></label><div class="figma-env__field"><span>传入方式</span><div class="figma-env__segmented"><button type="button" :class="{ 'is-selected': modelValue.authApiKeyIn === 'header' }" @click="patch({ authApiKeyIn: 'header' })">请求头</button><button type="button" :class="{ 'is-selected': modelValue.authApiKeyIn === 'query' }" @click="patch({ authApiKeyIn: 'query' })">Query 参数</button></div></div></div>
        <div v-else-if="modelValue.authType === 'digest'" class="figma-env__api-grid"><label class="figma-env__field"><span>用户名</span><input :value="modelValue.authDigestUser" @input="patch({ authDigestUser: ($event.target as HTMLInputElement).value })"></label><label class="figma-env__field"><span>密码</span><input :value="modelValue.authDigestPass" type="password" @input="patch({ authDigestPass: ($event.target as HTMLInputElement).value })"></label></div>
      </div>
    </div>
    <div v-if="!modelValue.baseUrl" class="figma-env__info-banner">填写 Base URL 后，接口测试任务才能在此环境中执行。</div>
  </section>
</template>
