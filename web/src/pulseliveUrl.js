import { viteSameOriginProxyHost } from './viteSameOriginProxyHost.js';

/** Pulselive / Premier League official JSON API (same-origin via Worker or Vite dev proxy). */
const PULSELIVE_DIRECT = 'https://footballapi.pulselive.com/football';

/**
 * Base URL for Pulselive fetches. Worker adds `/pulselive`, dev / loopback preview use
 * `/__pulselive`. Direct host requires `Origin` + `Account: premierleague` headers; in
 * the browser these are appended by the Worker / Vite proxy.
 */
export function pulseliveApiBase() {
  const env =
    (typeof import.meta !== 'undefined' && import.meta.env) || {};
  const raw = env.VITE_FPL_PROXY_URL;
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed !== '') return `${trimmed.replace(/\/$/, '')}/pulselive`;
  if (env.DEV || viteSameOriginProxyHost()) return '/__pulselive';
  return PULSELIVE_DIRECT;
}

/**
 * @param {string} pathAndQuery — e.g. `fixtures/91234` (no leading slash)
 */
export function pulseliveResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '');
  return `${pulseliveApiBase().replace(/\/$/, '')}/${pq}`;
}

export { PULSELIVE_DIRECT };
