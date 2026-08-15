<script setup lang="ts">
import { AlertCircle, Clock, Loader2, XCircle } from '@lucide/vue'
import { computed } from 'vue'

import WorkspaceFlowBrand from './WorkspaceFlowBrand.vue'

const props = withDefaults(defineProps<{
  workspaceName: string
  description: string
  submittedAt?: string | null
  cancelling?: boolean
}>(), {
  submittedAt: null,
  cancelling: false,
})

const emit = defineEmits<{
  back: []
  cancel: []
}>()

const submittedAtText = computed(() => {
  if (!props.submittedAt) {
    return '刚刚'
  }
  const submittedAt = new Date(props.submittedAt)
  if (Number.isNaN(submittedAt.getTime())) {
    return '刚刚'
  }
  if (Date.now() - submittedAt.getTime() < 5 * 60 * 1000) {
    return '刚刚'
  }
  return submittedAt.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})
</script>

<template>
  <main class="workspace-flow-page">
    <section class="workspace-flow workspace-flow--pending" aria-label="工作区申请已提交">
      <WorkspaceFlowBrand />

      <div class="workspace-flow__pending-heading">
        <span><Clock aria-hidden="true" /></span>
        <h1>申请已提交</h1>
        <p>你的申请已发送给工作区管理员。<br>审批通过后你将收到邮件通知，届时可重新登录进入工作区。</p>
      </div>

      <div class="workspace-flow__pending-card">
        <small>申请详情</small>
        <div class="workspace-flow__pending-workspace">
          <span class="workspace-flow__avatar workspace-flow__avatar--primary">{{ workspaceName.slice(0, 1) }}</span>
          <span><strong>{{ workspaceName }}</strong><em>{{ description }}</em></span>
        </div>
        <dl>
          <div><dt>申请状态</dt><dd class="is-pending"><i />等待管理员审批</dd></div>
          <div><dt>提交时间</dt><dd>{{ submittedAtText }}</dd></div>
          <div><dt>预计时效</dt><dd>通常 1 个工作日内完成</dd></div>
        </dl>
      </div>

      <div class="workspace-flow__pending-tip">
        <AlertCircle aria-hidden="true" />
        <p>如审批长时间未处理，可联系工作区管理员催办。通知将发送至你的注册邮箱。</p>
      </div>

      <button class="workspace-flow__primary-button workspace-flow__pending-back" type="button" @click="emit('back')">
        返回工作区列表
      </button>
      <button class="workspace-flow__cancel-application" type="button" :disabled="cancelling" @click="emit('cancel')">
        <Loader2 v-if="cancelling" class="is-spinning" aria-hidden="true" />
        <XCircle v-else aria-hidden="true" />
        <span>{{ cancelling ? '撤销中...' : '撤销申请' }}</span>
      </button>
    </section>
  </main>
</template>
