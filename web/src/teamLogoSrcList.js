/**
 * URL candidates for a team crest. Production dist ships team-logos-web/ only
 * (source uploads in team-logos/ are pruned after build so Vercel Hobby
 * Deployment Storage is not filled by 2–3 MB originals).
 */

const LOGO_EXTS = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'webp', 'WEBP']

function defaultBase() {
  try {
    return import.meta.env?.BASE_URL || '/'
  } catch {
    return '/'
  }
}

/**
 * @param {boolean} [customLogoOnly] If true, skip auto-generated `{id}.png` in
 *   team-logos-web/; only `logoMap` filenames and raw files under team-logos/.
 */
function buildSrcList(entryId, logoMap, customLogoOnly, base) {
  const rawBase = `${base}team-logos/`
  const webBase = `${base}team-logos-web/`
  const key = String(entryId)
  const mapped = logoMap[key]
  const webId = `${webBase}${entryId}.png`
  if (mapped) {
    const mappedRaw = `${rawBase}${mapped}`
    const mappedWeb = `${webBase}${mapped}`
    if (customLogoOnly) return [mappedWeb, mappedRaw]
    return [webId, mappedWeb]
  }

  const rawList = []
  for (const ext of LOGO_EXTS) {
    rawList.push(`${rawBase}${entryId}.${ext}`)
  }

  if (customLogoOnly) {
    return rawList
  }
  return [webId]
}

/**
 * Same URL list as TeamAvatar (for favicon / preload).
 * @param {number | string | null | undefined} entryId
 * @param {Record<string, string>} [logoMap]
 * @param {boolean} [customLogoOnly]
 * @param {string} [base] Vite BASE_URL
 * @returns {string[]}
 */
export function teamLogoSrcList(
  entryId,
  logoMap,
  customLogoOnly = false,
  base = defaultBase(),
) {
  if (entryId == null || entryId === '') return []
  const n = Number(entryId)
  if (!Number.isFinite(n)) return []
  return buildSrcList(n, logoMap || {}, customLogoOnly, base)
}
