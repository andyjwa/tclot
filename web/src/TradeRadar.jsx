import { formatTradeStat, polygonPath, radarVertex } from './tradeToolStats.js'
import './TradeRadar.css'

/* Wider than tall so chips, chart, and the stat table fit one phone screen. */
const VB_W = 400
const VB_H = 332
const CX = 200
const CY = 158
const RADIUS = 102
const RINGS = [0.25, 0.5, 0.75, 1]
const LABEL_R = 134

/**
 * Radar comparison of two trade sides. Axes come from `buildRadarAxes`.
 * Side A is rust; side B is pitch green.
 *
 * @param {{
 *   axes: { id: string, label: string, a: number, b: number, aNorm: number, bNorm: number }[],
 *   labelA?: string,
 *   labelB?: string,
 * }} props
 */
export function TradeRadar({ axes, labelA = 'Give', labelB = 'Get' }) {
  const n = axes?.length ?? 0
  if (n < 3) return null

  const gridPaths = RINGS.map((ring) =>
    polygonPath(
      Array.from({ length: n }, (_, i) => radarVertex(i, n, ring, CX, CY, RADIUS)),
    ),
  )
  const axisLines = Array.from({ length: n }, (_, i) => {
    const [x, y] = radarVertex(i, n, 1, CX, CY, RADIUS)
    return { x, y }
  })
  const pathA = polygonPath(
    axes.map((ax, i) => radarVertex(i, n, ax.aNorm, CX, CY, RADIUS)),
  )
  const pathB = polygonPath(
    axes.map((ax, i) => radarVertex(i, n, ax.bNorm, CX, CY, RADIUS)),
  )

  const aria = axes
    .map((ax) => `${ax.label} ${formatTradeStat(ax.id, ax.a)} to ${formatTradeStat(ax.id, ax.b)}`)
    .join('; ')

  return (
    <figure className="trade-radar">
      <svg
        className="trade-radar__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`${labelA} versus ${labelB}: ${aria}`}
      >
        {gridPaths.map((d, i) => (
          <path key={i} className="trade-radar__ring" d={d} />
        ))}
        {axisLines.map((p, i) => (
          <line
            key={i}
            className="trade-radar__axis"
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
          />
        ))}
        <path className="trade-radar__poly trade-radar__poly--b" d={pathB} />
        <path className="trade-radar__poly trade-radar__poly--a" d={pathA} />
        {axes.map((ax, i) => {
          const [lx, ly] = radarVertex(i, n, 1, CX, CY, LABEL_R)
          const anchor =
            lx < CX - 12 ? 'end' : lx > CX + 12 ? 'start' : 'middle'
          const dy = ly < CY - 8 ? 0 : ly > CY + 8 ? 12 : 4
          return (
            <g
              key={ax.id}
              className="trade-radar__label"
              transform={`translate(${lx.toFixed(1)},${(ly + dy).toFixed(1)})`}
            >
              <text
                className="trade-radar__nums"
                textAnchor={anchor}
                y="-11"
              >
                <tspan className="trade-radar__num--a">
                  {formatTradeStat(ax.id, ax.a)}
                </tspan>
                <tspan className="trade-radar__slash"> / </tspan>
                <tspan className="trade-radar__num--b">
                  {formatTradeStat(ax.id, ax.b)}
                </tspan>
              </text>
              <text className="trade-radar__k" textAnchor={anchor} y="4">
                {ax.label}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="trade-radar__caption">
        <span className="trade-radar__swatch trade-radar__swatch--a" />
        {labelA}
        <span className="trade-radar__swatch trade-radar__swatch--b" />
        {labelB}
      </figcaption>
    </figure>
  )
}
