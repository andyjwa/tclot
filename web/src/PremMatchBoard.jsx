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
  const rows = Math.max(xiH.length, xiA.length);

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
        <div className="prem-board__xi" role="list">
          {Array.from({ length: rows }, (_, i) => (
            <div className="prem-board__xi-row" key={`xi-${i}`} role="listitem">
              <XiCell
                player={xiH[i]}
                club={home}
                elementById={elementById}
                ownerByEl={ownerByEl}
                liveFullByElementId={liveFullByElementId}
                fixtureId={fixtureId}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
                side="home"
              />
              <XiCell
                player={xiA[i]}
                club={away}
                elementById={elementById}
                ownerByEl={ownerByEl}
                liveFullByElementId={liveFullByElementId}
                fixtureId={fixtureId}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
                side="away"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="muted muted--tight prem-board__empty">
          Lineups not confirmed yet. Both XIs usually land around team news.
        </p>
      )}
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

function XiCell({
  player,
  club,
  elementById,
  ownerByEl,
  liveFullByElementId,
  fixtureId,
  teamLogoMap,
  kitIndexByEntry,
  side,
}) {
  if (!player) return <div className="prem-board__cell prem-board__cell--empty" />;
  const id = Number(player.elementId);
  const owner = Number.isFinite(id) ? ownerByEl?.get(id) ?? ownerByEl?.get(String(id)) : null;
  const el = elementById?.[player.elementId] ?? elementById?.[String(player.elementId)];
  const name = playerLabel(player, elementById);
  const pts = fixtureFplPoints(liveFullByElementId, id, fixtureId);
  const badge = crest(club);
  return (
    <div className={'prem-board__cell prem-board__cell--' + side + (owner ? ' is-owned' : '')}>
      {badge ? <img className="prem-board__mini" src={badge} alt="" /> : <span className="prem-board__mini" />}
      <span className="prem-board__pname">
        <ClickablePlayerName
          element={player.elementId}
          displayName={name}
          web_name={el ? fplElementWebName(el, player.elementId) : name}
        >
          {name}
        </ClickablePlayerName>
      </span>
      <span className="prem-board__pts tabular">{pts == null ? '–' : pts}</span>
      {owner ? (
        <span className="prem-board__owner" title={owner.teamName}>
          <TeamAvatar
            entryId={owner.leagueEntryId}
            name={owner.teamName}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        </span>
      ) : (
        <span className="prem-board__owner" />
      )}
    </div>
  );
}
