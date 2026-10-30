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
    return `Médias observadas iguais: ${show(a.value)} ${a.unit}. Isso não demonstra equivalência das distribuições.`
  const higher = a.value > b.value ? 'Atlanta' : 'Houston'
  return `${higher} apresenta a maior média observada: Atlanta ${show(a.value)} e Houston ${show(b.value)} ${a.unit}. São ${pair[0]!.n} e ${pair[1]!.n} jogos, respectivamente; a diferença é descritiva, sem teste de superioridade.`
}
