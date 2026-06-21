#!/usr/bin/env node
/**
 * After each league H2H gameweek finishes (per details.json), archives model outputs
 * matching the Live projections panel: XI xPts sums, xPts MC win/draw/away %, and when
 * applicable Proj MC % + projected XI totals — plus actual H2H scores for backtesting.
 *
 * Reads:  public/league-data/details.json, bootstrap_draft.json
 * Writes: public/league-data/projections-history/gw-NN.json (+ index.json)
 *
 * Fetches draft event/live + classic fixtures + per-entry picks from FPL APIs (same as
 * build-waiver-gw-analytics). Skips quietly when OFFLINE=1 or SKIP_PROJECTIONS_HISTORY=1.
 *
 * Quick test: PROJECTIONS_HISTORY_LAST_N_GWS=3 only processes the last 3 finished GWs.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MODEL_CONFIG } from 'fpl-predictions';
import { buildEffectiveLineup } from '../src/fplAutosubProjection.js';
import {
  bootstrapTeamToPredictionTeam,
  simulateFantasyH2hPercents,
  simulateFantasyH2hPercentsFromProjBlends,
  sumPredictedXpForPickRows,
  predictedStatsForPickRow,
} from '../src/livePredictionMappers.js';
import { projectedGwTotalLiveBlendForElement } from '../src/liveGwMidProjection.js';
import { defensiveContributionCountFromLiveRow } from '../src/fplBonusFromBps.js';
import { dcThresholdReached } from '../src/liveScoresDerivations.js';

const POS_MAP = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const CS_POSITIONS = new Set(['GK', 'DEF', 'MID']);
const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);

/**
 * Pre-match expected goals / assists / clean-sheet count / def-con points for a
 * starting XI, summed from the same model used for xPts. Clean sheets sum the
 * per-player CS probability over CS-eligible positions (mirrors the live Odds tab).
 */
function teamPredictedStats(starters, ctx, teamsById, gw, salt) {
  const acc = { goals: 0, assists: 0, cs: 0, defcon: 0 };
  for (let i = 0; i < starters.length; i++) {
    const s = predictedStatsForPickRow(starters[i], ctx, teamsById, gw, UI_MODEL_CONFIG, salt + i);
    if (!s) continue;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.cs += s.cs;
    acc.defcon += s.defcon;
  }
  return { goals: r1(acc.goals), assists: r1(acc.assists), cs: r1(acc.cs), defcon: r1(acc.defcon) };
}

/**
 * Actual goals / assists / clean sheets (count of CS-eligible XI keeping one) /
 * def-con points earned for a starting XI, from the draft live element stats.
 */
function teamActualStats(displayStarters, elementById, liveFullByElementId) {
  const acc = { goals: 0, assists: 0, cs: 0, defcon: 0 };
  for (const row of displayStarters) {
    const pid = Number(row.element);
    const live = liveFullByElementId[pid];
    const st = live?.stats || {};
    const pos = POS_MAP[Number(elementById[pid]?.element_type)] ?? 'MID';
    acc.goals += Number(st.goals_scored) || 0;
    acc.assists += Number(st.assists) || 0;
    if (CS_POSITIONS.has(pos) && (Number(st.clean_sheets) || 0) >= 1) acc.cs += 1;
    if (dcThresholdReached(pos, defensiveContributionCountFromLiveRow(live))) acc.defcon += 2;
  }
  return acc;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const leagueDataDir = join(__dirname, '../public/league-data');
const historyDir = join(leagueDataDir, 'projections-history');
const detailsPath = join(leagueDataDir, 'details.json');
const bootstrapPath = join(leagueDataDir, 'bootstrap_draft.json');

const DRAFT_API = 'https://draft.premierleague.com/api';
const CLASSIC_API = 'https://fantasy.premierleague.com/api';

function gwSnapshotsOnDisk() {
  if (!existsSync(historyDir)) return [];
  const out = [];
  for (const f of readdirSync(historyDir)) {
    const m = /^gw-(\d+)\.json$/.exec(f);
    if (m) out.push(Number(m[1]));
  }
  return out.filter((n) => Number.isFinite(n) && n >= 1 && n <= 38).sort((a, b) => a - b);
}

const UI_MODEL_CONFIG = {
  ...DEFAULT_MODEL_CONFIG,
  simulationIterations: 450,
};
const H2H_MONTE_CARLO_ITERS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rngFor(playerId, fixtureId) {
  let a =
    Math.imul(Number(fixtureId) || 0, 0x9e3779b9) ^
    Math.imul(Number(playerId) || 0, 0x85ebca6b);
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79fd) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sumProjForPicks(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  let sum = 0;
  for (let i = 0; i < picks.length; i++) {
    const pr = picks[i];
    const pid = Number(pr?.element);
    const elPick = ctx.elementById?.[pid];
    if (!elPick) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        elPick,
        blendCtx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        liveByEl[pid],
        rngFor(pid, 990_011 + gw + i * 31 + Math.imul(picks.length, 997)),
        320,
        Number(pr?.multiplier) || 1,
      );
      sum += blend.projFinal;
    } catch {
      return null;
    }
  }
  return sum;
}

function buildProjBlendsForPicks(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  if (!Array.isArray(picks) || picks.length !== 11) return null;
  const blends = [];
  for (let i = 0; i < 11; i++) {
    const pid = Number(picks[i]?.element);
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        el,
        blendCtx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        liveByEl[pid],
        rngFor(pid, 990_011 + gw + i * 31),
        320,
        Number(picks[i]?.multiplier) || 1,
      );
      blends.push({ projFinal: blend.projFinal, remaining: blend.remaining });
    } catch {
      return null;
    }
  }
  return blends;
}

function listFullyFinishedGameweeks(details) {
  const matches = details.matches || [];
  const byEv = new Map();
  for (const m of matches) {
    const ev = Number(m.event);
    if (!Number.isFinite(ev) || ev < 1 || ev > 38) continue;
    if (!byEv.has(ev)) byEv.set(ev, []);
    byEv.get(ev).push(m);
  }
  const out = [];
  for (const [ev, arr] of byEv) {
    if (!arr.length) continue;
    if (arr.every((x) => x.finished === true)) out.push(ev);
  }
  return out.sort((a, b) => a - b);
}

function leagueEntryRowByInternalId(details, internalLeagueEntryId) {
  return (details.league_entries || []).find(
    (e) => Number(e.id) === Number(internalLeagueEntryId),
  );
}

function fplPredictionsPkgVersion() {
  try {
    const p = join(__dirname, '../../fpl-predictions/package.json');
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return j.version ?? null;
  } catch {
    return null;
  }
}

async function fetchJson(label, url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await sleep(350 * (i + 1));
    }
  }
  throw new Error(`${label}: ${lastErr?.message || 'fetch failed'}`);
}

function liveFullByElementIdFromDraftLive(liveJson) {
  const raw = liveJson?.elements;
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = v;
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      out[id] = row;
    }
  }
  return out;
}

function pickStartersBenchFromDraftPicks(payload) {
  const picks = payload?.picks || [];
  const rows = picks.map((p) => ({
    element: Number(p.element),
    pickPosition: p.position,
  }));
  rows.sort((a, b) => a.pickPosition - b.pickPosition);
  const starters = rows.filter((r) => r.pickPosition <= 11);
  const bench = rows.filter((r) => r.pickPosition > 11);
  const autoSubs = payload.automatic_subs ?? payload.subs ?? [];
  return buildEffectiveLineup({ starters, bench, autoSubs });
}

function xiSumPointsFromLive(displayStarters, liveByPts) {
  let s = 0;
  for (const row of displayStarters) {
    const pid = Number(row.element);
    const st = liveByPts[pid];
    const pts =
      typeof st?.total_points === 'number'
        ? st.total_points
        : typeof st === 'number'
          ? st
          : null;
    if (pts != null && Number.isFinite(pts)) s += pts;
  }
  return s;
}

function formatXp(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function actualH2hWinner(p1, p2) {
  if (p1 > p2) return 'home';
  if (p2 > p1) return 'away';
  return 'draw';
}

async function main() {
  if (process.env.OFFLINE === '1' || process.env.SKIP_PROJECTIONS_HISTORY === '1') {
    console.log(
      'build-projections-history: skip (OFFLINE / SKIP_PROJECTIONS_HISTORY)',
    );
    process.exit(0);
  }

  if (!existsSync(detailsPath) || !existsSync(bootstrapPath)) {
    console.warn('build-projections-history: skip — missing details.json or bootstrap_draft.json');
    process.exit(0);
  }

  let details;
  let boot;
  try {
    details = JSON.parse(readFileSync(detailsPath, 'utf8'));
    boot = JSON.parse(readFileSync(bootstrapPath, 'utf8'));
  } catch (e) {
    console.warn('build-projections-history: parse error', e.message);
    process.exit(0);
  }

  let finishedGws = listFullyFinishedGameweeks(details);
  const lastN = Number(process.env.PROJECTIONS_HISTORY_LAST_N_GWS);
  if (Number.isFinite(lastN) && lastN > 0 && finishedGws.length > lastN) {
    finishedGws = finishedGws.slice(-lastN);
    console.log(
      `build-projections-history: PROJECTIONS_HISTORY_LAST_N_GWS=${lastN} — processing`,
      finishedGws.join(','),
    );
  }
  if (!finishedGws.length) {
    console.log('build-projections-history: no finished H2H gameweeks in details.json');
    process.exit(0);
  }

  const elementById = Object.fromEntries((boot.elements || []).map((e) => [Number(e.id), e]));
  const teamByIdObj = Object.fromEntries((boot.teams || []).map((t) => [Number(t.id), t]));
  const teamsById = new Map();
  for (const t of Object.values(teamByIdObj)) {
    const tm = bootstrapTeamToPredictionTeam(t);
    teamsById.set(tm.id, tm);
  }

  const ctxBase = {
    elementById,
    teamById: teamByIdObj,
  };

  mkdirSync(historyDir, { recursive: true });

  /** @type {number[]} */
  const written = [];
  const pkgV = fplPredictionsPkgVersion();

  for (const gw of finishedGws) {
    const outPath = join(historyDir, `gw-${String(gw).padStart(2, '0')}.json`);

    let liveJson;
    let gwFixtures;
    try {
      ;[liveJson, gwFixtures] = await Promise.all([
        fetchJson(`draft event/${gw}/live`, `${DRAFT_API}/event/${gw}/live`),
        fetchJson(`classic fixtures e=${gw}`, `${CLASSIC_API}/fixtures/?event=${gw}`),
      ]);
    } catch (e) {
      console.warn(`build-projections-history: GW ${gw} fetch failed —`, e.message);
      continue;
    }

    await sleep(140);

    const picksCacheGw = new Map();

    const fixturesList = Array.isArray(gwFixtures)
      ? gwFixtures.filter((f) => Number(f.event) === gw)
      : [];
    const plGwHasFinishedFixture = fixturesList.some(
      (f) => f?.finished === true || f?.finished_provisional === true,
    );

    const liveFullByElementId = liveFullByElementIdFromDraftLive(liveJson);
    const liveByPts = {};
    for (const [k, v] of Object.entries(liveFullByElementId)) {
      const pts = v?.stats?.total_points;
      liveByPts[Number(k)] = { total_points: typeof pts === 'number' ? pts : 0 };
    }

    const blendCtxH2h = { gwFixtures: fixturesList };

    const matchesGw = (details.matches || []).filter(
      (m) => Number(m.event) === gw && m.finished === true,
    );

    const fixturesOut = [];

    const loadPicks = async (fplEid, label) => {
      const k = `${fplEid}`;
      if (!picksCacheGw.has(k)) {
        await sleep(115);
        picksCacheGw.set(
          k,
          fetchJson(`${label} gw${gw}`, `${DRAFT_API}/entry/${fplEid}/event/${gw}`),
        );
      }
      return picksCacheGw.get(k);
    };

    for (const m of matchesGw) {
      const homeLeagueId = Number(m.league_entry_1);
      const awayLeagueId = Number(m.league_entry_2);
      const homeRow = leagueEntryRowByInternalId(details, homeLeagueId);
      const awayRow = leagueEntryRowByInternalId(details, awayLeagueId);
      const homeFpl = homeRow?.entry_id != null ? Number(homeRow.entry_id) : null;
      const awayFpl = awayRow?.entry_id != null ? Number(awayRow.entry_id) : null;
      const homeName = homeRow?.entry_name ?? `Entry ${homeLeagueId}`;
      const awayName = awayRow?.entry_name ?? `Entry ${awayLeagueId}`;
      const p1 = Number(m.league_entry_1_points);
      const p2 = Number(m.league_entry_2_points);

      if (
        !Number.isFinite(homeFpl) ||
        !Number.isFinite(awayFpl) ||
        !Number.isFinite(p1) ||
        !Number.isFinite(p2)
      ) {
        continue;
      }

      let homePayload;
      let awayPayload;
      try {
        ;[homePayload, awayPayload] = await Promise.all([
          loadPicks(homeFpl, `picks ${homeFpl}`),
          loadPicks(awayFpl, `picks ${awayFpl}`),
        ]);
      } catch (e) {
        console.warn(
          `build-projections-history: GW${gw} picks ${homeFpl}/${awayFpl} —`,
          e.message,
        );
        continue;
      }

      const homeEff = pickStartersBenchFromDraftPicks(homePayload);
      const awayEff = pickStartersBenchFromDraftPicks(awayPayload);
      const stH = homeEff.displayStarters;
      const stA = awayEff.displayStarters;

      if (!Array.isArray(stH) || stH.length !== 11 || !Array.isArray(stA) || stA.length !== 11) {
        console.warn(`build-projections-history: GW${gw} ${homeName} vs ${awayName} — not 11 starters`);
        continue;
      }

      const ctx = { ...ctxBase, gwFixtures: fixturesList };

      const homeXiXp = sumPredictedXpForPickRows(stH, ctx, teamsById, gw, UI_MODEL_CONFIG, 11);
      const awayXiXp = sumPredictedXpForPickRows(stA, ctx, teamsById, gw, UI_MODEL_CONFIG, 511);
      const homeProjXi = sumProjForPicks(stH, ctx, teamsById, gw, blendCtxH2h, liveFullByElementId);
      const awayProjXi = sumProjForPicks(stA, ctx, teamsById, gw, blendCtxH2h, liveFullByElementId);

      const rnd = rngFor(homeLeagueId, awayLeagueId);
      const pctXp = simulateFantasyH2hPercents(
        stH,
        stA,
        ctx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        rnd,
        H2H_MONTE_CARLO_ITERS,
      );

      if (!pctXp) continue;

      let pctProj = null;
      if (plGwHasFinishedFixture) {
        const hBlends = buildProjBlendsForPicks(
          stH,
          ctx,
          teamsById,
          gw,
          blendCtxH2h,
          liveFullByElementId,
        );
        const aBlends = buildProjBlendsForPicks(
          stA,
          ctx,
          teamsById,
          gw,
          blendCtxH2h,
          liveFullByElementId,
        );
        if (hBlends && aBlends) {
          pctProj = simulateFantasyH2hPercentsFromProjBlends(
            hBlends,
            aBlends,
            rnd,
            1500,
          );
        }
      }

      const actualXiHome = xiSumPointsFromLive(stH, liveByPts);
      const actualXiAway = xiSumPointsFromLive(stA, liveByPts);

      const preStatsHome = teamPredictedStats(stH, ctx, teamsById, gw, 21);
      const preStatsAway = teamPredictedStats(stA, ctx, teamsById, gw, 521);
      const actStatsHome = teamActualStats(stH, elementById, liveFullByElementId);
      const actStatsAway = teamActualStats(stA, elementById, liveFullByElementId);

      const xFavorite =
        homeXiXp > awayXiXp ? 'home' : homeXiXp < awayXiXp ? 'away' : 'draw';
      const projFavorite =
        homeProjXi != null && awayProjXi != null
          ? homeProjXi > awayProjXi
            ? 'home'
            : homeProjXi < awayProjXi
              ? 'away'
              : 'draw'
          : null;

      fixturesOut.push({
        league_entry_1: homeLeagueId,
        league_entry_2: awayLeagueId,
        teamName1: homeName,
        teamName2: awayName,
        fpl_entry_1: homeFpl,
        fpl_entry_2: awayFpl,
        actualH2hPts1: p1,
        actualH2hPts2: p2,
        /** Sum of GW live total_points over effective XI — should match league points when bench not counted. */
        actualXiPts1: actualXiHome,
        actualXiPts2: actualXiAway,
        actualWinner: actualH2hWinner(p1, p2),
        xPtsXi1: formatXp(homeXiXp),
        xPtsXi2: formatXp(awayXiXp),
        xPtsFavorite: xFavorite,
        xPtsMc: {
          homeWinPct: Math.round(pctXp.homeWinPct),
          drawPct: Math.round(pctXp.drawPct),
          awayWinPct: Math.round(pctXp.awayWinPct),
        },
        projXi1: homeProjXi != null ? Math.round(homeProjXi) : null,
        projXi2: awayProjXi != null ? Math.round(awayProjXi) : null,
        projFavorite,
        projMc:
          pctProj != null
            ? {
                homeWinPct: Math.round(pctProj.homeWinPct),
                drawPct: Math.round(pctProj.drawPct),
                awayWinPct: Math.round(pctProj.awayWinPct),
              }
            : null,
        plHadFinishedFixtureForMc: plGwHasFinishedFixture,
        autosubSourceHome: homeEff.autosubSource ?? null,
        autosubSourceAway: awayEff.autosubSource ?? null,
        /** Pre-match expected stat totals over the effective XI (schemaVersion ≥ 2). */
        xGoals1: preStatsHome.goals,
        xGoals2: preStatsAway.goals,
        xAssists1: preStatsHome.assists,
        xAssists2: preStatsAway.assists,
        xCs1: preStatsHome.cs,
        xCs2: preStatsAway.cs,
        xDefcon1: preStatsHome.defcon,
        xDefcon2: preStatsAway.defcon,
        /** Actual stat totals over the effective XI (schemaVersion ≥ 2). */
        actualGoals1: actStatsHome.goals,
        actualGoals2: actStatsAway.goals,
        actualAssists1: actStatsHome.assists,
        actualAssists2: actStatsAway.assists,
        actualCs1: actStatsHome.cs,
        actualCs2: actStatsAway.cs,
        actualDefcon1: actStatsHome.defcon,
        actualDefcon2: actStatsAway.defcon,
      });
    }

    const snapshot = {
      schemaVersion: 2,
      gameweek: gw,
      generatedAt: new Date().toISOString(),
      leagueId: Number(details.league?.id) || null,
      leagueName: details.league?.name ?? null,
      disclaimer:
        'Built with bootstrap + model at generation time — not a replay of historical priors.',
      model: {
        simulationIterations: UI_MODEL_CONFIG.simulationIterations,
        h2hMonteCarloItersXp: H2H_MONTE_CARLO_ITERS,
        h2hMonteCarloItersProj: 1500,
        fplPredictionsSemver: pkgV,
      },
      fixtures: {
        classicPlGameweek: gw,
        plGwHadFinishedFixture: plGwHasFinishedFixture,
        fixtureCount: fixturesList.length,
      },
      h2h: fixturesOut,
    };

    writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    written.push(gw);
    console.log(
      `build-projections-history: GW ${gw} → ${fixturesOut.length} fixture row(s) → ${outPath.split('/').pop()}`,
    );
  }

  const indexPath = join(historyDir, 'index.json');
  const allOnDisk = gwSnapshotsOnDisk();
  writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        gameweeks: allOnDisk,
        note: 'Maps to projections-history/gw-NN.json; regenerate via npm run build or node scripts/build-projections-history.mjs',
      },
      null,
      2,
    ),
  );
  console.log(
    `build-projections-history: this run updated ${written.length} GW file(s); index lists ${allOnDisk.length} snapshot(s):`,
    allOnDisk.join(', ') || '(none)',
  );
}

main().catch((e) => {
  console.error('build-projections-history FATAL:', e);
  process.exit(1);
});
