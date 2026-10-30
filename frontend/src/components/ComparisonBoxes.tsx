import { useQueries, useQueryClient } from '@tanstack/react-query'
import { api, type Meta } from '@/lib/api'
import type { Selection } from '@/lib/filters'
import { teams, decimal, formatDate } from '@/lib/format'
import { analysisKey, requireRelease } from '@/lib/queries'
import { QueryBoundary } from './QueryBoundary'
import { BoxplotChart } from './ScientificCharts'
import { ReportSection } from './ReportPrimitives'
import { DataTable } from './DataTable'
export function ComparisonBoxes({ meta, selection }: { meta: Meta; selection: Selection }) {
  const client = useQueryClient()
  const queries = useQueries({
    queries: teams.map((team) => ({
      queryKey: analysisKey(meta, 'distribution', {
        teamId: team.id,
        metric: selection.metric,
        ...selection.filters,
      }),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        requireRelease(
          api.distribution(team.id, selection.metric, selection.filters, signal),
          meta,
          client,
        ),
    })),
  })
  const descriptions = queries.flatMap((q) => (q.data ? [q.data.description] : []))
  const raw = descriptions
    .flatMap((r) => [
      r.boxplot.lower_fence,
      r.boxplot.upper_fence,
      r.boxplot.lower_whisker,
      r.boxplot.upper_whisker,
      ...r.boxplot.outliers.map((p) => p.value),
    ])
    .filter((v): v is number => typeof v === 'number')
  const domain: [number, number] | undefined = raw.length
    ? [Math.min(...raw), Math.max(...raw)]
    : undefined
  const outliers = descriptions.flatMap((r) => r.boxplot.outliers)
  return (
    <ReportSection
      id="boxplots-comparacao"
      title={`Boxplots na mesma escala · ${selection.metric}`}
      requirements="R17 · R19 · R22 · R23"
    >
      <p>
        Mesma seleção, unidade e domínio horizontal nos dois gráficos. Os perfis individuais abrem o
        histórico completo, sem os filtros desta comparação.
      </p>
      {queries.map((query, i) => (
        <QueryBoundary key={teams[i].id} query={query}>
          {(data) => (
            <article>
              <h3>
                {teams[i].name} · n={data.description.n}
              </h3>
              <BoxplotChart description={data.description} domain={domain} />
            </article>
          )}
        </QueryBoundary>
      ))}
      <p>
        Q1/Q3, mediana, média, cercas e bigodes correspondem aos dados desta seleção. Todas as modas
        e partidas fora das cercas permanecem identificáveis. A tabela de quartis acima usa a mesma
        interpolação linear.
      </p>
      {queries.every((q) => q.isSuccess) &&
        (outliers.length ? (
          <DataTable
            data={outliers}
            columns={[
              {
                id: 'team',
                header: 'Time',
                cell: ({ row }) => teams.find((t) => t.id === row.original.team_id)?.name,
              },
              { accessorKey: 'game_id', header: 'ID da partida' },
              { id: 'date', header: 'Data', cell: ({ row }) => formatDate(row.original.game_date) },
              { accessorKey: 'matchup', header: 'Confronto' },
              {
                id: 'value',
                header: descriptions[0]?.unit ?? 'Valor',
                cell: ({ row }) => decimal(row.original.value),
              },
            ]}
            caption="Partidas fora das cercas dos boxplots — seleção atual dos dois times."
          />
        ) : (
          <p>Nenhuma partida fora das cercas nos resultados carregados.</p>
        ))}
    </ReportSection>
  )
}
