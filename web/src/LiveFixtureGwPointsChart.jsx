import { useMemo, useState, useRef, useEffect } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { liveGwDisplayTotal } from './liveGwTotals.js';

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
}

function pctWidth(value, maxVal) {
  const n = value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
  const m = maxVal <= 0 ? 1 : maxVal;
  return Math.max(0, Math.min(100, (n / m) * 100));
}

function useDismissOnOutsidePointer(ref, active, onDismiss) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!active) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        dismissRef.current();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active, ref]);
}

function MedianMarker({ leftPct, valueLabel }) {
  if (!valueLabel) return null;

  const aria = `Median gameweek winning score ${valueLabel} points`;

  return (
    <div className="live-gw-tile__median-hit" style={{ left: `${leftPct}%` }}>
      <button type="button" className="live-gw-tile__median-line-btn" aria-label={aria}>
        <span className="live-gw-tile__median-line" aria-hidden="true" />
      </button>
      <span className="live-gw-tile__median-hover-val tabular" aria-hidden="true">
        {valueLabel}
      </span>
    </div>
  );
}

/**
 * @param {{
 *   live: number | null,
 *   proj: number | null,
 *   maxVal: number,
 *   tipLive: string | null,
 *   tipProj: string | null,
 *   ariaLabel: string,
 * }} props
 */
function HorizontalPointsRow({ live, proj, maxVal, tipLive, tipProj, ariaLabel }) {
  const liveN = live != null && Number.isFinite(Number(live)) ? Number(live) : null;
  const projN = proj != null && Number.isFinite(Number(proj)) ? Number(proj) : null;
  const liveW = pctWidth(liveN, maxVal);
  const projW = pctWidth(projN, maxVal);

  const liveLbl = liveN != null ? String(Math.round(liveN)) : '';
  const projLbl = projN != null ? String(Math.round(projN)) : '';
  const tipLiveF =
    tipLive ?? (liveN != null ? `Current score (live): ${liveLbl}` : null);
  const tipProjF =
    tipProj ?? (projN != null ? `Projected GW total: ${projLbl}` : null);

  /** Fraction of the full track (0–100) covered by projected total bar. */
  const purpleLeftInProjBar = projW > 0 ? (liveW / projW) * 100 : 0;
  const purpleWidthInProjBar =
    projW > liveW && projW > 0 ? ((projW - liveW) / projW) * 100 : 0;

  const [open, setOpen] = useState(/** @type {null | 'live' | 'proj'} */ (null));
  const wrapRef = useRef(null);
  useDismissOnOutsidePointer(wrapRef, open != null, () => setOpen(null));

  const sticky =
    open === 'live' && tipLiveF ? tipLiveF : open === 'proj' && tipProjF ? tipProjF : null;

  return (
    <div className="live-gw-hbar" role="group" aria-label={ariaLabel} ref={wrapRef}>
      <div className="live-gw-hbar__track-col">
        <div className="live-gw-hbar__track">
          {projN != null ? (
            <button
              type="button"
              className="live-gw-hbar__proj"
              style={{ width: `${projW}%` }}
              title={tipProjF ?? undefined}
              aria-label={tipProjF ?? 'Projected gameweek total'}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => (o === 'proj' ? null : 'proj'));
              }}
            >
              {purpleWidthInProjBar > 11 ? (
                <span
                  className="live-gw-hbar__inbar live-gw-hbar__inbar--proj tabular"
                  style={{
                    left: `${purpleLeftInProjBar}%`,
                    width: `${purpleWidthInProjBar}%`,
                  }}
                >
                  {projLbl}
                </span>
              ) : projW > liveW && projN != null ? (
                <span
                  className="live-gw-hbar__inbar live-gw-hbar__inbar--proj live-gw-hbar__inbar--proj-narrow tabular"
                  style={{
                    left: `${purpleLeftInProjBar}%`,
                    width: `${Math.max(purpleWidthInProjBar, 6)}%`,
                  }}
                >
                  {projLbl}
                </span>
              ) : null}
            </button>
          ) : null}
          {liveN != null ? (
            <button
              type="button"
              className="live-gw-hbar__live tabular"
              style={{ width: `${liveW}%` }}
              title={tipLiveF ?? undefined}
              aria-label={tipLiveF ?? 'Live GW points so far'}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => (o === 'live' ? null : 'live'));
              }}
            >
              {liveW > 9 ? (
                <span className="live-gw-hbar__inbar live-gw-hbar__inbar--live">{liveLbl}</span>
              ) : (
                <span className="live-gw-hbar__inbar live-gw-hbar__inbar--live live-gw-hbar__inbar--live-narrow">
                  {liveLbl}
                </span>
              )}
            </button>
          ) : null}
        </div>
        {sticky ? (
          <p className="live-gw-hbar__sticky-tip" role="status">
            {sticky}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Grid of GW fixtures: horizontal live bars with projected totals behind,
 * median winning GW score marker from finished H2H results (full league history).
 *
 * `medianGwWinScore` is the median of winners’ FPL points across all finished league matches
 * (from `matches`), not live squad totals for the selected GW.
 *
 * @param {{
 *   gameweek: number,
 *   gwMatches: object[],
 *   teams: object[],
 *   squadByLeagueEntry: Map<number, object>,
 *   teamLogoMap: object,
 *   kitIndexByEntry?: object,
 *   projectedGwByEntryId?: Map<number, number | null>,
 *   medianGwWinScore?: number | null,
 * }} props
 */
export function LiveFixtureGwPointsChart({
  gameweek,
  gwMatches,
  teams,
  squadByLeagueEntry,
  teamLogoMap,
  kitIndexByEntry,
  projectedGwByEntryId,
  medianGwWinScore,
}) {
  const clusters = useMemo(() => {
    if (!Array.isArray(gwMatches) || gwMatches.length === 0) return [];
    const projMap =
      projectedGwByEntryId instanceof Map ? projectedGwByEntryId : null;
    return gwMatches.map((m) => {
      const homeId = Number(m.league_entry_1);
      const awayId = Number(m.league_entry_2);
      const homeName = teamNameForEntry(teams, homeId);
      const awayName = teamNameForEntry(teams, awayId);
      const homeLive = liveGwDisplayTotal(squadByLeagueEntry.get(homeId));
      const awayLive = liveGwDisplayTotal(squadByLeagueEntry.get(awayId));
      const homeNum =
        homeLive != null && Number.isFinite(Number(homeLive)) ? Number(homeLive) : null;
      const awayNum =
        awayLive != null && Number.isFinite(Number(awayLive)) ? Number(awayLive) : null;
      const hp = projMap?.get(homeId);
      const ap = projMap?.get(awayId);
      const homeProj =
        typeof hp === 'number' && Number.isFinite(hp) ? hp : null;
      const awayProj =
        typeof ap === 'number' && Number.isFinite(ap) ? ap : null;
      const fixtureTitle = `${homeName} vs ${awayName}`;
      return {
        key: `${homeId}-${awayId}-${Number(gameweek)}`,
        homeId,
        awayId,
        homeName,
        awayName,
        homeNum,
        awayNum,
        homeProj,
        awayProj,
        fixtureTitle,
      };
    });
  }, [gwMatches, teams, squadByLeagueEntry, gameweek, projectedGwByEntryId]);

  const maxVal = useMemo(() => {
    const nums = [];
    for (const c of clusters) {
      if (c.homeNum != null) nums.push(c.homeNum);
      if (c.awayNum != null) nums.push(c.awayNum);
      if (c.homeProj != null) nums.push(c.homeProj);
      if (c.awayProj != null) nums.push(c.awayProj);
    }
    if (medianGwWinScore != null && Number.isFinite(Number(medianGwWinScore))) {
      nums.push(Number(medianGwWinScore));
    }
    return Math.max(1, ...(nums.length ? nums : [0]));
  }, [clusters, medianGwWinScore]);

  if (!clusters.length) return null;

  const gwLabel = Number(gameweek);
  const medianN =
    medianGwWinScore != null && Number.isFinite(Number(medianGwWinScore))
      ? Number(medianGwWinScore)
      : null;
  const medianLeftPct = medianN != null ? pctWidth(medianN, maxVal) : null;
  const medianLabel =
    medianN != null ? String(Math.round(medianN)) : '';

  return (
    <div
      className="live-gw-bars"
      role="region"
      aria-label={`Gameweek ${gwLabel} live fantasy points by head-to-head fixture`}
    >
      <div className="live-gw-bars__grid">
        {clusters.map((c) => {
          const homePtsLabel = c.homeNum == null ? '—' : String(c.homeNum);
          const awayPtsLabel = c.awayNum == null ? '—' : String(c.awayNum);
          const homeTipLive =
            c.homeNum != null ? `Current score (live): ${Math.round(c.homeNum)}` : null;
          const awayTipLive =
            c.awayNum != null ? `Current score (live): ${Math.round(c.awayNum)}` : null;
          const homeTipProj =
            c.homeProj != null ? `Projected GW total: ${Math.round(c.homeProj)}` : null;
          const awayTipProj =
            c.awayProj != null ? `Projected GW total: ${Math.round(c.awayProj)}` : null;
          const ariaFixture = `${c.homeName}, ${homePtsLabel} points, versus ${c.awayName}, ${awayPtsLabel} points`;
          return (
            <div
              key={c.key}
              className="live-gw-tile"
              role="group"
              aria-label={ariaFixture}
            >
              <div className="live-gw-tile__header" title={c.fixtureTitle}>
                {c.fixtureTitle}
              </div>
              <div className="live-gw-tile__body">
                <div className="live-gw-tile__stack" aria-hidden="true">
                  <TeamAvatar
                    entryId={c.homeId}
                    name={c.homeName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <TeamAvatar
                    entryId={c.awayId}
                    name={c.awayName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </div>
                <div className="live-gw-tile__plots">
                  {medianLeftPct != null && medianLabel ? (
                    <MedianMarker leftPct={medianLeftPct} valueLabel={medianLabel} />
                  ) : null}
                  <HorizontalPointsRow
                    live={c.homeNum}
                    proj={c.homeProj}
                    maxVal={maxVal}
                    tipLive={homeTipLive}
                    tipProj={homeTipProj}
                    ariaLabel={`${c.homeName}: live ${homePtsLabel}, projected ${
                      c.homeProj == null ? 'unavailable' : String(Math.round(c.homeProj))
                    }`}
                  />
                  <HorizontalPointsRow
                    live={c.awayNum}
                    proj={c.awayProj}
                    maxVal={maxVal}
                    tipLive={awayTipLive}
                    tipProj={awayTipProj}
                    ariaLabel={`${c.awayName}: live ${awayPtsLabel}, projected ${
                      c.awayProj == null ? 'unavailable' : String(Math.round(c.awayProj))
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}