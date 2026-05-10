/**
 * Replay draft + league transactions to determine which fantasy roster held a player each GW.
 * Uses FPL draft `entry` (fpl entry_id) from transactions, then maps to `league_entries[].id` for UI.
 */

function sortAcceptedTransactions(transactions) {
  if (!Array.isArray(transactions)) return [];
  return transactions
    .filter((t) => t && t.result === 'a')
    .map((t) => ({
      event: Number(t.event),
      entry: Number(t.entry),
      element_in: t.element_in != null && t.element_in !== '' ? Number(t.element_in) : null,
      element_out: t.element_out != null && t.element_out !== '' ? Number(t.element_out) : null,
      added: t.added != null ? String(t.added) : '',
      id: t.id != null ? Number(t.id) : 0,
    }))
    .filter((t) => Number.isFinite(t.event) && t.event >= 1 && Number.isFinite(t.entry))
    .sort((a, b) => {
      if (a.event !== b.event) return a.event - b.event;
      const c = a.added.localeCompare(b.added);
      if (c !== 0) return c;
      return a.id - b.id;
    });
}

function fplEntryToLeagueEntryId(details) {
  /** @type {Map<number, number>} */
  const m = new Map();
  for (const e of details?.league_entries ?? []) {
    if (e?.entry_id != null && e?.id != null) {
      m.set(Number(e.entry_id), Number(e.id));
    }
  }
  return m;
}

/**
 * @param {object} opts
 * @param {number} opts.elementId
 * @param {object | null} [opts.draftPicks]
 * @param {object | null} [opts.transactions]
 * @param {object | null} [opts.details]
 * @param {number} [opts.maxGw=38]
 * @returns {Map<number, number | null>} gameweek → league_entry id (TeamAvatar entryId), null = waiver / unrostered
 */
export function buildElementOwnerLeagueEntryByGw({
  elementId,
  draftPicks,
  transactions,
  details,
  maxGw = 38,
}) {
  const el = Number(elementId);
  if (!Number.isFinite(el)) return new Map();

  const fplToLeague = fplEntryToLeagueEntryId(details);

  /** @type {Map<number, number>} element → fpl entry_id */
  const ownerByElement = new Map();
  for (const p of draftPicks?.picks ?? []) {
    if (p?.element == null || p?.entryId == null) continue;
    const pid = Number(p.element);
    const fid = Number(p.entryId);
    if (Number.isFinite(pid) && Number.isFinite(fid)) ownerByElement.set(pid, fid);
  }

  const txs = sortAcceptedTransactions(transactions?.transactions);
  /** @type {Map<number, Array<typeof txs[0]>>} */
  const byEvent = new Map();
  for (const t of txs) {
    if (!byEvent.has(t.event)) byEvent.set(t.event, []);
    byEvent.get(t.event).push(t);
  }

  /** @type {Map<number, number | null>} */
  const out = new Map();
  const capGw = Number.isFinite(Number(maxGw)) ? Math.min(38, Math.max(1, Number(maxGw))) : 38;

  for (let gw = 1; gw <= capGw; gw++) {
    const batch = byEvent.get(gw);
    if (batch) {
      for (const t of batch) {
        if (t.element_out != null && Number.isFinite(t.element_out)) {
          ownerByElement.delete(t.element_out);
        }
        if (t.element_in != null && Number.isFinite(t.element_in)) {
          ownerByElement.set(t.element_in, t.entry);
        }
      }
    }
    const fpl = ownerByElement.get(el);
    const leagueId =
      fpl != null
        ? (fplToLeague.get(fpl) ?? (Number.isFinite(fpl) ? fpl : null))
        : null;
    out.set(gw, leagueId);
  }

  return out;
}
