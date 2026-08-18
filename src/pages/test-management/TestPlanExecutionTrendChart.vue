<script setup lang="ts">
import type { LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'
import { graphic, type ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import '../../shared/ui/charts/echarts'

type TrendItem = { date: string; passed: number; failed: number }
type ChartOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>

const props = defineProps<{ items: TrendItem[] }>()

const option = computed<ChartOption>(() => ({
  animationDuration: 300,
  color: ['#0ea5e9', '#f53f3f'],
  tooltip: {
    trigger: 'axis',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e6eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    textStyle: {
      color: '#1d2129',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
    },
    extraCssText: 'box-shadow:none;',
  },
  grid: { top: 5, right: 5, bottom: 22, left: 24 },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.items.map(item => item.date),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#86909c', fontSize: 10, margin: 8 },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#86909c', fontSize: 10, margin: 6 },
    splitLine: { lineStyle: { color: '#f2f3f5', type: 'dashed' } },
  },
  series: [
    {
      name: '通过',
      type: 'line',
      data: props.items.map(item => item.passed),
      smooth: true,
      showSymbol: false,
      lineStyle: { color: '#0ea5e9', width: 2 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14, 165, 233, 0.16)' },
          { offset: 1, color: 'rgba(14, 165, 233, 0)' },
        ]),
      },
    },
    {
      name: '失败',
      type: 'line',
      data: props.items.map(item => item.failed),
      smooth: true,
      showSymbol: false,
      lineStyle: { color: '#f53f3f', width: 2 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(245, 63, 63, 0.12)' },
          { offset: 1, color: 'rgba(245, 63, 63, 0)' },
        ]),
      },
    },
  ],
}))
</script>

<template>
  <VChart class="test-plan-execution-trend" :option="option" autoresize role="img" aria-label="每日测试用例执行趋势" />
</template>

<style scoped>
.test-plan-execution-trend {
  width: 360px;
  height: 180px;
}
</style>
