<script setup lang="ts">
import type { BarSeriesOption } from 'echarts/charts'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import './echarts'

export type DefectModuleChartItem = {
  name: string
  count: number
}

type ChartOption = ComposeOption<BarSeriesOption | GridComponentOption | TooltipComponentOption>

const props = defineProps<{
  items: DefectModuleChartItem[]
}>()

const option = computed<ChartOption>(() => ({
  animationDuration: 1500,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'none' },
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
  grid: {
    top: 1,
    right: 30,
    bottom: 29,
    left: 119,
  },
  xAxis: {
    type: 'value',
    min: 0,
    max: 24,
    interval: 6,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: '#86909C',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
      margin: 9,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#F2F3F5',
        width: 1,
        type: 'dashed',
      },
    },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: props.items.map(item => item.name),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: '#4E5969',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
      margin: 8,
    },
  },
  series: [{
    type: 'bar',
    name: '缺陷数',
    data: props.items.map(item => item.count),
    barWidth: 23,
    itemStyle: {
      color: '#F53F3F',
      borderRadius: [0, 4, 4, 0],
    },
    emphasis: {
      itemStyle: { color: '#F53F3F' },
    },
  }],
}))
</script>

<template>
  <VChart
    class="defect-module-chart"
    :option="option"
    autoresize
    role="img"
    aria-label="模块缺陷分布水平条形图"
  />
</template>

<style scoped>
.defect-module-chart {
  width: 600px;
  height: 200px;
}
</style>
