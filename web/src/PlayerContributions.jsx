import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TeamAvatar } from './TeamAvatar';
import {
  buildLatestDropByElementOut,
  buildOwnerByElementId,
  buildTrackedElementIdSetWithFixtures,
  compareContributionEventsDesc,
  compareContributionEventsDescWithContext,
  contributionCoverageKey,
  contributionEventMatchesGameweek,
  fplCumulativeEventOrdinalLabel,
  liveElementRowForFeedValidation,
  fplTotalFeedEventContradictsLive,
  contributionCoveredByTimelineOmit,
  diffContributionEvents,
} from './playerContributionEvents';
import {
  mergePersistPlayerContributions,
  playerContributionStorageKey,
  readPlayerContributionBucket,
} from './playerContributionStorage';
import { fetchEspnContributionTimeline } from './espnPremTimeline';
import {
  fplElementDisplayName,
  fplElementWebName,
} from './fplElementNames.js';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';

/**
 * ESPN supplies real wallclock (epoch-ms) ordering for these. We prefer its ordering when it matches
 * the player; FPL approximates the rest (save_points / dc_points — ESPN doesn't cover — always FPL).
 */
const ESPN_KINDS = new Set(['goal', 'assist', 'yellow_card', 'red_card']);

/**
 * Drop previously-stored ESPN rows — used when a fetch returns empty so stale data doesn't stick.
 * Also strips legacy `fotmob:` rows from storage so upgrading users don't see orphan events.
 */
function stripStaleTimelineRows(events) {
  return (events || []).filter((e) => {
    const id = String(e?.stableId || '');
    return !id.startsWith('espn:') && !id.startsWith('fotmob:');
  });
}

/**
 * Keys {@link contributionCoverageKey} for each ESPN (or FotMob) row — per FPL fixture so
 * a player can have assists from FPL in a match where ESPN did not list them (e.g. OG assists).
 * @param {Array<{ elementId?: number, kind?: string, fplFixtureId?: number | null }>} timelineEvents
 */
function buildTimelineCoverageSet(timelineEvents) {
  const s = new Set();
  for (const e of timelineEvents || []) {
    const elid = Number(e?.elementId);
    const kind = e?.kind;
    if (!Number.isFinite(elid) || !kind) continue;
    s.add(contributionCoverageKey(elid, kind, e?.fplFixtureId));
  }
  return s;
}

function badgeUrl(teamCode) {
  if (teamCode == null) return null;
  return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`;
}

function pointsPerGoal(scoring, elementTypeId) {
  const et = Number(elementTypeId);
  if (!scoring) {
    if (et === 1) return 10;
    if (et === 2) return 6;
    if (et === 3) return 5;
    if (et === 4) return 4;
    return 4;
  }
  if (et === 1) return Number(scoring.goals_scored_GKP) || 10;
  if (et === 2) return Number(scoring.goals_scored_DEF) || 6;
  if (et === 3) return Number(scoring.goals_scored_MID) || 5;
  if (et === 4) return Number(scoring.goals_scored_FWD) || 4;
  return 4;
}

/** FPL-style: `settings.scoring.own_goals` (e.g. -2). Not position-specific in standard rules. */
function pointsPerOwnGoal(scoring) {
  const n = Number(scoring?.own_goals);
  if (Number.isFinite(n)) return n;
  return -2;
}

/** e.g. (+3) or (-1) */
function pointsBracket(signedTotal) {
  if (!Number.isFinite(signedTotal) || signedTotal === 0) return '';
  if (signedTotal > 0) return ` (+${signedTotal})`;
  return ` (${signedTotal})`;
}

/**
 * @param {string} kind
 * @param {number} delta — count for goals/assists/cards; fantasy pts for dc_points / save_points
 * @param {number | null | undefined} elementTypeId
 * @param {object | null | undefined} scoring — draft `settings.scoring`
 * @param {{ isOwnGoal?: boolean }} [opts]
 * @returns {{ emoji: string, text: string, bracket: string }}
 */
function contributionActionParts(kind, delta, elementTypeId, scoring, opts) {
  const d = Number(delta) || 0;
  const assistPts = Number(scoring?.assists) || 3;
  const yellowPts = Number(scoring?.yellow_cards) || -1;
  const redPts = Number(scoring?.red_cards) || -3;

  if (kind === 'goal') {
    const label = opts?.isOwnGoal
      ? d === 1
        ? 'OWN GOAL'
        : `${d} OWN GOALS`
      : d === 1
        ? 'GOAL'
        : `${d} GOALS`;
    const pts = opts?.isOwnGoal
      ? d * pointsPerOwnGoal(scoring)
      : d * pointsPerGoal(scoring, elementTypeId);
    const br = pointsBracket(pts);
    return { emoji: '⚽', text: `${label}${br}`, bracket: br };
  }
  if (kind === 'assist') {
    const label = d === 1 ? 'ASSIST' : `${d} ASSISTS`;
    const br = pointsBracket(d * assistPts);
    return { emoji: '🍑', text: `${label}${br}`, bracket: br };
  }
  if (kind === 'dc_points') {
    const br = pointsBracket(d);
    return { emoji: '🪖', text: `DEF CON${br}`, bracket: br };
  }
  if (kind === 'save_points') {
    const label = d === 1 ? 'SAVES' : `SAVES ×${d}`;
    const br = pointsBracket(d);
    return { emoji: '🧤', text: `${label}${br}`, bracket: br };
  }
  if (kind === 'yellow_card') {
    const label = d === 1 ? 'YELLOW' : `${d} YELLOWS`;
    const br = pointsBracket(d * yellowPts);
    return { emoji: '🟨', text: `${label}${br}`, bracket: br };
  }
  if (kind === 'red_card') {
    const label = d === 1 ? 'RED CARD' : `${d} RED CARDS`;
    const br = pointsBracket(d * redPts);
    return { emoji: '🟥', text: `${label}${br}`, bracket: br };
  }
  return { emoji: '', text: String(kind).toUpperCase(), bracket: '' };
}

/** Mins from live `stats` (GW snapshot — not the exact event clock). */
function liveStatMinutesLabel(liveFull, elementId) {
  const st = liveFull?.[Number(elementId)]?.stats;
  const m = st != null ? Number(st.minutes) : null;
  if (!Number.isFinite(m) || m < 0) return '—';
  return `${Math.min(120, Math.floor(m))}'`;
}

/** First word of fantasy / waiver label — e.g. “Toronto Oizo” → “Toronto”. */
function fantasyTeamFirstLabel(ownerLeagueEntryId, ownerTeamName, ownerLine) {
  if (ownerLeagueEntryId == null) {
    return 'Waiver';
  }
  const t = String(ownerTeamName ?? ownerLine ?? '').trim();
  if (!t) return '—';
  return t.split(/\s+/)[0] || t;
}

function firstWordOnly(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.split(/\s+/)[0] || t;
}

/** Yellow, red, DC, and save rows only if the player is on a league roster (starters or bench). */
const CONTRIBUTION_KINDS_LEAGUE_ROSTER_ONLY = new Set([
  'yellow_card',
  'red_card',
  'dc_points',
  'save_points',
]);

function contributionEventShownForLeague(ev, ownerByElementId) {
  if (!ev || !CONTRIBUTION_KINDS_LEAGUE_ROSTER_ONLY.has(ev.kind)) return true;
  const id = Number(ev.elementId);
  if (!Number.isFinite(id)) return false;
  return ownerByElementId.has(id);
}

function mergeUniqueByStableId(preferFirstLists, compareFn = compareContributionEventsDesc) {
  const m = new Map();
  for (const list of preferFirstLists) {
    for (const ev of list || []) {
      const sid = ev?.stableId;
      if (!sid || m.has(sid)) continue;
      m.set(sid, ev);
    }
  }
  return [...m.values()].sort(compareFn);
}

async function fetchArchiveEventsForGw(gameweek) {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = new URL('league-data/player-contributions-gw.json', base).href;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const gk = String(gameweek);
    const bucket = j?.byGw?.[gk] ?? j?.byGw?.[gameweek];
    return Array.isArray(bucket?.events) ? bucket.events : [];
  } catch {
    return [];
  }
}

/**
 * @param {{
 *   leagueId: number | null | undefined,
 *   gameweek: number,
 *   squads: object[],
 *   contributionLiveContext: object | null,
 *   waiverOutGwRows: object[],
 *   lastUpdated: string | null,
 *   teamLogoMap?: object,
 *   kitIndexByEntry?: object,
 * }} props
 */
export function PlayerContributions({
  leagueId,
  gameweek,
  squads,
  contributionLiveContext,
  waiverOutGwRows,
  lastUpdated,
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const [displayed, setDisplayed] = useState([]);
  /**
   * {@link contributionCoverageKey} per ESPN/FotMob row (includes `fplFixtureId`) so
   * FPL-only assists in the same GW are not hidden after an assist ESPN covered in another game.
   */
  const [timelineCoverage, setTimelineCoverage] = useState(
    /** @type {Set<string>} */ (new Set())
  );
  /** '' = all fantasy teams; otherwise `leagueEntryId` of owning squad. */
  const [fantasyTeamEntryId, setFantasyTeamEntryId] = useState('');
  /** When all false, every contribution kind is shown. When any true, only those kinds (union). */
  const [filterGoal, setFilterGoal] = useState(false);
  const [filterAssist, setFilterAssist] = useState(false);
  const [filterDc, setFilterDc] = useState(false);
  const [filterCards, setFilterCards] = useState(false);
  const prevLiveRef = useRef(null);
  const hydratedKeyRef = useRef('');
  const listScrollRef = useRef(null);
  const storageKey = useMemo(
    () => playerContributionStorageKey(leagueId, gameweek),
    [leagueId, gameweek]
  );

  const ownerByEl = useMemo(() => buildOwnerByElementId(squads), [squads]);
  const dropByEl = useMemo(
    () => buildLatestDropByElementOut(waiverOutGwRows),
    [waiverOutGwRows]
  );

  const tracked = useMemo(
    () =>
      buildTrackedElementIdSetWithFixtures(
        squads,
        waiverOutGwRows,
        contributionLiveContext?.elementById ?? {},
        contributionLiveContext?.gwTeamIds ?? []
      ),
    [
      squads,
      waiverOutGwRows,
      contributionLiveContext?.elementById,
      contributionLiveContext?.gwTeamIds,
    ]
  );

  const contribCtxRef = useRef(contributionLiveContext);
  contribCtxRef.current = contributionLiveContext;

  /** Fresh live + fixtures on each merge so ordering follows real-world fixture chronology (latest first). */
  const mergeContributionLists = useCallback((preferFirstLists) => {
    const ctx = contribCtxRef.current;
    return mergeUniqueByStableId(
      preferFirstLists,
      compareContributionEventsDescWithContext({
        liveFullByElementId: ctx?.liveFullByElementId,
        elementById: ctx?.elementById,
        gwFixtures: ctx?.gwFixtures ?? [],
      })
    );
  }, []);

  const contributionSortCtx = useMemo(
    () => ({
      liveFullByElementId: contributionLiveContext?.liveFullByElementId,
      elementById: contributionLiveContext?.elementById,
      gwFixtures: contributionLiveContext?.gwFixtures ?? [],
    }),
    [
      contributionLiveContext?.liveFullByElementId,
      contributionLiveContext?.elementById,
      contributionLiveContext?.gwFixtures,
    ]
  );

  const compareRowsFn = useMemo(
    () => compareContributionEventsDescWithContext(contributionSortCtx),
    [contributionSortCtx]
  );

  const hydrate = useCallback(async () => {
    const k = `${leagueId ?? 'x'}:${gameweek}`;
    hydratedKeyRef.current = k;
    const gwNum = Number(gameweek);
    const [arch, bucket] = await Promise.all([
      fetchArchiveEventsForGw(gameweek),
      Promise.resolve(readPlayerContributionBucket(storageKey)),
    ]);
    const local = bucket?.events ?? [];
    setDisplayed((prev) => {
      if (hydratedKeyRef.current !== k) return prev;
      const espnFromUi = (prev || []).filter(
        (e) =>
          Number.isFinite(gwNum) &&
          Number(e?.gameweek) === gwNum &&
          (String(e?.stableId || '').startsWith('espn:') ||
            String(e?.stableId || '').startsWith('fotmob:'))
      );
      return mergeContributionLists([espnFromUi, local, arch]);
    });
  }, [leagueId, gameweek, storageKey, mergeContributionLists]);

  useEffect(() => {
    prevLiveRef.current = null;
    setDisplayed([]);
    setTimelineCoverage(new Set());
    setFantasyTeamEntryId('');
    setFilterGoal(false);
    setFilterAssist(false);
    setFilterDc(false);
    setFilterCards(false);
  }, [gameweek, leagueId]);

  const fantasyTeamOptions = useMemo(() => {
    const out = [];
    for (const q of squads || []) {
      if (q?.error) continue;
      const id = q.leagueEntryId;
      if (id == null || !Number.isFinite(Number(id))) continue;
      const name = String(q.teamName ?? '').trim() || `Team ${id}`;
      out.push({ id: Number(id), name });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return out;
  }, [squads]);

  const espnFetchKey = useMemo(() => {
    const fx = contributionLiveContext?.gwFixtures || [];
    const ids = fx
      .map((f) => Number(f.id))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    return `${gameweek}|${ids.join(',')}`;
  }, [gameweek, contributionLiveContext?.gwFixtures]);

  const trackedKey = useMemo(
    () =>
      [...tracked]
        .filter((n) => Number.isFinite(Number(n)))
        .sort((a, b) => a - b)
        .join(','),
    [tracked]
  );

  useEffect(() => {
    const ctx = contribCtxRef.current;
    if (!ctx?.gwFixtures?.length || !ctx?.elementById || !ctx?.teamById) return;
    let cancelled = false;
    void (async () => {
      try {
        const liveCtx = contribCtxRef.current;
        if (!liveCtx?.gwFixtures?.length) return;
        const ev = await fetchEspnContributionTimeline({
          gameweek,
          gwFixtures: liveCtx.gwFixtures,
          elementById: liveCtx.elementById,
          teamById: liveCtx.teamById,
          trackedElementIds: tracked,
        });
        if (cancelled) return;
        const timelineEvents = (ev || []).filter((e) => ESPN_KINDS.has(e.kind));
        if (timelineEvents.length) {
          const filteredEv = timelineEvents.filter((e) =>
            contributionEventShownForLeague(e, ownerByEl)
          );
          const coverage = buildTimelineCoverageSet(filteredEv);
          setTimelineCoverage(coverage);
          setDisplayed((prev) => {
            const gwFx = liveCtx.gwFixtures || [];
            const eBy = liveCtx.elementById || {};
            const keep = (prev || []).filter((e) => {
              const sid = String(e?.stableId || '');
              if (sid.startsWith('espn:') || sid.startsWith('fotmob:')) return false;
              const elid = Number(e?.elementId);
              const elRow = Number.isFinite(elid) ? eBy[elid] : null;
              if (
                contributionCoveredByTimelineOmit(
                  coverage,
                  elid,
                  e?.kind,
                  e?.fplFixtureId,
                  elRow?.team,
                  gwFx
                )
              ) {
                return false;
              }
              return true;
            });
            return mergeContributionLists([filteredEv, keep]);
          });
          const bucket = readPlayerContributionBucket(storageKey);
          mergePersistPlayerContributions(
            storageKey,
            bucket?.events ?? [],
            filteredEv,
            2000
          );
        } else {
          setTimelineCoverage(new Set());
          setDisplayed((prev) => stripStaleTimelineRows(prev));
        }
      } catch {
        if (!cancelled) {
          setTimelineCoverage(new Set());
          setDisplayed((prev) => stripStaleTimelineRows(prev));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [espnFetchKey, gameweek, storageKey, trackedKey, ownerByEl]);

  /**
   * ESPN/FotMob coverage keys → FPL diff skips only matching (player, kind, fixture) slots.
   */
  const fplOmitByElementKind = useMemo(
    () => timelineCoverage,
    [timelineCoverage]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      await hydrate();
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!lastUpdated || !contributionLiveContext?.liveFullByElementId) return;
    const ctx = contributionLiveContext;
    const next = ctx.liveFullByElementId;
    const nowIso = new Date().toISOString();
    const newEvents = diffContributionEvents({
      prevLiveByElementId: prevLiveRef.current,
      nextLiveByElementId: next,
      elementById: ctx.elementById || {},
      trackedElementIds: tracked,
      gameweek,
      nowIso,
      gwFixtures: ctx.gwFixtures || [],
      omitByElementKind: fplOmitByElementKind,
    });
    prevLiveRef.current = next;

    const newEventsFiltered = newEvents.filter((e) =>
      contributionEventShownForLeague(e, ownerByEl)
    );
    if (!newEventsFiltered.length) return;

    setDisplayed((prev) => {
      const sortFn = compareContributionEventsDescWithContext({
        liveFullByElementId: ctx.liveFullByElementId,
        elementById: ctx.elementById,
        gwFixtures: ctx.gwFixtures || [],
      });
      const sortedIncoming = [...newEventsFiltered].sort(sortFn);
      return mergeContributionLists([sortedIncoming, prev]);
    });

    const bucket = readPlayerContributionBucket(storageKey);
    mergePersistPlayerContributions(
      storageKey,
      bucket?.events ?? [],
      newEventsFiltered,
      2000
    );
  }, [
    lastUpdated,
    contributionLiveContext,
    gameweek,
    tracked,
    storageKey,
    fplOmitByElementKind,
    ownerByEl,
  ]);

  /**
   * Latest first (top), reading down goes back in time. No auto-scroll — user controls position.
   * Dedupe: when ESPN covers (elementId, kind, fixture) we drop the matching FPL row.
   */
  const rows = useMemo(() => {
    const teamById = contributionLiveContext?.teamById || {};
    const liveFull = contributionLiveContext?.liveFullByElementId;
    const liveBy = contributionLiveContext?.liveByElementId;
    const inThisGw = (displayed || []).filter((e) =>
      contributionEventMatchesGameweek(e, gameweek)
    );
    const liveCoverage = buildTimelineCoverageSet(
      inThisGw.filter((e) => {
        const id = String(e?.stableId || '');
        return id.startsWith('espn:') || id.startsWith('fotmob:');
      })
    );
    return [...inThisGw]
      .sort(compareRowsFn)
      .filter((ev) => {
        if (!contributionEventShownForLeague(ev, ownerByEl)) return false;
        const elidN = Number(ev?.elementId);
        const elForLive = Number.isFinite(elidN)
          ? contributionLiveContext?.elementById?.[elidN]
          : undefined;
        if (
          fplTotalFeedEventContradictsLive(
            ev,
            liveElementRowForFeedValidation(liveFull, liveBy, elidN),
            elForLive?.element_type
          )
        ) {
          return false;
        }
        const sid = String(ev?.stableId || '');
        if (sid.startsWith('espn:') || sid.startsWith('fotmob:')) return true;
        if (
          contributionCoveredByTimelineOmit(
            liveCoverage,
            elidN,
            ev?.kind,
            ev?.fplFixtureId,
            elForLive?.team,
            contributionLiveContext?.gwFixtures
          )
        ) {
          return false;
        }
        return true;
      })
      .map((ev) => {
      const elidN = Number(ev?.elementId);
      const el = Number.isFinite(elidN)
        ? contributionLiveContext?.elementById?.[elidN]
        : undefined;
      const elementTypeId = el?.element_type;
      const tid = el?.team != null ? Number(el.team) : null;
      const tm = tid != null ? teamById[tid] : null;
      const own = ownerByEl.get(elidN) ?? ownerByEl.get(ev.elementId);
      const drop = dropByEl.get(elidN) ?? dropByEl.get(ev.elementId);
      let ownerLine = own?.teamName ?? null;
      if (!ownerLine) {
        ownerLine = drop
          ? `Last dropped, GW${drop.gameweek}, ${drop.teamName}.`
          : 'Waivers / free agents';
      }
      const ap = contributionActionParts(
        ev.kind,
        ev.delta,
        elementTypeId,
        contributionLiveContext?.draftScoring,
        { isOwnGoal: Boolean(ev.isOwnGoal) }
      );
      const ordinalFplEventLabel = fplCumulativeEventOrdinalLabel(
        ev.stableId,
        ev.kind
      );
      const knownName = fplElementDisplayName(el, elidN);
      const fantasyName = fplElementWebName(el, elidN);
      const minFromLive = liveStatMinutesLabel(liveFull, elidN);
      const rawEventMin = ev.minuteLabel;
      const minLbl =
        typeof rawEventMin === 'string' &&
        rawEventMin.trim() &&
        rawEventMin.trim() !== '—'
          ? rawEventMin.trim()
          : minFromLive;
      const isOwnGoalGoal = ev.kind === 'goal' && Boolean(ev.isOwnGoal);
      const minLblWithOg =
        isOwnGoalGoal && minLbl && minLbl !== '—'
          ? `${minLbl} (Own Goal)`
          : isOwnGoalGoal
            ? '(Own Goal)'
            : minLbl;
      const firstWord = own
        ? fantasyTeamFirstLabel(
            own.leagueEntryId,
            own.teamName,
            ownerLine
          )
        : drop
          ? firstWordOnly(drop.teamName) || '—'
          : fantasyTeamFirstLabel(
              null,
              null,
              ownerLine
            );
      const waiverDrop =
        !own && drop
          ? {
              gw: drop.gameweek,
              dropperTeamName: drop.teamName,
              dropperFirstWord: firstWordOnly(drop.teamName) || '—',
            }
          : null;
      return {
        ...ev,
        playerLabel: knownName,
        playerLabelFull: knownName,
        playerLabelShort: fantasyName,
        badgeUrl: badgeUrl(tm?.code),
        teamShort: tm?.short_name ?? '—',
        ownerLine,
        ownerTeamName: own?.teamName ?? null,
        ownerLeagueEntryId: own?.leagueEntryId ?? null,
        actionEmoji: ap.emoji,
        actionText: ap.text,
        actionBracket: ap.bracket,
        minuteLabel: minLblWithOg,
        /** e.g. "2nd assist" for FPL :tot2+ — shown by minutes */
        ordinalFplEventLabel,
        ownerFirstWord: firstWord,
        waiverDrop,
      };
    });
  }, [
    displayed,
    gameweek,
    contributionLiveContext,
    ownerByEl,
    dropByEl,
    compareRowsFn,
  ]);

  const filteredRows = useMemo(() => {
    let out = rows;
    if (fantasyTeamEntryId !== '') {
      const want = Number(fantasyTeamEntryId);
      out = out.filter((r) => Number(r.ownerLeagueEntryId) === want);
    }
    const restrictKinds =
      filterGoal || filterAssist || filterDc || filterCards;
    if (restrictKinds) {
      out = out.filter((r) => {
        if (filterGoal && r.kind === 'goal') return true;
        if (filterAssist && r.kind === 'assist') return true;
        if (filterDc && r.kind === 'dc_points') return true;
        if (
          filterCards &&
          (r.kind === 'yellow_card' || r.kind === 'red_card')
        ) {
          return true;
        }
        return false;
      });
    }
    return out;
  }, [
    rows,
    fantasyTeamEntryId,
    filterGoal,
    filterAssist,
    filterDc,
    filterCards,
  ]);

  const kindFiltersAll =
    !filterGoal && !filterAssist && !filterDc && !filterCards;

  const clearKindFilters = useCallback(() => {
    setFilterGoal(false);
    setFilterAssist(false);
    setFilterDc(false);
    setFilterCards(false);
  }, []);

  const toggleFilterGoal = useCallback(() => {
    setFilterGoal((g) => !g);
  }, []);

  const toggleFilterAssist = useCallback(() => {
    setFilterAssist((a) => !a);
  }, []);

  const toggleFilterDc = useCallback(() => {
    setFilterDc((d) => !d);
  }, []);

  const toggleFilterCards = useCallback(() => {
    setFilterCards((c) => !c);
  }, []);

  const toolbar = (
    <div className="player-contrib-section-head">
      <div className="player-contrib-toolbar">
        <div
          className="player-contrib-kind-filters"
          role="group"
          aria-label="Filter by event type"
        >
          <button
            type="button"
            className="player-contrib-kind-btn player-contrib-kind-btn--goal"
            aria-pressed={filterGoal}
            onClick={toggleFilterGoal}
            aria-label="Filter by goal"
          >
            <span className="player-contrib-kind-btn__m-wide">Goal</span>
            <span className="player-contrib-kind-btn__m-ico" aria-hidden>
              ⚽
            </span>
          </button>
          <button
            type="button"
            className="player-contrib-kind-btn player-contrib-kind-btn--assist"
            aria-pressed={filterAssist}
            onClick={toggleFilterAssist}
            aria-label="Filter by assist"
          >
            <span className="player-contrib-kind-btn__m-wide">Assist</span>
            <span className="player-contrib-kind-btn__m-ico" aria-hidden>
              🍑
            </span>
          </button>
          <button
            type="button"
            className="player-contrib-kind-btn player-contrib-kind-btn--dc"
            aria-pressed={filterDc}
            onClick={toggleFilterDc}
            aria-label="Filter by defensive contribution points"
          >
            <span className="player-contrib-kind-btn__m-wide">DC</span>
            <span className="player-contrib-kind-btn__m-ico" aria-hidden>
              🪖
            </span>
          </button>
          <button
            type="button"
            className="player-contrib-kind-btn player-contrib-kind-btn--cards"
            aria-pressed={filterCards}
            onClick={toggleFilterCards}
            aria-label="Filter by yellow or red card"
          >
            <span className="player-contrib-kind-btn__m-wide">Cards</span>
            <span className="player-contrib-kind-btn__m-ico" aria-hidden>
              🟨
            </span>
          </button>
          <button
            type="button"
            className="player-contrib-kind-btn player-contrib-kind-btn--all"
            aria-pressed={kindFiltersAll}
            onClick={clearKindFilters}
          >
            All
          </button>
        </div>
        <select
          className="player-contrib-team-select"
          value={fantasyTeamEntryId}
          onChange={(e) => setFantasyTeamEntryId(e.target.value)}
          aria-label="Filter by fantasy team"
        >
          <option value="">Teams</option>
          {fantasyTeamOptions.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  if (!rows.length) {
    return (
      <>
        {toolbar}
        <p className="muted muted--tight player-contrib-empty">
          Goals, Assists, Def Cons, Saves & Cards will appear here as they happen.
        </p>
      </>
    );
  }

  return (
    <>
      {toolbar}
      {!filteredRows.length ? (
        <div className="player-contrib-broadcast">
          <p className="muted muted--tight player-contrib-empty player-contrib-empty--filters">
            No events match these filters. Try another team or turn on more event types.
          </p>
        </div>
      ) : (
    <div className="player-contrib-broadcast">
      <div
        ref={listScrollRef}
        className="player-contrib-feed player-contrib-feed--pp-rich"
        role="list"
        aria-label="FPL live scoring events"
      >
        {filteredRows.map((r) => {
          const hasEvPts = Boolean(r.actionBracket && r.actionBracket.trim());
          const showMinute = r.kind !== 'dc_points';
          const ordTag = r.ordinalFplEventLabel;
          const minSrPart = showMinute
            ? ordTag
              ? `${r.minuteLabel} — ${ordTag}`
              : r.minuteLabel
            : null;
          const minPhrase = minSrPart != null ? ` (${minSrPart})` : '';
          const ptsLine = hasEvPts
            ? r.actionBracket.trim()
            : '—';
          const ptsAria = hasEvPts
            ? `Fantasy points for this event${r.actionBracket}`
            : 'No point change for this event';
          const arLabel = `${r.actionText}. ${r.playerLabelFull}${minPhrase}. ${r.ownerLine}. ${ptsLine}`;
          const isWaiverSameGw = Boolean(
            r.waiverDrop &&
              Number(r.waiverDrop.gw) === Number(gameweek)
          );
          return (
            <div
              key={r.stableId}
              className={`player-contrib-pp-row player-contrib-pp-row--${r.kind}${
                isWaiverSameGw
                  ? ' player-contrib-pp-row--waiver-same-gw'
                  : ''
              }`}
              role="listitem"
              aria-label={arLabel}
            >
              <span className="player-contrib-pp-row__sr player-contrib-row__player-sr">
                {r.actionText}. {r.playerLabelFull}
                {minPhrase}. {r.ownerLine}
              </span>
              <span
                className="pp-ev-emoji"
                aria-hidden
                title={r.actionText}
              >
                {r.actionEmoji || ''}
              </span>
              <span
                className="pp-ev-pts"
                aria-label={ptsAria}
              >
                {hasEvPts ? (
                  <span className="pp-ev-pts-bracket">{r.actionBracket}</span>
                ) : (
                  <span className="pp-ev-pts--empty">—</span>
                )}
              </span>
              <div className="pp-ev-club" title={r.teamShort}>
                {r.badgeUrl ? (
                  <img
                    className="pp-ev-club__badge"
                    src={r.badgeUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="pp-ev-club__badge-fallback" aria-hidden>
                    {r.teamShort?.slice(0, 3) ?? '—'}
                  </span>
                )}
                <span className="pp-ev-club__short">{r.teamShort}</span>
              </div>
              <div className="pp-ev-mid">
                <div
                  className="pp-ev-namecell"
                  title={
                    r.playerLabelFull !== r.playerLabel
                      ? r.playerLabelFull
                      : undefined
                  }
                >
                  <ClickablePlayerName
                    element={r.elementId}
                    displayName={r.playerLabelFull}
                    web_name={r.playerLabelShort}
                    teamShort={r.teamShort}
                    className="pp-ev-name"
                  >
                    {r.playerLabel}
                  </ClickablePlayerName>
                </div>
                {showMinute ? (
                  <span
                    className="pp-ev-minline"
                    title={ordTag || undefined}
                  >
                    <span className="pp-ev-mins" aria-hidden>
                      {r.minuteLabel}
                    </span>
                    {ordTag ? (
                      <>
                        <span className="pp-ev-mins-sep" aria-hidden>
                          &nbsp;·&nbsp;
                        </span>
                        <span
                          className="pp-ev-ordinal"
                          aria-hidden
                        >
                          {ordTag}
                        </span>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <div
                className={
                  r.waiverDrop
                    ? isWaiverSameGw
                      ? 'pp-ev-owner pp-ev-owner--waiver-drop pp-ev-owner--waiver-same-gw'
                      : 'pp-ev-owner pp-ev-owner--waiver-drop'
                    : 'pp-ev-owner'
                }
                title={
                  r.waiverDrop
                    ? isWaiverSameGw
                      ? `🗑️ - this GW, ${r.waiverDrop.dropperFirstWord}: utter twat.`
                      : `${r.waiverDrop.dropperTeamName} (GW ${r.waiverDrop.gw})`
                    : r.ownerLine
                }
              >
                {r.ownerLeagueEntryId != null ? (
                  <>
                    <span className="pp-ev-owner__word">{r.ownerFirstWord}</span>
                    <TeamAvatar
                      entryId={r.ownerLeagueEntryId}
                      name={r.ownerTeamName ?? r.ownerLine}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      badgeFallback
                    />
                  </>
                ) : r.waiverDrop ? (
                  <span className="pp-ev-owner__waiver-drop-line">
                    {isWaiverSameGw ? (
                      <span
                        className="pp-ev-owner__waiver-same-gw"
                        aria-label={`🗑️ - this GW, ${r.waiverDrop.dropperFirstWord}: utter twat.`}
                      >
                        <span aria-hidden>
                          🗑️ - this GW, {r.waiverDrop.dropperFirstWord}: utter twat.
                        </span>
                      </span>
                    ) : (
                      <>
                        <span
                          className="pp-ev-owner__waiver-bin"
                          role="img"
                          aria-hidden
                        >
                          🗑️
                        </span>
                        <span
                          className="pp-ev-owner__waiver-gw tabular"
                          aria-hidden
                        >
                          GW{r.waiverDrop.gw} -{' '}
                        </span>
                        <span className="pp-ev-owner__waiver-first">
                          {r.waiverDrop.dropperFirstWord}
                        </span>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="pp-ev-owner__word">{r.ownerFirstWord}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
      )}
    </>
  );
}
