import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveScores } from './useLiveScores';
import { TeamAvatar } from './TeamAvatar';
import { fetchEspnPremWindow } from './espnPremWindow.js';
import {
  clearAllCachedLineups,
  getCachedLineup,
  setCachedLineup,
} from './lineupCache.js';
import { fetchPulselivePremWindow } from './pulselivePremWindow.js';
import { mergePremWindowSources } from './premWindowMerger.js';
import { buildOwnerByElementId } from './playerContributionEvents.js';
import { GameWeekNavigator } from './GameWeekNavigator.jsx';
import {
  fplElementDisplayName,
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

/** Date only — used to bucket fixtures into day-of-week groups. */
function kickoffDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
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
 * 'live' (in-play) | 'pre' (lineups confirmed, pre-kick) | 'ft' (full time) | 'scheduled' (no lineups yet).
 * Drives both the left-side state chip and which section the row sits in
 * (live → pinned 'Live now' strip; everything else → day groups).
 */
function fixtureMockupState(fx) {
  if (isFixtureFullTime(fx)) return 'ft';
  if (isFixtureLive(fx)) return 'live';
  if (lineupsBothConfirmed(fx)) return 'pre';
  return 'scheduled';
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

/** Live minute string for the LIVE chip (e.g. "67'", "HT"). */
function liveMinuteLabel(fx) {
  const s = fx?.score;
  if (!s) return null;
  if (s.liveMinute) return s.liveMinute;
  if (s.statusText && s.finished !== true) return s.statusText;
  return null;
}

const EVENT_META = {
  goal: { icon: '⚽', label: 'Goal', className: 'prem-ev--goal' },
  assist: { icon: '🍑', label: 'Assist', className: 'prem-ev--assist' },
  yellow_card: { icon: '🟨', label: 'Yellow', className: 'prem-ev--yellow' },
  red_card: { icon: '🟥', label: 'Red', className: 'prem-ev--red' },
};

/** Yellow / red only if the player is on a league squad (owner map has the element). */
// Kept for re-enabling the events list inside the expanded fixture body.
// eslint-disable-next-line no-unused-vars
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

/** Compact owner crest (avatar only) — used in the "Not in squad" strip
 *  where a full OwnerTag is too wide to fit multiple items on one row. */
function OwnerCrest({ owner, teamLogoMap, kitIndexByEntry }) {
  if (!owner) return null;
  return (
    <span className="prem-owner-crest" title={owner.teamName}>
      <TeamAvatar
        entryId={owner.leagueEntryId}
        name={owner.teamName}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
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
}) {
  const meta = EVENT_META[ev.kind];
  if (!meta) return null;
  const owner = ev.elementId != null ? ownerByEl.get(ev.elementId) : null;
  const el = ev.elementId != null && elementById ? elementById[ev.elementId] : null;
  const nameShown = el
    ? fplElementDisplayName(el, ev.elementId)
    : (ev.playerName || '—');
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
        <span className="prem-ev-name">
          <ClickablePlayerName
            element={ev.elementId}
            displayName={el ? fplElementWebName(el, ev.elementId) : undefined}
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

/**
 * Home + away XI side-by-side, with each player row using the compact
 * `MobileLineupRow` design (crest · name · owner tag · position pill).
 *
 * No sub-bar header — the fixture row that toggles this body already
 * shows team names + score + state chip, so a second band with the
 * same names was pure repetition. Tiny formation chips ride above each
 * XI column to preserve the only piece of info the sub-bar carried that
 * the fixture row doesn't (since `Confirmed` is implied by the fact
 * that lineups are visible — we don't render this body otherwise).
 */
function LineupPaired({
  home,
  away,
  homeSide,
  awaySide,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  teamById,
}) {
  if (!homeSide && !awaySide) {
    return (
      <p className="muted muted--tight">No lineup yet</p>
    );
  }
  const h = homeSide;
  const a = awaySide;
  const xiH = sortPlayersByPosition(h?.xi ?? [], elementById);
  const xiA = sortPlayersByPosition(a?.xi ?? [], elementById);
  const xiLen = Math.max(xiH.length, xiA.length);
  const benchH = sortPlayersByPosition(h?.bench ?? [], elementById);
  const benchA = sortPlayersByPosition(a?.bench ?? [], elementById);
  const benchLen = Math.max(benchH.length, benchA.length);

  const rowFor = (player, club) =>
    player ? (
      <MobileLineupRow
        player={player}
        club={club}
        ownerByEl={ownerByEl}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
        elementById={elementById}
        teamById={teamById}
      />
    ) : (
      <div className="prem-lineup-paired__empty" aria-hidden />
    );

  const benchRowFor = (player, club) =>
    player ? (
      <MobileLineupRow
        player={player}
        club={club}
        ownerByEl={ownerByEl}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
        elementById={elementById}
        teamById={teamById}
        bench
      />
    ) : (
      <div className="prem-lineup-paired__empty" aria-hidden />
    );

  return (
    <div className="prem-lineup-paired">
      <div className="prem-lineup-paired__rows" role="list">
        {Array.from({ length: xiLen }, (_, i) => (
          <div
            className="prem-lineup-paired__row"
            key={`xi-${i}`}
            role="listitem"
          >
            <div className="prem-lineup-paired__cell prem-lineup-paired__cell--home">
              {rowFor(xiH[i], home)}
            </div>
            <div className="prem-lineup-paired__cell prem-lineup-paired__cell--away">
              {rowFor(xiA[i], away)}
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
                  {benchRowFor(benchH[i], home)}
                </div>
                <div className="prem-lineup-paired__cell prem-lineup-paired__cell--away">
                  {benchRowFor(benchA[i], away)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* NEW: Not in squad — fantasy-owned players on this PL club that are  */
/* not in the matchday XI/bench.                                       */
/* ================================================================== */

/** Build the "not in squad" list for one side. */
function computeNotInSquad({ ownerByEl, elementById, plTeamId, sideLineup }) {
  if (!sideLineup || plTeamId == null || !ownerByEl) return [];
  const inSquad = new Set();
  for (const p of [...(sideLineup.xi || []), ...(sideLineup.bench || [])]) {
    const id = Number(p?.elementId);
    if (Number.isFinite(id)) inSquad.add(id);
  }
  const out = [];
  for (const [elIdRaw, owner] of ownerByEl.entries()) {
    const elId = Number(elIdRaw);
    if (!Number.isFinite(elId)) continue;
    if (inSquad.has(elId)) continue;
    const el = elementById?.[elId];
    if (!el) continue;
    if (Number(el.team) !== Number(plTeamId)) continue;
    out.push({
      elementId: elId,
      name: fplElementWebName(el, elId) || fplElementDisplayName(el, elId),
      owner,
      el,
    });
  }
  out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return out;
}

function NotInSquadRow({ players, variant = 'mobile', teamLogoMap, kitIndexByEntry }) {
  if (!players?.length) return null;
  return (
    <div className={`prem-nis prem-nis--${variant}`}>
      <span className="prem-nis__h">Not in squad</span>
      <span className="prem-nis__items">
        {players.map((p, i) => {
          const el = p.el;
          const teamShort = el?.team_short ?? null;
          return (
            <span className="prem-nis__item" key={`${p.elementId}-${i}`}>
              {i > 0 ? <span className="prem-nis__sep" aria-hidden>|</span> : null}
              <OwnerCrest
                owner={p.owner}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <ClickablePlayerName
                element={p.elementId}
                displayName={p.name}
                web_name={p.name}
                teamShort={teamShort}
              >
                <span className="prem-nis__name">{p.name}</span>
              </ClickablePlayerName>
            </span>
          );
        })}
      </span>
    </div>
  );
}

/* ================================================================== */
/* NEW: State chip on the LEFT of every fixture row.                   */
/* ================================================================== */
function StateChip({ fx }) {
  const state = fixtureMockupState(fx);
  if (state === 'live') {
    const min = liveMinuteLabel(fx);
    return (
      <span className="prem-fxchip prem-fxchip--live">
        <span className="prem-fxchip__dot" aria-hidden />
        <span>LIVE</span>
        {min ? <span className="prem-fxchip__min">{min}</span> : null}
      </span>
    );
  }
  if (state === 'pre') {
    return <span className="prem-fxchip prem-fxchip--pre">Lineups out</span>;
  }
  if (state === 'ft') {
    return <span className="prem-fxchip prem-fxchip--ft">FT</span>;
  }
  return <span className="prem-fxchip prem-fxchip--ghost" aria-hidden />;
}

/** Right-side kickoff time on each row — hidden for live/ft (where the
 *  chip on the left already conveys the time dimension). */
function KickoffPill({ fx }) {
  const state = fixtureMockupState(fx);
  if (state === 'live' || state === 'ft') {
    return <span className="prem-fxright" aria-hidden />;
  }
  const iso = fx?.fplFixture?.kickoff_time || fx?.score?.kickoffIso || null;
  if (!iso) return <span className="prem-fxright" aria-hidden />;
  return <span className="prem-fxright">{kickoffTimeLabel(iso)}</span>;
}

/* ================================================================== */
/* NEW: Mobile lineup body — home/away toggle + single-side XI/bench   */
/* + Not-in-squad row. Used when narrow (< 560 px).                    */
/* ================================================================== */
function countOwnedInXi(side, ownerByEl) {
  if (!side?.xi || !ownerByEl) return 0;
  let n = 0;
  for (const p of side.xi) {
    const id = Number(p?.elementId);
    if (Number.isFinite(id) && ownerByEl.has(id)) n += 1;
  }
  return n;
}

/**
 * GK / DEF / MID / FWD ordering for both display + sort.
 *
 * `fotmobPremWindow.enrichWithFplElements` writes a one/two-char `fplPos` on
 * each player ('GK' / 'D' / 'M' / 'F'). The lineup body needs the full label
 * for the position pill, and a numeric rank so XI + bench can be sorted
 * GK → DEF → MID → FWD with FPL `element_type` as the authoritative source
 * and the short `fplPos` as the fallback. Unknown positions are sorted last
 * so they don't break the visual cadence at the top of the list.
 */
const POS_LABEL_FOR_FPLPOS = {
  GK: 'GK',
  D: 'DEF',
  M: 'MID',
  F: 'FWD',
};
const POS_RANK_FOR_FPLPOS = { GK: 1, D: 2, M: 3, F: 4 };

function lineupPlayerPosLabel(player, elementById) {
  const el =
    player?.elementId != null && elementById
      ? elementById[player.elementId]
      : null;
  const elementType = Number(el?.element_type);
  if (elementType === 1) return 'GK';
  if (elementType === 2) return 'DEF';
  if (elementType === 3) return 'MID';
  if (elementType === 4) return 'FWD';
  const short = String(player?.fplPos || '').trim().toUpperCase();
  return POS_LABEL_FOR_FPLPOS[short] || null;
}

function lineupPlayerPosRank(player, elementById) {
  const el =
    player?.elementId != null && elementById
      ? elementById[player.elementId]
      : null;
  const elementType = Number(el?.element_type);
  if (elementType === 1) return 1;
  if (elementType === 2) return 2;
  if (elementType === 3) return 3;
  if (elementType === 4) return 4;
  const short = String(player?.fplPos || '').trim().toUpperCase();
  return POS_RANK_FOR_FPLPOS[short] ?? 5;
}

/** Stable sort by `lineupPlayerPosRank` (GK → DEF → MID → FWD → unknown). */
function sortPlayersByPosition(players, elementById) {
  if (!Array.isArray(players)) return [];
  return players
    .map((p, idx) => ({ p, idx, rank: lineupPlayerPosRank(p, elementById) }))
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((wrap) => wrap.p);
}

function MobileLineupRow({
  player,
  club,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  teamById,
  bench = false,
}) {
  const owner = player.elementId != null ? ownerByEl.get(player.elementId) : null;
  const el = player.elementId != null && elementById ? elementById[player.elementId] : null;
  const displayName = el
    ? fplElementDisplayName(el, player.elementId)
    : (player.fplWebName?.trim() ||
        player.name ||
        `#${player.fotmobPlayerId ?? '?'}`);
  const teamShort =
    el && teamById ? teamById[Number(el.team)]?.short_name : undefined;
  const posLabel = lineupPlayerPosLabel(player, elementById);
  return (
    <div
      className={
        'prem-mlu-row' +
        (bench ? ' prem-mlu-row--bench' : '') +
        (owner ? ' is-owned' : '')
      }
    >
      {club?.code != null && plBadgeUrl(club.code) ? (
        <img
          className="prem-mlu-crest"
          src={plBadgeUrl(club.code)}
          alt={club?.name || ''}
          loading="lazy"
        />
      ) : (
        <span className="prem-mlu-crest" aria-hidden />
      )}
      <span className="prem-mlu-name">
        <ClickablePlayerName
          element={player.elementId}
          displayName={el ? fplElementWebName(el, player.elementId) : undefined}
          web_name={el ? fplElementWebName(el, player.elementId) : undefined}
          teamShort={teamShort}
        >
          {displayName}
        </ClickablePlayerName>
      </span>
      {owner ? (
        <OwnerTag
          owner={owner}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : null}
      {posLabel ? (
        <span className="prem-mlu-pos">{posLabel}</span>
      ) : null}
    </div>
  );
}

/**
 * Compact strip listing unowned bench players. One PL crest sits on the far
 * left, then a flex-wrap list of names where the separator is a `border-left`
 * on each cell. A negative `margin-left` + `overflow: hidden` clip on the
 * inner names wrapper hides the leftmost border of every wrapped visual row
 * so the strip reads as a tidy multi-row list (no leading ` | ` on row 2+).
 */
function UnownedBenchStrip({ players, club, elementById }) {
  if (!players?.length) return null;
  const crest =
    club?.code != null && plBadgeUrl(club.code) ? (
      <img
        className="prem-bench-other__crest"
        src={plBadgeUrl(club.code)}
        alt={club?.name || ''}
        loading="lazy"
      />
    ) : (
      <span className="prem-bench-other__crest" aria-hidden />
    );
  return (
    <div className="prem-bench-other">
      {crest}
      <span className="prem-bench-other__items-wrap">
        <span className="prem-bench-other__items">
          {players.map((p, i) => {
            const el =
              p?.elementId != null && elementById
                ? elementById[p.elementId]
                : null;
            const displayName = el
              ? fplElementWebName(el, p.elementId)
              : (p?.fplWebName?.trim() ||
                  p?.name ||
                  `#${p?.fotmobPlayerId ?? '?'}`);
            return (
              <span className="prem-bench-other__item" key={`bo-${i}`}>
                <ClickablePlayerName
                  element={p?.elementId}
                  displayName={displayName}
                  web_name={displayName}
                >
                  <span className="prem-bench-other__name">{displayName}</span>
                </ClickablePlayerName>
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
}

/**
 * Renders one team's XI + bench + not-in-squad strip on mobile.
 *
 * Bench is partitioned into:
 *   - `ownedBench`: bench players whose `elementId` is in `ownerByEl` —
 *     rendered as full `MobileLineupRow`s (with owner tag + position pill).
 *   - `unownedBench`: everyone else — rendered as a single compact strip
 *     via `UnownedBenchStrip` (one club crest + names separated by ` | `).
 *
 * The "Bench" header is hidden when both partitions are empty. XI and the
 * owned bench rows are sorted GK → DEF → MID → FWD via
 * `sortPlayersByPosition`.
 */
function MobileLineupSide({
  side,
  club,
  ownerByEl,
  elementById,
  teamById,
  teamLogoMap,
  kitIndexByEntry,
  notInSquad,
}) {
  const sortedXi = useMemo(
    () => sortPlayersByPosition(side?.xi || [], elementById),
    [side?.xi, elementById],
  );
  const { ownedBench, unownedBench } = useMemo(() => {
    const owned = [];
    const unowned = [];
    for (const p of side?.bench || []) {
      const id = Number(p?.elementId);
      const isOwned =
        Number.isFinite(id) && ownerByEl && ownerByEl.get(id);
      if (isOwned) owned.push(p);
      else unowned.push(p);
    }
    return {
      ownedBench: sortPlayersByPosition(owned, elementById),
      unownedBench: sortPlayersByPosition(unowned, elementById),
    };
  }, [side?.bench, ownerByEl, elementById]);
  const showBenchHeader = ownedBench.length > 0 || unownedBench.length > 0;

  return (
    <>
      <div className="prem-mlu-list">
        {sortedXi.map((p, i) => (
          <MobileLineupRow
            key={`xi-${i}`}
            player={p}
            club={club}
            ownerByEl={ownerByEl}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
            elementById={elementById}
            teamById={teamById}
          />
        ))}
      </div>
      {showBenchHeader ? (
        <div className="prem-mlu-bench-head">Bench</div>
      ) : null}
      {ownedBench.length > 0 ? (
        <div className="prem-mlu-list">
          {ownedBench.map((p, i) => (
            <MobileLineupRow
              key={`bench-owned-${i}`}
              player={p}
              club={club}
              ownerByEl={ownerByEl}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
              elementById={elementById}
              teamById={teamById}
              bench
            />
          ))}
        </div>
      ) : null}
      {unownedBench.length > 0 ? (
        <UnownedBenchStrip
          players={unownedBench}
          club={club}
          elementById={elementById}
        />
      ) : null}
      <NotInSquadRow
        players={notInSquad}
        variant="mobile"
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </>
  );
}

function MobileLineupBody({
  home,
  away,
  homeSide,
  awaySide,
  ownerByEl,
  elementById,
  teamById,
  teamLogoMap,
  kitIndexByEntry,
  notInSquadHome,
  notInSquadAway,
}) {
  const [team, setTeam] = useState('home');
  const side = team === 'home' ? homeSide : awaySide;
  const club = team === 'home' ? home : away;
  const notInSquad = team === 'home' ? notInSquadHome : notInSquadAway;
  const homeOwned = countOwnedInXi(homeSide, ownerByEl);
  const awayOwned = countOwnedInXi(awaySide, ownerByEl);

  if (!homeSide && !awaySide) {
    return (
      <p className="muted muted--tight">No lineup yet</p>
    );
  }

  return (
    <>
      <div className="prem-mlu-toggle" role="tablist" aria-label="Choose team">
        {['home', 'away'].map((t) => {
          const isActive = team === t;
          const c = t === 'home' ? home : away;
          const owned = t === 'home' ? homeOwned : awayOwned;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={isActive}
              className={'prem-mlu-toggle__pill' + (isActive ? ' is-active' : '')}
              onClick={() => setTeam(t)}
            >
              {c?.code != null && plBadgeUrl(c.code) ? (
                <img
                  className="prem-mlu-toggle__crest"
                  src={plBadgeUrl(c.code)}
                  alt={c?.name || ''}
                  loading="lazy"
                />
              ) : null}
              <span className="prem-mlu-toggle__name">
                {c?.name || (t === 'home' ? 'Home' : 'Away')}
              </span>
              <span className="prem-mlu-toggle__count">{owned}</span>
            </button>
          );
        })}
      </div>
      {side ? (
        <MobileLineupSide
          side={side}
          club={club}
          ownerByEl={ownerByEl}
          elementById={elementById}
          teamById={teamById}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          notInSquad={notInSquad}
        />
      ) : (
        <p className="muted muted--tight prem-mlu-empty">No lineup yet for this team.</p>
      )}
    </>
  );
}

/* ================================================================== */
/* NEW: Fixture row — collapsed view of a single fixture in the list.  */
/* Click expands the lineups/events body inline below it.              */
/* ================================================================== */
function FixtureRow({
  fx,
  teamById,
  ownerByEl,
  teamLogoMap,
  kitIndexByEntry,
  elementById,
  narrow,
  expanded,
  onToggle,
}) {
  const home = teamById?.[Number(fx.fplFixture?.team_h)];
  const away = teamById?.[Number(fx.fplFixture?.team_a)];
  const homeName = home?.name || 'Home';
  const awayName = away?.name || 'Away';
  const homeShort = home?.short_name || '—';
  const awayShort = away?.short_name || '—';
  const state = fixtureMockupState(fx);

  const showScore =
    fx.score &&
    (fx.score.started || fx.score.finished) &&
    Number.isFinite(Number(fx.score.homeScore));
  const center = showScore
    ? `${fx.score.homeScore}\u2013${fx.score.awayScore}`
    : 'vs';

  const canShowLineups = lineupsBothConfirmed(fx);
  // NOTE: events list is hidden for now — see the events placeholder inside
  // the expanded body below. `fx.events` is still fetched and threaded
  // through props so we can re-enable the section without re-wiring.

  const homeLabel = narrow ? homeShort : homeName;
  const awayLabel = narrow ? awayShort : awayName;

  const notInHome = useMemo(
    () =>
      computeNotInSquad({
        ownerByEl,
        elementById,
        plTeamId: Number(fx.fplFixture?.team_h),
        sideLineup: fx.lineups?.home,
      }),
    [ownerByEl, elementById, fx.fplFixture?.team_h, fx.lineups?.home],
  );
  const notInAway = useMemo(
    () =>
      computeNotInSquad({
        ownerByEl,
        elementById,
        plTeamId: Number(fx.fplFixture?.team_a),
        sideLineup: fx.lineups?.away,
      }),
    [ownerByEl, elementById, fx.fplFixture?.team_a, fx.lineups?.away],
  );

  const kickIso =
    fx.fplFixture?.kickoff_time || fx.score?.kickoffIso || null;

  return (
    <div
      className={
        'prem-fxitem' +
        (expanded ? ' is-expanded' : '') +
        (state === 'live' ? ' is-live' : '')
      }
    >
      <button
        type="button"
        className="prem-fxrow"
        aria-expanded={expanded}
        onClick={onToggle}
        title={kickIso ? formatKickoff(String(kickIso)) : undefined}
      >
        <span className="prem-fxrow__chip">
          <StateChip fx={fx} />
        </span>
        <span className="prem-fxrow__teams">
          <span className="prem-fxrow__home">
            <span className="prem-fxrow__name" title={homeName}>
              {homeLabel}
            </span>
            {plBadgeUrl(home?.code) ? (
              <img
                className="prem-fxrow__badge"
                src={plBadgeUrl(home?.code)}
                alt={homeName}
                loading="lazy"
              />
            ) : null}
          </span>
          <span
            className={
              'prem-fxrow__score' +
              (center === 'vs' ? ' prem-fxrow__score--vs' : '')
            }
          >
            {center}
          </span>
          <span className="prem-fxrow__away">
            {plBadgeUrl(away?.code) ? (
              <img
                className="prem-fxrow__badge"
                src={plBadgeUrl(away?.code)}
                alt={awayName}
                loading="lazy"
              />
            ) : null}
            <span className="prem-fxrow__name" title={awayName}>
              {awayLabel}
            </span>
          </span>
        </span>
        <span className="prem-fxrow__right">
          <KickoffPill fx={fx} />
        </span>
        <span className="prem-fxrow__chev" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded ? (
        <div className="prem-fxbody">
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
            <p className="muted muted--tight prem-fxbody__notice">
              {fx.detailsBlockedReason}
            </p>
          ) : null}

          {/* Events list temporarily hidden — data is still fetched via
              `visibleEvents` so we can re-enable the section without
              re-wiring props/hooks. */}

          {canShowLineups ? (
            <div className="prem-lineups">
              {narrow ? (
                <MobileLineupBody
                  home={home}
                  away={away}
                  homeSide={fx.lineups.home}
                  awaySide={fx.lineups.away}
                  ownerByEl={ownerByEl}
                  elementById={elementById}
                  teamById={teamById}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  notInSquadHome={notInHome}
                  notInSquadAway={notInAway}
                />
              ) : (
                <>
                  <LineupPaired
                    home={home}
                    away={away}
                    homeSide={fx.lineups.home}
                    awaySide={fx.lineups.away}
                    ownerByEl={ownerByEl}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    elementById={elementById}
                    teamById={teamById}
                  />
                  {notInHome.length > 0 || notInAway.length > 0 ? (
                    <div className="prem-nis-pair">
                      <div className="prem-nis-pair__cell prem-nis-pair__cell--home">
                        <NotInSquadRow
                          players={notInHome}
                          variant="desktop"
                          teamLogoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </div>
                      <div className="prem-nis-pair__cell prem-nis-pair__cell--away">
                        <NotInSquadRow
                          players={notInAway}
                          variant="desktop"
                          teamLogoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : fx.matchId && !fx.detailsBlockedReason ? (
            <p className="muted muted--tight">
              Lineups not confirmed yet — they often fill in close to team news (~1 hour before
              kickoff).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* NEW: Pinned 'Live now' strip — only rendered when ≥1 fixture is     */
/* in-play. Live fixtures shown here are removed from the day groups   */
/* below to avoid duplication.                                         */
/* ================================================================== */
function LiveStrip({ fixtures, rowProps, expandedSet, onToggle }) {
  if (!fixtures?.length) return null;
  return (
    <section className="prem-livenow" aria-label="Live now">
      <header className="prem-livenow__head">
        <span className="prem-livenow__dot" aria-hidden />
        <span className="prem-livenow__title">Live now</span>
        <span className="prem-livenow__count">{fixtures.length}</span>
      </header>
      <div className="prem-fxlist prem-fxlist--live">
        {fixtures.map((fx) => {
          const key = fixtureKey(fx);
          if (!key) return null;
          return (
            <FixtureRow
              key={key}
              fx={fx}
              {...rowProps}
              expanded={expandedSet.has(key)}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </section>
  );
}

/** Day band ('Saturday, Apr 12') above each day group. */
function DayBand({ label }) {
  return <div className="prem-day">{label}</div>;
}

/* ================================================================== */
/* Main component.                                                     */
/* ================================================================== */
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
    fixturesDegradedNotice: liveFixturesDegradedNotice,
    events,
    squads,
    contributionLiveContext,
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
  const [premWindowLoading, setPremWindowLoading] = useState(false);
  const [premWindowError, setPremWindowError] = useState(null);
  const [premWindowRows, setPremWindowRows] = useState(/** @type {any[]} */ ([]));
  /** Fetch-generation guard so a slow request for an older GW cannot overwrite the new one. */
  const premWindowGenRef = useRef(0);

  /**
   * Match data (score, lineups, events) for the GW's fixture list.
   *
   * Pulselive (official PL backend) is primary, ESPN is fallback — same
   * pattern `useLiveScores` already uses to feed FPL pick rows. Pulselive
   * publishes confirmed lineups at T-75, ~15 minutes earlier than ESPN, so
   * preferring it gets the Lineups page populated sooner; per-fixture rows
   * fall back to ESPN automatically when Pulselive is missing data.
   *
   * # Caching
   *
   * Finished fixtures are immutable (XI, bench, events, score, status). For
   * each `gwFixture.pulse_id`, we first look up a session-scoped cache via
   * `getCachedLineup`. Cached rows are displayed immediately and the
   * uncached subset is what we actually request from the network. If the
   * whole GW is cached (e.g. browsing a completed GW after a tab-switch),
   * no requests fire at all and the page lights up instantly.
   *
   * `forceRefresh: true` wipes the cache and re-runs the full fetch graph;
   * kept as a programmatic escape hatch even though the UI no longer
   * exposes a manual refresh control (the 90s `useLiveScores` poll and
   * GW-change effect drive all refreshes automatically).
   */
  const doPremWindowFetch = useCallback(
    async ({ forceRefresh = false } = {}) => {
      if (!gwFixtures || !teamById || !elementById) return;
      if (!gwFixtures.length) {
        setPremWindowRows([]);
        setPremWindowError(null);
        return;
      }
      premWindowGenRef.current += 1;
      const gen = premWindowGenRef.current;
      if (forceRefresh) clearAllCachedLineups();

      /** Partition fixtures by cache state. `cachedById` keeps insertion
       *  order so we can rebuild the final row list in `gwFixtures` order
       *  by joining cached + fresh rows on `pulse_id`. */
      const cachedById = new Map();
      const uncachedFixtures = [];
      for (const fx of gwFixtures) {
        const pid = Number(fx?.pulse_id);
        const cached =
          !forceRefresh && Number.isFinite(pid) ? getCachedLineup(pid) : null;
        if (cached) cachedById.set(pid, { ...cached, fplFixture: fx });
        else uncachedFixtures.push(fx);
      }

      /** Surface cached rows immediately — progressive hydration so the
       *  user sees finished fixtures the moment the component mounts even
       *  when one or two live fixtures are still being fetched. */
      if (cachedById.size > 0) {
        const initialRows = gwFixtures
          .map((fx) => cachedById.get(Number(fx?.pulse_id)))
          .filter(Boolean);
        setPremWindowRows(initialRows);
      }

      /** Whole-GW cache hit — short-circuit before touching the network. */
      if (uncachedFixtures.length === 0) {
        setPremWindowError(null);
        setPremWindowLoading(false);
        return;
      }

      setPremWindowLoading(true);
      setPremWindowError(null);
      try {
        const [pulseRows, espnRows] = await Promise.all([
          fetchPulselivePremWindow({
            gwFixtures: uncachedFixtures,
            teamById,
            elementById,
          }).catch(() => []),
          fetchEspnPremWindow({
            gwFixtures: uncachedFixtures,
            teamById,
            elementById,
          }).catch(() => []),
        ]);
        if (gen !== premWindowGenRef.current) return;
        const freshRows = mergePremWindowSources(pulseRows, espnRows, {
          primaryLabel: 'pulselive',
          fallbackLabel: 'espn',
        });
        /** Persist any newly-finished rows for the next mount. The cache
         *  module gates on `isRowFullTime`, so live/pre-match rows are
         *  silently rejected here. */
        for (const row of freshRows) {
          const pid = Number(row?.fplFixture?.pulse_id);
          if (Number.isFinite(pid)) setCachedLineup(pid, row);
        }
        /** Build the final list in the order `gwFixtures` defines so the
         *  day-grouping below picks up rows in kickoff order without an
         *  extra sort pass. */
        const byPulseId = new Map();
        for (const [pid, row] of cachedById) byPulseId.set(pid, row);
        for (const row of freshRows) {
          const pid = Number(row?.fplFixture?.pulse_id);
          if (Number.isFinite(pid)) byPulseId.set(pid, row);
        }
        const finalRows = gwFixtures
          .map((fx) => byPulseId.get(Number(fx?.pulse_id)))
          .filter(Boolean);
        setPremWindowRows(finalRows);
      } catch (e) {
        if (gen !== premWindowGenRef.current) return;
        setPremWindowError(e?.message || String(e));
        /** Don't blow away the cached rows on a transient error; keep them
         *  visible so the user can still see finished fixtures. */
        if (cachedById.size === 0) setPremWindowRows([]);
      } finally {
        if (gen === premWindowGenRef.current) setPremWindowLoading(false);
      }
    },
    [gwFixtures, teamById, elementById],
  );

  useEffect(() => {
    void doPremWindowFetch();
  }, [doPremWindowFetch]);

  /**
   * Sort rows by earliest kickoff first. Split out live (in-play) fixtures
   * into a separate list for the pinned 'Live now' strip; the rest are
   * grouped by day.
   */
  const { liveFixtures, dayGroups } = useMemo(() => {
    const rows = [...(premWindowRows || [])];
    rows.sort((a, b) => {
      const ka = Date.parse(a.fplFixture?.kickoff_time || '') || 0;
      const kb = Date.parse(b.fplFixture?.kickoff_time || '') || 0;
      return ka - kb;
    });
    const live = [];
    /** @type {Map<string, { label: string, fixtures: any[] }>} */
    const byDay = new Map();
    for (const r of rows) {
      if (isFixtureLive(r)) {
        live.push(r);
        continue;
      }
      const iso = r.fplFixture?.kickoff_time || r.score?.kickoffIso || null;
      const label = iso ? kickoffDateLabel(String(iso)) : 'Date TBD';
      if (!byDay.has(label)) byDay.set(label, { label, fixtures: [] });
      byDay.get(label).fixtures.push(r);
    }
    return { liveFixtures: live, dayGroups: [...byDay.values()] };
  }, [premWindowRows]);

  const ownerByEl = useMemo(() => buildOwnerMap(squads), [squads]);

  const awaitingFplContext =
    !liveError &&
    (teams?.length ?? 0) > 0 &&
    gwFixtures == null &&
    (liveLoading || contributionLiveContext == null);

  const awaitingPremWindow =
    !liveError &&
    !premWindowError &&
    Array.isArray(gwFixtures) &&
    gwFixtures.length > 0 &&
    premWindowLoading &&
    liveFixtures.length === 0 &&
    dayGroups.length === 0;

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

  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = useCallback((/** @type {number | string} */ matchKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) next.delete(matchKey);
      else next.add(matchKey);
      return next;
    });
  }, []);

  /** Shared props for each `FixtureRow` so the list/strip stay terse. */
  const rowProps = {
    teamById: teamById || {},
    ownerByEl,
    teamLogoMap,
    kitIndexByEntry,
    elementById,
    narrow,
  };

  const noFixtures =
    liveFixtures.length === 0 && dayGroups.length === 0 && !premWindowLoading;

  return (
    <div className="dashboard-stack prem-window-root">
      <section className="prem-window-chrome" aria-label="Lineups">
        {/* Same navigator the Scores subtab uses (`GameWeekNavigator` from
            `LiveScores.jsx`). Auto-refresh is handled by the 90s
            `useLiveScores` poll plus the GW-change effect, so no manual
            refresh control is rendered. */}
        <GameWeekNavigator
          gameweek={gameweek}
          gwOptions={gwOptions}
          onGameweekChange={onGameweekChange}
        />

        {liveError ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load live FPL context.</strong> {liveError}
          </div>
        ) : null}
        {!liveError && liveFixturesDegradedNotice ? (
          <div className="data-banner" role="status">
            <strong>Limited fixture data.</strong> {liveFixturesDegradedNotice}
          </div>
        ) : null}
        {premWindowError ? (
          <div className="data-banner data-banner--error" role="alert">
            <strong>Could not load match data.</strong> {premWindowError}
          </div>
        ) : null}
      </section>

      {awaitingFplContext ? (
        <section className="tile tile--compact" aria-busy="true">
          <p className="muted muted--tight">Loading Premier League fixtures (FPL) for lineups…</p>
        </section>
      ) : null}

      {awaitingPremWindow ? (
        <section className="tile tile--compact" aria-busy="true">
          <p className="muted muted--tight">
            Loading lineups, scores, and events…
          </p>
        </section>
      ) : null}

      {noFixtures ? (
        <section className="tile tile--compact">
          <p className="muted muted--tight">No fixtures for this gameweek.</p>
        </section>
      ) : null}

      {(liveFixtures.length > 0 || dayGroups.length > 0) ? (
        <section className="prem-fixlist-card" aria-label="Fixtures">
          <LiveStrip
            fixtures={liveFixtures}
            rowProps={rowProps}
            expandedSet={expanded}
            onToggle={toggle}
          />
          {dayGroups.map((day) => (
            <section className="prem-daysect" key={day.label}>
              <DayBand label={day.label} />
              <div className="prem-fxlist">
                {day.fixtures.map((fx) => {
                  const key = fixtureKey(fx);
                  if (!key) return null;
                  return (
                    <FixtureRow
                      key={key}
                      fx={fx}
                      {...rowProps}
                      expanded={expanded.has(key)}
                      onToggle={() => toggle(key)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      ) : null}
    </div>
  );
}
