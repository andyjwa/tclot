import {
  Fragment,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { TeamAvatar } from './TeamAvatar';
import { PointsCell } from './PointsCell.jsx';
import { PlayerContributions } from './PlayerContributions';
import { LiveOddsSection } from './LiveOddsSection.jsx';
import { useLiveScores } from './useLiveScores';
import { eventNameToGameWeekLabel } from './gwLabel.js';
import { GameWeekNavigator } from './GameWeekNavigator.jsx';
import { usePlayerHistory, ClickablePlayerName } from './PlayerHistoryContext.jsx';
import { usePlayerDetailOverlayOptional } from './PlayerDetailOverlay.jsx';
import { heroDefeatEntryIds, villainVictoryEntryIds } from './gwRawPointsRankSeason.js';
import { fplApiBase, FPL_DIRECT } from './fplDraftUrl.js';
import { liveGwDisplayTotal } from './liveGwTotals.js';
import { LiveProjectionsPanel } from './LiveProjectionsPanel.jsx';
import { MatchupScorecard } from './MatchupScorecard.jsx';
import { HeroVillainAvatarFrame } from './HeroVillainAvatarFrame.jsx';
import { LiveStandingsTable } from './LiveStandingsTable.jsx';
import { LiveFixtureCardDeck } from './LiveFixtureCardDeck.jsx';
import { LiveFixtureDesktopPage } from './LiveFixtureDesktopPage.jsx';
import {
  GuardOfHonourSplash,
  GuardOfHonourCollapsedStrip,
} from './GuardOfHonourSplash.jsx';
import {
  REIGNING_CHAMPION_LEAGUE_ENTRY_ID,
  REIGNING_CHAMPION_TEAM_NAME,
  REIGNING_CHAMPION_TITLE_TEAM_NAME,
  findChampionFixture,
  managerSurnameFromFullName,
} from './championOfRecord.js';
import { useMobileNarrowViewport } from './usePortraitMobile.js';
import { standingsMobileTeamName } from './teamNameUtils.js';
import { compareH2hStandingsKeys } from './h2hEffectiveFinished.js';
import { usePredictions } from './usePredictions.js';
import { useModelCalibration } from './useModelCalibration.js';
import { predictionsById, h2hWinProbs } from './forecastHelpers.js';
import { effectiveStartersForCard } from './liveFixtureCardDerivations.js';
import { teamProjection, anyFixtureLive } from './liveBlend.js';
import {
  computeManagerForm,
  liveGwOutcomeDot,
  projectedH2HPoints,
} from './liveScoresDerivations.js';
import {
  readTclotViewState,
  patchTclotViewState,
  fixtureIndexFromViewState,
} from './tclotViewState.js';

/**
 * Live H2H win probabilities for one fixture from the forecast blend — the
 * same model as the fixture card's Odds tab (per-player live blend once any
 * XI player has kicked off, frozen pre-match forecast before). Returns null
 * when the forecast covers neither XI (missing/stale predictions artifact,
 * orphan squads) so the meta strip can skip the odds cleanly.
 */
function fixtureWinProbs(homeSquad, awaySquad, byId, sigmaScale = 1) {
  const homeRows = effectiveStartersForCard(homeSquad);
  const awayRows = effectiveStartersForCard(awaySquad);
  const mode = anyFixtureLive(homeRows, awayRows) ? 'live' : 'prematch';
  const home = teamProjection(homeRows, byId, mode);
  const away = teamProjection(awayRows, byId, mode);
  if (home.matched === 0 && away.matched === 0) return null;
  return h2hWinProbs(home, away, 0.5, sigmaScale);
}

/**
 * Favourite label for the fixtures meta strip — locked mockup Option R:
 * ONLY the favourite, in the same ghost text as the seed label (the CSS
 * uppercases it): `Mordor SFG 74%`. Draw-favourite and dead-even fixtures
 * fall back to `Draw N%` / `Even N%` so the strip never picks a side that
 * isn't actually ahead.
 */
function favouriteMetaLabel(probs, homeDisplayName, awayDisplayName) {
  if (!probs) return null;
  const h = Number(probs.homeWinPct) || 0;
  const a = Number(probs.awayWinPct) || 0;
  const d = Number(probs.drawPct) || 0;
  if (d > h && d > a) return `Draw ${Math.round(d)}%`;
  if (h === a) return `Even ${Math.round(h)}%`;
  const name = h > a ? homeDisplayName : awayDisplayName;
  return `${name} ${Math.round(Math.max(h, a))}%`;
}

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
 * Resolved ESPN Published XI tone for matchday colouring (pill + row tooltip); used for Starting XI **and Bench** picks.
 * @returns {'' | 'live-picks-row--mdy-xi' | 'live-picks-row--mdy-bench' | 'live-picks-row--mdy-absent'}
 */
function liveStartingXiMatchdayRowClass(row) {
  if (!row || row.espnMatchdayRole == null) return '';
  if (row.espnMatchdayRole === 'xi') return 'live-picks-row--mdy-xi';
  if (row.espnMatchdayRole === 'bench') return 'live-picks-row--mdy-bench';
  if (row.espnMatchdayRole === 'absent') return 'live-picks-row--mdy-absent';
  return '';
}

function liveMatchdayRowTitle(toneClass) {
  switch (toneClass) {
    case 'live-picks-row--mdy-xi':
      return 'In the Premier League starting XI for this match.';
    case 'live-picks-row--mdy-bench':
      return 'Listed on the Premier League bench for this fixture.';
    case 'live-picks-row--mdy-absent':
      return 'Not in the published Premier League squad for this fixture — strongly consider swapping out.';
    default:
      return undefined;
  }
}

/** Map row tone ({@link liveStartingXiMatchdayRowClass}) to pill modifier classes */
function liveStartingXiMatchdayPillClass(rowToneClass) {
  switch (rowToneClass) {
    case 'live-picks-row--mdy-xi':
      return 'live-player-mdy-pill live-player-mdy-pill--xi';
    case 'live-picks-row--mdy-bench':
      return 'live-player-mdy-pill live-player-mdy-pill--bench';
    case 'live-picks-row--mdy-absent':
      return 'live-player-mdy-pill live-player-mdy-pill--absent';
    default:
      return '';
  }
}

/**
 * @param {{ rows: object[], autosubInElementIds?: Set<number>, onPlayerClick?: (row: object) => void, toneTable?: 'matchday' }} props
 */
function PicksTable({ rows, autosubInElementIds, onPlayerClick, toneTable }) {
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
              title="Confirmed FPL bonus when posted. A yellow ~n is a live BPS estimate only — not official yet. Once anyone in that match has official bonus, estimates for the rest of the fixture are dropped."
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
              title="Live FPL points; bonus in the total matches the Bonus column (confirmed official, or a ~ BPS estimate while that match has no official slate yet)."
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
            const mdyRowTone =
              toneTable === 'matchday' ? liveStartingXiMatchdayRowClass(r) : '';
            const mdyTitle = liveMatchdayRowTitle(mdyRowTone);
            const mdyPillClass = liveStartingXiMatchdayPillClass(mdyRowTone);
            const nameLabel =
              mdyPillClass ? (
                <span className={mdyPillClass}>
                  {playerColName}
                  {r.opponentShortLabel ? (
                    <span className="live-player-opponent">
                      {' '}
                      ({r.opponentShortLabel})
                    </span>
                  ) : null}
                </span>
              ) : (
                <>
                  {playerColName}
                  {r.opponentShortLabel ? (
                    <span className="live-player-opponent">
                      {' '}
                      ({r.opponentShortLabel})
                    </span>
                  ) : null}
                </>
              );
            return (
            <tr key={`${r.pickPosition}-${r.element}`} title={mdyTitle}>
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
                          {nameLabel}
                        </button>
                      ) : (
                        <div
                          className={
                            'live-player-name' +
                            (portraitLineup ? ' live-player-name--lineup-portrait' : '')
                          }
                          title={fullLabel}
                        >
                          {nameLabel}
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
                  ((Number(r.bonus) || 0) > 0
                    ? r.bonusConfirmed
                      ? ' live-pick-cell--green'
                      : ' live-pick-cell--yellow'
                    : '')
                }
                title={
                  (Number(r.bonus) || 0) > 0 && !r.bonusConfirmed
                    ? 'Provisional from live BPS — not confirmed by FPL yet'
                    : undefined
                }
              >
                {(Number(r.bonus) || 0) > 0 && !r.bonusConfirmed
                  ? `~${r.bonus}`
                  : r.bonus}
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

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`;
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

/** @param {object[] | Map<number, number>} squadsOrPoints @param {object[]} gwMatches */
function villainVictoryLeagueEntryIds(squadsOrPoints, gwMatches) {
  const points =
    squadsOrPoints instanceof Map
      ? squadsOrPoints
      : squadsToGwPointsMap(squadsOrPoints);
  return villainVictoryEntryIds(points, gwMatches);
}

/** @param {object[]} squads @param {object[]} gwMatches */
function heroDefeatLeagueEntryIds(squads, gwMatches) {
  return heroDefeatEntryIds(squadsToGwPointsMap(squads), gwMatches);
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

/** @param {{ squad: object, onPlayerClick?: (row: object, squad: object) => void }} */
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
          toneTable="matchday"
          onPlayerClick={
            onPlayerClick ? (r) => onPlayerClick(r, squad) : undefined
          }
        />
      </div>
      <h4 className="live-lineup-heading live-lineup-heading--bench">Bench</h4>
      <div className="live-picks-table-wrap live-picks-table-wrap--lineup-portrait">
        <PicksTable
          rows={bench}
          toneTable="matchday"
          onPlayerClick={
            onPlayerClick ? (r) => onPlayerClick(r, squad) : undefined
          }
        />
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
  const { error, fixturesDegradedNotice, events, eventSnapshot, squads, contributionLiveContext, lastUpdated } =
    useLiveScores({
      teams,
      gameweek,
      enabled: true,
      onBootstrapLiveMeta,
      /** Hook only applies the interval when GW is current and not finished. */
      pollIntervalMs: 90_000,
    });

  /**
   * Phone-width breakpoint (≤767px) — at this width the H2H fixture
   * scorecards prefer the curated short team names (mockup `Mordor SFG`
   * via {@link standingsMobileTeamName}) as the fitted name's first
   * candidate, and tapping a card opens the swipeable card deck instead of
   * the desktop fixture page.
   */
  const mobileNarrowViewport = useMobileNarrowViewport();

  /** FPL element id + labels — opens slide-over season history from `element-summary`. */
  const { openPlayerHistory } = usePlayerHistory();
  const detailOverlayCtx = usePlayerDetailOverlayOptional();

  const openLineupOrHistory = useCallback(
    (row, squad, opts) => {
      if (
        detailOverlayCtx &&
        Number.isFinite(Number(row?.element ?? row?.elementId))
      ) {
        detailOverlayCtx.openPlayerDetail({
          element: Number(row.element ?? row.elementId),
          leagueEntryId:
            squad?.leagueEntryId != null ? Number(squad.leagueEntryId) : undefined,
          displayName: row?.displayName,
          web_name: row?.web_name,
          teamShort: row?.teamShort,
          presentation: opts?.presentation,
        });
        return;
      }
      openPlayerHistory(row);
    },
    [detailOverlayCtx, openPlayerHistory],
  );

  /**
   * Player tapped from an OPEN fixture (mobile card deck or the inline
   * expanded lineup): the detail overlay slides UP as a bottom sheet over
   * the fixture (FotMob player sheet). Everywhere else keeps the default
   * push-from-the-right presentation.
   */
  const openPlayerFromFixture = useCallback(
    (row, squad) => openLineupOrHistory(row, squad, { presentation: 'sheet' }),
    [openLineupOrHistory],
  );

  const proxyHost = proxyHostLabel();
  const hasExplicitWorkerUrl =
    (import.meta.env.VITE_FPL_PROXY_URL ?? '').trim() !== '';
  const fplFetchBase = fplApiBase();
  /** Browser will hit FPL directly — needs Worker URL at build time for static hosts. */
  const showNoProxyBuildError = fplFetchBase === FPL_DIRECT;
  const usesSameOriginViteProxy = fplFetchBase === '/__fpl';

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

  /**
   * Live odds for the fixtures meta strip (see {@link fixtureWinProbs}).
   * Suppressed when the predictions artifact targets a different gameweek
   * than the one on screen, or once the selected GW is finished — a settled
   * result doesn't need a win probability next to it.
   */
  const { predictions } = usePredictions();
  const sigmaScale = useModelCalibration();
  const oddsById = useMemo(
    () => (predictions?.players?.length ? predictionsById(predictions) : null),
    [predictions],
  );
  const predictionsGwMismatch =
    predictions?.gameweek != null &&
    Number(predictions.gameweek) !== Number(gameweek);
  const showFixtureOdds =
    Boolean(oddsById) && !predictionsGwMismatch && !selectedGwOption?.finished;

  /**
   * Guard of Honour splash — top-down 2D match-engine cinematic for the
   * reigning champion's first fixture of a new season. Production trigger
   * (`gameweek === 1`) is OR'd with a manual `?gohSplash=1` URL flag so the
   * splash can be previewed against current (mid-season) data before the
   * new season opener.
   *
   * Collapse behaviour: the section renders collapsed by default as the
   * slim {@link GuardOfHonourCollapsedStrip} so the cinematic stays out of
   * the way. Tapping the strip expands the full splash, and its × control
   * collapses it back — the override is local to the component instance
   * (resets on reload, which matches how the FplLiveTripleThreatBanner
   * promo behaved). The `?gohSplash=1` preview flag always starts expanded.
   */
  const gohForceFlag = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('gohSplash') === '1';
    } catch {
      return false;
    }
  }, []);
  /** null = follow the collapsed default; true/false = user override. */
  const [gohCollapsedOverride, setGohCollapsedOverride] = useState(null);
  const gohCollapsed = gohCollapsedOverride ?? !gohForceFlag;
  const championFixtureBundle = useMemo(() => {
    const shouldRender = gohForceFlag || Number(gameweek) === 1;
    if (!shouldRender) return null;
    const fx = findChampionFixture(gwMatches, REIGNING_CHAMPION_LEAGUE_ENTRY_ID);
    if (!fx) return null;
    const champSquad = squadByLeagueEntry.get(fx.championLeagueEntryId);
    const oppSquad = squadByLeagueEntry.get(fx.opponentLeagueEntryId);
    const champStarters =
      champSquad?.displayStarters?.length === 11
        ? champSquad.displayStarters
        : (champSquad?.starters ?? []);
    const oppStarters =
      oppSquad?.displayStarters?.length === 11
        ? oppSquad.displayStarters
        : (oppSquad?.starters ?? []);
    if (champStarters.length < 11 || oppStarters.length < 11) return null;
    const opponentTeam = teams?.find((t) => Number(t.id) === fx.opponentLeagueEntryId);
    return {
      championStarters: champStarters,
      opponentStarters: oppStarters,
      championTeamName: REIGNING_CHAMPION_TEAM_NAME,
      opponentTeamName: teamNameForEntry(teams, fx.opponentLeagueEntryId),
      opponentManagerSurname: managerSurnameFromFullName(opponentTeam?.manager),
    };
  }, [
    gohForceFlag,
    gameweek,
    gwMatches,
    squadByLeagueEntry,
    teams,
  ]);

  /**
   * Official GW points from the finished H2H match rows (`details.json`),
   * keyed by `league_entry`. Available on first paint, unlike the per-team
   * live squads (one FPL fetch each, several seconds). Used as an instant
   * fallback for the `GW` outcome dots / `+3` chips so a finished GW's
   * Live Table doesn't sit on hollow "not started" dots while squads load.
   */
  const finishedMatchPtsByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const fx of gwMatches) {
      if (!fx?.finished) continue;
      const a = Number(fx.league_entry_1);
      const b = Number(fx.league_entry_2);
      const pa = Number(fx.league_entry_1_points);
      const pb = Number(fx.league_entry_2_points);
      if (Number.isFinite(a) && Number.isFinite(pa)) m.set(a, pa);
      if (Number.isFinite(b) && Number.isFinite(pb)) m.set(b, pb);
    }
    return m;
  }, [gwMatches]);

  /** Opponent’s live GW total for this GW (for projected Faced / GD / H2H pts). */
  const oppLiveGwByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const fx of gwMatches) {
      const a = Number(fx.league_entry_1);
      const b = Number(fx.league_entry_2);
      const la =
        liveGwDisplayTotal(squadByLeagueEntry.get(a)) ??
        finishedMatchPtsByLeagueEntry.get(a) ??
        null;
      const lb =
        liveGwDisplayTotal(squadByLeagueEntry.get(b)) ??
        finishedMatchPtsByLeagueEntry.get(b) ??
        null;
      m.set(a, lb);
      m.set(b, la);
    }
    return m;
  }, [gwMatches, squadByLeagueEntry, finishedMatchPtsByLeagueEntry]);

  /**
   * Opponent's `league_entry` id for this GW, keyed by manager `league_entry`.
   * Powers the site-wide form-dot tooltip on the `GW` dot column so we can
   * resolve the opponent's team name via {@link teamNameForEntry}.
   */
  const oppEntryByLeagueEntry = useMemo(() => {
    const m = new Map();
    for (const fx of gwMatches) {
      const a = Number(fx.league_entry_1);
      const b = Number(fx.league_entry_2);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        m.set(a, b);
        m.set(b, a);
      }
    }
    return m;
  }, [gwMatches]);

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
   * Projected For / Faced / GD / PTS from this GW’s live fixtures, then sorted by
   * official H2H order: projected PTS, then For, then team name (no GD / PA
   * step — same as FPL Draft). The table shows a unique place (`ordinalLive`,
   * 1 through 8 in this list order), not a shared competition rank.
   * `rankMove` uses that place vs season rank so movement still shows
   * inside tied groups.
   *
   * When this GW is already finished, league `tableRows` totals (PTS, For, Faced) already include
   * it — do not add live H2H points or GW FPL totals again (would double-count e.g. +3).
   */
  const liveStandingsRows = useMemo(() => {
    if (!Array.isArray(tableRows) || tableRows.length === 0) return [];
    /**
     * PR #5g — `gwHasStarted` is the signal the new `GW` dot column uses to
     * differentiate "pre-kickoff" (muted placeholder dot) from "live"
     * (W/D/L coloured dot, pulsing if not frozen). Frozen GWs are
     * always considered started so the FT dot still renders coloured.
     */
    const gwHasStarted =
      gwStandingsFrozen || gwMatches.some((m) => m?.started === true);
    const enriched = tableRows.map((row) => {
      const eid = row.league_entry;
      const squad = squadByLeagueEntry.get(eid);
      const liveGw =
        liveGwDisplayTotal(squad) ??
        finishedMatchPtsByLeagueEntry.get(eid) ??
        null;
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

      /**
       * PR #5g — `projectedFor` is the live-cumulative For (season points
       * for + this GW's live FPL points). When `gwStandingsFrozen` is true
       * the league `gf` already includes this GW so we add 0 to avoid
       * double-counting. This is the same value rendered in the new `FOR`
       * column post-restructure — no separate helper needed.
       */
      const projectedFor = gf + addMine;
      const projectedGa = ga + addOpp;
      const projectedGd = projectedFor - projectedGa;
      const h2hBonus =
        inFixture && liveGw != null && oppLiveGw != null
          ? liveH2hBonusPts(liveGw, oppLiveGw)
          : 0;
      const projectedPts = gwStandingsFrozen ? total : total + h2hBonus;

      /**
       * PR #5g — `formDotsHistoric` powers the new `Last 5` column: 5
       * most-recently-finished GW dots, no live dot (the live result moved
       * to the separate `GW` dot column).
       */
      const formDotsHistoric = computeManagerForm({
        leagueEntryId: eid,
        matches,
        gameweek,
        includeLive: false,
        count: 5,
      });
      /**
       * PR #5g — `gwOutcomeDot` drives the new `GW` column (single
       * coloured dot). `h2hProj` drives the inline `+3 / +1` chip in the
       * team-name cell (hidden on losing rows; `value === null` then).
       */
      const gwOutcomeDot = liveGwOutcomeDot(
        liveGw,
        inFixture ? oppLiveGw : null,
        gwHasStarted,
      );
      const h2hProj = projectedH2HPoints(
        liveGw,
        inFixture ? oppLiveGw : null,
      );

      return {
        ...row,
        liveGw,
        oppLiveGw: inFixture ? oppLiveGw : null,
        projectedFor,
        projectedGa,
        projectedGd,
        h2hBonus,
        projectedPts,
        formDotsHistoric,
        gwOutcomeDot,
        h2hProj,
        oppEntryThisGw: oppEntryByLeagueEntry.get(eid) ?? null,
      };
    });
    const sorted = [...enriched].sort((a, b) => {
      const byOfficial = compareH2hStandingsKeys(
        a.projectedPts,
        b.projectedPts,
        a.projectedFor,
        b.projectedFor,
        a.teamName,
        b.teamName,
      );
      if (byOfficial !== 0) return byOfficial;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    let currentLiveRank = 0;
    return sorted.map((row, i) => {
      if (i === 0 || row.projectedPts !== sorted[i - 1].projectedPts) {
        currentLiveRank = i + 1;
      }
      const liveRank = currentLiveRank;
      const ordinalLive = i + 1;
      /** No ↑/↓ until FPL has assigned season ranks (pre-season they are
       * null — the old `?? 999` fallback flagged every row as a huge
       * riser) and this GW has actually kicked off. */
      const seasonRank = Number(row.rank);
      const rankMove =
        gwHasStarted && Number.isFinite(seasonRank) && seasonRank > 0
          ? seasonRank - ordinalLive
          : 0;
      return { ...row, liveRank, ordinalLive, rankMove };
    });
  }, [
    tableRows,
    squadByLeagueEntry,
    finishedMatchPtsByLeagueEntry,
    oppLiveGwByLeagueEntry,
    oppEntryByLeagueEntry,
    gwStandingsFrozen,
    matches,
    gameweek,
    gwMatches,
  ]);

  const liveRankByEntry = useMemo(() => {
    const o = {};
    for (const row of liveStandingsRows) {
      const eid = row.league_entry;
      o[eid] = row.ordinalLive;
      o[String(eid)] = row.ordinalLive;
    }
    return o;
  }, [liveStandingsRows]);

  const villainVictoryEntryIds = useMemo(
    () =>
      villainVictoryLeagueEntryIds(
        gwStandingsFrozen && finishedMatchPtsByLeagueEntry.size >= 8
          ? finishedMatchPtsByLeagueEntry
          : squads,
        gwMatches,
      ),
    [gwStandingsFrozen, finishedMatchPtsByLeagueEntry, squads, gwMatches]
  );

  const heroDefeatEntryIds = useMemo(
    () => heroDefeatLeagueEntryIds(squads, gwMatches),
    [squads, gwMatches]
  );

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

  const liveSectionLabel = projectionsOnly ? 'Projections' : 'Live gameweek';

  /**
   * Selected fixture for the card surfaces. On phones (≤767px) tapping an
   * H2H row opens the full-screen swipeable card deck at this index; on
   * wider viewports it opens the full-width fixture page takeover
   * ({@link LiveFixtureDesktopPage}). `null` = both closed.
   */
  const [cardDeckIndex, setCardDeckIndex] = useState(null);
  /** True after we have applied (or skipped) a stored scorecard once. */
  const restoredScorecardRef = useRef(false);
  /** User has opened a scorecard this mount — persist closes after that. */
  const scorecardWasOpenRef = useRef(false);
  const [restoreScorecard, setRestoreScorecard] = useState(false);
  const restoredFixtureTab = readTclotViewState().fixtureTab;

  /** A fixture is open as the desktop full-width takeover page. */
  const pageOpen = !mobileNarrowViewport && cardDeckIndex != null;

  /**
   * List scroll position captured when the fixture page opens, so Back
   * returns the manager to the row they clicked instead of the page top.
   */
  const listScrollRef = useRef(0);
  const openFixtureCard = useCallback(
    (fixtureIndex) => {
      if (!mobileNarrowViewport) {
        listScrollRef.current = window.scrollY;
        window.scrollTo(0, 0);
      }
      setCardDeckIndex(fixtureIndex);
    },
    [mobileNarrowViewport],
  );
  const closeFixtureCard = useCallback(() => {
    const wasPage = !mobileNarrowViewport;
    setCardDeckIndex(null);
    if (wasPage) {
      // After React swaps the takeover back for the list.
      requestAnimationFrame(() => window.scrollTo(0, listScrollRef.current));
    }
  }, [mobileNarrowViewport]);

  const cardFixtures = useMemo(() => {
    return gwMatches.map((m) => {
      const homeId = Number(m.league_entry_1);
      const awayId = Number(m.league_entry_2);
      const homeSquad = squadByLeagueEntry.get(homeId);
      const awaySquad = squadByLeagueEntry.get(awayId);
      const homeRemaining =
        homeSquad && !homeSquad.error &&
        Number.isFinite(Number(homeSquad.xiPlayersRemaining))
          ? Number(homeSquad.xiPlayersRemaining)
          : null;
      const awayRemaining =
        awaySquad && !awaySquad.error &&
        Number.isFinite(Number(awaySquad.xiPlayersRemaining))
          ? Number(awaySquad.xiPlayersRemaining)
          : null;
      return {
        key: `${homeId}-${awayId}-${gameweek}`,
        homeId,
        awayId,
        homeName: teamNameForEntry(teams, homeId),
        awayName: teamNameForEntry(teams, awayId),
        homeSquad,
        awaySquad,
        homeLive: gwStandingsFrozen
          ? (finishedMatchPtsByLeagueEntry.get(homeId) ??
            liveGwDisplayTotal(homeSquad))
          : liveGwDisplayTotal(homeSquad),
        awayLive: gwStandingsFrozen
          ? (finishedMatchPtsByLeagueEntry.get(awayId) ??
            liveGwDisplayTotal(awaySquad))
          : liveGwDisplayTotal(awaySquad),
        homeRemaining,
        awayRemaining,
        comp: selectedGwOption?.label ?? `Gameweek ${gameweek}`,
      };
    });
  }, [
    gwMatches,
    squadByLeagueEntry,
    teams,
    gameweek,
    selectedGwOption,
    gwStandingsFrozen,
    finishedMatchPtsByLeagueEntry,
  ]);

  const cardDeckCtx = useMemo(
    () => ({
      matches,
      gameweek,
      gwFinished: Boolean(selectedGwOption?.finished),
      teams,
      teamLogoMap,
      kitIndexByEntry,
      liveStandingsRows,
      gwStandingsFrozen,
      onOpenPlayer: openPlayerFromFixture,
      villainEntryIds: villainVictoryEntryIds,
    }),
    [
      matches,
      gameweek,
      selectedGwOption,
      teams,
      teamLogoMap,
      kitIndexByEntry,
      liveStandingsRows,
      gwStandingsFrozen,
      openPlayerFromFixture,
      villainVictoryEntryIds,
    ],
  );

  useEffect(() => {
    if (restoredScorecardRef.current) return
    if (cardFixtures.length === 0) return
    restoredScorecardRef.current = true
    const stored = readTclotViewState()
    const i = fixtureIndexFromViewState(cardFixtures, stored.fixture, gameweek)
    if (i == null) return
    setRestoreScorecard(true)
    setCardDeckIndex(i)
  }, [cardFixtures, gameweek])

  useEffect(() => {
    if (cardDeckIndex != null) {
      scorecardWasOpenRef.current = true
      const fx = cardFixtures[cardDeckIndex]
      if (!fx) return
      patchTclotViewState({
        dashboardView: 'fplLive',
        fplLiveTab: 'live',
        liveGw: Number(gameweek),
        fixture: {
          homeId: fx.homeId,
          awayId: fx.awayId,
          gameweek: Number(gameweek),
        },
      })
      return
    }
    if (scorecardWasOpenRef.current) {
      patchTclotViewState({ fixture: null, fixtureTab: null })
    }
  }, [cardDeckIndex, cardFixtures, gameweek])

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
        aria-label={liveSectionLabel}
      >
        {showNoProxyBuildError ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>No proxy in this JavaScript build.</strong>{' '}
            <code>VITE_FPL_PROXY_URL</code> was not set for this deploy, so the browser calls FPL
            directly (<code>{FPL_DIRECT}</code>) and usually hits CORS on static hosting. Add your
            Cloudflare Worker base URL at <strong>build time</strong> (GitHub secret / CI env). Copy{' '}
            <code>web/.env.local.example</code> → <code>web/.env.local</code> for local testing, then{' '}
            <strong>re-run the deploy workflow</strong>. Check <code>deploy-check.json</code> —{' '}
            <code>liveProxyConfigured</code> should be <code>true</code>.
          </div>
        ) : null}

        {import.meta.env.DEV && usesSameOriginViteProxy && !hasExplicitWorkerUrl ? (
          <div className="data-banner" role="status">
            <span className="muted">
              Local dev uses Vite’s same-origin <code>/__fpl</code> proxy —{' '}
              <code>VITE_FPL_PROXY_URL</code> is optional. For GitHub Pages, set the Worker URL when
              building (see <code>web/.env.local.example</code>).
            </span>
          </div>
        ) : null}

        {allMissingFplId ? (
          <div className="data-banner" role="status">
            <strong>No FPL entry ids</strong> — sample/demo <code>details.json</code> omits{' '}
            <code>entry_id</code> on each team. Ingest your real draft league so each manager has an{' '}
            <code>entry_id</code> (the number from the FPL game URL).
          </div>
        ) : null}

        <GameWeekNavigator
          gameweek={gameweek}
          gwOptions={gwOptions}
          onGameweekChange={onGameweekChange}
          sticky={compactMobileChrome}
        />

        {error ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load live data.</strong> {error}{' '}
            <span className="muted">
              {hasExplicitWorkerUrl && proxyHost ? (
                <>
                  The FPL proxy (<code>{proxyHost}</code>) may be unavailable or over its daily
                  request limit (Cloudflare Workers free tier). Wait until after midnight UTC, run{' '}
                  <code>npm run dev:vite</code> locally, or upgrade the Workers plan — see{' '}
                  <code>web/workers/fpl-proxy/README.md</code>.
                </>
              ) : usesSameOriginViteProxy ? (
                <>
                  If you see HTML (<code>&lt;!doctype</code>…), the request never reached FPL — use{' '}
                  <code>npm run dev:vite</code> or <code>npx vite preview</code> so{' '}
                  <code>/__fpl</code> is proxied, not a plain static server. After changing{' '}
                  <code>.env.local</code>, restart Vite. For static hosting, set{' '}
                  <code>VITE_FPL_PROXY_URL</code> at build time.
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
        {!error && fixturesDegradedNotice ? (
          <div className="data-banner" role="status">
            <strong>Limited fixture data.</strong> {fixturesDegradedNotice}
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
      {pageOpen && cardFixtures.length > 0 ? (
        /* Desktop: the tapped fixture takes over the Scores stack as a wide
           two-column page (Match split | Stats + H2H + Odds) with a back
           button — natural document scroll, no overlays. */
        <LiveFixtureDesktopPage
          fixtures={cardFixtures}
          activeIndex={Math.min(cardDeckIndex, cardFixtures.length - 1)}
          onSelectFixture={setCardDeckIndex}
          ctx={cardDeckCtx}
          onBack={closeFixtureCard}
          initialTabId={restoredFixtureTab}
        />
      ) : null}
      {/* `display: contents` wrapper — invisible to layout. While the fixture
          page is open it hides the scores stack but keeps it MOUNTED, so live
          polling state survives and Back is instant. */}
      <div
        className={
          'lfx-main-col' + (pageOpen ? ' lfx-main-col--hidden' : '')
        }
      >
      {championFixtureBundle ? (
        gohCollapsed ? (
          <GuardOfHonourCollapsedStrip
            titleTeamName={REIGNING_CHAMPION_TITLE_TEAM_NAME}
            onExpand={() => setGohCollapsedOverride(false)}
          />
        ) : (
          <GuardOfHonourSplash
            championStarters={championFixtureBundle.championStarters}
            opponentStarters={championFixtureBundle.opponentStarters}
            championTeamName={championFixtureBundle.championTeamName}
            opponentTeamName={championFixtureBundle.opponentTeamName}
            opponentManagerSurname={championFixtureBundle.opponentManagerSurname}
            onCollapse={() => setGohCollapsedOverride(true)}
          />
        )
      ) : null}
      {useFixtureLayout ? (
        <section
          className="tile tile--compact live-banner-group-tile"
          aria-label={`Gameweek ${gameweek} head-to-head fixtures`}
        >
          <div className="tile-head-row tile-head-row--tight live-banner-group__head">
            <h2 className="tile-title tile-title--sm live-banner-group__title">
              <span className="live-banner-group__live-dot" aria-hidden="true" />
              Live Scores
            </h2>
          </div>
          <div className="live-banner-group__list">
            {gwMatches.map((m, fixtureIndex) => {
              const homeId = Number(m.league_entry_1);
              const awayId = Number(m.league_entry_2);
              const homeName = teamNameForEntry(teams, homeId);
              const awayName = teamNameForEntry(teams, awayId);
              /**
               * Mobile (≤767px) tries the full club name (MSFG renders as
               * `Mordor SFG` via {@link standingsMobileTeamName}) — the
               * row's `FittedTeamName` measures the slot and falls back to
               * the curated short label only when the full name would
               * overflow, so nothing ever gets a mid-word ellipsis.
               */
              const homeDisplayName = mobileNarrowViewport
                ? standingsMobileTeamName(homeName)
                : homeName;
              const awayDisplayName = mobileNarrowViewport
                ? standingsMobileTeamName(awayName)
                : awayName;
              const homeSquad = squadByLeagueEntry.get(homeId);
              const awaySquad = squadByLeagueEntry.get(awayId);
              const homeLive = gwStandingsFrozen
                ? (finishedMatchPtsByLeagueEntry.get(homeId) ??
                  liveGwDisplayTotal(homeSquad))
                : liveGwDisplayTotal(homeSquad);
              const awayLive = gwStandingsFrozen
                ? (finishedMatchPtsByLeagueEntry.get(awayId) ??
                  liveGwDisplayTotal(awaySquad))
                : liveGwDisplayTotal(awaySquad);
              /**
               * Distinct-player count (`xiPlayersRemaining`) drives the
               * bracketed `(N)` indicator next to each side's score. Falls
               * back to `null` when the squad payload is missing/errored
               * (orphan / `entry_id` not yet ingested) so the renderer can
               * skip the chip cleanly. When `N === 0` the renderer swaps
               * `(0)` for the "all done" green pulse dot.
               */
              const homeRemaining =
                homeSquad && !homeSquad.error &&
                Number.isFinite(Number(homeSquad.xiPlayersRemaining))
                  ? Number(homeSquad.xiPlayersRemaining)
                  : null;
              const awayRemaining =
                awaySquad && !awaySquad.error &&
                Number.isFinite(Number(awaySquad.xiPlayersRemaining))
                  ? Number(awaySquad.xiPlayersRemaining)
                  : null;

              const homeVillain = villainVictoryEntryIds.has(homeId);
              const awayVillain = villainVictoryEntryIds.has(awayId);
              const homeHero = heroDefeatEntryIds.has(homeId);
              const awayHero = heroDefeatEntryIds.has(awayId);

              const fixtureKey = `${homeId}-${awayId}-${gameweek}`;

              // Hero defeat / villain victory narrative status adds the
              // tinted avatar ring on whichever crest carries the status,
              // plus a faint edge tint on the card itself.
              const homeStatus = homeVillain ? 'villain' : homeHero ? 'hero' : null;
              const awayStatus = awayVillain ? 'villain' : awayHero ? 'hero' : null;

              /**
               * Meta strip right side — the live favourite with their win
               * probability ("Mordor SFG 74%", locked live-odds mockup
               * Option R). When the odds are suppressed (finished GW,
               * predictions targeting another GW) MatchupMeta falls back to
               * the to-play counts on that side instead.
               */
              const favLabel = showFixtureOdds
                ? favouriteMetaLabel(
                    fixtureWinProbs(homeSquad, awaySquad, oddsById, sigmaScale),
                    homeDisplayName,
                    awayDisplayName,
                  )
                : null;

              return (
                <MatchupScorecard
                  key={fixtureKey}
                  fixture={{
                    homeId,
                    awayId,
                    homeName,
                    awayName,
                    homeLive,
                    awayLive,
                    homeRemaining,
                    awayRemaining,
                  }}
                  metaRight={favLabel}
                  liveRankByEntry={liveRankByEntry}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  homeDisplayName={homeDisplayName}
                  awayDisplayName={awayDisplayName}
                  homeStatus={homeStatus}
                  awayStatus={awayStatus}
                  onClick={() => openFixtureCard(fixtureIndex)}
                  className={[
                    homeVillain || awayVillain ? 'lo-matchup--villain-victory' : null,
                    homeHero || awayHero ? 'lo-matchup--hero-defeat' : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              );
            })}
          </div>
        </section>
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
                  <HeroVillainAvatarFrame
                    status={squadVillain ? 'villain' : squadHero ? 'hero' : null}
                    size="compact"
                  >
                    <TeamAvatar
                      entryId={squad.leagueEntryId}
                      name={squad.teamName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </HeroVillainAvatarFrame>
                  <span className="live-squad-title__text">
                    <span>
                      {squad.teamName}
                      <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                    </span>
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
              <SquadLineupPanel squad={squad} onPlayerClick={openLineupOrHistory} />
            </section>
          );
        })
      )}

      {useFixtureLayout && mobileNarrowViewport ? (
        <LiveFixtureCardDeck
          fixtures={cardFixtures}
          openIndex={cardDeckIndex}
          onClose={() => setCardDeckIndex(null)}
          ctx={cardDeckCtx}
          initialTabId={restoredFixtureTab}
          skipOpenAnimation={restoreScorecard}
        />
      ) : null}

      <section
        className="tile tile--compact player-contrib-tile"
        aria-labelledby="player-contrib-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="player-contrib-heading" className="tile-title tile-title--sm">
            Points Feed
          </h2>
        </div>
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

      <LiveOddsSection
        fixtures={cardFixtures}
        gameweek={gameweek}
        gwFinished={Boolean(selectedGwOption?.finished)}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
        liveRankByEntry={liveRankByEntry}
      />

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
                  <HeroVillainAvatarFrame
                    status={squadVillain ? 'villain' : squadHero ? 'hero' : null}
                    size="compact"
                  >
                    <TeamAvatar
                      entryId={squad.leagueEntryId}
                      name={squad.teamName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </HeroVillainAvatarFrame>
                  <span className="live-squad-title__text">
                    <span>
                      {squad.teamName}
                      <LeftToPlayOutsideAfter count={squad.leftToPlayCount} />
                    </span>
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
              <SquadLineupPanel squad={squad} onPlayerClick={openLineupOrHistory} />
            </section>
            );
          })
        : null}

      <section
        className="tile tile--compact tile--live-standings"
        aria-labelledby="live-standings-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="live-standings-heading" className="tile-title tile-title--sm">
            Live Table
          </h2>
        </div>
        {!tableRows?.length ? (
          <p className="muted muted--tight">No standings data.</p>
        ) : (
          <LiveStandingsTable
            liveStandingsRows={liveStandingsRows}
            gwStandingsFrozen={gwStandingsFrozen}
            gameweek={gameweek}
            teams={teams}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
            mobile={mobileNarrowViewport}
            villainEntryIds={villainVictoryEntryIds}
          />
        )}
      </section>

      </div>
        </>
      )}
    </div>
  );
}
