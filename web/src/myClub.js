/**
 * The club this phone belongs to. One choice, shared with push
 * notifications so Settings does not ask twice. Unset means the site
 * looks the same for every manager.
 */

export const MY_CLUB_STORAGE_KEY = 'tclot:my-club'
export const MY_CLUB_EVENT = 'tclot:my-club'
const PUSH_ENTRY_KEY = 'tclot:push:entry-id'

function readId(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** @returns {number | null} */
export function readMyClubId() {
  if (typeof window === 'undefined') return null
  try {
    const own = readId(window.localStorage.getItem(MY_CLUB_STORAGE_KEY))
    if (own != null) return own
    const fromPush = readId(window.localStorage.getItem(PUSH_ENTRY_KEY))
    if (fromPush != null) {
      window.localStorage.setItem(MY_CLUB_STORAGE_KEY, String(fromPush))
      return fromPush
    }
    return null
  } catch {
    return null
  }
}

/** @param {number | string | null | undefined} entryId @param {number | string | null | undefined} myClubId */
export function isMyClub(entryId, myClubId) {
  if (myClubId == null || entryId == null || entryId === '') return false
  return Number(entryId) === Number(myClubId)
}

/** @param {number | string | null | undefined} entryId */
export function writeMyClubId(entryId) {
  if (typeof window === 'undefined') return
  try {
    const n = entryId == null || entryId === '' ? null : readId(entryId)
    if (n == null) {
      window.localStorage.removeItem(MY_CLUB_STORAGE_KEY)
      window.localStorage.removeItem(PUSH_ENTRY_KEY)
    } else {
      const v = String(n)
      window.localStorage.setItem(MY_CLUB_STORAGE_KEY, v)
      window.localStorage.setItem(PUSH_ENTRY_KEY, v)
    }
    window.dispatchEvent(new Event(MY_CLUB_EVENT))
  } catch {
    /* ignore */
  }
}
