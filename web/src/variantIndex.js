/** Small deterministic hash for stable template variation per matchup+GW. */
export function variantIndex(key, n) {
  const len = Number(n)
  if (!Number.isFinite(len) || len <= 0) return 0
  let h = 2166136261
  const s = String(key)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0) % len
}

export function pickFrom(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined
  return arr[variantIndex(key, arr.length)]
}
