#!/usr/bin/env node
/**
 * Builds the Regular(classic)↔Draft FPL player-ID reconciliation artifact.
 *
 * Both games share the underlying PL player database, joined on the stable Opta `code`, but
 * their element `id` spaces are NOT identical (this league's data has ~10% divergence). This
 * produces a map between the two id spaces plus monitoring counts, so any code/data that holds
 * a classic id can resolve the draft id used everywhere else in this app (and vice versa).
 *
 * Reads (prefers freshly-fetched data/, falls back to committed public/league-data/):
 *   - bootstrap_fpl.json   (Regular / classic bootstrap-static)
 *   - bootstrap_draft.json (Draft bootstrap-static)
 * Writes: public/league-data/id-reconciliation.json
 *
 * Runs every build (not just at season start) — divergences can appear mid-season when players
 * transfer and get re-registered. Skips quietly when inputs are missing.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildReconciliationMaps } from '../src/reconcilePlayerIds.js';
import { resolveSeasonFromBootstrap, getSeasonLabel, getSeasonString } from '../src/seasonString.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const dataDir = join(repoRoot, 'data');
const leagueDataDir = join(__dirname, '../public/league-data');
const outPath = join(leagueDataDir, 'id-reconciliation.json');

function log(...args) {
  console.log('build-id-reconciliation:', ...args);
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Prefer freshly-fetched data/, fall back to committed public/league-data/. */
function loadBootstrap(name) {
  for (const dir of [dataDir, leagueDataDir]) {
    const p = join(dir, name);
    if (existsSync(p)) {
      const j = readJson(p);
      if (j?.elements) return j;
    }
  }
  return null;
}

function main() {
  const regular = loadBootstrap('bootstrap_fpl.json');
  const draft = loadBootstrap('bootstrap_draft.json');

  if (!regular || !draft) {
    log(
      `skip — missing ${!regular ? 'bootstrap_fpl.json ' : ''}${!draft ? 'bootstrap_draft.json' : ''}`.trim(),
    );
    return;
  }

  const season =
    resolveSeasonFromBootstrap(draft) ||
    resolveSeasonFromBootstrap(regular) || { string: getSeasonString(), label: getSeasonLabel() };

  const result = buildReconciliationMaps(regular.elements, draft.elements);

  const artifact = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    season: season.string,
    seasonLabel: season.label,
    primaryJoinKey: 'code (Opta)',
    counts: result.counts,
    // Expected/informational: same player, different element id across the two games.
    idSpaceDivergences: result.idSpaceDivergences,
    // Data-quality signals worth monitoring at season rollover / mid-season transfers.
    nameFallbackMatches: result.nameFallbackMatches,
    unmatchedRegular: result.unmatchedRegular,
    // Full cross-id-space maps for joining classic-only data to this app's draft id space.
    regularToDraftMap: result.regularToDraftMap,
    draftToRegularMap: result.draftToRegularMap,
  };

  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  const c = result.counts;
  log(
    `${season.label}: ${c.codeMatched} code-matched, ${c.nameFallbackMatches} name-fallback, ` +
      `${c.unmatchedRegular} unmatched; ${c.idSpaceDivergences} id-space divergence(s) → ${outPath.split('/').pop()}`,
  );
  if (c.unmatchedRegular > 0 || c.nameFallbackMatches > 0) {
    log(
      'review: name-fallback or unmatched players present — verify around season rollover / transfers.',
    );
  }
}

main();
