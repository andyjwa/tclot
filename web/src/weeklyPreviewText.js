/**
 * Preview helpers (odds, watch list, form) plus the per-matchup blurb.
 * Fixture copy comes from the shared engine in `blurbEngine.js`.
 */

import { canonicalManager } from './leagueLore.js'
import { generateMatchupBlurb } from './blurbEngine.js'
import { probToFractionalOdds } from './oddsFormat.js'

/** Nick Mottershead (vegan jokes are one of several Mottershead lines). */
export function isVeganManager(manager) {
  return canonicalManager(manager) === 'nick mottershead'
}

/**
 * Round a 3-way probability triple to integer percents that sum to 100.
 * @param {{ home?: number, draw?: number, away?: number }} probs
 *   Fractions (0–1) or already-percent (0–100); auto-detected.
 * @returns {{ home: number, draw: number, away: number }}
 */
export function oddsPercents(probs) {
  const h = Number(probs?.home)
  const d = Number(probs?.draw)
  const a = Number(probs?.away)
  const raw = [h, d, a].map((n) => (Number.isFinite(n) ? n : 0))
  const sum = raw[0] + raw[1] + raw[2]
  if (!(sum > 0)) return { home: 50, draw: 0, away: 50 }
  const normalised = raw.map((n) => (n * 100) / sum)
  const floored = normalised.map((n) => Math.floor(n))
  let leftover = 100 - floored.reduce((s, n) => s + n, 0)
  const order = normalised
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (leftover <= 0) break
    floored[i] += 1
    leftover -= 1
  }
  return { home: floored[0], draw: floored[1], away: floored[2] }
}

/**
 * Top-N watch-list players from an archived XI (sorted by pre-match xP).
 * @param {Array<{ id?: number, name?: string, pos?: string, xp?: number }>|null} xi
 * @param {number} [n]
 */
export function watchPlayersFromXi(xi, n = 2) {
  if (!Array.isArray(xi) || xi.length === 0) return []
  return [...xi]
    .filter((p) => p && p.name && Number.isFinite(Number(p.xp)))
    .sort((a, b) => Number(b.xp) - Number(a.xp))
    .slice(0, n)
    .map((p) => ({
      id: p.id ?? null,
      name: p.name,
      pos: p.pos ?? '',
      xp: +Number(p.xp).toFixed(1),
    }))
}

/**
 * Top-N watch-list players from current-squad forecasts
 * (`predictions.json` totalPoints).
 * @param {Array<{ id?: number, name?: string, pos?: string, xp?: number }>|null} players
 * @param {number} [n]
 */
export function watchPlayersFromForecasts(players, n = 2) {
  return watchPlayersFromXi(players, n)
}

/**
 * Last-week over/under from an archived XI (pts vs pre-match xP).
 * Over: beat xP by 4+ or scored 10+. Under: xP >= 4 and missed by 3+ (or blanked).
 * @param {Array<{ name?: string, pts?: number, xp?: number }>|null} xi
 * @returns {{ over: { name: string, pts: number, xp: number } | null, under: { name: string, pts: number, xp: number } | null } | null}
 */
export function formFromXi(xi) {
  if (!Array.isArray(xi) || xi.length === 0) return null
  let over = null
  let under = null
  for (const p of xi) {
    if (!p?.name) continue
    const pts = Number(p.pts)
    const xp = Number(p.xp)
    if (!Number.isFinite(pts) || !Number.isFinite(xp)) continue
    const delta = pts - xp
    if (delta >= 4 || pts >= 10) {
      if (!over || delta > over.delta) {
        over = { name: p.name, pts, xp: +xp.toFixed(1), delta }
      }
    }
    if (xp >= 4 && (delta <= -3 || pts <= 2)) {
      if (!under || delta < under.delta) {
        under = { name: p.name, pts, xp: +xp.toFixed(1), delta }
      }
    }
  }
  if (!over && !under) return null
  const strip = (row) => (row ? { name: row.name, pts: row.pts, xp: row.xp } : null)
  return { over: strip(over), under: strip(under) }
}

/**
 * Fractional triple for the precall strip. Prefers the bookie sheet; falls
 * back to the model percents snapped onto the same ladder.
 * @param {{ bookie?: { home?: string, draw?: string, away?: string }, odds?: { home?: number, draw?: number, away?: number } }} m
 * @returns {{ home: string, draw: string, away: string } | null}
 */
export function bookiePrecall(m) {
  const h = m?.bookie?.home || probToFractionalOdds(m?.odds?.home)
  const d = m?.bookie?.draw || probToFractionalOdds(m?.odds?.draw)
  const a = m?.bookie?.away || probToFractionalOdds(m?.odds?.away)
  if (!h && !a) return null
  return { home: h || '–', draw: d || '–', away: a || '–' }
}

/**
 * Preview blurb for one matchup: one forward-looking claim (odds / projection
 * / waiver / derby), Motty vegan line when he appears. Max two sentences.
 *
 * @param {{
 *   gw: number,
 *   home: object, away: object,
 *   odds: { favoriteSide: 'home'|'away', favoritePct: number, home?: number, draw?: number, away?: number } | null,
 *   bookie?: { home?: string, draw?: string, away?: string } | null,
 *   predicted?: { home: number, away: number } | null,
 *   h2h?: { games, homeWins, awayWins, draws } | null,
 * }} m
 * @param {{ state?: object, gwContext?: object }} [opts]
 */
export function matchupPreviewSentences(m, opts = {}) {
  return generateMatchupBlurb(m, { surface: 'preview', ...opts }).sentences
}
