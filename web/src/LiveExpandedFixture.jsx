import { Fragment, useMemo, useState } from 'react';
import { liveGwDisplayTotal } from './liveGwTotals.js';
import {
  dcThresholdReached,
  isCleanSheetEligible,
  minutesTone,
  playerXiPillKind,
  rowsByPointsContributed,
  sortStartingXIByPosition,
} from './liveScoresDerivations.js';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';
import { effectiveBench, effectiveStarters } from './liveSquadEffective.js';

/** Picks the active auto-sub list off a squad (official preferred, then projected). */
function pickAutoSubs(squad) {
  if (!squad) return null;
  const subs =
    squad.autosubSource === 'official' && squad.autoSubs?.length
      ? squad.autoSubs
      : squad.autosubSource === 'projected' && squad.projectedAutoSubs?.length
        ? squad.projectedAutoSubs
        : [];
  if (!subs.length) return null;
  return { subs, source: squad.autosubSource };
}

/**
 * Auto-subs note line — small inline text at the bottom of the team's
 * table (after BENCH). Only renders when there are auto-subs for that
 * team this GW. Placing it at the tail keeps mid-table rows vertically
 * aligned across the desktop two-column layout.
 */
function AutoSubsNote({ squad }) {
  const auto = pickAutoSubs(squad);
  if (!auto) return null;
  const allRows = [...(squad?.starters ?? []), ...(squad?.bench ?? [])];

  return (
    <div
      className={
        'live-xp__autosubs' +
        (auto.source === 'projected' ? ' live-xp__autosubs--projected' : '')
      }
      role="status"
    >
      <strong>
        {auto.source === 'official' ? 'Auto subs:' : 'Projected auto subs:'}
      </strong>{' '}
      {auto.subs.map((a, i) => {
        const rowIn = allRows.find((r) => r.element === Number(a.element_in));
        const rowOut = allRows.find((r) => r.element === Number(a.element_out));
        const nameIn = rowIn?.displayName ?? rowIn?.web_name ?? `#${a.element_in}`;
        const nameOut = rowOut?.displayName ?? rowOut?.web_name ?? `#${a.element_out}`;
        return (
          <Fragment key={`${a.element_in}-${a.element_out}`}>
            {i > 0 ? <span className="live-xp__autosubs-sep">, </span> : null}
            <span className="live-xp__autosub-pair">
              <ClickablePlayerName
                element={a.element_in}
                displayName={rowIn?.displayName}
                web_name={rowIn?.web_name ?? nameIn}
                teamShort={rowIn?.teamShort}
              >
                {nameIn}
              </ClickablePlayerName>{' '}
              ↔{' '}
              <ClickablePlayerName
                element={a.element_out}
                displayName={rowOut?.displayName}
                web_name={rowOut?.web_name ?? nameOut}
                teamShort={rowOut?.teamShort}
              >
                {nameOut}
              </ClickablePlayerName>
            </span>
          </Fragment>
        );
      })}
      {auto.source === 'projected' ? (
        <span className="live-xp__autosubs-note">
          {' '}
          Provisional until FPL posts official autosubs.
        </span>
      ) : null}
    </div>
  );
}

/**
 * A single player row inside the per-team table. Mirrors the OPTION 2
 * mockup `mockup-table__row` — columns: PLAYER · POS · MIN · DC · G · A · B · PTS.
 */
function LiveExpandedTableRow({ row, bench, onOpenPlayer, autosubbed }) {
  const pillKind = playerXiPillKind(row);
  const mins = Number(row.minutes) || 0;
  const played = mins > 0;
  const tone = minutesTone(mins, played);
  const dc = Number(row.dcCount) || 0;
  const dcOn = played && dcThresholdReached(row.posSingular, dc);
  const goals = Number(row.goalsScored) || 0;
  const assists = Number(row.assists) || 0;
  const bonus = Number(row.bonus) || 0;
  const pts = Number(row.total_points) || 0;
  // FPL live element stat `clean_sheets` (already mapped on the row). Dot only
  // when FPL has awarded CS points and the position can score them.
  const showCleanSheet =
    (Number(row.cleanSheets) || 0) > 0 && isCleanSheetEligible(row.posSingular);
  const displayName = row.displayName ?? row.web_name ?? `#${row.element}`;
  const numOrDash = (n, accentClass) => {
    if (!played) return <span className="live-xp__zero">—</span>;
    if (n > 0) {
      return (
        <span className={`live-xp__cell-num ${accentClass}`}>{n}</span>
      );
    }
    return <span className="live-xp__zero">0</span>;
  };

  return (
    <div className={'live-xp__row' + (bench ? ' live-xp__row--bench' : '')}>
      <div className="live-xp__cell live-xp__cell--player">
        {row.badgeUrl ? (
          <img
            className="live-xp__player-crest"
            src={row.badgeUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="live-xp__player-crest live-xp__player-crest--fallback" aria-hidden="true">
            {row.teamShort?.slice(0, 3) ?? '—'}
          </span>
        )}
        {onOpenPlayer ? (
          <button
            type="button"
            className={`live-xp__player-name live-xp__player-name--${pillKind}`}
            onClick={() => onOpenPlayer(row)}
            title={`${displayName} — view season history`}
          >
            <span className="live-xp__player-name-text">{displayName}</span>
            {showCleanSheet ? (
              <span
                className="live-xp__player-cs"
                aria-label="Clean sheet points"
                title="Clean sheet points"
              />
            ) : null}
            {row.availabilityStatus === 'i' ? (
              <span
                className="live-xp__player-icon"
                title={row.availabilityNews?.trim() || 'Injured'}
                aria-label="Injured"
                role="img"
              >
                🚑
              </span>
            ) : null}
            {autosubbed ? (
              <span
                className="live-xp__player-icon"
                title="Autosubbed in from the bench"
                aria-label="Autosubbed in from the bench"
                role="img"
              >
                🔄
              </span>
            ) : null}
          </button>
        ) : (
          <span className={`live-xp__player-name live-xp__player-name--${pillKind}`}>
            <span className="live-xp__player-name-text">{displayName}</span>
            {showCleanSheet ? (
              <span
                className="live-xp__player-cs"
                aria-label="Clean sheet points"
                title="Clean sheet points"
              />
            ) : null}
            {row.availabilityStatus === 'i' ? (
              <span className="live-xp__player-icon" aria-label="Injured" role="img">🚑</span>
            ) : null}
            {autosubbed ? (
              <span className="live-xp__player-icon" aria-label="Autosubbed in" role="img">🔄</span>
            ) : null}
          </span>
        )}
      </div>
      <div className="live-xp__cell live-xp__cell--pos">{row.posSingular}</div>
      <div className={`live-xp__cell live-xp__cell--min live-xp__cell--min-${tone}`}>
        {played ? mins : '—'}
      </div>
      <div
        className={
          'live-xp__cell live-xp__cell--num live-xp__cell--dc' +
          (!played ? ' live-xp__cell--mute' : '') +
          (dcOn ? ' live-xp__cell--dc-on' : '')
        }
      >
        {played ? dc : '—'}
      </div>
      <div className="live-xp__cell live-xp__cell--num live-xp__cell--g">
        {numOrDash(goals, 'live-xp__cell-num--g')}
      </div>
      <div className="live-xp__cell live-xp__cell--num live-xp__cell--a">
        {numOrDash(assists, 'live-xp__cell-num--a')}
      </div>
      <div className="live-xp__cell live-xp__cell--num live-xp__cell--b">
        {numOrDash(bonus, 'live-xp__cell-num--b')}
      </div>
      <div
        className={
          'live-xp__cell live-xp__cell--num live-xp__cell--pts' +
          (pts === 0 ? ' live-xp__cell--pts-zero' : '')
        }
      >
        {pts}
      </div>
    </div>
  );
}

/**
 * Column header row above each team's table. Matches mockup
 * `mockup-table__head`.
 */
function LiveExpandedTableHead({ playerLabel = 'Player' }) {
  const isTeamLabel = playerLabel !== 'Player';
  return (
    <div className="live-xp__thead" role="row">
      <div
        className={
          'live-xp__th live-xp__th--player' +
          (isTeamLabel ? ' live-xp__th--player-team' : '')
        }
        title={isTeamLabel ? playerLabel : undefined}
      >
        {playerLabel}
      </div>
      <div className="live-xp__th live-xp__th--pos">Pos</div>
      <div className="live-xp__th live-xp__th--min">Min</div>
      <div className="live-xp__th live-xp__th--dc">DC</div>
      <div className="live-xp__th live-xp__th--g" title="Goals">G</div>
      <div className="live-xp__th live-xp__th--a" title="Assists">A</div>
      <div className="live-xp__th live-xp__th--b">B</div>
      <div className="live-xp__th live-xp__th--pts">Pts</div>
    </div>
  );
}

/**
 * One team's player table: optional auto-subs note, column header, then
 * STARTING XI rows and BENCH rows sorted by points contributed.
 */
function LiveExpandedTeamTable({ squad, onOpenPlayer, autosubInIds, playerLabel, showAutosubs = true, benchAccessory = null }) {
  // Starting XI is sorted by FPL position (GK → DEF → MID → FWD) so the
  // user can scan "best players at each position" across the two team
  // columns. Bench keeps points-contributed sort — order is independent.
  const startersSorted = useMemo(
    () => sortStartingXIByPosition(effectiveStarters(squad)),
    [squad],
  );
  const benchSorted = useMemo(
    () => rowsByPointsContributed(effectiveBench(squad)),
    [squad],
  );

  if (!squad) {
    return <p className="muted muted--tight">No squad data for this team.</p>;
  }
  if (squad.error) {
    return <p className="muted">{squad.error}</p>;
  }

  return (
    <div className="live-xp__team">
      <div className="live-xp__table" role="table">
        <LiveExpandedTableHead playerLabel={playerLabel} />
        <div className="live-xp__group live-xp__group--xi" role="row">Starting XI</div>
        {startersSorted.map((r) => (
          <LiveExpandedTableRow
            key={`s-${r.element}-${r.pickPosition}`}
            row={r}
            onOpenPlayer={onOpenPlayer}
            autosubbed={autosubInIds?.has(Number(r.element))}
          />
        ))}
        {benchSorted.length ? (
          <>
            <div className="live-xp__group live-xp__group--bench" role="row">
              <span className="live-xp__group-label">Bench</span>
              {benchAccessory}
            </div>
            {benchSorted.map((r) => (
              <LiveExpandedTableRow
                key={`b-${r.element}-${r.pickPosition}`}
                row={r}
                bench
                onOpenPlayer={onOpenPlayer}
              />
            ))}
          </>
        ) : null}
      </div>
      {/*
       * Auto-subs note renders AFTER the bench so both teams' starting XI
       * and bench rows line up vertically in the desktop side-by-side
       * layout — only the trailing autosub note adds tail height to one
       * column when the other team has no autosubs.
       */}
      {showAutosubs ? <AutoSubsNote squad={squad} /> : null}
    </div>
  );
}

/**
 * The expanded fixture body — restyled to match OPTION 2 · TABLE (STAT
 * TRACKING). User rejected the FotMob-derived row layout shipped in
 * PR #5 / 5a.
 *
 * Layout:
 *   - mobile         : tab selector (home / away) → one team's table.
 *   - desktop        : two team tables side-by-side.
 *
 * In both layouts the collapsed face-off row directly above the
 * expanded body carries the matchup + status, and clicking it toggles
 * the collapse — so no in-body sticky header / back-chevron is needed.
 *
 * The mobile team selector can be driven externally (e.g. the live
 * fixture card's scorehead badges) by passing `selectedSide` +
 * `onSelectSide`, and the internal tab bar can be hidden with
 * `showTabs={false}`.
 *
 * @param {{
 *   homeSquad: object,
 *   awaySquad: object,
 *   homeName: string,
 *   awayName: string,
 *   viewport?: 'desktop' | 'mobile',
 *   onOpenPlayer?: (row: object, squad: object) => void,
 *   selectedSide?: 'home' | 'away',
 *   onSelectSide?: (side: 'home' | 'away') => void,
 *   showTabs?: boolean,
 * }} props
 */
export function LiveExpandedFixture({
  homeSquad,
  awaySquad,
  homeName,
  awayName,
  viewport = 'desktop',
  onOpenPlayer,
  selectedSide,
  onSelectSide,
  showTabs = true,
  showAutosubs = true,
  benchAccessory = null,
}) {
  const homeAutoSubs = pickAutoSubs(homeSquad);
  const awayAutoSubs = pickAutoSubs(awaySquad);
  const homeAutoIn = useMemo(
    () => new Set((homeAutoSubs?.subs || []).map((a) => Number(a.element_in))),
    [homeAutoSubs],
  );
  const awayAutoIn = useMemo(
    () => new Set((awayAutoSubs?.subs || []).map((a) => Number(a.element_in))),
    [awayAutoSubs],
  );

  const [tab, setTab] = useState('home');

  const homeTotal = liveGwDisplayTotal(homeSquad);
  const awayTotal = liveGwDisplayTotal(awaySquad);

  const onPick = onOpenPlayer
    ? (row, squad) => onOpenPlayer(row, squad)
    : undefined;

  if (viewport === 'mobile') {
    // Controlled (scorehead-driven) selection when `selectedSide` is passed,
    // otherwise fall back to the internal tab state.
    const activeTab = selectedSide ?? tab;
    const selectSide = onSelectSide ?? setTab;
    const activeSquad = activeTab === 'home' ? homeSquad : awaySquad;
    const activeAutoIn = activeTab === 'home' ? homeAutoIn : awayAutoIn;
    return (
      <div className="live-xp live-xp--mobile">
        {showTabs ? (
          <div className="live-xp__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'home'}
              className={'live-xp__tab' + (activeTab === 'home' ? ' is-active' : '')}
              onClick={() => selectSide('home')}
            >
              <span className="live-xp__tab-name">{homeName}</span>
              <span className="live-xp__tab-pts tabular">
                {homeTotal != null ? `${homeTotal} pts` : '—'}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'away'}
              className={'live-xp__tab' + (activeTab === 'away' ? ' is-active' : '')}
              onClick={() => selectSide('away')}
            >
              <span className="live-xp__tab-name">{awayName}</span>
              <span className="live-xp__tab-pts tabular">
                {awayTotal != null ? `${awayTotal} pts` : '—'}
              </span>
            </button>
          </div>
        ) : null}
        <LiveExpandedTeamTable
          squad={activeSquad}
          onOpenPlayer={onPick ? (r) => onPick(r, activeSquad) : undefined}
          autosubInIds={activeAutoIn}
          playerLabel={activeTab === 'home' ? homeName : awayName}
          showAutosubs={showAutosubs}
          benchAccessory={benchAccessory}
        />
      </div>
    );
  }

  return (
    <div className="live-xp live-xp--desktop">
      <div className="live-xp__columns">
        <section className="live-xp__column">
          <LiveExpandedTeamTable
            squad={homeSquad}
            onOpenPlayer={onPick ? (r) => onPick(r, homeSquad) : undefined}
            autosubInIds={homeAutoIn}
            showAutosubs={showAutosubs}
          />
        </section>
        <section className="live-xp__column">
          <LiveExpandedTeamTable
            squad={awaySquad}
            onOpenPlayer={onPick ? (r) => onPick(r, awaySquad) : undefined}
            autosubInIds={awayAutoIn}
            showAutosubs={showAutosubs}
          />
        </section>
      </div>
    </div>
  );
}
