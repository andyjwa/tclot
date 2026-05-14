import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveScores } from './useLiveScores';
import { TeamAvatar } from './TeamAvatar';
import { fetchEspnPremWindow } from './espnPremWindow.js';
import { buildOwnerByElementId } from './playerContributionEvents.js';
import { gameWeekSelectLabel } from './gwLabel.js';
import { GameWeekSelectOptgroups } from './GameWeekSelectOptgroups.jsx';
import { LiveRefreshIconButton } from './LiveRefreshIconButton.jsx';
import {
  fplElementFullName,
  fplElementWebName,
  useNarrow560,
} from './fplElementNames.js';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';

/** PL badge URL by FPL team `code` (same source as LiveScores). */
function plBadgeUrl(code) {
  if (code == null) return null;
  return `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`;
}

function formatKickoff(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Date only — pairs with `kickoffTimeLabel` for the header line. */
function kickoffDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function kickoffTimeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function lineupsBothConfirmed(fx) {
  return (
    fx?.lineups?.home?.confirmed === true &&
    fx?.lineups?.away?.confirmed === true
  );
}

/** In-play (ESPN: match started, not full time). */
function isFixtureLive(fx) {
  const s = fx?.score;
  if (!s) return false;
  return s.started === true && s.finished !== true;
}

/** Full time — ESPN score, or FPL fixture flags. */
function isFixtureFullTime(fx) {
  if (fx?.score?.finished === true) return true;
  const f = fx?.fplFixture;
  if (f == null) return false;
  if (f.finished === true || f.finished_provisional === true) return true;
  return false;
}

/**
 * "Live fixtures" strip: from squad release / kickoff through full time, then back to main list.
 * Excludes finished fixtures; includes in-progress and pre-kick with both lineups out.
 */
function inLiveFixturesSection(fx) {
  if (isFixtureFullTime(fx)) return false;
  return lineupsBothConfirmed(fx) || isFixtureLive(fx);
}

/**
 * Card pill (right of tile): `Live` (squads in or game on) or `FT` only — no kickoff string.
 */
function fixturePillStatus(fx) {
  if (isFixtureFullTime(fx)) return 'FT';
  if (lineupsBothConfirmed(fx) || isFixtureLive(fx)) return 'Live';
  return null;
}

/** Stable key for expand state and React (FPL `fixtures.id` when present). */
function fixtureKey(fx) {
  const id = Number(fx?.fplFixture?.id);
  if (Number.isFinite(id) && id > 0) return id;
  const th = Number(fx?.fplFixture?.team_h);
  const ta = Number(fx?.fplFixture?.team_a);
  if (Number.isFinite(th) && Number.isFinite(ta)) return `f-${th}-${ta}`;
  return 0;
}

/**
 * Render a compact status label: FT / HT / live minute / kickoff time.
 * Prefers the live feed's `statusText`/`liveMinute` when available; falls back to FPL kickoff.
 */
function matchStatusText({ score, fplFixture }) {
  if (score?.finished) return score.statusText || 'FT';
  if (score?.started) {
    if (score.liveMinute) return score.liveMinute;
    return score.statusText || 'LIVE';
  }
  const iso = fplFixture?.kickoff_time || score?.kickoffIso;
  return iso ? formatKickoff(iso) : 'TBD';
}

const EVENT_META = {
  goal: { icon: '⚽', label: 'Goal', className: 'prem-ev--goal' },
  assist: { icon: '🍑', label: 'Assist', className: 'prem-ev--assist' },
  yellow_card: { icon: '🟨', label: 'Yellow', className: 'prem-ev--yellow' },
  red_card: { icon: '🟥', label: 'Red', className: 'prem-ev--red' },
};

/** Yellow / red only if the player is on a league squad (owner map has the element). */
function includePremWindowEvent(ev, ownerByEl) {
  if (ev.kind !== 'yellow_card' && ev.kind !== 'red_card') return true;
  const id = ev.elementId;
  if (id == null) return false;
  const n = Number(id);
  if (!Number.isFinite(n)) return false;
  return ownerByEl != null && ownerByEl.has(n);
}

/**
 * `{ element → { leagueEntryId, teamName, fplEntryId } }` — enriched version of
 * `buildOwnerByElementId` that also keeps `fplEntryId` (same shape we'd use for logos).
 */
function buildOwnerMap(squads) {
  const base = buildOwnerByElementId(squads);
  const out = new Map();
  const fplByLid = new Map();
  for (const q of squads || []) {
    if (q?.error) continue;
    const lid = Number(q.leagueEntryId);
    if (Number.isFinite(lid) && q.fplEntryId != null) {
      fplByLid.set(lid, Number(q.fplEntryId));
    }
  }
  for (const [k, v] of base.entries()) {
    out.set(k, { ...v, fplEntryId: fplByLid.get(v.leagueEntryId) ?? null });
  }
  return out;
}

/** First word of fantasy team name (e.g. "Hackney Meat Loaf" → "Hackney"). */
function fantasyTeamFirstWord(fullName) {
  const t = String(fullName ?? '').trim();
  if (!t) return '';
  return t.split(/\s+/)[0] || t;
}

function OwnerTag({ owner, teamLogoMap, kitIndexByEntry }) {
  if (!owner) return null;
  const label = fantasyTeamFirstWord(owner.teamName) || owner.teamName;
  return (
    <span className="prem-owner-tag" title={owner.teamName}>
      <span className="prem-owner-tag__name">{label}</span>
      <span className="prem-owner-tag__avatar">
        <TeamAvatar
          entryId={owner.leagueEntryId}
          name={owner.teamName}
          size="sm"
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      </span>
    </span>
  );
}

function EventRow({
  ev,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  teamById,
  narrowName,
}) {
  const meta = EVENT_META[ev.kind];
  if (!meta) return null;
  const owner = ev.elementId != null ? ownerByEl.get(ev.elementId) : null;
  const el = ev.elementId != null && elementById ? elementById[ev.elementId] : null;
  const nameShown = el
    ? narrowName
      ? fplElementWebName(el, ev.elementId)
      : fplElementFullName(el, ev.elementId)
    : (ev.playerName || '—');
  const fullTitle =
    el && narrowName ? fplElementFullName(el, ev.elementId) : undefined;
  const teamShort =
    el && teamById ? teamById[Number(el.team)]?.short_name : undefined;
  const sideClass =
    ev.teamSide === 'home'
      ? 'prem-ev-row--home'
      : ev.teamSide === 'away'
        ? 'prem-ev-row--away'
        : '';
  return (
    <li className={`prem-ev-row ${meta.className} ${sideClass}`}>
      <span className="prem-ev-minute">{ev.minuteLabel || '—'}</span>
      <span className="prem-ev-icon" aria-hidden="true">
        {meta.icon}
      </span>
      <span className="prem-ev-player">
        <span className="prem-ev-name" title={fullTitle}>
          <ClickablePlayerName
            element={ev.elementId}
            displayName={el ? fplElementFullName(el, ev.elementId) : undefined}
            web_name={el ? fplElementWebName(el, ev.elementId) : undefined}
            teamShort={teamShort}
          >
            {nameShown}
          </ClickablePlayerName>
        </span>
        {ev.isPenalty ? <span className="prem-ev-tag">(pen)</span> : null}
        {ev.isOwnGoal ? <span className="prem-ev-tag">(OG)</span> : null}
      </span>
      {owner ? (
        <OwnerTag
          owner={owner}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : null}
    </li>
  );
}

function LineupPlayerRow({
  player,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  teamById,
  narrowName,
}) {
  const owner = player.elementId != null ? ownerByEl.get(player.elementId) : null;
  const el = player.elementId != null && elementById ? elementById[player.elementId] : null;
  const displayName = el
    ? narrowName
      ? fplElementWebName(el, player.elementId)
      : fplElementFullName(el, player.elementId)
    : (player.fplWebName?.trim() ||
        player.name ||
        `#${player.fotmobPlayerId ?? '?'}`);
  const fullTitle = el && narrowName ? fplElementFullName(el, player.elementId) : undefined;
  const teamShort =
    el && teamById ? teamById[Number(el.team)]?.short_name : undefined;
  const fplPos =
    player.fplPos != null && String(player.fplPos).trim()
      ? String(player.fplPos).trim()
      : null;
  return (
    <div className="prem-lineup-row">
      <span className="prem-lineup-core">
        <span className="prem-lineup-name" title={fullTitle}>
          <ClickablePlayerName
            element={player.elementId}
            displayName={el ? fplElementFullName(el, player.elementId) : undefined}
            web_name={el ? fplElementWebName(el, player.elementId) : undefined}
            teamShort={teamShort}
          >
            {displayName}
          </ClickablePlayerName>
          {fplPos ? (
            <span className="prem-lineup-fpl-bracket" title="FPL position">
              {' '}
              ({fplPos})
            </span>
          ) : null}
        </span>
      </span>
      {owner ? (
        <span className="prem-lineup-owner">
          <OwnerTag
            owner={owner}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        </span>
      ) : null}
    </div>
  );
}

function LineupPairedHead({ title, side }) {
  if (!side) {
    return (
      <div className="prem-lineup-col__head">
        <span className="prem-lineup-col__title">{title}</span>
      </div>
    );
  }
  return (
    <div className="prem-lineup-col__head">
      <span className="prem-lineup-col__title">{title}</span>
      {side.formation ? (
        <span className="prem-lineup-col__formation">{side.formation}</span>
      ) : null}
      {side.confirmed ? (
        <span className="prem-lineup-col__badge prem-lineup-col__badge--confirmed">
          Confirmed
        </span>
      ) : (
        <span className="prem-lineup-col__badge prem-lineup-col__badge--predicted">
          Predicted
        </span>
      )}
    </div>
  );
}

/**
 * Home and away lineups in locked rows so each XI line is the same height and lines up
 * side-by-side; bench rows follow the same pattern.
 */
function LineupPaired({
  homeTitle,
  awayTitle,
  homeSide,
  awaySide,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  teamById,
  narrowName,
}) {
  if (!homeSide && !awaySide) {
    return (
      <p className="muted muted--tight">No lineup yet</p>
    );
  }
  const h = homeSide;
  const a = awaySide;
  const xiLen = Math.max(h?.xi?.length ?? 0, a?.xi?.length ?? 0);
  const benchH = h?.bench ?? [];
  const benchA = a?.bench ?? [];
  const benchLen = Math.max(benchH.length, benchA.length);

  return (
    <div className="prem-lineup-paired">
      <div className="prem-lineup-paired__heads">
        <div className="prem-lineup-paired__head-slab prem-lineup-paired__head-slab--home">
          <LineupPairedHead title={homeTitle} side={h} />
        </div>
        <div className="prem-lineup-paired__head-slab prem-lineup-paired__head-slab--away">
          <LineupPairedHead title={awayTitle} side={a} />
        </div>
      </div>

      <div className="prem-lineup-paired__rows" role="list">
        {Array.from({ length: xiLen }, (_, i) => (
          <div
            className="prem-lineup-paired__row"
            key={`xi-${i}`}
            role="listitem"
          >
            <div className="prem-lineup-paired__cell prem-lineup-paired__cell--home">
              {h?.xi?.[i] ? (
                <LineupPlayerRow
                  player={h.xi[i]}
                  ownerByEl={ownerByEl}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  elementById={elementById}
                  teamById={teamById}
                  narrowName={narrowName}
                />
              ) : (
                <div className="prem-lineup-paired__empty" aria-hidden />
              )}
            </div>
            <div className="prem-lineup-paired__cell prem-lineup-paired__cell--away">
              {a?.xi?.[i] ? (
                <LineupPlayerRow
                  player={a.xi[i]}
                  ownerByEl={ownerByEl}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  elementById={elementById}
                  teamById={teamById}
                  narrowName={narrowName}
                />
              ) : (
                <div className="prem-lineup-paired__empty" aria-hidden />
              )}
            </div>
          </div>
        ))}
      </div>

      {benchLen > 0 ? (
        <>
          <div className="prem-lineup-paired__bench-head">Bench</div>
          <div className="prem-lineup-paired__rows" role="list">
            {Array.from({ length: benchLen }, (_, i) => (
              <div
                className="prem-lineup-paired__row prem-lineup-paired__row--bench"
                key={`bench-${i}`}
                role="listitem"
              >
                <div className="prem-lineup-paired__cell prem-lineup-paired__cell--home">
                  {benchH[i] ? (
                    <LineupPlayerRow
                      player={benchH[i]}
                      ownerByEl={ownerByEl}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      elementById={elementById}
                      teamById={teamById}
                      narrowName={narrowName}
                    />
                  ) : (
                    <div className="prem-lineup-paired__empty" aria-hidden />
                  )}
                </div>
                <div className="prem-lineup-paired__cell prem-lineup-paired__cell--away">
                  {benchA[i] ? (
                    <LineupPlayerRow
                      player={benchA[i]}
                      ownerByEl={ownerByEl}
                      teamLogoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                      elementById={elementById}
                      teamById={teamById}
                      narrowName={narrowName}
                    />
                  ) : (
                    <div className="prem-lineup-paired__empty" aria-hidden />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {h?.coach || a?.coach ? (
        <div className="prem-lineup-paired__coaches">
          <div className="prem-lineup-paired__coach-slab prem-lineup-paired__cell--home prem-lineup-col__coach muted muted--tight">
            {h?.coach ? <>Manager: {h.coach}</> : null}
          </div>
          <div className="prem-lineup-paired__coach-slab prem-lineup-paired__cell--away prem-lineup-col__coach muted muted--tight">
            {a?.coach ? <>Manager: {a.coach}</> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FixtureCard({
  fx,
  teamById,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  narrowName,
  expanded,
  onToggle,
}) {
  const home = teamById[Number(fx.fplFixture?.team_h)];
  const away = teamById[Number(fx.fplFixture?.team_a)];
  const homeName = home?.name || 'Home';
  const awayName = away?.name || 'Away';
  const homeShort = home?.short_name || '—';
  const awayShort = away?.short_name || '—';

  const status = matchStatusText(fx);
  const pillStatus = fixturePillStatus(fx);
  const showScore =
    fx.score &&
    (fx.score.started || fx.score.finished) &&
    Number.isFinite(Number(fx.score.homeScore));

  const canShowLineups = lineupsBothConfirmed(fx);
  const visibleEvents = (fx.events || []).filter((ev) =>
    includePremWindowEvent(ev, ownerByEl)
  );
  const hasEvents = visibleEvents.length > 0;
  const kickIso =
    fx.fplFixture?.kickoff_time || fx.score?.kickoffIso || null;
  const inPlay = isFixtureLive(fx);
  const liveTile = pillStatus === 'Live';

  return (
    <section
      className={`prem-fixture${liveTile ? ' prem-fixture--live' : ''}`}
    >
      <button
        type="button"
        className="prem-fixture__header"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={
          inPlay
            ? `Live — ${homeShort} vs ${awayShort}, ${status}. Expand for details.`
            : undefined
        }
      >
        <div className="prem-fixture__header-content">
          <div className="prem-fixture__top-row">
            <span className="prem-fixture__top-spacer" aria-hidden="true" />
            <div className="prem-fixture__match-line">
              <span className="prem-fixture__club prem-fixture__club--home">
                <span className="prem-fixture__team-abbr" title={homeName}>
                  {homeShort}
                </span>
                {plBadgeUrl(home?.code) ? (
                  <img
                    className="prem-fixture__badge"
                    src={plBadgeUrl(home?.code)}
                    alt={homeName}
                    loading="lazy"
                  />
                ) : null}
              </span>
              <span className="prem-fixture__score">
                {showScore ? (
                  <>
                    <span className="tabular">{fx.score.homeScore}</span>
                    <span className="prem-fixture__score-sep">–</span>
                    <span className="tabular">{fx.score.awayScore}</span>
                  </>
                ) : (
                  <span className="prem-fixture__vs">vs</span>
                )}
              </span>
              <span className="prem-fixture__club prem-fixture__club--away">
                {plBadgeUrl(away?.code) ? (
                  <img
                    className="prem-fixture__badge"
                    src={plBadgeUrl(away?.code)}
                    alt={awayName}
                    loading="lazy"
                  />
                ) : null}
                <span className="prem-fixture__team-abbr" title={awayName}>
                  {awayShort}
                </span>
              </span>
            </div>
            {pillStatus ? (
              <span
                className={
                  'prem-fixture__status' +
                  (pillStatus === 'FT'
                    ? ' prem-fixture__status--ft'
                    : ' prem-fixture__status--live')
                }
              >
                {pillStatus}
              </span>
            ) : (
              <span
                className="prem-fixture__status prem-fixture__status--empty"
                aria-hidden="true"
              />
            )}
          </div>
          {kickIso ? (
            <div
              className="prem-fixture__kickoff-row"
              title={formatKickoff(String(kickIso))}
            >
              <span className="prem-fixture__kickoff">
                <span className="prem-fixture__kickoff-date">
                  {kickoffDateLabel(String(kickIso))}
                </span>
                <span className="prem-fixture__kickoff-sep" aria-hidden>
                  {' · '}
                </span>
                <span className="prem-fixture__kickoff-time">
                  {kickoffTimeLabel(String(kickIso))}
                </span>
              </span>
            </div>
          ) : null}
        </div>
        <span className="prem-fixture__chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div className="prem-fixture__body">
          {fx.fetchError ? (
            <div className="data-banner data-banner--error" role="alert">
              Could not load ESPN match summary: {fx.fetchError}
            </div>
          ) : null}
          {!fx.matchId ? (
            <p className="muted muted--tight">
              No ESPN match mapped for this fixture yet.
            </p>
          ) : null}
          {fx.matchId && fx.detailsBlockedReason ? (
            <p className="muted muted--tight prem-fixture__notice">
              {fx.detailsBlockedReason}
            </p>
          ) : null}

          {hasEvents ? (
            <div className="prem-events">
              <h3 className="prem-events__title">Events</h3>
              <ul className="prem-events__list">
                {visibleEvents.map((ev, i) => (
                  <EventRow
                    key={`${ev.kind}-${ev.eventId ?? i}-${i}`}
                    ev={ev}
                    ownerByEl={ownerByEl}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    elementById={elementById}
                    teamById={teamById}
                    narrowName={narrowName}
                  />
                ))}
              </ul>
            </div>
          ) : fx.matchId && !fx.detailsBlockedReason ? (
            <p className="muted muted--tight">No events yet.</p>
          ) : null}

          {canShowLineups ? (
            <div className="prem-lineups">
              <h3 className="prem-lineups__title">Lineups</h3>
              <LineupPaired
                homeTitle={homeName}
                awayTitle={awayName}
                homeSide={fx.lineups.home}
                awaySide={fx.lineups.away}
                ownerByEl={ownerByEl}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
                elementById={elementById}
                teamById={teamById}
                narrowName={narrowName}
              />
            </div>
          ) : fx.matchId && !fx.detailsBlockedReason ? (
            <p className="muted muted--tight">
              Lineups not confirmed yet — they often fill in close to team news (~1 hour before
              kickoff).
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   teams: Array<{ id: number, teamName: string, fplEntryId: number | null }>,
 *   gameweek: number,
 *   onGameweekChange: (n: number) => void,
 *   onBootstrapLiveMeta?: (meta: { currentGw: number | null }) => void,
 *   teamLogoMap: object,
 *   kitIndexByEntry?: object,
 * }} props
 */
export function PremWindow({
  teams,
  gameweek,
  onGameweekChange,
  onBootstrapLiveMeta,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const {
    loading: liveLoading,
    error: liveError,
    events,
    squads,
    contributionLiveContext,
    refresh: refreshLive,
  } = useLiveScores({
    teams,
    gameweek,
    enabled: true,
    onBootstrapLiveMeta,
    pollIntervalMs: 90_000,
  });

  const gwFixtures = contributionLiveContext?.gwFixtures ?? null;
  const teamById = contributionLiveContext?.teamById ?? null;
  const elementById = contributionLiveContext?.elementById ?? null;
  const narrow = useNarrow560();
  const [espnWindowLoading, setEspnWindowLoading] = useState(false);
  const [espnWindowError, setEspnWindowError] = useState(null);
  const [espnWindowRows, setEspnWindowRows] = useState(/** @type {any[]} */ ([]));
  /** Fetch-generation guard so a slow request for an older GW cannot overwrite the new one. */
  const espnWindowGenRef = useRef(0);

  const doEspnWindowFetch = useCallback(async () => {
    if (!gwFixtures || !teamById || !elementById) return;
    if (!gwFixtures.length) {
      setEspnWindowRows([]);
      setEspnWindowError(null);
      return;
    }
    espnWindowGenRef.current += 1;
    const gen = espnWindowGenRef.current;
    setEspnWindowLoading(true);
    setEspnWindowError(null);
    try {
      const rows = await fetchEspnPremWindow({ gwFixtures, teamById, elementById });
      if (gen !== espnWindowGenRef.current) return;
      setEspnWindowRows(rows);
    } catch (e) {
      if (gen !== espnWindowGenRef.current) return;
      setEspnWindowError(e?.message || String(e));
      setEspnWindowRows([]);
    } finally {
      if (gen === espnWindowGenRef.current) setEspnWindowLoading(false);
    }
  }, [gwFixtures, teamById, elementById]);

  useEffect(() => {
    void doEspnWindowFetch();
  }, [doEspnWindowFetch]);

  /**
   * Earliest kickoff first. "Live fixtures" = squads out or match under way, until full time
   * (then the fixture rejoins the main list with other scheduled/finished games).
   */
  const { liveWithLineups, otherFixtures } = useMemo(() => {
    const rows = [...(espnWindowRows || [])];
    rows.sort((a, b) => {
      const ka = Date.parse(a.fplFixture?.kickoff_time || '') || 0;
      const kb = Date.parse(b.fplFixture?.kickoff_time || '') || 0;
      return ka - kb;
    });
    const live = [];
    const other = [];
    for (const r of rows) {
      if (inLiveFixturesSection(r)) live.push(r);
      else other.push(r);
    }
    return { liveWithLineups: live, otherFixtures: other };
  }, [espnWindowRows]);

  const ownerByEl = useMemo(() => buildOwnerMap(squads), [squads]);

  const gwOptions = useMemo(() => {
    if (!Array.isArray(events) || !events.length) return [];
    return events
      .map((e) => ({
        id: Number(e.id),
        label: `Game Week ${e.id}`,
        finished: e.finished === true,
        is_current: e.is_current === true,
      }))
      .sort((a, b) => a.id - b.id);
  }, [events]);

  const selectedGwOption = useMemo(
    () => gwOptions.find((o) => Number(o.id) === Number(gameweek)),
    [gwOptions, gameweek],
  );

  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = useCallback((/** @type {number | string} */ matchKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) next.delete(matchKey);
      else next.add(matchKey);
      return next;
    });
  }, []);

  return (
    <div className="dashboard-stack prem-window-root">
      <section className="prem-window-chrome" aria-label="Lineups">
        <div className="live-toolbar live-toolbar--section-sticky">
          <div className="live-gw-field">
            <div className="live-gw-input-row">
              <label className="live-gw-label">
                <select
                  className="live-gw-select"
                  aria-label="Game week"
                  value={gameweek}
                  onChange={(e) => onGameweekChange(Number(e.target.value))}
                >
                  {gwOptions.length ? (
                    <GameWeekSelectOptgroups options={gwOptions} />
                  ) : (
                    <option value={gameweek}>{gameWeekSelectLabel(gameweek)}</option>
                  )}
                </select>
              </label>
              {selectedGwOption?.finished ? (
                <span
                  className="live-gw-pill"
                  title="This game week is complete (all fixtures finished)"
                  aria-label="This game week is complete"
                >
                  FT
                </span>
              ) : null}
            </div>
          </div>
          <LiveRefreshIconButton
            title="Refresh squads and results"
            loading={Boolean(liveLoading || espnWindowLoading)}
            disabled={Boolean(liveLoading || espnWindowLoading)}
            onClick={() => {
              void refreshLive();
              void doEspnWindowFetch();
            }}
          />
        </div>

        {liveError ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load live FPL context.</strong> {liveError}
          </div>
        ) : null}
        {espnWindowError ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>ESPN fetch failed.</strong> {espnWindowError}
          </div>
        ) : null}
      </section>

      {liveWithLineups.length === 0 &&
      otherFixtures.length === 0 &&
      !espnWindowLoading ? (
        <section className="tile tile--compact">
          <p className="muted muted--tight">No fixtures for this gameweek.</p>
        </section>
      ) : null}

      {liveWithLineups.length > 0 ? (
        <section
          className="prem-fixtures-block"
          aria-labelledby="prem-live-fixtures-heading"
        >
          <h3
            id="prem-live-fixtures-heading"
            className="prem-fixtures-block__title"
          >
            Live fixtures
          </h3>
          <div className="prem-fixtures prem-fixtures--grid">
            {liveWithLineups.map((fx) => {
              const key = fixtureKey(fx);
              if (key === 0) return null;
              return (
                <FixtureCard
                  key={key}
                  fx={fx}
                  teamById={teamById || {}}
                  ownerByEl={ownerByEl}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  elementById={elementById}
                  narrowName={narrow}
                  expanded={expanded.has(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {otherFixtures.length > 0 ? (
        <section
          className="prem-fixtures-block"
          aria-labelledby="prem-rest-fixtures-heading"
        >
          <h3
            id="prem-rest-fixtures-heading"
            className="prem-fixtures-block__title"
          >
            Fixtures
          </h3>
          <div className="prem-fixtures prem-fixtures--grid">
            {otherFixtures.map((fx) => {
              const key = fixtureKey(fx);
              if (key === 0) return null;
              return (
                <FixtureCard
                  key={key}
                  fx={fx}
                  teamById={teamById || {}}
                  ownerByEl={ownerByEl}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  elementById={elementById}
                  narrowName={narrow}
                  expanded={expanded.has(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
