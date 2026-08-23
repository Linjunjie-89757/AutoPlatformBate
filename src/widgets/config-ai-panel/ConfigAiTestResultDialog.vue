<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue'

import type { AiProviderTestResult } from '@/entities/ai-provider'
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'

defineProps<{
  result: AiProviderTestResult
  modelName: string
  latencyText: string
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="config-ai-test-dialog">
      <section class="config-ai-test-dialog__panel">
        <header class="config-ai-test-dialog__head">
          <h3>连接测试结果</h3>
          <button class="config-ai-test-dialog__icon-btn" type="button" aria-label="关闭" @click="$emit('close')">
            <img :src="figmaConfigAiIcons.drawer.close" alt="">
          </button>
        </header>

        <div class="config-ai-test-dialog__body">
          <div
            class="config-ai-test-dialog__status"
            :class="{ 'is-failed': !result.success }"
          >
            <img v-if="result.success" :src="figmaConfigAiIcons.testSuccess" alt="">
            <AlertTriangle v-else :size="22" aria-hidden="true" />
            <div>
              <strong>{{ result.success ? '连接测试成功' : '连接测试失败' }}</strong>
              <p>{{ result.success ? 'API 正常响应，连接可用' : '无法建立连接，请检查配置' }}</p>
            </div>
          </div>

          <dl class="config-ai-test-dialog__info">
            <div>
              <dt>响应耗时</dt>
              <dd>{{ latencyText }}</dd>
            </div>
            <div>
              <dt>返回模型</dt>
              <dd>{{ modelName || '-' }}</dd>
            </div>
            <div>
              <dt>测试时间</dt>
              <dd>{{ result.verifiedAt ? result.verifiedAt.replace('T', ' ').slice(0, 19) : '-' }}</dd>
            </div>
            <div v-if="!result.success && result.message">
              <dt>错误信息</dt>
              <dd class="is-error">{{ result.message }}</dd>
            </div>
          </dl>

          <div v-if="!result.success" class="config-ai-test-dialog__suggestion">
            <strong>建议处理方式</strong>
            <ul>
              <li>检查 API Key 是否正确配置且未过期</li>
              <li>确认 API Base URL 格式正确</li>
              <li>检查网络连通性和防火墙设置</li>
            </ul>
          </div>
        </div>

        <footer class="config-ai-test-dialog__foot">
          <button class="config-ai-test-dialog__confirm" type="button" @click="$emit('close')">确定</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.config-ai-test-dialog {
  position: fixed;
  z-index: 2200;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.config-ai-test-dialog__panel {
  width: 440px;
  overflow: hidden;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
}

.config-ai-test-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 21px 15px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-test-dialog__head h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.config-ai-test-dialog__icon-btn {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.config-ai-test-dialog__icon-btn:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.config-ai-test-dialog__icon-btn:hover:not(:disabled) img {
  filter: brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1551%) hue-rotate(180deg) brightness(95%) contrast(91%);
}

.config-ai-test-dialog__icon-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-test-dialog__body {
  padding: 17.5px 21px;
}

.config-ai-test-dialog__status {
  display: flex;
  align-items: center;
  gap: 10.5px;
  padding: 14px;
  border-radius: 11px;
  background: #e8ffea;
}

.config-ai-test-dialog__status.is-failed {
  background: #ffe8e8;
}

.config-ai-test-dialog__status.is-failed svg {
  color: #f53f3f;
  flex: 0 0 auto;
}

.config-ai-test-dialog__status img {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.config-ai-test-dialog__status strong {
  color: #00b42a;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.config-ai-test-dialog__status.is-failed strong {
  color: #f53f3f;
}

.config-ai-test-dialog__status p {
  margin: 1.75px 0 0;
  color: #009922;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-test-dialog__status.is-failed p {
  color: #cc2222;
}

.config-ai-test-dialog__info {
  overflow: hidden;
  margin: 14px 0 0;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
}

.config-ai-test-dialog__info div {
  display: flex;
  min-height: 38px;
  align-items: flex-start;
  padding: 8.75px 14px;
  border-top: 1px solid #e5e6eb;
  background: #ffffff;
}

.config-ai-test-dialog__info div:first-child {
  border-top: 0;
  background: #fafafa;
}

.config-ai-test-dialog__info div:nth-child(3) {
  background: #fafafa;
}

.config-ai-test-dialog__info dt {
  width: 70px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.config-ai-test-dialog__info dd {
  margin: 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
}

.config-ai-test-dialog__info dd.is-error {
  color: #f53f3f;
  overflow-wrap: anywhere;
}

.config-ai-test-dialog__suggestion {
  margin-top: 14px;
  padding: 11.5px;
  border: 1px solid #ffd6a0;
  border-radius: 11px;
  background: #fff3e8;
}

.config-ai-test-dialog__suggestion strong {
  display: block;
  margin-bottom: 6px;
  color: #ff7d00;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.config-ai-test-dialog__suggestion ul {
  display: flex;
  flex-direction: column;
  gap: 3.5px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.config-ai-test-dialog__suggestion li::before {
  content: '· ';
}

.config-ai-test-dialog__foot {
  display: flex;
  justify-content: flex-end;
  padding: 15px 21px 14px;
  border-top: 1px solid #e5e6eb;
}

.config-ai-test-dialog__confirm {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #00b42a;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: filter 150ms, transform 150ms;
}

.config-ai-test-dialog__confirm:hover:not(:disabled) {
  filter: brightness(1.1);
}

.config-ai-test-dialog__confirm:active:not(:disabled) {
  transform: scale(.98);
}
</style>
