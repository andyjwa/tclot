import { useState, useMemo, useId } from 'react'
import {
  SHIRT_FILL_PATH,
  SHIRT_OUTLINE_PATH,
  SHIRT_TEXT_ANCHOR,
  SHIRT_VIEW_BOX,
} from './shirtSilhouettePaths'
import { TEAM_KITS, TEAM_KIT_COUNT } from './teamKitStyles'

const RAW_BASE = `${import.meta.env.BASE_URL}team-logos/`
const WEB_BASE = `${import.meta.env.BASE_URL}team-logos-web/`
const LOGO_EXTS = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'webp', 'WEBP']

/**
 * FPL draft `id` (passed as `entryId` to TeamAvatar) — logos that are a small circle on a
 * square canvas get `team-avatar-frame--logo-zoom`; everyone else stays 1:1 in the clip.
 */
const LOGO_ZOOM_ENTRY_IDS = new Set([39219, 26587, 40206, 27370])

const SHIRT_TEXT = {
  sm: { fontSize: 15 },
  md: { fontSize: 20 },
  lg: { fontSize: 33 },
}

/**
 * @param {boolean} [customLogoOnly] If true, skip auto-generated team-logos-web assets; only
 *   `logoMap` entries and raw files under team-logos/ (custom uploads).
 */
function buildSrcList(entryId, logoMap, customLogoOnly) {
  const key = String(entryId)
  const mapped = logoMap[key]
  if (mapped) {
    const mappedRaw = `${RAW_BASE}${mapped}`
    // Named LOTR sources may live only under team-logos-web/ (preseason drop).
    const mappedWeb = `${WEB_BASE}${mapped}`
    if (customLogoOnly) return [mappedRaw, mappedWeb]
    // Prefer 192×192 pipeline output keyed by entry id (avoids huge JPG decode).
    return [`${WEB_BASE}${entryId}.png`, mappedWeb, mappedRaw]
  }

  const rawList = []
  for (const ext of LOGO_EXTS) {
    rawList.push(`${RAW_BASE}${entryId}.${ext}`)
  }

  if (customLogoOnly) {
    return rawList
  }
  // Prefer uploads in team-logos/ before pipeline output in team-logos-web/
  return [...rawList, `${WEB_BASE}${entryId}.png`]
}

/**
 * Same URL list as {@link TeamAvatar} (for favicon / preload).
 * @param {number | string | null | undefined} entryId
 * @param {Record<string, string>} logoMap
 * @param {boolean} [customLogoOnly]
 * @returns {string[]}
 */
export function teamLogoSrcList(entryId, logoMap, customLogoOnly = false) {
  if (entryId == null || entryId === '') return []
  const n = Number(entryId)
  if (!Number.isFinite(n)) return []
  return buildSrcList(n, logoMap || {}, customLogoOnly)
}

function fnv1a32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Map hit from standings-assigned kits; else stable hash fallback. */
function resolveKitIndex(entryId, kitIndexByEntry, name) {
  if (entryId != null && kitIndexByEntry && typeof kitIndexByEntry === 'object') {
    const n = Number(entryId)
    const raw = kitIndexByEntry[n] ?? kitIndexByEntry[String(n)]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const m = Math.floor(raw) % TEAM_KIT_COUNT
      return ((m % TEAM_KIT_COUNT) + TEAM_KIT_COUNT) % TEAM_KIT_COUNT
    }
  }
  const key = `${entryId == null ? '' : String(entryId)}\u{1e}${name == null ? '' : String(name)}`
  const h = fnv1a32(key)
  const mixed = Math.imul(h, 2654435769) >>> 0
  return mixed % TEAM_KIT_COUNT
}

function patternIdBase(reactId) {
  return `k${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
}

/**
 * Rounded “badge” with one initial (no shirt SVG) — for contexts that prefer a crest over kit.
 * Matches {@link team-avatar-frame} sizing.
 */
function CircleInitialsBadge({ name, size }) {
  const initial = (() => {
    const t = String(name ?? '').trim()
    if (t) return t.slice(0, 1).toUpperCase()
    return '?'
  })()
  return (
    <span
      className={`team-avatar-frame team-avatar-fallback-initials team-avatar-frame--${size}`}
      aria-hidden
    >
      <span className="team-avatar-fallback-initials__glyph">{initial}</span>
    </span>
  )
}

function ShirtInitialsBadge({ name, size, kitIndex }) {
  const initial = (name || '?').slice(0, 2).toUpperCase()
  const kit = TEAM_KITS[kitIndex] ?? TEAM_KITS[0]
  const reactId = useId()
  const pid = patternIdBase(reactId)
  const stripeVId = `${pid}-sv`
  const stripeHId = `${pid}-sh`
  const { fontSize } = SHIRT_TEXT[size] ?? SHIRT_TEXT.md
  const { x: textX, y: textY } = SHIRT_TEXT_ANCHOR

  const textStroke =
    kit.outline === 'light'
      ? 'rgba(255, 255, 255, 0.72)'
      : 'rgba(0, 0, 0, 0.38)'
  const strokeW = kit.mode === 'solid' ? 1.05 : 1.45

  const fill =
    kit.mode === 'solid'
      ? kit.fill
      : kit.mode === 'stripes-v'
        ? `url(#${stripeVId})`
        : `url(#${stripeHId})`

  return (
    <svg
      className={`team-shirt team-shirt--${size}`}
      viewBox={SHIRT_VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {kit.mode === 'stripes-v' ? (
        <defs>
          <pattern
            id={stripeVId}
            width="11"
            height="140"
            y="-10"
            patternUnits="userSpaceOnUse"
          >
            <rect y="-10" width="5.5" height="140" fill={kit.a} />
            <rect y="-10" x="5.5" width="5.5" height="140" fill={kit.b} />
          </pattern>
        </defs>
      ) : kit.mode === 'stripes-h' ? (
        <defs>
          <pattern
            id={stripeHId}
            width="140"
            height="12"
            y="-10"
            patternUnits="userSpaceOnUse"
          >
            <rect y="-10" width="140" height="6" fill={kit.a} />
            <rect y="-4" width="140" height="6" fill={kit.b} />
          </pattern>
        </defs>
      ) : null}
      <path d={SHIRT_FILL_PATH} fill={fill} />
      <path
        d={SHIRT_OUTLINE_PATH}
        fill="none"
        stroke="rgba(0, 0, 0, 0.34)"
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={textX}
        y={textY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={kit.text}
        stroke={textStroke}
        strokeWidth={strokeW}
        paintOrder="stroke fill"
        style={{
          fontFamily: 'inherit',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        {initial}
      </text>
    </svg>
  )
}

/**
 * Prefers pre-sized assets in team-logos-web/ (run: npm run dev / npm run build).
 */
export function TeamAvatar({
  entryId,
  name,
  size = 'md',
  logoMap = {},
  kitIndexByEntry,
  /** If true, render nothing when no custom logo image loads (no shirt initials fallback). */
  noFallback = false,
  /** If true, only try custom uploads (team-logos/ + logoMap), not team-logos-web pipeline. */
  customLogoOnly = false,
  /**
   * If true, when no logo image is shown, use a simple circular initial instead of the shirt
   * silhouette.
   */
  badgeFallback = false,
}) {
  const kitIndex = useMemo(
    () => resolveKitIndex(entryId, kitIndexByEntry, name),
    [entryId, kitIndexByEntry, name],
  )
  const srcList = useMemo(
    () => buildSrcList(entryId, logoMap, customLogoOnly),
    [entryId, logoMap, customLogoOnly],
  )
  const [idx, setIdx] = useState(0)
  const [showInitials, setShowInitials] = useState(false)

  const logoZoom = useMemo(() => {
    const n = Number(entryId)
    return Number.isFinite(n) && LOGO_ZOOM_ENTRY_IDS.has(n)
  }, [entryId])

  if (entryId == null || showInitials) {
    if (noFallback) return null
    if (badgeFallback) {
      return <CircleInitialsBadge name={name} size={size} />
    }
    return (
      <ShirtInitialsBadge
        name={name}
        entryId={entryId}
        size={size}
        kitIndex={kitIndex}
      />
    )
  }

  const src = srcList[idx]
  if (!src) {
    if (noFallback) return null
    if (badgeFallback) {
      return <CircleInitialsBadge name={name} size={size} />
    }
    return (
      <ShirtInitialsBadge
        name={name}
        entryId={entryId}
        size={size}
        kitIndex={kitIndex}
      />
    )
  }

  return (
    <span
      className={`team-avatar-frame team-avatar-frame--${size}${
        logoZoom ? ' team-avatar-frame--logo-zoom' : ''
      }`}
    >
      <img
        className="team-avatar"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (idx < srcList.length - 1) setIdx((i) => i + 1)
          else setShowInitials(true)
        }}
      />
    </span>
  )
}
