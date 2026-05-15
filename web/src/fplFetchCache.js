/** In-memory JSON fetch cache — cuts duplicate FPL proxy calls (shared worker daily quota). */
const store = new Map();

function ttlForUrl(url) {
  const u = String(url);
  if (u.includes('bootstrap-static')) return 10 * 60_000;
  if (u.includes('/live')) return 45_000;
  if (u.includes('fixtures?')) return 3 * 60_000;
  if (u.includes('/entry/') && u.includes('/event/')) return 45_000;
  return 30_000;
}

/**
 * GET JSON with a short TTL. Same URL within the window returns cached data (no network).
 * @param {string} url
 * @param {{ ttlMs?: number, label?: string }} [opts]
 */
export async function fetchFplJsonCached(url, opts = {}) {
  const ttlMs = opts.ttlMs ?? ttlForUrl(url);
  const now = Date.now();
  const hit = store.get(url);
  if (hit && now - hit.at < ttlMs) {
    return hit.data;
  }

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    const msg = e?.message || String(e);
    throw new Error(msg);
  }

  if (!res.ok) {
    const label = opts.label || 'FPL';
    throw new Error(`${label} HTTP ${res.status}`);
  }

  const data = await res.json();
  store.set(url, { data, at: now });
  return data;
}

/** Drop cached live/picks rows so manual refresh always re-fetches. */
export function bustFplLiveCache() {
  for (const key of store.keys()) {
    if (
      key.includes('/live') ||
      key.includes('/entry/') ||
      key.includes('fixtures?')
    ) {
      store.delete(key);
    }
  }
}
