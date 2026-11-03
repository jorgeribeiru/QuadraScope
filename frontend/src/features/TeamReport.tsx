import { ReadableParagraph } from '@/components/ReadableParagraph'
import { statisticLabels } from '@/lib/statistics'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { useReportHash } from '@/lib/report-hash'
import type { Selection, Metric } from '@/lib/filters'
import { teams, metricLabels, decimal, formatDate } from '@/lib/format'
import { QueryBoundary } from '@/components/QueryBoundary'
import { DataTable } from '@/components/DataTable'
import { Warning, EmptyState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { ReportIndex } from '@/components/ReportNavigation'
import { Interpretations } from '@/components/Interpretations'
import { BoxplotChart, DistributionChart } from '@/components/ScientificCharts'
import { profileHref, sectionIdFromHash } from '@/lib/report-catalog'
import { useLocation } from 'react-router-dom'
import {
  ReportSection,
  MetricSelect,
  Value,
  Period,
  type Description,
} from '@/components/ReportPrimitives'

export function TeamProfile({ meta, selection }: { meta: Meta; selection: Selection }) {
  const { teamId = '' } = useParams()
  const team = teams.find((t) => t.id === teamId)
  const hash = useReportHash()
  const location = useLocation()
  const section = sectionIdFromHash(location.hash)
  const metric = hash.read('variavel', Object.keys(metricLabels) as Metric[], 'PTS')
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'summary', { teamId, ...selection.filters }),
    queryFn: ({ signal }) =>
      requireRelease(api.summary(teamId, selection.filters, signal), meta, client),
    enabled: Boolean(team),
  })
  const distribution = useQuery({
    queryKey: analysisKey(meta, 'distribution', { teamId, metric, ...selection.filters }),
    queryFn: ({ signal }) =>
      requireRelease(api.distribution(teamId, metric, selection.filters, signal), meta, client),
    enabled: Boolean(team),
  })
  if (!team)
    return (
      <Warning>Este time não faz parte do recorte analítico. Selecione Atlanta ou Houston.</Warning>
    )
  return (
    <div className="report-stack">
      <div className="analysis-scope">
        <span className="scope-label">HISTÓRICO COMPLETO DO TIME</span>
        <ReadableParagraph>
          Neste perfil, analisamos todas as partidas disponíveis do time no CSV. Para comparar
          períodos ou selecionar jogos em casa e fora, usamos os filtros da Visão geral e da
          Comparação.
        </ReadableParagraph>
      </div>
      <ReportIndex />
      <div className="report-toolbar profile-toolbar">
        <div className="team-switch" role="group" aria-label="Selecionar time">
          {teams.map((t) => (
            <Button asChild key={t.id} variant={t.id === teamId ? 'default' : 'outline'}>
              <Link
                to={
                  section ? profileHref(t.id, metric, section) : `/times/${t.id}#variavel=${metric}`
                }
                aria-current={t.id === teamId ? 'page' : undefined}
              >
                {t.name}
              </Link>
            </Button>
          ))}
        </div>
        <MetricSelect metric={metric} onChange={(value) => hash.set('variavel', value)} />
      </div>
      <QueryBoundary query={query}>
        {(data) => {
          const row = data.results.find((r) => r.metric === metric)
          if (!row || !row.n) return <EmptyState />
          const measures = Object.entries(statisticLabels).map(([key, label]) => ({
            key,
            label,
            measure: row.statistics[key as keyof Description['statistics']],
          }))
          const b = row.boxplot
          return (
            <>
              <ReportSection
                id="medidas"
                title={`${team.name} · ${metricLabels[metric]}`}
                requirements="R03 · R16"
              >
                <div className="report-context">
                  <span className="tag">{row.n} jogos</span>
                  <Period period={row.period} />
                  <span>{row.unit} · histórico completo do time no CSV</span>
                </div>
                <div className="measure-highlights" role="group" aria-label="Medidas em destaque">
                  {(['mean', 'median', 'std', 'iqr'] as const).map((key) => (
                    <div className={`measure-highlight ${team.className}`} key={key}>
                      <span>{statisticLabels[key]}</span>
                      <strong>
                        <Value measure={row.statistics[key]} />
                      </strong>
                      <small>{row.statistics[key].unit}</small>
                    </div>
                  ))}
                </div>
                <h3>Todas as medidas</h3>
                <DataTable
                  data={measures}
                  columns={[
                    { accessorKey: 'label', header: 'Medida' },
                    {
                      id: 'value',
                      header: 'Valor',
                      cell: ({ row }) => <Value measure={row.original.measure} />,
                    },
                    { accessorKey: 'measure.unit', header: 'Unidade' },
                  ]}
                  caption={`Todas as medidas de ${metric} — ${team.name}.`}
                />
                <ReadableParagraph>
                  Moda: todos os valores com frequência máxima repetida; frequência{' '}
                  {row.statistics.modes.frequency ?? 'indisponível'}. Nenhum valor repetido
                  significa ausência de moda sob esta convenção. Variância e desvio são amostrais
                  (n−1); quartis usam interpolação linear.
                </ReadableParagraph>
                <details>
                  <summary>Resumo das sete variáveis</summary>
                  <DataTable
                    data={data.results}
                    columns={[
                      { accessorKey: 'metric', header: 'Variável' },
                      { accessorKey: 'n', header: 'Jogos' },
                      ...(['mean', 'median', 'std', 'cv', 'iqr'] as const).map((key) => ({
                        id: key,
                        header: statisticLabels[key],
                        cell: ({ row }: { row: { original: Description } }) => (
                          <Value measure={row.original.statistics[key]} />
                        ),
                      })),
                    ]}
                    caption={`Resumo das sete variáveis — ${team.name}. Unidades por variável; CV em percentual.`}
                  />
                </details>
              </ReportSection>
              <ReportSection
                id="boxplot"
                title={`Boxplot · ${metric}`}
                requirements="R17 · R22 · R23"
              >
                <BoxplotChart description={row} />
                <DataTable
                  data={[
                    { label: 'Cerca inferior', value: b.lower_fence },
                    { label: 'Bigode inferior', value: b.lower_whisker },
                    { label: 'Q1', value: b.q1 },
                    { label: 'Mediana', value: b.median },
                    { label: 'Q3', value: b.q3 },
                    { label: 'Bigode superior', value: b.upper_whisker },
                    { label: 'Cerca superior', value: b.upper_fence },
                  ]}
                  columns={[
                    { accessorKey: 'label', header: 'Elemento' },
                    {
                      id: 'value',
                      header: row.unit,
                      cell: ({ row }) =>
                        row.original.value === null ? '—' : decimal(row.original.value),
                    },
                  ]}
                  caption={`Elementos do boxplot de ${metric} — mesmos quartis da tabela de medidas.`}
                />
                <ReadableParagraph>
                  Cercas = Q1 − 1,5 × IQR e Q3 + 1,5 × IQR; IQR = Q3 − Q1. Bigodes são valores
                  observados dentro das cercas. Estar exatamente na cerca não sinaliza outlier. Uma
                  cerca negativa é um limite teórico, não uma contagem observada.
                </ReadableParagraph>
                {b.outliers.length ? (
                  <DataTable
                    data={b.outliers}
                    columns={[
                      { accessorKey: 'game_id', header: 'ID da partida' },
                      {
                        accessorKey: 'game_date',
                        header: 'Data',
                        cell: ({ row }) => formatDate(row.original.game_date),
                      },
                      { accessorKey: 'matchup', header: 'Confronto' },
                      {
                        accessorKey: 'value',
                        header: row.unit,
                        cell: ({ row }) => decimal(row.original.value),
                      },
                      {
                        id: 'side',
                        header: 'Lado',
                        cell: ({ row }) =>
                          row.original.side === 'lower' ? 'Inferior' : 'Superior',
                      },
                    ]}
                    caption={`Partidas fora das cercas IQR de ${metric} — ${team.name}.`}
                  />
                ) : (
                  <ReadableParagraph>
                    Nenhuma partida fora das cercas de IQR para esta variável. Não se força uma
                    sinalização inexistente.
                  </ReadableParagraph>
                )}
              </ReportSection>
              <ReportSection
                id="distribuicao"
                title={`Distribuição e assimetria · ${metric}`}
                requirements="R19"
              >
                <QueryBoundary query={distribution}>
                  {(d) =>
                    d.distribution.teams[0] ? (
                      <DistributionChart team={d.distribution.teams[0]} unit={row.unit} />
                    ) : (
                      <EmptyState />
                    )
                  }
                </QueryBoundary>
                <ReadableParagraph>
                  Assimetria ajustada de Fisher–Pearson: G₁ = [n/((n−1)(n−2))] Σ[(xᵢ − x̄)/s]³, com s
                  amostral. Exige n ≥ 3 e variação. Sinal positivo indica cauda à direita; negativo,
                  à esquerda. Critério descritivo: |G₁| &lt; 0,5 aproximadamente simétrica; de 0,5
                  até menos de 1 moderada; a partir de 1 forte. Essa classificação não testa
                  normalidade.
                </ReadableParagraph>
                <ReadableParagraph>
                  Escolhemos o coeficiente ajustado por incluir a correção amostral ao comparar
                  conjuntos de tamanhos diferentes. Interpretamos o resultado junto com os gráficos,
                  pois os extremos ainda influenciam o coeficiente. Mantivemos as variáveis na
                  escala original; uma transformação logarítmica exigiria outra discussão, inclusive
                  sobre os zeros de BLK/STL, já que log(0) é indefinido.
                </ReadableParagraph>
                <ReadableParagraph>
                  Coeficiente atual: <Value measure={row.statistics.skewness} />. Histograma mostra
                  concentração nas classes, KDE destaca suavização e boxplot localiza centro e
                  extremos; discretização e caudas podem produzir leituras diferentes, sobretudo em
                  BLK/STL.
                </ReadableParagraph>
              </ReportSection>
              <ReportSection
                id="leitura"
                title={`Leitura dos resultados · ${metric}`}
                requirements="R02 · R19 · R20 · R21 · R23"
              >
                <Interpretations
                  meta={meta}
                  context="teams"
                  filters={selection.filters}
                  team={teamId}
                  metric={metric}
                />
                <ReadableParagraph>
                  Trabalhamos com 75 jogos de Atlanta e 74 de Houston. Nesse conjunto, Atlanta teve
                  dois jogos com prorrogação e Houston, oito. Mantivemos os totais por partida, sem
                  ajuste por minutos ou posses, e consideramos essa diferença ao interpretar os
                  times.
                </ReadableParagraph>
              </ReportSection>
            </>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
