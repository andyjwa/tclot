/**
 * Win% for the weekly Preview cards.
 *
 * Live Odds / fixture Odds use `teamProjection(..., 'prematch')` + `h2hWinProbs`
 * on the locked XI and `predictions.json`. Preview used to fall through to the
 * season-strength / bookie board (often 0% draw, and a different favourite
 * than the XI xP on the same card). Upcoming weeks with a locked 11 must use
 * that same forecast so the two surfaces agree.
 *
 * Finished weeks prefer the locked Preview freeze (`preview-odds/gw-NN.json`
 * / published Upcoming board), then the archive `xPtsMc` snapshot.
 */
import { h2hWinProbs } from './forecastHelpers.js'
import { teamProjection } from './liveBlend.js'

/** Same gate as `useModelCalibration`: applied inflation, else 1. */
export function calibrationSigmaScale(calibration) {
  const s = Number(calibration?.sigmaInflation)
  if (calibration?.applied && Number.isFinite(s) && s > 0) return s
  return 1
}

/** Draft element ids from a recap/lineup starter list. */
export function starterElementIds(starters) {
  if (!Array.isArray(starters)) return []
  const ids = []
  for (const row of starters) {
    const id = Number(row?.id ?? row?.element ?? row?.elementId)
    if (Number.isFinite(id) && id > 0) ids.push(id)
  }
  return ids
}

/**
 * Pre-match H2H win bar from locked XI ids + the player forecast.
 * Same path as Live Odds (`teamProjection` prematch → `h2hWinProbs`).
 *
 * @returns {{ hw: number, dw: number, aw: number, source: 'engine', homeMu: number, awayMu: number } | null}
 */
export function xiPredictionOdds(predById, homeIds, awayIds, sigmaScale = 1) {
  const homeRows = (homeIds ?? []).map((id) => ({ element: Number(id) }))
  const awayRows = (awayIds ?? []).map((id) => ({ element: Number(id) }))
  if (!homeRows.length || !awayRows.length || !predById?.size) return null
  const home = teamProjection(homeRows, predById, 'prematch')
  const away = teamProjection(awayRows, predById, 'prematch')
  if (home.matched < 1 || away.matched < 1) return null
  const probs = h2hWinProbs(home, away, 0.5, sigmaScale)
  return {
    hw: probs.homeWinPct,
    dw: probs.drawPct,
    aw: probs.awayWinPct,
    source: 'engine',
    homeMu: home.mu,
    awayMu: away.mu,
  }
}

/**
 * Pick Preview odds: locked Preview freeze, then archive, then Live-Odds XI
 * forecast, then bookie, then season strength.
 *
 * @param {{
 *   previewFreeze?: { hw?: number, dw?: number, aw?: number, homeMu?: number, awayMu?: number } | null,
 *   archiveMc?: { homeWinPct?: number, drawPct?: number, awayWinPct?: number } | null,
 *   archiveHomeIsMatchHome?: boolean,
 *   xiOdds?: { hw: number, dw: number, aw: number, source?: string, homeMu?: number, awayMu?: number } | null,
 *   bookieProbs?: { home?: number, draw?: number, away?: number } | null,
 *   strength?: { homePct?: number, awayPct?: number, source?: string } | null,
 * }} p
 */
export function resolvePreviewOdds({
  previewFreeze = null,
  archiveMc = null,
  archiveHomeIsMatchHome = true,
  xiOdds = null,
  bookieProbs = null,
  strength = null,
} = {}) {
  const fh = Number(previewFreeze?.hw)
  const fa = Number(previewFreeze?.aw)
  if (Number.isFinite(fh) && Number.isFinite(fa)) {
    const dw = Number.isFinite(Number(previewFreeze?.dw)) ? Number(previewFreeze.dw) : 0
    return {
      hw: fh,
      dw,
      aw: fa,
      source: 'preview',
      frozen: true,
      homeMu: previewFreeze?.homeMu,
      awayMu: previewFreeze?.awayMu,
    }
  }
  const mcHw = Number(archiveMc?.homeWinPct)
  const mcAw = Number(archiveMc?.awayWinPct)
  if (Number.isFinite(mcHw) && Number.isFinite(mcAw)) {
    const dw = Number.isFinite(Number(archiveMc?.drawPct)) ? Number(archiveMc.drawPct) : 0
    return archiveHomeIsMatchHome
      ? { hw: mcHw, dw, aw: mcAw, source: 'engine', arch: true }
      : { hw: mcAw, dw, aw: mcHw, source: 'engine', arch: true }
  }
  if (xiOdds && Number.isFinite(Number(xiOdds.hw)) && Number.isFinite(Number(xiOdds.aw))) {
    return { ...xiOdds, source: 'engine', arch: false }
  }
  const bh = Number(bookieProbs?.home)
  const ba = Number(bookieProbs?.away)
  if (Number.isFinite(bh) && Number.isFinite(ba)) {
    return {
      hw: +(bh * 100).toFixed(10),
      dw: +(Number(bookieProbs?.draw) * 100).toFixed(10),
      aw: +(ba * 100).toFixed(10),
      source: 'strength',
      arch: false,
    }
  }
  const sh = Number(strength?.homePct)
  const sa = Number(strength?.awayPct)
  if (Number.isFinite(sh) && Number.isFinite(sa)) {
    return { hw: sh, dw: 0, aw: sa, source: strength?.source ?? 'strength', arch: false }
  }
  return null
}
