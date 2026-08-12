<script setup lang="ts">
import { Activity as Connection, AlertTriangle as Warning, Layers, Link2 as Link, Monitor, X as Close, XCircle as CircleClose } from '@lucide/vue'

import type { ConfigAutomationType } from '@/features/config-env-create-edit'
import { AppFigmaSwitch } from '@/shared/ui'

import type { EnvironmentEditorForm, ServiceEditorForm } from './configEnvironmentPanel.types'

defineProps<{
  environmentMode: 'create' | 'edit' | null
  environmentEditor: EnvironmentEditorForm
  stageOptions: Array<{ value: string; label: string }>
  applicabilityOptions: Array<{ value: ConfigAutomationType; label: string; icon: 'api' | 'web' | 'both' }>
  disableVisible: boolean
  runningReferences: Array<{ sourceType: string; sourceId: number | null; sourceName: string | null }>
  referenceCount: number
  serviceVisible: boolean
  serviceEditingIndex: number | null
  serviceEditor: ServiceEditorForm
  saving: boolean
  operating: boolean
}>()

const emit = defineEmits<{
  closeEnvironment: []
  submitEnvironment: []
  closeDisable: []
  submitStatus: []
  closeService: []
  testService: []
  submitService: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="environmentMode" class="figma-env-modal" :data-node-id="environmentMode === 'create' ? '331:2778' : '330:730'" @mousedown.self="emit('closeEnvironment')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--environment" :class="{ 'is-create': environmentMode === 'create' }">
        <header><div class="figma-env-modal__heading-copy"><h2>{{ environmentMode === 'create' ? '新建环境' : '编辑环境' }}</h2><p v-if="environmentMode === 'create'">先创建环境，再配置服务地址、变量和 Mock</p></div><button type="button" @click="emit('closeEnvironment')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__body figma-env-modal__body--environment">
          <label><span>环境名称 <b>*</b></span><input v-model="environmentEditor.envName" type="text" :placeholder="environmentMode === 'create' ? '例：功能测试环境、性能测试环境' : '请输入环境名称'"></label>
          <fieldset class="figma-env-modal__choice-field"><legend>环境阶段</legend><div class="figma-env-modal__stage-options"><button v-for="option in stageOptions" :key="option.value" type="button" :class="{ 'is-selected': environmentEditor.envType === option.value }" @click="environmentEditor.envType = option.value">{{ option.label }}</button></div></fieldset>
          <fieldset class="figma-env-modal__choice-field"><legend>适用范围</legend><div class="figma-env-modal__applicability-options"><button v-for="option in applicabilityOptions" :key="option.value" type="button" :class="{ 'is-selected': environmentEditor.automationType === option.value }" @click="environmentEditor.automationType = option.value"><el-icon><Link v-if="option.icon === 'api'" /><Monitor v-else-if="option.icon === 'web'" /><Layers v-else /></el-icon>{{ option.label }}</button></div></fieldset>
          <label><span>描述</span><input v-model="environmentEditor.description" type="text" :placeholder="environmentMode === 'create' ? '说明该环境的用途和范围' : '请输入环境说明'"></label>
        </div>
        <footer><button type="button" @click="emit('closeEnvironment')">取消</button><button class="is-primary" type="button" :disabled="saving" @click="emit('submitEnvironment')">{{ environmentMode === 'create' ? '创建环境' : '保存' }}</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="disableVisible" class="figma-env-modal" :data-node-id="runningReferences.length ? '330:2031' : '330:1272'" @mousedown.self="emit('closeDisable')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--confirm" :class="{ 'is-blocked': runningReferences.length > 0 }">
        <header><h2>停用环境</h2><button type="button" @click="emit('closeDisable')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__confirm-body">
          <div v-if="runningReferences.length" class="figma-env-modal__notice is-danger"><el-icon><CircleClose /></el-icon><div><strong>存在运行中任务，无法停用</strong><span v-for="item in runningReferences" :key="`${item.sourceType}-${item.sourceId}`">· {{ item.sourceName || '未命名任务' }}</span></div></div>
          <div v-else class="figma-env-modal__notice is-warning"><el-icon><Warning /></el-icon><span>停用后以下 <b>{{ referenceCount }}</b> 个引用任务将无法使用此环境</span></div>
        </div>
        <footer><button type="button" @click="emit('closeDisable')">取消</button><button v-if="runningReferences.length" class="is-disabled-action" type="button" disabled>存在运行中任务，无法停用</button><button v-else class="is-warning-action" type="button" :disabled="operating" @click="emit('submitStatus')">确认停用</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="serviceVisible" class="figma-env-modal" data-node-id="311:6625" @mousedown.self="emit('closeService')">
      <section class="figma-env-modal__dialog" data-node-id="311:6626">
        <header><h2>{{ serviceEditingIndex == null ? '添加服务' : '编辑服务' }}</h2><button type="button" @click="emit('closeService')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__body">
          <label><span>服务名称 <b>*</b></span><input v-model="serviceEditor.name" type="text" placeholder="例：订单服务"></label>
          <label><span>Base URL <b>*</b></span><div class="figma-env-modal__url"><input v-model="serviceEditor.baseUrl" type="text" placeholder="https://api.example.com"><button type="button" @click="emit('testService')"><el-icon><Connection /></el-icon>连接测试</button></div></label>
          <div class="figma-env-modal__row"><label><span>连接超时 (ms)</span><input v-model.number="serviceEditor.timeoutMs" type="number" min="1000" max="120000"></label><div class="figma-env-modal__default"><span>设为默认入口</span><AppFigmaSwitch v-model="serviceEditor.isDefault" label="设为默认入口" size="regular" /></div></div>
          <div class="figma-env-modal__enabled"><span><strong>是否启用</strong><small>停用后此服务地址不参与执行</small></span><AppFigmaSwitch v-model="serviceEditor.enabled" label="是否启用" size="regular" /></div>
        </div>
        <footer><button type="button" @click="emit('closeService')">取消</button><button class="is-primary" type="button" :disabled="saving" @click="emit('submitService')">保存</button></footer>
      </section>
    </div>
  </Teleport>
</template>
