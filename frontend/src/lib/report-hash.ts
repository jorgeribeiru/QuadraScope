import { useLocation, useNavigate } from 'react-router-dom'
import { reportHashParams } from './report-catalog'
export function useReportHash() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = reportHashParams(location.hash)
  return {
    read: <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
      const value = params.get(key)
      return allowed.includes(value as T) ? (value as T) : fallback
    },
    set: (key: string, value: string) => {
      params.set(key, value)
      void navigate({
        pathname: location.pathname,
        search: location.search,
        hash: params.toString(),
      })
    },
  }
}
