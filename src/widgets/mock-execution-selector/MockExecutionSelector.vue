<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { configApi, type MockApplicationItem, type MockExecutionSelection, type MockReleaseItem } from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    modelValue?: MockExecutionSelection
  }>(),
  {
    workspaceCode: 'ALL',
    modelValue: () => ({ enabled: false, appId: null, releaseId: null }),
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: MockExecutionSelection]
}>()

const applications = ref<MockApplicationItem[]>([])
const releases = ref<MockReleaseItem[]>([])
const loading = ref(false)
const releaseLoading = ref(false)
const form = reactive<MockExecutionSelection>({ ...props.modelValue })

const selectedApp = computed(() => applications.value.find(item => item.id === form.appId) || null)
const selectedRelease = computed(() => releases.value.find(item => item.id === form.releaseId) || null)

function syncFromProps(value: MockExecutionSelection) {
  form.enabled = Boolean(value?.enabled)
  form.appId = value?.appId ?? null
  form.releaseId = value?.releaseId ?? null
}

function emitValue() {
  emit('update:modelValue', {
    enabled: form.enabled,
    appId: form.enabled ? form.appId : null,
    releaseId: form.enabled ? form.releaseId : null,
  })
}

async function loadReleases(appId: number | null) {
  releases.value = []
  if (!appId) {
    form.releaseId = null
    emitValue()
    return
  }
  releaseLoading.value = true
  try {
    releases.value = await configApi.getMockReleases(props.workspaceCode, appId)
    if (!releases.value.some(item => item.id === form.releaseId)) {
      form.releaseId = releases.value.find(item => item.active)?.id ?? releases.value[0]?.id ?? null
      emitValue()
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    releaseLoading.value = false
  }
}

async function loadApplications() {
  loading.value = true
  try {
    applications.value = (await configApi.getMockApplications(props.workspaceCode)).items || []
    if (form.enabled && (!form.appId || !applications.value.some(item => item.id === form.appId))) {
      form.appId = applications.value[0]?.id ?? null
      await loadReleases(form.appId)
      emitValue()
    } else if (form.appId) {
      await loadReleases(form.appId)
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function handleEnabledChange(value: boolean | string | number) {
  form.enabled = Boolean(value)
  if (form.enabled && !form.appId) {
    form.appId = applications.value[0]?.id ?? null
    void loadReleases(form.appId)
  }
  emitValue()
}

function handleAppChange(value: number | null) {
  form.appId = value
  form.releaseId = null
  void loadReleases(value)
  emitValue()
}

watch(() => props.modelValue, value => syncFromProps(value), { deep: true })
watch(() => props.workspaceCode, () => {
  applications.value = []
  releases.value = []
  void loadApplications()
})

onMounted(() => {
  void loadApplications()
})
</script>

<template>
  <section class="mock-execution-selector">
    <div class="mock-execution-selector__header">
      <div>
        <strong>Mock 执行</strong>
        <p>固定本次执行使用的 Mock 应用和版本，报告会记录该快照。</p>
      </div>
      <el-switch :model-value="form.enabled" :loading="loading" active-text="启用" inactive-text="关闭" @update:model-value="handleEnabledChange" />
    </div>

    <div v-if="form.enabled" class="mock-execution-selector__fields">
      <label>
        <span>Mock 应用</span>
        <el-select :model-value="form.appId" :loading="loading" placeholder="请选择 Mock 应用" @update:model-value="handleAppChange">
          <el-option v-for="item in applications" :key="item.id" :label="item.appName" :value="item.id" />
        </el-select>
      </label>
      <label>
        <span>Mock 版本</span>
        <el-select v-model="form.releaseId" :loading="releaseLoading" :disabled="!form.appId" placeholder="请选择已发布版本" @change="emitValue">
          <el-option v-for="item in releases" :key="item.id" :label="`v${item.versionNo} · ${item.releaseName}`" :value="item.id" />
        </el-select>
      </label>
    </div>

    <p v-if="form.enabled && selectedApp && selectedRelease" class="mock-execution-selector__hint">
      本次将使用 {{ selectedApp.appName }} 的 v{{ selectedRelease.versionNo }}，不会跟随之后的配置编辑变化。
    </p>
    <p v-else-if="form.enabled && !releases.length && !releaseLoading" class="mock-execution-selector__warning">
      当前 Mock 应用还没有已发布版本，请先到配置中心发布版本。
    </p>
  </section>
</template>

<style scoped>
.mock-execution-selector {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 12px;
  background: var(--app-bg-muted, #f8fafc);
}

.mock-execution-selector__header,
.mock-execution-selector__fields {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mock-execution-selector__header > div {
  min-width: 0;
  flex: 1;
}

.mock-execution-selector strong,
.mock-execution-selector span {
  color: var(--app-text-primary, #111827);
}

.mock-execution-selector p {
  margin: 4px 0 0;
  color: var(--app-text-secondary, #6b7280);
  font-size: 12px;
}

.mock-execution-selector__fields label {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.mock-execution-selector__fields label > span {
  font-size: 12px;
}

.mock-execution-selector__hint {
  color: var(--app-color-success, #16a34a) !important;
}

.mock-execution-selector__warning {
  color: var(--app-color-warning, #b45309) !important;
}

@media (max-width: 720px) {
  .mock-execution-selector__fields {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
