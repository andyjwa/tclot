#!/usr/bin/env node
/**
 * Validation harness for the Pulselive Prem-window source.
 *
 * Picks a finished GW (default: most recent fully-finished), then for every fixture in
 * that GW calls Pulselive directly (with the same `Account: premierleague` headers the
 * worker would add in production) and pipes the responses through the parsers / team-map
 * helpers. Prints a per-fixture report and overall coverage stats so we can confirm:
 *
 *   - All 20 PL teams resolve in the team→FPL map
 *   - Every FPL fixture in the GW maps to a Pulselive fixture id
 *   - Both XIs are marked `confirmed: true` for finished games (sanity)
 *   - Every player on every team sheet resolves to an FPL elementId via the shared
 *     `matchFplElementId` helper used by ESPN today
 *
 * Sofascore was evaluated and rejected: its CDN (Varnish) returns HTTP 403 to any
 * non-real-browser client regardless of headers or origin — same from Node/curl on a
 * residential IP AND from a Cloudflare Worker. See PR description for details.
 *
 * Usage:
 *   node scripts/validate-lineup-sources.mjs           # most recent finished GW
 *   node scripts/validate-lineup-sources.mjs --gw 36   # specific GW
 *   node scripts/validate-lineup-sources.mjs --json    # machine-readable output
 *
 * Reads:  public/league-data/fixtures.json + bootstrap_draft.json
 * Writes: nothing (stdout only)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectPulseliveFixtures,
  findPulseliveMatchForFixture,
  harvestTeams as harvestPulseTeams,
  mapPulseliveTeamsToFpl,
  pickCurrentCompSeasonId,
  PL_COMP_ID,
} from '../src/pulselivePremTimeline.js';
import {
  parsePulseliveEvents,
  parsePulseliveLineups,
  parsePulseliveScore,
} from '../src/pulselivePremWindow.js';

import { enrichWithFplElements } from '../src/fotmobPremWindow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const leagueDataDir = join(__dirname, '../public/league-data');

const PULSELIVE_API = 'https://footballapi.pulselive.com/football';

const PULSE_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://www.premierleague.com',
  Referer: 'https://www.premierleague.com/',
  Account: 'premierleague',
  'User-Agent': 'TCLOT-lineup-validate/1.0',
};

function parseArgs(argv) {
  const out = { gw: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--gw' && argv[i + 1]) {
      out.gw = Number(argv[++i]);
    } else if (argv[i] === '--json') {
      out.json = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(
        'Usage: validate-lineup-sources.mjs [--gw N] [--json]\nDefaults to the most recent fully-finished GW.',
      );
      process.exit(0);
    }
  }
  return out;
}

function readJson(name) {
  return JSON.parse(readFileSync(join(leagueDataDir, name), 'utf8'));
}

function pickGw(fixtures, requested) {
  /** Build { gw → { total, finished } } from fixtures.json. */
  const byGw = new Map();
  for (const f of fixtures) {
    const gw = Number(f.event);
    if (!Number.isFinite(gw)) continue;
    const row = byGw.get(gw) || { gw, total: 0, finished: 0 };
    row.total++;
    if (f.finished) row.finished++;
    byGw.set(gw, row);
  }
  if (requested != null) {
    const row = byGw.get(requested);
    if (!row) throw new Error(`GW ${requested} not found in fixtures.json`);
    return row;
  }
  const finished = [...byGw.values()]
    .filter((r) => r.finished === r.total && r.total > 0)
    .sort((a, b) => b.gw - a.gw);
  if (!finished.length) throw new Error('No fully-finished GW found');
  return finished[0];
}

async function fetchJson(url, headers, label) {
  const r = await fetch(url, { headers });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`${label} HTTP ${r.status} — ${body.slice(0, 200)}`);
  }
  return r.json();
}

async function validatePulselive(gwFixtures, teamById, elementById) {
  if (!gwFixtures.length) {
    return { teamMapSize: 0, perFixture: [], listError: 'no fixtures' };
  }

  /** Discover the current compSeasons id — fromDate/toDate are silently ignored. */
  let compSeasonId = null;
  try {
    const seasonsJson = await fetchJson(
      `${PULSELIVE_API}/competitions/${PL_COMP_ID}/compseasons?page=0&pageSize=10`,
      PULSE_HEADERS,
      'Pulselive compseasons',
    );
    const kickoffMs = Date.parse(String(gwFixtures[0]?.kickoff_time || ''));
    compSeasonId = pickCurrentCompSeasonId(
      seasonsJson,
      Number.isFinite(kickoffMs) ? kickoffMs : null,
    );
  } catch (e) {
    return { teamMapSize: 0, perFixture: [], listError: e?.message || String(e) };
  }
  if (!compSeasonId) {
    return { teamMapSize: 0, perFixture: [], listError: 'could not resolve compSeasons' };
  }

  let listJson;
  try {
    const q = `${PULSELIVE_API}/fixtures?comps=${PL_COMP_ID}&compSeasons=${compSeasonId}&page=0&pageSize=400&sort=asc&statuses=U,L,C`;
    listJson = await fetchJson(q, PULSE_HEADERS, 'Pulselive fixtures list');
  } catch (e) {
    return { teamMapSize: 0, perFixture: [], listError: e?.message || String(e) };
  }

  const pulseFixtures = collectPulseliveFixtures(listJson);
  const pulseTeams = harvestPulseTeams(listJson);
  const pulseToFpl = mapPulseliveTeamsToFpl(teamById, pulseTeams);

  const perFixture = [];
  for (const fx of gwFixtures) {
    const match = findPulseliveMatchForFixture(fx, pulseToFpl, pulseFixtures);
    if (!match) {
      perFixture.push({ fx, status: 'no-match', error: null });
      continue;
    }

    let fixtureJson;
    let err = null;
    try {
      fixtureJson = await fetchJson(
        `${PULSELIVE_API}/fixtures/${match.fixtureId}`,
        PULSE_HEADERS,
        `Pulselive fixtures/${match.fixtureId}`,
      );
    } catch (e) {
      err = e?.message || String(e);
    }
    const lineups = fixtureJson
      ? parsePulseliveLineups(fixtureJson, fx, pulseToFpl)
      : null;
    const events = fixtureJson ? parsePulseliveEvents(fixtureJson, fx, pulseToFpl) : [];
    const score = fixtureJson ? parsePulseliveScore(fixtureJson, fx, pulseToFpl) : null;
    const enriched = lineups
      ? enrichWithFplElements({
          fplFixture: fx,
          events,
          lineups,
          elementById,
        })
      : { events, lineups: null };
    perFixture.push({
      fx,
      status: lineups ? (lineups.home.confirmed ? 'confirmed' : 'unconfirmed') : 'no-data',
      pulseliveFixtureId: match.fixtureId,
      lineups: enriched.lineups,
      events: enriched.events,
      score,
      error: err,
    });
  }

  return {
    teamMapSize: pulseToFpl.size,
    teamsScanned: pulseTeams.length,
    perFixture,
  };
}

/** Count how many `xi+bench` entries have a resolved FPL `elementId`. */
function lineupResolutionStats(lineups) {
  if (!lineups) return { total: 0, resolved: 0 };
  let total = 0;
  let resolved = 0;
  for (const side of [lineups.home, lineups.away]) {
    for (const p of [...(side?.xi || []), ...(side?.bench || [])]) {
      total++;
      if (p?.elementId != null && Number.isFinite(Number(p.elementId))) resolved++;
    }
  }
  return { total, resolved };
}

/** Player rows that didn't resolve to an FPL id — useful to spot rename / accent issues. */
function unresolvedPlayers(lineups, _label) {
  if (!lineups) return [];
  const out = [];
  for (const sideName of ['home', 'away']) {
    const side = lineups[sideName];
    for (const p of [...(side?.xi || []), ...(side?.bench || [])]) {
      if (p?.elementId == null || !Number.isFinite(Number(p.elementId))) {
        out.push({
          side: sideName,
          name: p?.name,
          shirt: p?.shirt,
          pos: p?.usualPosition,
        });
      }
    }
  }
  return out;
}

function teamLabel(fx, teamById) {
  const h = teamById[fx.team_h]?.short_name || `T${fx.team_h}`;
  const a = teamById[fx.team_a]?.short_name || `T${fx.team_a}`;
  return `${h} v ${a}`;
}

function pct(n, d) {
  if (d === 0) return '—';
  return `${((n / d) * 100).toFixed(0)}%`;
}

async function main() {
  const args = parseArgs(process.argv);
  const fixtures = readJson('fixtures.json');
  const bootstrap = readJson('bootstrap_draft.json');

  const teamById = Object.fromEntries(
    (bootstrap.teams || []).map((t) => [Number(t.id), t]),
  );
  const elementById = Object.fromEntries(
    (bootstrap.elements || []).map((e) => [Number(e.id), e]),
  );

  const gwInfo = pickGw(fixtures, args.gw);
  const gwFixtures = fixtures.filter(
    (f) => Number(f.event) === gwInfo.gw && f.kickoff_time,
  );

  if (!args.json) {
    console.log(
      `\n→ GW${gwInfo.gw}  (${gwInfo.finished}/${gwInfo.total} finished)  ${gwFixtures.length} fixtures\n`,
    );
  }

  const pulse = await validatePulselive(gwFixtures, teamById, elementById);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          gw: gwInfo.gw,
          fixtureCount: gwFixtures.length,
          pulse,
        },
        null,
        2,
      ),
    );
    return;
  }

  const dashes = '─'.repeat(80);

  console.log(`Pulselive team-mapping: ${pulse.teamMapSize}/20 PL teams resolved`);
  if (pulse.listError) console.log(`Pulselive fixtures list error: ${pulse.listError}`);
  console.log(dashes);
  console.log('Fixture'.padEnd(14) + 'Pulselive'.padEnd(34));
  console.log(dashes);

  const pulseByFxId = new Map(pulse.perFixture.map((r) => [Number(r.fx.id), r]));

  const allUnresolved = [];

  let pulseConfirmed = 0;
  let pulseResolveTotal = 0;
  let pulseResolveHits = 0;
  let evTotal = 0;
  let evIdHits = 0;
  let scoreOk = 0;

  for (const fx of gwFixtures) {
    const pl = pulseByFxId.get(Number(fx.id));
    const pStats = lineupResolutionStats(pl?.lineups);
    pulseResolveTotal += pStats.total;
    pulseResolveHits += pStats.resolved;
    if (pl?.status === 'confirmed') pulseConfirmed++;

    const evs = Array.isArray(pl?.events) ? pl.events : [];
    evTotal += evs.length;
    for (const e of evs) {
      if (e?.elementId != null && Number.isFinite(Number(e.elementId))) evIdHits++;
    }
    const hasScore =
      pl?.score && (pl.score.homeScore != null || pl.score.awayScore != null);
    if (hasScore) scoreOk++;

    const pLabel = pl
      ? `${pl.status} ${pStats.resolved}/${pStats.total} ids · ${evs.length} ev`
      : 'missing';
    const scoreLabel = pl?.score
      ? `  ${pl.score.homeScore ?? '-'}-${pl.score.awayScore ?? '-'} ${pl.score.statusText ?? ''}`
      : '';
    console.log(teamLabel(fx, teamById).padEnd(14) + pLabel.padEnd(36) + scoreLabel);

    if (pl?.error) console.log(`   pulse-error: ${pl.error}`);

    allUnresolved.push(...unresolvedPlayers(pl?.lineups, 'pulse'));
  }

  console.log(dashes);
  console.log(`Confirmed XIs:    pulse ${pulseConfirmed}/${gwFixtures.length}`);
  console.log(
    `Lineup id hit:    pulse ${pulseResolveHits}/${pulseResolveTotal} (${pct(pulseResolveHits, pulseResolveTotal)})`,
  );
  console.log(
    `Events id hit:    pulse ${evIdHits}/${evTotal} (${pct(evIdHits, evTotal)})`,
  );
  console.log(`Scores parsed:    pulse ${scoreOk}/${gwFixtures.length}`);

  if (allUnresolved.length) {
    console.log(dashes);
    console.log(`Unresolved players (${allUnresolved.length}):`);
    for (const u of allUnresolved.slice(0, 40)) {
      console.log(
        `  ${u.side.padEnd(5)} #${String(u.shirt ?? '?').padEnd(3)} ${u.pos ?? '  '} ${u.name}`,
      );
    }
    if (allUnresolved.length > 40) {
      console.log(`  …and ${allUnresolved.length - 40} more`);
    }
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
