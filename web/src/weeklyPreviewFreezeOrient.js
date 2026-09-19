/**
 * Browser-safe Preview freeze helpers. Keep Node `fs` out of this file —
 * `weeklyPreviewFreeze.js` writes freeze files and must not be imported
 * from client components.
 */

export function orientFreezeRow(row, homeId, awayId) {
  if (!row) return null
  const h = Number(homeId)
  const a = Number(awayId)
  const rh = Number(row.home)
  const ra = Number(row.away)
  if (rh === h && ra === a) {
    return {
      home: h,
      away: a,
      homeWinPct: Number(row.homeWinPct),
      drawPct: Number(row.drawPct) || 0,
      awayWinPct: Number(row.awayWinPct),
      predHome: row.predHome,
      predAway: row.predAway,
    }
  }
  if (rh === a && ra === h) {
    return {
      home: h,
      away: a,
      homeWinPct: Number(row.awayWinPct),
      drawPct: Number(row.drawPct) || 0,
      awayWinPct: Number(row.homeWinPct),
      predHome: row.predAway,
      predAway: row.predHome,
    }
  }
  return null
}

export function favoriteFromOriented(row, homeId, awayId) {
  const hw = Number(row?.homeWinPct)
  const aw = Number(row?.awayWinPct)
  if (!Number.isFinite(hw) || !Number.isFinite(aw)) {
    return {
      favorite: null,
      source: 'preview',
      homePct: null,
      awayPct: null,
      predHome: null,
      predAway: null,
    }
  }
  let favorite = null
  if (hw > aw) favorite = Number(homeId)
  else if (aw > hw) favorite = Number(awayId)
  const predHome = Number(row.predHome)
  const predAway = Number(row.predAway)
  return {
    favorite,
    source: 'preview',
    homePct: hw,
    awayPct: aw,
    predHome: Number.isFinite(predHome) ? predHome : null,
    predAway: Number.isFinite(predAway) ? predAway : null,
  }
}
