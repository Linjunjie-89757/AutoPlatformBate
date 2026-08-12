<script setup lang="ts">
import type { ApiDefinitionDetail } from '@/entities/api-automation'
import './styles/api-request-auth-panel.css'

defineProps<{
  detail: ApiDefinitionDetail
  markDirty: () => void
}>()
</script>

<template>
  <div class="api-auth-panel">
    <div class="api-config-panel-head">
      <strong>请求认证</strong>
      <span>配置当前请求发送时附带的认证信息。</span>
    </div>
    <span class="api-form-label">认证方式</span>
    <el-radio-group v-model="detail.requestConfig.authConfig.authType" @change="markDirty">
      <el-radio-button value="NONE">No Auth</el-radio-button>
      <el-radio-button value="BASIC">Basic Auth</el-radio-button>
      <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
    </el-radio-group>
    <div v-if="detail.requestConfig.authConfig.authType === 'NONE'" class="api-auth-empty">
      当前请求不附带认证信息。
    </div>
    <div v-if="detail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
      <label>Username</label>
      <el-input v-model="detail.requestConfig.authConfig.basicAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
      <label>Password</label>
      <el-input v-model="detail.requestConfig.authConfig.basicAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
    </div>
    <div v-else-if="detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
      <label>Username</label>
      <el-input v-model="detail.requestConfig.authConfig.digestAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
      <label>Password</label>
      <el-input v-model="detail.requestConfig.authConfig.digestAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
    </div>
  </div>
</template>
