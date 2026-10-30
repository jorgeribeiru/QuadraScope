import { describe, expect, it } from 'vitest'
import { parseSelection, selectionParams } from '@/lib/filters'
import { formatDate, formatMeasure } from '@/lib/format'
import type { components } from '@/generated/api'

describe('seleções compartilháveis', () => {
  it('normaliza os padrões e mantém datas inclusivas sem fuso', () => {
    const selected = parseSelection(
      new URLSearchParams('from=2026-01-01&to=2026-01-31&venue=home&outcome=win&metric=REB'),
    )
    expect(selected.issues).toEqual([])
    expect(selectionParams(selected.filters, selected.metric).toString()).toBe(
      'from=2026-01-01&to=2026-01-31&venue=home&outcome=win&metric=REB',
    )
    expect(selectionParams(parseSelection(new URLSearchParams()).filters, 'PTS').toString()).toBe(
      '',
    )
  })
  it.each([
    'from=2026-02-30',
    'from=2026-01-01T00:00:00Z',
    'from=0000-01-01',
    'from=2026-02-01&to=2026-01-01',
    'venue=neutral',
    'metric=MIN',
    'outcome=draw',
    'venue=home&venue=away',
    'k=5',
  ])('rejeita uma URL inválida: %s', (query) => {
    expect(parseSelection(new URLSearchParams(query)).issues.length).toBeGreaterThan(0)
  })
  it('admite ano bissexto e mostra a data civil no Brasil', () => {
    expect(parseSelection(new URLSearchParams('from=2024-02-29')).issues).toEqual([])
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })
})

describe('apresentação de medidas', () => {
  const measure = (value: number | number[] | null, unit = 'pontos/jogo') =>
    ({ value, unit }) as components['schemas']['Measure']
  it('preserva zero e distingue resultado indefinido', () => {
    expect(formatMeasure(measure(0))).toBe('0,00')
    expect(formatMeasure(measure(null))).toBe('—')
    expect(formatMeasure(measure(12.3456, '%'))).toBe('12,35%')
  })
  it('preserva todas as modas e a convenção sem moda', () => {
    expect(formatMeasure(measure([3, 4]))).toBe('3,00 · 4,00')
    expect(formatMeasure(measure([]))).toBe('—')
  })
})
