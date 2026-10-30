import { ReadableParagraph } from '@/components/ReadableParagraph'
import type { components } from '@/generated/api'
import { decimal, formatDate } from '@/lib/format'
import { DataTable } from './DataTable'
import { Warning } from './States'
import type { Description } from './ReportPrimitives'
const W = 800,
  H = 300,
  left = 65,
  right = 770
export function BoxplotChart({
  description,
  domain,
}: {
  description: Description
  domain?: [number, number]
}) {
  const b = description.boxplot
  if (
    b.n === 0 ||
    b.q1 === null ||
    b.q3 === null ||
    b.median === null ||
    b.lower_whisker === null ||
    b.upper_whisker === null ||
    b.lower_fence === null ||
    b.upper_fence === null
  )
    return <Warning>Sem observações para construir o boxplot.</Warning>
  const raw = [
    b.lower_fence,
    b.upper_fence,
    b.lower_whisker,
    b.upper_whisker,
    ...b.outliers.map((p) => p.value),
  ]
  const lo = domain?.[0] ?? Math.min(...raw),
    hi = domain?.[1] ?? Math.max(...raw),
    span = hi - lo || 2
  const min = lo - span * 0.07,
    max = hi + span * 0.07
  const x = (v: number) => left + ((v - min) / (max - min)) * (right - left)
  const tick = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5)
  return (
    <figure
      className="scientific-chart"
      tabIndex={0}
      aria-label="Gráfico científico com rolagem horizontal"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Boxplot ${description.metric}: Q1 ${decimal(b.q1)}, mediana ${decimal(b.median)}, Q3 ${decimal(b.q3)}, ${b.outlier_count} partidas atípicas. Valores e partidas nas tabelas abaixo.`}
      >
        {tick.map((v) => (
          <g key={v}>
            <line x1={x(v)} y1="35" x2={x(v)} y2="230" stroke="#e1e5db" />
            <text x={x(v)} y="255" textAnchor="middle">
              {decimal(v)}
            </text>
          </g>
        ))}
        <line
          x1={x(b.lower_whisker)}
          x2={x(b.upper_whisker)}
          y1="80"
          y2="80"
          stroke="#2f4934"
          strokeWidth="2"
        />
        {[b.lower_whisker, b.upper_whisker].map((v, i) => (
          <line key={i} x1={x(v)} x2={x(v)} y1="60" y2="100" stroke="#2f4934" strokeWidth="2" />
        ))}
        <rect
          x={x(b.q1)}
          y="50"
          width={Math.max(1, x(b.q3) - x(b.q1))}
          height="60"
          fill="#d4e3bc"
          stroke="#2f4934"
        >
          <title>
            Q1 {decimal(b.q1)}; Q3 {decimal(b.q3)}
          </title>
        </rect>
        <line x1={x(b.median)} x2={x(b.median)} y1="50" y2="110" stroke="#182d20" strokeWidth="3">
          <title>Mediana {decimal(b.median)}</title>
        </line>
        {[b.lower_fence, b.upper_fence].map((v, i) => (
          <line key={i} x1={x(v)} x2={x(v)} y1="30" y2="215" stroke="#927329" strokeDasharray="5 5">
            <title>
              Cerca {i === 0 ? 'inferior' : 'superior'} {decimal(v)}
            </title>
          </line>
        ))}
        {b.mean !== null && (
          <path d={`M ${x(b.mean)} 125 l 6 7 l -6 7 l -6 -7 Z`} fill="#b64a3d">
            <title>Média {decimal(b.mean)}</title>
          </path>
        )}
        {b.modes.map((v) => (
          <circle key={v} cx={x(v)} cy="160" r="5" fill="#655598">
            <title>
              Moda {decimal(v)}, frequência {b.mode_frequency}
            </title>
          </circle>
        ))}
        {b.outliers.map((p, i) => (
          <circle
            key={p.game_id}
            cx={x(p.value)}
            cy={190 + (i % 3) * 9}
            r="4"
            fill="#b64a3d"
            tabIndex={0}
            role="img"
            aria-label={`${p.matchup}, ${formatDate(p.game_date)}, partida ${p.game_id}: ${decimal(p.value)}`}
          >
            <title>
              {p.matchup} · {formatDate(p.game_date)} · ID {p.game_id}: {decimal(p.value)}
            </title>
          </circle>
        ))}
        <text x="15" y="85">
          Caixa
        </text>
        <text x="15" y="135">
          Média
        </text>
        <text x="15" y="164">
          Modas
        </text>
        <text x="15" y="204">
          Atípicas
        </text>
        <text x="420" y="284" textAnchor="middle">
          {description.unit} · eixo horizontal contínuo
        </text>
      </svg>
      <figcaption>
        Caixa: Q1–Q3; traço interno: mediana; bigodes: observações extremas dentro das cercas;
        linhas tracejadas: cercas teóricas; losango vermelho: média; círculos roxos: todas as modas
        repetidas. Marcadores ficam em faixas separadas para mostrar medidas coincidentes. A posição
        vertical dos pontos atípicos apenas separa sobreposições.
      </figcaption>
    </figure>
  )
}
export function DistributionChart({
  team,
  unit,
}: {
  team: components['schemas']['DistributionTeam']
  unit: string
}) {
  const { histogram: h, kde } = team
  if (!h.n || !h.edges.length) return <Warning>Sem observações para a distribuição.</Warning>
  const min = Math.min(h.edges[0], ...kde.x),
    max = Math.max(h.edges[h.edges.length - 1], ...kde.x)
  const ymax = Math.max(...h.density, ...kde.density, 0.001) * 1.1
  const x = (v: number) => left + ((v - min) / (max - min || 1)) * (right - left)
  const y = (v: number) => 235 - (v / ymax) * 190
  const bins = h.counts.map((count, i) => ({
    index: i,
    from: h.edges[i],
    to: h.edges[i + 1],
    count,
    density: h.density[i],
  }))
  return (
    <>
      <figure
        className="scientific-chart"
        tabIndex={0}
        aria-label="Gráfico científico com rolagem horizontal"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Histograma em densidade e KDE de ${h.n} jogos. Contagens por intervalo e coordenadas da KDE disponíveis nas tabelas.`}
        >
          {Array.from({ length: 5 }, (_, i) => (ymax * i) / 4).map((v) => (
            <g key={v}>
              <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#e1e5db" />
              <text x="58" y={y(v) + 4} textAnchor="end">
                {v.toLocaleString('pt-BR', { maximumSignificantDigits: 3 })}
              </text>
            </g>
          ))}
          {bins.map((b) => (
            <rect
              key={b.index}
              x={x(b.from)}
              y={y(b.density)}
              width={Math.max(0.5, x(b.to) - x(b.from))}
              height={235 - y(b.density)}
              fill="#b8cc9a"
              stroke="#4c6833"
              strokeWidth={1.5}
            >
              <title>
                {decimal(b.from)} a {decimal(b.to)}: {b.count} jogos; densidade{' '}
                {b.density.toLocaleString('pt-BR', { maximumSignificantDigits: 4 })}
              </title>
            </rect>
          ))}
          {kde.status === 'ok' && (
            <path
              d={kde.x
                .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(v)} ${y(kde.density[i])}`)
                .join(' ')}
              fill="none"
              stroke="#b64a3d"
              strokeWidth="3"
            />
          )}
          {Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5).map((v) => (
            <text key={v} x={x(v)} y="257" textAnchor="middle">
              {decimal(v)}
            </text>
          ))}
          <text x="65" y="25">
            Densidade (1/({unit}))
          </text>
          <text x="420" y="284" textAnchor="middle">
            {unit} · verde: histograma; vermelho: KDE Scott
          </text>
        </svg>
        <figcaption>
          Classes e grade definidas pela API com referência comum aos dois times na mesma seleção.
          Altura é densidade, não quantidade de partidas. KDE é suavização de contagens discretas e
          pode se estender além do domínio; não indica probabilidade de uma contagem exata.
        </figcaption>
      </figure>
      {kde.status !== 'ok' && (
        <Warning>
          KDE indisponível: {kde.reason ?? kde.status}. O histograma continua apresentado.
        </Warning>
      )}
      <details>
        <summary>Dados do histograma e da KDE</summary>
        <DataTable
          data={bins}
          columns={[
            {
              id: 'interval',
              header: `Intervalo (${unit})`,
              cell: ({ row }) =>
                `[${decimal(row.original.from)}; ${decimal(row.original.to)}${row.original.index === bins.length - 1 ? ']' : ')'}`,
            },
            { accessorKey: 'count', header: 'Jogos' },
            {
              accessorKey: 'density',
              header: `Densidade (1/(${unit}))`,
              cell: ({ row }) =>
                row.original.density.toLocaleString('pt-BR', { maximumSignificantDigits: 6 }),
            },
          ]}
          caption="Histograma: intervalos fechados à esquerda, abertos à direita, último fechado nas duas pontas."
        />
        <ReadableParagraph>
          KDE: método Scott; fator{' '}
          {kde.bandwidth_factor === null ? 'indefinido' : decimal(kde.bandwidth_factor)}, largura{' '}
          {kde.bandwidth === null ? 'indefinida' : decimal(kde.bandwidth)} {unit}. Série com {kde.n}{' '}
          observações.
        </ReadableParagraph>
        <DataTable
          data={kde.x.map((value, i) => ({ value, density: kde.density[i] }))}
          columns={[
            { accessorKey: 'value', header: unit, cell: ({ row }) => decimal(row.original.value) },
            {
              accessorKey: 'density',
              header: `Densidade KDE (1/(${unit}))`,
              cell: ({ row }) =>
                row.original.density.toLocaleString('pt-BR', { maximumSignificantDigits: 6 }),
            },
          ]}
          caption="Coordenadas calculadas da curva KDE; não são observações adicionais."
        />
      </details>
    </>
  )
}
