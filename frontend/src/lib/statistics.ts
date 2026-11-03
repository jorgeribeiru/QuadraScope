import type { components } from '@/generated/api'
type Description = components['schemas']['Description']
export const statisticLabels: Record<keyof Description['statistics'], string> = {
  mean: 'Média',
  median: 'Mediana',
  modes: 'Moda(s)',
  minimum: 'Mínimo',
  maximum: 'Máximo',
  range: 'Amplitude',
  variance: 'Variância amostral',
  std: 'Desvio padrão amostral',
  q1: 'Q1',
  q3: 'Q3',
  iqr: 'IQR',
  cv: 'CV (%)',
  iqr_median_ratio: 'IQR/mediana',
  skewness: 'Assimetria ajustada',
}
export const comparisonMeasures = ['mean', 'median', 'std', 'cv', 'iqr'] as const
export type ComparisonMeasure = (typeof comparisonMeasures)[number]
export function measureContrast(
  rows: components['schemas']['SummaryRow'][],
  metric: Description['metric'],
  measure: ComparisonMeasure,
) {
  if (measure === 'mean') return meanContrast(rows, metric)
  const pair = ['1610612737', '1610612745'].map((id) =>
    rows.find((row) => row.team_id === id && row.metric === metric),
  )
  const a = pair[0]?.statistics[measure],
    b = pair[1]?.statistics[measure]
  if (!a || !b || typeof a.value !== 'number' || typeof b.value !== 'number')
    return 'Medida indisponível em um dos times nesta seleção. Consulte os motivos e as quantidades de jogos na tabela.'
  const show = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const values = `${statisticLabels[measure]}: Atlanta ${show(a.value)} e Houston ${show(b.value)} ${a.unit}.`
  const meaning =
    measure === 'median'
      ? 'A mediana representa o centro ordenado das observações.'
      : measure === 'cv'
        ? 'Menor CV significa menor dispersão relativa à média nesta variável.'
        : measure === 'iqr'
          ? 'Menor IQR significa uma faixa central de 50% dos jogos mais estreita nesta variável.'
          : 'Menor desvio significa menor dispersão absoluta em torno da média nesta variável.'
  return `${values} ${meaning} Nesta comparação, consideramos ${pair[0]!.n} jogos de Atlanta e ${pair[1]!.n} de Houston.`
}
export function meanContrast(
  rows: components['schemas']['SummaryRow'][],
  metric: Description['metric'],
) {
  const pair = ['1610612737', '1610612745'].map((id) =>
    rows.find((r) => r.team_id === id && r.metric === metric),
  )
  const a = pair[0]?.statistics.mean,
    b = pair[1]?.statistics.mean
  if (!a || !b || typeof a.value !== 'number' || typeof b.value !== 'number')
    return 'Sem observações dos dois times para comparar as médias nesta seleção.'
  const show = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (a.value === b.value)
    return `Encontramos a mesma média nos dois times: ${show(a.value)} ${a.unit}. A distribuição dos valores pode variar, como mostramos nos boxplots.`
  const higher = a.value > b.value ? 'Atlanta' : 'Houston'
  return `Neste recorte, encontramos a maior média em ${higher}: Atlanta ${show(a.value)} e Houston ${show(b.value)} ${a.unit}. Consideramos ${pair[0]!.n} e ${pair[1]!.n} jogos, respectivamente.`
}
