/**
 * Blends Understat xG signals into the `fpl-predictions` engine inputs.
 *
 * Two enrichments, both designed to be *non-inverting* w.r.t. how the engine consumes them
 * (see fpl-predictions goalModel/assistModel):
 *
 *  - Team strength: `xGForPer90` / `xGAgainstPer90` carry absolute attack/defence quality
 *    (engine divides by league-average xG). `home/awayAttackStrength` and
 *    `home/awayDefenceStrength` are ~1.0-centred home/away *tilt* multipliers, so we set them
 *    from each team's home-vs-overall split ratios (clamped), replacing the flat 1.05/0.95.
 *    Higher `defenceStrength` ⇒ leakier in the engine's shape term, so deriving it from the
 *    xGA split (concede more where home/away xGA is higher) is directionally correct.
 *
 *  - Player rates: blend Understat per-90 xG/xA with FPL's own expected_goals/assists per-90,
 *    weighted toward Understat when it has a solid minutes sample.
 */
import { canonicalTeamKey, normalisePlayerName } from './understat.js';

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

/** Build a team lookup keyed by canonical team name + the league-average overall xGFor. */
export function understatTeamIndex(understat) {
  const byKey = new Map();
  const teams = understat?.teams ?? {};
  const xgForVals = [];
  for (const agg of Object.values(teams)) {
    if (!agg?.title) continue;
    byKey.set(canonicalTeamKey(agg.title), agg);
    if (Number.isFinite(agg.xGFor)) xgForVals.push(agg.xGFor);
  }
  const leagueAvgXGFor = xgForVals.length
    ? xgForVals.reduce((a, b) => a + b, 0) / xgForVals.length
    : null;
  return { byKey, leagueAvgXGFor };
}

/**
 * Return a new Team with Understat-derived strengths merged in. Falls back to the original
 * field when an Understat value is missing/zero so we never regress below the heuristic default.
 * @param {object} team engine Team (from bootstrapTeamToPredictionTeam)
 * @param {object} agg Understat team aggregate (parseUnderstatTeams value)
 */
export function enrichTeamWithUnderstat(team, agg) {
  if (!agg) return { team, enriched: false };
  const splitRatio = (sideVal, overall) =>
    overall > 0 && Number.isFinite(sideVal) ? clamp(sideVal / overall, 0.7, 1.3) : null;

  const homeAtk = splitRatio(agg.home?.xGFor, agg.xGFor);
  const awayAtk = splitRatio(agg.away?.xGFor, agg.xGFor);
  const homeDef = splitRatio(agg.home?.xGAgainst, agg.xGAgainst);
  const awayDef = splitRatio(agg.away?.xGAgainst, agg.xGAgainst);

  return {
    team: {
      ...team,
      xGForPer90: agg.xGFor > 0 ? agg.xGFor : team.xGForPer90,
      xGAgainstPer90: agg.xGAgainst > 0 ? agg.xGAgainst : team.xGAgainstPer90,
      goalsForPer90: agg.goalsFor > 0 ? agg.goalsFor : team.goalsForPer90,
      goalsAgainstPer90: agg.goalsAgainst > 0 ? agg.goalsAgainst : team.goalsAgainstPer90,
      cleanSheetRate: Number.isFinite(agg.cleanSheetRate) ? agg.cleanSheetRate : team.cleanSheetRate,
      homeAttackStrength: homeAtk ?? team.homeAttackStrength,
      awayAttackStrength: awayAtk ?? team.awayAttackStrength,
      homeDefenceStrength: homeDef ?? team.homeDefenceStrength,
      awayDefenceStrength: awayDef ?? team.awayDefenceStrength,
    },
    enriched: true,
  };
}

/**
 * Build an Understat player lookup. Each player is indexed under both a full-name key and a
 * last-name key, scoped by canonical team, to bridge FPL's `web_name` vs Understat's display name.
 */
export function understatPlayerIndex(understat) {
  const byKey = new Map();
  const players = understat?.players ?? [];
  const add = (key, p) => {
    if (!key) return;
    // First writer wins for last-name keys to keep deterministic; full-name keys are unique enough.
    if (!byKey.has(key)) byKey.set(key, p);
  };
  for (const p of players) {
    const teamKey = p.teamKey || canonicalTeamKey(p.team);
    const full = p.nameKey || normalisePlayerName(p.name);
    const tokens = String(p.name ?? '').trim().split(/\s+/);
    const last = normalisePlayerName(tokens[tokens.length - 1] ?? '');
    add(`${full}|${teamKey}`, p);
    add(`last:${last}|${teamKey}`, p);
  }
  return byKey;
}

/**
 * Find the Understat row for an FPL player. Tries full name, then web_name, then last name,
 * always scoped to the player's (canonical) team.
 * @param {{ firstName?:string, secondName?:string, webName?:string, teamName:string }} meta
 */
export function matchUnderstatPlayer(meta, index) {
  const teamKey = canonicalTeamKey(meta.teamName);
  const candidates = [];
  const full = normalisePlayerName(`${meta.firstName ?? ''} ${meta.secondName ?? ''}`);
  if (full) candidates.push(`${full}|${teamKey}`);
  if (meta.webName) candidates.push(`${normalisePlayerName(meta.webName)}|${teamKey}`);
  const secondTokens = String(meta.secondName ?? '').trim().split(/\s+/);
  const lastSecond = normalisePlayerName(secondTokens[secondTokens.length - 1] ?? '');
  if (lastSecond) candidates.push(`last:${lastSecond}|${teamKey}`);
  if (meta.webName) candidates.push(`last:${normalisePlayerName(meta.webName)}|${teamKey}`);
  for (const key of candidates) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Blend Understat per-90 xG/xA into a player. Weight toward Understat when it has a solid
 * minutes sample; otherwise lean on FPL's own expected_* rates already on the player.
 * @param {object} player engine Player (from bootstrapElementToPlayer)
 * @param {object} uPlayer matched Understat row (playerPer90FromUnderstat)
 */
export function blendPlayerXgXa(player, uPlayer) {
  if (!uPlayer) return { player, blended: false };
  // More Understat minutes ⇒ trust it more, capped so FPL always retains a meaningful share.
  const w = clamp((uPlayer.minutes || 0) / 900, 0.2, 0.6); // ~10 full matches → 0.6 cap
  const blend = (fpl, us) => {
    const f = Number.isFinite(fpl) ? fpl : 0;
    const u = Number.isFinite(us) ? us : 0;
    if (u <= 0 && f <= 0) return 0;
    if (u <= 0) return f;
    return w * u + (1 - w) * f;
  };
  return {
    player: {
      ...player,
      xGPer90: blend(player.xGPer90, uPlayer.xG90),
      xAPer90: blend(player.xAPer90, uPlayer.xA90),
    },
    blended: true,
    weight: w,
  };
}
