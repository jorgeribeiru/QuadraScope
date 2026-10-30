import { QueryClient, queryOptions } from '@tanstack/react-query'
import { api, ApiError, type Context, type Meta } from './api'
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: true },
    },
  })
}
export const metaOptions = queryOptions({
  queryKey: ['meta'],
  queryFn: ({ signal }) => api.meta(signal),
  staleTime: 0,
  refetchInterval: 60_000,
})
export function identity(meta: Meta) {
  const c = meta.context
  return {
    dataset: c.dataset_sha256,
    release: c.release_id,
    analysis: c.analysis_version,
    schema: c.schema_version,
    parameters: c.parameters,
    parameterVersion: c.parameter_version,
  }
}
export function analysisKey(meta: Meta, endpoint: string, params: unknown) {
  return ['analysis', identity(meta), endpoint, params] as const
}
export async function requireRelease<T extends { context: Context }>(
  promise: Promise<T>,
  meta: Meta,
  client: QueryClient,
): Promise<T> {
  const response = await promise
  if (response.context.release_id !== meta.context.release_id) {
    void client.invalidateQueries({ queryKey: ['meta'] })
    throw new ApiError(
      'Os dados foram atualizados. Aguarde a atualização e consulte novamente.',
      409,
      'dataset_changed',
    )
  }
  return response
}
export async function discardPreviousReleases(client: QueryClient, release: string) {
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === 'analysis' &&
      (query.queryKey[1] as { release?: string })?.release !== release,
  }
  await client.cancelQueries(filters)
  client.removeQueries(filters)
}
