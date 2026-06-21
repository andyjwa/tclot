/**
 * Cold-start priors for the forecast engine.
 *
 * The engine derives every player's scoring rates from *season-to-date* stats
 * (see bootstrapElementToPlayer). At the start of a new season those stats are
 * all zero, so GW1–GW5 forecasts would be flat and undifferentiated.
 *
 * This module fixes that by blending each player's *current-season* per-90
 * rates with a prior:
 *   - Returning players → their own prior-season per-90 rates, matched by the
 *     stable Opta `code` (which survives season rollover).
 *   - New / promoted players with no prior-season row → a position baseline
 *     derived from the prior season's regular starters (or hardcoded defaults
 *     if there is no archived season at all).
 *
 * The prior weight starts at 1.0 (GW1, zero current minutes) and fades linearly
 * to 0 once a player has accumulated ~FADE_MATCHES full matches of current-season
 * minutes, after which the live data stands on its own.
 *
 * Pure module: no fs/network. The build script supplies the prior-season
 * bootstrap; the app never imports this.
 */
import { bootstrapElementToPlayer } from './livePredictionMappers.js';

/** Current-season match-equivalents (minutes/90) at which the prior fully fades to zero. */
export const FADE_MATCHES = 6;

/** Minimum prior-season minutes for a player to feed the position baseline medians. */
export const BASELINE_MIN_MINUTES = 600;

/**
 * Scoring-rate fields blended from the prior for BOTH returning players and the
 * position baseline (no-history) path. These are the per-90 inputs the engine
 * reads that are zero at a cold start.
 */
export const PRIOR_RATE_FIELDS = [
  'xGPer90',
  'xAPer90',
  'shotsPer90',
  'shotsOnTargetPer90',
  'keyPassesPer90',
  'ictPer90',
  'seasonIctPer90',
  'yellowCardsPer90',
  'redCardsPer90',
  'savesPer90',
  'defensiveActionsPer90',
  'clearancesBlocksInterceptionsTacklesPer90',
  'ballRecoveriesPer90',
];

/**
 * Minutes / start-rate signals. Blended ONLY for returning players (we know
 * their actual prior role). For unknown new players we keep the current-season
 * minutes signal so a fringe signing is not auto-promoted to a nailed starter.
 */
export const PRIOR_MINUTES_FIELDS = ['recentStartRate', 'startsLast6', 'minutesLast6'];

/**
 * Last-resort position baselines (per-90), used only when there is no archived
 * prior season to compute medians from (true first-ever season). Conservative,
 * roughly league-typical for a regular starter at each position.
 */
export const HARDCODED_BASELINES = {
  GK: {
    xGPer90: 0,
    xAPer90: 0.01,
    shotsPer90: 0,
    shotsOnTargetPer90: 0,
    keyPassesPer90: 0.05,
    ictPer90: 0.5,
    seasonIctPer90: 0.5,
    yellowCardsPer90: 0.05,
    redCardsPer90: 0.003,
    savesPer90: 2.8,
    defensiveActionsPer90: 1.2,
    clearancesBlocksInterceptionsTacklesPer90: 1.0,
    ballRecoveriesPer90: 2.5,
  },
  DEF: {
    xGPer90: 0.05,
    xAPer90: 0.06,
    shotsPer90: 0.6,
    shotsOnTargetPer90: 0.2,
    keyPassesPer90: 0.7,
    ictPer90: 3,
    seasonIctPer90: 3,
    yellowCardsPer90: 0.18,
    redCardsPer90: 0.01,
    savesPer90: 0,
    defensiveActionsPer90: 7,
    clearancesBlocksInterceptionsTacklesPer90: 6,
    ballRecoveriesPer90: 5,
  },
  MID: {
    xGPer90: 0.12,
    xAPer90: 0.12,
    shotsPer90: 1.2,
    shotsOnTargetPer90: 0.4,
    keyPassesPer90: 1.2,
    ictPer90: 5,
    seasonIctPer90: 5,
    yellowCardsPer90: 0.15,
    redCardsPer90: 0.008,
    savesPer90: 0,
    defensiveActionsPer90: 4,
    clearancesBlocksInterceptionsTacklesPer90: 2.5,
    ballRecoveriesPer90: 4,
  },
  FWD: {
    xGPer90: 0.35,
    xAPer90: 0.12,
    shotsPer90: 2.2,
    shotsOnTargetPer90: 0.9,
    keyPassesPer90: 1.0,
    ictPer90: 6,
    seasonIctPer90: 6,
    yellowCardsPer90: 0.12,
    redCardsPer90: 0.006,
    savesPer90: 0,
    defensiveActionsPer90: 1.5,
    clearancesBlocksInterceptionsTacklesPer90: 0.8,
    ballRecoveriesPer90: 2,
  },
};

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Prior weight from current-season minutes: 1.0 at zero minutes, fading linearly
 * to 0 by `fadeMatches` full matches.
 * @param {number} currentMinutes season-to-date minutes
 * @param {number} [fadeMatches]
 * @returns {number} weight in [0, 1]
 */
export function coldStartWeight(currentMinutes, fadeMatches = FADE_MATCHES) {
  const matches = Math.max(0, Number(currentMinutes) || 0) / 90;
  const fade = fadeMatches > 0 ? fadeMatches : FADE_MATCHES;
  const w = 1 - matches / fade;
  if (w <= 0) return 0;
  if (w >= 1) return 1;
  return w;
}

function median(nums) {
  const xs = (nums || []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Build the historical prior set from a prior-season draft bootstrap.
 * @param {{ elements?: any[] } | null} priorBootstrapDraft
 * @returns {{ byCode: Map<number, object>, baselineByPosition: Record<string, object>, count: number }}
 */
export function buildHistoricalRates(priorBootstrapDraft) {
  const byCode = new Map();
  const samplesByPos = { GK: [], DEF: [], MID: [], FWD: [] };

  for (const el of priorBootstrapDraft?.elements ?? []) {
    if (!el || el.removed) continue;
    if (el.code == null) continue;
    const player = bootstrapElementToPlayer(el);
    byCode.set(Number(el.code), player);
    if ((Number(el.minutes) || 0) >= BASELINE_MIN_MINUTES && samplesByPos[player.position]) {
      samplesByPos[player.position].push(player);
    }
  }

  const baselineByPosition = {};
  for (const pos of POSITIONS) {
    const samples = samplesByPos[pos];
    if (!samples || !samples.length) {
      baselineByPosition[pos] = { ...HARDCODED_BASELINES[pos] };
      continue;
    }
    const base = {};
    for (const f of PRIOR_RATE_FIELDS) {
      base[f] = median(samples.map((s) => s[f]));
    }
    baselineByPosition[pos] = base;
  }

  return { byCode, baselineByPosition, count: byCode.size };
}

/**
 * Resolve the prior rates for a player: their own prior-season row if matched by
 * Opta code, else the position baseline.
 * @returns {{ rates: object, source: 'history' | 'baseline' }}
 */
export function priorRatesFor(player, code, historical) {
  const c = code == null ? null : Number(code);
  if (historical && c != null && historical.byCode.has(c)) {
    return { rates: historical.byCode.get(c), source: 'history' };
  }
  const base =
    (historical && historical.baselineByPosition && historical.baselineByPosition[player.position]) ||
    HARDCODED_BASELINES[player.position] ||
    HARDCODED_BASELINES.MID;
  return { rates: base, source: 'baseline' };
}

/**
 * Blend cold-start priors into a single engine Player. Returns a new object.
 * @param {object} player engine Player (post Understat blend) for the current season
 * @param {{ code?: number|null, currentMinutes?: number, historical?: object|null, fadeMatches?: number }} opts
 * @returns {{ player: object, weight: number, source: 'current' | 'history' | 'baseline' }}
 */
export function applyColdStartPriors(player, opts = {}) {
  const { code = null, currentMinutes = 0, historical = null, fadeMatches = FADE_MATCHES } = opts;
  const weight = coldStartWeight(currentMinutes, fadeMatches);
  if (weight <= 0) return { player, weight: 0, source: 'current' };

  const { rates: prior, source } = priorRatesFor(player, code, historical);
  const out = { ...player };

  const blend = (field) => {
    const cur = Number.isFinite(player[field]) ? player[field] : 0;
    const pri = Number.isFinite(prior[field]) ? prior[field] : 0;
    out[field] = weight * pri + (1 - weight) * cur;
  };

  for (const f of PRIOR_RATE_FIELDS) blend(f);
  // Minutes/start signals only carry over for a known returning player.
  if (source === 'history') {
    for (const f of PRIOR_MINUTES_FIELDS) blend(f);
  }

  return { player: out, weight, source };
}
