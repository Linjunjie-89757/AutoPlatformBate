<script setup lang="ts">
import type { ApiDefinitionDetail } from '@/entities/api-automation'
import { computed, ref, watch } from 'vue'
import ApiRequestTimeoutInput from './ApiRequestTimeoutInput.vue'
import './styles/api-request-settings-panel.css'

const props = defineProps<{
  detail: ApiDefinitionDetail
  loading?: boolean
  saving?: boolean
  canEdit?: boolean
  markDirty: () => void
}>()

const disabled = computed(() => props.loading || props.saving || props.canEdit === false)
const showResetConfirm = ref(false)
watch(() => props.detail, () => { showResetConfirm.value = false })

function updateTimeout(field: 'connectTimeoutMs' | 'timeoutMs', value: number) {
  if (disabled.value) return
  props.detail.requestConfig[field] = value
  props.markDirty()
}

function updateRedirect(event: Event) {
  if (disabled.value) return
  props.detail.requestConfig.followRedirects = (event.target as HTMLInputElement).checked
  props.markDirty()
}

function resetDefaults() {
  if (disabled.value) return
  Object.assign(props.detail.requestConfig, { connectTimeoutMs: 30000, timeoutMs: 60000, followRedirects: true })
  showResetConfirm.value = false
  props.markDirty()
}
</script>

<template>
  <div class="api-request-settings" :aria-busy="Boolean(loading || saving)">
    <div v-if="loading" class="api-settings-skeleton" role="status" aria-label="正在加载请求设置">
      <span class="api-settings-skeleton__title" />
      <div class="api-settings-skeleton__inputs"><span /><span /></div>
      <span class="api-settings-skeleton__section" />
      <span class="api-settings-skeleton__option" />
    </div>
    <template v-else>
      <section class="api-settings-group">
        <h3>超时（ms）</h3>
        <div class="api-settings-timeouts">
          <ApiRequestTimeoutInput label="连接超时" :model-value="detail.requestConfig.connectTimeoutMs ?? 10000" :disabled="disabled" @update:model-value="updateTimeout('connectTimeoutMs', $event)" />
          <ApiRequestTimeoutInput label="响应超时" :model-value="detail.requestConfig.timeoutMs" :disabled="disabled" @update:model-value="updateTimeout('timeoutMs', $event)" />
        </div>
      </section>
      <section class="api-settings-group">
        <h3>重定向</h3>
        <label class="api-settings-redirect" :class="{ 'is-disabled': disabled }">
          <input type="checkbox" :checked="detail.requestConfig.followRedirects !== false" :disabled="disabled" @change="updateRedirect">
          <span>自动跟随重定向</span><small>（301 / 302 / 307 / 308）</small>
        </label>
      </section>
      <div v-if="showResetConfirm" class="api-settings-reset-confirm">
        <span>确认恢复默认值？</span>
        <button type="button" :disabled="disabled" @click="showResetConfirm = false">取消</button>
        <button type="button" class="is-danger" :disabled="disabled" @click="resetDefaults">确认</button>
      </div>
      <button v-else type="button" class="api-settings-reset" :disabled="disabled" @click="showResetConfirm = true">恢复默认值</button>
    </template>
  </div>
</template>
