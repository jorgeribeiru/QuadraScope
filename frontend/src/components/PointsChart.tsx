import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { components } from '@/generated/api'
import { formatMeasure, metricLabels, teams } from '@/lib/format'
import type { Metric } from '@/lib/filters'

echarts.use([BarChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])
export function PointsChart({
  rows,
  metric,
}: {
  rows: components['schemas']['SummaryRow'][]
  metric: Metric
}) {
  const values = teams.map((team) => {
    const row = rows.find((row) => row.team_id === team.id)
    const value = row?.statistics.mean.value
    return {
      value: typeof value === 'number' ? value : null,
      itemStyle: {
        color: team.short === 'ATL' ? '#c34d42' : '#a96f25',
        borderRadius: [4, 4, 0, 0],
      },
    }
  })
  const description = teams
    .map((team) => {
      const row = rows.find((row) => row.team_id === team.id)
      return `${team.name}: ${row ? formatMeasure(row.statistics.mean) : 'indisponível'}`
    })
    .join('; ')
  return (
    <div
      className="comparison-chart"
      role="img"
      aria-label={`Média de ${metricLabels[metric]}. ${description}.`}
    >
      <ReactEChartsCore
        echarts={echarts}
        style={{ height: 250 }}
        option={{
          animation: false,
          aria: { enabled: true },
          grid: { left: 46, right: 20, top: 32, bottom: 34 },
          tooltip: {
            trigger: 'axis',
            valueFormatter: (value: number) =>
              typeof value === 'number'
                ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                : 'Indisponível',
          },
          xAxis: {
            type: 'category',
            data: ['Atlanta Hawks', 'Houston Rockets'],
            axisTick: { show: false },
            axisLine: { lineStyle: { color: '#dfe3db' } },
            axisLabel: { color: '#46524e' },
          },
          yAxis: {
            type: 'value',
            min: 0,
            name: rows[0]?.statistics.mean.unit || '',
            nameTextStyle: { color: '#68736c', align: 'left' },
            splitLine: { lineStyle: { color: '#edf0e9' } },
          },
          series: [
            {
              type: 'bar',
              barWidth: 65,
              data: values,
              label: {
                show: true,
                position: 'top',
                formatter: ({ value }: { value: number | null }) =>
                  value === null
                    ? '—'
                    : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
                color: '#15201d',
                fontSize: 15,
                fontWeight: 'bold',
              },
            },
          ],
        }}
      />
    </div>
  )
}
