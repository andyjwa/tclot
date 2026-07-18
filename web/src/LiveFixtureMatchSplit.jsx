import { useMemo } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { liveGwDisplayTotal } from './liveGwTotals.js';
import {
  minutesTone,
  rowsByPointsContributed,
  sortStartingXIByPosition,
} from './liveScoresDerivations.js';
import { effectiveBench, effectiveStarters } from './liveSquadEffective.js';

/** Minutes dot tone → CSS suffix: full/good → played, partial/low → part, none → none. */
function dotKind(row) {
  const mins = Number(row.minutes) || 0;
  const tone = minutesTone(mins, mins > 0);
  if (tone === 'full' || tone === 'good') return 'full';
  if (tone === 'partial' || tone === 'low') return 'part';
  return 'none';
}

function SplitRow({ row, onOpenPlayer, bench }) {
  const pts = Number(row.total_points) || 0;
  const played = (Number(row.minutes) || 0) > 0;
  const displayName = row.displayName ?? row.web_name ?? `#${row.element}`;
  const inner = (
    <>
      <span className="lfc-split__pos">{row.posSingular}</span>
      <span className="lfc-split__name">{displayName}</span>
      <span className={`lfc-split__dot lfc-split__dot--${dotKind(row)}`} aria-hidden="true" />
      <span className="lfc-split__pts">{played || pts !== 0 ? pts : '–'}</span>
    </>
  );
  const cls =
    'lfc-split__row' + (!played ? ' lfc-split__row--dnp' : '') + (bench ? ' lfc-split__row--bench' : '');
  if (!onOpenPlayer) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      className={cls}
      onClick={() => onOpenPlayer(row)}
      title={`${displayName} — view player`}
    >
      {inner}
    </button>
  );
}

function SplitColumn({ squad, name, entryId, ctx, onOpenPlayer, away }) {
  const starters = useMemo(
    () => sortStartingXIByPosition(effectiveStarters(squad)),
    [squad],
  );
  const bench = useMemo(() => rowsByPointsContributed(effectiveBench(squad)), [squad]);
  const total = liveGwDisplayTotal(squad);

  return (
    <div className={'lfc-split__col' + (away ? ' lfc-split__col--away' : '')}>
      <div className="lfc-split__head">
        <span className="lfc-split__head-badge">
          <TeamAvatar
            entryId={entryId}
            name={name}
            size="sm"
            logoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
          />
        </span>
        <span className="lfc-split__head-name">{name}</span>
        <span className="lfc-split__head-pts tabular">{total ?? '—'}</span>
      </div>
      {squad && !squad.error ? (
        <>
          {starters.map((r) => (
            <SplitRow
              key={`s-${r.element}-${r.pickPosition}`}
              row={r}
              onOpenPlayer={onOpenPlayer}
            />
          ))}
          {bench.length ? (
            <>
              <div className="lfc-split__benchhd">Bench</div>
              {bench.map((r) => (
                <SplitRow
                  key={`b-${r.element}-${r.pickPosition}`}
                  row={r}
                  onOpenPlayer={onOpenPlayer}
                  bench
                />
              ))}
            </>
          ) : null}
        </>
      ) : (
        <p className="muted muted--tight">{squad?.error ?? 'No squad data.'}</p>
      )}
    </div>
  );
}

/**
 * Match tab — both teams on one page as two independent half-width columns
 * (mockup "split columns" option B). Each column pins crest + name + running
 * total at its top; rows compress to POS · name · minutes dot · PTS so the
 * two XIs (+ benches) fit side by side on a phone.
 *
 * @param {{ fixture: object, ctx: object, onOpenPlayer?: (row, squad) => void }} props
 */
export function LiveFixtureMatchSplit({ fixture, ctx, onOpenPlayer }) {
  const { homeId, awayId, homeName, awayName, homeSquad, awaySquad } = fixture;
  const pick = (squad) =>
    onOpenPlayer ? (row) => onOpenPlayer(row, squad) : undefined;
  return (
    <div className="lfc-split">
      <SplitColumn
        squad={homeSquad}
        name={homeName}
        entryId={homeId}
        ctx={ctx}
        onOpenPlayer={pick(homeSquad)}
      />
      <SplitColumn
        squad={awaySquad}
        name={awayName}
        entryId={awayId}
        ctx={ctx}
        onOpenPlayer={pick(awaySquad)}
        away
      />
    </div>
  );
}
