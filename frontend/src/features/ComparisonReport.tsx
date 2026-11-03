import { VariableHighlights } from '@/components/VariableHighlights'
import { ReadableParagraph } from '@/components/ReadableParagraph'
import { statisticLabels, measureContrast, comparisonMeasures } from '@/lib/statistics'
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
import { ReportIndex } from '@/components/ReportNavigation'
import { useReportHash } from '@/lib/report-hash'
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
  const finding = (label: string, values: typeof cv) =>
    direction(values) === 'empate'
      ? `${label} igual nos dois times`
      : `menor ${label} em ${direction(values)}`
  return `Ao comparar esta variável, encontramos ${finding('CV', cv)}, ${finding('desvio', sd)} e ${finding('IQR', iqr)}. ${direction(cv) !== direction(sd) ? 'A ordenação muda entre CV e desvio porque o CV também considera a média de cada time.' : 'CV e desvio apontam a mesma ordenação neste recorte.'} ${direction(sd) !== direction(iqr) ? 'Já o IQR e o desvio apontam ordenações diferentes, mostrando que a concentração central e os extremos pesam de formas distintas na comparação.' : 'O IQR acompanha a ordenação do desvio, embora resuma apenas os 50% centrais dos jogos.'}`
}
export function Comparison({ meta, selection }: Props) {
  const hash = useReportHash()
  const measure = hash.read('medida', [...comparisonMeasures], 'mean')
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
                Aqui comparamos os times usando os filtros selecionados. Nos perfis individuais e na
                análise de outliers, consideramos o histórico completo de cada time.
              </ReadableParagraph>
            </div>
            <ReportIndex />
            <ReportSection
              id="comparacao"
              title={`${metricLabels[selection.metric]} · Atlanta × Houston`}
              requirements="R03 · R04 · R18"
            >
              <ReadableParagraph>
                Comparamos os históricos dos dois times com os mesmos filtros e unidades. Nas
                barras, mantivemos o eixo iniciado em zero. A diferença é descritiva: não realizamos
                um teste de superioridade entre os times.
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
              <label className="report-control chart-measure-control">
                Medida das barras
                <select
                  value={measure}
                  onChange={(event) => hash.set('medida', event.target.value)}
                >
                  {comparisonMeasures.map((key) => (
                    <option key={key} value={key}>
                      {statisticLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <h3>
                {statisticLabels[measure]} · {metricLabels[selection.metric]}
              </h3>
              <ReadableParagraph className="comparison-reading">
                {measureContrast(data.summary, selection.metric, measure)}
              </ReadableParagraph>
              <Suspense fallback={<Loading />}>
                <PointsChart
                  rows={data.selected_summary}
                  metric={selection.metric}
                  measure={measure}
                />
              </Suspense>
              <DataTable
                data={data.selected_summary}
                columns={[
                  {
                    id: 'team',
                    header: 'Time',
                    cell: ({ row }) => teams.find((team) => team.id === row.original.team_id)?.name,
                  },
                  { accessorKey: 'n', header: 'Jogos' },
                  {
                    id: 'measure',
                    header: statisticLabels[measure],
                    cell: ({ row }) => <Value measure={row.original.statistics[measure]} />,
                  },
                  {
                    id: 'unit',
                    header: 'Unidade',
                    cell: ({ row }) => row.original.statistics[measure].unit,
                  },
                ]}
                caption={`Dados das barras: ${statisticLabels[measure]} de ${selection.metric} — seleção atual.`}
              />
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
              <details id="zscore">
                <summary>Onde o z-score pode ser usado</summary>
                <ReadableParagraph>
                  z = (x − x̄)/s é adimensional. Para mostrar os dois times em uma escala padronizada
                  comum, declare uma referência conjunta (por exemplo, os dois históricos na
                  seleção) e calcule sua média/desvio sobre essa mesma referência. Não compare
                  médias de z calculadas separadamente em cada time: cada uma fica centrada em zero
                  por construção.
                </ReadableParagraph>
                <ReadableParagraph>
                  Nas barras, mantivemos as unidades das medidas. Para detectar outliers por
                  Z-score, usamos a média e o desvio amostral do próprio time. Nos métodos de
                  vizinhança, utilizamos StandardScaler com desvio populacional por variável, também
                  ajustado separadamente para cada time.
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
                <div key={stat} id={stat} className="anchor-target">
                  <DataTable
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
                </div>
              ))}
              <ReadableParagraph>
                IQR = Q3 − Q1 usa quartis com interpolação linear, iguais aos boxplots na mesma
                seleção. IQR resume os 50% centrais; amplitude usa apenas extremos e o desvio
                considera todos os valores com distâncias quadráticas. IQR/mediana é uma alternativa
                relativa robusta, não outro nome para CV: exige mediana positiva e não é
                automaticamente percentual.
              </ReadableParagraph>
              <div id="quartis" className="anchor-target">
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
              </div>
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
                Nossas interpretações acompanham os filtros desta página. Nos perfis e nos
                detectores, retomamos o histórico completo do time no CSV.
              </ReadableParagraph>
            </ReportSection>
          </div>
        )
      }
    </QueryBoundary>
  )
}
