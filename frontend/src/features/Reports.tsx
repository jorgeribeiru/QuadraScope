import { lazy, Suspense } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Database, Layers3, Target } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import type { components } from '@/generated/api'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { selectionHref, type Selection } from '@/lib/filters'
import { decimal, formatDate, formatMeasure, integer, metricLabels, teams } from '@/lib/format'
import { DataTable } from '@/components/DataTable'
import {
  EmptyState,
  ErrorState,
  Loading,
  PendingInterpretation,
  Warning,
} from '@/components/States'
import { Button } from '@/components/ui/button'

const PointsChart = lazy(() =>
  import('@/components/PointsChart').then((module) => ({ default: module.PointsChart })),
)
type Props = { meta: Meta; selection: Selection }
type Description = components['schemas']['Description']
function Boundary<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, Error>
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  return children(query.data)
}
function useComparisons({ meta, selection }: Props) {
  const client = useQueryClient()
  return useQuery({
    queryKey: analysisKey(meta, 'comparisons', { ...selection.filters, metric: selection.metric }),
    queryFn: ({ signal }) =>
      requireRelease(api.comparisons(selection.filters, selection.metric, signal), meta, client),
  })
}
function Value({ measure }: { measure: components['schemas']['Measure'] }) {
  return (
    <span title={measure.reason || measure.unit}>
      {formatMeasure(measure)}
      {measure.status === 'insufficient_sample' && (
        <small className="measure-state">amostra insuficiente</small>
      )}
    </span>
  )
}
const descriptionColumns: ColumnDef<Description>[] = [
  {
    accessorKey: 'metric',
    header: 'Variável',
    cell: ({ row }) => (
      <span className="metric-cell">
        <b>{row.original.metric}</b>
        {metricLabels[row.original.metric]}
      </span>
    ),
  },
  {
    id: 'mean',
    accessorFn: (row) =>
      typeof row.statistics.mean.value === 'number' ? row.statistics.mean.value : undefined,
    header: 'Média',
    cell: ({ row }) => <Value measure={row.original.statistics.mean} />,
  },
  {
    id: 'median',
    header: 'Mediana',
    cell: ({ row }) => <Value measure={row.original.statistics.median} />,
  },
  {
    id: 'std',
    header: 'Desvio padrão',
    cell: ({ row }) => <Value measure={row.original.statistics.std} />,
  },
  { id: 'cv', header: 'CV (%)', cell: ({ row }) => <Value measure={row.original.statistics.cv} /> },
  { accessorKey: 'n', header: 'Jogos' },
]

export function Overview(props: Props) {
  const query = useComparisons(props)
  const location = useLocation()
  return (
    <Boundary query={query}>
      {(data) => (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>
                <Layers3 size={17} />
                Observações selecionadas
              </span>
              <strong>
                {integer(Object.values(data.context.n_by_team).reduce((sum, n) => sum + n, 0))}
              </strong>
              <small>Um registro por time em uma partida</small>
            </div>
            <div className="stat-card">
              <span>
                <Target size={17} />
                Times em foco
              </span>
              <strong>02</strong>
              <small>Históricos próprios, mesma seleção</small>
            </div>
            <div className="stat-card">
              <span>
                <BarChart3 size={17} />
                Variáveis de análise
              </span>
              <strong>07</strong>
              <small>De pontos a cestas de três</small>
            </div>
            <div className="stat-card">
              <span>
                <Database size={17} />
                Base de contexto
              </span>
              <strong>{integer(props.meta.source.row_count)}</strong>
              <small>Registros dos 30 times da liga</small>
            </div>
          </div>
          {data.context.status === 'empty' ? (
            <EmptyState />
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DOIS TIMES. UMA MESMA QUADRA DE ANÁLISE.</span>
                  <h2>Os times em foco</h2>
                </div>
                <span className="subtle">
                  Seleção atual · {metricLabels[props.selection.metric]}
                </span>
              </div>
              <div className="team-grid">
                {teams.map((team) => {
                  const row = data.selected_summary.find((row) => row.team_id === team.id)
                  return (
                    <article className={`team-card ${team.className}`} key={team.id}>
                      <div className="team-card-heading">
                        <span className={`team-monogram large ${team.className}`}>
                          {team.short}
                        </span>
                        <div>
                          <span className="eyebrow">{team.city}</span>
                          <h3>{team.nickname}</h3>
                        </div>
                        <span className="sample-pill">{data.context.n_by_team[team.id]} jogos</span>
                      </div>
                      <div className="team-score">
                        <span>
                          MÉDIA DE {metricLabels[props.selection.metric].toLocaleUpperCase('pt-BR')}
                        </span>
                        <strong>{row ? formatMeasure(row.statistics.mean) : '—'}</strong>
                        <small>{row?.statistics.mean.unit}</small>
                      </div>
                      <div className="team-measures">
                        <div>
                          <span>Mediana</span>
                          <b>{row ? formatMeasure(row.statistics.median) : '—'}</b>
                        </div>
                        <div>
                          <span>Desvio padrão</span>
                          <b>{row ? formatMeasure(row.statistics.std) : '—'}</b>
                        </div>
                        <div>
                          <span>CV</span>
                          <b>{row ? formatMeasure(row.statistics.cv) : '—'}</b>
                        </div>
                      </div>
                      <Link to={`/times/${team.id}`} className="text-link">
                        Explorar perfil <ArrowRight size={16} />
                      </Link>
                    </article>
                  )
                })}
              </div>
              <div className="lower-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">LADO A LADO</span>
                      <h2>{metricLabels[props.selection.metric]} por partida</h2>
                    </div>
                    <span className="tag">Média</span>
                  </div>
                  <Suspense fallback={<Loading label="Preparando gráfico…" />}>
                    <PointsChart rows={data.selected_summary} metric={props.selection.metric} />
                  </Suspense>
                  <p className="chart-footnote">
                    Mesma unidade e eixo iniciado em zero. A tabela em Comparação apresenta os
                    valores.
                  </p>
                  <Link to={selectionHref('/comparar', location.search)} className="text-link">
                    Abrir comparação <ArrowRight size={15} />
                  </Link>
                </section>
                <section className="context-panel">
                  <span className="eyebrow">ANTES DE INTERPRETAR</span>
                  <h2>
                    Todo número
                    <br />
                    precisa de contexto.
                  </h2>
                  <ul>
                    <li>
                      <span>01</span>As amostras podem ter quantidades diferentes de jogos.
                    </li>
                    <li>
                      <span>02</span>Prorrogações e zeros legítimos são preservados.
                    </li>
                    <li>
                      <span>03</span>Uma partida atípica não comprova erro no dado.
                    </li>
                  </ul>
                  <Link to="/dados">
                    Conheça os dados <ArrowRight size={16} />
                  </Link>
                </section>
              </div>
            </>
          )}
          {data.context.warnings.map((warning) => (
            <Warning key={warning}>{warning}</Warning>
          ))}
          <PendingInterpretation />
        </>
      )}
    </Boundary>
  )
}

export function TeamProfile({ meta, selection }: Props) {
  const { teamId = '' } = useParams()
  const team = teams.find((team) => team.id === teamId)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'summary', { teamId, ...selection.filters }),
    queryFn: ({ signal }) =>
      requireRelease(api.summary(teamId, selection.filters, signal), meta, client),
    enabled: Boolean(team),
  })
  if (!team)
    return (
      <Warning>
        Este time não faz parte do recorte analítico. Selecione Atlanta ou Houston na navegação.
      </Warning>
    )
  return (
    <>
      <div className="team-switch" aria-label="Selecionar time">
        {teams.map((t) => (
          <Button asChild key={t.id} variant={t.id === teamId ? 'default' : 'outline'}>
            <Link to={`/times/${t.id}`}>{t.name}</Link>
          </Button>
        ))}
      </div>
      <Boundary query={query}>
        {(data) =>
          data.context.status === 'empty' ? (
            <EmptyState />
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PERFIL DA SELEÇÃO</span>
                  <h2>{team.name}</h2>
                </div>
                <span className="tag">{data.context.n_by_team[team.id]} jogos</span>
              </div>
              <DataTable
                data={data.results}
                columns={descriptionColumns}
                caption={`Estatísticas por partida — ${team.name}. Unidades por variável; CV em percentual.`}
              />
              <Warning>
                O CV deve ser lido com média, desvio e assimetria. Não há um corte universal de
                regularidade.
              </Warning>
              <PendingInterpretation />
            </section>
          )
        }
      </Boundary>
    </>
  )
}

export function Comparison(props: Props) {
  const query = useComparisons(props)
  const columns: ColumnDef<components['schemas']['SummaryRow']>[] = [
    {
      accessorKey: 'team_id',
      header: 'Time',
      cell: ({ row }) => teams.find((team) => team.id === row.original.team_id)?.name,
    },
    {
      id: 'mean',
      header: 'Média',
      cell: ({ row }) => <Value measure={row.original.statistics.mean} />,
    },
    {
      id: 'std',
      header: 'Desvio padrão',
      cell: ({ row }) => <Value measure={row.original.statistics.std} />,
    },
    {
      id: 'cv',
      header: 'CV (%)',
      cell: ({ row }) => <Value measure={row.original.statistics.cv} />,
    },
    {
      id: 'iqr',
      header: 'IQR',
      cell: ({ row }) => <Value measure={row.original.statistics.iqr} />,
    },
    { accessorKey: 'n', header: 'Jogos' },
  ]
  return (
    <Boundary query={query}>
      {(data) =>
        data.context.status === 'empty' ? (
          <EmptyState />
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">MESMOS FILTROS · REFERÊNCIAS EXPLÍCITAS</span>
                <h2>{metricLabels[props.selection.metric]} · Atlanta × Houston</h2>
              </div>
            </div>
            <Suspense fallback={<Loading />}>
              <PointsChart rows={data.selected_summary} metric={props.selection.metric} />
            </Suspense>
            <DataTable
              data={data.selected_summary}
              columns={columns}
              caption={`${metricLabels[props.selection.metric]} — comparação descritiva por partida. Mesma unidade para os dois times.`}
            />
            {data.context.warnings.map((w) => (
              <Warning key={w}>{w}</Warning>
            ))}
            <PendingInterpretation />
          </section>
        )
      }
    </Boundary>
  )
}

export function Anomalies({ meta, selection }: Props) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'anomalies', {
      ...selection.filters,
      team_id: teams[0].id,
      method: 'lof',
    }),
    queryFn: ({ signal }) =>
      requireRelease(api.anomalies(teams[0].id, selection.filters, signal), meta, client),
  })
  const columns: ColumnDef<components['schemas']['AnomalyRecord']>[] = [
    {
      accessorKey: 'game_date',
      header: 'Data',
      cell: ({ getValue }) => formatDate(String(getValue())),
    },
    { accessorKey: 'matchup', header: 'Confronto' },
    { accessorKey: 'game_id', header: 'Partida' },
    {
      accessorKey: 'score',
      header: 'Score LOF',
      cell: ({ row }) => (row.original.score === null ? '—' : decimal(row.original.score)),
    },
    {
      accessorKey: 'is_outlier',
      header: 'Sinalização',
      cell: ({ row }) =>
        row.original.is_outlier === null
          ? 'Indefinida'
          : row.original.is_outlier
            ? 'Atípica'
            : 'Não sinalizada',
    },
  ]
  return (
    <Boundary query={query}>
      {(data) => (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ATLANTA HAWKS · VETOR DAS SETE VARIÁVEIS</span>
              <h2>Partidas sob a lente do LOF</h2>
            </div>
            <span className="tag">Referência: {data.result.reference_n} jogos</span>
          </div>
          <Warning>
            O método foi ajustado ao histórico completo do próprio time. As {data.result.display_n}
            partidas exibidas pertencem a essa referência. Scores maiores indicam maior atipicidade;
            não são probabilidades.
          </Warning>
          {data.context.status === 'empty' ? (
            <EmptyState />
          ) : (
            <DataTable
              data={data.result.records}
              columns={columns}
              caption="LOF — partidas de Atlanta na seleção. Scores e flags preservam a referência completa."
            />
          )}
          <PendingInterpretation />
        </section>
      )}
    </Boundary>
  )
}

export function DataPage({ meta }: Props) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'dictionary', {}),
    queryFn: ({ signal }) => requireRelease(api.dictionary(signal), meta, client),
  })
  const columns: ColumnDef<components['schemas']['DictionaryColumn']>[] = [
    { accessorKey: 'original', header: 'Original' },
    { accessorKey: 'canonical', header: 'Nome canônico' },
    { accessorKey: 'label', header: 'Significado' },
    { accessorKey: 'kind', header: 'Tipo' },
    { accessorKey: 'unit', header: 'Unidade' },
  ]
  return (
    <>
      <div className="data-banner">
        <Database size={26} />
        <div>
          <h2>Uma base preservada. Uma análise rastreável.</h2>
          <p>
            NBA 2025–26 · API oficial via nba_api · {integer(meta.source.row_count)} registros,{' '}
            {meta.source.column_count} colunas.
          </p>
        </div>
      </div>
      <Warning>
        Este dicionário descreve a base completa. A data exata e os detalhes da extração não foram
        informados pelo grupo.
      </Warning>
      <Boundary query={query}>
        {(data) => (
          <section className="panel">
            <div className="panel-heading">
              <h2>Dicionário dos dados</h2>
              <span className="tag">28 colunas</span>
            </div>
            <DataTable
              data={data.columns}
              columns={columns}
              caption="Colunas originais e canônicas do dataset completo."
            />
          </section>
        )}
      </Boundary>
    </>
  )
}
