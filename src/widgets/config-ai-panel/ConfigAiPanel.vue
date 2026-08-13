<script setup lang="ts">
import { toRef } from 'vue'
import { ElMessage } from 'element-plus'

import { figmaConfigAiIcons } from '@/shared/assets/figma-icons'

import ConfigAiEditDrawer from './ConfigAiEditDrawer.vue'
import ConfigAiModelDrawer from './ConfigAiModelDrawer.vue'
import ConfigAiProviderPickerDrawer from './ConfigAiProviderPickerDrawer.vue'
import ConfigAiTestResultDialog from './ConfigAiTestResultDialog.vue'
import {
  capabilityVisuals,
  getProviderVisual,
  providerPickerOrder,
} from './model'
import { useConfigAiManagement } from './useConfigAiManagement'

const props = withDefaults(defineProps<{
  workspaceCode?: string
}>(), {
  workspaceCode: 'ALL',
})

const {
  loading,
  saving,
  testingId,
  errorMessage,
  searchKeyword,
  statusFilter,
  providerFilter,
  usageBindOpen,
  pickerVisible,
  editVisible,
  editMode,
  selectedProviderType,
  editingProvider,
  modelProvider,
  providerCapabilities,
  testResult,
  testResultModelName,
  testResultLatency,
  filteredProviders,
  stats,
  warningText,
  usageBindingRows,
  loadProviders,
  openCreatePicker,
  selectProvider,
  backToProviderPicker,
  openEdit,
  saveProvider,
  testProvider,
  testProviderDraft,
  toggleProvider,
  deleteProvider,
  openModels,
  getReviewModel,
  getStatusMeta,
  getLastTestMeta,
  handleModelProviderChanged,
} = useConfigAiManagement(toRef(props, 'workspaceCode'))
</script>

<template>
  <section class="config-ai-panel">
    <header class="config-ai-panel__head">
      <div>
        <h2>AI 连接池</h2>
        <p>管理 AI 服务商连接、模型和调用用途绑定</p>
      </div>
      <div class="config-ai-panel__actions">
        <button class="config-ai-btn config-ai-btn--ghost" type="button" :disabled="loading" @click="loadProviders">
          <img :src="figmaConfigAiIcons.refresh" alt="">
          刷新
        </button>
        <button class="config-ai-btn config-ai-btn--primary" type="button" @click="openCreatePicker">
          <img :src="figmaConfigAiIcons.plus" alt="">
          新增连接
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="config-ai-panel__error">
      {{ errorMessage }}
      <button type="button" @click="loadProviders">重试</button>
    </div>

    <div class="config-ai-stats">
      <article v-for="item in stats" :key="item.label" class="config-ai-stat">
        <strong :style="{ color: item.color, backgroundColor: item.bg }">{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </div>

    <div class="config-ai-filters">
      <label class="config-ai-search">
        <img :src="figmaConfigAiIcons.search" alt="">
        <input v-model="searchKeyword" type="text" placeholder="搜索连接名称">
      </label>
      <select v-model="statusFilter">
        <option value="all">全部状态</option>
        <option value="normal">正常</option>
        <option value="error">异常</option>
        <option value="disabled">已停用</option>
      </select>
      <select v-model="providerFilter">
        <option value="all">全部服务商</option>
        <option v-for="item in providerPickerOrder" :key="item" :value="item">
          {{ getProviderVisual(item).label }}
        </option>
      </select>
    </div>

    <section class="config-ai-table-card">
      <div class="config-ai-table-wrap">
        <table class="config-ai-table">
          <thead>
            <tr>
              <th>连接 / 服务商</th>
              <th>默认模型</th>
              <th>API 地址</th>
              <th>Key</th>
              <th>支持能力</th>
              <th>绑定用途</th>
              <th>状态</th>
              <th>最近测试</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="provider in filteredProviders" :key="provider.id">
              <td>
                <div class="config-ai-conn">
                  <span
                    class="config-ai-conn__avatar"
                    :style="{
                      color: getProviderVisual(provider).color,
                      backgroundColor: getProviderVisual(provider).bg,
                    }"
                  >
                    <img v-if="getProviderVisual(provider).logoSrc" :src="getProviderVisual(provider).logoSrc" alt="">
                    <span v-else>{{ getProviderVisual(provider).initial }}</span>
                  </span>
                  <div>
                    <strong>{{ provider.connectionName }}</strong>
                    <span>{{ getProviderVisual(provider).label }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="config-ai-model-cell">
                  <strong>{{ provider.modelName || '-' }}</strong>
                  <span>{{ getReviewModel(provider) }}</span>
                </div>
              </td>
              <td>
                <span class="config-ai-api-url" :title="provider.baseUrl">{{ provider.baseUrl }}</span>
              </td>
              <td>
                <span class="config-ai-key" :class="{ 'is-missing': !provider.apiKeyConfigured }">
                  <img :src="provider.apiKeyConfigured ? figmaConfigAiIcons.key.configured : figmaConfigAiIcons.key.missing" alt="">
                  {{ provider.apiKeyConfigured ? '已配置' : '未配置' }}
                </span>
              </td>
              <td>
                <div class="config-ai-chips">
                  <span
                    v-for="capability in providerCapabilities[provider.id]"
                    :key="capability"
                    :style="{
                      color: capabilityVisuals[capability].color,
                      backgroundColor: capabilityVisuals[capability].bg,
                    }"
                  >
                    {{ capabilityVisuals[capability].label }}
                  </span>
                  <span v-if="!providerCapabilities[provider.id]?.length" class="config-ai-muted">未探测</span>
                </div>
              </td>
              <td>
                <span class="config-ai-muted">未绑定</span>
              </td>
              <td>
                <span class="config-ai-status" :style="{ color: getStatusMeta(provider).color }">
                  <i :style="{ backgroundColor: getStatusMeta(provider).dot }" />
                  {{ getStatusMeta(provider).label }}
                </span>
              </td>
              <td>
                <div class="config-ai-last-test" :class="{ 'is-failed': getLastTestMeta(provider).failed }">
                  <strong>{{ getLastTestMeta(provider).main }}</strong>
                  <span v-if="getLastTestMeta(provider).sub">{{ getLastTestMeta(provider).sub }}</span>
                </div>
              </td>
              <td>
                <div class="config-ai-row-actions">
                  <button type="button" title="测试连接" :disabled="testingId === provider.id" @click="testProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.test" alt="">
                  </button>
                  <button type="button" title="模型管理" @click="openModels(provider)">
                    <img :src="figmaConfigAiIcons.action.model" alt="">
                  </button>
                  <button type="button" title="编辑" @click="openEdit(provider)">
                    <img :src="figmaConfigAiIcons.action.edit" alt="">
                  </button>
                  <button type="button" title="启停" @click="toggleProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.power" alt="">
                  </button>
                  <button type="button" title="删除" @click="deleteProvider(provider)">
                    <img :src="figmaConfigAiIcons.action.delete" alt="">
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredProviders.length">
              <td class="config-ai-table__empty" colspan="9">暂无 AI 连接</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="warningText" class="config-ai-warning">
        <img :src="figmaConfigAiIcons.warning" alt="">
        <span>{{ warningText }}</span>
      </div>
    </section>

    <section class="config-ai-usage-section" :class="{ 'is-open': usageBindOpen }">
      <button class="config-ai-usage-section__head" type="button" @click="usageBindOpen = !usageBindOpen">
        <span>
          <img :src="figmaConfigAiIcons.usage" alt="">
          <strong>AI 调用用途配置</strong>
          <em>5 个用途</em>
        </span>
        <img class="config-ai-usage-section__arrow" :src="figmaConfigAiIcons.chevronRight" alt="">
      </button>
      <div v-if="usageBindOpen" class="config-ai-usage-section__body">
        <p>为每种 AI 能力指定主模型和备用模型，当主模型不可用时自动切换到备用模型。</p>
        <table class="config-ai-usage-bind-table">
          <thead>
            <tr>
              <th>AI 能力</th>
              <th>主模型</th>
              <th>备用模型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usageBindingRows" :key="row.key">
              <td>
                <span class="config-ai-usage-bind-table__name">
                  <img :src="figmaConfigAiIcons.usage" alt="">
                  {{ row.label }}
                </span>
              </td>
              <td>
                <select :value="row.primary" disabled>
                  <option>{{ row.primary || '— 未指定 —' }}</option>
                </select>
              </td>
              <td>
                <select :value="row.backup" disabled>
                  <option>{{ row.backup || '— 未指定 —' }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="config-ai-usage-section__actions">
          <button type="button" @click="ElMessage.info('AI 调用用途绑定接口暂未接入')">
            <img :src="figmaConfigAiIcons.drawer.save" alt="">
            保存配置
          </button>
        </div>
      </div>
    </section>

    <ConfigAiProviderPickerDrawer
      v-if="pickerVisible"
      @close="pickerVisible = false"
      @select="selectProvider"
    />
    <ConfigAiEditDrawer
      v-if="editVisible"
      :mode="editMode"
      :workspace-code="workspaceCode"
      :provider-type="selectedProviderType"
      :provider="editingProvider"
      :saving="saving"
      :testing="testingId !== null"
      @close="editVisible = false"
      @back-to-picker="backToProviderPicker"
      @save="saveProvider"
      @test="testProviderDraft"
    />
    <ConfigAiModelDrawer
      v-if="modelProvider"
      :workspace-code="workspaceCode"
      :provider="modelProvider"
      @close="modelProvider = null"
      @changed="handleModelProviderChanged"
    />
    <ConfigAiTestResultDialog
      v-if="testResult"
      :result="testResult"
      :model-name="testResultModelName"
      :latency-text="testResultLatency"
      @close="testResult = null"
    />
  </section>
</template>

<style scoped src="./config-ai-panel.css"></style>
