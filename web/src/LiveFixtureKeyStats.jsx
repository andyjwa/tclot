import { useMemo } from 'react';
import { keyStatRows } from './liveFixtureCardDerivations.js';

/**
 * One comparison row: home value (left) and away value (right) flanking a
 * centred label, with a split violet bar beneath showing the home/away
 * proportion. Shared by the Key Stats and H2H card panes.
 *
 * @param {{ label: string, home: number, away: number, homeText?: string, awayText?: string }} props
 */
export function LiveFixtureCompareRow({ label, home, away, homeText, awayText }) {
  const total = (Number(home) || 0) + (Number(away) || 0);
  const homePct = total > 0 ? Math.round(((Number(home) || 0) / total) * 100) : 0;
  const awayPct = total > 0 ? 100 - homePct : 0;
  return (
    <div className="lfc-cmp">
      <div className="lfc-cmp__head">
        <span className="lfc-cmp__val tabular">{homeText ?? home}</span>
        <span className="lfc-cmp__label">{label}</span>
        <span className="lfc-cmp__val tabular">{awayText ?? away}</span>
      </div>
      <div className="lfc-cmp__bars">
        <div className="lfc-cmp__bar lfc-cmp__bar--home">
          <span className="lfc-cmp__fill" style={{ width: `${homePct}%` }} />
        </div>
        <div className="lfc-cmp__bar lfc-cmp__bar--away">
          <span className="lfc-cmp__fill" style={{ width: `${awayPct}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Key Stats pane — per-team aggregates over the effective starting XI in
 * the spec order (Players 60+, Goals, Assists, Def Con, Clean Sheets,
 * Yellow Cards, Red Cards).
 *
 * @param {{ homeSquad: object, awaySquad: object }} props
 */
export function LiveFixtureKeyStats({ homeSquad, awaySquad }) {
  const rows = useMemo(
    () => keyStatRows(homeSquad, awaySquad),
    [homeSquad, awaySquad],
  );
  return (
    <div className="lfc-block">
      <h3 className="lfc-block__h">Key Stats</h3>
      {rows.map((r) => (
        <LiveFixtureCompareRow
          key={r.key}
          label={r.label}
          home={r.home}
          away={r.away}
        />
      ))}
    </div>
  );
}
