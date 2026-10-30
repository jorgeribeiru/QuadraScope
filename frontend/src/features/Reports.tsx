import { ReadableParagraph } from '@/components/ReadableParagraph'
import { meanContrast } from '@/lib/statistics'
import { lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Database, Target } from 'lucide-react'
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
function selectionDescription(selection: Selection) {
  const { from, to, venue, outcome } = selection.filters
  const period =
    from && to
      ? `${formatDate(from)} a ${formatDate(to)}`
      : from
        ? `Desde ${formatDate(from)}`
        : to
          ? `Até ${formatDate(to)}`
          : 'Todo o período disponível'
  const venueLabel = { all: 'Casa e fora', home: 'Em casa', away: 'Fora de casa' }[venue]
  const outcomeLabel = { all: 'Todos os resultados', win: 'Vitórias', loss: 'Derrotas' }[outcome]
  return [period, venueLabel, outcomeLabel, metricLabels[selection.metric]]
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
      <ReadableParagraph>
        O recorte reúne {show(focus.rows)} observações em {show(focus.unique_games)} jogos
        distintos. Os {show(focus.head_to_head_games)} confrontos diretos aparecem em ambos os
        históricos, não são amostra independente adicional e não substituem a comparação de todas as
        partidas.
      </ReadableParagraph>
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
      <ReadableParagraph>
        Prorrogações aumentam a exposição dos totais por jogo; não se atribui a elas uma diferença
        isolada entre times. Calendário, adversários e quantidade de jogos também variam. Não há
        ajuste por posses, previsão, causalidade ou verificação externa de completude.
      </ReadableParagraph>
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
          <section className="overview-selection" aria-labelledby="overview-selection-title">
            <div>
              <span className="scope-label">SELEÇÃO APLICADA</span>
              <h2 id="overview-selection-title">Atlanta Hawks × Houston Rockets</h2>
              <ReadableParagraph>
                Explore estatísticas por partida dos históricos próprios dos dois times na temporada
                regular da NBA. A análise acadêmica é descritiva e respeita a seleção abaixo.
              </ReadableParagraph>
              <ul className="selection-summary" aria-label="Resumo da seleção aplicada">
                {selectionDescription(props.selection).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="selection-count">
              <span>Observações selecionadas</span>
              <strong>
                {integer(Object.values(data.context.n_by_team).reduce((sum, n) => sum + n, 0))}
              </strong>
              <small>Um registro por time em uma partida</small>
            </div>
          </section>
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
                        <img
                          className="team-logo large"
                          src={team.logo}
                          alt=""
                          width="48"
                          height="48"
                        />
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
                      <ReadableParagraph className="profile-scope">
                        O perfil usa o histórico completo do time e não mantém esta seleção.
                      </ReadableParagraph>
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
                  <ReadableParagraph className="overview-reading">
                    {meanContrast(data.selected_summary, props.selection.metric)}
                  </ReadableParagraph>
                  <ReadableParagraph className="chart-footnote">
                    Mesma unidade e eixo iniciado em zero. A tabela em Comparação apresenta os
                    valores.
                  </ReadableParagraph>
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
              <ReadableParagraph>
                As linhas abaixo descrevem os históricos próprios de Atlanta e Houston na seleção
                atual. Não são um ranking global dos times. Quantidades, médias e dispersões mudam
                com os filtros.
              </ReadableParagraph>
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
              <ReadableParagraph>
                IQR descreve o centro, desvio considera todos os afastamentos e CV os relativiza
                pela média. Discordâncias não autorizam escolher um vencedor único; consulte os
                quadros, assimetria e boxplots na mesma referência.
              </ReadableParagraph>
            </ReportSection>
          )}
          <section className="overview-context" aria-labelledby="overview-context-title">
            <div className="section-heading">
              <div>
                <span className="scope-label">CONTEXTO FIXO</span>
                <h2 id="overview-context-title">A base da análise</h2>
                <ReadableParagraph>
                  Os indicadores abaixo descrevem o projeto e a base completa; não mudam com os
                  filtros.
                </ReadableParagraph>
              </div>
            </div>
            <div className="overview-facts">
              <div>
                <Target size={19} />
                <span>
                  Times em foco<strong>02</strong>
                  <small>Atlanta e Houston</small>
                </span>
              </div>
              <div>
                <BarChart3 size={19} />
                <span>
                  Variáveis de análise<strong>07</strong>
                  <small>De pontos a cestas de três</small>
                </span>
              </div>
              <div>
                <Database size={19} />
                <span>
                  Base de contexto<strong>{integer(props.meta.source.row_count)}</strong>
                  <small>Registros dos 30 times da liga</small>
                </span>
              </div>
            </div>
          </section>
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
