/**
 * Client for the bookie Worker (web/workers/bookie/) — fake-money betting.
 *
 * The Worker URL comes from `VITE_BOOKIE_API_URL` (same deploy-time pattern
 * as `VITE_FPL_PROXY_URL`); when unset the Bookie tab renders its setup note
 * instead of a dead board. The session token is a Worker-signed bearer token
 * kept in localStorage — losing it just means logging in with the PIN again.
 */

const SESSION_STORAGE_KEY = 'tclotBookieSession.v1'

/** Production Worker. Used when a deploy forgot VITE_BOOKIE_API_URL (the new
 * Vercel project did). Local `vite` still requires the var so dev doesn't
 * write to the live book. */
const DEFAULT_BOOKIE_API = 'https://tclot-bookie.tclot.workers.dev'

export function bookieApiBase() {
  const raw = import.meta.env.VITE_BOOKIE_API_URL
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
  if (trimmed) return trimmed
  if (import.meta.env.DEV) return null
  return DEFAULT_BOOKIE_API
}

export function bookieEnabled() {
  return bookieApiBase() != null
}

/** @returns {{ token: string, entryId: number, name: string } | null} */
export function loadBookieSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.token !== 'string' || !Number.isFinite(Number(parsed?.entryId))) {
      return null
    }
    return { token: parsed.token, entryId: Number(parsed.entryId), name: String(parsed.name ?? '') }
  } catch {
    return null
  }
}

export function saveBookieSession(session) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* private mode — session just won't survive a reload */
  }
}

export function clearBookieSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', token = null, body = null } = {}) {
  const base = bookieApiBase()
  if (!base) throw new Error('bookie API not configured')
  const headers = {}
  if (body != null) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `bookie API ${res.status}`)
    err.status = res.status
    // e.g. a moved cash-out offer rides along on the 409 body
    err.data = data
    throw err
  }
  return data
}

export function fetchBookieState(token) {
  return request('/api/state', { token })
}

export function registerBookie(entryId, pin) {
  return request('/api/register', { method: 'POST', body: { entryId, pin } })
}

export function loginBookie(entryId, pin) {
  return request('/api/login', { method: 'POST', body: { entryId, pin } })
}

export function placeBookieBet(token, { marketId, selection, stake }) {
  return request('/api/bets', { method: 'POST', token, body: { marketId, selection, stake } })
}

/** Current cash-out offers for my open bets: { margin, quotes: [{betId, value}] }. */
export function fetchCashoutQuotes(token) {
  return request('/api/cashout', { token })
}

/** Take the money. `quote` is the offer the punter saw — the Worker refuses
 * to pay less than it without re-quoting (409 with the new value). */
export function cashoutBookieBet(token, { betId, quote }) {
  return request('/api/cashout', { method: 'POST', token, body: { betId, quote } })
}

/** Offer a peer side bet. Holds the proposer's stake until accept, decline, or cancel. */
export function offerSideBet(token, { opponentId, stake, sentence }) {
  return request('/api/side-bets', {
    method: 'POST',
    token,
    body: { opponentId, stake, sentence },
  })
}

/** accept | decline | cancel | propose | confirm | reject */
export function actOnSideBet(token, id, action, body = null) {
  return request(`/api/side-bets/${id}/${action}`, { method: 'POST', token, body })
}
