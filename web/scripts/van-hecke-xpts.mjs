/**
 * One-off: Van Hecke (element 151) xPts for mirrored app config (see LiveProjectionsPanel UI_MODEL_CONFIG).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_MODEL_CONFIG,
  buildRateBundle,
  predictForPlayerFromMap,
} from 'fpl-predictions';
import {
  bootstrapElementToPlayer,
  bootstrapTeamToPredictionTeam,
  classicFixtureToPredictionFixture,
  pickGwFixtureForTeam,
} from '../src/livePredictionMappers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '../public/league-data');

const UI_MODEL_CONFIG = {
  ...DEFAULT_MODEL_CONFIG,
  simulationIterations: 450,
};

function projectionRng(seedA, seedB) {
  let a =
    Math.imul(Number(seedA) || 0, 0x9e3779b9) ^
    Math.imul(Number(seedB) || 0, 0x85ebca6b);
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79fd) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bootstrap = JSON.parse(readFileSync(join(DATA, 'bootstrap_draft.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(join(DATA, 'fixtures.json'), 'utf8'));
const revision = JSON.parse(readFileSync(join(DATA, 'revision.json'), 'utf8'));

const GW = 36;
const ELEMENT_ID = 151;

const teamsById = new Map(
  (bootstrap.teams || []).map((t) => [Number(t.id), bootstrapTeamToPredictionTeam(t)]),
);
const teamShort = Object.fromEntries((bootstrap.teams || []).map((t) => [t.id, t.short_name]));

const gwFixtures = fixtures.filter((f) => Number(f.event) === GW);

const el = bootstrap.elements.find((e) => Number(e.id) === ELEMENT_ID);
if (!el) throw new Error(`Element ${ELEMENT_ID} not found`);

const player = bootstrapElementToPlayer(el);
const rawFx = pickGwFixtureForTeam(player.teamId, gwFixtures, GW);
if (!rawFx) throw new Error(`No fixture for team ${player.teamId} in GW ${GW}`);

const predFx = classicFixtureToPredictionFixture(rawFx, GW);
const rnd = projectionRng(player.id, predFx.id);

const pred = predictForPlayerFromMap(player, predFx, teamsById, UI_MODEL_CONFIG, rnd);

const pt = teamsById.get(player.teamId);
const oppId = player.teamId === predFx.homeTeamId ? predFx.awayTeamId : predFx.homeTeamId;
const op = teamsById.get(oppId);
const bundle = buildRateBundle(player, pt, op, predFx, UI_MODEL_CONFIG);

const home = teamShort[predFx.homeTeamId];
const away = teamShort[predFx.awayTeamId];
const isHome = player.teamId === predFx.homeTeamId;
const opponentVenue = isHome ? `${away} (H)` : `${home} (A)`;

const out = {
  revision: revision.v,
  maxFinishedH2hGw: revision.maxFinishedH2hGameweek,
  gameweek: GW,
  fixture: `${home} v ${away}`,
  opponentLabel: opponentVenue,
  rateBundle: {
    lambdaGoals: bundle.lambdaGoals,
    lambdaAssists: bundle.lambdaAssists,
    cleanSheetProbability: bundle.cleanSheetProbability,
    dcProbability: bundle.dcProbability,
    P_start: bundle.P_start,
    expectedMinutes: pred.expectedMinutes,
    expectedBonus: bundle.expectedBonus,
  },
  expectedPoints_mcMean: pred.expectedPoints,
  breakdown_analytic: pred.breakdown,
};

/** Fields in rateBundle that are probabilities in [0, 1] (display as % in console tables). */
const RATE_BUNDLE_PROB_KEYS = new Set([
  'cleanSheetProbability',
  'dcProbability',
  'P_start',
]);

function pct1(x) {
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function fmtRateBundleDisplayEntries() {
  return Object.entries(out.rateBundle).map(([key, value]) => ({
    field: key,
    value: RATE_BUNDLE_PROB_KEYS.has(key) ? pct1(value) : Number(value).toFixed(4),
  }));
}

const mcMeanXPts = pred.expectedPoints;

const mcAndProbLine = [
  `MC mean xPts: ${mcMeanXPts.toFixed(2)}`,
  `P_start ${pct1(bundle.P_start)}`,
  `P(CS) ${pct1(bundle.cleanSheetProbability)}`,
  `P(DC) ${pct1(bundle.dcProbability)}`,
].join(' | ');

const rateLine = [
  `λg ${Number(bundle.lambdaGoals).toFixed(4)}`,
  `λa ${Number(bundle.lambdaAssists).toFixed(4)}`,
  `xMins ${Number(pred.expectedMinutes).toFixed(1)}`,
  `xBonus ${Number(bundle.expectedBonus).toFixed(3)}`,
].join(' | ');

// Breakdown % column: each component / MC-mean expectedPoints (same denominator for every row).
const breakdownRows = Object.entries(pred.breakdown).map(([component, pts]) => {
  const n = Number(pts);
  const pctOfMc =
    mcMeanXPts !== 0 && Number.isFinite(mcMeanXPts)
      ? `${((n / mcMeanXPts) * 100).toFixed(1)}%`
      : '—';
  let ratesOrProb = '';
  switch (component) {
    case 'appearance':
      ratesOrProb = `xMins ${pred.expectedMinutes.toFixed(1)} · P(60+) ${pct1(pred.P_sixty_plus_minutes)}`;
      break;
    case 'goals':
      ratesOrProb = `λg ${pred.expectedGoals.toFixed(4)} · P(scoring≥1) ${pct1(pred.goalProbability)}`;
      break;
    case 'assists':
      ratesOrProb = `λa ${pred.expectedAssists.toFixed(4)} · P(ast≥1) ${pct1(pred.assistProbability)}`;
      break;
    case 'cleanSheet':
      ratesOrProb = `P(CS) ${pct1(pred.cleanSheetProbability)}`;
      break;
    case 'saves':
      ratesOrProb =
        player.position === 'GK'
          ? `E[saves] ${pred.expectedSaves.toFixed(2)} · P(save pts) ${pct1(pred.savePointsProbability)}`
          : '—';
      break;
    case 'defensiveContribution':
      ratesOrProb = `P(DC) ${pct1(pred.defensiveContributionProbability)}`;
      break;
    case 'ownGoals':
      ratesOrProb = `P(OG) ${pct1(pred.ownGoalProbability)}`;
      break;
    case 'penaltyMiss':
      ratesOrProb = `P(pen miss) ${pct1(pred.penaltyMissProbability)}`;
      break;
    case 'cards':
      ratesOrProb = `P(Y) ${pct1(pred.yellowCardProbability)} · P(R) ${pct1(pred.redCardProbability)}`;
      break;
    case 'bonus':
      ratesOrProb = `xBonus ${bundle.expectedBonus.toFixed(3)}`;
      break;
    default:
      ratesOrProb = '';
  }
  return { component, pts: n.toFixed(2), pctOfMcMeanXPts: pctOfMc, ratesOrProb };
});

console.log(
  [`GW ${GW} · ${out.fixture} · ${out.opponentLabel}`, mcAndProbLine, rateLine, ''].join('\n'),
);
console.log('rateBundle (full)');
console.table(fmtRateBundleDisplayEntries());
console.log(
  'breakdown_analytic (pts · % of MC mean · ratesOrProb)',
);
console.table(breakdownRows);
console.log(
  'footnote: analytic breakdown is closed-form EV vs MC simulated total xPts; card row pts can be negative (marginal P(Y), P(R) shown).',
);

const wantsRawJson = process.argv.includes('--raw-json');
if (wantsRawJson) {
  console.log('\n--- raw JSON ---\n');
  console.log(JSON.stringify(out, null, 2));
}
