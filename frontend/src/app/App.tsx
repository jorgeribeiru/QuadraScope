import { useEffect } from 'react'
import { Route, Routes, Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { ErrorState, Loading, Warning } from '@/components/States'
import { parseSelection, supportsFilters } from '@/lib/filters'
import { discardPreviousReleases, metaOptions } from '@/lib/queries'
import { Anomalies, Comparison, DataPage, Overview, TeamProfile } from '@/features/Reports'

export function App() {
  const meta = useQuery(metaOptions)
  const client = useQueryClient()
  const [params] = useSearchParams()
  const location = useLocation()
  const filtersEnabled = supportsFilters(location.pathname)
  const selection = parseSelection(filtersEnabled ? params : new URLSearchParams())
  const release = meta.data?.context.release_id
  useEffect(() => {
    if (release) void discardPreviousReleases(client, release)
  }, [client, release])
  if (!filtersEnabled && location.search) {
    return <Navigate to={{ pathname: location.pathname, hash: location.hash }} replace />
  }
  return (
    <Layout>
      {selection.issues.length > 0 ? (
        <Warning>
          Revise os filtros acima para consultar os dados. Nenhum resultado foi calculado com esta
          seleção inválida.
        </Warning>
      ) : meta.isPending ? (
        <Loading label="Conectando à base validada…" />
      ) : meta.isError ? (
        <ErrorState error={meta.error} retry={() => void meta.refetch()} />
      ) : (
        <Routes>
          <Route path="/" element={<Overview meta={meta.data} selection={selection} />} />
          <Route
            path="/times/:teamId"
            element={<TeamProfile meta={meta.data} selection={selection} />}
          />
          <Route path="/comparar" element={<Comparison meta={meta.data} selection={selection} />} />
          <Route
            path="/fora-da-curva"
            element={<Anomalies meta={meta.data} selection={selection} />}
          />
          <Route path="/dados" element={<DataPage meta={meta.data} />} />
          <Route
            path="*"
            element={
              <div className="state-panel">
                <h2>Esta página não foi encontrada</h2>
                <Link to="/">Voltar à visão geral</Link>
              </div>
            }
          />
        </Routes>
      )}
    </Layout>
  )
}
