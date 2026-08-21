/**
 * Shared JSON fetch for proxied upstream feeds (Pulselive / ESPN).
 *
 * The Cloudflare Worker routes by path prefix (`pulselive/`, `espn/`, …) and falls back to
 * the FPL base for anything unrecognised. Because the Worker only updates when someone runs
 * `npm run deploy`, a stale deploy silently lacks newer prefixes — the request is forwarded
 * to `fantasy.premierleague.com/api/<prefix>/…` and returns a **Django HTML 404**. A bare
 * "HTTP 404" gives no hint that the *proxy* is the problem rather than the upstream feed, so
 * we detect non-JSON responses and say so explicitly.
 */

/** True when the response body is HTML rather than the JSON we asked for. */
function looksLikeHtml(contentType, bodyStart) {
  if (/text\/html/i.test(String(contentType || ''))) return true;
  return /^\s*(<!doctype|<html)/i.test(String(bodyStart || ''));
}

/**
 * Fetch `url` and parse JSON, throwing descriptive errors.
 *
 * @param {string} url — fully-qualified (already prefixed) request URL
 * @param {string} label — short source label for messages, e.g. `Pulselive competitions/1`
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<any>}
 */
export async function fetchProxyJson(url, label, opts = {}) {
  const doFetch = opts.fetchImpl || fetch;
  const r = await doFetch(url);
  const contentType = r.headers?.get?.('content-type') ?? '';

  if (!r.ok) {
    /**
     * An HTML error page means the request never reached the intended upstream — almost
     * always a proxy routing miss (stale Worker deploy) rather than a real upstream 404.
     */
    let bodyStart = '';
    try {
      bodyStart = (await r.text()).slice(0, 200);
    } catch {
      /* body already consumed / unreadable — fall through to the plain status error */
    }
    if (looksLikeHtml(contentType, bodyStart)) {
      throw new Error(
        `${label} HTTP ${r.status} — proxy returned HTML, not JSON. The Worker is likely ` +
          'missing this upstream route (stale deploy): check `/__health` and redeploy ' +
          '`web/workers/fpl-proxy`.',
      );
    }
    throw new Error(`${label} HTTP ${r.status}`);
  }

  /** A 200 that isn't JSON is the same class of problem (proxy served a page). */
  if (contentType && !/json/i.test(contentType)) {
    throw new Error(
      `${label} returned ${contentType || 'an unknown content type'} instead of JSON — ` +
        'check that the proxy routes this upstream (`/__health`) and is up to date.',
    );
  }

  return r.json();
}
