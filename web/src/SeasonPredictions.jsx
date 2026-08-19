import { useEffect, useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { SeasonPreview } from './SeasonPreview'
import { standingsMobileTeamName } from './teamNameUtils.js'
import { buildSquadFplValueByLeagueEntryId } from './fplSquadValues.js'
import './SeasonPreview.css'
import './SeasonPredictions.css'

/** Line colors for the title-odds chart — one per team, stable by table order. */
const CHART_COLORS = [
  '#4ade80',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#94a3b8',
]

function OddsBar({ pct }) {
  return (
    <span className="season-preview__odds">
      <span className="season-preview__odds-track" aria-hidden>
        <span
          className="season-preview__odds-fill"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="season-preview__odds-num tabular">{pct}%</span>
    </span>
  )
}

/** Signed title-odds move since the previous snapshot, e.g. "+4.2". */
function oddsDelta(current, prevSnapshot, entryId) {
  if (!prevSnapshot) return null
  const prev = prevSnapshot.teams.find((t) => t.leagueEntryId === entryId)
  if (!prev) return null
  const d = +(current - prev.titlePct).toFixed(1)
  if (Math.abs(d) < 0.05) return null
  return d
}

/**
 * Season predictions — the living model. Re-simulated after every finished
 * gameweek by scripts/build-season-predictions.mjs: banked results stand,
 * the rest of the season is re-run with strengths updated by actual scores.
 * Keeps every weekly snapshot, so the odds chart and the model's win-call
 * record are receipts, not revisionism.
 *
 * Until GW1 finishes there's nothing to track, so the tab shows the full
 * draft recap (Season Preview — same engine, identical odds) instead; the
 * living view takes over from the first banked gameweek, with the
 * pre-season numbers preserved as the GW0 snapshot.
 */
export function SeasonPredictions({ teamLogoMap = {}, kitIndexByEntry }) {
  const [data, setData] = useState(null)
  const [squadValues, setSquadValues] = useState(() => new Map())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.BASE_URL}league-data/season-predictions.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (alive) setData(json)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    Promise.allSettled([
      fetch(`${import.meta.env.BASE_URL}league-data/element_status.json`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
      fetch(`${import.meta.env.BASE_URL}league-data/bootstrap_fpl.json`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
      fetch(`${import.meta.env.BASE_URL}league-data/details.json`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
    ]).then((results) => {
      if (!alive) return
      const [elementStatus, bootstrapFpl, details] = results
      if (
        elementStatus.status !== 'fulfilled' ||
        bootstrapFpl.status !== 'fulfilled' ||
        details.status !== 'fulfilled'
      ) {
        return
      }
      setSquadValues(
        buildSquadFplValueByLeagueEntryId({
          elementStatus: elementStatus.value,
          bootstrapFpl: bootstrapFpl.value,
          details: details.value,
        }),
      )
    })
    return () => {
      alive = false
    }
  }, [])

  if (failed) {
    return (
      <section className="tile tile--compact" aria-label="Season predictions">
        <h2 className="tile-title tile-title--sm">Season predictions</h2>
        <p className="season-preview__note">Predictions unavailable right now.</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="tile tile--compact" aria-label="Season predictions">
        <h2 className="tile-title tile-title--sm">Season predictions</h2>
        <p className="season-preview__note">Loading…</p>
      </section>
    )
  }

  if (data.asOfGw === 0) {
    return <SeasonPreview teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
  }

  const { current, snapshots, modelRecord, asOfGw } = data
  const prevSnapshot =
    snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  const decided = modelRecord.hits + modelRecord.misses

  return (
    <>
      <section
        className="tile tile--compact season-preview"
        aria-labelledby="season-predictions-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="season-predictions-heading" className="tile-title tile-title--sm">
            Season predictions
          </h2>
          <span className="season-predictions__asof tabular">
            After GW{asOfGw}
          </span>
        </div>
        <p className="season-preview__strap">
          Results through GW{asOfGw} are banked; the remaining fixtures are
          re-simulated with team strength updated by what has actually been
          scored.
        </p>

        <div className="season-predictions__record" role="status">
          <span className="season-predictions__record-label">Model record</span>
          {decided > 0 ? (
            <>
              <span className="season-predictions__record-value tabular">
                {modelRecord.hits}–{modelRecord.misses}
              </span>
              <span className="season-predictions__record-note">
                weekly winner calls
                {modelRecord.draws ? ` (${modelRecord.draws} drawn)` : ''}
                {modelRecord.avgAbsErr != null
                  ? ` · avg score miss ±${modelRecord.avgAbsErr}`
                  : ''}
              </span>
            </>
          ) : (
            <span className="season-predictions__record-note">
              starts with GW1 — every weekly winner call gets scored against the real
              result.
            </span>
          )}
        </div>

        <div className="season-preview__table-wrap">
          <table className="season-preview__table">
            <thead>
              <tr>
                <th scope="col" className="season-preview__th season-preview__th--rank">
                  #
                </th>
                <th scope="col" className="season-preview__th">
                  Projected finish
                </th>
                <th scope="col" className="season-preview__th season-preview__th--odds">
                  Title odds
                </th>
                <th scope="col" className="season-preview__th season-preview__th--num">
                  Proj
                </th>
                <th scope="col" className="season-preview__th season-preview__th--num season-preview__th--value">
                  FPL value
                </th>
                <th
                  scope="col"
                  className="season-preview__th season-preview__th--num season-preview__th--record"
                >
                  Pts now
                </th>
              </tr>
            </thead>
            <tbody>
              {current.teams.map((t, i) => {
                const delta = oddsDelta(t.titlePct, prevSnapshot, t.leagueEntryId)
                const v = squadValues.get(Number(t.leagueEntryId))
                return (
                  <tr key={t.leagueEntryId}>
                    <td className="season-preview__td season-preview__td--rank tabular">
                      {i + 1}
                    </td>
                    <td className="season-preview__td">
                      <span className="season-preview__team-cell">
                        <TeamAvatar
                          entryId={t.leagueEntryId}
                          name={t.name}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                        <span className="season-preview__team-name">
                          {standingsMobileTeamName(t.name)}
                        </span>
                        {delta != null ? (
                          <span
                            className={
                              'season-predictions__delta tabular ' +
                              (delta > 0
                                ? 'season-predictions__delta--up'
                                : 'season-predictions__delta--down')
                            }
                            title="Title odds move since last gameweek"
                          >
                            {delta > 0 ? '▲' : '▼'}
                            {Math.abs(delta)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="season-preview__td season-preview__td--odds">
                      <OddsBar pct={t.titlePct} />
                    </td>
                    <td className="season-preview__td season-preview__td--num tabular">
                      {Math.round(t.projPts)}
                    </td>
                    <td className="season-preview__td season-preview__td--num season-preview__td--value tabular">
                      {v ? `£${v.totalValue.toFixed(1)}m` : '—'}
                      {v ? (
                        <span className="season-preview__meta-count muted"> · {v.playerCount} players</span>
                      ) : null}
                    </td>
                    <td className="season-preview__td season-preview__td--num season-preview__td--record tabular">
                      {t.banked.pts}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {snapshots.length >= 2 ? (
        <TitleOddsChart snapshots={snapshots} teamLogoMap={teamLogoMap} />
      ) : null}

      <section
        className="tile tile--compact season-preview-method"
        aria-label="How season predictions work"
      >
        <h3 className="season-preview-method__title">How this works</h3>
        <p className="season-preview__note">
          Team strength starts from the draft-day model (the pre-season Preview) and
          re-weights toward each side's actual weekly scores as games accumulate. After
          every gameweek the rest of the season is simulated 5,000 times on the real
          fixture list. Weekly winner calls come from the same pre-match forecast the
          live win bars use, so the record above is scored against what the model
          actually said at the time. Player availability comes from FPL's own flags on
          every data refresh — injuries, suspensions and players who leave the league;
          for the human-readable physio room see{' '}
          <a
            href="https://www.premierinjuries.com/injury-table.php"
            target="_blank"
            rel="noreferrer"
          >
            premierinjuries.com
          </a>
          .
        </p>
      </section>
    </>
  )
}

/** SVG line chart: title odds per team across weekly snapshots. */
function TitleOddsChart({ snapshots, teamLogoMap }) {
  const series = useMemo(() => {
    // Order legend by latest title odds so the strongest claims sit first.
    const latest = snapshots[snapshots.length - 1]
    return latest.teams.map((t, i) => ({
      leagueEntryId: t.leagueEntryId,
      name: t.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      points: snapshots.map((s) => {
        const row = s.teams.find((x) => x.leagueEntryId === t.leagueEntryId)
        return { gw: s.asOfGw, pct: row ? row.titlePct : 0 }
      }),
    }))
  }, [snapshots])

  const W = 640
  const H = 220
  const PAD = { top: 10, right: 14, bottom: 22, left: 34 }
  const maxPct = Math.max(
    10,
    Math.ceil(Math.max(...series.flatMap((s) => s.points.map((p) => p.pct))) / 10) * 10,
  )
  const gws = snapshots.map((s) => s.asOfGw)
  const minGw = gws[0]
  const maxGw = gws[gws.length - 1]
  const x = (gw) =>
    PAD.left + ((gw - minGw) / Math.max(1, maxGw - minGw)) * (W - PAD.left - PAD.right)
  const y = (pct) => PAD.top + (1 - pct / maxPct) * (H - PAD.top - PAD.bottom)

  const yTicks = []
  for (let v = 0; v <= maxPct; v += maxPct <= 30 ? 10 : 20) yTicks.push(v)

  return (
    <section
      className="tile tile--compact season-predictions-chart"
      aria-label="Title odds over the season"
    >
      <h3 className="season-preview-method__title">Title odds, week by week</h3>
      <svg
        className="season-predictions-chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Line chart of each team's title odds after every gameweek"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="season-predictions-chart__grid"
            />
            <text x={PAD.left - 6} y={y(v) + 3} className="season-predictions-chart__tick" textAnchor="end">
              {v}%
            </text>
          </g>
        ))}
        {gws.map((gw) => (
          <text
            key={gw}
            x={x(gw)}
            y={H - 6}
            className="season-predictions-chart__tick"
            textAnchor="middle"
          >
            {gw === 0 ? 'Pre' : `GW${gw}`}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.leagueEntryId}
            className="season-predictions-chart__line"
            points={s.points.map((p) => `${x(p.gw)},${y(p.pct)}`).join(' ')}
            style={{ stroke: s.color }}
          />
        ))}
        {series.map((s) => {
          const last = s.points[s.points.length - 1]
          return (
            <circle
              key={s.leagueEntryId}
              cx={x(last.gw)}
              cy={y(last.pct)}
              r={3}
              style={{ fill: s.color }}
            />
          )
        })}
      </svg>
      <div className="season-predictions-chart__legend">
        {series.map((s) => (
          <span key={s.leagueEntryId} className="season-predictions-chart__legend-item">
            <span
              className="season-predictions-chart__legend-swatch"
              style={{ background: s.color }}
              aria-hidden
            />
            <TeamAvatar
              entryId={s.leagueEntryId}
              name={s.name}
              size="sm"
              logoMap={teamLogoMap}
            />
            <span className="season-predictions-chart__legend-name">
              {standingsMobileTeamName(s.name)}
            </span>
            <span className="tabular season-predictions-chart__legend-pct">
              {s.points[s.points.length - 1].pct}%
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}
