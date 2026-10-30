import type { UseQueryResult } from '@tanstack/react-query'
import { ErrorState, Loading } from './States'

export function QueryBoundary<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, Error>
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  return children(query.data)
}
