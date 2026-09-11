/**
 * TCLOT bookie — fake-money betting for the Draft H2H league.
 *
 * Markets are priced by the site's own prediction model: the deploy pipeline
 * writes league-data/bookie-markets.json (build-bookie-markets.mjs) and this
 * Worker ingests it into D1 — weekly H2H (home/draw/away) markets open until
 * the FPL gameweek deadline, per-matchup player specials (anytime goalscorer
 * and top point scorer, graded from the draft live feed with the no-play
 * void rule), plus season-long champion / Titan / Minnow / last-place boards
 * that reprice after every banked gameweek. Bets lock their odds at bet time.
 *
 * Settlement reads the official FPL Draft league results directly (same
 * "effectively finished" rule as web/src/h2hEffectiveFinished.js: a GW counts
 * as final once every Premier League fixture for it is finished or
 * provisionally finished, or FPL's bootstrap `events[].finished` flag is
 * already true), grades bets, credits payouts, and pays a weekly stipend
 * only when a bankroll is below 250 Clotcoins so a busted book can come
 * back — healthy balances are left alone.
 *
 * Identity is honor-system-with-a-lock: each manager claims their league
 * entry once with a PIN (PBKDF2-hashed); sessions are HMAC-signed tokens.
 *
 * Endpoints (JSON):
 *   GET  /api/health
 *   GET  /api/state        — markets, leaderboard, weekly P/L, everyone's
 *                            open + settled bets (+ me with auth)
 *   POST /api/register     — { entryId, pin }
 *   POST /api/login        — { entryId, pin }
 *   POST /api/bets         — { marketId, selection, stake } (Bearer auth)
 *   GET  /api/cashout      — live cash-out quotes for my open bets (auth)
 *   POST /api/cashout      — { betId, quote? } take the money (auth)
 *   POST /api/side-bets    — { opponentId, stake, sentence } offer (auth)
 *   POST /api/side-bets/:id/accept|decline|cancel|propose|confirm|reject
 *
 * Deploy: cd web/workers/bookie && npm run deploy  (see README.md for setup)
 */

import { footballComplete, footballOfficial, finishedEventIdsFromEvents, h2hResultForMarket, playerMarketOutcome, ranksFromMatches, seasonKindWinners, desiredBetGrade, creditedPayout, PLAYER_MARKET_KINDS, SEASON_MARKET_KINDS } from './settlement.js';
import { CASHOUT_MARGIN, cashoutValue, remainingFraction, liveH2hProbs } from './cashout.js';
import { applyFreshStart } from './freshStart.js';
import { PAY_STIPEND_SQL, STIPEND_FLOOR } from './stipend.js';
import {
  SIDE_MAX_STAKE,
  SIDE_MIN_STAKE,
  SIDE_SENTENCE_MAX,
  SIDE_SENTENCE_MIN,
  mergeSideBetLedger,
  normalizeSentence,
  parseStake,
  planSideAction,
  publicSideBet,
} from './sideBets.js';

const STARTING_BALANCE = 1000;
const WEEKLY_STIPEND = 50;
const MIN_STAKE = 10;
const PIN_ITERATIONS = 100_000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const SYNC_THROTTLE_MS = 1000 * 60 * 5;
const DRAFT_API = 'https://draft.premierleague.com/api';
const CLASSIC_API = 'https://fantasy.premierleague.com/api';

/* ------------------------------------------------------------------ */
/* Small utilities                                                      */
/* ------------------------------------------------------------------ */

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin');
  const allow = env.ALLOW_ORIGIN?.trim() || origin || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, ch) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...ch, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorJson(message, status, ch) {
  return json({ error: message }, status, ch);
}

const enc = new TextEncoder();

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hashPin(pin, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PIN_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(bits);
}

async function hmacSign(payloadB64, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  return bytesToHex(sig);
}

async function makeSessionToken(entryId, season, secret) {
  const payloadB64 = b64urlEncode(
    JSON.stringify({ e: Number(entryId), s: season, x: Date.now() + SESSION_TTL_MS }),
  );
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/** Verified session `{ entryId, season }` from the Authorization header, or null. */
async function sessionFromRequest(request, env) {
  const secret = env.SESSION_SECRET;
  if (!secret) return null;
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return null;
  const [payloadB64, sig] = m[1].split('.');
  if (!payloadB64 || !sig) return null;
  const expected = await hmacSign(payloadB64, secret);
  if (sig !== expected) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return null;
  }
  if (!payload || typeof payload.x !== 'number' || payload.x < Date.now()) return null;
  if (!Number.isFinite(Number(payload.e)) || typeof payload.s !== 'string') return null;
  return { entryId: Number(payload.e), season: payload.s };
}

async function fetchJson(url, init) {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'TCLOT-bookie/1.0' },
    ...init,
  });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

/* ------------------------------------------------------------------ */
/* Meta key/value helpers                                               */
/* ------------------------------------------------------------------ */

async function metaGet(db, k) {
  const row = await db.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first();
  return row ? row.v : null;
}

async function metaSet(db, k, v) {
  await db
    .prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .bind(k, String(v))
    .run();
}

/* ------------------------------------------------------------------ */
/* Market ingestion — bookie-markets.json → D1 rows                     */
/* ------------------------------------------------------------------ */

/**
 * Pull the model-priced market sheet from the deployed site and open any
 * markets that don't exist yet. Weekly H2H odds freeze at ingestion (the
 * sheet is rebuilt on every deploy, but a market that is already open keeps
 * its board — bets locked odds at bet time anyway). The outright board *is*
 * repriced on every sync while it stays open, because its odds should track
 * the Predictions tab week to week.
 */
async function ingestMarkets(env) {
  const base = (env.SITE_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return;
  const sheet = await fetchJson(`${base}/league-data/bookie-markets.json`, {
    cf: { cacheTtl: 0 },
  });
  const season = sheet?.season;
  if (!season) return;
  const db = env.DB;
  const nowMs = Date.now();

  if (sheet.weekly && Array.isArray(sheet.weekly.matches)) {
    const closesAtMs = Date.parse(sheet.weekly.deadline);
    if (Number.isFinite(closesAtMs) && closesAtMs > nowMs) {
      for (const m of sheet.weekly.matches) {
        const marketKey = `${season}:${m.key}`;
        const payload = JSON.stringify({
          gw: m.gw,
          homeEntryId: m.homeEntryId,
          awayEntryId: m.awayEntryId,
          homeName: m.homeName,
          awayName: m.awayName,
          odds: m.odds,
          probs: m.probs,
        });
        await db
          .prepare(
            `INSERT INTO markets (season, market_key, kind, gw, closes_at_ms, status, payload)
             VALUES (?, ?, 'h2h', ?, ?, 'open', ?)
             ON CONFLICT(market_key) DO NOTHING`,
          )
          .bind(season, marketKey, Number(m.gw), closesAtMs, payload)
          .run();
      }
    }
  }

  // Player specials freeze like the weekly board: first print wins, later
  // rebuilds never reprice an already-open market.
  if (sheet.players && Array.isArray(sheet.players.markets)) {
    const closesAtMs = Date.parse(sheet.players.deadline);
    if (Number.isFinite(closesAtMs) && closesAtMs > nowMs) {
      for (const m of sheet.players.markets) {
        if (!PLAYER_MARKET_KINDS.includes(m.kind)) continue;
        const marketKey = `${season}:${m.key}`;
        const payload = JSON.stringify({
          gw: m.gw,
          homeEntryId: m.homeEntryId,
          awayEntryId: m.awayEntryId,
          homeName: m.homeName,
          awayName: m.awayName,
          selections: m.selections,
        });
        await db
          .prepare(
            `INSERT INTO markets (season, market_key, kind, gw, closes_at_ms, status, payload)
             VALUES (?, ?, ?, ?, ?, 'open', ?)
             ON CONFLICT(market_key) DO NOTHING`,
          )
          .bind(season, marketKey, m.kind, Number(m.gw), closesAtMs, payload)
          .run();
      }
    }
  }

  for (const kind of SEASON_MARKET_KINDS) {
    const block = sheet[kind];
    if (!block || !Array.isArray(block.selections) || block.selections.length === 0) continue;
    const marketKey = `${season}:${kind}`;
    const closesAtMs = Date.parse(block.closesAt ?? '') || nowMs + 400 * 24 * 3600 * 1000;
    const payload = JSON.stringify({
      asOfGw: block.asOfGw ?? null,
      selections: block.selections,
    });
    await db
      .prepare(
        `INSERT INTO markets (season, market_key, kind, gw, closes_at_ms, status, payload)
         VALUES (?, ?, ?, NULL, ?, 'open', ?)
         ON CONFLICT(market_key) DO UPDATE SET
           payload = excluded.payload,
           closes_at_ms = excluded.closes_at_ms
         WHERE markets.status = 'open'`,
      )
      .bind(season, marketKey, kind, closesAtMs, payload)
      .run();
  }

  await metaSet(db, 'currentSeason', season);
}

/* ------------------------------------------------------------------ */
/* Settlement — official FPL results → graded bets                      */
/* (pure grading rules live in settlement.js so node:test can cover them) */
/* ------------------------------------------------------------------ */

/**
 * Bring every gradeable ticket on a market in line with `winningSelection`.
 * Idempotent: open bets settle, and a provisionally-settled bet is re-graded
 * (balance delta applied) when bonus later flips the result. Cashed-out
 * tickets are left alone — those already exited. Selections in
 * `voidedSelections` (player specials: no minutes) refund their stake.
 */
async function gradeBets(db, market, winningSelection, voidedSelections = null) {
  const winners =
    winningSelection == null
      ? null
      : winningSelection instanceof Set
        ? winningSelection
        : new Set([String(winningSelection)]);
  const bets = await db
    .prepare(
      `SELECT * FROM bets WHERE market_id = ? AND status IN ('open', 'won', 'lost', 'void')`,
    )
    .bind(market.id)
    .all();
  const nowIso = new Date().toISOString();
  for (const bet of bets.results ?? []) {
    const desired = desiredBetGrade(bet, winners, voidedSelections);
    if (bet.status === desired.status && Number(bet.payout) === Number(desired.payout)) continue;
    const delta = creditedPayout(desired) - creditedPayout(bet);
    const stmts = [
      db
        .prepare(`UPDATE bets SET status = ?, payout = ?, settled_at = ? WHERE id = ?`)
        .bind(desired.status, desired.payout, nowIso, bet.id),
    ];
    if (delta !== 0) {
      stmts.push(
        db
          .prepare(`UPDATE users SET balance = balance + ? WHERE entry_id = ? AND season = ?`)
          .bind(delta, bet.entry_id, bet.season),
      );
    }
    await db.batch(stmts);
  }
}

function parseMarketPayload(market) {
  try {
    return JSON.parse(market.payload);
  } catch {
    return {};
  }
}

function marketIsLocked(market) {
  return parseMarketPayload(market).locked === true;
}

/**
 * Settle every due market: H2H markets whose gameweek's football is complete,
 * and the outright once all league matches are final. After a gameweek fully
 * settles, anyone whose bankroll is below 250 gets the stipend (once)
 * so a busted book can come back — sit-outs above the floor are not paid.
 *
 * Weekly markets grade as soon as the football is effectively finished, then
 * stay unlocked until FPL's official finish (H2H `match.finished`, or every
 * PL fixture `finished` for player specials). Bonus can flip a one-point
 * scoreline in that gap — unlocked markets are re-read and re-graded.
 */
async function settleDue(env) {
  const db = env.DB;
  const nowMs = Date.now();
  const due = await db
    .prepare(`SELECT * FROM markets WHERE status = 'open' AND closes_at_ms < ?`)
    .bind(nowMs)
    .all();
  const dueMarkets = due.results ?? [];
  const settledWeekly = await db
    .prepare(
      `SELECT * FROM markets WHERE status = 'settled' AND kind IN ('h2h', 'scorer', 'toppoints')`,
    )
    .all();
  const unlockedWeekly = (settledWeekly.results ?? []).filter((m) => !marketIsLocked(m));
  const h2hDue = [
    ...dueMarkets.filter((m) => m.kind === 'h2h'),
    ...unlockedWeekly.filter((m) => m.kind === 'h2h'),
  ];
  const playerDue = [
    ...dueMarkets.filter((m) => PLAYER_MARKET_KINDS.includes(m.kind)),
    ...unlockedWeekly.filter((m) => PLAYER_MARKET_KINDS.includes(m.kind)),
  ];
  const seasonDue = dueMarkets.filter((m) => SEASON_MARKET_KINDS.includes(m.kind));
  if (h2hDue.length === 0 && playerDue.length === 0 && seasonDue.length === 0) return;

  const leagueId = String(env.LEAGUE_ID || '').trim();
  if (!leagueId) return;
  let details;
  try {
    details = await fetchJson(`${DRAFT_API}/league/${leagueId}/details`);
  } catch {
    return; // FPL down — try again on the next sync
  }
  const matches = details?.matches ?? [];
  const nowIso = new Date().toISOString();

  let extraFinishedGws = new Set();
  try {
    const boot = await fetchJson(`${DRAFT_API}/bootstrap-static`);
    extraFinishedGws = finishedEventIdsFromEvents(boot);
  } catch {
    /* bootstrap down — fall back to fixtures-only complete */
  }

  const gws = [...new Set([...h2hDue, ...playerDue].map((m) => Number(m.gw)))].sort(
    (a, b) => a - b,
  );
  for (const gw of gws) {
    let fixtures;
    try {
      fixtures = await fetchJson(`${CLASSIC_API}/fixtures/?event=${gw}`);
    } catch {
      // Still settle if FPL already marked the event finished even when
      // fixtures.json is unreachable (same extraFinishedGws union as the site).
      if (!extraFinishedGws.has(gw)) continue;
      fixtures = [];
    }
    const complete = footballComplete(fixtures, gw, extraFinishedGws);
    const officialFootball = footballOfficial(fixtures, gw);
    for (const market of h2hDue.filter((m) => Number(m.gw) === gw)) {
      const payload = parseMarketPayload(market);
      const match = matches.find(
        (m) =>
          Number(m.event) === gw &&
          ((Number(m.league_entry_1) === Number(payload.homeEntryId) &&
            Number(m.league_entry_2) === Number(payload.awayEntryId)) ||
            (Number(m.league_entry_1) === Number(payload.awayEntryId) &&
              Number(m.league_entry_2) === Number(payload.homeEntryId))),
      );
      const official = match?.finished === true;
      const finished = match && (official || (complete && match.started === true));
      if (!finished) continue;
      const outcome = h2hResultForMarket(payload, match);
      if (!outcome) continue;
      const already =
        market.status === 'settled' &&
        market.result === outcome.result &&
        (payload.locked === true) === official;
      if (already && payload.locked === true) continue;
      await db
        .prepare(
          `UPDATE markets SET status = 'settled', result = ?, settled_at = ?,
             payload = ? WHERE id = ?`,
        )
        .bind(
          outcome.result,
          nowIso,
          JSON.stringify({
            ...payload,
            finalScore: { home: outcome.home, away: outcome.away },
            locked: official,
          }),
          market.id,
        )
        .run();
      await gradeBets(db, market, outcome.result);
    }

    // Player specials wait for the whole gameweek's football, then grade
    // from the draft live feed (per-player minutes, goals and points).
    const playerMarkets = playerDue.filter((m) => Number(m.gw) === gw);
    if (complete && playerMarkets.length > 0) {
      let liveElements = null;
      try {
        const live = await fetchJson(`${DRAFT_API}/event/${gw}/live`);
        liveElements = live?.elements ?? null;
      } catch {
        /* live feed down — retry these markets on the next sync */
      }
      if (liveElements) {
        for (const market of playerMarkets) {
          const payload = parseMarketPayload(market);
          const outcome = playerMarketOutcome(market.kind, payload.selections ?? [], liveElements);
          if (!outcome) continue;
          const result = [...outcome.winners].join(',');
          if (market.status === 'settled' && market.result === result && payload.locked === true) {
            continue;
          }
          await db
            .prepare(
              `UPDATE markets SET status = 'settled', result = ?, settled_at = ?,
                 payload = ? WHERE id = ?`,
            )
            .bind(
              result,
              nowIso,
              JSON.stringify({
                ...payload,
                voided: [...outcome.voided],
                ...(outcome.topScore != null ? { topScore: outcome.topScore } : {}),
                locked: officialFootball,
              }),
              market.id,
            )
            .run();
          await gradeBets(db, market, outcome.winners, outcome.voided);
        }
      }
    }

    // Stipend: once per gameweek, after every H2H market for it has settled.
    // Only bankrolls that have fallen below the floor — not a +50 free roll
    // for anyone still sitting on a healthy stack.
    const remaining = await db
      .prepare(`SELECT COUNT(*) AS n FROM markets WHERE kind = 'h2h' AND gw = ? AND status = 'open'`)
      .bind(gw)
      .first();
    if (Number(remaining?.n) === 0) {
      const season =
        h2hDue.find((m) => Number(m.gw) === gw)?.season ??
        dueMarkets.find((m) => m.kind === 'h2h' && Number(m.gw) === gw)?.season;
      const stipendKey = `stipend:${season}:${gw}`;
      if (season && !(await metaGet(db, stipendKey))) {
        await db
          .prepare(PAY_STIPEND_SQL)
          .bind(WEEKLY_STIPEND, season, STIPEND_FLOOR)
          .run();
        await metaSet(db, stipendKey, nowIso);
      }
    }
  }

  const ranked = ranksFromMatches(matches);
  for (const market of seasonDue) {
    const winners = seasonKindWinners(market.kind, ranked);
    if (!winners || winners.size === 0) continue;
    await db
      .prepare(`UPDATE markets SET status = 'settled', result = ?, settled_at = ? WHERE id = ?`)
      .bind([...winners].join(','), nowIso, market.id)
      .run();
    await gradeBets(db, market, winners);
  }
}

/**
 * Ingest is cheap (one JSON fetch + a handful of INSERTs) and must run on
 * the request that would otherwise serve a stale board — the deploy warm
 * at #79 printed H2H before Vercel had written the player sheet, then the
 * 5-minute throttle hid the specials until someone waited out the cron.
 * Settlement still talks to FPL, so that stays throttled.
 */
async function ingestNow(env) {
  try {
    await ingestMarkets(env);
  } catch (e) {
    console.warn('bookie: ingest failed', e.message);
  }
}

async function settleNow(env, { force = false } = {}) {
  const db = env.DB;
  if (!force) {
    const last = Number(await metaGet(db, 'lastSyncAtMs')) || 0;
    if (Date.now() - last < SYNC_THROTTLE_MS) return;
  }
  await metaSet(db, 'lastSyncAtMs', Date.now());
  try {
    await settleDue(env);
  } catch (e) {
    console.warn('bookie: settle failed', e.message);
  }
}

/** Cron / first-boot: ingest then settle. */
async function syncNow(env, { force = false } = {}) {
  await ingestNow(env);
  await settleNow(env, { force });
}

/* ------------------------------------------------------------------ */
/* Roster — who is allowed to register                                  */
/* ------------------------------------------------------------------ */

/** League roster from the outright market payload: entryId → name. */
async function rosterForSeason(db, season) {
  const market = await db
    .prepare(`SELECT payload FROM markets WHERE market_key = ?`)
    .bind(`${season}:outright`)
    .first();
  if (!market) return null;
  try {
    const payload = JSON.parse(market.payload);
    return new Map(
      (payload.selections ?? []).map((s) => [Number(s.entryId), String(s.name)]),
    );
  } catch {
    return null;
  }
}

async function currentSeason(db) {
  return metaGet(db, 'currentSeason');
}

/* ------------------------------------------------------------------ */
/* Route handlers                                                       */
/* ------------------------------------------------------------------ */

async function handleRegister(request, env, ch) {
  const body = await request.json().catch(() => null);
  const entryId = Number(body?.entryId);
  const pin = String(body?.pin ?? '');
  if (!Number.isFinite(entryId) || !/^\d{4,8}$/.test(pin)) {
    return errorJson('entryId and a 4–8 digit pin are required', 400, ch);
  }
  if (!env.SESSION_SECRET) return errorJson('worker missing SESSION_SECRET', 500, ch);
  const db = env.DB;
  const season = await currentSeason(db);
  if (!season) return errorJson('markets not ingested yet — try again shortly', 503, ch);
  const roster = await rosterForSeason(db, season);
  if (!roster || !roster.has(entryId)) {
    return errorJson('unknown league entry', 400, ch);
  }
  const existing = await db
    .prepare(`SELECT entry_id FROM users WHERE entry_id = ? AND season = ?`)
    .bind(entryId, season)
    .first();
  if (existing) return errorJson('this team is already claimed — log in with its PIN', 409, ch);

  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPin(pin, salt);
  await db
    .prepare(
      `INSERT INTO users (entry_id, season, name, pin_hash, pin_salt, balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(entryId, season, roster.get(entryId), hash, salt, STARTING_BALANCE, new Date().toISOString())
    .run();
  const token = await makeSessionToken(entryId, season, env.SESSION_SECRET);
  return json({ token, entryId, season, name: roster.get(entryId), balance: STARTING_BALANCE }, 200, ch);
}

async function handleLogin(request, env, ch) {
  const body = await request.json().catch(() => null);
  const entryId = Number(body?.entryId);
  const pin = String(body?.pin ?? '');
  if (!Number.isFinite(entryId) || pin.length === 0) {
    return errorJson('entryId and pin are required', 400, ch);
  }
  if (!env.SESSION_SECRET) return errorJson('worker missing SESSION_SECRET', 500, ch);
  const db = env.DB;
  const season = await currentSeason(db);
  if (!season) return errorJson('markets not ingested yet — try again shortly', 503, ch);
  const user = await db
    .prepare(`SELECT * FROM users WHERE entry_id = ? AND season = ?`)
    .bind(entryId, season)
    .first();
  if (!user) return errorJson('team not registered yet', 404, ch);
  const hash = await hashPin(pin, user.pin_salt);
  if (hash !== user.pin_hash) return errorJson('wrong PIN', 401, ch);
  const token = await makeSessionToken(entryId, season, env.SESSION_SECRET);
  return json({ token, entryId, season, name: user.name, balance: user.balance }, 200, ch);
}

async function handlePlaceBet(request, env, ch) {
  const session = await sessionFromRequest(request, env);
  if (!session) return errorJson('login required', 401, ch);
  const body = await request.json().catch(() => null);
  const marketId = Number(body?.marketId);
  const selection = String(body?.selection ?? '');
  const stake = Number(body?.stake);
  if (!Number.isFinite(marketId) || !selection) {
    return errorJson('marketId and selection are required', 400, ch);
  }
  if (!Number.isInteger(stake) || stake < MIN_STAKE) {
    return errorJson(`stake must be a whole number of at least ${MIN_STAKE} coins`, 400, ch);
  }
  const db = env.DB;
  const market = await db.prepare(`SELECT * FROM markets WHERE id = ?`).bind(marketId).first();
  if (!market || market.season !== session.season) return errorJson('unknown market', 404, ch);
  if (market.status !== 'open' || market.closes_at_ms <= Date.now()) {
    return errorJson('market is closed', 409, ch);
  }
  const payload = JSON.parse(market.payload);
  let odds = null;
  if (market.kind === 'h2h') {
    if (!['home', 'draw', 'away'].includes(selection)) {
      return errorJson('selection must be home, draw or away', 400, ch);
    }
    odds = Number(payload.odds?.[selection]);
  } else if (PLAYER_MARKET_KINDS.includes(market.kind)) {
    const sel = (payload.selections ?? []).find((s) => String(s.elementId) === selection);
    odds = sel ? Number(sel.odds) : null;
  } else if (SEASON_MARKET_KINDS.includes(market.kind)) {
    const sel = (payload.selections ?? []).find((s) => String(s.entryId) === selection);
    odds = sel ? Number(sel.odds) : null;
  }
  if (!Number.isFinite(odds) || odds < 1) return errorJson('unknown selection', 400, ch);

  const debit = await db
    .prepare(
      `UPDATE users SET balance = balance - ?
       WHERE entry_id = ? AND season = ? AND balance >= ?`,
    )
    .bind(stake, session.entryId, session.season, stake)
    .run();
  if ((debit.meta?.changes ?? 0) === 0) return errorJson('insufficient balance', 400, ch);

  try {
    await db
      .prepare(
        `INSERT INTO bets (season, entry_id, market_id, selection, stake, odds, placed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(session.season, session.entryId, marketId, selection, stake, odds, new Date().toISOString())
      .run();
  } catch (e) {
    // Refund the debit if the ticket failed to write.
    await db
      .prepare(`UPDATE users SET balance = balance + ? WHERE entry_id = ? AND season = ?`)
      .bind(stake, session.entryId, session.season)
      .run();
    throw e;
  }
  const user = await db
    .prepare(`SELECT balance FROM users WHERE entry_id = ? AND season = ?`)
    .bind(session.entryId, session.season)
    .first();
  return json(
    { ok: true, balance: user?.balance ?? null, odds, potentialPayout: Math.round(stake * odds) },
    200,
    ch,
  );
}

/* ------------------------------------------------------------------ */
/* Cash-out — tempt them off their own tickets                          */
/* ------------------------------------------------------------------ */

/**
 * Live inputs for pricing H2H bets whose gameweek is underway: current
 * league match scores plus, per gameweek, how much football is left.
 * Returns null when the live feeds are unreachable — those quotes are
 * simply suspended rather than priced blind.
 */
async function liveCashoutContext(env, gws) {
  const leagueId = String(env.LEAGUE_ID || '').trim();
  if (!leagueId) return null;
  let details;
  try {
    details = await fetchJson(`${DRAFT_API}/league/${leagueId}/details`, {
      cf: { cacheTtl: 60 },
    });
  } catch {
    return null;
  }
  const remByGw = new Map();
  for (const gw of gws) {
    try {
      const fixtures = await fetchJson(`${CLASSIC_API}/fixtures/?event=${gw}`, {
        cf: { cacheTtl: 60 },
      });
      remByGw.set(gw, remainingFraction(fixtures, gw));
    } catch {
      /* no fixtures feed → quotes for this GW stay suspended */
    }
  }
  return { matches: details?.matches ?? [], remByGw };
}

/**
 * Cash-out offer in Clotcoins for one open bet, or null when no offer
 * stands (market settled, live feeds down, or the position is worthless).
 *
 * Pre-deadline the bet is priced off the market's own opening probabilities
 * (an exit costs the vig plus the cash-out margin). Once the gameweek is
 * underway, H2H bets re-price live from the actual score margin — which is
 * exactly when the offer gets tempting. The outright prices off the latest
 * weekly model sheet, since its payload reprices on every sync.
 */
function cashoutQuoteForBet(bet, market, liveCtx, nowMs) {
  if (!market || bet.status !== 'open' || market.status !== 'open') return null;
  const payload = JSON.parse(market.payload);

  let pNow = null;
  if (SEASON_MARKET_KINDS.includes(market.kind)) {
    const sel = (payload.selections ?? []).find(
      (s) => String(s.entryId) === String(bet.selection),
    );
    const pct = Number(sel?.pct ?? sel?.titlePct);
    if (!Number.isFinite(pct)) return null;
    pNow = pct / 100;
  } else if (PLAYER_MARKET_KINDS.includes(market.kind)) {
    // Pre-deadline the opening price stands; once the gameweek is underway
    // there is no per-player live model, so the offer suspends rather than
    // pricing blind.
    if (market.closes_at_ms <= nowMs) return null;
    const sel = (payload.selections ?? []).find(
      (s) => String(s.elementId) === String(bet.selection),
    );
    pNow = Number(sel?.prob);
  } else if (market.kind === 'h2h') {
    if (market.closes_at_ms > nowMs) {
      pNow = Number(payload.probs?.[bet.selection]);
    } else {
      if (!liveCtx || !liveCtx.remByGw.has(Number(market.gw))) return null;
      const gw = Number(market.gw);
      const match = liveCtx.matches.find(
        (m) =>
          Number(m.event) === gw &&
          ((Number(m.league_entry_1) === Number(payload.homeEntryId) &&
            Number(m.league_entry_2) === Number(payload.awayEntryId)) ||
            (Number(m.league_entry_1) === Number(payload.awayEntryId) &&
              Number(m.league_entry_2) === Number(payload.homeEntryId))),
      );
      if (!match) return null;
      const oriented = Number(match.league_entry_1) === Number(payload.homeEntryId);
      const p1 = Number(match.league_entry_1_points) || 0;
      const p2 = Number(match.league_entry_2_points) || 0;
      const probs = liveH2hProbs(
        payload.probs,
        oriented ? p1 : p2,
        oriented ? p2 : p1,
        liveCtx.remByGw.get(gw),
      );
      pNow = probs[bet.selection];
    }
  }
  if (!Number.isFinite(pNow)) return null;
  const value = cashoutValue({ stake: bet.stake, odds: bet.odds, pNow });
  return value >= 1 ? value : null;
}

/** My open bets joined to their market rows, plus quotes for each. */
async function quotedOpenBets(env, session) {
  const db = env.DB;
  const rows = await db
    .prepare(
      `SELECT b.id, b.selection, b.stake, b.odds, b.status,
              m.id AS m_id, m.kind, m.gw, m.status AS m_status,
              m.closes_at_ms, m.payload
       FROM bets b JOIN markets m ON m.id = b.market_id
       WHERE b.season = ? AND b.entry_id = ? AND b.status = 'open'`,
    )
    .bind(session.season, session.entryId)
    .all();
  const bets = rows.results ?? [];
  const nowMs = Date.now();
  const liveGws = [
    ...new Set(
      bets
        .filter((b) => b.kind === 'h2h' && b.m_status === 'open' && b.closes_at_ms <= nowMs)
        .map((b) => Number(b.gw)),
    ),
  ];
  const liveCtx = liveGws.length > 0 ? await liveCashoutContext(env, liveGws) : { matches: [], remByGw: new Map() };
  return bets.map((b) => ({
    betId: b.id,
    value: cashoutQuoteForBet(
      { selection: b.selection, stake: b.stake, odds: b.odds, status: b.status },
      { id: b.m_id, kind: b.kind, gw: b.gw, status: b.m_status, closes_at_ms: b.closes_at_ms, payload: b.payload },
      liveCtx,
      nowMs,
    ),
  }));
}

async function handleCashoutQuotes(request, env, ch) {
  const session = await sessionFromRequest(request, env);
  if (!session) return errorJson('login required', 401, ch);
  const quotes = await quotedOpenBets(env, session);
  return json(
    { margin: CASHOUT_MARGIN, quotes: quotes.filter((q) => q.value != null) },
    200,
    ch,
  );
}

async function handleCashoutTake(request, env, ch) {
  const session = await sessionFromRequest(request, env);
  if (!session) return errorJson('login required', 401, ch);
  const body = await request.json().catch(() => null);
  const betId = Number(body?.betId);
  const expected = Number(body?.quote);
  if (!Number.isFinite(betId)) return errorJson('betId is required', 400, ch);

  const db = env.DB;
  const bet = await db
    .prepare(`SELECT * FROM bets WHERE id = ? AND entry_id = ? AND season = ?`)
    .bind(betId, session.entryId, session.season)
    .first();
  if (!bet) return errorJson('unknown bet', 404, ch);
  if (bet.status !== 'open') return errorJson('bet already settled', 409, ch);
  const market = await db.prepare(`SELECT * FROM markets WHERE id = ?`).bind(bet.market_id).first();

  const nowMs = Date.now();
  let liveCtx = { matches: [], remByGw: new Map() };
  if (market?.kind === 'h2h' && market.status === 'open' && market.closes_at_ms <= nowMs) {
    liveCtx = await liveCashoutContext(env, [Number(market.gw)]);
  }
  const value = cashoutQuoteForBet(bet, market, liveCtx, nowMs);
  if (value == null) return errorJson('no cash-out offer on this bet right now', 409, ch);
  // The board moved against them since the quote they accepted — never pay
  // less than they agreed to without showing the new number first.
  if (Number.isFinite(expected) && value < expected) {
    return json({ error: 'the offer has moved', cashOut: value }, 409, ch);
  }

  const nowIso = new Date().toISOString();
  const closed = await db
    .prepare(
      `UPDATE bets SET status = 'cashed_out', payout = ?, settled_at = ?
       WHERE id = ? AND status = 'open'`,
    )
    .bind(value, nowIso, betId)
    .run();
  if ((closed.meta?.changes ?? 0) === 0) return errorJson('bet already settled', 409, ch);
  await db
    .prepare(`UPDATE users SET balance = balance + ? WHERE entry_id = ? AND season = ?`)
    .bind(value, session.entryId, session.season)
    .run();
  const user = await db
    .prepare(`SELECT balance FROM users WHERE entry_id = ? AND season = ?`)
    .bind(session.entryId, session.season)
    .first();
  return json({ ok: true, payout: value, balance: user?.balance ?? null }, 200, ch);
}

async function handleState(request, env, ctx, ch) {
  const db = env.DB;
  // Ingest inline so this response includes boards printed since the last
  // load (player specials missed the first warm because the sheet lagged
  // the Worker by ~15s). Settlement can stay in the background.
  await ingestNow(env);
  ctx.waitUntil(settleNow(env));
  const season = await currentSeason(db);
  if (!season) {
    // First hit ever: settle inline too so the tab isn't empty on day one.
    await syncNow(env, { force: true });
  }
  const seasonNow = season ?? (await currentSeason(db));
  if (!seasonNow) return json({ season: null, markets: [], leaderboard: [] }, 200, ch);

  // One-shot restart: wipe tickets and put every bankroll back at 1,000.
  // No-ops after the first run (see freshStart.js).
  const wiped = await applyFreshStart(db, {
    startingBalance: STARTING_BALANCE,
    nowIso: new Date().toISOString(),
    metaGet,
    metaSet,
  });
  if (wiped) console.log('bookie: fresh start — bets cleared, balances reset to', STARTING_BALANCE);

  const nowMs = Date.now();
  const markets = await db
    .prepare(
      `SELECT * FROM markets WHERE season = ?
       ORDER BY CASE kind
         WHEN 'h2h' THEN 0
         WHEN 'scorer' THEN 1
         WHEN 'toppoints' THEN 2
         WHEN 'outright' THEN 3
         WHEN 'titan' THEN 4
         WHEN 'minnow' THEN 5
         WHEN 'last' THEN 6
         ELSE 7 END, gw DESC, id ASC`,
    )
    .bind(seasonNow)
    .all();
  const marketRows = (markets.results ?? []).map((m) => ({
    id: m.id,
    key: m.market_key,
    kind: m.kind,
    gw: m.gw,
    closesAt: new Date(m.closes_at_ms).toISOString(),
    open: m.status === 'open' && m.closes_at_ms > nowMs,
    status: m.status,
    result: m.result,
    payload: JSON.parse(m.payload),
  }));

  const users = await db
    .prepare(`SELECT entry_id, name, balance FROM users WHERE season = ? ORDER BY balance DESC, name ASC`)
    .bind(seasonNow)
    .all();

  // Season won / lost / live per punter — the bankroll table columns.
  // Won is net profit; lost is stake written off; live is still-open stake.
  const ledger = await db
    .prepare(
      `SELECT b.entry_id,
              SUM(CASE
                    WHEN b.status = 'won' THEN MAX(0, b.payout - b.stake)
                    WHEN b.status = 'cashed_out' AND b.payout > b.stake THEN b.payout - b.stake
                    ELSE 0 END) AS won,
              SUM(CASE
                    WHEN b.status = 'lost' THEN b.stake
                    WHEN b.status = 'cashed_out' AND b.payout < b.stake THEN b.stake - b.payout
                    ELSE 0 END) AS lost,
              SUM(CASE WHEN b.status = 'open' THEN b.stake ELSE 0 END) AS live
       FROM bets b
       WHERE b.season = ?
       GROUP BY b.entry_id`,
    )
    .bind(seasonNow)
    .all();
  const ledgerByEntry = new Map(
    (ledger.results ?? []).map((r) => [
      Number(r.entry_id),
      { won: Number(r.won) || 0, lost: Number(r.lost) || 0, live: Number(r.live) || 0 },
    ]),
  );

  let sideBets = [];
  try {
    const sideBetRows = await db
      .prepare(`SELECT * FROM side_bets WHERE season = ? ORDER BY id DESC LIMIT 200`)
      .bind(seasonNow)
      .all();
    sideBets = sideBetRows.results ?? [];
  } catch (e) {
    // Missing table during a deploy window should not take the house book down.
    console.error('bookie: side bets unavailable', e);
  }
  mergeSideBetLedger(ledgerByEntry, sideBets);

  // Weekly net P/L per punter per GW (H2H + player specials).
  const weekly = await db
    .prepare(
      `SELECT b.entry_id, m.gw,
              SUM(CASE b.status WHEN 'won' THEN b.payout - b.stake
                                WHEN 'cashed_out' THEN b.payout - b.stake
                                WHEN 'lost' THEN -b.stake ELSE 0 END) AS net,
              COUNT(*) AS bets
       FROM bets b JOIN markets m ON m.id = b.market_id
       WHERE b.season = ? AND m.kind IN ('h2h', 'scorer', 'toppoints')
         AND b.status IN ('won', 'lost', 'cashed_out')
       GROUP BY b.entry_id, m.gw`,
    )
    .bind(seasonNow)
    .all();

  // Every ticket is public — the whole point is watching your rivals sweat.
  // Open (live) bets and settled ones alike, with the punter's name attached.
  const allBets = await db
    .prepare(
      `SELECT b.id, b.entry_id, u.name, b.market_id, b.selection, b.stake, b.odds,
              b.status, b.payout, b.placed_at, m.gw, m.kind
       FROM bets b
       JOIN markets m ON m.id = b.market_id
       JOIN users u ON u.entry_id = b.entry_id AND u.season = b.season
       WHERE b.season = ?
       ORDER BY b.id DESC LIMIT 400`,
    )
    .bind(seasonNow)
    .all();
  const betRows = allBets.results ?? [];

  const out = {
    season: seasonNow,
    startingBalance: STARTING_BALANCE,
    weeklyStipend: WEEKLY_STIPEND,
    stipendFloor: STIPEND_FLOOR,
    minStake: MIN_STAKE,
    sideMinStake: SIDE_MIN_STAKE,
    sideMaxStake: SIDE_MAX_STAKE,
    sideSentenceMin: SIDE_SENTENCE_MIN,
    sideSentenceMax: SIDE_SENTENCE_MAX,
    markets: marketRows,
    leaderboard: (users.results ?? []).map((u) => {
      const stats = ledgerByEntry.get(Number(u.entry_id)) ?? { won: 0, lost: 0, live: 0 };
      return {
        entryId: u.entry_id,
        name: u.name,
        balance: u.balance,
        won: stats.won,
        lost: stats.lost,
        live: stats.live,
      };
    }),
    weeklyNet: (weekly.results ?? []).map((r) => ({
      entryId: r.entry_id,
      gw: r.gw,
      net: r.net,
      bets: r.bets,
    })),
    openBets: betRows.filter((b) => b.status === 'open'),
    closedBets: betRows.filter((b) => b.status !== 'open'),
    sideBets: sideBets.map((row) => publicSideBet(row)).filter(Boolean),
  };

  const session = await sessionFromRequest(request, env);
  if (session && session.season === seasonNow) {
    const me = await db
      .prepare(`SELECT entry_id, name, balance FROM users WHERE entry_id = ? AND season = ?`)
      .bind(session.entryId, seasonNow)
      .first();
    if (me) {
      const myBets = await db
        .prepare(
          `SELECT b.id, b.market_id, b.selection, b.stake, b.odds, b.status, b.payout,
                  b.placed_at, m.kind, m.gw, m.status AS market_status
           FROM bets b JOIN markets m ON m.id = b.market_id
           WHERE b.season = ? AND b.entry_id = ?
           ORDER BY b.id DESC LIMIT 200`,
        )
        .bind(seasonNow, session.entryId)
        .all();
      out.me = {
        entryId: me.entry_id,
        name: me.name,
        balance: me.balance,
        bets: myBets.results ?? [],
      };
    }
  }
  return json(out, 200, ch);
}

/* ------------------------------------------------------------------ */
/* Peer side bets                                                       */
/* ------------------------------------------------------------------ */

async function refundCoins(db, entryId, season, amount) {
  await db
    .prepare(`UPDATE users SET balance = balance + ? WHERE entry_id = ? AND season = ?`)
    .bind(amount, entryId, season)
    .run();
}

async function userBalance(db, entryId, season) {
  const user = await db
    .prepare(`SELECT balance FROM users WHERE entry_id = ? AND season = ?`)
    .bind(entryId, season)
    .first();
  return user?.balance ?? null;
}

async function handleOfferSideBet(request, env, ch) {
  const session = await sessionFromRequest(request, env);
  if (!session) return errorJson('login required', 401, ch);
  const body = await request.json().catch(() => null);
  const opponentId = Number(body?.opponentId);
  const stake = parseStake(body?.stake);
  const sentence = normalizeSentence(body?.sentence);
  if (!Number.isFinite(opponentId)) return errorJson('pick an opponent', 400, ch);
  if (opponentId === session.entryId) return errorJson('pick someone else', 400, ch);
  if (stake == null) {
    return errorJson(
      `stake must be a whole number from ${SIDE_MIN_STAKE} to ${SIDE_MAX_STAKE} coins`,
      400,
      ch,
    );
  }
  if (!sentence) {
    return errorJson(
      `describe the bet in ${SIDE_SENTENCE_MIN}-${SIDE_SENTENCE_MAX} characters`,
      400,
      ch,
    );
  }

  const db = env.DB;
  const roster = await rosterForSeason(db, session.season);
  if (!roster?.has(session.entryId) || !roster.has(opponentId)) {
    return errorJson('unknown league entry', 400, ch);
  }

  const nowIso = new Date().toISOString();
  const debit = await db
    .prepare(
      `UPDATE users SET balance = balance - ?
       WHERE entry_id = ? AND season = ? AND balance >= ?`,
    )
    .bind(stake, session.entryId, session.season, stake)
    .run();
  if ((debit.meta?.changes ?? 0) === 0) return errorJson('insufficient balance', 400, ch);

  let inserted;
  try {
    inserted = await db
      .prepare(
        `INSERT INTO side_bets (
           season, proposer_id, proposer_name, opponent_id, opponent_name,
           stake, sentence, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'offered', ?, ?)`,
      )
      .bind(
        session.season,
        session.entryId,
        roster.get(session.entryId),
        opponentId,
        roster.get(opponentId),
        stake,
        sentence,
        nowIso,
        nowIso,
      )
      .run();
  } catch (e) {
    await refundCoins(db, session.entryId, session.season, stake);
    throw e;
  }

  const row = await db
    .prepare(`SELECT * FROM side_bets WHERE id = ?`)
    .bind(inserted.meta?.last_row_id)
    .first();
  return json(
    { ok: true, balance: await userBalance(db, session.entryId, session.season), sideBet: publicSideBet(row) },
    200,
    ch,
  );
}

async function claimSideBet(db, sql, binds) {
  const claimed = await db.prepare(sql).bind(...binds).run();
  return (claimed.meta?.changes ?? 0) > 0;
}

async function handleSideBetAction(request, env, ch, id, action) {
  const session = await sessionFromRequest(request, env);
  if (!session) return errorJson('login required', 401, ch);
  const body = action === 'propose' ? await request.json().catch(() => null) : null;
  const db = env.DB;
  const row = await db
    .prepare(`SELECT * FROM side_bets WHERE id = ? AND season = ?`)
    .bind(id, session.season)
    .first();
  if (!row) return errorJson('unknown side bet', 404, ch);

  const plan = planSideAction(row, session.entryId, action, body);
  if (!plan.ok) return errorJson(plan.error, plan.status);

  if (plan.debit) {
    const debit = await db
      .prepare(
        `UPDATE users SET balance = balance - ?
         WHERE entry_id = ? AND season = ? AND balance >= ?`,
      )
      .bind(plan.debit.amount, plan.debit.entryId, session.season, plan.debit.amount)
      .run();
    if ((debit.meta?.changes ?? 0) === 0) return errorJson('insufficient balance', 400, ch);
  }

  const nowIso = new Date().toISOString();
  let claimed = false;
  if (plan.kind === 'status') {
    claimed = await claimSideBet(
      db,
      `UPDATE side_bets SET status = ?, updated_at = ? WHERE id = ? AND status = ?`,
      [plan.status, nowIso, id, plan.from],
    );
  } else if (plan.kind === 'propose') {
    claimed = await claimSideBet(
      db,
      `UPDATE side_bets SET proposed_by = ?, proposed_result = ?, updated_at = ?
       WHERE id = ? AND status = 'accepted'`,
      [plan.proposedBy, plan.proposedResult, nowIso, id],
    );
  } else if (plan.kind === 'clear-proposal') {
    claimed = await claimSideBet(
      db,
      `UPDATE side_bets SET proposed_by = NULL, proposed_result = NULL, updated_at = ?
       WHERE id = ? AND status = 'accepted' AND proposed_result IS NOT NULL`,
      [nowIso, id],
    );
  } else if (plan.kind === 'settle') {
    claimed = await claimSideBet(
      db,
      `UPDATE side_bets
       SET status = ?, winner_id = ?, proposed_by = NULL, proposed_result = NULL, updated_at = ?
       WHERE id = ? AND status = 'accepted' AND proposed_result = ? AND proposed_by = ?`,
      [plan.status, plan.winnerId, nowIso, id, plan.expectProposedResult, plan.expectProposedBy],
    );
  }

  if (!claimed) {
    if (plan.debit) await refundCoins(db, plan.debit.entryId, session.season, plan.debit.amount);
    return errorJson('that bet already moved on', 409, ch);
  }

  for (const credit of plan.credits) {
    await refundCoins(db, credit.entryId, session.season, credit.amount);
  }

  const fresh = await db.prepare(`SELECT * FROM side_bets WHERE id = ?`).bind(id).first();
  return json(
    {
      ok: true,
      balance: await userBalance(db, session.entryId, session.season),
      sideBet: publicSideBet(fresh),
    },
    200,
    ch,
  );
}

/* ------------------------------------------------------------------ */
/* Worker entry points                                                  */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const ch = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    try {
      if (path === '/api/health') {
        return json({ ok: true, service: 'tclot-bookie' }, 200, ch);
      }
      if (path === '/api/state' && request.method === 'GET') {
        return await handleState(request, env, ctx, ch);
      }
      if (path === '/api/register' && request.method === 'POST') {
        return await handleRegister(request, env, ch);
      }
      if (path === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, env, ch);
      }
      if (path === '/api/bets' && request.method === 'POST') {
        return await handlePlaceBet(request, env, ch);
      }
      if (path === '/api/cashout' && request.method === 'GET') {
        return await handleCashoutQuotes(request, env, ch);
      }
      if (path === '/api/cashout' && request.method === 'POST') {
        return await handleCashoutTake(request, env, ch);
      }
      if (path === '/api/side-bets' && request.method === 'POST') {
        return await handleOfferSideBet(request, env, ch);
      }
      const sideAction = /^\/api\/side-bets\/(\d+)\/(accept|decline|cancel|propose|confirm|reject)$/.exec(path);
      if (sideAction && request.method === 'POST') {
        return await handleSideBetAction(request, env, ch, Number(sideAction[1]), sideAction[2]);
      }
      return errorJson('not found', 404, ch);
    } catch (e) {
      console.error('bookie: unhandled', e);
      return errorJson('internal error', 500, ch);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncNow(env, { force: true }));
  },
};
