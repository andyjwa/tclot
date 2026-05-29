import { useState } from 'react'
import { fplElementFullName, fplElementWebName } from './fplElementNames.js'
import { POS_LABEL } from './playersWireList.js'

/**
 * Premier League transparent club crest, retina variant for crisp
 * rendering at 120 px (desktop hero) and 56 px (portrait hero). Same
 * `badges/{size}/t{teamCode}@x2.png` URL family as the legacy
 * `PlayerWireHero` (`badges/50/t{n}.png`) and waiver
 * `oppFixtureCrestUrl` — only the requested size differs. The PL CDN
 * rejects sizes larger than 100 (`/badges/250/...` returns 403), so
 * `100@x2.png` (200×200 effective) is the largest crisp size available.
 */
function plBadgeUrl(teamCode) {
  if (teamCode == null) return null
  const n = Number(teamCode)
  if (!Number.isFinite(n)) return null
  return `https://resources.premierleague.com/premierleague/badges/100/t${n}@x2.png`
}

/** XI / BENCH / OUT pill text — desktop is verbose, portrait abbreviates. */
function statusPillText(xiKind, dense) {
  if (dense) {
    if (xiKind === 'xi') return 'XI'
    if (xiKind === 'bench') return 'BN'
    return 'OUT'
  }
  if (xiKind === 'xi') return 'STARTING XI'
  if (xiKind === 'bench') return 'ON BENCH'
  return 'NOT IN SQUAD'
}

/** Maps overlay-derived xiKind → CSS suffix used by the mockup tokens. */
function xiClassSuffix(xiKind) {
  if (xiKind === 'xi') return 'xi'
  if (xiKind === 'bench') return 'bench'
  return 'absent'
}

/**
 * Crest image with graceful fallback to the team short-name pill when the
 * PL CDN URL fails (network blip, future endpoint change, unknown
 * teamCode). Without this the hero shows a "broken-image" icon — caught
 * during PR redesign-phase-2 visual verification.
 */
function CrestImg({ url, fallback, className = '' }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <span className={`pdetail__hero-crest-fallback ${className}`.trim()}>
        {fallback ?? '?'}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * Desktop hero — 120 px crest with XI status pill stacked under it,
 * meta row + name + owner row in the body, single Compare chip on the
 * right. 1:1 port of `PlayerDetailDesktop` hero from
 * `web/src/Mockup.jsx` (~line 4568).
 *
 * @param {object} props
 */
function PlayerDetailHeroDesktop({
  el,
  team,
  ownerLabel,
  xiKind,
  onCompareClick,
  compareDisabled = false,
}) {
  const badgeUrl = plBadgeUrl(team?.code)
  const posLabel = POS_LABEL[el?.element_type] ?? '?'
  const webName = fplElementWebName(el, el?.id)
  const fullName = fplElementFullName(el, el?.id)
  const xiSuffix = xiClassSuffix(xiKind)
  const shirtRaw = Number(el?.squad_number)
  const shirtLabel = Number.isFinite(shirtRaw) && shirtRaw > 0 ? `Shirt #${shirtRaw}` : null
  const ownerCode = ownerLabel?.code ?? null
  const ownerName = ownerLabel?.name ?? null
  return (
    <div className="pdetail__hero">
      <div className="pdetail__hero-crest-wrap">
        <span className="pdetail__hero-crest" aria-hidden>
          <CrestImg url={badgeUrl} fallback={team?.short_name?.slice(0, 3)} />
        </span>
        <span className={`pdetail__hero-xi pdetail-xi--${xiSuffix}`}>
          {statusPillText(xiKind, false)}
        </span>
      </div>

      <div className="pdetail__hero-body">
        <div className="pdetail__hero-meta">
          <span className="pdetail__hero-pos">{posLabel}</span>
          {team?.name ? (
            <span className="pdetail__hero-club">{team.name}</span>
          ) : null}
          {shirtLabel ? (
            <>
              <span className="pdetail__hero-dot" aria-hidden />
              <span className="pdetail__hero-shirt">{shirtLabel}</span>
            </>
          ) : null}
        </div>
        <h2 className="pdetail__hero-name" title={fullName}>{webName}</h2>
        <div className="pdetail__hero-owner">
          {ownerName ? (
            <>
              <span>On</span>
              <span className="pdetail__hero-owner-crest" aria-hidden>
                {ownerCode ?? '?'}
              </span>
              <span className="pdetail__hero-owner-name">{ownerName}</span>
              <span className="pdetail__hero-owner-status">· Starting XI</span>
            </>
          ) : (
            <>
              <span className="pdetail__hero-owner-free-dot" aria-hidden />
              <span>Free agent</span>
              <span className="pdetail__hero-owner-status">
                · available on waivers
              </span>
            </>
          )}
        </div>
      </div>

      <div className="pdetail__hero-actions">
        <button
          type="button"
          className="pdetail__btn"
          onClick={onCompareClick}
          disabled={compareDisabled}
          title={compareDisabled ? 'Compare unavailable' : 'Compare with another player'}
        >
          <span>Compare</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Portrait hero — back chevron + title strip, then 56 px crest hero with
 * XI/BN/OUT pill on the right, owner strip, Compare chip. 1:1 port of
 * `PlayerDetailPortrait` hero from `web/src/Mockup.jsx` (~line 4661).
 *
 * @param {object} props
 */
function PlayerDetailHeroPortrait({
  el,
  team,
  ownerLabel,
  xiKind,
  onCompareClick,
  compareDisabled = false,
}) {
  const badgeUrl = plBadgeUrl(team?.code)
  const posLabel = POS_LABEL[el?.element_type] ?? '?'
  const webName = fplElementWebName(el, el?.id)
  const fullName = fplElementFullName(el, el?.id)
  const xiSuffix = xiClassSuffix(xiKind)
  const ownerCode = ownerLabel?.code ?? null
  const ownerName = ownerLabel?.name ?? null
  return (
    <div className="pdetail-p__chrome">
      <div className="pdetail-p__hero">
        <span className="pdetail-p__hero-crest" aria-hidden>
          <CrestImg
            url={badgeUrl}
            fallback={team?.short_name?.slice(0, 3)}
            className="pdetail-p__hero-crest-fallback"
          />
        </span>
        <div className="pdetail-p__hero-body">
          <div className="pdetail-p__hero-name" title={fullName}>{webName}</div>
          <div className="pdetail-p__hero-meta">
            <span className="pdetail-p__hero-pos">{posLabel}</span>
            {team?.name ? <span>{team.name}</span> : null}
          </div>
        </div>
        <span className={`pdetail-p__hero-xi pdetail-xi--${xiSuffix}`}>
          {statusPillText(xiKind, true)}
        </span>
      </div>

      <div className="pdetail-p__owner">
        {ownerName ? (
          <>
            <span>On</span>
            <span className="pdetail-p__owner-crest" aria-hidden>
              {ownerCode ?? '?'}
            </span>
            <span className="pdetail-p__owner-name">{ownerName}</span>
          </>
        ) : (
          <>
            <span className="pdetail-p__owner-free-dot" aria-hidden />
            <span>Free agent</span>
          </>
        )}
      </div>

      <div className="pdetail-p__actions">
        <button
          type="button"
          className="pdetail__btn pdetail-p__btn"
          onClick={onCompareClick}
          disabled={compareDisabled}
          title={compareDisabled ? 'Compare unavailable' : 'Compare with another player'}
        >
          <span>Compare</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Hero shell — chooses desktop or portrait variant based on `portrait`.
 * The Back-button header bar (formerly inline in the portrait hero) now
 * lives at `PlayerDetailView` level so it shows for ALL mobile-layout
 * widths (≤1080px), not just narrow portrait phones (≤600px). See
 * `PlayerDetailView.jsx` → `pdetail__topbar`.
 *
 * @param {{
 *   el: object,
 *   team: object | null | undefined,
 *   ownerLabel: { code: string, name: string } | null,
 *   xiKind: 'xi' | 'bench' | 'absent',
 *   onCompareClick: () => void,
 *   portrait: boolean,
 *   compareDisabled?: boolean,
 * }} props
 */
export function PlayerDetailHero({
  el,
  team,
  ownerLabel,
  xiKind,
  onCompareClick,
  portrait,
  compareDisabled = false,
}) {
  if (portrait) {
    return (
      <PlayerDetailHeroPortrait
        el={el}
        team={team}
        ownerLabel={ownerLabel}
        xiKind={xiKind}
        onCompareClick={onCompareClick}
        compareDisabled={compareDisabled}
      />
    )
  }
  return (
    <PlayerDetailHeroDesktop
      el={el}
      team={team}
      ownerLabel={ownerLabel}
      xiKind={xiKind}
      onCompareClick={onCompareClick}
      compareDisabled={compareDisabled}
    />
  )
}

