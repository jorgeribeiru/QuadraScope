import type { components } from '@/generated/api'
import { teams, metricLabels, decimal } from '@/lib/format'
import { ReadableParagraph } from './ReadableParagraph'

type Row = components['schemas']['SummaryRow']
function extremes(rows: Row[], key: 'cv' | 'skewness') {
  const values = rows.flatMap((row) => {
    const value = row.statistics[key].value
    return typeof value === 'number'
      ? [{ metric: row.metric, value, magnitude: key === 'skewness' ? Math.abs(value) : value }]
      : []
  })
  if (!values.length) return null
  const min = Math.min(...values.map((v) => v.magnitude)),
    max = Math.max(...values.map((v) => v.magnitude))
  return {
    low: values.filter((v) => v.magnitude === min),
    high: values.filter((v) => v.magnitude === max),
  }
}
export function VariableHighlights({ rows }: { rows: Row[] }) {
  const summaries = teams.map((team) => ({
    team,
    cv: extremes(
      rows.filter((r) => r.team_id === team.id),
      'cv',
    ),
    skew: extremes(
      rows.filter((r) => r.team_id === team.id),
      'skewness',
    ),
  }))
  const show = (items: { metric: Row['metric']; value: number }[], unit: string) =>
    items
      .map((item) => `${item.metric} (${metricLabels[item.metric]}): ${decimal(item.value)}${unit}`)
      .join('; ')
  const patterns = summaries.map((s) =>
    s.skew?.high
      .map((v) => v.metric)
      .sort()
      .join(','),
  )
  return (
    <div id="destaques-variaveis">
      <h3>Destaques entre variáveis na seleção atual</h3>
      {summaries.map(({ team, cv, skew }) => (
        <article key={team.id}>
          <h4>{team.name}</h4>
          <ReadableParagraph>
            {cv
              ? `Ao comparar as variáveis deste time, encontramos maior dispersão relativa pelo CV em ${show(cv.high, '%')}. A menor dispersão relativa aparece em ${show(cv.low, '%')}.`
              : 'Sem CV válido para ordenar as variáveis deste time nesta seleção.'}
          </ReadableParagraph>
          <ReadableParagraph>
            {skew
              ? `Encontramos a maior assimetria em magnitude |G₁| em ${show(skew.high, '')}. Usamos o valor absoluto nessa comparação e mantivemos o sinal para indicar a direção da cauda.`
              : 'Sem coeficiente de assimetria válido para ordenar as variáveis deste time.'}
          </ReadableParagraph>
        </article>
      ))}
      {patterns.every(Boolean) && (
        <ReadableParagraph>
          {patterns[0] === patterns[1]
            ? 'As variáveis de maior |G₁| coincidem nos dois times nesta seleção.'
            : 'As variáveis de maior |G₁| não coincidem nos dois times nesta seleção; o padrão de caudas varia entre os históricos.'}
        </ReadableParagraph>
      )}
      <ReadableParagraph>
        Usamos o CV para comparar a dispersão relativa entre variáveis de escalas diferentes. Assim,
        conseguimos relacionar a variação dos pontos à dos tocos, por exemplo. Em BLK e STL,
        consideramos também as médias pequenas e o fato de serem contagens inteiras. Quando a
        assimetria é forte, olhamos a mediana e a razão IQR/mediana como medidas complementares.
      </ReadableParagraph>
    </div>
  )
}
