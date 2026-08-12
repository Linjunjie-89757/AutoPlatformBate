<script setup lang="ts">
import { DocumentCopy } from '@element-plus/icons-vue'
import { CircleCheck, Download, RefreshCw } from '@lucide/vue'

defineProps<{
  releaseVersion: string
  releaseSize: string
  downloadUrl: string
  releaseLoading: boolean
  releaseErrorMessage: string
  platformApiBaseUrl: string
  runnerStartCommand: string
  runnerLoading: boolean
}>()

const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  copyPlatformAddress: []
  copyRunnerCommand: []
  refreshConnection: []
}>()
</script>

<template>
  <el-drawer v-model="visible" title="下载 Local Runner" size="520px">
    <div class="config-runner-guide">
      <p class="config-runner-guide__intro">
        Local Runner 用于在本机执行 Web UI 和接口自动化任务，连接后会自动出现在本页节点列表。
      </p>

      <section class="config-runner-guide__download">
        <div class="config-runner-guide__download-main">
          <span class="config-runner-guide__download-icon">
            <Download :size="22" :stroke-width="1.8" />
          </span>
          <div>
            <h3>Windows 版 Local Runner</h3>
            <p>
              {{ releaseVersion }} · Windows x64 · 便携版
              <template v-if="releaseSize"> · {{ releaseSize }}</template>
            </p>
          </div>
        </div>
        <a
          v-if="downloadUrl"
          class="config-runner-guide__primary-action"
          :href="downloadUrl"
          download
        >
          <Download :size="15" :stroke-width="1.8" />
          下载 Windows 版
        </a>
        <button v-else type="button" class="config-runner-guide__primary-action" disabled>
          <Download :size="15" :stroke-width="1.8" />
          {{ releaseLoading ? '正在检查安装包' : '安装包待发布' }}
        </button>
        <p v-if="releaseErrorMessage" class="config-runner-guide__availability is-error">
          安装包状态获取失败：{{ releaseErrorMessage }}
        </p>
        <p v-else-if="!releaseLoading && !downloadUrl" class="config-runner-guide__availability">
          当前环境尚未发布 Windows x64 Runner 安装包。
        </p>
      </section>

      <section>
        <h3>连接平台</h3>
        <ol class="config-runner-guide__steps">
          <li>
            <span>1</span>
            <div>
              <strong>下载并解压</strong>
              <p>将 Local Runner 解压到本机固定目录。</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>启动 Runner</strong>
              <p>双击 <code>Auto Platform Local Runner.exe</code>。</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>连接平台</strong>
              <p>在 Runner 窗口填写平台地址，点击“连接平台”。</p>
            </div>
          </li>
        </ol>

        <div class="config-runner-guide__command">
          <code>{{ platformApiBaseUrl }}</code>
          <button type="button" @click="emit('copyPlatformAddress')">
            <el-icon><DocumentCopy /></el-icon>
            复制地址
          </button>
        </div>
      </section>

      <div class="config-runner-guide__check">
        <CircleCheck :size="18" :stroke-width="1.8" />
        <div>
          <strong>检查连接状态</strong>
          <p>连接成功后，本页会出现一个在线节点。</p>
        </div>
        <button type="button" class="config-runner-secondary-button" :disabled="runnerLoading" @click="emit('refreshConnection')">
          <RefreshCw :size="13" :stroke-width="1.8" />
          刷新状态
        </button>
      </div>

      <el-collapse class="config-runner-guide__collapse">
        <el-collapse-item title="常见问题" name="faq">
          <ul>
            <li>无法连接时，先确认平台地址可从本机访问。</li>
            <li>Web UI 任务无法启动浏览器时，在 Runner 窗口查看最近日志。</li>
            <li>节点离线时，检查 Runner 是否正在运行并已连接平台。</li>
          </ul>
        </el-collapse-item>
        <el-collapse-item title="开发调试" name="development">
          <p>仅源码调试时需要在项目根目录执行：</p>
          <div class="config-runner-guide__command">
            <code>{{ runnerStartCommand }}</code>
            <button type="button" @click="emit('copyRunnerCommand')">
              <el-icon><DocumentCopy /></el-icon>
              复制命令
            </button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-drawer>
</template>

<style scoped src="./config-runner-download-drawer.css"></style>
