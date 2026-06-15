import { useState } from 'react'
import { fplElementFullName, fplElementWebName } from './fplElementNames.js'
import { POS_LABEL } from './playersWireList.js'
import { TeamAvatar } from './TeamAvatar'

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
 * meta row + name + owner row in the body. The owner row's "On
 * {crest} {team}" line renders the manager's fantasy team badge via
 * {@link TeamAvatar} (logos under `team-logos-web/`), falling back to
 * its kit silhouette + 3-letter shortcode when no custom logo is
 * shipped for the league entry. 1:1 port of `PlayerDetailDesktop`
 * hero from `web/src/Mockup.jsx` (~line 4568), minus the legacy
 * Compare chip which was removed across the site.
 *
 * @param {object} props
 */
function PlayerDetailHeroDesktop({
  el,
  team,
  ownerLabel,
  xiKind,
  logoMap,
  kitIndexByEntry,
}) {
  const badgeUrl = plBadgeUrl(team?.code)
  const posLabel = POS_LABEL[el?.element_type] ?? '?'
  const webName = fplElementWebName(el, el?.id)
  const fullName = fplElementFullName(el, el?.id)
  const xiSuffix = xiClassSuffix(xiKind)
  const shirtRaw = Number(el?.squad_number)
  const shirtLabel = Number.isFinite(shirtRaw) && shirtRaw > 0 ? `Shirt #${shirtRaw}` : null
  const ownerLeagueEntryId = ownerLabel?.leagueEntryId ?? null
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
                <TeamAvatar
                  entryId={ownerLeagueEntryId}
                  name={ownerName}
                  size="sm"
                  logoMap={logoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
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
    </div>
  )
}

/**
 * Portrait hero — single compact header that folds the Back chevron,
 * club crest and player name onto one row (`[‹] [crest] [name]`), with
 * the meta row (position pill · club · fantasy owner badge) beneath it.
 * The standalone "Player" top bar is dropped for portrait (it is still
 * rendered at the `PlayerDetailView` level for the tablet/landscape
 * case). Derived from the `PlayerDetailPortrait` hero in
 * `web/src/Mockup.jsx`, minus the legacy Compare chip which was removed
 * across the site.
 *
 * @param {object} props
 */
function PlayerDetailHeroPortrait({
  el,
  team,
  ownerLabel,
  onBack,
  logoMap,
  kitIndexByEntry,
}) {
  const badgeUrl = plBadgeUrl(team?.code)
  const posLabel = POS_LABEL[el?.element_type] ?? '?'
  const webName = fplElementWebName(el, el?.id)
  const fullName = fplElementFullName(el, el?.id)
  const ownerLeagueEntryId = ownerLabel?.leagueEntryId ?? null
  const ownerName = ownerLabel?.name ?? null
  return (
    <div className="pdetail-p__chrome">
      {/* Single compact header: Back chevron + club crest + player name on
          one row, meta row beneath. The standalone "Player" top bar is
          dropped for portrait (still used for tablet/landscape). The fantasy
          owner badge sits inline in the meta row (no separate "On {owner}"
          strip, no XI/BN/OUT status pill) — matching the mobile fixture
          card design. */}
      <div className="pdetail-p__hero">
        <button
          type="button"
          className="pdetail__back pdetail-p__hero-back"
          aria-label="Back"
          onClick={onBack}
        >
          <span aria-hidden>‹</span>
        </button>
        <span className="pdetail-p__hero-crest" aria-hidden>
          <CrestImg
            url={badgeUrl}
            fallback={team?.short_name?.slice(0, 3)}
            className="pdetail-p__hero-crest-fallback"
          />
        </span>
        <div className="pdetail-p__hero-body">
          <div className="pdetail-p__hero-name-row">
            <div className="pdetail-p__hero-name" title={fullName}>{webName}</div>
            <span className="pdetail-p__hero-pos">{posLabel}</span>
          </div>
          <div className="pdetail-p__hero-meta">
            {ownerName ? (
              <span className="pdetail-p__hero-fant">
                <span className="pdetail-p__owner-crest" aria-hidden>
                  <TeamAvatar
                    entryId={ownerLeagueEntryId}
                    name={ownerName}
                    size="sm"
                    logoMap={logoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </span>
                <span className="pdetail-p__owner-name">{ownerName}</span>
              </span>
            ) : (
              <span className="pdetail-p__hero-fant">
                <span className="pdetail-p__owner-free-dot" aria-hidden />
                <span>Free agent</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hero shell — chooses desktop or portrait variant based on `portrait`.
 * For portrait phones the Back chevron lives inside the hero row
 * (`onBack`); for the tablet/landscape mobile case the standalone
 * `pdetail__topbar` carries the chevron instead. See
 * `PlayerDetailView.jsx`.
 *
 * @param {{
 *   el: object,
 *   team: object | null | undefined,
 *   ownerLabel: { leagueEntryId: number | null, code: string, name: string } | null,
 *   xiKind: 'xi' | 'bench' | 'absent',
 *   portrait: boolean,
 *   onBack?: () => void,
 *   logoMap?: Record<string, string>,
 *   kitIndexByEntry?: Record<number, number>,
 * }} props
 */
export function PlayerDetailHero({
  el,
  team,
  ownerLabel,
  xiKind,
  portrait,
  onBack,
  logoMap,
  kitIndexByEntry,
}) {
  if (portrait) {
    return (
      <PlayerDetailHeroPortrait
        el={el}
        team={team}
        ownerLabel={ownerLabel}
        xiKind={xiKind}
        onBack={onBack}
        logoMap={logoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    )
  }
  return (
    <PlayerDetailHeroDesktop
      el={el}
      team={team}
      ownerLabel={ownerLabel}
      xiKind={xiKind}
      logoMap={logoMap}
      kitIndexByEntry={kitIndexByEntry}
    />
  )
}

