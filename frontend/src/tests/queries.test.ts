import { describe, expect, it } from 'vitest'
import type { Meta, Context } from '@/lib/api'
import {
  analysisKey,
  createQueryClient,
  discardPreviousReleases,
  requireRelease,
} from '@/lib/queries'
const meta = (release: string, analysis = '1.0.0', k = 10): Meta => ({
  source: {
    filename: 'fixture.csv',
    sha256: 'dataset',
    size_bytes: 0,
    row_count: 0,
    column_count: 28,
    encoding: 'UTF-8',
    delimiter: ',',
  },
  coverage: {},
  metrics: [],
  runtime_policy: {},
  context: {
    api_version: '1.0.0',
    release_id: release,
    dataset_sha256: 'dataset',
    schema_version: '1.0.0',
    analysis_version: analysis,
    parameter_version: '1.0.0',
    parameters: { neighbor_k: k },
    filters: { from: null, to: null, venue: 'all', outcome: 'all' },
    team_ids: [],
    metrics: [],
    n_by_team: {},
    reference_n_by_team: {},
    period_by_team: {},
    reference_scope: 'filtered_selection',
    status: 'ok',
    warnings: [],
    cache_key: 'fixture',
  },
})

describe('identidade do cache', () => {
  it('separa filtros, times, métodos, versões e parâmetros', () => {
    const baseline = analysisKey(meta('a'), 'summary', { team: 'ATL', venue: 'home' })
    expect(analysisKey(meta('a'), 'summary', { team: 'ATL', venue: 'home' })).toEqual(baseline)
    for (const key of [
      analysisKey(meta('b'), 'summary', { team: 'ATL', venue: 'home' }),
      analysisKey(meta('a', '2.0.0'), 'summary', {}),
      analysisKey(meta('a', '1.0.0', 5), 'summary', {}),
      analysisKey(meta('a'), 'summary', { team: 'HOU', venue: 'home' }),
      analysisKey(meta('a'), 'summary', { team: 'ATL', venue: 'away' }),
      analysisKey(meta('a'), 'anomalies', { method: 'lof' }),
    ])
      expect(key).not.toEqual(baseline)
  })
  it('remove resultados anteriores sem apagar o release atual ou metadados', async () => {
    const client = createQueryClient()
    const old = analysisKey(meta('old'), 'summary', {})
    const current = analysisKey(meta('new'), 'summary', {})
    client.setQueryData(old, 'old')
    client.setQueryData(current, 'new')
    client.setQueryData(['meta'], 'metadata')
    await discardPreviousReleases(client, 'new')
    expect(client.getQueryData(old)).toBeUndefined()
    expect(client.getQueryData(current)).toBe('new')
    expect(client.getQueryData(['meta'])).toBe('metadata')
    client.clear()
  })
  it('rejeita resposta de outro release e invalida metadados', async () => {
    const client = createQueryClient()
    client.setQueryData(['meta'], meta('old'))
    await expect(
      requireRelease(
        Promise.resolve({ context: { release_id: 'new' } as Context }),
        meta('old'),
        client,
      ),
    ).rejects.toMatchObject({ code: 'dataset_changed' })
    expect(client.getQueryState(['meta'])?.isInvalidated).toBe(true)
    client.clear()
  })
})
