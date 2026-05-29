import { draftCurrentGameweek } from './draftBoardRosterStatus'
import { fplElementWebName } from './fplElementNames.js'
import { defensiveContributionPointThreshold } from './fplBonusFromBps'
import { draftResourceUrl, fplApiBase } from './fplDraftUrl'

export const POS_FILTER_ALL = 'all'
export const POS_LABEL = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/** Abbreviated position labels for portrait wire table (All filter). */
export const PORTRAIT_POS_LABEL = { 1: 'GK', 2: 'D', 3: 'M', 4: 'F' }

/** Single-letter position labels for the portrait wire row body. */
export const PORTRAIT_POS_LABEL_SINGLE = { 1: 'G', 2: 'D', 3: 'M', 4: 'F' }

/** Portrait default stat columns per position filter (≤600px) — wire list only.
 *
 * Variant I tile layout: 'pos' is rendered as a single-letter label inside
 * each tile's left-column sub-row, so it's no longer needed as a stat column.
 * Defaults per filter therefore stay focused on numeric stats (Pts is always
 * rendered first, ahead of these). */
export const PORTRAIT_DEFAULT_WIRE_STAT_IDS_BY_POSITION = {
  all: ['gp', 'goals', 'assists', 'defConHits'],
  '1': ['starts', 'cs', 'savePts', 'bonus'],
  '2': ['goals', 'assists', 'cs', 'defConHits'],
  '3': ['goals', 'assists', 'cs', 'defConHits'],
  '4': ['sixtyPlus', 'goals', 'assists', 'bonus'],
}

/** Portrait default stat columns for player detail view only (≤600px). */
export const PORTRAIT_DETAIL_DEFAULT_WIRE_STAT_IDS_BY_POSITION = {
  '1': ['sixtyPlus', 'starts', 'cs', 'savePts', 'goals'],
  '2': ['sixtyPlus', 'goals', 'assists', 'cs', 'defConHits'],
  '3': ['sixtyPlus', 'goals', 'assists', 'cs', 'defConHits'],
  '4': ['sixtyPlus', 'goals', 'assists', 'xg', 'xa'],
}

/** @typedef {'all' | '1' | '2' | '3' | '4'} PositionFilterId */

/** @type {{ id: PositionFilterId, label: string }[]} */
export const WIRE_POSITION_PILLS = [
  { id: POS_FILTER_ALL, label: 'All' },
  { id: '1', label: 'GK' },
  { id: '2', label: 'DEF' },
  { id: '3', label: 'MID' },
  { id: '4', label: 'FWD' },
]
/** @typedef {'total_points' | 'goals' | 'assists' | 'games_played' | 'sixty_plus' | 'clean_sheets' | 'def_con' | 'bonus' | 'xg' | 'xa' | 'starts' | 'form' | 'ppg' | 'goals_conceded' | 'bps' | 'yellow_cards' | 'red_cards' | 'own_goals' | 'saves' | 'save_pts' | 'xgc' | 'player' | 'pos' | 'next3'} WireSortKey */
/** @typedef {'asc' | 'desc'} WireSortDir */
/** @typedef {'playing' | 'returns' | 'expected' | 'defensive' | 'form' | 'discipline'} WireStatGroupId */

/** @typedef {object} WireStatDef
 * @property {string} id
 * @property {string} label
 * @property {string} [title]
 * @property {WireStatGroupId} group
 * @property {WireSortKey} sortKey
 * @property {'pos' | 'summary_gp' | 'summary_sixty' | 'summary_dc' | 'int' | 'decimal' | 'string' | 'save_pts'} format
 * @property {string} [field]
 * @property {string[]} [hideWhenPos]
 */

export const WIRE_MAX_STAT_COLUMNS = 8

export const WIRE_STAT_SELECTION_KEY = 'tclot-wire-stat-columns'
const WIRE_STAT_SELECTION_V2_KEY = 'tclot-wire-stat-columns-v4'

/** Default toggleable stat columns on the All tab (Pts is always fixed). */
export const DEFAULT_WIRE_STAT_IDS = [
  'gp',
  'sixtyPlus',
  'goals',
  'assists',
  'cs',
  'xg',
  'xa',
]

/** Default table columns per position tab — applied when switching GK/DEF/MID/FWD. */
export const DEFAULT_WIRE_STAT_IDS_BY_POSITION = {
  all: DEFAULT_WIRE_STAT_IDS,
  '1': ['gp', 'starts', 'cs', 'savePts', 'bonus'],
  '2': ['gp', 'sixtyPlus', 'goals', 'assists', 'cs', 'defConHits', 'bonus'],
  '3': ['gp', 'sixtyPlus', 'goals', 'assists', 'cs', 'defConHits', 'xg', 'xa'],
  '4': ['gp', 'sixtyPlus', 'goals', 'assists', 'xg', 'xa', 'bonus'],
}

export const WIRE_STAT_GROUP_LABELS = {
  playing: 'Playing time',
  returns: 'Returns',
  expected: 'Expected',
  defensive: 'Defensive',
  form: 'Form',
  discipline: 'Discipline',
}

const FWD_DISABLED_PICKER_IDS = new Set(['cs', 'xgc', 'saves'])

/**
 * Position-tab profiles for the Stats picker — promote relevant stats, disable irrelevant ones.
 * @type {Record<string, { promotedLabel: string, promote: string[], hint: string, disable?: string[] }>}
 */
const POSITION_PICKER_PROFILES = {
  '1': {
    promotedLabel: 'Top for GK',
    promote: ['savePts', 'starts', 'cs', 'bonus'],
    hint: 'Save pts, starts, CS, and Bonus surfaced first while the GK tab is active.',
  },
  '2': {
    promotedLabel: 'Top for DEF',
    promote: ['cs', 'xgc', 'gc', 'defConHits'],
    hint: 'Clean sheets, xGC, GC, and DefCon surfaced first while the DEF tab is active.',
  },
  '3': {
    promotedLabel: 'Top for MID',
    promote: ['xg', 'xa', 'goals', 'assists', 'defConHits'],
    hint: 'xG, xA, returns, and DefCon surfaced first while the MID tab is active.',
  },
  '4': {
    promotedLabel: 'Top for FWD',
    promote: ['goals', 'assists', 'xg', 'xa'],
    hint: 'Returns and expected stats surfaced first. CS, xGC, and Svs are disabled for forwards.',
    disable: ['cs', 'xgc', 'saves'],
  },
}

/** @type {Record<string, WireStatDef>} */
export const WIRE_STAT_CATALOG = {
  pos: { id: 'pos', label: 'Pos', group: 'playing', sortKey: 'pos', format: 'pos' },
  gp: {
    id: 'gp',
    label: 'GP',
    title: 'Games played (GWs with minutes)',
    group: 'playing',
    sortKey: 'games_played',
    format: 'summary_gp',
  },
  sixtyPlus: {
    id: 'sixtyPlus',
    label: '60+',
    title: 'Gameweeks with 60+ minutes',
    group: 'playing',
    sortKey: 'sixty_plus',
    format: 'summary_sixty',
  },
  starts: {
    id: 'starts',
    label: 'Starts',
    title: 'Starts this season',
    group: 'playing',
    sortKey: 'starts',
    format: 'int',
    field: 'starts',
  },
  goals: {
    id: 'goals',
    label: 'G',
    title: 'Goals scored',
    group: 'returns',
    sortKey: 'goals',
    format: 'int',
    field: 'goals_scored',
  },
  assists: {
    id: 'assists',
    label: 'A',
    title: 'Assists',
    group: 'returns',
    sortKey: 'assists',
    format: 'int',
    field: 'assists',
  },
  bonus: {
    id: 'bonus',
    label: 'Bonus',
    title: 'Bonus points',
    group: 'returns',
    sortKey: 'bonus',
    format: 'int',
    field: 'bonus',
  },
  xg: {
    id: 'xg',
    label: 'xG',
    title: 'Expected goals',
    group: 'expected',
    sortKey: 'xg',
    format: 'decimal',
    field: 'expected_goals',
  },
  xa: {
    id: 'xa',
    label: 'xA',
    title: 'Expected assists',
    group: 'expected',
    sortKey: 'xa',
    format: 'decimal',
    field: 'expected_assists',
  },
  defConHits: {
    id: 'defConHits',
    label: 'DC',
    title: 'Gameweeks with DefCon fantasy points (2 pts)',
    group: 'defensive',
    sortKey: 'def_con',
    format: 'summary_dc',
  },
  cs: {
    id: 'cs',
    label: 'CS',
    title: 'Clean sheets',
    group: 'defensive',
    sortKey: 'clean_sheets',
    format: 'int',
    field: 'clean_sheets',
    hideWhenPos: ['4'],
  },
  saves: {
    id: 'saves',
    label: 'Svs',
    title: 'Saves',
    group: 'defensive',
    sortKey: 'saves',
    format: 'int',
    field: 'saves',
  },
  savePts: {
    id: 'savePts',
    label: 'Save Pts',
    title: 'Save points (1 pt per 3 saves)',
    group: 'defensive',
    sortKey: 'save_pts',
    format: 'save_pts',
    hideWhenPos: ['2', '3', '4'],
  },
  gc: {
    id: 'gc',
    label: 'GC',
    title: 'Goals conceded',
    group: 'defensive',
    sortKey: 'goals_conceded',
    format: 'int',
    field: 'goals_conceded',
  },
  xgc: {
    id: 'xgc',
    label: 'xGC',
    title: 'Expected goals conceded',
    group: 'defensive',
    sortKey: 'xgc',
    format: 'decimal',
    field: 'expected_goals_conceded',
  },
  bps: {
    id: 'bps',
    label: 'BPS',
    title: 'Bonus point system score',
    group: 'defensive',
    sortKey: 'bps',
    format: 'int',
    field: 'bps',
  },
  form: {
    id: 'form',
    label: 'Form',
    title: 'Form (last 30 days)',
    group: 'form',
    sortKey: 'form',
    format: 'string',
    field: 'form',
  },
  ppg: {
    id: 'ppg',
    label: 'PPG',
    title: 'Points per game',
    group: 'form',
    sortKey: 'ppg',
    format: 'string',
    field: 'points_per_game',
  },
  yc: {
    id: 'yc',
    label: 'YC',
    title: 'Yellow cards',
    group: 'discipline',
    sortKey: 'yellow_cards',
    format: 'int',
    field: 'yellow_cards',
  },
  rc: {
    id: 'rc',
    label: 'RC',
    title: 'Red cards',
    group: 'discipline',
    sortKey: 'red_cards',
    format: 'int',
    field: 'red_cards',
  },
  og: {
    id: 'og',
    label: 'OG',
    title: 'Own goals',
    group: 'discipline',
    sortKey: 'own_goals',
    format: 'int',
    field: 'own_goals',
  },
}

export const SORT_LABELS = {
  total_points: 'Total pts',
  goals: 'Goals',
  assists: 'Assists',
  games_played: 'Games played',
  sixty_plus: '60+ mins',
  clean_sheets: 'Clean sheets',
  def_con: 'DefCon GWs',
  bonus: 'Bonus',
  xg: 'xG',
  xa: 'xA',
  starts: 'Starts',
  form: 'Form',
  ppg: 'PPG',
  goals_conceded: 'Goals conceded',
  bps: 'BPS',
  yellow_cards: 'Yellow cards',
  red_cards: 'Red cards',
  own_goals: 'Own goals',
  saves: 'Saves',
  save_pts: 'Save pts',
  xgc: 'xGC',
}

/** Even flex share for numeric stat columns (player capped so stats spread across the row). */
const WIRE_STAT_COL = 'minmax(2.15rem, 1fr)'

/** @type {{ id: string, label: string, title?: string, width: string }[]} */
const WIRE_FIXED_COLUMNS_BEFORE = [
  { id: 'player', label: 'Player', title: 'Player', width: 'minmax(11rem, 1.6fr)' },
  { id: 'pts', label: 'Pts', width: 'minmax(3rem, 52px)' },
]

/** Desktop-only Position column injected between Player and Pts. Chip-only. */
const WIRE_POSITION_COLUMN = {
  id: 'pos',
  label: 'POS',
  title: 'Position',
  width: 'minmax(56px, 64px)',
}

/** @type {{ id: string, label: string, title?: string, width: string }[]} */
const WIRE_FIXED_COLUMNS_AFTER = [
  { id: 'next3', label: 'Next 3', width: 'minmax(6.25rem, 1.65fr)' },
]

const WIRE_NEXT_FIXTURE_PORTRAIT = {
  id: 'next3',
  label: 'Next',
  title: 'Next fixture',
  width: 'minmax(1.25rem, 0.7fr)',
}

/** Portrait wire grid — fr-based so columns fill the row width.
 *
 * Stat-column track tightened (1.25rem → 1rem min, 0.9fr → 0.78fr) so the
 * numeric stats (PTS / POS / GP / G / A / DC) sit with tight ~4–6px gutters
 * on a 390px phone. Player + Pts + Next3 keep their original generous
 * widths so the visual anchor (player name) and the right-edge fixture
 * group don't get squeezed. Desktop unchanged — desktop uses WIRE_STAT_COL
 * (`minmax(2.15rem, 1fr)`). */
const PORTRAIT_WIRE_PLAYER_COL = 'minmax(4.5rem, 2fr)'
const PORTRAIT_WIRE_PTS_COL = 'minmax(1.65rem, 0.65fr)'
const PORTRAIT_WIRE_STAT_COL = 'minmax(1rem, 0.78fr)'

/**
 * @param {string} statId
 */
function wireStatToColumn(statId) {
  const def = WIRE_STAT_CATALOG[statId]
  if (!def) return null
  return {
    id: def.id,
    label: def.label,
    title: def.title,
    width: WIRE_STAT_COL,
    hideWhenPos: def.hideWhenPos,
  }
}

/**
 * @param {PositionFilterId} positionFilter
 * @returns {string[]}
 */
export function defaultWireStatIdsForPosition(positionFilter) {
  const ids =
    DEFAULT_WIRE_STAT_IDS_BY_POSITION[positionFilter] ?? DEFAULT_WIRE_STAT_IDS
  return [...ids]
}

/**
 * Portrait max stat columns. Variant I tiles have a fixed 168px right column
 * that fits Pts + N stats — 'all' caps at 5 stats (so right column shows
 * Pts + 5 = 6 cells), per-position filters cap at 4 (Pts + 4 = 5 cells). Pos
 * is rendered in the tile sub-row and is not counted in this cap.
 *
 * @param {PositionFilterId} positionFilter
 */
export function portraitMaxStatColumns(positionFilter) {
  return positionFilter === POS_FILTER_ALL ? 5 : 4
}

/**
 * @param {PositionFilterId} positionFilter
 * @returns {string[]}
 */
export function portraitDefaultWireStatIdsForPosition(positionFilter) {
  const ids =
    PORTRAIT_DEFAULT_WIRE_STAT_IDS_BY_POSITION[positionFilter] ??
    PORTRAIT_DEFAULT_WIRE_STAT_IDS_BY_POSITION.all
  return [...ids]
}

/**
 * @param {PositionFilterId} positionFilter
 * @returns {string[]}
 */
export function portraitDetailDefaultWireStatIdsForPosition(positionFilter) {
  const ids =
    PORTRAIT_DETAIL_DEFAULT_WIRE_STAT_IDS_BY_POSITION[positionFilter] ??
    PORTRAIT_DETAIL_DEFAULT_WIRE_STAT_IDS_BY_POSITION['1']
  return [...ids]
}

/**
 * Drop stats hidden for the active position tab (e.g. CS on FWD).
 * @param {string[]} ids
 * @param {PositionFilterId} positionFilter
 */
export function filterWireStatIdsForPosition(ids, positionFilter) {
  return ids.filter((id) => {
    const def = WIRE_STAT_CATALOG[id]
    if (!def?.hideWhenPos?.length) return true
    if (positionFilter === POS_FILTER_ALL) return true
    return !def.hideWhenPos.includes(positionFilter)
  })
}

/**
 * @param {string[]} selectedIds
 * @param {PositionFilterId} positionFilter
 */
export function wireStatSelectionIsDefaultForPosition(selectedIds, positionFilter) {
  const norm = normalizeWireStatSelection(selectedIds, positionFilter)
  const def = defaultWireStatIdsForPosition(positionFilter)
  if (norm.length !== def.length) return false
  return norm.every((id, i) => id === def[i])
}

/**
 * @param {string[]} [raw]
 * @param {PositionFilterId} [positionFilter]
 * @returns {string[]}
 */
/**
 * @param {string[]} [raw]
 * @param {PositionFilterId} [positionFilter]
 * @param {number} [maxCols]
 * @param {{ portrait?: boolean, portraitDetail?: boolean }} [options]
 */
export function normalizeWireStatSelection(
  raw,
  positionFilter = POS_FILTER_ALL,
  maxCols = WIRE_MAX_STAT_COLUMNS,
  options = {},
) {
  const fallback = options.portraitDetail
    ? portraitDetailDefaultWireStatIdsForPosition(positionFilter)
    : options.portrait
      ? portraitDefaultWireStatIdsForPosition(positionFilter)
      : defaultWireStatIdsForPosition(positionFilter)
  if (!Array.isArray(raw)) return [...fallback]
  const out = []
  for (const id of raw) {
    if (typeof id !== 'string' || !WIRE_STAT_CATALOG[id] || out.includes(id)) continue
    out.push(id)
    if (out.length >= maxCols) break
  }
  const filtered = filterWireStatIdsForPosition(out, positionFilter)
  return filtered.length ? filtered : [...fallback]
}

/** @returns {Partial<Record<PositionFilterId, string[]>>} */
function readWireStatSelectionsMap() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const v2raw = localStorage.getItem(WIRE_STAT_SELECTION_V2_KEY)
    if (v2raw) {
      const parsed = JSON.parse(v2raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    }
    const legacy = localStorage.getItem(WIRE_STAT_SELECTION_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      if (Array.isArray(parsed)) return { all: parsed }
    }
  } catch {
    /* ignore */
  }
  return {}
}

/**
 * @param {PositionFilterId} [positionFilter]
 * @returns {string[]}
 */
export function readWireStatSelection(positionFilter = POS_FILTER_ALL) {
  const map = readWireStatSelectionsMap()
  const saved = map[positionFilter]
  if (Array.isArray(saved) && saved.length) {
    return normalizeWireStatSelection(saved, positionFilter)
  }
  return defaultWireStatIdsForPosition(positionFilter)
}

/**
 * @param {PositionFilterId} positionFilter
 * @param {string[]} ids
 */
export function writeWireStatSelection(positionFilter, ids) {
  if (typeof localStorage === 'undefined') return
  try {
    const map = readWireStatSelectionsMap()
    map[positionFilter] = normalizeWireStatSelection(ids, positionFilter)
    localStorage.setItem(WIRE_STAT_SELECTION_V2_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

/**
 * @param {PositionFilterId} positionFilter
 * @param {string[]} selectedStatIds
 * @param {{ portrait?: boolean }} [options]
 */
export function visibleWireColumns(positionFilter, selectedStatIds, options = {}) {
  const portrait = Boolean(options.portrait)
  const maxCols = portrait ? portraitMaxStatColumns(positionFilter) : WIRE_MAX_STAT_COLUMNS
  const stats = normalizeWireStatSelection(
    selectedStatIds ?? (portrait
      ? portraitDefaultWireStatIdsForPosition(positionFilter)
      : defaultWireStatIdsForPosition(positionFilter)),
    positionFilter,
    maxCols,
    { portrait },
  )
    .map((id) => wireStatToColumn(id))
    .filter(Boolean)
    .filter((col) => {
      // 'pos' is never a stat column. Desktop has a dedicated fixed POS column
      // between Player and Pts; portrait (Variant I tile layout) renders the
      // single-letter position in each tile's left-column sub-row.
      if (col.id === 'pos') return false
      if (!col.hideWhenPos?.length) return true
      if (positionFilter === POS_FILTER_ALL) return true
      return !col.hideWhenPos.includes(positionFilter)
    })
  const fixtureCol = portrait ? [WIRE_NEXT_FIXTURE_PORTRAIT] : WIRE_FIXED_COLUMNS_AFTER
  const fixedBefore = portrait
    ? WIRE_FIXED_COLUMNS_BEFORE.map((c) => {
        if (c.id === 'player') {
          return { ...c, width: PORTRAIT_WIRE_PLAYER_COL }
        }
        if (c.id === 'pts') {
          return { ...c, width: PORTRAIT_WIRE_PTS_COL }
        }
        return c
      })
    : (() => {
        // Desktop column order: Player → POS → Pts → stats → Next3
        const out = []
        for (const c of WIRE_FIXED_COLUMNS_BEFORE) {
          if (c.id === 'pts') {
            out.push(WIRE_POSITION_COLUMN)
          }
          out.push(c)
        }
        return out
      })()
  const statWidth = portrait ? PORTRAIT_WIRE_STAT_COL : WIRE_STAT_COL
  const statsWithWidth = stats.map((col) => ({
    ...col,
    width: statWidth,
  }))
  return [...fixedBefore, ...statsWithWidth, ...fixtureCol]
}

/**
 * @param {PositionFilterId} positionFilter
 * @returns {{ promoted: WireStatDef[], promotedLabel: string, hint: string | null, groups: { id: WireStatGroupId, label: string, stats: WireStatDef[] }[] }}
 */
export function wireStatPickerLayout(positionFilter) {
  const all = Object.values(WIRE_STAT_CATALOG)
  const profile =
    positionFilter !== POS_FILTER_ALL ? POSITION_PICKER_PROFILES[positionFilter] : null
  const promoted = profile
    ? profile.promote.map((id) => WIRE_STAT_CATALOG[id]).filter(Boolean)
    : []
  const promotedIds = new Set(promoted.map((s) => s.id))
  const rest = all.filter((s) => {
    if (promotedIds.has(s.id)) return false
    if (isWireStatDisabledInPicker(s.id, positionFilter)) return false
    return true
  })
  const groupOrder = ['playing', 'returns', 'expected', 'defensive', 'form', 'discipline']
  const groups = groupOrder
    .map((gid) => ({
      id: gid,
      label: WIRE_STAT_GROUP_LABELS[gid],
      stats: rest.filter((s) => s.group === gid),
    }))
    .filter((g) => g.stats.length > 0)
  return {
    promoted,
    promotedLabel: profile?.promotedLabel ?? '',
    hint: profile?.hint ?? null,
    groups,
  }
}

/**
 * Short label for the active position tab (GK, DEF, …).
 * @param {PositionFilterId} positionFilter
 */
export function wireStatPickerPositionTabLabel(positionFilter) {
  if (positionFilter === POS_FILTER_ALL) return null
  return WIRE_POSITION_PILLS.find((p) => p.id === positionFilter)?.label ?? null
}

/**
 * @param {string} statId
 * @param {PositionFilterId} positionFilter
 */
export function isWireStatDisabledInPicker(statId, positionFilter) {
  if (positionFilter === POS_FILTER_ALL) return false
  const def = WIRE_STAT_CATALOG[statId]
  if (def?.hideWhenPos?.includes(positionFilter)) return true
  const profile = POSITION_PICKER_PROFILES[positionFilter]
  if (profile?.disable?.includes(statId)) return true
  return false
}

/**
 * @param {string} statId
 * @param {PositionFilterId} positionFilter
 */
export function wireStatPickerDisabledReason(statId, positionFilter) {
  if (!isWireStatDisabledInPicker(statId, positionFilter)) return ''
  if (positionFilter === '4' && FWD_DISABLED_PICKER_IDS.has(statId)) {
    return 'Not relevant for forwards'
  }
  if (WIRE_STAT_CATALOG[statId]?.hideWhenPos?.includes(positionFilter)) {
    return 'Not relevant for this position'
  }
  return 'Not relevant for this position'
}

/**
 * @param {{ id: string, width: string }[]} cols
 */
export function wireTableGridTemplate(cols) {
  return cols.map((c) => c.width).join(' ')
}

/**
 * @param {PositionFilterId} positionFilter
 * @returns {SortKeyId[]}
 */
export function sortKeysForPositionFilter(positionFilter) {
  const base = [
    'total_points',
    'goals',
    'assists',
    'games_played',
    'sixty_plus',
    'starts',
    'def_con',
    'bonus',
    'xg',
    'xa',
    'form',
    'ppg',
    'goals_conceded',
    'bps',
    'yellow_cards',
    'red_cards',
    'own_goals',
    'saves',
    'xgc',
  ]
  if (positionFilter === '4') return base
  return [...base.slice(0, 5), 'clean_sheets', ...base.slice(5)]
}

export function parseElementStat(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function formatDecimalStat(v, digits = 1) {
  const n = parseElementStat(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

/** @param {object} el bootstrap element */
export function elementDefCon(el) {
  return parseElementStat(el?.defensive_contribution)
}

/** @param {object} h history row */
function historyGw(h) {
  if (!h || typeof h !== 'object') return NaN
  const n = Number(h.round ?? h.event)
  return Number.isFinite(n) ? n : NaN
}

function historyDcCount(h) {
  const v =
    h?.defensive_contribution ??
    h?.defensive_contributions ??
    h?.dc ??
    h?.dc_count
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Gameweeks where the player hit the DefCon threshold (earned the 2 FPL pts).
 * @param {object} payload element-summary JSON
 * @param {number} elementTypeId
 */
export function defConGwHitsFromSummary(payload, elementTypeId) {
  const threshold = defensiveContributionPointThreshold(elementTypeId)
  if (threshold == null) return 0
  const raw = payload?.history
  if (!Array.isArray(raw)) return 0
  let hits = 0
  for (const h of raw) {
    if (!h || !Number.isFinite(historyGw(h))) continue
    const dc = historyDcCount(h)
    if (dc != null && dc >= threshold) hits += 1
  }
  return hits
}

function historyMinutes(h) {
  const n = Number(h?.minutes)
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {object} payload element-summary JSON
 */
export function playingTimeFromSummary(payload) {
  const raw = payload?.history
  if (!Array.isArray(raw)) return { gamesPlayed: 0, sixtyPlus: 0 }
  let gamesPlayed = 0
  let sixtyPlus = 0
  for (const h of raw) {
    if (!h || !Number.isFinite(historyGw(h))) continue
    const mins = historyMinutes(h)
    if (mins > 0) gamesPlayed += 1
    if (mins >= 60) sixtyPlus += 1
  }
  return { gamesPlayed, sixtyPlus }
}

/**
 * @param {object} payload element-summary JSON
 * @param {number} elementTypeId
 */
export function elementSummaryStatsFromPayload(payload, elementTypeId) {
  const { gamesPlayed, sixtyPlus } = playingTimeFromSummary(payload)
  return {
    defConHits: defConGwHitsFromSummary(payload, elementTypeId),
    gamesPlayed,
    sixtyPlus,
  }
}

/** FPL save points from season saves total (1 pt per 3 saves). */
export function elementSavePoints(el) {
  return Math.floor(parseElementStat(el?.saves) / 3)
}

/**
 * Position-aware DefCon threshold in GW count for Phase-2 row-tone coloring.
 * GKP/DEF earn DefCon at 10 BPS, MID/FWD at 12 BPS — surfacing here matches
 * the production gameweek threshold without re-importing fplBonusFromBps.
 *
 * @param {number} elementType
 */
export function dcThresholdForPosition(elementType) {
  return elementType === 1 || elementType === 2 ? 10 : 12
}

/**
 * Pure helper for the Phase-2 stat-cell tone treatment.
 *
 * Round-2 polish: green `is-good` tone retired in favor of FotMob-style
 * minimal stat coloring. Only zero/placeholder values get a muted tone now —
 * non-zero values render in the default text color (matching Pts).
 *
 * - `is-zero` (muted, weight 400): value 0 or non-numeric placeholder.
 * - `''` (default): everything else renders in normal text color.
 *
 * Returns a CSS class name suffix to append to `.players-table__cell--stat`.
 *
 * The previous signature took `(statId, value, elementType)` to decide which
 * non-zero values earned the green tone; with that tone retired the extra
 * arguments are no longer needed. Existing call sites that still pass three
 * args continue to work — JS silently ignores the extras.
 *
 * @param {string | number | null | undefined} value
 * @returns {'is-zero' | ''}
 */
export function wireStatToneClass(value) {
  if (value === '—' || value === '…' || value == null || value === '') {
    return 'is-zero'
  }
  const num = Number(value)
  if (!Number.isFinite(num)) return 'is-zero'
  if (num === 0) return 'is-zero'
  return ''
}

/**
 * @param {string} statId
 * @param {object} el bootstrap element
 * @param {{ defConHits?: number | null, gamesPlayed?: number | null, sixtyPlus?: number | null } | null | undefined} summary
 * @param {boolean} [summaryLoading]
 * @param {{ portraitPosAbbrev?: boolean }} [options]
 */
export function formatWireStatValue(statId, el, summary, summaryLoading = false, options = {}) {
  const def = WIRE_STAT_CATALOG[statId]
  if (!def || !el) return '—'

  if (def.format === 'pos') {
    if (options.portraitPosSingleLetter) {
      return PORTRAIT_POS_LABEL_SINGLE[el.element_type] ?? '—'
    }
    if (options.portraitPosAbbrev) {
      return PORTRAIT_POS_LABEL[el.element_type] ?? '—'
    }
    return POS_LABEL[el.element_type] ?? '—'
  }

  if (def.format === 'summary_gp') {
    if (summary != null && summary.gamesPlayed != null) return String(summary.gamesPlayed)
    return summaryLoading ? '…' : '—'
  }
  if (def.format === 'summary_sixty') {
    if (summary != null && summary.sixtyPlus != null) return String(summary.sixtyPlus)
    return summaryLoading ? '…' : '—'
  }
  if (def.format === 'summary_dc') {
    if (summary != null && summary.defConHits != null) return String(summary.defConHits)
    return summaryLoading ? '…' : '—'
  }
  if (def.format === 'save_pts') return String(elementSavePoints(el))
  if (def.format === 'decimal') return formatDecimalStat(el[def.field])
  if (def.format === 'string') {
    const raw = el[def.field]
    const s = raw != null ? String(raw).trim() : ''
    return s || '—'
  }
  return String(parseElementStat(el[def.field]))
}

/**
 * Wire-list stat boxes — Pts first, then selected table columns.
 * @param {object} el bootstrap element
 * @param {object | null} summaryPayload element-summary JSON
 * @param {number} elementType
 * @param {boolean} [summaryLoading]
 * @param {string[]} [selectedStatIds]
 * @returns {{ k: string, v: string }[]}
 */
export function buildWireStatPills(
  el,
  summaryPayload,
  elementType,
  summaryLoading = false,
  selectedStatIds,
  positionFilter = POS_FILTER_ALL,
  options = {},
) {
  let summary = null
  if (summaryPayload) {
    summary = elementSummaryStatsFromPayload(summaryPayload, elementType)
  }

  const portrait = Boolean(options.portrait)
  const portraitDetail = Boolean(options.portraitDetail)
  const maxCols = portrait ? portraitMaxStatColumns(positionFilter) : WIRE_MAX_STAT_COLUMNS
  const ids = normalizeWireStatSelection(
    selectedStatIds ?? (portraitDetail
      ? portraitDetailDefaultWireStatIdsForPosition(positionFilter)
      : portrait
        ? portraitDefaultWireStatIdsForPosition(positionFilter)
        : defaultWireStatIdsForPosition(positionFilter)),
    positionFilter,
    maxCols,
    { portrait, portraitDetail },
  )
  const pills = [{ k: 'Pts', v: String(parseElementStat(el?.total_points)) }]
  let displayIds = ids
  if (options.portraitCompare) {
    displayIds = ids.filter((id) => id !== 'gp')
    if (ids.includes('gp') && !displayIds.includes('sixtyPlus')) {
      const gpIdx = ids.indexOf('gp')
      displayIds = [
        ...displayIds.slice(0, gpIdx),
        'sixtyPlus',
        ...displayIds.slice(gpIdx),
      ]
    }
  }
  for (const id of displayIds) {
    const def = WIRE_STAT_CATALOG[id]
    if (!def) continue
    if (id === 'pos' && positionFilter !== POS_FILTER_ALL) continue
    if (elementType === 4 && def.hideWhenPos?.includes('4')) continue
    pills.push({
      k: def.label,
      v: formatWireStatValue(id, el, summary, summaryLoading, {
        portraitPosAbbrev: portrait && positionFilter === POS_FILTER_ALL && id === 'pos',
      }),
    })
  }
  return pills
}

/**
 * @param {string} colId
 * @returns {WireSortKey | null}
 */
export function wireColumnToSortKey(colId) {
  if (WIRE_STAT_CATALOG[colId]) return WIRE_STAT_CATALOG[colId].sortKey
  switch (colId) {
    case 'player':
      return 'player'
    case 'next3':
      return 'next3'
    case 'pts':
      return 'total_points'
    default:
      return null
  }
}

/** Wire table column groups for vertical separators: identity | summary | detail stats | fixtures */
const WIRE_IDENTITY_COLS = new Set(['player', 'pos'])
const WIRE_SUMMARY_COLS = new Set(['pts', 'gp'])
const WIRE_FIXTURE_COLS = new Set(['next3'])

/**
 * @param {string} colId
 * @returns {'identity' | 'summary' | 'detail' | 'fixtures'}
 */
export function wireColumnGroupId(colId) {
  if (WIRE_IDENTITY_COLS.has(colId)) return 'identity'
  if (WIRE_FIXTURE_COLS.has(colId)) return 'fixtures'
  if (WIRE_SUMMARY_COLS.has(colId)) return 'summary'
  if (WIRE_STAT_CATALOG[colId]) return 'detail'
  return 'detail'
}

/**
 * @param {string} colId
 * @param {{ id: string }[]} visibleCols
 * @param {number} index
 */
export function wireColumnIsGroupStart(colId, visibleCols, index) {
  if (index <= 0) return false
  const prev = visibleCols[index - 1]
  if (!prev) return false
  return wireColumnGroupId(prev.id) !== wireColumnGroupId(colId)
}

/** Default direction when newly selecting a column. */
export function defaultSortDirForKey(sortKey) {
  return sortKey === 'player' || sortKey === 'pos' || sortKey === 'next3' ? 'asc' : 'desc'
}

/**
 * @param {object} a bootstrap element
 * @param {object} b bootstrap element
 * @param {WireSortKey} sortKey
 * @param {WireSortDir} sortDir
 * @param {{
 *   extraFor?: (el: object) => { defConHits?: number | null, gamesPlayed?: number | null, sixtyPlus?: number | null },
 *   nextFixtureSortKey?: (el: object) => string,
 * }} [options]
 */
export function compareWireElements(a, b, sortKey, sortDir, options = {}) {
  const { extraFor, nextFixtureSortKey } = options
  let cmp = 0

  if (sortKey === 'player') {
    cmp = fplElementWebName(a, a?.id).localeCompare(fplElementWebName(b, b?.id), undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  } else if (sortKey === 'pos') {
    cmp = (Number(a?.element_type) || 0) - (Number(b?.element_type) || 0)
  } else if (sortKey === 'next3') {
    const la = nextFixtureSortKey?.(a) ?? ''
    const lb = nextFixtureSortKey?.(b) ?? ''
    cmp = la.localeCompare(lb)
  } else {
    const ea = extraFor?.(a) ?? {}
    const eb = extraFor?.(b) ?? {}
    cmp = elementSortValue(a, sortKey, ea) - elementSortValue(b, sortKey, eb)
  }

  if (cmp === 0) {
    cmp = fplElementWebName(a, a?.id).localeCompare(fplElementWebName(b, b?.id), undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  }

  return sortDir === 'asc' ? cmp : -cmp
}

/**
 * @param {object} el
 * @param {WireSortKey} key
 * @param {{ defConHits?: number | null, gamesPlayed?: number | null, sixtyPlus?: number | null }} [extra]
 */
export function elementSortValue(el, key, extra = {}) {
  if (!el) return 0
  switch (key) {
    case 'player':
    case 'pos':
    case 'next3':
      return 0
    case 'goals':
      return parseElementStat(el.goals_scored)
    case 'assists':
      return parseElementStat(el.assists)
    case 'games_played':
      return extra.gamesPlayed != null ? extra.gamesPlayed : 0
    case 'sixty_plus':
      return extra.sixtyPlus != null ? extra.sixtyPlus : 0
    case 'clean_sheets':
      return parseElementStat(el.clean_sheets)
    case 'def_con':
      return extra.defConHits != null ? extra.defConHits : elementDefCon(el)
    case 'bonus':
      return parseElementStat(el.bonus)
    case 'xg':
      return parseElementStat(el.expected_goals)
    case 'xa':
      return parseElementStat(el.expected_assists)
    case 'starts':
      return parseElementStat(el.starts)
    case 'form':
      return parseElementStat(el.form)
    case 'ppg':
      return parseElementStat(el.points_per_game)
    case 'goals_conceded':
      return parseElementStat(el.goals_conceded)
    case 'bps':
      return parseElementStat(el.bps)
    case 'yellow_cards':
      return parseElementStat(el.yellow_cards)
    case 'red_cards':
      return parseElementStat(el.red_cards)
    case 'own_goals':
      return parseElementStat(el.own_goals)
    case 'saves':
      return parseElementStat(el.saves)
    case 'save_pts':
      return elementSavePoints(el)
    case 'xgc':
      return parseElementStat(el.expected_goals_conceded)
    default:
      return parseElementStat(el.total_points)
  }
}

function teamBadgeUrl(team) {
  const code = team?.code
  return code != null
    ? `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
    : null
}

/**
 * Next `limit` upcoming opponents per team (badge-ready).
 * @param {object} bootstrap
 * @param {Map<number, object>} teamById
 * @param {number} [limit=3]
 * @returns {Map<number, { oppTeamId: number, shortName: string, isHome: boolean, badgeUrl: string | null }[]>}
 */
export function buildNextFixturesByTeam(bootstrap, teamById, limit = 3) {
  const out = new Map()
  const fixturesByEvent = bootstrap?.fixtures
  if (!fixturesByEvent || typeof fixturesByEvent !== 'object') return out

  const nextGw = Number(bootstrap?.events?.next) || draftCurrentGameweek(bootstrap)
  if (!Number.isFinite(nextGw) || nextGw < 1) return out

  /** @type {Map<number, { kickoff: string, oppTeamId: number, shortName: string, isHome: boolean, badgeUrl: string | null }[]>} */
  const byTeam = new Map()

  for (let gw = nextGw; gw <= nextGw + 8; gw++) {
    const list = fixturesByEvent[String(gw)] ?? fixturesByEvent[gw]
    if (!Array.isArray(list)) continue
    for (const f of list) {
      if (f?.finished) continue
      const th = Number(f.team_h)
      const ta = Number(f.team_a)
      const kickoff = f.kickoff_time != null ? String(f.kickoff_time) : ''
      for (const [tid, oppId, isHome] of [
        [th, ta, true],
        [ta, th, false],
      ]) {
        if (!Number.isFinite(tid) || !Number.isFinite(oppId)) continue
        const opp = teamById.get(oppId)
        if (!byTeam.has(tid)) byTeam.set(tid, [])
        byTeam.get(tid).push({
          kickoff,
          oppTeamId: oppId,
          shortName: opp?.short_name ?? '?',
          isHome,
          badgeUrl: teamBadgeUrl(opp),
        })
      }
    }
  }

  for (const [tid, list] of byTeam) {
    list.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    const seen = new Set()
    const unique = []
    for (const fx of list) {
      const k = `${fx.oppTeamId}:${fx.isHome ? 'H' : 'A'}`
      if (seen.has(k)) continue
      seen.add(k)
      unique.push(fx)
      if (unique.length >= limit) break
    }
    out.set(tid, unique)
  }
  return out
}

/**
 * @param {number} elementId
 */
export async function fetchElementSummary(elementId) {
  const id = Number(elementId)
  if (!Number.isFinite(id)) throw new Error('Invalid player id')
  const base = fplApiBase().replace(/\/$/, '')
  const urls = [
    `${draftResourceUrl(`element-summary/${id}`)}`,
    `${base}/element-summary/${id}`,
  ]
  const tried = new Set()
  let lastErr = null
  for (const url of urls) {
    if (tried.has(url)) continue
    tried.add(url)
    try {
      const r = await fetch(url)
      if (r.ok) return r.json()
      lastErr = new Error(`HTTP ${r.status}`)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('Failed to load element-summary')
}

const HISTORY_BATCH = 8
const HISTORY_MAX_IDS = 150

/**
 * @param {number[]} elementIds
 * @param {(id: number, payload: object | null) => void} onResult
 */
export async function fetchElementSummariesBatched(elementIds, onResult) {
  const ids = [...new Set(elementIds.map(Number).filter(Number.isFinite))].slice(
    0,
    HISTORY_MAX_IDS,
  )
  for (let i = 0; i < ids.length; i += HISTORY_BATCH) {
    const chunk = ids.slice(i, i + HISTORY_BATCH)
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const payload = await fetchElementSummary(id)
          onResult(id, payload)
        } catch {
          onResult(id, null)
        }
      }),
    )
  }
}

/**
 * @param {Map<number, Set<number>|null>} squadsMap FPL entry_id → squad element ids
 * @param {{ id?: number|null, teamName?: string|null, fplEntryId?: number|null }[]} teamsForFormSelect
 * @returns {Map<number, { leagueEntryId: number, teamName: string }>}
 */
export function buildOwnerByElementFromFplSquads(squadsMap, teamsForFormSelect) {
  const out = new Map()
  const fplToOwner = new Map()
  for (const t of teamsForFormSelect || []) {
    const fplId = Number(t.fplEntryId)
    const lid = Number(t.id)
    if (!Number.isFinite(fplId) || !Number.isFinite(lid)) continue
    fplToOwner.set(fplId, {
      leagueEntryId: lid,
      teamName: String(t.teamName ?? '').trim() || `Team ${lid}`,
    })
  }
  for (const [fplId, squadSet] of squadsMap || []) {
    if (!squadSet) continue
    const owner = fplToOwner.get(Number(fplId))
    if (!owner) continue
    for (const pid of squadSet) {
      const id = Number(pid)
      if (!Number.isFinite(id) || out.has(id)) continue
      out.set(id, owner)
    }
  }
  return out
}

/**
 * Ownership from ingested `element_status.json` (no live squad API).
 * `owner` on each row is FPL `entry_id`.
 *
 * @param {{ element_status?: { element: number, owner: number | null }[] }} payload
 * @param {{ id?: number|null, teamName?: string|null, fplEntryId?: number|null }[]} teamsForFormSelect
 * @returns {Map<number, { leagueEntryId: number, teamName: string }>}
 */
export function buildOwnerByElementFromElementStatus(payload, teamsForFormSelect) {
  const out = new Map()
  const fplToOwner = new Map()
  for (const t of teamsForFormSelect || []) {
    const fplId = Number(t.fplEntryId)
    const lid = Number(t.id)
    if (!Number.isFinite(fplId) || !Number.isFinite(lid)) continue
    fplToOwner.set(fplId, {
      leagueEntryId: lid,
      teamName: String(t.teamName ?? '').trim() || `Team ${lid}`,
    })
  }
  for (const row of payload?.element_status || []) {
    const pid = Number(row?.element)
    const ownerFpl = Number(row?.owner)
    if (!Number.isFinite(pid) || !Number.isFinite(ownerFpl)) continue
    const owner = fplToOwner.get(ownerFpl)
    if (!owner || out.has(pid)) continue
    out.set(pid, owner)
  }
  return out
}

/** @param {{ element_status?: { element: number, owner: number | null }[] }} payload */
export function ownedElementIdsFromElementStatus(payload) {
  const s = new Set()
  for (const row of payload?.element_status || []) {
    if (row?.owner == null) continue
    const pid = Number(row.element)
    if (Number.isFinite(pid)) s.add(pid)
  }
  return s
}

/**
 * @param {object} wireStatsPayload player-wire-stats.json
 * @returns {Map<number, { defConHits: number, gamesPlayed: number, sixtyPlus: number }>}
 */
export function wireStatsMapFromPayload(wireStatsPayload) {
  const out = new Map()
  const by = wireStatsPayload?.byElement
  if (!by || typeof by !== 'object') return out
  for (const [k, v] of Object.entries(by)) {
    const id = Number(k)
    if (!Number.isFinite(id) || !v) continue
    out.set(id, {
      defConHits: v.defConHits ?? 0,
      gamesPlayed: v.gamesPlayed ?? 0,
      sixtyPlus: v.sixtyPlus ?? 0,
    })
  }
  return out
}
