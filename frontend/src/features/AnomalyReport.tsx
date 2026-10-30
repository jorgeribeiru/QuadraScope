import { ReadableParagraph } from '@/components/ReadableParagraph'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Meta, type Method } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { useReportHash } from '@/lib/report-hash'
import type { Selection, Metric } from '@/lib/filters'
import { metricLabels, teams, decimal, formatDate } from '@/lib/format'
import { QueryBoundary } from '@/components/QueryBoundary'
import { DataTable } from '@/components/DataTable'
import { ReportSection } from '@/components/ReportPrimitives'
import { Warning } from '@/components/States'
const methodNames: Record<Method, string> = {
  zscore: 'Z-score',
  iqr: 'IQR',
  grubbs: 'Grubbs',
  ecod: 'ECOD',
  knn: 'k-NN',
  lof: 'LOF',
  dbscan: 'DBSCAN',
}
const methodReadings: Record<Method, string> = {
  zscore:
    'Distância em desvios amostrais da média do próprio time. Score é |z|, não probabilidade. Um ponto além do corte pode ser legítimo e a referência não é a média conjunta dos times.',
  iqr: 'Sinaliza observações estritamente fora de Q1−1,5×IQR e Q3+1,5×IQR. Os quartis coincidem com os boxplots do histórico completo. Bigode é observação; cerca é limite teórico.',
  grubbs:
    'Teste bilateral para um extremo, sob normalidade aproximada. Alpha nominal de 5% por teste; múltiplos testes aumentam o risco de falsos positivos. Não houve remoção iterativa. Em empate ambíguo, os candidatos não são convertidos em um outlier individual confirmado.',
  ecod: 'Combina caudas empíricas inclusivas das sete variáveis, considerando assimetria. Não usa StandardScaler. Contribuições por variável explicam o score, sem representar causalidade ou probabilidade de erro.',
  knn: 'Distância euclidiana ao décimo vizinho externo, excluindo o próprio ponto. As sete variáveis são padronizadas no histórico do próprio time. A distância é relativa a essa referência e não permite ranking comum entre times.',
  lof: 'Compara densidade local com a dos dez vizinhos. O score mostrado é o negativo de negative_outlier_factor_; valores maiores indicam mais atipicidade. A decisão final usa o corte relativo explícito, não os rótulos automáticos da biblioteca.',
  dbscan:
    'Agrupamento por densidade no vetor padronizado. Cluster −1 significa ruído, não erro comprovado. Não há score contínuo ou ranking inventado. eps=2,5 e min_samples=5 foram revisados para este snapshot; a grade não sustenta múltiplos grupos estáveis.',
}
const precise = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })

export function Anomalies({ meta, selection }: { meta: Meta; selection: Selection }) {
  const hash = useReportHash(),
    client = useQueryClient()
  const teamId = hash.read(
    'time',
    teams.map((t) => t.id),
    teams[0].id,
  )
  const method = hash.read('metodo', Object.keys(methodNames) as Method[], 'lof')
  const metric = hash.read('variavel', Object.keys(metricLabels) as Metric[], 'PTS')
  const display = hash.read('partidas', ['flagged', 'all'] as const, 'flagged')
  const univariate = ['zscore', 'iqr', 'grubbs'].includes(method)
  const query = useQuery({
    queryKey: analysisKey(meta, 'anomalies', {
      ...selection.filters,
      teamId,
      method,
      metric: univariate ? metric : null,
    }),
    queryFn: ({ signal }) =>
      requireRelease(
        api.anomalies(teamId, selection.filters, signal, method, univariate ? metric : undefined),
        meta,
        client,
      ),
  })
  const inventory = useQuery({
    queryKey: analysisKey(meta, 'quality', {}),
    queryFn: ({ signal }) => requireRelease(api.quality(signal), meta, client),
  })
  return (
    <div className="report-stack">
      <div className="analysis-scope">
        <span className="scope-label">HISTÓRICO COMPLETO DO TIME</span>
        <ReadableParagraph>
          Os detectores usam uma referência fixa para cada time; os filtros da Visão geral e da
          Comparação não são aplicados aqui. A exibição das partidas não recalcula o método.
        </ReadableParagraph>
      </div>
      <div className="anomaly-intro">
        <h2>Escolha uma lente para a análise</h2>
        <ReadableParagraph>
          Z-score, IQR e Grubbs analisam uma variável. ECOD, k-NN, LOF e DBSCAN analisam o vetor
          completo de sete variáveis. Métodos diferentes podem sinalizar partidas diferentes.
        </ReadableParagraph>
      </div>
      <div className="report-toolbar">
        <label className="report-control">
          Time das anomalias
          <select value={teamId} onChange={(e) => hash.set('time', e.target.value)}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="report-control">
          Método
          <select value={method} onChange={(e) => hash.set('metodo', e.target.value)}>
            <optgroup label="Uma variável">
              {(['zscore', 'iqr', 'grubbs'] as const).map((key) => (
                <option key={key} value={key}>
                  {methodNames[key]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sete variáveis">
              {(['ecod', 'knn', 'lof', 'dbscan'] as const).map((key) => (
                <option key={key} value={key}>
                  {methodNames[key]}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {univariate && (
          <label className="report-control">
            Variável do detector
            <select value={metric} onChange={(e) => hash.set('variavel', e.target.value)}>
              {Object.entries(metricLabels).map(([key, name]) => (
                <option key={key} value={key}>
                  {key} · {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="report-control">
          Partidas exibidas
          <select value={display} onChange={(e) => hash.set('partidas', e.target.value)}>
            <option value="flagged">Sinalizadas e candidatas</option>
            <option value="all">Todas as partidas de referência</option>
          </select>
        </label>
      </div>
      <QueryBoundary query={query}>
        {(data) => {
          const result = data.result
          const fences =
            result.threshold && typeof result.threshold === 'object' ? result.threshold : null
          const rows =
            display === 'all'
              ? result.records
              : result.records.filter((r) => r.is_outlier === true || r.is_candidate === true)
          const team = teams.find((t) => t.id === teamId)!
          return (
            <ReportSection
              id="detector"
              title={`Partidas sob a lente do ${methodNames[method]}`}
              requirements="R14 · R15 · R23"
            >
              <div className="report-context">
                <strong>{team.name}</strong>
                <span>
                  {univariate
                    ? `Uma variável · ${metric} · ${metricLabels[metric]}`
                    : 'Multivariado · vetor das sete variáveis'}
                </span>
                <span className="tag">Referência: {result.reference_n} jogos</span>
              </div>
              <div className="anomaly-overview">
                <div className="anomaly-count">
                  <span>Sinalizações na referência</span>
                  <strong>{result.outlier_count ?? 'Indefinida'}</strong>
                  <small>{rows.length} linhas na tabela atual</small>
                </div>
                <div>
                  <h3>Como interpretar {methodNames[method]}</h3>
                  <ReadableParagraph>{methodReadings[method]}</ReadableParagraph>
                </div>
              </div>
              <ReadableParagraph className="anomaly-reference">
                <strong>{result.outlier_count ?? 'Indefinida'} sinalizações na referência</strong>;{' '}
                {result.display_n} partidas disponíveis e {rows.length} linhas na tabela atual. O
                controle de exibição não reajusta o detector. Referência fixa: histórico completo do
                próprio time no CSV; não herda filtros da Home.
              </ReadableParagraph>
              {result.status !== 'ok' && <Warning>{result.reason ?? result.status}</Warning>}
              {result.test && (
                <ReadableParagraph>
                  Grubbs: G={precise(result.test.statistic)}, crítico=
                  {precise(result.test.critical_value)}, hipótese de ausência de extremo{' '}
                  {result.test.rejected ? 'rejeitada' : 'não rejeitada'}. Atribuição:{' '}
                  {result.test.attribution === 'ambiguous_tie'
                    ? 'empate ambíguo entre candidatos'
                    : 'candidato único'}
                  . Candidatos: {result.test.candidate_game_ids.join(', ') || 'nenhum'}.
                </ReadableParagraph>
              )}
              <div className="anomaly-criterion">
                <h3>Critério e limites</h3>
                {method === 'iqr' ? (
                  <ReadableParagraph>
                    Cerca inferior:{' '}
                    {typeof fences?.lower === 'number' ? precise(fences.lower) : 'indefinida'};
                    cerca superior:{' '}
                    {typeof fences?.upper === 'number' ? precise(fences.upper) : 'indefinida'}{' '}
                    {result.unit}. Sinalização estritamente fora das cercas.
                  </ReadableParagraph>
                ) : method === 'zscore' ? (
                  <ReadableParagraph>
                    Limite de |z|:{' '}
                    {typeof result.threshold === 'number'
                      ? precise(result.threshold)
                      : 'indefinido'}{' '}
                    desvios amostrais. Sinalização quando |z| é estritamente maior que o limite.
                  </ReadableParagraph>
                ) : method === 'grubbs' ? (
                  <ReadableParagraph>
                    Valor crítico do teste global:{' '}
                    {typeof result.threshold === 'number'
                      ? precise(result.threshold)
                      : 'indefinido'}
                    . A decisão do teste e a atribuição aos candidatos estão descritas acima.
                  </ReadableParagraph>
                ) : method === 'dbscan' ? (
                  <ReadableParagraph>
                    Cluster −1 indica ruído. Não há limiar de score contínuo. Clusters sem ruído:{' '}
                    {result.clusters ?? 'indefinido'}.
                  </ReadableParagraph>
                ) : (
                  <ReadableParagraph>
                    Corte de score:{' '}
                    {typeof result.threshold === 'number'
                      ? precise(result.threshold)
                      : 'indefinido'}
                    . Score estritamente maior que o quantil 0,95 linear; empates no corte não são
                    sinalizados.
                  </ReadableParagraph>
                )}
                <ReadableParagraph>
                  Os valores exibidos são arredondados; as decisões usam a precisão integral do
                  cálculo.
                </ReadableParagraph>
              </div>
              <h3>Partidas {display === 'all' ? 'da referência' : 'sinalizadas e candidatas'}</h3>
              {rows.length ? (
                <DataTable
                  data={rows}
                  columns={[
                    { accessorKey: 'game_id', header: 'ID da partida' },
                    {
                      accessorKey: 'game_date',
                      header: 'Data',
                      cell: ({ row }) => formatDate(row.original.game_date),
                    },
                    { accessorKey: 'matchup', header: 'Confronto' },
                    ...result.features.map((feature) => ({
                      id: feature,
                      header: `${feature} (${result.feature_units[feature] ?? result.unit ?? ''})`,
                      cell: ({ row }: { row: { original: (typeof rows)[number] } }) =>
                        decimal(row.original.values[feature]),
                    })),
                    {
                      id: 'score',
                      header: method === 'dbscan' ? 'Cluster' : 'Score',
                      cell: ({ row }) =>
                        method === 'dbscan'
                          ? row.original.cluster === -1
                            ? '−1 · ruído'
                            : (row.original.cluster ?? '—')
                          : row.original.score === null
                            ? '—'
                            : precise(row.original.score),
                    },
                    {
                      id: 'flag',
                      header: 'Decisão',
                      cell: ({ row }) =>
                        row.original.is_outlier === null
                          ? 'Indefinida'
                          : row.original.is_outlier
                            ? 'Sinalizada'
                            : 'Não sinalizada',
                    },
                    {
                      id: 'candidate',
                      header: 'Candidato Grubbs',
                      cell: ({ row }) =>
                        row.original.is_candidate === true
                          ? 'Sim'
                          : row.original.is_candidate === false
                            ? 'Não'
                            : 'Não se aplica',
                    },
                  ]}
                  caption={`${methodNames[method]} — ${team.name}: ${display === 'all' ? 'todas as partidas' : 'sinalizações e candidatos'} na referência completa.`}
                />
              ) : (
                <ReadableParagraph>
                  {result.status !== 'ok'
                    ? 'Não há partidas para apresentar com este resultado do detector.'
                    : display === 'all'
                      ? 'Nenhuma partida disponível nesta referência.'
                      : 'Nenhuma partida sinalizada ou candidata sob esta regra. Não se força uma quantidade de outliers.'}
                </ReadableParagraph>
              )}
              <details>
                <summary>Parâmetros e evidências completas do detector</summary>
                <ReadableParagraph>
                  Parâmetros efetivamente usados, incluindo referência de padronização quando
                  aplicável. StandardScaler usa desvio populacional por feature; descritivas e
                  Z-score usam desvio amostral. Scores e limiares de métodos diferentes não são
                  comparáveis diretamente.
                </ReadableParagraph>
                <pre className="scientific-json">{JSON.stringify(result.parameters, null, 2)}</pre>
                {['ecod', 'knn', 'lof'].includes(method) && (
                  <ReadableParagraph>
                    Score unitário: {result.score_unit ?? 'adimensional'}. Informação adicional por
                    partida: contribuições de cauda ECOD, vizinhos k-NN ou rótulo da biblioteca LOF,
                    que não substitui a decisão final.
                  </ReadableParagraph>
                )}
                <pre className="scientific-json">
                  {JSON.stringify(
                    result.records
                      .filter((r) => r.is_outlier || r.is_candidate)
                      .map((r) => ({
                        game_id: r.game_id,
                        score: r.score,
                        raw_score: r.raw_score,
                        contributions: r.feature_contributions,
                        tail_probabilities: r.tail_probabilities,
                        neighbor_game_ids: r.neighbor_game_ids,
                        library_label: r.library_label,
                      })),
                    null,
                    2,
                  )}
                </pre>
              </details>
              {result.warnings.map((w) => (
                <Warning key={w}>{w}</Warning>
              ))}
              <Warning>
                Sem rótulos verdadeiros, não há acurácia demonstrada. Métodos diferentes podem
                sinalizar partidas diferentes: concordância não comprova correção. Escala, k, eps e
                limiar alteram os resultados; não houve remoção automática de partidas.
              </Warning>
            </ReportSection>
          )
        }}
      </QueryBoundary>
      <ReportSection
        id="inventario"
        title="Contagens por método e domínio de aplicação"
        requirements="R14 · R15"
      >
        <QueryBoundary query={inventory}>
          {(data) => (
            <>
              <ReadableParagraph>
                Contagens no histórico completo de cada time. Métodos univariados analisam uma
                variável; métodos multivariados analisam o vetor completo e sua contagem não é
                atribuída a uma coluna isolada. Identificadores e texto não são magnitudes
                estatísticas.
              </ReadableParagraph>
              <DataTable
                data={data.anomaly_summary.filter((r) => r.team_id === teamId)}
                columns={[
                  {
                    id: 'method',
                    header: 'Método',
                    cell: ({ row }) => methodNames[row.original.method],
                  },
                  {
                    id: 'metric',
                    header: 'Domínio',
                    cell: ({ row }) => row.original.metric ?? row.original.features.join(' · '),
                  },
                  { accessorKey: 'reference_n', header: 'Referência (jogos)' },
                  {
                    id: 'outliers',
                    header: 'Sinalizações',
                    cell: ({ row }) => row.original.outlier_count ?? 'Indefinida',
                  },
                  { accessorKey: 'status', header: 'Estado do cálculo' },
                ]}
                caption={`Inventário de anomalias — ${teams.find((t) => t.id === teamId)?.name}: 21 análises univariadas e quatro multivariadas.`}
              />
            </>
          )}
        </QueryBoundary>
      </ReportSection>
    </div>
  )
}
