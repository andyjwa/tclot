import { viteSameOriginProxyHost } from './viteSameOriginProxyHost.js'

/** ESPN soccer API (eng.1 = Premier League) — same-origin via Worker or Vite dev proxy. */
const ESPN_DIRECT = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';

/**
 * Base URL for ESPN fetches. Mirrors `fplApiBase` / `fotmobApiBase`:
 * Worker adds `/espn`, dev / loopback preview use `/__espn`.
 */
export function espnApiBase() {
  // `import.meta.env` is defined by Vite at build time; outside Vite (unit tests, pure Node)
  // it's undefined, so read defensively.
  const env =
    (typeof import.meta !== 'undefined' && import.meta.env) || {};
  const raw = env.VITE_FPL_PROXY_URL;
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed !== '') return `${trimmed.replace(/\/$/, '')}/espn`;
  if (env.DEV || viteSameOriginProxyHost()) return '/__espn';
  return ESPN_DIRECT;
}

/**
 * @param {string} pathAndQuery — e.g. `summary?event=740928` (no leading slash)
 */
export function espnResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '');
  return `${espnApiBase().replace(/\/$/, '')}/${pq}`;
}

export { ESPN_DIRECT };
