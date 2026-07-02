<script setup lang="ts">
import { computed, ref } from 'vue'
import { Cpu, InfoFilled } from '@element-plus/icons-vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import type {
  WebUiElementGroupItem,
  WebUiElementModuleItem,
  WebUiElementPageItem,
  WebUiEnvironmentItem,
} from '@/entities/web-ui-automation'
import {
  buildLocalRunnerStatusView,
  type LocalRunnerAuthStatus,
  type LocalRunnerHealthView,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import type { WebUiElementCollectLaunchForm } from './elementCollectTypes'

const props = defineProps<{
  modelValue: boolean
  form: WebUiElementCollectLaunchForm
  aiProviderLoading: boolean
  availableAiProviders: AiProviderConnectionItem[]
  enabledEnvironments: WebUiEnvironmentItem[]
  modules: WebUiElementModuleItem[]
  pageOptions: WebUiElementPageItem[]
  groupOptions: WebUiElementGroupItem[]
  localRunnerChecking: boolean
  localRunnerOpening: boolean
  localRunnerCapturing: boolean
  localRunnerAuthSaving: boolean
  localRunnerAuthClearing: boolean
  localRunnerSessionReleasing: boolean
  localRunnerHealth: LocalRunnerHealthView | null
  localRunnerAuthStatus: LocalRunnerAuthStatus | null
}>()

const pageObjectExpanded = ref(false)
const selectedRunnerId = ref('local-runner')

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'module-change': []
  'page-change': [value: number | null]
  'group-change': [value: number | null]
  'check-local-runner': []
  'open-local-runner-page': []
  'open-bound-task': []
  start: []
  offline: []
}>()

const runnerState = computed(() => buildLocalRunnerStatusView({
  checking: props.localRunnerChecking,
  health: props.localRunnerHealth,
  expectedUrl: props.form.pageUrl,
}))

const canStartCollect = computed(() => runnerState.value.canCollect && !isRunnerTaskOccupied.value && !props.localRunnerCapturing)
const boundCollectTaskId = computed(() => props.localRunnerHealth?.boundTaskId || '')
const isRunnerTaskOccupied = computed(() => Boolean(boundCollectTaskId.value))
const localRunnerOption = computed(() => {
  if (props.localRunnerChecking) {
    return {
      id: 'local-runner',
      name: '本机 Runner',
      status: '检测中',
      tagType: 'info' as const,
      description: '正在检测本地 Runner 连接状态',
    }
  }
  if (props.localRunnerHealth?.online) {
    return {
      id: 'local-runner',
      name: '本机 Runner',
      status: isRunnerTaskOccupied.value ? '处理中' : '在线',
      tagType: isRunnerTaskOccupied.value ? 'warning' as const : 'success' as const,
      description: runnerState.value.currentUrl ? `当前页：${runnerState.value.currentUrl}` : '未打开页面',
    }
  }
  return {
    id: 'local-runner',
    name: '本机 Runner',
    status: '离线',
    tagType: 'danger' as const,
    description: '请先启动本地 Runner',
  }
})
const runnerOptions = computed(() => [localRunnerOption.value])
const selectedPageName = computed(() =>
  props.pageOptions.find(item => item.id === props.form.pageId)?.pageName || '',
)
const inferredPageName = computed(() => {
  const pageTitle = props.localRunnerHealth?.pageTitle?.trim()
  if (pageTitle) {
    return pageTitle.slice(0, 50)
  }
  const url = props.localRunnerHealth?.currentUrl || props.form.pageUrl
  if (!url) {
    return '智能采集页面'
  }
  try {
    const parsed = new URL(url)
    const pathName = parsed.pathname.split('/').filter(Boolean).pop()
    return (pathName || parsed.hostname || '智能采集页面').slice(0, 50)
  } catch {
    return '智能采集页面'
  }
})
const pageObjectSummary = computed(() => {
  if (selectedPageName.value) {
    return `使用已有：${selectedPageName.value}`
  }
  const pageName = props.form.pageName.trim() || inferredPageName.value
  return `自动新建：${pageName}`
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="640px"
    top="6vh"
    class="web-ui-collect-launch"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="web-ui-collect-launch__title">
        <span>新建 AI 采集任务</span>
        <el-tooltip
          content="入口只负责创建采集任务；候选审核、过滤明细、重新验证和保存会进入独立采集工作台处理。"
          placement="bottom-start"
        >
          <el-icon><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
    </template>

    <el-form class="web-ui-collect-launch__runner-form" label-width="112px">
      <el-form-item label="本地 Runner" required>
        <div class="web-ui-collect-launch__runner-select-row">
          <el-select v-model="selectedRunnerId" placeholder="选择可用 Runner">
            <el-option
              v-for="item in runnerOptions"
              :key="item.id"
              :label="`${item.name} · ${item.status}`"
              :value="item.id"
            >
              <div class="web-ui-collect-launch__runner-option">
                <span>{{ item.name }}</span>
                <el-tag :type="item.tagType" effect="light" size="small">
                  {{ item.status }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
          <AppButton size="small" :loading="localRunnerChecking" @click="emit('check-local-runner')">
            检测
          </AppButton>
        </div>
      </el-form-item>

      <el-form-item label="目标页地址">
        <div class="web-ui-collect-launch__open-page-row">
          <el-input
            v-model="form.pageUrl"
            clearable
            placeholder="输入目标页地址，例如 https://example.com/orders"
          />
          <AppButton
            size="small"
            :loading="localRunnerOpening"
            :disabled="!runnerState.canOpenPage && runnerState.kind !== 'OFFLINE'"
            @click="emit('open-local-runner-page')"
          >
            打开页面
          </AppButton>
        </div>
      </el-form-item>
    </el-form>

    <div class="web-ui-collect-launch__runner-status">
      <template v-if="isRunnerTaskOccupied">
        <span>当前页面正在处理采集任务 #{{ boundCollectTaskId }}</span>
        <el-button link type="primary" @click="emit('open-bound-task')">打开任务</el-button>
      </template>
      <template v-else>
        <span>{{ localRunnerOption.description }}</span>
      </template>
    </div>

    <el-form class="web-ui-collect-launch__form" label-width="112px">
      <el-form-item label="AI 采集模型" required>
        <el-select
          v-model="form.providerConnectionId"
          :loading="aiProviderLoading"
          clearable
          filterable
          placeholder="选择连接池中已配置模型的 AI 连接"
        >
          <el-option
            v-for="item in availableAiProviders"
            :key="item.id"
            :label="`${item.connectionName} / ${item.modelName || '-'}`"
            :value="item.id"
          >
            <div class="web-ui-collect-launch__provider-option">
              <span>{{ item.connectionName }} / {{ item.modelName || '-' }}</span>
              <small>{{ item.protocolType }}</small>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="运行环境">
        <el-select v-model="form.environmentId" clearable filterable placeholder="选择登录环境">
          <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="所属模块" required>
        <el-select
          v-model="form.moduleId"
          clearable
          filterable
          placeholder="选择模块"
          @change="emit('module-change')"
        >
          <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="页面对象" required>
        <div class="web-ui-collect-launch__page-object">
          <div class="web-ui-collect-launch__page-object-summary">
            <span>{{ pageObjectSummary }}</span>
            <el-button link type="primary" @click="pageObjectExpanded = !pageObjectExpanded">
              {{ pageObjectExpanded ? '收起' : '更换' }}
            </el-button>
          </div>
          <div v-if="pageObjectExpanded" class="web-ui-collect-launch__page-target">
            <el-select
              v-model="form.pageId"
              clearable
              filterable
              placeholder="选择已有页面对象"
              @change="emit('page-change', $event as number | null)"
            >
              <el-option v-for="item in pageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
            </el-select>
            <el-input v-model="form.pageName" clearable :placeholder="`新建页面对象：${inferredPageName}`" />
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="web-ui-collect-launch__footer">
        <AppButton @click="emit('offline')">离线 HTML 导入</AppButton>
        <span class="web-ui-collect-launch__hint">候选审核会在采集工作台中完成</span>
        <AppButton @click="emit('update:modelValue', false)">取消</AppButton>
        <el-tooltip
          :disabled="canStartCollect"
          :content="isRunnerTaskOccupied ? '当前 Runner 正在处理已有采集任务，请先打开任务继续处理。' : '请先启动 Runner，并在 Runner 浏览器中进入可采集的目标业务页面。'"
          placement="top"
        >
          <span>
            <AppButton
              type="primary"
              :icon="Cpu"
              :loading="localRunnerCapturing"
              :disabled="!canStartCollect"
              @click="emit('start')"
            >
              开始采集
            </AppButton>
          </span>
        </el-tooltip>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.web-ui-collect-launch__title {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  font-weight: 600;
}

.web-ui-collect-launch__title .el-icon {
  color: var(--app-text-muted);
  cursor: help;
}

.web-ui-collect-launch :deep(.el-dialog__body) {
  max-height: calc(88vh - 150px);
  overflow-y: auto;
}

.web-ui-collect-launch :deep(.el-dialog__footer) {
  border-top: 1px solid var(--app-border-color);
}

.web-ui-collect-launch__form {
  display: grid;
  gap: var(--app-space-1);
  margin-top: var(--app-space-3);
}

.web-ui-collect-launch__provider-option,
.web-ui-collect-launch__footer,
.web-ui-collect-launch__runner-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-collect-launch__provider-option {
  justify-content: space-between;
}

.web-ui-collect-launch__provider-option small,
.web-ui-collect-launch__hint {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-launch__runner-form {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-collect-launch__runner-select-row,
.web-ui-collect-launch__open-page-row,
.web-ui-collect-launch__runner-status,
.web-ui-collect-launch__runner-option {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.web-ui-collect-launch__runner-select-row,
.web-ui-collect-launch__open-page-row {
  width: 100%;
}

.web-ui-collect-launch__runner-select-row .el-select,
.web-ui-collect-launch__open-page-row .el-input {
  flex: 1;
  min-width: 0;
}

.web-ui-collect-launch__runner-option {
  justify-content: space-between;
}

.web-ui-collect-launch__runner-status {
  min-height: 24px;
  margin-top: calc(var(--app-space-1) * -1);
  padding-left: 112px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-launch__page-target,
.web-ui-collect-launch__group-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--app-space-3);
  width: 100%;
}

.web-ui-collect-launch__page-object {
  display: grid;
  gap: var(--app-space-2);
  width: 100%;
}

.web-ui-collect-launch__page-object-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-soft);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-launch__page-object-summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-launch__footer {
  justify-content: flex-end;
}

.web-ui-collect-launch__hint {
  margin-right: auto;
}

.web-ui-collect-launch :deep(.el-select) {
  width: 100%;
}

@media (max-width: 700px) {
  .web-ui-collect-launch__runner-select-row,
  .web-ui-collect-launch__open-page-row,
  .web-ui-collect-launch__runner-status {
    align-items: stretch;
    flex-direction: column;
  }

  .web-ui-collect-launch__runner-status {
    padding-left: 0;
  }

  .web-ui-collect-launch__page-target,
  .web-ui-collect-launch__group-target {
    grid-template-columns: 1fr;
  }
}
</style>
