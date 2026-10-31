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
import { ReportIndex } from '@/components/ReportNavigation'
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
    'Calculamos a distância de cada valor à média do próprio time em desvios amostrais. Usamos |z| como score e sinalizamos os valores que ultrapassam o corte. Essa distância indica atipicidade, não a probabilidade de um erro.',
  iqr: 'Usamos os mesmos quartis dos boxplots e sinalizamos os valores fora de Q1−1,5×IQR e Q3+1,5×IQR. Distinguimos as cercas, que são limites calculados, dos bigodes, que correspondem a valores observados.',
  grubbs:
    'Aplicamos o teste bilateral para um extremo, com alpha de 5% por teste e pressuposto de normalidade aproximada. Como realizamos vários testes, consideramos o risco de falsos positivos. Não removemos valores para repetir o procedimento; em caso de empate ambíguo, mantemos a atribuição como indefinida.',
  ecod: 'Combinamos as caudas empíricas das sete variáveis, levando em conta a assimetria. No ECOD, usamos os valores originais, sem StandardScaler, e apresentamos a contribuição de cada variável para o score.',
  knn: 'Usamos a distância euclidiana ao décimo vizinho, excluindo o próprio ponto. Antes disso, padronizamos as sete variáveis no histórico de cada time. Assim, interpretamos as distâncias dentro da referência de Atlanta ou de Houston.',
  lof: 'Comparamos a densidade local de cada partida com a de seus dez vizinhos. Apresentamos o negativo de negative_outlier_factor_, de modo que scores maiores indiquem mais atipicidade. Adotamos um corte relativo explícito para a decisão final.',
  dbscan:
    'Aplicamos o agrupamento por densidade às sete variáveis padronizadas, com eps=2,5 e min_samples=5. Apresentamos o cluster −1 como ruído. Na comparação de parâmetros, não encontramos uma divisão estável em vários grupos; por isso, interpretamos esse resultado com cuidado.',
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
          Aplicamos os métodos ao histórico completo de cada time. Os controles desta página
          permitem consultar os resultados já calculados; os filtros da Visão geral e da Comparação
          ficam restritos àquelas páginas.
        </ReadableParagraph>
      </div>
      <ReportIndex />
      <div className="anomaly-intro">
        <h2>Como buscamos partidas atípicas</h2>
        <ReadableParagraph>
          Usamos Z-score, IQR e Grubbs para examinar uma variável por vez. Com ECOD, k-NN, LOF e
          DBSCAN, analisamos as sete variáveis em conjunto. Abaixo, mostramos quais partidas cada
          método identificou.
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
              title={`Resultados de ${methodNames[method]}`}
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
                {result.display_n} partidas disponíveis e {rows.length} linhas na tabela atual. Para
                esta análise, usamos o histórico completo do próprio time no CSV. Alterar as
                partidas exibidas muda a consulta, mas mantém os resultados do método.
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
                  search={{
                    label: 'Consultar partidas do detector',
                    placeholder: 'ID, confronto ou data (DD/MM/AAAA)',
                    text: (row) =>
                      `${row.game_id} ${row.matchup} ${formatDate(row.game_date)} ${row.game_date} ${row.is_outlier ? 'sinalizada' : 'não sinalizada'}`,
                  }}
                  filters={[
                    {
                      id: 'decision',
                      label: 'Decisão da partida',
                      value: (row) =>
                        row.is_outlier === null
                          ? 'undefined'
                          : row.is_outlier
                            ? 'flagged'
                            : 'unflagged',
                      options: [
                        { value: 'flagged', label: 'Sinalizada' },
                        { value: 'unflagged', label: 'Não sinalizada' },
                        { value: 'undefined', label: 'Indefinida' },
                      ],
                    },
                  ]}
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
                <summary>Parâmetros e detalhes do cálculo</summary>
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
              <ReadableParagraph>
                Mantivemos todas as partidas na base. Usamos as sinalizações para investigar
                resultados diferentes do padrão de cada time, considerando que os métodos e os
                parâmetros podem levar a conjuntos distintos de jogos. Como a base não tem rótulos
                de anomalia, não calculamos acurácia para esses detectores.
              </ReadableParagraph>
              {result.warnings.length > 0 && (
                <details>
                  <summary>Observações sobre o método</summary>
                  <ul>
                    {result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
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
                search={{
                  label: 'Consultar inventário de anomalias',
                  placeholder: 'Ex.: Grubbs, BLK, tocos ou multivariado',
                  text: (row) =>
                    `${methodNames[row.method]} ${row.metric ?? 'multivariado'} ${row.metric ? metricLabels[row.metric] : row.features.map((metric) => metricLabels[metric]).join(' ')}`,
                }}
                filters={[
                  {
                    id: 'method',
                    label: 'Método no inventário',
                    value: (row) => row.method,
                    options: Object.entries(methodNames).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  },
                ]}
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
