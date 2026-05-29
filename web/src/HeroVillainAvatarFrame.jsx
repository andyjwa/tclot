export const HERO_VILLAIN_LABEL = {
  hero: 'HERO DEFEAT',
  villain: 'VILLAIN VICTORY',
};

export const HERO_VILLAIN_ARIA = {
  hero: 'Hero defeat: 2nd-highest raw gameweek score in the league but losing this head-to-head on live points',
  villain: 'Villain detected: winning this head-to-head gameweek on live points while ranked 7th in the league for raw gameweek total',
};

/**
 * Hero / villain narrative wrapper around an avatar — locked mockup Variant 1
 * (see `Mockup.jsx` HERO/VILLAIN BADGE showcase + DECISIONS tracker). Applied
 * consistently across every production surface that previously rendered the
 * rectangular HERO DEFEAT / VILLAIN VICTORY tile.
 *
 * Size variants (different host contexts have different vertical/horizontal
 * room — the avatar treatment compresses accordingly):
 *
 *  - `default`: 2px tinted ring around the avatar only. The narrative
 *    caption pill no longer renders here — for face-off rows the
 *    HERO DEFEAT / VILLAIN VICTORY pill is rendered by the caller
 *    beneath the central score column (see `LiveFaceOffRow`), so the
 *    ring identifies *which* team carries the status while the pill text
 *    sits under the score. The ring's `role="img"` + `aria-label` keep
 *    the status accessible even though the visible pill moved.
 *
 *  - `compact`: 2px tinted ring only, NO caption slot rendered. Used in
 *    `live-squad-tile` heads where the team name immediately follows the
 *    avatar and already serves as a caption.
 *
 *  - `tiny`: 2px tinted ring only — no dot, no caption. Used in the Live
 *    Table standings row where the cell is tight. Tinted row background and
 *    the wrapper's `aria-label` (also surfaced as `title`) provide affordance.
 *
 * If `status` is nullish the wrapper renders the avatar untreated (no ring,
 * no caption).
 *
 * @param {{
 *   status: 'hero' | 'villain' | null | undefined,
 *   size?: 'default' | 'compact' | 'tiny',
 *   children: import('react').ReactNode,
 * }} props
 */
export function HeroVillainAvatarFrame({
  status,
  size = 'default',
  children,
}) {
  const ariaLabel = status ? HERO_VILLAIN_ARIA[status] : undefined;

  return (
    <span
      className={
        'live-banner-row__avatar-wrap' +
        (status ? ' live-banner-row__avatar-wrap--' + status : '') +
        (size !== 'default' ? ' live-banner-row__avatar-wrap--size-' + size : '')
      }
      role={status ? 'img' : undefined}
      aria-label={ariaLabel}
      title={status && size === 'tiny' ? ariaLabel : undefined}
    >
      {children}
    </span>
  );
}
