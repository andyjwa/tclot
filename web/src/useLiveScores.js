import { useState, useEffect, useCallback, useRef } from 'react';
import {
  computeProvisionalGwBonusByElementId,
  countElementGamesLeftToPlay,
  defensiveContributionCountFromLiveRow,
  fixturesForTeamInGw,
  gwTeamFixturesAllHardFinished,
  isFixtureFullyDone,
  selectDisplayBonus,
} from './fplBonusFromBps';
import { buildEffectiveLineup } from './fplAutosubProjection';
import { fetchEspnPremWindow } from './espnPremWindow.js';
import { fetchPulselivePremWindow } from './pulselivePremWindow.js';
import { mergePremWindowSources } from './premWindowMerger.js';
import { computeEspnMatchdayRole } from './espnMatchdayRoleForAutosub.js';
import {
  FPL_DIRECT,
  draftEntryEventUrl,
  draftResourceUrl,
  fplApiBase,
} from './fplDraftUrl';
import { fplShirtImageUrl } from './fplShirtUrl';
import { bustFplLiveCache, fetchFplJsonCached } from './fplFetchCache.js';
import { gameWeekSelectLabel } from './gwLabel.js';
import { countEffectiveXiPlayersRemaining } from './liveScoresDerivations.js';

/** Classic `fantasy.premierleague.com/api` path + query (fixtures, …). */
function classicResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '');
  const base = fplApiBase();
  if (base !== FPL_DIRECT) {
    return `${base.replace(/\/$/, '')}/${pq}`;
  }
  if (import.meta.env.DEV) {
    return `/__fpl/${pq}`;
  }
  return `${FPL_DIRECT}/${pq}`;
}

/** Draft bootstrap nests gameweeks in `events.data`; classic uses `events` array. */
function bootstrapEventList(boot) {
  const ev = boot?.events;
  if (ev && Array.isArray(ev.data)) return ev.data;
  if (Array.isArray(ev)) return ev;
  return [];
}

/** Draft `event/{gw}/live` returns `elements` as an id → { stats } map. */
function liveStatsByElementId(draftLiveJson) {
  const raw = draftLiveJson?.elements;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = (v && v.stats) || {};
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      out[id] = row.stats || {};
    }
  }
  return out;
}

/** Draft + classic live payloads: id → full element row (stats + explain). */
function liveFullByElementId(liveJson) {
  const raw = liveJson?.elements;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = v;
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      out[id] = row;
    }
  }
  return out;
}

function badgeUrl(teamCode) {
  if (teamCode == null) return null;
  return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`;
}

import { fplElementWebName, fetchKnownNameMap, enrichElementWithKnownName } from './fplElementNames.js';

/**
 * True when this PL team has at least one GW fixture and all are finished (provisional).
 * Used to style 0 minutes as DNP after the club’s match(es).
 */
function teamAllGwFixturesFinished(teamId, gwFixtures) {
  if (teamId == null || !Number.isFinite(teamId)) return false;
  if (!Array.isArray(gwFixtures) || !gwFixtures.length) return false;
  const mine = gwFixtures.filter(
    (f) => Number(f.team_h) === teamId || Number(f.team_a) === teamId
  );
  if (!mine.length) return false;
  return mine.every((f) => isFixtureFullyDone(f));
}

/**
 * FPL `short_name` for opponent(s) this GW (e.g. `MUN`, or `LEE · BUR` for a double).
 * @param {number | null} teamId
 * @param {object[]} gwFixtures
 * @param {Record<number, object>} teamById
 * @returns {string | null}
 */
function opponentShortLabelForTeam(teamId, gwFixtures, teamById) {
  if (teamId == null || !Number.isFinite(teamId)) return null;
  if (!Array.isArray(gwFixtures) || !gwFixtures.length) return null;
  const mine = gwFixtures.filter(
    (f) => Number(f.team_h) === teamId || Number(f.team_a) === teamId
  );
  if (!mine.length) return null;
  const sorted = mine.slice().sort((a, b) => {
    const ka = a.kickoff_time != null ? String(a.kickoff_time) : '';
    const kb = b.kickoff_time != null ? String(b.kickoff_time) : '';
    return ka.localeCompare(kb);
  });
  /** @type {string[]} */
  const labels = [];
  const seen = new Set();
  for (const f of sorted) {
    const th = Number(f.team_h);
    const ta = Number(f.team_a);
    const opp = th === teamId ? ta : th;
    const t = teamById[opp];
    const short = t?.short_name;
    if (!short || seen.has(short)) continue;
    seen.add(short);
    labels.push(String(short));
  }
  return labels.length ? labels.join(' · ') : null;
}

/**
 * 0 minutes and club still has at least one unfinished PL fixture this GW (or no fixture list).
 * @param {number} minutes
 * @param {number | null} teamId
 * @param {object[]} gwFixtures
 */
function computeStillYetToPlayPl(minutes, teamId, gwFixtures) {
  if ((Number(minutes) || 0) > 0) return false;
  if (!Array.isArray(gwFixtures) || !gwFixtures.length) return true;
  if (teamId == null || !Number.isFinite(teamId)) return false;
  return gwFixtures.some(
    (f) =>
      (Number(f.team_h) === teamId || Number(f.team_a) === teamId) &&
      !isFixtureFullyDone(f)
  );
}

/**
 * Unfinished PL fixtures this GW for this club (e.g. 2 in a double gameweek before either kicks off).
 * When the schedule is unknown (`gwFixtures` empty), returns 1 so counts stay player-shaped.
 * @param {number | null} teamId
 * @param {object[]} gwFixtures
 */
function countUnfinishedGwFixturesForTeam(teamId, gwFixtures) {
  if (teamId == null || !Number.isFinite(teamId)) return 0;
  if (!Array.isArray(gwFixtures) || !gwFixtures.length) return 1;
  const n = gwFixtures.filter(
    (f) =>
      (Number(f.team_h) === teamId || Number(f.team_a) === teamId) &&
      !isFixtureFullyDone(f)
  ).length;
  return n;
}

function mapPickRows(
  picks,
  liveByElementId,
  liveFullByElementId,
  elementById,
  teamById,
  typeById,
  gwFixtures,
  espnPremRows
) {
  const rows = (picks || []).map((p) => {
    const pid = Number(p.element);
    const el = elementById[pid];
    const tm = el ? teamById[el.team] : null;
    const typ = el ? typeById[el.element_type] : null;
    const st = liveByElementId[pid] || {};
    const liveRow = liveFullByElementId[pid];
    const multRaw = Number(p.multiplier);
    const fplMultiplier =
      Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1;
    const mins = st.minutes ?? 0;
    const goalsScored = Number(st.goals_scored) || 0;
    const assists = Number(st.assists) || 0;
    const pts = st.total_points ?? 0;
    const bps = st.bps ?? 0;
    const bonusApi = st.bonus ?? 0;
    const webName = el?.web_name ?? `Player #${pid}`;
    const tid = el?.team != null ? Number(el.team) : null;
    const opponentShortLabel = opponentShortLabelForTeam(tid, gwFixtures, teamById);
    const hasGwFixture = (() => {
      if (tid == null || !Number.isFinite(tid)) return true;
      if (!Array.isArray(gwFixtures) || !gwFixtures.length) return true;
      return gwFixtures.some(
        (f) => Number(f.team_h) === tid || Number(f.team_a) === tid
      );
    })();
    const stillYetToPlayPl = computeStillYetToPlayPl(mins, tid, gwFixtures);
    const leftToPlayStarter = p.position <= 11 && stillYetToPlayPl;
    const leftToPlayFixtureCount = countUnfinishedGwFixturesForTeam(tid, gwFixtures);
    const playerGamesLeftToPlay = countElementGamesLeftToPlay(
      el,
      liveRow,
      gwFixtures,
      tid,
      mins
    );
    const teamGwFixturesThisEvent =
      tid != null && Number.isFinite(tid) && Array.isArray(gwFixtures) && gwFixtures.length
        ? fixturesForTeamInGw(gwFixtures, tid)
        : [];
    const teamGwFixtureCount = teamGwFixturesThisEvent.length;
    const teamSingleFixtureLiveOrDone =
      teamGwFixturesThisEvent.length === 1 &&
      (() => {
        const f = teamGwFixturesThisEvent[0];
        return (
          isFixtureFullyDone(f) ||
          f?.started === true ||
          Number(f?.minutes) > 0
        );
      })();
    const espnMatchdayRole = computeEspnMatchdayRole(
      espnPremRows,
      gwFixtures,
      pid,
      tid
    );
    return {
      element: pid,
      web_name: webName,
      displayName: fplElementWebName(el, pid),
      /** FPL element `status`: `i` = injured (see bootstrap-static). */
      availabilityStatus: el?.status != null ? String(el.status) : null,
      availabilityNews: el?.news != null ? String(el.news) : null,
      teamShort: tm?.short_name ?? '—',
      teamName: tm?.name ?? null,
      opponentShortLabel,
      posSingular: typ?.singular_name_short ?? '—',
      shirtUrl: fplShirtImageUrl(tm?.code, el?.element_type),
      badgeUrl: badgeUrl(tm?.code),
      minutes: mins,
      goalsScored,
      assists,
      total_points: pts,
      bps,
      bonusApi,
      bonus: bonusApi,
      pickPosition: p.position,
      /** Draft captain / vice scoring — applied to `total_points` after provisional bonus. */
      fplMultiplier,
      dcCount: defensiveContributionCountFromLiveRow(liveRow),
      clubGwFixturesFinished: teamAllGwFixturesFinished(tid, gwFixtures),
      stillYetToPlayPl,
      leftToPlayStarter,
      /** Games left for this player’s club this GW (DGW ⇒ 2 when both fixtures unfinished). */
      leftToPlayFixtureCount,
      /** Per-player fixture count still to score from (DGW after first match uses explain / heuristics). */
      playerGamesLeftToPlay,
      /** False when the player’s real-life club has no PL match this gameweek (blank week for that team). */
      hasGwFixture,
      /** PL fixtures this GW for this player’s club (same filter as classic `event=` list). */
      teamGwFixtureCount,
      /**
       * True only when the club has exactly one GW fixture and it has kicked off or finished
       * (`started`, live `minutes`, or finished flags). Drives live autosub projection for
       * 0-min starters (e.g. not in matchday squad) before FPL closes the club’s GW.
       */
      teamSingleFixtureLiveOrDone,
      /**
       * ESPN Prem confirmed matchday squad role (`xi` / `bench` / `absent`) for projected autosub;
       * `null` when unknown (no lineups, DGW, or low name-match coverage).
       */
      espnMatchdayRole,
    };
  });
  rows.sort((a, b) => a.pickPosition - b.pickPosition);
  return rows;
}

/**
 * Total **fixtures** still to play for the **effective** starting XI (post-autosub when available):
 * sum of each starter’s `playerGamesLeftToPlay` (DGW can contribute 2 per player).
 * @param {object[]} xiRows — 11 rows from submitted starters or `displayStarters`
 */
function countEffectiveXiLeftToPlayGames(xiRows) {
  if (!Array.isArray(xiRows) || !xiRows.length) return 0;
  let total = 0;
  for (const r of xiRows) {
    const n = Number(r.playerGamesLeftToPlay);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}


/** Same rule as `startersForEffectiveXi` in LiveScores — full bench length match. */
function xiRowsForLeftToPlayCount(starters, bench, displayStarters, displayBench) {
  const nBench = bench?.length ?? 0;
  if (
    Array.isArray(displayStarters) &&
    displayStarters.length === 11 &&
    Array.isArray(displayBench) &&
    displayBench.length === nBench
  ) {
    return displayStarters;
  }
  return starters;
}

function applyBonusColumn(rows, provisionalByElement, elementById, gwFixtures) {
  return rows.map((r) => {
    const prov = provisionalByElement.get(r.element) ?? 0;
    const el = elementById?.[r.element];
    const trustApiZero =
      el != null &&
      gwTeamFixturesAllHardFinished(el.team, gwFixtures) &&
      (Number(r.bonusApi) || 0) === 0;
    const display = selectDisplayBonus(r.bonusApi, prov, { trustApiZero });
    const total_points =
      Number(r.total_points) - Number(r.bonusApi) + Number(display);
    return { ...r, bonus: display, total_points };
  });
}

/**
 * Live GW data from **draft** FPL APIs (browser fetch).
 * Uses draft bootstrap + draft event/live so element IDs match draft picks (classic uses a different id→player map).
 * @param {{ teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>, gameweek: number | null, enabled: boolean, onBootstrapLiveMeta?: (meta: { currentGw: number | null }) => void, pollIntervalMs?: number | null }} opts
 */
export function useLiveScores({
  teams,
  gameweek,
  enabled,
  onBootstrapLiveMeta,
  pollIntervalMs = null,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventSnapshot, setEventSnapshot] = useState(null);
  const [squads, setSquads] = useState([]);
  /** For player-contribution deltas: full live rows + bootstrap maps */
  const [contributionLiveContext, setContributionLiveContext] = useState(null);
  /** Classic `fantasy.premierleague.com/api/fixtures` failed; draft/live+picks path still succeeds. */
  const [fixturesDegradedNotice, setFixturesDegradedNotice] = useState(null);

  /** Parent passes a new `teams` array each render; ref avoids infinite load loops. */
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const bootstrapMetaCbRef = useRef(onBootstrapLiveMeta);
  bootstrapMetaCbRef.current = onBootstrapLiveMeta;

  /** When this goes 0 → N, we must re-fetch (load is not tied to `teams` by reference). */
  const teamCount = teams?.length ?? 0;

  /** Bumps on each load start so a slow stale request cannot overwrite newer squads (wrong players / GW). */
  const loadGenerationRef = useRef(0);

  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const load = useCallback(async () => {
    const teamList = teamsRef.current;
    const gw = Number(gameweek);
    if (!enabled || !Number.isFinite(gw) || !teamList?.length) return;

    loadGenerationRef.current += 1;
    const loadGen = loadGenerationRef.current;

    setLoading(true);
    setError(null);
    setFixturesDegradedNotice(null);

    try {
      const bootUrl = draftResourceUrl('bootstrap-static');
      const boot = await fetchFplJsonCached(bootUrl, {
        label: 'draft bootstrap-static',
      });
      const evRoot = boot.events;
      const evList = bootstrapEventList(boot);
      const currentGw = evRoot?.current;
      const nextGw = evRoot?.next;
      const currentGwNum =
        currentGw != null && Number.isFinite(Number(currentGw))
          ? Number(currentGw)
          : null;
      bootstrapMetaCbRef.current?.({ currentGw: currentGwNum });
      const evs = evList.map((e) => ({
        ...e,
        is_current: e.id === currentGw,
        is_next: e.id === nextGw,
      }));
      if (loadGen !== loadGenerationRef.current) return;
      setEvents(evs);
      const ev = evs.find((e) => e.id === gw);
      setEventSnapshot(ev ?? { id: gw, name: gameWeekSelectLabel(gw) });

      const knownMap = await fetchKnownNameMap();
      const elements = (boot.elements || []).map((e) =>
        enrichElementWithKnownName(e, knownMap),
      );

      const elementById = Object.fromEntries(
        elements.map((e) => [Number(e.id), e]),
      );
      const teamById = Object.fromEntries(
        (boot.teams || []).map((t) => [Number(t.id), t])
      );
      const typeById = Object.fromEntries(
        (boot.element_types || []).map((t) => [Number(t.id), t])
      );

      const liveUrl = draftResourceUrl(`event/${gw}/live`);
      const liveJson = await fetchFplJsonCached(liveUrl, {
        label: 'draft event/live',
      });
      const liveByElementId = liveStatsByElementId(liveJson);
      const liveFull = liveFullByElementId(liveJson);
      const liveFullNumeric = {};
      for (const [k, v] of Object.entries(liveFull)) {
        const id = Number(k);
        if (Number.isFinite(id)) liveFullNumeric[id] = v;
      }

      // Trailing slash matters: `fixtures?event=N` returns HTTP 301 to the
      // same URL with `/` before the query, and the dev proxy passes the
      // relative `Location` header back to the browser unresolved — the
      // browser then re-fetches `/api/fixtures/?event=N` against the dev
      // origin (Vite SPA) instead of upstream FPL, and HTML lands here as
      // "Unexpected token '<', '<!doctype '..." Adding the slash up-front
      // skips the redirect and reaches FPL's JSON directly.
      const fxUrl = classicResourceUrl(`fixtures/?event=${gw}`);
      let gwFixtures = [];
      try {
        const fixturesPayload = await fetchFplJsonCached(fxUrl, {
          label: 'classic fixtures',
        });
        gwFixtures = Array.isArray(fixturesPayload)
          ? fixturesPayload.filter((f) => Number(f.event) === gw)
          : [];
      } catch (fixtureErr) {
        const msg = fixtureErr?.message || String(fixtureErr);
        gwFixtures = [];
        const is503 = /\b503\b/.test(msg);
        if (loadGen === loadGenerationRef.current) {
          setFixturesDegradedNotice(
            is503
              ? 'FPL’s classic fixtures API is returning HTTP 503 (often “The game is being updated.” during maintenance). Draft lineups and live points still load below; provisional bonus, opponent labels, Premier window / ESPN bridge, and some “played / yet to play” hints may be wrong until classics respond again.'
              : `Classic fixtures failed (${msg}). Draft lineups and live points still load; fixture-dependent details may be wrong until this succeeds.`,
          );
        }
      }

      const provisionalByElement = computeProvisionalGwBonusByElementId(
        elements,
        liveFullNumeric,
        gwFixtures
      );

      if (loadGen !== loadGenerationRef.current) return;

      /**
       * Prem window: Pulselive (official PL backend) is primary, ESPN is fallback.
       *
       *   - Pulselive lineups land at T-75 (clubs are league-mandated to submit team sheets
       *     75 minutes before kickoff). ESPN follows about 15 minutes later (T-60).
       *   - Pulselive event timeline has wallclock-precise UTC for goals/assists/cards/own
       *     goals (`time.millis`) plus `assistId` bundled onto goal rows — same role ESPN
       *     plays today but earlier and from the official feed.
       *
       * Both calls run in parallel; merger picks the better source per fixture so a
       * Pulselive outage degrades gracefully to ESPN. Per-source failures are swallowed
       * (the `.catch(() => [])` belt + try/catch braces) — the merger handles missing
       * rows on either side.
       */
      let espnPremRows = [];
      try {
        const [pulseRows, espnRows] = await Promise.all([
          fetchPulselivePremWindow({ gwFixtures, teamById, elementById }).catch(
            () => [],
          ),
          fetchEspnPremWindow({ gwFixtures, teamById, elementById }).catch(() => []),
        ]);
        espnPremRows = mergePremWindowSources(pulseRows, espnRows, {
          primaryLabel: 'pulselive',
          fallbackLabel: 'espn',
        });
      } catch {
        espnPremRows = [];
      }
      if (loadGen !== loadGenerationRef.current) return;

      const squadList = await Promise.all(
        teamList.map(async (t) => {
          if (t.fplEntryId == null) {
            return {
              leagueEntryId: t.id,
              teamName: t.teamName,
              fplEntryId: null,
              error:
                'Missing FPL entry id in league data (need real details.json with entry_id).',
              starters: [],
              bench: [],
              displayStarters: [],
              displayBench: [],
              gwPoints: null,
              autoSubs: [],
              autosubSource: 'none',
              projectedAutoSubs: [],
              leftToPlayCount: null,
              xiPlayersRemaining: null,
            };
          }

          const url = draftEntryEventUrl(t.fplEntryId, gw);
          let picksPayload;
          try {
            picksPayload = await fetchFplJsonCached(url, { label: 'draft picks' });
          } catch (pickErr) {
            const pickMsg = pickErr?.message || String(pickErr);
            const statusMatch = pickMsg.match(/HTTP (\d+)/);
            return {
              leagueEntryId: t.id,
              teamName: t.teamName,
              fplEntryId: t.fplEntryId,
              error: statusMatch
                ? `Draft picks HTTP ${statusMatch[1]}`
                : pickMsg,
              starters: [],
              bench: [],
              displayStarters: [],
              displayBench: [],
              gwPoints: null,
              autoSubs: [],
              autosubSource: 'none',
              projectedAutoSubs: [],
              leftToPlayCount: null,
              xiPlayersRemaining: null,
            };
          }
          const picks = picksPayload.picks || [];
          const rows = mapPickRows(
            picks,
            liveByElementId,
            liveFullNumeric,
            elementById,
            teamById,
            typeById,
            gwFixtures,
            espnPremRows
          );
          const withBonus = applyBonusColumn(
            rows,
            provisionalByElement,
            elementById,
            gwFixtures
          );
          const withCaptain = withBonus.map((r) => ({
            ...r,
            total_points:
              Number(r.total_points) * (Number(r.fplMultiplier) || 1),
          }));
          const starters = withCaptain.filter((r) => r.pickPosition <= 11);
          const bench = withCaptain.filter((r) => r.pickPosition > 11);

          const eh = picksPayload.entry_history;
          const gwPoints =
            eh && typeof eh.points === 'number' ? eh.points : null;
          const pointsOnBench =
            eh && typeof eh.points_on_bench === 'number'
              ? eh.points_on_bench
              : null;
          const autoSubs =
            picksPayload.automatic_subs ?? picksPayload.subs ?? [];

          const {
            displayStarters,
            displayBench,
            autosubSource,
            projectedAutoSubs,
          } = buildEffectiveLineup({ starters, bench, autoSubs });

          const xiForLtp = xiRowsForLeftToPlayCount(
            starters,
            bench,
            displayStarters,
            displayBench
          );
          const leftToPlayCount = countEffectiveXiLeftToPlayGames(xiForLtp);
          /**
           * Distinct-player count for the FPL Live → Live GW fixture row
           * `(N)` indicator. Derived from the same `xiForLtp` rows as
           * {@link leftToPlayCount} so the two stay in sync, but DGW players
           * count as 1 here regardless of how many fixtures they have left.
           */
          const xiPlayersRemaining = countEffectiveXiPlayersRemaining(xiForLtp);

          return {
            leagueEntryId: t.id,
            teamName: t.teamName,
            fplEntryId: t.fplEntryId,
            error: null,
            starters,
            bench,
            displayStarters,
            displayBench,
            gwPoints,
            pointsOnBench,
            autoSubs,
            autosubSource,
            projectedAutoSubs,
            leftToPlayCount,
            xiPlayersRemaining,
          };
        })
      );

      if (loadGen !== loadGenerationRef.current) return;
      setSquads(squadList);
      const gwTeamIdSet = new Set();
      for (const f of gwFixtures) {
        const th = Number(f.team_h);
        const ta = Number(f.team_a);
        if (Number.isFinite(th)) gwTeamIdSet.add(th);
        if (Number.isFinite(ta)) gwTeamIdSet.add(ta);
      }
      setContributionLiveContext({
        liveFullByElementId: liveFullNumeric,
        /** Per-element `stats` from the same `event/{gw}/live` — fallback when a full row is not keyed. */
        liveByElementId,
        elementById,
        typeById,
        teamById,
        /** Classic GW fixtures (kickoff + live `minutes`) for contribution ordering. */
        gwFixtures,
        /** PL teams with a fixture this GW — used to include all players in contribution deltas. */
        gwTeamIds: [...gwTeamIdSet],
        /** Draft `settings.scoring` — points per goal/assist/cards etc. */
        draftScoring: boot?.settings?.scoring ?? null,
      });
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      if (loadGen === loadGenerationRef.current) {
        setFixturesDegradedNotice(null);
        setError(e?.message || String(e));
        setSquads([]);
        setContributionLiveContext(null);
      }
    } finally {
      if (loadGen === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, gameweek, teamCount]);

  useEffect(() => {
    if (
      enabled &&
      gameweek != null &&
      Number.isFinite(Number(gameweek)) &&
      teamCount > 0
    ) {
      void load();
    }
  }, [enabled, gameweek, load, teamCount]);

  const canPollLiveGw = (() => {
    if (!tabVisible) return false;
    if (pollIntervalMs == null || !(Number(pollIntervalMs) > 0)) return false;
    const gw = Number(gameweek);
    if (!Number.isFinite(gw)) return false;
    const curEv = events.find((e) => e.is_current);
    const cur = curEv?.id;
    if (cur == null || Number(cur) !== gw) return false;
    if (eventSnapshot?.finished) return false;
    return true;
  })();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!enabled || !canPollLiveGw) return undefined;
    const ms = Number(pollIntervalMs);
    const id = window.setInterval(() => {
      void load();
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, canPollLiveGw, pollIntervalMs, load, tabVisible]);

  const refresh = useCallback(() => {
    bustFplLiveCache();
    return load();
  }, [load]);

  return {
    loading,
    error,
    fixturesDegradedNotice,
    refresh,
    lastUpdated,
    events,
    eventSnapshot,
    squads,
    contributionLiveContext,
  };
}
