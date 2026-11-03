import { ReadableParagraph } from '@/components/ReadableParagraph'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Meta } from '@/lib/api'
import { analysisKey, requireRelease } from '@/lib/queries'
import type { Filters, Metric } from '@/lib/filters'
import { decimal, metricLabels, teams } from '@/lib/format'
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
          <ReadableParagraph>
            A seguir, discutimos as medidas do time e da variável selecionados. Os números
            acompanham o conjunto de jogos mostrado nesta página.
          </ReadableParagraph>
          {data.interpretations.map((reading, i) => {
            const id = typeof reading.team_id === 'string' ? reading.team_id : ''
            const code = typeof reading.metric === 'string' ? (reading.metric as Metric) : 'PTS'
            const evidence =
              reading.evidence !== null &&
              typeof reading.evidence === 'object' &&
              !Array.isArray(reading.evidence)
                ? (reading.evidence as Record<string, unknown>)
                : {}
            const unit =
              meta.metrics.find((metric) => metric.original === code)?.unit ?? 'unidades/jogo'
            const value = (key: string) =>
              typeof evidence[key] === 'number' ? decimal(evidence[key]) : 'indefinido'
            const n = typeof reading.n === 'number' ? reading.n : null
            return (
              <article key={`${id}-${code}-${i}`}>
                <h3>
                  {teams.find((t) => t.id === id)?.name} · {metricLabels[code]}
                </h3>
                <div className="reading-grid">
                  <section>
                    <h4>O que observamos</h4>
                    <ReadableParagraph>
                      {n === 0
                        ? 'Não encontramos jogos para esta seleção. Precisamos ampliar os filtros para discutir o desempenho do time.'
                        : `Neste recorte, analisamos ${n ?? 'uma quantidade não informada de'} jogos. Encontramos média de ${value('mean')} e mediana de ${value('median')} ${unit}.`}
                    </ReadableParagraph>
                  </section>
                  <section>
                    <h4>Medidas deste recorte</h4>
                    <dl className="reading-evidence">
                      {[
                        ['Desvio amostral', 'std', unit],
                        ['CV', 'cv', '%'],
                        ['Q1', 'q1', unit],
                        ['Q3', 'q3', unit],
                        ['IQR', 'iqr', unit],
                        ['Assimetria ajustada', 'skewness', 'adimensional'],
                      ].map(([label, key, measureUnit]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>
                            {value(key)} <small>{measureUnit}</small>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section>
                    <h4>Como interpretamos</h4>
                    <ReadableParagraph>
                      {n !== null && n < 2
                        ? 'Com menos de dois jogos, não conseguimos calcular o desvio amostral ou o CV. Por isso, deixamos essas medidas como indefinidas.'
                        : 'Usamos a média e a mediana para descrever o valor típico por partida. Para discutir a regularidade, olhamos também o desvio, o CV e a faixa dos 50% centrais, representada pelo IQR. Assim, consideramos tanto o nível dos resultados quanto sua variação entre os jogos.'}
                    </ReadableParagraph>
                  </section>
                </div>
                <details className="complete-reading">
                  <summary>Discussão completa dos resultados</summary>
                  <ReadableParagraph>
                    {typeof reading.text === 'string' ? reading.text : 'Leitura indisponível.'}
                  </ReadableParagraph>
                </details>
              </article>
            )
          })}
        </div>
      )}
    </QueryBoundary>
  )
}
