/**
 * <PointsCell> — unified PTS display used across leaderboards and tables.
 *
 * Extracted from the Champion of Champions → Algorithm mobile leaderboard
 * (`.heritage-cofc-algo-lb__total*`) so every "violet PTS" stat across
 * Standings, Historic Standings, CofC Cumulative, FPL Live Table, Team
 * History leaderboard, and the algo leaderboard itself reads the same.
 *
 * Sizes:
 *   - `sm` — 16px value, matches the existing algorithm leaderboard
 *     (so refactor is visually identical).
 *   - `md` — 20px value, used inside table cells where a column header
 *     already carries the "PTS" label and `showLabel` is false.
 *   - `lg` — 25.6px value, reserved for hero-style placements.
 *
 * Tones:
 *   - `violet` (default) — brand purple value.
 *   - `ink` — strong text colour, for surfaces where the violet would
 *     collide with another accent.
 *
 * `showLabel` defaults to true ("stat row" usage like the leaderboard);
 * set false for table-cell usage where the column header carries the
 * label.
 */
export function PointsCell({
  value,
  label = 'PTS',
  size = 'md',
  tone = 'violet',
  showLabel = true,
  className = '',
}) {
  return (
    <span
      className={[
        'pts-cell',
        `pts-cell--${size}`,
        `pts-cell--${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="pts-cell__value tabular">{value}</span>
      {showLabel ? <span className="pts-cell__label">{label}</span> : null}
    </span>
  )
}
