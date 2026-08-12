<script setup lang="ts">
import { AlertTriangle as Warning, X as Close } from '@lucide/vue'

import type { MockApplicationItem, MockReleaseItem } from '@/entities/config'

defineProps<{
  bindVisible: boolean
  applications: MockApplicationItem[]
  bindApplicationId: number | null
  bindReleaseId: number | null
  bindReleases: MockReleaseItem[]
  versionVisible: boolean
  currentRelease: MockReleaseItem | null
  versionOptions: MockReleaseItem[]
  versionSelection: number | null
  selectedVersionName: string
  currentReleaseId: number | null
  unbindVisible: boolean
  currentApplication: MockApplicationItem | null
  referenceCount: number | null
  saving: boolean
}>()

const emit = defineEmits<{
  closeBind: []
  'update:bindApplicationId': [value: number | null]
  'update:bindReleaseId': [value: number | null]
  changeApplication: [value: number | null]
  confirmBind: []
  closeVersion: []
  'update:versionSelection': [value: number | null]
  confirmVersion: []
  closeUnbind: []
  confirmUnbind: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="bindVisible" class="figma-env-modal" @mousedown.self="emit('closeBind')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-bind">
        <header><h2>绑定 Mock 应用</h2><button type="button" @click="emit('closeBind')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__mock-bind-body">
          <label><span>Mock 应用 <b>*</b></span><select :value="bindApplicationId ?? ''" @change="emit('changeApplication', Number(($event.target as HTMLSelectElement).value) || null); emit('update:bindApplicationId', Number(($event.target as HTMLSelectElement).value) || null)"><option value="" disabled>请选择 Mock 应用</option><option v-for="item in applications" :key="item.id" :value="item.id">{{ item.appName }}（{{ item.appCode }}）</option></select></label>
          <label><span>发布版本 <b>*</b></span><select :value="bindReleaseId ?? ''" :disabled="!bindApplicationId" @change="emit('update:bindReleaseId', Number(($event.target as HTMLSelectElement).value) || null)"><option value="" disabled>请选择发布版本</option><option v-for="item in bindReleases" :key="item.id" :value="item.id">v{{ item.versionNo }} · {{ item.releaseName || '未命名版本' }}</option></select></label>
          <div class="figma-env-modal__mock-bind-tip"><el-icon><Warning /></el-icon><span>绑定后默认启用 Mock，请求将按所选不可变发布版本执行。</span></div>
        </div>
        <footer><button type="button" @click="emit('closeBind')">取消</button><button class="is-primary" type="button" :disabled="saving || !bindApplicationId || !bindReleaseId" @click="emit('confirmBind')">确认绑定</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="versionVisible && currentRelease" class="figma-env-modal" data-node-id="334:8784" @mousedown.self="emit('closeVersion')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-version" data-node-id="334:8785">
        <header><h2>切换 Mock 版本</h2><button type="button" @click="emit('closeVersion')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__mock-version-body">
          <div class="figma-env-modal__mock-current"><span>当前版本：</span><code>v{{ currentRelease.versionNo }}</code></div>
          <div class="figma-env-modal__mock-version-list app-soft-scrollbar">
            <button v-for="release in versionOptions" :key="release.id" type="button" :class="{ 'is-selected': versionSelection === release.id && release.id !== currentReleaseId, 'is-current': release.id === currentReleaseId }" :disabled="release.id === currentReleaseId" @click="emit('update:versionSelection', release.id)">
              <i><span /></i><code>v{{ release.versionNo }}</code><em v-if="release.id === currentReleaseId">当前</em><small v-else-if="release.active">当前启用</small>
            </button>
          </div>
          <div class="figma-env-modal__mock-version-warning"><el-icon><Warning /></el-icon><div><p>版本切换将立即生效，当前正在运行的测试任务会在下次调用时使用新版本</p><small>{{ selectedVersionName || '该发布版本暂无说明' }}</small></div></div>
        </div>
        <footer><button type="button" @click="emit('closeVersion')">取消</button><button class="is-primary" type="button" :disabled="saving || !versionSelection || versionSelection === currentReleaseId" @click="emit('confirmVersion')">确认切换</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="unbindVisible && currentApplication && currentRelease" class="figma-env-modal" data-node-id="334:9351" @mousedown.self="emit('closeUnbind')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--mock-unbind" data-node-id="334:9352">
        <header><h2>解除 Mock 绑定</h2><button type="button" @click="emit('closeUnbind')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__mock-unbind-body">
          <p>解除后，测试请求将直接发送到真实服务，不再经过 Mock 拦截</p>
          <div v-if="referenceCount" class="figma-env-modal__mock-unbind-warning"><el-icon><Warning /></el-icon><span>当前 Mock 应用有 {{ referenceCount }} 个引用，解除当前环境绑定后请确认相关任务配置</span></div>
          <div class="figma-env-modal__mock-unbind-target">即将解除：<strong>{{ currentApplication.appName }}</strong><i>·</i><code>v{{ currentRelease.versionNo }}</code></div>
        </div>
        <footer><button type="button" @click="emit('closeUnbind')">取消</button><button class="is-danger" type="button" :disabled="saving" @click="emit('confirmUnbind')">确认解除绑定</button></footer>
      </section>
    </div>
  </Teleport>
</template>
