import type { components } from '@/generated/api'
type Measure = components['schemas']['Measure']
export const integer = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
export const decimal = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  )
export function formatMeasure(measure: Measure): string {
  if (measure.value === null) return '—'
  if (Array.isArray(measure.value))
    return measure.value.length ? measure.value.map(decimal).join(' · ') : '—'
  return decimal(measure.value) + (measure.unit === '%' ? '%' : '')
}
export function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}
export const teams = [
  {
    id: '1610612737',
    short: 'ATL',
    logo: '/teams/atlanta-hawks.svg',
    city: 'Atlanta',
    name: 'Atlanta Hawks',
    nickname: 'Hawks',
    className: 'atlanta',
  },
  {
    id: '1610612745',
    short: 'HOU',
    logo: '/teams/houston-rockets.svg',
    city: 'Houston',
    name: 'Houston Rockets',
    nickname: 'Rockets',
    className: 'houston',
  },
] as const
export const metricLabels = {
  PTS: 'Pontos',
  REB: 'Rebotes',
  AST: 'Assistências',
  STL: 'Roubos',
  BLK: 'Tocos',
  PF: 'Faltas',
  FG3M: 'Cestas de 3',
} as const
