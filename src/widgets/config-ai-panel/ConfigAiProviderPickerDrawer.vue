<script setup lang="ts">
import type { AiProviderType } from '@/entities/ai-provider'
import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'

import { getProviderVisual, providerPickerOrder } from './model'

defineEmits<{
  close: []
  select: [providerType: AiProviderType]
}>()
</script>

<template>
  <Teleport to="body">
    <div class="config-ai-picker">
      <aside class="config-ai-picker__drawer">
        <header class="config-ai-picker__head">
          <div>
            <h3>新建 AI 连接</h3>
            <p>选择服务商以开始配置</p>
          </div>
          <button class="config-ai-picker__icon-btn" type="button" aria-label="关闭" @click="$emit('close')">
            <img :src="figmaConfigAiIcons.drawer.close" alt="">
          </button>
        </header>

        <div class="config-ai-picker__grid">
          <button
            v-for="providerType in providerPickerOrder"
            :key="providerType"
            class="config-ai-provider-option"
            type="button"
            @click="$emit('select', providerType)"
          >
            <span
              class="config-ai-provider-option__avatar"
              :style="{
                color: getProviderVisual(providerType).color,
                backgroundColor: getProviderVisual(providerType).logoBg || getProviderVisual(providerType).bg,
              }"
            >
              <img v-if="getProviderVisual(providerType).logoSrc" :src="getProviderVisual(providerType).logoSrc" alt="">
              <span v-else>{{ getProviderVisual(providerType).initial }}</span>
            </span>
            <span class="config-ai-provider-option__name">{{ getProviderVisual(providerType).label }}</span>
            <img class="config-ai-provider-option__arrow" :src="figmaConfigAiIcons.chevronRight" alt="">
          </button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.config-ai-picker {
  position: fixed;
  z-index: 2100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.3);
}

.config-ai-picker__drawer {
  width: 560px;
  height: 100%;
  background: #ffffff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.config-ai-picker__head {
  display: flex;
  height: 50px;
  align-items: center;
  justify-content: space-between;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
}

.config-ai-picker__head h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.config-ai-picker__head p {
  margin: 1.75px 0 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.config-ai-picker__icon-btn {
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

.config-ai-picker__icon-btn img {
  width: 13px;
  height: 13px;
}

.config-ai-picker__grid {
  display: grid;
  grid-template-columns: repeat(2, 258.125px);
  gap: 10.5px;
  padding: 17.5px;
}

.config-ai-provider-option {
  display: flex;
  width: 258.125px;
  align-items: center;
  gap: 10.5px;
  padding: 13.25px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
}

.config-ai-provider-option:hover {
  border-color: #c9cdd4;
  background: #fafafa;
}

.config-ai-provider-option__avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.config-ai-provider-option__avatar img {
  display: block;
  width: 21px;
  height: 21px;
  object-fit: contain;
}

.config-ai-provider-option__avatar > span {
  color: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.config-ai-provider-option__name {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-ai-provider-option__arrow {
  width: 13px;
  height: 13px;
  margin-left: auto;
}
</style>
