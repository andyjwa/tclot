/** America/New_York wall-clock conversions (DST-safe for common cases). */

const EASTERN_TZ = 'America/New_York'

/**
 * @param {Date | number} inst
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number }}
 */
function easternWallClockParts(inst) {
  const d = inst instanceof Date ? inst : new Date(inst)
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    hourCycle: 'h23',
  })
  const o = {}
  for (const p of f.formatToParts(d)) {
    if (p.type === 'literal') continue
    o[p.type] = Number(p.value)
  }
  return {
    year: o.year,
    month: o.month,
    day: o.day,
    hour: o.hour,
    minute: o.minute,
  }
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** Days in month for Gregorian `month` 1–12. */
function daysInMonth(year, month) {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return dim[month - 1] ?? 31
}

/**
 * Next calendar date after `{year, month, day}` (plain Gregorian; same interpretation as Eastern date parts).
 * @returns {{ year: number, month: number, day: number }}
 */
function gregorianNextCalendarDay(year, month, day) {
  const max = daysInMonth(year, month)
  if (day < max) return { year, month, day: day + 1 }
  if (month < 12) return { year, month: month + 1, day: 1 }
  return { year: year + 1, month: 1, day: 1 }
}

/**
 * Instant when clocks in Eastern show `hour:minute` on the given **calendar** `{year, month, day}`
 * @returns {Date}
 */
export function utcInstantMatchingEasternWallClock(year, month, day, hour, minute) {
  const probeLo = Date.UTC(year, month - 1, day - 1, 16, minute, 0)
  const probeHi = Date.UTC(year, month - 1, day + 2, 7, minute, 0)

  /** @returns {boolean} */
  function matches(inst) {
    const p = easternWallClockParts(inst)
    return (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    )
  }

  for (let ms = probeLo; ms <= probeHi; ms += 60 * 1000) {
    if (matches(ms)) return new Date(ms)
  }

  console.warn(
    `[easternWallClockInstant] Missing minute for Eastern ${year}-${month}-${day} ${hour}:${minute}`,
  )
  return new Date(probeHi)
}

/**
 * End of Triple Threat banner: **11:15** Eastern on the calendar day **after today’s Eastern date**.
 * Visible while `now < end`.
 * @param {Date | number} [now]
 * @returns {Date}
 */
export function tripleThreatPromoEndExclusive(now = new Date()) {
  const t = now instanceof Date ? now : new Date(now)
  const { year, month, day } = easternWallClockParts(t)
  const next = gregorianNextCalendarDay(year, month, day)
  return utcInstantMatchingEasternWallClock(next.year, next.month, next.day, 11, 15)
}

/** @param {Date | number} [now] */
export function tripleThreatPromoIsActive(now = new Date()) {
  const t = now instanceof Date ? now : new Date(now)
  return t.getTime() < tripleThreatPromoEndExclusive(t).getTime()
}
