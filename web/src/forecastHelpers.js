/**
 * Pure helpers for the Forecast view (consumes scripts/build-predictions.mjs output).
 * Kept separate from the React component so the filtering/sorting/aggregation logic is unit-tested.
 */

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const POSITION_RANK = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/** Map predictions.players → Map(id → player) for O(1) joins (e.g. matchup lineups). */
export function predictionsById(predictions) {
  const m = new Map();
  for (const p of predictions?.players ?? []) m.set(Number(p.id), p);
  return m;
}

function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filter + sort the player list.
 * @param {object[]} players predictions.players
 * @param {{ position?: string|null, team?: string|null, query?: string,
 *           sortKey?: string, sortDir?: 'asc'|'desc' }} opts
 */
export function filterAndSortPlayers(players = [], opts = {}) {
  const { position = null, team = null, query = '', sortKey = 'totalPoints', sortDir = 'desc' } = opts;
  const q = normalise(query).trim();

  let rows = players.filter((p) => {
    if (position && p.position !== position) return false;
    if (team && p.team !== team) return false;
    if (q) {
      const hay = `${normalise(p.name)} ${normalise(p.fullName)} ${normalise(p.team)} ${normalise(p.teamShortName)}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const getVal = (p) => {
    switch (sortKey) {
      case 'name':
        return normalise(p.name);
      case 'team':
        return normalise(p.team);
      case 'position':
        return POSITION_RANK[p.position] ?? 99;
      case 'price':
        return p.price ?? -1;
      case 'ownership':
        return p.ownership ?? -1;
      case 'mins':
        return p.forecast?.probabilities?.projectedMins ?? -1;
      case 'goal':
        return p.forecast?.probabilities?.goalLikelihood ?? -1;
      case 'assist':
        return p.forecast?.probabilities?.assistLikelihood ?? -1;
      case 'cleanSheet':
        return p.forecast?.probabilities?.cleanSheetPct ?? -1;
      case 'ceiling':
        return p.forecast?.percentiles?.p90 ?? -1;
      case 'floor':
        return p.forecast?.percentiles?.p10 ?? -1;
      case 'haul':
        return p.forecast?.outcomes?.haul ?? -1;
      case 'blank':
        return p.forecast?.outcomes?.blank ?? -1;
      case 'totalPoints':
      default:
        return p.forecast?.totalPoints ?? -1;
    }
  };

  const dir = sortDir === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      return dir * String(va).localeCompare(String(vb));
    }
    if (va === vb) {
      // Stable tiebreak: higher xP, then name.
      const ta = a.forecast?.totalPoints ?? 0;
      const tb = b.forecast?.totalPoints ?? 0;
      if (ta !== tb) return tb - ta;
      return normalise(a.name).localeCompare(normalise(b.name));
    }
    return dir * (va - vb);
  });
  return rows;
}

/** Distinct team names present in the forecast, alphabetically. */
export function teamsInPredictions(predictions) {
  const set = new Set();
  for (const p of predictions?.players ?? []) {
    if (p.team) set.add(p.team);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Breakdown segments for a stacked bar / list. Positive contributions in scoring order, then any
 * negative (cards/own goals/penalty miss) flagged. Filters out ~zero segments for a clean UI.
 */
export function breakdownSegments(forecast) {
  const b = forecast?.breakdown ?? {};
  const defs = [
    ['minutes', 'Mins'],
    ['goals', 'Goals'],
    ['assists', 'Assists'],
    ['cleanSheet', 'Clean sheet'],
    ['saves', 'Saves'],
    ['defensiveContribution', 'Def. con'],
    ['bonus', 'Bonus'],
    ['cards', 'Cards'],
    ['ownGoals', 'Own goals'],
    ['penaltyMiss', 'Pen miss'],
  ];
  const out = [];
  for (const [key, label] of defs) {
    const value = Number(b[key]);
    if (!Number.isFinite(value) || Math.abs(value) < 0.05) continue;
    out.push({ key, label, value, negative: value < 0 });
  }
  return out;
}

/** Sum forecast totalPoints over a set of element ids (for H2H matchup previews). */
export function sumTeamForecastXp(byId, elementIds = []) {
  let sum = 0;
  let matched = 0;
  let missing = 0;
  for (const id of elementIds) {
    const p = byId.get(Number(id));
    const xp = p?.forecast?.totalPoints;
    if (Number.isFinite(xp)) {
      sum += xp;
      matched += 1;
    } else {
      missing += 1;
    }
  }
  return { xp: Math.round(sum * 10) / 10, matched, missing };
}

function erf(x) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

function normCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Team scoring distribution from the static forecast: summed mean (mu), pooled
 * standard deviation (from each player's percentile spread, p90−p10 ≈ 2.563σ), and
 * a summed floor/ceiling range. Used for honest H2H win probabilities.
 */
export function teamForecastDistribution(byId, elementIds = []) {
  let mu = 0;
  let variance = 0;
  let low = 0;
  let high = 0;
  let matched = 0;
  let missing = 0;
  for (const id of elementIds) {
    const f = byId.get(Number(id))?.forecast;
    const xp = Number(f?.totalPoints);
    if (Number.isFinite(xp)) {
      mu += xp;
      matched += 1;
      const p10 = Number(f?.percentiles?.p10);
      const p90 = Number(f?.percentiles?.p90);
      low += Number.isFinite(p10) ? p10 : xp;
      high += Number.isFinite(p90) ? p90 : xp;
      const sd = Number.isFinite(p90) && Number.isFinite(p10) ? Math.max(0, (p90 - p10) / 2.563) : 0;
      variance += sd * sd;
    } else {
      missing += 1;
    }
  }
  return {
    mu: Math.round(mu * 10) / 10,
    sigma: Math.sqrt(variance),
    low: Math.round(low),
    high: Math.round(high),
    matched,
    missing,
  };
}

/**
 * Win / draw / loss probabilities for two team distributions via a CLT normal
 * approximation (sum of ~11 independent player scores). `drawBand` accounts for
 * integer-point ties. Returns percentages (1 dp) that sum to ~100.
 */
export function h2hWinProbs(home, away, drawBand = 0.5) {
  const dMu = (home?.mu ?? 0) - (away?.mu ?? 0);
  const sd = Math.sqrt((home?.sigma ?? 0) ** 2 + (away?.sigma ?? 0) ** 2);
  const r = (x) => Math.round(x * 1000) / 10;
  if (!(sd > 0)) {
    if (dMu > 0) return { homeWinPct: 100, drawPct: 0, awayWinPct: 0 };
    if (dMu < 0) return { homeWinPct: 0, drawPct: 0, awayWinPct: 100 };
    return { homeWinPct: 0, drawPct: 100, awayWinPct: 0 };
  }
  const pHomeWin = 1 - normCdf((drawBand - dMu) / sd);
  const pAwayWin = normCdf((-drawBand - dMu) / sd);
  const pDraw = Math.max(0, 1 - pHomeWin - pAwayWin);
  return { homeWinPct: r(pHomeWin), drawPct: r(pDraw), awayWinPct: r(pAwayWin) };
}

/**
 * Extract a finished-gameweek matchup view from a `projections-history/gw-NN.json`
 * `h2h` array, matched by the two league-entry ids and oriented to the requested
 * home/away sides (the archived row may store the pairing in either order).
 *
 * Returns both:
 *   - `preMatch` — what was forecast before kick-off (xPtsXi points, xPtsMc win bar)
 *   - `final`    — how it actually settled (actualXiPts points, projMc win bar,
 *                  which collapses to the real outcome once the GW is done)
 *
 * @param {{ h2h?: any[] }|null} history parsed gw-NN.json
 * @param {number} homeId league_entry id shown as home on the card
 * @param {number} awayId league_entry id shown as away on the card
 * @returns {null | { preMatch: object, final: object, settled: boolean }}
 */
export function finishedMatchupOdds(history, homeId, awayId) {
  const rows = Array.isArray(history?.h2h) ? history.h2h : [];
  const h = Number(homeId);
  const a = Number(awayId);
  for (const row of rows) {
    const e1 = Number(row?.league_entry_1);
    const e2 = Number(row?.league_entry_2);
    let swap;
    if (e1 === h && e2 === a) swap = false;
    else if (e1 === a && e2 === h) swap = true;
    else continue;

    const probs = (mc) => {
      const p = mc || {};
      const hw = Number(p.homeWinPct) || 0;
      const aw = Number(p.awayWinPct) || 0;
      const dr = Number(p.drawPct) || 0;
      return swap
        ? { homeWinPct: aw, drawPct: dr, awayWinPct: hw }
        : { homeWinPct: hw, drawPct: dr, awayWinPct: aw };
    };
    const pair = (k1, k2) => {
      const v1 = Number(row[k1]) || 0;
      const v2 = Number(row[k2]) || 0;
      return swap ? [v2, v1] : [v1, v2];
    };
    const [preHome, preAway] = pair('xPtsXi1', 'xPtsXi2');
    const [finHome, finAway] = pair('actualXiPts1', 'actualXiPts2');

    return {
      preMatch: { probs: probs(row.xPtsMc), homePts: preHome, awayPts: preAway },
      final: { probs: probs(row.projMc), homePts: finHome, awayPts: finAway },
      settled: row.plHadFinishedFixtureForMc === true,
    };
  }
  return null;
}

/**
 * Team-level expected attacking/defensive totals from the static forecast,
 * summed over a set of element ids. Expectation is linear, so these are valid
 * sums of per-player probabilities even when players share a real-world club:
 *   - expGoals   = Σ P(player scores)
 *   - expAssists = Σ P(player assists)
 *   - expCs      = Σ P(player keeps a clean sheet)  (cleanSheetPct is 0–100)
 */
export function teamOddsTotals(byId, elementIds = []) {
  let expGoals = 0;
  let expAssists = 0;
  let expCs = 0;
  let matched = 0;
  for (const id of elementIds) {
    const prob = byId.get(Number(id))?.forecast?.probabilities;
    if (!prob) continue;
    matched += 1;
    expGoals += Number(prob.goalLikelihood) || 0;
    expAssists += Number(prob.assistLikelihood) || 0;
    expCs += (Number(prob.cleanSheetPct) || 0) / 100;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  return { expGoals: r1(expGoals), expAssists: r1(expAssists), expCs: r1(expCs), matched };
}

/**
 * Players most likely to return (≥6 projected points) across both managers'
 * XIs, ranked by return probability. Each entry carries the side it belongs to
 * so the UI can badge it. `returnPct` is an integer percentage.
 */
export function mostLikelyToReturn(byId, homeIds = [], awayIds = [], n = 3) {
  const rows = [];
  const collect = (ids, side) => {
    for (const id of ids) {
      const p = byId.get(Number(id));
      const ret = Number(p?.forecast?.outcomes?.returns);
      if (!p || !Number.isFinite(ret)) continue;
      rows.push({
        id: Number(id),
        side,
        name: p.name,
        position: p.position,
        teamId: p.teamId ?? null,
        returnPct: Math.round(ret * 100),
        xp: Number(p.forecast?.totalPoints) || 0,
      });
    }
  };
  collect(homeIds, 'home');
  collect(awayIds, 'away');
  rows.sort((a, b) => b.returnPct - a.returnPct || b.xp - a.xp);
  return rows.slice(0, n);
}

/** Win/draw/loss lean from two team xP sums (deterministic preview, not a Monte Carlo). */
export function matchupLean(homeXp, awayXp) {
  const diff = Math.round((homeXp - awayXp) * 10) / 10;
  if (diff > 0) return { favorite: 'home', diff: Math.abs(diff) };
  if (diff < 0) return { favorite: 'away', diff: Math.abs(diff) };
  return { favorite: 'level', diff: 0 };
}

// ---------------------------------------------------------------------------
// Likelihood-first presentation helpers (tiers / ranges / outcome odds).
// A single expected-points decimal hides how volatile a return is; these turn
// the engine's distribution into honest, human framing.
// ---------------------------------------------------------------------------

const TWO_WORLD_POSITIONS = new Set(['GK', 'DEF']);

/** Positions whose score is dominated by the binary clean-sheet outcome. */
export function isTwoWorld(position) {
  return TWO_WORLD_POSITIONS.has(position);
}

/**
 * Likelihood tier from expected points. Intentionally position-agnostic so the
 * leaderboard reads consistently (a 5.5xP defender and a 5.5xP forward are both
 * "Strong"). Lower `rank` = better.
 */
export function tierFor(forecast) {
  const xp = Number(forecast?.totalPoints);
  if (!Number.isFinite(xp)) return { key: 'unknown', label: 'No data', rank: 99 };
  if (xp >= 6.5) return { key: 'elite', label: 'Elite', rank: 0 };
  if (xp >= 5) return { key: 'strong', label: 'Strong', rank: 1 };
  if (xp >= 3.5) return { key: 'solid', label: 'Solid', rank: 2 };
  if (xp >= 2) return { key: 'risky', label: 'Risky', rank: 3 };
  return { key: 'fringe', label: 'Fringe', rank: 4 };
}

/** Floor / median / ceiling from the percentile distribution (rounded to whole points). */
export function rangeFor(forecast) {
  const p = forecast?.percentiles ?? {};
  const round = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  return { low: round(p.p10), mid: round(p.p50), high: round(p.p90) };
}

/**
 * Headline outcome odds as integer percents. These are deliberately overlapping
 * (a haul is also a return), because each answers a question a manager asks:
 * "will they blank?", "will they return?", "could they haul?".
 */
export function outcomeOdds(forecast) {
  const o = forecast?.outcomes ?? {};
  const pct = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : null);
  return { blank: pct(o.blank), returns: pct(o.returns), haul: pct(o.haul) };
}

/**
 * Mutually-exclusive bands for a 100% stacked bar: blank (≤2) / decent / haul (≥10).
 * Clamps and renormalises so the three always sum to 100.
 */
export function outcomeBar(forecast) {
  const o = forecast?.outcomes ?? {};
  const clamp01 = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  };
  let blank = clamp01(o.blank);
  let haul = clamp01(o.haul);
  if (blank + haul > 1) {
    const s = blank + haul;
    blank /= s;
    haul /= s;
  }
  const mid = Math.max(0, 1 - blank - haul);
  return [
    { key: 'blank', label: 'Blank', pct: Math.round(blank * 100) },
    { key: 'mid', label: 'Decent', pct: Math.round(mid * 100) },
    { key: 'haul', label: 'Haul', pct: Math.round(haul * 100) },
  ];
}

/**
 * Clean-sheet "two-world" view for GK/DEF: their score is dominated by a coin
 * flip (clean sheet or not), so a single average is misleading. Splits expected
 * points into the CS world and the no-CS world.
 *
 * Approximation: only the clean-sheet points depend on the CS outcome; minutes,
 * saves, attacking returns and bonus are treated as shared across both worlds.
 */
const ZERO_BREAKDOWN = {
  minutes: 0,
  goals: 0,
  assists: 0,
  cleanSheet: 0,
  saves: 0,
  bonus: 0,
  defensiveContribution: 0,
  cards: 0,
  ownGoals: 0,
  penaltyMiss: 0,
};

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Overlay a confirmed matchday role onto an already-enriched static forecast.
 *
 * This is a bounded analytic adjustment of the published numbers (not a full
 * re-simulation): it keeps the leaderboard internally consistent with the
 * Understat-enriched `predictions.json` while reflecting confirmed news.
 *   - 'absent' → zeroed (exact; the player cannot score)
 *   - 'bench'  → collapsed to a cameo (minute-dependent points heavily damped)
 *   - 'xi'     → rotation/doubt discount removed (modest, capped uplift when the
 *                model had under-projected the player's minutes)
 * Returns a NEW forecast object plus `baselineXp` / `xpDelta` for the UI.
 */
export function adjustForecastForRole(player, role) {
  const f = player?.forecast;
  if (!f || !role) return null;
  const baselineXp = Number(f.totalPoints) || 0;
  const r1 = (v) => Math.round(v * 10) / 10;
  const r3 = (v) => Math.round(v * 1000) / 1000;

  if (role === 'absent') {
    return {
      ...f,
      totalPoints: 0,
      breakdown: { ...ZERO_BREAKDOWN },
      probabilities: { ...(f.probabilities || {}), projectedMins: 0, cleanSheetPct: 0, projectedSaves: 0 },
      percentiles: { p10: 0, p50: 0, p90: 0 },
      outcomes: { blank: 1, returns: 0, haul: 0, monster: 0 },
      baselineXp,
      xpDelta: r1(0 - baselineXp),
    };
  }

  const bd = f.breakdown || {};
  const prob = f.probabilities || {};
  const out = f.outcomes || {};
  const bakedMins = Number(prob.projectedMins) || 0;

  let factor;
  let cs;
  let mins;
  let appearance;
  if (role === 'bench') {
    // Cameo: ~12 minutes if introduced. Minute-dependent output collapses; a sub
    // almost never completes the 60' needed for a clean sheet.
    mins = 12;
    factor = clamp(mins / Math.max(bakedMins, 1), 0, 1);
    cs = 0;
    appearance = 0.7; // expected appearance points for a likely-but-not-certain cameo
  } else {
    // Confirmed starter: if the model already had them near a full start, leave it;
    // otherwise lift minute-dependent output toward a full start (capped to avoid
    // fabricating large swings).
    const target = 85;
    factor = bakedMins >= 75 ? 1 : clamp(target / Math.max(bakedMins, 1), 1, 1.4);
    mins = Math.max(bakedMins, role === 'xi' ? Math.min(target, bakedMins * factor) : bakedMins);
    cs = (Number(bd.cleanSheet) || 0) * factor;
    appearance = 2;
  }

  const newBd = {
    minutes: appearance,
    goals: (Number(bd.goals) || 0) * factor,
    assists: (Number(bd.assists) || 0) * factor,
    cleanSheet: cs,
    saves: role === 'bench' ? 0 : (Number(bd.saves) || 0) * factor,
    bonus: (Number(bd.bonus) || 0) * (role === 'bench' ? factor * 0.5 : factor),
    defensiveContribution: (Number(bd.defensiveContribution) || 0) * factor,
    cards: (Number(bd.cards) || 0) * factor,
    ownGoals: (Number(bd.ownGoals) || 0) * factor,
    penaltyMiss: (Number(bd.penaltyMiss) || 0) * factor,
  };
  const total = Object.values(newBd).reduce((a, b) => a + b, 0);
  const ratio = baselineXp > 0 ? clamp(total / baselineXp, 0, 3) : 1;

  // Scale the distribution proportionally (rough, but directionally honest).
  const haul = clamp((Number(out.haul) || 0) * ratio, 0, 1);
  const returns = clamp((Number(out.returns) || 0) * ratio, 0, 1);
  const blank = clamp(1 - returns, 0, 1);

  return {
    ...f,
    totalPoints: r1(total),
    breakdown: Object.fromEntries(Object.entries(newBd).map(([k, v]) => [k, r1(v)])),
    probabilities: {
      ...prob,
      projectedMins: Math.round(mins),
      cleanSheetPct: role === 'bench' ? 0 : Math.round((Number(prob.cleanSheetPct) || 0) * Math.min(factor, 1.4)),
    },
    percentiles: {
      p10: Math.round((Number(f.percentiles?.p10) || 0) * ratio),
      p50: Math.round((Number(f.percentiles?.p50) || 0) * ratio),
      p90: Math.round((Number(f.percentiles?.p90) || 0) * ratio),
    },
    outcomes: { blank: r3(blank), returns: r3(returns), haul: r3(haul), monster: r3((Number(out.monster) || 0) * ratio) },
    baselineXp,
    xpDelta: r1(total - baselineXp),
  };
}

/**
 * Map confirmed roles onto the player list, returning a new array. Players without
 * a confirmed role pass through untouched. `roleMap` is Map<elementId, role>.
 */
export function applyConfirmedRolesToPlayers(players = [], roleMap) {
  if (!roleMap || roleMap.size === 0) return players;
  return players.map((p) => {
    const role = roleMap.get(Number(p.id));
    if (!role) return p;
    const adjusted = adjustForecastForRole(p, role);
    if (!adjusted) return { ...p, confirmedRole: role };
    return { ...p, confirmedRole: role, forecast: adjusted, xpDelta: adjusted.xpDelta };
  });
}

export function twoWorldView(player) {
  const f = player?.forecast ?? {};
  const csPct = Number(f.probabilities?.cleanSheetPct);
  if (!Number.isFinite(csPct)) return null;
  const csProb = Math.min(1, Math.max(0, csPct / 100));
  const total = Number(f.totalPoints) || 0;
  const csComponent = Number(f.breakdown?.cleanSheet) || 0; // E[CS pts] = csProb * csValue
  const defaultCsValue = player.position === 'GK' || player.position === 'DEF' ? 4 : 1;
  const csValue = csProb > 0.01 ? csComponent / csProb : defaultCsValue;
  const shared = total - csComponent; // expected points excluding the CS swing
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    csProb,
    noCsProb: 1 - csProb,
    csPoints: r1(shared + csValue),
    noCsPoints: r1(Math.max(0, shared)),
  };
}
