import { Fragment } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { PointsCell } from './PointsCell.jsx';
import { standingsMobileTeamName } from './teamNameUtils.js';
import { ClickableTeamName } from './TeamDetailOverlay.jsx';

/**
 * Local copy mirroring the per-file helper in `LiveScores.jsx`,
 * `LiveScoreFixtureTicker.jsx`, and `LiveFixtureGwPointsChart.jsx` —
 * avoids a circular import back into `LiveScores.jsx`.
 */
function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
}

/**
 * Row tint for the Live Table. Mirrors the production Standings
 * variant-c row treatment: rank-1 row tint (`row-highlight`) and the
 * rank-8 8th-place band. When every team shares rank 1 (pre-season /
 * all tied on 0 pts) the leader tint would band the whole table, so
 * it's suppressed until there's an actual leader.
 */
function liveStandingsRowClass(row, allTiedAtTop) {
  return [
    row.liveRank === 1 && !allTiedAtTop ? 'row-highlight' : '',
    row.liveRank === 8 ? 'standings-row--divider-above standings-row--8th' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Render the team cell content (avatar + name + +3/+1 chip + ↑/↓ move
 * indicator). On mobile Standings / Live Table we show the full club
 * name (MSFG stays `MSFG`) now that the manager subtitle is gone.
 */
function LiveTeamCell({ row, teamLogoMap, kitIndexByEntry, mobile }) {
  const displayName = mobile
    ? standingsMobileTeamName(row.teamName)
    : row.teamName;
  const moveUp = row.rankMove > 0;
  const moveDown = row.rankMove < 0;
  return (
    <span className="team-cell">
      <TeamAvatar
        entryId={row.league_entry}
        name={row.teamName}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
      <span className="team-name team-name--sidebar live-standings-team-name">
        <ClickableTeamName leagueEntryId={row.league_entry} title={row.teamName}>
          {displayName}
        </ClickableTeamName>
        {moveUp ? (
          <span
            className="live-standings-move live-standings-move--up"
            title={`Up ${row.rankMove} vs league #${row.rank}`}
            aria-label={`Up ${row.rankMove} places vs league position ${row.rank}`}
          >
            ↑
          </span>
        ) : null}
        {moveDown ? (
          <span
            className="live-standings-move live-standings-move--down"
            title={`Down ${-row.rankMove} vs league #${row.rank}`}
            aria-label={`Down ${-row.rankMove} places vs league position ${row.rank}`}
          >
            ↓
          </span>
        ) : null}
      </span>
      {row.h2hProj && row.h2hProj.value != null ? (
        <span
          className={`live-form-margin live-form-margin--${row.h2hProj.kind}`}
          title={
            row.h2hProj.kind === 'win'
              ? `Projected H2H points: +${row.h2hProj.value} (winning this GW)`
              : `Projected H2H points: +${row.h2hProj.value} (drawing this GW)`
          }
          aria-label={
            row.h2hProj.kind === 'win'
              ? `Projected H2H points plus ${row.h2hProj.value} (winning)`
              : `Projected H2H points plus ${row.h2hProj.value} (drawing)`
          }
        >
          +{row.h2hProj.value}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Single `LAST` dot for a Live Table row — shows the current GW's H2H
 * result. When the GW is in flight (not frozen) the dot pulses.
 */
function LiveLastDot({ row, gwStandingsFrozen, gameweek, teams }) {
  const kind = row.gwOutcomeDot;
  const isLive = !gwStandingsFrozen && kind !== 'none';
  const cls = ['live-gw-dot', `live-gw-dot--${kind}`, isLive ? 'live-gw-dot--live' : '']
    .filter(Boolean)
    .join(' ');
  const label =
    kind === 'win'
      ? `GW ${gameweek} winning`
      : kind === 'draw'
        ? `GW ${gameweek} drawing`
        : kind === 'loss'
          ? `GW ${gameweek} losing`
          : `GW ${gameweek} not started`;
  const oppName =
    row.oppEntryThisGw != null
      ? teamNameForEntry(teams, Number(row.oppEntryThisGw))
      : null;
  const hasScores = row.liveGw != null && row.oppLiveGw != null;
  let tooltip = null;
  if (oppName) {
    if (hasScores) {
      const liveTag = isLive ? ' · LIVE' : '';
      tooltip = `GW${gameweek} · ${row.liveGw} − ${row.oppLiveGw} · vs ${oppName}${liveTag}`;
    } else {
      tooltip = `GW${gameweek} · vs ${oppName}`;
    }
  }
  return (
    <span
      className={cls}
      role="img"
      tabIndex={tooltip ? 0 : -1}
      data-tooltip={tooltip || undefined}
      aria-label={tooltip ?? label}
    />
  );
}

/**
 * Live Table — mirrors the production Standings variant-c table for
 * visual parity. Renders a mobile 5-column variant and a desktop
 * 11-column variant. Extracted from `LiveScores.jsx` so the live
 * fixture card can reuse it.
 */
export function LiveStandingsTable({
  liveStandingsRows,
  gwStandingsFrozen,
  gameweek,
  teams,
  teamLogoMap,
  kitIndexByEntry,
  mobile,
}) {
  const lastTitle = gwStandingsFrozen
    ? 'This GW’s H2H result: green win, amber draw, red loss'
    : 'Live H2H result vs opponent: green winning, amber drawing, red losing, muted pre-kickoff';
  const allTiedAtTop =
    liveStandingsRows.length > 1 &&
    liveStandingsRows.every((r) => r.liveRank === 1);

  if (mobile) {
    return (
      <div className="table-scroll table-scroll--standings-open table-scroll--live">
        <table
          className="standings-table standings-table--variant-c standings-table--variant-c-mobile standings-table--live-mobile"
          role="table"
          aria-label="Live Table — ranks 1 through 8 (sorted by projected points)"
        >
          <thead>
            <tr>
              <th scope="col" className="col-rank">#</th>
              <th scope="col" className="col-team">Team</th>
              <th scope="col" className="col-num col-for">For</th>
              <th scope="col" className="col-num col-pts">PTS</th>
              <th scope="col" className="col-last" title={lastTitle}>
                GW {gameweek}
              </th>
            </tr>
          </thead>
          <tbody>
            {liveStandingsRows.map((row) => {
              const rowClass = liveStandingsRowClass(row, allTiedAtTop);
              return (
                <Fragment key={row.league_entry}>
                  <tr className={rowClass || undefined}>
                    <td className="col-rank">
                      {row.liveRank === 8 ? (
                        <span role="img" className="standings-rank-last" aria-label="8" title="Last place">
                          L
                        </span>
                      ) : (
                        row.liveRank
                      )}
                    </td>
                    <td className="col-team">
                      <LiveTeamCell
                        row={row}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                        mobile
                      />
                    </td>
                    <td
                      className="col-num col-for tabular"
                      title={`Season ${row.gf} + GW live${row.liveGw != null ? ` (${row.liveGw})` : ''}`}
                    >
                      {row.projectedFor}
                    </td>
                    <td className="col-num col-pts tabular">
                      <PointsCell value={row.projectedPts} size="md" showLabel={false} />
                    </td>
                    <td className="col-last">
                      <LiveLastDot
                        row={row}
                        gwStandingsFrozen={gwStandingsFrozen}
                        gameweek={gameweek}
                        teams={teams}
                      />
                    </td>
                  </tr>
                  {row.liveRank === 4 ? (
                    <tr
                      className="standings-divider standings-divider--minnows"
                      aria-hidden="true"
                    >
                      <td colSpan={5}>
                        <span className="standings-divider__label">Minnows</span>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-scroll table-scroll--standings-open table-scroll--live">
      <table
        className="standings-table standings-table--sidebar standings-table--variant-c standings-table--live-desktop"
        role="table"
        aria-label="Live Table — ranks 1 through 8 (sorted by projected points)"
      >
        <thead>
          <tr>
            <th
              className="col-rank"
              title={
                gwStandingsFrozen
                  ? 'League position (this GW is finished)'
                  : 'Position by projected points including this GW'
              }
            >
              #
            </th>
            <th className="col-team">Team</th>
            <th className="col-num col-pl" title="Season H2H matches played">
              PL
            </th>
            <th className="col-num col-wdl" title="Season H2H wins">W</th>
            <th className="col-num col-wdl" title="Season H2H draws">D</th>
            <th className="col-num col-wdl" title="Season H2H losses">L</th>
            <th
              className="col-num col-for"
              title={
                gwStandingsFrozen
                  ? 'Season points for (includes this GW)'
                  : 'Season points for, plus this GW’s live FPL points'
              }
            >
              For
            </th>
            <th
              className="col-num col-faced"
              title={
                gwStandingsFrozen
                  ? 'Season points against (includes this GW)'
                  : 'Season points against, plus your opponent’s live GW score vs you (when paired)'
              }
            >
              Faced
            </th>
            <th
              className="col-num col-gd"
              title={
                gwStandingsFrozen
                  ? 'Goal difference: For minus Against'
                  : 'Projected GD: projected For minus projected Against'
              }
            >
              GD
            </th>
            <th
              className="col-num col-pts"
              title={
                gwStandingsFrozen
                  ? 'Season H2H points (includes this GW)'
                  : 'Season H2H points plus 3 / 1 / 0 from live score vs opponent this GW'
              }
            >
              PTS
            </th>
            <th className="col-last" title={lastTitle}>
              GW {gameweek}
            </th>
          </tr>
        </thead>
        <tbody>
          {liveStandingsRows.map((row) => {
            const rowClass = liveStandingsRowClass(row, allTiedAtTop);
            return (
              <Fragment key={row.league_entry}>
                <tr className={rowClass || undefined}>
                  <td className="col-rank">
                    {row.liveRank === 8 ? (
                      <span role="img" className="standings-rank-last" aria-label="8" title="Last place">
                        L
                      </span>
                    ) : (
                      row.liveRank
                    )}
                  </td>
                  <td className="col-team">
                    <LiveTeamCell
                      row={row}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      mobile={false}
                    />
                  </td>
                  <td className="col-num col-pl tabular">
                    {(row.matches_won ?? 0) +
                      (row.matches_drawn ?? 0) +
                      (row.matches_lost ?? 0)}
                  </td>
                  <td className="col-num col-wdl tabular">{row.matches_won ?? 0}</td>
                  <td className="col-num col-wdl tabular">{row.matches_drawn ?? 0}</td>
                  <td className="col-num col-wdl tabular">{row.matches_lost ?? 0}</td>
                  <td
                    className="col-num col-for tabular"
                    title={`Season ${row.gf} + GW live${row.liveGw != null ? ` (${row.liveGw})` : ''}`}
                  >
                    {row.projectedFor}
                  </td>
                  <td
                    className="col-num col-faced tabular"
                    title={`Season ${row.ga} + opponent GW${row.oppLiveGw != null ? ` (${row.oppLiveGw})` : ''}`}
                  >
                    {row.projectedGa}
                  </td>
                  <td className="col-num col-gd tabular">
                    {row.projectedGd > 0 ? `+${row.projectedGd}` : row.projectedGd}
                  </td>
                  <td className="col-num col-pts tabular">
                    <strong>{row.projectedPts}</strong>
                  </td>
                  <td className="col-last">
                    <LiveLastDot
                      row={row}
                      gwStandingsFrozen={gwStandingsFrozen}
                      gameweek={gameweek}
                      teams={teams}
                    />
                  </td>
                </tr>
                {row.liveRank === 4 ? (
                  <tr
                    className="standings-divider standings-divider--minnows"
                    aria-hidden="true"
                  >
                    <td colSpan={11}>
                      <span className="standings-divider__label">Minnows</span>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
