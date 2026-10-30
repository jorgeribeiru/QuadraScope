import type { components } from '@/generated/api'
export type Metric = components['schemas']['Description']['metric']
export type Filters = {
  from?: string
  to?: string
  venue: 'all' | 'home' | 'away'
  outcome: 'all' | 'win' | 'loss'
}
export type Selection = { filters: Filters; metric: Metric; issues: string[] }
const metrics = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'FG3M']
function civilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const parsed = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}
export function parseSelection(params: URLSearchParams): Selection {
  const issues: string[] = []
  const read = (key: string) => params.get(key) ?? ''
  for (const key of new Set(params.keys())) {
    if (!['from', 'to', 'venue', 'outcome', 'metric'].includes(key))
      issues.push(`Parâmetro desconhecido: ${key}.`)
    if (params.getAll(key).length > 1) issues.push(`Parâmetro repetido: ${key}.`)
  }
  const from = read('from'),
    to = read('to'),
    venue = read('venue') || 'all',
    outcome = read('outcome') || 'all',
    metric = read('metric') || 'PTS'
  if (from && !civilDate(from)) issues.push('Data inicial inválida. Use YYYY-MM-DD.')
  if (to && !civilDate(to)) issues.push('Data final inválida. Use YYYY-MM-DD.')
  if (from && to && from > to) issues.push('A data inicial deve ser anterior ou igual à final.')
  if (!['all', 'home', 'away'].includes(venue)) issues.push('Mando inválido.')
  if (!['all', 'win', 'loss'].includes(outcome)) issues.push('Resultado inválido.')
  if (!metrics.includes(metric)) issues.push('Variável fora das sete métricas disponíveis.')
  return {
    filters: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      venue: venue as Filters['venue'],
      outcome: outcome as Filters['outcome'],
    },
    metric: metric as Metric,
    issues,
  }
}
export function selectionParams(filters: Filters, metric: Metric) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.venue !== 'all') params.set('venue', filters.venue)
  if (filters.outcome !== 'all') params.set('outcome', filters.outcome)
  if (metric !== 'PTS') params.set('metric', metric)
  return params
}

export function supportsFilters(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/' || path === '/comparar'
}
export function selectionHref(pathname: string, search: string): string {
  return pathname + (supportsFilters(pathname) ? search : '')
}
