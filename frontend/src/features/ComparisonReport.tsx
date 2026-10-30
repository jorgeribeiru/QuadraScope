import { VariableHighlights } from '@/components/VariableHighlights'
import { ReadableParagraph } from '@/components/ReadableParagraph'
import { statisticLabels, meanContrast } from '@/lib/statistics'
import { lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Meta } from '@/lib/api'
import type { Selection, Metric } from '@/lib/filters'
import { analysisKey, requireRelease } from '@/lib/queries'
import { teams, metricLabels, formatMeasure } from '@/lib/format'
import { QueryBoundary } from '@/components/QueryBoundary'
import { DataTable } from '@/components/DataTable'
import { EmptyState, Loading, Warning } from '@/components/States'
import { Interpretations } from '@/components/Interpretations'
import { ComparisonBoxes } from '@/components/ComparisonBoxes'
import { ReportSection, Value } from '@/components/ReportPrimitives'
const PointsChart = lazy(() =>
  import('@/components/PointsChart').then((m) => ({ default: m.PointsChart })),
)
type Props = { meta: Meta; selection: Selection }
function comparisonText(
  rows: Awaited<ReturnType<typeof api.comparisons>>['summary'],
  metric: Metric,
) {
  const pair = teams.map((team) => rows.find((r) => r.team_id === team.id && r.metric === metric))
  if (!pair[0]?.n || !pair[1]?.n)
    return 'Um dos times não tem observações. Não há comparação de regularidade entre os dois nesta seleção.'
  const cv = pair.map((r) => r!.statistics.cv.value),
    sd = pair.map((r) => r!.statistics.std.value),
    iqr = pair.map((r) => r!.statistics.iqr.value)
  if ([...cv, ...sd, ...iqr].some((v) => typeof v !== 'number'))
    return 'Amostra ou medidas insuficientes para ordenar a dispersão relativa e absoluta dos dois times. Leia os estados de validade; não há conclusão global de regularidade.'
  const direction = (values: typeof cv) =>
    typeof values[0] === 'number' && typeof values[1] === 'number'
      ? values[0] === values[1]
        ? 'empate'
        : values[0] < values[1]
          ? 'Atlanta'
          : 'Houston'
      : 'indefinido'
  return `Menor CV: ${direction(cv)}; menor desvio: ${direction(sd)}; menor IQR: ${direction(iqr)}. CV compara dispersão relativa à média, desvio e IQR permanecem na unidade original. ${direction(cv) !== direction(sd) ? 'CV e desvio discordam: a diferença entre as médias altera a ordenação relativa.' : 'CV e desvio têm a mesma ordenação nesta seleção; isso não demonstra equivalência das medidas.'} ${direction(sd) !== direction(iqr) ? 'Desvio e IQR discordam: o centro e as caudas têm comportamentos distintos; confira os boxplots.' : 'A ordenação do desvio coincide com a do IQR, mas suas sensibilidades aos extremos são diferentes.'}`
}
export function Comparison({ meta, selection }: Props) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'comparisons', { ...selection.filters, metric: selection.metric }),
    queryFn: ({ signal }) =>
      requireRelease(api.comparisons(selection.filters, selection.metric, signal), meta, client),
  })
  return (
    <QueryBoundary query={query}>
      {(data) =>
        data.context.status === 'empty' ? (
          <EmptyState />
        ) : (
          <div className="report-stack">
            <div className="analysis-scope">
              <span className="scope-label">SELEÇÃO APLICADA</span>
              <ReadableParagraph>
                Os resultados desta página acompanham os filtros aplicados. Os perfis individuais e
                os detectores usam o histórico completo de cada time.
              </ReadableParagraph>
            </div>
            <ReportSection
              id="comparacao"
              title={`${metricLabels[selection.metric]} · Atlanta × Houston`}
              requirements="R03 · R04 · R18"
            >
              <ReadableParagraph>
                Mesmos filtros, unidade e eixo iniciado em zero. São médias por partida em
                históricos próprios, não médias apenas dos confrontos diretos.
              </ReadableParagraph>
              <div
                className="comparison-highlights"
                role="group"
                aria-label="Resumo dos times na seleção"
              >
                {teams.map((team) => {
                  const row = data.selected_summary.find((item) => item.team_id === team.id)
                  return (
                    <article className={`comparison-highlight ${team.className}`} key={team.id}>
                      <div className="comparison-highlight-heading">
                        <h3>{team.name}</h3>
                        <span>{row ? `${row.n} jogos` : 'Sem observações disponíveis'}</span>
                      </div>
                      <span className="comparison-highlight-label">
                        Média · {metricLabels[selection.metric]}
                      </span>
                      <strong>{row ? <Value measure={row.statistics.mean} /> : '—'}</strong>
                      <small>{row?.statistics.mean.unit}</small>
                      <dl className="comparison-measures">
                        <div>
                          <dt>Mediana</dt>
                          <dd>{row ? <Value measure={row.statistics.median} /> : '—'}</dd>
                        </div>
                        <div>
                          <dt>Desvio padrão amostral</dt>
                          <dd>{row ? <Value measure={row.statistics.std} /> : '—'}</dd>
                        </div>
                      </dl>
                    </article>
                  )
                })}
              </div>
              <ReadableParagraph className="comparison-reading">
                {meanContrast(data.summary, selection.metric)}
              </ReadableParagraph>
              <Suspense fallback={<Loading />}>
                <PointsChart rows={data.selected_summary} metric={selection.metric} />
              </Suspense>
              <DataTable
                data={data.selected_summary}
                columns={[
                  {
                    id: 'team',
                    header: 'Time',
                    cell: ({ row }) => teams.find((t) => t.id === row.original.team_id)?.name,
                  },
                  { accessorKey: 'n', header: 'Jogos' },
                  ...(
                    [
                      'mean',
                      'median',
                      'std',
                      'range',
                      'cv',
                      'iqr',
                      'iqr_median_ratio',
                      'skewness',
                    ] as const
                  ).map((key) => ({
                    id: key,
                    header: statisticLabels[key],
                    cell: ({
                      row,
                    }: {
                      row: { original: (typeof data.selected_summary)[number] }
                    }) => <Value measure={row.original.statistics[key]} />,
                  })),
                ]}
                caption={`${metricLabels[selection.metric]} — comparação descritiva por partida. Mesma unidade para os dois times.`}
              />
              <ReadableParagraph>
                {comparisonText(data.summary, selection.metric)}
              </ReadableParagraph>
              {data.context.warnings.map((w) => (
                <Warning key={w}>{w}</Warning>
              ))}
              <details>
                <summary>Onde o z-score pode ser usado</summary>
                <ReadableParagraph>
                  z = (x − x̄)/s é adimensional. Para mostrar os dois times em uma escala padronizada
                  comum, declare uma referência conjunta (por exemplo, os dois históricos na
                  seleção) e calcule sua média/desvio sobre essa mesma referência. Não compare
                  médias de z calculadas separadamente em cada time: cada uma fica centrada em zero
                  por construção.
                </ReadableParagraph>
                <ReadableParagraph>
                  As barras acima mantêm as unidades originais. O detector Z-score usa média e
                  desvio amostral do próprio time, e os métodos de vizinhança usam StandardScaler
                  com desvio populacional por feature no histórico do próprio time. Essas
                  referências têm objetivos diferentes e não produzem um ranking comum de scores.
                </ReadableParagraph>
              </details>
            </ReportSection>
            <ComparisonBoxes meta={meta} selection={selection} />
            <ReportSection
              id="regularidade"
              title="Dispersão nas sete variáveis"
              requirements="R20 · R21 · R22 · R23"
            >
              <ReadableParagraph>
                CV = 100 × s/x̄, com s = √[Σ(xᵢ−x̄)²/(n−1)]. Requer escala de razão, média positiva e
                n ≥ 2. Um CV menor indica menor dispersão relativa nesta variável e seleção; não
                equivale a um time globalmente mais regular. BLK/STL têm médias pequenas e
                granularidade inteira, podendo ampliar o CV sem grande dispersão absoluta.
              </ReadableParagraph>
              <VariableHighlights rows={data.summary} />
              {(['cv', 'iqr'] as const).map((stat) => (
                <DataTable
                  key={stat}
                  data={data.matrices[stat].rows}
                  columns={[
                    {
                      id: 'metric',
                      header: 'Variável',
                      cell: ({ row }) =>
                        `${row.original.metric} · ${metricLabels[row.original.metric]}`,
                    },
                    ...teams.map((team) => ({
                      id: team.id,
                      header: team.name,
                      cell: ({
                        row,
                      }: {
                        row: { original: (typeof data.matrices.cv.rows)[number] }
                      }) => (
                        <>
                          <Value measure={row.original.teams[team.id]} />
                          <small className="measure-state">
                            n={row.original.teams[team.id].n} · {row.original.unit}
                          </small>
                        </>
                      ),
                    })),
                  ]}
                  caption={`Quadro 7×2 de ${stat === 'cv' ? 'CV (%)' : 'IQR (unidades por variável)'} — seleção atual.`}
                />
              ))}
              <ReadableParagraph>
                IQR = Q3 − Q1 usa quartis com interpolação linear, iguais aos boxplots na mesma
                seleção. IQR resume os 50% centrais; amplitude usa apenas extremos e o desvio
                considera todos os valores com distâncias quadráticas. IQR/mediana é uma alternativa
                relativa robusta, não outro nome para CV: exige mediana positiva e não é
                automaticamente percentual.
              </ReadableParagraph>
              <DataTable
                data={data.quartiles}
                columns={[
                  { accessorKey: 'metric', header: 'Variável' },
                  { id: 'unit', header: 'Unidade', cell: ({ row }) => row.original.q1.unit },
                  {
                    id: 'team',
                    header: 'Time',
                    cell: ({ row }) => teams.find((t) => t.id === row.original.team_id)?.name,
                  },
                  { accessorKey: 'n', header: 'Jogos' },
                  ...(['q1', 'q3', 'iqr'] as const).map((key) => ({
                    id: key,
                    header: key.toUpperCase(),
                    cell: ({ row }: { row: { original: (typeof data.quartiles)[number] } }) => (
                      <Value measure={row.original[key]} />
                    ),
                  })),
                ]}
                caption="Q1, Q3 e IQR dos 14 pares variável/time — seleção atual."
              />
              <details>
                <summary>Discussão por variável e quadro de evidências</summary>
                {Object.keys(metricLabels).map((metric) => (
                  <article key={metric}>
                    <h3>{metricLabels[metric as Metric]}</h3>
                    <ReadableParagraph>
                      {comparisonText(data.summary, metric as Metric)}
                    </ReadableParagraph>
                  </article>
                ))}
                <DataTable
                  data={data.summary}
                  columns={[
                    { accessorKey: 'metric', header: 'Variável' },
                    {
                      id: 'unit',
                      header: 'Unidade',
                      cell: ({ row }) => row.original.statistics.mean.unit,
                    },
                    {
                      id: 'team',
                      header: 'Time',
                      cell: ({ row }) => teams.find((t) => t.id === row.original.team_id)?.name,
                    },
                    { accessorKey: 'n', header: 'Jogos' },
                    ...(
                      ['mean', 'std', 'range', 'cv', 'iqr', 'iqr_median_ratio', 'skewness'] as const
                    ).map((key) => ({
                      id: key,
                      header: statisticLabels[key],
                      cell: ({ row }: { row: { original: (typeof data.summary)[number] } }) =>
                        formatMeasure(row.original.statistics[key]),
                    })),
                  ]}
                  caption="Média, dispersão e assimetria por variável/time — evidências do mesmo recorte."
                />
              </details>
              <Warning>
                Compare unidades iguais. Um IQR de pontos não pode ser ordenado diretamente com um
                IQR de tocos para concluir regularidade. IQR zero e mediana zero exigem ler os
                estados de validade.
              </Warning>
            </ReportSection>
            <ReportSection
              id="leituras-comparacao"
              title="Interpretação da variável selecionada"
              requirements="R02 · R19 · R21 · R23"
            >
              <Interpretations
                meta={meta}
                context="comparisons"
                filters={selection.filters}
                metric={selection.metric}
              />
              <ReadableParagraph>
                As leituras acompanham os filtros. Os perfis individuais e os detectores usam o
                histórico completo do time no CSV; abrir um perfil não mantém esta seleção.
              </ReadableParagraph>
            </ReportSection>
          </div>
        )
      }
    </QueryBoundary>
  )
}
