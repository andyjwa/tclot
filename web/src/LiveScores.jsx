import {
  useMemo,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { TeamAvatar } from './TeamAvatar';
import { PlayerContributions } from './PlayerContributions';
import { useLiveScores } from './useLiveScores';
import { eventNameToGameWeekLabel, gameWeekSelectLabel } from './gwLabel.js';
import { GameWeekSelectOptgroups } from './GameWeekSelectOptgroups.jsx';
import { LiveRefreshIconButton } from './LiveRefreshIconButton.jsx';
import { usePlayerHistory, ClickablePlayerName } from './PlayerHistoryContext.jsx';
import { heroDefeatEntryIds, villainVictoryEntryIds } from './gwRawPointsRankSeason.js';
import { DEFAULT_MODEL_CONFIG } from 'fpl-predictions';
import { liveGwDisplayTotal } from './liveGwTotals.js';
import { LiveFixtureGwPointsChart } from './LiveFixtureGwPointsChart.jsx';
import { LiveProjectionsPanel } from './LiveProjectionsPanel.jsx';
import {
  bootstrapTeamToPredictionTeam,
  simulateFantasyH2hPercents,
  simulateFantasyH2hPercentsFromProjBlends,
  projectionRng as makePredictionRng,
} from './livePredictionMappers.js';
import {
  monteCarloBlendFromLiveBlend,
  projectedGwTotalLiveBlendForElement,
} from './liveGwMidProjection.js';

/**
 * Mins cell: green ≥60; red 0 after club’s GW fixture(s) finished; yellow 2–59.
 */
function livePickMinsCellClass(r) {
  const m = Number(r.minutes) || 0;
  if (m >= 60) return 'live-pick-cell--green';
  if (m === 0 && r.clubGwFixturesFinished === true) return 'live-pick-cell--red';
  if (m > 1 && m < 60) return 'live-pick-cell--yellow';
  return '';
}

/** Matches `live-picks-table-wrap--lineup-portrait` CSS breakpoint. */
const PORTRAIT_LINEUP_MQ = '(max-width: 560px) and (orientation: portrait)';

function usePortraitLineupMatch() {
  const subscribe = useCallback((onChange) => {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia(PORTRAIT_LINEUP_MQ);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(PORTRAIT_LINEUP_MQ).matches;
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** DC cell: DEF ≥10, MID/FWD ≥12 (FPL defensive contribution count) */
function livePickDcGreen(r) {
  const dc = Number(r.dcCount) || 0;
  const pos = r.posSingular;
  if (pos === 'DEF') return dc >= 10;
  if (pos === 'MID' || pos === 'FWD') return dc >= 12;
  return false;
}

function KitThumb({ shirtUrl, badgeUrl, teamShort }) {
  const src = shirtUrl || badgeUrl;
  if (!src) {
    return (
      <span className="live-kit-fallback" title={teamShort}>
        {teamShort?.slice(0, 3) ?? '?'}
      </span>
    );
  }
  return (
    <img
      className="live-kit-img"
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        if (shirtUrl && badgeUrl && img.src.includes(String(shirtUrl))) {
          img.src = badgeUrl;
        }
      }}
    />
  );
}

/**
 * @param {{ rows: object[], autosubInElementIds?: Set<number>, onPlayerClick?: (row: object) => void }} props
 */
function PicksTable({ rows, autosubInElementIds, onPlayerClick }) {
  const portraitLineup = usePortraitLineupMatch();
  if (!rows.length) return <p className="muted muted--tight">No picks</p>;
  return (
    <div className="table-scroll">
      <table className="live-picks-table">
        <colgroup>
          <col className="live-picks-col-player" />
          <col className="live-picks-col-pos" />
          <col className="live-picks-col-num live-picks-col-mins" />
          <col className="live-picks-col-num live-picks-col-dc" />
          <col className="live-picks-col-num live-picks-col-goals" />
          <col className="live-picks-col-num live-picks-col-assists" />
          <col className="live-picks-col-num live-picks-col-bonus" />
          <col className="live-picks-col-alarm" />
          <col className="live-picks-col-num live-picks-col-pts" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="live-picks-col-player">
              Player
            </th>
            <th scope="col" className="live-picks-col-pos">
              Pos
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-mins"
              title="Minutes"
            >
              Mins
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-dc"
              title="Defensive contributions this gameweek (FPL live stats)"
            >
              DC
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-goals"
              title="Goals scored this gameweek"
              aria-label="Goals"
            >
              <span aria-hidden="true">⚽</span>
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-assists"
              title="Assists this gameweek"
              aria-label="Assists"
            >
              <span aria-hidden="true">🍑</span>
            </th>
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-bonus"
              title="FPL stats.bonus when &gt;0; else BPS estimate while live. After all of this club’s GW fixtures are full-time, if FPL still shows 0 bonus the estimate is dropped so it won’t freeze vs the official site."
            >
              Bonus
            </th>
            <th
              scope="col"
              className="live-picks-col-alarm live-picks-col-alarm--head"
              aria-label="Defensive contribution highlight"
              title="Shows when FPL awards exactly 2 pts from defensive contributions in live explain."
            />
            <th
              scope="col"
              className="live-picks-col-num live-picks-col-pts live-picks-col-pts--split"
              title="Live FPL points; bonus in the total matches the Bonus column (including BPS estimate when not yet posted)."
            >
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const minsTone = livePickMinsCellClass(r);
            const playerColName = r.displayName ?? r.web_name ?? '—';
            const fullLabel = `${playerColName}${r.opponentShortLabel ? ` (${r.opponentShortLabel})` : ''} · #${r.element}${r.teamName ? ` · ${r.teamName}` : ''}`;
            return (
            <tr key={`${r.pickPosition}-${r.element}`}>
              <td className="live-picks-col-player">
                <div className="live-player-cell">
                  <KitThumb
                    shirtUrl={r.shirtUrl}
                    badgeUrl={r.badgeUrl}
                    teamShort={r.teamShort}
                  />
                  <div className="live-player-text">
                    <div className="live-player-name-row">
                      {onPlayerClick ? (
                        <button
                          type="button"
                          className={
                            'live-player-name live-player-name--btn' +
                            (portraitLineup ? ' live-player-name--lineup-portrait' : '')
                          }
                          title={`${fullLabel} — view season history`}
                          onClick={() => onPlayerClick(r)}
                        >
                          {playerColName}
                          {r.opponentShortLabel ? (
                            <span className="live-player-opponent">
                              {' '}
                              ({r.opponentShortLabel})
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <div
                          className={
                            'live-player-name' +
                            (portraitLineup ? ' live-player-name--lineup-portrait' : '')
                          }
                          title={fullLabel}
                        >
                          {playerColName}
                          {r.opponentShortLabel ? (
                            <span className="live-player-opponent">
                              {' '}
                              ({r.opponentShortLabel})
                            </span>
                          ) : null}
                        </div>
                      )}
                      {r.availabilityStatus === 'i' ? (
                        <span
                          className="live-player-injury"
                          title={
                            r.availabilityNews?.trim()
                              ? r.availabilityNews
                              : 'Injured'
                          }
                          aria-label="Injured"
                          role="img"
                        >
                          🚑
                        </span>
                      ) : null}
                      {autosubInElementIds?.has(r.element) ? (
                        <span
                          className="live-player-autosub"
                          title="Autosubbed in from the bench"
                          aria-label="Autosubbed in from the bench"
                          role="img"
                        >
                          🔄
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="live-picks-col-pos tabular">{r.posSingular}</td>
              <td
                className={['live-picks-col-num', 'live-picks-col-mins', 'tabular', minsTone]
                  .filter(Boolean)
                  .join(' ')}
              >
                {r.minutes}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-dc tabular' +
                  (livePickDcGreen(r) ? ' live-pick-cell--green' : '')
                }
              >
                {r.dcCount}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-goals tabular' +
                  ((Number(r.goalsScored) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.goalsScored}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-assists tabular' +
                  ((Number(r.assists) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.assists}
              </td>
              <td
                className={
                  'live-picks-col-num live-picks-col-bonus tabular' +
                  ((Number(r.bonus) || 0) > 0 ? ' live-pick-cell--green' : '')
                }
              >
                {r.bonus}
              </td>
              <td className="live-picks-col-alarm tabular" />
              <td className="live-picks-col-num live-picks-col-pts live-picks-col-pts--split tabular">
                <strong>{r.total_points}</strong>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 3 / 1 / 0 from live GW score vs opponent (same as H2H table stakes). */
function liveH2hBonusPts(myLive, oppLive) {
  if (myLive == null || oppLive == null) return 0;
  if (myLive > oppLive) return 3;
  if (myLive < oppLive) return 0;
  return 1;
}

/** GW column: league points from the live fixture (+3 / +1 / 0). */
function formatGwLeaguePtsBonus(h2hBonus) {
  if (h2hBonus === 3) return '+3';
  if (h2hBonus === 1) return '+1';
  return '0';
}

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
}

/**
 * All `matches` rows between two `league_entry` ids this season (tile home/away = banner sides).
 * Winner-first score in each chip (e.g. 34–21). For draws, home tile score first (same order as FPL row).
 * Uses live GW XI totals when this row is the active gameweek pairing.
 */
function seasonH2hBetween(matches, homeId, awayId, gameweek, liveHomePts, liveAwayPts) {
  const h = Number(homeId);
  const a = Number(awayId);
  const gwNum = Number(gameweek);
  const homeWins = [];
  const awayWins = [];
  const draws = [];
  for (const m of matches || []) {
    const e1 = Number(m.league_entry_1);
    const e2 = Number(m.league_entry_2);
    if (!Number.isFinite(e1) || !Number.isFinite(e2)) continue;
    if ((e1 !== h || e2 !== a) && (e1 !== a || e2 !== h)) continue;

    const ev = Number(m.event);
    let hp;
    let ap;
    if (Number.isFinite(ev) && ev === gwNum && liveHomePts != null && liveAwayPts != null) {
      hp = liveHomePts;
      ap = liveAwayPts;
    } else {
      const p1 = Number(m.league_entry_1_points);
      const p2 = Number(m.league_entry_2_points);
      if (!Number.isFinite(p1) || !Number.isFinite(p2)) continue;
      hp = e1 === h ? p1 : p2;
      ap = e1 === h ? p2 : p1;
    }

    if (hp > ap) {
      homeWins.push({ gw: ev, label: `${hp}-${ap}` });
    } else if (ap > hp) {
      awayWins.push({ gw: ev, label: `${ap}-${hp}` });
    } else {
      draws.push({ gw: ev, label: `${hp}-${ap}` });
    }
  }
  const byGw = (x, y) => x.gw - y.gw;
  homeWins.sort(byGw);
  awayWins.sort(byGw);
  draws.sort(byGw);
  return { homeWins, awayWins, draws };
}

/**
 * @param {{ homeId: number, awayId: number, homeName: string, awayName: string, matches: object[], gameweek: number, liveHomePts: number | null | undefined, liveAwayPts: number | null | undefined, teamLogoMap: object, kitIndexByEntry?: object }} props
 */
function LiveFixtureSeasonH2h({
  homeId,
  awayId,
  homeName,
  awayName,
  matches,
  gameweek,
  liveHomePts,
  liveAwayPts,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const { homeWins, awayWins, draws } = useMemo(
    () =>
      seasonH2hBetween(matches, homeId, awayId, gameweek, liveHomePts, liveAwayPts),
    [matches, homeId, awayId, gameweek, liveHomePts, liveAwayPts],
  );
  const hasAny = homeWins.length + awayWins.length + draws.length > 0;

  return (
    <div className="live-fixture-season-h2h" aria-label="Season head-to-head">
      <h4 className="live-fixture-season-h2h__heading">Season H2H</h4>
      {!hasAny ? (
        <p className="muted muted--tight live-fixture-season-h2h__empty">
          No scored head-to-heads in league data for this pair yet.
        </p>
      ) : (
        <>
          <div className="live-fixture-season-h2h__row">
            <div className="live-fixture-season-h2h__side">
              <TeamAvatar
                entryId={homeId}
                name={homeName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <div className="live-fixture-season-h2h__chips">
                {homeWins.map((x) => (
                  <span
                    key={`h2h-h-${homeId}-${awayId}-${x.gw}`}
                    className="live-h2h-chip live-h2h-chip--win tabular"
                    title={`GW ${x.gw}: ${homeName} ${x.label}`}
                  >
                    {x.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="live-fixture-season-h2h__side live-fixture-season-h2h__side--away">
              <TeamAvatar
                entryId={awayId}
                name={awayName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <div className="live-fixture-season-h2h__chips">
                {awayWins.map((x) => (
                  <span
                    key={`h2h-a-${homeId}-${awayId}-${x.gw}`}
                    className="live-h2h-chip live-h2h-chip--win tabular"
                    title={`GW ${x.gw}: ${awayName} ${x.label}`}
                  >
                    {x.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {draws.length > 0 ? (
            <div className="live-fixture-season-h2h__draws">
              <span className="live-fixture-season-h2h__draws-label">Draws</span>
              <div className="live-fixture-season-h2h__chips">
                {draws.map((x) => (
                  <span
                    key={`h2h-d-${homeId}-${awayId}-${x.gw}`}
                    className="live-h2h-chip live-h2h-chip--draw tabular"
                    title={`GW ${x.gw}: draw ${x.label}`}
                  >
                    {x.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function squadsToGwPointsMap(squads) {
  const pointsByEntryId = new Map();
  for (const s of squads || []) {
    const id = Number(s.leagueEntryId);
    const pts = liveGwDisplayTotal(s);
    if (!Number.isFinite(id) || pts == null || !Number.isFinite(Number(pts))) continue;
    pointsByEntryId.set(id, Number(pts));
  }
  return pointsByEntryId;
}

/** @param {object[]} squads @param {object[]} gwMatches */
function villainVictoryLeagueEntryIds(squads, gwMatches) {
  return villainVictoryEntryIds(squadsToGwPointsMap(squads), gwMatches);
}

/** @param {object[]} squads @param {object[]} gwMatches */
function heroDefeatLeagueEntryIds(squads, gwMatches) {
  return heroDefeatEntryIds(squadsToGwPointsMap(squads), gwMatches);
}

const H2H_WIN_PCT_CONFIG = { ...DEFAULT_MODEL_CONFIG, simulationIterations: 450 };

/**
 * Collect per-player {projFinal, remaining} blends for exactly 11 starters.
 * Returns null if any player is missing from context.
 */
function buildProjBlendsForPicks(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  if (!Array.isArray(picks) || picks.length !== 11) return null;
  const blends = [];
  for (let i = 0; i < 11; i++) {
    const pid = Number(picks[i]?.element);
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        el,
        blendCtx,
        teamsById,
        gw,
        H2H_WIN_PCT_CONFIG,
        liveByEl[pid],
        makePredictionRng(pid, 990_011 + gw + i * 31),
        320,
        Number(picks[i]?.fplMultiplier) || 1,
      );
      blends.push(monteCarloBlendFromLiveBlend(blend, picks[i]));
    } catch {
      return null;
    }
  }
  return blends;
}

/** Sum projected GW totals for 11 starters; matches `buildProjBlendsForPicks` RNG seeds. */
function sumProjectedGwForStarters(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  if (!Array.isArray(picks) || picks.length !== 11) return null;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const pid = Number(picks[i]?.element);
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        el,
        blendCtx,
        teamsById,
        gw,
        H2H_WIN_PCT_CONFIG,
        liveByEl[pid],
        makePredictionRng(pid, 990_011 + gw + i * 31),
        320,
        Number(picks[i]?.fplMultiplier) || 1,
      );
      sum += monteCarloBlendFromLiveBlend(blend, picks[i]).projFinal;
    } catch {
      return null;
    }
  }
  return sum;
}


/** Joker + “Villain Detected” for live tiles (image in `public/villain-detected.png`). */
function VillainDetectedBadge({ variant = 'default' }) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const src = `${base}villain-detected.png`;
  const compact = variant === 'compact';
  return (
    <span
      className={
        'live-villain-detected' +
        (compact ? ' live-villain-detected--compact' : '')
      }
      role="img"
      aria-label="Villain detected: winning this head-to-head gameweek on live points while ranked 7th in the league for raw gameweek total"
    >
      <img
        className="live-villain-detected__img"
        src={src}
        alt=""
        width={compact ? 32 : 40}
        height={compact ? 32 : 40}
        decoding="async"
        loading="lazy"
      />
      <span className="live-villain-detected__label" aria-hidden="true">
        Villain Detected
      </span>
    </span>
  );
}

/** Bonnie Tyler cover + “Hero Defeat” (`public/hero-defeat.png`). */
function HeroDefeatBadge({ variant = 'default' }) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const src = `${base}hero-defeat.png`;
  const compact = variant === 'compact';
  return (
    <span
      className={
        'live-hero-defeat' +
        (compact ? ' live-hero-defeat--compact' : '')
      }
      role="img"
      aria-label="Hero defeat: 2nd-highest raw gameweek score in the league but losing this head-to-head on live points"
    >
      <img
        className="live-hero-defeat__img"
        src={src}
        alt=""
        width={compact ? 32 : 38}
        height={compact ? 46 : 52}
        decoding="async"
        loading="lazy"
      />
      <span className="live-hero-defeat__label" aria-hidden="true">
        Hero Defeat
      </span>
    </span>
  );
}

/** Effective XI rows (post-autosub when available). */
function startersForEffectiveXi(squad) {
  if (!squad || squad.error) return [];
  const nBench = squad.bench?.length ?? 0;
  if (
    squad.displayStarters?.length === 11 &&
    squad.displayBench?.length === nBench
  ) {
    return squad.displayStarters;
  }
  return squad.starters ?? [];
}

/** Element ids on this squad’s submitted picks (starters ∪ bench) — guards against stale/mixed rows. */
function pickElementIdSet(squad) {
  const s = new Set();
  for (const r of squad?.starters ?? []) {
    if (r?.element != null) s.add(r.element);
  }
  for (const r of squad?.bench ?? []) {
    if (r?.element != null) s.add(r.element);
  }
  return s;
}

/** FPL `web_name` (e.g. Martinez) — matches game UI better than derived displayName. */
function formatPlayerLtpSegment(r) {
  const name = String(r.web_name ?? r.displayName ?? '').trim() || '?';
  const opp = r.opponentShortLabel ?? '—';
  return `${name} (${opp})`;
}

const LEFT_TO_PLAY_TITLE =
  'Total fixtures left for the effective starting XI: each starter adds their own remaining club fixtures they can still score from (double gameweeks: up to two per player).';

/** Bracketed count after the team name (both sides — keeps layout symmetrical). */
function LeftToPlayOutsideAfter({ count, leadingSpace = true }) {
  if (typeof count !== 'number') return null;
  return (
    <span className="live-left-to-play tabular" title={LEFT_TO_PLAY_TITLE}>
      {leadingSpace ? ' ' : null}
      ({count})
    </span>
  );
}

/** @param {{ squad: object, onPlayerClick?: (row: object) => void }} */
function SquadLineupPanel({ squad, onPlayerClick }) {
  if (!squad) {
    return <p className="muted muted--tight">No squad data for this team.</p>;
  }
  if (squad.error) {
    return <p className="muted">{squad.error}</p>;
  }

  const nBench = squad.bench?.length ?? 0;
  const useEffective =
    squad.displayStarters?.length === 11 && squad.displayBench?.length === nBench;
  const starters = useEffective ? squad.displayStarters : squad.starters;
  const bench = useEffective ? squad.displayBench : squad.bench;

  const allRows = [...squad.starters, ...squad.bench];
  const subsToShow =
    squad.autosubSource === 'official' && squad.autoSubs?.length
      ? squad.autoSubs
      : squad.autosubSource === 'projected' && squad.projectedAutoSubs?.length
        ? squad.projectedAutoSubs
        : [];

  const autosubInElementIds =
    useEffective && subsToShow.length > 0
      ? new Set(
          subsToShow
            .map((a) => Number(a.element_in))
            .filter((id) => Number.isFinite(id))
        )
      : undefined;

  return (
    <>
      {subsToShow.length ? (
        <div
          className={
            'live-auto-subs muted' +
            (squad.autosubSource === 'projected' ? ' live-auto-subs--projected' : '')
          }
          role="status"
        >
          <strong>
            {squad.autosubSource === 'official' ? 'Auto subs:' : 'Projected auto subs:'}
          </strong>{' '}
          {subsToShow.map((a) => {
            const rowIn = allRows.find((r) => r.element === Number(a.element_in));
            const rowOut = allRows.find((r) => r.element === Number(a.element_out));
            const nameIn = rowIn?.displayName ?? rowIn?.web_name ?? `#${a.element_in}`;
            const nameOut = rowOut?.displayName ?? rowOut?.web_name ?? `#${a.element_out}`;
            return (
              <span key={`${a.element_in}-${a.element_out}`} className="live-auto-sub-pair">
                <ClickablePlayerName
                  element={a.element_in}
                  displayName={rowIn?.displayName}
                  web_name={rowIn?.web_name ?? nameIn}
                  teamShort={rowIn?.teamShort}
                >
                  {nameIn}
                </ClickablePlayerName>
                {' '}
                ↔{' '}
                <ClickablePlayerName
                  element={a.element_out}
                  displayName={rowOut?.displayName}
                  web_name={rowOut?.web_name ?? nameOut}
                  teamShort={rowOut?.teamShort}
                >
                  {nameOut}
                </ClickablePlayerName>
              </span>
            );
          })}
          {squad.autosubSource === 'projected' ? (
            <span className="live-auto-subs__note">
              {' '}
              Provisional until FPL posts official autosubs.
            </span>
          ) : null}
        </div>
      ) : null}
      <h4 className="live-lineup-heading">Starting XI</h4>
      <div className="live-picks-table-wrap live-picks-table-wrap--lineup-portrait">
        <PicksTable
          rows={starters}
          autosubInElementIds={autosubInElementIds}
          onPlayerClick={onPlayerClick}
        />
      </div>
      <h4 className="live-lineup-heading live-lineup-heading--bench">Bench</h4>
      <div className="live-picks-table-wrap live-picks-table-wrap--lineup-portrait">
        <PicksTable rows={bench} onPlayerClick={onPlayerClick} />
      </div>
    </>
  );
}

function proxyHostLabel() {
  const raw = import.meta.env.VITE_FPL_PROXY_URL;
  if (raw == null || String(raw).trim() === '') return null;
  try {
    return new URL(String(raw).trim()).host;
  } catch {
    return null;
  }
}

function isLikelyLocalDev() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * @param {{ teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>, tableRows?: Array<object>, matches?: Array<{ event: number, league_entry_1: number, league_entry_2: number, finished?: boolean, league_entry_1_points?: number, league_entry_2_points?: number }>, gameweek: number, onGameweekChange: (n: number) => void, onBootstrapLiveMeta?: (meta: { currentGw: number | null }) => void, teamLogoMap: object, kitIndexByEntry?: object, leagueId?: number | null, waiverOutGwRows?: object[], fplDraftCurrentGw?: number | null, projectionsOnly?: boolean }}
 */
export function LiveScores({
  teams,
  tableRows = [],
  matches = [],
  gameweek,
  onGameweekChange,
  onBootstrapLiveMeta,
  teamLogoMap,
  kitIndexByEntry,
  leagueId = null,
  waiverOutGwRows = [],
  /** Draft bootstrap `events.current` — when the selected GW is earlier, standings use league totals only (no live +3 overlay). */
  fplDraftCurrentGw = null,
  /** When true, only the GW toolbar and {@link LiveProjectionsPanel} (FPL Live → Projections sub-tab). */
  projectionsOnly = false,
  /** Mobile app shell: hide tile h2; GW toolbar sticks below section sub-pills. */
  compactMobileChrome = false,
}) {
  const { loading, error, refresh, events, eventSnapshot, squads, contributionLiveContext, lastUpdated } =
    useLiveScores({
      teams,
      gameweek,
      enabled: true,
      onBootstrapLiveMeta,
      /** Hook only applies the interval when GW is current and not finished. */
      pollIntervalMs: 90_000,
    });

  /** Fixture keys in the set are expanded; default empty = all collapsed. */
  const [expandedFixtures, setExpandedFixtures] = useState(() => new Set());
  const toggleFixtureExpanded = useCallback((key) => {
    setExpandedFixtures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Single “fixtures left” panel for all H2H fixtures — collapsed by default. */
  const [ltpPanelExpanded, setLtpPanelExpanded] = useState(false);

  /** FPL element id + labels — opens slide-over season history from `element-summary`. */
  const { openPlayerHistory } = usePlayerHistory();

  const proxyHost = proxyHostLabel();

  const allMissingFplId =
    teams?.length > 0 && teams.every((t) => t.fplEntryId == null);

  const gwOptions = useMemo(() => {
    return (events || [])
      .filter((e) => e && e.id >= 1 && e.id <= 38)
      .map((e) => ({
        id: e.id,
        label: eventNameToGameWeekLabel(e.name, e.id),
        finished: e.finished,
        is_current: e.is_current,
        is_next: e.is_next,
      }));
  }, [events]);

  const selectedGwOption = useMemo(
    () => gwOptions.find((o) => Number(o.id) === Number(gameweek)),
    [gwOptions, gameweek],
  );

  const gwMatches = useMemo(() => {
    if (!Array.isArray(matches) || matches.length === 0) return [];
    return matches.filter((m) => Number(m.event) === Number(gameweek));
  }, [matches, gameweek]);

  const squadByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const s of squads) {
      m.set(s.leagueEntryId, s);
    }
    return m;
  }, [squads]);

  /** Opponent’s live GW total for this GW (for projected Faced / GD / H2H pts). */
  const oppLiveGwByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const fx of gwMatches) {
      const a = Number(fx.league_entry_1);
      const b = Number(fx.league_entry_2);
      const la = liveGwDisplayTotal(squadByLeagueEntry.get(a));
      const lb = liveGwDisplayTotal(squadByLeagueEntry.get(b));
      m.set(a, lb);
      m.set(b, la);
    }
    return m;
  }, [gwMatches, squadByLeagueEntry]);

  /**
   * Win percentages for each H2H fixture: pre-live uses xPts MC; live uses per-player Proj MC.
   * Keyed by `${homeId}-${awayId}-${gameweek}`.
   */
  const h2hWinPctByKey = useMemo(() => {
    const ctx = contributionLiveContext;
    if (!ctx?.elementById || !gwMatches.length) return new Map();
    const gw = Number(gameweek);
    if (!Number.isFinite(gw)) return new Map();

    const allFx = Array.isArray(ctx.gwFixtures) ? ctx.gwFixtures : [];
    const teamsById = new Map();
    for (const t of Object.values(ctx.teamById || {})) {
      const tm = bootstrapTeamToPredictionTeam(t);
      teamsById.set(tm.id, tm);
    }

    const gwIsLive = allFx.some((f) => f?.started === true);
    const liveByEl = ctx.liveFullByElementId || {};
    const blendCtx = { gwFixtures: allFx };
    const result = new Map();

    for (const m of gwMatches) {
      const homeId = Number(m.league_entry_1);
      const awayId = Number(m.league_entry_2);
      const sqH = squadByLeagueEntry.get(homeId);
      const sqA = squadByLeagueEntry.get(awayId);
      const stH =
        sqH?.displayStarters?.length === 11 ? sqH.displayStarters : (sqH?.starters ?? []);
      const stA =
        sqA?.displayStarters?.length === 11 ? sqA.displayStarters : (sqA?.starters ?? []);
      const key = `${homeId}-${awayId}-${gw}`;
      const rnd = makePredictionRng(homeId, awayId);

      if (gwIsLive && stH.length === 11 && stA.length === 11) {
        const hBlends = buildProjBlendsForPicks(stH, ctx, teamsById, gw, blendCtx, liveByEl);
        const aBlends = buildProjBlendsForPicks(stA, ctx, teamsById, gw, blendCtx, liveByEl);
        if (hBlends && aBlends) {
          const pct = simulateFantasyH2hPercentsFromProjBlends(hBlends, aBlends, rnd, 1500, {
            homeXiFixturesLeft: sqH?.leftToPlayCount,
            awayXiFixturesLeft: sqA?.leftToPlayCount,
          });
          if (pct) {
            result.set(key, { ...pct, isLive: true });
            continue;
          }
        }
      }

      if (stH.length === 11 && stA.length === 11) {
        const pct = simulateFantasyH2hPercents(
          stH, stA, ctx, teamsById, gw, H2H_WIN_PCT_CONFIG, rnd, 1500,
        );
        if (pct) result.set(key, { ...pct, isLive: false });
      }
    }
    return result;
  }, [contributionLiveContext, gwMatches, gameweek, squadByLeagueEntry]);

  /** Per-entry projected GW total (live blend); null when lineup or context incomplete. */
  const projectedGwByEntryId = useMemo(() => {
    const m = new Map();
    const ctx = contributionLiveContext;
    if (!ctx?.elementById || !gwMatches.length) return m;
    const gw = Number(gameweek);
    if (!Number.isFinite(gw)) return m;

    const allFx = Array.isArray(ctx.gwFixtures) ? ctx.gwFixtures : [];
    const teamsById = new Map();
    for (const t of Object.values(ctx.teamById || {})) {
      const tm = bootstrapTeamToPredictionTeam(t);
      teamsById.set(tm.id, tm);
    }
    const blendCtx = { gwFixtures: allFx };
    const liveByEl = ctx.liveFullByElementId || {};

    const entryIds = new Set();
    for (const fx of gwMatches) {
      entryIds.add(Number(fx.league_entry_1));
      entryIds.add(Number(fx.league_entry_2));
    }
    for (const id of entryIds) {
      const sq = squadByLeagueEntry.get(id);
      const st =
        sq?.displayStarters?.length === 11
          ? sq.displayStarters
          : (sq?.starters ?? []);
      if (st.length !== 11) {
        m.set(id, null);
        continue;
      }
      const sum = sumProjectedGwForStarters(
        st,
        ctx,
        teamsById,
        gw,
        blendCtx,
        liveByEl,
      );
      m.set(id, sum);
    }
    return m;
  }, [contributionLiveContext, gwMatches, gameweek, squadByLeagueEntry]);

  /**
   * Median FPL points among winning sides in **finished** head-to-head matches (full season),
   * from league `matches` — not the current GW’s live polling totals.
   */
  const medianGwWinScore = useMemo(() => {
    const winners = [];
    for (const m of matches) {
      if (!m?.finished) continue;
      const p1 = Number(m.league_entry_1_points);
      const p2 = Number(m.league_entry_2_points);
      if (!Number.isFinite(p1) || !Number.isFinite(p2)) continue;
      if (p1 > p2) winners.push(p1);
      else if (p2 > p1) winners.push(p2);
    }
    if (!winners.length) return null;
    winners.sort((x, y) => x - y);
    const mid = Math.floor(winners.length / 2);
    return winners.length % 2 === 1
      ? winners[mid]
      : (winners[mid - 1] + winners[mid]) / 2;
  }, [matches]);

  /**
   * When “frozen”, PTS / For / Faced come from league `standings` only (no live +3 overlay).
   * FPL sometimes leaves `matches[].finished` false briefly after scores settle, and
   * `events.data[id].finished` can lag — so also freeze when the user is viewing a GW **before**
   * draft `events.current` (FPL has rolled the calendar to a later GW).
   */
  const gwStandingsFrozen = useMemo(() => {
    const cur = Number(fplDraftCurrentGw);
    const gw = Number(gameweek);
    const viewingPastGw =
      Number.isFinite(cur) && Number.isFinite(gw) && gw < cur;
    return (
      Boolean(eventSnapshot?.finished) ||
      (gwMatches.length > 0 && gwMatches.every((m) => m.finished)) ||
      viewingPastGw
    );
  }, [eventSnapshot?.finished, gwMatches, gameweek, fplDraftCurrentGw]);

  /**
   * Projected For / Faced / GD / PTS from this GW’s live fixtures, then sorted by projected PTS,
   * then For, then GD. `liveRank` = competition rank (ties share a #). `rankMove` uses ordinal
   * list position (i + 1) vs season rank so movement still shows inside tied groups.
   *
   * When this GW is already finished, league `tableRows` totals (PTS, For, Faced) already include
   * it — do not add live H2H points or GW FPL totals again (would double-count e.g. +3).
   */
  const liveStandingsRows = useMemo(() => {
    if (!Array.isArray(tableRows) || tableRows.length === 0) return [];
    const enriched = tableRows.map((row) => {
      const eid = row.league_entry;
      const squad = squadByLeagueEntry.get(eid);
      const liveGw = liveGwDisplayTotal(squad);
      const inFixture = oppLiveGwByLeagueEntry.has(eid);
      const oppLiveGw = inFixture ? oppLiveGwByLeagueEntry.get(eid) : null;

      const gf = Number(row.gf) || 0;
      const ga = Number(row.ga) || 0;
      const total = Number(row.total) || 0;
      const addMine =
        gwStandingsFrozen || liveGw == null ? 0 : liveGw;
      const addOpp =
        gwStandingsFrozen ||
        !inFixture ||
        oppLiveGw == null ||
        !Number.isFinite(Number(oppLiveGw))
          ? 0
          : Number(oppLiveGw);

      const projectedFor = gf + addMine;
      const projectedGa = ga + addOpp;
      const projectedGd = projectedFor - projectedGa;
      const h2hBonus =
        inFixture && liveGw != null && oppLiveGw != null
          ? liveH2hBonusPts(liveGw, oppLiveGw)
          : 0;
      const projectedPts = gwStandingsFrozen ? total : total + h2hBonus;

      return {
        ...row,
        liveGw,
        oppLiveGw: inFixture ? oppLiveGw : null,
        projectedFor,
        projectedGa,
        projectedGd,
        h2hBonus,
        projectedPts,
      };
    });
    const sorted = [...enriched].sort((a, b) => {
      const d = (b.projectedPts ?? 0) - (a.projectedPts ?? 0);
      if (d !== 0) return d;
      const f = (b.projectedFor ?? 0) - (a.projectedFor ?? 0);
      if (f !== 0) return f;
      const g = (b.projectedGd ?? 0) - (a.projectedGd ?? 0);
      if (g !== 0) return g;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    let currentLiveRank = 0;
    return sorted.map((row, i) => {
      if (i === 0 || row.projectedPts !== sorted[i - 1].projectedPts) {
        currentLiveRank = i + 1;
      }
      const liveRank = currentLiveRank;
      const ordinalLive = i + 1;
      const rankMove = (row.rank ?? 999) - ordinalLive;
      return { ...row, liveRank, ordinalLive, rankMove };
    });
  }, [tableRows, squadByLeagueEntry, oppLiveGwByLeagueEntry, gwStandingsFrozen]);

  const liveRankByEntry = useMemo(() => {
    const o = {};
    for (const row of liveStandingsRows) {
      const eid = row.league_entry;
      o[eid] = row.liveRank;
      o[String(eid)] = row.liveRank;
    }
    return o;
  }, [liveStandingsRows]);

  const villainVictoryEntryIds = useMemo(
    () => villainVictoryLeagueEntryIds(squads, gwMatches),
    [squads, gwMatches]
  );

  const heroDefeatEntryIds = useMemo(
    () => heroDefeatLeagueEntryIds(squads, gwMatches),
    [squads, gwMatches]
  );

  /** One object per H2H fixture with both sides’ fixture totals and player lines. */
  const leftToPlayByFixture = useMemo(() => {
    if (!gwMatches.length) return [];
    const buildSide = (leagueEntryId) => {
      const squad = squadByLeagueEntry.get(leagueEntryId);
      const name =
        squad?.teamName ?? teamNameForEntry(teams, leagueEntryId);
      const live = liveGwDisplayTotal(squad);
      const xi = startersForEffectiveXi(squad);
      const allowed = pickElementIdSet(squad);
      const ltpRows = xi
        .filter((r) => allowed.has(r.element))
        .filter((r) => Number(r.playerGamesLeftToPlay) > 0);
      const segments = ltpRows.map(formatPlayerLtpSegment);
      const ltpGamesCount = ltpRows.reduce((sum, r) => {
        const n = Number(r.playerGamesLeftToPlay);
        return sum + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0);
      return { leagueEntryId, name, live, segments, ltpGamesCount };
    };
    return gwMatches.map((m) => {
      const homeId = Number(m.league_entry_1);
      const awayId = Number(m.league_entry_2);
      return {
        key: `${homeId}-${awayId}-${Number(gameweek)}`,
        home: buildSide(homeId),
        away: buildSide(awayId),
      };
    });
  }, [gwMatches, teams, squadByLeagueEntry, gameweek]);

  const pairedLeagueEntryIds = useMemo(() => {
    const s = new Set();
    for (const m of gwMatches) {
      s.add(Number(m.league_entry_1));
      s.add(Number(m.league_entry_2));
    }
    return s;
  }, [gwMatches]);

  const orphanSquads = useMemo(
    () => squads.filter((q) => !pairedLeagueEntryIds.has(q.leagueEntryId)),
    [squads, pairedLeagueEntryIds]
  );

  const useFixtureLayout = gwMatches.length > 0;

  return (
    <div
      className={
        'dashboard-stack live-scores-root' +
        (compactMobileChrome ? ' live-scores-root--compact-chrome' : '')
      }
    >
      <section
        className={
          compactMobileChrome ? 'live-scores-chrome' : 'tile tile--compact'
        }
        aria-labelledby="live-heading"
      >
        <h2
          id="live-heading"
          className={
            'tile-title tile-title--sm' +
            (compactMobileChrome ? ' live-heading--hide-mobile' : '')
          }
        >
          {projectionsOnly ? 'Projections' : 'Live GW'}
        </h2>

        {!proxyHost ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>No proxy in this JavaScript build.</strong>{' '}
            {isLikelyLocalDev() ? (
              <>
                For <strong>local dev</strong>, create <code>web/.env.local</code> with{' '}
                <code>
                  VITE_FPL_PROXY_URL=https://…workers.dev
                </code>{' '}
                (same URL as your Cloudflare Worker / GitHub secret). Copy{' '}
                <code>web/.env.local.example</code> → <code>.env.local</code>, edit the URL, then{' '}
                <strong>restart</strong> Vite (<code>Ctrl+C</code> and <code>npx vite</code> again).
              </>
            ) : (
              <>
                <code>VITE_FPL_PROXY_URL</code> was empty at build time, so the browser calls FPL
                directly and usually gets <em>Failed to fetch</em> on GitHub Pages. Add the secret,
                then <strong>re-run the deploy workflow</strong>. Check <code>deploy-check.json</code>{' '}
                — <code>liveProxyConfigured</code> should be <code>true</code>.
              </>
            )}
          </div>
        ) : null}

        {allMissingFplId ? (
          <div className="data-banner" role="status">
            <strong>No FPL entry ids</strong> — sample/demo <code>details.json</code> omits{' '}
            <code>entry_id</code> on each team. Ingest your real draft league so each manager has an{' '}
            <code>entry_id</code> (the number from the FPL game URL).
          </div>
        ) : null}

        <div
          className={
            'live-toolbar' +
            (compactMobileChrome ? ' live-toolbar--section-sticky' : '')
          }
        >
          <div className="live-gw-field">
            <div className="live-gw-input-row">
              <label className="live-gw-label">
                <select
                  className="live-gw-select"
                  aria-label="Game week"
                  value={gameweek}
                  onChange={(e) => onGameweekChange(Number(e.target.value))}
                >
                  {gwOptions.length ? (
                    <GameWeekSelectOptgroups options={gwOptions} />
                  ) : (
                    <option value={gameweek}>{gameWeekSelectLabel(gameweek)}</option>
                  )}
                </select>
              </label>
              {selectedGwOption?.finished ? (
                <span
                  className="live-gw-pill"
                  title="This game week is complete (all fixtures finished)"
                  aria-label="This game week is complete"
                >
                  FT
                </span>
              ) : null}
            </div>
          </div>
          <LiveRefreshIconButton
            title="Refresh from FPL"
            loading={Boolean(loading)}
            disabled={Boolean(loading)}
            onClick={() => void refresh()}
          />
        </div>

        {error ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load live data.</strong> {error}{' '}
            <span className="muted">
              {proxyHost ? (
                <>
                  The FPL proxy (<code>{proxyHost}</code>) may be unavailable or over its daily
                  request limit (Cloudflare Workers free tier). Wait until after midnight UTC, run{' '}
                  <code>npm run dev:vite</code> locally, or upgrade the Workers plan — see{' '}
                  <code>web/workers/fpl-proxy/README.md</code>.
                </>
              ) : isLikelyLocalDev() ? (
                <>
                  Restart Vite after adding <code>VITE_FPL_PROXY_URL</code> to{' '}
                  <code>web/.env.local</code>, or leave that unset so dev uses the built-in{' '}
                  <code>/__fpl</code> proxy.
                </>
              ) : (
                <>
                  On GitHub Pages, set <code>VITE_FPL_PROXY_URL</code> to your Worker (see{' '}
                  <code>web/workers/fpl-proxy/README.md</code>) and redeploy.
                </>
              )}
            </span>
          </div>
        ) : null}
      </section>

      {projectionsOnly ? (
        <LiveProjectionsPanel
          contributionLiveContext={contributionLiveContext}
          gameweek={gameweek}
          gwMatches={gwMatches}
          squads={squads}
          teams={teams}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          liveRankByEntry={liveRankByEntry}
        />
      ) : (
        <>
      <section
        className="tile tile--compact player-contrib-tile"
        aria-label="FPL live scores"
      >
        <PlayerContributions
          leagueId={leagueId}
          gameweek={gameweek}
          squads={squads}
          contributionLiveContext={contributionLiveContext}
          waiverOutGwRows={waiverOutGwRows}
          lastUpdated={lastUpdated}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      </section>

      {useFixtureLayout ? (
        <div
          className="live-fixtures-scroller"
          role="region"
          aria-label={`Gameweek ${gameweek} head-to-head fixtures`}
        >
          <div className="live-fixtures-scroller__track">
            {gwMatches.map((m) => {
            const homeId = Number(m.league_entry_1);
            const awayId = Number(m.league_entry_2);
            const homeName = teamNameForEntry(teams, homeId);
            const awayName = teamNameForEntry(teams, awayId);
            const homeSquad = squadByLeagueEntry.get(homeId);
            const awaySquad = squadByLeagueEntry.get(awayId);
            const homeLive = liveGwDisplayTotal(homeSquad);
            const awayLive = liveGwDisplayTotal(awaySquad);
            const homeLead =
              homeLive != null && awayLive != null && homeLive > awayLive;
            const awayLead =
              homeLive != null && awayLive != null && awayLive > homeLive;

            const homeLtp = homeSquad?.leftToPlayCount;
            const awayLtp = awaySquad?.leftToPlayCount;

            const homeVillain = villainVictoryEntryIds.has(homeId);
            const awayVillain = villainVictoryEntryIds.has(awayId);
            const homeHero = heroDefeatEntryIds.has(homeId);
            const awayHero = heroDefeatEntryIds.has(awayId);

            const fixtureKey = `${homeId}-${awayId}-${gameweek}`;
            const winPct = h2hWinPctByKey.get(fixtureKey);
            const lineupOpen = expandedFixtures.has(fixtureKey);
            const fixtureBodyId = `live-fixture-lineups-${fixtureKey}`;

            return (
              <section
                key={fixtureKey}
                className={
                  'tile tile--compact live-fixture-tile' +
                  (homeVillain || awayVillain
                    ? ' live-fixture-tile--villain-victory'
                    : '') +
                  (homeHero || awayHero ? ' live-fixture-tile--hero-defeat' : '')
                }
                aria-label={
                  typeof homeLtp === 'number' && typeof awayLtp === 'number'
                    ? `${homeName}, ${homeLtp} fixtures left, vs ${awayName}, ${awayLtp} fixtures left`
                    : `${homeName} vs ${awayName}`
                }
              >
                <button
                  type="button"
                  className="live-fixture-banner live-fixture-banner--toggle"
                  onClick={() => toggleFixtureExpanded(fixtureKey)}
                  aria-expanded={lineupOpen}
                  aria-controls={fixtureBodyId}
                >
                  <span className="live-fixture-chevron live-fixture-chevron--desktop" aria-hidden>
                    {lineupOpen ? '▼' : '▶'}
                  </span>
                    <span className="live-fixture-banner__row">
                    <span className="live-fixture-banner__team live-fixture-banner__team--home">
                      {homeVillain ? (
                        <span className="live-fixture-banner__villain-edge live-fixture-banner__villain-edge--home">
                          <VillainDetectedBadge variant="compact" />
                        </span>
                      ) : homeHero ? (
                        <span className="live-fixture-banner__villain-edge live-fixture-banner__villain-edge--home">
                          <HeroDefeatBadge variant="compact" />
                        </span>
                      ) : null}
                      <span className="live-fixture-banner__team-cluster live-fixture-banner__team-cluster--home">
                        {winPct ? (
                          <span
                            className={
                              'live-fixture-banner__win-pct live-fixture-banner__win-pct--home tabular' +
                              (winPct.isLive ? ' live-fixture-banner__win-pct--live' : '')
                            }
                            title={winPct.isLive ? 'Home win % (live Proj MC)' : 'Home win % (xPts MC)'}
                            aria-label={`Home win ${Math.round(winPct.homeWinPct)}%`}
                          >
                            {Math.round(winPct.homeWinPct)}%
                          </span>
                        ) : null}
                        <span className="live-fixture-banner__team-avatar">
                        <TeamAvatar
                          entryId={homeId}
                          name={homeName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </span>
                      <span className="live-fixture-banner__team-text live-fixture-banner__team-text--home">
                        <span className="live-fixture-banner__team-inner">
                          <span className="live-fixture-banner__name-line">
                            <span
                              className={`live-fixture-banner__name ${homeLead ? 'live-fixture-banner__name--lead' : ''}`}
                            >
                              {homeName}
                            </span>
                          </span>
                          {typeof homeLtp === 'number' ? (
                            <span className="live-fixture-banner__ltp-line">
                              <LeftToPlayOutsideAfter count={homeLtp} leadingSpace={false} />
                            </span>
                          ) : null}
                        </span>
                      </span>
                      </span>
                    </span>

                    <span className="live-fixture-banner__vs-sep" aria-hidden="true">
                      vs
                    </span>

                    <span className="live-fixture-banner__scorebox" aria-label="Gameweek points comparison">
                      <span className="live-fixture-banner__score-row">
                        <span
                          className="live-fixture-banner__score-avatar live-fixture-banner__score-avatar--home"
                          aria-hidden="true"
                        >
                          <TeamAvatar
                            entryId={homeId}
                            name={homeName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                        </span>
                        {homeLive != null && awayLive != null ? (
                          <span className="live-fixture-banner__live-score tabular">
                            <span className={homeLead ? 'live-fixture-pts--lead' : ''}>{homeLive}</span>
                            <span className="live-fixture-banner__dash">–</span>
                            <span className={awayLead ? 'live-fixture-pts--lead' : ''}>{awayLive}</span>
                          </span>
                        ) : (
                          <span className="live-fixture-vs">v</span>
                        )}
                        <span
                          className="live-fixture-banner__score-avatar live-fixture-banner__score-avatar--away"
                          aria-hidden="true"
                        >
                          <TeamAvatar
                            entryId={awayId}
                            name={awayName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                        </span>
                      </span>
                      <span className="muted live-fixture-banner__score-caption">GW pts (live)</span>
                    </span>

                    <span className="live-fixture-banner__team live-fixture-banner__team--away">
                      <span className="live-fixture-banner__team-cluster live-fixture-banner__team-cluster--away">
                      <span className="live-fixture-banner__team-text live-fixture-banner__team-text--away">
                        <span className="live-fixture-banner__team-inner">
                          <span className="live-fixture-banner__name-line">
                            <span
                              className={`live-fixture-banner__name ${awayLead ? 'live-fixture-banner__name--lead' : ''}`}
                            >
                              {awayName}
                            </span>
                          </span>
                          {typeof awayLtp === 'number' ? (
                            <span className="live-fixture-banner__ltp-line">
                              <LeftToPlayOutsideAfter count={awayLtp} leadingSpace={false} />
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="live-fixture-banner__team-avatar">
                        <TeamAvatar
                          entryId={awayId}
                          name={awayName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </span>
                      </span>
                      {winPct ? (
                        <span
                          className={
                            'live-fixture-banner__win-pct live-fixture-banner__win-pct--away tabular' +
                            (winPct.isLive ? ' live-fixture-banner__win-pct--live' : '')
                          }
                          title={winPct.isLive ? 'Away win % (live Proj MC)' : 'Away win % (xPts MC)'}
                          aria-label={`Away win ${Math.round(winPct.awayWinPct)}%`}
                        >
                          {Math.round(winPct.awayWinPct)}%
                        </span>
                      ) : null}
                      {awayVillain ? (
                        <span className="live-fixture-banner__villain-edge live-fixture-banner__villain-edge--away">
                          <VillainDetectedBadge variant="compact" />
                        </span>
                      ) : awayHero ? (
                        <span className="live-fixture-banner__villain-edge live-fixture-banner__villain-edge--away">
                          <HeroDefeatBadge variant="compact" />
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {/* Mobile: bottom affordance — ▼ = collapsed (lineup below), ▲ = expanded (hide). */}
                  <span className="live-fixture-banner__expand-foot">
                    <span className="live-fixture-chevron live-fixture-chevron--mobile" aria-hidden>
                      {!lineupOpen ? '▼' : '▲'}
                    </span>
                  </span>
                </button>

                {lineupOpen ? (
                  <div className="live-fixture-expanded-body" id={fixtureBodyId}>
                    <LiveFixtureSeasonH2h
                      homeId={homeId}
                      awayId={awayId}
                      homeName={homeName}
                      awayName={awayName}
                      matches={matches}
                      gameweek={gameweek}
                      liveHomePts={homeLive}
                      liveAwayPts={awayLive}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                    <div className="live-fixture-split">
                  <div
                    className={
                      'live-fixture-column' +
                      (homeVillain ? ' live-fixture-column--villain-victory' : '') +
                      (homeHero ? ' live-fixture-column--hero-defeat' : '')
                    }
                  >
                    <div className="live-fixture-column-head">
                      <h3 className="live-fixture-column-title">
                        <span className="live-fixture-column-title__row">
                          <span>
                            {homeName}
                            <LeftToPlayOutsideAfter count={homeLtp} />
                          </span>
                          {homeVillain ? (
                            <VillainDetectedBadge />
                          ) : homeHero ? (
                            <HeroDefeatBadge />
                          ) : null}
                        </span>
                      </h3>
                      <div className="live-squad-meta tabular">
                        {homeLive != null ? (
                          <span className="live-squad-pts">
                            <strong>{homeLive}</strong> GW pts
                          </span>
                        ) : null}
                        {homeSquad?.pointsOnBench != null ? (
                          <span className="muted">Bench: {homeSquad.pointsOnBench} pts</span>
                        ) : null}
                      </div>
                    </div>
                    <SquadLineupPanel squad={homeSquad} onPlayerClick={openPlayerHistory} />
                  </div>
                  <div className="live-fixture-divider" aria-hidden="true" />
                  <div
                    className={
                      'live-fixture-column' +
                      (awayVillain ? ' live-fixture-column--villain-victory' : '') +
                      (awayHero ? ' live-fixture-column--hero-defeat' : '')
                    }
                  >
                    <div className="live-fixture-column-head">
                      <h3 className="live-fixture-column-title">
                        <span className="live-fixture-column-title__row">
                          <span>
                            {awayName}
                            <LeftToPlayOutsideAfter count={awayLtp} />
                          </span>
                          {awayVillain ? (
                            <VillainDetectedBadge />
                          ) : awayHero ? (
                            <HeroDefeatBadge />
                          ) : null}
                        </span>
                      </h3>
                      <div className="live-squad-meta tabular">
                        {awayLive != null ? (
                          <span className="live-squad-pts">
                            <strong>{awayLive}</strong> GW pts
                          </span>
                        ) : null}
                        {awaySquad?.pointsOnBench != null ? (
                          <span className="muted">Bench: {awaySquad.pointsOnBench} pts</span>
                        ) : null}
                      </div>
                    </div>
                    <SquadLineupPanel squad={awaySquad} onPlayerClick={openPlayerHistory} />
                    </div>
                  </div>
                </div>
                ) : null}
              </section>
            );
            })}
          </div>
        </div>
      ) : (
        squads.map((squad) => {
          const squadVillain = villainVictoryEntryIds.has(Number(squad.leagueEntryId));
          const squadHero = heroDefeatEntryIds.has(Number(squad.leagueEntryId));
          return (
            <section
              key={squad.leagueEntryId}
              className={
                'tile tile--compact live-squad-tile' +
                (squadVillain ? ' live-squad-tile--villain-victory' : '') +
                (squadHero ? ' live-squad-tile--hero-defeat' : '')
              }
              aria-labelledby={`live-squad-${squad.leagueEntryId}`}
            >
              <div className="live-squad-head">
                <h3
                  id={`live-squad-${squad.leagueEntryId}`}
                  className="live-squad-title"
                  title={
                    squad.fplEntryId != null
                      ? `Squad from draft FPL API · entry_id ${squad.fplEntryId} (league_entries.entry_id)`
                      : undefined
                  }
                >
                  <TeamAvatar
                    entryId={squad.leagueEntryId}
                    name={squad.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <span className="live-squad-title__text">
                    <span>
                      {squad.teamName}
                      <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                    </span>
                    {squadVillain ? (
                      <VillainDetectedBadge variant="compact" />
                    ) : squadHero ? (
                      <HeroDefeatBadge variant="compact" />
                    ) : null}
                  </span>
                </h3>
                <div className="live-squad-meta tabular">
                  {liveGwDisplayTotal(squad) != null ? (
                    <span className="live-squad-pts">
                      <strong>{liveGwDisplayTotal(squad)}</strong> GW pts
                    </span>
                  ) : null}
                  {squad.pointsOnBench != null ? (
                    <span className="muted">Bench: {squad.pointsOnBench} pts</span>
                  ) : null}
                </div>
              </div>
              <SquadLineupPanel squad={squad} onPlayerClick={openPlayerHistory} />
            </section>
          );
        })
      )}

      {useFixtureLayout && orphanSquads.length > 0
        ? orphanSquads.map((squad) => {
            const squadVillain = villainVictoryEntryIds.has(Number(squad.leagueEntryId));
            const squadHero = heroDefeatEntryIds.has(Number(squad.leagueEntryId));
            return (
            <section
              key={`orphan-${squad.leagueEntryId}`}
              className={
                'tile tile--compact live-squad-tile live-squad-tile--orphan' +
                (squadVillain ? ' live-squad-tile--villain-victory' : '') +
                (squadHero ? ' live-squad-tile--hero-defeat' : '')
              }
              aria-labelledby={`live-squad-o-${squad.leagueEntryId}`}
            >
              <p className="muted muted--tight live-orphan-note">
                No H2H pairing in schedule for this GW — showing squad only.
              </p>
              <div className="live-squad-head">
                <h3
                  id={`live-squad-o-${squad.leagueEntryId}`}
                  className="live-squad-title"
                  title={
                    squad.fplEntryId != null
                      ? `Squad from draft FPL API · entry_id ${squad.fplEntryId}`
                      : undefined
                  }
                >
                  <TeamAvatar
                    entryId={squad.leagueEntryId}
                    name={squad.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <span className="live-squad-title__text">
                    <span>
                      {squad.teamName}
                      <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                    </span>
                    {squadVillain ? (
                      <VillainDetectedBadge variant="compact" />
                    ) : squadHero ? (
                      <HeroDefeatBadge variant="compact" />
                    ) : null}
                  </span>
                </h3>
                <div className="live-squad-meta tabular">
                  {liveGwDisplayTotal(squad) != null ? (
                    <span className="live-squad-pts">
                      <strong>{liveGwDisplayTotal(squad)}</strong> GW pts
                    </span>
                  ) : null}
                </div>
              </div>
              <SquadLineupPanel squad={squad} onPlayerClick={openPlayerHistory} />
            </section>
            );
          })
        : null}

      {leftToPlayByFixture.length > 0 ? (
        <section
          className="tile tile--compact live-ltp-panel-tile"
          aria-label="Total fixtures left to play in H2H matchups"
        >
          <button
            type="button"
            className="live-fixture-banner live-fixture-banner--toggle live-ltp-fixture-banner"
            onClick={() => setLtpPanelExpanded((v) => !v)}
            aria-expanded={ltpPanelExpanded}
            aria-controls="live-ltp-panel-body"
          >
            <span className="live-fixture-chevron live-fixture-chevron--desktop" aria-hidden>
              {ltpPanelExpanded ? '▼' : '▶'}
            </span>
            <span className="live-ltp-fixture-banner__text">
              <span className="live-ltp-fixture-banner__title live-ltp-fixture-banner__title--only">
                Fixtures left to play
              </span>
            </span>
            <span className="live-fixture-banner__expand-foot" aria-hidden>
              <span className="live-fixture-chevron live-fixture-chevron--mobile">
                {!ltpPanelExpanded ? '▼' : '▲'}
              </span>
            </span>
          </button>

          {ltpPanelExpanded ? (
            <div className="live-ltp-panel-body" id="live-ltp-panel-body">
              {leftToPlayByFixture.map((fx) => (
                <div key={fx.key} className="live-ltp-fixture-block">
                  <div className="live-ltp-summary-list">
                    {[fx.home, fx.away].map((row) => (
                      <div
                        key={row.leagueEntryId}
                        className="live-ltp-summary-row"
                      >
                        <span className="live-ltp-summary-team">
                          <span className="live-ltp-summary-score-inline tabular">
                            {row.live != null ? row.live : '—'}
                          </span>
                          <TeamAvatar
                            entryId={row.leagueEntryId}
                            name={row.name}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <strong className="live-ltp-summary-team-name">
                            {row.name}
                          </strong>
                        </span>
                        <span className="live-ltp-summary-players">
                          <span
                            className="live-ltp-summary-players-count muted tabular"
                            title="Total fixtures left (sum over effective starting XI)"
                          >
                            ({row.ltpGamesCount})
                          </span>
                          {row.segments.length ? (
                            <> {row.segments.join(', ')}</>
                          ) : (
                            <span className="muted"> None</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        className="tile tile--compact tile--live-standings"
        aria-labelledby="live-standings-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="live-standings-heading" className="tile-title tile-title--sm">
            Live Table
          </h2>
          <span className="league-pill league-pill--sm">GW {gameweek}</span>
        </div>
        {!tableRows?.length ? (
          <p className="muted muted--tight">No standings data.</p>
        ) : (
          <div className="table-scroll table-scroll--standings-open">
            <table className="standings-table standings-table--sidebar standings-table--live">
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
                  <th className="col-num col-pl">PL</th>
                  <th className="col-num col-wdl">W</th>
                  <th className="col-num col-wdl">D</th>
                  <th className="col-num col-wdl">L</th>
                  <th
                    className="col-num col-for"
                    title={
                      gwStandingsFrozen
                        ? 'Season points for (includes this GW)'
                        : 'Season points for, plus this GW’s live score vs your opponent'
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
                        ? 'Goal difference: For minus Faced'
                        : 'Projected GD: projected For minus projected Faced'
                    }
                  >
                    GD
                  </th>
                  <th
                    className="col-num col-live-gw"
                    title={
                      gwStandingsFrozen
                        ? 'League points from this GW’s result: +3 win, +1 draw, 0 loss'
                        : 'League points from this GW’s live fixture: +3 win, +1 draw, 0 loss'
                    }
                  >
                    GW
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
                </tr>
              </thead>
              <tbody>
                {liveStandingsRows.map((row) => {
                  const isLeader = row.liveRank === 1;
                  const isVillainVictory = villainVictoryEntryIds.has(
                    Number(row.league_entry)
                  );
                  const isHeroDefeat = heroDefeatEntryIds.has(
                    Number(row.league_entry)
                  );
                  const rowClass = [
                    isLeader ? 'row-highlight' : '',
                    row.liveRank === 1 ? 'standings-row--divider-below' : '',
                    row.liveRank === 8
                      ? 'standings-row--divider-above standings-row--8th'
                      : '',
                    isVillainVictory ? 'standings-row--villain-victory' : '',
                    isHeroDefeat ? 'standings-row--hero-defeat' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const moveUp = row.rankMove > 0;
                  const moveDown = row.rankMove < 0;
                  return (
                    <tr key={row.league_entry} className={rowClass || undefined}>
                      <td className="col-rank">
                        {row.liveRank === 8 ? (
                          <span
                            role="img"
                            className="standings-rank-8"
                            aria-label="8"
                          >
                            🧩
                          </span>
                        ) : (
                          row.liveRank
                        )}
                      </td>
                      <td className="col-team">
                        <span className="team-cell">
                          <TeamAvatar
                            entryId={row.league_entry}
                            name={row.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="team-name team-name--sidebar live-standings-team-name">
                            {row.teamName}
                            {isVillainVictory ? (
                              <VillainDetectedBadge variant="compact" />
                            ) : isHeroDefeat ? (
                              <HeroDefeatBadge variant="compact" />
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
                        </span>
                      </td>
                      <td className="col-num col-pl">{row.pl}</td>
                      <td className="col-num col-wdl">{row.matches_won}</td>
                      <td className="col-num col-wdl">{row.matches_drawn}</td>
                      <td className="col-num col-wdl">{row.matches_lost}</td>
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
                        {row.projectedGd > 0
                          ? `+${row.projectedGd}`
                          : row.projectedGd}
                      </td>
                      <td className="col-num col-live-gw tabular">
                        <strong
                          className={
                            row.h2hBonus === 3
                              ? 'live-standings-gw-val live-standings-gw-val--win'
                              : row.h2hBonus === 1
                                ? 'live-standings-gw-val live-standings-gw-val--draw'
                                : 'live-standings-gw-val live-standings-gw-val--loss'
                          }
                        >
                          {formatGwLeaguePtsBonus(row.h2hBonus)}
                        </strong>
                      </td>
                      <td className="col-num col-pts tabular">
                        <strong>{row.projectedPts}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-foot muted standings-landscape-hint">
          On mobile, turn your device to landscape for the full table.
          {gwStandingsFrozen ? (
            <>
              {' '}
              Frozen standings use league totals from the last loaded league file; refresh ingest /
              deploy so <code>details.json</code> matches FPL if PTS look stale.
            </>
          ) : null}
        </p>
      </section>

      {useFixtureLayout ? (
        <LiveFixtureGwPointsChart
          gameweek={gameweek}
          gwMatches={gwMatches}
          teams={teams}
          squadByLeagueEntry={squadByLeagueEntry}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          projectedGwByEntryId={projectedGwByEntryId}
          medianGwWinScore={medianGwWinScore}
        />
      ) : null}
        </>
      )}
    </div>
  );
}
