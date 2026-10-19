import {
  elementSavePoints,
  parseElementStat,
} from './playersWireList.js'

/** @typedef {'current' | 'prior' | 'combined'} TradeSeasonMode */

/**
 * Stats that can be summed (or averaged) across a trade side and plotted
 * as radar axes. `source: 'summary'` reads player-wire-stats; everything
 * else is a bootstrap element field.
 *
 * @type {Record<string, {
 *   id: string,
 *   label: string,
 *   title: string,
 *   group: 'scoring' | 'expected' | 'playing' | 'defensive',
 *   format: 'int' | 'decimal',
 *   aggregate: 'sum' | 'avg',
 *   lowerIsBetter?: boolean,
 *   field?: string,
 *   source?: 'element' | 'summary' | 'savePts',
 *   summaryKey?: 'gamesPlayed' | 'sixtyPlus' | 'defConHits',
 * }>}
 */
export const TRADE_STAT_CATALOG = {
  pts: {
    id: 'pts',
    label: 'PTS',
    title: 'Total points',
    group: 'scoring',
    format: 'int',
    aggregate: 'sum',
    field: 'total_points',
  },
  goals: {
    id: 'goals',
    label: 'G',
    title: 'Goals',
    group: 'scoring',
    format: 'int',
    aggregate: 'sum',
    field: 'goals_scored',
  },
  assists: {
    id: 'assists',
    label: 'A',
    title: 'Assists',
    group: 'scoring',
    format: 'int',
    aggregate: 'sum',
    field: 'assists',
  },
  bonus: {
    id: 'bonus',
    label: 'BON',
    title: 'Bonus points',
    group: 'scoring',
    format: 'int',
    aggregate: 'sum',
    field: 'bonus',
  },
  xg: {
    id: 'xg',
    label: 'xG',
    title: 'Expected goals',
    group: 'expected',
    format: 'decimal',
    aggregate: 'sum',
    field: 'expected_goals',
  },
  xa: {
    id: 'xa',
    label: 'xA',
    title: 'Expected assists',
    group: 'expected',
    format: 'decimal',
    aggregate: 'sum',
    field: 'expected_assists',
  },
  minutes: {
    id: 'minutes',
    label: 'MIN',
    title: 'Minutes',
    group: 'playing',
    format: 'int',
    aggregate: 'sum',
    field: 'minutes',
  },
  starts: {
    id: 'starts',
    label: 'ST',
    title: 'Starts',
    group: 'playing',
    format: 'int',
    aggregate: 'sum',
    field: 'starts',
  },
  gp: {
    id: 'gp',
    label: 'GP',
    title: 'Games played (GWs with minutes)',
    group: 'playing',
    format: 'int',
    aggregate: 'sum',
    source: 'summary',
    summaryKey: 'gamesPlayed',
  },
  sixtyPlus: {
    id: 'sixtyPlus',
    label: '60+',
    title: 'Gameweeks with 60+ minutes',
    group: 'playing',
    format: 'int',
    aggregate: 'sum',
    source: 'summary',
    summaryKey: 'sixtyPlus',
  },
  cs: {
    id: 'cs',
    label: 'CS',
    title: 'Clean sheets',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    field: 'clean_sheets',
  },
  defConHits: {
    id: 'defConHits',
    label: 'DC',
    title: 'DefCon GWs',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    source: 'summary',
    summaryKey: 'defConHits',
  },
  saves: {
    id: 'saves',
    label: 'SV',
    title: 'Saves',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    field: 'saves',
  },
  savePts: {
    id: 'savePts',
    label: 'SVP',
    title: 'Save points (1 per 3 saves)',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    source: 'savePts',
  },
  bps: {
    id: 'bps',
    label: 'BPS',
    title: 'Bonus point system score',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    field: 'bps',
  },
  gc: {
    id: 'gc',
    label: 'GC',
    title: 'Goals conceded (lower is better)',
    group: 'defensive',
    format: 'int',
    aggregate: 'sum',
    lowerIsBetter: true,
    field: 'goals_conceded',
  },
}

export const TRADE_STAT_GROUPS = [
  { id: 'scoring', label: 'Scoring' },
  { id: 'expected', label: 'Expected' },
  { id: 'playing', label: 'Playing time' },
  { id: 'defensive', label: 'Defensive' },
]

/** Six axes — same count as a classic player radar. */
export const DEFAULT_TRADE_STAT_IDS = [
  'pts',
  'goals',
  'assists',
  'cs',
  'bonus',
  'xg',
]

export const TRADE_MAX_STATS = 8
export const TRADE_MIN_STATS = 3

/** "2026-27" → "26/27" */
export function seasonShortLabel(label) {
  if (typeof label !== 'string') return ''
  const m = label.match(/^(\d{4})-(\d{2})$/)
  return m ? `${m[1].slice(2)}/${m[2]}` : label
}

/**
 * @param {string[]} selectedIds
 * @returns {string[]}
 */
export function normalizeTradeStatSelection(selectedIds) {
  const seen = new Set()
  const out = []
  for (const id of selectedIds || []) {
    if (!TRADE_STAT_CATALOG[id] || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= TRADE_MAX_STATS) break
  }
  if (out.length >= TRADE_MIN_STATS) return out
  for (const id of DEFAULT_TRADE_STAT_IDS) {
    if (seen.has(id)) continue
    out.push(id)
    seen.add(id)
    if (out.length >= TRADE_MIN_STATS) break
  }
  return out
}

/**
 * @param {object | null | undefined} el
 * @param {{ gamesPlayed?: number, sixtyPlus?: number, defConHits?: number } | null | undefined} summary
 * @param {string} statId
 * @returns {number}
 */
export function readTradeStat(el, summary, statId) {
  const def = TRADE_STAT_CATALOG[statId]
  if (!def) return 0
  if (def.source === 'summary') {
    return Number(summary?.[def.summaryKey]) || 0
  }
  if (def.source === 'savePts') {
    return elementSavePoints(el)
  }
  if (!el) return 0
  return parseElementStat(el[def.field])
}

/**
 * @param {object[]} elements
 * @returns {Map<number, object>}
 */
export function indexElementsByCode(elements) {
  const out = new Map()
  for (const el of elements || []) {
    const code = Number(el?.code)
    if (!Number.isFinite(code) || out.has(code)) continue
    out.set(code, el)
  }
  return out
}

/**
 * @param {object | null | undefined} currentEl
 * @param {Map<number, object>} priorByCode
 * @returns {object | null}
 */
export function joinPriorByCode(currentEl, priorByCode) {
  const code = Number(currentEl?.code)
  if (!Number.isFinite(code) || !priorByCode) return null
  return priorByCode.get(code) ?? null
}

/**
 * @param {object | null | undefined} currentEl
 * @param {object | null | undefined} priorEl
 * @param {object | null | undefined} currentSummary
 * @param {object | null | undefined} priorSummary
 * @param {string} statId
 * @param {TradeSeasonMode} mode
 * @returns {{ value: number, current: number, prior: number, hasPrior: boolean }}
 */
export function seasonStatValue(
  currentEl,
  priorEl,
  currentSummary,
  priorSummary,
  statId,
  mode,
) {
  const current = readTradeStat(currentEl, currentSummary, statId)
  const hasPrior = Boolean(priorEl)
  const prior = hasPrior ? readTradeStat(priorEl, priorSummary, statId) : 0
  if (mode === 'prior') return { value: hasPrior ? prior : 0, current, prior, hasPrior }
  if (mode === 'combined') {
    return { value: current + prior, current, prior, hasPrior }
  }
  return { value: current, current, prior, hasPrior }
}

/**
 * @param {{
 *   currentEl: object | null,
 *   priorEl?: object | null,
 *   currentSummary?: object | null,
 *   priorSummary?: object | null,
 * }[]} players
 * @param {string[]} statIds
 * @param {TradeSeasonMode} mode
 * @returns {Record<string, number>}
 */
export function aggregateSideStats(players, statIds, mode) {
  const ids = normalizeTradeStatSelection(statIds)
  /** @type {Record<string, number>} */
  const sums = {}
  /** @type {Record<string, number>} */
  const counts = {}
  for (const id of ids) {
    sums[id] = 0
    counts[id] = 0
  }
  for (const p of players || []) {
    if (!p?.currentEl && mode !== 'prior') continue
    if (mode === 'prior' && !p?.priorEl) continue
    for (const id of ids) {
      const { value } = seasonStatValue(
        p.currentEl,
        p.priorEl,
        p.currentSummary,
        p.priorSummary,
        id,
        mode,
      )
      sums[id] += value
      counts[id] += 1
    }
  }
  /** @type {Record<string, number>} */
  const out = {}
  for (const id of ids) {
    const def = TRADE_STAT_CATALOG[id]
    if (def?.aggregate === 'avg') {
      out[id] = counts[id] ? sums[id] / counts[id] : 0
    } else {
      out[id] = sums[id]
    }
  }
  return out
}

/**
 * Scale a raw pair onto 0–1 for the radar. The leader of each axis sits on
 * the outer ring; lower-is-better stats invert so the smaller number wins.
 *
 * @param {number} a
 * @param {number} b
 * @param {{ lowerIsBetter?: boolean }} [def]
 * @returns {{ aNorm: number, bNorm: number }}
 */
export function normalizeRadarPair(a, b, def = {}) {
  const av = Number(a) || 0
  const bv = Number(b) || 0
  const scale = Math.max(Math.abs(av), Math.abs(bv), 1)
  if (def.lowerIsBetter) {
    return {
      aNorm: (scale - av) / scale,
      bNorm: (scale - bv) / scale,
    }
  }
  return {
    aNorm: av / scale,
    bNorm: bv / scale,
  }
}

/**
 * @param {string[]} statIds
 * @param {Record<string, number>} sideA
 * @param {Record<string, number>} sideB
 * @returns {{
 *   id: string,
 *   label: string,
 *   title: string,
 *   a: number,
 *   b: number,
 *   aNorm: number,
 *   bNorm: number,
 *   delta: number,
 *   lowerIsBetter: boolean,
 * }[]}
 */
export function buildRadarAxes(statIds, sideA, sideB) {
  const ids = normalizeTradeStatSelection(statIds)
  return ids.map((id) => {
    const def = TRADE_STAT_CATALOG[id]
    const a = Number(sideA?.[id]) || 0
    const b = Number(sideB?.[id]) || 0
    const { aNorm, bNorm } = normalizeRadarPair(a, b, def)
    const delta = def.lowerIsBetter ? b - a : a - b
    return {
      id,
      label: def.label,
      title: def.title,
      a,
      b,
      aNorm,
      bNorm,
      delta,
      lowerIsBetter: Boolean(def.lowerIsBetter),
    }
  })
}

/**
 * @param {number} index
 * @param {number} count
 * @param {number} value01
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} [startAngle]
 * @returns {[number, number]}
 */
export function radarVertex(
  index,
  count,
  value01,
  cx,
  cy,
  radius,
  startAngle = -Math.PI / 2,
) {
  const n = Math.max(3, count)
  const angle = startAngle + (index / n) * Math.PI * 2
  const r = radius * Math.max(0, Math.min(1, Number(value01) || 0))
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

/**
 * @param {[number, number][]} points
 * @returns {string}
 */
export function polygonPath(points) {
  if (!points?.length) return ''
  const body = points
    .map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L'
      return `${cmd}${p[0].toFixed(2)},${p[1].toFixed(2)}`
    })
    .join(' ')
  return `${body} Z`
}

/**
 * @param {string} statId
 * @param {number} value
 * @returns {string}
 */
export function formatTradeStat(statId, value) {
  const def = TRADE_STAT_CATALOG[statId]
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (def?.format === 'decimal') return n.toFixed(1)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 10) / 10)
}

/**
 * Count of GKP / DEF / MID / FWD (element types 1–4) in a picked side.
 *
 * @param {{ positionType?: number }[] | null | undefined} players
 * @returns {Record<1 | 2 | 3 | 4, number>}
 */
export function tradePositionCounts(players) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const p of players || []) {
    const t = Number(p?.positionType)
    if (t >= 1 && t <= 4) counts[t] += 1
  }
  return counts
}

/**
 * True when every position count on this side is at least the other side's.
 * An empty other side is always covered, so the first side can pick freely.
 *
 * @param {Record<number, number> | null | undefined} sideCounts
 * @param {Record<number, number> | null | undefined} otherCounts
 */
export function tradeSideCovers(sideCounts, otherCounts) {
  for (let t = 1; t <= 4; t += 1) {
    if ((sideCounts?.[t] || 0) < (otherCounts?.[t] || 0)) return false
  }
  return true
}

/**
 * Both sides hold the same number of players at each position.
 *
 * @param {Record<number, number> | null | undefined} countsA
 * @param {Record<number, number> | null | undefined} countsB
 */
export function tradePositionsMatch(countsA, countsB) {
  for (let t = 1; t <= 4; t += 1) {
    if ((countsA?.[t] || 0) !== (countsB?.[t] || 0)) return false
  }
  return true
}

/**
 * A side that already covers the other may add any position. A side that
 * is short may only fill a position the other side still has more of.
 *
 * @param {Record<number, number> | null | undefined} sideCounts
 * @param {Record<number, number> | null | undefined} otherCounts
 * @param {number | string | null | undefined} positionType
 */
export function canAddTradePosition(sideCounts, otherCounts, positionType) {
  const pos = Number(positionType)
  if (!Number.isFinite(pos) || pos < 1 || pos > 4) return false
  if ((sideCounts?.[pos] || 0) < (otherCounts?.[pos] || 0)) return true
  return tradeSideCovers(sideCounts, otherCounts)
}

/**
 * Positions this side still owes, one entry per missing player, GKP → FWD.
 *
 * @param {Record<number, number> | null | undefined} sideCounts
 * @param {Record<number, number> | null | undefined} otherCounts
 * @returns {number[]}
 */
export function missingTradePositions(sideCounts, otherCounts) {
  const missing = []
  for (let t = 1; t <= 4; t += 1) {
    const gap = (otherCounts?.[t] || 0) - (sideCounts?.[t] || 0)
    for (let i = 0; i < gap; i += 1) missing.push(t)
  }
  return missing
}

/**
 * "MID, FWD" or "2 MID, FWD".
 *
 * @param {number[] | null | undefined} positionTypes
 * @param {(positionType: number) => string} [labelOf]
 */
export function formatTradePositionNeeds(positionTypes, labelOf) {
  const counts = tradePositionCounts(
    (positionTypes || []).map((positionType) => ({ positionType })),
  )
  const parts = []
  for (let t = 1; t <= 4; t += 1) {
    const n = counts[t]
    if (!n) continue
    const label = labelOf ? labelOf(t) : String(t)
    parts.push(n > 1 ? `${n} ${label}` : label)
  }
  return parts.join(', ')
}

/**
 * Browse filter: keep one FPL element_type (1 GKP / 2 DEF / 3 MID / 4 FWD).
 * Blank or unknown values leave the list unchanged.
 *
 * @param {object[] | null | undefined} squad
 * @param {number | string | null | undefined} positionType
 * @returns {object[]}
 */
export function filterSquadByPosition(squad, positionType) {
  const list = Array.isArray(squad) ? squad : []
  const pos = Number(positionType)
  if (!Number.isFinite(pos) || pos < 1 || pos > 4) return list
  return list.filter((p) => Number(p.positionType) === pos)
}

/**
 * Squad list for one trade side. Selected players stay visible so they can
 * be removed. Everyone else is hidden unless their position can still be
 * added without breaking the position match.
 *
 * @param {object[] | null | undefined} squad
 * @param {{
 *   sideCounts?: Record<number, number>,
 *   otherCounts?: Record<number, number>,
 *   selectedIds?: number[],
 * }} [opts]
 * @returns {object[]}
 */
export function filterSquadForTrade(squad, opts = {}) {
  const list = Array.isArray(squad) ? squad : []
  const sideCounts = opts?.sideCounts
  const otherCounts = opts?.otherCounts
  if (!sideCounts || !otherCounts) return list
  if (tradeSideCovers(sideCounts, otherCounts)) return list
  const selected = new Set((opts.selectedIds || []).map(Number))
  return list.filter((p) => {
    if (selected.has(Number(p.element))) return true
    return canAddTradePosition(sideCounts, otherCounts, p.positionType)
  })
}

/**
 * Case-insensitive player-name filter for Trade Tool search.
 *
 * @param {{ name?: string }[]} squad
 * @param {string} query
 */
export function filterSquadByQuery(squad, query) {
  const list = Array.isArray(squad) ? squad : []
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return list
  return list.filter((p) => String(p.name ?? '').toLowerCase().includes(q))
}

/**
 * Encode a Trade Tool side source for the team picker.
 * Fantasy managers use `entry:<leagueEntryId>`; PL clubs use `club:<teamId>`.
 *
 * @param {'entry' | 'club'} kind
 * @param {number} id
 * @returns {string}
 */
export function encodeTradeSource(kind, id) {
  const n = Number(id)
  if (!Number.isFinite(n) || (kind !== 'entry' && kind !== 'club')) return ''
  return `${kind}:${n}`
}

/**
 * @param {string | number | null | undefined} raw
 * @returns {{ kind: 'entry' | 'club', id: number } | null}
 */
export function parseTradeSource(raw) {
  const m = String(raw ?? '').match(/^(entry|club):(\d+)$/)
  if (!m) return null
  return { kind: /** @type {'entry' | 'club'} */ (m[1]), id: Number(m[2]) }
}

/**
 * Players for the given ids, in pick order.
 *
 * @param {number[]} ids
 * @param {{ element: number }[] | null | undefined} squad
 */
function playersFromIds(ids, squad) {
  const byId = new Map()
  for (const p of squad || []) byId.set(Number(p.element), p)
  return (ids || []).map((id) => byId.get(Number(id))).filter(Boolean)
}

/**
 * Toggle a player on one side. There is no cap on how many players a side
 * can hold. The side that already covers the other may add any position;
 * the side that is short may only fill a position the other side still has
 * more of. The same element cannot sit on both sides.
 *
 * @param {{
 *   idsA?: number[],
 *   idsB?: number[],
 *   squadA?: { element: number, positionType: number }[],
 *   squadB?: { element: number, positionType: number }[],
 *   side: 'a' | 'b',
 *   elementId: number,
 * }} args
 * @returns {{ idsA: number[], idsB: number[] }}
 */
export function applyTradePick({
  idsA = [],
  idsB = [],
  squadA = [],
  squadB = [],
  side,
  elementId,
}) {
  const id = Number(elementId)
  const nextA = (idsA || []).map(Number)
  const nextB = (idsB || []).map(Number)
  if (!Number.isFinite(id)) return { idsA: nextA, idsB: nextB }

  const isA = side === 'a'
  const squad = isA ? squadA : squadB
  const player = (squad || []).find((p) => Number(p.element) === id)
  if (!player) return { idsA: nextA, idsB: nextB }

  const current = isA ? nextA : nextB
  const other = isA ? nextB : nextA

  if (current.includes(id)) {
    const kept = current.filter((x) => x !== id)
    return isA ? { idsA: kept, idsB: other } : { idsA: other, idsB: kept }
  }

  if (other.includes(id)) return { idsA: nextA, idsB: nextB }

  const otherSquad = isA ? squadB : squadA
  if (
    !canAddTradePosition(
      tradePositionCounts(playersFromIds(current, squad)),
      tradePositionCounts(playersFromIds(other, otherSquad)),
      player.positionType,
    )
  ) {
    return { idsA: nextA, idsB: nextB }
  }

  const added = [...current, id]
  return isA ? { idsA: added, idsB: other } : { idsA: other, idsB: added }
}

/**
 * Toggle a stat in the radar selection, respecting min/max.
 * @param {string[]} selectedIds
 * @param {string} statId
 * @returns {string[]}
 */
export function toggleTradeStat(selectedIds, statId) {
  if (!TRADE_STAT_CATALOG[statId]) return normalizeTradeStatSelection(selectedIds)
  const current = normalizeTradeStatSelection(selectedIds)
  if (current.includes(statId)) {
    if (current.length <= TRADE_MIN_STATS) return current
    return current.filter((id) => id !== statId)
  }
  if (current.length >= TRADE_MAX_STATS) return current
  return [...current, statId]
}
