import { ReadableParagraph } from '@/components/ReadableParagraph'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import type { components } from '@/generated/api'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { formatDate, integer, metricLabels, teams } from '@/lib/format'
import { DataTable } from '@/components/DataTable'
import { QueryBoundary } from '@/components/QueryBoundary'
import { Warning } from '@/components/States'

type Column = components['schemas']['DictionaryColumn']
type Quality = Awaited<ReturnType<typeof api.quality>>['report']
type QualityColumn = Quality['columns'][number]
type Check = components['schemas']['QualityCheck']
type Json = components['schemas']['JsonValue']

// Os campos JSON livres continuam tratados como desconhecidos: ausência não vira zero.
function object(value: Json | undefined): Record<string, Json> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}
function list(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : []
}
function text(value: Json | undefined): string {
  return typeof value === 'string' ? value : 'Não informado'
}
function count(value: Json | undefined): string {
  return typeof value === 'number' ? integer(value) : '—'
}
function date(value: Json | undefined): string {
  return typeof value === 'string' ? formatDate(value) : 'Não informado'
}
const kinds = {
  identifier: 'Identificador textual',
  string: 'Texto',
  integer: 'Inteiro',
  float: 'Número real',
  boolean: 'Booleano',
  date: 'Data civil',
} as const
const roles = { primary: 'Vetor estatístico', auxiliary: 'Auxiliar', context: 'Contexto' } as const
const statuses = {
  pass: 'Aprovada',
  fail: 'Falhou',
  observed: 'Observação',
  not_evaluated: 'Não avaliada',
} as const
const dictionaryColumns: ColumnDef<Column>[] = [
  { accessorKey: 'original', header: 'Original' },
  { accessorKey: 'canonical', header: 'Nome canônico' },
  { accessorKey: 'label', header: 'Significado' },
  { accessorKey: 'kind', header: 'Tipo', cell: ({ row }) => kinds[row.original.kind] },
  { accessorKey: 'unit', header: 'Unidade' },
  { accessorKey: 'domain', header: 'Domínio' },
  { accessorKey: 'role', header: 'Papel', cell: ({ row }) => roles[row.original.role] },
  {
    id: 'selection',
    header: 'Uso no vetor',
    cell: ({ row }) =>
      row.original.analysis_eligible
        ? 'Incluída entre as sete variáveis'
        : row.original.exclusion_reason,
  },
]
const qualityColumns: ColumnDef<QualityColumn>[] = [
  { accessorKey: 'original', header: 'Coluna original' },
  { accessorKey: 'canonical', header: 'Nome canônico' },
  { accessorKey: 'n', header: 'Registros' },
  { accessorKey: 'missing', header: 'Ausentes' },
  {
    accessorKey: 'zeros',
    header: 'Zeros',
    cell: ({ row }) => row.original.zeros ?? 'Não se aplica',
  },
  {
    accessorKey: 'negatives',
    header: 'Negativos',
    cell: ({ row }) => row.original.negatives ?? 'Não se aplica',
  },
  { accessorKey: 'outside_domain', header: 'Fora do domínio' },
  { accessorKey: 'domain', header: 'Domínio' },
  { accessorKey: 'special_value_policy', header: 'Política de valores especiais' },
  {
    id: 'outliers',
    header: 'Outliers estatísticos',
    cell: ({ row }) =>
      row.original.outliers.status === 'not_applicable'
        ? 'Não aplicável a este tipo de campo.'
        : Object.hasOwn(metricLabels, row.original.original)
          ? 'Ver perfil e métodos de anomalias; separado dos erros de domínio.'
          : 'Não avaliado: campo fora do vetor das sete variáveis.',
  },
]
const checkColumns: ColumnDef<Check>[] = [
  { accessorKey: 'rule', header: 'Regra auditada' },
  {
    accessorKey: 'description',
    header: 'Interpretação',
    cell: ({ row }) => row.original.description ?? 'Validação estrutural da base.',
  },
  { accessorKey: 'status', header: 'Estado', cell: ({ row }) => statuses[row.original.status] },
  {
    id: 'affected',
    header: 'Quantidade',
    cell: ({ row }) => row.original.affected_records ?? row.original.count ?? '—',
  },
  {
    id: 'severity',
    header: 'Tratamento',
    cell: ({ row }) =>
      row.original.severity === 'blocker' ? 'Bloqueia a análise se falhar' : 'Aviso / contexto',
  },
]
function Section({
  id,
  title,
  requirements,
  children,
}: {
  id: string
  title: string
  requirements: string
  children: React.ReactNode
}) {
  return (
    <section className="panel report-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="panel-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="tag">{requirements}</span>
      </div>
      {children}
      <a className="data-back-link" href="#indice-dados">
        Voltar ao índice de Dados e métodos
      </a>
    </section>
  )
}
function Coverage({ coverage }: { coverage: Quality['coverage'] }) {
  const focus = object(coverage.focus)
  const allTeams = list(coverage.by_team).map(object)
  const focusTeams = allTeams.filter((row) => teams.some((team) => team.id === row.team_id))
  const coverageColumns: ColumnDef<Record<string, Json>>[] = [
    { accessorKey: 'team_name', header: 'Time' },
    { accessorKey: 'rows', header: 'Jogos' },
    { accessorKey: 'from', header: 'Primeiro jogo', cell: ({ row }) => date(row.original.from) },
    { accessorKey: 'to', header: 'Último jogo', cell: ({ row }) => date(row.original.to) },
    { accessorKey: 'home', header: 'Casa' },
    { accessorKey: 'away', header: 'Fora' },
    { accessorKey: 'wins', header: 'Vitórias observadas' },
    { accessorKey: 'losses', header: 'Derrotas observadas' },
    { accessorKey: 'overtime_games', header: 'Jogos com prorrogação' },
  ]
  return (
    <>
      <ReadableParagraph>
        Unidade de análise: <strong>um time em uma partida</strong>. Cada jogo aparece em duas
        linhas, uma por adversário. A base contém {count(coverage.unique_games)} jogos distintos de{' '}
        {count(coverage.teams)} times, de {date(coverage.from)} a {date(coverage.to)}.
      </ReadableParagraph>
      <DataTable
        data={focusTeams}
        columns={coverageColumns}
        caption="Cobertura dos históricos de Atlanta e Houston no CSV completo."
      />
      <ReadableParagraph>
        O recorte do grupo reúne {count(focus.rows)} observações em {count(focus.unique_games)}{' '}
        jogos distintos. Seus {count(focus.head_to_head_games)} confrontos diretos pertencem aos
        dois históricos; não representam uma amostra independente adicional. Prorrogações são
        mantidas, pois alteram a exposição dos totais por partida.
      </ReadableParagraph>
      <details>
        <summary>Cobertura dos 30 times e confrontos diretos</summary>
        <DataTable
          data={allTeams}
          columns={coverageColumns}
          caption="Cobertura de todos os times presentes na base, sem consulta ao calendário externo."
        />
        <ul>
          {list(focus.head_to_head)
            .map(object)
            .map((game) => (
              <li key={text(game.game_id)}>
                {date(game.date)} · partida {text(game.game_id)}:{' '}
                {list(game.team_ids)
                  .map(
                    (id, index) =>
                      `${teams.find((team) => team.id === id)?.name ?? text(id)} ${count(list(game.points)[index])}`,
                  )
                  .join(' × ')}
                .
              </li>
            ))}
        </ul>
      </details>
      <Warning>
        {text(coverage.completeness)} Quantidades diferentes entre os times não significam células
        ausentes e não autorizam completar partidas por suposição.
      </Warning>
    </>
  )
}
function Missingness({ report }: { report: Quality }) {
  const global = object(report.missingness.global)
  const focus = object(report.missingness.focus)
  const mechanisms = object(global.mechanisms)
  const methods = list(global.methods).map(object)
  return (
    <Section
      id="ausencias"
      title="Ausências: mecanismos e aplicabilidade dos testes"
      requirements="R12 · R13"
    >
      <ReadableParagraph>
        Foram encontradas{' '}
        <strong>{count(global.missing_cells)} células ausentes na base completa</strong> e{' '}
        {count(focus.missing_cells)} no recorte Atlanta/Houston. Não houve imputação. O mecanismo de
        ausência não foi identificado: ausência de células vazias não demonstra MCAR nem cobertura
        integral da temporada.
      </ReadableParagraph>
      <dl className="report-definitions">
        {Object.entries(mechanisms).map(([name, explanation]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{text(explanation)}</dd>
          </div>
        ))}
      </dl>
      <ReadableParagraph>
        Rejeitar MCAR não identifica automaticamente MAR ou MNAR. Um teste não significativo também
        não prova MCAR. Em geral, MAR e MNAR exigem hipóteses adicionais e não são distinguíveis
        apenas pelos valores observados.
      </ReadableParagraph>
      <div className="method-grid">
        {methods.map((method) => (
          <article className="method-card" key={text(method.id)}>
            <h3>{text(method.name)}</h3>
            <ReadableParagraph>
              <strong>Teoria.</strong> {text(method.theory)}
            </ReadableParagraph>
            <ReadableParagraph>
              <strong>Quando usar.</strong> {text(method.why_use)}
            </ReadableParagraph>
            <ReadableParagraph>
              <strong>Pressupostos.</strong> {text(method.requirements)}
            </ReadableParagraph>
            <ReadableParagraph className="method-status">
              <strong>
                {method.status === 'not_applicable'
                  ? 'Não aplicável neste recorte'
                  : text(method.status)}
                .
              </strong>{' '}
              {text(method.reason)}
            </ReadableParagraph>
            <ReadableParagraph>
              Execução: {method.executed === false ? 'não executado' : 'não informada'}. Estatística
              e p-valor: não calculados.
            </ReadableParagraph>
          </article>
        ))}
      </div>
      <Warning>
        Não foram criados padrões artificiais de ausência para produzir p-valores. Os testes
        longitudinais citados exigem desenho e pressupostos próprios; linhas time-partida não
        equivalem automaticamente a um painel de abandono clínico.
      </Warning>
      <details>
        <summary>Limitações e referências dos métodos de ausência</summary>
        <ul>
          {list(global.limitations).map((item) => (
            <li key={text(item)}>{text(item)}</li>
          ))}
        </ul>
        <ul>
          {list(global.references)
            .filter(
              (item): item is string => typeof item === 'string' && item.startsWith('https://'),
            )
            .map((href) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noreferrer">
                  {href.includes('amices.org')
                    ? 'Documentação mice: testes MCAR'
                    : 'Referência metodológica sobre mecanismos de ausência'}
                </a>
              </li>
            ))}
        </ul>
      </details>
    </Section>
  )
}
function QualityReport({ report }: { report: Quality }) {
  const missing = report.columns.reduce((sum, col) => sum + col.missing, 0)
  const invalid = report.columns.reduce((sum, col) => sum + col.outside_domain, 0)
  const checks = report.checks.filter((check) => !check.rule.startsWith('column_domain:'))
  return (
    <>
      <Section id="qualidade" title="Auditoria de qualidade" requirements="R11 · R12 · R14">
        <ReadableParagraph>
          A auditoria aprovada encontrou {integer(missing)} células ausentes, {integer(invalid)}{' '}
          valores fora do domínio, {count(report.duplicates.row_excess)} linhas duplicadas
          excedentes e {count(report.duplicates.key_excess)} chaves time-partida duplicadas
          excedentes. A aprovação comprova consistência segundo as regras verificadas; não autentica
          externamente os resultados esportivos.
        </ReadableParagraph>
        <ReadableParagraph>
          Zeros são preservados quando válidos no domínio. Um zero em BLK ou STL pode representar
          uma partida sem tocos ou roubos. Negativos e ausências são contados separadamente; valores
          atípicos não são automaticamente erros de domínio.
        </ReadableParagraph>
        <DataTable
          data={report.columns}
          columns={qualityColumns}
          caption="Qualidade por coluna — base completa, 28 colunas originais."
        />
        <details>
          <summary>Auditoria por coluna no recorte Atlanta/Houston</summary>
          <DataTable
            data={report.focus_columns}
            columns={qualityColumns}
            caption="Qualidade por coluna — somente as observações dos dois times em foco."
          />
        </details>
        <h3>Consistências dentro e entre partidas</h3>
        <ReadableParagraph>
          As verificações abaixo são distintas da auditoria de células: incluem pontos, rebotes,
          acumulados, pareamento dos adversários, mando e exposição por prorrogação. A quantidade
          indica registros afetados ou ocorrências conforme a descrição da regra; não representa uma
          contagem de jogos distintos em todas as linhas.
        </ReadableParagraph>
        <DataTable
          data={checks}
          columns={checkColumns}
          caption="Regras de consistência, estados e ocorrências na base completa."
        />
        <Warning>
          Outliers estatísticos são avaliados separadamente nos perfis e em Fora da curva. IDs,
          datas, textos e acumulados não entram no vetor dos sete indicadores; não se aplica uma
          distância estatística ao número de um identificador.
        </Warning>
      </Section>
      <Missingness report={report} />
    </>
  )
}
export function DataPage({ meta }: { meta: Meta }) {
  const client = useQueryClient()
  const dictionary = useQuery({
    queryKey: analysisKey(meta, 'dictionary', {}),
    queryFn: ({ signal }) => requireRelease(api.dictionary(signal), meta, client),
  })
  const quality = useQuery({
    queryKey: analysisKey(meta, 'quality', {}),
    queryFn: ({ signal }) => requireRelease(api.quality(signal), meta, client),
  })
  const documentation = useQuery({
    queryKey: analysisKey(meta, 'documentation', { context: 'methodology' }),
    queryFn: ({ signal }) => requireRelease(api.documentation(signal), meta, client),
  })
  return (
    <div className="data-report">
      <div className="analysis-scope data-intro">
        <span className="scope-label">DOCUMENTAÇÃO DA BASE COMPLETA</span>
        <h2>Conheça os dados antes de interpretar</h2>
        <ReadableParagraph>
          Consulte a cobertura, a origem, o dicionário, a auditoria e as escolhas metodológicas do
          QuadraScope. Esta documentação tem escopo fixo e não muda com os filtros das análises.
        </ReadableParagraph>
      </div>
      <nav id="indice-dados" className="report-index" aria-label="Seções de Dados e métodos">
        <h2>Explore por assunto</h2>
        <ul>
          <li>
            <a href="#base">
              <strong>Base e cobertura</strong>
              <span>Dimensões, times e partidas</span>
            </a>
          </li>
          <li>
            <a href="#origem">
              <strong>Origem</strong>
              <span>Proveniência e limites da coleta</span>
            </a>
          </li>
          <li>
            <a href="#dicionario">
              <strong>Dicionário</strong>
              <span>Colunas, unidades e transformações</span>
            </a>
          </li>
          <li>
            <a href={quality.isSuccess ? '#qualidade' : '#auditoria'}>
              <strong>Qualidade</strong>
              <span>Regras e resultados da auditoria</span>
            </a>
          </li>
          <li>
            <a href={quality.isSuccess ? '#ausencias' : '#auditoria'}>
              <strong>Ausências</strong>
              <span>Mecanismos e testes aplicáveis</span>
            </a>
          </li>
          <li>
            <a href="#metodos">
              <strong>Métodos</strong>
              <span>Convenções, detectores e limites</span>
            </a>
          </li>
        </ul>
      </nav>
      <Section id="base" title="Dimensões e cobertura do recorte" requirements="R07 · R08">
        <div className="stat-grid data-stat-grid">
          {[
            ['Registros', integer(meta.source.row_count)],
            ['Colunas originais', integer(meta.source.column_count)],
            ['Tamanho do CSV', `${integer(meta.source.size_bytes)} bytes`],
            ['Formato', `${meta.source.encoding} · CSV`],
          ].map(([label, value]) => (
            <div className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <QueryBoundary query={quality}>
          {(data) => <Coverage coverage={data.report.coverage} />}
        </QueryBoundary>
      </Section>
      <Section id="origem" title="Origem e limites de proveniência" requirements="R07 · R08">
        <ReadableParagraph>
          A origem foi declarada pela equipe. Os detalhes disponíveis e os não informados estão
          registrados abaixo, sem presumir uma verificação externa.
        </ReadableParagraph>
        <QueryBoundary query={documentation}>
          {(data) => {
            const provenance = data.provenance
            return (
              <>
                <dl className="report-definitions">
                  <div>
                    <dt>Fonte declarada pelo grupo</dt>
                    <dd>{text(provenance.source)}</dd>
                  </div>
                  <div>
                    <dt>Coleta</dt>
                    <dd>{text(provenance.collection_library)}</dd>
                  </div>
                  <div>
                    <dt>Temporada / fase</dt>
                    <dd>
                      {text(provenance.season)} · {text(provenance.phase)}
                    </dd>
                  </div>
                  <div>
                    <dt>Data de extração</dt>
                    <dd>
                      {provenance.extracted_at === null
                        ? 'Não informada'
                        : text(provenance.extracted_at)}
                    </dd>
                  </div>
                  <div>
                    <dt>Endpoints / versão da biblioteca</dt>
                    <dd>
                      {text(provenance.endpoints)} / {text(provenance.collection_library_version)}
                    </dd>
                  </div>
                  <div>
                    <dt>Tratamentos anteriores à entrega do CSV</dt>
                    <dd>{text(provenance.prior_transformations)}</dd>
                  </div>
                </dl>
                <Warning>{text(provenance.limitation)}</Warning>
              </>
            )
          }}
        </QueryBoundary>
        <ReadableParagraph>
          O CSV original é preservado; o pipeline confere sua identidade antes de processar. Nome:{' '}
          <code>{meta.source.filename}</code>. Delimitador: <code>{meta.source.delimiter}</code>.
        </ReadableParagraph>
        <ReadableParagraph className="source-identity">
          SHA-256 da fonte: <code>{meta.source.sha256}</code>
          <br />
          Release da análise: <code>{meta.context.release_id}</code>
        </ReadableParagraph>
      </Section>
      <Section id="dicionario" title="Dicionário dos dados" requirements="R07 · R08 · R09 · R10">
        <ReadableParagraph>
          As 28 colunas originais são preservadas com nomes canônicos explícitos. As sete variáveis
          do vetor são PTS, REB, AST, STL, BLK, PF e FG3M. Cada exclusão está justificada na última
          coluna.
        </ReadableParagraph>
        <QueryBoundary query={dictionary}>
          {(data) => (
            <DataTable
              data={data.columns}
              columns={dictionaryColumns}
              caption="Dicionário completo: nomes, tipos semânticos, unidades, domínios e seleção das 28 colunas."
            />
          )}
        </QueryBoundary>
        <h3>Conversões e campos derivados</h3>
        <ul>
          <li>
            IDs ficam como texto de dígitos. Datas são datas civis no formato YYYY-MM-DD, sem
            conversão de fuso.
          </li>
          <li>
            W e L já são contagens numéricas de vitórias e derrotas acumuladas. WL é 0/1 na origem e
            vira o booleano won; não se inventa uma codificação categórica.
          </li>
          <li>
            Contagens são inteiros não negativos; percentuais da fonte são frações entre 0 e 1.
            Variáveis não são arredondadas antes dos cálculos.
          </li>
          <li>
            O pareamento por partida acrescenta opponent_id, opponent_points, point_margin, venue e
            overtime_periods. A base enriquecida tem cinco campos adicionais, sem sobrescrever as 28
            colunas originais.
          </li>
          <li>
            O mando vem de vs./@. A margem é PTS menos os pontos do adversário. MIN agrega minutos
            dos jogadores: 240 + 25 × prorrogações; não é a duração individual de uma partida.
          </li>
          <li>
            Não há imputação, exclusão de zeros ou remoção automática de outliers. Registros
            permanecem disponíveis para contexto e auditoria.
          </li>
        </ul>
        <ReadableParagraph>
          Identificadores, nomes, resultados e acumulados permanecem como contexto. Não entram nas
          distâncias entre desempenhos. Em uma futura previsão, resultado e acumulados pós-jogo
          poderiam causar vazamento de informação; o vetor atual é descritivo e não é um modelo
          preditivo.
        </ReadableParagraph>
      </Section>
      <div id="auditoria" className="data-quality-sections">
        <QueryBoundary query={quality}>
          {(data) => <QualityReport report={data.report} />}
        </QueryBoundary>
      </div>
      <Section
        id="metodos"
        title="Métodos, stack e limites da análise"
        requirements="R01 · R10 · R14"
      >
        <ReadableParagraph>
          A análise científica é executada em Python. FastAPI reutiliza as funções validadas,
          verifica parâmetros e publica contratos OpenAPI. React organiza navegação, tabelas e
          gráficos interativos; os indicadores vêm da API, evitando reproduzir fórmulas estatísticas
          no navegador. A combinação FastAPI + React foi confirmada pelo grupo.
        </ReadableParagraph>
        <QueryBoundary query={documentation}>
          {(data) => {
            const methodology = data.methodology
            return (
              <>
                <ReadableParagraph>{text(methodology.unit_of_analysis)}</ReadableParagraph>
                <h3>Convenções descritivas</h3>
                <ul>
                  {Object.values(object(methodology.descriptives)).map((value) => (
                    <li key={text(value)}>{text(value)}</li>
                  ))}
                </ul>
                <h3>Domínio dos detectores</h3>
                <dl className="report-definitions">
                  {Object.entries(object(methodology.detectors)).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name === 'zscore' ? 'Z-score' : name.toUpperCase()}</dt>
                      <dd>{text(value)}</dd>
                    </div>
                  ))}
                </dl>
                <ReadableParagraph>
                  Z-score, IQR e Grubbs são univariados. ECOD, k-NN, LOF e DBSCAN analisam o vetor
                  das sete variáveis. Grubbs testa um extremo sob pressupostos; DBSCAN identifica
                  ruído, sem score contínuo inventado.
                </ReadableParagraph>
                <ul>
                  {list(methodology.limitations).map((value) => (
                    <li key={text(value)}>{text(value)}</li>
                  ))}
                </ul>
              </>
            )
          }}
        </QueryBoundary>
        <ReadableParagraph>
          Históricos com calendários, adversários e quantidades diferentes são comparados de forma
          descritiva. Não se conclui causalidade, eficiência por posse ou superioridade global a
          partir desses totais.
        </ReadableParagraph>
        <ReadableParagraph className="chart-footnote">
          Os códigos R01–R24 nas seções permitem localizar as exigências do relatório. Esta página
          apresenta os requisitos de dados e qualidade; os resultados estatísticos por time
          pertencem aos perfis e às páginas de comparação e anomalias.
        </ReadableParagraph>
      </Section>
    </div>
  )
}
