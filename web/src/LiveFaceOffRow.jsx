import { TeamAvatar } from './TeamAvatar';
import {
  HeroVillainAvatarFrame,
  HERO_VILLAIN_LABEL,
} from './HeroVillainAvatarFrame';
import { liveFixtureLead } from './liveScoresDerivations.js';

/**
 * Small football-shirt glyph used by the "players still to play" cluster under
 * each team name. One shirt == one starter who has not yet finished their
 * fixture; the cluster shrinks as players complete and disappears (replaced by
 * an `FT` tag) once every starter is done. `aria-hidden` because the parent
 * `.live-banner-row__to-play` already carries a descriptive label.
 */
function ShirtIcon() {
  return (
    <svg
      className="live-banner-row__shirt"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 2.5 C9 4 15 4 15 2.5 L19.5 5 L22 9.5 L18 12 L16.5 10.8 L16.5 21.5 L7.5 21.5 L7.5 10.8 L6 12 L2 9.5 L4.5 5 Z" />
    </svg>
  );
}

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
 *   layout?: 'shirts' | 'bars',
 * }} props
 *
 * `layout` selects the "players still to play" presentation (feature-flagged
 * via `readLiveScoreLayout()`):
 *  - `shirts` (default): a shrinking jersey cluster under each team name.
 *  - `bars`: mockup "Variation 3" — names + score on top, with two muted
 *    progress bars running full-width along the bottom of the tile, filling
 *    inward, and `FT` / a to-play count at the outer ends.
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
  layout = 'shirts',
}) {
  const barsMode = layout === 'bars';
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
   * "Players still to play" cluster rendered under each team name. Each team
   * starts the gameweek with 11 shirts and a shirt is removed as every starter
   * finishes, so the shirts that remain are the starters still to play; the
   * cluster physically shrinks toward full time. Once the last starter is done
   * the shirts give way to a quiet `FT` tag. Render nothing when the squad
   * payload is missing (`null`) so an orphan / not-yet-ingested fixture doesn't
   * render a misleading row.
   */
  function renderToPlay(n, side) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    const remaining = Math.max(0, Math.min(11, Math.floor(Number(n))));
    const done = remaining === 0;
    const ariaLabel = done
      ? `${side === 'home' ? 'Home' : 'Away'} team — all 11 starters have finished their fixtures`
      : `${remaining} starter${remaining === 1 ? '' : 's'} still to play`;
    return (
      <span
        className={
          'live-banner-row__to-play' +
          (done ? ' live-banner-row__to-play--done' : '')
        }
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {done ? (
          <span className="live-banner-row__ft" aria-hidden="true">
            FT
          </span>
        ) : (
          <span className="live-banner-row__shirts" aria-hidden="true">
            {Array.from({ length: remaining }, (_, i) => (
              <ShirtIcon key={i} />
            ))}
          </span>
        )}
      </span>
    );
  }

  /**
   * One half of the baseline rail (mockup "Variation 3"). The track fills with
   * the proportion of starters who have *finished* (`played / 11`) and the
   * label at the outer end shows the to-play count, or `FT` once everyone is
   * done. Orange while live, brand purple at full time; both kept muted so the
   * bar stays informative without competing with the names and score. Renders
   * an empty (unfilled) track when the squad payload is missing so the two
   * halves stay symmetric.
   */
  function renderRailHalf(n, side) {
    const away = side === 'away';
    const hasData = n != null && Number.isFinite(Number(n));
    const remaining = hasData
      ? Math.max(0, Math.min(11, Math.floor(Number(n))))
      : null;
    const done = remaining === 0;
    const played = remaining == null ? 0 : 11 - remaining;
    const pct = Math.round((played / 11) * 100);
    const ariaLabel = !hasData
      ? undefined
      : done
        ? `${away ? 'Away' : 'Home'} team — all 11 starters have finished their fixtures`
        : `${remaining} starter${remaining === 1 ? '' : 's'} still to play`;
    return (
      <span
        className={
          'live-banner-row__half' +
          (away ? ' live-banner-row__half--away' : '')
        }
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {hasData ? (
          <span
            className={
              'live-banner-row__rail-status' +
              (done ? ' live-banner-row__rail-status--ft' : '')
            }
            aria-hidden="true"
          >
            {done ? 'FT' : remaining}
          </span>
        ) : null}
        <span className="live-banner-row__track" aria-hidden="true">
          {hasData ? (
            <span
              className={
                'live-banner-row__track-fill ' +
                (done
                  ? 'live-banner-row__track-fill--ft'
                  : 'live-banner-row__track-fill--live')
              }
              style={{ width: `${pct}%` }}
            />
          ) : null}
        </span>
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
        (hasBothStatus ? ' live-banner-row--has-status-both' : '') +
        (barsMode ? ' live-banner-row--bars' : '')
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
          {barsMode ? null : renderToPlay(homeRemaining, 'home')}
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
          {barsMode ? null : renderToPlay(awayRemaining, 'away')}
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

      {barsMode ? (
        <div className="live-banner-row__rail">
          {renderRailHalf(homeRemaining, 'home')}
          {renderRailHalf(awayRemaining, 'away')}
        </div>
      ) : null}

      {chevronEnd ?? null}
    </RowEl>
  );
}
