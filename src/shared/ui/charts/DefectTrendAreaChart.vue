<script setup lang="ts">
import type { LineSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { graphic, type ComposeOption } from 'echarts/core'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import './echarts'

export type DefectTrendChartItem = {
  day: string
  newCount: number
  closedCount: number
}

type ChartOption = ComposeOption<
  LineSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>

const props = defineProps<{
  items: DefectTrendChartItem[]
}>()

const option = computed<ChartOption>(() => ({
  animationDuration: 1500,
  animationEasing: 'cubicOut',
  color: ['#F53F3F', '#00B42A'],
  tooltip: {
    trigger: 'axis',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    textStyle: {
      color: '#1D2129',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 13,
      fontWeight: 400,
    },
    axisPointer: {
      type: 'line',
      lineStyle: {
        color: '#C9CDD4',
        width: 1,
        type: 'dashed',
      },
    },
    extraCssText: 'box-shadow:none;',
  },
  legend: {
    bottom: 0,
    left: 'center',
    data: ['新增', '关闭'],
    icon: 'circle',
    itemWidth: 7,
    itemHeight: 7,
    itemGap: 10,
    textStyle: {
      color: '#4E5969',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
    },
  },
  grid: {
    top: 5,
    right: 10,
    bottom: 48,
    left: 40,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.items.map(item => item.day),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: '#86909C',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
      margin: 9,
    },
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 16,
    interval: 4,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: '#86909C',
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 12,
      fontWeight: 400,
      margin: 8,
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
  series: [
    {
      name: '新增',
      type: 'line',
      data: props.items.map(item => item.newCount),
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { color: '#F53F3F', width: 2.5 },
      itemStyle: { color: '#F53F3F', borderColor: '#FFFFFF', borderWidth: 2 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0.05, color: 'rgba(245, 63, 63, 0.12)' },
          { offset: 0.95, color: 'rgba(245, 63, 63, 0)' },
        ]),
      },
    },
    {
      name: '关闭',
      type: 'line',
      data: props.items.map(item => item.closedCount),
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { color: '#00B42A', width: 2.5 },
      itemStyle: { color: '#00B42A', borderColor: '#FFFFFF', borderWidth: 2 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0.05, color: 'rgba(0, 180, 42, 0.12)' },
          { offset: 0.95, color: 'rgba(0, 180, 42, 0)' },
        ]),
      },
    },
  ],
}))
</script>

<template>
  <VChart
    class="defect-trend-chart"
    :option="option"
    autoresize
    role="img"
    aria-label="缺陷新增与关闭趋势面积图"
  />
</template>

<style scoped>
.defect-trend-chart {
  width: 600px;
  height: 200px;
}
</style>
