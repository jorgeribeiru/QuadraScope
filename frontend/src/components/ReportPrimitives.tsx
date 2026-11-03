import type { components } from '@/generated/api'
import { formatMeasure, metricLabels, formatDate } from '@/lib/format'
import type { Metric } from '@/lib/filters'
import { SectionActions } from './ReportNavigation'
export type Description = components['schemas']['Description']
export type Measure = components['schemas']['Measure']
export function Value({ measure }: { measure: Measure }) {
  return (
    <span title={measure.reason || measure.unit}>
      {formatMeasure(measure)}
      {measure.reason && <small className="measure-state">{measure.reason}</small>}
    </span>
  )
}
export function ReportSection({
  id,
  title,
  requirements,
  children,
}: {
  id: string
  title: string
  requirements: string
  children: React.ReactNode
}) {
  return (
    <section
      className="panel report-section"
      id={id}
      aria-labelledby={`${id}-title`}
      data-requirements={requirements}
    >
      <div className="panel-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        {!/^R\d/.test(requirements) && <span className="tag">{requirements}</span>}
      </div>
      {children}
      <SectionActions id={id} />
    </section>
  )
}
export function MetricSelect({
  metric,
  onChange,
}: {
  metric: Metric
  onChange: (value: Metric) => void
}) {
  return (
    <label className="report-control">
      Variável do perfil
      <select value={metric} onChange={(e) => onChange(e.target.value as Metric)}>
        {Object.entries(metricLabels).map(([code, name]) => (
          <option value={code} key={code}>
            {code} · {name}
          </option>
        ))}
      </select>
    </label>
  )
}
export function Period({ period }: { period: Description['period'] }) {
  return (
    <span>
      {period ? `${formatDate(period.from)} a ${formatDate(period.to)}` : 'Sem período observado'}
    </span>
  )
}
