import { useEffect, useRef, useState } from 'react';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';
import { TeamAvatar } from './TeamAvatar';
import { fplElementWebName } from './fplElementNames.js';
import { fixtureFplPoints } from './premFixturePoints.js';
import './PremMatchBoard.css';

const POS_RANK = { 1: 1, 2: 2, 3: 3, 4: 4 };
const NO_EVENTS = [];

function posRank(player, elementById) {
  const el = elementById?.[player?.elementId] ?? elementById?.[String(player?.elementId)];
  return POS_RANK[Number(el?.element_type)] ?? 5;
}

function sortXi(players, elementById) {
  return (players || [])
    .map((p, idx) => ({ p, idx, rank: posRank(p, elementById) }))
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((w) => w.p);
}

function playerLabel(player, elementById) {
  const el = elementById?.[player?.elementId] ?? elementById?.[String(player?.elementId)];
  if (el) return fplElementWebName(el, player.elementId);
  return player?.fplWebName?.trim() || player?.name || '—';
}

const POS_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POS_FROM_SHORT = { GK: 'GK', D: 'DEF', M: 'MID', F: 'FWD' };

function positionLabel(player, elementById) {
  const el = elementById?.[player?.elementId] ?? elementById?.[String(player?.elementId)];
  const fromType = POS_LABEL[Number(el?.element_type)];
  if (fromType) return fromType;
  const short = String(player?.fplPos || '').trim().toUpperCase();
  return POS_FROM_SHORT[short] || '';
}

function managerFirstWord(owner) {
  const name = String(owner?.teamName ?? '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0] || name;
}

/**
 * One lineup row. Every slot is always present so manager badges, the
 * chair, and the position sit on the same vertical lines no matter how
 * long the player or manager name is, and whether anyone owns the player.
 *
 * Pass `points` (including null) to add the fixed points column used by
 * the desktop scorecard. Omit it on the phone list.
 */
export function PremLineupRow({
  player,
  club,
  ownerByEl,
  elementById,
  teamById,
  teamLogoMap,
  kitIndexByEntry,
  points,
  bench = false,
}) {
  const id = Number(player?.elementId);
  const owner = Number.isFinite(id)
    ? ownerByEl?.get(id) ?? ownerByEl?.get(String(id)) ?? null
    : null;
  const el = elementById?.[player?.elementId] ?? elementById?.[String(player?.elementId)];
  const name = playerLabel(player, elementById);
  const pos = positionLabel(player, elementById);
  const mgr = managerFirstWord(owner);
  const showPts = points !== undefined;
  const crestUrl = club?.code != null ? crest(club) : null;
  const teamShort = el && teamById ? teamById[Number(el.team)]?.short_name : undefined;
  return (
    <div
      className={
        'prem-mlu-row' +
        (bench ? ' prem-mlu-row--bench' : '') +
        (owner ? ' is-owned' : '') +
        (showPts ? ' prem-mlu-row--pts' : '')
      }
    >
      {crestUrl ? (
        <img className="prem-mlu-crest" src={crestUrl} alt="" />
      ) : (
        <span className="prem-mlu-crest" aria-hidden />
      )}
      <span className="prem-mlu-name">
        <ClickablePlayerName
          element={player?.elementId}
          displayName={el ? fplElementWebName(el, player.elementId) : name}
          web_name={el ? fplElementWebName(el, player.elementId) : name}
          teamShort={teamShort}
        >
          {name}
        </ClickablePlayerName>
      </span>
      {showPts ? (
        <span className="prem-mlu-pts tabular">{points == null ? '–' : points}</span>
      ) : null}
      <span className="prem-mlu-mgr" title={owner?.teamName || undefined}>
        {mgr}
      </span>
      <span className="prem-mlu-badge">
        {owner ? (
          <TeamAvatar
            entryId={owner.leagueEntryId}
            name={owner.teamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        ) : null}
      </span>
      <span className="prem-mlu-icon">
        {owner?.onFantasyBench ? (
          <span className="prem-owner-bench" title="On fantasy bench" aria-label="On fantasy bench">
            🪑
          </span>
        ) : null}
      </span>
      <span className="prem-mlu-pos">{pos}</span>
    </div>
  );
}

function eventKey(ev, i) {
  if (ev?.eventId != null) return `id:${ev.eventId}`;
  return `${ev?.kind}|${ev?.minuteLabel}|${ev?.playerName}|${ev?.teamSide}|${i}`;
}

/**
 * Light "just in" set: events that appear after the first snapshot of this
 * match. The opening payload is not highlighted.
 */
function useJustInKeys(events, resetKey) {
  const seen = useRef(/** @type {Set<string>} */ (new Set()));
  const primed = useRef(false);
  const resetRef = useRef(resetKey);
  const [fresh, setFresh] = useState(() => new Set());

  const signature = (events || [])
    .map((ev, i) => eventKey(ev, i))
    .join('\n');

  useEffect(() => {
    if (resetRef.current !== resetKey) {
      resetRef.current = resetKey;
      seen.current = new Set();
      primed.current = false;
    }
    const keys = signature ? signature.split('\n') : [];
    if (!primed.current) {
      primed.current = true;
      for (const k of keys) seen.current.add(k);
      return undefined;
    }
    const newcomers = keys.filter((k) => k && !seen.current.has(k));
    for (const k of keys) seen.current.add(k);
    if (!newcomers.length) return undefined;
    setFresh(new Set(newcomers));
    const timer = window.setTimeout(() => setFresh(new Set()), 8000);
    return () => window.clearTimeout(timer);
  }, [signature, resetKey]);

  return fresh;
}

function statusLabel(fx) {
  const score = fx?.score;
  if (score?.finished || fx?.fplFixture?.finished || fx?.fplFixture?.finished_provisional) {
    return 'FT';
  }
  if (score?.started) return score.liveMinute || score.statusText || 'LIVE';
  const iso = fx?.fplFixture?.kickoff_time || score?.kickoffIso;
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function crest(team) {
  if (team?.code == null) return null;
  return `https://resources.premierleague.com/premierleague/badges/50/t${team.code}.png`;
}

/**
 * Selected Premier League match: score, scorers, event chips, and both
 * XIs with FPL points and league-owner crests.
 */
export function PremMatchBoard({
  fx,
  teamById,
  elementById,
  ownerByEl,
  liveFullByElementId,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const home = teamById?.[Number(fx?.fplFixture?.team_h)];
  const away = teamById?.[Number(fx?.fplFixture?.team_a)];
  const homeName = home?.short_name || home?.name || 'Home';
  const awayName = away?.short_name || away?.name || 'Away';
  const showScore =
    fx?.score &&
    (fx.score.started || fx.score.finished) &&
    Number.isFinite(Number(fx.score.homeScore));
  const events = Array.isArray(fx?.events) ? fx.events : NO_EVENTS;
  const fresh = useJustInKeys(events, fx?.fplFixture?.id ?? fx?.matchId ?? null);
  const fixtureId = fx?.fplFixture?.id;

  const goals = events.filter((ev) => ev?.kind === 'goal');
  const homeGoals = goals.filter((ev) => ev.teamSide === 'home');
  const awayGoals = goals.filter((ev) => ev.teamSide === 'away');

  const chips = events
    .filter((ev) => ev?.kind === 'goal' || ev?.kind === 'yellow' || ev?.kind === 'red')
    .slice(0, 14)
    .map((ev, i) => ({
      key: eventKey(ev, i),
      kind: ev.kind,
      label: `${ev.playerName || '—'}${ev.minuteLabel ? ` ${ev.minuteLabel}` : ''}${
        ev.isOwnGoal ? ' OG' : ev.isPenalty ? ' pen' : ''
      }`,
    }));

  const xiH = sortXi(fx?.lineups?.home?.xi, elementById);
  const xiA = sortXi(fx?.lineups?.away?.xi, elementById);
  const benchH = sortXi(fx?.lineups?.home?.bench, elementById);
  const benchA = sortXi(fx?.lineups?.away?.bench, elementById);
  const rows = Math.max(xiH.length, xiA.length);
  const benchRows = Math.max(benchH.length, benchA.length);

  const scorerLine = (list) =>
    list.length
      ? list
          .map((ev) => `${ev.playerName || '—'}${ev.minuteLabel ? ` ${ev.minuteLabel}` : ''}`)
          .join(', ')
      : null;

  return (
    <article className="prem-board" aria-label={`${home?.name || homeName} versus ${away?.name || awayName}`}>
      <header className="prem-board__score">
        <BoardSide name={home?.name || homeName} short={homeName} team={home} align="home" />
        <div className="prem-board__mid">
          <span className="prem-board__big tabular">
            {showScore ? fx.score.homeScore : '–'}
            <span className="prem-board__dash">–</span>
            {showScore ? fx.score.awayScore : '–'}
          </span>
          <span className={'prem-board__status' + (statusLabel(fx) !== 'FT' && fx?.score?.started && !fx?.score?.finished ? ' is-live' : '')}>
            {statusLabel(fx)}
          </span>
        </div>
        <BoardSide name={away?.name || awayName} short={awayName} team={away} align="away" />
      </header>

      {homeGoals.length || awayGoals.length ? (
        <div className="prem-board__scorers">
          <span>{scorerLine(homeGoals) || '—'}</span>
          <span>{scorerLine(awayGoals) || '—'}</span>
        </div>
      ) : null}

      {chips.length ? (
        <ul className="prem-board__chips" aria-label="Match events">
          {chips.map((c) => (
            <li
              key={c.key}
              className={
                'prem-board__chip prem-board__chip--' +
                c.kind +
                (fresh.has(c.key) ? ' is-just-in' : '')
              }
            >
              {fresh.has(c.key) ? <span className="prem-board__just">Just in</span> : null}
              {c.label}
            </li>
          ))}
        </ul>
      ) : null}

      {rows > 0 ? (
        <LineupGrid
          homePlayers={xiH}
          awayPlayers={xiA}
          home={home}
          away={away}
          elementById={elementById}
          teamById={teamById}
          ownerByEl={ownerByEl}
          liveFullByElementId={liveFullByElementId}
          fixtureId={fixtureId}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : (
        <p className="muted muted--tight prem-board__empty">
          Lineups not confirmed yet. Both XIs usually land around team news.
        </p>
      )}
      {benchRows > 0 ? (
        <>
          <div className="prem-board__bench-head">Bench</div>
          <LineupGrid
            homePlayers={benchH}
            awayPlayers={benchA}
            home={home}
            away={away}
            elementById={elementById}
            teamById={teamById}
            ownerByEl={ownerByEl}
            liveFullByElementId={liveFullByElementId}
            fixtureId={fixtureId}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
            bench
          />
        </>
      ) : null}
    </article>
  );
}

function BoardSide({ name, short, team, align }) {
  const badge = crest(team);
  const img = badge ? (
    <img className="prem-board__badge" src={badge} alt="" />
  ) : (
    <span className="prem-board__badge" aria-hidden />
  );
  const text = (
    <span className="prem-board__club">
      <span className="prem-board__club-name">{name}</span>
      <span className="prem-board__club-short">{short}</span>
    </span>
  );
  return (
    <div className={`prem-board__side prem-board__side--${align}`}>
      {align === 'home' ? (
        <>
          {text}
          {img}
        </>
      ) : (
        <>
          {img}
          {text}
        </>
      )}
    </div>
  );
}

function LineupGrid({
  homePlayers,
  awayPlayers,
  home,
  away,
  elementById,
  teamById,
  ownerByEl,
  liveFullByElementId,
  fixtureId,
  teamLogoMap,
  kitIndexByEntry,
  bench = false,
}) {
  const count = Math.max(homePlayers.length, awayPlayers.length);
  const cell = (player, club, side) => {
    if (!player) return <div className="prem-board__cell prem-board__cell--empty" />;
    const pts = fixtureFplPoints(liveFullByElementId, player.elementId, fixtureId);
    return (
      <div className={'prem-board__cell prem-board__cell--' + side}>
        <PremLineupRow
          player={player}
          club={club}
          ownerByEl={ownerByEl}
          elementById={elementById}
          teamById={teamById}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          points={pts}
          bench={bench}
        />
      </div>
    );
  };
  return (
    <div className="prem-board__xi" role="list">
      {Array.from({ length: count }, (_, i) => (
        <div className="prem-board__xi-row" key={`${bench ? 'b' : 'xi'}-${i}`} role="listitem">
          {cell(homePlayers[i], home, 'home')}
          {cell(awayPlayers[i], away, 'away')}
        </div>
      ))}
    </div>
  );
}
