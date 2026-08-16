import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

use([
  PieChart,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  SVGRenderer,
])
