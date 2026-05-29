import { defensiveContributionPointThreshold } from './fplBonusFromBps.js'
import { isCleanSheetEligible } from './liveScoresDerivations.js'

/**
 * Local copy of POS_LABEL — avoids transitively importing
 * `./playersWireList.js`, which uses extensionless module specifiers
 * Vite-only Node `--test` cannot resolve. Kept in sync with that file.
 */
const POS_LABEL = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/**
 * Premier-League-FPL-style FDR ramp 1..5 → tone bucket consumed by CSS class
 * suffix `pdetail-fdr--{n}`. Mirror of `mockup-pdetail-fdr--{n}` from
 * `web/src/Mockup.css` (lines ~4614-4618).
 *
 * @param {number | null | undefined} difficulty
 * @returns {1 | 2 | 3 | 4 | 5}
 */
export function fdrTone(difficulty) {
  if (difficulty == null) return 3
  const n = Number(difficulty)
  if (!Number.isFinite(n)) return 3
  if (n <= 1) return 1
  if (n >= 5) return 5
  return /** @type {1|2|3|4|5} */ (Math.round(n))
}

/**
 * Return the last `count` history rows in chronological order. Newest gets
 * the right-most bar in the mini chart.
 *
 * @template T
 * @param {T[] | null | undefined} historyRows
 * @param {number} [count]
 * @returns {T[]}
 */
export function lastNHistoryRows(historyRows, count = 5) {
  if (!Array.isArray(historyRows) || historyRows.length === 0) return []
  if (count <= 0) return []
  const n = Math.min(count, historyRows.length)
  return historyRows.slice(historyRows.length - n)
}

/**
 * Average / last / total summary for the last 5 GW totals row.
 *
 * @param {number[]} values
 * @returns {{ avg: number, last: number, total: number }}
 */
export function summarizeRecentPoints(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { avg: 0, last: 0, total: 0 }
  }
  let total = 0
  for (const v of values) {
    const n = Number(v)
    total += Number.isFinite(n) ? n : 0
  }
  const last = Number.isFinite(Number(values[values.length - 1]))
    ? Number(values[values.length - 1])
    : 0
  return {
    avg: total / values.length,
    last,
    total,
  }
}

/**
 * "pos / neg / neutral" bucket for the mini chart, comparing each value
 * against the average of the same series. Mirrors the `pos-neg` accent
 * variant from `MiniBars` in the locked Mockup (`web/src/Mockup.jsx`
 * lines ~4260-4267 — but the mockup uses a hard-coded `>= 6` threshold for
 * its season-MID sample; production uses the running average so the chart
 * remains meaningful for low-scoring positions like GK / DEF).
 *
 * @param {number} value
 * @param {number} average
 * @returns {'pos' | 'neg' | 'neutral'}
 */
export function miniBarTone(value, average) {
  const v = Number(value)
  const a = Number(average)
  if (!Number.isFinite(v) || !Number.isFinite(a)) return 'neutral'
  const delta = v - a
  if (delta > 0.5) return 'pos'
  if (delta < -0.5) return 'neg'
  return 'neutral'
}

/**
 * Build a compact stat-row catalog for the Performance table.
 *
 * @returns {{ id: string, label: string, title: string }[]}
 */
export function performanceStatCatalog() {
  /*
   * Catalog order drives the rendered column order in the Performance
   * table — `visibleColumns = catalog.filter(c => visibleIds.includes(c.id))`
   * preserves catalog index. Round-2 polish puts MIN ahead of PTS so the
   * default reads `GW · OPP · MIN · PTS · G · A · DC · BNS` per user spec
   * (MIN sits next to OPP, then PTS lands as the visual anchor stat).
   */
  return [
    { id: 'min', label: 'MIN', title: 'Minutes' },
    { id: 'pts', label: 'PTS', title: 'Total points' },
    { id: 'g',   label: 'G',   title: 'Goals' },
    { id: 'a',   label: 'A',   title: 'Assists' },
    { id: 'cs',  label: 'CS',  title: 'Clean sheets' },
    { id: 'dc',  label: 'DC',  title: 'Defensive contributions' },
    { id: 'bns', label: 'BNS', title: 'Bonus' },
    { id: 'bps', label: 'BPS', title: 'Bonus point system' },
    { id: 'xg',  label: 'xG',  title: 'Expected goals' },
    { id: 'xa',  label: 'xA',  title: 'Expected assists' },
    { id: 'sav', label: 'SAV', title: 'Saves' },
    { id: 'gc',  label: 'GC',  title: 'Goals conceded' },
    { id: 'yel', label: 'YEL', title: 'Yellow cards' },
    { id: 'red', label: 'RED', title: 'Red cards' },
    { id: 'fdr', label: 'FDR', title: 'Fixture difficulty rating' },
  ]
}

/**
 * Default visible columns. Order = `MIN · PTS · G · A · DC · BNS`
 * (PTS sits second, immediately after MIN, so the eye lands on it
 * directly after reading the GW + opponent column). FDR is intentionally
 * excluded from the default set per round-2 user feedback ("FDR isn't
 * needed as a default") — it's still selectable via the columns picker.
 */
export const DEFAULT_PERFORMANCE_COL_IDS = [
  'min',
  'pts',
  'g',
  'a',
  'dc',
  'bns',
]

/**
 * Stat-cell tone matching LiveScores rules. `'good'` → green-on cell,
 * `'neutral'` → default. FWDs never get a CS tone (`isCleanSheetEligible` is
 * false). DC is gated by `defensiveContributionPointThreshold` for the
 * player's position.
 *
 * @param {string} statId
 * @param {number | null | undefined} value
 * @param {number | null | undefined} elementType
 * @returns {'good' | 'neutral'}
 */
export function statCellTone(statId, value, elementType) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return 'neutral'
  const posLabel = POS_LABEL[elementType] ?? null
  switch (statId) {
    case 'g':
    case 'a':
    case 'bns':
      return 'good'
    case 'cs':
      return isCleanSheetEligible(posLabel) ? 'good' : 'neutral'
    case 'dc': {
      const t = defensiveContributionPointThreshold(elementType)
      if (t == null) return 'neutral'
      return v >= t ? 'good' : 'neutral'
    }
    default:
      return 'neutral'
  }
}

/**
 * Build a per-GW row map keyed by gameweek number.
 *
 *   - completed GW: `{ gw, kind: 'past', history: <historyRow>, fixture: <fxRow|null> }`
 *   - upcoming GW: `{ gw, kind: 'future', history: null, fixture: <fxRow> }`
 *
 * For double-game-weeks (DGW) the row carries `extras` for the additional
 * fixtures. The Performance table only renders one row per GW number; DGW
 * extras are surfaced inline via the OPP column.
 *
 * @param {object} elementSummary FPL element-summary payload
 * @returns {Array<{
 *   gw: number,
 *   kind: 'past' | 'future',
 *   history: object | null,
 *   fixture: object | null,
 *   extras: object[],
 * }>}
 */
export function performanceTableRows(elementSummary) {
  const history = Array.isArray(elementSummary?.history) ? elementSummary.history : []
  const fixtures = Array.isArray(elementSummary?.fixtures) ? elementSummary.fixtures : []

  /** @type {Map<number, { history: object | null, extras: object[], kind: 'past' }>} */
  const pastByGw = new Map()
  for (const h of history) {
    const gw = Number(h?.round ?? h?.event)
    if (!Number.isFinite(gw)) continue
    const cur = pastByGw.get(gw)
    if (!cur) {
      pastByGw.set(gw, { history: h, extras: [], kind: 'past' })
    } else {
      cur.extras.push(h)
    }
  }

  /** @type {Map<number, { fixture: object | null, extras: object[] }>} */
  const futureByGw = new Map()
  for (const f of fixtures) {
    const gw = Number(f?.event)
    if (!Number.isFinite(gw)) continue
    const cur = futureByGw.get(gw)
    if (!cur) {
      futureByGw.set(gw, { fixture: f, extras: [] })
    } else {
      cur.extras.push(f)
    }
  }

  const allGws = new Set()
  for (const gw of pastByGw.keys()) allGws.add(gw)
  for (const gw of futureByGw.keys()) allGws.add(gw)
  const sorted = [...allGws].sort((a, b) => a - b)

  return sorted.map((gw) => {
    const past = pastByGw.get(gw)
    if (past) {
      return {
        gw,
        kind: /** @type {'past'} */ ('past'),
        history: past.history,
        fixture: futureByGw.get(gw)?.fixture ?? null,
        extras: past.extras,
      }
    }
    const fut = futureByGw.get(gw)
    return {
      gw,
      kind: /** @type {'future'} */ ('future'),
      history: null,
      fixture: fut?.fixture ?? null,
      extras: fut?.extras ?? [],
    }
  })
}

/**
 * "Season complete" detector for the Overview Next-5 placeholder. Returns
 * `true` only when we're confident the season is over — the summary
 * payload has loaded *and* it has zero upcoming fixtures. Returns `false`
 * for the pre-load state (`summaryPayload == null` or `fixtures` not yet
 * an array) so the caller doesn't flash a "Season complete" placeholder
 * during the in-flight fetch.
 *
 * @param {object | null | undefined} elementSummary FPL element-summary payload
 * @returns {boolean}
 */
export function isSeasonComplete(elementSummary) {
  if (!elementSummary) return false
  const fx = elementSummary.fixtures
  if (!Array.isArray(fx)) return false
  return fx.length === 0
}

/**
 * First N upcoming fixtures, with `home` flag derived from `is_home` and
 * the opponent team-id derived from `team_h` / `team_a`.
 *
 * @param {object} elementSummary FPL element-summary payload
 * @param {number} playerTeamId FPL bootstrap `element.team`
 * @param {number} [count]
 * @returns {Array<{
 *   gw: number,
 *   teamId: number,
 *   home: boolean,
 *   difficulty: 1 | 2 | 3 | 4 | 5,
 * }>}
 */
export function upcomingFixturesNext(elementSummary, playerTeamId, count = 5) {
  const fixtures = Array.isArray(elementSummary?.fixtures) ? elementSummary.fixtures : []
  if (fixtures.length === 0) return []
  const home = Number(playerTeamId)
  const out = []
  for (const f of fixtures) {
    const gw = Number(f?.event)
    if (!Number.isFinite(gw)) continue
    const isHome = f?.is_home != null
      ? Boolean(f.is_home)
      : Number(f?.team_h) === home
    const oppId = isHome ? Number(f?.team_a) : Number(f?.team_h)
    if (!Number.isFinite(oppId)) continue
    out.push({
      gw,
      teamId: oppId,
      home: isHome,
      difficulty: fdrTone(f?.difficulty),
    })
    if (out.length >= count) break
  }
  return out
}

/**
 * Pull a stat value from an element-summary `history` row by Performance
 * stat id. Returns `null` if the value is missing or non-numeric. DNP rows
 * (minutes === 0) still surface their numeric stats — the table greys the
 * row in CSS instead of zeroing them out, so we return raw values here.
 *
 * @param {string} statId
 * @param {object} historyRow
 * @returns {number | null}
 */
export function performanceStatValue(statId, historyRow) {
  if (!historyRow) return null
  let raw
  switch (statId) {
    case 'pts': raw = historyRow.total_points; break
    case 'min': raw = historyRow.minutes; break
    case 'g':   raw = historyRow.goals_scored; break
    case 'a':   raw = historyRow.assists; break
    case 'cs':  raw = historyRow.clean_sheets; break
    case 'dc':  raw = historyRow.defensive_contribution ?? historyRow.dc; break
    case 'bns': raw = historyRow.bonus; break
    case 'bps': raw = historyRow.bps; break
    case 'xg':  raw = historyRow.expected_goals; break
    case 'xa':  raw = historyRow.expected_assists; break
    case 'sav': raw = historyRow.saves; break
    case 'gc':  raw = historyRow.goals_conceded; break
    case 'yel': raw = historyRow.yellow_cards; break
    case 'red': raw = historyRow.red_cards; break
    default:    return null
  }
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Format a stat value for the Performance table. xG / xA show 2 decimals;
 * everything else shows the integer string. `null` → em-dash.
 *
 * @param {string} statId
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatPerformanceStat(statId, value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const n = Number(value)
  if (statId === 'xg' || statId === 'xa') return n.toFixed(2)
  return String(n)
}

/**
 * Count of GWs where the player played 60+ minutes (the FPL "appearance"
 * threshold for full points / clean-sheet eligibility). Drives the
 * "60+ mins" Overview tile (replaces the old total-minutes tile, which
 * masked rotation).
 *
 * @param {Array<object> | null | undefined} historyRows
 * @returns {number}
 */
export function countGamesPlayedOver60(historyRows) {
  if (!Array.isArray(historyRows)) return 0
  let n = 0
  for (const h of historyRows) {
    const mins = Number(h?.minutes)
    if (Number.isFinite(mins) && mins >= 60) n += 1
  }
  return n
}

/**
 * Count of GWs where the player met or exceeded the
 * `defensiveContributionPointThreshold` for their position (10 for DEF,
 * 12 for MID/FWD; GK has no qualifying threshold per FPL scoring rules
 * — `defensiveContributionPointThreshold(1)` happens to return 10 today,
 * but goalkeepers don't earn DC points so we explicitly return 0 here).
 * Drives the "DC" tile — *count of qualifying games*, not season total —
 * to surface contribution frequency rather than raw volume.
 *
 * @param {Array<object> | null | undefined} historyRows
 * @param {number | null | undefined} elementType
 * @returns {number}
 */
export function countDcThresholdMet(historyRows, elementType) {
  if (!Array.isArray(historyRows)) return 0
  const et = Number(elementType)
  if (!Number.isFinite(et) || et === 1) return 0
  const t = defensiveContributionPointThreshold(et)
  if (t == null) return 0
  let n = 0
  for (const h of historyRows) {
    const dc = Number(performanceStatValue('dc', h))
    if (Number.isFinite(dc) && dc >= t) n += 1
  }
  return n
}

/**
 * Format a final score (`team_h_score - team_a_score`) from the player's
 * club's perspective. Returns `null` if the score is missing — the draft
 * API's `element-summary.history` rows omit score fields, so the caller
 * should fall back to a `plFixtures` lookup when this returns null.
 *
 * @param {object} historyRow FPL `element-summary.history` row
 * @returns {{ score: string, result: 'W' | 'D' | 'L', wasHome: boolean } | null}
 */
export function historyScoreFromPerspective(historyRow) {
  if (!historyRow) return null
  const home = Number(historyRow.team_h_score)
  const away = Number(historyRow.team_a_score)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  const wasHome = Boolean(historyRow.was_home)
  const my = wasHome ? home : away
  const opp = wasHome ? away : home
  const result = my > opp ? 'W' : my < opp ? 'L' : 'D'
  return { score: `${my}-${opp}`, result, wasHome }
}

/**
 * Look up final score for a gameweek + player club from the bootstrap
 * fixtures payload. Used when `historyScoreFromPerspective` returns null
 * (the draft API omits scores). Skips fixtures that haven't finished.
 *
 * @param {Array<object> | null | undefined} plFixtures
 * @param {number} gw
 * @param {number} playerTeamId
 * @returns {{ score: string, result: 'W' | 'D' | 'L', wasHome: boolean } | null}
 */
export function fixtureScoreForGw(plFixtures, gw, playerTeamId) {
  if (!Array.isArray(plFixtures)) return null
  const event = Number(gw)
  const club = Number(playerTeamId)
  if (!Number.isFinite(event) || !Number.isFinite(club)) return null
  const fx = plFixtures.find((f) => {
    if (Number(f?.event) !== event) return null
    return Number(f?.team_h) === club || Number(f?.team_a) === club
  })
  if (!fx) return null
  if (fx.team_h_score == null || fx.team_a_score == null) return null
  const home = Number(fx.team_h_score)
  const away = Number(fx.team_a_score)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  const wasHome = Number(fx.team_h) === club
  const my = wasHome ? home : away
  const opp = wasHome ? away : home
  const result = my > opp ? 'W' : my < opp ? 'L' : 'D'
  return { score: `${my}-${opp}`, result, wasHome }
}

/**
 * Build the Last-5-GW card model — opponent crest + score + player points,
 * with DNP rows surfaced as a greyed placeholder. Tone is computed against
 * the *season* points-per-GW average so a single big haul stays green even
 * when the running 5-GW window dips low.
 *
 * The draft `element-summary.history` rows omit `team_h_score`/`team_a_score`
 * /`was_home`, so when those fields are missing the function falls back to
 * looking up the fixture in the bootstrap `plFixtures` payload (`event`
 * matches the GW, `team_h`/`team_a` matches the player's club). Pass
 * `plFixtures` and `playerTeamId` via `options` to enable that fallback.
 *
 * @param {Array<object> | null | undefined} historyRows Full season history (chronological)
 * @param {number | null | undefined} _elementType Reserved (kept for future per-position weighting)
 * @param {number} [count]
 * @param {{
 *   plFixtures?: Array<object> | null,
 *   playerTeamId?: number | null,
 * }} [options]
 * @returns {Array<{
 *   gw: number,
 *   opponentTeamId: number | null,
 *   home: boolean,
 *   score: string | null,
 *   result: 'W' | 'D' | 'L' | null,
 *   points: number | null,
 *   minutes: number,
 *   dnp: boolean,
 *   tone: 'pos' | 'neg' | 'neutral',
 * }>}
 */
export function lastFiveGwCards(historyRows, _elementType, count = 5, options = {}) {
  const rows = lastNHistoryRows(historyRows ?? [], count)
  if (rows.length === 0) return []
  const all = Array.isArray(historyRows) ? historyRows : []
  let totalAll = 0
  let countAll = 0
  for (const h of all) {
    const v = Number(h?.total_points)
    if (Number.isFinite(v)) {
      totalAll += v
      countAll += 1
    }
  }
  const seasonAvg = countAll > 0 ? totalAll / countAll : 0
  const { plFixtures = null, playerTeamId = null } = options
  return rows.map((h) => {
    const gw = Number(h?.round ?? h?.event)
    const minutes = Number(h?.minutes) || 0
    const dnp = minutes <= 0
    const oppId = Number(h?.opponent_team)
    /** History row first; fall back to bootstrap fixtures when scores are missing. */
    let score = historyScoreFromPerspective(h)
    if (!score && Number.isFinite(gw) && playerTeamId != null) {
      score = fixtureScoreForGw(plFixtures, gw, playerTeamId)
    }
    const wasHome = score?.wasHome ?? Boolean(h?.was_home)
    const pts = Number(h?.total_points)
    const points = Number.isFinite(pts) ? pts : null
    const tone = dnp || points == null
      ? /** @type {'neutral'} */ ('neutral')
      : miniBarTone(points, seasonAvg)
    return {
      gw: Number.isFinite(gw) ? gw : 0,
      opponentTeamId: Number.isFinite(oppId) ? oppId : null,
      home: wasHome,
      score: score?.score ?? null,
      result: score?.result ?? null,
      points,
      minutes,
      dnp,
      tone,
    }
  })
}
