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
 * Event-kind glyphs in the locked design (PR #5e) — match Mockup.jsx
 * `contribKindGlyph`. ⚽ goal / 🅰 assist / 🛡 DC / 🧤 saves /
 * 🟨 yellow / 🟥 red. These render in the 20px lead lane of the
 * card's top line; keep them single-character so the lane lines up
 * across rows.
 */
const CONTRIB_EMOJI_BY_KIND = {
  goal: '⚽',
  assist: '🅰',
  dc_points: '🛡',
  save_points: '🧤',
  yellow_card: '🟨',
  red_card: '🟥',
};

function contribEmojiForKind(kind) {
  return CONTRIB_EMOJI_BY_KIND[kind] || '';
}

/** Order + identity for the event-kind checkboxes in the filter popover. */
const CONTRIB_KIND_FILTERS = [
  { id: 'goal', label: 'Goals' },
  { id: 'assist', label: 'Assists' },
  { id: 'dc_points', label: 'DC' },
  { id: 'save_points', label: 'Saves' },
  { id: 'yellow_card', label: 'Yellow' },
  { id: 'red_card', label: 'Red' },
];
const CONTRIB_KIND_FILTER_IDS = CONTRIB_KIND_FILTERS.map((k) => k.id);

/** Tint modifier for the bottom-row KIND word (yellow/red destructive). */
function contribKindToneModifier(kind) {
  if (kind === 'red_card') return 'red';
  if (kind === 'yellow_card') return 'yellow';
  return '';
}

/**
 * @param {string} kind
 * @param {number} delta — count for goals/assists/cards; fantasy pts for dc_points / save_points
 * @param {number | null | undefined} elementTypeId
 * @param {object | null | undefined} scoring — draft `settings.scoring`
 * @param {{ isOwnGoal?: boolean }} [opts]
 * @returns {{ emoji: string, label: string, pts: number, text: string, bracket: string }}
 *   `label` — caps word for the row's KIND cell (no bracket).
 *   `pts` — signed fantasy points; render via the `+N` / `−N` pill.
 *   `text` / `bracket` — kept for the legacy `aria-label` composer.
 */
function contributionActionParts(kind, delta, elementTypeId, scoring, opts) {
  const d = Number(delta) || 0;
  const assistPts = Number(scoring?.assists) || 3;
  const yellowPts = Number(scoring?.yellow_cards) || -1;
  const redPts = Number(scoring?.red_cards) || -3;
  const emoji = contribEmojiForKind(kind);

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
    return { emoji, label, pts, text: `${label}${br}`, bracket: br };
  }
  if (kind === 'assist') {
    const label = d === 1 ? 'ASSIST' : `${d} ASSISTS`;
    const pts = d * assistPts;
    const br = pointsBracket(pts);
    return { emoji, label, pts, text: `${label}${br}`, bracket: br };
  }
  if (kind === 'dc_points') {
    const br = pointsBracket(d);
    return { emoji, label: 'DEF CON', pts: d, text: `DEF CON${br}`, bracket: br };
  }
  if (kind === 'save_points') {
    const label = d === 1 ? 'SAVES' : `SAVES ×${d}`;
    const br = pointsBracket(d);
    return { emoji, label, pts: d, text: `${label}${br}`, bracket: br };
  }
  if (kind === 'yellow_card') {
    const label = d === 1 ? 'YELLOW' : `${d} YELLOWS`;
    const pts = d * yellowPts;
    const br = pointsBracket(pts);
    return { emoji, label, pts, text: `${label}${br}`, bracket: br };
  }
  if (kind === 'red_card') {
    const label = d === 1 ? 'RED CARD' : `${d} RED CARDS`;
    const pts = d * redPts;
    const br = pointsBracket(pts);
    return { emoji, label, pts, text: `${label}${br}`, bracket: br };
  }
  const fallback = String(kind).toUpperCase();
  return { emoji: '', label: fallback, pts: 0, text: fallback, bracket: '' };
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
  /**
   * Locked design (PR #5e) — multi-select filter popover. Both sets
   * default to "all selected" (no filtering). The popover keeps a
   * `draft*` copy that the user mutates; Apply commits draft → applied
   * so the feed only re-filters once.
   */
  const [selectedKinds, setSelectedKinds] = useState(
    () => new Set(CONTRIB_KIND_FILTER_IDS)
  );
  const [selectedTeams, setSelectedTeams] = useState(
    /** @type {Set<number>} */ (new Set())
  );
  const [teamsInitialized, setTeamsInitialized] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKinds, setDraftKinds] = useState(
    () => new Set(CONTRIB_KIND_FILTER_IDS)
  );
  const [draftTeams, setDraftTeams] = useState(
    /** @type {Set<number>} */ (new Set())
  );
  /* Note: there is no expand/collapse state — the full filtered event
     list always renders inside a scrollable max-height container
     (`.live-contrib__feed` has overflow-y: auto). See PR #5e follow-up. */
  /**
   * Streaming arrival animation — the topmost row's stableId is
   * stamped onto this state whenever it changes, then cleared after
   * the keyframe finishes. Skipped on the first paint so existing
   * history doesn't pulse on mount.
   */
  const [justArrivedId, setJustArrivedId] = useState(null);
  const arrivalInitRef = useRef(true);
  const filterRootRef = useRef(null);
  const filterButtonRef = useRef(null);
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
    arrivalInitRef.current = true;
    setDisplayed([]);
    setTimelineCoverage(new Set());
    setSelectedKinds(new Set(CONTRIB_KIND_FILTER_IDS));
    setDraftKinds(new Set(CONTRIB_KIND_FILTER_IDS));
    setSelectedTeams(new Set());
    setDraftTeams(new Set());
    setTeamsInitialized(false);
    setFilterOpen(false);
    setJustArrivedId(null);
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

  /**
   * Seed `selectedTeams` / `draftTeams` to "all teams selected" once
   * the fantasy-team list is known. Without this the popover would
   * open with zero teams ticked and the feed empty.
   */
  useEffect(() => {
    if (teamsInitialized) return;
    if (!fantasyTeamOptions.length) return;
    const ids = new Set(fantasyTeamOptions.map((t) => t.id));
    setSelectedTeams(ids);
    setDraftTeams(new Set(ids));
    setTeamsInitialized(true);
  }, [fantasyTeamOptions, teamsInitialized]);

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
        actionLabel: ap.label,
        actionPts: ap.pts,
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

  /**
   * Locked filter logic (PR #5e):
   * - kinds: only rows whose `kind` is in `selectedKinds` pass.
   * - teams: when ANY team checkbox is off, only rows whose
   *   `ownerLeagueEntryId` is in `selectedTeams` pass — waiver /
   *   free-agent rows (`ownerLeagueEntryId == null`) get hidden.
   *   When every team is selected (default), waiver rows pass.
   */
  const allTeamsSelected =
    fantasyTeamOptions.length > 0 &&
    selectedTeams.size === fantasyTeamOptions.length;
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!selectedKinds.has(r.kind)) return false;
      const ownerId = r.ownerLeagueEntryId;
      if (ownerId == null) {
        return allTeamsSelected;
      }
      return selectedTeams.has(Number(ownerId));
    });
  }, [rows, selectedKinds, selectedTeams, allTeamsSelected]);

  const totalChoices =
    CONTRIB_KIND_FILTER_IDS.length + fantasyTeamOptions.length;
  const totalSelected = selectedKinds.size + selectedTeams.size;
  const allKindsSelected = selectedKinds.size === CONTRIB_KIND_FILTER_IDS.length;
  const allFiltersOn = allKindsSelected && allTeamsSelected;

  /**
   * Streaming arrival: stamp the topmost stableId onto `justArrivedId`
   * whenever the head of `filteredRows` changes (a new event landed
   * at the top). Skipped on the very first paint so existing history
   * doesn't pulse on mount. Cleared after the keyframe duration so
   * the modifier can re-fire next time.
   */
  const topRowId = filteredRows[0]?.stableId ?? null;
  useEffect(() => {
    if (arrivalInitRef.current) {
      arrivalInitRef.current = false;
      return undefined;
    }
    if (!topRowId) {
      setJustArrivedId(null);
      return undefined;
    }
    setJustArrivedId(topRowId);
    const t = setTimeout(() => {
      setJustArrivedId((cur) => (cur === topRowId ? null : cur));
    }, 1300);
    return () => clearTimeout(t);
  }, [topRowId]);

  /* Full filtered list is always rendered; the feed container
     applies max-height + overflow-y so the user scrolls in place
     instead of pushing the rest of the page down. */
  const visibleRows = filteredRows;

  const openFilterPopover = useCallback(() => {
    setDraftKinds(new Set(selectedKinds));
    setDraftTeams(new Set(selectedTeams));
    setFilterOpen(true);
  }, [selectedKinds, selectedTeams]);

  const closeFilterPopover = useCallback(() => {
    setFilterOpen(false);
  }, []);

  const applyFilters = useCallback(() => {
    setSelectedKinds(new Set(draftKinds));
    setSelectedTeams(new Set(draftTeams));
    setFilterOpen(false);
  }, [draftKinds, draftTeams]);

  const toggleDraftKind = useCallback((id) => {
    setDraftKinds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleDraftTeam = useCallback((id) => {
    setDraftTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const draftSelectAll = useCallback(() => {
    setDraftKinds(new Set(CONTRIB_KIND_FILTER_IDS));
    setDraftTeams(new Set(fantasyTeamOptions.map((t) => t.id)));
  }, [fantasyTeamOptions]);

  const draftClearAll = useCallback(() => {
    setDraftKinds(new Set());
    setDraftTeams(new Set());
  }, []);

  /** Click-outside + Escape closes the popover (no Apply). */
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDocPointer = (ev) => {
      const root = filterRootRef.current;
      if (!root) return;
      if (root.contains(ev.target)) return;
      setFilterOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const filterButtonCount = allFiltersOn
    ? 'All'
    : `${totalSelected} of ${totalChoices}`;

  const toolbar = (
    <div className="live-contrib__head">
      <div className="live-contrib__filter-dropdown" ref={filterRootRef}>
        <button
          type="button"
          ref={filterButtonRef}
          className="live-contrib__filter-button"
          aria-expanded={filterOpen}
          aria-haspopup="dialog"
          onClick={() => (filterOpen ? closeFilterPopover() : openFilterPopover())}
        >
          <span className="live-contrib__filter-button-label">Filters</span>
          <span className="live-contrib__filter-button-sep" aria-hidden>·</span>
          <span className="live-contrib__filter-button-count">
            {filterButtonCount}
          </span>
          <span className="live-contrib__filter-button-chev" aria-hidden>▾</span>
        </button>
        {filterOpen ? (
          <div
            className="live-contrib__filter-popover"
            role="dialog"
            aria-label="Filter contributions"
          >
            <div className="live-contrib__filter-section">
              <div className="live-contrib__filter-heading">Event kind</div>
              {CONTRIB_KIND_FILTERS.map((c) => {
                const on = draftKinds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="live-contrib__filter-row"
                  >
                    <span
                      className={
                        'live-contrib__filter-check' +
                        (on ? ' live-contrib__filter-check--on' : '')
                      }
                      aria-hidden
                    >
                      {on ? '✓' : ''}
                    </span>
                    <input
                      type="checkbox"
                      className="live-contrib__filter-input"
                      checked={on}
                      onChange={() => toggleDraftKind(c.id)}
                    />
                    <span className="live-contrib__filter-row-glyph" aria-hidden>
                      {contribEmojiForKind(c.id)}
                    </span>
                    <span className="live-contrib__filter-row-label">
                      {c.label}
                    </span>
                  </label>
                );
              })}
            </div>
            {fantasyTeamOptions.length ? (
              <div className="live-contrib__filter-section">
                <div className="live-contrib__filter-heading">Team</div>
                {fantasyTeamOptions.map((t) => {
                  const on = draftTeams.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="live-contrib__filter-row"
                    >
                      <span
                        className={
                          'live-contrib__filter-check' +
                          (on ? ' live-contrib__filter-check--on' : '')
                        }
                        aria-hidden
                      >
                        {on ? '✓' : ''}
                      </span>
                      <input
                        type="checkbox"
                        className="live-contrib__filter-input"
                        checked={on}
                        onChange={() => toggleDraftTeam(t.id)}
                      />
                      <span className="live-contrib__filter-row-label">
                        {t.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            <div className="live-contrib__filter-foot">
              <span className="live-contrib__filter-bulk">
                <button
                  type="button"
                  className="live-contrib__filter-bulk-btn"
                  onClick={draftSelectAll}
                >
                  Select all
                </button>
                <span className="live-contrib__filter-bulk-sep" aria-hidden>·</span>
                <button
                  type="button"
                  className="live-contrib__filter-bulk-btn"
                  onClick={draftClearAll}
                >
                  Clear all
                </button>
              </span>
              <button
                type="button"
                className="live-contrib__filter-apply"
                onClick={applyFilters}
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!rows.length) {
    return (
      <div className="live-contrib">
        {toolbar}
        <p className="muted muted--tight live-contrib__empty">
          Goals, Assists, Def Cons, Saves & Cards will appear here as they happen.
        </p>
      </div>
    );
  }

  if (!filteredRows.length) {
    return (
      <div className="live-contrib">
        {toolbar}
        <div className="live-contrib__feed-wrap">
          <p className="muted muted--tight live-contrib__empty live-contrib__empty--filters">
            No events match these filters. Try another team or turn on more event types.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-contrib">
      {toolbar}
      <div className="live-contrib__feed-wrap">
        <div
          ref={listScrollRef}
          className="live-contrib__feed"
          role="list"
          aria-label="FPL live scoring events"
        >
          {visibleRows.map((r) => {
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
            const isJustArrived = r.stableId === justArrivedId;
            const tone = contribKindToneModifier(r.kind);
            const ptsModifier = r.actionPts < 0 ? 'neg' : 'pos';
            const teamLine = r.ownerTeamName ?? r.ownerLine ?? '';
            const teamLineTitle =
              r.waiverDrop && isWaiverSameGw
                ? `🗑️ - this GW, ${r.waiverDrop.dropperFirstWord}: utter twat.`
                : r.waiverDrop
                  ? `${r.waiverDrop.dropperTeamName} (GW ${r.waiverDrop.gw})`
                  : r.ownerLine;
            return (
              <div
                key={r.stableId}
                className={
                  'live-contrib-row' +
                  ` live-contrib-row--${r.kind}` +
                  (isWaiverSameGw ? ' live-contrib-row--waiver-same-gw' : '') +
                  (isJustArrived ? ' live-contrib-row--just-arrived' : '')
                }
                role="listitem"
                aria-label={arLabel}
              >
                <span className="live-contrib-row__sr">
                  {r.actionText}. {r.playerLabelFull}
                  {minPhrase}. {r.ownerLine}
                </span>
                <div className="live-contrib-row__top">
                  <span
                    className="live-contrib-row__glyph"
                    aria-hidden
                    title={r.actionText}
                  >
                    {r.actionEmoji || ''}
                  </span>
                  <ClickablePlayerName
                    element={r.elementId}
                    displayName={r.playerLabelFull}
                    web_name={r.playerLabelShort}
                    teamShort={r.teamShort}
                    className="live-contrib-row__player"
                  >
                    {r.playerLabel}
                  </ClickablePlayerName>
                  <span
                    className="live-contrib-row__crest"
                    title={r.teamShort}
                  >
                    {r.badgeUrl ? (
                      <img
                        className="live-contrib-row__crest-img"
                        src={r.badgeUrl}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="live-contrib-row__crest-fallback"
                        aria-hidden
                      >
                        {r.teamShort?.slice(0, 3) ?? '—'}
                      </span>
                    )}
                  </span>
                </div>
                <span
                  className="live-contrib-row__minute"
                  aria-hidden={!showMinute}
                  title={ordTag || undefined}
                >
                  {showMinute ? r.minuteLabel : ''}
                </span>
                <div className="live-contrib-row__sub">
                  {r.ownerLeagueEntryId != null ? (
                    <span className="live-contrib-row__team-avatar">
                      <TeamAvatar
                        entryId={r.ownerLeagueEntryId}
                        name={r.ownerTeamName ?? r.ownerLine}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                        badgeFallback
                      />
                    </span>
                  ) : (
                    <span
                      className="live-contrib-row__team-avatar live-contrib-row__team-avatar--waiver"
                      aria-hidden
                    >
                      🗑️
                    </span>
                  )}
                  <span
                    className={
                      'live-contrib-row__team' +
                      (r.waiverDrop && isWaiverSameGw
                        ? ' live-contrib-row__team--waiver-same-gw'
                        : '')
                    }
                    title={teamLineTitle}
                  >
                    {r.ownerLeagueEntryId != null
                      ? teamLine
                      : r.waiverDrop
                        ? isWaiverSameGw
                          ? `this GW · ${r.waiverDrop.dropperFirstWord}: utter twat.`
                          : `GW${r.waiverDrop.gw} · dropped by ${r.waiverDrop.dropperFirstWord}`
                        : 'Waivers / free agents'}
                  </span>
                </div>
                <div className="live-contrib-row__meta-bottom">
                  <span
                    className={
                      'live-contrib-row__kind' +
                      (tone ? ` live-contrib-row__kind--${tone}` : '')
                    }
                  >
                    {r.actionLabel}
                  </span>
                  <span
                    className={`live-contrib-row__pts live-contrib-row__pts--${ptsModifier}`}
                    aria-label={ptsAria}
                  >
                    {hasEvPts
                      ? r.actionPts > 0
                        ? `+${r.actionPts}`
                        : r.actionPts < 0
                          ? `−${Math.abs(r.actionPts)}`
                          : '0'
                      : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
