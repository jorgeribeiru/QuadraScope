import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import type { Filters, Metric } from '@/lib/filters'
import { metricLabels, teams } from '@/lib/format'
import { QueryBoundary } from './QueryBoundary'
export function Interpretations({
  meta,
  context,
  filters,
  team,
  metric,
}: {
  meta: Meta
  context: 'overview' | 'teams' | 'comparisons'
  filters: Filters
  team?: string
  metric?: Metric
}) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: analysisKey(meta, 'interpretations', { context, ...filters, team, metric }),
    queryFn: ({ signal }) =>
      requireRelease(api.interpretations(context, filters, team, metric, signal), meta, client),
  })
  return (
    <QueryBoundary query={query}>
      {(data) => (
        <div className="interpretation-readings" aria-live="polite">
          <p>
            Escopo: seleção desta seção. As leituras são descritivas, vinculadas ao release e às
            medidas exibidas.
          </p>
          {data.interpretations.map((reading, i) => {
            const id = typeof reading.team_id === 'string' ? reading.team_id : ''
            const code = typeof reading.metric === 'string' ? (reading.metric as Metric) : 'PTS'
            return (
              <article key={`${id}-${code}-${i}`}>
                <h3>
                  {teams.find((t) => t.id === id)?.name} · {metricLabels[code]}
                </h3>
                <p>{typeof reading.text === 'string' ? reading.text : 'Leitura indisponível.'}</p>
              </article>
            )
          })}
        </div>
      )}
    </QueryBoundary>
  )
}
