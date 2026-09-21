import { Fragment } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { PointsCell } from './PointsCell.jsx';
import { firstWord, standingsMobileTeamName } from './teamNameUtils.js';
import { ClickableTeamName } from './TeamDetailOverlay.jsx';
import { useIsCeefax } from './useIsCeefax.js';

/**
 * Local copy mirroring the per-file helper in `LiveScores.jsx`,
 * `LiveScoreFixtureTicker.jsx`, and `LiveFixtureGwPointsChart.jsx` —
 * avoids a circular import back into `LiveScores.jsx`.
 */
function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
}

/**
 * Row treatment for the Live Table. Unlike the production Standings
 * table there's no rank-1 leader tint here — the Titans/Minnows
 * section labels carry the grouping instead (and a tint would band
 * multiple rows whenever teams are tied at the top). Only the rank-8
 * 8th-place band is kept. `standings-row--ceefax-leader-cut` is a
 * no-op outside the Ceefax skin (red rule under the top row).
 */
function liveStandingsRowClass(row, idx, isCeefax, isVillain) {
  const parts = [];
  if (!isCeefax && idx === 0) parts.push('standings-row--ceefax-leader-cut');
  if (isCeefax) {
    parts.push(
      idx % 2 === 0
        ? 'standings-row--ceefax-odd'
        : 'standings-row--ceefax-even',
    );
  }
  if ((row.ordinalLive ?? idx + 1) === 8) {
    parts.push('standings-row--divider-above', 'standings-row--8th');
  }
  if (isVillain) parts.push('standings-row--villain-victory');
  return parts.join(' ');
}

/**
 * Section label rows. "Titans" heads the table; "Minnows" splits it
 * after the 4th row. Keyed by row position (not `liveRank`) so the
 * split survives ties — pre-season every team shares rank 1/5 and a
 * rank-keyed divider would never render.
 */
function SectionLabelRow({ label, colSpan, top }) {
  return (
    <tr
      className={`standings-divider standings-divider--minnows${top ? ' standings-divider--top' : ''}`}
      aria-hidden="true"
    >
      <td colSpan={colSpan}>
        <span className="standings-divider__label">{label}</span>
      </td>
    </tr>
  );
}

/**
 * Render the team cell content (avatar + name + +3/+1 chip + ↑/↓ move
 * indicator). On mobile Standings / Live Table we show the full club
 * name (MSFG stays `MSFG`) now that the manager subtitle is gone.
 */
function LiveTeamCell({ row, teamLogoMap, kitIndexByEntry, mobile, villain = false }) {
  const isCeefax = useIsCeefax();
  /* Ceefax bumps the name type well past what full club names can fit
   * at 390px — use the curated short labels so rows stay single-line. */
  const displayName = mobile
    ? isCeefax
      ? firstWord(row.teamName)
      : standingsMobileTeamName(row.teamName)
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
        <span
          className={
            'live-standings-name' + (villain ? ' live-standings-name--villain' : '')
          }
        >
          <ClickableTeamName leagueEntryId={row.league_entry} title={row.teamName}>
            {displayName}
          </ClickableTeamName>
        </span>
        {villain ? (
          <span className="live-standings-villain-chip">Villain</span>
        ) : null}
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
  villainEntryIds = null,
}) {
  const isCeefax = useIsCeefax();
  const lastTitle = gwStandingsFrozen
    ? 'This GW’s H2H result: green win, amber draw, red loss'
    : 'Live H2H result vs opponent: green winning, amber drawing, red losing, muted pre-kickoff';

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
            {!isCeefax ? <SectionLabelRow label="Titans" colSpan={5} top /> : null}
            {liveStandingsRows.map((row, idx) => {
              const isVillain = Boolean(
                villainEntryIds?.has(Number(row.league_entry)),
              );
              const rowClass = liveStandingsRowClass(row, idx, isCeefax, isVillain);
              return (
                <Fragment key={row.league_entry}>
                  <tr className={rowClass || undefined}>
                    <td className="col-rank">
                      {row.ordinalLive ?? idx + 1}
                    </td>
                    <td className="col-team">
                      <LiveTeamCell
                        row={row}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                        mobile
                        villain={isVillain}
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
                  {idx === 3 && !isCeefax ? (
                    <SectionLabelRow label="Minnows" colSpan={5} />
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
          {!isCeefax ? <SectionLabelRow label="Titans" colSpan={11} top /> : null}
          {liveStandingsRows.map((row, idx) => {
            const isVillain = Boolean(
              villainEntryIds?.has(Number(row.league_entry)),
            );
            const rowClass = liveStandingsRowClass(row, idx, isCeefax, isVillain);
            return (
              <Fragment key={row.league_entry}>
                <tr className={rowClass || undefined}>
                  <td className="col-rank">
                    {row.ordinalLive ?? idx + 1}
                  </td>
                  <td className="col-team">
                    <LiveTeamCell
                      row={row}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      mobile={false}
                      villain={isVillain}
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
                {idx === 3 && !isCeefax ? (
                  <SectionLabelRow label="Minnows" colSpan={11} />
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
