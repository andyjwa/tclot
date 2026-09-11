/**
 * Forbidden-waiver helpers — players added to FPL Draft after the league
 * cutoff cannot be claimed until the rule window closes. Used to mark a
 * successful pickup (e.g. Dedic) in red when someone takes one anyway.
 */

/** @param {unknown} payload `forbidden-waivers.json` */
export function forbiddenIdSetFromPayload(payload) {
  const ids = new Set()
  const players = payload?.players
  if (!Array.isArray(players)) return ids
  for (const p of players) {
    const id = Number(p?.id)
    if (Number.isFinite(id)) ids.add(id)
  }
  return ids
}

/** Pickup element id from a waiver move / drops-gw-live / first-pick row. */
export function pickupElementId(move) {
  if (!move || typeof move !== 'object') return null
  const raw = move.element_in ?? move.elementId
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

/**
 * @param {object | null | undefined} move
 * @param {Set<number> | null | undefined} forbiddenIds
 */
export function isForbiddenWaiverPickup(move, forbiddenIds) {
  if (!forbiddenIds || typeof forbiddenIds.has !== 'function') return false
  const id = pickupElementId(move)
  return id != null && forbiddenIds.has(id)
}

/**
 * Pickup ids that appear on successful moves and sit on the forbidden list.
 *
 * @param {object[] | null | undefined} moves
 * @param {Set<number> | null | undefined} forbiddenIds
 * @returns {Set<number>}
 */
export function takenForbiddenIdsFromMoves(moves, forbiddenIds) {
  const out = new Set()
  if (!Array.isArray(moves) || !forbiddenIds || typeof forbiddenIds.has !== 'function') {
    return out
  }
  for (const m of moves) {
    const id = pickupElementId(m)
    if (id != null && forbiddenIds.has(id)) out.add(id)
  }
  return out
}

/**
 * Any successful pickup id from weekly waiver rows (for intersecting with
 * the forbidden list in the rule tile).
 *
 * @param {object[] | null | undefined} moves
 * @returns {Set<number>}
 */
export function pickupIdSetFromMoves(moves) {
  const out = new Set()
  if (!Array.isArray(moves)) return out
  for (const m of moves) {
    const id = pickupElementId(m)
    if (id != null) out.add(id)
  }
  return out
}

/** Gameweek on a drops-gw-live row or a raw draft transaction. */
export function waiverMoveGameweek(move) {
  const g = Number(move?.gameweek ?? move?.event)
  return Number.isFinite(g) && g >= 1 ? g : null
}

/** Highest processed waiver gameweek in the row set, or null. */
export function latestWaiverGameweek(moves) {
  let max = null
  if (!Array.isArray(moves)) return max
  for (const m of moves) {
    const g = waiverMoveGameweek(m)
    if (g != null && (max == null || g > max)) max = g
  }
  return max
}

/**
 * Pickup ids from the latest waiver gameweek only. Earlier claims fall off
 * when the next waiver run lands, so a taken stamp does not stick all season.
 *
 * @param {object[] | null | undefined} moves
 * @returns {Set<number>}
 */
export function pickupIdSetFromLatestWaiver(moves) {
  const gw = latestWaiverGameweek(moves)
  if (gw == null) return new Set()
  return pickupIdSetFromMoves(
    moves.filter((m) => waiverMoveGameweek(m) === gw),
  )
}
