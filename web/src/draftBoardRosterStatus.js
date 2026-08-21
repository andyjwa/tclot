/**
 * Current squad + first gameweek a drafted player left a manager (waiver/free agent or trade).
 */

/**
 * Whether the new season has actually kicked off. FPL's draft bootstrap keeps
 * every player's LAST-season `total_points` until current-season data starts
 * flowing, so pre-GW1 those totals must not be shown as this season's points.
 *
 * @param {object} boot draft `bootstrap-static` JSON
 */
export function draftSeasonStarted(boot) {
  const ev = boot?.events
  if (ev == null) return false
  if (typeof ev.current === 'number' && ev.current >= 1) return true
  const data = ev.data
  if (!Array.isArray(data)) return false
  return data.some((x) => x?.is_current === true || x?.finished === true)
}

/** @param {object} boot draft `bootstrap-static` JSON */
export function draftCurrentGameweek(boot) {
  const ev = boot?.events
  if (ev == null) return 1
  if (typeof ev.current === 'number' && ev.current >= 1) return ev.current
  const data = ev.data
  if (Array.isArray(data) && data.length) {
    const cur = data.find((x) => x.is_current === true)
    if (cur?.id >= 1) return cur.id
    const finished = data.filter((x) => x.finished)
    if (finished.length) return finished[finished.length - 1].id
    return data[0].id
  }
  return 1
}

/**
 * @returns {Map<string, { gw: number, kind: 'trade' | 'transfer' }>} key `${fplEntryId}:${elementId}`
 */
export function buildFirstLeftGameweekMap(transactionsPayload, tradesPayload) {
  const m = new Map()

  function consider(key, gw, kind) {
    if (key == null || gw == null || !Number.isFinite(gw)) return
    const prev = m.get(key)
    if (prev == null || gw < prev.gw) m.set(key, { gw, kind })
  }

  for (const t of transactionsPayload?.transactions || []) {
    if ((t.kind !== 'w' && t.kind !== 'f') || t.result !== 'a') continue
    const out = t.element_out
    const ent = t.entry
    const ev = t.event
    if (out == null || ent == null || ev == null) continue
    consider(`${ent}:${out}`, ev, 'transfer')
  }

  for (const tr of tradesPayload?.trades || []) {
    if (tr.state !== 'p') continue
    const ev = tr.event
    const off = tr.offered_entry
    const rec = tr.received_entry
    if (ev == null) continue
    for (const row of tr.tradeitem_set || []) {
      if (row?.element_out != null && off != null) consider(`${off}:${row.element_out}`, ev, 'trade')
      if (row?.element_in != null && rec != null) consider(`${rec}:${row.element_in}`, ev, 'trade')
    }
  }

  return m
}

/**
 * @param {object[]} picks draft picks with entryId, element
 * @param {Map<number, Set<number>|null|undefined>} squadElementsByFplEntryId
 * @param {Map<string, { gw: number, kind: string }>} firstLeftMap
 */
export function mergeRosterStatusIntoPicks(picks, squadElementsByFplEntryId, firstLeftMap) {
  return picks.map((p) => {
    const set = squadElementsByFplEntryId.get(p.entryId)
    const onSquad = set ? set.has(p.element) : null
    const left = firstLeftMap.get(`${p.entryId}:${p.element}`)
    return {
      ...p,
      rosterOnSquad: onSquad,
      rosterLeftGameweek: left?.gw ?? null,
      rosterLeftKind: left?.kind ?? null,
    }
  })
}
