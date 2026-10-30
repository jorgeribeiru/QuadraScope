import createClient from 'openapi-fetch'
import type { components, paths } from '@/generated/api'
import type { Filters, Metric } from './filters'
export type Meta = components['schemas']['MetaResponse']
export type Method = components['schemas']['Anomaly']['method']
export type Context = components['schemas']['Context']
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL || window.location.origin,
})
async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  try {
    const { data, error, response } = await call
    if (!response.ok || data === undefined) {
      const detail = error as components['schemas']['ErrorResponse'] | undefined
      throw new ApiError(
        detail?.error?.message || 'Não foi possível consultar os dados.',
        response.status,
        detail?.error?.code || 'http_error',
      )
    }
    return data
  } catch (error) {
    if (error instanceof ApiError || (error instanceof Error && error.name === 'AbortError'))
      throw error
    throw new ApiError(
      'Não foi possível conectar à API. Verifique a conexão e tente novamente.',
      0,
      'network_error',
    )
  }
}
export const api = {
  meta: (signal?: AbortSignal) => unwrap(client.GET('/api/v1/meta', { signal })),
  summary: (team: string, filters: Filters, signal?: AbortSignal) =>
    unwrap(
      client.GET('/api/v1/teams/{team_id}/summary', {
        params: { path: { team_id: team }, query: filters },
        signal,
      }),
    ),
  comparisons: (filters: Filters, metric: Metric, signal?: AbortSignal) =>
    unwrap(
      client.GET('/api/v1/comparisons', { params: { query: { ...filters, metric } }, signal }),
    ),
  anomalies: (
    team: string,
    filters: Filters,
    signal?: AbortSignal,
    method: Method = 'lof',
    metric?: Metric,
  ) =>
    unwrap(
      client.GET('/api/v1/anomalies', {
        params: { query: { ...filters, team_id: team, method, ...(metric ? { metric } : {}) } },
        signal,
      }),
    ),
  distribution: (team: string, metric: Metric, filters: Filters, signal?: AbortSignal) =>
    unwrap(
      client.GET('/api/v1/distributions', {
        params: { query: { ...filters, team_id: team, metric } },
        signal,
      }),
    ),
  interpretations: (
    context: 'overview' | 'teams' | 'comparisons',
    filters: Filters,
    team?: string,
    metric?: Metric,
    signal?: AbortSignal,
  ) =>
    unwrap(
      client.GET('/api/v1/interpretations', {
        params: {
          query: {
            context,
            ...filters,
            ...(team ? { team_id: team } : {}),
            ...(metric ? { metric } : {}),
          },
        },
        signal,
      }),
    ),
  documentation: (signal?: AbortSignal) =>
    unwrap(
      client.GET('/api/v1/interpretations', {
        params: { query: { context: 'methodology' } },
        signal,
      }),
    ),
  dictionary: (signal?: AbortSignal) => unwrap(client.GET('/api/v1/dictionary', { signal })),
  quality: (signal?: AbortSignal) => unwrap(client.GET('/api/v1/quality', { signal })),
}
