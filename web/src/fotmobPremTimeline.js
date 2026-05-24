import { fotmobResourceUrl } from './fotmobUrl.js';

const PL_LEAGUE_ID = 47;

function normClub(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '')
    .replace(/\./g, '')
    .trim();
}

function yyyymmddUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${mo}${day}`;
}

async function fetchFotmob(pathWithQuery) {
  const url = fotmobResourceUrl(pathWithQuery);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FotMob ${pathWithQuery} HTTP ${r.status}`);
  return r.json();
}

/**
 * Collect `{ id, homeId, awayId }` from FotMob `matches?date=` payload (shape varies).
 * @param {object} matchesJson
 * @returns {Array<{ matchId: number, homeId: number, awayId: number }>}
 */
export function collectDayMatches(matchesJson) {
  const out = [];
  const seen = new Set();

  function consider(o) {
    if (!o || typeof o !== 'object') return;
    const idRaw = o.id;
    const id = Number(idRaw);
    const h = o.home;
    const a = o.away;
    if (!Number.isFinite(id) || !h || !a) return;
    const hid = Number(h.id);
    const aid = Number(a.id);
    if (!Number.isFinite(hid) || !Number.isFinite(aid)) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ matchId: id, homeId: hid, awayId: aid });
  }

  function walk(o, depth) {
    if (depth > 18 || o == null) return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x, depth + 1);
      return;
    }
    if (typeof o === 'object') {
      consider(o);
      for (const v of Object.values(o)) walk(v, depth + 1);
    }
  }

  walk(matchesJson, 0);
  return out;
}

/**
 * Table / overview teams from `leagues?id=47&tab=table|overview`.
 * @param {object} leagueJson
 * @returns {Array<{ id: number, shortName: string, name: string }>}
 */
export function extractLeagueTeams(leagueJson) {
  const raw = [];
  function walk(o, depth) {
    if (depth > 22 || !o || typeof o !== 'object') return;
    if (
      typeof o.id === 'number' &&
      typeof o.shortName === 'string' &&
      typeof o.name === 'string' &&
      o.shortName.length >= 2 &&
      o.shortName.length <= 6
    ) {
      raw.push({
        id: o.id,
        shortName: String(o.shortName).toUpperCase(),
        name: String(o.name),
      });
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) {
        for (const x of v) walk(x, depth + 1);
      } else if (v && typeof v === 'object') walk(v, depth + 1);
    }
  }
  walk(leagueJson, 0);
  const byId = new Map();
  for (const t of raw) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

/**
 * @param {Record<number, object>} teamById — FPL `teams` keyed by id
 * @param {Array<{ id: number, shortName: string, name: string }>} fotmobTeams
 * @returns {Map<number, number>} fplTeamId → fotmobTeamId
 */
export function mapFplTeamsToFotmob(teamById, fotmobTeams) {
  const byShort = new Map();
  const byName = new Map();
  for (const t of fotmobTeams) {
    byShort.set(t.shortName, t.id);
    byName.set(normClub(t.name), t.id);
  }
  const m = new Map();
  for (const [k, pl] of Object.entries(teamById || {})) {
    const fid = Number(k);
    if (!Number.isFinite(fid)) continue;
    const sh = String(pl.short_name || '').toUpperCase();
    if (byShort.has(sh)) {
      m.set(fid, byShort.get(sh));
      continue;
    }
    const nn = normClub(pl.name);
    if (byName.has(nn)) m.set(fid, byName.get(nn));
  }
  return m;
}

function findMatchIdForFplFixture(fx, fplToFm, dayRows) {
  const th = Number(fx.team_h);
  const ta = Number(fx.team_a);
  const fh = fplToFm.get(th);
  const fa = fplToFm.get(ta);
  if (!Number.isFinite(fh) || !Number.isFinite(fa)) return null;
  for (const row of dayRows) {
    if (
      (row.homeId === fh && row.awayId === fa) ||
      (row.homeId === fa && row.awayId === fh)
    ) {
      return row.matchId;
    }
  }
  return null;
}

function normPlayer(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/ł/g, 'l')
    .replace(/['’`.]/g, '')
    .trim();
}

function lastNameToken(needle) {
  const p = String(needle || '')
    .split(/\s+/)
    .filter(Boolean);
  return p.length ? p[p.length - 1] : '';
}

/** First whitespace-delimited token; used for multi-part FPL `second_name` (e.g. "Paula da …"). */
function firstWord(s) {
  const p = String(s || '')
    .split(/\s+/)
    .filter(Boolean);
  return p.length ? p[0] : '';
}

/**
 * Unaccented, lower; map common given-name variants to FPL `first_name` (also normalized).
 */
const GIVEN_NAME_ALIASES = {
  danny: 'daniel',
  dave: 'david',
  bobby: 'robert',
  billy: 'william',
  will: 'william',
  mike: 'michael',
  mick: 'michael',
  matt: 'matthew',
  chris: 'christopher',
  tommy: 'thomas',
  tom: 'thomas',
  tony: 'anthony',
  nico: 'nicolas',
  nick: 'nicholas',
  alex: 'alexander',
  sasha: 'oleksandr',
  eddy: 'edouard',
  micky: 'michail',
  sam: 'samuel',
  tim: 'timothy',
  jim: 'james',
  vini: 'vinícius',
  stevie: 'steven',
  stev: 'steven',
  steve: 'steven',
  rob: 'robert',
  bob: 'robert',
  fred: 'frederick',
  fran: 'francis',
  charlie: 'charles',
  paddy: 'padraig',
  willy: 'william',
};

function aliasOrSelf(t) {
  return GIVEN_NAME_ALIASES[t] || t;
}

/**
 * FPL can store a short `first_name` (e.g. S.) while feeds use a full name (e.g. Stefan) —
 * match the first *token* of the external given-name segment against `first_name` / `known_name`.
 * @param {string} g — first name token (normalized)
 * @param {{ w: string, kn: string, sn: string, fn: string }} r
 */
function firstGivenTokenFits(g, r) {
  if (!g) return !r.fn && !r.kn;
  const fn = r.fn;
  const kn = r.kn;
  /** ESPN may use initials (“R.” → `r`) while FPL carries the full `first_name`. */
  if (fn && fn.length > 1 && g.length === 1 && g === fn.slice(0, 1)) return true;
  if (kn && kn.length > 1 && g.length === 1 && g === kn.slice(0, 1)) return true;
  if (g === fn) return true;
  if (kn && g === kn) return true;
  if (fn) {
    if (aliasOrSelf(g) === fn) return true;
    if (aliasOrSelf(fn) === g) return true;
  }
  if (kn) {
    if (aliasOrSelf(g) === kn) return true;
  }
  if (fn) {
    if (g[0] === fn[0] && (fn.length <= 2 && g.length >= 2)) return true;
  }
  if (kn) {
    if (g[0] === kn[0] && (kn.length <= 2 && g.length >= 2)) return true;
  }
  return false;
}

/**
 * Surname-locked + flexible first name (e.g. ESPN "Stefan" vs FPL `first_name` "S.").
 * @param {string} needle — normPlayer(…)
 * @param {{ w: string, kn: string, sn: string, fn: string, full: string }} r
 */
function espnFuzzySurnameAndGiven(needle, r) {
  const toks = needle.split(/\s+/).filter(Boolean);
  if (toks.length < 1) return false;
  const lastT = toks[toks.length - 1];
  if (lastT.length < 2) return false;

  const snFirst = r.sn ? firstWord(r.sn) : '';
  const lastOk =
    (r.sn && (r.sn === lastT || snFirst === lastT)) ||
    (r.w && r.w === lastT) ||
    (r.kn && r.kn === lastT);
  if (!lastOk) return false;

  if (toks.length === 1) return true;

  const gSeg = toks.slice(0, -1).join(' ').trim();
  const firstTok = gSeg.split(/\s+/).filter(Boolean)[0] || '';
  if (!firstTok) return true;
  return firstGivenTokenFits(firstTok, r);
}

/**
 * Resolve FotMob/ESPN display name to FPL element id on `teamFplId`.
 * ESPN often differs from FPL (`Danny` vs `Daniel`, `Robin Roefs` vs `R. Roefs` in `web_name`);
 * we disambiguate with last name and first initial when the loose rules hit 0 or 2+ candidates.
 * Prefer FPL `first_name`+`second_name` alignment with the feed, not `web_name` alone, when
 * the surname + given token match uniquely.
 *
 * @returns {number | null}
 */
export function matchFplElementId(teamFplId, displayName, elementById) {
  const needle = normPlayer(displayName);
  if (!needle) return null;

  const teamEls = Object.values(elementById || {}).filter(
    (el) => Number(el.team) === Number(teamFplId),
  );
  /** @type {Array<{ id: number, w: string, kn: string, sn: string, fn: string, full: string }>} */
  const rows = [];
  for (const el of teamEls) {
    const id = Number(el.id);
    if (!Number.isFinite(id)) continue;
    rows.push({
      id,
      w: normPlayer(el.web_name),
      kn: normPlayer(el.known_name),
      sn: normPlayer(el.second_name),
      fn: normPlayer(el.first_name),
      full: normPlayer([el.first_name, el.second_name].filter(Boolean).join(' ')),
    });
  }

  function looseMatch(r) {
    if (!r) return false;
    const toksN = needle.split(/\s+/).filter(Boolean);
    if (toksN.length >= 2 && r.sn) {
      /**
       * ESPN often splits hyphenated surnames with spaces (“R. Ait Nouri”), while FPL keeps
       * `second_name` as “Aït-Nouri”. Match the last **two** tokens when they align after
       * normalising hyphens to spaces on the FPL side.
       */
      if (toksN.length >= 3) {
        const compound = toksN.slice(-2).join(' ');
        const snFlat = String(r.sn).replace(/-/g, ' ');
        const compoundFlat = compound.replace(/-/g, ' ');
        if (compoundFlat === snFlat || compound === snFlat) {
          if (firstGivenTokenFits(toksN[0], r)) return true;
        }
      }
      if (
        firstWord(r.sn) === toksN[toksN.length - 1] &&
        firstGivenTokenFits(toksN[0], r)
      ) {
        return true;
      }
    }
    return (
      needle === r.w ||
      needle === r.kn ||
      needle === r.sn ||
      needle === r.full ||
      (r.w && (r.w.includes(needle) || needle.includes(r.w))) ||
      (r.sn && (r.sn === needle || needle.includes(r.sn)))
    );
  }

  const cands = rows.filter(
    (r) => looseMatch(r) || espnFuzzySurnameAndGiven(needle, r),
  );

  if (cands.length === 1) return cands[0].id;

  if (cands.length > 1) {
    const fuzzyOnly = cands.filter((r) => espnFuzzySurnameAndGiven(needle, r));
    if (fuzzyOnly.length === 1) return fuzzyOnly[0].id;

    const last = lastNameToken(needle);
    if (last.length >= 2) {
      const byLast = cands.filter(
        (r) =>
          r.sn === last ||
          (r.sn && firstWord(r.sn) === last) ||
          r.w === last ||
          r.kn === last,
      );
      if (byLast.length > 1) return null;
      if (byLast.length === 1) return byLast[0].id;
    }

    const strong = cands.filter(
      (r) => needle === r.full || needle === r.w || needle === r.kn,
    );
    if (strong.length === 1) return strong[0].id;

    const parts = needle.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      if (surname.length >= 2) {
        const bySurname = cands.filter(
          (r) =>
            r.sn === surname ||
            r.w === surname ||
            (r.sn && firstWord(r.sn) === surname) ||
            r.full.endsWith(' ' + surname),
        );
        if (bySurname.length === 1) return bySurname[0].id;
        const firstTok = parts[0];
        if (firstTok.length === 1 && bySurname.length > 0) {
          const byInit = bySurname.filter((r) => !r.fn || r.fn.charAt(0) === firstTok);
          if (byInit.length === 1) return byInit[0].id;
        }
      }
    }
    return null;
  }

  const last = lastNameToken(needle);
  if (last.length >= 2) {
    const byLast = rows.filter(
      (r) =>
        r.sn === last ||
        (r.sn && firstWord(r.sn) === last) ||
        r.w === last ||
        r.kn === last ||
        r.full.endsWith(' ' + last),
    );
    if (byLast.length === 1) return byLast[0].id;
  }

  return null;
}

function extractEventsList(matchJson) {
  const c = matchJson?.content;
  const mf = c?.matchFacts;
  const ev = mf?.events;
  if (Array.isArray(ev)) return ev;
  if (ev && Array.isArray(ev.events)) return ev.events;
  return [];
}

function classifyFotmobEvent(ev) {
  const t = String(ev?.type || '');
  const tl = t.toLowerCase();
  const card = String(ev?.card || '').toLowerCase();
  if (tl === 'card' || card) {
    if (card.includes('red') || tl.includes('red')) return 'red_card';
    return 'yellow_card';
  }
  if (tl.includes('goal') || /\bgoal\b/i.test(String(ev?.nameStr || ''))) {
    return 'goal';
  }
  if (tl.includes('assist') || /\bassist\b/i.test(String(ev?.nameStr || ''))) {
    return 'assist';
  }
  return null;
}

/**
 * FotMob goal rows sometimes list an assister in `swap` (second entry).
 * @returns {{ primary: object, assist: object | null }}
 */
function assistNameFromGoalText(nameStr) {
  const m = String(nameStr || '').match(/assist(?:ed)?\s+by\s+([^·,(\n]+)/i);
  return m ? m[1].trim() : null;
}

function assistPlayerFromSwap(ev) {
  const swaps = Array.isArray(ev?.swap) ? ev.swap : [];
  const last = swaps[swaps.length - 1];
  if (last?.name && /\bassist/i.test(String(ev?.nameStr || ''))) {
    return { name: String(last.name) };
  }
  return null;
}

/**
 * FotMob encodes event minutes in varying shapes across responses. Try:
 *   1. `ev.time` as number (most common)
 *   2. `ev.timeStr` / `ev.time` as string — e.g. `"23'"`, `"45+2'"`, `"90+3"`
 *   3. fallback fields `minute`, `matchMinute`
 * Stoppage (`+N`) becomes a separate `stoppage` value so it can act as a sub-minute tiebreak.
 * Returns `{ minute: number | null, stoppage: number }`.
 */
export function parseFotmobEventMinute(ev) {
  const directTime = ev?.time;
  if (typeof directTime === 'number' && Number.isFinite(directTime)) {
    const overloadNum = Number(ev?.overloadTime);
    return {
      minute: directTime,
      stoppage: Number.isFinite(overloadNum) ? overloadNum : 0,
    };
  }
  const strSources = [ev?.timeStr, directTime, ev?.minute, ev?.matchMinute];
  for (const src of strSources) {
    if (src == null) continue;
    const s = String(src);
    const m = s.match(/(\d+)(?:\s*\+\s*(\d+))?/);
    if (m) {
      const overloadNum = Number(ev?.overloadTime);
      return {
        minute: Number(m[1]),
        stoppage: m[2] != null
          ? Number(m[2])
          : Number.isFinite(overloadNum)
            ? overloadNum
            : 0,
      };
    }
  }
  const altNum = Number(ev?.minute ?? ev?.matchMinute);
  if (Number.isFinite(altNum)) {
    const overloadNum = Number(ev?.overloadTime);
    return {
      minute: altNum,
      stoppage: Number.isFinite(overloadNum) ? overloadNum : 0,
    };
  }
  return { minute: null, stoppage: 0 };
}

/**
 * @param {{
 *   gameweek: number,
 *   gwFixtures: object[],
 *   elementById: Record<number, object>,
 *   teamById: Record<number, object>,
 *   trackedElementIds: Set<number>,
 * }} p
 * @returns {Promise<object[]>} contribution-shaped events with `sortKey` ≈ epoch ms ordering
 */
export async function fetchFotmobContributionTimeline({
  gameweek,
  gwFixtures,
  elementById,
  teamById,
  trackedElementIds,
}) {
  const gw = Number(gameweek);
  if (!Number.isFinite(gw) || !Array.isArray(gwFixtures) || !gwFixtures.length) {
    return [];
  }

  let leagueJson;
  try {
    leagueJson = await fetchFotmob(
      `leagues?id=${PL_LEAGUE_ID}&tab=table&type=league&timeZone=UTC`
    );
  } catch {
    try {
      leagueJson = await fetchFotmob(
        `leagues?id=${PL_LEAGUE_ID}&tab=overview&type=league&timeZone=UTC`
      );
    } catch {
      return [];
    }
  }

  const fotmobTeams = extractLeagueTeams(leagueJson);
  const fplToFm = mapFplTeamsToFotmob(teamById, fotmobTeams);
  if (!fplToFm.size) return [];

  const dates = new Set();
  for (const fx of gwFixtures) {
    const d = yyyymmddUtc(fx.kickoff_time);
    if (d) dates.add(d);
  }

  /** @type {Map<string, ReturnType<collectDayMatches>>} */
  const byDate = new Map();
  for (const d of dates) {
    try {
      const mj = await fetchFotmob(`matches?date=${d}`);
      byDate.set(d, collectDayMatches(mj));
    } catch {
      byDate.set(d, []);
    }
  }

  const out = [];

  for (const fx of gwFixtures) {
    const kickMs = Date.parse(String(fx.kickoff_time || ''));
    if (!Number.isFinite(kickMs)) continue;
    const d = yyyymmddUtc(fx.kickoff_time);
    const dayRows = d ? byDate.get(d) || [] : [];
    const matchId = findMatchIdForFplFixture(fx, fplToFm, dayRows);
    if (!Number.isFinite(matchId)) continue;

    let matchJson;
    try {
      matchJson = await fetchFotmob(`matchDetails?matchId=${matchId}`);
    } catch {
      continue;
    }

    const rawEvents = extractEventsList(matchJson);
    /**
     * Normalize then sort chronologically. Different FotMob endpoints return events in different
     * orders (sometimes grouped by half, sometimes descending). Sorting here guarantees the slot
     * tie-break reflects real match order.
     */
    const normalized = [];
    for (let i = 0; i < rawEvents.length; i++) {
      const ev = rawEvents[i];
      const kind = classifyFotmobEvent(ev);
      if (!kind) continue;
      const { minute, stoppage } = parseFotmobEventMinute(ev);
      const eid = Number(ev?.eventId);
      normalized.push({
        ev,
        kind,
        minute,
        stoppage,
        idx: i,
        eid: Number.isFinite(eid) ? eid : i,
      });
    }
    normalized.sort((a, b) => {
      const am = Number.isFinite(a.minute) ? a.minute : Number.POSITIVE_INFINITY;
      const bm = Number.isFinite(b.minute) ? b.minute : Number.POSITIVE_INFINITY;
      if (am !== bm) return am - bm;
      if (a.stoppage !== b.stoppage) return a.stoppage - b.stoppage;
      if (a.eid !== b.eid) return a.eid - b.eid;
      return a.idx - b.idx;
    });

    let slot = 0;
    let lastMk = '';

    for (let i = 0; i < normalized.length; i++) {
      const { ev, kind, minute, stoppage } = normalized[i];
      const tmin = Number.isFinite(minute) ? minute : 0;
      const ot = Number.isFinite(stoppage) ? stoppage : 0;
      const mk = `${tmin}_${ot}`;
      if (mk !== lastMk) {
        slot = 0;
        lastMk = mk;
      } else {
        slot += 1;
      }
      const sortKey = kickMs + tmin * 60_000 + ot * 1000 + slot;

      const pushOne = (k, playerObj, delta = 1) => {
        if (!playerObj?.name) return;
        const isHome = ev.isHome === true;
        const teamFpl = isHome ? Number(fx.team_h) : Number(fx.team_a);
        if (!Number.isFinite(teamFpl)) return;
        const elid = matchFplElementId(teamFpl, playerObj.name, elementById);
        if (elid == null || !trackedElementIds.has(elid)) return;
        const iso = new Date(sortKey).toISOString();
        out.push({
          stableId: `fotmob:${matchId}:${k}:${elid}:${ev.eventId ?? i}:${sortKey}`,
          kind: k,
          elementId: elid,
          gameweek: gw,
          delta,
          recordedAt: iso,
          sortKey,
          source: 'fotmob',
          fplFixtureId:
            fx?.id != null && Number.isFinite(Number(fx.id)) ? Number(fx.id) : null,
        });
      };

      if (kind === 'goal') {
        const primary = ev?.player;
        const teamFplScorer =
          ev.isHome === true ? Number(fx.team_h) : Number(fx.team_a);
        pushOne('goal', primary, 1);
        const an = assistNameFromGoalText(ev.nameStr);
        if (an && Number.isFinite(teamFplScorer)) {
          const elA = matchFplElementId(teamFplScorer, an, elementById);
          if (elA != null && trackedElementIds.has(elA)) {
            const iso = new Date(sortKey + 1).toISOString();
            out.push({
              stableId: `fotmob:${matchId}:assist:${elA}:${ev.eventId ?? i}:${sortKey}a`,
              kind: 'assist',
              elementId: elA,
              gameweek: gw,
              delta: 1,
              recordedAt: iso,
              sortKey: sortKey + 1,
              source: 'fotmob',
              fplFixtureId:
                fx?.id != null && Number.isFinite(Number(fx.id)) ? Number(fx.id) : null,
            });
          }
        } else {
          const swapA = assistPlayerFromSwap(ev);
          if (swapA?.name) pushOne('assist', swapA, 1);
        }
      } else {
        pushOne(kind, ev.player, 1);
      }
    }
  }

  out.sort((a, b) => (Number(b.sortKey) || 0) - (Number(a.sortKey) || 0));
  return out;
}
