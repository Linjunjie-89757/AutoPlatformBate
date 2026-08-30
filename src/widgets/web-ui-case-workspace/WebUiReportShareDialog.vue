<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { CopyDocument, Link, RefreshRight, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  formatWebUiDateTime,
  webUiAutomationApi,
  type WebUiReportShareCreated,
  type WebUiReportShareSummary,
  type WebUiReportShareType,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmAction } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  modelValue: boolean
  workspaceCode: string
  shareType: WebUiReportShareType
  targetId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const loading = ref(false)
const submitting = ref(false)
const expiresInDays = ref(7)
const shares = ref<WebUiReportShareSummary[]>([])
const latestCreated = ref<WebUiReportShareCreated | null>(null)
let requestSeq = 0

const enabledShares = computed(() => shares.value.filter(share => share.status === 1))
const shareTypeLabel = computed(() => props.shareType === 'BATCH' ? '批次报告' : '执行报告')

function buildAbsoluteShareUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return new URL(path, window.location.origin).toString()
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMessage)
  } catch {
    ElMessage.warning('当前浏览器不允许自动复制，请手动选择链接复制')
  }
}

async function loadShares() {
  const targetId = props.targetId
  const requestId = ++requestSeq
  if (!props.modelValue || !targetId) {
    shares.value = []
    latestCreated.value = null
    return
  }

  loading.value = true
  try {
    const result = await webUiAutomationApi.getReportShares(props.workspaceCode, {
      shareType: props.shareType,
      targetId,
    })
    if (requestId === requestSeq && props.modelValue && props.targetId === targetId) {
      shares.value = result
    }
  } catch (error) {
    if (requestId === requestSeq && props.modelValue && props.targetId === targetId) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === requestSeq && props.modelValue && props.targetId === targetId) {
      loading.value = false
    }
  }
}

async function createShare() {
  if (!props.targetId) {
    ElMessage.warning('暂无可分享的报告')
    return
  }
  submitting.value = true
  try {
    const result = await webUiAutomationApi.createReportShare(props.workspaceCode, {
      shareType: props.shareType,
      targetId: props.targetId,
      expiresInDays: expiresInDays.value,
    })
    latestCreated.value = result
    await copyText(buildAbsoluteShareUrl(result.shareUrl), '公开分享链接已生成并复制')
    await loadShares()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function copyLatestCreated() {
  if (!latestCreated.value) {
    return
  }
  await copyText(buildAbsoluteShareUrl(latestCreated.value.shareUrl), '公开分享链接已复制')
}

async function revokeShare(share: WebUiReportShareSummary) {
  try {
    await confirmAction({
      title: '撤销公开链接',
      message: '撤销后，已经发出去的公开链接将无法继续访问。',
      confirmText: '撤销',
      cancelText: '取消',
    })
    await webUiAutomationApi.revokeReportShare(props.workspaceCode, share.id)
    ElMessage.success('公开分享链接已撤销')
    await loadShares()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function regenerateShare(share: WebUiReportShareSummary) {
  submitting.value = true
  try {
    const result = await webUiAutomationApi.regenerateReportShare(props.workspaceCode, share.id)
    latestCreated.value = result
    await copyText(buildAbsoluteShareUrl(result.shareUrl), '公开分享链接已重新生成并复制')
    await loadShares()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

watch(
  () => [props.modelValue, props.workspaceCode, props.shareType, props.targetId] as const,
  () => {
    void loadShares()
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog v-model="visible" :title="`${shareTypeLabel}分享`" width="560px">
    <div v-loading="loading" class="web-ui-report-share">
      <el-alert
        title="公开链接不需要登录，任何拿到链接的人都可以只读查看报告。敏感变量仍会按执行快照脱敏。"
        type="warning"
        show-icon
        :closable="false"
      />

      <section class="web-ui-report-share__create">
        <el-radio-group v-model="expiresInDays">
          <el-radio-button :label="1">1 天</el-radio-button>
          <el-radio-button :label="7">7 天</el-radio-button>
          <el-radio-button :label="30">30 天</el-radio-button>
          <el-radio-button :label="0">永久</el-radio-button>
        </el-radio-group>
        <AppButton type="primary" :icon="Link" :loading="submitting" @click="createShare">生成公开链接</AppButton>
      </section>

      <section v-if="latestCreated" class="web-ui-report-share__latest">
        <span>最新生成的公开链接</span>
        <code>{{ buildAbsoluteShareUrl(latestCreated.shareUrl) }}</code>
        <AppButton size="small" :icon="CopyDocument" @click="copyLatestCreated">复制</AppButton>
      </section>

      <section class="web-ui-report-share__list">
        <header>
          <strong>已生成链接</strong>
          <span>{{ enabledShares.length }} 个启用中</span>
        </header>
        <p class="web-ui-report-share__hint">
          平台只保存公开 token 的哈希值。关闭弹窗后不能再次查看旧链接，如需重新复制，请使用“重新生成”。
        </p>
        <el-empty v-if="!shares.length" description="暂无公开分享链接" :image-size="72" />
        <article v-for="share in shares" v-else :key="share.id" class="web-ui-report-share-item">
          <div>
            <strong>{{ share.status === 1 ? '启用中' : '已撤销' }}</strong>
            <span>过期时间：{{ share.expiresAt ? formatWebUiDateTime(share.expiresAt) : '永久有效' }}</span>
            <span>访问次数：{{ share.accessCount }}</span>
          </div>
          <div class="web-ui-report-share-item__actions">
            <AppButton
              size="small"
              :icon="RefreshRight"
              :disabled="share.status !== 1"
              :loading="submitting"
              @click="regenerateShare(share)"
            >
              重新生成
            </AppButton>
            <AppButton
              size="small"
              :icon="SwitchButton"
              :disabled="share.status !== 1"
              @click="revokeShare(share)"
            >
              撤销
            </AppButton>
          </div>
        </article>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.web-ui-report-share {
  display: grid;
  gap: var(--app-space-4);
}

.web-ui-report-share__create {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-report-share__latest {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-md);
  background: #eff6ff;
}

.web-ui-report-share__latest span,
.web-ui-report-share__list header span,
.web-ui-report-share-item span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-report-share__latest code {
  overflow-wrap: anywhere;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xs);
}

.web-ui-report-share__list {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-report-share__hint {
  margin: calc(var(--app-space-2) * -1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-md);
}

.web-ui-report-share__list header,
.web-ui-report-share-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-report-share-item {
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-report-share-item > div:first-child {
  display: grid;
  min-width: 0;
  gap: var(--app-space-1);
}

.web-ui-report-share-item__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

@media (max-width: 640px) {
  .web-ui-report-share-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
