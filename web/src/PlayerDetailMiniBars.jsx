import { miniBarTone } from './playerDetailDerivations.js'

/**
 * Inline-SVG bar chart for "last 5 GW" points. Port of `MiniBars` from
 * `web/src/Mockup.jsx` (~line 4240). The mockup uses a fixed `>= 6`
 * threshold for its sample MID; production swaps in a running-average
 * comparator (`miniBarTone`) so the chart still reads for low-scoring
 * positions.
 *
 * @param {{
 *   values: number[],
 *   max?: number,
 *   width?: number,
 *   height?: number,
 *   accent?: 'pos-neg' | 'brand',
 * }} props
 */
export function PlayerDetailMiniBars({
  values,
  max = 18,
  width = 460,
  height = 92,
  accent = 'pos-neg',
}) {
  const safe = Array.isArray(values) ? values.filter((v) => Number.isFinite(Number(v))) : []
  if (safe.length === 0) return null

  const n = safe.length
  const pad = 2
  const gap = 4
  const barW = (width - gap * (n - 1)) / n

  const total = safe.reduce((acc, v) => acc + Number(v), 0)
  const average = total / n

  const yAxisMax = Math.max(max, ...safe, 1)

  return (
    <svg
      className="pdetail-bars"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden
      preserveAspectRatio="none"
    >
      <line
        x1={0}
        x2={width}
        y1={height - 0.5}
        y2={height - 0.5}
        className="pdetail-bars__base"
      />
      {safe.map((raw, i) => {
        const v = Number(raw)
        const clamped = Math.max(0, Math.min(v, yAxisMax))
        const h = Math.max(2, Math.round((clamped / yAxisMax) * (height - pad * 2 - 8)))
        const x = i * (barW + gap)
        const y = height - h - 10
        const cls = accent === 'pos-neg'
          ? `pdetail-bars__bar--${miniBarTone(v, average)}`
          : `pdetail-bars__bar--${accent}`
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              className={`pdetail-bars__bar ${cls}`}
            />
            <text
              x={x + barW / 2}
              y={height - 1}
              className="pdetail-bars__label"
              textAnchor="middle"
            >
              {v}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
