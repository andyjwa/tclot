import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { LiveFixtureCard } from './LiveFixtureCard.jsx';
import { FIXTURE_CARD_TABS } from './liveFixtureCardTabs.js';
import { useOverlayDismissal } from './overlayStack.js';
import './LiveFixtureCard.css';

const TH_AXIS = 8;
const TH_PAGE = 70;
const TH_CLOSE = 110;
/* Flick: a fast short swipe pages/dismisses even under the distance
   thresholds above — matching native pager feel. Velocity is px/ms. */
const TH_FLICK = 0.45;
const TH_MIN_FLICK_DIST = 24;
/* Touches starting within this strip of the left screen edge always mean
   "back" (drag the whole screen out, iOS edge-swipe style) — on EVERY tab,
   not just the first. Without this, an edge swipe on Stats/Odds/Table just
   paged one tab backwards, which read as the gesture not registering. */
const EDGE_CLOSE_PX = 28;
const ANIM_MS = 440;

/** Read the current app theme (set by App on `document.body`). */
function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.body?.dataset?.tclotTheme === 'light' ? 'light' : 'dark';
}

/** Subscribe to `data-tclot-theme` changes on <body> for live theming. */
function subscribeTheme(onChange) {
  if (typeof document === 'undefined') return () => {};
  const obs = new MutationObserver(onChange);
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-tclot-theme'] });
  return () => obs.disconnect();
}

/**
 * Mobile live fixture screen — FotMob-style. Portals to `document.body` and
 * pushes in full-screen FROM THE RIGHT (not a bottom sheet). Horizontal
 * swipes page between the card's tabs (see `FIXTURE_CARD_TABS`: Match /
 * Lineups / Stats / Odds / Table); a rightward swipe on the first tab — or
 * one starting at the left screen edge on ANY tab — drags the whole screen
 * out to dismiss (iOS back-swipe). Fixtures are switched via the pagination
 * dots.
 * Dismissal: back chevron / edge swipe / Esc / system back. Sits below the
 * player detail overlay (z-index 10050) so tapping a player still slides
 * their stats up over the top.
 *
 * @param {{ fixtures: object[], openIndex: number|null, onClose: () => void, ctx: object }} props
 */
export function LiveFixtureCardDeck({ fixtures, openIndex, onClose, ctx }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [index, setIndex] = useState(0);
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark');

  const sheetRef = useRef(null);
  const deckRef = useRef(null);
  const scrimRef = useRef(null);
  const indexRef = useRef(0);
  const tabIndexRef = useRef(0);

  const N = fixtures.length;
  const T = FIXTURE_CARD_TABS.length;

  // Open: mount, jump to the tapped fixture on the first tab, then push the
  // screen in from the right. State updates happen inside rAF callbacks (not
  // synchronously in the effect body) so the first paint stays at
  // translateX(100%) and the is-open class is applied on the next frame to
  // trigger the transition.
  useEffect(() => {
    if (openIndex == null) return undefined;
    const target = Math.max(0, Math.min(openIndex, N - 1));
    const r1 = requestAnimationFrame(() => {
      setMounted(true);
      setIndex(target);
      setTabIndex(0);
      requestAnimationFrame(() => setShown(true));
    });
    return () => cancelAnimationFrame(r1);
  }, [openIndex, N]);

  // External close (parent set openIndex back to null): animate out, unmount.
  useEffect(() => {
    if (openIndex != null || !mounted) return undefined;
    const r = requestAnimationFrame(() => setShown(false));
    const t = setTimeout(() => setMounted(false), ANIM_MS);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [openIndex, mounted]);

  const requestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Esc + Android/browser back close the screen — but only when this is the
  // topmost overlay (a player sheet or team card may be stacked on top).
  useOverlayDismissal(mounted, requestClose, 'lfcSheet');

  // Body scroll lock while open. `overflow: hidden` alone does NOT stop iOS
  // Safari from scrolling/rubber-banding the page behind a fixed overlay,
  // which let the previous page peek through the bottom strip. Pin the body
  // with `position: fixed` (offsetting the saved scroll position) so the page
  // physically can't move, then restore the scroll position on close.
  useEffect(() => {
    if (!mounted) return undefined;
    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [mounted]);

  // Keep the fixture track in sync with the resting index (dot clicks,
  // programmatic open).
  useLayoutEffect(() => {
    indexRef.current = index;
    if (deckRef.current) {
      deckRef.current.style.transform = `translateX(${-index * 100}%)`;
    }
  }, [index, mounted]);

  useLayoutEffect(() => {
    tabIndexRef.current = tabIndex;
  }, [tabIndex]);

  // Gesture handling: horizontal swipes page the active card's TAB panes
  // (FotMob-style left/right to change menu options). A rightward swipe on
  // the first tab, or one starting at the left screen edge on any tab,
  // instead drags the whole screen and dismisses past the threshold.
  // Vertical drags are left to the native pane scrollers.
  // Native (non-passive) listeners so we can preventDefault during drags.
  useEffect(() => {
    if (!mounted) return undefined;
    const sheet = sheetRef.current;
    const deck = deckRef.current;
    const scrim = scrimRef.current;
    if (!sheet || !deck) return undefined;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let axis = null;
    let mode = null; // 'tabs' | 'close'
    let active = false;
    // Flick velocity (px/ms, EMA-smoothed) so a quick short swipe still pages
    // even when it releases under the distance threshold.
    let vx = 0;
    let lastX = 0;
    let lastT = 0;

    const point = (e) => (e.touches ? e.touches[0] : e);
    const activePanes = () =>
      deck.querySelectorAll('.lfc-panes')[indexRef.current] ?? null;

    const onDown = (e) => {
      active = true;
      axis = null;
      mode = null;
      dx = 0;
      dy = 0;
      vx = 0;
      const p = point(e);
      startX = p.clientX;
      startY = p.clientY;
      lastX = p.clientX;
      lastT = performance.now();
    };
    const onMove = (e) => {
      if (!active) return;
      const p = e.touches ? e.touches[0] : e;
      dx = p.clientX - startX;
      dy = p.clientY - startY;
      const now = performance.now();
      if (now > lastT) {
        vx = 0.7 * ((p.clientX - lastX) / (now - lastT)) + 0.3 * vx;
      }
      lastX = p.clientX;
      lastT = now;
      if (!axis && (Math.abs(dx) > TH_AXIS || Math.abs(dy) > TH_AXIS)) {
        // If the browser already claimed this touch for a native scroll the
        // events are no longer cancelable — dragging the track underneath a
        // live scroll is what made the gesture feel like both were moving.
        // Yield instead of fighting it.
        if (e.touches && !e.cancelable) {
          axis = 'y';
        } else {
          axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (axis === 'x') {
          const fromEdge = startX <= EDGE_CLOSE_PX;
          mode =
            dx > 0 && (fromEdge || tabIndexRef.current === 0)
              ? 'close'
              : 'tabs';
        }
      }
      if (axis !== 'x') return;
      if (e.cancelable) e.preventDefault();
      const ti = tabIndexRef.current;
      if (mode === 'close') {
        const d = Math.max(0, dx);
        sheet.classList.add('is-dragging');
        sheet.style.transform = `translateX(${d}px)`;
        /* Fade the dim faster than the sheet travels so Scores is clearly
           the page behind well before the dismiss threshold (not a solid
           grey slab until the sheet is almost gone). */
        if (scrim) scrim.style.opacity = String(Math.max(0, 1 - d / 220));
      } else {
        const track = activePanes();
        if (!track) return;
        track.classList.add('is-dragging');
        let d = dx;
        // Rubber-band resistance past either end of the tab track. (A drag
        // that STARTS rightward on the first tab is captured by the 'close'
        // mode above; this only softens a swing-back past the origin.)
        if ((ti === T - 1 && dx < 0) || (ti === 0 && dx > 0)) d = dx * 0.3;
        track.style.transform = `translateX(calc(${-ti * 100}% + ${d}px))`;
      }
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      if (axis === 'x') {
        const ti = tabIndexRef.current;
        if (mode === 'close') {
          sheet.classList.remove('is-dragging');
          if (scrim) scrim.style.opacity = '';
          if (dx > TH_CLOSE || (dx > 45 && vx > TH_FLICK)) {
            // Finish the swipe off-screen. The inline transform set during
            // the drag overrides the class-based rules, so we must animate it
            // to translateX(100%) here — otherwise removing `is-open` on
            // close can't move the sheet and it stays frozen at the release
            // position.
            sheet.style.transform = 'translateX(100%)';
            requestClose();
          } else {
            // Spring back: clear the inline transform so the `is-open` class
            // rule (translateX(0)) drives the snap-back.
            sheet.style.transform = '';
          }
        } else {
          const track = activePanes();
          track?.classList.remove('is-dragging');
          let next = ti;
          const flickL = dx < -TH_MIN_FLICK_DIST && vx < -TH_FLICK;
          const flickR = dx > TH_MIN_FLICK_DIST && vx > TH_FLICK;
          if ((dx < -TH_PAGE || flickL) && ti < T - 1) next = ti + 1;
          else if ((dx > TH_PAGE || flickR) && ti > 0) next = ti - 1;
          if (track) track.style.transform = `translateX(${-next * 100}%)`;
          if (next !== ti) setTabIndex(next);
        }
      }
      axis = null;
      mode = null;
    };

    sheet.addEventListener('touchstart', onDown, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onUp);
    sheet.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      sheet.removeEventListener('touchstart', onDown);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onUp);
      sheet.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [mounted, T, requestClose]);

  const activeTabId = FIXTURE_CARD_TABS[tabIndex]?.id ?? FIXTURE_CARD_TABS[0].id;
  const handleTabChange = useCallback((id) => {
    const i = FIXTURE_CARD_TABS.findIndex((t) => t.id === id);
    if (i >= 0) setTabIndex(i);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={'fotmob lfc-root' + (shown ? ' is-open' : '')} data-theme={theme}>
      <div
        ref={scrimRef}
        className="lfc-scrim"
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="lfc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Live fixture"
      >
        <div className="lfc-viewport">
          <div ref={deckRef} className="lfc-deck">
            {fixtures.map((fx) => (
              <div className="lfc-page" key={fx.key}>
                <LiveFixtureCard
                  fixture={fx}
                  ctx={ctx}
                  tab={activeTabId}
                  onTabChange={handleTabChange}
                  onBack={requestClose}
                />
              </div>
            ))}
          </div>
        </div>
        {/* Subtle bottom-left back — thumb-reachable exit, present on every tab. */}
        <button
          type="button"
          className="lfc-back-bottom"
          aria-label="Back"
          onClick={requestClose}
        >
          <span aria-hidden="true">‹</span>
        </button>
        {N > 1 ? (
          <div className="lfc-dots" role="tablist" aria-label="Fixtures">
            {fixtures.map((fx, i) => (
              <button
                key={fx.key}
                type="button"
                role="tab"
                className={'lfc-dot' + (i === index ? ' is-on' : '')}
                aria-label={`Go to fixture ${i + 1}`}
                aria-selected={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
