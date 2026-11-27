/**
 * Shareable hashes for the FPL Live subtabs.
 *
 * Canonical:
 *   #/fpl/tclot
 *   #/fpl/tclot/<gw>/<homeId>-<awayId>
 *   #/fpl/premier-league
 *   #/fpl/premier-league/<gw>/<fixtureKey>
 *
 * Older labels stay valid and rewrite to the canonical path:
 *   #/fpl/scores/…  → TCLOT
 *   #/fpl/lineups/… and #/fpl/squads/… → Premier League
 *
 * `#/players` is a different route and is left untouched.
 */

const PREFIX = '#/fpl/'

const SLUG_TO_TAB = {
  tclot: 'live',
  scores: 'live',
  'premier-league': 'squads',
  lineups: 'squads',
  squads: 'squads',
}

const TAB_TO_SLUG = {
  live: 'tclot',
  squads: 'premier-league',
}

/**
 * @param {string | null | undefined} hash
 * @returns {{
 *   tab: 'live' | 'squads',
 *   gameweek: number | null,
 *   homeId: number | null,
 *   awayId: number | null,
 *   fixtureKey: string | number | null,
 *   alias: boolean,
 * } | null}
 */
export function parseFplLiveHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(PREFIX)) return null
  const body = hash.slice(PREFIX.length).split('?')[0]
  const parts = body.split('/').filter((p) => p.length > 0)
  if (!parts.length) return null
  const tab = SLUG_TO_TAB[parts[0]]
  if (!tab) return null
  const alias = parts[0] !== TAB_TO_SLUG[tab]
  let gameweek = null
  if (parts[1] != null) {
    const gw = Number(parts[1])
    if (!Number.isFinite(gw) || gw < 1 || gw > 38) return null
    gameweek = gw
  }
  let homeId = null
  let awayId = null
  let fixtureKey = null
  if (parts[2] != null) {
    const seg = decodeURIComponent(parts[2])
    if (tab === 'live') {
      const m = /^(\d+)-(\d+)$/.exec(seg)
      if (!m) return null
      homeId = Number(m[1])
      awayId = Number(m[2])
    } else {
      fixtureKey = /^\d+$/.test(seg) ? Number(seg) : seg
    }
  }
  return { tab, gameweek, homeId, awayId, fixtureKey, alias }
}

/**
 * @param {{
 *   tab: 'live' | 'squads',
 *   gameweek?: number | null,
 *   homeId?: number | null,
 *   awayId?: number | null,
 *   fixtureKey?: string | number | null,
 * }} state
 */
export function buildFplLiveHash(state) {
  const tab = state?.tab === 'squads' ? 'squads' : 'live'
  const slug = TAB_TO_SLUG[tab]
  let hash = `${PREFIX}${slug}`
  const gw = Number(state?.gameweek)
  if (!Number.isFinite(gw) || gw < 1 || gw > 38) return hash
  hash += `/${gw}`
  if (tab === 'live') {
    const homeId = Number(state?.homeId)
    const awayId = Number(state?.awayId)
    if (Number.isFinite(homeId) && homeId > 0 && Number.isFinite(awayId) && awayId > 0) {
      hash += `/${homeId}-${awayId}`
    }
  } else if (state?.fixtureKey != null && String(state.fixtureKey) !== '') {
    hash += `/${encodeURIComponent(String(state.fixtureKey))}`
  }
  return hash
}

/**
 * Index of a TCLOT hash pairing inside the current card-fixture list.
 *
 * @param {Array<{ homeId?: number, awayId?: number }>} fixtures
 * @param {number} gameweek
 * @param {string | null | undefined} hash
 * @returns {number | null}
 */
export function fixtureIndexFromFplHash(fixtures, gameweek, hash) {
  const parsed = parseFplLiveHash(hash)
  if (!parsed || parsed.tab !== 'live') return null
  if (parsed.gameweek != null && Number(parsed.gameweek) !== Number(gameweek)) return null
  if (parsed.homeId == null || parsed.awayId == null) return null
  if (!Array.isArray(fixtures)) return null
  const i = fixtures.findIndex(
    (f) => Number(f.homeId) === parsed.homeId && Number(f.awayId) === parsed.awayId,
  )
  return i >= 0 ? i : null
}

function currentUrl(hash) {
  return `${window.location.pathname}${window.location.search}${hash || ''}`
}

/** Rewrite the hash in place. No-op for `#/players` and when already canonical. */
export function replaceFplLiveHash(state) {
  if (typeof window === 'undefined') return
  if (window.location.hash.startsWith('#/players')) return
  const next = buildFplLiveHash(state)
  if (window.location.hash === next) return
  window.history.replaceState(null, '', currentUrl(next))
}

export function clearFplLiveHash() {
  if (typeof window === 'undefined') return
  if (!parseFplLiveHash(window.location.hash)) return
  window.history.replaceState(null, '', currentUrl(''))
}
