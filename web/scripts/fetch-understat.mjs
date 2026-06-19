#!/usr/bin/env node
/**
 * Fetches Understat EPL data (player xG/xA + team xG/xGA/PPDA/Deep) and writes a compact,
 * pipeline-ready artifact. Understat is a free, public xG source — exactly the public signal
 * the OpenFPL approach (arXiv:2508.09992) validates as sufficient to rival paid services.
 *
 * Source:  GET https://understat.com/main/getLeagueData/EPL/{startYear}  → { teams, players, dates }
 * Season:  start year derived from the live bootstrap (or wall-clock), e.g. 2025 → 2025-26.
 * Writes:  public/league-data/understat.json (snapshotted on season rollover by archive step).
 *
 * Resilient by design: never fails the build. Skips on OFFLINE=1 / SKIP_UNDERSTAT=1 or any
 * fetch/parse error (the prediction pipeline falls back to FPL-only signals).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseUnderstatPlayers, parseUnderstatTeams } from '../src/understat.js';
import { resolveSeasonFromBootstrap, seasonStartYearFromDate } from '../src/seasonString.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const leagueDataDir = join(__dirname, '../public/league-data');
const outPath = join(leagueDataDir, 'understat.json');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function log(...args) {
  console.log('fetch-understat:', ...args);
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Understat season = season START year (2025 → 2025-26). */
function understatSeasonStartYear() {
  for (const dir of [join(repoRoot, 'data'), leagueDataDir]) {
    const boot = readJson(join(dir, 'bootstrap_draft.json'));
    const s = boot ? resolveSeasonFromBootstrap(boot) : null;
    if (s) return s.startYear;
  }
  return seasonStartYearFromDate();
}

async function main() {
  if (process.env.OFFLINE === '1' || process.env.SKIP_UNDERSTAT === '1') {
    log('skip (OFFLINE / SKIP_UNDERSTAT)');
    return;
  }
  if (!existsSync(leagueDataDir)) {
    log('skip — no public/league-data/ directory.');
    return;
  }

  const startYear = understatSeasonStartYear();
  const seasonLabel = `${startYear}-${String(startYear + 1).slice(2)}`;
  const url = `https://understat.com/main/getLeagueData/EPL/${startYear}`;

  let leagueData;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: `https://understat.com/league/EPL/${startYear}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    leagueData = await res.json();
  } catch (err) {
    log(`unavailable (${err.message}) — pipeline will fall back to FPL-only signals.`);
    return;
  }

  const players = parseUnderstatPlayers(leagueData);
  const teams = parseUnderstatTeams(leagueData);

  if (!players.length && Object.keys(teams).length === 0) {
    log(`no data parsed for ${seasonLabel} — skipping write.`);
    return;
  }

  const artifact = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: url,
    season: `${String(startYear).slice(2)}${String(startYear + 1).slice(2)}`,
    seasonLabel,
    understatSeason: startYear,
    counts: { players: players.length, teams: Object.keys(teams).length },
    players,
    teams,
  };

  writeFileSync(outPath, JSON.stringify(artifact));
  log(
    `${seasonLabel}: ${players.length} players, ${Object.keys(teams).length} teams → ${outPath.split('/').pop()}`,
  );
}

main().catch((e) => {
  // Never fail the build on Understat.
  console.warn('fetch-understat: non-fatal error —', e?.message || e);
});
