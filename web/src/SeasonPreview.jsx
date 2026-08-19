import { useEffect, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { standingsMobileTeamName } from './teamNameUtils.js'
import { buildSquadFplValueByLeagueEntryId } from './fplSquadValues.js'
import './SeasonPreview.css'

/** Grade chip tone: A-family green, B-family amber, C-family gray. */
function gradeTone(grade) {
  const letter = String(grade ?? '')[0]
  if (letter === 'A') return 'a'
  if (letter === 'B') return 'b'
  return 'c'
}

function fmtRecord(sim) {
  const losses = Math.max(0, Math.round(38 - sim.avgW - sim.avgD))
  return `${Math.round(sim.avgW)}-${Math.round(sim.avgD)}-${losses}`
}

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

/**
 * 26/27 Season Preview — the pundit's draft verdict. Static content built by
 * scripts/build-season-preview.mjs from the draft board, the fpl-predictions
 * GW1 forecasts (FPL + Understat), each squad's 25/26 scoring, and a Monte
 * Carlo run of the real 38-GW H2H schedule.
 */
export function SeasonPreview({ teamLogoMap = {}, kitIndexByEntry }) {
  const [data, setData] = useState(null)
  const [squadValues, setSquadValues] = useState(() => new Map())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.BASE_URL}league-data/season-preview.json`)
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
      <section className="tile tile--compact" aria-label="Season preview">
        <h2 className="tile-title tile-title--sm">26/27 season preview</h2>
        <p className="season-preview__note">Preview unavailable right now.</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="tile tile--compact" aria-label="Season preview">
        <h2 className="tile-title tile-title--sm">26/27 season preview</h2>
        <p className="season-preview__note">Loading…</p>
      </section>
    )
  }

  const { teams, awards, method } = data

  return (
    <>
      <section className="tile tile--compact season-preview" aria-labelledby="season-preview-heading">
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="season-preview-heading" className="tile-title tile-title--sm">
            26/27 season preview
          </h2>
        </div>
        <p className="season-preview__strap">
          Every draft graded, every squad projected, the whole season simulated{' '}
          {method.simulations.toLocaleString()} times on the real fixture list.
        </p>

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
                  Pts
                </th>
                <th scope="col" className="season-preview__th season-preview__th--num">
                  FPL value
                </th>
                <th scope="col" className="season-preview__th season-preview__th--num season-preview__th--record">
                  W-D-L
                </th>
                <th scope="col" className="season-preview__th season-preview__th--grade">
                  Draft
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => {
                // Regular-FPL market value of the full 15-man draft squad.
                const v = squadValues.get(Number(t.leagueEntryId))
                return (
                <tr key={t.leagueEntryId}>
                  <td className="season-preview__td season-preview__td--rank tabular">{i + 1}</td>
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
                    </span>
                  </td>
                  <td className="season-preview__td season-preview__td--odds">
                    <OddsBar pct={t.sim.titlePct} />
                  </td>
                  <td className="season-preview__td season-preview__td--num tabular">
                    {Math.round(t.sim.avgPts)}
                  </td>
                  <td className="season-preview__td season-preview__td--num tabular">
                    {v ? `£${v.totalValue.toFixed(1)}m` : '—'}
                    {v ? (
                      <span className="season-preview__meta-count muted"> · {v.playerCount} players</span>
                    ) : null}
                  </td>
                  <td className="season-preview__td season-preview__td--num season-preview__td--record tabular">
                    {fmtRecord(t.sim)}
                  </td>
                  <td className="season-preview__td season-preview__td--grade">
                    <span
                      className={`season-preview__grade season-preview__grade--${gradeTone(t.grade)}`}
                    >
                      {t.grade}
                    </span>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="season-preview__awards">
          <span className="season-preview__award">
            <span className="season-preview__award-label">Projected MVP</span>
            <span className="season-preview__award-value">
              {awards.mvp.name} · {standingsMobileTeamName(awards.mvp.teamName)}
            </span>
          </span>
          <span className="season-preview__award">
            <span className="season-preview__award-label">Steal of the draft</span>
            <span className="season-preview__award-value">
              {awards.steal.name} (R{awards.steal.round}) ·{' '}
              {standingsMobileTeamName(awards.steal.teamName)}
            </span>
          </span>
        </div>
      </section>

      {teams.map((t, i) => {
        const v = squadValues.get(Number(t.leagueEntryId))
        return (
          <section
            key={t.leagueEntryId}
            className="tile tile--compact season-preview-card"
            aria-label={`${t.name} season preview`}
          >
            <div className="season-preview-card__head">
              <span className="season-preview-card__rank tabular" aria-hidden>
                {i + 1}
              </span>
              <TeamAvatar
                entryId={t.leagueEntryId}
                name={t.name}
                size="md"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <div className="season-preview-card__title">
                <h3 className="season-preview-card__name">{standingsMobileTeamName(t.name)}</h3>
                <span className="season-preview-card__sub">
                  Projected {ordinal(i + 1)} · {Math.round(t.sim.avgPts)} pts · title{' '}
                  {t.sim.titlePct}%
                </span>
              </div>
              <span
                className={`season-preview__grade season-preview__grade--lg season-preview__grade--${gradeTone(t.grade)}`}
                title="Draft grade"
              >
                {t.grade}
              </span>
            </div>
            <p className="season-preview-card__verdict">{t.verdict}</p>
            <dl className="season-preview-card__meta">
              <div className="season-preview-card__meta-item">
                <dt>Key player</dt>
                <dd>
                  {t.keyPlayer.name}{' '}
                  <span className="season-preview-card__meta-dim">{t.keyPlayer.teamShort}</span>
                </dd>
              </div>
              {t.steal ? (
                <div className="season-preview-card__meta-item">
                  <dt>Best value</dt>
                  <dd>
                    {t.steal.name}{' '}
                    <span className="season-preview-card__meta-dim">R{t.steal.round}</span>
                  </dd>
                </div>
              ) : null}
              <div className="season-preview-card__meta-item">
                <dt>Best XI shape</dt>
                <dd>{t.shape}</dd>
              </div>
              <div className="season-preview-card__meta-item">
                <dt>Top-half odds</dt>
                <dd className="tabular">{t.sim.topHalfPct}%</dd>
              </div>
              <div className="season-preview-card__meta-item">
                <dt>FPL value</dt>
                <dd className="tabular">
                  {v ? `£${v.totalValue.toFixed(1)}m` : '—'}
                  {v ? (
                    <span className="season-preview-card__meta-dim"> · {v.playerCount} players</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>
        )
      })}

      <section className="tile tile--compact season-preview-method" aria-label="How this preview works">
        <h3 className="season-preview-method__title">How this works</h3>
        <p className="season-preview__note">
          Each drafted player gets a weekly projection blending the {method.engine} forecast with
          their 25/26 scoring ({method.blend}). Team strength is the best legal XI from the
          drafted fifteen, then the {method.schedule} is simulated{' '}
          {method.simulations.toLocaleString()} times to produce finishes, points and title odds.
          Availability uses FPL's own flags: injured and suspended players lose forecast value,
          and anyone who has left the league counts for nothing. For injury detail see{' '}
          <a
            href="https://www.premierinjuries.com/injury-table.php"
            target="_blank"
            rel="noreferrer"
          >
            premierinjuries.com
          </a>
          . It's a pre-season model, not a prophecy — waivers, trades and hamstrings will have
          their say.
        </p>
      </section>
    </>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
