<script setup lang="ts">
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
            <img :src="figmaConfigAiIcons.testSuccess" alt="">
            <div>
              <strong>{{ result.success ? '连接测试成功' : '连接测试失败' }}</strong>
              <p>{{ result.message || (result.success ? 'API 正常响应，连接可用' : '无法建立连接，请检查配置') }}</p>
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
          </dl>
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

.config-ai-test-dialog__status img {
  width: 22px;
  height: 22px;
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
