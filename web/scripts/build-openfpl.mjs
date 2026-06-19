#!/usr/bin/env node
/**
 * OpenFPL inference add-on (FLAGGED + DISABLED BY DEFAULT).
 *
 * OpenFPL (arXiv:2508.09992) is an FPL+Understat-only ML model. The plan is to use it to *anchor*
 * the headline xP from our `fpl-predictions` Monte Carlo engine once it's trained on backfilled
 * history and the new season's fixtures are live. Until then this step is a no-op.
 *
 * Behaviour:
 *   - Default (OPENFPL_ENABLED unset/≠1): logs that it's disabled and exits 0. No Python, no writes.
 *   - Enabled (OPENFPL_ENABLED=1): runs scripts/openfpl/infer.py (Python). If python3 or the inputs
 *     are missing, or the model isn't trained yet, it logs and exits 0 — it NEVER fails the build.
 *   - Anchoring (OPENFPL_ANCHOR_WEIGHT, default 0): when infer.py returns status "ok", each player's
 *     forecast.totalPoints in predictions.json is blended toward the OpenFPL xP by this weight, and
 *     forecast.openFplXp is attached. Weight 0 keeps the engine output but still records OpenFPL xP.
 *
 * See scripts/openfpl/README.md for activation steps.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { blendAnchorXp } from '../src/openfplAnchor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leagueDataDir = process.env.PREDICTIONS_LEAGUE_DATA_DIR || join(__dirname, '../public/league-data');
const inferScript = join(__dirname, 'openfpl', 'infer.py');

function log(...args) {
  console.log('build-openfpl:', ...args);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function anchorIntoPredictions(openfpl) {
  const weight = Number(process.env.OPENFPL_ANCHOR_WEIGHT);
  const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  const predPath = join(leagueDataDir, 'predictions.json');
  const predictions = readJson(predPath);
  if (!predictions?.players?.length) {
    log('no predictions.json players to anchor — skipping merge.');
    return;
  }
  const xpById = openfpl.predictions || {};
  let anchored = 0;
  for (const p of predictions.players) {
    const xp = Number(xpById[String(p.id)]);
    if (!Number.isFinite(xp)) continue;
    p.forecast.openFplXp = Math.round(xp * 10) / 10;
    p.forecast.totalPoints = Math.round(blendAnchorXp(p.forecast.totalPoints, xp, w) * 10) / 10;
    anchored += 1;
  }
  predictions.players.sort((a, b) => b.forecast.totalPoints - a.forecast.totalPoints);
  predictions.source = { ...(predictions.source || {}), anchor: w > 0 ? 'openfpl' : 'openfpl-recorded' };
  predictions.openFpl = { gameweek: openfpl.gameweek, anchorWeight: w, anchoredPlayers: anchored };
  writeFileSync(predPath, JSON.stringify(predictions));
  log(`anchored ${anchored} player(s) at weight ${w} → predictions.json`);
}

function main() {
  if (process.env.OPENFPL_ENABLED !== '1') {
    log('disabled (set OPENFPL_ENABLED=1 to enable the OpenFPL inference add-on).');
    return;
  }
  if (!existsSync(inferScript)) {
    log(`skip — inference script missing at ${inferScript}`);
    return;
  }

  const python = process.env.PYTHON_BIN || 'python3';
  const outPath = join(leagueDataDir, 'openfpl-predictions.json');
  const res = spawnSync(
    python,
    [inferScript, '--league-data-dir', leagueDataDir, '--out', outPath],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );

  if (res.error) {
    log(`skip — could not run ${python} (${res.error.message}). Is Python installed?`);
    return;
  }
  if (res.status !== 0) {
    log(`skip — infer.py exited ${res.status}.`);
    return;
  }

  const openfpl = readJson(outPath);
  if (!openfpl) {
    log('skip — no openfpl-predictions.json produced.');
    return;
  }
  if (openfpl.status !== 'ok') {
    log(`inference status "${openfpl.status}" — not anchoring (expected until model is trained).`);
    return;
  }
  anchorIntoPredictions(openfpl);
}

try {
  main();
} catch (e) {
  // Flagged add-on must never break the build.
  console.warn('build-openfpl: non-fatal error —', e?.message || e);
}
