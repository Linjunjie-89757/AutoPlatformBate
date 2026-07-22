<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, Cpu, Link } from '@element-plus/icons-vue'
import { Sparkles } from '@lucide/vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import type {
  WebUiElementModuleItem,
  WebUiElementPageItem,
  WebUiEnvironmentItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import type { WebUiElementCollectLaunchForm } from './elementCollectTypes'

const props = defineProps<{
  form: WebUiElementCollectLaunchForm
  aiProviderLoading: boolean
  availableAiProviders: AiProviderConnectionItem[]
  enabledEnvironments: WebUiEnvironmentItem[]
  modules: WebUiElementModuleItem[]
  pageOptions: WebUiElementPageItem[]
  localRunnerChecking: boolean
  localRunnerOpening: boolean
  localRunnerCapturing: boolean
  localRunnerOnline: boolean
  localRunnerUrl: string
}>()

const emit = defineEmits<{
  back: []
  'module-change': []
  'page-change': [value: number | null]
  'check-local-runner': []
  'open-local-runner-page': []
  start: []
}>()

const includeFrames = ref(false)
const waitForIdle = ref(2000)
const maxElements = ref(50)
const selectedPage = computed(() => props.pageOptions.find(item => item.id === props.form.pageId) || null)
const runnerLabel = computed(() => {
  if (props.localRunnerChecking) return 'Runner 检测中'
  return props.localRunnerOnline ? '本地 Runner 已连接' : '本地 Runner 未连接'
})

function handlePageChange(value: number | null) {
  emit('page-change', value)
}
</script>

<template>
  <section class="web-ui-ai-capture">
    <header class="web-ui-ai-capture__header">
      <button class="web-ui-ai-capture__back" type="button" @click="emit('back')">
        <el-icon><ArrowLeft /></el-icon>
        返回元素库
      </button>
      <span class="web-ui-ai-capture__divider" />
      <span class="web-ui-ai-capture__icon"><el-icon><Sparkles /></el-icon></span>
      <h1>AI 元素采集</h1>
    </header>

    <div class="web-ui-ai-capture__body">
      <aside class="web-ui-ai-capture__config">
        <div class="web-ui-ai-capture__config-scroll">
          <section class="web-ui-ai-capture__field-block">
            <label>目标页面地址</label>
            <div class="web-ui-ai-capture__url-input">
              <el-input v-model="form.pageUrl" placeholder="https://example.com/orders" />
              <AppButton size="small" :loading="localRunnerOpening" @click="emit('open-local-runner-page')">打开</AppButton>
            </div>
            <p>确保测试环境 / Runner 可以访问该地址</p>
          </section>

          <section class="web-ui-ai-capture__field-block">
            <label>运行 Runner</label>
            <div class="web-ui-ai-capture__runner">
              <span><el-icon><Cpu /></el-icon>{{ runnerLabel }}</span>
              <AppButton size="small" :loading="localRunnerChecking" @click="emit('check-local-runner')">检测</AppButton>
            </div>
            <small v-if="localRunnerUrl">当前页面：{{ localRunnerUrl }}</small>
          </section>

          <section class="web-ui-ai-capture__field-block web-ui-ai-capture__field-block--compact">
            <label>AI 采集模型</label>
            <el-select v-model="form.providerConnectionId" :loading="aiProviderLoading" clearable filterable placeholder="选择 AI 连接">
              <el-option
                v-for="item in availableAiProviders"
                :key="item.id"
                :label="`${item.connectionName} / ${item.modelName || '-'}`"
                :value="item.id"
              />
            </el-select>
          </section>

          <section class="web-ui-ai-capture__field-block web-ui-ai-capture__field-block--compact">
            <label>运行环境</label>
            <el-select v-model="form.environmentId" clearable filterable placeholder="选择登录环境">
              <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </section>

          <section class="web-ui-ai-capture__field-block web-ui-ai-capture__field-block--compact">
            <label>所属模块</label>
            <el-select v-model="form.moduleId" clearable filterable placeholder="选择模块" @change="emit('module-change')">
              <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
            </el-select>
          </section>

          <section class="web-ui-ai-capture__field-block web-ui-ai-capture__field-block--compact">
            <label>页面对象</label>
            <el-select v-model="form.pageId" clearable filterable placeholder="选择已有页面" @change="handlePageChange($event as number | null)">
              <el-option v-for="item in pageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
            </el-select>
            <el-input v-model="form.pageName" :placeholder="selectedPage?.pageName || '或输入新页面名称'" />
          </section>

          <section class="web-ui-ai-capture__scope">
            <label>采集范围</label>
            <label class="web-ui-ai-capture__radio" :class="{ 'is-active': form.scope === 'ALL' }">
              <el-radio v-model="form.scope" value="ALL">全页可操作元素</el-radio>
            </label>
            <label class="web-ui-ai-capture__radio" :class="{ 'is-active': form.scope === 'FORM' }">
              <el-radio v-model="form.scope" value="FORM">仅表单元素</el-radio>
            </label>
            <label class="web-ui-ai-capture__radio" :class="{ 'is-active': form.scope === 'BUTTON' }">
              <el-radio v-model="form.scope" value="BUTTON">按钮与链接</el-radio>
            </label>
          </section>

          <section class="web-ui-ai-capture__advanced">
            <h2>高级选项</h2>
            <div class="web-ui-ai-capture__advanced-row">
              <span>包含 iframe 内元素</span>
              <el-switch v-model="includeFrames" />
            </div>
            <div class="web-ui-ai-capture__advanced-row">
              <span>等待动态渲染 (ms)</span>
              <el-input-number v-model="waitForIdle" :min="0" :max="10000" controls-position="right" />
            </div>
            <div class="web-ui-ai-capture__advanced-row">
              <span>最大采集元素数</span>
              <el-input-number v-model="maxElements" :min="1" :max="300" controls-position="right" />
            </div>
          </section>

          <AppButton class="web-ui-ai-capture__start" type="primary" :loading="localRunnerCapturing" @click="emit('start')">
            <el-icon><Sparkles /></el-icon>
            开始 AI 采集
          </AppButton>
        </div>
      </aside>

      <main class="web-ui-ai-capture__empty">
        <span class="web-ui-ai-capture__empty-icon"><el-icon><Link /></el-icon></span>
        <h2>配置目标地址后开始采集</h2>
        <p>AI 将自动识别页面所有可操作元素，人工确认后可一键入库。</p>
      </main>
    </div>
  </section>
</template>

<style scoped>
.web-ui-ai-capture { display:flex; flex:1; min-width:0; min-height:0; height:calc(100dvh - 64px); flex-direction:column; overflow:hidden; background:#f7f8fc; }
.web-ui-ai-capture__header { display:flex; flex:0 0 48px; align-items:center; gap:12px; padding:0 20px; border-bottom:1px solid #e5e6eb; background:#fff; }
.web-ui-ai-capture__back { display:inline-flex; align-items:center; gap:6px; padding:0; border:0; background:transparent; color:#4e5969; font-size:13px; font-weight:500; cursor:pointer; }
.web-ui-ai-capture__back:hover { color:#00b8b0; }
.web-ui-ai-capture__divider { width:1px; height:16px; background:#e5e6eb; }
.web-ui-ai-capture__icon, .web-ui-ai-capture__empty-icon { display:grid; place-items:center; background:#e8fffb; color:#00b8b0; }
.web-ui-ai-capture__icon { width:28px; height:28px; border-radius:6px; font-size:14px; }
.web-ui-ai-capture__header h1 { margin:0; color:#1d2129; font-size:15px; font-weight:600; }
.web-ui-ai-capture__body { display:flex; min-width:0; min-height:0; flex:1; overflow:hidden; }
.web-ui-ai-capture__config { width:300px; flex:0 0 300px; border-right:1px solid #e5e6eb; background:#fff; overflow:hidden; }
.web-ui-ai-capture__config-scroll { display:grid; align-content:start; gap:16px; height:100%; box-sizing:border-box; padding:16px; overflow:auto; }
.web-ui-ai-capture__field-block, .web-ui-ai-capture__scope { display:grid; gap:7px; }
.web-ui-ai-capture__field-block > label, .web-ui-ai-capture__scope > label:first-child { color:#4e5969; font-size:12px; font-weight:600; }
.web-ui-ai-capture__field-block p, .web-ui-ai-capture__field-block small { margin:0; color:#86909c; font-size:11px; line-height:1.5; }
.web-ui-ai-capture__field-block--compact { gap:6px; }
.web-ui-ai-capture__url-input, .web-ui-ai-capture__runner { display:flex; align-items:center; gap:8px; min-width:0; }
.web-ui-ai-capture__url-input :deep(.el-input) { min-width:0; flex:1; }
.web-ui-ai-capture__runner { justify-content:space-between; min-height:34px; padding:0 8px 0 10px; border:1px solid #e5e6eb; border-radius:6px; background:#fff; color:#4e5969; font-size:12px; }
.web-ui-ai-capture__runner span { display:flex; min-width:0; align-items:center; gap:6px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.web-ui-ai-capture__scope { padding-top:16px; border-top:1px solid #e5e6eb; }
.web-ui-ai-capture__radio { display:flex; align-items:center; min-height:34px; padding:0 10px; border-radius:6px; cursor:pointer; }
.web-ui-ai-capture__radio.is-active { background:#e8fffb; }
.web-ui-ai-capture__radio :deep(.el-radio__label) { color:#4e5969; font-size:12px; }
.web-ui-ai-capture__radio.is-active :deep(.el-radio__label) { color:#00b8b0; }
.web-ui-ai-capture__advanced { display:grid; gap:0; padding-top:16px; border-top:1px solid #e5e6eb; }
.web-ui-ai-capture__advanced h2 { margin:0 0 4px; color:#4e5969; font-size:12px; font-weight:600; }
.web-ui-ai-capture__advanced-row { display:flex; align-items:center; justify-content:space-between; min-height:42px; gap:12px; border-bottom:1px solid #f2f3f5; color:#1d2129; font-size:12px; }
.web-ui-ai-capture__advanced-row :deep(.el-input-number) { width:92px; }
.web-ui-ai-capture__start { width:100%; height:40px; margin-top:2px; border:0; border-radius:6px; background:#00b8b0; font-size:13px; font-weight:600; }
.web-ui-ai-capture__start:hover { background:#00a8a0; }
.web-ui-ai-capture__empty { display:flex; flex:1; min-width:0; align-items:center; justify-content:center; flex-direction:column; padding:24px; text-align:center; }
.web-ui-ai-capture__empty-icon { width:64px; height:64px; border-radius:12px; color:#c9cdd4; font-size:32px; }
.web-ui-ai-capture__empty h2 { margin:14px 0 6px; color:#4e5969; font-size:15px; font-weight:600; }
.web-ui-ai-capture__empty p { margin:0; color:#86909c; font-size:13px; }
@media (max-width:760px) { .web-ui-ai-capture__config { width:280px; flex-basis:280px; } .web-ui-ai-capture__header { padding:0 12px; } }
</style>
