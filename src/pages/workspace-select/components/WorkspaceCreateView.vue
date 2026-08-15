<script setup lang="ts">
import { CheckCircle2, ChevronDown, Loader2 } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'

import WorkspaceFlowBackButton from './WorkspaceFlowBackButton.vue'
import WorkspaceFlowBrand from './WorkspaceFlowBrand.vue'

type InitializationMode = 'blank' | 'sample'

const INDUSTRIES = [
  '电商 / 零售',
  '金融 / 支付',
  '政务 / 公共服务',
  '医疗 / 健康',
  '教育 / 培训',
  '游戏 / 娱乐',
  '企业服务 / SaaS',
  '其他',
]

const emit = defineEmits<{
  back: []
  created: [workspace: WorkspaceItem]
  enter: [workspace: WorkspaceItem]
}>()

const workspaceName = ref('')
const description = ref('')
const industry = ref('')
const initializationMode = ref<InitializationMode>('blank')
const nameError = ref('')
const creating = ref(false)
const createdWorkspace = ref<WorkspaceItem | null>(null)

function getWorkspaceInitial(workspace: WorkspaceItem) {
  return (workspace.workspaceName || workspace.workspaceCode || 'A').trim().slice(0, 1).toUpperCase()
}

function handleNameInput() {
  if (nameError.value) {
    nameError.value = ''
  }
}

async function handleCreate() {
  const normalizedName = workspaceName.value.trim()
  if (!normalizedName) {
    nameError.value = '请输入工作区名称'
    return
  }

  if (creating.value) {
    return
  }

  creating.value = true
  try {
    const workspace = await workspaceApi.createWorkspace({
      workspaceName: normalizedName,
      description: description.value.trim() || null,
      workspaceType: 'PROJECT',
      industry: industry.value || null,
      initializationMode: initializationMode.value.toUpperCase(),
    })
    createdWorkspace.value = workspace
    emit('created', workspace)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error) || '工作区创建失败，请稍后重试')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="workspace-flow-page">
    <section v-if="createdWorkspace" class="workspace-flow workspace-flow--success" aria-label="工作区创建成功">
      <div class="workspace-flow__success-icon">
        <CheckCircle2 aria-hidden="true" />
      </div>
      <h1>工作区已创建</h1>
      <p class="workspace-flow__success-copy">
        工作区 <strong>{{ createdWorkspace.workspaceName }}</strong> 已成功创建，你已被设为工作区管理员。
      </p>

      <div class="workspace-flow__created-card">
        <span class="workspace-flow__avatar workspace-flow__avatar--primary">
          {{ getWorkspaceInitial(createdWorkspace) }}
        </span>
        <span>
          <strong>{{ createdWorkspace.workspaceName }}</strong>
          <small>1 名成员 · 刚刚创建</small>
        </span>
      </div>

      <button class="workspace-flow__primary-button workspace-flow__primary-button--large" type="button" @click="emit('enter', createdWorkspace)">
        进入工作区 →
      </button>
    </section>

    <section v-else class="workspace-flow workspace-flow--form" aria-label="创建工作区">
      <WorkspaceFlowBrand />
      <WorkspaceFlowBackButton @back="emit('back')" />

      <form class="workspace-flow__form-card" @submit.prevent="handleCreate">
        <div class="workspace-flow__form-heading">
          <h1>创建工作区</h1>
          <p>工作区是团队和项目的容器，创建后可邀请成员加入。</p>
        </div>

        <label class="workspace-flow__field">
          <span>工作区名称 <b>*</b></span>
          <input
            v-model="workspaceName"
            :class="{ 'is-error': nameError }"
            maxlength="100"
            placeholder="例如：X-MAN、订单中心测试团队"
            @input="handleNameInput"
          >
          <small v-if="nameError" class="workspace-flow__field-error">{{ nameError }}</small>
        </label>

        <label class="workspace-flow__field">
          <span>工作区描述（选填）</span>
          <textarea
            v-model="description"
            maxlength="500"
            rows="3"
            placeholder="简要描述该工作区的用途和覆盖的业务范围"
          />
        </label>

        <label class="workspace-flow__field">
          <span>所属行业（选填）</span>
          <span class="workspace-flow__select-wrap">
            <select v-model="industry" :class="{ 'is-placeholder': !industry }">
              <option value="">请选择所属行业</option>
              <option v-for="item in INDUSTRIES" :key="item" :value="item">{{ item }}</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>

        <fieldset class="workspace-flow__initialization">
          <legend>初始化数据</legend>
          <div>
            <button
              type="button"
              :class="{ 'is-selected': initializationMode === 'blank' }"
              @click="initializationMode = 'blank'"
            >
              <strong>空白工作区</strong>
              <small>从零开始，适合自定义需求</small>
            </button>
            <button
              type="button"
              :class="{ 'is-selected': initializationMode === 'sample' }"
              @click="initializationMode = 'sample'"
            >
              <strong>导入示例数据</strong>
              <small>预置用例，快速熟悉平台功能</small>
            </button>
          </div>
        </fieldset>

        <div class="workspace-flow__form-actions">
          <button type="button" class="workspace-flow__secondary-button" @click="emit('back')">取消</button>
          <button type="submit" class="workspace-flow__primary-button" :disabled="creating">
            <Loader2 v-if="creating" class="is-spinning" aria-hidden="true" />
            <span>{{ creating ? '创建中...' : '创建工作区' }}</span>
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
