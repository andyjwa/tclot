import { useMemo, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { liveGwDisplayTotal } from './liveGwTotals.js';
import {
  dcThresholdReached,
  minutesTone,
  playerLiveState,
  rowsByPointsContributed,
  sortStartingXIByPosition,
} from './liveScoresDerivations.js';
import { effectiveBench, effectiveStarters } from './liveSquadEffective.js';

/**
 * Minutes dot tone → CSS suffix: full/good → green, partial/low → yellow.
 * RED (`out`) when the player is out of the running: no GW fixture for their
 * club ("not in the squad"), or their club's fixtures finished with 0 minutes
 * (DNP). Grey `none` is reserved for pre-kickoff.
 */
function dotKind(row) {
  const state = playerLiveState(row);
  if (state.kind === 'dnp' || state.kind === 'none') return 'out';
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

/** Sticky team header — a direct grid child so the events band can span the
 *  full card width between the headers and the two player columns. */
function SplitHead({ squad, name, entryId, ctx, away }) {
  const total = liveGwDisplayTotal(squad);
  return (
    <div
      className={
        'lfc-split__head lfc-split__head--' + (away ? 'away' : 'home')
      }
    >
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
  );
}

function SplitColumn({ squad, onOpenPlayer, away }) {
  const starters = useMemo(
    () => sortStartingXIByPosition(effectiveStarters(squad)),
    [squad],
  );
  const bench = useMemo(() => rowsByPointsContributed(effectiveBench(squad)), [squad]);

  return (
    <div className={'lfc-split__col' + (away ? ' lfc-split__col--away' : '')}>
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
 * Event categories for the "Match events" block, in display order. `glyph`
 * kinds render a letter chip; `card` kinds render a coloured card swatch.
 */
const EVENT_KINDS = [
  { id: 'g', glyph: 'G', title: 'Goals' },
  { id: 'a', glyph: 'A', title: 'Assists' },
  { id: 'dc', glyph: 'DC', title: 'Defensive contribution' },
  { id: 'sv', glyph: 'SV', title: 'Save points' },
  { id: 'y', card: 'y', title: 'Yellow cards' },
  { id: 'r', card: 'r', title: 'Red cards' },
];

/**
 * Collects per-category event entries ({ name, tag }) for a squad's
 * starting XI only. Tags are the muted suffixes: ×n for multiples,
 * the DC count for DC, and ×saves for keepers who earned save points.
 */
function squadEvents(squad) {
  const ev = { g: [], a: [], dc: [], sv: [], y: [], r: [] };
  for (const row of sortStartingXIByPosition(effectiveStarters(squad))) {
    const name = row.displayName ?? row.web_name ?? `#${row.element}`;
    const played = (Number(row.minutes) || 0) > 0;
    const goals = Number(row.goalsScored) || 0;
    const assists = Number(row.assists) || 0;
    const dc = Number(row.dcCount) || 0;
    const saves = Number(row.saves) || 0;
    const yellows = Number(row.yellowCards) || 0;
    const reds = Number(row.redCards) || 0;
    if (goals > 0) ev.g.push({ name, tag: goals > 1 ? `×${goals}` : '' });
    if (assists > 0) ev.a.push({ name, tag: assists > 1 ? `×${assists}` : '' });
    if (played && dcThresholdReached(row.posSingular, dc)) {
      ev.dc.push({ name, tag: String(dc) });
    }
    // Save points: 1 pt per 3 saves, so only keepers at 3+ saves appear.
    if (saves >= 3) ev.sv.push({ name, tag: `×${saves}` });
    if (yellows > 0) ev.y.push({ name, tag: yellows > 1 ? `×${yellows}` : '' });
    if (reds > 0) ev.r.push({ name, tag: '' });
  }
  return ev;
}

function EventNames({ entries }) {
  if (!entries.length) {
    return <span className="lfc-events__none">—</span>;
  }
  return entries.map((e, i) => (
    <span key={`${e.name}-${i}`} className="lfc-events__nm">
      {i > 0 ? <span className="lfc-events__sep">, </span> : null}
      {e.name}
      {e.tag ? <span className="lfc-events__x"> {e.tag}</span> : null}
    </span>
  ));
}

function EventKindIcon({ kind }) {
  if (kind.card) {
    return (
      <span
        className={`lfc-events__cardico lfc-events__cardico--${kind.card}`}
        role="img"
        aria-label={kind.title}
      />
    );
  }
  return (
    <span
      className={`lfc-events__ico lfc-events__ico--${kind.id}`}
      aria-label={kind.title}
    >
      {kind.glyph}
    </span>
  );
}

/**
 * "Match events" band under the team headers (mockup T2 + collapse):
 * a tinted full-width section, expanded by default, with a toggle strip of
 * per-category counts and a chevron. Expanded it shows one row per event
 * category with the type glyph on the centre line, home names
 * right-aligned, away names left-aligned (mockup option 3b). Names wrap
 * within their own half when a side gets busy; categories with no events
 * on either side are dropped, and the whole band hides when there are
 * none at all.
 */
function MatchEventsBlock({ homeSquad, awaySquad }) {
  const [open, setOpen] = useState(true);
  const home = useMemo(() => squadEvents(homeSquad), [homeSquad]);
  const away = useMemo(() => squadEvents(awaySquad), [awaySquad]);
  const kinds = EVENT_KINDS.filter(
    (k) => home[k.id].length || away[k.id].length,
  );
  if (!kinds.length) return null;
  return (
    <section
      className={'lfc-events' + (open ? ' lfc-events--open' : '')}
      aria-label="Match events, starting XI"
    >
      <button
        type="button"
        className="lfc-events__toggle"
        aria-expanded={open}
        aria-label="Match events"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? null : <span className="lfc-events__title">Match Events</span>}
        <span
          className={
            'lfc-events__chev' + (open ? ' lfc-events__chev--open' : '')
          }
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open ? (
        /* Whole-band tap collapses — the rows hold nothing interactive, and
           the chevron button remains the keyboard/AT toggle. */
        <div className="lfc-events__body" onClick={() => setOpen(false)}>
          {kinds.map((k) => (
            <div key={k.id} className="lfc-events__row" title={k.title}>
              <span className="lfc-events__side lfc-events__side--home">
                <EventNames entries={home[k.id]} />
              </span>
              <span className="lfc-events__mid">
                <EventKindIcon kind={k} />
              </span>
              <span className="lfc-events__side lfc-events__side--away">
                <EventNames entries={away[k.id]} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
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
      <SplitHead squad={homeSquad} name={homeName} entryId={homeId} ctx={ctx} />
      <SplitHead squad={awaySquad} name={awayName} entryId={awayId} ctx={ctx} away />
      <MatchEventsBlock homeSquad={homeSquad} awaySquad={awaySquad} />
      <SplitColumn squad={homeSquad} onOpenPlayer={pick(homeSquad)} />
      <SplitColumn squad={awaySquad} onOpenPlayer={pick(awaySquad)} away />
    </div>
  );
}
