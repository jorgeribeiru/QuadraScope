import { ReadableParagraph } from '@/components/ReadableParagraph'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import type { components } from '@/generated/api'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import { formatDate, integer, metricLabels, teams } from '@/lib/format'
import { DataTable } from '@/components/DataTable'
import { QueryBoundary } from '@/components/QueryBoundary'
import { ReportIndex } from '@/components/ReportNavigation'
import { ReportSection } from '@/components/ReportPrimitives'
import { columnDecisions } from '@/lib/column-decisions'

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
        : (columnDecisions[row.original.original] ?? row.original.exclusion_reason),
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
    <ReportSection id={id} title={title} requirements={requirements}>
      {children}
    </ReportSection>
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
        Nosso recorte reúne {count(focus.rows)} observações em {count(focus.unique_games)} jogos
        distintos. Os {count(focus.head_to_head_games)} confrontos diretos aparecem nos históricos
        dos dois times. Também mantivemos os jogos com prorrogação, considerando que eles têm mais
        tempo para acumular pontos e outras estatísticas.
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
      <ReadableParagraph>
        Trabalhamos com os jogos disponíveis no arquivo. Por isso, a cobertura apresentada aqui é a
        da nossa base, e não a temporada completa. A diferença na quantidade de jogos entre os times
        é uma questão de cobertura, separada da presença de campos vazios.
      </ReadableParagraph>
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
        Na verificação dos dados, encontramos{' '}
        <strong>{count(global.missing_cells)} células ausentes na base completa</strong> e{' '}
        {count(focus.missing_cells)} no recorte Atlanta/Houston. Não houve imputação. Como não temos
        padrões de ausência para comparar neste arquivo, discutimos os mecanismos abaixo sem
        atribuir um deles à base.
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
      <ReadableParagraph>
        Não aplicamos esses testes à nossa base, pois não encontramos células ausentes. Além disso,
        os métodos longitudinais exigem observações repetidas e padrões de abandono específicos, que
        precisam ser considerados antes de uma aplicação a dados de partidas.
      </ReadableParagraph>
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
          Verificamos as 28 colunas e encontramos {integer(missing)} células ausentes,{' '}
          {integer(invalid)} valores fora do domínio, {count(report.duplicates.row_excess)} linhas
          duplicadas excedentes e {count(report.duplicates.key_excess)} chaves time-partida
          duplicadas excedentes. Também conferimos relações entre as estatísticas, como a soma dos
          rebotes e a composição da pontuação.
        </ReadableParagraph>
        <ReadableParagraph>
          Mantivemos os zeros quando eles fazem sentido para a variável. Em BLK ou STL, por exemplo,
          zero pode representar uma partida sem tocos ou roubos. Tratamos valores negativos,
          ausências e outliers separadamente, porque são situações diferentes.
        </ReadableParagraph>
        <DataTable
          data={report.columns}
          search={{
            label: 'Consultar qualidade por coluna',
            text: (row) =>
              `${row.original} ${row.canonical} ${metricLabels[row.original as keyof typeof metricLabels] ?? ''} ${row.domain}`,
          }}
          columns={qualityColumns}
          caption="Qualidade por coluna — base completa, 28 colunas originais."
        />
        <details>
          <summary>Auditoria por coluna no recorte Atlanta/Houston</summary>
          <DataTable
            data={report.focus_columns}
            search={{
              label: 'Consultar qualidade no recorte',
              text: (row) =>
                `${row.original} ${row.canonical} ${metricLabels[row.original as keyof typeof metricLabels] ?? ''} ${row.domain}`,
            }}
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
          search={{
            label: 'Consultar regras de consistência',
            text: (row) => `${row.rule} ${row.description} ${statuses[row.status]}`,
          }}
          columns={checkColumns}
          caption="Regras de consistência, estados e ocorrências na base completa."
        />
        <ReadableParagraph>
          Analisamos os outliers das sete variáveis nos perfis e em Fora da curva. Mantivemos
          identificadores, datas, textos e acumulados como informações de contexto, fora desse
          conjunto de indicadores.
        </ReadableParagraph>
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
          Aqui descrevemos a base que utilizamos e os tratamentos que aplicamos antes da análise.
          Reunimos o dicionário, a verificação de qualidade e nossas escolhas metodológicas. Estas
          informações se referem ao arquivo completo e não mudam com os filtros.
        </ReadableParagraph>
      </div>
      <ReportIndex auditAvailable={quality.isSuccess} />
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
          Utilizamos um arquivo CSV com estatísticas da temporada regular 2025–26 da NBA. A fonte
          registrada para a coleta é a API da NBA, acessada pela biblioteca nba_api. Abaixo,
          apresentamos os registros disponíveis sobre a origem do arquivo.
        </ReadableParagraph>
        <QueryBoundary query={documentation}>
          {(data) => {
            const provenance = data.provenance
            return (
              <>
                <div className="provenance-grid">
                  <div>
                    <h3>Sobre a base utilizada</h3>
                    <dl className="report-definitions">
                      <div>
                        <dt>Fonte dos dados</dt>
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
                    </dl>
                  </div>
                  <div>
                    <h3>Detalhes da extração</h3>
                    <dl className="report-definitions">
                      {' '}
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
                          {text(provenance.endpoints)} /{' '}
                          {text(provenance.collection_library_version)}
                        </dd>
                      </div>
                      <div>
                        <dt>Tratamentos anteriores à entrega do CSV</dt>
                        <dd>{text(provenance.prior_transformations)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                {[
                  provenance.extracted_at,
                  provenance.endpoints,
                  provenance.collection_library_version,
                  provenance.prior_transformations,
                ].some((value) => value == null) && (
                  <ReadableParagraph>
                    Alguns detalhes da extração não constam nos registros que temos. Mantivemos
                    esses campos como não informados e usamos o CSV original como referência para
                    reproduzir a análise.
                  </ReadableParagraph>
                )}
              </>
            )
          }}
        </QueryBoundary>
        <ReadableParagraph>
          Preservamos o CSV original e conferimos sua identificação antes do processamento. Nome:{' '}
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
          Mantivemos as 28 colunas da base e adotamos nomes mais descritivos no processamento. Para
          a análise principal, selecionamos PTS, REB, AST, STL, BLK, PF e FG3M. Na última coluna,
          explicamos o uso de cada campo.
        </ReadableParagraph>
        <QueryBoundary query={dictionary}>
          {(data) => (
            <DataTable
              data={data.columns}
              search={{
                label: 'Buscar no dicionário',
                placeholder: 'Ex.: tocos, BLK, data ou cumulative_wins',
                text: (row) =>
                  `${row.original} ${row.canonical} ${row.label} ${kinds[row.kind]} ${roles[row.role]} ${columnDecisions[row.original] ?? ''}`,
              }}
              filters={[
                {
                  id: 'kind',
                  label: 'Tipo de dado',
                  value: (row) => row.kind,
                  options: Object.entries(kinds).map(([value, label]) => ({ value, label })),
                },
                {
                  id: 'role',
                  label: 'Papel da coluna',
                  value: (row) => row.role,
                  options: Object.entries(roles).map(([value, label]) => ({ value, label })),
                },
              ]}
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
            W e L já vieram como contagens numéricas de vitórias e derrotas acumuladas. WL veio como
            0/1 e foi convertido para o booleano won.
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
            Não precisamos imputar valores. Preservamos os zeros válidos e mantivemos as partidas
            identificadas como outliers para discutir seus resultados.
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
          Desenvolvemos a análise em Python e utilizamos FastAPI para disponibilizar os resultados.
          Escolhemos React para organizar as páginas, os filtros e os gráficos interativos. Assim,
          concentramos os cálculos estatísticos no Python e usamos a interface para consultar e
          apresentar esses resultados.
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
                  Aplicamos Z-score, IQR e Grubbs a uma variável por vez. Nos métodos ECOD, k-NN,
                  LOF e DBSCAN, consideramos as sete variáveis em conjunto. Para o DBSCAN,
                  apresentamos os grupos e o ruído identificados pelo método.
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
          Nosso objetivo é descrever e comparar os jogos presentes na base. Como os times
          enfrentaram adversários e calendários diferentes, interpretamos as diferenças como
          resultados desse recorte, sem atribuir uma causa isolada a elas.
        </ReadableParagraph>
        <ReadableParagraph className="chart-footnote">
          Depois da preparação dos dados, seguimos para os perfis dos times, a comparação das
          estatísticas e a análise dos outliers. O guia do projeto reúne os links para cada assunto.
        </ReadableParagraph>
      </Section>
    </div>
  )
}
