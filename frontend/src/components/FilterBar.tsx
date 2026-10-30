import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { parseSelection, selectionParams, type Filters, type Metric } from '@/lib/filters'
import { metricLabels } from '@/lib/format'
import { Button } from './ui/button'

export function FilterBar() {
  const [params, setParams] = useSearchParams()
  const { filters, metric, issues } = parseSelection(params)
  function apply(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setParams(
      selectionParams(
        {
          from: String(data.get('from') || ''),
          to: String(data.get('to') || ''),
          venue: data.get('venue') as Filters['venue'],
          outcome: data.get('outcome') as Filters['outcome'],
        },
        data.get('metric') as Metric,
      ),
    )
  }
  return (
    <section className="filter-section" aria-label="Filtros da análise">
      <form key={params.toString()} onSubmit={apply} className="filter-bar">
        <div className="filter-icon">
          <SlidersHorizontal size={18} />
          <span>Seleção</span>
        </div>
        <label>
          De
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          Até
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Mando
          <select name="venue" defaultValue={filters.venue}>
            <option value="all">Casa e fora</option>
            <option value="home">Em casa</option>
            <option value="away">Fora de casa</option>
          </select>
        </label>
        <label>
          Resultado
          <select name="outcome" defaultValue={filters.outcome}>
            <option value="all">Todos</option>
            <option value="win">Vitórias</option>
            <option value="loss">Derrotas</option>
          </select>
        </label>
        <label>
          Variável
          <select name="metric" defaultValue={metric}>
            {Object.entries(metricLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {code} · {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="small">
          Aplicar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="small"
          aria-label="Limpar filtros"
          onClick={() => setParams(new URLSearchParams())}
        >
          <RotateCcw size={16} />
        </Button>
      </form>
      {issues.length > 0 && (
        <div role="alert" className="filter-error">
          {issues.join(' ')}
        </div>
      )}
    </section>
  )
}
