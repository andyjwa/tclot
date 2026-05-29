/**
 * CORS proxy for read-only FPL API calls:
 * - fantasy.premierleague.com/api/* (bootstrap-static, event/{gw}/live, …)
 * - draft/* → draft.premierleague.com/api/* (bootstrap-static, event/{gw}/live, entry picks — draft ID space)
 * - fotmob/* → www.fotmob.com/api/* (unofficial read-only match timelines for Live tab ordering)
 * - espn/* → site.api.espn.com/apis/site/v2/sports/soccer/eng.1/* (open scoreboard + summary feed; lineups at T-60)
 * - pulselive/* → footballapi.pulselive.com/football/* (official PL backend; T-75 lineups +
 *   wallclock-precise events; requires `Account: premierleague` header)
 * Avoid * + / in this block comment — it would end the comment early.
 * Deploy: cd web/workers/fpl-proxy && npm run deploy
 */
const FANTASY_API = 'https://fantasy.premierleague.com/api';
const DRAFT_API = 'https://draft.premierleague.com/api';
const FOTMOB_API = 'https://www.fotmob.com/api';
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
const PULSELIVE_API = 'https://footballapi.pulselive.com/football';

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin');
  const allow =
    env.ALLOW_ORIGIN?.trim() || origin || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/** Edge cache TTL (seconds) — reduces upstream + worker load on the free tier. */
function cacheTtlSeconds(path, upstreamBase) {
  if (path === 'bootstrap-static') return 600;
  if (path.includes('/live')) return 45;
  if (path.startsWith('fixtures')) return 180;
  if (path.includes('/entry/') && path.includes('/event/')) return 45;
  if (upstreamBase === FOTMOB_API) return 60;
  if (upstreamBase === ESPN_API) return 120;
  /**
   * Pulselive is the T-75 lineup source — lineups + events flip from absent → published
   * within seconds of clubs submitting team sheets, so a short TTL on per-fixture reads
   * keeps the "Confirmed" badge and the live event ticker fresh. The seasons + fixtures
   * list endpoints don't churn within a GW so they get a longer TTL.
   */
  if (upstreamBase === PULSELIVE_API) {
    if (path.startsWith('fixtures/') && !path.includes('?')) return 30;
    if (path.startsWith('fixtures') && path.includes('?')) return 120;
    if (path.startsWith('competitions/') && path.includes('/compseasons')) return 86400;
    return 60;
  }
  return 0;
}

function withCors(upstream, ch, cacheTtl) {
  const outHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(ch)) {
    outHeaders.set(k, v);
  }
  outHeaders.delete('Set-Cookie');
  if (cacheTtl > 0) {
    outHeaders.set('Cache-Control', `public, max-age=${cacheTtl}`);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    const ch = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: ch });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: ch });
    }

    const url = new URL(request.url);
    let path = url.pathname.replace(/^\/+/, '');
    if (path.includes('..') || path.startsWith('//')) {
      return new Response('Bad path', { status: 400, headers: ch });
    }

    let upstreamBase = FANTASY_API;
    if (path.startsWith('draft/')) {
      path = path.slice('draft/'.length);
      upstreamBase = DRAFT_API;
    } else if (path.startsWith('fotmob/')) {
      path = path.slice('fotmob/'.length);
      upstreamBase = FOTMOB_API;
    } else if (path.startsWith('espn/')) {
      path = path.slice('espn/'.length);
      upstreamBase = ESPN_API;
    } else if (path.startsWith('pulselive/')) {
      path = path.slice('pulselive/'.length);
      upstreamBase = PULSELIVE_API;
    }
    const target = `${upstreamBase}/${path}${url.search}`;
    const cacheTtl = cacheTtlSeconds(path, upstreamBase);
    const cache = caches.default;
    const cacheKey = new Request(target, { method: 'GET' });

    if (request.method === 'GET' && cacheTtl > 0) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return withCors(cached, ch, cacheTtl);
      }
    }

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'TCLOT-fpl-proxy/1.0',
    };
    if (upstreamBase === FOTMOB_API) {
      headers.Referer = 'https://www.fotmob.com/';
    } else if (upstreamBase === PULSELIVE_API) {
      /**
       * Pulselive (premierleague.com backend) returns HTTP 401 without `Account:
       * premierleague`. `Origin`/`Referer` aren't strictly required but match what the
       * official PL site sends, so we mirror them to stay in the well-trodden path.
       */
      headers.Origin = 'https://www.premierleague.com';
      headers.Referer = 'https://www.premierleague.com/';
      headers.Account = 'premierleague';
    }
    const upstream = await fetch(target, {
      method: request.method,
      headers,
    });

    const response = withCors(upstream, ch, cacheTtl);

    if (request.method === 'GET' && upstream.ok && cacheTtl > 0) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
