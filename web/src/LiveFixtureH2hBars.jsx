import { useMemo } from 'react';
import { LiveFixtureCompareRow } from './LiveFixtureKeyStats.jsx';
import { h2hSeasonSummary, h2hBarRows } from './liveFixtureCardDerivations.js';

/**
 * H2H pane — season head-to-head record between the two managers, derived
 * from the full season `matches` list, rendered as violet compare bars
 * (wins, average points, total points).
 *
 * @param {{ matches: object[], homeId: number, awayId: number, homeName?: string, awayName?: string }} props
 */
export function LiveFixtureH2hBars({ matches, homeId, awayId, homeName, awayName }) {
  const summary = useMemo(
    () => h2hSeasonSummary(matches, homeId, awayId),
    [matches, homeId, awayId],
  );
  const rows = useMemo(() => h2hBarRows(summary), [summary]);

  return (
    <div className="lfc-block">
      <h3 className="lfc-block__h">Season head-to-head</h3>
      {summary.meetings === 0 ? (
        <p className="lfc-h2h__empty">
          {homeName && awayName
            ? `${homeName} and ${awayName} haven’t met yet this season.`
            : 'No meetings yet this season.'}
        </p>
      ) : (
        <>
          <p className="lfc-h2h__meta">
            {summary.meetings} meeting{summary.meetings === 1 ? '' : 's'} this season
            {summary.draws ? ` · ${summary.draws} draw${summary.draws === 1 ? '' : 's'}` : ''}
          </p>
          {rows.map((r) => (
            <LiveFixtureCompareRow
              key={r.key}
              label={r.label}
              home={r.home}
              away={r.away}
              homeText={r.homeText}
              awayText={r.awayText}
            />
          ))}
        </>
      )}
    </div>
  );
}
