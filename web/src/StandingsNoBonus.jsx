import { Fragment, useState } from 'react'
import { formatSwing } from './bestXi.js'
import { TeamAvatar } from './TeamAvatar'
import { firstWord } from './teamNameUtils.js'
import { useMobileNarrowViewport } from './usePortraitMobile'
import { useNoBonusPoints } from './useNoBonusPoints.js'
import { archivedSeasonLabel, seasonLabelDisplay } from './seasonArchive.js'

function scoreText(a, b) {
  return `${a}–${b}`
}

function recordText(w, d, l) {
  return `${w}-${d}-${l}`
}

function resultWord(code) {
  if (code === 'W') return 'win'
  if (code === 'L') return 'loss'
  return 'draw'
}

function ResultChip({ code }) {
  const kind = code === 'W' ? 'win' : code === 'L' ? 'loss' : 'draw'
  return (
    <span className={`standings-schedule-team__chip standings-schedule-team__chip--${kind}`}>
      {code}
    </span>
  )
}

function Swing({ n, className = '' }) {
  const v = Number(n) || 0
  const tone =
    v > 0
      ? ' standings-stats-nobonus__swing--up'
      : v < 0
        ? ' standings-stats-nobonus__swing--down'
        : ''
  return (
    <span className={`tabular standings-stats-nobonus__swing${tone} ${className}`.trim()}>
      {formatSwing(v)}
    </span>
  )
}

/**
 * Stats → no bonus points.
 *
 * @param {object} props
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 */
export function StandingsNoBonus({ teamLogoMap = {}, kitIndexByEntry = {} }) {
  const isMobileNarrow = useMobileNarrowViewport()
  const { report, loading } = useNoBonusPoints(true)
  const [expandedId, setExpandedId] = useState(/** @type {number | null} */ (null))

  const standings = report?.standings || []
  const fixtures = report?.fixtures || []
  const teams = report?.teams || []
  const hasData = standings.some((r) => (r.w ?? 0) + (r.d ?? 0) + (r.l ?? 0) > 0)
  const flipped = Number(report?.flippedCount) || fixtures.length
  const changed = standings.filter((r) => r.changed)

  return (
    <section
      className="standings-stats__section standings-stats__section--nobonus"
      aria-labelledby="standings-stats-nobonus-heading"
    >
      <h3 id="standings-stats-nobonus-heading" className="standings-stats-eyebrow">
        No bonus points
      </h3>
      <p className="standings-stats-hint">
        Official scores with bonus taken off the players who counted, after
        autosubs. The table is the standings that would leave. A shaded row
        would have a different result. Rank can still move on points for.
      </p>

      {loading ? (
        <p className="muted muted--tight">Loading no-bonus table…</p>
      ) : !hasData ? (
        <p className="muted muted--tight">
          {archivedSeasonLabel()
            ? `${seasonLabelDisplay(archivedSeasonLabel())} is not scored. FPL no longer has that season's starting XIs, so the bonus that counted cannot be taken off those scores.`
            : 'No finished gameweeks to score yet.'}
        </p>
      ) : (
        <>
          <div className="standings-stats-nobonus-flips">
            <p className="standings-stats-nobonus-flips__lead">
              {flipped === 0
                ? 'No fixture results would change.'
                : `${flipped} result${flipped === 1 ? '' : 's'} would change.`}
            </p>
            {report?.incomplete?.length ? (
              <p className="muted muted--tight">
                GW {report.incomplete.join(', ')} could not be scored, so it is left as played.
              </p>
            ) : null}
            {fixtures.length ? (
              <div className="table-scroll table-scroll--win-margin">
                <table className="win-margin-table standings-stats-nobonus-fixtures">
                  <thead>
                    <tr>
                      <th scope="col" className="tabular standings-stats-nobonus-fixtures__gw">
                        GW
                      </th>
                      <th scope="col">Fixture</th>
                      <th
                        scope="col"
                        className="standings-stats-nobonus-fixtures__score"
                        title="Official score, then the same fixture with bonus removed"
                      >
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((fx) => (
                      <tr key={`${fx.gw}-${fx.homeId}-${fx.awayId}`}>
                        <td className="tabular standings-stats-nobonus-fixtures__gw">{fx.gw}</td>
                        <th scope="row" className="standings-stats-nobonus-fixtures__match">
                          <span>{isMobileNarrow ? firstWord(fx.homeName) : fx.homeName}</span>
                          <span className="standings-stats-nobonus-fixtures__vs">v</span>
                          <span>{isMobileNarrow ? firstWord(fx.awayName) : fx.awayName}</span>
                        </th>
                        <td className="standings-stats-nobonus-fixtures__score">
                          <span className="standings-stats-nobonus-fixtures__line">
                            <span className="tabular">{scoreText(fx.homePts, fx.awayPts)}</span>
                            <span className="standings-stats-nobonus-detail__arrow" aria-hidden="true">
                              →
                            </span>
                            <span className="tabular">{scoreText(fx.homeAdj, fx.awayAdj)}</span>
                          </span>
                          <span className="visually-hidden">
                            becomes {scoreText(fx.homeAdj, fx.awayAdj)} without bonus
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="table-scroll table-scroll--win-margin">
            <table className="win-margin-table standings-stats-nobonus-table">
              <caption className="visually-hidden">
                Standings if bonus points were removed
                {changed.length
                  ? `. ${changed.length} team${changed.length === 1 ? '' : 's'} would change rank or result.`
                  : '. No rank or result would change.'}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="tabular win-margin-table__n" title="Rank without bonus">
                    #
                  </th>
                  <th scope="col" className="win-margin-table__team">
                    Team
                  </th>
                  <th scope="col" className="tabular win-margin-table__n standings-stats-nobonus-table__pts" title="League points without bonus">
                    Pts
                  </th>
                  <th
                    scope="col"
                    className="tabular win-margin-table__n standings-stats-nobonus-table__wide"
                    title="Wins, draws and losses without bonus"
                  >
                    W-D-L
                  </th>
                  <th
                    scope="col"
                    className="tabular win-margin-table__n standings-stats-nobonus-table__wide"
                    title="Points for without bonus"
                  >
                    For
                  </th>
                  <th scope="col" className="tabular win-margin-table__n" title="Current official rank">
                    Was
                  </th>
                  <th scope="col" className="tabular win-margin-table__n" title="Places gained without bonus">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const resultChanged = row.ptsDelta !== 0
                  const tone = !resultChanged
                    ? ''
                    : row.ptsDelta > 0
                      ? ' standings-stats-nobonus-table__row--up'
                      : ' standings-stats-nobonus-table__row--down'
                  const title = resultChanged
                    ? `Would be ${recordText(row.w, row.d, row.l)}, ${row.pts} pts. Official is ${recordText(row.nowW, row.nowD, row.nowL)}, ${row.nowPts} pts.`
                    : row.rankDelta !== 0
                      ? `Result unchanged. Rank would move on points for, from ${row.nowRank} to ${row.rank}.`
                      : `Unchanged: ${recordText(row.w, row.d, row.l)}, ${row.pts} pts.`
                  return (
                    <tr
                      key={row.leagueEntryId}
                      className={tone.trim() || undefined}
                      title={title}
                    >
                      <td className="tabular win-margin-table__n">{row.rank}</td>
                      <th scope="row" className="win-margin-table__team">
                        <span className="win-margin-table__team-inner">
                          <TeamAvatar
                            entryId={row.leagueEntryId}
                            name={row.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="win-margin-table__name" title={row.teamName}>
                            {isMobileNarrow ? firstWord(row.teamName) : row.teamName}
                          </span>
                        </span>
                      </th>
                      <td className="tabular win-margin-table__n standings-stats-nobonus-table__pts">
                        <span className="standings-stats-nobonus-table__delta">
                          {row.ptsDelta !== 0 ? <Swing n={row.ptsDelta} /> : null}
                        </span>
                        <strong>{row.pts}</strong>
                      </td>
                      <td className="tabular win-margin-table__n standings-stats-nobonus-table__wide">
                        {recordText(row.w, row.d, row.l)}
                      </td>
                      <td className="tabular win-margin-table__n standings-stats-nobonus-table__wide">
                        {row.pf}
                      </td>
                      <td className="tabular win-margin-table__n">{row.nowRank}</td>
                      <td className="tabular win-margin-table__n">
                        <Swing n={row.rankDelta} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h4 className="standings-stats-nobonus-teams__label" id="standings-stats-nobonus-teams-label">
            By team
          </h4>
          <p className="standings-stats-hint standings-stats-nobonus-teams__hint">
            Open a team for the gameweeks whose result would change, and the
            bonus taken off that score.
          </p>
          <div className="table-scroll table-scroll--win-margin">
            <table className="win-margin-table standings-stats-nobonus-teams">
              <thead>
                <tr>
                  <th scope="col" className="win-margin-table__team">
                    Team
                  </th>
                  <th
                    scope="col"
                    className="tabular win-margin-table__n"
                    title="Change in league points (3 for a win, 1 for a draw)"
                  >
                    Table
                  </th>
                  <th
                    scope="col"
                    className="tabular win-margin-table__n"
                    title="Bonus points removed from this team’s scores"
                  >
                    Bonus
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((row) => {
                  const open = expandedId === row.leagueEntryId
                  const toggleId = `standings-nobonus-team-${row.leagueEntryId}`
                  const panelId = `standings-nobonus-detail-${row.leagueEntryId}`
                  const flips = row.flips || []
                  return (
                    <Fragment key={row.leagueEntryId}>
                      <tr className={open ? 'standings-stats-nobonus-teams__row--open' : undefined}>
                        <th scope="row" className="win-margin-table__team">
                          <button
                            type="button"
                            id={toggleId}
                            className="standings-stats-nobonus-teams__btn"
                            aria-expanded={open}
                            aria-controls={panelId}
                            onClick={() =>
                              setExpandedId(open ? null : row.leagueEntryId)
                            }
                          >
                            <span
                              className={
                                'standings-stats-nobonus-teams__chevron' +
                                (open ? ' standings-stats-nobonus-teams__chevron--open' : '')
                              }
                              aria-hidden="true"
                            >
                              ▶
                            </span>
                            <span className="win-margin-table__team-inner">
                              <TeamAvatar
                                entryId={row.leagueEntryId}
                                name={row.teamName}
                                size="sm"
                                logoMap={teamLogoMap}
                                kitIndexByEntry={kitIndexByEntry}
                              />
                              <span className="win-margin-table__name" title={row.teamName}>
                                {isMobileNarrow ? firstWord(row.teamName) : row.teamName}
                              </span>
                            </span>
                          </button>
                        </th>
                        <td className="tabular win-margin-table__n">
                          <Swing n={row.ptsDelta} />
                        </td>
                        <td className="tabular win-margin-table__n">
                          {Number(row.bonusRemoved) || 0}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="standings-stats-nobonus-teams__detail">
                          <td colSpan={3}>
                            <div
                              id={panelId}
                              className="standings-stats-nobonus-detail"
                              role="region"
                              aria-labelledby={toggleId}
                            >
                              {flips.length ? (
                                <ul className="standings-stats-nobonus-detail__list">
                                  {flips.map((fx) => (
                                    <li key={`${fx.gw}-${fx.opponentId}`}>
                                      <span className="standings-stats-nobonus-detail__gw tabular">
                                        GW {fx.gw}
                                      </span>
                                      <span className="standings-stats-nobonus-detail__opp">
                                        {isMobileNarrow
                                          ? firstWord(fx.opponentName)
                                          : fx.opponentName}
                                      </span>
                                      <span className="standings-stats-nobonus-detail__scores">
                                        <span className="tabular">
                                          {scoreText(fx.pts, fx.oppPts)}
                                        </span>
                                        <ResultChip code={fx.from} />
                                        <span className="standings-stats-nobonus-detail__arrow" aria-hidden="true">
                                          →
                                        </span>
                                        <span className="tabular">
                                          {scoreText(fx.adj, fx.oppAdj)}
                                        </span>
                                        <ResultChip code={fx.to} />
                                        <span className="visually-hidden">
                                          {resultWord(fx.from)} becomes {resultWord(fx.to)}
                                        </span>
                                      </span>
                                      <span className="standings-stats-nobonus-detail__bonus tabular">
                                        {fx.bonusRemoved} removed
                                        <span className="standings-stats-nobonus-detail__opp-bonus">
                                          opp {fx.opponentBonus}
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="standings-stats-nobonus-detail__empty muted">
                                  No result would change.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
