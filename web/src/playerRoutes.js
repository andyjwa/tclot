/** Deep links for Players workbench (`#/players`). */

const PREFIX = '#/players'

/**
 * @returns {{
 *   waiver: number | null,
 *   bench: number | null,
 *   teamId: number | null,
 *   plClubId: number | null,
 * } | null}
 */
export function parsePlayersHash() {
  if (typeof window === 'undefined') return null
  const h = window.location.hash
  if (!h.startsWith(PREFIX)) return null
  const qIdx = h.indexOf('?')
  const qs = qIdx >= 0 ? h.slice(qIdx + 1) : ''
  const params = new URLSearchParams(qs)
  const w = Number(params.get('w'))
  const b = Number(params.get('b'))
  const t = Number(params.get('t'))
  const c = Number(params.get('c'))
  return {
    waiver: Number.isFinite(w) ? w : null,
    bench: Number.isFinite(b) ? b : null,
    teamId: Number.isFinite(t) ? t : null,
    plClubId: Number.isFinite(c) ? c : null,
  }
}

function buildPlayersHash(slice) {
  const p = new URLSearchParams()
  if (slice.waiver != null && Number.isFinite(slice.waiver)) p.set('w', String(slice.waiver))
  if (slice.bench != null && Number.isFinite(slice.bench)) p.set('b', String(slice.bench))
  if (slice.teamId != null && Number.isFinite(slice.teamId)) p.set('t', String(slice.teamId))
  if (slice.plClubId != null && Number.isFinite(slice.plClubId)) p.set('c', String(slice.plClubId))
  return `${PREFIX}${p.toString() ? `?${p.toString()}` : ''}`
}

/**
 * Updates `location.hash` without adding history entries — shareable waiver vs roster view.
 * @param {{
 *   waiver?: number | null,
 *   bench?: number | null,
 *   teamId?: number | null,
 *   plClubId?: number | null,
 * }} slice
 */
export function replacePlayersHash(slice) {
  if (typeof window === 'undefined') return
  const next = buildPlayersHash(slice)
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}

/**
 * Push a new history entry when opening player detail (browser back returns to list).
 * @param {{
 *   waiver?: number | null,
 *   bench?: number | null,
 *   teamId?: number | null,
 *   plClubId?: number | null,
 * }} slice
 */
/** @returns {boolean} whether a new history entry was pushed */
export function pushPlayersHash(slice) {
  if (typeof window === 'undefined') return false
  const next = buildPlayersHash(slice)
  if (window.location.hash !== next) {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${next}`)
    return true
  }
  return false
}

export function stripPlayersHash() {
  if (typeof window === 'undefined') return
  if (!window.location.hash.startsWith(PREFIX)) return
  const blank = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, '', blank)
}
