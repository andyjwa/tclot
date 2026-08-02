#!/usr/bin/env node
/**
 * Writes public/league-data/seasons/index.json — the manifest the header season
 * switcher uses to discover archived seasons (public/league-data/seasons/<label>/,
 * created by archive-prior-season.mjs at rollover or committed by hand).
 *
 * Runs right after archive-prior-season.mjs in the build chain so a rollover's
 * fresh archive is listed in the same build that creates it. `current` is the
 * season of the live public/league-data/ tree (season.json marker, falling back
 * to bootstrap_draft.json), letting the UI skip any archive that duplicates the
 * live season (e.g. a hand-committed snapshot of the season still in play).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveSeasonFromBootstrap } from '../src/seasonString.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leagueDataDir =
  process.env.SEASON_LEAGUE_DATA_DIR || join(__dirname, '../public/league-data');
const seasonsDir = join(leagueDataDir, 'seasons');

const SEASON_LABEL_RE = /^\d{4}-\d{2}$/;

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function currentSeasonLabel() {
  const marker = readJson(join(leagueDataDir, 'season.json'));
  if (marker?.label) return String(marker.label);
  const boot = readJson(join(leagueDataDir, 'bootstrap_draft.json'));
  return boot ? (resolveSeasonFromBootstrap(boot)?.label ?? null) : null;
}

function main() {
  const labels = existsSync(seasonsDir)
    ? readdirSync(seasonsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && SEASON_LABEL_RE.test(d.name))
        .map((d) => d.name)
        .sort()
        .reverse() // newest first
    : [];

  const manifest = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    current: currentSeasonLabel(),
    seasons: labels,
  };

  mkdirSync(seasonsDir, { recursive: true });
  writeFileSync(join(seasonsDir, 'index.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `build-seasons-manifest: current=${manifest.current ?? '?'} archived=[${labels.join(', ')}]`,
  );
}

main();
