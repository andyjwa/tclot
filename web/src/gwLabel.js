/**
 * Display string for a gameweek number (e.g. select options).
 * @param {number | string} n
 * @returns {string}
 */
export function gameWeekSelectLabel(n) {
  const g = Number(n)
  if (!Number.isFinite(g)) return 'Game Week'
  return `Game Week ${g}`
}

/**
 * Compact gameweek label for tight, space-constrained triggers (e.g. mobile
 * pills). Renders "GW38" with no separator.
 * @param {number | string} n
 * @returns {string}
 */
export function gameWeekShortLabel(n) {
  const g = Number(n)
  if (!Number.isFinite(g)) return 'GW'
  return `GW${g}`
}

/**
 * FPL bootstrap often uses a single word ("Gameweek 33"). Normalize to "Game Week 33".
 * @param {string | null | undefined} name
 * @param {number | string} id
 * @returns {string}
 */
export function eventNameToGameWeekLabel(name, id) {
  if (typeof name === 'string' && name.trim()) {
    return name.replace(/\bGameweek\b/gi, 'Game Week')
  }
  return gameWeekSelectLabel(id)
}

/**
 * Split live GW options into { past, current, upcoming } for native `<optgroup>` sections.
 * Uses FPL `finished` (all PL fixtures in that week done) and `is_current` (bootstrap’s live GW).
 *
 * @param {Array<{ id: number, label: string, finished?: boolean, is_current?: boolean }>} options
 * @returns {{ past: typeof options, current: typeof options, upcoming: typeof options }}
 */
export function groupGameWeekOptionsForSelect(options) {
  const past = []
  const current = []
  const upcoming = []
  for (const o of options) {
    if (o.finished) {
      past.push(o)
    } else if (o.is_current) {
      current.push(o)
    } else {
      upcoming.push(o)
    }
  }
  const byId = (a, b) => Number(a.id) - Number(b.id)
  past.sort(byId)
  current.sort(byId)
  upcoming.sort(byId)
  return { past, current, upcoming }
}
