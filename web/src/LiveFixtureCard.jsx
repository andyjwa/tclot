import { useEffect, useRef, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveExpandedFixture } from './LiveExpandedFixture.jsx';
import { LiveStandingsTable } from './LiveStandingsTable.jsx';
import { LiveFixtureKeyStats } from './LiveFixtureKeyStats.jsx';
import { LiveFixtureH2hBars } from './LiveFixtureH2hBars.jsx';
import { LiveFixtureOdds } from './LiveFixtureOdds.jsx';

const TABS = [
  { id: 'lineups', label: 'Lineups' },
  { id: 'stats', label: 'Key Stats' },
  { id: 'odds', label: 'Odds' },
  { id: 'table', label: 'Live Table' },
];

/** Persisted flag: the one-time "pull to switch teams" coach hint has been shown. */
const COACH_KEY = 'tclot:lfcTeamSwitchCoachSeen';
/** Session guard so the coach only fires once even across sheet re-opens. */
let coachClaimed = false;

/** Overscroll-to-switch tuning. */
const SWITCH_THRESHOLD = 82; // px of (resisted) pull needed to commit a switch
const SWITCH_MAX = 150; // px cap on the visible pull
const SWITCH_RESIST = 0.62; // rubber-band resistance factor

/** Per-side caption beneath the team name in the scorehead. */
function teamSubText(remaining, isLeader, settled) {
  if (remaining != null && remaining > 0) {
    return { text: `${remaining} to play`, live: true };
  }
  if (settled && isLeader) return { text: 'Winner', live: false };
  return { text: '\u00a0', live: false };
}

/**
 * A single live fixture "page" in the swipeable deck: a scorehead whose
 * team badges select which lineup to show (additive highlight), a 4-tab
 * selector (Lineups / Key Stats / Odds / Live Table), and the matching
 * scrollable pane. Key Stats also folds in the season head-to-head; Odds
 * carries the pre-match projection model. Reuses the production lineup table
 * ({@link LiveExpandedFixture}) and {@link LiveStandingsTable}.
 *
 * @param {{ fixture: object, ctx: object }} props
 */
export function LiveFixtureCard({ fixture, ctx, active = false }) {
  const [tab, setTab] = useState('lineups');
  const [side, setSide] = useState('home');

  const {
    homeId,
    awayId,
    homeName,
    awayName,
    homeSquad,
    awaySquad,
    homeLive,
    awayLive,
    homeRemaining,
    awayRemaining,
    comp,
  } = fixture;

  // Refs so the imperative gesture handler (bound once) always reads the
  // latest tab/side and can drive the switch without re-binding listeners.
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const cardRef = useRef(null);
  const tabRef = useRef(tab);
  const sideRef = useRef(side);
  // Keep the imperative-handler refs in sync (they're read asynchronously
  // during touch/mouse gestures, never during render). `setSide` from useState
  // has a stable identity so it's used directly in the handler below.
  useEffect(() => {
    tabRef.current = tab;
    sideRef.current = side;
  }, [tab, side]);

  // ---- Overscroll-to-switch gesture (Lineups tab only) ----
  // Pull up past the end of the home lineup → switch to the away team; on the
  // away team, pull down past the top → switch back. Everything stays on one
  // page; this only engages at the scroll boundary. We stopPropagation on the
  // switch gesture so the deck's swipe-down-to-dismiss doesn't also fire (that
  // dismiss stays available on the home team, where a downward pull isn't a
  // switch).
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const wrap = wrapRef.current;
    if (!scrollEl || !wrap) return undefined;

    let startX = 0;
    let startY = 0;
    let axis = null;
    let dragging = false;
    let mode = null; // 'toAway' | 'toHome' | null
    let dist = 0;

    const atBottom = () =>
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;
    const atTop = () => scrollEl.scrollTop <= 0;
    const point = (e) => (e.touches ? e.touches[0] : e);
    const bandFor = (m) =>
      wrap.querySelector(
        m === 'toAway' ? '.lfc-switch-reveal--bottom' : '.lfc-switch-reveal--top',
      );

    const clearReveal = (animate) => {
      if (animate) scrollEl.style.transition = 'transform 0.3s ease';
      scrollEl.style.transform = '';
      scrollEl.style.opacity = '';
      wrap.classList.remove('is-switch-ready', 'is-switching');
      const rb = wrap.querySelector('.lfc-switch-reveal--bottom');
      const rt = wrap.querySelector('.lfc-switch-reveal--top');
      if (rb) rb.style.opacity = '';
      if (rt) rt.style.opacity = '';
      if (animate) {
        window.setTimeout(() => {
          scrollEl.style.transition = '';
        }, 320);
      }
    };

    const onDown = (e) => {
      if (tabRef.current !== 'lineups') return;
      // If the user grabs the pane mid coach-hint, cancel it so the drag owns
      // the transform.
      cardRef.current?.classList.remove('lfc-card--coaching');
      dragging = true;
      axis = null;
      mode = null;
      dist = 0;
      const p = point(e);
      startX = p.clientX;
      startY = p.clientY;
      scrollEl.style.transition = '';
    };

    const onMove = (e) => {
      if (!dragging) return;
      const p = point(e);
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') {
          const s = sideRef.current;
          if (s === 'home' && dy < 0 && atBottom()) mode = 'toAway';
          else if (s === 'away' && dy > 0 && atTop()) mode = 'toHome';
          else mode = null;
        }
      }
      // Horizontal drags (deck paging) and non-switch vertical drags (home
      // dismiss, mid-list scroll) are left entirely to the deck / native scroll.
      if (axis !== 'y' || !mode) return;

      e.stopPropagation();
      if (e.cancelable) e.preventDefault();

      const raw = Math.max(0, mode === 'toAway' ? -dy : dy);
      dist = Math.min(raw * SWITCH_RESIST, SWITCH_MAX);
      const ready = dist >= SWITCH_THRESHOLD;
      const sign = mode === 'toAway' ? -1 : 1;
      scrollEl.style.transform = `translateY(${sign * dist}px)`;

      const band = bandFor(mode);
      if (band) {
        band.style.opacity = String(Math.min(dist / SWITCH_THRESHOLD, 1));
        const t1 = band.querySelector('.lfc-switch-reveal__t1');
        if (t1) t1.textContent = ready ? 'Release to view' : 'Keep pulling';
      }
      wrap.classList.toggle('is-switch-ready', ready);
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      if (axis === 'y' && mode) {
        const commit = dist >= SWITCH_THRESHOLD;
        if (commit) {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const target = mode === 'toAway' ? 'away' : 'home';
          const sign = mode === 'toAway' ? -1 : 1;
          wrap.classList.add('is-switching');
          scrollEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
          scrollEl.style.transform = `translateY(${sign * (dist + 44)}px)`;
          scrollEl.style.opacity = '0';
          window.setTimeout(() => {
            setSide(target);
            clearReveal(false);
            scrollEl.style.transition = '';
            wrap.classList.add(target === 'away' ? 'is-switch-enter-up' : 'is-switch-enter-down');
            window.setTimeout(() => {
              wrap.classList.remove('is-switch-enter-up', 'is-switch-enter-down');
            }, 300);
          }, 190);
        } else {
          clearReveal(true);
        }
      }
      axis = null;
      mode = null;
      dist = 0;
    };

    scrollEl.addEventListener('touchstart', onDown, { passive: true });
    scrollEl.addEventListener('touchmove', onMove, { passive: false });
    scrollEl.addEventListener('touchend', onUp);
    scrollEl.addEventListener('mousedown', onDown);
    scrollEl.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      scrollEl.removeEventListener('touchstart', onDown);
      scrollEl.removeEventListener('touchmove', onMove);
      scrollEl.removeEventListener('touchend', onUp);
      scrollEl.removeEventListener('mousedown', onDown);
      scrollEl.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ---- One-time coach hint ----
  // The very first time an opened card is the active page (on the Lineups tab,
  // home side), gently bounce the list and flash the reveal + tooltip so the
  // pull-to-switch gesture is discoverable. Never shown again (persisted).
  useEffect(() => {
    if (!active || tab !== 'lineups' || side !== 'home') return undefined;
    if (coachClaimed) return undefined;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(COACH_KEY)) {
        return undefined;
      }
    } catch {
      /* localStorage unavailable — just show it this session */
    }
    coachClaimed = true;
    const card = cardRef.current;
    const start = window.setTimeout(() => {
      card?.classList.add('lfc-card--coaching');
    }, 650);
    const end = window.setTimeout(() => {
      card?.classList.remove('lfc-card--coaching');
      try {
        localStorage.setItem(COACH_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 650 + 2400);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
      card?.classList.remove('lfc-card--coaching');
    };
  }, [active, tab, side]);

  const toPlay = (Number(homeRemaining) || 0) + (Number(awayRemaining) || 0);
  const live = toPlay > 0;
  const settled = !live && homeLive != null && awayLive != null && homeLive !== awayLive;
  const homeSub = teamSubText(homeRemaining, homeLive > awayLive, settled);
  const awaySub = teamSubText(awayRemaining, awayLive > homeLive, settled);

  // Selection highlight only reads meaningfully on the Lineups tab.
  const selHome = tab === 'lineups' && side === 'home';
  const selAway = tab === 'lineups' && side === 'away';

  const teamButton = (which) => {
    const isHome = which === 'home';
    const sel = isHome ? selHome : selAway;
    return (
      <button
        type="button"
        className={'lfc-team' + (sel ? ' is-sel' : '')}
        onClick={() => {
          setSide(which);
          if (tab !== 'lineups') setTab('lineups');
        }}
        aria-pressed={sel}
        aria-label={`Show ${isHome ? homeName : awayName} lineup`}
      >
        <span className="lfc-team__score tabular">
          {(isHome ? homeLive : awayLive) ?? '—'}
        </span>
        <span className="lfc-team__badge">
          <TeamAvatar
            entryId={isHome ? homeId : awayId}
            name={isHome ? homeName : awayName}
            size="lg"
            logoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
          />
        </span>
        <span className="lfc-team__name">{isHome ? homeName : awayName}</span>
        <span
          className={
            'lfc-team__sub' + ((isHome ? homeSub : awaySub).live ? ' lfc-team__sub--live' : '')
          }
        >
          {(isHome ? homeSub : awaySub).text}
        </span>
      </button>
    );
  };

  // The reveal band that appears while over-pulling. Bottom = the away team
  // (revealed by pulling up on the home lineup); top = the home team (revealed
  // by pulling down on the away lineup). Only rendered on the Lineups tab.
  const revealBand = (which) => {
    const isBottom = which === 'bottom';
    const teamId = isBottom ? awayId : homeId;
    const teamName = isBottom ? awayName : homeName;
    return (
      <div
        className={'lfc-switch-reveal lfc-switch-reveal--' + which}
        aria-hidden="true"
      >
        <span className="lfc-switch-reveal__chev">{isBottom ? '⌃' : '⌄'}</span>
        <span className="lfc-switch-reveal__badge">
          <TeamAvatar
            entryId={teamId}
            name={teamName}
            size="lg"
            logoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
          />
        </span>
        <span className="lfc-switch-reveal__t1">Release to view</span>
        <span className="lfc-switch-reveal__t2">{teamName}</span>
      </div>
    );
  };

  return (
    <div className="lfc-card" ref={cardRef}>
      <div className="lfc-card__top">
        <div className="lfc-scorehead" role="group" aria-label="Tap a team to view its lineup">
          {teamButton('home')}
          <div className="lfc-mid">
            <span className={'lfc-mid__main' + (live ? ' lfc-mid__main--live' : '')}>
              {live ? '● LIVE' : 'FT'}
            </span>
            {comp ? <span className="lfc-mid__sub">{comp}</span> : null}
          </div>
          {teamButton('away')}
        </div>
        <div className="lfc-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={'lfc-tab' + (tab === t.id ? ' is-active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lfc-pane-wrap" ref={wrapRef}>
        {tab === 'lineups' ? (
          <>
            {revealBand('top')}
            {revealBand('bottom')}
            <div className="lfc-switch-tip" aria-hidden="true">
              <span className="lfc-switch-tip__chev">⌃</span>
              Pull past the bench to switch teams
            </div>
          </>
        ) : null}
        <div className="lfc-card__scroll lfc-pane" ref={scrollRef}>
        {tab === 'lineups' ? (
          <LiveExpandedFixture
            homeSquad={homeSquad}
            awaySquad={awaySquad}
            homeName={homeName}
            awayName={awayName}
            viewport="mobile"
            selectedSide={side}
            onSelectSide={setSide}
            showTabs={false}
            showAutosubs={false}
            onOpenPlayer={ctx.onOpenPlayer}
          />
        ) : null}
        {tab === 'stats' ? (
          <>
            <LiveFixtureKeyStats homeSquad={homeSquad} awaySquad={awaySquad} />
            <LiveFixtureH2hBars
              matches={ctx.matches}
              homeId={homeId}
              awayId={awayId}
              homeName={homeName}
              awayName={awayName}
            />
          </>
        ) : null}
        {tab === 'odds' ? (
          <LiveFixtureOdds
            homeSquad={homeSquad}
            awaySquad={awaySquad}
            homeId={homeId}
            awayId={awayId}
            homeName={homeName}
            awayName={awayName}
            ctx={ctx}
          />
        ) : null}
        {tab === 'table' ? (
          <LiveStandingsTable
            liveStandingsRows={ctx.liveStandingsRows}
            gwStandingsFrozen={ctx.gwStandingsFrozen}
            gameweek={ctx.gameweek}
            teams={ctx.teams}
            teamLogoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
            mobile
          />
        ) : null}
        </div>
      </div>
    </div>
  );
}
