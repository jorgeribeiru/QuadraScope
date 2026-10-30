import { meanContrast } from '@/lib/statistics'
import { lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Database, Layers3, Target } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { selectionHref, selectionParams, type Selection, type Metric } from '@/lib/filters'
import { integer, metricLabels, teams, formatMeasure, formatDate } from '@/lib/format'
import { DataTable } from '@/components/DataTable'
import { QueryBoundary as Boundary } from '@/components/QueryBoundary'
import { EmptyState, Loading, Warning } from '@/components/States'
import { ReportSection, Value } from '@/components/ReportPrimitives'
import { Interpretations } from '@/components/Interpretations'
const PointsChart = lazy(() =>
  import('@/components/PointsChart').then((m) => ({ default: m.PointsChart })),
)
type Props = { meta: Meta; selection: Selection }
function useComparisons({ meta, selection }: Props) {
  const client = useQueryClient()
  return useQuery({
    queryKey: analysisKey(meta, 'comparisons', { ...selection.filters, metric: selection.metric }),
    queryFn: ({ signal }) =>
      requireRelease(api.comparisons(selection.filters, selection.metric, signal), meta, client),
  })
}
function record(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {}
}
function array(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function show(v: unknown) {
  return typeof v === 'number' ? integer(v) : typeof v === 'string' ? v : 'não informado'
}
function FullHistoryContext({ meta }: { meta: Meta }) {
  const coverage = meta.coverage,
    focus = record(coverage.focus)
  const history = array(coverage.by_team)
    .map(record)
    .filter((r) => teams.some((t) => t.id === r.team_id))
  return (
    <ReportSection
      id="contexto-completo"
      title="Históricos completos e confrontos diretos"
      requirements="R07 · R24"
    >
      <Warning>
        Escopo fixo: CSV completo. Este bloco de cobertura não é recalculado pelos filtros acima. As
        conclusões da seleção ficam na seção anterior.
      </Warning>
      <p>
        O recorte reúne {show(focus.rows)} observações em {show(focus.unique_games)} jogos
        distintos. Os {show(focus.head_to_head_games)} confrontos diretos aparecem em ambos os
        históricos, não são amostra independente adicional e não substituem a comparação de todas as
        partidas.
      </p>
      <ul>
        {history.map((row) => (
          <li key={show(row.team_id)}>
            {show(row.team_name)}: {show(row.rows)} jogos; {show(row.home)} em casa,{' '}
            {show(row.away)} fora e {show(row.overtime_games)} com prorrogação. Cobertura de{' '}
            {typeof row.from === 'string' ? formatDate(row.from) : '—'} a{' '}
            {typeof row.to === 'string' ? formatDate(row.to) : '—'}.
          </li>
        ))}
      </ul>
      <DataTable
        data={array(focus.head_to_head).map(record)}
        columns={[
          {
            id: 'date',
            header: 'Data',
            cell: ({ row }) =>
              typeof row.original.date === 'string' ? formatDate(row.original.date) : '—',
          },
          { id: 'id', header: 'ID da partida', cell: ({ row }) => show(row.original.game_id) },
          {
            id: 'points',
            header: 'Placar nos registros',
            cell: ({ row }) =>
              array(row.original.team_ids)
                .map(
                  (id, i) =>
                    `${teams.find((t) => t.id === id)?.name ?? show(id)} ${show(array(row.original.points)[i])}`,
                )
                .join(' × '),
          },
        ]}
        caption="Confrontos diretos no CSV completo — escopo fixo, separado da seleção atual."
      />
      <p>
        Prorrogações aumentam a exposição dos totais por jogo; não se atribui a elas uma diferença
        isolada entre times. Calendário, adversários e quantidade de jogos também variam. Não há
        ajuste por posses, previsão, causalidade ou verificação externa de completude.
      </p>
      <Link to="/dados#base" className="text-link">
        Auditar cobertura e métodos <ArrowRight size={15} />
      </Link>
    </ReportSection>
  )
}
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
          {data.context.status !== 'empty' && (
            <ReportSection
              id="sintese"
              title="Síntese descritiva da seleção"
              requirements="R02 · R21 · R24"
            >
              <p>
                As linhas abaixo descrevem os históricos próprios de Atlanta e Houston na seleção
                atual. Não são um ranking global dos times. Quantidades, médias e dispersões mudam
                com os filtros.
              </p>
              <DataTable
                data={Object.keys(metricLabels).map((code) => ({
                  metric: code as Metric,
                  rows: data.summary.filter((r) => r.metric === code),
                }))}
                columns={[
                  {
                    id: 'metric',
                    header: 'Variável',
                    cell: ({ row }) => metricLabels[row.original.metric],
                  },
                  ...teams.map((team) => ({
                    id: team.id,
                    header: team.name,
                    cell: ({
                      row,
                    }: {
                      row: { original: { metric: Metric; rows: typeof data.summary } }
                    }) => {
                      const r = row.original.rows.find((r) => r.team_id === team.id)
                      return r ? (
                        <span>
                          n={r.n} · média <Value measure={r.statistics.mean} /> · CV{' '}
                          <Value measure={r.statistics.cv} />
                        </span>
                      ) : (
                        'Sem observações'
                      )
                    },
                  })),
                  {
                    id: 'evidence',
                    header: 'Evidência na seleção',
                    cell: ({ row }) => (
                      <Link
                        to={selectionHref(
                          '/comparar',
                          `?${selectionParams(props.selection.filters, row.original.metric).toString()}`,
                        )}
                      >
                        Comparar {row.original.metric}
                      </Link>
                    ),
                  },
                ]}
                caption="Síntese das sete variáveis — médias e CV na seleção atual, com acesso às evidências."
              />
              <ul>
                {Object.entries(metricLabels).map(([metric, label]) => (
                  <li key={metric}>
                    <strong>{label}.</strong> {meanContrast(data.summary, metric as Metric)}
                  </li>
                ))}
              </ul>
              <Interpretations
                meta={props.meta}
                context="overview"
                filters={props.selection.filters}
                metric={props.selection.metric}
              />
              <p>
                IQR descreve o centro, desvio considera todos os afastamentos e CV os relativiza
                pela média. Discordâncias não autorizam escolher um vencedor único; consulte os
                quadros, assimetria e boxplots na mesma referência.
              </p>
            </ReportSection>
          )}
          <FullHistoryContext meta={props.meta} />
        </>
      )}
    </Boundary>
  )
}

export { TeamProfile } from './TeamReport'
export { Comparison } from './ComparisonReport'
export { Anomalies } from './AnomalyReport'
export { DataPage } from './DataReport'
