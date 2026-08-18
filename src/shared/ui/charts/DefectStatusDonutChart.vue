<script setup lang="ts">
import type { PieSeriesOption } from 'echarts/charts'
import type { TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import './echarts'

export type DefectStatusChartItem = {
  name: string
  value: number
  color: string
}

type ChartOption = ComposeOption<PieSeriesOption | TooltipComponentOption>

const props = defineProps<{
  items: DefectStatusChartItem[]
}>()

const option = computed<ChartOption>(() => ({
  animationDelay: 400,
  animationDuration: 1500,
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
    center: [200, 86],
    radius: [55, 85],
    startAngle: 90,
    clockwise: true,
    padAngle: 3,
    minAngle: 0,
    selectedOffset: 0,
    label: { show: false },
    emphasis: {
      scale: false,
    },
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
  <div class="defect-status-chart">
    <VChart
      class="defect-status-chart__plot"
      :option="option"
      autoresize
      role="img"
      aria-label="缺陷状态分布环形图"
    />
    <div class="defect-status-chart__legend" aria-hidden="true">
      <span
        v-for="item in items"
        :key="item.name"
        :style="{ color: item.color }"
      >
        <i :style="{ backgroundColor: item.color }" />{{ item.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.defect-status-chart {
  width: 400px;
  height: 200px;
}

.defect-status-chart__plot {
  width: 400px;
  height: 172px;
}

.defect-status-chart__legend {
  display: flex;
  width: 400px;
  margin-top: 4px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #4e5969;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.defect-status-chart__legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.defect-status-chart__legend i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
}
</style>
