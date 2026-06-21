#!/usr/bin/env node
/**
 * Build-time FPL forecasted-score pipeline (static adaptation of the spec's /api/predictions).
 *
 * Produces per-player expected-points forecasts for the target gameweek using the existing
 * `fpl-predictions` Monte Carlo engine as the projection source, enriched with Understat xG/xA
 * (player rates) and team xG/xGA home/away strengths. Output mirrors the spec's API response
 * shape so the frontend can consume it as a static artifact.
 *
 * Reads (public/league-data, refreshed by the rest of the build):
 *   - bootstrap_draft.json  (canonical element id space + per-90 inputs + form/status)
 *   - bootstrap_fpl.json    (classic: events for GW resolution; price/ownership via Opta code)
 *   - fixtures.json         (classic fixtures: matchups, kickoff, difficulty)
 *   - understat.json        (optional: player + team xG enrichment)
 *   - id-reconciliation.json(optional: id-space monitoring counts for health)
 * Writes:
 *   - predictions.json         (gameweek, players[] in spec shape)
 *   - predictions-health.json  (gameweek, updatedAt, idMismatches, understat coverage)
 *
 * Deterministic (seeded RNG per fixture) so rebuilds don't churn the artifact. Never fails the
 * build: skips on SKIP_PREDICTIONS=1, writes an empty (season-not-started) artifact when there's
 * no resolvable upcoming gameweek.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MODEL_CONFIG, predictMatchFixture } from 'fpl-predictions';
import {
  bootstrapTeamToPredictionTeam,
  bootstrapElementToPlayer,
  classicFixtureToPredictionFixture,
  projectionRng,
} from '../src/livePredictionMappers.js';
import { canonicalTeamKey } from '../src/understat.js';
import {
  understatTeamIndex,
  enrichTeamWithUnderstat,
  understatPlayerIndex,
  matchUnderstatPlayer,
  blendPlayerXgXa,
} from '../src/enrichFromUnderstat.js';
import { resolveSeasonFromBootstrap, getSeasonString, getSeasonLabel } from '../src/seasonString.js';
import { buildHistoricalRates, applyColdStartPriors } from '../src/coldStartPriors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
// Overridable (env) so the off-season / empty path can be tested in a sandbox.
const leagueDataDir = process.env.PREDICTIONS_LEAGUE_DATA_DIR || join(__dirname, '../public/league-data');
const incomingDataDir = process.env.PREDICTIONS_INCOMING_DATA_DIR || join(repoRoot, 'data');

const POS_MAP = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const MODEL_CONFIG = { ...DEFAULT_MODEL_CONFIG, simulationIterations: 1500 };

function log(...args) {
  console.log('build-predictions:', ...args);
}

function readJson(name) {
  for (const dir of [incomingDataDir, leagueDataDir]) {
    const p = join(dir, name);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        /* try next dir */
      }
    }
  }
  return null;
}

const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
const r2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);
const r3 = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0);
const numOrNull = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Target GW: env override → classic is_next → is_current → first unfinished fixture → null. */
function resolveTargetGameweek(classicBoot, fixtures) {
  const env = Number(process.env.PREDICTIONS_TARGET_GW);
  if (Number.isFinite(env) && env >= 1 && env <= 38) return env;
  const events = classicBoot?.events ?? [];
  const next = events.find((e) => e.is_next);
  if (next) return Number(next.id);
  const cur = events.find((e) => e.is_current && !e.finished);
  if (cur) return Number(cur.id);
  const unfinished = (Array.isArray(fixtures) ? fixtures : [])
    .filter((f) => f?.finished !== true && Number.isFinite(Number(f.event)))
    .map((f) => Number(f.event))
    .sort((a, b) => a - b);
  return unfinished.length ? unfinished[0] : null;
}

/**
 * Locate the most recent archived season strictly before `currentLabel` and load its
 * draft bootstrap (full end-of-season per-90 stats) for cold-start priors. Labels are
 * "YYYY-YY" so a lexical compare orders them correctly. Returns null if no archive.
 */
function loadPriorSeasonBootstrap(currentLabel) {
  const seasonsDir = join(leagueDataDir, 'seasons');
  if (!existsSync(seasonsDir)) return null;
  let entries;
  try {
    entries = readdirSync(seasonsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  let best = null;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const label = e.name;
    if (currentLabel && label >= currentLabel) continue; // only seasons before the current one
    const p = join(seasonsDir, label, 'bootstrap_draft.json');
    if (!existsSync(p)) continue;
    if (!best || label > best.label) best = { label, path: p };
  }
  if (!best) return null;
  try {
    return { label: best.label, bootstrap: JSON.parse(readFileSync(best.path, 'utf8')) };
  } catch {
    return null;
  }
}

/** Accumulate two predictions for the same player across a double gameweek. */
function accumulatePrediction(a, b) {
  if (!a) return b;
  const combineProb = (x, y) => 1 - (1 - (x || 0)) * (1 - (y || 0));
  return {
    ...a,
    expectedPoints: a.expectedPoints + b.expectedPoints,
    expectedMinutes: a.expectedMinutes + b.expectedMinutes,
    expectedSaves: (a.expectedSaves || 0) + (b.expectedSaves || 0),
    goalProbability: combineProb(a.goalProbability, b.goalProbability),
    assistProbability: combineProb(a.assistProbability, b.assistProbability),
    cleanSheetProbability: Math.max(a.cleanSheetProbability, b.cleanSheetProbability),
    p10: a.p10 + b.p10,
    p50: a.p50 + b.p50,
    p90: a.p90 + b.p90,
    // Outcome bands across a DGW (approximate): "return/haul in at least one match"
    // via combineProb; "blank" means quiet in both, so multiply.
    probabilitySixPlus: combineProb(a.probabilitySixPlus, b.probabilitySixPlus),
    probabilityTenPlus: combineProb(a.probabilityTenPlus, b.probabilityTenPlus),
    probabilityFifteenPlus: combineProb(a.probabilityFifteenPlus, b.probabilityFifteenPlus),
    probabilityTwoOrLess: (a.probabilityTwoOrLess ?? 0) * (b.probabilityTwoOrLess ?? 0),
    breakdown: Object.fromEntries(
      Object.keys(a.breakdown).map((k) => [k, (a.breakdown[k] || 0) + (b.breakdown[k] || 0)]),
    ),
  };
}

function writeArtifacts(predictions, health) {
  writeFileSync(join(leagueDataDir, 'predictions.json'), JSON.stringify(predictions));
  writeFileSync(join(leagueDataDir, 'predictions-health.json'), JSON.stringify(health, null, 2));
}

function main() {
  if (process.env.SKIP_PREDICTIONS === '1') {
    log('skip (SKIP_PREDICTIONS)');
    return;
  }

  const draftBoot = readJson('bootstrap_draft.json');
  const classicBoot = readJson('bootstrap_fpl.json');
  const fixtures = readJson('fixtures.json');
  const understat = readJson('understat.json');
  const reconciliation = readJson('id-reconciliation.json');

  if (!draftBoot?.elements?.length) {
    log('skip — bootstrap_draft.json missing/empty.');
    return;
  }

  const season =
    resolveSeasonFromBootstrap(draftBoot) ||
    resolveSeasonFromBootstrap(classicBoot) || { string: getSeasonString(), label: getSeasonLabel() };

  const updatedAt = new Date().toISOString();
  const gw = resolveTargetGameweek(classicBoot, fixtures);

  const idMismatches = reconciliation
    ? {
        idSpaceDivergences: reconciliation.counts?.idSpaceDivergences ?? null,
        nameFallback: reconciliation.counts?.nameFallbackMatches ?? null,
        unresolved: reconciliation.counts?.unmatchedRegular ?? null,
      }
    : null;

  const gwFixtures = gw != null && Array.isArray(fixtures) ? fixtures.filter((f) => Number(f.event) === gw) : [];

  if (gw == null || !gwFixtures.length) {
    const note =
      gw == null
        ? 'No upcoming gameweek resolved — season not started or fixtures unavailable.'
        : `No fixtures found for GW ${gw}.`;
    log(`${note} Writing empty artifact.`);
    writeArtifacts(
      {
        schemaVersion: 1,
        generatedAt: updatedAt,
        season: season.string,
        seasonLabel: season.label,
        gameweek: gw,
        note,
        count: 0,
        players: [],
      },
      {
        gameweek: gw,
        updatedAt,
        idMismatches,
        understatAvailable: Boolean(understat),
        playerCount: 0,
        note,
      },
    );
    return;
  }

  // --- Build team map (draft) → engine Team, enriched with Understat where available. ---
  const teamMeta = Object.fromEntries((draftBoot.teams ?? []).map((t) => [Number(t.id), t]));
  const uTeamIdx = understat ? understatTeamIndex(understat) : { byKey: new Map(), leagueAvgXGFor: null };
  const teamsById = new Map();
  let teamsEnriched = 0;
  for (const t of draftBoot.teams ?? []) {
    const base = bootstrapTeamToPredictionTeam(t);
    const agg = uTeamIdx.byKey.get(canonicalTeamKey(t.name));
    const { team, enriched } = enrichTeamWithUnderstat(base, agg);
    if (enriched) teamsEnriched += 1;
    teamsById.set(team.id, team);
  }

  // --- Classic element lookup (by Opta code) for price/ownership the draft feed lacks. ---
  const classicByCode = new Map();
  for (const ce of classicBoot?.elements ?? []) {
    if (ce?.code != null) classicByCode.set(Number(ce.code), ce);
  }

  // --- Understat player index for xG/xA blending. ---
  const uPlayerIdx = understat ? understatPlayerIndex(understat) : null;
  let understatPlayerMatches = 0;

  // --- Cold-start priors: prior-season per-90 (by Opta code) + position baselines.
  // Weighted heavily when current-season minutes are low (GW1) and fading to zero
  // once a player has ~6 matches of current data; keeps early-season forecasts from
  // collapsing to flat zeros. ---
  const prior = loadPriorSeasonBootstrap(season.label);
  const historical = prior ? buildHistoricalRates(prior.bootstrap) : null;
  let coldStartApplied = 0;
  let coldStartHistory = 0;
  let coldStartBaseline = 0;

  // Engine Player per draft element, enriched; cache by id.
  const elementsByTeam = new Map();
  const playerById = new Map();
  const understatMatchById = new Map();
  for (const el of draftBoot.elements) {
    if (el?.removed) continue;
    const teamId = Number(el.team);
    let player = bootstrapElementToPlayer(el);
    if (uPlayerIdx) {
      const uPlayer = matchUnderstatPlayer(
        {
          firstName: el.first_name,
          secondName: el.second_name,
          webName: el.web_name,
          teamName: teamMeta[teamId]?.name,
        },
        uPlayerIdx,
      );
      if (uPlayer) {
        const { player: blended, weight } = blendPlayerXgXa(player, uPlayer);
        player = blended;
        understatPlayerMatches += 1;
        understatMatchById.set(Number(el.id), { matched: true, weight: r3(weight) });
      }
    }
    // Apply cold-start priors after Understat (weight gates it: 0 once enough current minutes).
    const cold = applyColdStartPriors(player, {
      code: el.code,
      currentMinutes: Number(el.minutes) || 0,
      historical,
    });
    if (cold.weight > 0) {
      player = cold.player;
      coldStartApplied += 1;
      if (cold.source === 'history') coldStartHistory += 1;
      else if (cold.source === 'baseline') coldStartBaseline += 1;
    }
    playerById.set(Number(el.id), player);
    if (!elementsByTeam.has(teamId)) elementsByTeam.set(teamId, []);
    elementsByTeam.get(teamId).push(player);
  }

  // --- Run the engine once per fixture; accumulate per player across DGWs. ---
  const predByPlayer = new Map();
  let fixturesRun = 0;
  for (const f of gwFixtures) {
    const homeTeamId = Number(f.team_h);
    const awayTeamId = Number(f.team_a);
    const home = elementsByTeam.get(homeTeamId) ?? [];
    const away = elementsByTeam.get(awayTeamId) ?? [];
    if (!home.length || !away.length) continue;
    if (!teamsById.has(homeTeamId) || !teamsById.has(awayTeamId)) continue;

    const predFx = classicFixtureToPredictionFixture(f, gw);
    const rnd = projectionRng(Number(f.id) + gw * 1009, homeTeamId * 7919 + awayTeamId);
    let preds;
    try {
      preds = predictMatchFixture(home, away, predFx, teamsById, MODEL_CONFIG, rnd);
    } catch (e) {
      log(`fixture ${f.id} (GW${gw}) prediction failed — ${e.message}`);
      continue;
    }
    fixturesRun += 1;
    for (const p of preds) {
      predByPlayer.set(p.playerId, accumulatePrediction(predByPlayer.get(p.playerId), p));
    }
  }

  // --- Shape into the spec's /api/predictions player records. ---
  const players = [];
  for (const el of draftBoot.elements) {
    const id = Number(el.id);
    const pred = predByPlayer.get(id);
    if (!pred) continue; // player's team had no fixture this GW
    const classic = el.code != null ? classicByCode.get(Number(el.code)) : null;
    const teamRow = teamMeta[Number(el.team)];
    const bd = pred.breakdown;
    players.push({
      id,
      code: el.code ?? null,
      name: el.web_name,
      fullName: `${el.first_name ?? ''} ${el.second_name ?? ''}`.trim(),
      teamId: Number(el.team),
      team: teamRow?.name ?? null,
      teamShortName: teamRow?.short_name ?? null,
      position: POS_MAP[Number(el.element_type)] ?? null,
      price: classic ? numOrNull(classic.now_cost) / 10 : null,
      form: numOrNull(el.form),
      ownership: classic ? numOrNull(classic.selected_by_percent) : null,
      status: el.status ?? null,
      chanceOfPlaying: el.chance_of_playing_next_round ?? null,
      understat: understatMatchById.get(id) ?? { matched: false },
      forecast: {
        totalPoints: r1(pred.expectedPoints),
        breakdown: {
          minutes: r2(bd.appearance),
          goals: r2(bd.goals),
          assists: r2(bd.assists),
          cleanSheet: r2(bd.cleanSheet),
          saves: r2(bd.saves),
          bonus: r2(bd.bonus),
          defensiveContribution: r2(bd.defensiveContribution),
          cards: r2(bd.cards),
          ownGoals: r2(bd.ownGoals),
          penaltyMiss: r2(bd.penaltyMiss),
        },
        probabilities: {
          projectedMins: Math.round(pred.expectedMinutes),
          goalLikelihood: r3(pred.goalProbability),
          assistLikelihood: r3(pred.assistProbability),
          cleanSheetPct: Math.round(pred.cleanSheetProbability * 100),
          projectedSaves: Math.round(pred.expectedSaves || 0),
        },
        percentiles: { p10: r1(pred.p10), p50: r1(pred.p50), p90: r1(pred.p90) },
        outcomes: {
          blank: r3(pred.probabilityTwoOrLess),
          returns: r3(pred.probabilitySixPlus),
          haul: r3(pred.probabilityTenPlus),
          monster: r3(pred.probabilityFifteenPlus),
        },
      },
    });
  }
  players.sort((a, b) => b.forecast.totalPoints - a.forecast.totalPoints);

  const playerMatchRate = playerById.size
    ? Math.round((understatPlayerMatches / playerById.size) * 1000) / 1000
    : 0;

  const predictions = {
    schemaVersion: 1,
    generatedAt: updatedAt,
    season: season.string,
    seasonLabel: season.label,
    gameweek: gw,
    source: {
      bootstrap: 'draft',
      enrichment: understat ? 'fpl+understat' : 'fpl-only',
      engine: 'fpl-predictions',
    },
    model: { simulationIterations: MODEL_CONFIG.simulationIterations },
    understat: {
      available: Boolean(understat),
      seasonLabel: understat?.seasonLabel ?? null,
      players: understat?.counts?.players ?? 0,
      teamsEnriched,
      playerMatchRate,
    },
    coldStart: {
      priorSeasonLabel: prior?.label ?? null,
      applied: coldStartApplied,
      fromHistory: coldStartHistory,
      fromBaseline: coldStartBaseline,
    },
    idMismatches,
    count: players.length,
    players,
  };

  writeArtifacts(predictions, {
    gameweek: gw,
    updatedAt,
    idMismatches,
    understatAvailable: Boolean(understat),
    understatPlayerMatchRate: playerMatchRate,
    teamsEnriched,
    fixturesRun,
    playerCount: players.length,
    coldStart: {
      priorSeasonLabel: prior?.label ?? null,
      applied: coldStartApplied,
      fromHistory: coldStartHistory,
      fromBaseline: coldStartBaseline,
    },
  });

  const coldStartNote = coldStartApplied
    ? `cold-start priors on ${coldStartApplied} (${coldStartHistory} hist${prior ? ` from ${prior.label}` : ''}, ${coldStartBaseline} baseline), `
    : '';
  log(
    `GW ${gw} (${season.label}): ${players.length} players over ${fixturesRun} fixture(s); ` +
      `teams enriched ${teamsEnriched}/${(draftBoot.teams ?? []).length}, ` +
      `${coldStartNote}understat player match ${(playerMatchRate * 100).toFixed(0)}% → predictions.json`,
  );
}

main();
