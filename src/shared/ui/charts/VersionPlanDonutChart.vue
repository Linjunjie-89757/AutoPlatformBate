<script setup lang="ts">
import type { PieSeriesOption } from 'echarts/charts'
import type { TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import './echarts'

export type VersionPlanChartItem = {
  name: string
  value: number
  color: string
}

type ChartOption = ComposeOption<PieSeriesOption | TooltipComponentOption>

const props = defineProps<{
  items: VersionPlanChartItem[]
}>()

const option = computed<ChartOption>(() => ({
  animationDuration: 1000,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'item',
    formatter: '{b} : {c}',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    textStyle: {
      color: '#1D2129',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
    },
    extraCssText: 'box-shadow:none;',
  },
  series: [{
    type: 'pie',
    center: [70, 70],
    radius: [38, 60],
    startAngle: 90,
    clockwise: true,
    padAngle: 3,
    selectedOffset: 0,
    label: { show: false },
    emphasis: { scale: false },
    data: props.items.map(item => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.color,
        borderColor: '#FFFFFF',
        borderWidth: 1,
      },
    })),
  }],
}))
</script>

<template>
  <div class="version-plan-chart">
    <VChart
      class="version-plan-chart__plot"
      :option="option"
      autoresize
      role="img"
      aria-label="测试计划状态环形图"
    />
    <div class="version-plan-chart__legend">
      <div v-for="item in items" :key="item.name">
        <i :style="{ backgroundColor: item.color }" />
        <span>{{ item.name }}</span>
        <b :style="{ color: item.color }">{{ item.value }}</b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-plan-chart {
  display: flex;
  align-items: center;
  gap: 16px;
}

.version-plan-chart__plot {
  width: 140px;
  height: 140px;
  flex: 0 0 140px;
}

.version-plan-chart__legend {
  min-width: 180px;
  flex: 1;
}

.version-plan-chart__legend > div {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.version-plan-chart__legend i {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
}

.version-plan-chart__legend span {
  flex: 1;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
}

.version-plan-chart__legend b {
  font-size: 13px;
  font-weight: 600;
}
</style>
