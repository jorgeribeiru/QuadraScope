import type { Metric } from './filters'
import { metricLabels, teams } from './format'

export type ReportPage = 'overview' | 'profile' | 'comparison' | 'anomalies' | 'data' | 'guide'
export type Destination = { label: string; href: string }
export type ReportSectionEntry = {
  id: string
  title: string
  description: string
  keywords: string
}
export const reportPages: {
  id: ReportPage
  title: string
  path: string
  scope: string
  sections: ReportSectionEntry[]
}[] = [
  {
    id: 'overview',
    title: 'Visão geral',
    path: '/',
    scope: 'Apresentamos os resultados gerais e um resumo da base utilizada.',
    sections: [
      {
        id: 'sintese',
        title: 'Síntese descritiva',
        description: 'Médias, CV e interpretação das sete variáveis.',
        keywords: 'conclusão resumo regularidade',
      },
      {
        id: 'contexto-completo',
        title: 'Históricos e confrontos',
        description: 'Cobertura, prorrogações e confrontos diretos.',
        keywords: 'calendário partidas mando jogos',
      },
    ],
  },
  {
    id: 'data',
    title: 'Dados e métodos',
    path: '/dados',
    scope: 'Descrevemos a base, os tratamentos e as escolhas da análise.',
    sections: [
      {
        id: 'base',
        title: 'Base e cobertura',
        description: 'Dimensões, tamanho, times e partidas.',
        keywords: 'linhas colunas bytes dataset',
      },
      {
        id: 'origem',
        title: 'Origem',
        description: 'Proveniência e limites da coleta.',
        keywords: 'nba api fonte extração temporada',
      },
      {
        id: 'dicionario',
        title: 'Dicionário',
        description: 'Colunas, tipos, unidades e transformações.',
        keywords: 'data datas renomeação nomes exclusão features W L WL booleano',
      },
      {
        id: 'qualidade',
        title: 'Qualidade',
        description: 'Regras e resultados da auditoria.',
        keywords: 'zeros negativos duplicados inconsistências domínio',
      },
      {
        id: 'ausencias',
        title: 'Ausências',
        description: 'Mecanismos e testes aplicáveis.',
        keywords:
          'missing MCAR MAR MNAR Little Jamshidian Jalal Listing Schlittgen Fairclough imputação',
      },
      {
        id: 'metodos',
        title: 'Métodos',
        description: 'Convenções, detectores e limites.',
        keywords: 'Python FastAPI React framework teoria fórmulas',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Perfil dos times',
    path: '/times/1610612737',
    scope: 'Analisamos separadamente todos os jogos disponíveis de Atlanta e Houston.',
    sections: [
      {
        id: 'medidas',
        title: 'Medidas descritivas',
        description: 'Todas as medidas da variável selecionada.',
        keywords: 'média mediana moda mínimo máximo amplitude variância desvio quartis',
      },
      {
        id: 'boxplot',
        title: 'Boxplot e outliers',
        description: 'Centro, cercas, modas e partidas atípicas.',
        keywords: 'Q1 Q3 IQR superior inferior limite extremos',
      },
      {
        id: 'distribuicao',
        title: 'Distribuição e assimetria',
        description: 'Histograma, KDE, fórmula e classificação.',
        keywords: 'skewness Fisher Pearson densidade simetria cauda',
      },
      {
        id: 'leitura',
        title: 'Leitura dos resultados',
        description: 'Nossa interpretação das medidas e da variação entre os jogos.',
        keywords: 'interpretação crítica robustez sensibilidade',
      },
    ],
  },
  {
    id: 'comparison',
    title: 'Comparação',
    path: '/comparar',
    scope: 'Comparamos os times por variável, período, mando e resultado.',
    sections: [
      {
        id: 'comparacao',
        title: 'Barras e medidas',
        description: 'Dois times na mesma unidade e seleção.',
        keywords: 'média mediana desvio CV IQR z-score barras',
      },
      {
        id: 'boxplots-comparacao',
        title: 'Boxplots na mesma escala',
        description: 'Distribuições e partidas atípicas dos dois times.',
        keywords: 'outliers quartis cercas',
      },
      {
        id: 'regularidade',
        title: 'Dispersão nas sete variáveis',
        description: 'Quadros CV e IQR, quartis e comparação de regularidade.',
        keywords: 'coeficiente variação Q1 Q3 amplitude desvio mediana homogêneo',
      },
      {
        id: 'leituras-comparacao',
        title: 'Interpretação comparativa',
        description: 'Leituras dos dois times na seleção atual.',
        keywords: 'síntese crítica assimetria robustez',
      },
    ],
  },
  {
    id: 'anomalies',
    title: 'Fora da curva',
    path: '/fora-da-curva',
    scope: 'Aplicamos os métodos ao conjunto completo de jogos de cada time.',
    sections: [
      {
        id: 'detector',
        title: 'Resultados do detector',
        description: 'Partidas identificadas, critérios e parâmetros utilizados.',
        keywords: 'outliers anomalias Z-score IQR Grubbs ECOD k-NN LOF DBSCAN ruído',
      },
      {
        id: 'inventario',
        title: 'Inventário dos métodos',
        description: 'Contagens das análises por método e variável.',
        keywords: 'outliers quantidade univariado multivariado',
      },
    ],
  },
  {
    id: 'guide',
    title: 'Guia do projeto',
    path: '/guia',
    scope: 'Apresentamos a organização do nosso trabalho.',
    sections: [
      {
        id: 'enunciado',
        title: 'Por item do enunciado',
        description: 'Os assuntos do projeto e as seções em que os discutimos.',
        keywords: 'requisitos professor avaliação',
      },
      {
        id: 'consultas',
        title: 'Consultas prontas',
        description: 'Atalhos para alguns resultados e métodos do trabalho.',
        keywords: 'atalhos perguntas',
      },
      {
        id: 'mapa',
        title: 'Mapa do site',
        description: 'Páginas e seções do relatório.',
        keywords: 'índice navegação',
      },
      {
        id: 'roteiro',
        title: 'Roteiro de apresentação',
        description: 'Percurso da base à síntese.',
        keywords: 'professor apresentação',
      },
    ],
  },
]

export function pageForPath(path: string) {
  return reportPages.find((page) =>
    page.id === 'profile'
      ? path.startsWith('/times/')
      : page.path === (path.replace(/\/+$/, '') || '/'),
  )
}

export function sectionHref(path: string, section: string, search = '', hash = '') {
  const params = reportHashParams(hash)
  if (path.startsWith('/times/') || path === '/fora-da-curva' || hash.includes('=')) {
    // Fragmentos antigos de seleção continuam válidos; uma âncora simples não vira parâmetro.
    if (hash && !hash.includes('=')) params.delete(hash.replace(/^#/, ''))
    params.set('secao', section)
    return `${path}${search}#${params.toString()}`
  }
  return `${path}${search}#${section}`
}

export function reportHashParams(hash: string) {
  const fragment = hash.replace(/^#/, '')
  if (!fragment || fragment.includes('=')) return new URLSearchParams(fragment)
  try {
    return new URLSearchParams({ secao: decodeURIComponent(fragment) })
  } catch {
    return new URLSearchParams()
  }
}

export function sectionIdFromHash(hash: string) {
  return reportHashParams(hash).get('secao')
}

export function profileHref(team: string, metric: Metric, section: string) {
  return sectionHref(`/times/${team}`, section, '', `#variavel=${metric}`)
}

const data = (section: string): Destination => ({
  label: 'Dados e procedimentos',
  href: `/dados#${section}`,
})
const comparison = (section = 'regularidade'): Destination => ({
  label: 'Quadros e comparação',
  href: `/comparar#${section}`,
})
const profiles = (section: string): Destination[] =>
  teams.map((team) => ({
    label: `${team.city}: ${section === 'leitura' ? 'interpretação' : 'resultados'}`,
    href: profileHref(team.id, 'PTS', section),
  }))
const detector: Destination = {
  label: 'Resultados dos métodos',
  href: '/fora-da-curva#metodo=iqr&secao=detector',
}

export const requirements: {
  id: string
  title: string
  pdf: string
  description: string
  destinations: Destination[]
  note?: string
}[] = [
  {
    id: 'R01',
    title: 'Sistema Python e escolha do framework',
    pdf: '1',
    description:
      'Utilizamos Python na análise e no backend, com FastAPI e React para apresentar os resultados.',
    destinations: [data('metodos')],
  },
  {
    id: 'R02',
    title: 'Resultados e interpretação textual',
    pdf: '1',
    description:
      'Apresentamos os resultados em tabelas e gráficos, acompanhados da nossa interpretação.',
    destinations: [{ label: 'Síntese', href: '/#sintese' }, ...profiles('leitura')],
  },
  {
    id: 'R03',
    title: 'Navegação e seleção de time e variável',
    pdf: '1',
    description:
      'Organizamos a consulta por time e variável. Na comparação, também é possível filtrar os jogos.',
    destinations: [...profiles('medidas'), comparison('comparacao')],
  },
  {
    id: 'R04',
    title: 'Títulos, eixos, unidades, legendas e tabelas',
    pdf: '1',
    description:
      'Indicamos os títulos, as unidades e os elementos dos gráficos, usando a mesma formatação nas tabelas.',
    destinations: [...profiles('boxplot'), comparison('comparacao')],
  },
  {
    id: 'R05',
    title: 'Hospedagem e execução local',
    pdf: '1',
    description:
      'Reunimos o relatório neste sistema web e documentamos a execução local no README.',
    destinations: [{ label: 'Sobre acesso e entrega', href: '/guia#entrega' }],
  },
  {
    id: 'R06',
    title: 'Entrega do código e link no Classroom',
    pdf: '2',
    description: 'O código e as instruções de execução estão no repositório do projeto.',
    destinations: [{ label: 'Informações de entrega', href: '/guia#entrega' }],
    note: 'A entrega da disciplina reúne o código-fonte e o endereço da aplicação no Classroom.',
  },
  {
    id: 'R07',
    title: 'Dimensões e significado de cada coluna',
    pdf: '2',
    description:
      'Consideramos cada linha como um time em uma partida. No dicionário, explicamos o significado das 28 colunas.',
    destinations: [data('base'), { label: 'Dicionário completo', href: '/dados#dicionario' }],
  },
  {
    id: 'R08',
    title: 'Tipos, tamanho da base e datas',
    pdf: '2',
    description:
      'Descrevemos o tamanho do arquivo, os tipos das colunas e o tratamento que aplicamos às datas.',
    destinations: [data('base'), { label: 'Tipos e conversões', href: '/dados#dicionario' }],
  },
  {
    id: 'R09',
    title: 'Nomes intuitivos e conversões',
    pdf: '2',
    description:
      'Renomeamos as colunas e explicamos as conversões, incluindo W, L e o resultado WL.',
    destinations: [data('dicionario')],
  },
  {
    id: 'R10',
    title: 'Seleção e exclusão de campos',
    pdf: '2',
    description:
      'Escolhemos as sete variáveis pedidas para a análise e mantivemos os demais campos para identificação e contexto.',
    destinations: [data('dicionario'), { label: 'Métodos e limites', href: '/dados#metodos' }],
  },
  {
    id: 'R11',
    title: 'Zeros, negativos, duplicatas e domínio',
    pdf: '2',
    description:
      'Verificamos zeros, negativos, duplicatas, valores fora do domínio e relações entre as estatísticas das partidas.',
    destinations: [data('qualidade')],
  },
  {
    id: 'R12',
    title: 'Ausências e mecanismos MCAR, MAR e MNAR',
    pdf: '2',
    description:
      'Contamos os valores ausentes em cada coluna e discutimos os mecanismos MCAR, MAR e MNAR.',
    destinations: [
      data('qualidade'),
      { label: 'Mecanismos de ausência', href: '/dados#ausencias' },
    ],
  },
  {
    id: 'R13',
    title: 'Testes dos mecanismos de ausência',
    pdf: '2',
    description:
      'Estudamos os testes de Little, Jamshidian–Jalal, Listing–Schlittgen e a regressão de Fairclough, explicando quando se aplicam.',
    destinations: [data('ausencias')],
    note: 'Como não encontramos células ausentes neste arquivo, não aplicamos esses testes nem calculamos p-valores.',
  },
  {
    id: 'R14',
    title: 'Inconsistências e outliers por coluna',
    pdf: '3',
    description:
      'Verificamos a consistência das 28 colunas e analisamos os outliers das sete variáveis principais.',
    destinations: [
      data('qualidade'),
      { label: 'Inventário de anomalias', href: '/fora-da-curva#inventario' },
    ],
    note: 'Aplicamos os detectores às sete variáveis: PTS, REB, AST, STL, BLK, PF e FG3M. As demais colunas numéricas ficaram fora dessa etapa de detecção.',
  },
  {
    id: 'R15',
    title: 'Métodos de detecção de outliers',
    pdf: '3',
    description:
      'Aplicamos Z-score, IQR, Grubbs, ECOD, k-NN, DBSCAN e LOF e explicamos os critérios de cada método.',
    destinations: [data('metodos'), detector],
  },
  {
    id: 'R16',
    title: 'Medidas descritivas por variável e time',
    pdf: '3',
    description:
      'Calculamos média, mediana, moda, extremos, amplitude, desvio, variância e quartis para cada variável dos dois times.',
    destinations: profiles('medidas'),
  },
  {
    id: 'R17',
    title: 'Boxplot com todos os elementos',
    pdf: '3',
    description:
      'Construímos os boxplots com quartis, média, mediana, modas, limites e identificação das partidas atípicas.',
    destinations: [...profiles('boxplot'), comparison('boxplots-comparacao')],
  },
  {
    id: 'R18',
    title: 'Barras comparativas e papel do z-score',
    pdf: '3',
    description:
      'Comparamos os times em gráficos de barras e discutimos como o z-score pode ser usado na padronização.',
    destinations: [
      comparison('comparacao'),
      { label: 'Discussão do z-score', href: '/comparar#zscore' },
    ],
  },
  {
    id: 'R19',
    title: 'Assimetria, histograma e KDE',
    pdf: '3–4',
    description:
      'Usamos o coeficiente ajustado de Fisher–Pearson e examinamos a direção e a intensidade da assimetria com os histogramas e boxplots.',
    destinations: [...profiles('distribuicao'), ...profiles('leitura'), comparison()],
  },
  {
    id: 'R20',
    title: 'CV: cálculo, validade e quadro por time',
    pdf: '4–5',
    description:
      'Calculamos o CV com desvio amostral e comparamos a dispersão relativa das variáveis, com atenção às médias pequenas de BLK e STL.',
    destinations: [comparison('cv'), ...profiles('leitura')],
  },
  {
    id: 'R21',
    title: 'CV, regularidade e alternativas robustas',
    pdf: '4–5',
    description:
      'Interpretamos o CV junto com o desvio, a assimetria e a razão IQR/mediana para discutir a regularidade de cada time.',
    destinations: [comparison(), comparison('leituras-comparacao')],
  },
  {
    id: 'R22',
    title: 'IQR, quartis e quadro por time',
    pdf: '5',
    description:
      'Calculamos o IQR a partir de Q1 e Q3, usando interpolação linear, e comparamos a faixa central dos dois times.',
    destinations: [comparison('iqr'), { label: 'Tabela de quartis', href: '/comparar#quartis' }],
  },
  {
    id: 'R23',
    title: 'IQR, extremos e regra dos outliers',
    pdf: '5',
    description:
      'Comparamos o IQR com a amplitude e o desvio e conferimos os outliers pela regra de 1,5 × IQR.',
    destinations: [...profiles('boxplot'), ...profiles('leitura'), detector],
  },
  {
    id: 'R24',
    title: 'Síntese interpretativa',
    pdf: '1 e desenvolvimento',
    description:
      'Reunimos nossas principais observações sobre Atlanta e Houston, considerando as médias e a variação entre os jogos.',
    destinations: [
      { label: 'Síntese da seleção', href: '/#sintese' },
      comparison('leituras-comparacao'),
    ],
  },
]

export const readyQueries: (Destination & { description: string; keywords: string })[] = [
  {
    label: 'Tipos, nomes e exclusões das colunas',
    href: '/dados#dicionario',
    description: 'Consultar o dicionário e as conversões.',
    keywords: 'datas renomeação W L WL',
  },
  {
    label: 'Como foram tratadas as ausências?',
    href: '/dados#ausencias',
    description: 'MCAR, MAR, MNAR e aplicabilidade dos quatro testes.',
    keywords: 'missing Little Jamshidian Jalal Listing Schlittgen Fairclough',
  },
  {
    label: 'Outliers de pontos de Atlanta',
    href: profileHref(teams[0].id, 'PTS', 'boxplot'),
    description: 'Boxplot, limites e partidas identificadas.',
    keywords: 'PTS Hawks extremos anomalias',
  },
  {
    label: 'Distribuição de tocos de Houston',
    href: profileHref(teams[1].id, 'BLK', 'distribuicao'),
    description: 'Histograma, KDE e assimetria de BLK.',
    keywords: 'BLK Rockets densidade',
  },
  {
    label: 'Comparar o CV nas sete variáveis',
    href: '/comparar#cv',
    description: 'Quadro dos dois times e leitura da dispersão relativa.',
    keywords: 'coeficiente variação regularidade',
  },
  {
    label: 'Conferir Q1, Q3 e IQR',
    href: '/comparar#quartis',
    description: 'Quartis dos 14 pares variável/time.',
    keywords: 'intervalo interquartil',
  },
  {
    label: 'Grubbs para pontos de Houston',
    href: '/fora-da-curva#time=1610612745&metodo=grubbs&variavel=PTS&secao=detector',
    description: 'Estatística, valor crítico e candidatos.',
    keywords: 'teste Rockets outliers',
  },
  {
    label: 'Comparar contagens dos detectores',
    href: '/fora-da-curva#inventario',
    description: 'Inventário univariado e multivariado por time.',
    keywords: 'ECOD knn LOF DBSCAN zscore anomalias',
  },
]

export const presentationRoute: Destination[] = [
  { label: '1. Base e cobertura', href: '/dados#base' },
  { label: '2. Qualidade e ausências', href: '/dados#qualidade' },
  { label: '3. Medidas descritivas', href: profileHref(teams[0].id, 'PTS', 'medidas') },
  { label: '4. Distribuições', href: profileHref(teams[0].id, 'PTS', 'distribuicao') },
  { label: '5. Comparação', href: '/comparar#regularidade' },
  { label: '6. Anomalias', href: '/fora-da-curva#inventario' },
  { label: '7. Síntese', href: '/#sintese' },
]

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
export type SearchEntry = Destination & { description: string; category: string; keywords: string }
export const searchEntries: SearchEntry[] = [
  ...reportPages.flatMap((page) =>
    page.sections.map((section) => ({
      label: section.title,
      href: sectionHref(page.path, section.id),
      description: section.description,
      category: page.title,
      keywords: `${page.title} ${section.keywords}`,
    })),
  ),
  ...requirements.map((item) => ({
    label: `${Number(item.id.slice(1))}. ${item.title}`,
    href: `/guia#${item.id}`,
    description: item.description,
    category: `Enunciado · p. ${item.pdf}`,
    keywords: item.id,
  })),
  ...readyQueries.map((query) => ({ ...query, category: 'Consulta pronta' })),
  ...teams.flatMap((team) =>
    (Object.entries(metricLabels) as [Metric, string][]).map(([metric, label]) => ({
      label: `${team.city} · ${label} (${metric})`,
      href: profileHref(team.id, metric, 'medidas'),
      description: 'Medidas, boxplot, histograma e interpretação no histórico completo.',
      category: 'Time e variável',
      keywords: `${team.name} ${team.short} ${metric} ${label} boxplot histograma outliers`,
    })),
  ),
]

export function searchReport(query: string) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  if (!terms.length) return []
  return searchEntries
    .filter((entry) => {
      const searchable = normalizeSearch(
        `${entry.label} ${entry.description} ${entry.keywords} ${entry.category}`,
      )
      return terms.every((term) => searchable.includes(term))
    })
    .sort(
      (a, b) =>
        Number(normalizeSearch(b.label).includes(normalizeSearch(query))) -
        Number(normalizeSearch(a.label).includes(normalizeSearch(query))),
    )
}
