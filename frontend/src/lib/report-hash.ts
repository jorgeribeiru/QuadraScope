import { useLocation, useNavigate } from 'react-router-dom'
export function useReportHash() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.hash.slice(1))
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
