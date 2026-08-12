<script setup lang="ts">
import { ArrowDown, ArrowUp, Check, X as Close } from '@lucide/vue'

import type { ParamSetItem } from '@/entities/config'
import type { ConfigEnvLocalVariableForm } from '@/features/config-env-create-edit'
import { parseWebUiVariables } from '@/features/config-param-create-edit'
import { AppFigmaSwitch } from '@/shared/ui'

import type { LocalVariableEditorForm } from './configEnvironmentPanel.types'

defineProps<{
  bindVisible: boolean
  selectedSetCount: number
  availableSets: ParamSetItem[]
  bindSelection: number[]
  priorityVisible: boolean
  prioritySets: ParamSetItem[]
  conflicts: Array<Array<{ name: string; set: ParamSetItem }>>
  localMode: 'create' | 'edit' | null
  localEditor: LocalVariableEditorForm
  localTypeOptions: LocalVariableEditorForm['valueType'][]
  deleteVariable: ConfigEnvLocalVariableForm | null
  saving: boolean
  scopeLabel: (item: ParamSetItem) => string
  hasSensitive: (item: ParamSetItem) => boolean
  versionLabel: (item: ParamSetItem) => string
}>()

const emit = defineEmits<{
  closeBind: []
  toggleSet: [id: number]
  confirmBind: []
  closePriority: []
  movePriority: [index: number, direction: -1 | 1]
  savePriority: []
  closeLocal: []
  syncLocalType: []
  submitLocal: []
  closeDelete: []
  confirmDelete: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="bindVisible" class="figma-env-modal" data-node-id="332:4204" @mousedown.self="emit('closeBind')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--bind-variable">
        <header>
          <div class="figma-env-modal__heading-copy"><h2>绑定变量集</h2><p>已绑定 {{ selectedSetCount }} 个，可绑定 {{ availableSets.length }} 个</p></div>
          <button type="button" @click="emit('closeBind')"><el-icon><Close /></el-icon></button>
        </header>
        <div class="figma-env-modal__variable-set-options app-soft-scrollbar">
          <button v-for="item in availableSets" :key="item.id" type="button" :class="{ 'is-selected': bindSelection.includes(item.id) }" @click="emit('toggleSet', item.id)">
            <span class="figma-env-modal__checkbox"><el-icon v-if="bindSelection.includes(item.id)"><Check /></el-icon></span>
            <span class="figma-env-modal__variable-set-option-copy">
              <span><strong>{{ item.paramName }}</strong><em>{{ scopeLabel(item) }}</em><em v-if="hasSensitive(item)" class="is-sensitive">含敏感变量</em></span>
              <small>{{ parseWebUiVariables(item.contentJson).length }} 个变量 <i>·</i> <code>{{ versionLabel(item) }}</code></small>
            </span>
          </button>
          <div v-if="!availableSets.length" class="figma-env-modal__variable-empty">暂无可绑定的变量集</div>
        </div>
        <footer><span>已选 {{ bindSelection.length }} 个</span><button type="button" @click="emit('closeBind')">取消</button><button class="is-primary" type="button" :disabled="!bindSelection.length || saving" @click="emit('confirmBind')">确认绑定</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="priorityVisible" class="figma-env-modal" data-node-id="332:4969" @mousedown.self="emit('closePriority')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--priority">
        <header>
          <div class="figma-env-modal__heading-copy"><h2>调整优先级</h2><p>数字越小优先级越高，同名变量将以高优先级变量集为准</p></div>
          <button type="button" @click="emit('closePriority')"><el-icon><Close /></el-icon></button>
        </header>
        <div class="figma-env-modal__priority-body">
          <div class="figma-env-modal__priority-columns">
            <section><h3>当前顺序（可调整）</h3><article v-for="(item, index) in prioritySets" :key="item.id"><b>{{ index + 1 }}</b><span><strong>{{ item.paramName }}</strong><small>{{ parseWebUiVariables(item.contentJson).length }} 变量 · {{ versionLabel(item) }}</small></span><i><button type="button" :disabled="index === 0" @click="emit('movePriority', index, -1)"><el-icon><ArrowUp /></el-icon></button><button type="button" :disabled="index === prioritySets.length - 1" @click="emit('movePriority', index, 1)"><el-icon><ArrowDown /></el-icon></button></i></article></section>
            <section><h3>调整后预览</h3><article v-for="(item, index) in prioritySets" :key="item.id" class="is-preview"><b>{{ index + 1 }}</b><strong>{{ item.paramName }}</strong></article></section>
          </div>
          <section v-if="conflicts.length" class="figma-env-modal__conflicts"><header>以下变量存在同名冲突，高优先级将覆盖低优先级</header><div><p v-for="items in conflicts" :key="items[0]?.name"><code>{{ items[0]?.name }}</code><span>存在于</span><template v-for="(owner, index) in items" :key="owner.set.id"><span>{{ owner.set.paramName }}</span><i v-if="index < items.length - 1">和</i></template><span>，以</span><strong>{{ prioritySets[0]?.paramName }}</strong><span>为准</span></p></div></section>
        </div>
        <footer><button type="button" @click="emit('closePriority')">取消</button><button class="is-primary" type="button" :disabled="saving" @click="emit('savePriority')">保存优先级</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="localMode" class="figma-env-modal" :data-node-id="localMode === 'create' ? '332:5784' : '332:6521'" @mousedown.self="emit('closeLocal')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--local-variable">
        <header><h2>{{ localMode === 'create' ? '添加局部变量' : '编辑局部变量' }}</h2><button type="button" @click="emit('closeLocal')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__body figma-env-modal__body--local-variable">
          <label><span>变量名 <b>*</b></span><input v-model="localEditor.name" class="is-mono" type="text" placeholder="例：API_GATEWAY_URL"></label>
          <label><span>值</span><input v-model="localEditor.value" :type="localEditor.sensitive ? 'password' : 'text'" :placeholder="localEditor.valueType === 'secret' ? '输入后将按敏感变量存储' : ''"></label>
          <div class="figma-env-modal__row figma-env-modal__row--local-variable">
            <label><span>类型</span><select v-model="localEditor.valueType" @change="emit('syncLocalType')"><option v-for="option in localTypeOptions" :key="option" :value="option">{{ option }}</option></select></label>
            <div class="figma-env-modal__default"><span>敏感变量</span><AppFigmaSwitch v-model="localEditor.sensitive" label="敏感变量" /></div>
          </div>
          <label><span>说明</span><input v-model="localEditor.description" type="text" placeholder="简要描述此变量的用途"></label>
          <div class="figma-env-modal__local-enabled"><span>是否启用</span><AppFigmaSwitch v-model="localEditor.enabled" label="是否启用" /></div>
        </div>
        <footer><button type="button" @click="emit('closeLocal')">取消</button><button class="is-primary" type="button" :disabled="saving" @click="emit('submitLocal')">保存</button></footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="deleteVariable" class="figma-env-modal" data-node-id="332:7259" @mousedown.self="emit('closeDelete')">
      <section class="figma-env-modal__dialog figma-env-modal__dialog--delete-variable">
        <header><h2>删除局部变量</h2><button type="button" @click="emit('closeDelete')"><el-icon><Close /></el-icon></button></header>
        <div class="figma-env-modal__delete-variable-copy">确认删除变量「<strong>{{ deleteVariable.name }}</strong>」？此操作不可恢复。</div>
        <footer><button type="button" @click="emit('closeDelete')">取消</button><button class="is-danger" type="button" :disabled="saving" @click="emit('confirmDelete')">确认删除</button></footer>
      </section>
    </div>
  </Teleport>
</template>
