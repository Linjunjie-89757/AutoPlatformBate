<script setup lang="ts">
import type { BarSeriesOption } from 'echarts/charts'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import './echarts'

export type DefectAssigneeChartItem = {
  name: string
  open: number
  closed: number
}

type ChartOption = ComposeOption<
  BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>

const props = defineProps<{
  items: DefectAssigneeChartItem[]
}>()

const chartHeight = computed(() => Math.max(100, props.items.length * 38))
const maxValue = computed(() => Math.max(1, ...props.items.map(item => item.open + item.closed)))
const option = computed<ChartOption>(() => ({
  animationDuration: 300,
  grid: { top: 0, right: 48, bottom: 18, left: 56, containLabel: false },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: unknown) => {
      const rows = Array.isArray(params) ? params : [params]
      const name = rows[0]?.name ?? ''
      const item = props.items.find(candidate => candidate.name === name)
      if (!item) return name
      return `${name}<br/>未关闭：${item.open}<br/>已关闭：${item.closed}`
    },
    textStyle: { fontSize: 12, color: '#1D2129' },
    borderColor: '#E5E6EB',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  xAxis: {
    type: 'value',
    min: 0,
    max: maxValue.value,
    interval: Math.max(1, Math.ceil(maxValue.value / 4)),
    axisLabel: { color: '#86909C', fontSize: 11 },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: '#F2F3F5', type: 'dotted' } },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: props.items.map(item => item.name),
    axisLabel: { color: '#4E5969', fontSize: 11, width: 48, overflow: 'truncate' },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [
    {
      name: '未关闭',
      type: 'bar',
      stack: 'assignee',
      data: props.items.map(item => item.open),
      barWidth: 24,
      itemStyle: { color: '#F53F3F' },
      emphasis: { focus: 'series' },
    },
    {
      name: '已关闭',
      type: 'bar',
      stack: 'assignee',
      data: props.items.map(item => item.closed),
      barWidth: 24,
      itemStyle: { color: 'rgba(245, 63, 63, 0.35)', borderRadius: [0, 4, 4, 0] },
      emphasis: { focus: 'series' },
    },
  ],
}))
</script>

<template>
  <VChart
    class="defect-assignee-chart"
    :style="{ height: `${chartHeight}px` }"
    :option="option"
    autoresize
    role="img"
    aria-label="负责人缺陷分布横向堆叠柱状图"
  />
</template>

<style scoped>
.defect-assignee-chart {
  width: 600px;
  max-width: 100%;
}
</style>
