const PREFIX = 'tcLot-player-contrib:v1:';

/** @param {number | null | undefined} leagueId */
export function playerContributionStorageKey(leagueId, gameweek) {
  const lid =
    leagueId != null && Number.isFinite(Number(leagueId))
      ? Number(leagueId)
      : 'unknown';
  const gw =
    gameweek != null && Number.isFinite(Number(gameweek))
      ? Number(gameweek)
      : 'unknown';
  return `${PREFIX}${lid}:gw:${gw}`;
}

/**
 * @param {string} key
 * @returns {{ events: object[] } | null}
 */
export function readPlayerContributionBucket(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.events)) return null;
    return { events: j.events };
  } catch {
    return null;
  }
}

/**
 * Merge new events, cap length, persist.
 * @param {string} key
 * @param {object[]} existing
 * @param {object[]} incoming — must have `stableId`
 * @param {number} [cap]
 */
export function mergePersistPlayerContributions(
  key,
  existing,
  incoming,
  cap = 2000
) {
  if (typeof window === 'undefined') return existing;
  const seen = new Set((existing || []).map((e) => e.stableId).filter(Boolean));
  const merged = [...(existing || [])];
  for (const ev of incoming || []) {
    if (!ev?.stableId || seen.has(ev.stableId)) continue;
    seen.add(ev.stableId);
    merged.push(ev);
  }
  const trimmed =
    merged.length > cap ? merged.slice(merged.length - cap) : merged;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        generated: new Date().toISOString(),
        events: trimmed,
      })
    );
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

/**
 * Replace the stored list. Used to drop rows that the current gameweek's live
 * stats no longer support (a previous GW's card stamped onto this one).
 * @param {string} key
 * @param {object[]} events
 */
export function replacePlayerContributionEvents(key, events) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        generated: new Date().toISOString(),
        events: Array.isArray(events) ? events : [],
      })
    );
  } catch {
    /* quota / private mode */
  }
}
