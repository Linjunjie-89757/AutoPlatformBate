<script setup lang="ts">
import { computed, ref } from 'vue'
import { DocumentCopy } from '@element-plus/icons-vue'
import { Download, Shield, X } from '@lucide/vue'

const props = defineProps<{
  releaseVersion: string
  releaseFileName: string
  releaseSize: string
  downloadUrl: string
  releaseLoading: boolean
  releaseErrorMessage: string
  runnerStartCommand: string
}>()

const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  copyRunnerCommand: []
}>()

type RunnerPlatform = 'linux' | 'macos' | 'windows'

const selectedPlatform = ref<RunnerPlatform>('windows')
const selectedArchitecture = ref<'amd64' | 'arm64'>('amd64')

const selectedPlatformLabel = computed(() => ({
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
}[selectedPlatform.value]))

const selectedFileName = computed(() => {
  if (selectedPlatform.value !== 'windows' || selectedArchitecture.value !== 'amd64') return ''
  if (props.releaseFileName) return props.releaseFileName
  if (!props.releaseVersion || props.releaseVersion === '版本检查中') return ''
  return `autotest-runner-${props.releaseVersion.replace(/^v/i, '')}-windows-amd64.zip`
})

const selectedSize = computed(() => {
  if (selectedPlatform.value !== 'windows' || selectedArchitecture.value !== 'amd64') return ''
  return props.releaseSize
})

const selectedDownloadUrl = computed(() => (
  selectedPlatform.value === 'windows' && selectedArchitecture.value === 'amd64'
    ? props.downloadUrl
    : ''
))

function selectPlatform(platform: RunnerPlatform) {
  selectedPlatform.value = platform
  selectedArchitecture.value = 'amd64'
}

function selectArchitecture(architecture: 'amd64' | 'arm64') {
  if (selectedPlatform.value === 'windows' && architecture === 'arm64') return
  selectedArchitecture.value = architecture
}
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-runner-download-drawer"
    direction="rtl"
    size="560px"
    :with-header="false"
    destroy-on-close
  >
    <div class="config-runner-download-drawer__shell">
      <header class="config-runner-download-drawer__header">
        <div>
          <h3>下载 Runner</h3>
          <p>选择适合您运行环境的 Runner 安装包</p>
        </div>
        <button type="button" aria-label="关闭" @click="visible = false">
          <X :size="13" :stroke-width="1.5" aria-hidden="true" />
        </button>
      </header>

      <div class="config-runner-download-drawer__body">
        <section class="config-runner-download-section">
          <h4>版本</h4>
          <button type="button" class="config-runner-version-card is-selected" :disabled="releaseLoading">
            <span>{{ releaseLoading ? '版本检查中' : releaseVersion }}</span>
            <small v-if="!releaseLoading">当前版本</small>
          </button>
        </section>

        <section class="config-runner-download-section">
          <h4>操作系统</h4>
          <div class="config-runner-segmented-control">
            <button
              v-for="platform in [
                { key: 'linux', label: 'Linux' },
                { key: 'macos', label: 'macOS' },
                { key: 'windows', label: 'Windows' },
              ]"
              :key="platform.key"
              type="button"
              :class="{ 'is-selected': selectedPlatform === platform.key }"
              @click="selectPlatform(platform.key as RunnerPlatform)"
            >
              {{ platform.label }}
            </button>
          </div>
        </section>

        <section class="config-runner-download-section">
          <h4>处理器架构</h4>
          <div class="config-runner-architecture-options">
            <button
              type="button"
              :class="{ 'is-selected': selectedArchitecture === 'amd64', 'is-disabled': !selectedDownloadUrl && selectedPlatform !== 'windows' }"
              @click="selectArchitecture('amd64')"
            >
              <strong>amd64</strong>
              <span>{{ selectedPlatform === 'windows' ? (releaseSize || '—') : '待提供' }}</span>
            </button>
            <button
              type="button"
              :class="{ 'is-selected': selectedArchitecture === 'arm64', 'is-disabled': selectedPlatform === 'windows' }"
              :disabled="selectedPlatform === 'windows'"
              @click="selectArchitecture('arm64')"
            >
              <strong>arm64</strong>
              <span>{{ selectedPlatform === 'windows' ? '—' : '待提供' }}</span>
            </button>
          </div>
        </section>

        <section class="config-runner-package-card">
          <div class="config-runner-package-card__summary">
            <span class="config-runner-package-card__icon"><Download :size="16" :stroke-width="1.8" /></span>
            <div>
              <strong>{{ selectedFileName || `${selectedPlatformLabel} ${selectedArchitecture} 安装包暂未提供` }}</strong>
              <small>{{ selectedSize || '—' }}</small>
            </div>
          </div>

          <a
            v-if="selectedDownloadUrl"
            class="config-runner-package-card__download"
            :href="selectedDownloadUrl"
            download
          >
            <Download :size="13" :stroke-width="1.8" />
            下载安装包
          </a>
          <button v-else type="button" class="config-runner-package-card__download is-disabled" disabled>
            暂无可用安装包
          </button>
          <p v-if="releaseErrorMessage" class="config-runner-download-error">
            安装包状态获取失败：{{ releaseErrorMessage }}
          </p>
          <p v-else-if="!releaseLoading && !selectedDownloadUrl" class="config-runner-download-muted">
            当前环境仅提供 Windows x64 Runner 安装包。
          </p>
        </section>

        <section class="config-runner-install-section">
          <h4>安装与启动</h4>
          <div class="config-runner-code-block">
            <button type="button" class="config-runner-code-block__copy" @click="emit('copyRunnerCommand')">
              <el-icon><DocumentCopy /></el-icon>
              复制
            </button>
            <code># 解压安装包后，在项目根目录执行</code>
            <code>{{ props.runnerStartCommand }}</code>
          </div>
        </section>

        <div class="config-runner-download-hint">
          <Shield :size="13" :stroke-width="1.8" aria-hidden="true" />
          <span>Runner 启动后，前往「注册节点」生成一次性注册码，完成节点与平台的绑定。</span>
        </div>

      </div>
    </div>
  </el-drawer>
</template>

<style scoped src="./config-runner-download-drawer.css"></style>
