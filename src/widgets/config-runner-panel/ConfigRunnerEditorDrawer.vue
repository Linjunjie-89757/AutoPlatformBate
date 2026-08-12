<script setup lang="ts">
import type { RunnerNodeSummary } from '@/entities/local-runner'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'
import {
  capabilityPills,
  formatRunnerName,
  getCapabilityMeta,
  getRunnerCapabilityDisplayLabel,
  getRunnerEnv,
  getRunnerHost,
  getRunnerMaxSlots,
  getRunnerNote,
  getRunnerPort,
  getRunnerStatusKey,
  runnerEditorCapabilityOptions,
} from './configRunnerPanel.helpers'

const props = defineProps<{
  mode: 'create' | 'edit'
  target: RunnerNodeSummary | null
}>()

const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  unsupported: [action: string]
}>()

function isCapabilitySelected(capability: string) {
  const selected = props.target
    ? capabilityPills(props.target)
    : ['API_CASE_RUN', 'WEB_CASE_RUN', 'SCREENSHOT']
  return selected.includes(capability)
}
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-runner-editor-drawer"
    direction="rtl"
    size="520px"
    :with-header="false"
    destroy-on-close
  >
    <div class="config-runner-editor-drawer__shell">
      <header class="config-runner-editor-drawer__header">
        <div>
          <h3>{{ mode === 'edit' ? '编辑 Runner 节点' : '注册 Runner 节点' }}</h3>
          <p>配置执行节点基础信息、调度能力和运行状态。</p>
        </div>
        <button type="button" aria-label="关闭" @click="visible = false">
          <img :src="figmaConfigRunnerIcons.drawer.close" alt="">
        </button>
      </header>

      <div class="config-runner-editor-drawer__body">
        <div class="config-runner-editor-field">
          <label>
            <span>节点名称</span>
            <input :value="target ? formatRunnerName(target) : ''" placeholder="runner-prod-01">
          </label>
        </div>

        <div class="config-runner-editor-grid is-host">
          <div class="config-runner-editor-field">
            <label>
              <span>Host / IP</span>
              <input :value="target ? getRunnerHost(target) : ''" placeholder="10.0.1.101">
            </label>
          </div>
          <div class="config-runner-editor-field">
            <label>
              <span>端口</span>
              <input :value="target ? getRunnerPort(target) : '9000'" placeholder="9000">
            </label>
          </div>
        </div>

        <div class="config-runner-editor-field">
          <label>
            <span>注册 Token</span>
            <input value="" type="password" :placeholder="mode === 'edit' ? '已配置，输入新 Token 以替换' : '输入连接 Token'">
          </label>
          <p>Token 加密存储，用于平台与节点之间的身份校验</p>
        </div>

        <div class="config-runner-editor-grid">
          <div class="config-runner-editor-field">
            <label>
              <span>所属环境</span>
              <select :value="target ? getRunnerEnv(target) : '测试环境'">
                <option>生产环境</option>
                <option>测试环境</option>
                <option>预发布</option>
                <option>开发环境</option>
              </select>
            </label>
          </div>
          <div class="config-runner-editor-field">
            <label>
              <span>最大并发数</span>
              <input :value="target ? getRunnerMaxSlots(target) || 1 : 2" type="number">
            </label>
          </div>
        </div>

        <div class="config-runner-editor-divider" />

        <section class="config-runner-editor-capability-block">
          <h4>执行能力</h4>
          <div class="config-runner-editor-capability-list">
            <label
              v-for="capability in runnerEditorCapabilityOptions"
              :key="capability"
              class="config-runner-editor-capability"
              :class="{ 'is-selected': isCapabilitySelected(capability) }"
            >
              <span class="config-runner-editor-capability__check" aria-hidden="true">
                <img v-if="isCapabilitySelected(capability)" :src="figmaConfigRunnerIcons.checkbox.checked" alt="">
              </span>
              <span class="config-runner-editor-capability__icon" :style="{ backgroundColor: getCapabilityMeta(capability).bg }">
                <img :src="getCapabilityMeta(capability).figmaIcon" alt="">
              </span>
              <strong>{{ getRunnerCapabilityDisplayLabel(capability) }}</strong>
            </label>
          </div>
        </section>

        <div class="config-runner-editor-divider" />

        <section class="config-runner-editor-enable">
          <div>
            <strong>启用节点</strong>
            <span>停用后该节点不会被分配任何执行任务</span>
          </div>
          <button type="button" class="config-runner-editor-toggle" :class="{ 'is-on': !(target && getRunnerStatusKey(target) === 'disabled') }">
            <i />
          </button>
        </section>

        <section class="config-runner-editor-field">
          <label>
            <span>备注</span>
            <textarea :value="target ? getRunnerNote(target) : ''" rows="2" placeholder="可选" />
          </label>
        </section>
      </div>

      <footer class="config-runner-editor-drawer__footer">
        <button type="button" class="config-runner-secondary-button" @click="visible = false">取消</button>
        <button type="button" class="config-runner-primary-button" @click="emit('unsupported', mode === 'edit' ? '编辑 Runner 节点' : '注册 Runner 节点')">
          <img :src="figmaConfigRunnerIcons.drawer.save" alt="">
          {{ mode === 'edit' ? '保存修改' : '注册节点' }}
        </button>
      </footer>
    </div>
  </el-drawer>
</template>

<style scoped src="./config-runner-editor-drawer.css"></style>
