#!/usr/bin/env node
/**
 * Season-rollover guard. Runs AFTER the league fetch (data/ holds the incoming season) but
 * BEFORE copy-data.js overwrites public/league-data/ with it.
 *
 * When the incoming season differs from the season currently on disk, this snapshots the
 * entire live public/league-data/ tree into public/league-data/seasons/<old-label>/ so a
 * refresh never destroys the prior season, then clears the live tree (except seasons/) so
 * copy-data + downstream scripts populate a clean new-season tree.
 *
 * Same-season rebuilds (the common case) are a no-op. First-ever run (no on-disk season) is a
 * no-op. Disable with SKIP_SEASON_ARCHIVE=1.
 *
 * Incoming season is read from data/bootstrap_draft.json (fetch-league-if-needed / ingest.py).
 * On-disk season is read from public/league-data/season.json, falling back to its committed
 * bootstrap_draft.json.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveSeasonFromBootstrap } from '../src/seasonString.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
// Paths are overridable (env) so the season-rollover path can be tested in a sandbox.
const dataDir = process.env.SEASON_INCOMING_DATA_DIR || join(repoRoot, 'data');
const leagueDataDir =
  process.env.SEASON_LEAGUE_DATA_DIR || join(__dirname, '../public/league-data');
const seasonsDir = join(leagueDataDir, 'seasons');

function log(...args) {
  console.log('archive-prior-season:', ...args);
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function seasonFromBootstrapFile(p) {
  const b = readJson(p);
  return b ? resolveSeasonFromBootstrap(b) : null;
}

function onDiskSeason() {
  const marker = readJson(join(leagueDataDir, 'season.json'));
  if (marker?.season && marker?.label) {
    return { string: String(marker.season), label: String(marker.label) };
  }
  return seasonFromBootstrapFile(join(leagueDataDir, 'bootstrap_draft.json'));
}

function main() {
  if (process.env.SKIP_SEASON_ARCHIVE === '1') {
    log('skip (SKIP_SEASON_ARCHIVE=1)');
    return;
  }

  const incoming = seasonFromBootstrapFile(join(dataDir, 'bootstrap_draft.json'));
  if (!incoming) {
    log('skip — no incoming data/bootstrap_draft.json to compare (nothing fetched).');
    return;
  }

  if (!existsSync(leagueDataDir)) {
    log('skip — no existing public/league-data/ to archive.');
    return;
  }

  const onDisk = onDiskSeason();
  if (!onDisk) {
    log(`first run — no on-disk season detected; incoming ${incoming.label}. Nothing to archive.`);
    return;
  }

  if (onDisk.string === incoming.string) {
    log(`same season (${onDisk.label}); no archive needed.`);
    return;
  }

  // Season change: snapshot the full live tree (minus seasons/) into seasons/<old-label>/.
  const archiveDir = join(seasonsDir, onDisk.label);
  mkdirSync(archiveDir, { recursive: true });

  let copied = 0;
  for (const entry of readdirSync(leagueDataDir)) {
    if (entry === 'seasons') continue; // never recurse the archive into itself
    cpSync(join(leagueDataDir, entry), join(archiveDir, entry), { recursive: true });
    copied += 1;
  }

  // Drop live artifacts (except seasons/) so copy-data + downstream scripts
  // populate a clean new-season tree instead of mixing stale derived JSON
  // (predictions, understat, draft_picks, …) from the archived season.
  let cleared = 0;
  for (const entry of readdirSync(leagueDataDir)) {
    if (entry === 'seasons') continue;
    rmSync(join(leagueDataDir, entry), { recursive: true, force: true });
    cleared += 1;
  }

  log(
    `season change ${onDisk.label} → ${incoming.label}: archived ${copied} entr${copied === 1 ? 'y' : 'ies'} to seasons/${onDisk.label}/ and cleared ${cleared} live entr${cleared === 1 ? 'y' : 'ies'}.`,
  );
}

main();
