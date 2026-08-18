import { useCallback, useLayoutEffect, useRef } from 'react';
import { TeamAvatar } from './TeamAvatar';
import {
  HeroVillainAvatarFrame,
  HERO_VILLAIN_LABEL,
  HERO_VILLAIN_SHORT,
} from './HeroVillainAvatarFrame';
import { liveFixtureLead } from './liveScoresDerivations.js';
import { firstWord } from './teamNameUtils.js';

/**
 * Team name that shows the full name when it fits its slot and falls back to
 * the team's FIRST WORD ONLY (never a mid-word ellipsis) when the full name
 * would overflow — matching the Standings hero/table treatment via the shared
 * {@link firstWord} helper.
 *
 * Fit detection is imperative rather than pure-CSS: the slot is flex-shrunk to
 * the available width by the row grid (the side cell is a fixed `1fr`), so when
 * the full name overflows, `scrollWidth > clientWidth`. We measure with the
 * full name in place, then swap to the first word if it doesn't fit. The
 * measure/apply runs:
 *  - after every render (a layout effect with no deps), so a score-tick
 *    re-render that resets the text node back to the full name is corrected
 *    before paint (no flash); and
 *  - on viewport resize, via a `ResizeObserver` on the stable `…__side` cell
 *    (observing the slot itself would loop, since we mutate its width).
 *
 * `candidate` is the caller's display name — already collapsed to the first
 * word on mobile (so it simply renders the first word there) and the full name
 * on desktop (where the fit check decides). The DOM text is written
 * imperatively so React never fights the measurement.
 */
function FittedTeamName({ fullName, displayName, className, title }) {
  const candidate = displayName ?? fullName;
  const short = firstWord(fullName);
  /** Last-resort single token — covers curated labels that are already
   * multi-word (e.g. `Seoul Shire`, `Atleti Bilbo`): without it, a slot
   * too narrow for the curated label would ellipsize mid-word. */
  const tiniest = String(short || candidate || '')
    .trim()
    .split(/\s+/)[0] ?? '';
  const ref = useRef(null);

  const apply = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    /** `scrollWidth`/`clientWidth` are integer-rounded, which can hide a
     * sub-pixel overflow that CSS still ellipsizes (e.g. 76.2px of text in
     * a 74.6px box reads as 75 <= 75). Measure the fractional text width
     * with a Range instead; keep the integer check as a cheap first cut. */
    const fits = () => {
      if (el.scrollWidth > el.clientWidth) return false;
      if (typeof document === 'undefined' || !document.createRange) return true;
      const range = document.createRange();
      range.selectNodeContents(el);
      const textWidth = range.getBoundingClientRect().width;
      return textWidth <= el.getBoundingClientRect().width + 0.1;
    };
    el.textContent = candidate;
    if (fits()) return;
    if (short && short !== candidate) {
      el.textContent = short;
      if (fits()) return;
    }
    if (tiniest && tiniest !== el.textContent) {
      el.textContent = tiniest;
    }
  }, [candidate, short, tiniest]);

  // Re-apply after every render so a re-render (e.g. live score tick) that
  // resets the text node to the full name is re-fitted before the browser
  // paints.
  useLayoutEffect(() => {
    apply();
  });

  // Re-fit on viewport resize. Observe the stable side cell (fixed grid `1fr`)
  // rather than the slot — mutating the slot's own width would retrigger the
  // observer in a loop.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const sideEl = el.closest('.live-banner-row__side') || el.parentElement;
    if (!sideEl) return undefined;
    const ro = new ResizeObserver(() => apply());
    ro.observe(sideEl);
    return () => ro.disconnect();
  }, [apply]);

  return (
    <span ref={ref} className={className} title={title}>
      {candidate}
    </span>
  );
}

/**
 * Compact face-off row (desktop wide grid, or mobile compressed) — both
 * variants share a single 1-fr · auto · 1-fr grid and only the size class
 * differs. Used inside `LiveBannerGroup` and the mobile compressed list
 * (mockup `mockup-live-group__row` and `mockup-live-compressed__row`).
 *
 * Layout follows the locked FotMob-style mockup: the team name sits on the
 * OUTER edge and the crest hugs the central score (name · crest · score ·
 * crest · name). A small grey "players still to play" countdown pill sits at
 * the FAR END of each side (home far-left, away far-right) showing that team's
 * remaining starters, flipping to `FT` once all 11 are done. The older shirt
 * cluster under each name is retired in favour of these end pills.
 *
 * Winner emphasis follows mockup **Option C** (locked decision): both score
 * numbers share one strong ink colour and the winning side gets a soft purple
 * "glass" pill behind it; team names stay equal-weight. The score lives in a
 * fixed-width 3-column grid (home · "–" · away) so every separator and digit
 * lines up vertically row to row, and the winner pill is painted as a spread
 * box-shadow (zero layout impact) so it never nudges the numbers out of line.
 *
 * Hero defeat / villain victory narrative status: the relevant team's avatar
 * keeps the Variant 1 tinted ring (marks *which* team), and a short one-word
 * caption (Hero / Villain) is tucked under that team's name. The caption is
 * absolutely positioned beneath the name so it leaves the name / crest / score
 * baseline untouched.
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
   * "Players still to play" countdown pill rendered at the far end of each
   * side. Shows the number of starters that have not yet finished their
   * fixture, counting down toward full time; once the last starter is done it
   * flips to a quiet `FT` tag. Renders nothing when the squad payload is
   * missing (`null`) so an orphan / not-yet-ingested fixture doesn't show a
   * misleading count — the score stays centred regardless because the team
   * block hugs the centre via `margin`, not this pill.
   */
  function renderCountdownPill(n, side) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    const remaining = Math.max(0, Math.min(11, Math.floor(Number(n))));
    const done = remaining === 0;
    const ariaLabel = done
      ? `${side === 'home' ? 'Home' : 'Away'} team — all 11 starters have finished their fixtures`
      : `${remaining} starter${remaining === 1 ? '' : 's'} still to play`;
    return (
      <span
        className={
          'live-banner-row__countdown' +
          (done ? ' live-banner-row__countdown--done' : '')
        }
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {done ? 'FT' : remaining}
      </span>
    );
  }

  /**
   * One-word narrative caption (Hero / Villain) tucked under a team's name.
   * Returns nothing when the side carries no status. Absolutely positioned by
   * CSS so it never shifts the name / crest / score baseline.
   */
  function renderAward(status, name) {
    if (!status) return null;
    return (
      <span
        className={'live-banner-row__award live-banner-row__award--' + status}
        aria-label={`${name}: ${HERO_VILLAIN_LABEL[status]}`}
      >
        {HERO_VILLAIN_SHORT[status]}
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
        {barsMode ? null : renderCountdownPill(homeRemaining, 'home')}
        <span className="live-banner-row__teamblock live-banner-row__teamblock--home">
          <span className="live-banner-row__names">
            <FittedTeamName
              className={
                'live-banner-row__name' +
                (homeWinner ? ' live-banner-row__name--winner' : '') +
                (awayWinner ? ' live-banner-row__name--loser' : '')
              }
              fullName={homeName}
              displayName={homeDisplayName}
              title={homeName}
            />
            {renderAward(homeStatus, homeName)}
          </span>
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
        </span>
      </div>

      <div className="live-banner-row__center">
        <div className="live-banner-row__score tabular" aria-label="Gameweek score">
          {homeScoreLive && awayScoreLive ? (
            <>
              <span className="live-banner-row__score-cell live-banner-row__score-cell--home">
                <span
                  className={
                    'live-banner-row__score-half' +
                    (homeWinner ? ' live-banner-row__score-half--winner' : '')
                  }
                >
                  {homeLive}
                </span>
              </span>
              <span className="live-banner-row__score-sep" aria-hidden="true">
                –
              </span>
              <span className="live-banner-row__score-cell live-banner-row__score-cell--away">
                <span
                  className={
                    'live-banner-row__score-half' +
                    (awayWinner ? ' live-banner-row__score-half--winner' : '')
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
      </div>

      <div className="live-banner-row__side live-banner-row__side--away">
        <span className="live-banner-row__teamblock live-banner-row__teamblock--away">
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
          <span className="live-banner-row__names live-banner-row__names--away">
            <FittedTeamName
              className={
                'live-banner-row__name' +
                (awayWinner ? ' live-banner-row__name--winner' : '') +
                (homeWinner ? ' live-banner-row__name--loser' : '')
              }
              fullName={awayName}
              displayName={awayDisplayName}
              title={awayName}
            />
            {renderAward(awayStatus, awayName)}
          </span>
        </span>
        {barsMode ? null : renderCountdownPill(awayRemaining, 'away')}
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
