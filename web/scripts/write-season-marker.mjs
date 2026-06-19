#!/usr/bin/env node
/**
 * Records which season the live public/league-data/ currently holds, and indexes any archived
 * seasons. Runs AFTER copy-data.js (so bootstrap_draft.json reflects the freshly copied season).
 *
 * Writes:
 *  - public/league-data/season.json          → { season: "2526", label: "2025-26", updatedAt }
 *  - public/league-data/seasons/index.json    → { seasons: ["2024-25", ...], current, updatedAt }
 *
 * season.json is the change-detection baseline read by archive-prior-season.mjs on the next run.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  resolveSeasonFromBootstrap,
  getSeasonString,
  getSeasonLabel,
} from '../src/seasonString.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leagueDataDir =
  process.env.SEASON_LEAGUE_DATA_DIR || join(__dirname, '../public/league-data');
const seasonsDir = join(leagueDataDir, 'seasons');

function log(...args) {
  console.log('write-season-marker:', ...args);
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function currentSeason() {
  const boot = readJson(join(leagueDataDir, 'bootstrap_draft.json'));
  const fromBoot = boot ? resolveSeasonFromBootstrap(boot) : null;
  if (fromBoot) return { string: fromBoot.string, label: fromBoot.label };
  // No bootstrap (e.g. demo/sample mode): fall back to wall-clock derivation.
  return { string: getSeasonString(), label: getSeasonLabel() };
}

function archivedSeasonLabels() {
  if (!existsSync(seasonsDir)) return [];
  return readdirSync(seasonsDir)
    .filter((name) => {
      try {
        return statSync(join(seasonsDir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function main() {
  if (!existsSync(leagueDataDir)) {
    log('skip — no public/league-data/ directory.');
    return;
  }

  const season = currentSeason();
  const updatedAt = new Date().toISOString();

  writeFileSync(
    join(leagueDataDir, 'season.json'),
    JSON.stringify({ season: season.string, label: season.label, updatedAt }, null, 2),
  );

  const archived = archivedSeasonLabels();
  if (archived.length > 0 || existsSync(seasonsDir)) {
    mkdirSync(seasonsDir, { recursive: true });
    writeFileSync(
      join(seasonsDir, 'index.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          updatedAt,
          current: season.label,
          seasons: archived,
          note: 'Archived prior seasons under seasons/<label>/. Current live season is in the parent league-data/.',
        },
        null,
        2,
      ),
    );
  }

  log(
    `current season ${season.label} (${season.string}); archived: ${archived.join(', ') || '(none)'}.`,
  );
}

main();
