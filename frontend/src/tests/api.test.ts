import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})
it('usa o contrato tipado, datas civis e sinal de cancelamento', async () => {
  const fetcher = vi.fn(async (request: Request) => {
    expect(request.method).toBe('GET')
    return new Response(JSON.stringify({ context: {}, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetcher)
  const { api } = await import('@/lib/api')
  const controller = new AbortController()
  await api.summary(
    '1610612737',
    { from: '2026-01-01', venue: 'home', outcome: 'all' },
    controller.signal,
  )
  const request = fetcher.mock.calls[0][0] as Request
  expect(request.url).toContain(
    '/api/v1/teams/1610612737/summary?from=2026-01-01&venue=home&outcome=all',
  )
  expect(request.signal.aborted).toBe(false)
})
it('preserva erro 503 em vez de convertê-lo em resultado vazio', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'artifacts_unavailable', message: 'Pacote inválido.', details: [] },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  )
  const { api } = await import('@/lib/api')
  await expect(api.meta()).rejects.toMatchObject({
    status: 503,
    code: 'artifacts_unavailable',
    message: 'Pacote inválido.',
  })
})
it('distingue falha de rede de uma seleção sem partidas', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
  const { api } = await import('@/lib/api')
  await expect(api.meta()).rejects.toMatchObject({ status: 0, code: 'network_error' })
})
