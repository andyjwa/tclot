/**
 * Local push notification preferences (Settings UI + subscription metadata).
 */

export const PUSH_ENABLED_STORAGE_KEY = 'tclot:push:enabled'
export const PUSH_ENTRY_ID_STORAGE_KEY = 'tclot:push:entry-id'
export const PUSH_PREFS_STORAGE_KEY = 'tclot:push:prefs'

/** @typedef {{ deadlineReminders: boolean, waiverResults: boolean, liveXi: boolean }} PushPrefs */

export const DEFAULT_PUSH_PREFS = /** @type {PushPrefs} */ ({
  deadlineReminders: true,
  waiverResults: true,
  liveXi: true,
})

/** @returns {boolean} */
export function readPushEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PUSH_ENABLED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} enabled */
export function writePushEnabled(enabled) {
  if (typeof window === 'undefined') return
  try {
    if (enabled) window.localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, '1')
    else window.localStorage.removeItem(PUSH_ENABLED_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** @returns {number | null} */
export function readPushEntryId() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PUSH_ENTRY_ID_STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** @param {number | null | undefined} entryId */
export function writePushEntryId(entryId) {
  if (typeof window === 'undefined') return
  try {
    if (entryId == null) window.localStorage.removeItem(PUSH_ENTRY_ID_STORAGE_KEY)
    else window.localStorage.setItem(PUSH_ENTRY_ID_STORAGE_KEY, String(entryId))
  } catch {
    /* ignore */
  }
}

/** @returns {PushPrefs} */
export function readPushPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_PUSH_PREFS }
  try {
    const raw = window.localStorage.getItem(PUSH_PREFS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PUSH_PREFS }
    const parsed = JSON.parse(raw)
    return {
      // Accept legacy keys (gwDeadline / liveKickoff) so an early opt-in
      // doesn't lose its preference when the toggle set changed.
      deadlineReminders:
        parsed?.deadlineReminders !== false && parsed?.gwDeadline !== false,
      waiverResults: parsed?.waiverResults !== false,
      liveXi: parsed?.liveXi !== false,
    }
  } catch {
    return { ...DEFAULT_PUSH_PREFS }
  }
}

/** @param {Partial<PushPrefs>} prefs @returns {PushPrefs} */
export function writePushPrefs(prefs) {
  const next = { ...readPushPrefs(), ...prefs }
  if (typeof window === 'undefined') return next
  try {
    window.localStorage.setItem(PUSH_PREFS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** @returns {boolean} */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * @param {string | undefined | null} raw
 * @returns {string}
 */
export function resolvePushApiBase(raw) {
  const trimmed = String(raw ?? '').trim().replace(/\/$/, '')
  if (!trimmed) return ''
  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    if (
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      trimmed.startsWith('http')
    ) {
      return '/__push'
    }
  }
  return trimmed
}

/**
 * @param {string | undefined | null} rawEnv
 * @returns {string}
 */
export function resolveVapidPublicKey(rawEnv) {
  return String(rawEnv ?? '').trim()
}

/** Convert base64url VAPID key to Uint8Array for PushManager.subscribe. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
