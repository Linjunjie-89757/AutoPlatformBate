<script setup lang="ts">
defineProps<{
  activeScenarioDetail: Record<string, any>
  minGlobalTimeoutMs: number
  maxGlobalTimeoutMs: number
  maxStepRetryCount: number
  maxDefaultStepWaitMs: number
  markScenarioDirty: () => void
}>()
</script>

<template>
  <div class="scenario-placeholder-panel">
    <div class="scenario-settings-panel">
      <div class="scenario-settings-card">
        <div>
          <strong>执行策略</strong>
          <p>控制场景步骤失败后的执行方式。</p>
        </div>
        <label class="scenario-settings-row">
          <span>
            <strong>失败后继续执行</strong>
            <small>关闭后，步骤失败时场景立即停止。</small>
          </span>
          <el-switch
            v-model="activeScenarioDetail.continueOnFailure"
            active-text="继续"
            inactive-text="停止"
            @change="markScenarioDirty"
          />
        </label>
        <label class="scenario-settings-row">
          <span>
            <strong>全局超时时间</strong>
            <small>整个场景的最大执行时长，超过后停止后续步骤。</small>
          </span>
          <el-input-number
            v-model="activeScenarioDetail.globalTimeoutMs"
            class="scenario-settings-number"
            :min="minGlobalTimeoutMs"
            :max="maxGlobalTimeoutMs"
            :step="1000"
            controls-position="right"
            @change="markScenarioDirty"
          />
        </label>
        <label class="scenario-settings-row">
          <span>
            <strong>步骤失败重试次数</strong>
            <small>单个请求步骤失败后的自动重试次数。</small>
          </span>
          <el-input-number
            v-model="activeScenarioDetail.stepFailureRetryCount"
            class="scenario-settings-number scenario-settings-number-short"
            :min="0"
            :max="maxStepRetryCount"
            :step="1"
            controls-position="right"
            @change="markScenarioDirty"
          />
        </label>
        <label class="scenario-settings-row">
          <span>
            <strong>步骤间默认等待</strong>
            <small>每个可执行步骤之间默认等待的毫秒数。</small>
          </span>
          <el-input-number
            v-model="activeScenarioDetail.defaultStepWaitMs"
            class="scenario-settings-number"
            :min="0"
            :max="maxDefaultStepWaitMs"
            :step="500"
            controls-position="right"
            @change="markScenarioDirty"
          />
        </label>
      </div>
    </div>
  </div>
</template>
