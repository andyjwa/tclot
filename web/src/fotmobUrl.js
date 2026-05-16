import { viteSameOriginProxyHost } from './viteSameOriginProxyHost.js'

/** FotMob unofficial JSON API (same-origin via Worker or Vite dev proxy). */
const FOTMOB_DIRECT = 'https://www.fotmob.com/api';

/**
 * Base URL for FotMob fetches. Mirrors `fplApiBase`: Worker adds `/fotmob`, dev / loopback preview use `/__fotmob`.
 */
export function fotmobApiBase() {
  const raw = import.meta.env.VITE_FPL_PROXY_URL;
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed !== '') return `${trimmed.replace(/\/$/, '')}/fotmob`;
  if (import.meta.env.DEV || viteSameOriginProxyHost()) return '/__fotmob';
  return FOTMOB_DIRECT;
}

/**
 * @param {string} pathAndQuery — e.g. `matchDetails?matchId=123` (no leading slash)
 */
export function fotmobResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '');
  const base = fotmobApiBase();
  if (base === FOTMOB_DIRECT) {
    return `${FOTMOB_DIRECT}/${pq}`;
  }
  return `${base.replace(/\/$/, '')}/${pq}`;
}

export { FOTMOB_DIRECT };
