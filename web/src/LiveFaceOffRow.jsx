import { TeamAvatar } from './TeamAvatar';
import {
  HeroVillainAvatarFrame,
  HERO_VILLAIN_LABEL,
} from './HeroVillainAvatarFrame';
import { liveFixtureLead } from './liveScoresDerivations.js';

/**
 * Compact face-off row (desktop wide grid, or mobile compressed) — both
 * variants share a single 1-fr · auto · 1-fr grid and only the size class
 * differs. Used inside `LiveBannerGroup` and the mobile compressed list
 * (mockup `mockup-live-group__row` and `mockup-live-compressed__row`).
 *
 * Winner emphasis follows mockup **Option D** (locked decision): winner's
 * score number rendered in `var(--tclot-logo-purple)`; team names stay
 * equal-weight; no tinted background; no underline.
 *
 * Hero defeat / villain victory narrative badge follows the Variant 1
 * treatment from the mockup HERO/VILLAIN BADGE showcase (locked): the
 * relevant team's avatar is wrapped in a 2px tinted ring so you can still
 * see *which* team carries the status. The narrative caption pill
 * (HERO DEFEAT / VILLAIN VICTORY) is rendered beneath the central score
 * column rather than under the crest. When both sides carry a status the
 * two pills stack under the score.
 *
 * @param {{
 *   homeId: number,
 *   awayId: number,
 *   homeName: string,
 *   awayName: string,
 *   homeDisplayName?: string,
 *   awayDisplayName?: string,
 *   homeLive: number | null | undefined,
 *   awayLive: number | null | undefined,
 *   homeRemaining?: number | null,
 *   awayRemaining?: number | null,
 *   teamLogoMap: object,
 *   kitIndexByEntry?: object,
 *   compact?: boolean,
 *   expanded?: boolean,
 *   bannerExtras?: { home?: React.ReactNode, away?: React.ReactNode },
 *   homeStatus?: 'hero' | 'villain' | null,
 *   awayStatus?: 'hero' | 'villain' | null,
 *   onToggle?: () => void,
 *   ariaControls?: string,
 *   chevronEnd?: React.ReactNode,
 * }} props
 */
export function LiveFaceOffRow({
  homeId,
  awayId,
  homeName,
  awayName,
  homeDisplayName,
  awayDisplayName,
  homeLive,
  awayLive,
  homeRemaining = null,
  awayRemaining = null,
  teamLogoMap,
  kitIndexByEntry,
  compact = false,
  expanded = false,
  bannerExtras = {},
  homeStatus = null,
  awayStatus = null,
  onToggle,
  ariaControls,
  chevronEnd = null,
}) {
  const lead = liveFixtureLead(homeLive, awayLive);
  const homeWinner = lead === 'home';
  const awayWinner = lead === 'away';
  const homeScoreLive = homeLive != null;
  const awayScoreLive = awayLive != null;
  const hasStatus = Boolean(homeStatus) || Boolean(awayStatus);
  const hasBothStatus = Boolean(homeStatus) && Boolean(awayStatus);

  const RowEl = onToggle ? 'button' : 'div';
  const interactiveProps = onToggle
    ? {
        type: 'button',
        onClick: onToggle,
        'aria-expanded': expanded,
        'aria-controls': ariaControls,
      }
    : {};

  /**
   * Stylish "X to play" sub-row rendered under each team name. Replaces the
   * older bracketed `(N)` next to the score so the to-play count lives in
   * one place per team (under the name) and the score row stays clean
   * (`44 – 53`). Amber pulse dot reads "still in play"; green pulse +
   * "All done" once every starter has finished. Render nothing when the
   * squad payload is missing (`null`) so an orphan / not-yet-ingested
   * fixture doesn't render a misleading row.
   */
  function renderToPlay(n, side) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    const count = Math.max(0, Math.floor(Number(n)));
    const done = count === 0;
    const label = done ? 'All done' : `${count} to play`;
    const ariaLabel = done
      ? `${side === 'home' ? 'Home' : 'Away'} team — all 11 starters have finished their fixtures`
      : `${count} starter${count === 1 ? '' : 's'} still to play`;
    return (
      <span
        className={
          'live-banner-row__to-play' +
          (done ? ' live-banner-row__to-play--done' : '')
        }
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span
          className={
            'live-banner-row__to-play-dot' +
            (done ? ' live-banner-row__to-play-dot--done' : '')
          }
          aria-hidden="true"
        />
        <span className="live-banner-row__to-play-text">{label}</span>
      </span>
    );
  }

  return (
    <RowEl
      className={
        'live-banner-row' +
        (compact ? ' live-banner-row--compact' : '') +
        (onToggle ? ' live-banner-row--toggle' : '') +
        (expanded ? ' live-banner-row--open' : '') +
        (hasStatus ? ' live-banner-row--has-status' : '') +
        (hasBothStatus ? ' live-banner-row--has-status-both' : '')
      }
      {...interactiveProps}
    >
      <div className="live-banner-row__side live-banner-row__side--home">
        {bannerExtras.home ?? null}
        <span className="live-banner-row__crest">
          <HeroVillainAvatarFrame status={homeStatus} size="default">
            <TeamAvatar
              entryId={homeId}
              name={homeName}
              size={compact ? 'sm' : 'md'}
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </HeroVillainAvatarFrame>
        </span>
        <span className="live-banner-row__names">
          <span
            className={
              'live-banner-row__name' +
              (homeWinner ? ' live-banner-row__name--winner' : '') +
              (awayWinner ? ' live-banner-row__name--loser' : '')
            }
            title={homeName}
          >
            {homeDisplayName ?? homeName}
          </span>
          {renderToPlay(homeRemaining, 'home')}
        </span>
      </div>

      <div className="live-banner-row__center">
      <div className="live-banner-row__score tabular" aria-label="Gameweek score">
        {homeScoreLive && awayScoreLive ? (
          <>
            <span className="live-banner-row__score-side live-banner-row__score-side--home">
              <span
                className={
                  'live-banner-row__score-half' +
                  (homeWinner ? ' live-banner-row__score-half--winner' : '') +
                  (awayWinner ? ' live-banner-row__score-half--loser' : '')
                }
              >
                {homeLive}
              </span>
            </span>
            <span className="live-banner-row__score-sep" aria-hidden="true">
              –
            </span>
            <span className="live-banner-row__score-side live-banner-row__score-side--away">
              <span
                className={
                  'live-banner-row__score-half' +
                  (awayWinner ? ' live-banner-row__score-half--winner' : '') +
                  (homeWinner ? ' live-banner-row__score-half--loser' : '')
                }
              >
                {awayLive}
              </span>
            </span>
          </>
        ) : (
          <span className="live-banner-row__score-pending muted">vs</span>
        )}
      </div>
        {hasStatus ? (
          <span className="live-banner-row__status-captions">
            {homeStatus ? (
              <span
                className={
                  'live-banner-row__caption-pill live-banner-row__caption-pill--' +
                  homeStatus
                }
                aria-label={`${homeName}: ${HERO_VILLAIN_LABEL[homeStatus]}`}
              >
                {HERO_VILLAIN_LABEL[homeStatus]}
              </span>
            ) : null}
            {awayStatus ? (
              <span
                className={
                  'live-banner-row__caption-pill live-banner-row__caption-pill--' +
                  awayStatus
                }
                aria-label={`${awayName}: ${HERO_VILLAIN_LABEL[awayStatus]}`}
              >
                {HERO_VILLAIN_LABEL[awayStatus]}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="live-banner-row__side live-banner-row__side--away">
        <span className="live-banner-row__names live-banner-row__names--away">
          <span
            className={
              'live-banner-row__name' +
              (awayWinner ? ' live-banner-row__name--winner' : '') +
              (homeWinner ? ' live-banner-row__name--loser' : '')
            }
            title={awayName}
          >
            {awayDisplayName ?? awayName}
          </span>
          {renderToPlay(awayRemaining, 'away')}
        </span>
        <span className="live-banner-row__crest">
          <HeroVillainAvatarFrame status={awayStatus} size="default">
            <TeamAvatar
              entryId={awayId}
              name={awayName}
              size={compact ? 'sm' : 'md'}
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </HeroVillainAvatarFrame>
        </span>
        {bannerExtras.away ?? null}
      </div>

      {chevronEnd ?? null}
    </RowEl>
  );
}
